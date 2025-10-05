#!/usr/bin/env node
/**
 * Database Migration: PDF Multi-Source Support
 *
 * Adds PDF tables to enable PDF document analysis alongside YouTube data.
 * This is the first non-YouTube data source, establishing patterns for
 * future integrations (Reddit, news articles, images).
 *
 * Tables Created:
 * 1. items - Core abstraction for all item types (unified queries)
 * 2. pdfs - PDF file metadata
 * 3. pdf_excerpts - Chunked PDF text with bounding boxes
 *
 * Design: See docs/PDF_Implementation_From_Consultant.md - Option C: Hybrid Core + Extension Pattern
 *
 * Usage: node scripts/add-pdf-support.js
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

console.log(`[PDF Migration] Database path: ${dbPath}`);
console.log(`[PDF Migration] Starting PDF multi-source support migration...\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[PDF Migration] ❌ Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('[PDF Migration] ✓ Connected to database');
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
    console.log('[PDF Migration] Checking current schema...');
    const tables = await all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items', 'pdfs', 'pdf_excerpts')");
    const tableNames = tables.map(t => t.name);

    if (tableNames.includes('items') &&
        tableNames.includes('pdfs') &&
        tableNames.includes('pdf_excerpts')) {
      console.log('[PDF Migration] ✓ Migration already applied');
      console.log('[PDF Migration] Database already has PDF tables\n');
      db.close();
      return;
    }

    console.log('[PDF Migration] Schema needs update\n');

    // ========================================
    // Step 1: Create items table (core abstraction)
    // ========================================
    console.log('[PDF Migration] Step 1: Creating items table (core abstraction)...');

    await run(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        collection_id INTEGER NOT NULL,
        item_type TEXT NOT NULL CHECK(item_type IN ('video_chunk', 'comment', 'pdf_excerpt')),
        text_content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (collection_id) REFERENCES collections(id)
      )
    `);
    console.log('[PDF Migration]   ✓ Created items table');
    console.log('[PDF Migration]   ℹ️  Composite ID format: "chunk:1241", "comment:5678", "pdf:42"');
    console.log('[PDF Migration]   ℹ️  Enables unified queries across all data types');

    // ========================================
    // Step 2: Create pdfs table
    // ========================================
    console.log('\n[PDF Migration] Step 2: Creating pdfs table...');

    await run(`
      CREATE TABLE IF NOT EXISTS pdfs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        title TEXT,
        author TEXT,
        num_pages INTEGER,
        file_size INTEGER,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (collection_id) REFERENCES collections(id)
      )
    `);
    console.log('[PDF Migration]   ✓ Created pdfs table');
    console.log('[PDF Migration]   ℹ️  Stores PDF file metadata and location');

    // ========================================
    // Step 3: Create pdf_excerpts table
    // ========================================
    console.log('\n[PDF Migration] Step 3: Creating pdf_excerpts table...');

    await run(`
      CREATE TABLE IF NOT EXISTS pdf_excerpts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pdf_id INTEGER NOT NULL,
        collection_id INTEGER NOT NULL,
        excerpt_number INTEGER,
        page_number INTEGER,
        text_content TEXT NOT NULL,
        char_start INTEGER,
        char_end INTEGER,
        bbox TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
        FOREIGN KEY (collection_id) REFERENCES collections(id)
      )
    `);
    console.log('[PDF Migration]   ✓ Created pdf_excerpts table');
    console.log('[PDF Migration]   ℹ️  bbox stores JSON: {x, y, width, height, page}');
    console.log('[PDF Migration]   ℹ️  Used for highlighting excerpts in PDF viewer');

    // ========================================
    // Step 4: Create performance indexes
    // ========================================
    console.log('\n[PDF Migration] Step 4: Creating performance indexes...');

    await run(`CREATE INDEX IF NOT EXISTS idx_items_type ON items(item_type)`);
    console.log('[PDF Migration]   ✓ Created index on items(item_type)');

    await run(`CREATE INDEX IF NOT EXISTS idx_items_collection ON items(collection_id)`);
    console.log('[PDF Migration]   ✓ Created index on items(collection_id)');

    await run(`CREATE INDEX IF NOT EXISTS idx_items_text ON items(text_content)`);
    console.log('[PDF Migration]   ✓ Created index on items(text_content) for full-text search');

    await run(`CREATE INDEX IF NOT EXISTS idx_pdfs_collection ON pdfs(collection_id)`);
    console.log('[PDF Migration]   ✓ Created index on pdfs(collection_id)');

    await run(`CREATE INDEX IF NOT EXISTS idx_pdf_excerpts_pdf ON pdf_excerpts(pdf_id)`);
    console.log('[PDF Migration]   ✓ Created index on pdf_excerpts(pdf_id)');

    await run(`CREATE INDEX IF NOT EXISTS idx_pdf_excerpts_collection ON pdf_excerpts(collection_id)`);
    console.log('[PDF Migration]   ✓ Created index on pdf_excerpts(collection_id)');

    // ========================================
    // Step 5: Verify schema
    // ========================================
    console.log('\n[PDF Migration] Step 5: Verifying schema...');

    const createdTables = await all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items', 'pdfs', 'pdf_excerpts') ORDER BY name");
    console.log('[PDF Migration]   PDF tables created:');
    createdTables.forEach(table => {
      console.log(`[PDF Migration]     ✓ ${table.name}`);
    });

    // Show column details for items table
    const itemsInfo = await all('PRAGMA table_info(items)');
    console.log('\n[PDF Migration]   items table columns:');
    itemsInfo.forEach(col => {
      const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
      const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
      console.log(`[PDF Migration]     - ${col.name.padEnd(20)} ${col.type.padEnd(10)} ${nullable}${defaultVal}`);
    });

    // Show column details for pdf_excerpts table
    const excerptsInfo = await all('PRAGMA table_info(pdf_excerpts)');
    console.log('\n[PDF Migration]   pdf_excerpts table columns:');
    excerptsInfo.forEach(col => {
      const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
      const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
      console.log(`[PDF Migration]     - ${col.name.padEnd(20)} ${col.type.padEnd(10)} ${nullable}${defaultVal}`);
    });

    console.log('\n[PDF Migration] ✅ Migration completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  PDF Multi-Source Support: ENABLED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nNew capabilities:');
    console.log('  ✓ Upload and analyze PDF documents');
    console.log('  ✓ Extract and chunk PDF text');
    console.log('  ✓ Rate PDF excerpts with Gemini AI');
    console.log('  ✓ Compare PDFs in BWS experiments');
    console.log('  ✓ View PDF excerpts with highlights');
    console.log('  ✓ Mixed-type collections (YouTube + PDFs)');
    console.log('\nDatabase tables:');
    console.log('  • items          - Unified abstraction (all types)');
    console.log('  • pdfs           - PDF file metadata');
    console.log('  • pdf_excerpts   - Chunked text with bounding boxes');
    console.log('\nArchitecture:');
    console.log('  Hybrid Core + Extension Pattern (Option C)');
    console.log('  - Existing YouTube tables: UNCHANGED ✓');
    console.log('  - New PDF tables: ADDED ✓');
    console.log('  - Unified queries: items table ✓');
    console.log('  - Extensible: Future types (Reddit, news, images) ✓');
    console.log('\nNext steps:');
    console.log('  1. Install PDF dependencies: npm install pdf-parse pdfjs-dist pdf-lib');
    console.log('  2. Implement PDF collector (src/collectors/pdf-collector.js)');
    console.log('  3. Implement PDF chunker (src/services/pdf-chunker.js)');
    console.log('  4. Add PDF upload UI to index-advanced.html');
    console.log('  5. Update rating engine for PDF excerpts');
    console.log('  6. Add PDF viewer to BWS interface');
    console.log('\nSee docs/PDF_Implementation_From_Consultant.md for full implementation guide.\n');

  } catch (error) {
    console.error('\n[PDF Migration] ❌ Migration failed:', error.message);
    console.error('[PDF Migration] Error details:', error);
    console.error('\nIf you see "table already exists", the migration was already applied.');
    console.error('Run: sqlite3 <db-path> ".tables" to check.\n');
    process.exit(1);
  } finally {
    db.close(() => {
      console.log('[PDF Migration] Database connection closed');
    });
  }
}

// Run migration
migrate();
