# Rating Projects Architecture - Robust Failure Handling & Gallery System

## Executive Summary

Transform the AI Analysis tab into a production-ready "Rating Projects" system that gracefully handles failures, allows resuming incomplete projects, and provides a meticulous gallery interface for browsing and managing rating projects.

## Core Concepts

### Terminology
- **Rating Project** = A named set of relevance ratings for a collection's items
- **Failed Items** = Items that couldn't be rated after retries (marked for later)
- **Project Status** = `in_progress`, `completed`, `partial` (has failures), `failed`

### Key Principles
1. **Never Stop on Failure** - Mark as failed, continue rating others
2. **Always Resumable** - Save progress continuously
3. **Transparent Failures** - Show exactly what failed and why
4. **Gallery Experience** - Browse projects like collections

---

## Database Schema Updates

### Enhanced `rating_projects` Table
```sql
ALTER TABLE rating_projects ADD COLUMN failed_items INTEGER DEFAULT 0;
ALTER TABLE rating_projects ADD COLUMN skipped_items INTEGER DEFAULT 0;
ALTER TABLE rating_projects ADD COLUMN last_error TEXT;
ALTER TABLE rating_projects ADD COLUMN paused_at DATETIME;

-- Status values:
-- 'pending'    - Created but not started
-- 'in_progress' - Currently rating
-- 'paused'     - User paused
-- 'partial'    - Completed with some failures
-- 'completed'  - 100% success
-- 'failed'     - Critical error, couldn't start
```

### Enhanced `relevance_ratings` Table
```sql
ALTER TABLE relevance_ratings ADD COLUMN status TEXT DEFAULT 'success';
ALTER TABLE relevance_ratings ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE relevance_ratings ADD COLUMN error_message TEXT;
ALTER TABLE relevance_ratings ADD COLUMN last_retry_at DATETIME;

-- Status values:
-- 'success'   - Rated successfully
-- 'failed'    - Failed after retries
-- 'skipped'   - Explicitly skipped by user
-- 'pending'   - Not yet attempted
```

---

## Failure Handling Strategy

### Current Behavior (BAD)
```javascript
try {
  rating = await gemini.rate(item);
} catch (error) {
  throw error; // ❌ STOPS EVERYTHING
}
```

### New Behavior (GOOD)
```javascript
try {
  rating = await gemini.rate(item, { retries: 3 });
  await db.saveRating({
    ...rating,
    status: 'success'
  });
} catch (error) {
  // Mark as failed, but CONTINUE
  await db.saveRating({
    project_id,
    item_id,
    status: 'failed',
    error_message: error.message,
    retry_count: 3,
    relevance_score: null,
    confidence: null,
    reasoning: null
  });
  
  // Increment failed count
  await db.incrementFailedItems(projectId);
  
  // Emit failure event (for UI)
  this.emit('item-failed', {
    item,
    error: error.message
  });
  
  // CONTINUE to next item
}
```

### Retry Strategy
1. **Per-item retries**: 3 attempts with exponential backoff (1s, 2s, 4s)
2. **Track retry count**: Store in database
3. **Final failure**: Mark as `failed` status, continue to next item
4. **Resume capability**: Can re-attempt failed items later

---

## Rating Project Gallery

### UI Structure

```
Rating Projects Tab
├── Project Gallery (like Collections)
│   ├── Search/Filter bar
│   ├── Stats summary (total projects, success rate, etc.)
│   └── Project cards grid
│       ├── Project card
│       │   ├── Header (name, status badge)
│       │   ├── Stats (progress, success/failed counts)
│       │   ├── Preview (research intent)
│       │   └── Actions (View, Resume, Export, Delete)
│       └── ...
├── Project Details Modal (like Enhanced Viewer)
│   ├── Header (name, collection, status)
│   ├── Stats panel
│   │   ├── Progress: 450/500 (90%)
│   │   ├── Success: 430 (86%)
│   │   ├── Failed: 20 (4%)
│   │   └── Skipped: 0 (0%)
│   ├── Tabs
│   │   ├── Overview (charts, distribution)
│   │   ├── Successful Ratings (browse)
│   │   ├── Failed Items (browse, retry)
│   │   └── Settings (view config)
│   └── Actions (Resume, Export, Delete)
└── Create New Project (existing form)
```

### Project Card Design
```html
<div class="rating-project-card">
  <div class="project-header">
    <h4>{project_name}</h4>
    <span class="status-badge status-{status}">{status}</span>
  </div>
  
  <div class="project-meta">
    <span>{collection_name}</span>
    <span>{created_at}</span>
  </div>
  
  <div class="project-stats">
    <div class="progress-ring">
      <svg><!-- Circular progress --></svg>
      <span class="progress-text">86%</span>
    </div>
    <div class="stats-breakdown">
      <div class="stat">
        <span class="stat-value">430</span>
        <span class="stat-label">Success</span>
      </div>
      <div class="stat stat-failure">
        <span class="stat-value">20</span>
        <span class="stat-label">Failed</span>
      </div>
    </div>
  </div>
  
  <div class="project-preview">
    <p>{research_intent.substring(0, 100)}...</p>
  </div>
  
  <div class="project-actions">
    <button class="btn btn-sm btn-primary" onclick="viewProject(id)">
      View Details
    </button>
    {#if status === 'partial' || status === 'in_progress'}
      <button class="btn btn-sm btn-warning" onclick="resumeProject(id)">
        Resume ({failed_items} to retry)
      </button>
    {/if}
    <button class="btn btn-sm btn-secondary" onclick="exportProject(id)">
      Export
    </button>
  </div>
</div>
```

---

## Project Details Modal

### Overview Tab
- **Charts**:
  - Relevance score distribution (histogram)
  - Confidence distribution
  - Success/failure pie chart
  - Timeline of rating progress
  
- **Stats**:
  - Total items: 500
  - Successfully rated: 430 (86%)
  - Failed items: 20 (4%)
  - Skipped: 0
  - Average relevance: 0.67
  - Average confidence: 0.82
  - Time taken: 2h 15m
  - Cost: $0.75

### Successful Ratings Tab
- Filterable table/list of rated items
- Columns: Score, Confidence, Type, Content Preview, Reasoning
- Sort by score, confidence, date
- Click to see full details

### Failed Items Tab
```html
<div class="failed-items-list">
  <div class="failed-item-header">
    <h3>Failed Items (20)</h3>
    <button class="btn btn-primary" onclick="retryAllFailed()">
      Retry All Failed Items
    </button>
  </div>
  
  <div class="failed-items">
    {#each failedItems as item}
      <div class="failed-item-card">
        <div class="item-info">
          <span class="item-type">{item.type}</span>
          <span class="item-id">{item.id}</span>
        </div>
        <div class="item-content">
          <p>{item.content.substring(0, 200)}...</p>
        </div>
        <div class="item-error">
          <strong>Error:</strong> {item.error_message}
          <small>Last attempted: {item.last_retry_at}</small>
          <small>Retry count: {item.retry_count}</small>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-primary" onclick="retryItem(item.id)">
            Retry Now
          </button>
          <button class="btn btn-sm btn-secondary" onclick="skipItem(item.id)">
            Skip
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>
```

---

## Resume Functionality

### Resume Flow
1. **User clicks "Resume" on partial project**
2. **System queries**: `SELECT * FROM relevance_ratings WHERE project_id = ? AND status = 'failed'`
3. **Display confirmation**: "Found 20 failed items. Retry now?"
4. **On confirm**:
   - Re-initialize rating engine
   - Pass only failed items
   - Update retry counts
   - Show progress in real-time
5. **On completion**:
   - Update project status
   - Show summary: "Recovered 15/20 items. 5 still failed."

### Resume Banner (like incomplete collections)
```html
<div id="resumeRatingBanner" class="resume-banner" style="display: none;">
  <div class="banner-content">
    <h3>⚠️ Resume Incomplete Rating Project?</h3>
    <p>Project "{project_name}" has {failed_items} failed items that can be retried.</p>
    <div class="banner-actions">
      <button class="btn btn-primary" onclick="resumeRating()">
        Resume Rating
      </button>
      <button class="btn btn-secondary" onclick="dismissResumeBanner()">
        Later
      </button>
    </div>
  </div>
</div>
```

---

## Export Format

### Rating Project Export Structure
```json
{
  "export_version": "1.0",
  "export_type": "rating_project",
  "exported_at": "2025-09-30T12:00:00Z",
  
  "project": {
    "id": 1,
    "name": "Mental Health Stigma Analysis",
    "collection_id": 5,
    "collection_name": "depression",
    "research_intent": "Find content discussing mental health stigma...",
    "rating_scale": "ternary",
    "created_at": "2025-09-30T10:00:00Z",
    "completed_at": "2025-09-30T12:00:00Z",
    "status": "partial"
  },
  
  "statistics": {
    "total_items": 500,
    "successfully_rated": 480,
    "failed_items": 20,
    "skipped_items": 0,
    "success_rate": 0.96,
    "average_relevance": 0.67,
    "average_confidence": 0.82,
    "relevance_distribution": {
      "high": 150,
      "medium": 200,
      "low": 130
    },
    "time_taken_seconds": 8100,
    "estimated_cost": 0.75
  },
  
  "ratings": [
    {
      "item_id": "comment_123",
      "item_type": "comment",
      "status": "success",
      "relevance_score": 0.8,
      "confidence": 0.9,
      "reasoning": "This comment directly discusses...",
      "rated_at": "2025-09-30T10:15:00Z",
      "retry_count": 0
    },
    {
      "item_id": "chunk_video123_5",
      "item_type": "video_chunk",
      "status": "failed",
      "error_message": "Gemini response missing required field: relevance",
      "retry_count": 3,
      "last_retry_at": "2025-09-30T11:45:00Z"
    }
  ],
  
  "failed_items_summary": [
    {
      "item_id": "chunk_video123_5",
      "item_type": "video_chunk",
      "error": "Gemini response missing required field: relevance",
      "retry_count": 3,
      "content_preview": "In this video we discuss..."
    }
  ]
}
```

### Export Options
1. **Full Export** - All ratings + failed items
2. **Success Only** - Only successfully rated items
3. **Failed Only** - Only failed items (for debugging)
4. **CARDS Format** - Convert to CARDS with relevance filter

---

## Implementation Plan

### Phase 1: Failure Handling ✅
- [x] Add retry logic to gemini-rater
- [ ] Update rating-engine to catch and mark failures
- [ ] Update database schema with new fields
- [ ] Store failed items with error messages
- [ ] Continue on failure instead of stopping

### Phase 2: Database Enhancements
- [ ] Add `failed_items`, `skipped_items` columns
- [ ] Add `status`, `error_message`, `retry_count` to ratings
- [ ] Create database methods:
  - `getFailedRatings(projectId)`
  - `incrementFailedItems(projectId)`
  - `updateRatingStatus(ratingId, status)`
  - `getProjectStatistics(projectId)`

### Phase 3: Gallery UI
- [ ] Create RatingProjectsGallery component
- [ ] Project cards with stats and status badges
- [ ] Search/filter functionality
- [ ] Sort by date, status, success rate

### Phase 4: Project Details Modal
- [ ] Create detailed view modal
- [ ] Overview tab with charts
- [ ] Successful ratings browser
- [ ] Failed items list with retry buttons
- [ ] Settings/config view

### Phase 5: Resume Functionality
- [ ] Resume banner component
- [ ] Check for incomplete projects on load
- [ ] Retry individual failed items
- [ ] Retry all failed items in batch
- [ ] Update retry counts and timestamps

### Phase 6: Export System
- [ ] Define export format standard
- [ ] Export full project data
- [ ] Export filtered (success only)
- [ ] Export to CARDS format with relevance filter
- [ ] Export failed items report

---

## UI Components

### New Components Needed
1. `RatingProjectsGallery` - Main gallery view
2. `RatingProjectCard` - Individual project card
3. `ProjectDetailsModal` - Detailed view with tabs
4. `FailedItemsList` - List of failed items with retry
5. `ResumeBanner` - Banner for incomplete projects
6. `ProjectStatistics` - Charts and stats component

### Navigation Updates
```
AI Analysis Tab
├── "Create New Project" section (collapsed by default)
├── "Rating Projects" Gallery (main focus)
│   ├── Stats summary
│   ├── Search/filter
│   └── Project cards grid
└── Resume banner (if applicable)
```

---

## User Flows

### Flow 1: Creating a Project
1. User fills in project details
2. Clicks "Start Rating"
3. Project created with status `in_progress`
4. Rating begins, shows progress
5. Some items fail (marked as `failed`, continue)
6. Project completes with status `partial`
7. User sees: "Completed: 480/500. 20 items failed."

### Flow 2: Browsing Projects
1. User opens "Rating Projects" gallery
2. Sees grid of project cards
3. Each card shows: name, collection, progress, status
4. Click "View Details" → Opens modal
5. Browse successful ratings, see distributions
6. Click "Failed Items" tab → See what needs retry

### Flow 3: Resuming Failed Items
1. User sees project card with status `partial`
2. Clicks "Resume (20 to retry)"
3. Confirmation: "Retry 20 failed items?"
4. Progress modal shows retry in real-time
5. Completion: "Recovered 15/20. 5 still failed."
6. Project status updates

### Flow 4: Exporting Results
1. User clicks "Export" on project
2. Modal: "Export Options"
   - [ ] Include failed items
   - [ ] Success only
   - Format: JSON / CARDS
   - Relevance threshold: 0.7
3. Clicks "Export"
4. File saved to Downloads
5. Notification: "Exported 480 ratings to Downloads/..."

---

## Success Metrics

### For Users
- ✅ Never lose progress due to API failures
- ✅ Clear visibility into what failed and why
- ✅ Easy to resume and retry failed items
- ✅ Beautiful gallery to browse all projects
- ✅ Export in standardized formats

### For System
- 95%+ success rate on ratings
- Failed items properly tracked and recoverable
- All state saved to database
- Resume functionality works 100%
- Export format is machine-readable

---

## Future Enhancements

### Phase 7: Analytics
- Compare projects on same collection
- Identify patterns in failures
- Success rate over time
- Cost tracking per project

### Phase 8: Collaboration
- Share rating projects
- Import rating projects
- Merge ratings from multiple raters
- Inter-rater reliability metrics

### Phase 9: Active Learning
- Prioritize uncertain items for human review
- Learn from human corrections
- Adaptive confidence thresholds

---

## Summary

This architecture transforms AI Analysis from a "hope it works" tool into a **production-ready Rating Projects system** with:

1. **Robust failure handling** - Never lose progress
2. **Transparent tracking** - Know exactly what failed
3. **Resume-ability** - Pick up where you left off
4. **Beautiful gallery** - Browse like collections
5. **Standardized exports** - Machine-readable formats
6. **User confidence** - Trust the system works

**Next Steps**: Implement Phase 1 (failure handling) first, then Phase 2 (database), then Phase 3 (gallery UI).
