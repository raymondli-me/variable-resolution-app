# Phase 0 Implementation Handoff: Collection Management Foundation

**From:** Consultant Agent (Claude)
**To:** Implementation Agent
**Date:** October 6, 2025
**Phase:** Phase 0 - Collection Management (Week 0)
**Status:** Ready for Implementation

---

## EXECUTIVE SUMMARY

This is the **most critical foundation phase** of the Collections First-Class Architecture. We are building the organizational and sharing infrastructure that makes collections manageable, shareable, and portable.

**Why Phase 0 First?**
- Collections are useless if you can't organize them
- Export/import enables collaboration and reproducibility
- Without organization, the database becomes a junkyard
- Delivers immediate value to Raymond's research workflow

**Break this into 4 sub-tasks:**
1. **Task 0.1:** Schema Migration (folders, imports, exports tables) ← **START HERE**
2. **Task 0.2:** Folder Management (CRUD operations + UI browser)
3. **Task 0.3:** Export System (JSON, ZIP, SQLite formats)
4. **Task 0.4:** Import System (ID remapping, conflict resolution)

This document provides detailed guidance for **all 4 sub-tasks**.

---

## TASK 0.1: SCHEMA MIGRATION & FOLDER BASICS

### Goal Statement

Create the database schema foundation for folder hierarchy, collection organization, and import/export tracking. Implement basic folder CRUD operations.

### Files to Create

```
scripts/
  └── migrate-collection-management.js    (Migration script)

src/database/
  └── folder-methods.js                   (Folder CRUD operations)
```

### Files to Modify

```
src/database/db.js                        (Add folder methods to main DB class)
main.js                                   (Add IPC handlers for folders)
preload.js                                (Expose folder API to renderer)
```

### Schema Changes

Execute this migration script to add 3 new tables and update collections table:

```sql
-- ============================================
-- FOLDERS TABLE (Hierarchical Organization)
-- ============================================
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  color TEXT DEFAULT '#6366f1',  -- Hex color for UI
  icon TEXT,                      -- Emoji or icon name (optional)
  archived BOOLEAN DEFAULT 0,

  -- Cached metadata (updated via triggers or manual refresh)
  collection_count INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,

  -- Prevent duplicate folder names in same parent
  UNIQUE(name, parent_folder_id)
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_archived ON folders(archived);

-- ============================================
-- COLLECTION IMPORTS TABLE (Provenance Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS collection_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Source information
  source_uuid TEXT,           -- Matches export_uuid from source export
  source_name TEXT,           -- Original collection name
  source_folder_path TEXT,    -- Original folder path (e.g., "/Research/CTE Study")

  -- Target (what we created locally)
  target_collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  target_folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,

  -- Import strategy used
  import_strategy TEXT CHECK(import_strategy IN ('new', 'merge', 'replace', 'skip')),

  -- ID remapping data (JSON object)
  id_remapping TEXT,          -- {"old_collection_id": new_id, "old_pdf_id": new_id, ...}

  -- Import results
  items_imported INTEGER DEFAULT 0,
  conflicts_resolved INTEGER DEFAULT 0,
  warnings TEXT,              -- JSON array of warning messages

  -- File path
  import_file_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_imports_target_collection ON collection_imports(target_collection_id);
CREATE INDEX IF NOT EXISTS idx_imports_source_uuid ON collection_imports(source_uuid);

-- ============================================
-- COLLECTION EXPORTS TABLE (Export Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS collection_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  exported_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Export details
  export_path TEXT,
  export_format TEXT CHECK(export_format IN ('json', 'zip', 'sqlite')),
  export_uuid TEXT,           -- UUID for tracking (used by imports)

  -- What was included
  included_dependencies BOOLEAN DEFAULT 1,  -- Parent collections, lineage
  included_assets BOOLEAN DEFAULT 1,        -- PDF files, video files

  -- Metadata
  file_size_mb REAL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_exports_collection ON collection_exports(collection_id);
CREATE INDEX IF NOT EXISTS idx_exports_uuid ON collection_exports(export_uuid);

-- ============================================
-- UPDATE COLLECTIONS TABLE
-- ============================================

-- Add folder organization columns
ALTER TABLE collections ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE collections ADD COLUMN archived BOOLEAN DEFAULT 0;
ALTER TABLE collections ADD COLUMN starred BOOLEAN DEFAULT 0;

-- Add UUID for export/import tracking
ALTER TABLE collections ADD COLUMN uuid TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_collections_folder ON collections(folder_id);
CREATE INDEX IF NOT EXISTS idx_collections_archived ON collections(archived);
CREATE INDEX IF NOT EXISTS idx_collections_starred ON collections(starred);

-- ============================================
-- BACKFILL UUIDS FOR EXISTING COLLECTIONS
-- ============================================

-- Generate UUIDs for all existing collections that don't have one
-- (Implementation will use crypto.randomUUID() in Node.js)
```

### Core Logic: Folder CRUD Operations

#### File: `src/database/folder-methods.js`

This module contains all folder-related database operations. Use this pattern:

```javascript
/**
 * Folder Management Methods
 * Handles hierarchical folder organization for collections
 */

class FolderManager {
  constructor(db) {
    this.db = db;  // Reference to main Database instance
  }

  /**
   * Create a new folder
   * @param {string} name - Folder name
   * @param {number|null} parentFolderId - Parent folder ID (null for root)
   * @param {Object} options - { description, color, icon }
   * @returns {Promise<number>} New folder ID
   */
  async createFolder(name, parentFolderId = null, options = {}) {
    // Validate: no circular references
    if (parentFolderId) {
      const wouldCreateCycle = await this.wouldCreateCircularReference(parentFolderId, null);
      if (wouldCreateCycle) {
        throw new Error('Cannot create folder: would create circular reference');
      }
    }

    // Insert folder
    const sql = `
      INSERT INTO folders (name, parent_folder_id, description, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await this.db.run(sql, [
      name,
      parentFolderId,
      options.description || null,
      options.color || '#6366f1',
      options.icon || null
    ]);

    // Update parent's collection_count if needed
    if (parentFolderId) {
      await this.updateFolderMetadata(parentFolderId);
    }

    return result.id;
  }

  /**
   * Get folder by ID
   */
  async getFolder(folderId) {
    const sql = 'SELECT * FROM folders WHERE id = ?';
    return await this.db.get(sql, [folderId]);
  }

  /**
   * Get all child folders of a parent (or root folders if parentId is null)
   */
  async getChildFolders(parentFolderId = null) {
    const sql = `
      SELECT * FROM folders
      WHERE parent_folder_id ${parentFolderId === null ? 'IS NULL' : '= ?'}
      AND archived = 0
      ORDER BY name ASC
    `;
    return await this.db.all(sql, parentFolderId === null ? [] : [parentFolderId]);
  }

  /**
   * Get collections in a folder
   */
  async getCollectionsInFolder(folderId = null) {
    const sql = `
      SELECT * FROM collections
      WHERE folder_id ${folderId === null ? 'IS NULL' : '= ?'}
      AND archived = 0
      ORDER BY created_at DESC
    `;
    return await this.db.all(sql, folderId === null ? [] : [folderId]);
  }

  /**
   * Get full folder contents (folders + collections)
   */
  async getFolderContents(folderId = null) {
    const folders = await this.getChildFolders(folderId);
    const collections = await this.getCollectionsInFolder(folderId);

    return {
      folders,
      collections
    };
  }

  /**
   * Move folder to new parent
   * @param {number} folderId - Folder to move
   * @param {number|null} newParentId - New parent (null for root)
   */
  async moveFolder(folderId, newParentId) {
    // Validate: cannot move folder into itself or its children
    if (newParentId) {
      const wouldCreateCycle = await this.wouldCreateCircularReference(newParentId, folderId);
      if (wouldCreateCycle) {
        throw new Error('Cannot move folder: would create circular reference');
      }
    }

    const sql = `
      UPDATE folders
      SET parent_folder_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.run(sql, [newParentId, folderId]);

    // Update metadata for old and new parents
    const oldFolder = await this.getFolder(folderId);
    if (oldFolder.parent_folder_id) {
      await this.updateFolderMetadata(oldFolder.parent_folder_id);
    }
    if (newParentId) {
      await this.updateFolderMetadata(newParentId);
    }
  }

  /**
   * Rename folder
   */
  async renameFolder(folderId, newName) {
    const sql = `
      UPDATE folders
      SET name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.run(sql, [newName, folderId]);
  }

  /**
   * Delete folder
   * @param {number} folderId
   * @param {boolean} cascade - If true, delete all children; if false, move children to parent
   */
  async deleteFolder(folderId, cascade = false) {
    const folder = await this.getFolder(folderId);

    if (cascade) {
      // CASCADE DELETE is handled by foreign key constraint
      // Just delete the folder, children will be auto-deleted
      await this.db.run('DELETE FROM folders WHERE id = ?', [folderId]);
    } else {
      // Move children to this folder's parent
      const children = await this.getChildFolders(folderId);
      for (const child of children) {
        await this.moveFolder(child.id, folder.parent_folder_id);
      }

      // Move collections to this folder's parent
      await this.db.run(
        'UPDATE collections SET folder_id = ? WHERE folder_id = ?',
        [folder.parent_folder_id, folderId]
      );

      // Now delete the empty folder
      await this.db.run('DELETE FROM folders WHERE id = ?', [folderId]);
    }

    // Update parent metadata
    if (folder.parent_folder_id) {
      await this.updateFolderMetadata(folder.parent_folder_id);
    }
  }

  /**
   * Get folder path (e.g., "/Research/CTE Study/2025")
   */
  async getFolderPath(folderId) {
    const sql = `
      WITH RECURSIVE folder_path AS (
        SELECT id, name, parent_folder_id, 0 as depth
        FROM folders WHERE id = ?
        UNION ALL
        SELECT f.id, f.name, f.parent_folder_id, fp.depth + 1
        FROM folders f
        JOIN folder_path fp ON f.id = fp.parent_folder_id
      )
      SELECT group_concat(name, '/') as path
      FROM (SELECT name FROM folder_path ORDER BY depth DESC)
    `;
    const result = await this.db.get(sql, [folderId]);
    return result ? '/' + result.path : '/';
  }

  /**
   * Get full folder lineage (from root to target)
   */
  async getFolderLineage(folderId) {
    const sql = `
      WITH RECURSIVE folder_lineage AS (
        SELECT * FROM folders WHERE id = ?
        UNION ALL
        SELECT f.* FROM folders f
        JOIN folder_lineage fl ON f.id = fl.parent_folder_id
      )
      SELECT * FROM folder_lineage ORDER BY id ASC
    `;
    return await this.db.all(sql, [folderId]);
  }

  /**
   * Check if moving folderId to newParentId would create a circular reference
   */
  async wouldCreateCircularReference(newParentId, folderId) {
    // If newParentId is null (root), no cycle possible
    if (!newParentId) return false;

    // If trying to move folder into itself
    if (newParentId === folderId) return true;

    // Check if newParentId is a descendant of folderId
    const lineage = await this.getFolderLineage(newParentId);
    return lineage.some(folder => folder.id === folderId);
  }

  /**
   * Update folder metadata (collection_count, total_items)
   */
  async updateFolderMetadata(folderId) {
    // Count direct collections
    const collectionCount = await this.db.get(
      'SELECT COUNT(*) as count FROM collections WHERE folder_id = ? AND archived = 0',
      [folderId]
    );

    // Count total items across all collections in this folder
    const totalItems = await this.db.get(
      'SELECT SUM(item_count) as total FROM collections WHERE folder_id = ? AND archived = 0',
      [folderId]
    );

    await this.db.run(
      'UPDATE folders SET collection_count = ?, total_items = ? WHERE id = ?',
      [collectionCount.count, totalItems.total || 0, folderId]
    );
  }

  /**
   * Archive/unarchive folder
   */
  async archiveFolder(folderId, archived = true) {
    await this.db.run(
      'UPDATE folders SET archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [archived ? 1 : 0, folderId]
    );
  }
}

module.exports = FolderManager;
```

### Integrating with Main Database Class

#### File: `src/database/db.js`

Add these methods to the main `Database` class:

```javascript
const FolderManager = require('./folder-methods');

class Database {
  constructor() {
    // ... existing constructor code ...
    this.folderManager = null;
  }

  async init() {
    // ... existing init code ...

    // Initialize folder manager
    this.folderManager = new FolderManager(this);
  }

  // Expose folder methods directly on Database instance
  async createFolder(name, parentFolderId, options) {
    return await this.folderManager.createFolder(name, parentFolderId, options);
  }

  async getFolder(folderId) {
    return await this.folderManager.getFolder(folderId);
  }

  async getFolderContents(folderId) {
    return await this.folderManager.getFolderContents(folderId);
  }

  async moveFolder(folderId, newParentId) {
    return await this.folderManager.moveFolder(folderId, newParentId);
  }

  async renameFolder(folderId, newName) {
    return await this.folderManager.renameFolder(folderId, newName);
  }

  async deleteFolder(folderId, cascade) {
    return await this.folderManager.deleteFolder(folderId, cascade);
  }

  async getFolderPath(folderId) {
    return await this.folderManager.getFolderPath(folderId);
  }

  async getFolderLineage(folderId) {
    return await this.folderManager.getFolderLineage(folderId);
  }

  async archiveFolder(folderId, archived) {
    return await this.folderManager.archiveFolder(folderId, archived);
  }

  // Collection organization methods
  async moveCollectionToFolder(collectionId, folderId) {
    await this.run(
      'UPDATE collections SET folder_id = ? WHERE id = ?',
      [folderId, collectionId]
    );

    // Update folder metadata
    if (folderId) {
      await this.folderManager.updateFolderMetadata(folderId);
    }
  }

  async archiveCollection(collectionId, archived = true) {
    await this.run(
      'UPDATE collections SET archived = ? WHERE id = ?',
      [archived ? 1 : 0, collectionId]
    );
  }

  async starCollection(collectionId, starred = true) {
    await this.run(
      'UPDATE collections SET starred = ? WHERE id = ?',
      [starred ? 1 : 0, collectionId]
    );
  }
}
```

### IPC Handlers (main.js)

Add these IPC handlers to enable renderer process to call folder operations:

```javascript
// Folder Management
ipcMain.handle('folders:create', async (event, name, parentFolderId, options) => {
  try {
    const folderId = await db.createFolder(name, parentFolderId, options);
    return { success: true, data: folderId };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:get', async (event, folderId) => {
  try {
    const folder = await db.getFolder(folderId);
    return { success: true, data: folder };
  } catch (error) {
    console.error('Error getting folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:getContents', async (event, folderId) => {
  try {
    const contents = await db.getFolderContents(folderId);
    return { success: true, data: contents };
  } catch (error) {
    console.error('Error getting folder contents:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:move', async (event, folderId, newParentId) => {
  try {
    await db.moveFolder(folderId, newParentId);
    return { success: true };
  } catch (error) {
    console.error('Error moving folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:rename', async (event, folderId, newName) => {
  try {
    await db.renameFolder(folderId, newName);
    return { success: true };
  } catch (error) {
    console.error('Error renaming folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:delete', async (event, folderId, cascade) => {
  try {
    await db.deleteFolder(folderId, cascade);
    return { success: true };
  } catch (error) {
    console.error('Error deleting folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:getPath', async (event, folderId) => {
  try {
    const path = await db.getFolderPath(folderId);
    return { success: true, data: path };
  } catch (error) {
    console.error('Error getting folder path:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:archive', async (event, folderId, archived) => {
  try {
    await db.archiveFolder(folderId, archived);
    return { success: true };
  } catch (error) {
    console.error('Error archiving folder:', error);
    return { success: false, error: error.message };
  }
});

// Collection organization
ipcMain.handle('collections:moveToFolder', async (event, collectionId, folderId) => {
  try {
    await db.moveCollectionToFolder(collectionId, folderId);
    return { success: true };
  } catch (error) {
    console.error('Error moving collection to folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('collections:archive', async (event, collectionId, archived) => {
  try {
    await db.archiveCollection(collectionId, archived);
    return { success: true };
  } catch (error) {
    console.error('Error archiving collection:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('collections:star', async (event, collectionId, starred) => {
  try {
    await db.starCollection(collectionId, starred);
    return { success: true };
  } catch (error) {
    console.error('Error starring collection:', error);
    return { success: false, error: error.message };
  }
});
```

### Preload API (preload.js)

Expose folder API to renderer process:

```javascript
contextBridge.exposeInMainWorld('api', {
  // ... existing API ...

  folders: {
    create: (name, parentFolderId, options) =>
      ipcRenderer.invoke('folders:create', name, parentFolderId, options),
    get: (folderId) =>
      ipcRenderer.invoke('folders:get', folderId),
    getContents: (folderId) =>
      ipcRenderer.invoke('folders:getContents', folderId),
    move: (folderId, newParentId) =>
      ipcRenderer.invoke('folders:move', folderId, newParentId),
    rename: (folderId, newName) =>
      ipcRenderer.invoke('folders:rename', folderId, newName),
    delete: (folderId, cascade) =>
      ipcRenderer.invoke('folders:delete', folderId, cascade),
    getPath: (folderId) =>
      ipcRenderer.invoke('folders:getPath', folderId),
    archive: (folderId, archived) =>
      ipcRenderer.invoke('folders:archive', folderId, archived)
  },

  collections: {
    // ... existing methods ...
    moveToFolder: (collectionId, folderId) =>
      ipcRenderer.invoke('collections:moveToFolder', collectionId, folderId),
    archive: (collectionId, archived) =>
      ipcRenderer.invoke('collections:archive', collectionId, archived),
    star: (collectionId, starred) =>
      ipcRenderer.invoke('collections:star', collectionId, starred)
  }
});
```

### Migration Script

#### File: `scripts/migrate-collection-management.js`

```javascript
#!/usr/bin/env node
/**
 * Database Migration: Collection Management Foundation
 *
 * Adds support for:
 * - Folder hierarchy for organizing collections
 * - Import/export tracking
 * - Collection archiving and starring
 *
 * Usage: node scripts/migrate-collection-management.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Determine database path
const appDataPath = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'vr-collector')
  : process.platform === 'win32'
  ? path.join(process.env.APPDATA, 'vr-collector')
  : path.join(os.homedir(), '.config', 'vr-collector');

const dbPath = path.join(appDataPath, 'collections.db');

console.log(`[Migration] Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[Migration] Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('[Migration] Connected to database');
});

// Promisified query functions
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function migrate() {
  try {
    console.log('[Migration] Starting collection management migration...\n');

    // Check if already migrated
    const tableInfo = await all('PRAGMA table_info(folders)');
    if (tableInfo.length > 0) {
      console.log('[Migration] ✓ Migration already applied');
      console.log('[Migration] Database already has folder support');
      db.close();
      return;
    }

    console.log('[Migration] Step 1: Creating folders table...');
    await run(`
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        color TEXT DEFAULT '#6366f1',
        icon TEXT,
        archived BOOLEAN DEFAULT 0,
        collection_count INTEGER DEFAULT 0,
        total_items INTEGER DEFAULT 0,
        UNIQUE(name, parent_folder_id)
      )
    `);
    console.log('[Migration]   ✓ Created folders table');

    await run('CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_folders_archived ON folders(archived)');
    console.log('[Migration]   ✓ Created folder indexes');

    console.log('\n[Migration] Step 2: Creating collection_imports table...');
    await run(`
      CREATE TABLE IF NOT EXISTS collection_imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        source_uuid TEXT,
        source_name TEXT,
        source_folder_path TEXT,
        target_collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
        target_folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        import_strategy TEXT CHECK(import_strategy IN ('new', 'merge', 'replace', 'skip')),
        id_remapping TEXT,
        items_imported INTEGER DEFAULT 0,
        conflicts_resolved INTEGER DEFAULT 0,
        warnings TEXT,
        import_file_path TEXT
      )
    `);
    console.log('[Migration]   ✓ Created collection_imports table');

    await run('CREATE INDEX IF NOT EXISTS idx_imports_target_collection ON collection_imports(target_collection_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_imports_source_uuid ON collection_imports(source_uuid)');
    console.log('[Migration]   ✓ Created import indexes');

    console.log('\n[Migration] Step 3: Creating collection_exports table...');
    await run(`
      CREATE TABLE IF NOT EXISTS collection_exports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
        exported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        export_path TEXT,
        export_format TEXT CHECK(export_format IN ('json', 'zip', 'sqlite')),
        export_uuid TEXT,
        included_dependencies BOOLEAN DEFAULT 1,
        included_assets BOOLEAN DEFAULT 1,
        file_size_mb REAL,
        notes TEXT
      )
    `);
    console.log('[Migration]   ✓ Created collection_exports table');

    await run('CREATE INDEX IF NOT EXISTS idx_exports_collection ON collection_exports(collection_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_exports_uuid ON collection_exports(export_uuid)');
    console.log('[Migration]   ✓ Created export indexes');

    console.log('\n[Migration] Step 4: Updating collections table...');

    // Check which columns already exist
    const collectionsInfo = await all('PRAGMA table_info(collections)');
    const hasFolder = collectionsInfo.some(col => col.name === 'folder_id');
    const hasArchived = collectionsInfo.some(col => col.name === 'archived');
    const hasStarred = collectionsInfo.some(col => col.name === 'starred');
    const hasUuid = collectionsInfo.some(col => col.name === 'uuid');

    if (!hasFolder) {
      await run('ALTER TABLE collections ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL');
      console.log('[Migration]   ✓ Added folder_id column');
    }

    if (!hasArchived) {
      await run('ALTER TABLE collections ADD COLUMN archived BOOLEAN DEFAULT 0');
      console.log('[Migration]   ✓ Added archived column');
    }

    if (!hasStarred) {
      await run('ALTER TABLE collections ADD COLUMN starred BOOLEAN DEFAULT 0');
      console.log('[Migration]   ✓ Added starred column');
    }

    if (!hasUuid) {
      await run('ALTER TABLE collections ADD COLUMN uuid TEXT UNIQUE');
      console.log('[Migration]   ✓ Added uuid column');
    }

    await run('CREATE INDEX IF NOT EXISTS idx_collections_folder ON collections(folder_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_collections_archived ON collections(archived)');
    await run('CREATE INDEX IF NOT EXISTS idx_collections_starred ON collections(starred)');
    console.log('[Migration]   ✓ Created collection indexes');

    console.log('\n[Migration] Step 5: Backfilling UUIDs for existing collections...');
    const collections = await all('SELECT id FROM collections WHERE uuid IS NULL');
    for (const collection of collections) {
      const uuid = crypto.randomUUID();
      await run('UPDATE collections SET uuid = ? WHERE id = ?', [uuid, collection.id]);
    }
    console.log(`[Migration]   ✓ Generated UUIDs for ${collections.length} collections`);

    console.log('\n[Migration] ✅ Migration completed successfully!');
    console.log('\n[Migration] New capabilities enabled:');
    console.log('[Migration]   • Organize collections in hierarchical folders');
    console.log('[Migration]   • Archive old collections');
    console.log('[Migration]   • Star favorite collections');
    console.log('[Migration]   • Track imports and exports');
    console.log('[Migration]   • Share collections with collaborators');

  } catch (error) {
    console.error('\n[Migration] ❌ Migration failed:', error.message);
    console.error('[Migration] Error details:', error);
    process.exit(1);
  } finally {
    db.close(() => {
      console.log('\n[Migration] Database connection closed');
    });
  }
}

// Run migration
migrate();
```

### Success Criteria for Task 0.1

- [ ] Migration script runs successfully
- [ ] All 3 new tables created (folders, collection_imports, collection_exports)
- [ ] Collections table has 4 new columns (folder_id, archived, starred, uuid)
- [ ] All indexes created
- [ ] Existing collections have UUIDs backfilled
- [ ] No SQL errors in migration
- [ ] `src/database/folder-methods.js` created with all CRUD operations
- [ ] Folder methods integrated into `src/database/db.js`
- [ ] IPC handlers added to `main.js`
- [ ] Preload API exposes folder methods
- [ ] Can manually test: Create folder, rename folder, move folder, delete folder
- [ ] Circular reference prevention works (test: try to move folder into its own child)
- [ ] Folder path resolution works (test: create /A/B/C, get path for C)

### Testing Task 0.1

After implementation, test manually using Electron's dev console:

```javascript
// Create root folder
const result1 = await window.api.folders.create('Research', null, {
  description: 'Research projects',
  color: '#6366f1'
});
console.log('Created folder:', result1);

// Create child folder
const result2 = await window.api.folders.create('CTE Study', result1.data, {});
console.log('Created child folder:', result2);

// Get folder contents
const contents = await window.api.folders.getContents(result1.data);
console.log('Folder contents:', contents);

// Get folder path
const path = await window.api.folders.getPath(result2.data);
console.log('Folder path:', path);  // Should show: /Research/CTE Study

// Try circular reference (should fail)
try {
  await window.api.folders.move(result1.data, result2.data);
  console.log('ERROR: Should have prevented circular reference!');
} catch (error) {
  console.log('✓ Correctly prevented circular reference');
}
```

---

## TASK 0.2: FOLDER BROWSER UI

### Goal Statement

Create a hierarchical folder browser UI that allows users to navigate folders, view collections, and perform folder operations (create, rename, move, delete).

### Files to Create

```
src/components/
  └── folder-browser.js               (Folder browser component)

src/styles/
  └── folder-browser.css              (Folder browser styles)
```

### Files to Modify

```
index-advanced.html                   (Add folder browser to collections view)
```

### UI Component Structure

The folder browser should display:
- Hierarchical tree of folders (expandable/collapsible)
- Collections within each folder
- Context menu for folders (right-click)
- Drag-and-drop to move collections between folders
- Special views: "All Collections", "Starred", "Archived"

**Reference the UI mockup from architecture doc:**
```
📁 Research                                   (12)
  📁 CTE Study                                (8)
    📁 2025                                   (5)
      📊 High CTE Symptoms                    300
      📊 Diagnostic Criteria                  80
    📁 Archived                               (3)
  📁 Eye Contact Analysis                     (4)
📁 Pilot Tests                                (6)
⭐ Starred Collections                        (3)
🗑️  Archived                                  (15)
```

### Success Criteria for Task 0.2

- [ ] Folder tree renders correctly
- [ ] Folders are expandable/collapsible
- [ ] Collections display under correct folders
- [ ] Can create new folder via UI button
- [ ] Can rename folder via context menu
- [ ] Can delete folder with confirmation dialog
- [ ] Can move folder via drag-and-drop
- [ ] Can move collection to folder via drag-and-drop
- [ ] Context menu appears on right-click
- [ ] Folder colors displayed correctly
- [ ] Collection counts update automatically
- [ ] "Starred" and "Archived" special views work

---

## TASK 0.3: EXPORT SYSTEM

### Goal Statement

Implement export functionality for collections in 3 formats: JSON (single collection), ZIP (folder bundle), and SQLite (full database backup).

### Files to Create

```
src/services/
  └── collection-exporter.js          (Export logic for all 3 formats)
```

### Files to Modify

```
src/database/db.js                    (Add export methods)
main.js                               (Add export IPC handlers)
preload.js                            (Expose export API)
```

### Export Format Specifications

**1. JSON Format (Single Collection)**

See detailed JSON schema in architecture doc. Must include:
- Collection metadata
- Full lineage chain
- All items with scores
- Dependencies (PDFs, videos)
- Statistics

**2. ZIP Format (Folder Bundle)**

```
folder_name.zip
├── manifest.json
├── collections/
│   ├── collection_1.json
│   └── collection_2.json
└── assets/
    └── pdfs/
```

**3. SQLite Format (Full Database)**

Simple file copy with timestamp: `vr-collector-backup-YYYY-MM-DD.db`

### Success Criteria for Task 0.3

- [ ] Can export single collection to JSON
- [ ] JSON export includes all required fields
- [ ] Can export folder to ZIP bundle
- [ ] ZIP includes manifest + collection JSONs
- [ ] Can optionally include PDF/video assets
- [ ] Can export full database backup
- [ ] Export tracked in `collection_exports` table
- [ ] Export UUID generated for tracking
- [ ] File size calculated and stored
- [ ] Export path saved for reference

---

## TASK 0.4: IMPORT SYSTEM

### Goal Statement

Implement import functionality with ID remapping, conflict detection, and resolution strategies.

### Files to Create

```
src/services/
  └── collection-importer.js          (Import logic with ID remapping)
```

### Files to Modify

```
src/database/db.js                    (Add import methods)
main.js                               (Add import IPC handlers)
preload.js                            (Expose import API)
```

### Import Workflow

1. **Parse import file** (JSON or ZIP)
2. **Validate format version**
3. **Detect conflicts** (existing UUIDs, PDFs, folders)
4. **Show conflict resolution UI** to user
5. **Remap IDs** (collections, PDFs, items)
6. **Import with chosen strategy** (new/merge/replace/skip)
7. **Track import** in `collection_imports` table

### Success Criteria for Task 0.4

- [ ] Can import JSON collection file
- [ ] Can import ZIP folder bundle
- [ ] ID remapping works (no collisions)
- [ ] Conflict detection identifies existing items
- [ ] User can choose resolution strategy
- [ ] Lineage preserved after import
- [ ] Dependencies resolved correctly
- [ ] Import tracked in database
- [ ] Warnings shown for missing dependencies
- [ ] Folder path recreated or merged

---

## IMPLEMENTATION ORDER

**Do these tasks in sequence:**

1. ✅ **Task 0.1** (Schema + Folder CRUD) ← START HERE
   - Run migration script
   - Implement folder methods
   - Test in console

2. ⏳ **Task 0.2** (Folder Browser UI)
   - Build UI component
   - Add to collections view
   - Test navigation and operations

3. ⏳ **Task 0.3** (Export System)
   - Implement JSON export
   - Implement ZIP export
   - Implement SQLite backup

4. ⏳ **Task 0.4** (Import System)
   - Implement JSON import
   - Implement conflict detection
   - Implement ID remapping

**Each task builds on the previous. Do not skip ahead.**

---

## IMPORTANT NOTES FOR IMPLEMENTATION AGENT

### Adherence to Team Workflow

Follow the principles in `TEAM_WORKFLOW_AND_PRINCIPLES.md`:

1. **Complete one task before starting the next**
2. **Report back after each task** with:
   - What was completed
   - What was tested
   - Any deviations from this plan
3. **Ask for clarification** if anything is unclear
4. **Do not add features** not specified in this handoff

### Code Quality Standards

- **Match existing code style** in the codebase
- **Use async/await** (not callbacks)
- **Handle errors gracefully** (try/catch blocks)
- **Add JSDoc comments** for all public methods
- **Console.log important operations** for debugging

### Testing Approach

- **Test each method individually** before integration
- **Use Electron dev tools console** for manual testing
- **Create a few test folders/collections** to verify behavior
- **Test edge cases** (circular refs, null parents, deleted items)

### When You're Stuck

If you encounter issues:

1. **Check existing code** for similar patterns
2. **Reference architecture doc** for design intent
3. **Ask Consultant Agent** for clarification
4. **Do not implement workarounds** that violate architecture

### What NOT to Do

❌ **Don't skip the migration script** - Database must be updated first
❌ **Don't hardcode values** - Use constants or config
❌ **Don't ignore errors** - All errors must be caught and handled
❌ **Don't modify unrelated code** - Stay focused on the task
❌ **Don't change the schema** without approval

---

## EXPECTED TIMELINE

- **Task 0.1:** 2-3 hours (schema + folder methods)
- **Task 0.2:** 3-4 hours (folder browser UI)
- **Task 0.3:** 3-4 hours (export system)
- **Task 0.4:** 4-5 hours (import system with ID remapping)

**Total: ~15 hours for Phase 0 complete**

---

## FINAL CHECKLIST

Before marking Phase 0 complete:

- [ ] All 4 tasks completed
- [ ] Migration script runs without errors
- [ ] Folder browser UI functional
- [ ] Can create/rename/move/delete folders
- [ ] Can export collection to JSON
- [ ] Can export folder to ZIP
- [ ] Can import collection from JSON
- [ ] ID remapping works
- [ ] No console errors
- [ ] Raymond can organize his collections in folders
- [ ] Raymond can export and share a collection
- [ ] Documentation updated (if needed)

---

**Ready to begin? Start with Task 0.1: Schema Migration & Folder Basics.**

**Report back when Task 0.1 is complete, then we'll proceed to Task 0.2.**

Good luck! 🚀
