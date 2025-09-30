// Database migration script
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

async function migrateDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'collections.db');
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('[MIGRATION] Starting database migration...');

      // Step 1: Check if new columns already exist
      db.all("PRAGMA table_info(rating_projects)", (err, columns) => {
        if (err) {
          console.error('[MIGRATION] Error checking rating_projects:', err);
          reject(err);
          return;
        }

        const hasFailedItems = columns.some(col => col.name === 'failed_items');
        
        if (!hasFailedItems) {
          console.log('[MIGRATION] Adding new columns to rating_projects...');
          db.run(`ALTER TABLE rating_projects ADD COLUMN failed_items INTEGER DEFAULT 0`);
          db.run(`ALTER TABLE rating_projects ADD COLUMN last_error TEXT`);
          db.run(`ALTER TABLE rating_projects ADD COLUMN paused_at DATETIME`);
        } else {
          console.log('[MIGRATION] rating_projects already has new columns');
        }
      });

      // Step 2: Migrate relevance_ratings table (can't alter column constraints, need to recreate)
      db.all("PRAGMA table_info(relevance_ratings)", (err, columns) => {
        if (err) {
          console.error('[MIGRATION] Error checking relevance_ratings:', err);
          reject(err);
          return;
        }

        const hasStatus = columns.some(col => col.name === 'status');
        
        if (!hasStatus) {
          console.log('[MIGRATION] Recreating relevance_ratings table with new schema...');
          
          // Backup existing data
          db.run(`CREATE TABLE relevance_ratings_backup AS SELECT * FROM relevance_ratings`);
          
          // Drop old table
          db.run(`DROP TABLE relevance_ratings`);
          
          // Create new table with updated schema
          db.run(`
            CREATE TABLE relevance_ratings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              project_id INTEGER NOT NULL,
              item_type TEXT NOT NULL,
              item_id TEXT NOT NULL,
              relevance_score REAL,
              confidence REAL,
              reasoning TEXT,
              gemini_response TEXT,
              status TEXT DEFAULT 'success',
              error_message TEXT,
              retry_count INTEGER DEFAULT 0,
              last_retry_at DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (project_id) REFERENCES rating_projects(id),
              UNIQUE(project_id, item_type, item_id)
            )
          `);
          
          // Restore data
          db.run(`
            INSERT INTO relevance_ratings 
            (id, project_id, item_type, item_id, relevance_score, confidence, reasoning, gemini_response, created_at, status)
            SELECT id, project_id, item_type, item_id, relevance_score, confidence, reasoning, gemini_response, created_at, 'success'
            FROM relevance_ratings_backup
          `);
          
          // Drop backup
          db.run(`DROP TABLE relevance_ratings_backup`);
          
          // Recreate indexes
          db.run(`CREATE INDEX IF NOT EXISTS idx_relevance_ratings_lookup ON relevance_ratings(project_id, item_type, item_id)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_relevance_ratings_score ON relevance_ratings(relevance_score)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_relevance_ratings_status ON relevance_ratings(project_id, status)`);
          
          console.log('[MIGRATION] relevance_ratings table migrated successfully');
        } else {
          console.log('[MIGRATION] relevance_ratings already has new columns');
        }
        
        // Create new indexes if they don't exist
        db.run(`CREATE INDEX IF NOT EXISTS idx_rating_projects_status ON rating_projects(status)`, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('[MIGRATION] Error creating index:', err);
          }
        });

        console.log('[MIGRATION] Migration complete!');
        resolve();
      });
    });

    db.close();
  });
}

module.exports = { migrateDatabase };

