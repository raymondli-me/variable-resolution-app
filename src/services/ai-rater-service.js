/**
 * AI Rater Service
 *
 * Modern, class-based service for AI rating projects.
 * Provides rich UI feedback through IPC messages and toast notifications.
 *
 * @class AiRaterService
 */

const { app } = require('electron');
const path = require('path');
const GeminiRater = require('./gemini-rater');
const RatingEngine = require('./rating-engine');

class AiRaterService {
  /**
   * Create a new AI Rater Service instance
   * @param {Function} getDatabase - Function that returns the database instance
   * @param {Function} getMainWindow - Function that returns the main window instance
   * @param {Function} getSettings - Function that returns the settings object
   * @param {Function} decrypt - Function to decrypt API keys
   * @param {Function} getRatingEngine - Function that returns the current rating engine
   * @param {Function} setRatingEngine - Function to set the rating engine
   */
  constructor(getDatabase, getMainWindow, getSettings, decrypt, getRatingEngine, setRatingEngine) {
    this.getDatabase = getDatabase;
    this.getMainWindow = getMainWindow;
    this.getSettings = getSettings;
    this.decrypt = decrypt;
    this.getRatingEngine = getRatingEngine;
    this.setRatingEngine = setRatingEngine;
  }

  // ============================================================================
  // UI FEEDBACK METHODS
  // ============================================================================

  /**
   * Send progress update to UI
   */
  sendProgress(data) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('ai:progress', data);
    }
  }

  /**
   * Send error to UI
   */
  sendError(error) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('ai:error', { error });
    }
  }

  /**
   * Send completion notification to UI
   */
  sendComplete(data) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('ai:complete', data);
    }
  }

  /**
   * Send toast notification to UI
   */
  sendToast(type, message, options = {}) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('show-toast', { type, message, options });
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get database instance and ensure it's initialized
   */
  async getDb() {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('../database/db');
    await db.initialize(dbPath);
    return db;
  }

  // ============================================================================
  // PUBLIC METHODS (IPC Handlers)
  // ============================================================================

  /**
   * Get rating projects for a collection
   */
  async getRatingProjects(collectionId) {
    try {
      const db = await this.getDb();
      const projects = await db.getRatingProjects(collectionId);
      return { success: true, data: projects };
    } catch (error) {
      console.error('Error getting rating projects:', error);
      this.sendToast('error', `Failed to get rating projects: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a single rating project
   */
  async getRatingProject(projectId) {
    try {
      const db = await this.getDb();
      const project = await db.getRatingProject(projectId);
      return { success: true, data: project };
    } catch (error) {
      console.error('Error getting rating project:', error);
      this.sendToast('error', `Failed to get rating project: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all rating projects
   */
  async getAllRatingProjects() {
    try {
      const db = await this.getDb();
      const projects = await db.getAllRatingProjects();
      return { success: true, data: projects };
    } catch (error) {
      console.error('Error getting all rating projects:', error);
      this.sendToast('error', `Failed to get all rating projects: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get item counts for a collection
   */
  async getItemCounts(collectionId) {
    try {
      const db = await this.getDb();

      // Check if this is a merged collection
      if (typeof collectionId === 'string' && collectionId.startsWith('merge:')) {
        const mergeId = parseInt(collectionId.replace('merge:', ''));

        // Get counts from all source collections in the merge
        const chunks = await db.all(`
          SELECT COUNT(*) as count
          FROM video_chunks vc
          JOIN collection_merge_members cmm ON vc.collection_id = cmm.source_collection_id
          WHERE cmm.merge_id = ?
        `, [mergeId]);

        const comments = await db.all(`
          SELECT COUNT(*) as count
          FROM comments c
          JOIN collection_merge_members cmm ON c.collection_id = cmm.source_collection_id
          WHERE cmm.merge_id = ?
        `, [mergeId]);

        const pdfs = await db.all(`
          SELECT COUNT(*) as count
          FROM pdf_excerpts pe
          JOIN collection_merge_members cmm ON pe.collection_id = cmm.source_collection_id
          WHERE cmm.merge_id = ?
        `, [mergeId]);

        return {
          success: true,
          data: {
            chunks: chunks[0].count,
            comments: comments[0].count,
            pdfs: pdfs[0].count
          }
        };
      }

      // Regular collection - get chunk, comment, and PDF counts
      const chunks = await db.all(
        'SELECT COUNT(*) as count FROM video_chunks WHERE collection_id = ?',
        [collectionId]
      );
      const comments = await db.all(
        'SELECT COUNT(*) as count FROM comments WHERE collection_id = ?',
        [collectionId]
      );
      const pdfs = await db.all(
        'SELECT COUNT(*) as count FROM pdf_excerpts WHERE collection_id = ?',
        [collectionId]
      );

      return {
        success: true,
        data: {
          chunks: chunks[0].count,
          comments: comments[0].count,
          pdfs: pdfs[0].count
        }
      };
    } catch (error) {
      console.error('Error getting item counts:', error);
      this.sendToast('error', `Failed to get item counts: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get child projects for a parent project
   */
  async getChildProjects(projectId) {
    try {
      const db = await this.getDb();
      const children = await db.getChildProjects(projectId);
      return { success: true, data: children };
    } catch (error) {
      console.error('Error getting child projects:', error);
      this.sendToast('error', `Failed to get child projects: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get project lineage
   */
  async getProjectLineage(projectId) {
    try {
      const db = await this.getDb();
      const lineage = await db.getRatingProjectLineage(projectId);
      return { success: true, data: lineage };
    } catch (error) {
      console.error('Error getting project lineage:', error);
      this.sendToast('error', `Failed to get project lineage: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get filtered item count
   */
  async getFilteredItemCount(parentProjectId, filterCriteria) {
    try {
      const db = await this.getDb();

      const minScore = filterCriteria.min_score || 0.0;
      const maxScore = filterCriteria.max_score || 1.0;
      const allowedTypes = filterCriteria.content_types || ['video_chunk', 'comment'];

      // Count items from parent project that match filter
      const result = await db.get(`
        SELECT COUNT(*) as count
        FROM relevance_ratings
        WHERE project_id = ?
          AND status = 'success'
          AND relevance_score >= ?
          AND relevance_score <= ?
          AND item_type IN (${allowedTypes.map(() => '?').join(',')})
      `, [parentProjectId, minScore, maxScore, ...allowedTypes]);

      return { success: true, data: { count: result.count } };
    } catch (error) {
      console.error('Error getting filtered item count:', error);
      this.sendToast('error', `Failed to get filtered item count: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Preview rating (first 5 items)
   */
  async previewRating(config) {
    try {
      this.sendProgress({
        type: 'info',
        message: 'Starting rating preview...'
      });

      const settings = this.getSettings();
      const geminiKey = settings.apiKeys?.gemini ? this.decrypt(settings.apiKeys.gemini) : null;
      if (!geminiKey) {
        this.sendToast('error', 'Gemini API key not set. Please configure it in settings.');
        return { success: false, error: 'Gemini API key not set' };
      }

      const db = await this.getDb();

      let items;

      // Check if this is a child project preview
      if (config.parentProjectId && config.filterCriteria) {
        console.log('[Preview] Child project - fetching from parent ratings');
        const minScore = config.filterCriteria.min_score || 0.0;
        const maxScore = config.filterCriteria.max_score || 1.0;
        const allowedTypes = config.filterCriteria.content_types || ['video_chunk', 'comment'];

        // Get items from parent's ratings with filters
        const parentRatings = await db.all(`
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
            v.title as video_title,
            v.channel_title
          FROM relevance_ratings r
          LEFT JOIN comments c ON r.item_type = 'comment' AND r.item_id = c.id
          LEFT JOIN video_chunks vc ON r.item_type = 'video_chunk' AND r.item_id = vc.id
          LEFT JOIN videos v ON (c.video_id = v.id OR vc.video_id = v.id)
          WHERE r.project_id = ?
            AND r.status = 'success'
            AND r.relevance_score >= ?
            AND r.relevance_score <= ?
            AND r.item_type IN (${allowedTypes.map(() => '?').join(',')})
          ORDER BY r.relevance_score DESC
        `, [config.parentProjectId, minScore, maxScore, ...allowedTypes]);

        // Convert to items format
        items = [];
        for (const rating of parentRatings) {
          if (rating.item_type === 'video_chunk' && config.includeChunks && rating.chunk_file_path) {
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
              parent_rating_score: rating.relevance_score
            });
          } else if (rating.item_type === 'comment' && config.includeComments && rating.comment_text) {
            items.push({
              type: 'comment',
              id: rating.item_id,
              text: rating.comment_text,
              author_name: rating.comment_author,
              like_count: rating.comment_likes,
              video_id: rating.comment_video_id,
              video_title: rating.video_title,
              parent_rating_score: rating.relevance_score
            });
          }
        }

        console.log(`[Preview] Found ${items.length} filtered items from parent`);
      } else {
        // Root project - fetch from collection
        items = await db.getItemsForRating(
          config.collectionId,
          config.includeChunks,
          config.includeComments
        );
      }

      // Take first 5
      const previewItems = items.slice(0, 5);
      const geminiRater = new GeminiRater(geminiKey);

      const previews = [];
      for (const item of previewItems) {
        try {
          let result;
          if (item.type === 'video_chunk') {
            result = await geminiRater.rateComment(
              item.transcript_text || 'No transcript',
              { title: item.video_title },
              config.researchIntent,
              config.ratingScale
            );
          } else {
            result = await geminiRater.rateComment(
              item.text,
              { title: item.video_title },
              config.researchIntent,
              config.ratingScale
            );
          }
          previews.push({
            item: {
              type: item.type,
              content: item.type === 'comment' ? item.text : item.transcript_text,
              title: item.video_title
            },
            rating: result
          });
        } catch (error) {
          previews.push({
            item: {
              type: item.type,
              content: item.type === 'comment' ? item.text : item.transcript_text
            },
            error: error.message
          });
        }
      }

      this.sendProgress({
        type: 'success',
        message: `Preview complete: ${previews.length} items rated`
      });

      return { success: true, previews, totalItems: items.length };
    } catch (error) {
      console.error('Preview error:', error);
      this.sendToast('error', `Preview failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start rating project
   */
  async startRating(config) {
    try {
      this.sendProgress({
        type: 'info',
        message: 'Initializing AI rating service...'
      });

      // Get Gemini API key
      const settings = this.getSettings();
      const geminiKey = settings.apiKeys?.gemini ? this.decrypt(settings.apiKeys.gemini) : null;
      if (!geminiKey) {
        this.sendToast('error', 'Gemini API key not set. Please configure it in settings.');
        return { success: false, error: 'Gemini API key not set. Please configure it in settings.' };
      }

      // Initialize services
      const db = await this.getDb();
      const geminiRater = new GeminiRater(geminiKey);

      // Create and start rating engine (pass mainWindow for PDF image generation)
      const mainWindow = this.getMainWindow();
      const ratingEngine = new RatingEngine(db, geminiRater, mainWindow);
      this.setRatingEngine(ratingEngine);

      // Setup event listeners with rich UI feedback
      ratingEngine.on('progress', (data) => {
        this.sendProgress(data);
      });

      ratingEngine.on('item-rated', (data) => {
        mainWindow.webContents.send('ai:item-rated', data);
      });

      ratingEngine.on('complete', (data) => {
        this.sendComplete(data);
        this.sendToast('success', `Rating project completed! Rated ${data.totalItems || 0} items`, {
          duration: 5000
        });
      });

      ratingEngine.on('error', (data) => {
        this.sendError(data);
        this.sendToast('error', `Rating error: ${data.error || 'Unknown error'}`, {
          duration: 8000
        });
      });

      // Start rating
      this.sendProgress({
        type: 'info',
        message: 'Starting rating project...'
      });

      this.sendToast('info', 'AI rating project started');

      ratingEngine.startRatingProject(config);

      return { success: true };
    } catch (error) {
      console.error('Error starting rating:', error);
      this.sendToast('error', `Failed to start rating: ${error.message}`, { duration: 8000 });
      return { success: false, error: error.message };
    }
  }

  /**
   * Pause rating
   */
  async pauseRating() {
    const ratingEngine = this.getRatingEngine();
    if (ratingEngine) {
      ratingEngine.pause();
      this.sendToast('info', 'Rating paused');
      return { success: true };
    }
    this.sendToast('warning', 'No rating in progress');
    return { success: false, error: 'No rating in progress' };
  }

  /**
   * Resume rating
   */
  async resumeRating() {
    const ratingEngine = this.getRatingEngine();
    if (ratingEngine) {
      ratingEngine.resume();
      this.sendToast('info', 'Rating resumed');
      return { success: true };
    }
    this.sendToast('warning', 'No rating to resume');
    return { success: false, error: 'No rating to resume' };
  }

  /**
   * Cancel rating
   */
  async cancelRating() {
    const ratingEngine = this.getRatingEngine();
    if (ratingEngine) {
      ratingEngine.cancel();
      this.sendToast('info', 'Rating cancelled');
      return { success: true };
    }
    this.sendToast('warning', 'No rating to cancel');
    return { success: false, error: 'No rating to cancel' };
  }

  /**
   * Export ratings for a project
   */
  async exportRatings(projectId) {
    try {
      this.sendProgress({
        type: 'info',
        message: 'Exporting ratings...'
      });

      const db = await this.getDb();
      const project = await db.getRatingProject(projectId);
      const ratings = await db.getRatingsForProject(projectId);

      const exportData = {
        project,
        ratings,
        exported_at: new Date().toISOString()
      };

      // Save to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `ratings_${project.project_name.replace(/\s+/g, '_')}_${timestamp}.json`;
      const outputPath = path.join(app.getPath('downloads'), filename);

      require('fs').writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

      this.sendProgress({
        type: 'success',
        message: `Ratings exported to: ${outputPath}`
      });

      this.sendToast('success', `Ratings exported successfully`);

      return { success: true, path: outputPath };
    } catch (error) {
      console.error('Error exporting ratings:', error);
      this.sendToast('error', `Export failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test Gemini connection
   */
  async testGeminiConnection() {
    try {
      const settings = this.getSettings();
      const geminiKey = settings.apiKeys?.gemini ? this.decrypt(settings.apiKeys.gemini) : null;
      if (!geminiKey) {
        this.sendToast('error', 'Gemini API key not set');
        return { success: false, error: 'Gemini API key not set' };
      }

      const geminiRater = new GeminiRater(geminiKey);
      const result = await geminiRater.testConnection();

      if (result.success) {
        this.sendToast('success', 'Gemini connection successful');
      } else {
        this.sendToast('error', `Gemini connection failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.sendToast('error', `Connection test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get ratings for a project
   */
  async getRatingsForProject(projectId) {
    try {
      const db = await this.getDb();
      const ratings = await db.getRatingsForProject(projectId);
      return { success: true, ratings };
    } catch (error) {
      console.error('Error getting ratings for project:', error);
      this.sendToast('error', `Failed to get ratings: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { AiRaterService };
