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
      // Note: Cannot add UNIQUE constraint to existing table with ALTER TABLE in SQLite
      // We'll add the column without UNIQUE and rely on app logic
      await run('ALTER TABLE collections ADD COLUMN uuid TEXT');
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
