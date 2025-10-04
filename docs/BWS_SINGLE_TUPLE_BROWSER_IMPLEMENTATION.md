# BWS Single-Tuple Browser - Implementation Guide

**Document Version:** 1.0
**Date:** 2025-10-04
**Status:** Ready for Implementation
**Target:** Implementation Agent

---

## Executive Summary

**Goal:** Enable users to browse AI ratings in the native single-tuple BWS interface (4 videos at a time) with navigation controls and AI judgment overlays.

**What This Fixes:**
- ❌ Previous approach: Scrollable list showing all 580 tuples → 2,320 video elements → browser limit errors
- ✅ Correct approach: Single-tuple view showing 4 videos at a time → no limit errors, reuses existing code

**Core Concept:**
- Use the **existing** single-tuple rating interface (already has 4-video grid, hover effects, etc.)
- Add AI judgment overlays (green BEST border, red WORST border, reasoning text)
- Add navigation controls (Next/Prev/Skip buttons)
- Add filter dropdown (All / AI-Rated / Unrated / Human-Rated)
- Add blind mode toggle (hide AI overlays for unbiased rating)

**Estimated Time:** 2-3 hours

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Design Overview](#2-design-overview)
3. [Implementation Steps](#3-implementation-steps)
4. [Code Changes Required](#4-code-changes-required)
5. [Testing Checklist](#5-testing-checklist)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Current State Analysis

### What Already Works

**Existing single-tuple view** (`index-advanced.html` line 1319-1330):
- ✅ 4-video grid layout
- ✅ Hover effects on videos
- ✅ Click to expand/detail view
- ✅ BEST/WORST selection for human rating
- ✅ Submit judgment functionality

**What's missing:**
- ❌ AI judgment overlays (green/red borders showing what AI picked)
- ❌ AI reasoning display
- ❌ Navigation controls (Next/Prev/Skip)
- ❌ Filter to jump to specific tuple types
- ❌ Blind mode toggle

### File Structure

```
src/bws-manager.js
├── Line 898-949: startHumanBWSRating() - Entry point for human rating
├── Line 1137-1249: loadNextBWSTuple() - Loads a single tuple
├── Line 1251-1425: renderBWSItemCard() - Renders each video card
├── Line 1657-1715: submitBWSJudgment() - Submits human rating
└── Line 2358-2850: List view code (WE WON'T USE THIS)

index-advanced.html
├── Line 1319-1330: Single-tuple rating view container
└── Line 1327: bws-rating-items-grid (where 4 videos appear)
```

---

## 2. Design Overview

### Visual Mockup

```
┌────────────────────────────────────────────────────────────────┐
│ BWS Rating - Experiment: anatolian-actuals                     │
│ Progress: 45/580 rated (8%)                            [Exit]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 🤖 AI Rating: 45/580 (8%) ████░░░░░░░░░░░░░░            │ │ ← Inline banner (already exists)
│ └───────────────────────────────────────────────────────────┘ │
│                                                                │
│ [Filter: All ▼]  [👁 Blind Mode: OFF]                         │
│                                                                │
│ Tuple #23 - ✅ AI Rated (2m ago) | ⚪ Not rated by you        │
│                                                                │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────┐│
│ │ Video 1      │  │ Video 2      │  │ Video 3      │  │ V4  ││
│ │ [Video plays │  │ [Video plays │  │ [Video plays │  │     ││
│ │  on hover]   │  │  on hover]   │  │  on hover]   │  │     ││
│ │              │  │              │  │              │  │     ││
│ │ 🔴 WORST     │  │              │  │ 🟢 BEST      │  │     ││ ← AI overlay (if not blind)
│ │ (AI picked)  │  │              │  │ (AI picked)  │  │     ││
│ └──────────────┘  └──────────────┘  └──────────────┘  └─────┘│
│                                                                │
│ 🤖 AI Reasoning: "Video 3 shows energetic dog playing,        │
│    Video 1 shows calm interview - clear energy contrast"      │
│                                                                │
│ [← Prev]  [Rate as Human]  [Skip Unrated]  [Next →]          │
└────────────────────────────────────────────────────────────────┘
```

### User Flow

**Scenario 1: Browsing AI ratings (passive)**
1. User starts AI experiment
2. Inline progress banner shows: "🤖 AI Rating: 0/580 (0%)"
3. User clicks filter: "AI-Rated" (to only see completed tuples)
4. First AI-rated tuple appears with green/red borders
5. User reads AI reasoning
6. User clicks "Next" → Shows next AI-rated tuple
7. Repeat steps 5-6 to browse through AI ratings

**Scenario 2: Rating with AI guidance (active)**
1. User starts AI experiment (AI running in background)
2. User clicks filter: "Unrated" (to rate tuples AI hasn't done yet)
3. Tuple appears without AI overlays (AI hasn't rated this yet)
4. User selects BEST/WORST based on their own judgment
5. User submits judgment
6. Next unrated tuple loads automatically

**Scenario 3: Blind rating (unbiased)**
1. User enables "Blind Mode"
2. AI overlays disappear (green/red borders hidden)
3. User rates tuples without seeing what AI picked
4. After rating, user disables blind mode to see AI's choice
5. Compare AI vs Human choices (agreement indicator shows)

---

## 3. Implementation Steps

### Step 1: Hide Scrollable List View

**Goal:** Remove the scrollable list interface (wrong approach) and show only single-tuple view

**File:** `src/bws-manager.js`

**Find:** `initializeBWSListView()` function (around line 2378)

**Change:** Comment out the list view initialization

```javascript
function initializeBWSListView(experimentId) {
  // DEPRECATED: Using single-tuple browser instead of list view
  // This was causing video player limit errors (2320 videos at once)
  console.log('[initializeBWSListView] Skipped - using single-tuple browser');
  return;

  // ... rest of function commented out or deleted
}
```

**Result:** List view won't render, freeing up the interface for single-tuple view

---

### Step 2: Modify `loadNextBWSTuple()` to Support Navigation

**Goal:** Load specific tuples by index/filter, not just "next unrated"

**File:** `src/bws-manager.js`

**Current function signature** (line 1137):
```javascript
async function loadNextBWSTuple() {
  // Only loads next unrated tuple
}
```

**New function signature:**
```javascript
async function loadBWSTuple(options = {}) {
  const {
    tupleIndex = null,      // Load specific tuple by index (0-based)
    direction = 'next',     // 'next' or 'prev'
    filter = 'all'          // 'all', 'ai-rated', 'unrated', 'human-rated'
  } = options;

  // Get current experiment
  const experimentId = bwsRatingState.experimentId;
  if (!experimentId) {
    console.error('[loadBWSTuple] No experiment ID');
    return;
  }

  try {
    // Get all tuples for this experiment
    const allTuples = await window.api.bws.getAllTuples({ experimentId });

    // Get AI judgments
    const aiJudgments = await window.api.bws.getJudgments({
      experimentId,
      raterType: 'ai'
    });

    // Get human judgments
    const humanJudgments = await window.api.bws.getJudgments({
      experimentId,
      raterType: 'human',
      raterId: bwsRatingState.raterId || 'default-rater'
    });

    // Build judgment maps
    const aiJudgmentMap = new Map();
    aiJudgments.forEach(j => aiJudgmentMap.set(j.tuple_id, j));

    const humanJudgmentMap = new Map();
    humanJudgments.forEach(j => humanJudgmentMap.set(j.tuple_id, j));

    // Filter tuples based on filter option
    let filteredTuples = allTuples;

    if (filter === 'ai-rated') {
      filteredTuples = allTuples.filter(t => aiJudgmentMap.has(t.id));
    } else if (filter === 'unrated') {
      filteredTuples = allTuples.filter(t =>
        !aiJudgmentMap.has(t.id) && !humanJudgmentMap.has(t.id)
      );
    } else if (filter === 'human-rated') {
      filteredTuples = allTuples.filter(t => humanJudgmentMap.has(t.id));
    }

    if (filteredTuples.length === 0) {
      showNotification('No tuples match the current filter', 'info');
      return;
    }

    // Determine which tuple to load
    let targetTupleIndex;

    if (tupleIndex !== null) {
      // Load specific tuple
      targetTupleIndex = tupleIndex;
    } else {
      // Navigate from current tuple
      const currentIndex = bwsRatingState.currentTupleIndex || 0;

      if (direction === 'next') {
        targetTupleIndex = (currentIndex + 1) % filteredTuples.length;
      } else if (direction === 'prev') {
        targetTupleIndex = (currentIndex - 1 + filteredTuples.length) % filteredTuples.length;
      }
    }

    // Store current state
    bwsRatingState.currentTupleIndex = targetTupleIndex;
    bwsRatingState.currentFilter = filter;
    bwsRatingState.filteredTuples = filteredTuples;

    // Load the tuple
    const tupleToLoad = filteredTuples[targetTupleIndex];
    const tupleWithItems = await window.api.bws.getTupleWithItems({ tupleId: tupleToLoad.id });

    // Get judgments for this tuple
    const aiJudgment = aiJudgmentMap.get(tupleToLoad.id);
    const humanJudgment = humanJudgmentMap.get(tupleToLoad.id);

    // Render the tuple
    renderBWSTuple(tupleWithItems, aiJudgment, humanJudgment);

    // Update navigation UI
    updateNavigationUI(targetTupleIndex, filteredTuples.length);

  } catch (error) {
    console.error('[loadBWSTuple] Error:', error);
    showNotification('Failed to load tuple', 'error');
  }
}
```

**Why this is better:**
- ✅ Can load specific tuple by index
- ✅ Supports Next/Prev navigation
- ✅ Respects filter (only show AI-rated, unrated, etc.)
- ✅ Preloads AI/human judgments to show overlays

---

### Step 3: Create `renderBWSTuple()` Function

**Goal:** Render a single tuple with AI judgment overlays

**File:** `src/bws-manager.js`

**Add this new function** (after `loadBWSTuple()`):

```javascript
/**
 * Render a single BWS tuple with AI/human judgment overlays
 */
function renderBWSTuple(tuple, aiJudgment, humanJudgment) {
  // Get container
  const itemsGrid = document.getElementById('bws-rating-items-grid');
  const singleRatingView = document.getElementById('bws-single-rating-view');

  if (!itemsGrid || !singleRatingView) {
    console.error('[renderBWSTuple] Required elements not found');
    return;
  }

  // Show single-rating view
  singleRatingView.style.display = 'block';

  // Update tuple info header
  updateTupleInfoHeader(tuple, aiJudgment, humanJudgment);

  // Clear existing items
  itemsGrid.innerHTML = '';

  // Render each item
  tuple.items.forEach((item, index) => {
    const itemCard = renderBWSItemCard(item, index, aiJudgment, humanJudgment);
    itemsGrid.appendChild(itemCard);
  });

  // Display AI reasoning (if exists and blind mode off)
  displayAIReasoning(aiJudgment);

  // Update action buttons
  updateActionButtons(humanJudgment);
}

/**
 * Update tuple info header
 */
function updateTupleInfoHeader(tuple, aiJudgment, humanJudgment) {
  // Create/update header element (add to HTML if doesn't exist)
  let header = document.getElementById('bws-tuple-info-header');

  if (!header) {
    // Create header element
    header = document.createElement('div');
    header.id = 'bws-tuple-info-header';
    header.className = 'bws-tuple-info-header';

    // Insert before single-rating-view
    const singleView = document.getElementById('bws-single-rating-view');
    singleView.parentNode.insertBefore(header, singleView);
  }

  // Determine status
  let statusHTML = '';

  if (aiJudgment && humanJudgment) {
    statusHTML = '<span class="status-both">✅ AI + Human Rated</span>';
  } else if (aiJudgment) {
    const timeAgo = getTimeAgo(aiJudgment.created_at);
    statusHTML = `<span class="status-ai">🤖 AI Rated (${timeAgo})</span>`;
  } else if (humanJudgment) {
    const timeAgo = getTimeAgo(humanJudgment.created_at);
    statusHTML = `<span class="status-human">👤 You Rated (${timeAgo})</span>`;
  } else {
    statusHTML = '<span class="status-unrated">⚪ Not Rated</span>';
  }

  // Agreement indicator (if both rated)
  let agreementHTML = '';
  if (aiJudgment && humanJudgment) {
    const bestAgree = aiJudgment.best_item_id === humanJudgment.best_item_id;
    const worstAgree = aiJudgment.worst_item_id === humanJudgment.worst_item_id;
    const agreementPct = (bestAgree && worstAgree) ? 100 : (bestAgree || worstAgree) ? 50 : 0;

    const icon = agreementPct === 100 ? '✅' : agreementPct === 50 ? '⚠️' : '❌';
    const text = agreementPct === 100 ? 'Perfect Agreement' :
                 agreementPct === 50 ? 'Partial Agreement' :
                 'Disagreement';

    agreementHTML = `
      <span class="agreement-indicator agreement-${agreementPct}">
        ${icon} ${text} (${agreementPct}%)
      </span>
    `;
  }

  header.innerHTML = `
    <div class="tuple-header-left">
      <h3>Tuple #${tuple.id}</h3>
      ${statusHTML}
    </div>
    <div class="tuple-header-right">
      ${agreementHTML}
    </div>
  `;
}

/**
 * Display AI reasoning
 */
function displayAIReasoning(aiJudgment) {
  // Get or create reasoning container
  let reasoningContainer = document.getElementById('bws-ai-reasoning-display');

  if (!reasoningContainer) {
    // Create container
    reasoningContainer = document.createElement('div');
    reasoningContainer.id = 'bws-ai-reasoning-display';
    reasoningContainer.className = 'bws-ai-reasoning-display';

    // Insert after items grid
    const itemsGrid = document.getElementById('bws-rating-items-grid');
    itemsGrid.parentNode.insertBefore(reasoningContainer, itemsGrid.nextSibling);
  }

  // Check blind mode
  const blindMode = document.getElementById('bws-blind-mode')?.checked || false;

  if (aiJudgment && aiJudgment.reasoning && !blindMode) {
    reasoningContainer.style.display = 'block';
    reasoningContainer.innerHTML = `
      <div class="reasoning-label">🤖 AI Reasoning:</div>
      <div class="reasoning-text">${aiJudgment.reasoning}</div>
    `;
  } else {
    reasoningContainer.style.display = 'none';
  }
}

/**
 * Update action buttons based on rating state
 */
function updateActionButtons(humanJudgment) {
  const submitBtn = document.getElementById('bws-rating-submit-btn');
  const skipBtn = document.getElementById('bws-rating-skip-btn');

  if (humanJudgment) {
    // Already rated by human - change button text
    if (submitBtn) {
      submitBtn.textContent = 'Update Rating';
      submitBtn.disabled = false;
    }
  } else {
    // Not rated - normal submit
    if (submitBtn) {
      submitBtn.textContent = 'Submit Judgment';
      submitBtn.disabled = true; // Enable when BEST/WORST selected
    }
  }
}
```

---

### Step 4: Modify `renderBWSItemCard()` to Add AI Overlays

**Goal:** Add green/red borders showing AI's BEST/WORST choices

**File:** `src/bws-manager.js`

**Current function** (around line 1251):
```javascript
function renderBWSItemCard(item, index) {
  // Creates video card without AI overlays
}
```

**Modified function:**
```javascript
function renderBWSItemCard(item, index, aiJudgment, humanJudgment) {
  const card = document.createElement('div');
  card.className = 'bws-rating-item-card';
  card.dataset.itemId = item.id;
  card.dataset.index = index;

  // Check blind mode
  const blindMode = document.getElementById('bws-blind-mode')?.checked || false;

  // Determine if this item is BEST/WORST (AI)
  let aiBadgeHTML = '';
  let aiHighlightClass = '';

  if (aiJudgment && !blindMode) {
    if (item.id === aiJudgment.best_item_id) {
      aiHighlightClass = 'ai-best-overlay';
      aiBadgeHTML = '<div class="ai-badge badge-best">🟢 BEST (AI)</div>';
    } else if (item.id === aiJudgment.worst_item_id) {
      aiHighlightClass = 'ai-worst-overlay';
      aiBadgeHTML = '<div class="ai-badge badge-worst">🔴 WORST (AI)</div>';
    }
  }

  // Determine if this item is BEST/WORST (Human)
  let humanBadgeHTML = '';
  let humanHighlightClass = '';

  if (humanJudgment) {
    if (item.id === humanJudgment.best_item_id) {
      humanHighlightClass = 'human-best-overlay';
      humanBadgeHTML = '<div class="human-badge badge-best">✓ BEST (You)</div>';
    } else if (item.id === humanJudgment.worst_item_id) {
      humanHighlightClass = 'human-worst-overlay';
      humanBadgeHTML = '<div class="human-badge badge-worst">✗ WORST (You)</div>';
    }
  }

  // Combine highlight classes
  if (aiHighlightClass) card.classList.add(aiHighlightClass);
  if (humanHighlightClass) card.classList.add(humanHighlightClass);

  // Build content based on item type
  const isVideo = item.item_type === 'video_chunk';

  if (isVideo) {
    // Video item
    const videoElement = document.createElement('video');
    videoElement.src = item.file_path;
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.className = 'bws-item-video';

    // Hover to play
    videoElement.addEventListener('mouseenter', () => {
      videoElement.play();
    });

    videoElement.addEventListener('mouseleave', () => {
      videoElement.pause();
      videoElement.currentTime = 0;
    });

    card.appendChild(videoElement);

    // Transcript overlay
    if (item.transcript_text) {
      const transcriptDiv = document.createElement('div');
      transcriptDiv.className = 'bws-item-transcript';
      transcriptDiv.textContent = item.transcript_text.substring(0, 100) + '...';
      card.appendChild(transcriptDiv);
    }
  } else {
    // Comment item
    const textDiv = document.createElement('div');
    textDiv.className = 'bws-item-text';
    textDiv.textContent = item.text || 'No content';
    card.appendChild(textDiv);
  }

  // Add AI badge (if exists)
  if (aiBadgeHTML) {
    const badgeDiv = document.createElement('div');
    badgeDiv.innerHTML = aiBadgeHTML;
    card.appendChild(badgeDiv.firstChild);
  }

  // Add human badge (if exists)
  if (humanBadgeHTML) {
    const badgeDiv = document.createElement('div');
    badgeDiv.innerHTML = humanBadgeHTML;
    card.appendChild(badgeDiv.firstChild);
  }

  // Click handler for selection (existing BEST/WORST logic)
  card.addEventListener('click', () => {
    handleItemSelection(card, item.id);
  });

  return card;
}
```

**Key changes:**
- Added `aiJudgment` and `humanJudgment` parameters
- Added AI overlay classes (`ai-best-overlay`, `ai-worst-overlay`)
- Added AI badges (green BEST, red WORST)
- Respects blind mode (hides overlays when enabled)

---

### Step 5: Add Navigation Controls UI

**Goal:** Add Next/Prev/Skip buttons to HTML

**File:** `index-advanced.html`

**Find:** `<div class="bws-rating-actions">` (around line 1333)

**Replace with:**
```html
<!-- Navigation and Action Buttons -->
<div class="bws-navigation-bar">
  <div class="bws-nav-left">
    <button id="bws-nav-prev-btn" class="btn btn-secondary">
      ← Previous
    </button>
  </div>

  <div class="bws-nav-center">
    <button id="bws-rating-submit-btn" class="btn btn-primary" disabled>
      Submit Judgment
    </button>
    <button id="bws-rating-skip-btn" class="btn btn-secondary">
      Skip
    </button>
  </div>

  <div class="bws-nav-right">
    <button id="bws-nav-next-btn" class="btn btn-secondary">
      Next →
    </button>
  </div>
</div>

<!-- Progress indicator -->
<div id="bws-tuple-position" class="bws-tuple-position">
  Tuple <span id="bws-current-index">1</span> of <span id="bws-total-count">0</span>
</div>
```

---

### Step 6: Wire Up Navigation Event Listeners

**Goal:** Make Next/Prev/Skip buttons work

**File:** `src/bws-manager.js`

**Add this function** (after `renderBWSTuple()`):

```javascript
/**
 * Setup navigation event listeners
 */
function setupBWSNavigation() {
  // Next button
  document.getElementById('bws-nav-next-btn')?.addEventListener('click', () => {
    const filter = bwsRatingState.currentFilter || 'all';
    loadBWSTuple({ direction: 'next', filter });
  });

  // Previous button
  document.getElementById('bws-nav-prev-btn')?.addEventListener('click', () => {
    const filter = bwsRatingState.currentFilter || 'all';
    loadBWSTuple({ direction: 'prev', filter });
  });

  // Skip button (skip to next unrated)
  document.getElementById('bws-rating-skip-btn')?.addEventListener('click', () => {
    loadBWSTuple({ direction: 'next', filter: 'unrated' });
  });

  // Filter dropdown
  document.getElementById('bws-filter-mode')?.addEventListener('change', (e) => {
    const filter = e.target.value;
    loadBWSTuple({ tupleIndex: 0, filter }); // Load first tuple of filtered set
  });

  // Blind mode toggle
  document.getElementById('bws-blind-mode')?.addEventListener('change', (e) => {
    const blindMode = e.target.checked;

    // Update label
    const label = document.getElementById('bws-blind-mode-label');
    if (label) {
      label.textContent = blindMode ? '🙈 Blind Mode: ON' : '👁 Blind Mode: OFF';
    }

    // Re-render current tuple to hide/show AI overlays
    const currentTuple = bwsRatingState.currentTuple;
    const aiJudgment = bwsRatingState.currentAIJudgment;
    const humanJudgment = bwsRatingState.currentHumanJudgment;

    if (currentTuple) {
      renderBWSTuple(currentTuple, aiJudgment, humanJudgment);
    }
  });
}

/**
 * Update navigation UI (position counter)
 */
function updateNavigationUI(currentIndex, totalCount) {
  const currentIndexElement = document.getElementById('bws-current-index');
  const totalCountElement = document.getElementById('bws-total-count');

  if (currentIndexElement) {
    currentIndexElement.textContent = currentIndex + 1; // Display 1-based
  }

  if (totalCountElement) {
    totalCountElement.textContent = totalCount;
  }

  // Enable/disable prev button
  const prevBtn = document.getElementById('bws-nav-prev-btn');
  if (prevBtn) {
    prevBtn.disabled = (currentIndex === 0);
  }

  // Enable/disable next button
  const nextBtn = document.getElementById('bws-nav-next-btn');
  if (nextBtn) {
    nextBtn.disabled = (currentIndex === totalCount - 1);
  }
}
```

**Call this function** in `startHumanBWSRating()` (line 898):

```javascript
async function startHumanBWSRating(experimentId, experiment) {
  // ... existing code ...

  // ✅ ADD THIS LINE:
  setupBWSNavigation();

  // Load first tuple
  await loadBWSTuple({ tupleIndex: 0, filter: 'all' });
}
```

---

### Step 7: Add CSS Styles for Overlays

**Goal:** Style AI/human overlays (green/red borders, badges)

**File:** `src/styles/rating-projects.css`

**Add these styles:**

```css
/* ============================================
   BWS Single-Tuple Browser - AI Overlays
   ============================================ */

/* Tuple info header */
.bws-tuple-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.tuple-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tuple-header-left h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.status-ai {
  color: #3b82f6;
  font-weight: 600;
}

.status-human {
  color: #10b981;
  font-weight: 600;
}

.status-both {
  color: #8b5cf6;
  font-weight: 600;
}

.status-unrated {
  color: var(--text-secondary);
}

/* Agreement indicator */
.agreement-indicator {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
}

.agreement-100 {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid #10b981;
}

.agreement-50 {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  border: 1px solid #fbbf24;
}

.agreement-0 {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid #ef4444;
}

/* AI overlay on video cards */
.ai-best-overlay {
  border: 3px solid #10b981 !important;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
}

.ai-worst-overlay {
  border: 3px solid #ef4444 !important;
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
}

.human-best-overlay {
  border: 3px solid #3b82f6 !important;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.human-worst-overlay {
  border: 3px solid #f97316 !important;
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.5);
}

/* AI/Human badges */
.ai-badge,
.human-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 700;
  z-index: 10;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.ai-badge.badge-best {
  background: #10b981;
  color: white;
}

.ai-badge.badge-worst {
  background: #ef4444;
  color: white;
}

.human-badge.badge-best {
  background: #3b82f6;
  color: white;
  top: 48px; /* Stack below AI badge if both exist */
}

.human-badge.badge-worst {
  background: #f97316;
  color: white;
  top: 48px;
}

/* AI reasoning display */
.bws-ai-reasoning-display {
  padding: 1rem;
  margin-top: 1rem;
  background: rgba(59, 130, 246, 0.1);
  border-left: 4px solid #3b82f6;
  border-radius: 6px;
}

.reasoning-label {
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 0.5rem;
}

.reasoning-text {
  color: var(--text-primary);
  line-height: 1.6;
}

/* Navigation bar */
.bws-navigation-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  gap: 1rem;
}

.bws-nav-left,
.bws-nav-center,
.bws-nav-right {
  display: flex;
  gap: 0.5rem;
}

.bws-nav-center {
  flex: 1;
  justify-content: center;
}

/* Tuple position indicator */
.bws-tuple-position {
  text-align: center;
  margin-top: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.bws-tuple-position span {
  color: var(--text-primary);
  font-weight: 600;
}

/* Blind mode active state */
.bws-rating-interface.blind-mode-active .ai-badge,
.bws-rating-interface.blind-mode-active .ai-best-overlay,
.bws-rating-interface.blind-mode-active .ai-worst-overlay {
  display: none !important;
  border: 2px solid var(--border) !important;
  box-shadow: none !important;
}
```

---

### Step 8: Update `startAIBWSRating()` to Initialize Single-Tuple Browser

**Goal:** When AI experiment starts, show single-tuple view (not list view)

**File:** `src/bws-manager.js`

**Find:** `startAIBWSRating()` function (around line 815)

**Modify:**
```javascript
async function startAIBWSRating(experimentId, experiment) {
  try {
    // Show confirmation
    const confirmed = confirm(
      `Start AI rating for "${experiment.name}"?\n\n` +
      `This will process ${experiment.total_tuples} comparisons using Gemini AI.\n\n` +
      `You can browse results in real-time using the single-tuple viewer.`
    );
    if (!confirmed) return;

    // Store current experiment ID
    window.currentAIRatingExperimentId = experimentId;

    // ✅ Initialize single-tuple browser (NOT list view)
    setupBWSNavigation();

    // ✅ Show inline progress banner
    showInlineAIProgress(experimentId, experiment);

    // Setup progress listeners to update banner
    setupInlineAIProgressListeners();

    // Load first tuple (user can browse while AI runs)
    await loadBWSTuple({ tupleIndex: 0, filter: 'all' });

    // Start AI rating (runs in background)
    const result = await window.api.bws.startAIRating({ experimentId });

    if (!result.success) {
      hideInlineAIProgress();
      showNotification(`AI rating failed: ${result.error}`, 'error');
      window.currentAIRatingExperimentId = null;
    }

  } catch (error) {
    console.error('Error starting AI BWS rating:', error);
    hideInlineAIProgress();
    showNotification('Failed to start AI rating', 'error');
    window.currentAIRatingExperimentId = null;
  }
}
```

**Key changes:**
- Calls `setupBWSNavigation()` instead of `initializeBWSListView()`
- Loads first tuple with `loadBWSTuple()`
- User can immediately start browsing while AI runs in background

---

## 5. Testing Checklist

### Test 1: AI Rating with Single-Tuple Browser

**Steps:**
1. Start app: `npm run dev`
2. Go to BWS tab
3. Create new experiment (AI rater, any collection)
4. Click "Start Rating"

**Expected:**
- [x] Inline progress banner appears: "🤖 AI Rating: 0/580 (0%)"
- [x] Single-tuple view shows with 4 videos
- [x] First tuple loads (no AI overlay yet - not rated)
- [x] Next/Prev buttons visible
- [x] Console shows NO video limit errors

---

### Test 2: Navigation Controls

**Steps:**
1. From Test 1, AI is running
2. Wait for 5-10 tuples to be AI-rated
3. Click filter: "AI-Rated"
4. Click "Next" button multiple times

**Expected:**
- [x] Each click loads next AI-rated tuple
- [x] Green/red borders appear on BEST/WORST
- [x] AI reasoning displays below videos
- [x] Position indicator updates: "Tuple 2 of 10", "Tuple 3 of 10", etc.
- [x] Prev button disabled at first tuple
- [x] Next button disabled at last tuple

---

### Test 3: Blind Mode

**Steps:**
1. From Test 2, viewing an AI-rated tuple
2. Green/red borders visible
3. Click "Blind Mode" toggle

**Expected:**
- [x] Green/red borders disappear
- [x] AI badges (🟢 BEST, 🔴 WORST) hidden
- [x] AI reasoning hidden
- [x] Videos still playable on hover
- [x] Can still select BEST/WORST for human rating

---

### Test 4: Human Rating After AI

**Steps:**
1. Filter: "AI-Rated"
2. View an AI-rated tuple
3. Select your own BEST/WORST (different from AI)
4. Click "Submit Judgment"

**Expected:**
- [x] Judgment saves successfully
- [x] Both AI and human overlays now visible
- [x] Agreement indicator shows: "❌ Disagreement (0%)"
- [x] Next tuple loads automatically

---

### Test 5: Live Updates

**Steps:**
1. Start AI rating
2. Immediately set filter: "Unrated"
3. Browse unrated tuples
4. Wait for AI to finish rating some tuples

**Expected:**
- [x] Progress banner updates in real-time
- [x] When you navigate back to a tuple AI just rated, overlays appear
- [x] Filter counts update (fewer unrated, more AI-rated)

---

### Test 6: Performance

**Steps:**
1. Start AI rating with 580 tuples
2. Open DevTools → Console
3. Browse through 20-30 tuples rapidly

**Expected:**
- [x] ZERO `[Intervention]` video limit errors
- [x] Only 4 video elements exist at any time (check Elements tab)
- [x] Navigation is instant (<100ms per tuple)
- [x] No memory leaks (Memory usage stable)

---

## 6. Troubleshooting

### Issue: Navigation buttons not working

**Symptom:** Clicking Next/Prev does nothing

**Diagnosis:**
1. Check console for errors
2. Verify `setupBWSNavigation()` is called
3. Check if event listeners attached

**Fix:**
```javascript
// In startHumanBWSRating() or startAIBWSRating()
setupBWSNavigation(); // Make sure this is called
```

---

### Issue: AI overlays not showing

**Symptom:** No green/red borders on AI-rated tuples

**Diagnosis:**
1. Check if `aiJudgment` parameter is passed to `renderBWSItemCard()`
2. Verify blind mode is OFF
3. Check CSS classes are applied

**Fix:**
```javascript
// In renderBWSTuple()
tuple.items.forEach((item, index) => {
  const itemCard = renderBWSItemCard(item, index, aiJudgment, humanJudgment);
  //                                              ^^^^^^^^^^^^^ Make sure these are passed
});
```

---

### Issue: Filter not working

**Symptom:** Filter dropdown doesn't change which tuples show

**Diagnosis:**
1. Check if filter event listener is set up
2. Verify `loadBWSTuple({ filter })` is called with correct filter value

**Fix:**
```javascript
// In setupBWSNavigation()
document.getElementById('bws-filter-mode')?.addEventListener('change', (e) => {
  const filter = e.target.value; // 'all', 'ai-rated', 'unrated', etc.
  loadBWSTuple({ tupleIndex: 0, filter });
});
```

---

### Issue: Videos not playing on hover

**Symptom:** Hover over video does nothing

**Diagnosis:**
1. Check if video element created correctly
2. Verify mouseenter/mouseleave listeners attached

**Fix:**
```javascript
// In renderBWSItemCard()
videoElement.addEventListener('mouseenter', () => {
  videoElement.play();
});

videoElement.addEventListener('mouseleave', () => {
  videoElement.pause();
  videoElement.currentTime = 0;
});
```

---

## Summary

**What you're building:**
- Single-tuple browser showing 4 videos at a time (reusing existing human rating interface)
- AI judgment overlays (green/red borders, badges, reasoning)
- Navigation controls (Next/Prev/Skip)
- Filter dropdown (All / AI-Rated / Unrated / Human-Rated)
- Blind mode toggle (hide AI overlays)
- Inline progress banner (shows AI rating in real-time)

**Key benefits:**
- ✅ Only 4 video elements ever exist (no browser limits)
- ✅ Reuses existing well-tested code
- ✅ Native BWS interface (familiar to users)
- ✅ Simple implementation (2-3 hours vs 1-2 days for scrollable list)
- ✅ Better UX (focused on one comparison at a time)

**Files to modify:**
1. `src/bws-manager.js` - Main logic (7 functions to add/modify)
2. `index-advanced.html` - Navigation UI (1 section to update)
3. `src/styles/rating-projects.css` - AI overlay styles (~100 lines)

**Ready to implement!** 🚀
