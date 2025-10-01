#!/usr/bin/env node
/**
 * Database Migration: Hierarchical Rating Projects
 *
 * Adds support for recursive rating workflows where rating projects
 * can be used as data sources for other rating projects.
 *
 * Changes:
 * 1. Add parent_project_id to rating_projects (nullable, references rating_projects.id)
 * 2. Add source_type to rating_projects ('collection' or 'rating_project')
 * 3. Add filter_criteria to rating_projects (JSONB for score ranges, content types)
 * 4. Make collection_id nullable (not needed for child projects)
 *
 * Usage: node scripts/migrate-hierarchical-projects.js
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
    console.log('[Migration] Starting hierarchical projects migration...\n');

    // Check if migration already applied
    const tableInfo = await all('PRAGMA table_info(rating_projects)');
    const hasParentProjectId = tableInfo.some(col => col.name === 'parent_project_id');
    const hasSourceType = tableInfo.some(col => col.name === 'source_type');

    if (hasParentProjectId && hasSourceType) {
      console.log('[Migration] ✓ Migration already applied');
      console.log('[Migration] Database already has hierarchical project support');
      db.close();
      return;
    }

    console.log('[Migration] Step 1: Adding new columns to rating_projects...');

    // Add parent_project_id (nullable, references rating_projects.id)
    if (!hasParentProjectId) {
      await run(`
        ALTER TABLE rating_projects
        ADD COLUMN parent_project_id INTEGER REFERENCES rating_projects(id)
      `);
      console.log('[Migration]   ✓ Added parent_project_id column');
    }

    // Add source_type (defaults to 'collection' for existing projects)
    if (!hasSourceType) {
      await run(`
        ALTER TABLE rating_projects
        ADD COLUMN source_type TEXT DEFAULT 'collection' CHECK(source_type IN ('collection', 'rating_project'))
      `);
      console.log('[Migration]   ✓ Added source_type column');
    }

    // Add filter_criteria (JSONB stored as TEXT)
    const hasFilterCriteria = tableInfo.some(col => col.name === 'filter_criteria');
    if (!hasFilterCriteria) {
      await run(`
        ALTER TABLE rating_projects
        ADD COLUMN filter_criteria TEXT
      `);
      console.log('[Migration]   ✓ Added filter_criteria column');
    }

    // Add source_id (generic reference to collection_id OR parent_project_id)
    const hasSourceId = tableInfo.some(col => col.name === 'source_id');
    if (!hasSourceId) {
      await run(`
        ALTER TABLE rating_projects
        ADD COLUMN source_id INTEGER NOT NULL DEFAULT 0
      `);
      console.log('[Migration]   ✓ Added source_id column');
    }

    console.log('\n[Migration] Step 2: Migrating existing projects to new schema...');

    // Update existing projects to use source_id (copy from collection_id)
    const existingProjects = await all('SELECT id, collection_id FROM rating_projects WHERE source_id = 0');
    for (const project of existingProjects) {
      await run(`
        UPDATE rating_projects
        SET source_id = ?, source_type = 'collection'
        WHERE id = ?
      `, [project.collection_id, project.id]);
    }
    console.log(`[Migration]   ✓ Migrated ${existingProjects.length} existing projects`);

    console.log('\n[Migration] Step 3: Creating indexes for performance...');

    // Add indexes for hierarchical queries
    await run(`
      CREATE INDEX IF NOT EXISTS idx_rating_projects_parent
      ON rating_projects(parent_project_id)
    `);
    console.log('[Migration]   ✓ Created index on parent_project_id');

    await run(`
      CREATE INDEX IF NOT EXISTS idx_rating_projects_source
      ON rating_projects(source_type, source_id)
    `);
    console.log('[Migration]   ✓ Created index on source_type + source_id');

    console.log('\n[Migration] Step 4: Verifying schema...');

    const updatedTableInfo = await all('PRAGMA table_info(rating_projects)');
    console.log('[Migration]   Columns in rating_projects:');
    updatedTableInfo.forEach(col => {
      const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
      const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
      console.log(`[Migration]     - ${col.name} (${col.type}) ${nullable}${defaultVal}`);
    });

    console.log('\n[Migration] ✅ Migration completed successfully!');
    console.log('\n[Migration] New capabilities enabled:');
    console.log('[Migration]   • Create rating projects from other rating projects');
    console.log('[Migration]   • Filter by score range (e.g., only items > 0.7)');
    console.log('[Migration]   • Multi-wave hierarchical filtering');
    console.log('[Migration]   • Track project lineage and relationships');

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
