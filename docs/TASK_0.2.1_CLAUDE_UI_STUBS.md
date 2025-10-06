# Task 0.2.1: UI Stubbing for Export/Import (Frontend)

**To:** Claude Implementation Agent (Frontend Specialist)
**From:** Consultant Agent
**Date:** October 6, 2025
**Priority:** HIGH
**Estimated Time:** 1-2 hours
**Dependencies:** ✅ API_CONTRACT_PHASE_0.md

---

## OBJECTIVE

Create stub implementations of export/import API methods in the Folder Browser UI. This enables immediate testing of the complete UI flow while the Backend Agent completes the actual implementation.

---

## CONTEXT

The Backend Agent (Gemini) is currently finalizing the export/import system. Rather than waiting, we're implementing a **phased integration approach**:

1. **Phase 1 (NOW):** Frontend stubs with mock data → Test UI interactions
2. **Phase 2 (Later):** Backend completion → Replace stubs with real APIs
3. **Phase 3 (Final):** End-to-end integration testing

**This task is Phase 1.**

---

## WHAT YOU WILL DO

### 1. Read the API Contract

**CRITICAL:** Read `docs/API_CONTRACT_PHASE_0.md` completely before starting.

This document defines the exact signatures and return values you must implement.

### 2. Create Stub File

**File to Create:** `src/components/folder-browser-stubs.js`

This file will contain mock implementations of the export/import APIs.

### 3. Implement Export Stubs

**Methods to Stub:**

#### `window.api.collections.exportToJSON(collectionId, outputPath)`

**Stub Behavior:**
- Log to console: `"[STUB] Exporting collection ${collectionId} to ${outputPath}"`
- Wait 1 second (simulate async operation)
- Return success response with mock data
- Display toast: "Collection exported successfully"

**Example Implementation:**
```javascript
window.api.collections.exportToJSON = async (collectionId, outputPath) => {
  console.log(`[STUB] Exporting collection ${collectionId} to ${outputPath}`);

  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mock successful export
  return {
    success: true,
    data: {
      exportId: Math.floor(Math.random() * 1000),
      filePath: outputPath,
      fileSize: 15234,
      itemCount: 50
    }
  };
};
```

#### `window.api.folders.exportToZIP(folderId, outputPath, options)`

**Stub Behavior:**
- Log to console with all parameters
- Wait 2 seconds (simulate longer operation)
- Return success with mock stats
- Display toast: "Folder exported successfully (5 collections)"

#### `window.api.database.exportToSQLite(outputPath)`

**Stub Behavior:**
- Log to console
- Wait 3 seconds (simulate database copy)
- Return success with mock database stats
- Display toast: "Database exported successfully"

### 4. Implement Import Stubs

#### `window.api.collections.importFromJSON(filePath, options)`

**Stub Behavior:**
- Log parameters
- Wait 1.5 seconds
- **Randomly simulate conflicts** (30% chance):
  - Return with conflicts array
  - Log: "UUID conflict detected"
- Otherwise return success
- Display toast with import results

**Example with Conflict Simulation:**
```javascript
window.api.collections.importFromJSON = async (filePath, options) => {
  console.log(`[STUB] Importing collection from ${filePath}`, options);

  await new Promise(resolve => setTimeout(resolve, 1500));

  // 30% chance of UUID conflict
  const hasConflict = Math.random() < 0.3;

  if (hasConflict) {
    return {
      success: true,
      data: {
        importId: Math.floor(Math.random() * 1000),
        collectionId: 42,
        uuid: 'abc-123-new',
        itemsImported: 50,
        itemsSkipped: 0,
        conflicts: [{
          type: 'uuid',
          original: 'abc-123',
          resolution: 'Renamed to abc-123-new'
        }]
      }
    };
  }

  return {
    success: true,
    data: {
      importId: Math.floor(Math.random() * 1000),
      collectionId: 42,
      uuid: 'abc-123',
      itemsImported: 50,
      itemsSkipped: 0,
      conflicts: []
    }
  };
};
```

#### `window.api.folders.importFromZIP(filePath, options)`

**Stub Behavior:**
- Log parameters
- Wait 3 seconds (simulate extracting ZIP)
- Return success with folder/collection counts
- Display toast: "Imported 5 collections into '/Research'"

#### `window.api.database.importFromSQLite(filePath, options)`

**Stub Behavior:**
- Log parameters
- Wait 4 seconds (simulate database merge)
- Return success with import stats
- Display toast: "Database import complete (150 records)"

### 5. Integrate Stubs into Folder Browser

**Modify:** `src/components/folder-browser.js`

**Add at the top:**
```javascript
// Import stubs for testing (will be replaced with real APIs)
import './folder-browser-stubs.js';
```

**Or if not using modules, load in HTML:**
```html
<script src="src/components/folder-browser-stubs.js"></script>
```

### 6. Add Context Menu Export/Import Actions

**Modify:** `src/components/folder-browser.js` → `showContextMenu()`

**Add these menu items:**

**For Folders:**
```javascript
{
  label: 'Export Folder (ZIP)',
  action: () => this.exportFolderToZIP(itemId)
}
```

**For Collections:**
```javascript
{
  label: 'Export Collection (JSON)',
  action: () => this.exportCollectionToJSON(itemId)
}
```

**For Root Level:**
```javascript
{
  label: 'Import Collection...',
  action: () => this.importCollection()
},
{
  label: 'Import Folder Bundle...',
  action: () => this.importFolder()
}
```

### 7. Implement UI Handler Methods

**Add to FolderBrowser class:**

```javascript
async exportCollectionToJSON(collectionId) {
  // In production, this would open a file picker dialog
  // For now, use a fixed path
  const outputPath = `/Users/raymondli701/Desktop/exports/collection-${collectionId}.json`;

  try {
    const result = await window.api.collections.exportToJSON(collectionId, outputPath);

    if (result.success) {
      this.showSuccess(`Collection exported to ${result.data.filePath}`);
      console.log('Export result:', result.data);
    } else {
      this.showError(`Export failed: ${result.error}`);
    }
  } catch (error) {
    this.showError(`Export error: ${error.message}`);
  }
}

async exportFolderToZIP(folderId) {
  const outputPath = `/Users/raymondli701/Desktop/exports/folder-${folderId}.zip`;

  try {
    const result = await window.api.folders.exportToZIP(folderId, outputPath, {
      includeSubfolders: true,
      includeArchived: false
    });

    if (result.success) {
      this.showSuccess(
        `Folder exported: ${result.data.collectionCount} collections (${result.data.totalItems} items)`
      );
    } else {
      this.showError(`Export failed: ${result.error}`);
    }
  } catch (error) {
    this.showError(`Export error: ${error.message}`);
  }
}

async importCollection() {
  // In production, this would open a file picker
  // For now, use a mock path
  const filePath = '/Users/raymondli701/Desktop/exports/sample-export.json';

  try {
    const result = await window.api.collections.importFromJSON(filePath, {
      targetFolderId: null,
      conflictResolution: 'rename',
      preserveUUID: true
    });

    if (result.success) {
      const message = result.data.conflicts.length > 0
        ? `Imported with ${result.data.conflicts.length} conflicts resolved`
        : `Imported ${result.data.itemsImported} items successfully`;

      this.showSuccess(message);

      // Refresh tree to show new collection
      await this.loadFolderTree();
    } else {
      this.showError(`Import failed: ${result.error}`);
    }
  } catch (error) {
    this.showError(`Import error: ${error.message}`);
  }
}

async importFolder() {
  const filePath = '/Users/raymondli701/Desktop/exports/sample-folder.zip';

  try {
    const result = await window.api.folders.importFromZIP(filePath, {
      targetFolderId: null,
      conflictResolution: 'rename',
      recreateFolderStructure: true
    });

    if (result.success) {
      this.showSuccess(
        `Imported ${result.data.collectionsImported} collections in ${result.data.foldersCreated} folders`
      );

      // Refresh tree
      await this.loadFolderTree();
    } else {
      this.showError(`Import failed: ${result.error}`);
    }
  } catch (error) {
    this.showError(`Import error: ${error.message}`);
  }
}
```

---

## SUCCESS CRITERIA

### Stubbing Complete When:

- [ ] `folder-browser-stubs.js` created with all 6 stub methods
- [ ] Each stub logs to console with parameters
- [ ] Each stub simulates realistic delays (1-4 seconds)
- [ ] Each stub returns data matching API contract exactly
- [ ] Context menu has export/import options
- [ ] Handler methods call stubs correctly
- [ ] Toast notifications display for all operations
- [ ] No console errors

### Testing Checklist:

**Export Testing:**
```javascript
// 1. Right-click a collection
// 2. Select "Export Collection (JSON)"
// 3. Wait 1 second
// 4. See toast: "Collection exported successfully"
// 5. Check console for: "[STUB] Exporting collection X to /path/to/file.json"

// 6. Right-click a folder
// 7. Select "Export Folder (ZIP)"
// 8. Wait 2 seconds
// 9. See toast: "Folder exported successfully (5 collections)"
// 10. Check console logs
```

**Import Testing:**
```javascript
// 1. Click "Import Collection..." button (add to UI)
// 2. Wait 1.5 seconds
// 3. See toast with import result
// 4. 30% of time, should show conflict resolution
// 5. Tree should refresh (even though data unchanged in stub)

// 6. Click "Import Folder Bundle..." button
// 7. Wait 3 seconds
// 8. See toast: "Imported X collections in Y folders"
```

---

## NOTES

### Why Stubs Are Important

1. **Immediate Feedback:** Test UI interactions now, don't wait for backend
2. **Find UI Bugs Early:** Discover UX issues before integration
3. **Parallel Work:** Backend can implement APIs independently
4. **Easy Transition:** When backend ready, just remove stub file

### What NOT to Do

- ❌ Don't implement actual file I/O in stubs
- ❌ Don't modify database in stubs
- ❌ Don't create real export files
- ✅ Do log everything to console
- ✅ Do simulate realistic timing
- ✅ Do return exact API contract formats

### When Stubs Are Replaced

Once Gemini completes the backend:
1. Remove `folder-browser-stubs.js`
2. Remove import/script tag
3. Test with real APIs
4. Verify everything still works

**The handler methods in folder-browser.js won't need changes** because they're already calling the correct API methods!

---

## ESTIMATED TIME

**Total: 1-2 hours**

- Read API contract: 15 min
- Create stub file: 30 min
- Add context menu items: 15 min
- Add handler methods: 30 min
- Testing: 30 min

---

## COMPLETION REPORT

When done, create: `docs/TASK_0.2.1_COMPLETION_REPORT.md`

Include:
- All stub methods implemented
- Console logs showing stubbed calls
- Screenshots of context menu options
- Examples of toast notifications
- Confirmation that all success criteria met

---

**Start this task immediately. This enables full UI testing while waiting for backend completion.**
