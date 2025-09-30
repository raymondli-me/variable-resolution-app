# Database Schema Changes - Visual Explanation

## What We Just Did ✅

We updated the database structure to track failures and enable resuming incomplete rating projects.

---

## Before vs After

### Table 1: `rating_projects`

**BEFORE** (❌ Couldn't track failures):
```
┌────┬──────────────┬────────────┬─────────────────┬──────────────┬─────────┐
│ id │ project_name │ collection │ research_intent │ total_items  │ status  │
├────┼──────────────┼────────────┼─────────────────┼──────────────┼─────────┤
│ 1  │ "Stigma"     │ 5          │ "Find mental…"  │ 500          │ pending │
└────┴──────────────┴────────────┴─────────────────┴──────────────┴─────────┘
                                                           ↑
                                        Only total, not success vs failure
```

**AFTER** (✅ Full tracking):
```
┌────┬──────────────┬────────────┬─────────────┬──────────────┬─────────────┬──────────────┬────────────┐
│ id │ project_name │ collection │ total_items │ rated_items  │ failed_items│ last_error   │ status     │
├────┼──────────────┼────────────┼─────────────┼──────────────┼─────────────┼──────────────┼────────────┤
│ 1  │ "Stigma"     │ 5          │ 500         │ 480          │ 20          │ "Missing…"   │ partial    │
└────┴──────────────┴────────────┴─────────────┴──────────────┴─────────────┴──────────────┴────────────┘
                                                     ↑              ↑               ↑            ↑
                                              Success count   Failure count   Debug info   Clear status
```

**New Columns Added:**
- `failed_items` → How many items failed after retries
- `last_error` → Most recent error message (for debugging)
- `paused_at` → Timestamp if user paused (for future resume feature)

---

### Table 2: `relevance_ratings`

**BEFORE** (❌ No way to track failures):
```
┌────┬────────────┬──────────┬─────────────────┬────────────┬────────────┐
│ id │ project_id │ item_id  │ relevance_score │ confidence │ reasoning  │
├────┼────────────┼──────────┼─────────────────┼────────────┼────────────┤
│ 1  │ 1          │ "comm_1" │ 0.8             │ 0.9        │ "Relevant…"│
│ 2  │ 1          │ "comm_2" │ 0.3             │ 0.7        │ "Not rel…" │
└────┴────────────┴──────────┴─────────────────┴────────────┴────────────┘
                                     ↑
                     Required to be NOT NULL → Failed items couldn't be saved!
```

**AFTER** (✅ Failed items saved):
```
┌────┬────────────┬──────────┬─────────────────┬────────────┬─────────┬───────────────┬─────────────┬────────────────┐
│ id │ project_id │ item_id  │ relevance_score │ confidence │ status  │ error_message │ retry_count │ last_retry_at  │
├────┼──────────────┼──────────┼─────────────────┼────────────┼─────────┼───────────────┼─────────────┼────────────────┤
│ 1  │ 1          │ "comm_1" │ 0.8             │ 0.9        │ success │ NULL          │ 0           │ NULL           │
│ 2  │ 1          │ "comm_2" │ 0.3             │ 0.7        │ success │ NULL          │ 0           │ NULL           │
│ 3  │ 1          │ "comm_3" │ NULL            │ NULL       │ failed  │ "Missing…"    │ 3           │ 2025-09-30…    │
└────┴────────────┴──────────┴─────────────────┴────────────┴─────────┴───────────────┴─────────────┴────────────────┘
                                     ↑              ↑            ↑             ↑              ↑               ↑
                              Now nullable     Now nullable   Status!    Why failed?   How many tries?  When last tried?
```

**New Columns Added:**
- `status` → 'success', 'failed', or 'pending'
- `error_message` → Exact error from Gemini (e.g., "Missing relevance field")
- `retry_count` → How many times we tried (0-3)
- `last_retry_at` → When we last attempted this item

**Key Change:**
- `relevance_score` → Changed from `NOT NULL` to nullable (allows NULL for failed items)

---

## Real-World Example

### Scenario: Rating 100 Comments

**Old Behavior (BAD):**
```
Rating comment 1... ✅ Success
Rating comment 2... ✅ Success
Rating comment 3... ❌ GEMINI ERROR: "Missing relevance field"
💥 CRASH - Lost all progress, can't see what failed
```

**New Behavior (GOOD):**
```
Rating comment 1... ✅ Success (saved)
Rating comment 2... ✅ Success (saved)
Rating comment 3... ❌ GEMINI ERROR (retrying...)
  Retry 1... ❌ Failed
  Retry 2... ❌ Failed
  Retry 3... ❌ Failed
  → Marked as FAILED in database, continue to next
Rating comment 4... ✅ Success (saved)
...
Rating comment 100... ✅ Success (saved)

✅ Complete: 97 success, 3 failed
📊 Can view/retry the 3 failed items later
```

**What Gets Saved:**

**rating_projects table:**
```
id: 1
project_name: "Comment Analysis"
total_items: 100
rated_items: 97      ← Successfully rated
failed_items: 3      ← Failed after retries
status: "partial"    ← Has some failures
last_error: "Missing relevance field"
```

**relevance_ratings table (failed item):**
```
id: 3
project_id: 1
item_id: "comment_3"
relevance_score: NULL        ← No score (failed)
confidence: NULL             ← No confidence
status: "failed"             ← Explicitly marked
error_message: "Gemini response missing required field: relevance"
retry_count: 3               ← Tried 3 times
last_retry_at: "2025-09-30 12:15:30"
```

---

## New Database Methods Added

### 1. Get Failed Ratings
```javascript
const failedItems = await db.getFailedRatings(projectId);

// Returns:
[
  {
    id: 3,
    item_id: "comment_3",
    error_message: "Missing relevance field",
    retry_count: 3,
    ...
  },
  {
    id: 7,
    item_id: "comment_7",
    error_message: "Empty response from Gemini",
    retry_count: 3,
    ...
  }
]
```

### 2. Increment Failed Count
```javascript
await db.incrementFailedItems(projectId);
// Updates: failed_items = failed_items + 1
```

### 3. Get Project Statistics
```javascript
const stats = await db.getProjectStatistics(projectId);

// Returns:
{
  project: { ... },           // Full project details
  total: 100,                 // Total items
  success_count: 97,          // Successfully rated
  failed_count: 3,            // Failed items
  pending_count: 0,           // Not yet attempted
  avg_relevance: 0.67,        // Average score
  avg_confidence: 0.82,       // Average confidence
  distribution: {
    high: 30,                 // 0.8+ relevance
    medium: 50,               // 0.4-0.8 relevance
    low: 17                   // <0.4 relevance
  }
}
```

---

## Why This Matters

### Before (Problems):
1. ❌ **Lost Progress** - One error stops everything
2. ❌ **No Visibility** - Don't know what failed
3. ❌ **Can't Resume** - Have to start over
4. ❌ **No Debugging** - No error messages saved

### After (Solutions):
1. ✅ **Never Lose Progress** - Failures are saved, continue rating
2. ✅ **Full Visibility** - See exactly what failed and why
3. ✅ **Resume Ready** - Query failed items, retry them
4. ✅ **Debugging** - Error messages and timestamps saved

---

## Next Steps

Now that the database supports failure tracking, we can build:

1. **Gallery UI** - Browse rating projects with success/failure stats
2. **Failed Items View** - See what failed, why, and retry them
3. **Resume Functionality** - Pick up incomplete projects
4. **Export Options** - Export with/without failed items

The foundation is solid! 🎉
