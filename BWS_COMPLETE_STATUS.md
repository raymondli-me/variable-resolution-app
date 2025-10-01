# BWS Implementation - Complete Status Report
**Date:** October 1, 2025
**Session:** Phase 4 + Phase 5.5 Complete

---

## Table of Contents
1. [What We Built](#what-we-built)
2. [Technical Architecture](#technical-architecture)
3. [Critical Technical Quirks](#critical-technical-quirks)
4. [Database Schema](#database-schema)
5. [Code Locations](#code-locations)
6. [Bradley-Terry Implementation Details](#bradley-terry-implementation-details)
7. [Testing and Verification](#testing-and-verification)
8. [Next Phase: Human Rating Interface](#next-phase-human-rating-interface)

---

## What We Built

### Phase 4: Interactive BWS Results Viewer (COMPLETED)
**Goal:** Display BWS experiment results with sortable table and video playback

**Features Implemented:**
- ✅ Sortable results table (click any column header)
- ✅ Scrollable table with fixed header (600px max height)
- ✅ Click video chunk rows to open preview modal
- ✅ HTML5 video player with autoplay
- ✅ Display transcript, timestamps, and scores in modal
- ✅ In-memory sorting (no database re-queries)

**Key Files:**
- `src/bws-manager.js` - Results rendering and sorting logic
- `index-advanced.html` - Table structure and video modal
- `src/styles/rating-projects.css` - Table styles and modal z-index

### Phase 5.5: Bradley-Terry Scoring (COMPLETED)
**Goal:** Add statistical scoring method with confidence intervals

**Features Implemented:**
- ✅ Pairwise comparison extraction from BWS judgments
- ✅ Hunter-Lange MM algorithm for strength estimation
- ✅ 95% confidence intervals
- ✅ Both counting and BT scores calculated automatically
- ✅ UI displays both methods side-by-side
- ✅ Sortable by either scoring method

**Key Files:**
- `src/database/db.js` - BT algorithm implementation (240+ lines)
- `main.js` - IPC handler updated
- `scripts/test-bradley-terry.js` - Test script for verification

---

## Technical Architecture

### BWS Workflow (End-to-End)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CREATE EXPERIMENT                                        │
│    User: Click "Create BWS Experiment"                     │
│    → Select rating project                                  │
│    → Set filter (min score, e.g., 0.7)                     │
│    → Configure: tuple size, appearances, design method     │
│    Database: bws_experiments row created (status: draft)   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. GENERATE COMPARISONS                                     │
│    Function: generateBWSTuples()                            │
│    Method: MaxDiff (balanced design)                        │
│    Result: 35 tuples of 4 items each                       │
│    Database: bws_tuples table populated                    │
│    Format: item_ids = JSON array ["1241", "1159", ...]     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. RUN COMPARISONS (AI or Human)                           │
│    AI: Automatic rating via Gemini                         │
│    Human: Interactive UI (keyboard shortcuts)              │
│    For each tuple:                                          │
│      - Display 4 items                                      │
│      - User/AI picks BEST and WORST                        │
│      - Save to bws_judgments                               │
│    Progress saved after each judgment                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. CALCULATE SCORES                                         │
│    Trigger: finishBWSRating() → calculateScores()          │
│    Methods executed:                                        │
│      a) Counting: num_best - num_worst                     │
│      b) Bradley-Terry: Hunter-Lange MM algorithm           │
│      c) Confidence intervals: ±1.96 * SE                   │
│    Database: bws_scores table populated                    │
│    Experiment status: completed                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. VIEW RESULTS                                             │
│    UI: Sortable table with both scoring methods            │
│    Columns: Rank | Item | BT Score | Count | B | W | App   │
│    Features:                                                │
│      - Click column to sort                                 │
│      - Click video chunk to preview                         │
│      - Scroll table (600px height)                         │
└─────────────────────────────────────────────────────────────┘
```

### Scoring Flow Detail

```javascript
// When user completes experiment:
finishBWSRating()
  ↓
window.api.bws.calculateScores({ experimentId })
  ↓
IPC: 'bws:calculateScores' (main.js:2756)
  ↓
db.calculateBWSScores(experimentId)  // src/database/db.js:1134
  ↓
┌─────────────────────────────────────────────────────┐
│ 1. Get all judgments from database                  │
│    SELECT j.*, t.item_ids FROM bws_judgments j      │
│    JOIN bws_tuples t ON j.tuple_id = t.id           │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ 2. Calculate Counting Scores                        │
│    For each judgment:                                │
│      - Count appearances per item                    │
│      - Count best selections                         │
│      - Count worst selections                        │
│    score_counting = num_best - num_worst            │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ 3. Extract Pairwise Comparisons                     │
│    extractPairwiseComparisons(judgments)            │
│    From: {A, B, C, D}, best=A, worst=D              │
│    Extract:                                          │
│      A > B (definite)                                │
│      A > C (definite)                                │
│      A > D (definite)                                │
│      B > D (definite)                                │
│      C > D (definite)                                │
│    Returns: { wins: Map, totals: Map }              │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ 4. Calculate Bradley-Terry Scores                   │
│    calculateBradleyTerryScores(itemIds, pairwise)   │
│    Algorithm: Hunter-Lange MM                        │
│    Steps:                                            │
│      a) Initialize: all strengths = 1.0             │
│      b) Iterate:                                     │
│         π_i^new = W_i / Σ(n_ij/(π_i + π_j))        │
│      c) Check convergence (< 1e-6)                  │
│      d) Normalize: sum(strengths) = N               │
│      e) Calculate SE: sqrt(1 / comparisons)         │
│    Returns: Map<itemId, {strength, stdError}>       │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ 5. Merge & Calculate Confidence Intervals           │
│    For each item:                                    │
│      score_bt = strength                             │
│      margin = 1.96 * stdError                        │
│      CI_lower = strength - margin                    │
│      CI_upper = strength + margin                    │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ 6. Sort by BT Score & Assign Ranks                  │
│    items.sort((a,b) => b.score_bt - a.score_bt)    │
│    items.forEach((item, i) => item.rank = i + 1)   │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ 7. Save to Database                                 │
│    DELETE FROM bws_scores WHERE exp_id = ?          │
│    INSERT INTO bws_scores (item_id, counting,       │
│      bt, ci_lower, ci_upper, appearances, ...)      │
└─────────────────────────────────────────────────────┘
  ↓
Return scores array to IPC → Update UI
```

---

## Critical Technical Quirks

### 1. Z-Index Layering (CRITICAL)
**Location:** `src/styles/rating-projects.css:2795-2797`

```css
.bws-results-overlay {
  z-index: 10000;  /* BWS results view */
}

#bws-video-modal {
  z-index: 10001 !important;  /* Video modal MUST be higher */
}
```

**Why:** BWS results view is a full-screen overlay. Video modal must appear on top.

**Rule for Future:** Any modal opened from BWS results needs `z-index > 10000`

### 2. HTML5 Video Element Pattern (CRITICAL)
**Location:** `src/bws-manager.js:1365`, `src/components/enhanced-viewer.js:628`

```javascript
// ❌ WRONG - Does not work in Electron
const videoSource = document.getElementById('bws-video-source');
videoSource.src = videoPath;

// ✅ CORRECT - Set src directly on video element
const videoPlayer = document.getElementById('bws-video-player');
videoPlayer.src = videoPath;  // NO <source> child element!
```

**Why:** Electron's Chromium doesn't properly handle `<source>` element updates.

**HTML Structure:**
```html
<!-- ❌ WRONG -->
<video id="player" controls>
  <source id="source" src="" type="video/mp4">
</video>

<!-- ✅ CORRECT -->
<video id="player" controls>
  Your browser does not support video.
</video>
```

### 3. Video Autoplay Pattern (CRITICAL)
**Location:** `src/bws-manager.js:1371-1379`

```javascript
// Muted autoplay trick to bypass browser restrictions
videoPlayer.muted = true;
try {
  await videoPlayer.play();
  videoPlayer.muted = false;  // Unmute after playing starts
} catch (error) {
  console.error('[BWS Video] Autoplay failed:', error);
  videoPlayer.muted = false;
}
```

**Why:** Browsers block autoplay with audio. Start muted, then unmute.

**Pattern from:** `src/components/enhanced-viewer.js:632-636`

### 4. Electron File Protocol
**Location:** `src/bws-manager.js:1352-1354`

```javascript
// Video file paths are absolute from database
const videoPath = score.chunk_file_path.startsWith('file://')
  ? score.chunk_file_path
  : `file://${score.chunk_file_path}`;

videoPlayer.src = videoPath;
```

**Path Format:**
```
Database stores: /Users/.../collections/.../video_chunks/abc/chunk_0006.mp4
Electron needs:  file:///Users/.../collections/.../video_chunks/abc/chunk_0006.mp4
```

**No IPC Handler Needed:** Construct path directly in renderer process.

### 5. Database Field Names from JOINs
**Location:** `src/database/db.js:978-996`

```javascript
// Query JOINs comments and video_chunks
SELECT s.*,
  c.text as comment_text,           // Comment content
  c.author_name,                     // Comment author
  vc.transcript_text as chunk_text,  // Video chunk transcript
  vc.file_path as chunk_file_path,   // Video file path
  vc.video_id
FROM bws_scores s
LEFT JOIN comments c ON s.item_id = c.id
LEFT JOIN video_chunks vc ON s.item_id = vc.id
```

**Access Pattern:**
```javascript
const isComment = score.comment_text != null;
const content = isComment ? score.comment_text : score.chunk_text;
```

**WRONG field names:**
- `score.text` ❌
- `score.transcript_text` ❌
- `score.score` ❌ (use `score.score_counting`)

### 6. CSS Overflow Scrolling
**Location:** `src/styles/rating-projects.css:2593-2599`

```css
.bws-results-table-container {
  overflow-y: auto;      /* BOTH required */
  max-height: 600px;     /* for scrolling */
}
```

**Why:** Container needs explicit height constraint to enable scrolling.

### 7. In-Memory Sorting Pattern
**Location:** `src/bws-manager.js:1149-1156`

```javascript
let bwsResultsState = {
  scores: [],           // Load ONCE from database
  sortColumn: 'rank',
  sortDirection: 'asc'
};

// On sort:
const sorted = [...bwsResultsState.scores].sort((a, b) => ...);
renderBWSResultsTable(sorted);  // No database query!
```

**Why:** Performance. 35 items sort in <1ms in JavaScript vs 10-50ms database round-trip.

### 8. Bradley-Terry Convergence
**Location:** `src/database/db.js:1050-1092`

```javascript
const maxIterations = 100;
const convergenceThreshold = 1e-6;

for (let iter = 0; iter < maxIterations; iter++) {
  // Update all strengths
  // ...

  if (maxChange < convergenceThreshold) {
    console.log(`[Bradley-Terry] Converged after ${iter + 1} iterations`);
    break;
  }
}
```

**Typical convergence:** 10-20 iterations for 35 items.

**If not converging:**
- Check for disconnected items (no comparisons with others)
- Check for circular inconsistencies (A>B>C>A with 100% confidence)

---

## Database Schema

### Table: `bws_experiments`
```sql
CREATE TABLE bws_experiments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  rating_project_id INTEGER,
  item_type TEXT,  -- 'video_chunk', 'comment', 'mixed'
  tuple_size INTEGER DEFAULT 3,
  tuple_count INTEGER,
  design_method TEXT,  -- 'random', 'balanced', 'maxdiff'
  scoring_method TEXT,  -- 'counting', 'bradley_terry', 'conditional_logit'
  rater_type TEXT,  -- 'human', 'ai', 'hybrid'
  status TEXT,  -- 'draft', 'in_progress', 'completed'
  created_at DATETIME,
  completed_at DATETIME
);
```

### Table: `bws_tuples`
```sql
CREATE TABLE bws_tuples (
  id INTEGER PRIMARY KEY,
  experiment_id INTEGER NOT NULL,
  tuple_index INTEGER NOT NULL,
  item_ids TEXT NOT NULL,  -- JSON array: ["1241", "1159", "1182", "1174"]
  created_at DATETIME,
  FOREIGN KEY (experiment_id) REFERENCES bws_experiments(id)
);
```

### Table: `bws_judgments`
```sql
CREATE TABLE bws_judgments (
  id INTEGER PRIMARY KEY,
  tuple_id INTEGER NOT NULL,
  rater_type TEXT,  -- 'human', 'ai'
  rater_id TEXT NOT NULL,  -- 'gemini-2.5-flash', 'human-user'
  best_item_id INTEGER NOT NULL,
  worst_item_id INTEGER NOT NULL,
  reasoning TEXT,  -- AI reasoning or human notes
  response_time_ms INTEGER,
  created_at DATETIME,
  FOREIGN KEY (tuple_id) REFERENCES bws_tuples(id),
  CHECK (best_item_id != worst_item_id)
);
```

### Table: `bws_scores`
```sql
CREATE TABLE bws_scores (
  id INTEGER PRIMARY KEY,
  experiment_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  item_type TEXT,
  score_counting REAL,              -- Counting: best - worst
  score_bt REAL,                    -- Bradley-Terry strength
  score_cl REAL,                    -- Conditional Logit (not implemented)
  confidence_interval_lower REAL,   -- BT: score - 1.96*SE
  confidence_interval_upper REAL,   -- BT: score + 1.96*SE
  num_appearances INTEGER DEFAULT 0,
  num_best INTEGER DEFAULT 0,
  num_worst INTEGER DEFAULT 0,
  rank INTEGER,
  created_at DATETIME,
  FOREIGN KEY (experiment_id) REFERENCES bws_experiments(id),
  UNIQUE(experiment_id, item_id)
);
```

**Key Insight:** Each experiment can have multiple raters. Current implementation:
- AI creates experiment → 35 judgments from AI → scores calculated
- **NEXT:** Human can add judgments to same experiment → scores recalculated with combined data

---

## Code Locations

### Core BWS Manager
**File:** `src/bws-manager.js` (1,400+ lines)

**Key Functions:**
- `initializeBWS()` - Setup event listeners
- `openCreateBWSModal()` - Create experiment UI
- `createBWSExperiment()` - Generate tuples and save to DB
- `startBWSExperiment()` - Open rating interface
- `loadNextBWSTuple()` - Load comparison for rating
- `submitBWSJudgment()` - Save best/worst selection
- `finishBWSRating()` - Calculate scores and complete
- `showBWSResults()` - Display results table
- `renderBWSResultsTable()` - Render table rows (1215-1270)
- `sortBWSResults()` - In-memory sorting (1289-1346)
- `openBWSVideoModal()` - Video preview (1341-1395)

### Database Operations
**File:** `src/database/db.js` (1,300+ lines)

**BWS Methods:**
- `createBWSExperiment()` - Insert experiment row
- `getBWSExperiments()` - List all experiments
- `saveBWSTuples()` - Bulk insert tuples
- `getNextBWSTuple()` - Get unjudged tuple
- `saveBWSJudgment()` - Insert judgment
- `getBWSJudgments()` - Get all judgments for experiment
- `calculateBWSScores()` - **Main scoring method** (1134-1210)
  - Calls `extractPairwiseComparisons()` (983-1019)
  - Calls `calculateBradleyTerryScores()` (1025-1129)
- `saveBWSScores()` - Save scores to DB (950-977)
- `getBWSScores()` - Get scores with JOINs (978-996)

### UI Components
**File:** `index-advanced.html`

**BWS Sections:**
- Lines 1000-1100: Create experiment modal
- Lines 1150-1200: Rating interface
- Lines 1250-1280: Results table
- Lines 1285-1310: Video preview modal

### Styling
**File:** `src/styles/rating-projects.css`

**BWS Styles:**
- Lines 2520-2600: Results overlay and container
- Lines 2600-2750: Table styles
- Lines 2750-2798: Sortable headers, video rows, BT score cells, modal z-index

### IPC Handlers
**File:** `main.js`

**BWS Handlers:**
- Line 2660: `bws:createExperiment`
- Line 2682: `bws:getExperiments`
- Line 2703: `bws:getNextTuple`
- Line 2725: `bws:saveJudgment`
- Line 2756: `bws:calculateScores` - **Uses calculateBWSScores()**
- Line 2778: `bws:getScores`

### Test Script
**File:** `scripts/test-bradley-terry.js` (350+ lines)

**Purpose:** Recalculate scores for existing experiments

**Usage:**
```bash
node scripts/test-bradley-terry.js
```

**Output:**
- Loads all experiments from database
- Recalculates counting + BT scores
- Shows top 10 items with both methods
- Updates database with new scores

---

## Bradley-Terry Implementation Details

### Algorithm: Hunter-Lange MM (Minorization-Maximization)

**Paper:** Hunter & Lange (2004) - "A Tutorial on MM Algorithms"

**Update Formula:**
```
π_i^(new) = (W_i) / Σ_{j≠i} (n_ij / (π_i^(old) + π_j^(old)))

Where:
  π_i     = strength of item i
  W_i     = total wins for item i against all opponents
  n_ij    = number of comparisons between items i and j
```

**Properties:**
- ✅ Guaranteed convergence (monotonic improvement)
- ✅ Numerically stable
- ✅ Simple implementation (no matrix operations)
- ✅ Well-studied and proven

**Why MM over alternatives:**
- Newton-Raphson: Faster but can diverge, requires Hessian
- Gradient Descent: Can overshoot or oscillate
- MM: Always improves, never diverges, simple

### Pairwise Extraction Strategy

**Conservative Approach:** Only extract definite wins

**From tuple {A, B, C, D} with best=A, worst=D:**
```
Definite pairwise comparisons:
  A > B  (best beats middle)
  A > C  (best beats middle)
  A > D  (best beats worst)
  B > D  (middle beats worst)
  C > D  (middle beats worst)

Uncertain:
  B vs C  (both middle items - tie)
```

**Alternative approaches (not implemented):**
- Liberal: Assume B and C tied (each gets 0.5 win)
- Rank-based: Assign positions (best=1.0, middle=0.5, worst=0.0)

**Our choice:** Conservative - only count clear wins. More principled, less assumption.

### Confidence Interval Calculation

**Standard Error Approximation:**
```
SE(π_i) = sqrt(1 / C_i)

Where:
  C_i = total number of comparisons for item i
```

**95% Confidence Interval:**
```
CI_95 = [π_i - 1.96 * SE, π_i + 1.96 * SE]
```

**Interpretation:**
- Item with 4 comparisons: SE = 0.5, CI width = ±0.98
- Item with 16 comparisons: SE = 0.25, CI width = ±0.49
- More comparisons → tighter CI → more confidence

**Statistical Significance:**
If two items have non-overlapping CIs, they are significantly different (p < 0.05).

### Normalization

**Why:** Raw strengths might sum to arbitrary value (e.g., 73.2)

**Method:** Scale so sum equals number of items
```
scale_factor = N / Σ(π_i)
π_i_normalized = π_i * scale_factor
```

**Result:** Average item has strength ≈ 1.0

**Interpretation:** Score of 4.0 means "4x as strong as average item"

### Example Calculation

**Input Data:**
```
35 judgments on 35 items
Item 1241: 4 appearances, 4 best, 0 worst
Item 1159: 4 appearances, 3 best, 0 worst
```

**Counting Scores:**
```
Item 1241: +4
Item 1159: +3
```

**Bradley-Terry Process:**

1. **Pairwise extraction:**
   - Item 1241 won 12 pairwise comparisons (beat 3 items in 4 tuples)
   - Item 1159 won 9 pairwise comparisons

2. **Opponent quality matters:**
   - Item 1241 beat strong opponents (who also won many comparisons)
   - Item 1159 beat weaker opponents
   - Algorithm iteratively propagates this information

3. **Convergence (after 15 iterations):**
   ```
   Item 1241: strength = 18.41 [17.92, 18.90]
   Item 1159: strength = 0.83 [0.31, 1.36]
   ```

4. **Interpretation:**
   - Item 1241 is 22x stronger than Item 1159 (18.41 / 0.83)
   - Despite similar counting scores (+4 vs +3)
   - Item 1241 is definitively in Tier 1 (CI doesn't overlap with others)

---

## Testing and Verification

### Test Results (Experiment #2: "anatolian-strength-bws")

**Experiment Details:**
- 35 video chunks
- 35 judgments (4-item tuples)
- AI rater: Gemini 2.5 Flash

**Score Comparison:**

| Rank | Item ID | Count | BT Score | 95% CI | Interpretation |
|------|---------|-------|----------|---------|----------------|
| 1 | 1241 | +4 | **18.41** | [17.92, 18.90] | Dominant (way stronger than count suggests) |
| 2 | 1190 | +3 | **4.13** | [3.61, 4.66] | Strong (beat tough opponents) |
| 3 | 1215 | +3 | **2.95** | [2.43, 3.47] | Good |
| 4 | 1208 | +2 | **2.74** | [2.12, 3.36] | Above average |
| 5 | 1182 | +3 | **1.91** | [1.38, 2.43] | Decent (same count as #2 but weaker opponents) |
| 6 | 1224 | +2 | **0.89** | [0.33, 1.46] | Below average |
| 7 | 1159 | +3 | **0.83** | [0.31, 1.36] | Weak (beat easy opponents) |

**Key Insights:**
1. Items 1190, 1215, 1182, 1159 all have count +3
2. BT reveals: 1190 (4.13) is 5x stronger than 1159 (0.83)
3. Item 1241 is in a league of its own (18.41)
4. Confidence intervals show certainty of rankings

**Convergence:** Algorithm converged in 15 iterations (< 0.001% change)

### Verification Steps

**1. Database updated:**
```bash
sqlite3 ~/Library/.../collections.db \
  "SELECT item_id, rank, score_counting, score_bt FROM bws_scores
   WHERE experiment_id=2 ORDER BY rank LIMIT 5"
```

**2. UI displays correctly:**
- Restart app
- Navigate to BWS tab
- Click experiment → View Results
- See "BT Score" column with values and CIs
- Click column headers to sort

**3. Video playback works:**
- Click any video chunk row
- Modal opens with z-index 10001 (above overlay)
- Video plays automatically (muted → unmuted trick)

---

## Next Phase: Human Rating Interface

### Goal
Allow humans to rate BWS experiments that were completed by AI (or create new human-only experiments).

### Requirements

**1. Reuse Existing AI Experiment**
- Experiment already has 35 AI judgments from Gemini
- Human adds 35 additional judgments on same tuples
- System recalculates scores with **combined** data (70 judgments total)
- Compare human vs AI agreement

**2. Human Rating Interface**
- **IMPORTANT:** Interface already exists! `src/bws-manager.js` has rating UI
- Currently used for manual testing, not exposed in production flow
- Keyboard shortcuts: 1/2/3/4 for BEST, Q/W/E/R for WORST
- Display: Video chunks or comments with transcripts
- Progress bar shows N/M completed

**3. Save and Resume**
- Auto-save after each judgment
- User can close app and resume later
- Track progress per rater (human vs AI)

**4. Multi-Rater Scoring Architecture**

**Core Principle:** Calculate scores BOTH for combined data AND individual raters.

**Scoring Strategy:**
```
Experiment completes → Calculate scores in THREE ways:

1. COMBINED scores (all raters together)
   - Use all judgments from bws_judgments
   - Produces "consensus" ranking
   - Most reliable (largest N)

2. INDIVIDUAL rater scores (per rater)
   - Filter judgments by rater_id
   - Calculate separate BT scores for:
     - AI only (gemini-2.5-flash)
     - Human only (human-user)
   - Compare rankings between raters

3. AGREEMENT METRICS
   - Rank correlation (Spearman's rho)
   - Percentage agreement on best/worst selections
   - Items with largest disagreement
```

**Database Storage:**
```sql
-- Option A: Store all in bws_scores with rater_id column
ALTER TABLE bws_scores ADD COLUMN rater_id TEXT;  -- NULL = combined

-- Combined scores:
INSERT INTO bws_scores (experiment_id, item_id, rater_id, score_bt, ...)
VALUES (2, 1241, NULL, 18.41, ...);  -- rater_id=NULL means "combined"

-- Individual rater scores:
INSERT INTO bws_scores (experiment_id, item_id, rater_id, score_bt, ...)
VALUES (2, 1241, 'gemini-2.5-flash', 17.32, ...);

INSERT INTO bws_scores (experiment_id, item_id, rater_id, score_bt, ...)
VALUES (2, 1241, 'human-user', 19.58, ...);
```

**UI Display:**
```
┌─────────────────────────────────────────────────────────────┐
│ BWS Results: anatolian-strength-bws                         │
│                                                             │
│ [View: ▼ Combined (AI + Human) ]  35 items, 70 judgments  │
│       Options:                                              │
│       - Combined (AI + Human)      ← Default               │
│       - AI only (gemini-2.5-flash) [35 judgments]         │
│       - Human only (human-user)    [35 judgments]         │
│                                                             │
│ Agreement: 78% on BEST, 82% on WORST | Rank correlation: 0.85 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Rank | Item        | BT Score (All) | AI Score | Human Score│
│      |             | [95% CI]       | [95% CI] | [95% CI]   │
├─────────────────────────────────────────────────────────────┤
│  1   | Chunk 1241  | 18.41          | 17.32    | 19.58      │
│      |             | [17.92, 18.90] | [16.5,…] | [18.3,…]   │
│      |             | 📊 High agreement (both rank #1)       │
├─────────────────────────────────────────────────────────────┤
│  2   | Chunk 1190  | 4.13           | 5.21     | 3.08       │
│      |             | [3.61, 4.66]   | [4.2,…]  | [2.1,…]    │
│      |             | ⚠️ Disagreement: AI=#2, Human=#5       │
└─────────────────────────────────────────────────────────────┘

[Download Comparison Report CSV]
```

**Implementation Flow:**
```javascript
// When any rater completes their judgments:
async function finishBWSRating(experimentId) {
  // 1. Calculate combined scores (all raters)
  const combinedScores = await calculateBWSScores(experimentId, null);

  // 2. Get list of unique raters
  const raters = await db.all(`
    SELECT DISTINCT rater_id
    FROM bws_judgments
    WHERE tuple_id IN (SELECT id FROM bws_tuples WHERE experiment_id=?)
  `, [experimentId]);

  // 3. Calculate scores for each individual rater
  for (const rater of raters) {
    const raterScores = await calculateBWSScores(experimentId, rater.rater_id);
  }

  // 4. Calculate inter-rater agreement
  if (raters.length >= 2) {
    const agreement = await calculateInterRaterAgreement(experimentId);
    // Store agreement metrics
  }
}
```

**Rater ID Conventions:**
- AI models: `'gemini-2.5-flash'`, `'gpt-4-turbo'`, `'claude-3-opus'`
- Humans: `'human-user'`, `'human-alice'`, `'human-bob'`
- Combined: `NULL` or `'combined'`

**Future: Hierarchical Bayesian Modeling**
- Model: `y_ij = μ_i + rater_j + ε`
- `μ_i` = true item quality (latent variable)
- `rater_j` = rater bias/variance
- Estimate "true" scores accounting for rater differences
- Identify biased raters (AI model X consistently rates higher)
- Shrinkage: Pull unreliable rater estimates toward population mean

**Database Schema Update Needed:**
```sql
-- Add rater_id to bws_scores for multi-rater support
ALTER TABLE bws_scores ADD COLUMN rater_id TEXT;

-- Create index for filtering by rater
CREATE INDEX idx_bws_scores_rater ON bws_scores(experiment_id, rater_id);

-- Agreement metrics table (future)
CREATE TABLE bws_inter_rater_agreement (
  experiment_id INTEGER,
  rater_1 TEXT,
  rater_2 TEXT,
  spearman_rho REAL,
  kendall_tau REAL,
  best_agreement_pct REAL,
  worst_agreement_pct REAL,
  created_at DATETIME,
  PRIMARY KEY (experiment_id, rater_1, rater_2)
);
```

### Existing Code to Leverage

**Rating Interface HTML:** `index-advanced.html` lines ~1150-1200
```html
<div id="bws-rating-interface" style="display: none;">
  <div class="bws-rating-container">
    <div class="bws-rating-progress">...</div>
    <div class="bws-rating-items">
      <!-- 4 items displayed -->
    </div>
    <div class="bws-rating-controls">
      <button>Select Best</button>
      <button>Select Worst</button>
      <button>Submit</button>
    </div>
  </div>
</div>
```

**Rating Logic:** `src/bws-manager.js`
- `startBWSExperiment()` - Opens rating interface (line ~850)
- `loadNextBWSTuple()` - Loads tuple for rating (line ~950)
- `submitBWSJudgment()` - Saves judgment to DB (line ~1000)
- `finishBWSRating()` - Completes and calculates scores (line ~1085)

**Database Support:**
- `getNextBWSTuple()` already filters by rater:
  ```sql
  SELECT * FROM bws_tuples t
  WHERE t.experiment_id = ?
    AND NOT EXISTS (
      SELECT 1 FROM bws_judgments j
      WHERE j.tuple_id = t.id
        AND j.rater_id = ?  -- Filter by current rater!
    )
  ```

### What Needs to Be Built

**1. "Add Human Ratings" Button in Experiment List**
- Location: Next to "View Results" button
- Shows: Only for completed AI experiments
- Click: Opens human rating interface for same tuples

**2. Rater Selection / Tracking**
- Prompt for rater name on first human rating session
- Store in localStorage or prompt each time
- Pass to `saveBWSJudgment()` as `rater_id: 'human-{name}'`

**3. Progress Tracking by Rater**
- Show: "AI: 35/35 complete, Human: 12/35 complete"
- Filter tuples by rater in `getNextBWSTuple()`

**4. Score Recalculation with Mixed Data**
- When human completes: `calculateBWSScores()` runs on all judgments (AI + human)
- Scores reflect combined dataset
- Future: Compare human vs AI scores separately

**5. UI Polish**
- Make rating interface intuitive and beautiful
- Show item content clearly (transcript + video preview)
- Keyboard shortcuts explanation
- Progress indicator
- "Pause and Resume" messaging

**6. Inter-Rater Agreement (Future)**
- Calculate correlation between human and AI judgments
- Show: "Agreement: 78% on best selection, 82% on worst selection"
- Identify items with disagreement for further analysis

### Design Decisions to Make

**Q1: Should humans rate the EXACT same tuples as AI?**
- **Pro:** Direct comparison of human vs AI on identical task
- **Con:** Humans might be influenced if they see AI completed it
- **Recommendation:** Yes, same tuples. Don't show AI ratings until human completes.

**Q2: Can multiple humans rate the same experiment?**
- **Pro:** Inter-rater reliability analysis
- **Con:** More complex UI for rater management
- **Recommendation:** Phase 1 = single human. Phase 2 = multiple humans.

**Q3: Should scores be recalculated after each human judgment or only at end?**
- **Pro (each):** User sees live rankings update
- **Con (each):** Computationally expensive, rankings unstable
- **Recommendation:** Recalculate only when human clicks "Finish" (like AI)
- **Better:** Calculate ALL THREE score sets (combined, AI-only, human-only) at end

**Q3b: How to display multi-rater results?**
- **Primary view:** Combined scores (consensus ranking)
- **Dropdown selector:** Switch between Combined / AI-only / Human-only
- **Side-by-side columns:** Show all three in same table for direct comparison
- **Agreement indicators:** Visual badges for high/low agreement items
- **Recommendation:** Start with dropdown, add side-by-side later

**Q4: Should human see video playback during rating?**
- **Pro:** Better judgment quality, see context
- **Con:** Slower rating process
- **Recommendation:** Yes, embed video preview for video chunks

### Implementation Plan

**Step 1:** Find and verify existing rating interface code
- Search for `startBWSExperiment`, `loadNextBWSTuple` usage
- Test manual rating flow in current codebase
- Document what works and what needs fixing

**Step 2:** Add "Add Human Ratings" button to experiment list
- Check experiment status and rater_type
- Show button if experiment is completed and has AI ratings
- Open rating interface with `rater_type: 'human'`

**Step 3:** Implement rater ID tracking
- Prompt user for name (or use 'human-default')
- Store in `bwsRatingState.raterId`
- Pass to all judgment save operations

**Step 4:** Update progress tracking
- Show separate progress for each rater
- Filter tuples by current rater in `getNextBWSTuple`

**Step 5:** UI/UX improvements
- Polish rating interface styling
- Add keyboard shortcut hints
- Add video preview for video chunks
- Add pause/resume messaging

**Step 6:** Implement multi-rater scoring calculation
- Modify `calculateBWSScores()` to accept optional `raterId` parameter
- When `raterId=null`: Use all judgments (combined)
- When `raterId='gemini-2.5-flash'`: Filter judgments by rater
- Store scores with `rater_id` column in database

**Step 7:** Build inter-rater comparison UI
- Dropdown to switch between Combined / AI-only / Human-only views
- Display agreement metrics (correlation, % agreement)
- Highlight items with disagreement
- Optional: Side-by-side columns for direct comparison

**Step 8:** Calculate agreement metrics
- Spearman rank correlation between AI and human rankings
- Percentage agreement on best/worst selections
- Identify top 5 items with largest disagreement
- Display prominently in results header

**Step 9:** Test and verify
- Complete AI experiment (35 judgments)
- Add human ratings (35 judgments)
- Verify judgments saved with correct rater_id
- Verify THREE score sets calculated:
  - Combined (70 judgments)
  - AI only (35 judgments)
  - Human only (35 judgments)
- Compare rankings visually
- Check agreement metrics are reasonable

### Future Enhancements (Not Now)

**Multi-Model AI Rating:**
- Run same experiment through GPT-4, Claude, Gemini
- Compare model agreement
- Identify items with consensus vs disagreement

**Multi-Human Rating:**
- Track individual human raters by name
- Calculate inter-rater reliability (Krippendorff's alpha)
- Show agreement matrix

**Hybrid Scoring:**
- Weight AI vs human judgments differently
- E.g., 70% human, 30% AI
- Or: Use AI for initial filter, human for final ranking

**Hierarchical Bayesian Modeling:**
- Model rater effects and item quality simultaneously
- Equation: `score_ij = μ_i + α_j + ε_ij`
  - `μ_i` = true item quality (what we want)
  - `α_j` = rater bias (AI model X rates 10% higher)
  - `ε_ij` = noise
- Estimate using Stan, PyMC3, or brms (R)
- Provides:
  - Adjusted scores accounting for rater bias
  - Uncertainty estimates for each item's "true" quality
  - Rater reliability metrics
- Use case: "Is GPT-4 consistently harsher than humans?"

**Comparison Dashboard:**
- Side-by-side rankings: AI vs Human vs Combined
- Scatter plot: AI score (x) vs Human score (y)
- Identify outliers (items rated very differently)
- Highlight disagreements with color coding
- Export comparison report (CSV with all three score columns)

**Multi-Model AI Comparison:**
- Run same experiment through 3 AI models
- Score sets: Gemini-only, GPT-4-only, Claude-only, Combined
- Agreement matrix showing correlation between all pairs
- Identify "consensus items" (all models agree) vs "controversial items" (models disagree)
- Use for model evaluation and quality control

---

## Files Changed This Session

### Modified Files
1. `src/database/db.js` (+240 lines)
   - Added `extractPairwiseComparisons()`
   - Added `calculateBradleyTerryScores()`
   - Renamed `calculateBWSCountingScores()` → `calculateBWSScores()`
   - Updated `saveBWSScores()` to include BT fields

2. `main.js` (+1 line)
   - Changed IPC handler to use `calculateBWSScores()`

3. `src/bws-manager.js` (+14 lines)
   - Updated `renderBWSResultsTable()` to display BT scores
   - Updated `sortBWSResults()` to support BT score sorting

4. `index-advanced.html` (+2 lines)
   - Added "BT Score" column header
   - Reordered columns

5. `src/styles/rating-projects.css` (+29 lines)
   - Added `.bws-bt-score-cell` styling
   - Updated column width rules for 7 columns
   - Added `#bws-video-modal` z-index override

### New Files
1. `scripts/test-bradley-terry.js` (350 lines)
   - Test script for BT score calculation
   - Can recalculate scores for any experiment

2. `BWS_SESSION_STATUS.md` (initial version)
   - Technical documentation for Phase 4

3. `BWS_COMPLETE_STATUS.md` (this file)
   - Comprehensive documentation for Phases 4 + 5.5

---

## Summary for Future AI Agents

**What You Have:**
- ✅ Complete BWS workflow (create → rate → calculate → view)
- ✅ AI rating via Gemini
- ✅ Two scoring methods: Counting + Bradley-Terry
- ✅ Interactive results viewer with video playback
- ✅ Database schema supports multiple raters

**What You Need to Know:**
- Z-index: Video modals need 10001+ (overlay is 10000)
- Videos: Set `videoPlayer.src` directly, not `<source>` element
- Autoplay: Muted → play → unmuted pattern
- Paths: Use `file://` prefix for local video files
- Sorting: In-memory for performance
- BT: Hunter-Lange MM algorithm, converges in ~15 iterations

**What's Next:**
- Human rating interface (already exists, needs to be exposed)
- Rater tracking and progress by rater
- **Multi-rater scoring system:**
  - Calculate combined scores (all raters)
  - Calculate individual rater scores (AI-only, human-only)
  - Store all score sets in database with `rater_id` column
- **Inter-rater comparison UI:**
  - Dropdown to switch between score views
  - Agreement metrics (correlation, % agreement)
  - Visual indicators for disagreement
- **Future: Hierarchical Bayes modeling** for true quality estimation

**Critical Files:**
- `src/bws-manager.js` - All BWS UI logic
- `src/database/db.js` - All database operations + BT algorithm
- `main.js` - IPC handlers
- `scripts/test-bradley-terry.js` - Testing utility

**Testing:**
```bash
# Recalculate scores for all experiments
node scripts/test-bradley-terry.js

# Check database
sqlite3 ~/Library/Application\ Support/vr-collector/collections.db \
  "SELECT * FROM bws_scores WHERE experiment_id=2 ORDER BY rank"
```

**Common Issues:**
1. Video won't play → Check z-index and src assignment pattern
2. Scores not updating → Check IPC handler uses `calculateBWSScores()`
3. Sorting broken → Check `bwsResultsState.scores` is populated
4. BT scores null → Check judgments exist and pairwise extraction worked

---

**End of Documentation**
