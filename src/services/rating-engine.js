// Rating Engine for batch processing with Gemini
const EventEmitter = require('events');

class RatingEngine extends EventEmitter {
  constructor(db, geminiRater) {
    super();
    this.db = db;
    this.gemini = geminiRater;
    this.running = false;
    this.paused = false;
    this.currentProject = null;
  }

  /**
   * Start a new rating project
   */
  async startRatingProject(projectConfig) {
    try {
      this.running = true;
      this.paused = false;
      
      // Create project in database
      const projectId = await this.db.createRatingProject({
        collectionId: projectConfig.collectionId,
        projectName: projectConfig.projectName,
        researchIntent: projectConfig.researchIntent,
        ratingScale: projectConfig.ratingScale,
        geminiModel: projectConfig.geminiModel,
        parentProjectId: projectConfig.parentProjectId || null,  // NEW: hierarchical support
        filterCriteria: projectConfig.filterCriteria || null,    // NEW: hierarchical support
        settings: {
          includeChunks: projectConfig.includeChunks,
          includeComments: projectConfig.includeComments,
          batchSize: projectConfig.batchSize,
          rateLimit: projectConfig.rateLimit,
          includeConfidence: projectConfig.includeConfidence
        }
      });
      
      this.currentProject = { ...projectConfig, id: projectId };
      
      // Get items to rate
      console.log(`[RatingEngine] Fetching items for project ${projectId}, collection ${projectConfig.collectionId}...`);
      console.log(`[RatingEngine] includeChunks: ${projectConfig.includeChunks}, includeComments: ${projectConfig.includeComments}`);

      const items = await this.db.getItemsForRating(
        projectConfig.collectionId,
        projectConfig.includeChunks,
        projectConfig.includeComments,
        projectId  // NEW: Pass projectId to check for hierarchical projects
      );
      
      console.log(`[RatingEngine] Found ${items.length} items to rate`);
      if (items.length > 0) {
        console.log(`[RatingEngine] First item:`, {
          type: items[0].type,
          id: items[0].id,
          has_file_path: !!items[0].file_path,
          has_text: !!items[0].text,
          has_transcript: !!items[0].transcript_text
        });
      }
      
      // Update total items
      await this.db.updateRatingProject(projectId, { 
        total_items: items.length,
        status: 'in_progress'
      });
      
      // Emit initial progress (0%)
      this.emit('progress', {
        projectId,
        current: 0,
        total: items.length,
        percentage: 0,
        elapsedMs: 0,
        remainingMs: 0
      });
      
      // Process in batches
      const batchSize = projectConfig.batchSize || 50;
      const rateLimit = projectConfig.rateLimit || 60; // per minute
      const delayMs = (60 * 1000) / rateLimit;
      
      let ratedCount = 0;
      const startTime = Date.now();
      
      for (let i = 0; i < items.length && this.running; i += batchSize) {
        if (this.paused) {
          this.emit('paused', { projectId, progress: ratedCount / items.length });
          await this.waitForResume();
        }
        
        const batch = items.slice(i, Math.min(i + batchSize, items.length));
        
        // Process batch (with progress updates for each concurrency chunk)
        await this.processBatch(batch, projectId, projectConfig, items.length, i, startTime);
        ratedCount += batch.length;
        
        // Update progress
        const progress = (ratedCount / items.length) * 100;
        const elapsed = Date.now() - startTime;
        const avgTimePerItem = elapsed / ratedCount;
        const remainingTime = avgTimePerItem * (items.length - ratedCount);
        
        await this.db.updateRatingProject(projectId, { 
          rated_items: ratedCount 
        });
        
        this.emit('progress', {
          projectId,
          current: ratedCount,
          total: items.length,
          percentage: progress,
          elapsedMs: elapsed,
          remainingMs: remainingTime
        });
        
        // Rate limiting delay
        if (i + batchSize < items.length && this.running) {
          await new Promise(resolve => setTimeout(resolve, delayMs * batch.length));
        }
      }
      
      // Mark project complete
      if (this.running && ratedCount === items.length) {
        await this.db.updateRatingProject(projectId, { 
          status: 'completed',
          completed_at: new Date().toISOString()
        });
        this.emit('complete', { projectId, totalRated: ratedCount });
      } else {
        await this.db.updateRatingProject(projectId, { 
          status: 'paused'
        });
      }
      
    } catch (error) {
      console.error('Rating engine error:', error);
      this.emit('error', { 
        projectId: this.currentProject?.id, 
        error: error.message 
      });
      
      if (this.currentProject?.id) {
        await this.db.updateRatingProject(this.currentProject.id, { 
          status: 'failed'
        });
      }
      
      throw error;
    } finally {
      this.running = false;
      this.currentProject = null;
    }
  }

  /**
   * Process a batch of items with controlled concurrency
   */
  async processBatch(items, projectId, config, totalItems, startIndex, startTime) {
    const concurrency = config.concurrentRequests || 5;
    const ratings = [];
    
    console.log(`[RatingEngine] Processing batch of ${items.length} items with concurrency ${concurrency}`);
    
    // Process items with limited concurrency
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, Math.min(i + concurrency, items.length));
      console.log(`[RatingEngine] Processing chunk ${Math.floor(i/concurrency) + 1}, items ${i+1} to ${i+chunk.length}`);
      const chunkPromises = chunk.map(item => this.rateItemWithBackoff(item, config));
      const chunkRatings = await Promise.all(chunkPromises);
      ratings.push(...chunkRatings);
      
      // Emit progress update after each concurrency chunk
      const currentTotal = startIndex + i + chunk.length;
      const percentage = (currentTotal / totalItems) * 100;
      const elapsed = Date.now() - startTime;
      const avgTimePerItem = elapsed / currentTotal;
      const remainingTime = avgTimePerItem * (totalItems - currentTotal);
      
      this.emit('progress', {
        projectId,
        current: currentTotal,
        total: totalItems,
        percentage: percentage,
        elapsedMs: elapsed,
        remainingMs: remainingTime
      });
    }
    
    // Save ratings to database (handle successes and failures gracefully)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rating = ratings[i];
      
      try {
        if (rating && rating.success !== false) {
          // Successful rating
          await this.db.saveRating({
            project_id: projectId,
            item_type: item.type,
            item_id: item.id,
            relevance_score: rating.relevance,
            confidence: rating.confidence,
            reasoning: rating.reasoning,
            gemini_response: JSON.stringify(rating),
            status: 'success'
          });
          
          this.emit('item-rated', {
            projectId,
            item: {
              type: item.type,
              id: item.id,
              content: item.type === 'comment' ? item.text : item.transcript_text
            },
            rating: {
              relevance_score: rating.relevance,
              confidence: rating.confidence,
              reasoning: rating.reasoning
            }
          });
        } else {
          // Failed rating - save as failed but continue
          await this.db.saveRating({
            project_id: projectId,
            item_type: item.type,
            item_id: item.id,
            relevance_score: null,
            confidence: null,
            reasoning: null,
            gemini_response: null,
            status: 'failed',
            error_message: rating.error,
            retry_count: rating.retryCount || 3
          });
          
          this.emit('item-failed', {
            projectId,
            item: {
              type: item.type,
              id: item.id,
              content: item.type === 'comment' ? item.text : item.transcript_text
            },
            error: rating.error
          });
        }
        
      } catch (error) {
        console.error(`Error saving rating for item ${item.id}:`, error);
      }
    }
  }

  /**
   * Rate item with exponential backoff for 503 errors
   */
  async rateItemWithBackoff(item, config, maxRetries = 5) {
    const retryDelay = (config.retryDelay || 2) * 1000; // Convert to ms
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.rateItem(item, config);
        
        // If it's a failed result with 503 error, retry with backoff
        if (result.success === false && result.error && result.error.includes('503')) {
          if (attempt < maxRetries - 1) {
            const backoffDelay = retryDelay * Math.pow(2, attempt); // Exponential backoff
            console.log(`503 error for item ${item.id}, waiting ${backoffDelay}ms before retry ${attempt + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }
        }
        
        return result;
      } catch (error) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = retryDelay * Math.pow(2, attempt);
          console.log(`Error for item ${item.id}, waiting ${backoffDelay}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        
        // Max retries reached, return failure
        return {
          success: false,
          error: error.message,
          retryCount: maxRetries,
          relevance: null,
          confidence: null,
          reasoning: null
        };
      }
    }
  }

  /**
   * Rate a single item (returns failed object instead of throwing)
   */
  async rateItem(item, config) {
    try {
      if (item.type === 'video_chunk') {
        const result = await this.gemini.rateVideoChunk(
          item.file_path,
          item.transcript_text,
          config.researchIntent,
          config.ratingScale
        );
        return { ...result, success: true };
      } else if (item.type === 'comment') {
        const result = await this.gemini.rateComment(
          item.text,
          { title: item.video_title },
          config.researchIntent,
          config.ratingScale
        );
        return { ...result, success: true };
      } else {
        throw new Error(`Unknown item type: ${item.type}`);
      }
    } catch (error) {
      console.error(`Failed to rate item ${item.id} after retries:`, error);
      
      // Return failed object instead of throwing
      return {
        success: false,
        error: error.message,
        retryCount: 3,
        relevance: null,
        confidence: null,
        reasoning: null
      };
    }
  }

  /**
   * Pause rating
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume rating
   */
  resume() {
    this.paused = false;
    if (this.resumeResolver) {
      this.resumeResolver();
    }
  }

  /**
   * Cancel rating
   */
  cancel() {
    this.running = false;
    this.paused = false;
  }

  /**
   * Wait for resume
   */
  waitForResume() {
    return new Promise(resolve => {
      if (!this.paused) {
        resolve();
      } else {
        this.resumeResolver = resolve;
      }
    });
  }

  /**
   * Preview rating (rate first N items)
   */
  async previewRating(projectConfig, limit = 10) {
    try {
      // Get sample items
      const items = await this.db.getItemsForRating(
        projectConfig.collectionId,
        projectConfig.includeChunks,
        projectConfig.includeComments
      );
      
      const sampleItems = items.slice(0, limit);
      const results = [];
      
      for (const item of sampleItems) {
        const rating = await this.rateItem(item, projectConfig);
        results.push({
          item: {
            type: item.type,
            content: item.type === 'comment' ? item.text : item.transcript_text,
            metadata: {
              video_title: item.video_title,
              ...(item.type === 'video_chunk' && {
                start_time: item.start_time,
                end_time: item.end_time
              })
            }
          },
          rating
        });
        
        this.emit('preview-item', results[results.length - 1]);
      }
      
      return results;
      
    } catch (error) {
      console.error('Preview error:', error);
      throw error;
    }
  }
}

module.exports = RatingEngine;