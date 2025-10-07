const { ipcMain, app } = require('electron');
const path = require('path');
const GeminiRater = require('../services/gemini-rater');
const RatingEngine = require('../services/rating-engine');

function registerAIHandlers(getDatabase, getMainWindow, getSettings, decrypt, getRatingEngine, setRatingEngine) {
  // AI Analysis IPC Handlers
  ipcMain.handle('ai:getRatingProjects', async (event, { collectionId }) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

      const projects = await db.getRatingProjects(collectionId);
      return { success: true, data: projects };
    } catch (error) {
      console.error('Error getting rating projects:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:getRatingProject', async (event, { projectId }) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

      const project = await db.getRatingProject(projectId);
      return { success: true, data: project };
    } catch (error) {
      console.error('Error getting rating project:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:getAllRatingProjects', async () => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

      const projects = await db.getAllRatingProjects();
      return { success: true, data: projects };
    } catch (error) {
      console.error('Error getting all rating projects:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:getItemCounts', async (event, { collectionId }) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

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
      return { success: false, error: error.message };
    }
  });

  // Hierarchical rating project IPC handlers
  ipcMain.handle('ai:getChildProjects', async (event, { projectId }) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

      const children = await db.getChildProjects(projectId);
      return { success: true, data: children };
    } catch (error) {
      console.error('Error getting child projects:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:getProjectLineage', async (event, { projectId }) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

      const lineage = await db.getRatingProjectLineage(projectId);
      return { success: true, data: lineage };
    } catch (error) {
      console.error('Error getting project lineage:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:getFilteredItemCount', async (event, { parentProjectId, filterCriteria }) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

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
      return { success: false, error: error.message };
    }
  });

  // Preview rating (first 5 items)
  ipcMain.handle('ai:previewRating', async (event, config) => {
    try {
      const settings = getSettings();
      const geminiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;
      if (!geminiKey) {
        return { success: false, error: 'Gemini API key not set' };
      }

      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

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

      return { success: true, previews, totalItems: items.length };
    } catch (error) {
      console.error('Preview error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:startRating', async (event, config) => {
    try {
      // Get Gemini API key
      const settings = getSettings();
      const geminiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;
      if (!geminiKey) {
        return { success: false, error: 'Gemini API key not set. Please configure it in settings.' };
      }

      // Initialize services
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

      const geminiRater = new GeminiRater(geminiKey);

      // Create and start rating engine (pass mainWindow for PDF image generation)
      const mainWindow = getMainWindow();
      const ratingEngine = new RatingEngine(db, geminiRater, mainWindow);
      setRatingEngine(ratingEngine);

      // Setup event listeners
      ratingEngine.on('progress', (data) => {
        mainWindow.webContents.send('ai:progress', data);
      });

      ratingEngine.on('item-rated', (data) => {
        mainWindow.webContents.send('ai:item-rated', data);
      });

      ratingEngine.on('complete', (data) => {
        mainWindow.webContents.send('ai:complete', data);
      });

      ratingEngine.on('error', (data) => {
        mainWindow.webContents.send('ai:error', data);
      });

      // Start rating
      ratingEngine.startRatingProject(config);

      return { success: true };
    } catch (error) {
      console.error('Error starting rating:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:pauseRating', async () => {
    const ratingEngine = getRatingEngine();
    if (ratingEngine) {
      ratingEngine.pause();
      return { success: true };
    }
    return { success: false, error: 'No rating in progress' };
  });

  ipcMain.handle('ai:resumeRating', async () => {
    const ratingEngine = getRatingEngine();
    if (ratingEngine) {
      ratingEngine.resume();
      return { success: true };
    }
    return { success: false, error: 'No rating to resume' };
  });

  ipcMain.handle('ai:cancelRating', async () => {
    const ratingEngine = getRatingEngine();
    if (ratingEngine) {
      ratingEngine.cancel();
      return { success: true };
    }
    return { success: false, error: 'No rating to cancel' };
  });

  ipcMain.handle('ai:exportRatings', async (event, { projectId }) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

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

      return { success: true, path: outputPath };
    } catch (error) {
      console.error('Error exporting ratings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:testGeminiConnection', async () => {
    try {
      const settings = getSettings();
      const geminiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;
      if (!geminiKey) {
        return { success: false, error: 'Gemini API key not set' };
      }

      const geminiRater = new GeminiRater(geminiKey);
      const result = await geminiRater.testConnection();

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:getRatingsForProject', async (event, { projectId }) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
      await db.initialize(dbPath);

      const ratings = await db.getRatingsForProject(projectId);

      return { success: true, ratings };
    } catch (error) {
      console.error('Error getting ratings for project:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerAIHandlers };
