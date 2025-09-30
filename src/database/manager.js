import Database from 'better-sqlite3';
import crypto from 'crypto';

export class DatabaseManager {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  async initialize() {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        search_term TEXT NOT NULL,
        parameters TEXT,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        collection_id TEXT,
        title TEXT,
        description TEXT,
        channel_id TEXT,
        channel_title TEXT,
        published_at DATETIME,
        duration INTEGER,
        view_count INTEGER,
        like_count INTEGER,
        comment_count INTEGER,
        thumbnails TEXT,
        local_path TEXT,
        collected_at DATETIME,
        FOREIGN KEY (collection_id) REFERENCES collections(id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        video_id TEXT,
        author_id TEXT,
        author_name TEXT,
        text TEXT,
        text_display TEXT,
        published_at DATETIME,
        updated_at DATETIME,
        like_count INTEGER,
        reply_count INTEGER,
        FOREIGN KEY (video_id) REFERENCES videos(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_videos_collection ON videos(collection_id);
      CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id);
      CREATE INDEX IF NOT EXISTS idx_collections_created ON collections(created_at);
    `);
  }

  /**
   * Save a collection
   */
  async saveCollection({ jobId, source, searchTerm, results, timestamp }) {
    const collectionId = jobId || crypto.randomBytes(16).toString('hex');

    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO collections (id, source, search_term, parameters, status, completed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        collectionId,
        source,
        searchTerm,
        JSON.stringify(results.parameters || {}),
        'completed',
        timestamp
      );

      // Save videos
      const insertVideo = this.db.prepare(`
        INSERT OR REPLACE INTO videos 
        (id, collection_id, title, description, channel_id, channel_title, 
         published_at, duration, view_count, like_count, comment_count, 
         thumbnails, local_path, collected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertComment = this.db.prepare(`
        INSERT OR REPLACE INTO comments
        (id, video_id, author_id, author_name, text, text_display,
         published_at, updated_at, like_count, reply_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const video of results) {
        insertVideo.run(
          video.id,
          collectionId,
          video.title,
          video.description,
          video.channelId,
          video.channelTitle,
          video.publishedAt,
          video.duration,
          video.viewCount,
          video.likeCount,
          video.commentCount,
          JSON.stringify(video.thumbnails),
          video.localPath || null,
          video.collectedAt
        );

        // Save comments if available
        if (video.comments) {
          for (const comment of video.comments) {
            insertComment.run(
              comment.id,
              video.id,
              comment.authorId,
              comment.authorName,
              comment.text,
              comment.textDisplay,
              comment.publishedAt,
              comment.updatedAt,
              comment.likeCount,
              comment.replyCount
            );
          }
        }
      }

      return collectionId;
    } catch (error) {
      console.error('Database save error:', error);
      throw error;
    }
  }

  /**
   * Get all collections
   */
  async getCollections() {
    return this.db.prepare(`
      SELECT c.*, COUNT(v.id) as video_count
      FROM collections c
      LEFT JOIN videos v ON c.id = v.collection_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all();
  }

  /**
   * Get collection with videos and comments
   */
  async getCollection(collectionId) {
    const collection = this.db.prepare(`
      SELECT * FROM collections WHERE id = ?
    `).get(collectionId);

    if (!collection) return null;

    const videos = this.db.prepare(`
      SELECT * FROM videos WHERE collection_id = ?
    `).all(collectionId);

    // Get comments for each video
    for (const video of videos) {
      video.comments = this.db.prepare(`
        SELECT * FROM comments WHERE video_id = ?
        ORDER BY like_count DESC, published_at DESC
      `).all(video.id);

      // Parse JSON fields
      video.thumbnails = JSON.parse(video.thumbnails);
    }

    collection.parameters = JSON.parse(collection.parameters);
    collection.videos = videos;

    return collection;
  }

  /**
   * Save API key (encrypted)
   */
  async saveApiKey(service, apiKey) {
    // Simple encryption - in production use proper key management
    const cipher = crypto.createCipher('aes-256-cbc', 'vr-collector-key');
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(`${service}_api_key`, encrypted);
  }

  /**
   * Get API key (decrypted)
   */
  async getApiKey(service) {
    const row = this.db.prepare(`
      SELECT value FROM settings WHERE key = ?
    `).get(`${service}_api_key`);

    if (!row) return null;

    try {
      const decipher = crypto.createDecipher('aes-256-cbc', 'vr-collector-key');
      let decrypted = decipher.update(row.value, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const stats = {
      totalCollections: this.db.prepare('SELECT COUNT(*) as count FROM collections').get().count,
      totalVideos: this.db.prepare('SELECT COUNT(*) as count FROM videos').get().count,
      totalComments: this.db.prepare('SELECT COUNT(*) as count FROM comments').get().count,
      topChannels: this.db.prepare(`
        SELECT channel_title, COUNT(*) as video_count
        FROM videos
        GROUP BY channel_id
        ORDER BY video_count DESC
        LIMIT 10
      `).all(),
      recentCollections: this.db.prepare(`
        SELECT * FROM collections
        ORDER BY created_at DESC
        LIMIT 5
      `).all()
    };

    return stats;
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}