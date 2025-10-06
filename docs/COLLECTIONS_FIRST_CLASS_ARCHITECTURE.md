# Collections as First-Class Objects: Architecture & Implementation Plan

**Date:** October 6, 2025
**Session Goal:** Transform Collections into manipulable, first-class data structures
**Consultant:** Claude (Sonnet 4.5)
**Status:** 📋 Planning Phase

---

## EXECUTIVE SUMMARY

This document outlines a fundamental architectural shift in the VR Collector application: elevating **Collections** from simple data containers to first-class, manipulable research objects. The current system conflates data sources (Collections) with analysis processes (Rating Projects), limiting workflow flexibility, collaboration capabilities, and database organization.

**The Complete Vision:**

1. **Collections as First-Class Objects** - Manipulable, derivable, chainable data structures
2. **Database as File System** - Organize collections in folders, archive old work, search/filter
3. **Import/Export Portability** - Share collections with collaborators, work across computers
4. **Full Lineage Tracking** - Every collection knows its complete derivation history
5. **Unified Pipeline** - Seamless workflow from data collection to final export

**Workflow Goal:**
```
Collection → filter → sample → rate → filter → rate → sample → BWS → export → share
```

Instead of the current rigid:
```
Collection → Rating Project → (Child Rating Project) → BWS
(No organization, no sharing, no derivation tracking)
```

**Key Innovation:** Treat your database as a "collection of collections"—organized, shareable, and portable. Collections become research artifacts you can manage, refine, and collaborate on.

---

## CURRENT STATE ANALYSIS

### What We Have Now

#### 1. **Collections** (Data Sources)
- **Primary Creation Methods:**
  - YouTube Data API searches → videos, comments, video_chunks
  - PDF uploads → pdfs, pdf_excerpts

- **Secondary Creation Method:**
  - Merged Collections → virtual collections combining 2+ collections
  - Tables: `collection_merges`, `collection_merge_members`
  - Can be used in rating projects and BWS

- **Limitations:**
  - ❌ Cannot create child collections
  - ❌ Cannot filter collections (only filter rating projects)
  - ❌ Cannot randomly sample collections
  - ❌ Cannot duplicate collections
  - ❌ Collections are "create once, use many" (immutable)

#### 2. **Rating Projects** (Analysis Layer)
- **Purpose:** Use Gemini AI to rate items for relevance to research intent
- **Capabilities:**
  - ✅ Can create child projects from parent projects
  - ✅ Filter by score range (min_score, max_score)
  - ✅ Filter by content types (video_chunk, comment, pdf_excerpt)
  - ✅ Track lineage (parent_project_id, filter_criteria)

- **Schema:**
  ```sql
  rating_projects (
    id, collection_id, project_name, research_intent, rating_scale,
    parent_project_id,  -- References another rating_project
    filter_criteria,    -- JSON: {min_score, max_score, content_types}
    merge_id,           -- References collection_merges (for merged collections)
    ...
  )
  ```

- **Limitations:**
  - ❌ Cannot sample from parent (only filter by score)
  - ❌ Hierarchical filtering only works for rating projects, not collections
  - ❌ BWS experiments can't inherit from rating project hierarchies

#### 3. **BWS Experiments** (Preference Elicitation)
- **Purpose:** Best-Worst Scaling for precise ranking
- **Current Design:**
  - Takes items directly from a collection (or merge)
  - Single item_type per experiment (comment/video_chunk/pdf_excerpt)
  - Creates tuples for pairwise comparison
  - Outputs BWS scores + rankings

- **Critical Issues:**
  - ❌ Cannot use rating project results as input
  - ❌ Cannot create child BWS experiments
  - ❌ Loses all filtering/rating context from prior workflow steps
  - ❌ ID collision bug between item types (recently fixed)

#### 4. **Data Flow Diagram (Current)**

```
┌─────────────────────────────────────────────────────┐
│  DATA SOURCES (Collections)                         │
│  - YouTube Search  → videos, comments, chunks       │
│  - PDF Upload      → pdfs, excerpts                 │
│  - Future: News API, Reddit API                     │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
         ┌───────────────┐
         │  Collection   │ (immutable)
         └───────┬───────┘
                 │
      ┌──────────┴──────────────────────────────┐
      │                                          │
      ↓                                          ↓
┌──────────────┐                        ┌──────────────────┐
│ Merged       │                        │  Rating Project  │
│ Collection   │                        │  (filter items)  │
└──────┬───────┘                        └────────┬─────────┘
       │                                         │
       └───────────────┬─────────────────────────┘
                       │
                       ↓
              ┌────────────────┐
              │  Child Rating  │ (filters parent ratings)
              │  Project       │
              └────────┬───────┘
                       │
                       ↓
                  (No further path to BWS with context!)
```

**The Break:** BWS experiments start fresh from collections—they don't inherit the refined dataset from rating project hierarchies.

---

## THE VISION: COLLECTIONS AS FIRST-CLASS OBJECTS

### Core Principle
**Collections should be the universal data structure** that can be:
1. **Created** from multiple sources (YouTube, PDF, APIs, other collections)
2. **Transformed** through operations (filter, sample, merge, duplicate)
3. **Analyzed** through AI workflows (rating, BWS)
4. **Exported** with full provenance and lineage

### Desired Workflow Examples

#### Example 1: Iterative Filtering for Piloting
```
Collection "Basketball Videos" (500 items)
  → filter (score > 0.7)
    → Collection "High Relevance" (150 items)
      → random_sample (n=50)
        → Collection "Pilot Sample" (50 items)
          → rate (refine intent)
            → Collection "Refined" (50 items, newly rated)
              → BWS experiment
                → Rankings + export
```

#### Example 2: Multi-Stage Refinement
```
Collection "Concussion Research PDFs" (2000 excerpts)
  → rate (research_intent: "CTE symptoms")
    → Collection "CTE-Relevant" (800 excerpts, scores attached)
      → filter (score > 0.8)
        → Collection "High CTE" (300 excerpts)
          → rate (research_intent: "diagnostic criteria")
            → Collection "Diagnostic" (300 excerpts, multi-rated)
              → filter (score > 0.9 on diagnostic)
                → Collection "Gold Standard" (50 excerpts)
                  → BWS
                    → Final ranking
```

#### Example 3: Duplicate + Sample for Quick Testing
```
Collection "Eye Contact Dataset" (1000 chunks)
  → duplicate
    → Collection "Eye Contact (Copy)" (1000 chunks)
      → random_sample (n=20)
        → Collection "Eye Contact Test" (20 chunks)
          → rate quickly
            → validate approach before running on full 1000
```

### Key Operations Needed

| Operation | Description | Input | Output |
|-----------|-------------|-------|--------|
| **create_from_source** | YouTube/PDF/API data | API params | Collection |
| **duplicate** | Clone existing collection | Collection | Collection (copy) |
| **merge** | Combine 2+ collections | Collection[] | Collection (merged) |
| **filter** | Filter by criteria | Collection + criteria | Collection (subset) |
| **random_sample** | Sample n items randomly | Collection + n | Collection (sample) |
| **rate** | AI rating workflow | Collection + intent | Collection (w/ scores) |
| **bws_analyze** | Best-Worst Scaling | Collection | Collection (w/ BWS scores) |
| **export** | Export to CARDS/CSV | Collection | File |

---

## ARCHITECTURAL CHALLENGES

### Challenge 1: Collection Mutability vs Immutability

**Current:** Collections are immutable—once created, items never change.

**Needed:** Collections need to carry metadata (ratings, BWS scores) from analysis steps.

**Options:**
- **Option A:** Make collections mutable, add columns to item tables (e.g., `relevance_score` in `video_chunks`)
  - ❌ Couples data to analysis
  - ❌ Breaks if same item rated in multiple projects

- **Option B:** Keep collections immutable, create "Derived Collections" that reference parent + transformations
  - ✅ Preserves provenance
  - ✅ Items can be in multiple collections
  - ⚠️ Requires new `derived_collections` table

- **Option C (RECOMMENDED):** Collections as Views + Provenance
  - Collections reference items (many-to-many)
  - Metadata (scores) stored separately, linked via collection membership
  - Full lineage tracking

### Challenge 2: Rating Projects vs Collections

**Current:** Rating projects contain the filtering/sampling logic.

**Needed:** Filtering/sampling should create new collections, not just filter within rating projects.

**Proposed:**
- Rating projects become "analysis operations" on collections
- Output of rating = new collection with scores attached
- Example:
  ```
  Collection 1 → [Rate] → Collection 2 (same items + scores)
  Collection 2 → [Filter score>0.7] → Collection 3 (subset of items)
  ```

### Challenge 3: BWS Integration

**Current:** BWS reads items directly from collections, ignoring rating context.

**Needed:** BWS should consume refined collections (post-rating/filtering).

**Proposed:**
- BWS experiments take `collection_id` (not raw item queries)
- Collection already contains filtered/rated items
- BWS scores stored back to collection metadata

### Challenge 4: Provenance & Lineage

**Needed:** Track full workflow history:
```
Collection 5 (derived from Collection 3, filtered by score>0.8)
  Collection 3 (derived from Collection 1, rated with intent "X")
    Collection 1 (YouTube search "basketball")
```

**Schema Needs:**
- `parent_collection_id` (nullable)
- `derivation_method` (e.g., "filter", "sample", "rate", "merge")
- `derivation_params` (JSON with operation details)
- `source_type` (enum: "youtube", "pdf", "derived", "merged")

---

## PROPOSED SCHEMA CHANGES

### Option C: Hybrid Core + Extension Pattern (RECOMMENDED)

#### 1. Update `collections` Table
```sql
ALTER TABLE collections ADD COLUMN parent_collection_id INTEGER REFERENCES collections(id);
ALTER TABLE collections ADD COLUMN source_type TEXT DEFAULT 'youtube'
  CHECK(source_type IN ('youtube', 'pdf', 'derived', 'merged'));
ALTER TABLE collections ADD COLUMN derivation_method TEXT;
  -- Values: 'filter', 'sample', 'duplicate', 'rate', 'bws', 'merge'
ALTER TABLE collections ADD COLUMN derivation_params TEXT; -- JSON
ALTER TABLE collections ADD COLUMN item_count INTEGER;

-- Examples:
-- YouTube collection:
--   source_type='youtube', parent_collection_id=NULL, derivation_method=NULL
-- Filtered collection:
--   source_type='derived', parent_collection_id=5, derivation_method='filter',
--   derivation_params='{"min_score": 0.7, "item_type": "video_chunk"}'
-- Sampled collection:
--   source_type='derived', parent_collection_id=5, derivation_method='sample',
--   derivation_params='{"sample_size": 50, "method": "random"}'
```

#### 2. Create `collection_items` Table (Many-to-Many)
```sql
CREATE TABLE collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,  -- 'video_chunk', 'comment', 'pdf_excerpt'
  item_id INTEGER NOT NULL, -- References video_chunks.id, comments.id, or pdf_excerpts.id

  -- Metadata from analysis (nullable, only for derived collections)
  relevance_score REAL,
  bws_score REAL,
  bws_rank INTEGER,
  analysis_metadata TEXT,  -- JSON with reasoning, confidence, etc.

  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  UNIQUE(collection_id, item_type, item_id)
);

CREATE INDEX idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX idx_collection_items_item ON collection_items(item_type, item_id);
```

**How It Works:**
- **Source Collections (YouTube/PDF):** Populate `collection_items` during data ingestion
  - `collection_items` rows have `relevance_score=NULL`, `bws_score=NULL`

- **Derived Collections (Filtered/Sampled):** Copy subset of parent's `collection_items`
  - Inherits scores from parent

- **Rated Collections:** Update `collection_items.relevance_score` for existing rows
  - Creates new "version" of collection? OR updates in place?

- **BWS Collections:** Update `collection_items.bws_score` and `bws_rank`

#### 3. Update `rating_projects` Table
```sql
-- INSTEAD of storing parent_project_id, store parent_collection_id
ALTER TABLE rating_projects ADD COLUMN output_collection_id INTEGER REFERENCES collections(id);

-- Workflow:
-- 1. User creates rating project from Collection 1
-- 2. Rating completes → creates Collection 2 (derived, with scores)
-- 3. output_collection_id = 2
-- 4. User can now filter/sample Collection 2 → Collection 3
```

#### 4. Update `bws_experiments` Table
```sql
ALTER TABLE bws_experiments ADD COLUMN input_collection_id INTEGER REFERENCES collections(id);
ALTER TABLE bws_experiments ADD COLUMN output_collection_id INTEGER REFERENCES collections(id);

-- Workflow:
-- 1. User creates BWS from Collection 3 (refined dataset)
-- 2. BWS completes → updates Collection 3's items with bws_score/rank
-- 3. OR creates Collection 4 with BWS scores
```

---

## COLLECTION MANAGEMENT & PORTABILITY

### The Database as a "Collection of Collections"

**Core Insight:** Users need to manage their research database like a file system—organizing, archiving, sharing, and importing collections as atomic, portable units.

**Current Limitations:**
- ❌ Collections pile up in a flat list (no organization)
- ❌ Cannot archive old/completed research
- ❌ Cannot share collections with collaborators
- ❌ Cannot export/import collections between databases
- ❌ No backup strategy for individual collections
- ❌ No way to organize by project, semester, topic, etc.

**Vision:** Collections should be **organizeable**, **shareable**, and **portable**—just like files in a file system.

### Folder Hierarchy for Collections

**Use Cases:**
- **By Research Project:** `/CTE Study 2025/`, `/Eye Contact Analysis/`
- **By Status:** `/Active/`, `/Archived/`, `/Pilot Tests/`
- **By Semester:** `/Fall 2024/`, `/Spring 2025/`
- **By Data Source:** `/YouTube Data/`, `/PDF Research/`, `/Reddit Threads/`
- **By Collaborator:** `/Shared with Lab/`, `/Personal/`

**Proposed Schema:**

```sql
-- Folders table (recursive hierarchy)
CREATE TABLE folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  color TEXT,  -- UI visual distinction (e.g., "#6366f1")
  icon TEXT,   -- Optional emoji or icon name
  archived BOOLEAN DEFAULT 0,

  -- Folder metadata
  collection_count INTEGER DEFAULT 0,  -- Cached count
  total_items INTEGER DEFAULT 0,       -- Cached aggregate

  UNIQUE(name, parent_folder_id)  -- No duplicate names in same parent
);

CREATE INDEX idx_folders_parent ON folders(parent_folder_id);

-- Update collections table
ALTER TABLE collections ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE collections ADD COLUMN archived BOOLEAN DEFAULT 0;
ALTER TABLE collections ADD COLUMN starred BOOLEAN DEFAULT 0;  -- For favorites

CREATE INDEX idx_collections_folder ON collections(folder_id);
```

**Folder Path Resolution:**
```sql
-- Get full folder path for a collection
WITH RECURSIVE folder_path AS (
  SELECT id, name, parent_folder_id, 0 as depth
  FROM folders WHERE id = (SELECT folder_id FROM collections WHERE id = ?)
  UNION ALL
  SELECT f.id, f.name, f.parent_folder_id, fp.depth + 1
  FROM folders f
  JOIN folder_path fp ON f.id = fp.parent_folder_id
)
SELECT group_concat(name, '/') as full_path
FROM (SELECT name FROM folder_path ORDER BY depth DESC);

-- Result: "Research/CTE Study/2025/Active"
```

**UI Hierarchy Example:**
```
📁 Research
  📁 CTE Study
    📁 2025
      📁 Active
        📊 High CTE Symptoms (Collection)
        📊 Diagnostic Criteria (Collection)
      📁 Archived
        📊 Pilot Test v1 (Collection)
  📁 Eye Contact Analysis
    📊 Basketball Videos (Collection)
    📊 Interview Clips (Collection)
📁 Pilot Tests
  📊 Quick Test Dataset (Collection)
📁 Shared with Lab
  📊 Gold Standard Rankings (Collection)
```

### Export/Import System

#### Export Formats

**1. Single Collection Export (JSON)**
```json
{
  "format_version": "2.0",
  "export_type": "collection",
  "export_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "exported_at": "2025-10-06T12:00:00Z",
  "exported_by": "VR Collector v3.0",

  "collection": {
    "id": 5,
    "name": "High CTE Symptoms",
    "search_term": "concussion CTE symptoms",
    "source_type": "derived",
    "derivation_method": "filter",
    "derivation_params": {
      "min_score": 0.8,
      "item_types": ["pdf_excerpt"]
    },
    "folder_path": "/Research/CTE Study/2025/Active",
    "created_at": "2025-10-05T10:30:00Z",
    "item_count": 300,
    "archived": false,
    "starred": true
  },

  "lineage": [
    {
      "id": 1,
      "name": "Concussion Research PDFs",
      "source_type": "pdf",
      "derivation_method": null
    },
    {
      "id": 2,
      "name": "CTE-Relevant",
      "source_type": "derived",
      "derivation_method": "rate",
      "derivation_params": {
        "research_intent": "CTE symptoms",
        "gemini_model": "gemini-2.5-flash"
      }
    },
    {
      "id": 5,
      "name": "High CTE Symptoms",
      "source_type": "derived",
      "derivation_method": "filter",
      "derivation_params": {"min_score": 0.8}
    }
  ],

  "items": [
    {
      "item_type": "pdf_excerpt",
      "item_id": 123,
      "text_content": "Chronic traumatic encephalopathy (CTE) is a progressive...",
      "relevance_score": 0.85,
      "bws_score": null,
      "bws_rank": null,
      "analysis_metadata": {
        "reasoning": "Directly discusses CTE symptoms and diagnostic criteria",
        "confidence": 0.9
      },
      "source_metadata": {
        "pdf_title": "CTE Diagnostic Guidelines 2024",
        "page_number": 12,
        "excerpt_number": 3
      }
    },
    // ... 299 more items
  ],

  "dependencies": {
    "pdfs": [
      {
        "id": 1,
        "title": "CTE Diagnostic Guidelines 2024",
        "author": "Smith et al.",
        "file_path": "/path/to/file.pdf",
        "num_pages": 45,
        "metadata": {...}
      }
    ],
    "videos": [],
    "parent_collections": [1, 2]
  },

  "statistics": {
    "total_items": 300,
    "item_type_breakdown": {
      "pdf_excerpt": 300,
      "video_chunk": 0,
      "comment": 0
    },
    "score_distribution": {
      "min": 0.80,
      "max": 0.95,
      "mean": 0.87,
      "median": 0.86
    }
  }
}
```

**2. Folder Export (ZIP Bundle)**
```
CTE_Study_2025.zip
├── manifest.json              # Folder metadata + collection list
├── collections/
│   ├── collection_1.json      # Full collection export
│   ├── collection_2.json
│   └── collection_5.json
├── assets/
│   ├── pdfs/
│   │   ├── cte_guidelines_2024.pdf
│   │   └── concussion_review.pdf
│   └── videos/                # (Optional, can be large)
│       └── chunks/
└── README.md                  # Human-readable summary
```

**manifest.json:**
```json
{
  "format_version": "2.0",
  "export_type": "folder",
  "export_uuid": "...",
  "exported_at": "2025-10-06T12:00:00Z",

  "folder": {
    "name": "CTE Study 2025",
    "path": "/Research/CTE Study/2025",
    "description": "Complete CTE research dataset with ratings and BWS",
    "color": "#6366f1"
  },

  "collections": [
    {
      "filename": "collection_1.json",
      "id": 1,
      "name": "Concussion Research PDFs",
      "item_count": 2000
    },
    {
      "filename": "collection_2.json",
      "id": 2,
      "name": "CTE-Relevant",
      "item_count": 800
    },
    {
      "filename": "collection_5.json",
      "id": 5,
      "name": "High CTE Symptoms",
      "item_count": 300
    }
  ],

  "dependencies": {
    "included_assets": true,
    "pdf_files": 15,
    "video_files": 0,
    "total_size_mb": 245
  }
}
```

**3. Full Database Export (SQLite Backup)**
```bash
# Simple SQLite backup
cp ~/Library/Application\ Support/vr-collector/collections.db ~/Desktop/vr-collector-backup-2025-10-06.db

# Or via app UI: Export → Full Database Backup
# Creates: vr-collector-backup-2025-10-06.db + README.txt
```

#### Import Strategies

**Challenge:** ID conflicts when importing collections from another database.

**Solution: ID Remapping**

```sql
-- Track imports for provenance
CREATE TABLE collection_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source_uuid TEXT,      -- Matches export_uuid from source
  source_name TEXT,      -- Original collection name
  source_folder_path TEXT,

  -- What we created
  target_collection_id INTEGER REFERENCES collections(id),
  target_folder_id INTEGER REFERENCES folders(id),

  -- How we imported
  import_strategy TEXT,  -- 'new', 'merge', 'replace', 'skip'
  id_remapping TEXT,     -- JSON: {"old_collection_id": new_id, ...}

  -- Metadata
  items_imported INTEGER,
  conflicts_resolved INTEGER,
  warnings TEXT          -- JSON array of warnings
);
```

**Import Workflow:**

1. **Parse Import File**
   - Validate format version
   - Check for dependencies (parent collections, PDFs, videos)

2. **Conflict Detection**
   - Check if collection with same UUID already exists
   - Check if folder path exists
   - Check if items (videos/PDFs) already exist

3. **Resolution Strategy (User Choice):**
   - **Skip:** Don't import if exists
   - **Merge:** Combine items from both collections
   - **Replace:** Delete existing, import new
   - **Duplicate:** Create new with "(Imported)" suffix

4. **ID Remapping:**
   ```javascript
   const idMap = {};

   // Import PDFs first (if included)
   for (const pdf of importData.dependencies.pdfs) {
     const existingPdf = await db.getPDFByPath(pdf.file_path);
     if (existingPdf) {
       idMap[`pdf_${pdf.id}`] = existingPdf.id;
     } else {
       const newId = await db.importPDF(pdf);
       idMap[`pdf_${pdf.id}`] = newId;
     }
   }

   // Import collection with remapped IDs
   const newCollectionId = await db.createCollection(...);
   idMap[`collection_${importData.collection.id}`] = newCollectionId;

   // Import items with remapped PDF IDs
   for (const item of importData.items) {
     if (item.item_type === 'pdf_excerpt') {
       item.pdf_id = idMap[`pdf_${item.pdf_id}`];
     }
     await db.addItemToCollection(newCollectionId, item);
   }
   ```

5. **Lineage Resolution:**
   - If parent collections missing, warn user
   - Option to import entire lineage chain (if available)
   - Or orphan the collection (parent_collection_id=NULL)

6. **Folder Recreation:**
   - Recreate folder hierarchy from `folder_path`
   - Merge if folder exists
   - Create new if missing

#### Export Tracking

```sql
CREATE TABLE collection_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER REFERENCES collections(id),
  exported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  export_path TEXT,
  export_format TEXT,    -- 'json', 'zip', 'sqlite'
  export_uuid TEXT,      -- UUID for import tracking
  included_dependencies BOOLEAN,
  included_assets BOOLEAN,
  file_size_mb REAL
);
```

### UI Components

#### 1. Folder Browser
```
┌─────────────────────────────────────────────────────┐
│  Collections                            [+ New] [⚙️] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📁 Research                                   (12) │
│    📁 CTE Study                                (8)  │
│      📁 2025                                   (5)  │
│        📊 High CTE Symptoms                    300  │
│        📊 Diagnostic Criteria                  80   │
│      📁 Archived                               (3)  │
│    📁 Eye Contact Analysis                     (4)  │
│  📁 Pilot Tests                                (6)  │
│  ⭐ Starred Collections                        (3)  │
│  🗑️  Archived                                  (15) │
│                                                     │
│  [Right-click folder for options]                  │
│   • New Collection                                 │
│   • New Subfolder                                  │
│   • Rename                                         │
│   • Export Folder...                               │
│   • Archive                                        │
│   • Delete                                         │
└─────────────────────────────────────────────────────┘
```

#### 2. Export Modal
```
┌─────────────────────────────────────────────────────┐
│  Export Collection: "High CTE Symptoms"             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Export Format:                                     │
│  ○ Single Collection (JSON)  ← Recommended for     │
│     • Lightweight, shareable       sharing         │
│     • ~2.5 MB                                       │
│                                                     │
│  ○ Folder Bundle (ZIP)                             │
│     • Includes all collections in folder           │
│     • Includes PDF files (245 MB)                  │
│     • Ready to share complete project              │
│                                                     │
│  ○ Full Database Backup (SQLite)                   │
│     • Everything in your database                  │
│     • For backup/migration                         │
│                                                     │
│  ──────────────────────────────────────────────    │
│                                                     │
│  Include Options:                                  │
│  ☑ Full lineage (parent collections)               │
│  ☑ Item metadata (scores, reasoning)               │
│  ☑ PDF files (required for pdf_excerpts)           │
│  ☐ Video files (optional, large)                   │
│                                                     │
│  Export Location:                                  │
│  [/Users/you/Desktop/exports/    ] [Browse...]     │
│                                                     │
│  [Cancel]                    [Export Collection]   │
└─────────────────────────────────────────────────────┘
```

#### 3. Import Modal
```
┌─────────────────────────────────────────────────────┐
│  Import Collection                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Select File:                                       │
│  [High_CTE_Symptoms.json        ] [Browse...]      │
│                                                     │
│  ──────────────────────────────────────────────    │
│  Preview:                                          │
│                                                     │
│  📊 High CTE Symptoms                              │
│  300 PDF excerpts · Scores: 0.80-0.95              │
│  Lineage: 3 steps (2 parent collections)           │
│  Original folder: /Research/CTE Study/2025/Active  │
│                                                     │
│  ⚠️ Conflicts Detected:                            │
│  • PDF "CTE Guidelines 2024.pdf" already exists    │
│  • Folder "/Research/CTE Study" already exists     │
│                                                     │
│  Resolution:                                       │
│  PDF Conflicts:     [Use Existing ▼]              │
│  Folder Placement:  [Use Existing ▼]              │
│  Collection Name:   [Keep Original ▼]             │
│                                                     │
│  Import to folder:                                 │
│  [/Research/CTE Study/Imported     ] [Browse...]   │
│                                                     │
│  [Cancel]                        [Import]          │
└─────────────────────────────────────────────────────┘
```

### Database Methods (New)

```javascript
// Folder Management
async createFolder(name, parentFolderId, options = {})
async renameFolder(folderId, newName)
async moveFolder(folderId, newParentId)
async deleteFolder(folderId, cascade = false)
async getFolderPath(folderId)  // Returns "/Research/CTE Study/2025"
async getFolderContents(folderId)  // Returns {folders: [], collections: []}

// Collection Organization
async moveCollectionToFolder(collectionId, folderId)
async archiveCollection(collectionId)
async starCollection(collectionId, starred = true)
async searchCollections(query, options = {})  // Search by name, folder, tags

// Export
async exportCollection(collectionId, format, options = {})
  // format: 'json', 'zip', 'sqlite'
  // options: {includeDependencies, includeAssets, includeLin lineage}
async exportFolder(folderId, outputPath)
async exportFullDatabase(outputPath)

// Import
async importCollection(filePath, options = {})
  // options: {strategy: 'skip'|'merge'|'replace'|'duplicate', targetFolder}
async importFolder(zipPath, options = {})
async validateImport(filePath)  // Check for conflicts before importing

// Tracking
async getExportHistory(collectionId)
async getImportHistory()
```

### Sharing Workflow Example

**Scenario:** Researcher wants to share refined dataset with collaborator

1. **Export:**
   ```
   User A (Computer 1):
   - Navigates to "High CTE Symptoms" collection
   - Clicks "Export" → "Single Collection (JSON)"
   - Includes lineage + PDF files
   - Saves to: high_cte_symptoms_export.zip (250 MB)
   - Shares via Google Drive / email
   ```

2. **Import:**
   ```
   User B (Computer 2):
   - Opens VR Collector
   - Clicks "Import Collection"
   - Selects: high_cte_symptoms_export.zip
   - Reviews conflicts (PDFs exist? Folder exists?)
   - Chooses: "Create new folder: /Shared with Lab"
   - Imports → Collection ready to use!
   ```

3. **Result:**
   ```
   User B now has:
   - Full collection (300 items)
   - All PDF files
   - All scores and metadata
   - Complete lineage chain
   - Can continue analysis (filter, BWS, export)
   ```

### Benefits of This System

| Benefit | Description |
|---------|-------------|
| **Organization** | Collections organized by project/semester/topic in hierarchical folders |
| **Archiving** | Archive old research without deleting, keep DB clean |
| **Collaboration** | Share refined datasets with colleagues via standardized exports |
| **Backup** | Export critical collections for safekeeping, version control |
| **Reproducibility** | Full lineage preserved in exports, others can replicate analysis |
| **Multi-computer** | Work on laptop, import to lab desktop seamlessly |
| **Data Portability** | Collections become portable research artifacts, not locked in DB |

### Schema Summary (Collection Management)

```sql
-- New tables
CREATE TABLE folders (...);
CREATE TABLE collection_imports (...);
CREATE TABLE collection_exports (...);

-- Updated tables
ALTER TABLE collections ADD COLUMN folder_id INTEGER REFERENCES folders(id);
ALTER TABLE collections ADD COLUMN archived BOOLEAN DEFAULT 0;
ALTER TABLE collections ADD COLUMN starred BOOLEAN DEFAULT 0;
```

---

## IMPLEMENTATION ROADMAP

### Phase 0: Collection Management (Week 0 - CRITICAL FOUNDATION)
**Goal:** Build folder system and import/export before other features

- [ ] **Schema Migration:**
  - Create `folders` table
  - Create `collection_imports` table
  - Create `collection_exports` table
  - Add `folder_id`, `archived`, `starred` to `collections`

- [ ] **Folder Management:**
  - Database methods for CRUD operations
  - Folder hierarchy browser UI
  - Drag-and-drop collections into folders
  - Archive/unarchive functionality

- [ ] **Export System:**
  - Export single collection to JSON
  - Export folder to ZIP bundle
  - Export full database (SQLite copy)
  - Track exports in database

- [ ] **Import System:**
  - Import JSON collections with ID remapping
  - Conflict detection and resolution UI
  - Folder path recreation
  - Dependency resolution (PDFs, videos)

- [ ] **UI Components:**
  - Folder browser with hierarchy
  - Export modal with format options
  - Import modal with conflict resolution
  - Collection context menu (move, archive, export)

**Why Phase 0?** This is foundational infrastructure that enables sharing and organization from day one. Without it, users can't manage their collections effectively or collaborate.

### Phase 1: Foundation (Week 1)
**Goal:** Add schema support for derived collections

- [ ] Migration script: Add columns to `collections` table
  - `parent_collection_id`, `source_type`, `derivation_method`, `derivation_params`, `item_count`

- [ ] Migration script: Create `collection_items` table
  - Many-to-many relationship between collections and items

- [ ] Backfill existing collections:
  - Populate `collection_items` for all existing YouTube/PDF collections
  - Set `source_type` appropriately

- [ ] Database methods:
  - `createDerivedCollection(parentId, method, params)`
  - `addItemsToCollection(collectionId, items[])`
  - `getCollectionItems(collectionId, options)`
  - `getCollectionLineage(collectionId)` (traverse parent chain)

### Phase 2: Collection Operations (Week 2)
**Goal:** Implement core transformations

- [ ] **Duplicate Collection**
  - Create new collection, copy all `collection_items`
  - Set `source_type='derived'`, `derivation_method='duplicate'`

- [ ] **Filter Collection**
  - UI: Modal with filter criteria (score range, item types, keyword search)
  - Backend: Query parent collection items, filter, create new collection
  - Params: `{min_score, max_score, item_types, keywords}`

- [ ] **Random Sample Collection**
  - UI: Input for sample size (n)
  - Backend: SELECT random subset from parent, create new collection
  - Params: `{sample_size, seed?}`

- [ ] **Merge Collections** (Already Exists!)
  - Extend existing merge system to use new `collection_items` table
  - Set `source_type='merged'`, `derivation_method='merge'`

- [ ] UI Updates:
  - Collection viewer: Show lineage breadcrumbs (like rating projects)
  - Collection card: Show derivation badge (📊 Filtered, 🎲 Sampled, etc.)
  - "Create Child Collection" button → dropdown menu (Duplicate, Filter, Sample, Merge)

### Phase 3: Rating Integration (Week 3)
**Goal:** Rating creates derived collections

- [ ] Update Rating Workflow:
  - Rating project completion → creates `output_collection_id`
  - New collection inherits parent items + adds `relevance_score` to `collection_items`
  - Set `source_type='derived'`, `derivation_method='rate'`

- [ ] Database updates:
  - `rating_projects.output_collection_id` (new column)
  - After rating completes, create derived collection with scores

- [ ] UI Updates:
  - Rating completion screen: "View Rated Collection" button
  - Rated collection viewer: Show scores inline with items
  - Filter UI: Enable score-based filtering on rated collections

### Phase 4: BWS Integration (Week 4)
**Goal:** BWS consumes and produces collections

- [ ] Update BWS Workflow:
  - BWS experiment takes `input_collection_id` (filtered/rated collection)
  - BWS completion → creates `output_collection_id` OR updates input collection
  - Add `bws_score`, `bws_rank` to `collection_items`

- [ ] Database updates:
  - `bws_experiments.input_collection_id` (new column)
  - `bws_experiments.output_collection_id` (new column)
  - After BWS completes, update collection items with scores/ranks

- [ ] UI Updates:
  - BWS creation: Select from collections (not raw items)
  - BWS results viewer: Show ranked collection
  - Export: Include BWS scores in CARDS export

### Phase 5: Advanced Workflows (Week 5)
**Goal:** Enable complex chaining

- [ ] Workflow Builder UI (Optional):
  - Visual pipeline editor: drag-and-drop collection operations
  - Example: Collection 1 → Filter → Sample → Rate → BWS → Export
  - Save workflows as templates

- [ ] Collection Versioning:
  - Problem: Rating the same collection twice creates ambiguity
  - Solution: Version collections (like Git branches)
  - `collections.version`, `collections.version_parent_id`

- [ ] Smart Filters:
  - "Top N by score"
  - "Random stratified sample" (ensure balance across types)
  - "Keyword + score" combined filters
  - "Exclude already rated" (for iterative refinement)

- [ ] Future Data Sources:
  - News API collector
  - Reddit API collector
  - Twitter/X API collector
  - Generic CSV importer

---

## DATA FLOW (PROPOSED)

### Example Workflow: Concussion Research

```
┌─────────────────────────────┐
│ 1. PDF Upload               │
│ "concussion_research.pdf"   │
│ → 2000 excerpts             │
└──────────────┬──────────────┘
               │
               ↓
        ┌──────────────┐
        │ Collection 1  │ (source_type='pdf')
        │ 2000 excerpts │
        └──────┬────────┘
               │
               ↓ [RATE: "CTE symptoms"]
        ┌──────────────┐
        │ Collection 2  │ (derived, method='rate')
        │ 2000 excerpts │ (with scores)
        └──────┬────────┘
               │
               ↓ [FILTER: score > 0.8]
        ┌──────────────┐
        │ Collection 3  │ (derived, method='filter')
        │ 800 excerpts  │
        └──────┬────────┘
               │
               ↓ [SAMPLE: n=50 random]
        ┌──────────────┐
        │ Collection 4  │ (derived, method='sample')
        │ 50 excerpts   │
        └──────┬────────┘
               │
               ↓ [RATE: "diagnostic criteria"]
        ┌──────────────┐
        │ Collection 5  │ (derived, method='rate')
        │ 50 excerpts   │ (multi-rated)
        └──────┬────────┘
               │
               ↓ [FILTER: score > 0.9]
        ┌──────────────┐
        │ Collection 6  │ (derived, method='filter')
        │ 20 excerpts   │
        └──────┬────────┘
               │
               ↓ [BWS]
        ┌──────────────┐
        │ Collection 7  │ (derived, method='bws')
        │ 20 excerpts   │ (with BWS ranks)
        └──────┬────────┘
               │
               ↓ [EXPORT]
           📄 CARDS v2
           (full provenance)
```

**Lineage Query:**
```sql
-- Get full lineage for Collection 7
WITH RECURSIVE lineage AS (
  SELECT * FROM collections WHERE id = 7
  UNION ALL
  SELECT c.* FROM collections c
  JOIN lineage l ON c.id = l.parent_collection_id
)
SELECT * FROM lineage ORDER BY id;

-- Result:
-- 1 | pdf | NULL | NULL
-- 2 | derived | 1 | rate | {"research_intent": "CTE symptoms"}
-- 3 | derived | 2 | filter | {"min_score": 0.8}
-- 4 | derived | 3 | sample | {"sample_size": 50}
-- 5 | derived | 4 | rate | {"research_intent": "diagnostic criteria"}
-- 6 | derived | 5 | filter | {"min_score": 0.9}
-- 7 | derived | 6 | bws | {"experiment_id": 15}
```

---

## UI/UX MOCKUPS

### 1. Collection Viewer (Enhanced)

```
┌────────────────────────────────────────────────────────────┐
│  Collection: "High CTE Symptoms"                           │
│  📊 Derived from "CTE-Relevant" (filtered by score > 0.8)  │
│                                                            │
│  Lineage: PDF Upload → Rate (CTE) → Filter (0.8+) → *You* │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  300 excerpts · PDF · Scores: 0.80-0.95               │ │
│  │                                                       │ │
│  │  [Duplicate] [Filter...] [Sample...] [Rate...] [BWS] │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 2. Filter Collection Modal

```
┌─────────────────────────────────────┐
│  Filter Collection                  │
│  ────────────────────────────────   │
│                                     │
│  Parent: "High CTE Symptoms" (300)  │
│                                     │
│  Score Range:                       │
│  Min: [0.9   ] Max: [1.0   ]        │
│                                     │
│  Content Types:                     │
│  ☑ PDF Excerpts                     │
│  ☐ Video Chunks                     │
│  ☐ Comments                         │
│                                     │
│  Keyword Filter (optional):         │
│  [diagnostic              ]         │
│                                     │
│  ────────────────────────────────   │
│  Preview: ~80 items match           │
│                                     │
│  New Collection Name:               │
│  [Diagnostic Criteria    ]          │
│                                     │
│  [Cancel]  [Create Filtered Collection] │
└─────────────────────────────────────┘
```

### 3. Collection Card (with Derivation Badge)

```
┌─────────────────────────────────┐
│  📊 Gold Standard CTE           │
│  🎲 Sample of 20 from parent    │
│  ─────────────────────────────  │
│  20 PDF excerpts                │
│  Scores: 0.90-0.98              │
│  BWS Ranked                     │
│  ─────────────────────────────  │
│  Created Oct 6, 2025            │
│  Lineage: 6 steps               │
└─────────────────────────────────┘
```

---

## RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Backward Compatibility** | Existing collections break | Backfill script, gradual rollout, feature flags |
| **Performance** | Deep lineage queries slow | Materialized lineage view, index on parent_collection_id |
| **Complexity** | Too many collections clutter UI | Collection search/filter, archive old collections, lineage visualization |
| **Data Duplication** | Same items in many collections | `collection_items` is lightweight (just IDs + scores) |
| **Circular References** | Collection A → B → A loop | Validation check before creating derived collection |
| **Versioning Ambiguity** | Same collection rated twice | Implement collection versioning (Phase 5) |

---

## SUCCESS CRITERIA

### Pilot Workflow (Must Work)
1. Upload PDF collection (500 excerpts)
2. Duplicate it
3. Sample 20 random excerpts from duplicate
4. Rate those 20
5. Filter for score > 0.8
6. Run BWS on refined set
7. Export with full lineage

**Expected Result:** Under 5 minutes, zero manual SQL, full provenance in export.

### Advanced Workflow (Stretch Goal)
1. Create Collection A (YouTube, 1000 chunks)
2. Rate → Collection B (scores attached)
3. Filter → Collection C (top 200)
4. Merge with Collection D (PDF excerpts) → Collection E
5. Sample → Collection F (50 items)
6. Rate → Collection G (multi-rated)
7. BWS → Collection H (final ranked)
8. Export → CARDS v2 with 7-step lineage

**Expected Result:** Lineage breadcrumbs visible at every step, export includes all metadata.

---

## NEXT STEPS (Immediate)

### This Session (Today)
1. ✅ Write this comprehensive architecture document
2. ⏳ Review with user, gather feedback
3. ⏳ Prioritize phases (which weeks are critical?)
4. ⏳ Decide on schema approach (Option C recommended)

### Next Session (Tomorrow?)
1. Implement Phase 1: Schema migration
2. Backfill existing collections → `collection_items`
3. Test lineage queries
4. Create `createDerivedCollection()` method

### Week 1 Goal
- Phase 1 complete: Schema + backfill done
- Phase 2 started: Duplicate + Filter working in UI

---

## OPEN QUESTIONS

### Core Architecture

1. **Rating Updates:** When rating a collection, should it:
   - (A) Update existing collection in-place (mutate `collection_items.relevance_score`)
   - (B) Create new derived collection (immutable, preserves history)
   - **Recommendation:** (B) for provenance, but allow (A) as "update mode"

2. **BWS Updates:** Same question as above.
   - **Recommendation:** (B) to preserve pre-BWS state

3. **Collection Deletion:** If parent collection deleted, what happens to children?
   - **Recommendation:** Cascade delete OR orphan with warning

4. **Merged Collections:** Integrate with new `collection_items` table, or keep separate?
   - **Recommendation:** Integrate—merges are just another derivation method

5. **UI Placement:** Where should "Create Child Collection" button live?
   - **Recommendation:** Collection viewer (like current rating project viewer has)

6. **Workflow Templates:** Should we allow saving operation chains as reusable templates?
   - **Recommendation:** Phase 5 stretch goal

### Collection Management

7. **Export File Size:** What to do with large video files in exports?
   - (A) Always include (very large files)
   - (B) Never include, only metadata (requires re-download)
   - (C) Optional checkbox (user decides)
   - **Recommendation:** (C) with warning about file size

8. **Folder Permissions:** Should folders support access control (shared vs private)?
   - **Recommendation:** Not in v1, but design schema to allow later

9. **Import Conflicts:** Default strategy for ID conflicts?
   - **Recommendation:** "Duplicate with new name" safest default

10. **Export Format Versioning:** How to handle format changes over time?
    - **Recommendation:** Include `format_version` in exports, maintain backward compatibility

11. **Circular Folder References:** Can a folder be moved into its own child?
    - **Recommendation:** Validation check to prevent (like preventing Collection A → B → A)

---

## CONCLUSION

The transformation of Collections into first-class objects is **essential** for enabling the flexible, iterative research workflows you envision. The current system's separation of Collections (data) and Rating Projects (analysis) creates a conceptual barrier that limits piloting, sampling, and workflow chaining.

**The Complete Vision:**
1. **Collection Management:** Folders, import/export, archiving—treat database as organized file system
2. **Schema Evolution:** Add `parent_collection_id`, `derivation_method`, and `collection_items` table
3. **Operation Implementation:** Duplicate, Filter, Sample as first-class collection operations
4. **Integration:** Connect Rating Projects and BWS to produce/consume collections
5. **Provenance:** Full lineage tracking from source to export
6. **Portability:** Standardized formats for sharing collections across computers/collaborators

**Estimated Timeline:**
- **Phase 0 (Week 0):** Collection management foundation (folders, import/export) - **START HERE**
- **Phases 1-4 (Weeks 1-4):** Core collection operations and workflow integration
- **Phase 5 (Week 5+):** Advanced features (templates, versioning, smart filters)

**Critical Success Factors:**
1. **Phase 0 First:** Build organization/sharing infrastructure before operations (collections are useless if you can't manage them)
2. **Backward Compatibility:** Gradual rollout with feature flags
3. **ID Remapping:** Robust import system handles conflicts gracefully
4. **User Testing:** Validate folder UX and export formats early

**What This Enables:**

| Current | Future |
|---------|--------|
| Flat list of collections | Organized folder hierarchy (by project, semester, status) |
| Collections locked in local DB | Export/import for collaboration |
| Rating projects only for filtering | Collections are filterable, samplable, chainable |
| BWS disconnected from rating | Full pipeline: collect → rate → filter → BWS → export |
| No provenance | Complete lineage tracking |
| No backup strategy | Export critical collections as portable archives |

This architecture positions VR Collector as a **true research data pipeline platform**—not just a collection viewer, but a complete system for building, refining, organizing, and sharing research datasets. Collections become:
- **Manipulable** (filter, sample, duplicate)
- **Traceable** (full lineage from source to export)
- **Portable** (standardized import/export)
- **Organized** (folders, archiving, search)
- **Collaborative** (share refined datasets with colleagues)

**The database truly becomes a "collection of collections"**—manageable, shareable, and built for rigorous research workflows.

---

**Ready to proceed?** Let's start with **Phase 0: Collection Management** (folders + import/export), then move to Phase 1. 🚀
