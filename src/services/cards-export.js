// CARDS Export Service for VR Collector
// Exports YouTube collection data to CARDS 2.0 format for BWS rating

const path = require('path');
const fs = require('fs').promises;

class CARDSExportService {
  constructor(db) {
    this.db = db;
  }

  // Helper methods for database queries
  async getCollectionVideos(collectionId) {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        'SELECT * FROM videos WHERE collection_id = ?',
        [collectionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getVideoChunks(videoId, collectionId) {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        'SELECT * FROM video_chunks WHERE video_id = ? AND collection_id = ? ORDER BY chunk_number',
        [videoId, collectionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getVideoComments(videoId, collectionId) {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        'SELECT * FROM comments WHERE video_id = ? AND collection_id = ? ORDER BY like_count DESC',
        [videoId, collectionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Export a collection to CARDS 2.0 format
   * @param {number} collectionId - Collection to export
   * @param {object} options - Export configuration
   * @returns {object} Export result with file path
   */
  async exportToCARDS(collectionId, options = {}) {
    try {
      // Get collection data
      const collection = await this.db.getCollection(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }

      // Set default options
      options = {
        include_videos: true,
        include_chunks: true,
        include_comments: true,
        include_transcripts: true,
        video_export_mode: 'thumbnail',
        max_video_duration: 30,
        chunks_per_video: 5,
        min_comment_likes: 10,
        assessment_method: 'bws',
        set_size: 4,
        dimensions: [{
          id: 'quality',
          name: 'Content Quality',
          description: 'Overall quality and value of the content',
          scale_type: 'unipolar',
          anchors: ['Low Quality', 'High Quality']
        }],
        ...options
      };

      // Collect items from various sources
      const items = await this.collectItems(collectionId, options);
      
      // Generate CARDS structure
      const cardsData = this.generateCARDSStructure(items, collection, options);
      
      // Generate assessment sets
      cardsData.assessment_sets = this.generateAssessmentSets(items, options);
      
      // Add quality control sets
      cardsData.quality_control = this.generateQualityControl(items, options);
      
      // Validate the structure
      const validation = this.validateCARDSStructure(cardsData);
      if (!validation.valid) {
        throw new Error(`Invalid CARDS structure: ${validation.errors.join(', ')}`);
      }

      // Save to file
      const outputPath = await this.saveToFile(cardsData, collection, options);
      
      // Prepare media package if requested
      if (options.include_media_files) {
        await this.prepareMediaPackage(cardsData, outputPath);
      }

      return {
        success: true,
        path: outputPath,
        stats: {
          total_items: items.length,
          videos: items.filter(i => i.media.type === 'video').length,
          text_items: items.filter(i => i.media.type === 'text').length,
          assessment_sets: cardsData.assessment_sets.length
        }
      };

    } catch (error) {
      console.error('CARDS export error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Collect items from various sources
   */
  async collectItems(collectionId, options) {
    const items = [];
    let itemIndex = 0;

    // Get videos from collection - using direct query since method might not exist
    const videos = await this.getCollectionVideos(collectionId);
    
    for (const video of videos) {
      // Add video as item if requested
      if (options.include_videos) {
        const videoItem = await this.transformVideoToItem(video, itemIndex++);
        if (videoItem) items.push(videoItem);
      }

      // Add video chunks if requested
      if (options.include_chunks && video.transcription) {
        const chunks = await this.getVideoChunks(video.id, collectionId);
        const chunkItems = await this.transformChunksToItems(
          chunks, 
          video, 
          options, 
          itemIndex
        );
        items.push(...chunkItems);
        itemIndex += chunkItems.length;
      }

      // Add comments if requested
      if (options.include_comments) {
        const comments = await this.getVideoComments(video.id, collectionId);
        const commentItems = this.transformCommentsToItems(
          comments, 
          video, 
          options, 
          itemIndex
        );
        items.push(...commentItems);
        itemIndex += commentItems.length;
      }
    }

    return items;
  }

  /**
   * Transform video to CARDS item
   */
  async transformVideoToItem(video, index) {
    // Create a descriptive content string
    const content = `${video.title}${video.description ? ': ' + video.description.substring(0, 200) : ''}`;
    
    const item = {
      id: `video_${video.id}`,
      content: content.trim(),
      media: {
        type: 'video',
        url: video.local_path || '',
        mime_type: 'video/mp4',
        duration_seconds: video.duration,
        youtube_id: video.id,
        thumbnail_url: video.thumbnails?.high?.url || video.thumbnails?.default?.url
      },
      metadata: {
        source: 'youtube',
        category: 'full_video',
        title: video.title,
        channel: video.channel_title,
        channel_id: video.channel_id,
        published: video.published_at,
        collected: video.collected_at,
        statistics: {
          views: video.view_count,
          likes: video.like_count,
          comments: video.comment_count
        },
        engagement_rate: video.view_count ? (video.like_count / video.view_count) : 0,
        tags: JSON.parse(video.tags || '[]'),
        has_transcription: !!video.transcription
      }
    };

    return item;
  }

  /**
   * Transform video chunks to CARDS items
   */
  async transformChunksToItems(chunks, video, options, startIndex) {
    const items = [];
    
    // Sort chunks by timestamp
    chunks.sort((a, b) => a.start_time - b.start_time);
    
    // Select chunks based on options
    let selectedChunks = chunks;
    if (options.chunks_per_video && chunks.length > options.chunks_per_video) {
      // Sample evenly across the video
      const step = Math.floor(chunks.length / options.chunks_per_video);
      selectedChunks = [];
      for (let i = 0; i < options.chunks_per_video; i++) {
        selectedChunks.push(chunks[i * step]);
      }
    }

    for (const chunk of selectedChunks) {
      const item = {
        id: `chunk_${video.id}_${chunk.chunk_number}`,
        content: chunk.transcript_text || `Video segment ${chunk.chunk_number} from "${video.title}"`,
        media: {
          type: 'video',
          url: chunk.file_path,
          mime_type: 'video/mp4',
          duration_seconds: chunk.duration,
          segment: {
            parent_video: video.id,
            chunk_number: chunk.chunk_number,
            start_time: chunk.start_time,
            end_time: chunk.end_time
          }
        },
        metadata: {
          source: 'youtube',
          category: 'video_segment',
          video_title: video.title,
          channel: video.channel_title,
          position_in_video: chunk.start_time / video.duration,
          has_speech: !!chunk.transcript_text
        }
      };
      
      items.push(item);
    }

    return items;
  }

  /**
   * Transform comments to CARDS items
   */
  transformCommentsToItems(comments, video, options, startIndex) {
    const items = [];
    
    // Filter comments based on options
    let selectedComments = comments;
    if (options.min_comment_likes) {
      selectedComments = comments.filter(c => c.like_count >= options.min_comment_likes);
    }
    if (options.min_comment_length) {
      selectedComments = selectedComments.filter(c => c.text.length >= options.min_comment_length);
    }
    
    // Sort by likes and take top N
    selectedComments.sort((a, b) => b.like_count - a.like_count);
    if (options.max_comments_per_video) {
      selectedComments = selectedComments.slice(0, options.max_comments_per_video);
    }

    for (const comment of selectedComments) {
      const item = {
        id: `comment_${comment.id}`,
        content: comment.text,
        media: {
          type: 'text',
          encoding: 'utf-8',
          word_count: comment.text.split(/\s+/).length,
          language: 'en' // TODO: Detect language
        },
        metadata: {
          source: 'youtube_comment',
          category: comment.parent_id ? 'reply' : 'top_level',
          video_id: video.id,
          video_title: video.title,
          author: comment.author_name,
          author_channel_id: comment.author_channel_id,
          published: comment.published_at,
          statistics: {
            likes: comment.like_count,
            replies: comment.reply_count
          },
          is_reply: !!comment.parent_id,
          sentiment: null // TODO: Add sentiment analysis
        }
      };
      
      items.push(item);
    }

    return items;
  }

  /**
   * Generate CARDS 2.0 structure
   */
  generateCARDSStructure(items, collection, options) {
    const now = new Date().toISOString();
    
    return {
      cards_version: '2.0',
      
      project: {
        id: `vr_youtube_${collection.id}`,
        title: `YouTube Collection: ${collection.search_term}`,
        description: `Exported from VR Collector - Collection of YouTube videos about "${collection.search_term}"`,
        created_by: 'VR Collector',
        source_platform: 'youtube',
        export_date: now,
        version: '1.0.0'
      },
      
      metadata: {
        id: `export_${collection.id}_${Date.now()}`,
        title: collection.search_term,
        description: `YouTube videos and comments collected for: ${collection.search_term}`,
        created: now,
        domain: 'social_media',
        subdomain: 'youtube',
        tags: ['youtube', 'video', 'comments', 'multimodal', 'vr-collector'],
        
        media_summary: this.calculateMediaSummary(items),
        
        collection_info: {
          collected_at: collection.created_at,
          video_count: collection.video_count,
          comment_count: collection.comment_count,
          settings: JSON.parse(collection.settings || '{}')
        },
        
        export_options: options
      },
      
      items: items,
      
      assessment_config: {
        method: options.assessment_method,
        dimensions: options.dimensions,
        
        cross_media_comparison: {
          allowed: true,
          guidelines: 'When comparing different media types, focus on content quality rather than production value'
        },
        
        bws_config: {
          set_size: options.set_size,
          selection_type: 'best_worst',
          media_balance: {
            strategy: options.media_balance || 'mixed',
            min_media_types_per_set: 1
          }
        }
      },
      
      assessment_sets: [], // Generated separately
      responses: [],       // Empty for new export
      session: null,       // No active session
      
      quality_control: {}  // Generated separately
    };
  }

  /**
   * Calculate media summary statistics
   */
  calculateMediaSummary(items) {
    const summary = {
      text: 0,
      image: 0,
      video: 0,
      audio: 0,
      pdf: 0
    };
    
    for (const item of items) {
      if (summary.hasOwnProperty(item.media.type)) {
        summary[item.media.type]++;
      }
    }
    
    return summary;
  }

  /**
   * Generate balanced assessment sets
   */
  generateAssessmentSets(items, options) {
    const sets = [];
    const setSize = options.set_size || 4;
    const dimensionId = options.dimensions[0].id; // Use first dimension for now
    
    // Simple balanced set generation
    // TODO: Implement more sophisticated algorithms
    const itemsCopy = [...items];
    const usedItems = new Set();
    let setId = 0;
    
    // Try to create sets with mixed media types
    while (itemsCopy.length >= setSize) {
      const set = {
        set_id: setId++,
        dimension_id: dimensionId,
        item_ids: [],
        set_metadata: {
          media_types: [],
          creation_method: 'balanced_random'
        }
      };
      
      // Try to get different media types
      const mediaTypes = ['video', 'text'];
      for (const mediaType of mediaTypes) {
        const typeItems = itemsCopy.filter(i => 
          i.media.type === mediaType && !usedItems.has(i.id)
        );
        if (typeItems.length > 0) {
          const item = typeItems[Math.floor(Math.random() * typeItems.length)];
          set.item_ids.push(item.id);
          set.set_metadata.media_types.push(item.media.type);
          usedItems.add(item.id);
        }
      }
      
      // Fill remaining slots
      while (set.item_ids.length < setSize) {
        const remainingItems = itemsCopy.filter(i => !usedItems.has(i.id));
        if (remainingItems.length === 0) break;
        
        const item = remainingItems[Math.floor(Math.random() * remainingItems.length)];
        set.item_ids.push(item.id);
        set.set_metadata.media_types.push(item.media.type);
        usedItems.add(item.id);
      }
      
      if (set.item_ids.length === setSize) {
        sets.push(set);
      } else {
        break; // Can't create full sets anymore
      }
      
      // Remove used items from the copy
      for (const id of usedItems) {
        const index = itemsCopy.findIndex(i => i.id === id);
        if (index > -1) itemsCopy.splice(index, 1);
      }
    }
    
    return sets;
  }

  /**
   * Generate quality control sets
   */
  generateQualityControl(items, options) {
    // TODO: Implement quality control generation
    // - Gold standard sets with known rankings
    // - Attention check sets with obvious choices
    // - Duplicate sets for consistency checking
    
    return {
      gold_standard_sets: [],
      attention_checks: [],
      duplicate_sets: []
    };
  }

  /**
   * Validate CARDS structure
   */
  validateCARDSStructure(data) {
    const errors = [];
    
    // Check required fields
    if (!data.cards_version) errors.push('Missing cards_version');
    if (!data.project) errors.push('Missing project info');
    if (!data.items || !Array.isArray(data.items)) errors.push('Missing or invalid items array');
    if (!data.assessment_config) errors.push('Missing assessment_config');
    
    // Validate items
    for (const item of data.items || []) {
      if (!item.id) errors.push(`Item missing id`);
      if (!item.content) errors.push(`Item ${item.id} missing content`);
      if (!item.media) errors.push(`Item ${item.id} missing media info`);
    }
    
    // Validate assessment sets
    for (const set of data.assessment_sets || []) {
      if (set.item_ids.length !== data.assessment_config.bws_config.set_size) {
        errors.push(`Set ${set.set_id} has wrong number of items`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Save CARDS data to file
   */
  async saveToFile(cardsData, collection, options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cards_export_${collection.id}_${timestamp}.json`;
    
    // Parse collection settings if it's a string
    let settings = {};
    try {
      settings = typeof collection.settings === 'string' 
        ? JSON.parse(collection.settings) 
        : collection.settings || {};
    } catch (e) {
      console.warn('Failed to parse collection settings:', e);
    }
    
    // Determine output directory
    const appDataPath = require('electron').app.getPath('userData');
    const defaultExportPath = path.join(appDataPath, 'exports', 'cards');
    
    const outputDir = options.output_path || 
      settings.folders?.exports || 
      defaultExportPath;
    
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, filename);
    
    await fs.writeFile(
      outputPath, 
      JSON.stringify(cardsData, null, 2), 
      'utf8'
    );
    
    return outputPath;
  }

  /**
   * Prepare media package (optional)
   */
  async prepareMediaPackage(cardsData, outputPath) {
    // TODO: Copy and organize media files
    // - Create media/ directory structure
    // - Copy video files and chunks
    // - Generate thumbnails if needed
    // - Update file paths in cardsData
  }
}

module.exports = CARDSExportService;