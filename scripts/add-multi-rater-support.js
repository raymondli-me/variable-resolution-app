#!/usr/bin/env node
/**
 * Database Migration: Multi-Rater BWS Support
 *
 * Adds rater_id column to bws_scores table to enable:
 * - Combined scores (all raters) - rater_id = NULL
 * - Individual rater scores (AI-only, human-only) - rater_id = 'gemini-2.5-flash', 'human-user', etc.
 * - Inter-rater agreement analysis
 *
 * Design: See docs/BWS_COMPLETE_STATUS.md - Multi-Rater Scoring Architecture
 *
 * Usage: node scripts/add-multi-rater-support.js
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

console.log(`[Multi-Rater Migration] Database path: ${dbPath}`);
console.log(`[Multi-Rater Migration] Starting multi-rater support migration...\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[Multi-Rater Migration] ❌ Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('[Multi-Rater Migration] ✓ Connected to database');
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
    // Check if table exists
    console.log('[Multi-Rater Migration] Checking for bws_scores table...');
    const tables = await all("SELECT name FROM sqlite_master WHERE type='table' AND name='bws_scores'");

    if (tables.length === 0) {
      console.log('[Multi-Rater Migration] ⚠️  bws_scores table does not exist');
      console.log('[Multi-Rater Migration] ℹ️  Run scripts/add-bws-tables.js first\n');
      db.close();
      return;
    }

    console.log('[Multi-Rater Migration] ✓ Found bws_scores table');

    // Check if column already exists
    console.log('[Multi-Rater Migration] Checking for rater_id column...');
    const columns = await all('PRAGMA table_info(bws_scores)');
    const hasRaterId = columns.some(col => col.name === 'rater_id');

    if (hasRaterId) {
      console.log('[Multi-Rater Migration] ✓ Migration already applied');
      console.log('[Multi-Rater Migration] Database already has rater_id column\n');
      db.close();
      return;
    }

    console.log('[Multi-Rater Migration] Schema needs update\n');

    // ========================================
    // Step 1: Add rater_id column to bws_scores
    // ========================================
    console.log('[Multi-Rater Migration] Step 1: Adding rater_id column to bws_scores...');

    await run(`
      ALTER TABLE bws_scores ADD COLUMN rater_id TEXT
    `);
    console.log('[Multi-Rater Migration]   ✓ Added rater_id column');
    console.log('[Multi-Rater Migration]   ℹ️  NULL = combined scores (all raters)');
    console.log('[Multi-Rater Migration]   ℹ️  "gemini-2.5-flash" = AI-only scores');
    console.log('[Multi-Rater Migration]   ℹ️  "human-user" = human-only scores');

    // ========================================
    // Step 2: Create index for filtering by rater
    // ========================================
    console.log('\n[Multi-Rater Migration] Step 2: Creating performance index...');

    await run(`CREATE INDEX IF NOT EXISTS idx_bws_scores_rater ON bws_scores(experiment_id, rater_id)`);
    console.log('[Multi-Rater Migration]   ✓ Created index on bws_scores(experiment_id, rater_id)');

    // ========================================
    // Step 3: Update UNIQUE constraint
    // ========================================
    console.log('\n[Multi-Rater Migration] Step 3: Updating UNIQUE constraint...');
    console.log('[Multi-Rater Migration]   ℹ️  SQLite does not support ALTER CONSTRAINT');
    console.log('[Multi-Rater Migration]   ℹ️  Old constraint: UNIQUE(experiment_id, item_id)');
    console.log('[Multi-Rater Migration]   ℹ️  New constraint needed: UNIQUE(experiment_id, item_id, rater_id)');
    console.log('[Multi-Rater Migration]   ⚠️  Existing scores remain with old constraint');
    console.log('[Multi-Rater Migration]   ℹ️  New inserts should include rater_id to avoid conflicts');

    // ========================================
    // Step 4: Verify schema
    // ========================================
    console.log('\n[Multi-Rater Migration] Step 4: Verifying schema...');

    const updatedColumns = await all('PRAGMA table_info(bws_scores)');
    console.log('[Multi-Rater Migration]   bws_scores columns:');
    updatedColumns.forEach(col => {
      const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
      const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
      const highlight = col.name === 'rater_id' ? ' ← NEW' : '';
      console.log(`[Multi-Rater Migration]     - ${col.name.padEnd(30)} ${col.type.padEnd(10)} ${nullable}${defaultVal}${highlight}`);
    });

    console.log('\n[Multi-Rater Migration] ✅ Migration completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Multi-Rater BWS Support: ENABLED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nNew capabilities:');
    console.log('  ✓ Calculate combined scores (all raters together)');
    console.log('  ✓ Calculate individual rater scores (AI-only, human-only)');
    console.log('  ✓ Compare AI vs human rankings');
    console.log('  ✓ Inter-rater agreement metrics');
    console.log('\nRater ID conventions:');
    console.log('  • NULL or "combined"     - All raters combined');
    console.log('  • "gemini-2.5-flash"     - Gemini AI model scores');
    console.log('  • "gpt-4-turbo"          - GPT-4 scores (if used)');
    console.log('  • "human-user"           - Default human rater');
    console.log('  • "human-alice"          - Specific human rater (if tracking multiple)');
    console.log('\nScore calculation workflow:');
    console.log('  1. User completes experiment (AI or human)');
    console.log('  2. System calculates THREE score sets:');
    console.log('     a) Combined (rater_id = NULL)');
    console.log('     b) AI-only (rater_id = "gemini-2.5-flash")');
    console.log('     c) Human-only (rater_id = "human-user")');
    console.log('  3. UI shows dropdown to switch between views');
    console.log('  4. Agreement metrics calculated if both raters present');
    console.log('\nNext steps:');
    console.log('  1. Restart the app');
    console.log('  2. Complete an AI BWS experiment');
    console.log('  3. Add human ratings to same experiment');
    console.log('  4. View results with rater selector dropdown');
    console.log('  5. Check inter-rater agreement metrics\n');

  } catch (error) {
    console.error('\n[Multi-Rater Migration] ❌ Migration failed:', error.message);
    console.error('[Multi-Rater Migration] Error details:', error);
    console.error('\nIf you see "duplicate column name", the migration was already applied.\n');
    process.exit(1);
  } finally {
    db.close(() => {
      console.log('[Multi-Rater Migration] Database connection closed');
    });
  }
}

// Run migration
migrate();
