# API Contract: Phase 0 - Collection Management

**Author:** Consultant Agent (Claude)
**Date:** October 6, 2025
**Status:** 🔒 LOCKED - Integration Contract
**Purpose:** Definitive API specification for frontend-backend integration

---

## PURPOSE

This document defines the **explicit API contract** between the frontend (Claude's Folder Browser UI) and backend (Gemini's Export/Import system). Both agents must implement exactly these signatures.

**Contract Rules:**
1. ✅ Frontend may call only methods documented here
2. ✅ Backend must implement exactly these signatures
3. ✅ Return values must match specified structure exactly
4. ✅ Any deviations require consultant approval and document update

---

## FOLDER OPERATIONS

### `window.api.folders.create(name, parentId, options)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Create a new folder in the hierarchy

**Parameters:**
```typescript
name: string          // Folder name (required)
parentId: number|null // Parent folder ID, null for root (required)
options: {
  description?: string // Optional folder description
  color?: string       // Optional color hex code (default: #6366f1)
  icon?: string        // Optional emoji icon (default: 📁)
}
```

**Returns:**
```typescript
{
  success: boolean
  data: number         // New folder ID
  error?: string       // Error message if success=false
}
```

**Example:**
```javascript
const result = await window.api.folders.create('Research', null, { color: '#10b981' });
// { success: true, data: 5 }
```

---

### `window.api.folders.getContents(folderId)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Get all subfolders and collections in a folder

**Parameters:**
```typescript
folderId: number|null  // Folder ID, null for root level
```

**Returns:**
```typescript
{
  success: boolean
  data: {
    folders: Array<{
      id: number
      name: string
      parent_folder_id: number|null
      description: string|null
      color: string
      icon: string
      archived: boolean
      created_at: string  // ISO 8601 datetime
      collection_count: number
      total_items: number
    }>
    collections: Array<{
      id: number
      name: string
      folder_id: number|null
      starred: boolean
      archived: boolean
      created_at: string
      item_count: number
      uuid: string
    }>
  }
  error?: string
}
```

**Example:**
```javascript
const result = await window.api.folders.getContents(5);
// { success: true, data: { folders: [...], collections: [...] } }
```

---

### `window.api.folders.get(folderId)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Get details of a single folder

**Parameters:**
```typescript
folderId: number  // Folder ID
```

**Returns:**
```typescript
{
  success: boolean
  data: {
    id: number
    name: string
    parent_folder_id: number|null
    description: string|null
    color: string
    icon: string
    archived: boolean
    created_at: string
    collection_count: number
    total_items: number
  }
  error?: string
}
```

---

### `window.api.folders.rename(folderId, newName)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Rename a folder

**Parameters:**
```typescript
folderId: number  // Folder ID
newName: string   // New folder name
```

**Returns:**
```typescript
{
  success: boolean
  error?: string
}
```

---

### `window.api.folders.delete(folderId, cascade)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Delete a folder

**Parameters:**
```typescript
folderId: number  // Folder ID
cascade: boolean  // If true, move children to parent; if false, fail if has children
```

**Returns:**
```typescript
{
  success: boolean
  error?: string  // e.g., "Cannot delete folder with children (use cascade)"
}
```

---

### `window.api.folders.move(folderId, newParentId)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Move a folder to a new parent

**Parameters:**
```typescript
folderId: number       // Folder to move
newParentId: number|null  // New parent ID, null for root
```

**Returns:**
```typescript
{
  success: boolean
  error?: string  // e.g., "Would create circular reference"
}
```

---

### `window.api.folders.archive(folderId, archived)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Archive or unarchive a folder

**Parameters:**
```typescript
folderId: number  // Folder ID
archived: boolean // true to archive, false to unarchive
```

**Returns:**
```typescript
{
  success: boolean
  error?: string
}
```

---

### `window.api.folders.getPath(folderId)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Get the full path of a folder (e.g., "/Research/CTE Study/2025")

**Parameters:**
```typescript
folderId: number  // Folder ID
```

**Returns:**
```typescript
{
  success: boolean
  data: string  // Path string like "/Research/CTE Study"
  error?: string
}
```

---

## COLLECTION OPERATIONS

### `window.api.collections.moveToFolder(collectionId, folderId)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Move a collection to a folder

**Parameters:**
```typescript
collectionId: number     // Collection ID
folderId: number|null    // Target folder ID, null for root
```

**Returns:**
```typescript
{
  success: boolean
  error?: string
}
```

---

### `window.api.collections.star(collectionId, starred)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Star or unstar a collection

**Parameters:**
```typescript
collectionId: number  // Collection ID
starred: boolean      // true to star, false to unstar
```

**Returns:**
```typescript
{
  success: boolean
  error?: string
}
```

---

### `window.api.collections.archive(collectionId, archived)`

**Status:** ✅ Implemented (Task 0.1)

**Purpose:** Archive or unarchive a collection

**Parameters:**
```typescript
collectionId: number  // Collection ID
archived: boolean     // true to archive, false to unarchive
```

**Returns:**
```typescript
{
  success: boolean
  error?: string
}
```

---

## EXPORT OPERATIONS

### `window.api.collections.exportToJSON(collectionId, outputPath)`

**Status:** 🔄 Implementing (Task 0.3 - Gemini)

**Purpose:** Export a single collection to JSON format

**Parameters:**
```typescript
collectionId: number  // Collection to export
outputPath: string    // Absolute file path (e.g., "/Users/name/Desktop/export.json")
```

**Returns:**
```typescript
{
  success: boolean
  data?: {
    exportId: number      // ID in collection_exports table
    filePath: string      // Path where file was written
    fileSize: number      // File size in bytes
    itemCount: number     // Number of items exported
  }
  error?: string
}
```

**Export JSON Structure:**
```typescript
{
  format_version: "1.0.0"
  exported_at: string  // ISO 8601 timestamp
  collection: {
    uuid: string
    name: string
    description: string|null
    created_at: string
    folder_path: string|null  // e.g., "/Research/CTE Study"
    starred: boolean
    archived: boolean
    parent_collection_id: string|null  // Parent UUID
    derivation_method: string|null
    derivation_params: object|null
  }
  items: Array<{
    item_id: number
    item_type: "video"|"pdf"|"url"|"text"
    added_at: string
    metadata: object  // Type-specific metadata
  }>
  stats: {
    total_items: number
    items_by_type: { [type: string]: number }
  }
}
```

**Example:**
```javascript
const result = await window.api.collections.exportToJSON(
  1,
  '/Users/raymondli701/Desktop/exports/my-collection.json'
);
// { success: true, data: { exportId: 1, filePath: "...", fileSize: 15234, itemCount: 50 } }
```

---

### `window.api.folders.exportToZIP(folderId, outputPath, options)`

**Status:** 🔄 Implementing (Task 0.3 - Gemini)

**Purpose:** Export a folder and all its collections to a ZIP bundle

**Parameters:**
```typescript
folderId: number     // Folder to export (null for all collections)
outputPath: string   // Absolute path for ZIP file
options: {
  includeSubfolders?: boolean  // Include nested folders (default: true)
  includeArchived?: boolean    // Include archived items (default: false)
}
```

**Returns:**
```typescript
{
  success: boolean
  data?: {
    exportId: number
    filePath: string
    fileSize: number
    folderCount: number
    collectionCount: number
    totalItems: number
  }
  error?: string
}
```

**ZIP Bundle Structure:**
```
export.zip
├── manifest.json        # Metadata about the export
├── collections/
│   ├── {uuid1}.json    # Each collection as separate JSON
│   ├── {uuid2}.json
│   └── ...
└── README.txt          # Human-readable export info
```

**Manifest Structure:**
```typescript
{
  format_version: "1.0.0"
  exported_at: string
  folder: {
    name: string
    path: string
    description: string|null
  }
  collections: Array<{
    uuid: string
    name: string
    filename: string  // e.g., "collections/{uuid}.json"
  }>
  stats: {
    folder_count: number
    collection_count: number
    total_items: number
  }
}
```

---

### `window.api.database.exportToSQLite(outputPath)`

**Status:** 🔄 Implementing (Task 0.3 - Gemini)

**Purpose:** Export entire database to standalone SQLite file

**Parameters:**
```typescript
outputPath: string  // Absolute path for .db file
```

**Returns:**
```typescript
{
  success: boolean
  data?: {
    exportId: number
    filePath: string
    fileSize: number
    tableCount: number
    totalRecords: number
  }
  error?: string
}
```

**Notes:**
- Creates a complete copy of the database
- Removes sensitive data (API keys, tokens)
- Includes all tables: collections, video_chunks, pdfs, folders, etc.

---

## IMPORT OPERATIONS

### `window.api.collections.importFromJSON(filePath, options)`

**Status:** 🔄 Implementing (Task 0.4 - Gemini)

**Purpose:** Import a collection from JSON file

**Parameters:**
```typescript
filePath: string  // Path to JSON file
options: {
  targetFolderId?: number|null  // Folder to import into (default: null)
  conflictResolution?: "skip"|"rename"|"replace"  // Default: "rename"
  preserveUUID?: boolean  // Keep original UUID if no conflict (default: true)
}
```

**Returns:**
```typescript
{
  success: boolean
  data?: {
    importId: number           // ID in collection_imports table
    collectionId: number       // New collection ID in database
    uuid: string               // Final UUID (original or remapped)
    itemsImported: number
    itemsSkipped: number
    conflicts: Array<{
      type: "uuid"|"name"
      original: string
      resolution: string
    }>
  }
  error?: string
}
```

**Example:**
```javascript
const result = await window.api.collections.importFromJSON(
  '/Users/raymondli701/Downloads/export.json',
  { targetFolderId: 5, conflictResolution: 'rename' }
);
// { success: true, data: { importId: 1, collectionId: 42, uuid: "...", itemsImported: 50, ... } }
```

---

### `window.api.folders.importFromZIP(filePath, options)`

**Status:** 🔄 Implementing (Task 0.4 - Gemini)

**Purpose:** Import a folder bundle from ZIP file

**Parameters:**
```typescript
filePath: string  // Path to ZIP file
options: {
  targetFolderId?: number|null  // Parent folder for import (default: root)
  conflictResolution?: "skip"|"rename"|"replace"
  recreateFolderStructure?: boolean  // Recreate original folder paths (default: true)
}
```

**Returns:**
```typescript
{
  success: boolean
  data?: {
    importId: number
    foldersCreated: number
    collectionsImported: number
    totalItems: number
    conflicts: Array<{
      type: "folder"|"collection"
      name: string
      resolution: string
    }>
    mapping: {
      folders: { [oldPath: string]: number }  // Map of folder paths to new IDs
      collections: { [oldUUID: string]: number }  // Map of UUIDs to new IDs
    }
  }
  error?: string
}
```

---

### `window.api.database.importFromSQLite(filePath, options)`

**Status:** 🔄 Implementing (Task 0.4 - Gemini)

**Purpose:** Import data from an exported SQLite database

**Parameters:**
```typescript
filePath: string  // Path to .db file
options: {
  tables?: string[]  // Specific tables to import (default: all)
  conflictResolution?: "skip"|"rename"|"replace"
  mergeMode?: boolean  // Merge with existing data vs replace (default: true)
}
```

**Returns:**
```typescript
{
  success: boolean
  data?: {
    importId: number
    tablesImported: string[]
    recordsImported: number
    recordsSkipped: number
    conflicts: Array<{
      table: string
      recordId: number
      resolution: string
    }>
  }
  error?: string
}
```

---

## ERROR HANDLING STANDARDS

### Error Response Format

**All API methods must return errors in this format:**

```typescript
{
  success: false
  error: string  // Human-readable error message
  code?: string  // Machine-readable error code (optional)
  details?: any  // Additional error context (optional)
}
```

### Standard Error Codes

```typescript
// File System Errors
"ENOENT"      // File or directory not found
"EACCES"      // Permission denied
"ENOSPC"      // No space left on device

// Database Errors
"DB_ERROR"           // Generic database error
"NOT_FOUND"          // Record not found
"CONSTRAINT_FAILED"  // Foreign key or constraint violation
"CIRCULAR_REF"       // Circular reference detected

// Validation Errors
"INVALID_PARAMS"     // Invalid parameters provided
"MISSING_REQUIRED"   // Required parameter missing
"INVALID_FORMAT"     // Invalid data format

// Import/Export Errors
"EXPORT_FAILED"      // Export operation failed
"IMPORT_FAILED"      // Import operation failed
"UUID_CONFLICT"      // UUID already exists
"FORMAT_INVALID"     // Invalid file format
"VERSION_MISMATCH"   // Incompatible format version
```

### Example Error Responses

```javascript
// File not found
{
  success: false,
  error: "Export file not found",
  code: "ENOENT",
  details: { path: "/Users/name/missing.json" }
}

// UUID conflict during import
{
  success: false,
  error: "Collection with UUID 'abc-123' already exists",
  code: "UUID_CONFLICT",
  details: {
    uuid: "abc-123",
    existingId: 42,
    suggestedResolution: "Use conflictResolution='rename' option"
  }
}

// Circular reference
{
  success: false,
  error: "Cannot move folder: would create circular reference",
  code: "CIRCULAR_REF",
  details: { folderId: 5, newParentId: 12 }
}
```

---

## TESTING CHECKLIST

### For Frontend Agent (Claude)

**Before integration:**
- [ ] Create stub implementations of all export/import methods
- [ ] Test UI with mock data for all operations
- [ ] Verify error handling displays correctly in UI
- [ ] Test drag-and-drop triggers correct API calls
- [ ] Test context menu actions call correct methods

**After integration:**
- [ ] Verify actual API calls match stubs exactly
- [ ] Test all success paths
- [ ] Test all error paths
- [ ] Verify loading states during async operations
- [ ] Check toast notifications display correctly

### For Backend Agent (Gemini)

**During implementation:**
- [ ] Implement exactly the signatures specified in this contract
- [ ] Return data structures match examples exactly
- [ ] All error cases return proper error format
- [ ] Unit test each method in isolation
- [ ] Test UUID collision handling

**Before handoff:**
- [ ] Test export of single collection to JSON
- [ ] Test export of folder to ZIP
- [ ] Test database export to SQLite
- [ ] Test import with no conflicts
- [ ] Test import with UUID conflicts
- [ ] Test import with folder path conflicts
- [ ] Verify lineage preserved after import
- [ ] Verify folder structure recreated correctly

---

## INTEGRATION TESTING SCENARIOS

### Scenario 1: Export Single Collection
```javascript
// 1. User right-clicks collection in UI
// 2. Selects "Export → JSON"
// 3. File picker dialog opens
// 4. User selects output path
// 5. Backend exports to JSON
// 6. Toast notification: "Collection exported successfully"
// 7. File appears at selected location
```

### Scenario 2: Export Folder Bundle
```javascript
// 1. User right-clicks folder in UI
// 2. Selects "Export → ZIP Bundle"
// 3. File picker dialog opens
// 4. User selects output path
// 5. Backend exports folder + collections to ZIP
// 6. Progress indicator shows export progress
// 7. Toast notification: "Folder exported successfully (5 collections)"
// 8. ZIP file appears at location
```

### Scenario 3: Import Collection with UUID Conflict
```javascript
// 1. User clicks "Import" button
// 2. File picker shows JSON files
// 3. User selects exported collection
// 4. Backend detects UUID already exists
// 5. Dialog shows: "Collection 'Research Data' already exists. Rename, Skip, or Replace?"
// 6. User selects "Rename"
// 7. Backend imports with new UUID
// 8. Toast notification: "Collection imported as 'Research Data (2)'"
// 9. New collection appears in tree
```

### Scenario 4: Import Folder Bundle
```javascript
// 1. User clicks "Import" button
// 2. File picker shows ZIP files
// 3. User selects folder bundle
// 4. Backend reads manifest
// 5. Progress dialog shows: "Importing 5 collections from 'Research' folder..."
// 6. Backend recreates folder structure
// 7. Backend imports each collection
// 8. Toast notification: "Imported 5 collections into '/Research'"
// 9. New folder appears in tree with all collections
```

---

## VERSION HISTORY

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | Oct 6, 2025 | Initial API contract | Consultant Agent |

---

## APPROVAL STATUS

- [x] **Consultant Agent** - Created and approved
- [ ] **Frontend Agent (Claude)** - Acknowledged
- [ ] **Backend Agent (Gemini)** - Acknowledged
- [ ] **Project Lead (Raymond)** - Reviewed

---

**This contract is now LOCKED for Phase 0 implementation.**

Any changes require:
1. Consultant approval
2. Document version increment
3. Notification to both implementation agents
4. Update to integration tests

---

**Next Steps:**
1. Share with Claude → Create UI stubs
2. Share with Gemini → Verify implementation matches
3. Begin integration testing when both ready
