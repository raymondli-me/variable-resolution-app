# BWS Live List Viewer - Implementation Guide

**Document Version:** 2.0
**Date:** 2025-10-04
**Status:** Ready for Phase 2 Implementation
**Target:** Implementation Agent

---

## Executive Summary

This document provides complete instructions for implementing a **live scrollable list view** for BWS (Best-Worst Scaling) experiments that shows AI and human ratings in real-time. The user wants to browse AI ratings as they're generated, with the ability to filter, enable blind mode, and rate tuples inline.

### What's Been Completed

✅ **Phase 1A - Core Infrastructure:**
- Scrollable list view UI components (HTML/CSS)
- Filter controls (All / Unrated / AI-Rated / Human-Rated)
- Blind mode toggle
- Auto-refresh polling (every 2 seconds)
- Backend APIs (getAllTuples, getJudgments)
- Visual highlights (green BEST, red WORST borders)
- Agreement indicators when both AI and Human rate same tuple

### What's Broken (Needs Immediate Fix)

❌ **Critical Issue: List View Invisible for AI Experiments**
- List view only initializes for human experiments
- AI experiments show full-screen blocking overlay instead
- User cannot see live ratings appearing

### What Needs Implementation (This Document)

🎯 **Phase 2 - Polished UX (THIS TASK):**
- Initialize list view for AI experiments
- Replace blocking overlay with inline progress banner
- Show live ratings as AI processes them
- Smooth, non-intrusive progress indicator
- Complete end-to-end workflow

---

## Table of Contents

1. [Background: The Journey](#1-background-the-journey)
2. [Architecture Overview](#2-architecture-overview)
3. [Critical Bugs Fixed](#3-critical-bugs-fixed)
4. [Current Problem: Invisible List View](#4-current-problem-invisible-list-view)
5. [Phase 2 Implementation Plan](#5-phase-2-implementation-plan)
6. [Code Changes Required](#6-code-changes-required)
7. [Testing Checklist](#7-testing-checklist)
8. [Troubleshooting](#8-troubleshooting)
9. [Future Enhancements](#9-future-enhancements)

---

## 1. Background: The Journey

### User's Goal

> "I want to browse what the AI has rated in the native human BWS interface... kind of like live... with a spot for the explanations... and UI highlights for best and worst... and the ability to turn on and off the AI visibility so that we can do blind rating if we want."

### Key Requirements

1. **Live browsing**: See AI ratings appear in real-time as AI processes tuples
2. **Native interface**: Use the same interface for browsing and rating
3. **Blind mode**: Toggle to hide AI judgments for unbiased human rating
4. **Visual highlights**: Green borders for BEST, red borders for WORST
5. **AI explanations**: Show Gemini's reasoning prominently
6. **Filtering**: View all tuples, or filter by rating status
7. **Agreement analysis**: When both AI and Human rate same tuple, show agreement %

### Design Decision: Inline Integration vs Separate Viewer

After analysis, we chose **Option D: Inline Integration**:
- Scrollable list of tuples (5-10 visible at once)
- Each tuple shows as a card with videos, ratings, and AI reasoning
- Same interface for browsing AI ratings and human rating
- No context switching between views

**Rejected alternatives:**
- Option A: Overlay modal (too small, blocks content)
- Option B: New tab/section (context switching)
- Option C: Side panel (cramped on small screens)

---

## 2. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│ BWS Rating Interface                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Filter: All ▼] [🔄 Auto-refresh] [👁 Blind Mode]    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🤖 AI Rating: 9/580 (2%) ████░░░░░░░░░░░░░░    │   │ ← Phase 2: Inline Banner
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Tuple #1 - ✅ AI Rated (2m ago)                 │   │
│  │                                                  │   │
│  │ [Video 1]  [Video 2]  [Video 3]  [Video 4]     │   │
│  │   🔴         🟢                                  │   │
│  │  WORST      BEST                                │   │
│  │                                                  │   │
│  │ 🤖 AI: "Video 2 shows energetic dog..."        │   │
│  │                                                  │   │
│  │ [Rate This Tuple]                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Tuple #2 - ⏳ AI rating in progress...          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Tuple #3 - ⚪ Not rated yet                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│         ↓ Scroll for more ↓                             │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User clicks "Start AI Rating"
         ↓
startBWSRating(experimentId)
         ↓
Routes based on experiment.rater_type
         ↓
┌────────────────────────────────┬──────────────────────────────┐
│ rater_type = 'ai'              │ rater_type = 'human'         │
│                                │                              │
│ startAIBWSRating()             │ startHumanBWSRating()        │
│  ├─ initializeBWSListView()    │  ├─ initializeBWSListView()  │
│  ├─ showInlineAIProgress()     │  ├─ loadFirstTuple()         │
│  └─ startAIRating() (backend)  │  └─ (ready for human input)  │
│                                │                              │
│ Auto-refresh every 2 seconds   │ Manual rating                │
│  ├─ loadBWSList()              │  ├─ submitJudgment()         │
│  ├─ getAllTuples()             │  ├─ refreshBWSListView()     │
│  └─ getJudgments()             │  └─ return to list           │
└────────────────────────────────┴──────────────────────────────┘
```

### File Structure

```
vr-collector/
├── index-advanced.html
│   ├── Line 1262-1288: Filter controls & list view container
│   ├── Line 1286: <div id="bws-list-view"> (scrollable container)
│   └── Line 1352-1377: AI progress overlay (WILL REPLACE WITH BANNER)
│
├── src/bws-manager.js
│   ├── Line 789-810: startBWSRating() - Router function
│   ├── Line 815-852: startAIBWSRating() - AI experiment handler
│   ├── Line 898-949: startHumanBWSRating() - Human experiment handler
│   ├── Line 2358-2364: bwsListViewState - State management
│   ├── Line 2378-2391: initializeBWSListView() - Initialize list view
│   ├── Line 2447-2649: loadBWSList() - Load and render tuples
│   └── Line 2708-2728: Auto-refresh logic
│
├── src/styles/rating-projects.css
│   ├── Line 2559-2684: List view styles (.bws-list-view, .bws-tuple-card)
│   └── Line 2685-2800: AI progress overlay styles (WILL MODIFY)
│
└── main.js
    └── Line 3005-3091: IPC handlers (getAllTuples, getJudgments)
```

---

## 3. Critical Bugs Fixed

### Bug #1: Duplicate Code Declaration

**Symptom:**
```
Uncaught SyntaxError: Identifier 'bwsListViewState' has already been declared
```

**Root Cause:**
Implementation agent accidentally duplicated entire Phase 1A code section (lines 2358-2774 were copied twice).

**Fix:**
Deleted lines 2747-2774 (duplicate section).

**Lesson:** Always use git diff before committing to catch copy-paste errors.

---

### Bug #2: Database Closed Prematurely

**Symptom:**
```
SQLITE_MISUSE: Database handle is closed
--> in Database#run('CREATE INDEX IF NOT EXISTS idx_rating_projects_status ...')
```

**Root Cause:**
Migration script called `db.close()` outside of async callback chain. JavaScript's async callbacks hadn't completed when close was called.

**Broken code:**
```javascript
db.serialize(() => {
  db.all("PRAGMA table_info(...)", (err, columns) => {
    // Async operations here...
  });
});

db.close(); // ❌ Executed immediately, before callbacks finish!
```

**Fix:**
Moved `db.close()` inside final callback (line 151).

**Lesson:** When using nested callbacks, always close resources in the innermost final callback. Or better yet, use async/await.

---

### Bug #3: Infinite Recursion

**Symptom:**
```
Uncaught (in promise) RangeError: Maximum call stack size exceeded
    at startBWSRating (bws-manager.js:2749:30)
    at startBWSRating (bws-manager.js:2751:9)
    at startBWSRating (bws-manager.js:2751:9)
    ... (infinite loop)
```

**Root Cause:**
Implementation agent tried to use decorator pattern with function redeclaration:

```javascript
// Line 789 - Original function
async function startBWSRating(experimentId) { /* ... */ }

// Line 2748 - Attempted wrapper
const originalStartBWSRating = startBWSRating;
async function startBWSRating(experimentId, raterId = null) {
  await originalStartBWSRating(experimentId, raterId); // ❌ Calls itself!
  initializeBWSListView(experimentId);
}
```

**Why it failed:** JavaScript function hoisting makes both declarations point to the NEW function (line 2748). When the new function calls `originalStartBWSRating()`, it's actually calling itself → infinite recursion.

**Fix:**
Deleted decorator wrappers (lines 2747-2774) and modified original functions directly:
- `startHumanBWSRating()` line 941: Added `initializeBWSListView(experimentId);`
- `closeBWSRating()` line 1829: Added `cleanupBWSListView();`
- `submitBWSJudgment()` line 1709: Added `returnToListView();`

**Lesson:**
Don't use decorator pattern with function declarations due to hoisting. Either:
1. Modify the original function directly (what we did)
2. Use function expressions: `const startBWSRating = function() { ... }`
3. Use event-driven architecture

---

## 4. Current Problem: Invisible List View

### The Issue

After fixing all bugs, the app starts successfully but:

✅ AI rating works (console shows "Tuple 5123 rated", "Tuple 5124 rated", etc.)
❌ User cannot see the list view
❌ Cannot click on tuple cards
❌ Full-screen overlay blocks everything

**Console output (working but invisible):**
```
bws-manager.js:975 [BWS AI Progress] 0/580 (0%)
bws-manager.js:988 [BWS AI] Tuple 5123 rated - Best: 0, Worst: 2
bws-manager.js:975 [BWS AI Progress] 1/580 (0%)
bws-manager.js:988 [BWS AI] Tuple 5124 rated - Best: 0, Worst: 1
...
```

### Root Cause Analysis

**Problem #1: List View Not Initialized for AI Experiments**

The routing logic at line 789-810:
```javascript
async function startBWSRating(experimentId) {
  const expResult = await window.api.bws.getExperiment({ experimentId });

  if (expResult.experiment.rater_type === 'ai') {
    await startAIBWSRating(experimentId, expResult.experiment); // ← AI path
  } else {
    await startHumanBWSRating(experimentId, expResult.experiment); // ← Human path
  }
}
```

Only `startHumanBWSRating()` calls `initializeBWSListView()` (line 941):
```javascript
async function startHumanBWSRating(experimentId, experiment) {
  // ... setup code ...

  // ✅ Initialize list view for browsing AI/human ratings
  initializeBWSListView(experimentId); // ONLY IN HUMAN PATH

  await loadNextBWSTuple();
}
```

But `startAIBWSRating()` does NOT initialize list view (line 815-852):
```javascript
async function startAIBWSRating(experimentId, experiment) {
  const confirmed = confirm(`Start AI rating...`);
  if (!confirmed) return;

  window.currentAIRatingExperimentId = experimentId;

  setupAIBWSProgressListeners(); // Shows full-screen overlay instead

  // ❌ NO LIST VIEW INITIALIZATION!

  const result = await window.api.bws.startAIRating({ experimentId });
}
```

**Problem #2: Full-Screen Overlay Blocks Everything**

Even if list view were initialized, the overlay completely covers it:

```css
/* rating-projects.css:2685 */
.bws-ai-progress-overlay {
  position: fixed;        /* Covers entire viewport */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(13, 17, 23, 0.95);  /* Opaque backdrop */
  z-index: 9999;         /* Very high, covers everything */
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Visual representation:**
```
┌─────────────────────────────────────────────┐
│   🤖 AI Rating in Progress                  │ ← Full-screen overlay
│   Processing 580 comparisons...             │   (z-index: 9999)
│                                             │
│   ████████████░░░░░░░░░░░░░░ 9/580         │
│                                             │
│   Latest: Tuple 5131 rated                  │
│                                             │
│   (This may take a few minutes)             │
└─────────────────────────────────────────────┘
          ↓ BLOCKS EVERYTHING ↓
┌─────────────────────────────────────────────┐
│ List View (invisible, cannot click)         │
│ ┌─────────────────────────────────────────┐ │
│ │ Tuple #1 - ✅ AI Rated                  │ │ ← Want to see this
│ │ [Videos...] BEST/WORST                  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Tuple #2 - ⏳ Rating...                 │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Why This Happened

**Original design intent:**
- AI experiments → Show modal with progress bar (fire and forget)
- Human experiments → Show rating interface for manual input

**User's actual need:**
- AI experiments → Show LIVE list view with ratings appearing in real-time
- Progress indicator should be inline, not blocking

This is a **fundamental UX change** from the original architecture.

---

## 5. Phase 2 Implementation Plan

### Overview

Replace the blocking full-screen overlay with an **inline progress banner** that sits above the list view.

**User experience:**
1. User clicks "Start AI Rating" button
2. Confirmation dialog: "Start AI rating for 'experiment-name'? This will process 580 comparisons..."
3. User confirms
4. **Instantly see:**
   - Inline progress banner at top: "🤖 AI Rating: 9/580 (2%) [progress bar]"
   - Scrollable list view below
   - Tuples appearing with green/red highlights as AI completes them
   - Auto-refresh every 2 seconds
5. User can browse, filter, enable blind mode while AI runs
6. When AI finishes, banner shows: "✅ AI Rating Complete: 580/580 (100%)"

### Implementation Steps

**Step 1:** Add inline progress banner HTML
**Step 2:** Create CSS styles for banner
**Step 3:** Modify `startAIBWSRating()` to initialize list view
**Step 4:** Create `showInlineAIProgress()` function
**Step 5:** Update progress event handlers to update banner instead of overlay
**Step 6:** Hide/remove old full-screen overlay
**Step 7:** Test end-to-end workflow

---

## 6. Code Changes Required

### Change #1: Add Inline Progress Banner (HTML)

**File:** `index-advanced.html`
**Location:** Before line 1286 (before `<div id="bws-list-view">`)

**Add this HTML:**
```html
<!-- AI Progress Banner (Inline, Non-Blocking) -->
<div id="bws-ai-progress-banner" class="bws-ai-progress-banner" style="display: none;">
  <div class="bws-ai-progress-content">
    <div class="bws-ai-progress-header">
      <span class="bws-ai-progress-icon">🤖</span>
      <span class="bws-ai-progress-title" id="bws-ai-progress-title">AI Rating in Progress</span>
      <button id="bws-ai-progress-pause" class="btn-icon" title="Pause AI rating" style="display: none;">
        ⏸
      </button>
    </div>

    <div class="bws-ai-progress-bar-container">
      <div class="bws-ai-progress-bar-track">
        <div id="bws-ai-progress-bar-fill" class="bws-ai-progress-bar-fill" style="width: 0%;"></div>
      </div>
      <div class="bws-ai-progress-stats">
        <span id="bws-ai-progress-count-inline">0 / 0</span>
        <span id="bws-ai-progress-percentage-inline">0%</span>
      </div>
    </div>

    <div id="bws-ai-latest-inline" class="bws-ai-latest-inline" style="display: none;">
      <span class="latest-label">Latest:</span>
      <span id="bws-ai-latest-text-inline"></span>
    </div>
  </div>
</div>
```

**Expected result after adding:**
- New banner component exists in DOM but hidden (`display: none`)
- Will be shown when AI rating starts

---

### Change #2: Add Banner CSS Styles

**File:** `src/styles/rating-projects.css`
**Location:** After line 2684 (before `.bws-ai-progress-overlay`)

**Add this CSS:**
```css
/* ============================================
   BWS AI Progress Banner (Inline, Non-Blocking)
   ============================================ */

.bws-ai-progress-banner {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bws-ai-progress-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bws-ai-progress-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bws-ai-progress-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.bws-ai-progress-title {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.bws-ai-progress-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bws-ai-progress-bar-track {
  flex: 1;
  height: 10px;
  background: var(--bg-primary);
  border-radius: 5px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
}

.bws-ai-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #3b82f6);
  border-radius: 5px;
  transition: width 0.4s ease-out;
  position: relative;
}

/* Animated shimmer effect on progress bar */
.bws-ai-progress-bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.bws-ai-progress-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 120px;
  justify-content: flex-end;
}

.bws-ai-latest-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.latest-label {
  font-weight: 600;
  color: var(--text-primary);
}

/* Success state when AI completes */
.bws-ai-progress-banner.completed {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15));
  border-color: #10b981;
}

.bws-ai-progress-banner.completed .bws-ai-progress-bar-fill {
  background: #10b981;
}

.bws-ai-progress-banner.completed .bws-ai-progress-icon {
  filter: grayscale(0);
}

/* Error state (if AI fails) */
.bws-ai-progress-banner.error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1));
  border-color: #ef4444;
}

.bws-ai-progress-banner.error .bws-ai-progress-bar-fill {
  background: #ef4444;
}
```

**Expected result after adding:**
- Banner will have polished gradient background
- Animated shimmer effect on progress bar
- Smooth slide-down animation when shown
- Success/error states with color changes

---

### Change #3: Modify `startAIBWSRating()` to Initialize List View

**File:** `src/bws-manager.js`
**Location:** Line 815-852 (replace entire function)

**Replace the function with:**
```javascript
/**
 * Start AI BWS Rating
 */
async function startAIBWSRating(experimentId, experiment) {
  try {
    // Show confirmation
    const confirmed = confirm(
      `Start AI rating for "${experiment.name}"?\n\n` +
      `This will process ${experiment.total_tuples} comparisons using Gemini AI.\n\n` +
      `You can browse results in real-time as the AI rates each tuple.`
    );
    if (!confirmed) return;

    // Store current experiment ID for progress tracking
    window.currentAIRatingExperimentId = experimentId;

    // ✅ CRITICAL: Initialize list view FIRST (so user can see live updates)
    initializeBWSListView(experimentId);

    // ✅ Show inline progress banner instead of blocking overlay
    showInlineAIProgress(experimentId, experiment);

    // Setup progress listeners to update banner
    setupInlineAIProgressListeners();

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
- Line 827: `initializeBWSListView(experimentId)` - Initialize list view FIRST
- Line 830: `showInlineAIProgress()` - Show banner instead of overlay
- Line 833: `setupInlineAIProgressListeners()` - Update banner, not overlay
- Removed all references to `bws-ai-progress-overlay` (old overlay)

---

### Change #4: Create `showInlineAIProgress()` Function

**File:** `src/bws-manager.js`
**Location:** After line 852 (after `startAIBWSRating()`)

**Add this function:**
```javascript
/**
 * Show inline AI progress banner
 */
function showInlineAIProgress(experimentId, experiment) {
  const banner = document.getElementById('bws-ai-progress-banner');
  if (!banner) {
    console.error('[showInlineAIProgress] Banner element not found!');
    return;
  }

  // Initialize progress display
  const totalTuples = experiment.total_tuples || 0;
  const alreadyCompleted = experiment.total_judgments || 0;
  const percentage = totalTuples > 0 ? Math.round((alreadyCompleted / totalTuples) * 100) : 0;

  // Update banner content
  document.getElementById('bws-ai-progress-title').textContent = 'AI Rating in Progress';
  document.getElementById('bws-ai-progress-count-inline').textContent = `${alreadyCompleted} / ${totalTuples}`;
  document.getElementById('bws-ai-progress-percentage-inline').textContent = `${percentage}%`;
  document.getElementById('bws-ai-progress-bar-fill').style.width = `${percentage}%`;

  // Remove any previous state classes
  banner.classList.remove('completed', 'error');

  // Show banner with animation
  banner.style.display = 'block';

  console.log(`[AI Progress Banner] Initialized: ${alreadyCompleted}/${totalTuples} (${percentage}%)`);
}

/**
 * Hide inline AI progress banner
 */
function hideInlineAIProgress() {
  const banner = document.getElementById('bws-ai-progress-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

/**
 * Update inline AI progress banner
 */
function updateInlineAIProgress(current, total) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  // Update count
  const countElement = document.getElementById('bws-ai-progress-count-inline');
  if (countElement) {
    countElement.textContent = `${current} / ${total}`;
  }

  // Update percentage
  const percentageElement = document.getElementById('bws-ai-progress-percentage-inline');
  if (percentageElement) {
    percentageElement.textContent = `${percentage}%`;
  }

  // Update progress bar fill
  const fillElement = document.getElementById('bws-ai-progress-bar-fill');
  if (fillElement) {
    fillElement.style.width = `${percentage}%`;
  }

  console.log(`[AI Progress Banner] Updated: ${current}/${total} (${percentage}%)`);
}

/**
 * Mark inline AI progress as completed
 */
function markInlineAIProgressComplete(total) {
  const banner = document.getElementById('bws-ai-progress-banner');
  if (!banner) return;

  // Update to completed state
  banner.classList.add('completed');
  document.getElementById('bws-ai-progress-title').textContent = '✅ AI Rating Complete';
  document.getElementById('bws-ai-progress-count-inline').textContent = `${total} / ${total}`;
  document.getElementById('bws-ai-progress-percentage-inline').textContent = '100%';
  document.getElementById('bws-ai-progress-bar-fill').style.width = '100%';

  // Hide latest result
  const latestElement = document.getElementById('bws-ai-latest-inline');
  if (latestElement) {
    latestElement.style.display = 'none';
  }

  console.log(`[AI Progress Banner] Completed: ${total}/${total}`);

  // Auto-hide banner after 5 seconds
  setTimeout(() => {
    if (banner) {
      banner.style.display = 'none';
    }
  }, 5000);
}

/**
 * Mark inline AI progress as error
 */
function markInlineAIProgressError(errorMessage) {
  const banner = document.getElementById('bws-ai-progress-banner');
  if (!banner) return;

  // Update to error state
  banner.classList.add('error');
  document.getElementById('bws-ai-progress-title').textContent = '❌ AI Rating Error';

  // Show error in latest section
  const latestElement = document.getElementById('bws-ai-latest-inline');
  const latestTextElement = document.getElementById('bws-ai-latest-text-inline');
  if (latestElement && latestTextElement) {
    latestTextElement.textContent = errorMessage;
    latestElement.style.display = 'flex';
  }

  console.error(`[AI Progress Banner] Error: ${errorMessage}`);
}
```

**What these functions do:**
- `showInlineAIProgress()`: Initializes banner with starting values
- `hideInlineAIProgress()`: Hides banner completely
- `updateInlineAIProgress()`: Updates count/percentage as AI progresses
- `markInlineAIProgressComplete()`: Shows success state, auto-hides after 5s
- `markInlineAIProgressError()`: Shows error state with message

---

### Change #5: Setup Inline Progress Listeners

**File:** `src/bws-manager.js`
**Location:** After the functions from Change #4

**Add this function:**
```javascript
/**
 * Setup event listeners for inline AI progress updates
 */
function setupInlineAIProgressListeners() {
  // Listen for progress updates
  window.api.bws.onAIProgress((data) => {
    const { experimentId, current, total, percentage } = data;

    // Only update if this is the current experiment
    if (experimentId === window.currentAIRatingExperimentId) {
      updateInlineAIProgress(current, total);

      // Refresh list view to show newly rated tuple
      loadBWSList();

      console.log(`[BWS AI Progress] ${current}/${total} (${percentage}%)`);
    }
  });

  // Listen for individual tuple ratings
  window.api.bws.onAITupleRated((data) => {
    const { experimentId, tupleId, best, worst } = data;

    // Only update if this is the current experiment
    if (experimentId === window.currentAIRatingExperimentId) {
      // Show latest result in banner
      const latestElement = document.getElementById('bws-ai-latest-inline');
      const latestTextElement = document.getElementById('bws-ai-latest-text-inline');

      if (latestElement && latestTextElement) {
        latestTextElement.textContent = `Tuple #${tupleId} rated (Best: ${best}, Worst: ${worst})`;
        latestElement.style.display = 'flex';
      }

      // Refresh list view
      loadBWSList();

      console.log(`[BWS AI] Tuple ${tupleId} rated - Best: ${best}, Worst: ${worst}`);
    }
  });

  // Listen for completion
  window.api.bws.onAIComplete((data) => {
    const { experimentId, totalCompleted } = data;

    // Only update if this is the current experiment
    if (experimentId === window.currentAIRatingExperimentId) {
      markInlineAIProgressComplete(totalCompleted);

      // Final refresh
      loadBWSList();

      // Clear current experiment ID
      window.currentAIRatingExperimentId = null;

      console.log(`[BWS AI] Completed: ${totalCompleted} tuples rated`);
      showNotification(`AI rating complete! ${totalCompleted} tuples rated.`, 'success');
    }
  });

  // Listen for errors
  window.api.bws.onAIError((data) => {
    const { experimentId, tupleId, error } = data;

    // Only update if this is the current experiment
    if (experimentId === window.currentAIRatingExperimentId) {
      console.error(`[BWS AI Error] Tuple ${tupleId}: ${error}`);

      // Don't stop on individual errors, just log them
      // The AI will continue with next tuple
    }
  });
}
```

**What this does:**
- Listens to IPC events from main process (AI rating progress)
- Updates banner in real-time as AI completes tuples
- Refreshes list view after each tuple is rated
- Shows "latest rated" message in banner
- Handles completion and errors gracefully

---

### Change #6: Remove/Hide Old Full-Screen Overlay

**File:** `src/bws-manager.js`
**Location:** Find and modify `setupAIBWSProgressListeners()` function (around line 960)

**Option A: Comment out the old function** (safest):
```javascript
/**
 * Setup AI BWS Progress Listeners
 *
 * @deprecated - Replaced by setupInlineAIProgressListeners()
 * This function showed a full-screen blocking overlay.
 * Now using inline banner instead.
 */
function setupAIBWSProgressListeners() {
  // OLD CODE - DISABLED
  // const overlay = document.getElementById('bws-ai-progress-overlay');
  // if (overlay) {
  //   overlay.style.display = 'flex';
  // }

  console.log('[setupAIBWSProgressListeners] Using inline banner instead of overlay');
}
```

**Option B: Delete the entire overlay from HTML** (cleaner):

**File:** `index-advanced.html`
**Lines:** 1351-1377
**Action:** Delete the entire `<div id="bws-ai-progress-overlay">` section

Before deletion, verify you have the inline banner added (Change #1). Then delete:
```html
<!-- DELETE THIS ENTIRE SECTION -->
<!-- AI Rating Progress Overlay -->
<div id="bws-ai-progress-overlay" class="bws-ai-progress-overlay" style="display: none;">
  <!-- ... all content ... -->
</div>
<!-- End AI Progress Overlay -->
```

**Recommendation:** Use Option A first (comment out), test thoroughly, then do Option B (delete overlay) once confirmed working.

---

### Change #7: Update `closeBWSRating()` to Clean Up Banner

**File:** `src/bws-manager.js`
**Location:** Find `closeBWSRating()` function (around line 1826)

**Add this line** after `cleanupBWSListView();` (line 1829):
```javascript
function closeBWSRating() {
  if (confirm('Are you sure you want to exit? Progress is saved automatically.')) {
    // ✅ Cleanup list view (stop auto-refresh, reset state)
    cleanupBWSListView();

    // ✅ NEW: Hide inline AI progress banner
    hideInlineAIProgress();

    // Pause all videos
    pauseAllBWSVideos();

    // ... rest of existing code ...
```

---

## 7. Testing Checklist

### Pre-Implementation Checklist

Before making changes:

- [ ] Backup current code: `git commit -am "Pre-Phase-2 backup"`
- [ ] Verify current state: AI rating works but list view invisible
- [ ] Document current line numbers (they may shift after edits)

### Implementation Checklist

Follow this order:

- [ ] **Step 1:** Add inline progress banner HTML (Change #1)
- [ ] **Step 2:** Add banner CSS styles (Change #2)
- [ ] **Step 3:** Test: Verify banner exists in DOM (inspect element, should be hidden)
- [ ] **Step 4:** Modify `startAIBWSRating()` (Change #3)
- [ ] **Step 5:** Add `showInlineAIProgress()` and related functions (Change #4)
- [ ] **Step 6:** Add `setupInlineAIProgressListeners()` (Change #5)
- [ ] **Step 7:** Test: Start AI rating, verify banner shows
- [ ] **Step 8:** Comment out old overlay code (Change #6 Option A)
- [ ] **Step 9:** Update `closeBWSRating()` (Change #7)
- [ ] **Step 10:** Full end-to-end test

### Post-Implementation Tests

#### Test 1: AI Rating with Live List View

**Steps:**
1. Start app: `npm run dev`
2. Go to BWS tab
3. Click "New BWS Experiment"
4. Select a collection with video chunks
5. Set Rater Type: **AI Only**
6. Enter research intent: "high energy content"
7. Click "Create Experiment"
8. Click "Start Rating" on the newly created experiment

**Expected results:**
- [x] Confirmation dialog appears
- [x] After confirming:
  - [x] Inline progress banner appears at top
  - [x] Banner shows: "🤖 AI Rating in Progress"
  - [x] Progress bar at 0%
  - [x] Count shows "0 / 580" (or whatever total)
- [x] List view visible below banner
- [x] Initially shows all tuples as "Unrated"
- [x] Every 2 seconds, list refreshes
- [x] New AI ratings appear with green/red borders
- [x] Banner updates: "1 / 580 (0%)", "2 / 580 (0%)", etc.
- [x] Latest result shows: "Tuple #5123 rated (Best: 0, Worst: 2)"
- [x] Can scroll through list while AI runs
- [x] Old full-screen overlay does NOT appear

**If test fails, check:**
- Console errors (open DevTools → Console)
- Is `initializeBWSListView()` being called? (add `console.log` at line 2378)
- Is banner element in DOM? (`document.getElementById('bws-ai-progress-banner')`)
- Are IPC events firing? (check console logs)

---

#### Test 2: Filter and Blind Mode During AI Rating

**Steps:**
1. While AI is rating (from Test 1):
2. Change filter to "AI Rated"
3. Wait 5 seconds
4. Change filter back to "All"
5. Enable "Blind Mode" checkbox
6. Disable "Blind Mode" checkbox

**Expected results:**
- [x] Filter "AI Rated": List shows only tuples AI has completed
- [x] Filter "All": List shows all tuples (rated and unrated)
- [x] Blind Mode ON: Green/red borders disappear, AI reasoning hidden
- [x] Blind Mode OFF: Green/red borders reappear, AI reasoning visible
- [x] List continues auto-refreshing throughout
- [x] Progress banner continues updating

---

#### Test 3: Completion State

**Steps:**
1. Wait for AI to complete all tuples (or use small experiment with 10 tuples)
2. Observe banner when 100% complete

**Expected results:**
- [x] Banner turns green background (`.completed` class)
- [x] Title changes to "✅ AI Rating Complete"
- [x] Progress bar at 100%
- [x] Count shows "580 / 580" (or total)
- [x] After 5 seconds, banner auto-hides
- [x] Notification appears: "AI rating complete! 580 tuples rated."
- [x] List view shows all tuples with AI ratings

---

#### Test 4: Manual Rating After AI Completes

**Steps:**
1. After AI completes (from Test 3):
2. Scroll to an AI-rated tuple
3. Click "Rate This Tuple" button
4. Select BEST and WORST items
5. Click "Submit Judgment"

**Expected results:**
- [x] Single rating view appears (expanded from list)
- [x] Can select BEST/WORST
- [x] Submit button enables
- [x] After submit, returns to list view
- [x] Tuple now shows both AI and Human ratings
- [x] Agreement indicator appears (100% / 50% / 0%)

---

#### Test 5: Close Interface During AI Rating

**Steps:**
1. Start AI rating (from Test 1)
2. Wait for 10-20 tuples to be rated
3. Click "Close" button (or navigate away)

**Expected results:**
- [x] Confirmation dialog: "Are you sure you want to exit?"
- [x] After confirming:
  - [x] List view hides
  - [x] Progress banner hides
  - [x] Auto-refresh stops
  - [x] AI continues rating in background (main process)
- [x] If you re-open the experiment:
  - [x] Progress banner shows current state (e.g., "50 / 580")
  - [x] List view shows all completed ratings so far

---

#### Test 6: Error Handling

**Steps:**
1. Disconnect internet
2. Start AI rating
3. Observe behavior

**Expected results:**
- [x] Banner shows initial state
- [x] After first API call fails:
  - [x] Console shows error
  - [x] Banner may show error state (red background)
  - [x] Notification: "AI rating failed: [error message]"
- [x] List view still accessible
- [x] Can retry later

---

#### Test 7: Human Experiment (Regression Test)

**Steps:**
1. Create new BWS experiment
2. Set Rater Type: **Human**
3. Click "Create Experiment"
4. Click "Start Rating"

**Expected results:**
- [x] List view appears (no progress banner)
- [x] Can filter to "Unrated Only"
- [x] Click "Rate This Tuple" works
- [x] Can complete human ratings
- [x] No AI-related UI appears
- [x] Everything works as before (no regressions)

---

## 8. Troubleshooting

### Issue: Banner doesn't appear

**Symptoms:**
- List view appears but no progress banner
- Console shows no errors

**Diagnosis:**
1. Check if banner element exists in HTML:
   ```javascript
   document.getElementById('bws-ai-progress-banner')
   ```
   Should return an element, not `null`.

2. Check if `showInlineAIProgress()` is being called:
   ```javascript
   // Add console.log at start of function
   function showInlineAIProgress(experimentId, experiment) {
     console.log('[DEBUG] showInlineAIProgress called', { experimentId, experiment });
     // ... rest of function
   ```

3. Check CSS:
   - Banner might have `display: none` and never set to `display: block`
   - Verify line in `showInlineAIProgress()`: `banner.style.display = 'block';`

**Fix:**
- If element not found: HTML not added correctly (redo Change #1)
- If function not called: Check `startAIBWSRating()` line 830
- If CSS issue: Check banner.style.display is set to 'block'

---

### Issue: Banner appears but doesn't update

**Symptoms:**
- Banner shows "0 / 580 (0%)" but never changes
- List view updates with new ratings
- Console shows progress logs

**Diagnosis:**
1. Check if progress listeners are set up:
   ```javascript
   // Add console.log in setupInlineAIProgressListeners
   window.api.bws.onAIProgress((data) => {
     console.log('[DEBUG] AI Progress event received', data);
     // ...
   ```

2. Check if IPC events are firing:
   - Open main.js console (Electron main process)
   - Should see: `[BWS AI] Progress event sent: { current: 1, total: 580 }`

3. Check if `updateInlineAIProgress()` is being called:
   ```javascript
   function updateInlineAIProgress(current, total) {
     console.log('[DEBUG] updateInlineAIProgress called', { current, total });
     // ...
   ```

**Fix:**
- If listeners not set up: Check `setupInlineAIProgressListeners()` is called (Change #5)
- If IPC not firing: Check main.js event emitters (should already work)
- If function not called: Check event listener callback is correct

---

### Issue: List view doesn't show AI ratings

**Symptoms:**
- Banner updates correctly
- Console shows "Tuple 5123 rated"
- List view remains empty or shows "Unrated"

**Diagnosis:**
1. Check if `loadBWSList()` is being called after each rating:
   ```javascript
   // In setupInlineAIProgressListeners, onAITupleRated callback
   window.api.bws.onAITupleRated((data) => {
     console.log('[DEBUG] About to call loadBWSList');
     loadBWSList();
   ```

2. Check if API is returning judgments:
   ```javascript
   // In loadBWSList(), after getting judgments
   const aiJudgments = await window.api.bws.getJudgments({ experimentId, raterType: 'ai' });
   console.log('[DEBUG] AI Judgments:', aiJudgments);
   ```

3. Check database:
   - Open SQLite DB: `~/Library/Application Support/vr-collector/collections.db`
   - Query: `SELECT * FROM bws_judgments WHERE experiment_id = [your-id] AND rater_type = 'ai'`
   - Should see rows with `best_item_id` and `worst_item_id`

**Fix:**
- If loadBWSList not called: Add it to event listener (Change #5)
- If API returns empty: Check main.js IPC handler (should already work)
- If database empty: AI rating not saving (check main.js saveBWSJudgment)

---

### Issue: Infinite recursion returns

**Symptoms:**
```
RangeError: Maximum call stack size exceeded
```

**Diagnosis:**
You accidentally re-introduced the decorator pattern.

**Fix:**
- Search for: `const originalStartBWSRating`
- Delete any decorator wrapper code
- Use direct modification only (see Section 3, Bug #3)

---

### Issue: Old overlay still appears

**Symptoms:**
- Full-screen overlay blocks list view
- Inline banner also visible (two progress indicators)

**Diagnosis:**
Old `setupAIBWSProgressListeners()` still being called.

**Fix:**
1. Find `setupAIBWSProgressListeners()` in `src/bws-manager.js`
2. Verify it's commented out or replaced (Change #6)
3. If still called in `startAIBWSRating()`, remove that line
4. Expected: Only `setupInlineAIProgressListeners()` should be called

---

## 9. Future Enhancements

### Enhancement 1: Pause/Resume AI Rating

**Current:** AI runs until all tuples completed or error
**Enhancement:** Add pause button to banner

**Implementation:**
1. Add pause button to banner HTML (already exists: `<button id="bws-ai-progress-pause">`)
2. Create IPC handler: `window.api.bws.pauseAIRating({ experimentId })`
3. Main process: Track pause state, skip rating loop when paused
4. Update button: ⏸ when running, ▶ when paused

**Benefit:** User can pause AI to save API costs or check results

---

### Enhancement 2: Retry Failed Tuples

**Current:** If AI fails on a tuple, it logs error and continues
**Enhancement:** Track failed tuples and offer "Retry Failed" button

**Implementation:**
1. Database: Add `failed_tuples` column to `bws_experiments` table
2. Store failed tuple IDs in JSON array
3. Add "Retry Failed (5)" button next to progress banner
4. On click: Re-run AI rating only on failed tuples

**Benefit:** Recover from transient errors without re-rating everything

---

### Enhancement 3: Export Disagreements

**Current:** Can see agreement % in UI
**Enhancement:** Export CSV of tuples where AI and Human disagree

**Implementation:**
1. Add "Export Disagreements" button to Results view
2. Query database for tuples where AI BEST ≠ Human BEST
3. Generate CSV with:
   - Tuple ID
   - Video file paths
   - AI choice (BEST/WORST)
   - Human choice (BEST/WORST)
   - AI reasoning
   - Human reasoning (if added to schema)
4. Download as `disagreements-experiment-name.csv`

**Benefit:** Analyze where AI and Human diverge, improve prompts

---

### Enhancement 4: Realtime Agreement Dashboard

**Current:** Agreement shown per-tuple
**Enhancement:** Live chart showing agreement % over time

**Implementation:**
1. Add chart library (e.g., Chart.js)
2. Create dashboard section below list view
3. Calculate rolling agreement:
   - X-axis: Number of tuples rated by both
   - Y-axis: Agreement % (0-100%)
4. Update chart after each human rating

**Visual mockup:**
```
Agreement Over Time
100% ┤     ●───●
     │    ╱     ╲
 75% ┤   ●       ●
     │  ╱         ╲
 50% ┤ ●           ●───●
     │╱
 25% ┤
     └─────────────────────→
      0   10  20  30  40  Tuples
```

**Benefit:** Visualize how well AI understands research intent

---

### Enhancement 5: Batch Operations

**Current:** Rate one tuple at a time
**Enhancement:** Bulk actions on multiple tuples

**Implementation:**
1. Add checkboxes to tuple cards
2. Add action bar: "With 5 selected: [Rate All] [Export] [Delete]"
3. "Rate All" → Opens multi-tuple rating view (Swipeable?)
4. "Export" → Download selected tuples as JSON
5. "Delete" → Remove ratings (confirm first)

**Benefit:** Faster workflow for power users

---

## 10. Appendix

### A. Complete File Manifest

Files modified in this implementation:

| File | Lines Changed | Type | Description |
|------|---------------|------|-------------|
| `index-advanced.html` | ~1286 | Add | Inline progress banner HTML |
| `src/styles/rating-projects.css` | ~2684 | Add | Banner CSS styles |
| `src/bws-manager.js` | 815-852 | Replace | `startAIBWSRating()` function |
| `src/bws-manager.js` | ~853 | Add | `showInlineAIProgress()` + 4 related functions |
| `src/bws-manager.js` | ~950 | Add | `setupInlineAIProgressListeners()` function |
| `src/bws-manager.js` | ~960 | Modify | Comment out `setupAIBWSProgressListeners()` |
| `src/bws-manager.js` | ~1829 | Add | `hideInlineAIProgress()` in `closeBWSRating()` |
| `index-advanced.html` | 1351-1377 | Delete | Old full-screen overlay (optional) |

Total additions: ~200 lines
Total deletions: ~30 lines
Net change: +170 lines

---

### B. Key Functions Reference

#### List View Functions (Already Exist)

```javascript
// Line 2378: Initialize list view with filters and auto-refresh
initializeBWSListView(experimentId)

// Line 2447: Load all tuples and render cards
async loadBWSList()

// Line 2708: Start polling for updates every 2 seconds
startAutoRefresh()

// Line 2718: Stop polling
stopAutoRefresh()

// Line 2725: Clean up on close
cleanupBWSListView()
```

#### New Inline Banner Functions (To Add)

```javascript
// Show banner with initial state
showInlineAIProgress(experimentId, experiment)

// Hide banner
hideInlineAIProgress()

// Update progress bar and count
updateInlineAIProgress(current, total)

// Mark as completed (green, auto-hide)
markInlineAIProgressComplete(total)

// Mark as error (red, show message)
markInlineAIProgressError(errorMessage)

// Setup IPC event listeners
setupInlineAIProgressListeners()
```

---

### C. IPC Event Reference

Events fired by main process (main.js) that renderer listens to:

| Event | Data | When Fired | Handler |
|-------|------|------------|---------|
| `bws:ai-progress` | `{ experimentId, current, total, percentage }` | After each tuple rated | `onAIProgress` |
| `bws:ai-tuple-rated` | `{ experimentId, tupleId, best, worst }` | After each tuple rated | `onAITupleRated` |
| `bws:ai-complete` | `{ experimentId, totalCompleted }` | All tuples completed | `onAIComplete` |
| `bws:ai-error` | `{ experimentId, tupleId, error }` | Tuple rating failed | `onAIError` |

**Note:** These events already exist in main.js (lines 2920-3003). You just need to listen to them with `setupInlineAIProgressListeners()`.

---

### D. CSS Variables Reference

If you need to customize colors:

```css
/* Defined in main CSS file */
--bg-primary: #0d1117;         /* Dark background */
--bg-secondary: #161b22;       /* Card background */
--bg-tertiary: #21262d;        /* Lighter background */
--border: #30363d;             /* Border color */
--text-primary: #c9d1d9;       /* Main text */
--text-secondary: #8b949e;     /* Secondary text */
--accent: #58a6ff;             /* Blue accent */
--success: #10b981;            /* Green (BEST) */
--danger: #ef4444;             /* Red (WORST) */
```

Banner uses:
- Success gradient: `linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))`
- Progress bar: `linear-gradient(90deg, #10b981, #3b82f6)`
- Completed state: `#10b981`
- Error state: `#ef4444`

---

### E. Git Workflow

Recommended commit strategy:

```bash
# Before starting
git checkout -b phase-2-inline-banner
git commit -am "Pre-Phase-2 backup"

# After each change
git add index-advanced.html
git commit -m "Add inline progress banner HTML"

git add src/styles/rating-projects.css
git commit -m "Add banner CSS styles"

git add src/bws-manager.js
git commit -m "Modify startAIBWSRating to use inline banner"

# ... etc for each change

# After all changes and testing
git checkout main
git merge phase-2-inline-banner
```

**Benefit:** Easy to revert individual changes if something breaks.

---

### F. Database Schema Reference

Relevant tables for BWS:

```sql
-- Experiments
CREATE TABLE bws_experiments (
  id INTEGER PRIMARY KEY,
  name TEXT,
  collection_id INTEGER,
  rater_type TEXT,  -- 'ai', 'human', or 'both'
  research_intent TEXT,
  total_tuples INTEGER,
  created_at DATETIME
);

-- Tuples (sets of items to compare)
CREATE TABLE bws_tuples (
  id INTEGER PRIMARY KEY,
  experiment_id INTEGER,
  item_ids TEXT,  -- JSON array: [123, 456, 789, 101]
  created_at DATETIME
);

-- Judgments (ratings)
CREATE TABLE bws_judgments (
  id INTEGER PRIMARY KEY,
  tuple_id INTEGER,
  rater_type TEXT,      -- 'ai' or 'human'
  rater_id TEXT,        -- 'gemini-2.5-flash' or user ID
  best_item_id INTEGER,
  worst_item_id INTEGER,
  reasoning TEXT,       -- AI explanation or human notes
  response_time_ms INTEGER,
  created_at DATETIME
);

-- Items (video chunks or comments)
CREATE TABLE video_chunks (
  id INTEGER PRIMARY KEY,
  video_id TEXT,
  file_path TEXT,       -- For multimodal AI
  transcript_text TEXT, -- For context
  -- ... other fields
);
```

**Query examples:**

Get all AI judgments for an experiment:
```sql
SELECT * FROM bws_judgments
WHERE tuple_id IN (
  SELECT id FROM bws_tuples WHERE experiment_id = 123
) AND rater_type = 'ai';
```

Get tuples with both AI and Human ratings:
```sql
SELECT t.id, t.item_ids,
       ai.best_item_id AS ai_best, ai.worst_item_id AS ai_worst,
       h.best_item_id AS human_best, h.worst_item_id AS human_worst
FROM bws_tuples t
LEFT JOIN bws_judgments ai ON ai.tuple_id = t.id AND ai.rater_type = 'ai'
LEFT JOIN bws_judgments h ON h.tuple_id = t.id AND h.rater_type = 'human'
WHERE t.experiment_id = 123 AND ai.id IS NOT NULL AND h.id IS NOT NULL;
```

---

## Summary

This document provides everything needed to implement Phase 2 of the BWS Live List Viewer. The implementation agent should:

1. **Read sections 4-6** to understand the problem and solution
2. **Follow section 6 sequentially** to make code changes
3. **Use section 7** to verify each change works
4. **Refer to section 8** if issues arise

**Expected outcome:** User can see AI ratings appearing in real-time in a scrollable list, with an inline progress banner that doesn't block the view.

**Estimated implementation time:** 2-3 hours for experienced developer.

**Questions?** Check Troubleshooting (Section 8) or refer to consultant report: `BWS_MULTIMODAL_CONSULTANT_REPORT.md`

---

**End of Document**
