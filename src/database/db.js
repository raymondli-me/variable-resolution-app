const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const FolderManager = require('./folder-methods');
const CollectionExporter = require('../services/collection-exporter');
const CollectionImporter = require('../services/collection-importer');

class Database {
  constructor() {
    this.db = null;
    this.folderManager = null;
    this.exporter = null;
    this.importer = null;
  }

  async init() {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(() => {
            // Initialize folder manager
            this.folderManager = new FolderManager(this);
            this.exporter = new CollectionExporter(this);
            this.importer = new CollectionImporter(this);
            resolve();
          }).catch(reject);
        }
      });
    });
  }

  /**
   * Add source column to excerpt_ratings table if it doesn't exist
   */
  async addSourceColumnIfNeeded() {
    try {
      // Check if column exists
      const result = await this.get(`PRAGMA table_info(excerpt_ratings)`);
      const columns = await this.all(`PRAGMA table_info(excerpt_ratings)`);

      const hasSourceColumn = columns.some(col => col.name === 'source');

      if (!hasSourceColumn) {
        console.log('[Database] Adding source column to excerpt_ratings table');
        await this.run(`ALTER TABLE excerpt_ratings ADD COLUMN source TEXT DEFAULT 'human'`);
        console.log('[Database] Source column added successfully');
      }
    } catch (error) {
      // Table might not exist yet, which is fine
      console.log('[Database] Excerpt ratings table does not exist yet (will be created)');
    }
  }

  /**
   * Add variable_type column to global_rating_variables table if it doesn't exist
   */
  async addVariableTypeColumnIfNeeded() {
    try {
      // Check if column exists
      const columns = await this.all(`PRAGMA table_info(global_rating_variables)`);

      const hasVariableTypeColumn = columns.some(col => col.name === 'variable_type');

      if (!hasVariableTypeColumn) {
        console.log('[Database] Adding variable_type column to global_rating_variables table');
        await this.run(`ALTER TABLE global_rating_variables ADD COLUMN variable_type TEXT DEFAULT 'rating'`);
        console.log('[Database] variable_type column added successfully');
      }
    } catch (error) {
      // Table might not exist yet, which is fine
      console.log('[Database] Global rating variables table does not exist yet (will be created)');
    }
  }

  async createTables() {
    // First, add source column to excerpt_ratings if it doesn't exist
    await this.addSourceColumnIfNeeded();
    // Add variable_type column to global_rating_variables if it doesn't exist
    await this.addVariableTypeColumnIfNeeded();

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
      `CREATE INDEX IF NOT EXISTS idx_rating_projects_status ON rating_projects(status)`,

      // Collection Merge tables - for combining multiple collections
      `CREATE TABLE IF NOT EXISTS collection_merges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        settings TEXT,
        is_active INTEGER DEFAULT 1
      )`,

      // Maps which source collections belong to which merge
      `CREATE TABLE IF NOT EXISTS collection_merge_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merge_id INTEGER NOT NULL,
        source_collection_id INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        weight REAL DEFAULT 1.0,
        notes TEXT,
        FOREIGN KEY (merge_id) REFERENCES collection_merges(id) ON DELETE CASCADE,
        FOREIGN KEY (source_collection_id) REFERENCES collections(id) ON DELETE CASCADE,
        UNIQUE(merge_id, source_collection_id)
      )`,

      // Indexes for merge tables
      `CREATE INDEX IF NOT EXISTS idx_merge_members_merge ON collection_merge_members(merge_id)`,
      `CREATE INDEX IF NOT EXISTS idx_merge_members_source ON collection_merge_members(source_collection_id)`,

      // Provenance tables for export/import tracking
      `CREATE TABLE IF NOT EXISTS collection_exports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER,
        folder_id INTEGER,
        export_uuid TEXT NOT NULL UNIQUE,
        export_format TEXT NOT NULL,
        export_path TEXT NOT NULL,
        file_size_mb REAL,
        included_dependencies INTEGER DEFAULT 1,
        included_assets INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      )`,

      `CREATE TABLE IF NOT EXISTS collection_imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_uuid TEXT,
        source_name TEXT,
        source_folder_path TEXT,
        target_collection_id INTEGER NOT NULL,
        target_folder_id INTEGER,
        import_strategy TEXT NOT NULL,
        id_remapping TEXT,
        items_imported INTEGER,
        warnings TEXT,
        import_file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_collection_id) REFERENCES collections(id) ON DELETE CASCADE,
        FOREIGN KEY (target_folder_id) REFERENCES folders(id) ON DELETE SET NULL
      )`,

      // Rating Variables table - for custom user-defined coding variables
      `CREATE TABLE IF NOT EXISTS rating_variables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        definition TEXT,
        scale_type TEXT NOT NULL,
        anchors TEXT,
        reasoning_depth TEXT DEFAULT 'brief',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      )`,

      // Global Rating Variables table - for centralized, reusable coding variables
      `CREATE TABLE IF NOT EXISTS global_rating_variables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        genre TEXT NOT NULL,
        definition TEXT,
        variable_type TEXT DEFAULT 'rating',
        scale_type TEXT,
        anchors TEXT,
        reasoning_depth TEXT DEFAULT 'brief',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Excerpt Ratings table - for human ratings of PDF excerpts
      `CREATE TABLE IF NOT EXISTS excerpt_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        excerpt_id INTEGER NOT NULL,
        variable_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        reasoning TEXT,
        reasoning_depth TEXT DEFAULT 'brief',
        source TEXT DEFAULT 'human',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (excerpt_id) REFERENCES pdf_excerpts(id) ON DELETE CASCADE,
        FOREIGN KEY (variable_id) REFERENCES rating_variables(id) ON DELETE CASCADE,
        UNIQUE(excerpt_id, variable_id)
      )`,

      // AI Excerpt Ratings table - for AI-generated ratings of PDF excerpts
      // Note: No UNIQUE constraint - allows multiple AI ratings for comparison/history
      `CREATE TABLE IF NOT EXISTS ai_excerpt_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        excerpt_id INTEGER NOT NULL,
        variable_id INTEGER NOT NULL,
        score TEXT NOT NULL,
        reasoning TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (excerpt_id) REFERENCES pdf_excerpts(id) ON DELETE CASCADE,
        FOREIGN KEY (variable_id) REFERENCES rating_variables(id) ON DELETE CASCADE
      )`,

      // Indexes for rating tables
      `CREATE INDEX IF NOT EXISTS idx_rating_variables_collection ON rating_variables(collection_id)`,
      `CREATE INDEX IF NOT EXISTS idx_excerpt_ratings_excerpt ON excerpt_ratings(excerpt_id)`,
      `CREATE INDEX IF NOT EXISTS idx_excerpt_ratings_variable ON excerpt_ratings(variable_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_excerpt_ratings_excerpt ON ai_excerpt_ratings(excerpt_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_excerpt_ratings_variable ON ai_excerpt_ratings(variable_id)`
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
  async createCollection(searchTerm, settings, report = null, parentCollectionId = null, derivationInfo = null) {
    // Include the report in settings if provided
    const fullSettings = report ? { ...settings, collectionReport: report } : settings;

    // Build SQL dynamically based on whether lineage info is provided
    let sql, params;
    if (parentCollectionId !== null && derivationInfo !== null) {
      sql = `INSERT INTO collections (search_term, settings, parent_collection_id, derivation_info) VALUES (?, ?, ?, ?)`;
      params = [searchTerm, JSON.stringify(fullSettings), parentCollectionId, JSON.stringify(derivationInfo)];
    } else {
      sql = `INSERT INTO collections (search_term, settings) VALUES (?, ?)`;
      params = [searchTerm, JSON.stringify(fullSettings)];
    }

    const result = await this.run(sql, params);
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

  // Export methods
  async exportCollection(collectionId, outputPath, options) {
    return await this.exporter.exportCollectionJSON(collectionId, outputPath, options);
  }

  async exportFolder(folderId, outputPath, options) {
    return await this.exporter.exportFolderZIP(folderId, outputPath, options);
  }

  async exportDatabase(outputPath) {
    return await this.exporter.exportFullDatabase(outputPath);
  }

  // Import methods
  async importCollection(filePath, options) {
    return await this.importer.importCollectionJSON(filePath, options);
  }

  async importFolder(zipPath, options) {
    return await this.importer.importFolderZIP(zipPath, options);
  }

  // Rating project methods
  async createRatingProject(project) {
    // Parse collectionId to check if it's a merge
    let collectionId = 0;  // Sentinel value for merged collections
    let mergeId = null;

    if (typeof project.collectionId === 'string' && project.collectionId.startsWith('merge:')) {
      mergeId = parseInt(project.collectionId.replace('merge:', ''));
      collectionId = 0;  // Use 0 as sentinel for merged collections
    } else {
      collectionId = project.collectionId;
    }

    const result = await this.run(`
      INSERT INTO rating_projects (
        collection_id, merge_id, project_name, research_intent, rating_scale,
        gemini_model, total_items, settings, parent_project_id, filter_criteria
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      collectionId,
      mergeId,
      project.projectName,
      project.researchIntent,
      project.ratingScale,
      project.geminiModel || 'gemini-2.5-flash',
      project.totalItems || 0,
      JSON.stringify(project.settings || {}),
      project.parentProjectId || null,  // NEW: parent project reference
      project.filterCriteria ? JSON.stringify(project.filterCriteria) : null  // NEW: filter config
    ]);

    return result.id;
  }

  async getRatingProjects(collectionId) {
    // Parse collectionId - might be "merge:123" string or regular collection ID
    if (typeof collectionId === 'string' && collectionId.startsWith('merge:')) {
      const mergeId = parseInt(collectionId.replace('merge:', ''));
      return await this.all(
        'SELECT * FROM rating_projects WHERE merge_id = ? ORDER BY created_at DESC',
        [mergeId]
      );
    }

    return await this.all(
      'SELECT * FROM rating_projects WHERE collection_id = ? ORDER BY created_at DESC',
      [collectionId]
    );
  }

  async getAllRatingProjects() {
    return await this.all(`
      SELECT
        rp.*,
        COALESCE(c.search_term, cm.name) as collection_name,
        CASE WHEN rp.merge_id IS NOT NULL THEN 1 ELSE 0 END as is_merged
      FROM rating_projects rp
      LEFT JOIN collections c ON rp.collection_id = c.id
      LEFT JOIN collection_merges cm ON rp.merge_id = cm.id
      ORDER BY rp.created_at DESC
    `);
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
  
  async getItemsForRating(collectionId, includeChunks, includeComments, projectId = null, includePDFs = false) {
    const items = [];

    // If projectId provided, check if it's a child project (has parent_project_id)
    if (projectId) {
      const project = await this.getRatingProject(projectId);

      if (project && project.parent_project_id) {
        console.log(`[Database] Project ${projectId} is a child project, fetching from parent ${project.parent_project_id}`);

        // This is a CHILD PROJECT - fetch from parent's ratings
        const filterCriteria = project.filter_criteria ? JSON.parse(project.filter_criteria) : {};
        const minScore = filterCriteria.min_score || 0.0;
        const maxScore = filterCriteria.max_score || 1.0;
        const allowedTypes = filterCriteria.content_types || ['video_chunk', 'comment', 'pdf_excerpt'];

        console.log(`[Database] Filter criteria: min_score=${minScore}, max_score=${maxScore}, types=${allowedTypes.join(',')}`);

        // Get successful ratings from parent project that match filter criteria
        const parentRatings = await this.all(`
          SELECT
            r.*,
            c.text as comment_text,
            c.author_name as comment_author,
            c.like_count as comment_likes,
            c.video_id as comment_video_id,
            vc.transcript_text as chunk_text,
            vc.start_time as chunk_start,
            vc.end_time as chunk_end,
            vc.file_path as chunk_file_path,
            vc.video_id as chunk_video_id,
            vc.chunk_number,
            pe.text_content as pdf_text,
            pe.page_number as pdf_page,
            pe.excerpt_number as pdf_excerpt_num,
            pdf.title as pdf_title,
            pdf.file_path as pdf_file_path,
            v.title as video_title,
            v.channel_title
          FROM relevance_ratings r
          LEFT JOIN comments c ON r.item_type = 'comment' AND r.item_id = c.id
          LEFT JOIN video_chunks vc ON r.item_type = 'video_chunk' AND r.item_id = vc.id
          LEFT JOIN pdf_excerpts pe ON r.item_type = 'pdf_excerpt' AND r.item_id = pe.id
          LEFT JOIN pdfs pdf ON pe.pdf_id = pdf.id
          LEFT JOIN videos v ON (c.video_id = v.id OR vc.video_id = v.id)
          WHERE r.project_id = ?
            AND r.status = 'success'
            AND r.relevance_score >= ?
            AND r.relevance_score <= ?
          ORDER BY r.relevance_score DESC
        `, [project.parent_project_id, minScore, maxScore]);

        console.log(`[Database] Found ${parentRatings.length} ratings from parent project matching criteria`);

        // Convert parent ratings back to items format
        for (const rating of parentRatings) {
          if (!allowedTypes.includes(rating.item_type)) {
            continue; // Skip if type not in filter
          }

          if (rating.item_type === 'video_chunk') {
            if (includeChunks && rating.chunk_file_path) {
              items.push({
                type: 'video_chunk',
                id: rating.item_id,
                video_id: rating.chunk_video_id,
                chunk_number: rating.chunk_number,
                file_path: rating.chunk_file_path,
                start_time: rating.chunk_start,
                end_time: rating.chunk_end,
                transcript_text: rating.chunk_text,
                video_title: rating.video_title,
                channel_title: rating.channel_title,
                parent_rating_score: rating.relevance_score,  // Include parent's score for reference
                parent_rating_reasoning: rating.reasoning
              });
            }
          } else if (rating.item_type === 'comment') {
            if (includeComments && rating.comment_text) {
              items.push({
                type: 'comment',
                id: rating.item_id,
                text: rating.comment_text,
                author_name: rating.comment_author,
                like_count: rating.comment_likes,
                video_id: rating.comment_video_id,
                video_title: rating.video_title,
                parent_rating_score: rating.relevance_score,
                parent_rating_reasoning: rating.reasoning
              });
            }
          } else if (rating.item_type === 'pdf_excerpt') {
            if (includePDFs && rating.pdf_text) {
              items.push({
                type: 'pdf_excerpt',
                id: rating.item_id,
                text_content: rating.pdf_text,
                page_number: rating.pdf_page,
                excerpt_number: rating.pdf_excerpt_num,
                pdf_title: rating.pdf_title,
                pdf_file_path: rating.pdf_file_path,
                parent_rating_score: rating.relevance_score,
                parent_rating_reasoning: rating.reasoning
              });
            }
          }
        }

        console.log(`[Database] Returning ${items.length} items from parent project for child project`);
        return items;
      }
    }

    // ROOT PROJECT or no projectId - fetch from collection as before
    console.log(`[Database] Fetching items from collection ${collectionId} (root project)`);

    // Parse collectionId - might be "merge:123" string or regular collection ID
    let actualCollectionId = collectionId;
    let mergeId = null;

    if (typeof collectionId === 'string' && collectionId.startsWith('merge:')) {
      mergeId = parseInt(collectionId.replace('merge:', ''));
      actualCollectionId = null;
    }

    let collectionIds = [];

    if (mergeId) {
      // This is a merged collection - get all source collection IDs
      const sourceCollections = await this.all(`
        SELECT source_collection_id FROM collection_merge_members WHERE merge_id = ?
      `, [mergeId]);

      if (sourceCollections.length > 0) {
        collectionIds = sourceCollections.map(sc => sc.source_collection_id);
        console.log(`[Database] Merged collection detected (ID ${mergeId}), fetching from ${collectionIds.length} source collections`);
      }
    } else {
      // Check if the numeric ID is a merged collection
      const merge = await this.get(`
        SELECT id FROM collection_merges WHERE id = ? AND is_active = 1
      `, [actualCollectionId]);

      if (merge) {
        // This is a merged collection - get all source collection IDs
        const sourceCollections = await this.all(`
          SELECT source_collection_id FROM collection_merge_members WHERE merge_id = ?
        `, [actualCollectionId]);

        if (sourceCollections.length > 0) {
          collectionIds = sourceCollections.map(sc => sc.source_collection_id);
          console.log(`[Database] Merged collection detected, fetching from ${collectionIds.length} source collections`);
        }
      } else {
        // Regular collection
        collectionIds = [actualCollectionId];
      }
    }

    if (includeChunks) {
      const placeholders = collectionIds.map(() => '?').join(',');

      // If projectId provided, skip already-rated items
      let chunksQuery = `
        SELECT vc.*, v.title as video_title, v.channel_title
        FROM video_chunks vc
        JOIN videos v ON vc.video_id = v.id
        WHERE vc.collection_id IN (${placeholders})
      `;

      if (projectId) {
        chunksQuery += `
          AND NOT EXISTS (
            SELECT 1 FROM relevance_ratings rr
            WHERE rr.project_id = ${projectId}
              AND rr.item_type = 'video_chunk'
              AND rr.item_id = CAST(vc.id AS TEXT)
              AND rr.status = 'success'
          )
        `;
      }

      const chunks = await this.all(chunksQuery, collectionIds);

      items.push(...chunks.map(chunk => ({
        type: 'video_chunk',
        id: `chunk_${chunk.video_id}_${chunk.chunk_number}`,
        ...chunk
      })));
    }

    if (includeComments) {
      const placeholders = collectionIds.map(() => '?').join(',');

      // If projectId provided, skip already-rated items
      let commentsQuery = `
        SELECT c.*, v.title as video_title
        FROM comments c
        JOIN videos v ON c.video_id = v.id
        WHERE c.collection_id IN (${placeholders})
      `;

      if (projectId) {
        commentsQuery += `
          AND NOT EXISTS (
            SELECT 1 FROM relevance_ratings rr
            WHERE rr.project_id = ${projectId}
              AND rr.item_type = 'comment'
              AND rr.item_id = c.id
              AND rr.status = 'success'
          )
        `;
      }

      const comments = await this.all(commentsQuery, collectionIds);

      items.push(...comments.map(comment => ({
        type: 'comment',
        id: comment.id,
        ...comment
      })));
    }

    if (includePDFs) {
      const placeholders = collectionIds.map(() => '?').join(',');

      // If projectId provided, skip already-rated items
      let pdfsQuery = `
        SELECT pe.*, pdf.title as pdf_title, pdf.file_path as pdf_file_path
        FROM pdf_excerpts pe
        JOIN pdfs pdf ON pe.pdf_id = pdf.id
        WHERE pe.collection_id IN (${placeholders})
      `;

      if (projectId) {
        pdfsQuery += `
          AND NOT EXISTS (
            SELECT 1 FROM relevance_ratings rr
            WHERE rr.project_id = ${projectId}
              AND rr.item_type = 'pdf_excerpt'
              AND rr.item_id = pe.id
              AND rr.status = 'success'
          )
        `;
      }

      const pdfExcerpts = await this.all(pdfsQuery, collectionIds);

      items.push(...pdfExcerpts.map(excerpt => ({
        type: 'pdf_excerpt',
        id: excerpt.id,
        ...excerpt
      })));
    }

    console.log(`[Database] Returning ${items.length} items from collection(s) for root project`);
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

  // Get child projects of a given project
  async getChildProjects(projectId) {
    return await this.all(
      `SELECT * FROM rating_projects
       WHERE parent_project_id = ?
       ORDER BY created_at DESC`,
      [projectId]
    );
  }

  // Get full lineage of a project (from root to current)
  async getRatingProjectLineage(projectId) {
    const lineage = [];
    let currentId = projectId;

    // Traverse up the parent chain (max 20 levels to prevent infinite loops)
    for (let i = 0; i < 20; i++) {
      const project = await this.getRatingProject(currentId);

      if (!project) {
        break; // Project not found
      }

      lineage.unshift(project); // Add to beginning of array

      if (!project.parent_project_id) {
        break; // Reached root project
      }

      currentId = project.parent_project_id;
    }

    return lineage;
  }

  // Check if creating a child project would create a circular reference
  async wouldCreateCircularReference(parentProjectId, childProjectId) {
    if (parentProjectId === childProjectId) {
      return true; // Self-reference
    }

    const lineage = await this.getRatingProjectLineage(parentProjectId);
    return lineage.some(p => p.id === childProjectId);
  }

  // Get all root projects for a collection (projects with no parent)
  async getRootProjects(collectionId) {
    return await this.all(
      `SELECT * FROM rating_projects
       WHERE collection_id = ? AND parent_project_id IS NULL
       ORDER BY created_at DESC`,
      [collectionId]
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

  // ========================================
  // BWS (Best-Worst Scaling) Methods
  // ========================================

  /**
   * Create a new BWS experiment
   */
  async createBWSExperiment(experimentData) {
    const {
      name,
      rating_project_id,
      item_type,
      tuple_size,
      tuple_count,
      design_method,
      scoring_method,
      rater_type,
      research_intent,
      status = 'draft'
    } = experimentData;

    const result = await this.run(`
      INSERT INTO bws_experiments (
        name, rating_project_id, item_type, tuple_size, tuple_count,
        design_method, scoring_method, rater_type, research_intent, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, rating_project_id, item_type, tuple_size, tuple_count,
      design_method, scoring_method, rater_type, research_intent, status
    ]);

    return result.id;
  }

  /**
   * Get all BWS experiments
   */
  async getAllBWSExperiments() {
    return await this.all(`
      SELECT
        e.*,
        rp.project_name as rating_project_name,
        rp.collection_id,
        (SELECT COUNT(*) FROM bws_tuples WHERE experiment_id = e.id) as tuples_generated,
        (SELECT COUNT(*) FROM bws_judgments j JOIN bws_tuples t ON j.tuple_id = t.id WHERE t.experiment_id = e.id) as judgments_count
      FROM bws_experiments e
      LEFT JOIN rating_projects rp ON e.rating_project_id = rp.id
      ORDER BY e.created_at DESC
    `);
  }

  /**
   * Get BWS experiment by ID
   */
  async getBWSExperiment(experimentId) {
    return await this.get(`
      SELECT
        e.*,
        rp.project_name as rating_project_name,
        rp.collection_id,
        (SELECT COUNT(*) FROM bws_tuples WHERE experiment_id = e.id) as tuples_generated,
        (SELECT COUNT(*) FROM bws_judgments j JOIN bws_tuples t ON j.tuple_id = t.id WHERE t.experiment_id = e.id) as judgments_count
      FROM bws_experiments e
      LEFT JOIN rating_projects rp ON e.rating_project_id = rp.id
      WHERE e.id = ?
    `, [experimentId]);
  }

  /**
   * Update BWS experiment
   */
  async updateBWSExperiment(experimentId, updates) {
    const allowedFields = ['name', 'status', 'total_cost', 'completed_at'];
    const fields = Object.keys(updates).filter(k => allowedFields.includes(k));

    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);

    await this.run(
      `UPDATE bws_experiments SET ${setClause} WHERE id = ?`,
      [...values, experimentId]
    );
  }

  /**
   * Save generated tuples for an experiment
   */
  async saveBWSTuples(experimentId, tuples) {
    const sql = `
      INSERT INTO bws_tuples (experiment_id, tuple_index, item_ids)
      VALUES (?, ?, ?)
    `;

    for (let i = 0; i < tuples.length; i++) {
      const itemIds = JSON.stringify(tuples[i]);
      await this.run(sql, [experimentId, i, itemIds]);
    }

    return tuples.length;
  }

  /**
   * Get tuples for an experiment
   */
  async getBWSTuples(experimentId) {
    const rows = await this.all(`
      SELECT * FROM bws_tuples
      WHERE experiment_id = ?
      ORDER BY tuple_index
    `, [experimentId]);

    // Parse JSON item_ids
    return rows.map(row => ({
      ...row,
      item_ids: JSON.parse(row.item_ids)
    }));
  }

  /**
   * Get a specific tuple with its items
   */
  async getBWSTupleWithItems(tupleId) {
    const tuple = await this.get(`
      SELECT * FROM bws_tuples WHERE id = ?
    `, [tupleId]);

    if (!tuple) return null;

    // CRITICAL FIX: Get experiment type to avoid ID collisions between tables
    const experiment = await this.get(`
      SELECT item_type FROM bws_experiments WHERE id = ?
    `, [tuple.experiment_id]);

    if (!experiment) {
      console.error('[BWS] Experiment not found for tuple', tupleId);
      return null;
    }

    tuple.item_ids = JSON.parse(tuple.item_ids);

    // Fetch items from the CORRECT table based on experiment type
    // This prevents ID collisions (e.g., video_chunks.id=4 vs pdf_excerpts.id=4)
    const items = [];
    for (const itemId of tuple.item_ids) {
      let item = null;

      // Query ONLY the table matching the experiment's item type
      if (experiment.item_type === 'comment') {
        item = await this.get('SELECT *, "comment" as item_type FROM comments WHERE id = ?', [itemId]);
      } else if (experiment.item_type === 'video_chunk') {
        item = await this.get('SELECT *, "video_chunk" as item_type FROM video_chunks WHERE id = ?', [itemId]);
      } else if (experiment.item_type === 'pdf_excerpt') {
        item = await this.get(`
          SELECT pe.*, "pdf_excerpt" as item_type, pdf.title as pdf_title, pdf.file_path as pdf_file_path
          FROM pdf_excerpts pe
          JOIN pdfs pdf ON pe.pdf_id = pdf.id
          WHERE pe.id = ?
        `, [itemId]);
      } else {
        console.error('[BWS] Unknown item_type:', experiment.item_type);
      }

      if (item) items.push(item);
    }

    tuple.items = items;
    return tuple;
  }

  /**
   * Get next unrated tuple for a rater
   */
  async getNextBWSTuple(experimentId, raterType, raterId) {
    // Get all tuple IDs for this experiment
    const allTuples = await this.all(`
      SELECT id FROM bws_tuples
      WHERE experiment_id = ?
      ORDER BY tuple_index
    `, [experimentId]);

    // Get tuples already rated by this rater
    const ratedTupleIds = await this.all(`
      SELECT DISTINCT t.id
      FROM bws_tuples t
      JOIN bws_judgments j ON j.tuple_id = t.id
      WHERE t.experiment_id = ? AND j.rater_type = ? AND j.rater_id = ?
    `, [experimentId, raterType, raterId]);

    const ratedIds = new Set(ratedTupleIds.map(r => r.id));
    const unratedTuples = allTuples.filter(t => !ratedIds.has(t.id));

    if (unratedTuples.length === 0) return null;

    // RANDOMIZE: Pick a random unrated tuple instead of always the first one
    const randomIndex = Math.floor(Math.random() * unratedTuples.length);
    const selectedTuple = unratedTuples[randomIndex];

    // Get full tuple with items
    const tuple = await this.getBWSTupleWithItems(selectedTuple.id);

    // RANDOMIZE: Shuffle the items within the tuple so videos appear in different positions
    if (tuple && tuple.items) {
      tuple.items = this.shuffleArray([...tuple.items]);
      // Update item_ids to match shuffled order
      tuple.item_ids = tuple.items.map(item => item.id);
    }

    return tuple;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Save a BWS judgment
   */
  async saveBWSJudgment(judgmentData) {
    const {
      tuple_id,
      rater_type,
      rater_id,
      best_item_id,
      worst_item_id,
      reasoning = null,
      response_time_ms = null
    } = judgmentData;

    // Validate best != worst (except for skip marker where best=-1 and worst=-2)
    const isSkipMarker = (best_item_id === -1 && worst_item_id === -2);
    if (best_item_id === worst_item_id && !isSkipMarker) {
      throw new Error('Best and worst items cannot be the same');
    }

    const result = await this.run(`
      INSERT INTO bws_judgments (
        tuple_id, rater_type, rater_id, best_item_id, worst_item_id,
        reasoning, response_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [tuple_id, rater_type, rater_id, best_item_id, worst_item_id, reasoning, response_time_ms]);

    return result.id;
  }

  /**
   * Get all judgments for an experiment
   */
  async getBWSJudgments(experimentId) {
    return await this.all(`
      SELECT j.*, t.tuple_index, t.item_ids
      FROM bws_judgments j
      JOIN bws_tuples t ON j.tuple_id = t.id
      WHERE t.experiment_id = ?
      ORDER BY j.created_at
    `, [experimentId]);
  }

  /**
   * Get count of judgments for a specific rater (multi-rater support)
   */
  async getRaterJudgmentCount(experimentId, raterId) {
    const result = await this.get(`
      SELECT COUNT(*) as count
      FROM bws_judgments j
      JOIN bws_tuples t ON j.tuple_id = t.id
      WHERE t.experiment_id = ?
        AND j.rater_id = ?
    `, [experimentId, raterId]);

    return result ? result.count : 0;
  }

  /**
   * Calculate counting scores for an experiment
   */
  async calculateBWSCountingScores(experimentId) {
    // Get all judgments
    const judgments = await this.getBWSJudgments(experimentId);

    // Count appearances, best, and worst for each item
    const scores = {};

    for (const judgment of judgments) {
      const itemIds = JSON.parse(judgment.item_ids);

      // Track appearances
      for (const itemId of itemIds) {
        if (!scores[itemId]) {
          scores[itemId] = {
            item_id: itemId,
            num_appearances: 0,
            num_best: 0,
            num_worst: 0
          };
        }
        scores[itemId].num_appearances++;
      }

      // Track best/worst
      if (scores[judgment.best_item_id]) {
        scores[judgment.best_item_id].num_best++;
      }
      if (scores[judgment.worst_item_id]) {
        scores[judgment.worst_item_id].num_worst++;
      }
    }

    // Calculate scores and save
    const items = Object.values(scores);
    for (const item of items) {
      item.score_counting = item.num_best - item.num_worst;
    }

    // Sort by score and assign ranks
    items.sort((a, b) => b.score_counting - a.score_counting);
    items.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Save to database
    await this.saveBWSScores(experimentId, items);

    return items;
  }

  /**
   * Save BWS scores to database
   * @param {number} experimentId - The experiment ID
   * @param {Array} scores - Array of score objects
   * @param {string|null} raterId - Optional rater ID (null = combined)
   */
  async saveBWSScores(experimentId, scores, raterId = null) {
    // Delete existing scores for this experiment and rater combination
    if (raterId) {
      await this.run('DELETE FROM bws_scores WHERE experiment_id = ? AND rater_id = ?', [experimentId, raterId]);
    } else {
      await this.run('DELETE FROM bws_scores WHERE experiment_id = ? AND rater_id IS NULL', [experimentId]);
    }

    // Insert new scores
    const sql = `
      INSERT INTO bws_scores (
        experiment_id, item_id, score_counting, score_bt,
        confidence_interval_lower, confidence_interval_upper,
        num_appearances, num_best, num_worst, rank, rater_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const score of scores) {
      await this.run(sql, [
        experimentId,
        score.item_id,
        score.score_counting,
        score.score_bt || null,
        score.confidence_interval_lower || null,
        score.confidence_interval_upper || null,
        score.num_appearances,
        score.num_best,
        score.num_worst,
        score.rank,
        raterId
      ]);
    }
  }

  /**
   * Extract pairwise comparisons from BWS judgments
   * Returns: { wins: Map<itemPair, count>, totals: Map<itemPair, count> }
   */
  extractPairwiseComparisons(judgments) {
    const wins = new Map();
    const totals = new Map();

    // Helper to create consistent pair key
    const pairKey = (id1, id2) => {
      const [a, b] = id1 < id2 ? [id1, id2] : [id2, id1];
      return `${a}_${b}`;
    };

    for (const judgment of judgments) {
      const itemIds = JSON.parse(judgment.item_ids);
      const bestId = judgment.best_item_id;
      const worstId = judgment.worst_item_id;

      // Extract definite pairwise wins
      // Best beats all others
      for (const otherId of itemIds) {
        if (otherId !== bestId) {
          const key = pairKey(bestId, otherId);
          wins.set(key, (wins.get(key) || 0) + (bestId < otherId ? 1 : 0));
          totals.set(key, (totals.get(key) || 0) + 1);
        }
      }

      // All others beat worst
      for (const otherId of itemIds) {
        if (otherId !== worstId && otherId !== bestId) {
          const key = pairKey(otherId, worstId);
          wins.set(key, (wins.get(key) || 0) + (otherId < worstId ? 1 : 0));
          totals.set(key, (totals.get(key) || 0) + 1);
        }
      }
    }

    return { wins, totals };
  }

  /**
   * Calculate Bradley-Terry scores using iterative algorithm
   * Returns: Map<itemId, { strength, stdError }>
   */
  calculateBradleyTerryScores(itemIds, pairwiseData) {
    const { wins, totals } = pairwiseData;

    // Initialize all items with equal strength
    const strengths = new Map();
    itemIds.forEach(id => strengths.set(id, 1.0));

    // Helper to get win count for item i vs item j
    const getWins = (id1, id2) => {
      const key = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
      const w = wins.get(key) || 0;
      const t = totals.get(key) || 0;
      if (id1 < id2) {
        return w; // id1 wins
      } else {
        return t - w; // id2 wins (total minus id1 wins)
      }
    };

    const getTotalComparisons = (id1, id2) => {
      const key = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
      return totals.get(key) || 0;
    };

    // Iterative algorithm
    const maxIterations = 100;
    const convergenceThreshold = 1e-6;

    for (let iter = 0; iter < maxIterations; iter++) {
      const newStrengths = new Map();
      let maxChange = 0;

      for (const itemId of itemIds) {
        let numerator = 0;
        let denominator = 0;

        // Sum over all opponents
        for (const opponentId of itemIds) {
          if (itemId !== opponentId) {
            const winsAgainst = getWins(itemId, opponentId);
            const totalGames = getTotalComparisons(itemId, opponentId);

            if (totalGames > 0) {
              numerator += winsAgainst;
              denominator += totalGames / (strengths.get(itemId) + strengths.get(opponentId));
            }
          }
        }

        // Update strength (avoid division by zero)
        const newStrength = denominator > 0 ? numerator / denominator : strengths.get(itemId);
        newStrengths.set(itemId, newStrength);

        // Track convergence
        const change = Math.abs(newStrength - strengths.get(itemId));
        maxChange = Math.max(maxChange, change);
      }

      // Update strengths
      for (const [id, strength] of newStrengths) {
        strengths.set(id, strength);
      }

      // Check convergence
      if (maxChange < convergenceThreshold) {
        console.log(`[Bradley-Terry] Converged after ${iter + 1} iterations`);
        break;
      }
    }

    // Normalize scores (scale so sum = number of items)
    const totalStrength = Array.from(strengths.values()).reduce((sum, s) => sum + s, 0);
    const normalizationFactor = itemIds.length / totalStrength;

    for (const [id, strength] of strengths) {
      strengths.set(id, strength * normalizationFactor);
    }

    // Calculate standard errors (simplified approximation)
    const stdErrors = new Map();
    for (const itemId of itemIds) {
      let totalComps = 0;
      for (const opponentId of itemIds) {
        if (itemId !== opponentId) {
          totalComps += getTotalComparisons(itemId, opponentId);
        }
      }

      // Simplified SE: inverse square root of comparisons
      // More comparisons = lower standard error
      const se = totalComps > 0 ? Math.sqrt(1 / totalComps) : 1.0;
      stdErrors.set(itemId, se);
    }

    // Return combined results
    const results = new Map();
    for (const itemId of itemIds) {
      results.set(itemId, {
        strength: strengths.get(itemId),
        stdError: stdErrors.get(itemId)
      });
    }

    return results;
  }

  /**
   * Calculate BWS scores with both counting and Bradley-Terry methods
   * @param {number} experimentId - The experiment ID
   * @param {string|null} raterId - Optional rater ID to filter judgments (null = combined/all raters)
   */
  async calculateBWSScores(experimentId, raterId = null) {
    // Get all judgments
    let judgments = await this.getBWSJudgments(experimentId);

    // Filter by rater if specified
    if (raterId) {
      judgments = judgments.filter(j => j.rater_id === raterId);
    }

    // Filter out skipped judgments (marked with best_item_id = -1 and worst_item_id = -2)
    judgments = judgments.filter(j => !(j.best_item_id === -1 && j.worst_item_id === -2));

    if (judgments.length === 0) {
      throw new Error(`No judgments found for this experiment${raterId ? ` with rater_id=${raterId}` : ''}`);
    }

    console.log(`[calculateBWSScores] Calculating scores for experiment ${experimentId}${raterId ? ` (rater: ${raterId})` : ' (combined)'} with ${judgments.length} judgments`);

    // Count appearances, best, and worst for each item (Counting method)
    const scores = {};

    for (const judgment of judgments) {
      const itemIds = JSON.parse(judgment.item_ids);

      // Track appearances
      for (const itemId of itemIds) {
        if (!scores[itemId]) {
          scores[itemId] = {
            item_id: itemId,
            num_appearances: 0,
            num_best: 0,
            num_worst: 0
          };
        }
        scores[itemId].num_appearances++;
      }

      // Track best/worst
      if (scores[judgment.best_item_id]) {
        scores[judgment.best_item_id].num_best++;
      }
      if (scores[judgment.worst_item_id]) {
        scores[judgment.worst_item_id].num_worst++;
      }
    }

    // Calculate counting scores
    const items = Object.values(scores);
    for (const item of items) {
      item.score_counting = item.num_best - item.num_worst;
    }

    // Calculate Bradley-Terry scores
    const itemIds = items.map(item => item.item_id);
    const pairwiseData = this.extractPairwiseComparisons(judgments);
    const btResults = this.calculateBradleyTerryScores(itemIds, pairwiseData);

    // Merge BT scores with counting scores
    for (const item of items) {
      const btResult = btResults.get(item.item_id);
      if (btResult) {
        item.score_bt = btResult.strength;

        // Calculate 95% confidence interval (1.96 * SE)
        const margin = 1.96 * btResult.stdError;
        item.confidence_interval_lower = btResult.strength - margin;
        item.confidence_interval_upper = btResult.strength + margin;
      }
    }

    // Sort by Bradley-Terry score (fallback to counting if BT not available)
    items.sort((a, b) => {
      const scoreA = a.score_bt !== undefined ? a.score_bt : a.score_counting;
      const scoreB = b.score_bt !== undefined ? b.score_bt : b.score_counting;
      return scoreB - scoreA;
    });

    // Assign ranks
    items.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Save to database with rater_id
    await this.saveBWSScores(experimentId, items, raterId);

    console.log(`[calculateBWSScores] Saved ${items.length} scores for ${raterId || 'combined'}`);

    return items;
  }

  /**
   * Get scores for an experiment
   * @param {number} experimentId - The experiment ID
   * @param {string|null} raterId - Optional rater ID to filter ('combined', 'gemini-2.5-flash', 'human-user', or null for combined)
   */
  async getBWSScores(experimentId, raterId = 'combined') {
    // Convert 'combined' string to NULL for database query
    const raterFilter = raterId === 'combined' ? null : raterId;

    return await this.all(`
      SELECT
        s.*,
        c.text as comment_text,
        c.author_name,
        c.like_count,
        vc.transcript_text as chunk_text,
        vc.start_time,
        vc.end_time,
        vc.file_path as chunk_file_path,
        vc.video_id
      FROM bws_scores s
      LEFT JOIN comments c ON s.item_id = c.id
      LEFT JOIN video_chunks vc ON s.item_id = vc.id
      WHERE s.experiment_id = ?
        AND (? IS NULL AND s.rater_id IS NULL OR s.rater_id = ?)
      ORDER BY s.rank
    `, [experimentId, raterFilter, raterFilter]);
  }

  /**
   * Get BWS experiment statistics
   */
  async getBWSExperimentStats(experimentId) {
    const exp = await this.getBWSExperiment(experimentId);
    const tuples = await this.getBWSTuples(experimentId);
    const judgments = await this.getBWSJudgments(experimentId);

    const totalTuples = tuples.length;
    const totalJudgments = judgments.length;
    const progress = totalTuples > 0 ? (totalJudgments / totalTuples) * 100 : 0;

    // Count by rater type
    const aiJudgments = judgments.filter(j => j.rater_type === 'ai').length;
    const humanJudgments = judgments.filter(j => j.rater_type === 'human').length;

    return {
      ...exp,
      total_tuples: totalTuples,
      total_judgments: totalJudgments,
      progress_percentage: Math.round(progress),
      ai_judgments: aiJudgments,
      human_judgments: humanJudgments,
      is_complete: totalJudgments >= totalTuples
    };
  }

  /**
   * Delete BWS experiment (cascades to tuples, judgments, scores)
   */
  async deleteBWSExperiment(experimentId) {
    await this.run('DELETE FROM bws_experiments WHERE id = ?', [experimentId]);
  }

  // ========================================
  // Collection Merge Methods
  // ========================================

  /**
   * Create a new merged collection
   * @param {string} name - Name for the merged collection
   * @param {Array<number>} collectionIds - Array of collection IDs to merge
   * @param {Object} options - Optional settings
   * @returns {number} The merge ID
   */
  async createMerge(name, collectionIds, options = {}) {
    const { description = '', settings = {} } = options;

    // Validate that all collections exist
    for (const collectionId of collectionIds) {
      const collection = await this.get('SELECT id FROM collections WHERE id = ?', [collectionId]);
      if (!collection) {
        throw new Error(`Collection ${collectionId} not found`);
      }
    }

    // Create the merge
    const result = await this.run(`
      INSERT INTO collection_merges (name, description, settings)
      VALUES (?, ?, ?)
    `, [name, description, JSON.stringify(settings)]);

    const mergeId = result.id;

    // Add all source collections
    for (const collectionId of collectionIds) {
      await this.run(`
        INSERT INTO collection_merge_members (merge_id, source_collection_id)
        VALUES (?, ?)
      `, [mergeId, collectionId]);
    }

    console.log(`[Database] Created merge "${name}" (ID: ${mergeId}) with ${collectionIds.length} collections`);
    return mergeId;
  }

  /**
   * Get all merges
   * @returns {Array} List of merge objects with statistics
   */
  async getAllMerges() {
    const merges = await this.all(`
      SELECT
        m.*,
        COUNT(DISTINCT cmm.source_collection_id) as collection_count
      FROM collection_merges m
      LEFT JOIN collection_merge_members cmm ON m.id = cmm.merge_id
      WHERE m.is_active = 1
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `);

    // Get source collections for each merge
    for (const merge of merges) {
      merge.source_collections = await this.getMergeMembers(merge.id);
      merge.settings = merge.settings ? JSON.parse(merge.settings) : {};
    }

    return merges;
  }

  /**
   * Get a specific merge with full details
   * @param {number} mergeId - The merge ID
   * @returns {Object} Merge object with source collections
   */
  async getMerge(mergeId) {
    const merge = await this.get(`
      SELECT * FROM collection_merges WHERE id = ? AND is_active = 1
    `, [mergeId]);

    if (!merge) return null;

    // Get source collections
    merge.source_collections = await this.getMergeMembers(mergeId);
    merge.settings = merge.settings ? JSON.parse(merge.settings) : {};

    return merge;
  }

  /**
   * Get member collections of a merge
   * @param {number} mergeId - The merge ID
   * @returns {Array} List of source collections
   */
  async getMergeMembers(mergeId) {
    return await this.all(`
      SELECT
        c.*,
        cmm.added_at as merged_at,
        cmm.weight,
        cmm.notes
      FROM collection_merge_members cmm
      JOIN collections c ON cmm.source_collection_id = c.id
      WHERE cmm.merge_id = ?
      ORDER BY cmm.added_at ASC
    `, [mergeId]);
  }

  /**
   * Add a collection to an existing merge
   * @param {number} mergeId - The merge ID
   * @param {number} collectionId - Collection to add
   */
  async addCollectionToMerge(mergeId, collectionId) {
    // Check if already exists
    const existing = await this.get(`
      SELECT id FROM collection_merge_members
      WHERE merge_id = ? AND source_collection_id = ?
    `, [mergeId, collectionId]);

    if (existing) {
      throw new Error('Collection already in this merge');
    }

    await this.run(`
      INSERT INTO collection_merge_members (merge_id, source_collection_id)
      VALUES (?, ?)
    `, [mergeId, collectionId]);

    // Update merge timestamp
    await this.run(`
      UPDATE collection_merges SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [mergeId]);

    console.log(`[Database] Added collection ${collectionId} to merge ${mergeId}`);
  }

  /**
   * Remove a collection from a merge
   * @param {number} mergeId - The merge ID
   * @param {number} collectionId - Collection to remove
   */
  async removeCollectionFromMerge(mergeId, collectionId) {
    await this.run(`
      DELETE FROM collection_merge_members
      WHERE merge_id = ? AND source_collection_id = ?
    `, [mergeId, collectionId]);

    // Update merge timestamp
    await this.run(`
      UPDATE collection_merges SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [mergeId]);

    console.log(`[Database] Removed collection ${collectionId} from merge ${mergeId}`);
  }

  /**
   * Get all videos in a merged collection (with deduplication)
   * @param {number} mergeId - The merge ID
   * @returns {Array} List of videos with source collection info
   */
  async getMergeVideos(mergeId) {
    return await this.all(`
      SELECT DISTINCT
        v.*,
        c.search_term as source_collection_name,
        c.id as source_collection_id
      FROM videos v
      JOIN collection_merge_members cmm ON v.collection_id = cmm.source_collection_id
      JOIN collections c ON c.id = v.collection_id
      WHERE cmm.merge_id = ?
      ORDER BY v.collected_at DESC
    `, [mergeId]);
  }

  /**
   * Get all comments in a merged collection
   * @param {number} mergeId - The merge ID
   * @returns {Array} List of comments with source info
   */
  async getMergeComments(mergeId) {
    return await this.all(`
      SELECT
        co.*,
        c.search_term as source_collection_name,
        c.id as source_collection_id,
        v.title as video_title
      FROM comments co
      JOIN collection_merge_members cmm ON co.collection_id = cmm.source_collection_id
      JOIN collections c ON c.id = co.collection_id
      JOIN videos v ON co.video_id = v.id
      WHERE cmm.merge_id = ?
      ORDER BY co.published_at DESC
    `, [mergeId]);
  }

  /**
   * Get all video chunks in a merged collection
   * @param {number} mergeId - The merge ID
   * @returns {Array} List of video chunks
   */
  async getMergeVideoChunks(mergeId) {
    return await this.all(`
      SELECT
        vc.*,
        c.search_term as source_collection_name,
        c.id as source_collection_id,
        v.title as video_title
      FROM video_chunks vc
      JOIN collection_merge_members cmm ON vc.collection_id = cmm.source_collection_id
      JOIN collections c ON c.id = vc.collection_id
      JOIN videos v ON vc.video_id = v.id
      WHERE cmm.merge_id = ?
      ORDER BY vc.created_at DESC
    `, [mergeId]);
  }

  /**
   * Get all PDF excerpts in a merged collection
   * @param {number} mergeId - The merge ID
   * @returns {Array} List of PDF excerpts with source info
   */
  async getMergePDFExcerpts(mergeId) {
    return await this.all(`
      SELECT
        pe.*,
        c.search_term as source_collection_name,
        c.id as source_collection_id,
        p.title as pdf_title,
        p.file_path as pdf_file_path
      FROM pdf_excerpts pe
      JOIN collection_merge_members cmm ON pe.collection_id = cmm.source_collection_id
      JOIN collections c ON c.id = pe.collection_id
      JOIN pdfs p ON pe.pdf_id = p.id
      WHERE cmm.merge_id = ?
      ORDER BY pe.created_at DESC
    `, [mergeId]);
  }

  /**
   * Get all PDFs in a merged collection (grouped by PDF file)
   * @param {number} mergeId - The merge ID
   * @returns {Array} List of PDFs with excerpt counts
   */
  async getMergePDFs(mergeId) {
    return await this.all(`
      SELECT DISTINCT
        p.*,
        c.search_term as source_collection_name,
        c.id as source_collection_id,
        (SELECT COUNT(*) FROM pdf_excerpts WHERE pdf_id = p.id) as excerpts_count
      FROM pdfs p
      JOIN collection_merge_members cmm ON p.collection_id = cmm.source_collection_id
      JOIN collections c ON c.id = p.collection_id
      WHERE cmm.merge_id = ?
      ORDER BY p.created_at DESC
    `, [mergeId]);
  }

  /**
   * Get statistics for a merged collection
   * @param {number} mergeId - The merge ID
   * @returns {Object} Statistics object
   */
  async getMergeStatistics(mergeId) {
    const videos = await this.getMergeVideos(mergeId);
    const comments = await this.getMergeComments(mergeId);
    const chunks = await this.getMergeVideoChunks(mergeId);
    const members = await this.getMergeMembers(mergeId);

    // Count unique vs total
    const videoIds = videos.map(v => v.id);
    const uniqueVideos = new Set(videoIds).size;

    return {
      total_collections: members.length,
      total_videos: videos.length,
      unique_videos: uniqueVideos,
      duplicate_videos: videos.length - uniqueVideos,
      total_comments: comments.length,
      total_chunks: chunks.length,
      source_collections: members.map(m => ({
        id: m.id,
        name: m.search_term,
        video_count: m.video_count,
        comment_count: m.comment_count
      }))
    };
  }

  /**
   * Delete a merge (soft delete by default)
   * @param {number} mergeId - The merge ID
   * @param {boolean} hard - If true, permanently delete
   */
  async deleteMerge(mergeId, hard = false) {
    if (hard) {
      // Hard delete (cascade will remove members)
      await this.run('DELETE FROM collection_merges WHERE id = ?', [mergeId]);
      console.log(`[Database] Hard deleted merge ${mergeId}`);
    } else {
      // Soft delete
      await this.run('UPDATE collection_merges SET is_active = 0 WHERE id = ?', [mergeId]);
      console.log(`[Database] Soft deleted merge ${mergeId}`);
    }
  }

  /**
   * Update merge metadata
   * @param {number} mergeId - The merge ID
   * @param {Object} updates - Fields to update
   */
  async updateMerge(mergeId, updates) {
    const allowedFields = ['name', 'description', 'settings'];
    const fields = Object.keys(updates).filter(k => allowedFields.includes(k));

    if (fields.length === 0) return;

    const setClause = fields.map(f => {
      if (f === 'settings') return `${f} = ?`;
      return `${f} = ?`;
    }).join(', ');

    const values = fields.map(f => {
      if (f === 'settings') return JSON.stringify(updates[f]);
      return updates[f];
    });

    await this.run(`
      UPDATE collection_merges
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [...values, mergeId]);

    console.log(`[Database] Updated merge ${mergeId}`);
  }

  // ============================================
  // RATING VARIABLES METHODS
  // ============================================

  /**
   * Create a new rating variable for a collection
   */
  async createRatingVariable(variableData) {
    const { collection_id, label, definition, scale_type, anchors, reasoning_depth } = variableData;

    const result = await this.run(`
      INSERT INTO rating_variables (
        collection_id, label, definition, scale_type, anchors, reasoning_depth
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      collection_id,
      label,
      definition || null,
      scale_type,
      JSON.stringify(anchors || {}),
      reasoning_depth || 'brief'
    ]);

    return result.id;
  }

  /**
   * Get all rating variables for a collection
   */
  async getRatingVariables(collectionId) {
    const variables = await this.all(`
      SELECT * FROM rating_variables
      WHERE collection_id = ?
      ORDER BY created_at DESC
    `, [collectionId]);

    // Parse anchors JSON
    return variables.map(v => ({
      ...v,
      anchors: v.anchors ? JSON.parse(v.anchors) : {}
    }));
  }

  /**
   * Get a specific rating variable
   */
  async getRatingVariable(variableId) {
    const variable = await this.get(`
      SELECT * FROM rating_variables WHERE id = ?
    `, [variableId]);

    if (variable && variable.anchors) {
      variable.anchors = JSON.parse(variable.anchors);
    }

    return variable;
  }

  /**
   * Update a rating variable
   */
  async updateRatingVariable(variableId, updates) {
    const allowedFields = ['label', 'definition', 'scale_type', 'anchors', 'reasoning_depth'];
    const fields = Object.keys(updates).filter(k => allowedFields.includes(k));

    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => {
      if (f === 'anchors') return JSON.stringify(updates[f]);
      return updates[f];
    });

    await this.run(`
      UPDATE rating_variables SET ${setClause} WHERE id = ?
    `, [...values, variableId]);
  }

  /**
   * Delete a rating variable
   */
  async deleteRatingVariable(variableId) {
    await this.run('DELETE FROM rating_variables WHERE id = ?', [variableId]);
  }

  // ============================================
  // AI EXCERPT RATINGS METHODS
  // ============================================

  /**
   * Save a new AI excerpt rating (allows multiple ratings for history)
   */
  async saveAIExcerptRating(ratingData) {
    const { excerpt_id, variable_id, score, reasoning } = ratingData;

    const result = await this.run(`
      INSERT INTO ai_excerpt_ratings (
        excerpt_id, variable_id, score, reasoning, created_at, updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [excerpt_id, variable_id, score, reasoning || null]);

    return result.id;
  }

  /**
   * Get latest AI rating for a specific excerpt and variable
   */
  async getAIExcerptRating(excerptId, variableId) {
    return await this.get(`
      SELECT *
      FROM ai_excerpt_ratings
      WHERE excerpt_id = ? AND variable_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [excerptId, variableId]);
  }

  /**
   * Get all AI ratings for a specific excerpt and variable (history)
   */
  async getAIExcerptRatingHistory(excerptId, variableId) {
    return await this.all(`
      SELECT *
      FROM ai_excerpt_ratings
      WHERE excerpt_id = ? AND variable_id = ?
      ORDER BY created_at DESC
    `, [excerptId, variableId]);
  }

  /**
   * Get all AI ratings for a PDF's excerpts
   */
  async getAIRatingsForPDF(pdfId, variableId) {
    return await this.all(`
      SELECT air.*
      FROM ai_excerpt_ratings air
      JOIN pdf_excerpts pe ON air.excerpt_id = pe.id
      WHERE pe.pdf_id = ? AND air.variable_id = ?
    `, [pdfId, variableId]);
  }

  /**
   * Count how many excerpts have AI ratings for a PDF and variable
   */
  async countAIRatingsForPDF(pdfId, variableId) {
    const result = await this.get(`
      SELECT COUNT(DISTINCT air.excerpt_id) as count
      FROM ai_excerpt_ratings air
      JOIN pdf_excerpts pe ON air.excerpt_id = pe.id
      WHERE pe.pdf_id = ? AND air.variable_id = ?
    `, [pdfId, variableId]);

    return result ? result.count : 0;
  }

  /**
   * Count how many excerpts have human ratings for a PDF and variable
   */
  async countHumanRatingsForPDF(pdfId, variableId) {
    const result = await this.get(`
      SELECT COUNT(DISTINCT er.excerpt_id) as count
      FROM excerpt_ratings er
      JOIN pdf_excerpts pe ON er.excerpt_id = pe.id
      WHERE pe.pdf_id = ? AND er.variable_id = ?
    `, [pdfId, variableId]);

    return result ? result.count : 0;
  }

  // ============================================
  // GLOBAL RATING VARIABLES METHODS
  // ============================================

  /**
   * Create a new global rating variable
   */
  async createGlobalRatingVariable(variableData) {
    const { label, genre, definition, variable_type, scale_type, anchors, reasoning_depth } = variableData;

    const result = await this.run(`
      INSERT INTO global_rating_variables (
        label, genre, definition, variable_type, scale_type, anchors, reasoning_depth
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      label,
      genre,
      definition,
      variable_type || 'rating',  // Default to 'rating' for backward compatibility
      scale_type,
      JSON.stringify(anchors),
      reasoning_depth
    ]);

    return result.lastID;
  }

  /**
   * Get all global rating variables
   */
  async getGlobalRatingVariables() {
    const variables = await this.all(`
      SELECT * FROM global_rating_variables
      ORDER BY created_at DESC
    `);

    // Parse JSON anchors
    return variables.map(v => ({
      ...v,
      anchors: v.anchors ? JSON.parse(v.anchors) : {}
    }));
  }

  /**
   * Get global rating variables by genre
   */
  async getGlobalRatingVariablesByGenre(genre) {
    const variables = await this.all(`
      SELECT * FROM global_rating_variables
      WHERE genre = ? OR genre = 'both'
      ORDER BY created_at DESC
    `, [genre]);

    // Parse JSON anchors
    return variables.map(v => ({
      ...v,
      anchors: v.anchors ? JSON.parse(v.anchors) : {}
    }));
  }

  /**
   * Delete a global rating variable
   */
  async deleteGlobalRatingVariable(variableId) {
    await this.run('DELETE FROM global_rating_variables WHERE id = ?', [variableId]);
  }

  // ============================================
  // EXCERPT RATINGS METHODS
  // ============================================

  /**
   * Save or update an excerpt rating
   */
  async saveExcerptRating(ratingData) {
    const { excerpt_id, variable_id, score, reasoning, reasoning_depth } = ratingData;

    const result = await this.run(`
      INSERT INTO excerpt_ratings (
        excerpt_id, variable_id, score, reasoning, reasoning_depth, updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(excerpt_id, variable_id)
      DO UPDATE SET
        score = excluded.score,
        reasoning = excluded.reasoning,
        reasoning_depth = excluded.reasoning_depth,
        updated_at = CURRENT_TIMESTAMP
    `, [excerpt_id, variable_id, score, reasoning || null, reasoning_depth || 'brief']);

    return result.id;
  }

  /**
   * Get ratings for a specific excerpt
   * Handles both collection-specific and global variables
   */
  async getExcerptRatings(excerptId) {
    // Get all ratings and join with appropriate variable table
    const ratings = await this.all(`
      SELECT
        er.*,
        COALESCE(grv.label, rv.label) as variable_label,
        COALESCE(grv.scale_type, rv.scale_type) as scale_type,
        COALESCE(grv.anchors, rv.anchors) as anchors
      FROM excerpt_ratings er
      LEFT JOIN global_rating_variables grv ON er.variable_id = grv.id
      LEFT JOIN rating_variables rv ON er.variable_id = rv.id
      WHERE er.excerpt_id = ?
      ORDER BY er.created_at DESC
    `, [excerptId]);

    // Parse anchors JSON for each rating
    return ratings.map(r => ({
      ...r,
      anchors: r.anchors ? JSON.parse(r.anchors) : {}
    }));
  }

  /**
   * Get rating for a specific excerpt and variable
   * Handles both collection-specific and global variables
   */
  async getExcerptRating(excerptId, variableId) {
    // Try global variables first (most common case for PDF viewer)
    let rating = await this.get(`
      SELECT
        er.*,
        grv.label as variable_label,
        grv.scale_type,
        grv.anchors
      FROM excerpt_ratings er
      JOIN global_rating_variables grv ON er.variable_id = grv.id
      WHERE er.excerpt_id = ? AND er.variable_id = ?
    `, [excerptId, variableId]);

    // If not found, try collection-specific variables
    if (!rating) {
      rating = await this.get(`
        SELECT
          er.*,
          rv.label as variable_label,
          rv.scale_type,
          rv.anchors
        FROM excerpt_ratings er
        JOIN rating_variables rv ON er.variable_id = rv.id
        WHERE er.excerpt_id = ? AND er.variable_id = ?
      `, [excerptId, variableId]);
    }

    if (rating && rating.anchors) {
      rating.anchors = JSON.parse(rating.anchors);
    }

    return rating;
  }

  /**
   * Get all ratings for a variable across all excerpts
   */
  async getRatingsByVariable(variableId) {
    return await this.all(`
      SELECT
        er.*,
        pe.text_content as excerpt_text,
        pe.page_number,
        pdf.title as pdf_title
      FROM excerpt_ratings er
      JOIN pdf_excerpts pe ON er.excerpt_id = pe.id
      JOIN pdfs pdf ON pe.pdf_id = pdf.id
      WHERE er.variable_id = ?
      ORDER BY er.created_at DESC
    `, [variableId]);
  }

  /**
   * Delete an excerpt rating
   */
  async deleteExcerptRating(excerptId, variableId) {
    await this.run(`
      DELETE FROM excerpt_ratings
      WHERE excerpt_id = ? AND variable_id = ?
    `, [excerptId, variableId]);
  }

  /**
   * Get rating statistics for a variable
   */
  async getVariableRatingStats(variableId) {
    return await this.get(`
      SELECT
        COUNT(*) as total_ratings,
        AVG(score) as avg_score,
        MIN(score) as min_score,
        MAX(score) as max_score,
        COUNT(DISTINCT excerpt_id) as total_excerpts_rated
      FROM excerpt_ratings
      WHERE variable_id = ?
    `, [variableId]);
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // ============================================
  // FOLDER MANAGEMENT METHODS
  // ============================================

  /**
   * Create a new folder
   */
  async createFolder(name, parentFolderId, options) {
    return await this.folderManager.createFolder(name, parentFolderId, options);
  }

  /**
   * Get folder by ID
   */
  async getFolder(folderId) {
    return await this.folderManager.getFolder(folderId);
  }

  /**
   * Get folder contents (subfolders + collections)
   */
  async getFolderContents(folderId) {
    return await this.folderManager.getFolderContents(folderId);
  }

  /**
   * Move folder to new parent
   */
  async moveFolder(folderId, newParentId) {
    return await this.folderManager.moveFolder(folderId, newParentId);
  }

  /**
   * Rename folder
   */
  async renameFolder(folderId, newName) {
    return await this.folderManager.renameFolder(folderId, newName);
  }

  /**
   * Delete folder
   */
  async deleteFolder(folderId, cascade) {
    return await this.folderManager.deleteFolder(folderId, cascade);
  }

  /**
   * Get folder path string
   */
  async getFolderPath(folderId) {
    return await this.folderManager.getFolderPath(folderId);
  }

  /**
   * Get folder lineage
   */
  async getFolderLineage(folderId) {
    return await this.folderManager.getFolderLineage(folderId);
  }

  /**
   * Archive/unarchive folder
   */
  async archiveFolder(folderId, archived) {
    return await this.folderManager.archiveFolder(folderId, archived);
  }

  // ============================================
  // COLLECTION ORGANIZATION METHODS
  // ============================================

  /**
   * Move collection to folder
   */
  async moveCollectionToFolder(collectionId, folderId) {
    await this.run(
      'UPDATE collections SET folder_id = ? WHERE id = ?',
      [folderId, collectionId]
    );

    // Update folder metadata
    if (folderId) {
      await this.folderManager.updateFolderMetadata(folderId);
    }
  }

  /**
   * Archive/unarchive collection
   */
  async archiveCollection(collectionId, archived = true) {
    await this.run(
      'UPDATE collections SET archived = ? WHERE id = ?',
      [archived ? 1 : 0, collectionId]
    );
  }

  /**
   * Star/unstar collection
   */
  async starCollection(collectionId, starred = true) {
    await this.run(
      'UPDATE collections SET starred = ? WHERE id = ?',
      [starred ? 1 : 0, collectionId]
    );
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