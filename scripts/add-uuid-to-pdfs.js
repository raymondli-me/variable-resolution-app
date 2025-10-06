#!/usr/bin/env node
/**
 * Database Migration: Add UUID to PDFs
 *
 * Adds a UUID column to the `pdfs` table to ensure a stable, unique identifier
 * for PDF documents across different databases, which is critical for the
 * export/import functionality.
 *
 * Usage: node scripts/add-uuid-to-pdfs.js
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

console.log(`[PDF UUID Migration] Database path: ${dbPath}`);
console.log(`[PDF UUID Migration] Starting migration to add UUIDs to PDFs...\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[PDF UUID Migration] ❌ Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('[PDF UUID Migration] ✓ Connected to database');
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

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function migrate() {
  try {
    console.log('[PDF UUID Migration] Checking schema for `pdfs` table...');
    const tableInfo = await all('PRAGMA table_info(pdfs)');
    const hasUUIDColumn = tableInfo.some(col => col.name === 'uuid');

    if (hasUUIDColumn) {
      console.log('[PDF UUID Migration] ✓ `uuid` column already exists in `pdfs` table.');
      console.log('[PDF UUID Migration] Migration not needed.\n');
      return;
    }

    console.log('[PDF UUID Migration] Schema needs update. Adding `uuid` column...\n');

    // Step 1: Add the UUID column
    await run('ALTER TABLE pdfs ADD COLUMN uuid TEXT');
    console.log('[PDF UUID Migration] ✓ `uuid` column added to `pdfs` table.');

    // Step 2: Backfill UUIDs for existing PDFs
    console.log('[PDF UUID Migration] Backfilling UUIDs for existing PDF records...');
    const pdfsToUpdate = await all('SELECT id FROM pdfs WHERE uuid IS NULL');

    if (pdfsToUpdate.length === 0) {
      console.log('[PDF UUID Migration] ✓ No PDFs needed a UUID backfill.');
    } else {
      for (const pdf of pdfsToUpdate) {
        const newUUID = crypto.randomUUID();
        await run('UPDATE pdfs SET uuid = ? WHERE id = ?', [newUUID, pdf.id]);
      }
      console.log(`[PDF UUID Migration] ✓ Backfilled UUIDs for ${pdfsToUpdate.length} PDF(s).`);
    }

    // Step 3: Add a UNIQUE index to the UUID column
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_pdfs_uuid ON pdfs(uuid)');
    console.log('[PDF UUID Migration] ✓ Added unique index on `uuid` column.');

    console.log('\n[PDF UUID Migration] ✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n[PDF UUID Migration] ❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    db.close(() => {
      console.log('[PDF UUID Migration] Database connection closed');
    });
  }
}

// Run migration
migrate();
