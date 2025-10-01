#!/usr/bin/env node
/**
 * Database Migration: Hierarchical Rating Projects (Option A)
 *
 * Adds minimal schema changes to support recursive rating workflows.
 *
 * Changes:
 * 1. Add parent_project_id (nullable, references rating_projects.id)
 * 2. Add filter_criteria (TEXT, stores JSON filter config)
 * 3. Add index on parent_project_id for performance
 *
 * Design: See docs/HIERARCHICAL_RATING_SCHEMA_ANALYSIS.md
 *
 * Usage: node scripts/add-hierarchical-rating.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Determine database path (same as main app)
const appDataPath = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'vr-collector')
  : process.platform === 'win32'
  ? path.join(process.env.APPDATA, 'vr-collector')
  : path.join(os.homedir(), '.config', 'vr-collector');

const dbPath = path.join(appDataPath, 'collections.db');

console.log(`[Migration] Database path: ${dbPath}`);
console.log(`[Migration] Starting hierarchical rating migration (Option A)...\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[Migration] ❌ Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('[Migration] ✓ Connected to database');
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
    // Check if migration already applied
    console.log('[Migration] Checking current schema...');
    const tableInfo = await all('PRAGMA table_info(rating_projects)');
    const hasParentProjectId = tableInfo.some(col => col.name === 'parent_project_id');
    const hasFilterCriteria = tableInfo.some(col => col.name === 'filter_criteria');

    if (hasParentProjectId && hasFilterCriteria) {
      console.log('[Migration] ✓ Migration already applied');
      console.log('[Migration] Database already has hierarchical rating support\n');
      db.close();
      return;
    }

    console.log('[Migration] Schema needs update\n');
    console.log('[Migration] Step 1: Adding parent_project_id column...');

    // Add parent_project_id (nullable, self-referencing foreign key)
    if (!hasParentProjectId) {
      await run(`
        ALTER TABLE rating_projects
        ADD COLUMN parent_project_id INTEGER REFERENCES rating_projects(id)
      `);
      console.log('[Migration]   ✓ Added parent_project_id (nullable, references rating_projects.id)');
    } else {
      console.log('[Migration]   ⊙ parent_project_id already exists');
    }

    console.log('\n[Migration] Step 2: Adding filter_criteria column...');

    // Add filter_criteria (JSON stored as TEXT)
    if (!hasFilterCriteria) {
      await run(`
        ALTER TABLE rating_projects
        ADD COLUMN filter_criteria TEXT
      `);
      console.log('[Migration]   ✓ Added filter_criteria (TEXT, stores JSON)');
    } else {
      console.log('[Migration]   ⊙ filter_criteria already exists');
    }

    console.log('\n[Migration] Step 3: Creating performance indexes...');

    // Add index on parent_project_id for fast child lookups
    await run(`
      CREATE INDEX IF NOT EXISTS idx_rating_projects_parent
      ON rating_projects(parent_project_id)
    `);
    console.log('[Migration]   ✓ Created index on parent_project_id');

    // Also add composite index for common queries
    await run(`
      CREATE INDEX IF NOT EXISTS idx_rating_projects_collection_parent
      ON rating_projects(collection_id, parent_project_id)
    `);
    console.log('[Migration]   ✓ Created index on (collection_id, parent_project_id)');

    console.log('\n[Migration] Step 4: Verifying schema...');

    const updatedTableInfo = await all('PRAGMA table_info(rating_projects)');
    console.log('[Migration]   rating_projects columns:');
    updatedTableInfo.forEach(col => {
      const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
      const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
      const highlight = (col.name === 'parent_project_id' || col.name === 'filter_criteria') ? ' ← NEW' : '';
      console.log(`[Migration]     - ${col.name.padEnd(20)} ${col.type.padEnd(10)} ${nullable}${defaultVal}${highlight}`);
    });

    console.log('\n[Migration] Step 5: Checking indexes...');
    const indexes = await all("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='rating_projects'");
    console.log('[Migration]   Indexes on rating_projects:');
    indexes.forEach(idx => {
      if (idx.name.startsWith('idx_')) {
        console.log(`[Migration]     - ${idx.name}`);
      }
    });

    console.log('\n[Migration] ✅ Migration completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Hierarchical Rating Projects: ENABLED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nNew capabilities:');
    console.log('  ✓ Create rating projects from other rating projects');
    console.log('  ✓ Filter parent project results (score thresholds, content types)');
    console.log('  ✓ Multi-wave hierarchical filtering');
    console.log('  ✓ Track project lineage and relationships');
    console.log('\nNext steps:');
    console.log('  1. Restart the app to load updated schema');
    console.log('  2. Create a rating project from a collection (root project)');
    console.log('  3. Open that project and click "Create Child Project"');
    console.log('  4. Filter by score (e.g., only items > 0.7)');
    console.log('  5. Rate the filtered items with a new research intent');
    console.log('\nSee docs/HIERARCHICAL_RATING_SCHEMA_ANALYSIS.md for details.\n');

  } catch (error) {
    console.error('\n[Migration] ❌ Migration failed:', error.message);
    console.error('[Migration] Error details:', error);
    console.error('\nIf you see "duplicate column name", the migration was already applied.');
    console.error('Run: sqlite3 <db-path> "PRAGMA table_info(rating_projects);" to check.\n');
    process.exit(1);
  } finally {
    db.close(() => {
      console.log('[Migration] Database connection closed');
    });
  }
}

// Run migration
migrate();
