#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const appDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'vr-collector');
const dbPath = path.join(appDataPath, 'collections.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

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

async function backfill() {
  try {
    const collections = await all('SELECT id FROM collections WHERE uuid IS NULL');
    console.log(`Found ${collections.length} collections without UUIDs`);

    for (const collection of collections) {
      const uuid = crypto.randomUUID();
      await run('UPDATE collections SET uuid = ? WHERE id = ?', [uuid, collection.id]);
      console.log(`  ✓ Generated UUID for collection ${collection.id}: ${uuid}`);
    }

    console.log('✅ Backfill complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    db.close();
  }
}

backfill();
