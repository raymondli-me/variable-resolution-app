const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/vr-collector/collections.db'
);

const db = new sqlite3.Database(dbPath);

console.log('Adding PDF support to BWS experiments...');

db.serialize(() => {
  // Create new table with updated CHECK constraint
  db.run(`
    CREATE TABLE bws_experiments_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rating_project_id INTEGER,
      item_type TEXT CHECK(item_type IN ('video_chunk', 'comment', 'pdf_excerpt', 'mixed')),
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
  `, (err) => {
    if (err) {
      console.error('Error creating new table:', err);
      return;
    }

    // Copy data from old table
    db.run(`
      INSERT INTO bws_experiments_new
      SELECT * FROM bws_experiments
    `, (err) => {
      if (err) {
        console.error('Error copying data:', err);
        return;
      }

      // Drop old table
      db.run('DROP TABLE bws_experiments', (err) => {
        if (err) {
          console.error('Error dropping old table:', err);
          return;
        }

        // Rename new table
        db.run('ALTER TABLE bws_experiments_new RENAME TO bws_experiments', (err) => {
          if (err) {
            console.error('Error renaming table:', err);
            return;
          }

          console.log('✓ Migration complete! BWS experiments now support PDF excerpts.');
          db.close();
        });
      });
    });
  });
});
