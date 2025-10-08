# Merged Collections Architecture

**Date:** October 7, 2025
**Status:** 📘 DOCUMENTATION

---

## Overview

**Merged Collections** are virtual collections that combine multiple source collections into a unified dataset. Unlike regular collections (which contain videos/PDFs directly), merged collections are **meta-collections** that aggregate content from 2 or more existing collections.

---

## Purpose & Use Cases

### Why Merge Collections?

1. **Cross-Collection Analysis**: Compare videos from different search terms or time periods
   - Example: "concussion_papers_2024" + "concussion_pdf_2014" → "2014 vs 2024 concussion news articles"

2. **Unified Rating/Ranking**: Rate items from multiple collections as a single dataset
   - Example: "australian shepherd memes" + "anatolian shepherd memes" → "Anatolian and Aussies"

3. **Dataset Aggregation**: Create larger datasets for statistical analysis

4. **Thematic Grouping**: Organize related collections by theme/topic

---

## Architecture

### Database Schema

```sql
-- Main merge metadata
CREATE TABLE collection_merges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- User-friendly name
  description TEXT,                      -- Optional description
  settings TEXT,                         -- JSON settings (future use)
  is_active INTEGER DEFAULT 1,           -- Soft delete flag
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Maps which collections belong to which merge
CREATE TABLE collection_merge_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merge_id INTEGER NOT NULL,
  source_collection_id INTEGER NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  weight REAL DEFAULT 1.0,               -- For weighted sampling/rating
  notes TEXT,                            -- Optional metadata
  FOREIGN KEY (merge_id) REFERENCES collection_merges(id) ON DELETE CASCADE,
  FOREIGN KEY (source_collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  UNIQUE(merge_id, source_collection_id) -- Prevent duplicate membership
);
```

### Key Characteristics

- **Virtual**: Merges don't duplicate data; they reference existing collections
- **Dynamic**: Statistics are calculated on-the-fly from source collections
- **Cascading**: Deleting a merge doesn't delete source collections
- **Weighted** (future): Each source can have a weight for sampling

---

## User Interface

### Current UI (Tab-Based)

Located in: `index-advanced.html` → Collections View → "Merged Collections" tab

**Components:**
- `src/components/merge-manager.js` - Main UI controller
- `src/styles/merged-collections.css` - Styling

**Features:**
1. **Create Merge Modal**:
   - Select 2+ collections via checkboxes
   - Enter merge name and description
   - Preview aggregated statistics

2. **Merge List View**:
   - Cards showing merge name, source count, stats
   - Click to view details

3. **Merge Detail View**:
   - Full statistics (total/unique videos, comments, chunks)
   - List of source collections with "Remove" buttons
   - "Browse Content" button (opens collection viewer)

### Relationship to Collections Hub

**Current State:**
- **Collections Hub** (card view): Displays regular collections
- **Merged Collections Tab**: Displays merged collections

**They are separate but complementary:**
- Regular collections appear in the main grid/list view
- Merged collections appear only in the "Merged Collections" tab
- Both use similar viewing/browsing interfaces

---

## Core Functionality

### Creating a Merge

```javascript
// API Call
const mergeId = await window.api.database.createMerge(
  "2014 vs 2024 concussion news",
  [collectionId1, collectionId2],
  { description: "Comparing coverage across decades" }
);
```

**Process:**
1. User clicks "Create Merge" button
2. Modal shows list of available collections
3. User selects 2+ collections
4. User provides name/description
5. System creates merge entry and member records
6. Preview shows aggregated statistics

### Browsing Merged Content

When user clicks "Browse Content" on a merge:

1. Viewer queries all videos/chunks/comments from source collections
2. Content is aggregated and deduplicated (by video_id)
3. Presented as a unified collection in gallery/enhanced viewer

**Special Handling:**
- Video duplicates across sources are counted once
- Comments are aggregated per video
- Chunks from all sources are combined

### Rating/Ranking Merged Collections

Merged collections can be used in:

1. **Rating Projects**: Rate items across all source collections
   - Project targets `merge_id` instead of `collection_id`

2. **BWS Experiments**: Compare items from merged dataset
   - BWS uses merge as source for tuple generation

---

## API Methods

Located in `src/database/db.js`:

```javascript
// Create
createMerge(name, collectionIds, options) → mergeId

// Read
getAllMerges() → Array<Merge>
getMerge(mergeId) → Merge (with source_collections array)
getMergeStatistics(mergeId) → Stats

// Update
addCollectionToMerge(mergeId, collectionId)
removeCollectionFromMerge(mergeId, collectionId)
updateMerge(mergeId, updates)

// Delete
deleteMerge(mergeId, hard = false)
```

---

## Statistics Calculation

Merges track these aggregated statistics:

- **Collections**: Count of source collections
- **Total Videos**: Sum of all videos across sources
- **Unique Videos**: Count after deduplication (by video_id)
- **Duplicate Videos**: Total - Unique
- **Total Comments**: Sum of all comments
- **Total Chunks**: Sum of all video chunks

Calculated via SQL joins on demand (not stored).

---

## Integration with Other Features

### Rating Projects
- Can target `merge_id` instead of `collection_id`
- AI rates all items from all source collections
- Results stored with `merge_id` reference

### BWS Experiments
- Can use merged collection as item source
- Generates tuples across all source collections
- Enables cross-collection ranking

### Collection Viewer
- Unified view of all content
- Handles video deduplication
- Shows source collection badges (future enhancement)

---

## Future Enhancements

1. **Export**: Export merged dataset to JSON/CSV
2. **Weights**: Use collection weights for sampling
3. **Source Badges**: Show which collection each item came from
4. **Merge-of-Merges**: Allow merging existing merges
5. **Hub Integration**: Show merges in the Collections Hub card view

---

## UI Modernization Considerations

The current merged collections UI uses the **tab-based approach** (Saved Collections / Merged Collections tabs). This is separate from the new **Collections Hub** card view.

**Options for Phase 2:**

1. **Keep Separate** (Current State):
   - Pro: Clear distinction between regular and merged collections
   - Con: Feels disconnected from the unified hub vision

2. **Unified View with Filter**:
   - Show both regular and merged collections in the hub
   - Add filter/toggle: "All | Collections | Merges"
   - Pro: True unified hub, consistent UX
   - Con: May clutter the main view

3. **Hybrid Approach**:
   - Show merged collections as special cards in the hub (with distinct styling)
   - Keep "Create Merge" modal accessible from hub
   - Pro: Balanced, clear visual distinction
   - Con: Requires careful UI design to differentiate

**Recommendation:** Address in **Phase 2 - EPIC 2: Polish the Views** after the Grid/List toggle is complete.

---

## Summary

Merged collections are a powerful feature that enables:
- Cross-collection analysis
- Unified rating/ranking
- Dataset aggregation

**Current Status:**
- ✅ Fully functional backend
- ✅ Complete UI in "Merged Collections" tab
- ⏳ Not yet integrated with new Collections Hub card view

**Next Steps:**
- Document the UI integration strategy in Phase 2 blueprint
- Consider visual design for merged collection cards
- Plan for seamless browsing experience across regular and merged collections
