# Integration Test Plan: Phase 0 - Collection Management

**Consultant:** Claude
**Date:** October 6, 2025
**Status:** 📋 Ready for Execution
**Purpose:** End-to-end testing of folder management + export/import system

---

## OVERVIEW

This document defines the complete integration testing strategy for Phase 0. Testing begins **after both implementation agents complete their work**:

- ✅ Task 0.1: Schema & Folder API (Complete)
- ✅ Task 0.2: Folder Browser UI (Complete)
- ⏳ Task 0.3/0.4: Export/Import Backend (In Progress - Gemini)
- ⏳ Task 0.2.1: UI Stubs (Assigned - Claude)
- ⏳ Task 0.2.2: Toast Notifications (Assigned - Claude)

---

## TEST PHASES

### Phase 1: Pre-Integration (Current)

**Status:** ✅ Complete

**What Was Tested:**
- [x] Schema migration successful
- [x] Folder CRUD operations work independently
- [x] Folder Browser UI renders correctly
- [x] Context menus function
- [x] Drag-and-drop interactions work

**How Tested:**
- Manual console testing
- UI interaction testing
- Backend unit tests

---

### Phase 2: Stubbed Integration (In Progress)

**Status:** 🔄 Task 0.2.1 assigned to Claude

**What to Test:**
- [ ] UI calls export/import stub methods
- [ ] Context menu shows export/import options
- [ ] Toast notifications display for all operations
- [ ] Error handling works with stub failures
- [ ] Progress indicators work correctly

**How to Test:**
```javascript
// 1. Open Folder Browser
// 2. Right-click collection → Export → JSON
// 3. Verify toast appears: "Collection exported"
// 4. Check console for stub log
// 5. Repeat for all export/import operations
```

**Success Criteria:**
- All UI flows work with stubs
- No console errors
- Toast notifications display correctly
- User can interact with full feature set (mocked)

---

### Phase 3: Backend Integration (Next)

**Status:** ⏳ Waiting for Gemini completion

**What to Test:**
- [ ] Replace stubs with real backend APIs
- [ ] Export actually creates files on disk
- [ ] Import reads files and creates database records
- [ ] UUID remapping works correctly
- [ ] Folder structure preserved in export/import
- [ ] Lineage tracking maintained

**Prerequisites:**
1. Gemini completes Task 0.3 (Export)
2. Gemini completes Task 0.4 (Import)
3. Gemini provides completion report
4. Backend unit tests pass

---

### Phase 4: End-to-End Integration (Final)

**Status:** 📋 Ready for execution when Phase 3 complete

**What to Test:**
- Complete user workflows from UI to database
- Real file I/O operations
- Error handling in production scenarios
- Performance under load
- Edge cases and failure modes

---

## END-TO-END TEST SCENARIOS

### Scenario 1: Create and Export Folder Structure

**User Story:** As a researcher, I want to organize my collections into folders and export them for backup.

**Setup:**
```sql
-- Start with clean slate
DELETE FROM collections WHERE id > 0;
DELETE FROM folders WHERE id > 0;
```

**Steps:**

1. **Create Folder Hierarchy**
   ```javascript
   // Create root folder
   const research = await window.api.folders.create('Research', null, {
     description: 'Research projects',
     color: '#10b981'
   });

   // Create subfolder
   const cte = await window.api.folders.create('CTE Study', research.data, {
     description: '2025 CTE research',
     color: '#3b82f6'
   });
   ```

2. **Add Collections to Folders**
   ```javascript
   // Assuming collection ID 1 exists
   await window.api.collections.moveToFolder(1, cte.data);
   ```

3. **Export Folder to ZIP**
   ```javascript
   const result = await window.api.folders.exportToZIP(
     research.data,
     '/Users/raymondli701/Desktop/exports/research-backup.zip',
     { includeSubfolders: true, includeArchived: false }
   );
   ```

**Verify:**
- [ ] ZIP file created at specified path
- [ ] ZIP contains `manifest.json`
- [ ] ZIP contains `collections/` directory
- [ ] Each collection has its own JSON file
- [ ] Manifest lists all collections correctly
- [ ] Folder hierarchy preserved in manifest
- [ ] Export tracked in `collection_exports` table

**Expected Result:**
```
research-backup.zip
├── manifest.json
│   {
│     "format_version": "1.0.0",
│     "exported_at": "2025-10-06T...",
│     "folder": {
│       "name": "Research",
│       "path": "/Research",
│       "description": "Research projects"
│     },
│     "collections": [
│       {
│         "uuid": "abc-123",
│         "name": "Collection 1",
│         "filename": "collections/abc-123.json"
│       }
│     ],
│     "stats": {
│       "folder_count": 2,
│       "collection_count": 1,
│       "total_items": 50
│     }
│   }
├── collections/
│   └── abc-123.json
└── README.txt
```

---

### Scenario 2: Import and Merge Collections

**User Story:** As a researcher, I want to import a collection from a collaborator and merge it into my existing folder structure.

**Setup:**
```javascript
// Ensure export from Scenario 1 exists
// Ensure Research folder exists in database
```

**Steps:**

1. **Import ZIP Bundle**
   ```javascript
   const result = await window.api.folders.importFromZIP(
     '/Users/raymondli701/Desktop/exports/research-backup.zip',
     {
       targetFolderId: null,  // Import to root
       conflictResolution: 'rename',
       recreateFolderStructure: true
     }
   );
   ```

2. **Verify Import Result**
   ```javascript
   console.log(result);
   // Should show:
   // {
   //   success: true,
   //   data: {
   //     importId: 1,
   //     foldersCreated: 2,
   //     collectionsImported: 1,
   //     totalItems: 50,
   //     conflicts: [],
   //     mapping: { ... }
   //   }
   // }
   ```

3. **Check UI**
   - Open Folder Browser
   - Verify "Research" folder appears (possibly as "Research (2)" due to rename)
   - Expand folder
   - Verify "CTE Study" subfolder exists
   - Verify collection appears under correct folder

**Verify:**
- [ ] Folder structure recreated correctly
- [ ] Collections appear in correct folders
- [ ] UUIDs preserved if no conflicts
- [ ] UUIDs remapped if conflicts detected
- [ ] Lineage preserved (parent_collection_id updated)
- [ ] Import tracked in `collection_imports` table
- [ ] Items in collection reference correct IDs

---

### Scenario 3: UUID Conflict Resolution

**User Story:** As a researcher, I want to import a collection that I already have, and the system should handle the conflict gracefully.

**Setup:**
```javascript
// Export collection ID 1
const export1 = await window.api.collections.exportToJSON(
  1,
  '/Users/raymondli701/Desktop/exports/collection-1.json'
);

// Keep collection 1 in database
// Try to import the same collection
```

**Steps:**

1. **Import with UUID Conflict**
   ```javascript
   const result = await window.api.collections.importFromJSON(
     '/Users/raymondli701/Desktop/exports/collection-1.json',
     {
       targetFolderId: null,
       conflictResolution: 'rename',  // Try different resolutions
       preserveUUID: true
     }
   );
   ```

2. **Test Each Conflict Resolution:**

   **Option A: Rename**
   ```javascript
   conflictResolution: 'rename'
   // Expected: New UUID generated, collection imported as "Collection 1 (2)"
   ```

   **Option B: Skip**
   ```javascript
   conflictResolution: 'skip'
   // Expected: Import succeeds but no new collection created
   // result.data.itemsSkipped = N
   ```

   **Option C: Replace**
   ```javascript
   conflictResolution: 'replace'
   // Expected: Existing collection updated with imported data
   // Original UUID kept, items replaced
   ```

**Verify:**
- [ ] "rename" generates new UUID
- [ ] "skip" doesn't create duplicate
- [ ] "replace" updates existing collection
- [ ] Conflict logged in result.data.conflicts array
- [ ] No database constraint errors
- [ ] UI shows correct collection count

---

### Scenario 4: Lineage Preservation

**User Story:** As a researcher, I want to export a collection and its parent, then import them on another machine and maintain the parent-child relationship.

**Setup:**
```sql
-- Create parent collection
INSERT INTO collections (name, uuid) VALUES ('Parent Collection', 'parent-uuid-123');

-- Create derived collection
INSERT INTO collections (name, uuid, parent_collection_id, derivation_method)
VALUES ('Filtered Collection', 'child-uuid-456', 1, 'filter');
```

**Steps:**

1. **Export Both Collections**
   ```javascript
   await window.api.collections.exportToJSON(
     1,  // Parent
     '/Users/raymondli701/Desktop/exports/parent.json'
   );

   await window.api.collections.exportToJSON(
     2,  // Child
     '/Users/raymondli701/Desktop/exports/child.json'
   );
   ```

2. **Delete Both from Database**
   ```sql
   DELETE FROM collections WHERE id IN (1, 2);
   ```

3. **Import Parent First**
   ```javascript
   const parentResult = await window.api.collections.importFromJSON(
     '/Users/raymondli701/Desktop/exports/parent.json',
     { preserveUUID: true }
   );
   ```

4. **Import Child Second**
   ```javascript
   const childResult = await window.api.collections.importFromJSON(
     '/Users/raymondli701/Desktop/exports/child.json',
     { preserveUUID: true }
   );
   ```

5. **Verify Lineage**
   ```sql
   SELECT id, name, uuid, parent_collection_id, derivation_method
   FROM collections;

   -- Child should reference parent's NEW id
   -- But UUIDs should be preserved
   ```

**Verify:**
- [ ] Parent imported with preserved UUID
- [ ] Child imported with preserved UUID
- [ ] Child's `parent_collection_id` updated to parent's new ID
- [ ] `derivation_method` preserved
- [ ] Can query lineage recursively
- [ ] No broken references

---

### Scenario 5: Folder Path Resolution

**User Story:** As a researcher, I want to export collections from nested folders, import them on another machine, and have the folder structure automatically recreated.

**Setup:**
```javascript
// Create: /Research/CTE Study/2025/Q1
const research = await window.api.folders.create('Research', null, {});
const cte = await window.api.folders.create('CTE Study', research.data, {});
const y2025 = await window.api.folders.create('2025', cte.data, {});
const q1 = await window.api.folders.create('Q1', y2025.data, {});

// Add collection to deepest folder
await window.api.collections.moveToFolder(1, q1.data);
```

**Steps:**

1. **Export Folder Bundle**
   ```javascript
   const result = await window.api.folders.exportToZIP(
     research.data,  // Root of hierarchy
     '/Users/raymondli701/Desktop/exports/deep-structure.zip',
     { includeSubfolders: true }
   );
   ```

2. **Delete All Folders**
   ```sql
   DELETE FROM folders WHERE id > 0;
   DELETE FROM collections WHERE id > 0;
   ```

3. **Import ZIP**
   ```javascript
   const result = await window.api.folders.importFromZIP(
     '/Users/raymondli701/Desktop/exports/deep-structure.zip',
     {
       targetFolderId: null,  // Import to root
       recreateFolderStructure: true
     }
   );
   ```

4. **Verify Folder Structure**
   ```javascript
   // Should see full hierarchy recreated:
   // Research → CTE Study → 2025 → Q1

   const path = await window.api.folders.getPath(q1.data);
   console.log(path);
   // Expected: "/Research/CTE Study/2025/Q1"
   ```

**Verify:**
- [ ] All 4 folders recreated
- [ ] Parent-child relationships preserved
- [ ] Collection appears in correct (deepest) folder
- [ ] Folder metadata preserved (colors, descriptions)
- [ ] getPath() returns correct full path
- [ ] No orphaned folders

---

### Scenario 6: Error Handling

**User Story:** As a researcher, I want helpful error messages when import/export operations fail.

**Test Cases:**

#### 6a: Export to Invalid Path
```javascript
const result = await window.api.collections.exportToJSON(
  1,
  '/nonexistent/directory/export.json'
);

// Expected:
// {
//   success: false,
//   error: "Export directory does not exist",
//   code: "ENOENT",
//   details: { path: "/nonexistent/directory" }
// }
```

#### 6b: Import Invalid JSON
```javascript
// Create malformed JSON file
const result = await window.api.collections.importFromJSON(
  '/path/to/invalid.json',
  {}
);

// Expected:
// {
//   success: false,
//   error: "Invalid JSON format",
//   code: "FORMAT_INVALID"
// }
```

#### 6c: Import Incompatible Version
```javascript
// Create JSON with future format version
// "format_version": "99.0.0"

const result = await window.api.collections.importFromJSON(
  '/path/to/future-version.json',
  {}
);

// Expected:
// {
//   success: false,
//   error: "Incompatible format version: 99.0.0 (supported: 1.0.0)",
//   code: "VERSION_MISMATCH"
// }
```

#### 6d: Missing Items During Import
```javascript
// Create JSON referencing video_chunk IDs that don't exist
const result = await window.api.collections.importFromJSON(
  '/path/to/export-with-missing-items.json',
  {}
);

// Expected:
// {
//   success: true,
//   data: {
//     itemsImported: 45,
//     itemsSkipped: 5,  // Missing items skipped
//     warnings: [
//       "5 items not found in database and were skipped"
//     ]
//   }
// }
```

**Verify:**
- [ ] All errors return proper format (success: false, error: string)
- [ ] Error messages are helpful and actionable
- [ ] Error codes match standards in API contract
- [ ] Details object provides context
- [ ] Toast notifications show errors in UI
- [ ] Console logs full error details

---

## PERFORMANCE TESTING

### Test 1: Large Collection Export

**Setup:**
```sql
-- Create collection with 1000 items
INSERT INTO collections (name) VALUES ('Large Collection');
-- Add 1000 video_chunks to this collection
```

**Test:**
```javascript
console.time('export-large');
const result = await window.api.collections.exportToJSON(
  largeCollectionId,
  '/path/to/large-export.json'
);
console.timeEnd('export-large');
```

**Success Criteria:**
- [ ] Export completes in < 5 seconds
- [ ] No memory leaks
- [ ] File size reasonable (< 5MB)
- [ ] No UI blocking during export

---

### Test 2: Many Folders Import

**Setup:**
```javascript
// Create ZIP with 50 folders, 200 collections
```

**Test:**
```javascript
console.time('import-many');
const result = await window.api.folders.importFromZIP(
  '/path/to/large-bundle.zip',
  { recreateFolderStructure: true }
);
console.timeEnd('import-many');
```

**Success Criteria:**
- [ ] Import completes in < 30 seconds
- [ ] No database locks
- [ ] Progress indication in UI
- [ ] Can cancel import mid-process

---

## REGRESSION TESTING

**Ensure Phase 0 doesn't break existing features:**

- [ ] Video chunk collection still works
- [ ] PDF collection still works
- [ ] BWS experiments still function
- [ ] Existing collections display correctly
- [ ] Rating functionality unchanged
- [ ] Search and filters work

---

## DEVICE TESTING

**Test on multiple platforms:**

- [ ] macOS (primary development platform)
- [ ] Windows (if applicable)
- [ ] Linux (if applicable)

**Test file path handling:**
- [ ] Windows paths: `C:\Users\name\Desktop\export.json`
- [ ] macOS/Linux paths: `/Users/name/Desktop/export.json`
- [ ] Paths with spaces: `/Users/name/My Documents/export.json`
- [ ] Paths with special characters

---

## SIGN-OFF CHECKLIST

### For Consultant Agent (Me)

Before declaring Phase 0 complete:

- [ ] All scenarios pass
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Error handling comprehensive
- [ ] Documentation updated
- [ ] Git commits clean
- [ ] Both agents' work integrated smoothly

### For Project Lead (Raymond)

Before moving to Phase 1:

- [ ] Can create folder hierarchy
- [ ] Can organize collections into folders
- [ ] Can export collections to JSON
- [ ] Can export folders to ZIP
- [ ] Can import and merge data
- [ ] Features feel polished and professional
- [ ] Ready to use for real research

---

## NEXT STEPS AFTER SIGN-OFF

1. **Create Phase 0 Completion Report**
   - Document: `docs/PHASE_0_COMPLETION_REPORT.md`
   - Summary of all features delivered
   - Known limitations
   - Recommendations for Phase 1

2. **Update Architecture Document**
   - Mark Phase 0 as complete
   - Document any deviations from plan
   - Update timeline for Phase 1

3. **Begin Phase 1 Planning**
   - Review Phase 1 requirements
   - Create handoff documents
   - Assign tasks to implementation agents

---

## CONTACT FOR ISSUES

**During Testing:**
- Consultant Agent coordinates all testing
- Implementation agents fix bugs in their respective domains
- Project Lead validates user experience

**Bug Priority:**
- P0 (Blocker): Cannot complete scenario, data loss risk
- P1 (Critical): Feature broken, workaround exists
- P2 (Major): Feature impaired, minor impact
- P3 (Minor): Cosmetic, edge case

---

**Test execution begins when Gemini completes Tasks 0.3 & 0.4.**
