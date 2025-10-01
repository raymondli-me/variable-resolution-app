#!/usr/bin/env node
/**
 * Database Migration: Best-Worst Scaling (BWS) Tables
 *
 * Adds BWS experiment tables to support comparative preference elicitation.
 *
 * Tables Created:
 * 1. bws_experiments - Experiment metadata and configuration
 * 2. bws_tuples - Item sets (tuples) for comparison
 * 3. bws_judgments - Best/worst selections from raters
 * 4. bws_scores - Computed rankings and scores
 *
 * Design: See docs/HIERARCHICAL_RATING_COMPLETION_AND_BWS_ROADMAP.md
 *
 * Usage: node scripts/add-bws-tables.js
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

console.log(`[BWS Migration] Database path: ${dbPath}`);
console.log(`[BWS Migration] Starting BWS tables migration...\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[BWS Migration] ❌ Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('[BWS Migration] ✓ Connected to database');
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
    console.log('[BWS Migration] Checking current schema...');
    const tables = await all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'bws_%'");
    const tableNames = tables.map(t => t.name);

    if (tableNames.includes('bws_experiments') &&
        tableNames.includes('bws_tuples') &&
        tableNames.includes('bws_judgments') &&
        tableNames.includes('bws_scores')) {
      console.log('[BWS Migration] ✓ Migration already applied');
      console.log('[BWS Migration] Database already has BWS tables\n');
      db.close();
      return;
    }

    console.log('[BWS Migration] Schema needs update\n');

    // ========================================
    // Step 1: Create bws_experiments table
    // ========================================
    console.log('[BWS Migration] Step 1: Creating bws_experiments table...');

    await run(`
      CREATE TABLE IF NOT EXISTS bws_experiments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rating_project_id INTEGER,
        item_type TEXT CHECK(item_type IN ('video_chunk', 'comment', 'mixed')),
        tuple_size INTEGER DEFAULT 3 CHECK(tuple_size >= 2 AND tuple_size <= 5),
        tuple_count INTEGER,
        design_method TEXT CHECK(design_method IN ('random', 'balanced', 'maxdiff')) DEFAULT 'random',
        scoring_method TEXT CHECK(scoring_method IN ('counting', 'bradley_terry', 'conditional_logit')) DEFAULT 'counting',
        rater_type TEXT CHECK(rater_type IN ('human', 'ai', 'hybrid')) DEFAULT 'ai',
        research_intent TEXT,
        status TEXT CHECK(status IN ('draft', 'in_progress', 'paused', 'completed')) DEFAULT 'draft',
        total_cost REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (rating_project_id) REFERENCES rating_projects(id)
      )
    `);
    console.log('[BWS Migration]   ✓ Created bws_experiments table');

    // ========================================
    // Step 2: Create bws_tuples table
    // ========================================
    console.log('\n[BWS Migration] Step 2: Creating bws_tuples table...');

    await run(`
      CREATE TABLE IF NOT EXISTS bws_tuples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experiment_id INTEGER NOT NULL,
        tuple_index INTEGER NOT NULL,
        item_ids TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (experiment_id) REFERENCES bws_experiments(id) ON DELETE CASCADE
      )
    `);
    console.log('[BWS Migration]   ✓ Created bws_tuples table');
    console.log('[BWS Migration]   ℹ  item_ids stores JSON array: [1234, 5678, 9012]');

    // ========================================
    // Step 3: Create bws_judgments table
    // ========================================
    console.log('\n[BWS Migration] Step 3: Creating bws_judgments table...');

    await run(`
      CREATE TABLE IF NOT EXISTS bws_judgments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tuple_id INTEGER NOT NULL,
        rater_type TEXT CHECK(rater_type IN ('human', 'ai')) NOT NULL,
        rater_id TEXT NOT NULL,
        best_item_id INTEGER NOT NULL,
        worst_item_id INTEGER NOT NULL,
        reasoning TEXT,
        response_time_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tuple_id) REFERENCES bws_tuples(id) ON DELETE CASCADE,
        CHECK (best_item_id != worst_item_id)
      )
    `);
    console.log('[BWS Migration]   ✓ Created bws_judgments table');
    console.log('[BWS Migration]   ℹ  Validates: best_item_id != worst_item_id');

    // ========================================
    // Step 4: Create bws_scores table
    // ========================================
    console.log('\n[BWS Migration] Step 4: Creating bws_scores table...');

    await run(`
      CREATE TABLE IF NOT EXISTS bws_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experiment_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        item_type TEXT,
        score_counting REAL,
        score_bt REAL,
        score_cl REAL,
        confidence_interval_lower REAL,
        confidence_interval_upper REAL,
        num_appearances INTEGER DEFAULT 0,
        num_best INTEGER DEFAULT 0,
        num_worst INTEGER DEFAULT 0,
        rank INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (experiment_id) REFERENCES bws_experiments(id) ON DELETE CASCADE,
        UNIQUE(experiment_id, item_id)
      )
    `);
    console.log('[BWS Migration]   ✓ Created bws_scores table');
    console.log('[BWS Migration]   ℹ  Stores multiple scoring methods (counting, Bradley-Terry, conditional logit)');

    // ========================================
    // Step 5: Create performance indexes
    // ========================================
    console.log('\n[BWS Migration] Step 5: Creating performance indexes...');

    await run(`CREATE INDEX IF NOT EXISTS idx_bws_tuples_experiment ON bws_tuples(experiment_id)`);
    console.log('[BWS Migration]   ✓ Created index on bws_tuples(experiment_id)');

    await run(`CREATE INDEX IF NOT EXISTS idx_bws_judgments_tuple ON bws_judgments(tuple_id)`);
    console.log('[BWS Migration]   ✓ Created index on bws_judgments(tuple_id)');

    await run(`CREATE INDEX IF NOT EXISTS idx_bws_judgments_rater ON bws_judgments(rater_type, rater_id)`);
    console.log('[BWS Migration]   ✓ Created index on bws_judgments(rater_type, rater_id)');

    await run(`CREATE INDEX IF NOT EXISTS idx_bws_scores_experiment ON bws_scores(experiment_id)`);
    console.log('[BWS Migration]   ✓ Created index on bws_scores(experiment_id)');

    await run(`CREATE INDEX IF NOT EXISTS idx_bws_scores_rank ON bws_scores(experiment_id, rank)`);
    console.log('[BWS Migration]   ✓ Created index on bws_scores(experiment_id, rank)');

    // ========================================
    // Step 6: Verify schema
    // ========================================
    console.log('\n[BWS Migration] Step 6: Verifying schema...');

    const createdTables = await all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'bws_%' ORDER BY name");
    console.log('[BWS Migration]   BWS tables created:');
    createdTables.forEach(table => {
      console.log(`[BWS Migration]     ✓ ${table.name}`);
    });

    // Show column details for bws_experiments
    const experimentsInfo = await all('PRAGMA table_info(bws_experiments)');
    console.log('\n[BWS Migration]   bws_experiments columns:');
    experimentsInfo.forEach(col => {
      const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
      const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
      console.log(`[BWS Migration]     - ${col.name.padEnd(20)} ${col.type.padEnd(10)} ${nullable}${defaultVal}`);
    });

    console.log('\n[BWS Migration] ✅ Migration completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Best-Worst Scaling (BWS): ENABLED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nNew capabilities:');
    console.log('  ✓ Create BWS experiments from rating projects');
    console.log('  ✓ Generate comparison tuples (random/balanced/maxdiff)');
    console.log('  ✓ Collect best/worst judgments (human + AI)');
    console.log('  ✓ Compute item scores and rankings');
    console.log('  ✓ Track inter-rater agreement (human vs AI)');
    console.log('\nDatabase tables:');
    console.log('  • bws_experiments   - Experiment configuration');
    console.log('  • bws_tuples        - Item sets for comparison');
    console.log('  • bws_judgments     - Best/worst selections');
    console.log('  • bws_scores        - Computed rankings');
    console.log('\nNext steps:');
    console.log('  1. Restart the app to load updated schema');
    console.log('  2. Complete a rating project to filter items');
    console.log('  3. Navigate to AI Analysis → BWS tab');
    console.log('  4. Click "Create BWS Experiment"');
    console.log('  5. Select rating project and configure design');
    console.log('  6. Generate tuples and start rating');
    console.log('\nSee docs/HIERARCHICAL_RATING_COMPLETION_AND_BWS_ROADMAP.md for details.\n');

  } catch (error) {
    console.error('\n[BWS Migration] ❌ Migration failed:', error.message);
    console.error('[BWS Migration] Error details:', error);
    console.error('\nIf you see "table already exists", the migration was already applied.');
    console.error('Run: sqlite3 <db-path> ".tables" | grep bws to check.\n');
    process.exit(1);
  } finally {
    db.close(() => {
      console.log('[BWS Migration] Database connection closed');
    });
  }
}

// Run migration
migrate();
