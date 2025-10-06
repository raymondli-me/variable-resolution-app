# Tasks 0.3 & 0.4 Handoff: Backend Completion (Agent A)

**To:** Claude Implementation Agent A (Backend Specialist)
**From:** Consultant Agent
**Date:** October 6, 2025
**Status:** 🔧 Backend Completion Required
**Estimated Time:** 8-10 hours

---

## SITUATION

You are taking over backend export/import implementation from a previous agent (Gemini) who completed ~75% of the work but left critical gaps. A comprehensive audit has been completed - see `docs/CODEBASE_AUDIT_OCT_6_2025.md` for full details.

**Current State:**
- ✅ Database schema 100% complete
- ✅ Basic export working (JSON tested successfully)
- ⚠️ Import logic 60% complete (PDF excerpts only)
- ⚠️ Missing helper methods causing failures
- ⚠️ Folder operations incomplete

**Your Mission:**
Complete all missing backend functionality to make export/import fully operational.

---

## WHAT YOU NEED TO READ FIRST

**Critical Documents (Read in Order):**
1. `docs/API_CONTRACT_PHASE_0.md` - Exact API specifications
2. `docs/CODEBASE_AUDIT_OCT_6_2025.md` - Current state analysis
3. `docs/COLLECTIONS_FIRST_CLASS_ARCHITECTURE.md` - Overall architecture

**Key Files to Understand:**
1. `src/services/collection-exporter.js` - Your main work file
2. `src/services/collection-importer.js` - Your main work file
3. `src/database/db.js` - Integration wrappers (lines 367-387)
4. `main.js` - IPC handlers (lines 895-940)

---

## YOUR TASKS

### Task 1: Complete Collection Exporter

**File:** `src/services/collection-exporter.js`

#### 1.1: Implement `getCollectionsInFolderRecursive(folderId)`

**Location:** Referenced at line 107 but not implemented

**Purpose:** Get all collections in a folder and its subfolders

**Requirements:**
```javascript
/**
 * Get all collections in folder and subfolders recursively
 * @param {number} folderId - Root folder ID
 * @returns {Promise<Array>} Array of collection objects
 */
async getCollectionsInFolderRecursive(folderId) {
  const collections = [];

  // Get collections in this folder
  const directCollections = await this.db.all(
    'SELECT * FROM collections WHERE folder_id = ? AND archived = 0',
    [folderId]
  );
  collections.push(...directCollections);

  // Get subfolders
  const subfolders = await this.db.all(
    'SELECT id FROM folders WHERE parent_folder_id = ? AND archived = 0',
    [folderId]
  );

  // Recursively get collections from subfolders
  for (const subfolder of subfolders) {
    const subCollections = await this.getCollectionsInFolderRecursive(subfolder.id);
    collections.push(...subCollections);
  }

  return collections;
}
```

**Testing:**
```javascript
// Test in Electron console
const exporter = db.exporter;
const result = await exporter.getCollectionsInFolderRecursive(1);
console.log('Collections found:', result.length);
```

---

#### 1.2: Implement or Remove `copyAssets()`

**Location:** Referenced at line 129 but not implemented

**Decision Required:**
- **Option A:** Implement asset copying (complex, requires file system operations)
- **Option B:** Remove the feature for now (simpler, defer to Phase 1)

**Recommended:** Option B - Remove for now

**If Option B (Recommended):**
```javascript
// Line 129-131: Remove these lines
if (options.includeAssets) {
  await this.copyAssets(collections, path.join(tempDir, 'assets'));
}

// Update manifest at line 146-150 to remove assets
// Remove this from manifest:
assets: {
  pdf_files: 0,
  video_files: 0,
  total_size_mb: 0
}
```

**If Option A (Advanced):**
Implement copying PDF and video files to `assets/` folder in ZIP.

**Your Choice:** Decide based on time constraints. Option B is acceptable for Phase 0.

---

#### 1.3: Complete ZIP Export Logic

**Current Issue:** Lines 116-126 need to export each collection properly

**Fix Required:**
```javascript
// At line 116-126, replace placeholder with full export
for (const collection of collections) {
  const jsonPath = path.join(tempDir, 'collections', `collection_${collection.id}.json`);

  // Export this collection to JSON
  const exportData = await this.buildCollectionExportData(collection.id);
  await fs.writeFile(jsonPath, JSON.stringify(exportData, null, 2), 'utf8');

  collectionManifest.push({
    filename: `collection_${collection.id}.json`,
    uuid: collection.uuid,
    name: collection.search_term,
    item_count: exportData.items.length
  });
}
```

**Helper Method to Add:**
```javascript
/**
 * Build export data for a collection (reusable)
 * @param {number} collectionId
 * @returns {Promise<Object>} Export data object
 */
async buildCollectionExportData(collectionId) {
  const collection = await this.db.getCollection(collectionId);
  const folderPath = collection.folder_id
    ? await this.db.getFolderPath(collection.folder_id)
    : null;
  const lineage = await this.getCollectionLineage(collectionId);
  const items = await this.getCollectionItems(collectionId);
  const dependencies = await this.getCollectionDependencies(collectionId, items);
  const statistics = this.calculateStatistics(items);

  return {
    format_version: "2.0",
    export_type: "collection",
    export_uuid: crypto.randomUUID(),
    exported_at: new Date().toISOString(),
    exported_by: "Variable Resolution App v3.0",
    collection: {
      uuid: collection.uuid,
      id: collection.id,
      name: collection.search_term,
      search_term: collection.search_term,
      source_type: collection.source_type || 'youtube',
      derivation_method: collection.derivation_method,
      derivation_params: collection.derivation_params ? JSON.parse(collection.derivation_params) : null,
      folder_path: folderPath,
      created_at: collection.created_at,
      archived: collection.archived || false,
      starred: collection.starred || false,
      video_count: collection.video_count || 0,
      comment_count: collection.comment_count || 0,
      item_count: statistics.total_items
    },
    lineage,
    items,
    dependencies,
    statistics
  };
}
```

Then update `exportCollectionJSON()` at line 18 to use this:
```javascript
async exportCollectionJSON(collectionId, outputPath, options = {}) {
  const exportData = await this.buildCollectionExportData(collectionId);

  const filepath = outputPath;
  const parentDir = path.dirname(filepath);
  await fs.mkdir(parentDir, { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(exportData, null, 2), 'utf8');

  await this.trackExport(collectionId, filepath, 'json', exportData.export_uuid, true, false);

  return filepath;
}
```

---

### Task 2: Complete Collection Importer

**File:** `src/services/collection-importer.js`

#### 2.1: Implement Video Chunk Import

**Location:** Line 271 - `importItem()` only handles PDF excerpts

**Add to `importItem()` method:**
```javascript
async importItem(item, collectionId, idMap) {
  if (item.item_type === 'pdf_excerpt') {
    // ... existing PDF code ...
  }

  else if (item.item_type === 'video_chunk') {
    // First, ensure the video exists
    let videoId = null;

    // Check if video exists by YouTube ID
    const existingVideo = await this.db.get(
      'SELECT id FROM videos WHERE video_id = ?',
      [item.source_metadata.video_id]
    );

    if (existingVideo) {
      videoId = existingVideo.id;
    } else {
      // Create placeholder video entry
      const newVideo = await this.db.run(`
        INSERT INTO videos (
          video_id, title, channel_title, published_at
        ) VALUES (?, ?, ?, ?)
      `, [
        item.source_metadata.video_id || 'imported_' + crypto.randomUUID(),
        item.source_metadata.video_title || 'Imported Video',
        item.source_metadata.channel_title || 'Unknown Channel',
        new Date().toISOString()
      ]);
      videoId = newVideo.lastID;
    }

    // Create video chunk
    await this.db.run(`
      INSERT INTO video_chunks (
        video_id, collection_id, chunk_number,
        start_time, end_time, transcript_text, file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      videoId,
      collectionId,
      item.source_metadata.chunk_number || 0,
      item.source_metadata.start_time || 0,
      item.source_metadata.end_time || 0,
      item.text_content,
      item.source_metadata.file_path || null
    ]);
  }

  else if (item.item_type === 'comment') {
    // Similar to video_chunk - ensure video exists first
    let videoId = null;

    const existingVideo = await this.db.get(
      'SELECT id FROM videos WHERE video_id = ?',
      [item.source_metadata.video_id]
    );

    if (existingVideo) {
      videoId = existingVideo.id;
    } else {
      const newVideo = await this.db.run(`
        INSERT INTO videos (
          video_id, title, channel_title, published_at
        ) VALUES (?, ?, ?, ?)
      `, [
        item.source_metadata.video_id || 'imported_' + crypto.randomUUID(),
        item.source_metadata.video_title || 'Imported Video',
        'Unknown Channel',
        new Date().toISOString()
      ]);
      videoId = newVideo.lastID;
    }

    // Create comment
    await this.db.run(`
      INSERT INTO comments (
        video_id, collection_id, comment_id,
        text, author_name, like_count
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      videoId,
      collectionId,
      'imported_' + crypto.randomUUID(),
      item.text_content,
      item.source_metadata.author_name || 'Unknown',
      item.source_metadata.like_count || 0
    ]);
  }

  else {
    console.warn(`Unknown item type: ${item.item_type}`);
  }
}
```

---

#### 2.2: Implement Folder Path Recreation

**Location:** Lines 119-122 have placeholder

**Complete Implementation:**
```javascript
// In detectConflicts() at lines 119-122
if (importData.collection.folder_path) {
  // Parse folder path (e.g., "/Research/CTE Study/2025")
  const pathParts = importData.collection.folder_path.split('/').filter(p => p);

  let currentParentId = null;

  for (const folderName of pathParts) {
    // Check if folder exists
    const existing = await this.db.get(
      'SELECT id FROM folders WHERE name = ? AND parent_folder_id IS ?',
      [folderName, currentParentId]
    );

    if (existing) {
      currentParentId = existing.id;
    } else {
      // Folder doesn't exist - will need to create it during import
      conflicts.folder_path = {
        path: importData.collection.folder_path,
        exists: false
      };
      break;
    }
  }

  if (currentParentId) {
    conflicts.folder_path = {
      path: importData.collection.folder_path,
      exists: true,
      folderId: currentParentId
    };
  }
}
```

**Then in `performImport()` at line 239 (targetFolderId assignment):**
```javascript
// Before line 239, add folder creation logic
let finalFolderId = targetFolderId;

if (importData.collection.folder_path && !targetFolderId) {
  // Recreate folder structure
  const pathParts = importData.collection.folder_path.split('/').filter(p => p);
  let currentParentId = null;

  for (const folderName of pathParts) {
    const existing = await this.db.get(
      'SELECT id FROM folders WHERE name = ? AND parent_folder_id IS ?',
      [folderName, currentParentId]
    );

    if (existing) {
      currentParentId = existing.id;
    } else {
      // Create folder
      const newFolder = await this.db.run(`
        INSERT INTO folders (name, parent_folder_id, color)
        VALUES (?, ?, ?)
      `, [folderName, currentParentId, '#6366f1']);
      currentParentId = newFolder.lastID;
    }
  }

  finalFolderId = currentParentId;
}

// Then use finalFolderId instead of targetFolderId in the INSERT
const newCollectionId = await this.db.run(`
  INSERT INTO collections (
    uuid, search_term, folder_id, ...
  ) VALUES (?, ?, ?, ...)
`, [
  newCollectionUUID,
  importData.collection.name,
  finalFolderId,  // <-- Use finalFolderId here
  ...
]);
```

---

### Task 3: Test Everything

#### 3.1: Export Tests

**Test 1: Single Collection Export**
```javascript
// In Electron console
const exportPath = '/Users/raymondli701/Desktop/exports/test-export.json';
const result = await window.api.collections.exportToJSON(1, exportPath);
console.log('Export result:', result);

// Verify file exists and has correct structure
const fs = require('fs').promises;
const data = JSON.parse(await fs.readFile(exportPath, 'utf8'));
console.log('Format version:', data.format_version);
console.log('Items count:', data.items.length);
console.log('Dependencies:', data.dependencies);
```

**Test 2: Folder Export to ZIP**
```javascript
// Create a folder first if needed
const folder = await window.api.folders.create('Test Folder', null, {});
await window.api.collections.moveToFolder(1, folder.data);

const zipPath = '/Users/raymondli701/Desktop/exports/test-folder.zip';
const result = await window.api.folders.exportToZIP(folder.data, zipPath, {
  includeSubfolders: true,
  includeArchived: false
});
console.log('ZIP export result:', result);
```

---

#### 3.2: Import Tests

**Test 1: Basic Import**
```javascript
// Import the collection we just exported
const importPath = '/Users/raymondli701/Desktop/exports/test-export.json';
const result = await window.api.collections.importFromJSON(importPath, {
  targetFolderId: null,
  conflictResolution: 'duplicate',  // Create new with different UUID
  preserveUUID: false
});
console.log('Import result:', result);
console.log('New collection ID:', result.data.newCollectionId);
console.log('Items imported:', result.data.itemsImported);
```

**Test 2: UUID Conflict**
```javascript
// Try importing the SAME file again (same UUID)
const result2 = await window.api.collections.importFromJSON(importPath, {
  conflictResolution: 'skip'  // Should skip
});
console.log('Should skip:', result2);

const result3 = await window.api.collections.importFromJSON(importPath, {
  conflictResolution: 'rename'  // Should create with new UUID
});
console.log('Should create new:', result3);
```

**Test 3: Folder Structure Recreation**
```javascript
// Export a collection in a folder
const folderResult = await window.api.folders.create('Research', null, {});
await window.api.collections.moveToFolder(1, folderResult.data);

const exportPath = '/Users/raymondli701/Desktop/exports/with-folder.json';
await window.api.collections.exportToJSON(1, exportPath);

// Delete the folder and collection
await window.api.folders.delete(folderResult.data, true);

// Import and verify folder recreated
const importResult = await window.api.collections.importFromJSON(exportPath, {
  recreateFolderStructure: true
});

// Check if folder exists
const folders = await window.api.folders.getContents(null);
console.log('Folders after import:', folders.data.folders);
// Should see "Research" folder recreated
```

---

### Task 4: Fix Any Bugs

**Common Issues to Watch For:**

1. **Database NULL Handling**
   - SQL: `WHERE parent_folder_id IS NULL` vs `WHERE parent_folder_id = NULL`
   - Use `IS NULL` for null checks

2. **Async/Await**
   - Always await database calls
   - Use try/catch for error handling

3. **JSON Parsing**
   - Check if string before parsing: `typeof x === 'string' ? JSON.parse(x) : x`

4. **ID Remapping**
   - Ensure all foreign keys are remapped
   - Test with circular references (parent collections)

5. **File Paths**
   - Always use `path.join()` for cross-platform compatibility
   - Ensure parent directories exist before writing

---

## SUCCESS CRITERIA

### Must Complete ✅

- [ ] `getCollectionsInFolderRecursive()` implemented and tested
- [ ] `copyAssets()` implemented OR calls removed (decision documented)
- [ ] ZIP export includes all collections in folder
- [ ] Video chunk import working
- [ ] Comment import working
- [ ] Folder path recreation working
- [ ] All 6 test scenarios pass
- [ ] No database errors in console

### Quality Bar

- [ ] Code follows existing patterns
- [ ] Proper error handling (try/catch)
- [ ] Comments explain complex logic
- [ ] No console warnings or errors
- [ ] Matches API contract exactly

---

## DELIVERABLES

When complete, create: `docs/AGENT_A_COMPLETION_REPORT.md`

**Include:**
1. Summary of what was implemented
2. Test results (all 6 tests with outputs)
3. Any decisions made (e.g., copyAssets removal)
4. Known limitations or edge cases
5. Code quality self-assessment
6. Estimated time vs actual time

**Format:**
```markdown
# Agent A Completion Report: Backend Export/Import

**Agent:** Claude Implementation Agent A
**Date:** [Date]
**Time Spent:** [X hours]
**Status:** ✅ Complete

## Implementation Summary
- [List what you did]

## Test Results
### Test 1: Single Collection Export
[Output]

### Test 2: ...
[Output]

## Decisions Made
- copyAssets: [Implemented / Removed] because...

## Known Limitations
- [Any edge cases]

## Code Quality
- [Self-assessment]
```

---

## IMPORTANT NOTES

### What You Should NOT Do

- ❌ Don't modify frontend files (folder-browser.js, etc.)
- ❌ Don't change API contract without consultant approval
- ❌ Don't modify IPC handlers in main.js (unless critical bug)
- ❌ Don't add new dependencies without asking

### What You SHOULD Do

- ✅ Follow existing code patterns
- ✅ Test thoroughly in Electron console
- ✅ Document decisions in completion report
- ✅ Ask consultant if blocked or uncertain
- ✅ Commit your work with clear messages

---

## COORDINATION WITH AGENT B

**Agent B is working on:**
- Frontend components (folder-browser.js)
- Toast notifications
- File pickers

**No conflicts expected** because:
- You work on src/services/* (backend)
- Agent B works on src/components/* (frontend)
- Shared files (db.js, main.js) - coordinate via consultant

**If you need to modify shared files:**
1. Document why in commit message
2. Notify consultant
3. Keep changes minimal

---

## GETTING HELP

**If Blocked:**
1. Check API contract first
2. Review audit document
3. Ask consultant for guidance

**Consultant Available For:**
- Architectural questions
- API contract clarifications
- Integration issues
- Merge conflicts

---

## TIMELINE

**Estimated:** 8-10 hours

**Breakdown:**
- Read docs: 1 hour
- Implement getCollectionsInFolderRecursive: 0.5 hours
- Fix ZIP export logic: 1 hour
- Implement video/comment import: 2-3 hours
- Implement folder recreation: 1-2 hours
- Testing: 2-3 hours
- Bug fixes: 1-2 hours
- Documentation: 0.5 hours

**Start ASAP, target completion: Within 2 days**

---

Good luck! The backend is almost there - you're finishing what Gemini started. The export foundation is solid, you just need to complete the missing pieces.

**Remember:** Test everything thoroughly. Import/export is critical - data loss is unacceptable.

---

**Handoff Date:** October 6, 2025
**Start When:** Consultant approval received
