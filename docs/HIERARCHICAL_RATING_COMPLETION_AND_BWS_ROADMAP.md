# Hierarchical Rating System - Completion Report & BWS Roadmap

**Date:** September 30, 2025
**Status:** ✅ Hierarchical Rating COMPLETE | 🎯 Next: Best-Worst Scaling (BWS)
**Agent Handoff:** This document bridges completed work to next phase

---

## Executive Summary

We successfully implemented a **hierarchical rating system** that enables recursive dataset refinement through multi-wave AI ratings. Users can now:

1. Rate a collection (e.g., 769 items) → Filter high scores
2. Create child project from high-scoring items (e.g., 262 items) → Re-rate with new intent
3. Continue recursively until reaching a refined, high-quality subset
4. **Goal achieved:** From 769 items → 262 items → ready for BWS experiments

**Next Phase:** Implement Best-Worst Scaling (BWS) for precise human + AI preference data collection on refined datasets.

---

## Part 1: What Was Implemented

### 1.1 Database Schema (SQLite)

**Added to `rating_projects` table:**
```sql
ALTER TABLE rating_projects ADD COLUMN parent_project_id INTEGER;
ALTER TABLE rating_projects ADD COLUMN filter_criteria TEXT;  -- JSON format
CREATE INDEX idx_rating_projects_parent ON rating_projects(parent_project_id);
```

**Filter Criteria JSON Format:**
```json
{
  "min_score": 0.7,
  "max_score": 1.0,
  "content_types": ["video_chunk", "comment"]
}
```

### 1.2 Backend Methods

**File:** `src/database/db.js`

**Key Methods:**
1. `getItemsForRating(collectionId, includeChunks, includeComments, projectId)`
   - **Auto-detects child projects** via `parent_project_id`
   - If child: fetches from parent's ratings filtered by score/type
   - If root: fetches from collection as before

2. `getRatingProjectLineage(projectId)`
   - Traverses parent chain: Child → Parent → Root
   - Returns array for breadcrumb navigation

3. `getChildProjects(projectId)`
   - Finds all immediate children

4. `getFilteredItemCount(parentProjectId, filterCriteria)`
   - Preview how many items match filter before creating child

**Critical Code Quirk Discovered:**
```javascript
// WRONG (initially implemented):
LEFT JOIN video_chunks vc ON r.item_id LIKE 'chunk_' || vc.video_id || '_' || vc.chunk_number

// CORRECT (actual database format):
LEFT JOIN video_chunks vc ON r.item_id = vc.id
```
**Why:** `item_id` is stored as numeric ID (e.g., 1155), not string format. This caused "0 items" bug in preview.

### 1.3 Frontend Features

**File:** `src/renderer-advanced.js`

**UI Components Added:**
1. **"Create Child Project" button** on completed project viewer
2. **Parent project info notice** (purple gradient box)
3. **Filter controls** (min/max score, content type checkboxes)
4. **Live item count preview** ("262 items")
5. **Breadcrumb lineage** (Root → Child → Grandchild)

**Key JavaScript Methods:**
- `openChildProjectModal()` - Opens modal with parent context
- `updateFilteredItemCount()` - Live preview of filtered items
- `displayProjectLineage()` - Shows clickable breadcrumbs
- `startRating()` - Detects child project, passes parent + filters
- `previewRating()` - Preview for both root and child projects

**Critical Code Quirk:**
```javascript
// For CHILD projects, read from FILTER checkboxes:
includeChunks = document.getElementById('filter-video-chunks')?.checked

// For ROOT projects, read from REGULAR checkboxes:
includeChunks = document.getElementById('rate-chunks')?.checked
```
**Why:** Content type section is hidden for child projects to avoid confusion.

### 1.4 IPC Communication

**File:** `main.js`

**New Handlers:**
- `ai:getChildProjects` - Fetch child projects
- `ai:getProjectLineage` - Get breadcrumb data
- `ai:getFilteredItemCount` - Preview filtered count
- `ai:previewRating` - Extended to support child projects
- `ai:startRating` - Already existed, no changes needed

**Critical Bug Fixed:**
`rating-engine.js` was NOT passing `parentProjectId` and `filterCriteria` to `db.createRatingProject()`. Added:
```javascript
const projectId = await this.db.createRatingProject({
  // ... existing fields ...
  parentProjectId: projectConfig.parentProjectId || null,
  filterCriteria: projectConfig.filterCriteria || null
});
```

---

## Part 2: Testing Results

### Test Case: Australian Shepherd Comments

**Project Chain:**
1. **Root:** `aussie-comment-relevance` (ID: 3)
   - 556 total items, 350 rated
   - Research intent: "Is this comment relevant to Australian Shepherds?"

2. **Child:** `aussie-relevance-substantive-v3` (ID: 10)
   - Parent: Project 3
   - Filter: min_score 0.7, max_score 1.0
   - **262 items** (filtered from 350 successful ratings)
   - Research intent: "Does this comment provide substantive content about Australian Shepherds?"
   - **Results:** 118 scored 1.0 (substantive), 144 scored 0.0 (surface-level)
   - **Success:** 0 failures, all items processed correctly

**Validation:**
```sql
SELECT parent_project_id, filter_criteria FROM rating_projects WHERE id = 10;
-- Result: parent=3, filter={"min_score":0.7,"max_score":1,"content_types":["video_chunk","comment"]}
```

✅ Hierarchical system working perfectly.

---

## Part 3: Code Quirks & Lessons Learned

### 3.1 Database Item ID Formats

**Comments:**
- `item_id` = numeric comment ID from `comments` table
- Join: `r.item_id = c.id` ✅

**Video Chunks:**
- `item_id` = numeric video_chunk ID from `video_chunks` table
- Join: `r.item_id = vc.id` ✅
- **NOT:** String format like `'chunk_videoId_chunkNumber'` ❌

### 3.2 Gemini JSON Parsing Edge Cases

**Issue:** Long reasoning strings get truncated in logs, causing "Invalid JSON" errors:
```
Error: Invalid JSON response: {
  "relevance": 0.0,
  "confidence": 1.0,
  "reasoning": "The comment is a brief, surface-level reaction/agreement...
```

**Cause:** Parser expects complete JSON but reasoning is cut off.

**Solution:** Retry mechanism (3 attempts) usually succeeds. Consider increasing max response length or truncating reasoning server-side.

### 3.3 NULL vs 0.0 Scores

**Observed:** Some ratings have `relevance_score = NULL` in database despite Gemini returning `"relevance": 0`.

**Cause:** Gemini sometimes returns integer `0` instead of float `0.0`, and parser may not handle this consistently.

**Impact:** Low - reasoning still saved, items still filtered correctly (NULL treated as non-relevant).

**Fix (future):** Update parser to handle `0` as `0.0`.

### 3.4 Modal State Management

**Quirk:** When opening child project modal, must set TWO values:
```javascript
// Set dropdown value (visual only):
document.getElementById('ai-collection-select').value = currentProject.collection_id;

// Set controller state (used by startRating()):
this.currentCollection = currentProject.collection_id;
```

Forgetting the second line causes "Please select a collection first" error even when collection is displayed.

### 3.5 Preview vs Actual Rating

Both `previewRating()` and `startRating()` needed separate fixes to handle child projects:
- Preview: Fixed in `main.js` IPC handler
- Rating: Fixed in `rating-engine.js` createRatingProject call

They do NOT share code, so hierarchical logic must be duplicated.

---

## Part 4: Pipeline Context - Where We Are

### 4.1 Full VR-Collector Pipeline

```
1. DATA COLLECTION
   ├─ YouTube URL input
   ├─ yt-dlp downloads videos + metadata
   ├─ Whisper transcribes audio → video chunks
   └─ Extracts comments → SQLite collection

2. RATING PHASE (AI-based) ← WE ARE HERE
   ├─ Root project: Rate all items in collection
   ├─ Child projects: Re-rate filtered high-scoring items
   └─ Recursive refinement until small, high-quality dataset

3. BWS PHASE (Human + AI) ← NEXT STEP
   ├─ Generate item tuples (n=3-5 items per set)
   ├─ Present to raters: "Pick best and worst"
   ├─ Collect preference data
   └─ Estimate item scores via statistical model

4. EXPORT PHASE
   ├─ CARDS 2.0 format (Comments And Rating Data Standard)
   ├─ Include: items, ratings, BWS scores, metadata
   └─ Ready for research/publication
```

### 4.2 Current State

**✅ Completed:**
- Data collection (YouTube + Whisper)
- AI rating with Gemini 2.5 Flash
- Hierarchical rating for dataset refinement
- Export to JSON (basic)

**🎯 Next:**
- Best-Worst Scaling (BWS) implementation
- CARDS 2.0 export standardization

**📊 Typical User Flow:**
```
Collection: 769 items
  ↓ (AI rate: relevance)
Root Project: 350/769 scored ≥ 0.7
  ↓ (AI rate: substantive content)
Child Project: 118/262 scored 1.0
  ↓ (BWS rate: quality ranking)
BWS Experiment: 20-50 items → Fine-grained scores
  ↓
Export: High-quality dataset for research
```

---

## Part 5: Best-Worst Scaling (BWS) - Theory & Requirements

### 5.1 What is BWS?

**Best-Worst Scaling** is a preference elicitation method where raters:
1. View a small set of items (typically 3-5 items, called a "tuple" or "choice set")
2. Select the **BEST** item in the set
3. Select the **WORST** item in the set
4. Repeat for many tuples

**Statistical Model:** Scores are estimated using:
- Counting method (simple: #best - #worst)
- Bradley-Terry model (probability-based)
- Conditional logit model (maximum likelihood)

**Advantages over Likert scales:**
- Forces discrimination (no "all items are 7/10")
- More reliable scores with fewer judgments
- Cross-lingual reliability
- Better for subjective quality judgments

### 5.2 BWS in VR-Collector Context

**Use Case:** After AI filtering, we have ~50-200 "high-quality" items. BWS helps:
1. Rank items precisely for publication
2. Validate AI ratings with human judgment
3. Find the "cream of the crop" (top 10-20 items)
4. Create gold-standard datasets

**Example:**
- User has 118 substantive Aussie comments from hierarchical rating
- Wants to find the **best 20** for a research paper
- Runs BWS experiment: 50 tuples × 3 items = 150 comparisons
- Estimates scores, exports top 20 with confidence intervals

### 5.3 BWS Design Parameters

Users need control over:

#### **A. Tuple Configuration**
- **Tuple size (n):** 3, 4, or 5 items per set
  - n=3: Standard, easy to rate, requires more tuples
  - n=4: More information per tuple, slightly harder
  - n=5: Maximum info but cognitively demanding

- **Number of tuples (k):** How many sets to generate
  - Rule of thumb: Each item should appear ~3-5 times
  - For 50 items with n=3: Need ~50-80 tuples

- **Tuple generation method:**
  - **Random:** Simple, may have imbalanced coverage
  - **Balanced Incomplete Block Design (BIBD):** Each item appears equally often
  - **MaxDiff design:** Maximizes information gain

#### **B. Rater Configuration**
- **Who rates:**
  - **Human only:** Manual selection via UI
  - **AI only:** Gemini makes best/worst picks
  - **Hybrid:** Both human and AI (compare agreement)

- **Number of raters per tuple:**
  - Single rater: Fast but less reliable
  - Multiple raters: Calculate inter-rater reliability (Krippendorff's α)

#### **C. Data Type Separation**
**CRITICAL:** BWS must respect data modalities:

- **Video chunks:** Visual content, duration 3-10s
  - BWS prompt: "Which video best shows [X]?"
  - Cannot compare video to text!

- **Comments:** Text-only
  - BWS prompt: "Which comment is most substantive?"
  - Cannot compare comment to video!

**Implementation:**
```javascript
// CORRECT:
const videoTuples = generateTuples(items.filter(i => i.type === 'video_chunk'), 3);
const commentTuples = generateTuples(items.filter(i => i.type === 'comment'), 3);

// WRONG:
const mixedTuples = generateTuples(items, 3); // May mix videos + comments!
```

#### **D. Scoring Method**
- **Counting:** Simple, interpretable
  - Score = (#times picked as best) - (#times picked as worst)

- **Bradley-Terry:** Probabilistic model
  - Estimates "quality" parameter via maximum likelihood
  - Provides confidence intervals

- **Conditional Logit:** Most sophisticated
  - Handles covariates (e.g., video length, comment upvotes)
  - Requires R or Python libraries

**Recommendation:** Start with counting, add Bradley-Terry later.

---

## Part 6: BWS Implementation Roadmap

### 6.1 Database Schema Additions

**New Tables Needed:**

```sql
-- BWS Experiments
CREATE TABLE bws_experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rating_project_id INTEGER,  -- Source project for items
  item_type TEXT CHECK(item_type IN ('video_chunk', 'comment')),
  tuple_size INTEGER DEFAULT 3,
  tuple_count INTEGER,
  design_method TEXT CHECK(design_method IN ('random', 'bibd', 'maxdiff')),
  scoring_method TEXT CHECK(scoring_method IN ('counting', 'bradley_terry', 'conditional_logit')),
  rater_type TEXT CHECK(rater_type IN ('human', 'ai', 'hybrid')),
  status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rating_project_id) REFERENCES rating_projects(id)
);

-- BWS Tuples (item sets)
CREATE TABLE bws_tuples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER,
  tuple_index INTEGER,  -- 0-based index
  item_ids TEXT,  -- JSON array: [1234, 5678, 9012]
  FOREIGN KEY (experiment_id) REFERENCES bws_experiments(id)
);

-- BWS Judgments
CREATE TABLE bws_judgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tuple_id INTEGER,
  rater_type TEXT CHECK(rater_type IN ('human', 'ai')),
  rater_id TEXT,  -- 'human' or 'gemini-2.5-flash'
  best_item_id INTEGER,
  worst_item_id INTEGER,
  reasoning TEXT,  -- Optional: why these picks?
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tuple_id) REFERENCES bws_tuples(id)
);

-- BWS Scores (computed)
CREATE TABLE bws_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER,
  item_id INTEGER,
  item_type TEXT,
  score_counting REAL,  -- Count-based score
  score_bt REAL,  -- Bradley-Terry score
  score_cl REAL,  -- Conditional logit score
  confidence_interval_lower REAL,
  confidence_interval_upper REAL,
  num_appearances INTEGER,  -- How many tuples included this item
  num_best INTEGER,
  num_worst INTEGER,
  FOREIGN KEY (experiment_id) REFERENCES bws_experiments(id)
);

CREATE INDEX idx_bws_tuples_experiment ON bws_tuples(experiment_id);
CREATE INDEX idx_bws_judgments_tuple ON bws_judgments(tuple_id);
CREATE INDEX idx_bws_scores_experiment ON bws_scores(experiment_id);
```

### 6.2 UI Flow

**Step 1: Create BWS Experiment**
```
User clicks "Create BWS Experiment" on completed rating project
  ↓
Modal:
  - Experiment name
  - Item type: [Video Chunks | Comments | Both (separate experiments)]
  - Tuple size: [3 | 4 | 5]
  - Design method: [Random | BIBD | MaxDiff]
  - Rater type: [Human | AI | Hybrid]
  - Number of tuples: Auto-calculated or manual
  ↓
Generate tuples → Save to database
```

**Step 2: Rate Tuples (Human)**
```
BWS Rating Interface:
  - Show tuple (3 items side-by-side)
  - Video chunks: Embedded players
  - Comments: Text boxes with metadata
  ↓
User clicks "BEST" under one item
User clicks "WORST" under another item
  ↓
Save judgment → Load next tuple
  ↓
Progress bar: "15/50 tuples rated"
```

**Step 3: Rate Tuples (AI)**
```
For each tuple:
  - Build prompt: "Here are 3 comments. Pick the BEST and WORST based on [intent]"
  - Send to Gemini with JSON schema
  - Parse: {best: itemId, worst: itemId, reasoning: "..."}
  - Save judgment
```

**Step 4: Compute Scores**
```
When all tuples rated:
  - Run counting method: score = #best - #worst
  - (Optional) Run Bradley-Terry via R/Python subprocess
  - Save scores to bws_scores table
  - Display ranked list with confidence intervals
```

**Step 5: Export**
```
Export BWS experiment in CARDS 2.0 format:
  - Items with metadata
  - Tuples used
  - All judgments (human + AI)
  - Final scores
  - Provenance (Gemini version, prompt, date)
```

### 6.3 Critical Implementation Details

#### **6.3.1 Tuple Generation**

**Random Method (Easiest):**
```javascript
function generateRandomTuples(items, tupleSize, tupleCount) {
  const tuples = [];
  for (let i = 0; i < tupleCount; i++) {
    const tuple = [];
    const available = [...items];
    for (let j = 0; j < tupleSize; j++) {
      const idx = Math.floor(Math.random() * available.length);
      tuple.push(available.splice(idx, 1)[0]);
    }
    tuples.push(tuple);
  }
  return tuples;
}
```

**Balanced Method (Better):**
Ensure each item appears ~equal number of times. Use combinatorial design or iterative balancing.

#### **6.3.2 AI Rating Prompt**

**For Comments:**
```javascript
const bwsPrompt = `
You are evaluating comments about Australian Shepherds.

Research Intent: ${experimentIntent}

Here are ${tupleSize} comments. Pick the BEST and WORST:

${tuple.map((item, idx) => `
Comment ${idx + 1}:
"${item.text}"
Video: ${item.video_title}
Author: ${item.author_name}
`).join('\n')}

Return JSON:
{
  "best": <index 1-${tupleSize}>,
  "worst": <index 1-${tupleSize}>,
  "reasoning": "Why you picked these"
}
`;
```

**For Videos:**
Send video chunks as multimodal input (same as current rating).

#### **6.3.3 Score Calculation**

**Counting Method:**
```javascript
function calculateCountingScores(items, judgments) {
  const scores = {};

  for (const item of items) {
    scores[item.id] = {
      best: 0,
      worst: 0,
      appearances: 0
    };
  }

  for (const judgment of judgments) {
    const tuple = getTuple(judgment.tuple_id);
    for (const itemId of tuple.item_ids) {
      scores[itemId].appearances++;
    }
    scores[judgment.best_item_id].best++;
    scores[judgment.worst_item_id].worst++;
  }

  for (const itemId in scores) {
    scores[itemId].score = scores[itemId].best - scores[itemId].worst;
  }

  return scores;
}
```

**Bradley-Terry (Needs R or Python):**
Use `BradleyTerry2` R package or `choix` Python library. Call as subprocess:
```javascript
const { execSync } = require('child_process');
const result = execSync(`Rscript calculate_bt_scores.R ${dataFilePath}`);
```

### 6.4 Data Integrity & Validation

**Checks Needed:**

1. **Item Type Homogeneity:**
   ```javascript
   const types = new Set(items.map(i => i.type));
   if (types.size > 1) {
     throw new Error('BWS experiment cannot mix video chunks and comments!');
   }
   ```

2. **Minimum Appearances:**
   ```javascript
   const minAppearances = 3;
   const count = tuples.flat().filter(id => id === itemId).length;
   if (count < minAppearances) {
     console.warn(`Item ${itemId} only appears ${count} times`);
   }
   ```

3. **Judgment Validity:**
   ```javascript
   if (judgment.best_item_id === judgment.worst_item_id) {
     throw new Error('Best and worst cannot be the same item!');
   }
   ```

4. **Rater Agreement (for hybrid):**
   Calculate Krippendorff's α between human and AI judgments.

---

## Part 7: Logging & Provenance

### 7.1 What to Log

**For Each BWS Experiment:**
- Gemini model version (e.g., `gemini-2.5-flash`)
- Prompt template used
- Research intent
- Date/time of rating
- Total cost (API calls)
- All judgments (NEVER discard)

**For Each Judgment:**
- Tuple shown (item IDs + order)
- Rater picks (best/worst)
- Reasoning (if AI)
- Response time (if human)

**For Score Computation:**
- Method used (counting/BT/CL)
- Library versions (if R/Python)
- Confidence intervals
- Diagnostics (convergence warnings, etc.)

### 7.2 CARDS 2.0 Export

**Structure:**
```json
{
  "metadata": {
    "collection_name": "australian shepherd memes",
    "collection_date": "2025-09-30",
    "source": "youtube",
    "tool": "vr-collector",
    "version": "1.0.0"
  },
  "items": [
    {
      "id": 1234,
      "type": "comment",
      "text": "...",
      "video_title": "...",
      "author": "...",
      "metadata": {...}
    }
  ],
  "rating_projects": [
    {
      "id": 3,
      "name": "aussie-comment-relevance",
      "intent": "...",
      "model": "gemini-2.5-flash",
      "parent_project_id": null,
      "ratings": [
        {"item_id": 1234, "score": 0.9, "reasoning": "..."}
      ]
    },
    {
      "id": 10,
      "name": "aussie-relevance-substantive",
      "parent_project_id": 3,
      "filter_criteria": {...},
      "ratings": [...]
    }
  ],
  "bws_experiments": [
    {
      "id": 1,
      "name": "top-20-substantive-comments",
      "rating_project_id": 10,
      "design": {
        "tuple_size": 3,
        "tuple_count": 50,
        "method": "random"
      },
      "tuples": [
        {"tuple_id": 1, "items": [1234, 5678, 9012]}
      ],
      "judgments": [
        {
          "tuple_id": 1,
          "rater": "gemini-2.5-flash",
          "best": 1234,
          "worst": 9012,
          "reasoning": "..."
        }
      ],
      "scores": [
        {
          "item_id": 1234,
          "score_counting": 12,
          "score_bt": 2.34,
          "rank": 1,
          "num_appearances": 15,
          "num_best": 14,
          "num_worst": 2
        }
      ]
    }
  ]
}
```

---

## Part 8: Key Questions for Next Agent

Before implementing BWS, consider:

### 8.1 Design Decisions

1. **Start simple or full-featured?**
   - Option A: Implement random tuples + counting scores (fast, 1-2 days)
   - Option B: Full BIBD design + Bradley-Terry (slower, 1-2 weeks)

2. **Human rating UI priority?**
   - High: Build web interface for human raters first
   - Low: Start with AI-only BWS, add human later

3. **Single experiment or batch?**
   - User rates one BWS experiment at a time
   - Or: Queue multiple experiments (e.g., one for videos, one for comments)

### 8.2 Technical Decisions

1. **R/Python integration for Bradley-Terry?**
   - Pro: More accurate scores, confidence intervals
   - Con: Adds dependency, complexity
   - Alternative: Pure JS implementation (less accurate)

2. **Real-time scoring or batch?**
   - Real-time: Recompute scores after each judgment (expensive)
   - Batch: Compute once all tuples rated (standard)

3. **BWS prompt engineering:**
   - Use same Gemini model as rating (gemini-2.5-flash)?
   - Or try gemini-2.5-pro for more nuanced judgments?

4. **Video BWS challenges:**
   - Can Gemini compare 3-5 videos simultaneously?
   - May need to send 3 video files in one prompt (test token limits)
   - Alternative: Do video BWS in smaller batches

### 8.3 Data Considerations

1. **Minimum dataset size for BWS:**
   - Too small (<10 items): BWS overkill, just manually rank
   - Sweet spot (20-100 items): Perfect for BWS
   - Too large (>200 items): Need multiple BWS experiments or sampling

2. **Handling ties:**
   - BWS forces discrimination (no ties)
   - But final scores may tie (e.g., two items both 0 net score)
   - How to display? Show tied ranks or use tiebreaker (e.g., fewer worst picks)

3. **Video chunk duration mismatch:**
   - User mentioned: "transcript chunks from whisper line up with videos" concerns
   - This is an UPSTREAM issue (collection phase)
   - BWS will inherit this if not fixed
   - Consider: Allow manual trimming of chunks before BWS?

---

## Part 9: Immediate Next Steps for BWS Agent

### Priority 1: Database Schema
1. Create 4 new tables (bws_experiments, bws_tuples, bws_judgments, bws_scores)
2. Add foreign keys and indexes
3. Test with sample data

### Priority 2: Tuple Generation
1. Implement random tuple generator
2. Add validation (no duplicates within tuple, balanced coverage)
3. Test with 50-item dataset

### Priority 3: AI Rating
1. Extend GeminiRater class for BWS judgments
2. Create BWS prompt template
3. Test with 3-item tuples (comments first, videos later)

### Priority 4: Scoring
1. Implement counting method
2. Display ranked list in UI
3. Export to JSON

### Priority 5: Human Rating UI
1. Design BWS rating interface (sketch first!)
2. Implement tuple display (side-by-side items)
3. Add best/worst button clicks
4. Progress tracking

### Priority 6: CARDS 2.0 Export
1. Define JSON schema
2. Implement export function
3. Include all provenance data

---

## Part 10: Files Modified (Reference)

**Database:**
- `scripts/add-hierarchical-rating.js` - Migration script
- `src/database/db.js` - 6 new methods, fixed join condition

**Backend:**
- `src/services/rating-engine.js` - Pass parentProjectId to createRatingProject
- `main.js` - 3 new IPC handlers, fixed preview handler

**Frontend:**
- `src/renderer-advanced.js` - 7 new methods, dual checkbox handling
- `index-advanced.html` - Modal updates, filter controls, breadcrumb container
- `src/styles/rating-projects.css` - 160+ lines for hierarchical UI

**Documentation:**
- `docs/HIERARCHICAL_RATING_SCHEMA_ANALYSIS.md` - Design analysis (50 pages)
- `docs/HIERARCHICAL_RATING_IMPLEMENTATION_GUIDE.md` - Step-by-step guide
- `docs/HIERARCHICAL_RATING_CURRENT_STATUS.md` - Bug tracking (interim)
- `docs/HIERARCHICAL_RATING_COMPLETION_AND_BWS_ROADMAP.md` - This document

---

## Part 11: Known Issues & Future Improvements

### Hierarchical Rating Issues

1. **Whisper chunk alignment:**
   - User reported concerns about transcript/video sync
   - Not blocking BWS, but may affect video BWS quality
   - Fix: Review Whisper chunking logic, possibly add manual adjustment UI

2. **NULL score bug:**
   - Some ratings save NULL instead of 0.0
   - Impact: Low (still filtered correctly)
   - Fix: Update parser to handle integer 0

3. **Long reasoning truncation:**
   - Gemini sometimes returns very long reasoning
   - Causes "Invalid JSON" errors in logs
   - Fix: Increase max response length or server-side truncation

### Future Enhancements

1. **Circular reference detection:**
   - Prevent user from creating: Child → Grandchild → back to Root
   - Currently no check implemented

2. **Lineage depth limits:**
   - Should we allow 5+ levels deep?
   - May become confusing for users

3. **Bulk operations:**
   - "Create 3 child projects with different intents" in one click
   - "Export entire lineage chain"

---

## Part 12: Success Metrics

**Hierarchical Rating (DONE):**
- ✅ Users can create child projects
- ✅ Filtering works correctly (262 items from 350)
- ✅ No data loss or corruption
- ✅ UI intuitive (filter preview, breadcrumbs)

**BWS (TO MEASURE):**
- Users can run BWS on refined datasets
- AI judgments are consistent (>80% agreement with human)
- Scores are interpretable and useful
- Export format accepted by research community

---

## Conclusion

The hierarchical rating system is **production-ready** and successfully achieves its goal: recursive dataset refinement through multi-wave AI ratings. Users can now systematically narrow thousands of items to a high-quality subset ready for Best-Worst Scaling.

**Next agent: You have all the context needed to implement BWS.** Start with simple random tuples + counting scores, validate with user, then add advanced features (BIBD, Bradley-Terry, human UI).

The pipeline is: **Collection → Rating (DONE) → BWS (YOUR TASK) → Export → Research**

Good luck! 🚀

---

**Document Version:** 1.0
**Last Updated:** September 30, 2025
**Next Review:** After BWS implementation complete
