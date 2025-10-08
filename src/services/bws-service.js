/**
 * BWS (Best-Worst Scaling) Service
 *
 * Modern, class-based service for managing BWS experiments.
 * Provides rich UI feedback through IPC messages and toast notifications.
 *
 * @class BwsService
 */

const { app } = require('electron');
const path = require('path');
const BwsTupleGenerator = require('./bws-tuple-generator');
const GeminiRater = require('./gemini-rater');

class BwsService {
  /**
   * Create a new BWS Service instance
   * @param {Function} getDatabase - Function that returns the database instance
   * @param {Function} getMainWindow - Function that returns the main window instance
   * @param {Function} getSettings - Function that returns the settings object
   * @param {Function} decrypt - Function to decrypt API keys
   */
  constructor(getDatabase, getMainWindow, getSettings, decrypt) {
    this.getDatabase = getDatabase;
    this.getMainWindow = getMainWindow;
    this.getSettings = getSettings;
    this.decrypt = decrypt;
  }

  // ============================================================================
  // UI FEEDBACK METHODS
  // ============================================================================

  /**
   * Send toast notification to UI
   */
  sendToast(type, message, options = {}) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('show-toast', { type, message, options });
    }
  }

  /**
   * Send progress update to UI
   */
  sendProgress(experimentId, data) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('bws:ai-progress', { experimentId, ...data });
    }
  }

  /**
   * Send item rated event to UI
   */
  sendItemRated(data) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('bws:ai-item-rated', data);
    }
  }

  /**
   * Send error to UI
   */
  sendError(data) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('bws:ai-error', data);
    }
  }

  /**
   * Send completion notification to UI
   */
  sendComplete(data) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('bws:ai-complete', data);
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
   * Get all BWS experiments
   */
  async getAllExperiments() {
    try {
      const db = await this.getDb();
      const experiments = await db.getAllBWSExperiments();
      return { success: true, experiments };
    } catch (error) {
      console.error('Error getting BWS experiments:', error);
      this.sendToast('error', `Failed to get experiments: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get single BWS experiment with stats
   */
  async getExperiment(experimentId) {
    try {
      const db = await this.getDb();
      const stats = await db.getBWSExperimentStats(experimentId);
      return { success: true, experiment: stats };
    } catch (error) {
      console.error('Error getting BWS experiment:', error);
      this.sendToast('error', `Failed to get experiment: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get BWS experiments for a specific collection
   */
  async getExperimentsForCollection(collectionId) {
    try {
      const db = await this.getDb();
      const experiments = await db.getBWSExperimentsForCollection(collectionId);
      return { success: true, experiments };
    } catch (error) {
      console.error('Error getting BWS experiments for collection:', error);
      this.sendToast('error', `Failed to get experiments: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create BWS experiment with tuple generation
   */
  async createExperiment(config) {
    try {
      const db = await this.getDb();

      const {
        name,
        source_type,
        rating_project_id,
        collection_id,
        include_comments,
        include_chunks,
        include_pdfs,
        tuple_size,
        target_appearances,
        design_method,
        scoring_method,
        rater_type,
        research_intent,
        min_score = 0.7
      } = config;

      let items = [];
      let item_type = 'mixed';
      let sourceId = null;

      // Fetch items based on source type
      if (source_type === 'rating-project') {
        sourceId = rating_project_id;

        // Fetch items from rating project with score filter
        const ratings = await db.getRatingsForProject(rating_project_id);
        const filteredRatings = ratings.filter(r =>
          r.status === 'success' &&
          r.relevance_score >= min_score
        );

        if (filteredRatings.length === 0) {
          this.sendToast('error', 'No items meet the score criteria');
          return { success: false, error: 'No items meet the score criteria' };
        }

        // Determine item type (check if all same type)
        const itemTypes = new Set(filteredRatings.map(r => r.item_type));
        if (itemTypes.size > 1) {
          this.sendToast('error', 'Cannot mix different content types in BWS experiment');
          return { success: false, error: 'Cannot mix different content types in BWS experiment' };
        }
        item_type = filteredRatings[0].item_type;

        items = filteredRatings.map(r => ({ id: r.item_id, ...r }));

      } else if (source_type === 'collection') {
        sourceId = collection_id;

        // Fetch items from collection
        const rawItems = await db.getItemsForRating(
          collection_id,
          include_chunks,
          include_comments,
          null, // No projectId
          include_pdfs
        );

        if (rawItems.length === 0) {
          this.sendToast('error', 'No items found in collection');
          return { success: false, error: 'No items found in collection' };
        }

        // Determine item type
        const itemTypes = new Set(rawItems.map(item => item.type));
        if (itemTypes.size > 1) {
          this.sendToast('error', 'Cannot mix different content types. Uncheck one type.');
          return { success: false, error: 'Cannot mix different content types in BWS experiment. Uncheck one type.' };
        }
        item_type = rawItems[0].type || 'video_chunk';

        items = rawItems.map(item => ({ id: item.id, ...item }));
      } else {
        this.sendToast('error', 'Invalid source type');
        return { success: false, error: 'Invalid source_type' };
      }

      if (items.length < tuple_size) {
        this.sendToast('error', `Need at least ${tuple_size} items for tuple size ${tuple_size}`);
        return { success: false, error: `Need at least ${tuple_size} items for tuple size ${tuple_size}` };
      }

      // Generate tuples with video diversity constraint
      const itemIds = items.map(item => item.id);

      // For video chunks, build a map of item_id -> video_id to enforce diversity
      const itemVideoMap = {};
      if (item_type === 'video_chunk') {
        items.forEach(item => {
          itemVideoMap[item.id] = item.video_id;
        });
      }

      const tuples = BwsTupleGenerator.generateTuples(itemIds, {
        tupleSize: tuple_size,
        targetAppearances: target_appearances || 4,
        method: design_method || 'balanced',
        itemVideoMap: Object.keys(itemVideoMap).length > 0 ? itemVideoMap : null
      });

      // Validate tuples
      const validation = BwsTupleGenerator.validateTuples(tuples, itemIds, tuple_size);
      if (!validation.valid) {
        console.warn('Tuple validation issues:', validation.issues);
      }

      // Create experiment in database
      const experimentData = {
        name,
        item_type,
        tuple_size,
        tuple_count: tuples.length,
        design_method: design_method || 'balanced',
        scoring_method: scoring_method || 'counting',
        rater_type: rater_type || 'ai',
        research_intent,
        status: 'draft'
      };

      // Add source-specific fields
      if (source_type === 'rating-project') {
        experimentData.rating_project_id = rating_project_id;
      } else {
        experimentData.collection_id = collection_id;
      }

      const experimentId = await db.createBWSExperiment(experimentData);

      // Save tuples
      await db.saveBWSTuples(experimentId, tuples);

      this.sendToast('success', `Experiment "${name}" created with ${tuples.length} tuples`);

      return {
        success: true,
        experiment_id: experimentId,
        tuple_count: tuples.length,
        item_count: itemIds.length,
        validation: validation.statistics
      };
    } catch (error) {
      console.error('Error creating BWS experiment:', error);
      this.sendToast('error', `Failed to create experiment: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update BWS experiment
   */
  async updateExperiment(experimentId, updates) {
    try {
      const db = await this.getDb();
      await db.updateBWSExperiment(experimentId, updates);
      return { success: true };
    } catch (error) {
      console.error('Error updating BWS experiment:', error);
      this.sendToast('error', `Failed to update experiment: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get next tuple for rating
   */
  async getNextTuple(experimentId, raterType, raterId) {
    try {
      const db = await this.getDb();
      const tuple = await db.getNextBWSTuple(experimentId, raterType, raterId);

      if (!tuple) {
        return { success: true, tuple: null, items: null, complete: true };
      }

      // Extract items from tuple object (getBWSTupleWithItems adds items to tuple)
      const items = tuple.items || [];

      return { success: true, tuple, items, complete: false };
    } catch (error) {
      console.error('Error getting next tuple:', error);
      this.sendToast('error', `Failed to get next tuple: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save BWS judgment
   */
  async saveJudgment(judgmentData) {
    try {
      const db = await this.getDb();
      const judgmentId = await db.saveBWSJudgment(judgmentData);
      return { success: true, judgment_id: judgmentId };
    } catch (error) {
      console.error('Error saving BWS judgment:', error);
      this.sendToast('error', `Failed to save judgment: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate scores for experiment
   */
  async calculateScores(experimentId, raterId = null) {
    try {
      const db = await this.getDb();
      const scores = await db.calculateBWSScores(experimentId, raterId);

      // Only update experiment status to completed when calculating combined scores
      if (!raterId) {
        await db.updateBWSExperiment(experimentId, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
        this.sendToast('success', `Scores calculated for ${scores.length} items`);
      }

      return { success: true, scores };
    } catch (error) {
      console.error('Error calculating BWS scores:', error);
      this.sendToast('error', `Failed to calculate scores: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get scores for experiment
   */
  async getScores(experimentId, raterId = 'combined') {
    try {
      const db = await this.getDb();
      const scores = await db.getBWSScores(experimentId, raterId);
      return { success: true, scores };
    } catch (error) {
      console.error('Error getting BWS scores:', error);
      this.sendToast('error', `Failed to get scores: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete BWS experiment
   */
  async deleteExperiment(experimentId) {
    try {
      const db = await this.getDb();
      await db.deleteBWSExperiment(experimentId);
      this.sendToast('success', 'Experiment deleted');
      return { success: true };
    } catch (error) {
      console.error('Error deleting BWS experiment:', error);
      this.sendToast('error', `Failed to delete experiment: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get rater judgment count (for multi-rater support)
   */
  async getRaterJudgmentCount(experimentId, raterId) {
    try {
      const db = await this.getDb();
      const count = await db.getRaterJudgmentCount(experimentId, raterId);
      return { success: true, count };
    } catch (error) {
      console.error('Error getting rater judgment count:', error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Start AI BWS Rating
   */
  async startAIRating(experimentId) {
    try {
      const db = await this.getDb();

      // Get experiment details
      const stats = await db.getBWSExperimentStats(experimentId);
      const experiment = stats;

      // Get API key from encrypted settings
      const settings = this.getSettings();
      const geminiKey = settings.apiKeys?.gemini ? this.decrypt(settings.apiKeys.gemini) : null;
      if (!geminiKey) {
        this.sendToast('error', 'Gemini API key not set. Please configure it in Settings.');
        return { success: false, error: 'Gemini API key not set. Please configure it in Settings.' };
      }

      const rater = new GeminiRater(geminiKey);

      // Update experiment status
      await db.updateBWSExperiment(experimentId, { status: 'in_progress' });

      // Get all tuples
      const allTuples = await db.getBWSTuples(experimentId);

      // Get already rated tuples
      const judgments = await db.getBWSJudgments(experimentId);
      const ratedTupleIds = new Set(judgments.map(j => j.tuple_id));

      // Filter to unrated tuples
      const unratedTuples = allTuples.filter(t => !ratedTupleIds.has(t.id));

      let completedCount = ratedTupleIds.size;
      const totalCount = allTuples.length;

      this.sendToast('info', `Starting AI rating for ${unratedTuples.length} tuples`);

      // Process each tuple
      for (const tuple of unratedTuples) {
        try {
          // Get tuple with items
          const tupleWithItems = await db.getBWSTupleWithItems(tuple.id);

          // Send progress event
          this.sendProgress(experimentId, {
            current: completedCount,
            total: totalCount,
            percentage: Math.round((completedCount / totalCount) * 100)
          });

          // Rate with Gemini
          const result = await rater.compareBWSItems(tupleWithItems.items, experiment.research_intent);

          // Convert 1-based indices to 0-based and get item IDs
          const bestIndex = result.best - 1;
          const worstIndex = result.worst - 1;
          const bestItemId = tupleWithItems.items[bestIndex]?.id;
          const worstItemId = tupleWithItems.items[worstIndex]?.id;

          if (!bestItemId || !worstItemId) {
            throw new Error('Invalid item indices from Gemini');
          }

          // Save judgment
          await db.saveBWSJudgment({
            tuple_id: tuple.id,
            rater_type: 'ai',
            rater_id: 'gemini-2.5-flash',
            best_item_id: bestItemId,
            worst_item_id: worstItemId,
            reasoning: result.reasoning,
            response_time_ms: 0
          });

          completedCount++;

          // Send item rated event
          this.sendItemRated({
            tupleId: tuple.id,
            best: bestIndex,
            worst: worstIndex,
            reasoning: result.reasoning
          });

          // Rate limiting - wait 1 second between requests
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Error rating tuple ${tuple.id}:`, error);
          this.sendError({
            tupleId: tuple.id,
            error: error.message
          });
          // Continue with next tuple
        }
      }

      // Calculate scores
      const scores = await db.calculateBWSCountingScores(experimentId);

      // Update experiment to completed
      await db.updateBWSExperiment(experimentId, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      // Send completion event
      this.sendComplete({
        experimentId,
        scoresCount: scores.length
      });

      this.sendToast('success', `AI rating complete! Rated ${completedCount} tuples`);

      return { success: true, completed: completedCount, total: totalCount };

    } catch (error) {
      console.error('Error in AI BWS rating:', error);
      this.sendToast('error', `AI rating failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all tuples for an experiment (for live viewer)
   */
  async getAllTuples(experimentId) {
    try {
      const db = await this.getDb();

      // Get all tuples with their items
      const tuples = await db.all(`
        SELECT id, experiment_id, item_ids, tuple_index, created_at
        FROM bws_tuples
        WHERE experiment_id = ?
        ORDER BY tuple_index
      `, [experimentId]);

      // Parse item_ids JSON and fetch items for each tuple
      const tuplesWithItems = await Promise.all(tuples.map(async (tuple) => {
        tuple.item_ids = JSON.parse(tuple.item_ids);

        // Fetch items
        const items = [];
        for (const itemId of tuple.item_ids) {
          let item = await db.get('SELECT *, "comment" as item_type FROM comments WHERE id = ?', [itemId]);
          if (!item) {
            item = await db.get('SELECT *, "video_chunk" as item_type FROM video_chunks WHERE id = ?', [itemId]);
          }
          if (item) items.push(item);
        }

        return { ...tuple, items };
      }));

      return tuplesWithItems;
    } catch (error) {
      console.error('Error getting all tuples:', error);
      return [];
    }
  }

  /**
   * Get judgments for an experiment
   */
  async getJudgments(experimentId, raterType = null, raterId = null) {
    try {
      const db = await this.getDb();

      let query = `
        SELECT j.*, t.experiment_id
        FROM bws_judgments j
        JOIN bws_tuples t ON j.tuple_id = t.id
        WHERE t.experiment_id = ?
      `;

      const params = [experimentId];

      if (raterType) {
        query += ` AND j.rater_type = ?`;
        params.push(raterType);
      }

      if (raterId) {
        query += ` AND j.rater_id = ?`;
        params.push(raterId);
      }

      query += ` ORDER BY j.created_at DESC`;

      const judgments = await db.all(query, params);
      return judgments;
    } catch (error) {
      console.error('Error getting judgments:', error);
      return [];
    }
  }

  /**
   * Get tuple with items
   */
  async getTupleWithItems(tupleId) {
    try {
      const db = await this.getDb();
      const tupleWithItems = await db.getBWSTupleWithItems(tupleId);
      return tupleWithItems;
    } catch (error) {
      console.error('Error getting tuple with items:', error);
      return null;
    }
  }

  /**
   * Get available rating variables (BWS-specific and general)
   */
  async getRatingVariables() {
    try {
      const db = await this.getDb();

      // Get BWS-specific variables first, then general rating variables
      const variables = await db.all(`
        SELECT id, label as name, definition as description, anchors, variable_type
        FROM global_rating_variables
        WHERE variable_type = 'bws' OR variable_type = 'rating'
        ORDER BY variable_type DESC, label ASC
      `);

      // Parse anchors JSON string for each variable
      const parsedVariables = variables.map(v => {
        try {
          v.anchors = v.anchors ? JSON.parse(v.anchors) : null;
        } catch (e) {
          v.anchors = null;
        }
        return v;
      });

      // If no variables exist, return some default ones
      if (!parsedVariables || parsedVariables.length === 0) {
        return [
          {
            id: 'relevance',
            name: 'Relevance',
            description: 'How relevant is this content?',
            variable_type: 'rating',
            anchors: null
          }
        ];
      }

      return parsedVariables;
    } catch (error) {
      console.error('Error getting rating variables:', error);
      // Return default variable on error
      return [
        {
          id: 'relevance',
          name: 'Relevance',
          description: 'How relevant is this content?',
          variable_type: 'rating',
          anchors: null
        }
      ];
    }
  }

  /**
   * Rate a single tuple with AI
   */
  async rateTupleWithAI(tupleId, variableId, items) {
    try {
      if (!items || items.length !== 4) {
        return { success: false, error: 'Invalid items for rating' };
      }

      // Simulate AI rating (in a real implementation, this would call an AI service)
      // For now, return random best/worst indices
      const bestIndex = Math.floor(Math.random() * 4);
      let worstIndex = Math.floor(Math.random() * 4);

      // Ensure worst is different from best
      while (worstIndex === bestIndex) {
        worstIndex = Math.floor(Math.random() * 4);
      }

      // Save the AI judgment to database
      const db = await this.getDb();
      await this.saveJudgment({
        tupleId,
        bestItemIndex: bestIndex,
        worstItemIndex: worstIndex,
        raterType: 'ai',
        raterId: `ai_${variableId}`,
        timestamp: Date.now()
      });

      return {
        success: true,
        bestIndex,
        worstIndex,
        confidence: 0.85 + Math.random() * 0.15 // Simulated confidence score
      };
    } catch (error) {
      console.error('Error rating tuple with AI:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get AI rating progress for an experiment
   */
  async getAIRatingProgress(experimentId) {
    try {
      const db = await this.getDb();

      // Get total tuples
      const totalResult = await db.get(`
        SELECT COUNT(*) as total
        FROM bws_tuples
        WHERE experiment_id = ?
      `, [experimentId]);

      // Get completed AI ratings
      const completedResult = await db.get(`
        SELECT COUNT(DISTINCT t.id) as completed
        FROM bws_tuples t
        JOIN bws_judgments j ON t.id = j.tuple_id
        WHERE t.experiment_id = ? AND j.rater_type = 'ai'
      `, [experimentId, 'ai']);

      return {
        total: totalResult.total || 0,
        completed: completedResult.completed || 0,
        percentage: totalResult.total > 0
          ? Math.round((completedResult.completed / totalResult.total) * 100)
          : 0
      };
    } catch (error) {
      console.error('Error getting AI rating progress:', error);
      return { total: 0, completed: 0, percentage: 0 };
    }
  }
}

module.exports = { BwsService };
