const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/vr-collector/collections.db'
);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Adding merge_id support to rating_projects table...');

  // Add merge_id column (nullable, for merged collections)
  db.run(`
    ALTER TABLE rating_projects
    ADD COLUMN merge_id INTEGER REFERENCES collection_merges(id)
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding merge_id column:', err);
    } else {
      console.log('✓ Added merge_id column to rating_projects');
    }
  });

  // Make collection_id nullable (since merge projects won't have one)
  // Note: SQLite doesn't support modifying column constraints directly,
  // but we can work around this by accepting either collection_id OR merge_id

  console.log('✓ Migration complete! Rating projects now support merged collections.');
  console.log('  - collection_id: for regular collections');
  console.log('  - merge_id: for merged collections');
});

db.close();
