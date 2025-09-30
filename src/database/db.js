const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const queries = [
      // Collections table
      `CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_term TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        video_count INTEGER,
        comment_count INTEGER,
        settings TEXT,
        status TEXT DEFAULT 'completed'
      )`,
      
      // Videos table
      `CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        collection_id INTEGER,
        title TEXT,
        description TEXT,
        channel_id TEXT,
        channel_title TEXT,
        published_at DATETIME,
        view_count INTEGER,
        like_count INTEGER,
        comment_count INTEGER,
        duration INTEGER,
        tags TEXT,
        thumbnails TEXT,
        local_path TEXT,
        transcription TEXT,
        collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (collection_id) REFERENCES collections(id)
      )`,
      
      // Comments table
      `CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        video_id TEXT,
        collection_id INTEGER,
        author_channel_id TEXT,
        author_name TEXT,
        text TEXT,
        published_at DATETIME,
        updated_at DATETIME,
        like_count INTEGER,
        reply_count INTEGER,
        parent_id TEXT,
        FOREIGN KEY (video_id) REFERENCES videos(id),
        FOREIGN KEY (collection_id) REFERENCES collections(id)
      )`,
      
      // Video chunks table
      `CREATE TABLE IF NOT EXISTS video_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT,
        collection_id INTEGER,
        chunk_number INTEGER,
        file_path TEXT,
        start_time REAL,
        end_time REAL,
        duration REAL,
        transcript_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id),
        FOREIGN KEY (collection_id) REFERENCES collections(id)
      )`,
      
      // Create indexes for better performance
      `CREATE INDEX IF NOT EXISTS idx_videos_collection ON videos(collection_id)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_collection ON comments(collection_id)`,
      `CREATE INDEX IF NOT EXISTS idx_chunks_video ON video_chunks(video_id)`,
      `CREATE INDEX IF NOT EXISTS idx_chunks_collection ON video_chunks(collection_id)`,
      
      // Rating projects table
      `CREATE TABLE IF NOT EXISTS rating_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        project_name TEXT NOT NULL,
        research_intent TEXT NOT NULL,
        rating_scale TEXT NOT NULL,
        gemini_model TEXT DEFAULT 'gemini-2.5-flash',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        status TEXT DEFAULT 'pending',
        total_items INTEGER,
        rated_items INTEGER DEFAULT 0,
        failed_items INTEGER DEFAULT 0,
        last_error TEXT,
        paused_at DATETIME,
        settings TEXT,
        FOREIGN KEY (collection_id) REFERENCES collections(id)
      )`,
      
      // Relevance ratings table
      `CREATE TABLE IF NOT EXISTS relevance_ratings (
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
      )`,
      
      // Indexes for rating tables
      `CREATE INDEX IF NOT EXISTS idx_relevance_ratings_lookup ON relevance_ratings(project_id, item_type, item_id)`,
      `CREATE INDEX IF NOT EXISTS idx_relevance_ratings_score ON relevance_ratings(relevance_score)`,
      `CREATE INDEX IF NOT EXISTS idx_relevance_ratings_status ON relevance_ratings(project_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_rating_projects_collection ON rating_projects(collection_id)`,
      `CREATE INDEX IF NOT EXISTS idx_rating_projects_status ON rating_projects(status)`
    ];

    for (const query of queries) {
      await this.run(query);
    }
  }

  // Promisified database methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Collection methods
  async createCollection(searchTerm, settings, report = null) {
    // Include the report in settings if provided
    const fullSettings = report ? { ...settings, collectionReport: report } : settings;
    const sql = `INSERT INTO collections (search_term, settings) VALUES (?, ?)`;
    const result = await this.run(sql, [searchTerm, JSON.stringify(fullSettings)]);
    return result.id;
  }

  async updateCollection(id, videoCount, commentCount) {
    const sql = `UPDATE collections SET video_count = ?, comment_count = ? WHERE id = ?`;
    await this.run(sql, [videoCount, commentCount, id]);
  }

  async getCollections(limit = 50, offset = 0) {
    const sql = `
      SELECT * FROM collections 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    return await this.all(sql, [limit, offset]);
  }

  async getCollection(id) {
    const collection = await this.get('SELECT * FROM collections WHERE id = ?', [id]);
    if (collection) {
      collection.videos = await this.all('SELECT * FROM videos WHERE collection_id = ?', [id]);
      collection.settings = JSON.parse(collection.settings || '{}');
    }
    return collection;
  }

  // Video methods
  async saveVideo(video, collectionId) {
    const sql = `
      INSERT OR REPLACE INTO videos (
        id, collection_id, title, description, channel_id, channel_title,
        published_at, view_count, like_count, comment_count, duration,
        tags, thumbnails, local_path, transcription
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      video.id,
      collectionId,
      video.title,
      video.description,
      video.channelId,
      video.channelTitle,
      video.publishedAt,
      video.viewCount,
      video.likeCount,
      video.commentCount,
      video.duration,
      JSON.stringify(video.tags || []),
      JSON.stringify(video.thumbnails || {}),
      video.localPath || null,
      video.transcription ? JSON.stringify(video.transcription) : null
    ]);
  }

  // Video chunk methods
  async saveVideoChunks(chunks, collectionId) {
    const sql = `
      INSERT INTO video_chunks (
        video_id, collection_id, chunk_number, file_path,
        start_time, end_time, duration, transcript_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    for (const chunk of chunks) {
      await this.run(sql, [
        chunk.videoId,
        collectionId,
        chunk.chunkNumber,
        chunk.filePath,
        chunk.startTime,
        chunk.endTime,
        chunk.duration,
        chunk.text
      ]);
    }
  }

  async getVideoChunks(videoId) {
    const sql = 'SELECT * FROM video_chunks WHERE video_id = ? ORDER BY chunk_number';
    return await this.all(sql, [videoId]);
  }

  // Comment methods
  async saveComments(comments, videoId, collectionId) {
    const sql = `
      INSERT OR REPLACE INTO comments (
        id, video_id, collection_id, author_channel_id, author_name,
        text, published_at, updated_at, like_count, reply_count, parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    for (const comment of comments) {
      await this.run(sql, [
        comment.id,
        videoId,
        collectionId,
        comment.authorChannelId,
        comment.authorDisplayName,
        comment.textOriginal,
        comment.publishedAt,
        comment.updatedAt,
        comment.likeCount,
        comment.totalReplyCount,
        comment.parentId || null
      ]);
    }
  }

  // Export/Import methods
  async exportCollection(collectionId, outputPath) {
    const collection = await this.getCollection(collectionId);
    const videos = await this.all('SELECT * FROM videos WHERE collection_id = ?', [collectionId]);
    const comments = await this.all('SELECT * FROM comments WHERE collection_id = ?', [collectionId]);
    const chunks = await this.all('SELECT * FROM video_chunks WHERE collection_id = ?', [collectionId]);
    
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      collection: collection,
      videos: videos,
      comments: comments,
      video_chunks: chunks
    };
    
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    return outputPath;
  }

  async importCollection(filePath) {
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Create new collection
    const collectionId = await this.createCollection(
      data.collection.search_term + ' (Imported)',
      data.collection.settings
    );
    
    // Import videos
    for (const video of data.videos) {
      video.collection_id = collectionId;
      await this.saveVideo(video, collectionId);
    }
    
    // Import comments
    for (const comment of data.comments) {
      comment.collection_id = collectionId;
      await this.saveComments([comment], comment.video_id, collectionId);
    }
    
    await this.updateCollection(collectionId, data.videos.length, data.comments.length);
    return collectionId;
  }

  // Rating project methods
  async createRatingProject(project) {
    const result = await this.run(`
      INSERT INTO rating_projects (
        collection_id, project_name, research_intent, rating_scale,
        gemini_model, total_items, settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      project.collectionId,
      project.projectName,
      project.researchIntent,
      project.ratingScale,
      project.geminiModel || 'gemini-2.5-flash',
      project.totalItems || 0,
      JSON.stringify(project.settings || {})
    ]);
    
    return result.id;
  }
  
  async getRatingProjects(collectionId) {
    return await this.all(
      'SELECT * FROM rating_projects WHERE collection_id = ? ORDER BY created_at DESC',
      [collectionId]
    );
  }
  
  async getRatingProject(projectId) {
    return await this.get(
      'SELECT * FROM rating_projects WHERE id = ?',
      [projectId]
    );
  }
  
  async updateRatingProject(projectId, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(projectId);
    
    return await this.run(
      `UPDATE rating_projects SET ${fields} WHERE id = ?`,
      values
    );
  }
  
  async saveRating(rating) {
    return await this.run(`
      INSERT OR REPLACE INTO relevance_ratings (
        project_id, item_type, item_id, relevance_score,
        confidence, reasoning, gemini_response, status,
        error_message, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      rating.project_id,
      rating.item_type,
      rating.item_id,
      rating.relevance_score || null,
      rating.confidence || null,
      rating.reasoning || null,
      rating.gemini_response || null,
      rating.status || 'success',
      rating.error_message || null,
      rating.retry_count || 0
    ]);
  }
  
  async getRatingsForProject(projectId) {
    return await this.all(`
      SELECT 
        r.*,
        c.text as comment_text,
        c.author_name as comment_author,
        c.like_count as comment_likes,
        vc.transcript_text as chunk_text,
        vc.start_time as chunk_start,
        vc.end_time as chunk_end,
        vc.file_path as chunk_file_path,
        v.title as video_title
      FROM relevance_ratings r
      LEFT JOIN comments c ON r.item_type = 'comment' AND r.item_id = c.id
      LEFT JOIN video_chunks vc ON r.item_type = 'video_chunk' AND r.item_id = vc.id
      LEFT JOIN videos v ON (c.video_id = v.id OR vc.video_id = v.id)
      WHERE r.project_id = ?
      ORDER BY r.created_at DESC
    `, [projectId]);
  }
  
  async getItemsForRating(collectionId, includeChunks, includeComments) {
    const items = [];
    
    if (includeChunks) {
      const chunks = await this.all(`
        SELECT vc.*, v.title as video_title, v.channel_title
        FROM video_chunks vc
        JOIN videos v ON vc.video_id = v.id
        WHERE vc.collection_id = ?
      `, [collectionId]);
      
      items.push(...chunks.map(chunk => ({
        type: 'video_chunk',
        id: `chunk_${chunk.video_id}_${chunk.chunk_number}`,
        ...chunk
      })));
    }
    
    if (includeComments) {
      const comments = await this.all(`
        SELECT c.*, v.title as video_title
        FROM comments c
        JOIN videos v ON c.video_id = v.id
        WHERE c.collection_id = ?
      `, [collectionId]);
      
      items.push(...comments.map(comment => ({
        type: 'comment',
        id: comment.id,
        ...comment
      })));
    }
    
    return items;
  }
  
  // Get failed ratings for a project (for retry functionality)
  async getFailedRatings(projectId) {
    return await this.all(
      `SELECT * FROM relevance_ratings 
       WHERE project_id = ? AND status = 'failed'
       ORDER BY created_at DESC`,
      [projectId]
    );
  }
  
  // Increment failed items count
  async incrementFailedItems(projectId) {
    return await this.run(
      `UPDATE rating_projects 
       SET failed_items = failed_items + 1 
       WHERE id = ?`,
      [projectId]
    );
  }
  
  // Get comprehensive project statistics
  async getProjectStatistics(projectId) {
    const project = await this.getRatingProject(projectId);
    
    const stats = await this.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        AVG(CASE WHEN status = 'success' THEN relevance_score END) as avg_relevance,
        AVG(CASE WHEN status = 'success' THEN confidence END) as avg_confidence
      FROM relevance_ratings
      WHERE project_id = ?
    `, [projectId]);
    
    // Get distribution of relevance scores
    const distribution = await this.all(`
      SELECT 
        CASE 
          WHEN relevance_score >= 0.8 THEN 'high'
          WHEN relevance_score >= 0.4 THEN 'medium'
          ELSE 'low'
        END as category,
        COUNT(*) as count
      FROM relevance_ratings
      WHERE project_id = ? AND status = 'success'
      GROUP BY category
    `, [projectId]);
    
    return {
      project,
      ...stats,
      distribution: distribution.reduce((acc, row) => {
        acc[row.category] = row.count;
        return acc;
      }, {})
    };
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Singleton instance
let dbInstance = null;

// Initialize database
async function initializeDatabase(dbPath) {
  if (!dbInstance) {
    dbInstance = new Database();
    await dbInstance.init();
  }
  return dbInstance;
}

// Export singleton instance with all methods
module.exports = new Proxy({}, {
  get: function(target, prop) {
    // Special handling for initialize
    if (prop === 'initialize') {
      return initializeDatabase;
    }
    if (prop === 'getDatabase') {
      return initializeDatabase; // Alias
    }
    // For all other properties, get them from the dbInstance
    if (!dbInstance) {
      throw new Error('Database not initialized. Call db.initialize() first.');
    }
    const value = dbInstance[prop];
    if (typeof value === 'function') {
      return value.bind(dbInstance);
    }
    return value;
  }
});