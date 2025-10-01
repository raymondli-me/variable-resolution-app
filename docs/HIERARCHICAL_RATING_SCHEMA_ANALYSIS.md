# Hierarchical Rating Projects: Schema Design Analysis

**Date:** September 30, 2025
**Purpose:** Comprehensive analysis of schema design options for recursive/hierarchical rating workflows
**Status:** Design Phase - No implementation yet

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Use Cases & Requirements](#use-cases--requirements)
3. [Schema Design Options](#schema-design-options)
4. [Deep Analysis of Each Option](#deep-analysis-of-each-option)
5. [Edge Cases & Complications](#edge-cases--complications)
6. [Performance Considerations](#performance-considerations)
7. [Export & Interoperability](#export--interoperability)
8. [Future Extensibility](#future-extensibility)
9. [Recommendation](#recommendation)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Problem Statement

### Current Limitation

Rating projects can only use **collections** as their data source:

```
Collection → Rating Project → Export
```

This is a one-time, one-pass filtering process.

### Desired Capability

Enable **recursive refinement** where rating projects can be data sources for other projects:

```
Collection → Project 1 (filter: relevance) → 150 items
           → Project 2 (filter: quality) → 40 items
           → Project 3 (filter: breed) → 12 items
```

Each wave uses the previous wave's results as input, progressively refining the dataset.

---

## Use Cases & Requirements

### Primary Use Case: Multi-Wave Filtering

**Scenario:** Researcher studying "Anatolian Shepherd dogs looking directly at camera"

1. **Wave 1:** Collect 500 dog videos → Rate for "dogs in frame" → 200 relevant
2. **Wave 2:** Take those 200 → Rate for "looking at camera" → 80 relevant
3. **Wave 3:** Take those 80 → Rate for "Anatolian Shepherd breed" → 15 final items

**Requirements:**
- Track which project a rating project came from
- Filter parent project results (score thresholds, content types)
- Maintain lineage back to original collection
- Visualize hierarchy in UI

### Secondary Use Case: Comparative Analysis

**Scenario:** Different research intents on same data

```
Collection: "dog videos" (500)
  ├─ Project A: "aggression indicators" → 120 items
  ├─ Project B: "playful behavior" → 180 items
  └─ Project C: "training commands" → 95 items
```

**Requirements:**
- Multiple projects from same source
- Compare different ratings of same items
- No parent-child relationship (siblings)

### Tertiary Use Case: Consensus Rating

**Scenario:** Rate same items with multiple intents, combine scores

```
Collection: "dog videos" (500)
  ├─ Rater A: "looking at camera" → scores
  └─ Rater B: "looking at camera" → scores
      └─ Consensus Project: Average scores
```

**Requirements:**
- Merge ratings from multiple projects
- Not strictly hierarchical (more like a join)
- May involve different research intents

### Future Use Case: Cross-Collection Projects

**Scenario:** Combine items from multiple collections

```
Collection A: "YouTube dogs" → 300 items
Collection B: "Stock footage dogs" → 200 items
  └─ Combined Project: Rate all 500 together
```

**Requirements:**
- Project references multiple collections OR other projects
- No single "parent" source
- Many-to-many relationship

---

## Schema Design Options

### Current Schema (Baseline)

```sql
CREATE TABLE rating_projects (
  id INTEGER PRIMARY KEY,
  collection_id INTEGER NOT NULL,  -- Single source
  project_name TEXT NOT NULL,
  research_intent TEXT NOT NULL,
  total_items INTEGER,
  rated_items INTEGER,
  failed_items INTEGER,
  status TEXT,
  settings TEXT,  -- JSON
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);
```

**Limitations:**
- ❌ Can't reference another rating project
- ❌ Can't filter parent project results
- ❌ Can't track lineage
- ❌ Can't support cross-collection projects

---

### Option A: Minimal Addition (Parent Reference)

**Add 2 columns:**

```sql
ALTER TABLE rating_projects
  ADD COLUMN parent_project_id INTEGER REFERENCES rating_projects(id);

ALTER TABLE rating_projects
  ADD COLUMN filter_criteria TEXT;  -- JSON

-- Example data:
-- Project 1: collection_id=1, parent_project_id=NULL
-- Project 2: collection_id=1, parent_project_id=1, filter_criteria='{"min_score":0.7}'
```

**How it works:**
- If `parent_project_id IS NULL` → Root project, fetch from collection
- If `parent_project_id IS NOT NULL` → Child project, fetch from parent's ratings
- `collection_id` still required (tracks root collection for all descendants)

**Pros:**
- ✅ Minimal schema change (2 columns)
- ✅ Non-breaking (existing projects unaffected)
- ✅ Simple to understand (parent = NULL means root)
- ✅ Maintains collection lineage for all projects
- ✅ Easy to query ("all projects from collection 1")
- ✅ Natural tree structure

**Cons:**
- ❌ `collection_id` redundant for child projects (always same as root)
- ❌ Can't support cross-collection projects (only one collection_id)
- ❌ Filter logic lives in application code (not enforced by DB)
- ❌ Requires parsing JSON in queries (slower)

**Query Examples:**

```sql
-- Get all projects in a collection (including descendants)
SELECT * FROM rating_projects WHERE collection_id = 1;

-- Get direct children of a project
SELECT * FROM rating_projects WHERE parent_project_id = 5;

-- Get root projects only
SELECT * FROM rating_projects WHERE parent_project_id IS NULL;

-- Get child projects with filters
SELECT * FROM rating_projects
WHERE parent_project_id IS NOT NULL
  AND json_extract(filter_criteria, '$.min_score') >= 0.7;
```

---

### Option B: Explicit Source Type

**Replace collection_id with generic source:**

```sql
-- Drop constraint, make nullable
ALTER TABLE rating_projects DROP COLUMN collection_id;

ALTER TABLE rating_projects ADD COLUMN source_type TEXT
  CHECK(source_type IN ('collection', 'rating_project', 'multiple'));

ALTER TABLE rating_projects ADD COLUMN source_id INTEGER;

ALTER TABLE rating_projects ADD COLUMN filter_criteria TEXT;

-- Example data:
-- Project 1: source_type='collection', source_id=1
-- Project 2: source_type='rating_project', source_id=1 (Project 1's id)
```

**How it works:**
- Check `source_type` to determine where to fetch items
- If `source_type = 'collection'` → fetch from collections table
- If `source_type = 'rating_project'` → fetch from parent project's ratings
- Lose direct link to root collection (must traverse up)

**Pros:**
- ✅ Explicit and self-documenting (source_type makes intent clear)
- ✅ Extensible to other source types (e.g., 'multiple', 'external')
- ✅ Could support cross-collection if source_type='multiple'

**Cons:**
- ❌ Breaking change (collection_id removed)
- ❌ Every query needs to check source_type
- ❌ Loses root collection lineage (hard to find "all projects from collection 1")
- ❌ More complex queries (joins depend on source_type)
- ❌ Migration more difficult (need to update all existing projects)
- ❌ No foreign key enforcement (source_id could reference non-existent records)

**Query Examples:**

```sql
-- Get items for a project (complex):
SELECT
  CASE
    WHEN rp.source_type = 'collection' THEN
      (SELECT items FROM collection_items WHERE collection_id = rp.source_id)
    WHEN rp.source_type = 'rating_project' THEN
      (SELECT ratings FROM relevance_ratings WHERE project_id = rp.source_id)
  END as items
FROM rating_projects rp
WHERE rp.id = 5;

-- Find root collection (requires recursive CTE):
WITH RECURSIVE lineage AS (
  SELECT id, source_type, source_id FROM rating_projects WHERE id = 5
  UNION ALL
  SELECT rp.id, rp.source_type, rp.source_id
  FROM rating_projects rp
  JOIN lineage l ON rp.id = l.source_id
  WHERE l.source_type = 'rating_project'
)
SELECT * FROM lineage WHERE source_type = 'collection';
```

---

### Option C: No Schema Change (JSON Storage)

**Use existing `settings` column:**

```sql
-- No ALTER statements needed
-- Store in settings JSON:
{
  "parentProjectId": 1,
  "filterCriteria": {
    "minScore": 0.7,
    "contentTypes": ["video_chunk"]
  }
}
```

**How it works:**
- Application checks `settings.parentProjectId`
- If present, fetch from parent project
- Otherwise, fetch from collection

**Pros:**
- ✅ Zero migration needed
- ✅ Maximum flexibility (can change structure anytime)
- ✅ Non-breaking (no schema changes)
- ✅ Fast to implement

**Cons:**
- ❌ No database-level constraints or validation
- ❌ Can't enforce referential integrity (parentProjectId could reference deleted project)
- ❌ Hard to query hierarchies (need to parse JSON)
- ❌ No indexes on JSON fields (slow queries)
- ❌ Fragile (typos in JSON keys, schema drift)
- ❌ Poor database design (important relationships hidden in text blobs)

**Query Examples:**

```sql
-- Find child projects (slow, no index):
SELECT * FROM rating_projects
WHERE json_extract(settings, '$.parentProjectId') = 5;

-- Enforce foreign key? Impossible.
```

---

### Option D: Separate Junction Table (Many-to-Many)

**Create new table for project relationships:**

```sql
CREATE TABLE rating_projects (
  id INTEGER PRIMARY KEY,
  project_name TEXT NOT NULL,
  research_intent TEXT NOT NULL,
  -- NO collection_id or parent_project_id here
);

CREATE TABLE project_sources (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('collection', 'rating_project')),
  source_id INTEGER NOT NULL,
  filter_criteria TEXT,
  FOREIGN KEY (project_id) REFERENCES rating_projects(id)
);

-- Example data:
-- Project 1 sources:
--   project_id=1, source_type='collection', source_id=1
-- Project 2 sources:
--   project_id=2, source_type='rating_project', source_id=1, filter_criteria='{"min_score":0.7}'
-- Cross-collection project:
--   project_id=3, source_type='collection', source_id=1
--   project_id=3, source_type='collection', source_id=2
```

**How it works:**
- Projects can have **multiple sources**
- Query `project_sources` to find what to fetch
- Supports cross-collection, multi-parent scenarios

**Pros:**
- ✅ Most flexible (supports all future use cases)
- ✅ Normalized database design
- ✅ Can combine multiple sources
- ✅ Clean separation of concerns
- ✅ Easy to add new source types

**Cons:**
- ❌ Significant complexity (requires JOINs everywhere)
- ❌ Breaking change (collection_id removed from main table)
- ❌ Harder to visualize simple hierarchies (single-parent trees)
- ❌ Migration more involved
- ❌ Overkill for current use cases

**Query Examples:**

```sql
-- Get all sources for a project:
SELECT * FROM project_sources WHERE project_id = 5;

-- Get items for a project (requires dynamic queries):
-- Application must:
-- 1. Fetch all sources for project
-- 2. For each source, fetch items based on source_type
-- 3. Merge and deduplicate items
-- 4. Apply filter_criteria from each source
```

---

### Option E: Hybrid (Option A + Root Collection Tracking)

**Combine best of A and B:**

```sql
ALTER TABLE rating_projects
  ADD COLUMN parent_project_id INTEGER REFERENCES rating_projects(id);

ALTER TABLE rating_projects
  ADD COLUMN root_collection_id INTEGER REFERENCES collections(id);

ALTER TABLE rating_projects
  ADD COLUMN filter_criteria TEXT;

-- Keep collection_id as "immediate source collection" (nullable for child projects)
-- Add root_collection_id as "original collection" (always set)

-- Example data:
-- Project 1 (root):
--   collection_id=1, parent_project_id=NULL, root_collection_id=1
-- Project 2 (child):
--   collection_id=NULL, parent_project_id=1, root_collection_id=1
```

**How it works:**
- `collection_id` = immediate source (NULL for child projects)
- `root_collection_id` = original collection (set for all projects)
- `parent_project_id` = parent project (NULL for root)

**Pros:**
- ✅ Easy to find all projects from a collection (root_collection_id)
- ✅ Easy to determine if root or child (parent_project_id NULL check)
- ✅ Maintains full lineage
- ✅ Supports future cross-collection (set multiple root_collection_ids)

**Cons:**
- ❌ 3 new columns (most intrusive)
- ❌ Redundancy (collection_id and root_collection_id same for root projects)
- ❌ Migration needs to populate root_collection_id for existing projects
- ❌ Still doesn't support multiple sources without junction table

---

## Deep Analysis of Each Option

### Option A: Minimal Addition

**Database Integrity:**
- ⭐⭐⭐⭐ Good (foreign key on parent_project_id)
- ⚠️ Filter criteria unvalidated (JSON)
- ⚠️ Circular references possible (A→B→A) unless checked in code

**Query Performance:**
- ⭐⭐⭐⭐ Good (indexes on parent_project_id and collection_id)
- ⚠️ JSON parsing in queries (slower, but rare)
- ⭐⭐⭐⭐⭐ Simple queries for common cases

**Development Complexity:**
- ⭐⭐⭐⭐⭐ Very low (minimal code changes)
- ⭐⭐⭐⭐ Easy to reason about
- ⚠️ Need application-level validation for filters

**UI Implications:**
- ⭐⭐⭐⭐⭐ Simple to visualize (tree structure)
- ⭐⭐⭐⭐ Easy breadcrumbs ("Collection 1 → Project A → Project B")
- ⚠️ Can't show cross-collection relationships

**Future Extensibility:**
- ⭐⭐⭐ Limited (can't do cross-collection without major changes)
- ⭐⭐⭐⭐ Easy to add more filter criteria (just update JSON structure)
- ⚠️ Locked into single-parent tree model

**Migration Risk:**
- ⭐⭐⭐⭐⭐ Very low (purely additive)
- ✅ Existing projects work unchanged
- ✅ Rollback trivial (drop columns)

**Export Compatibility:**
- ⭐⭐⭐⭐ Good for VRDS/CARDS (can embed lineage in metadata)
- ⚠️ May need to flatten hierarchy for some formats

---

### Option B: Explicit Source Type

**Database Integrity:**
- ⭐⭐ Poor (no foreign key enforcement on source_id)
- ⚠️ source_id could reference non-existent collection/project
- ⚠️ Orphaned records possible

**Query Performance:**
- ⭐⭐ Poor (every query needs CASE statements or multiple queries)
- ⭐⭐⭐ Index on source_type + source_id helps but queries still complex
- ⚠️ Can't use simple JOINs (depends on source_type)

**Development Complexity:**
- ⭐⭐ High (breaking change requires rewriting many queries)
- ⭐⭐⭐ Logic clearer in code (explicit source types)
- ⚠️ More branching logic everywhere

**UI Implications:**
- ⭐⭐⭐ Moderate (need to handle multiple source types in UI)
- ⚠️ Harder to show lineage (need to traverse up recursively)
- ⭐⭐⭐⭐ Could support varied visualizations (graphs vs trees)

**Future Extensibility:**
- ⭐⭐⭐⭐⭐ Excellent (easy to add new source types)
- ⭐⭐⭐⭐⭐ Supports cross-collection, external sources, etc.
- ⚠️ But each new source type requires code changes everywhere

**Migration Risk:**
- ⭐ Very high (breaking change)
- ❌ All existing projects need migration
- ❌ All queries need updates
- ⚠️ Rollback difficult (data structure changed)

**Export Compatibility:**
- ⭐⭐⭐ Moderate (need to resolve source references for export)
- ⚠️ Complex lineage tracking

---

### Option C: No Schema Change

**Database Integrity:**
- ⭐ Very poor (no constraints, no validation)
- ❌ Can't prevent invalid references
- ❌ Data corruption risk

**Query Performance:**
- ⭐ Very poor (JSON parsing, no indexes)
- ❌ Full table scans for hierarchy queries
- ❌ Scales poorly

**Development Complexity:**
- ⭐⭐⭐⭐⭐ Very low (no migration, just code changes)
- ⚠️ Need extensive application-level validation
- ⚠️ Fragile (JSON structure can drift)

**UI Implications:**
- ⭐⭐⭐⭐ Same as Option A (application handles it)
- ⚠️ No DB-level help with integrity

**Future Extensibility:**
- ⭐⭐⭐⭐⭐ Maximum flexibility (change JSON anytime)
- ⚠️ But no structure = chaos over time

**Migration Risk:**
- ⭐⭐⭐⭐⭐ Zero (no migration needed)
- ✅ Instant implementation
- ⚠️ Technical debt accumulates

**Export Compatibility:**
- ⭐⭐⭐ Same as Option A
- ⚠️ But need to validate JSON before export

---

### Option D: Junction Table

**Database Integrity:**
- ⭐⭐⭐⭐⭐ Excellent (fully normalized, proper constraints)
- ✅ Enforced referential integrity
- ✅ No redundancy

**Query Performance:**
- ⭐⭐⭐ Moderate (requires JOINs for everything)
- ⭐⭐⭐⭐ Can optimize with indexes
- ⚠️ Complex queries for simple cases

**Development Complexity:**
- ⭐ Very high (major rewrite of everything)
- ⚠️ Every operation requires junction table CRUD
- ⭐⭐⭐⭐⭐ Clean architecture once built

**UI Implications:**
- ⭐⭐⭐⭐⭐ Can visualize complex relationships (graphs, DAGs)
- ⭐⭐ Harder for simple cases (overkill for single parent)

**Future Extensibility:**
- ⭐⭐⭐⭐⭐ Maximum (supports everything imaginable)
- ✅ Cross-collection, multi-source, consensus, etc.

**Migration Risk:**
- ⭐ Very high (breaking change, complex migration)
- ⚠️ Need to migrate all existing project references

**Export Compatibility:**
- ⭐⭐⭐⭐ Good (can embed full provenance)
- ⚠️ Need to serialize complex relationships

---

### Option E: Hybrid

**Database Integrity:**
- ⭐⭐⭐⭐ Good (foreign keys, some redundancy)
- ⚠️ Need to keep collection_id and root_collection_id in sync

**Query Performance:**
- ⭐⭐⭐⭐ Good (can query by either collection field)
- ⭐⭐⭐⭐⭐ Fast common queries
- ⚠️ More fields to index

**Development Complexity:**
- ⭐⭐⭐ Moderate (3 new columns, logic to maintain them)
- ⭐⭐⭐⭐ Clear semantics

**UI Implications:**
- ⭐⭐⭐⭐⭐ Best of both worlds (tree + collection lineage)
- ⭐⭐⭐⭐ Easy breadcrumbs and filtering

**Future Extensibility:**
- ⭐⭐⭐ Moderate (better than A, worse than D)
- ⚠️ Still locked into single-parent model

**Migration Risk:**
- ⭐⭐⭐ Moderate (3 columns, need to populate root_collection_id)
- ⭐⭐⭐⭐ Non-breaking if handled right

**Export Compatibility:**
- ⭐⭐⭐⭐⭐ Excellent (full lineage + root collection always known)

---

## Edge Cases & Complications

### 1. Circular References

**Problem:** Project A → Project B → Project A (infinite loop)

**Options:**
- **Option A:** Check in application code before creating child project
- **Option B:** Same (no DB enforcement possible)
- **Option C:** Same
- **Option D:** Could add CHECK constraint with recursive CTE (complex)
- **Option E:** Same as A

**Recommendation:** Application-level validation with warning UI

---

### 2. Deleting Parent Projects

**Problem:** Delete Project A, but Project B depends on it

**Options:**
- **CASCADE:** Delete all children (dangerous!)
- **RESTRICT:** Block deletion if children exist ✅ Recommended
- **SET NULL:** Orphan children (confusing)
- **Soft delete:** Mark as deleted but keep data

**Recommendation:**
- UI warning: "This project has 3 dependent child projects"
- Option to delete children or block deletion
- Database RESTRICT constraint

---

### 3. Re-rating Parent Items

**Problem:** User updates Project A ratings after Project B already created

**Scenario:**
```
Project A: Rate 500 items → 150 score > 0.7
Project B: Take those 150 → Rate for detail → 40 items

User re-runs Project A → Now only 120 items score > 0.7

What happens to Project B?
```

**Options:**
- **Immutable:** Projects are snapshots, Project B still shows 150 items (even if parent changed)
- **Dynamic:** Project B auto-updates to 120 items (confusing!)
- **Versioning:** Track project versions, Project B references "Project A v1"

**Recommendation:** **Immutable snapshots**
- When creating Project B, snapshot item IDs from Project A
- Store in `filter_criteria`: `{"sourceSnapshot": [list of item IDs]}`
- OR store in separate table: `project_item_snapshots`

---

### 4. Cross-Collection Projects

**Problem:** Want to rate items from multiple collections

**Example:**
```
Collection A: YouTube dogs (300 items)
Collection B: Stock footage dogs (200 items)
Combined Project: Rate all 500 together
```

**Option A:** ❌ Can't support (single collection_id)
**Option B:** ⚠️ Could add source_type='multiple' but awkward
**Option D:** ✅ Natural fit (multiple source records)
**Option E:** ⚠️ Could set multiple root_collection_ids but messy

**Is this use case important?**
- For research: **Maybe** (combining datasets is common)
- For now: **Probably not** (can merge collections before rating)

---

### 5. Filter Criteria Validation

**Problem:** Typos, invalid JSON, conflicting filters

**Example:**
```json
{
  "min_score": 1.5,  // Invalid (max is 1.0)
  "content_types": ["video_chunk", "imagee"]  // Typo
}
```

**Solutions:**
- Schema validation in application before saving
- JSON Schema validation
- Enum constraints in database (limited)
- UI with dropdowns/sliders (prevent invalid input)

**Recommendation:**
- Validate in UI (prevent bad input)
- Validate in backend before INSERT
- Store validated JSON only

---

### 6. Performance with Deep Hierarchies

**Problem:** Project at depth 10 (10 ancestors)

**Query:** "Get items for Project 10" requires:
1. Fetch Project 10 → Get parent_project_id = 9
2. Fetch Project 9 ratings with filters
3. If Project 9 has parent, repeat...

**Recursion depth = 10** → Could be slow

**Solutions:**
- **Materialized path:** Store full lineage in single field: `"1/5/8/9/10"`
- **Closure table:** Pre-compute all ancestor relationships
- **Limit depth:** Warn if hierarchy > 5 levels deep
- **Cache:** Cache intermediate results

**Recommendation:**
- Start simple (recursive fetch is fine for depth < 5)
- Add materialized path if performance issues arise
- Warn users if creating deep hierarchies

---

## Performance Considerations

### Indexing Strategy

**Option A:**
```sql
CREATE INDEX idx_rating_projects_parent ON rating_projects(parent_project_id);
CREATE INDEX idx_rating_projects_collection ON rating_projects(collection_id);
CREATE INDEX idx_rating_projects_collection_status ON rating_projects(collection_id, status);
```
**Impact:** Fast queries for "find children" and "find by collection"

**Option B:**
```sql
CREATE INDEX idx_rating_projects_source ON rating_projects(source_type, source_id);
```
**Impact:** Slower (CASE statements in queries, can't use index effectively)

**Option D:**
```sql
CREATE INDEX idx_project_sources_project ON project_sources(project_id);
CREATE INDEX idx_project_sources_lookup ON project_sources(source_type, source_id);
```
**Impact:** Good for junction table, but requires JOINs

---

### Query Complexity

**Option A - Get items for project:**
```sql
-- Simple: 1 query to check parent, then 1 query to fetch
SELECT parent_project_id, filter_criteria FROM rating_projects WHERE id = ?;
-- Then: if parent exists, SELECT from relevance_ratings WHERE project_id = parent AND score >= min
```

**Option B - Get items for project:**
```sql
-- Complex: dynamic query based on source_type
-- Can't write single SQL, must build in application
```

**Option D - Get items for project:**
```sql
-- Multiple queries: fetch sources, then fetch items for each source
SELECT * FROM project_sources WHERE project_id = ?;
-- Then: for each source, query based on source_type
```

**Winner:** Option A (simplest queries)

---

### Storage Overhead

**Option A:** +2 columns × 4 bytes each = 8 bytes per row
**Option B:** Same storage, but removes collection_id so net zero
**Option D:** New table, ~20 bytes per source record (1-N per project)
**Option E:** +3 columns = 12 bytes per row

For 10,000 projects:
- Option A: +80 KB
- Option D: +200-500 KB (depending on sources per project)

**Winner:** Negligible difference, not a factor

---

## Export & Interoperability

### VRDS Export (Video Research Dataset Standard)

**Desired output:**
```json
{
  "dataset_id": "project_3_final",
  "created_at": "...",
  "research_intent": "Anatolian Shepherd looking at camera",
  "lineage": [
    {"project_id": 1, "intent": "dogs in frame", "items_in": 500, "items_out": 200},
    {"project_id": 2, "intent": "looking at camera", "items_in": 200, "items_out": 80},
    {"project_id": 3, "intent": "Anatolian Shepherd", "items_in": 80, "items_out": 15}
  ],
  "items": [ /* 15 final items */ ]
}
```

**Option A:** Easy to traverse up parent_project_id chain
**Option B:** Harder (need to resolve source_type references)
**Option D:** Easy (query junction table for sources)

---

### CARDS 2.0 Export

**CARDS 2.0 supports project metadata:**
```json
{
  "cards_version": "2.0",
  "project": {
    "id": "project_3",
    "parent_project": "project_2",  // ← Need this
    "root_collection": "collection_1"  // ← And this
  }
}
```

**Option A:** ✅ Easy (has both parent and collection)
**Option E:** ✅✅ Perfect (has parent + root_collection explicit)
**Option B:** ⚠️ Harder (need to traverse to find root)

**Winner:** Option E for export, Option A close second

---

## Future Extensibility

### Roadmap Items

1. **Recursive rating** ← We're designing for this now
2. **Cross-collection projects** ← Not supported by A/E, needs D
3. **Consensus rating** (merge multiple projects) ← Needs D or custom logic
4. **External data sources** (non-collection) ← Needs B or D
5. **Project versioning** ← Orthogonal (separate table)
6. **Multi-rater projects** ← Orthogonal (user assignment)
7. **Active learning** (prioritize uncertain items) ← Uses existing ratings
8. **Export to training datasets** ← Uses final project

**Which options support future roadmap?**

| Feature | A | B | C | D | E |
|---------|---|---|---|---|---|
| Recursive rating | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cross-collection | ❌ | ⚠️ | ❌ | ✅ | ❌ |
| Consensus rating | ⚠️ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| External sources | ❌ | ✅ | ❌ | ✅ | ❌ |
| Easy export | ✅ | ⚠️ | ✅ | ⚠️ | ✅✅ |

---

### Adding Features Later

**Starting with Option A, can we add cross-collection later?**

Yes, possible migration paths:
1. **Add junction table later** (Option A → Option D)
2. **Add source_type later** (Option A → Option B)
3. **Keep both systems** (Option A for hierarchies, custom logic for cross-collection)

**Conclusion:** Option A doesn't lock us in permanently, but Option D is more future-proof

---

## Recommendation

### For Immediate Implementation: **Option A (Minimal Addition)**

**Rationale:**

1. **Meets current requirements** (recursive rating, filtering, lineage)
2. **Low risk** (minimal schema change, non-breaking)
3. **Easy to implement** (can ship in days, not weeks)
4. **Good performance** (simple queries, efficient indexes)
5. **Easy to understand** (parent = NULL means root, simple tree)
6. **Export-friendly** (lineage clear, collection always tracked)

**Trade-offs accepted:**
- ❌ Can't do cross-collection projects (not immediate need)
- ❌ Locked into single-parent tree (acceptable for research workflows)

**Migration plan:**
```sql
ALTER TABLE rating_projects ADD COLUMN parent_project_id INTEGER;
ALTER TABLE rating_projects ADD COLUMN filter_criteria TEXT;
CREATE INDEX idx_rating_projects_parent ON rating_projects(parent_project_id);
```

**When to reconsider:**
- If cross-collection becomes critical → migrate to Option D
- If external data sources needed → migrate to Option B or D
- If performance issues at scale → add materialized paths

---

### For Long-Term (Future Phase): **Option D (Junction Table)**

**When to migrate:**
- When cross-collection projects are needed
- When consensus rating (multiple sources) is required
- When performance issues arise with deep hierarchies
- When database design matters more than velocity

**Migration path from A → D:**
1. Create `project_sources` table
2. Migrate existing projects: INSERT INTO project_sources based on parent_project_id and collection_id
3. Keep both schemas temporarily (graceful transition)
4. Update application code to use junction table
5. Remove parent_project_id and collection_id from rating_projects once stable

**Complexity:** High, but enables all future use cases

---

## Implementation Roadmap

### Phase 1: Minimal Hierarchical Support (Option A)

**Timeline:** 1-2 days

**Tasks:**
1. Create migration script (add 2 columns)
2. Update `getItemsForRating()` to check parent_project_id
3. Update `createRatingProject()` to accept parent + filters
4. Add UI: "Create Child Project" button on project viewer
5. Add UI: Filter controls (min_score, max_score, content_types)
6. Add UI: Lineage breadcrumbs in project viewer
7. Test: Create project → child → grandchild → verify filtering

**Deliverable:** Working recursive rating with up to 3-5 levels

---

### Phase 2: Enhanced Visualization & UX

**Timeline:** 2-3 days

**Tasks:**
1. Project hierarchy tree view (interactive)
2. Lineage visualization (breadcrumbs with stats)
3. "View Source Project" navigation
4. Filter preview ("This will include ~120 items from parent")
5. Depth warnings ("Creating 6th level, consider consolidating")

**Deliverable:** Polished UI for hierarchical workflows

---

### Phase 3: Export with Lineage

**Timeline:** 1-2 days

**Tasks:**
1. Update VRDS export to include lineage metadata
2. Update CARDS export to include parent_project reference
3. Add "Export Full Hierarchy" option (exports entire tree)
4. Lineage report (PDF/markdown showing filtering cascade)

**Deliverable:** Publishable exports with full provenance

---

### Phase 4 (Future): Junction Table Migration

**Timeline:** 5-7 days

**Tasks:**
1. Design `project_sources` schema
2. Create migration script (A → D)
3. Update all queries to use junction table
4. Update UI for multi-source selection
5. Test cross-collection workflows
6. Consensus rating features

**Deliverable:** Full multi-source support

---

## Decision Matrix

| Criteria | Weight | A | B | C | D | E |
|----------|--------|---|---|---|---|---|
| Meets immediate needs | 30% | ✅ 5 | ✅ 5 | ⚠️ 3 | ✅ 5 | ✅ 5 |
| Implementation speed | 25% | ✅✅ 5 | ⚠️ 2 | ✅✅ 5 | ❌ 1 | ⚠️ 3 |
| Migration risk | 20% | ✅✅ 5 | ❌ 1 | ✅✅ 5 | ❌ 1 | ⚠️ 3 |
| Query performance | 10% | ✅ 4 | ⚠️ 2 | ❌ 1 | ⚠️ 3 | ✅ 4 |
| Future extensibility | 10% | ⚠️ 3 | ✅ 4 | ⚠️ 2 | ✅✅ 5 | ⚠️ 3 |
| Export compatibility | 5% | ✅ 4 | ⚠️ 2 | ✅ 4 | ⚠️ 3 | ✅✅ 5 |
| **Total Score** | | **4.35** | **2.75** | **3.70** | **2.95** | **3.85** |

**Winner: Option A** (with Option E close second)

---

## Final Thoughts

**Start with Option A:**
- Ship fast, minimal risk
- Solves the immediate problem (recursive rating)
- Keeps options open for future migration

**Monitor for:**
- Need for cross-collection projects
- Performance issues with deep hierarchies
- User requests for multi-source projects

**When those arise, consider Option D migration**

**Don't choose Option C** - it's technical debt masquerading as convenience

---

**Next Step:** Get user approval on Option A, then implement Phase 1

