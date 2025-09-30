// Manual database migration script
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'vr-collector', 'collections.db');
console.log(`Migrating database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

db.serialize(() => {
  console.log('\n=== Step 1: Adding columns to rating_projects ===');
  
  // Check if columns exist
  db.all("PRAGMA table_info(rating_projects)", (err, columns) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    
    const hasFailedItems = columns.some(col => col.name === 'failed_items');
    const hasLastError = columns.some(col => col.name === 'last_error');
    const hasPausedAt = columns.some(col => col.name === 'paused_at');
    
    if (!hasFailedItems) {
      console.log('Adding failed_items column...');
      db.run('ALTER TABLE rating_projects ADD COLUMN failed_items INTEGER DEFAULT 0', (err) => {
        if (err) console.error('Error adding failed_items:', err);
        else console.log('✓ Added failed_items');
      });
    } else {
      console.log('✓ failed_items already exists');
    }
    
    if (!hasLastError) {
      console.log('Adding last_error column...');
      db.run('ALTER TABLE rating_projects ADD COLUMN last_error TEXT', (err) => {
        if (err) console.error('Error adding last_error:', err);
        else console.log('✓ Added last_error');
      });
    } else {
      console.log('✓ last_error already exists');
    }
    
    if (!hasPausedAt) {
      console.log('Adding paused_at column...');
      db.run('ALTER TABLE rating_projects ADD COLUMN paused_at DATETIME', (err) => {
        if (err) console.error('Error adding paused_at:', err);
        else console.log('✓ Added paused_at');
      });
    } else {
      console.log('✓ paused_at already exists');
    }
  });
  
  console.log('\n=== Step 2: Migrating relevance_ratings table ===');
  
  // Check relevance_ratings schema
  db.all("PRAGMA table_info(relevance_ratings)", (err, columns) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    
    const hasStatus = columns.some(col => col.name === 'status');
    const relevanceScoreColumn = columns.find(col => col.name === 'relevance_score');
    const isNullable = relevanceScoreColumn && relevanceScoreColumn.notnull === 0;
    
    if (!hasStatus || !isNullable) {
      console.log('Recreating relevance_ratings with new schema...');
      
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('Error starting transaction:', err);
          return;
        }
        
        // Backup
        db.run('CREATE TABLE relevance_ratings_backup AS SELECT * FROM relevance_ratings', (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating backup:', err);
            db.run('ROLLBACK');
            return;
          }
          
          // Drop old
          db.run('DROP TABLE IF EXISTS relevance_ratings', (err) => {
            if (err) {
              console.error('Error dropping table:', err);
              db.run('ROLLBACK');
              return;
            }
            
            // Create new
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
            `, (err) => {
              if (err) {
                console.error('Error creating new table:', err);
                db.run('ROLLBACK');
                return;
              }
              
              // Restore data
              db.run(`
                INSERT INTO relevance_ratings 
                (id, project_id, item_type, item_id, relevance_score, confidence, reasoning, gemini_response, created_at, status)
                SELECT id, project_id, item_type, item_id, relevance_score, confidence, reasoning, gemini_response, created_at, 'success'
                FROM relevance_ratings_backup
              `, (err) => {
                if (err) {
                  console.error('Error restoring data:', err);
                  db.run('ROLLBACK');
                  return;
                }
                
                // Drop backup
                db.run('DROP TABLE relevance_ratings_backup', (err) => {
                  if (err) {
                    console.error('Error dropping backup:', err);
                  }
                  
                  // Commit
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('Error committing:', err);
                      return;
                    }
                    
                    // Create indexes
                    db.run('CREATE INDEX IF NOT EXISTS idx_relevance_ratings_lookup ON relevance_ratings(project_id, item_type, item_id)');
                    db.run('CREATE INDEX IF NOT EXISTS idx_relevance_ratings_score ON relevance_ratings(relevance_score)');
                    db.run('CREATE INDEX IF NOT EXISTS idx_relevance_ratings_status ON relevance_ratings(project_id, status)');
                    
                    console.log('✓ relevance_ratings table migrated successfully');
                    
                    // Close and finish
                    setTimeout(() => {
                      db.close((err) => {
                        if (err) console.error('Error closing database:', err);
                        else console.log('\n=== Migration complete! ===');
                        process.exit(0);
                      });
                    }, 1000);
                  });
                });
              });
            });
          });
        });
      });
    } else {
      console.log('✓ relevance_ratings already has new schema');
      db.close(() => {
        console.log('\n=== Migration complete (no changes needed)! ===');
        process.exit(0);
      });
    }
  });
});

