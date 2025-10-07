#!/usr/bin/env node
/**
 * Database Migration: Collection Lineage Support
 *
 * Adds lineage tracking columns to the collections table to support
 * derived collections (filtered, transformed, etc.)
 *
 * Columns Added:
 * 1. parent_collection_id - References the source collection
 * 2. derivation_info - JSON text describing the derivation operation
 *
 * Usage: node scripts/add-lineage-to-collections.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

console.log('[Lineage Migration] Adding lineage columns to collections table...');

// Determine database path (same as main app)
const appDataPath = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'vr-collector')
  : process.platform === 'win32'
  ? path.join(process.env.APPDATA, 'vr-collector')
  : path.join(os.homedir(), '.config', 'vr-collector');

const dbPath = path.join(appDataPath, 'collections.db');

console.log(`[Lineage Migration] Database path: ${dbPath}`);

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[Lineage Migration] ❌ Failed to connect to database:', err);
    process.exit(1);
  }

  console.log('[Lineage Migration] ✓ Connected to database');
});

// Run migrations
async function runMigration() {
  try {
    console.log('\n[Lineage Migration] Checking existing schema...');

    // Check if columns already exist
    const tableInfo = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(collections)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const columnNames = tableInfo.map(col => col.name);
    const hasParentColumn = columnNames.includes('parent_collection_id');
    const hasDerivationColumn = columnNames.includes('derivation_info');

    if (hasParentColumn && hasDerivationColumn) {
      console.log('[Lineage Migration] ✓ Migration already applied');
      console.log('[Lineage Migration] Collections table already has lineage columns\n');
      db.close();
      return;
    }

    console.log('[Lineage Migration] Schema needs update\n');

    // Add parent_collection_id column
    if (!hasParentColumn) {
      console.log('[Lineage Migration] Step 1: Adding parent_collection_id column...');
      await new Promise((resolve, reject) => {
        db.run(`
          ALTER TABLE collections
          ADD COLUMN parent_collection_id INTEGER
          REFERENCES collections(id)
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('[Lineage Migration]   ✓ Added column: parent_collection_id');
            resolve();
          }
        });
      });
    } else {
      console.log('[Lineage Migration] Step 1: Column parent_collection_id already exists, skipping...');
    }

    // Add derivation_info column
    if (!hasDerivationColumn) {
      console.log('\n[Lineage Migration] Step 2: Adding derivation_info column...');
      await new Promise((resolve, reject) => {
        db.run(`
          ALTER TABLE collections
          ADD COLUMN derivation_info TEXT
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('[Lineage Migration]   ✓ Added column: derivation_info');
            resolve();
          }
        });
      });
    } else {
      console.log('\n[Lineage Migration] Step 2: Column derivation_info already exists, skipping...');
    }

    // Verify schema
    console.log('\n[Lineage Migration] Step 3: Verifying schema...');
    const updatedTableInfo = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(collections)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const newColumns = updatedTableInfo.filter(col =>
      col.name === 'parent_collection_id' || col.name === 'derivation_info'
    );

    console.log('[Lineage Migration]   Lineage columns:');
    newColumns.forEach(col => {
      const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
      console.log(`[Lineage Migration]     ✓ ${col.name.padEnd(25)} ${col.type.padEnd(10)} ${nullable}`);
    });

    console.log('\n[Lineage Migration] ✅ Migration completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Collection Lineage: ENABLED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nNew capabilities:');
    console.log('  ✓ Track parent-child relationships between collections');
    console.log('  ✓ Store derivation metadata (filter criteria, transforms, etc.)');
    console.log('  ✓ Build analysis pipelines with traceable lineage');
    console.log('\nDatabase columns added to collections table:');
    console.log('  • parent_collection_id - References source collection');
    console.log('  • derivation_info      - JSON metadata about the derivation');
    console.log('\nNext steps:');
    console.log('  1. Restart the app to load updated schema');
    console.log('  2. Services can now create derived collections');
    console.log('  3. Use derivation_info to track filtering, rating, chunking operations\n');

  } catch (err) {
    console.error('\n[Lineage Migration] ❌ Migration failed:', err.message);
    console.error('[Lineage Migration] Error details:', err);
    process.exit(1);
  } finally {
    // Close database
    db.close((err) => {
      if (err) {
        console.error('[Lineage Migration] Error closing database:', err.message);
      } else {
        console.log('[Lineage Migration] Database connection closed');
      }
    });
  }
}

// Run the migration
runMigration();
