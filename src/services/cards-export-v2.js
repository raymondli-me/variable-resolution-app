// Enhanced CARDS Export Service with Filtering and Media Separation
// This handles the multi-stage export process with quality filtering

const path = require('path');
const fs = require('fs').promises;

class EnhancedCARDSExporter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Main export method with filtering options
   */
  async exportWithFiltering(collectionId, options = {}) {
    const results = {
      raw: null,
      filtered: null,
      separated: null,
      report: null
    };

    // Step 1: Collect all items with quality signals
    console.log('Step 1: Collecting items with quality signals...');
    const rawItems = await this.collectItemsWithQualitySignals(collectionId, options);
    
    // Save raw export if requested
    if (options.exportRaw) {
      results.raw = await this.saveRawExport(collectionId, rawItems, options);
    }

    // Step 2: Apply quality filtering
    console.log('Step 2: Applying quality filters...');
    const filteringResult = await this.applyQualityFilters(rawItems, options);
    results.report = filteringResult.report;

    // Step 3: Separate by media type
    console.log('Step 3: Separating by media type...');
    const separated = this.separateByMediaType(filteringResult.filtered);

    // Step 4: Create CARDS exports
    console.log('Step 4: Creating CARDS exports...');
    const exports = [];

    // Export video chunks if we have any
    if (separated.video.length >= options.minItemsForExport || 10) {
      const videoCards = await this.createCARDSExport(
        collectionId,
        separated.video,
        'video',
        options
      );
      const videoPath = await this.saveExport(videoCards, collectionId, 'video', options);
      exports.push({ type: 'video', path: videoPath, count: separated.video.length });
    }

    // Export comments if we have any
    if (separated.text.length >= options.minItemsForExport || 10) {
      const commentCards = await this.createCARDSExport(
        collectionId,
        separated.text,
        'text',
        options
      );
      const commentPath = await this.saveExport(commentCards, collectionId, 'comments', options);
      exports.push({ type: 'text', path: commentPath, count: separated.text.length });
    }

    // Optional: Create mixed sample for cross-media studies
    if (options.createMixedSample && separated.video.length > 0 && separated.text.length > 0) {
      const mixedSample = this.createMixedSample(separated, options.mixedSampleSize || 100);
      const mixedCards = await this.createCARDSExport(
        collectionId,
        mixedSample,
        'mixed',
        options
      );
      const mixedPath = await this.saveExport(mixedCards, collectionId, 'mixed_sample', options);
      exports.push({ type: 'mixed', path: mixedPath, count: mixedSample.length });
    }

    results.separated = exports;
    return results;
  }

  /**
   * Collect items with quality signals for filtering
   */
  async collectItemsWithQualitySignals(collectionId, options) {
    const items = [];
    
    // Get collection info
    const collection = await this.db.getCollection(collectionId);
    const videos = await this.getCollectionVideos(collectionId);
    
    for (const video of videos) {
      // Process video chunks
      if (options.include_chunks && video.transcription) {
        const chunks = await this.getVideoChunks(video.id, collectionId);
        for (const chunk of chunks) {
          const item = await this.transformChunkWithQualitySignals(chunk, video);
          items.push(item);
        }
      }

      // Process comments
      if (options.include_comments) {
        const comments = await this.getVideoComments(video.id, collectionId);
        for (const comment of comments) {
          const item = this.transformCommentWithQualitySignals(comment, video);
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * Transform chunk with quality signals
   */
  async transformChunkWithQualitySignals(chunk, video) {
    const transcriptText = chunk.transcript_text || '';
    const words = transcriptText.split(/\s+/).filter(w => w.length > 0);
    
    return {
      id: `chunk_${video.id}_${chunk.chunk_number}`,
      type: 'video',
      content: transcriptText || `Video segment ${chunk.chunk_number}`,
      media: {
        type: 'video',
        url: chunk.file_path,
        duration_seconds: chunk.duration,
        parent_video: video.id
      },
      metadata: {
        video_title: video.title,
        channel: video.channel_title,
        chunk_position: chunk.start_time / video.duration
      },
      quality_signals: {
        // Content signals
        word_count: words.length,
        words_per_second: words.length / (chunk.duration || 1),
        has_speech: transcriptText.length > 0,
        
        // Video signals
        duration: chunk.duration,
        position_in_video: chunk.start_time / video.duration,
        
        // Derived signals
        information_density: this.calculateInformationDensity(transcriptText),
        silence_ratio: transcriptText.length === 0 ? 1 : 0
      }
    };
  }

  /**
   * Transform comment with quality signals
   */
  transformCommentWithQualitySignals(comment, video) {
    const words = comment.text.split(/\s+/).filter(w => w.length > 0);
    const emojis = (comment.text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    
    return {
      id: `comment_${comment.id}`,
      type: 'text',
      content: comment.text,
      media: { type: 'text' },
      metadata: {
        video_id: video.id,
        video_title: video.title,
        author: comment.author_name,
        is_reply: !!comment.parent_id
      },
      quality_signals: {
        // Engagement
        likes: comment.like_count,
        like_ratio: video.view_count ? comment.like_count / video.view_count : 0,
        
        // Content
        length: comment.text.length,
        word_count: words.length,
        sentence_count: (comment.text.match(/[.!?]+/g) || []).length,
        
        // Quality indicators
        has_punctuation: /[.!?,]/.test(comment.text),
        emoji_count: emojis,
        emoji_ratio: emojis / Math.max(words.length, 1),
        capital_ratio: (comment.text.match(/[A-Z]/g) || []).length / comment.text.length,
        
        // Spam indicators
        is_very_short: comment.text.length < 10,
        is_all_caps: comment.text === comment.text.toUpperCase() && /[A-Z]/.test(comment.text),
        has_spam_pattern: this.detectSpamPatterns(comment.text),
        
        // Derived
        quality_score: this.calculateCommentQualityScore(comment)
      }
    };
  }

  /**
   * Apply quality filters
   */
  async applyQualityFilters(items, options) {
    const filters = this.getFilters(options);
    const report = {
      total_items: items.length,
      stages: [],
      by_type: { video: { before: 0, after: 0 }, text: { before: 0, after: 0 } }
    };

    // Count by type
    items.forEach(item => {
      report.by_type[item.type].before++;
    });

    let filtered = [...items];

    // Apply filters in sequence
    for (const [filterName, filterFn] of Object.entries(filters)) {
      const before = filtered.length;
      filtered = filtered.filter(filterFn);
      const removed = before - filtered.length;
      
      if (removed > 0) {
        report.stages.push({
          name: filterName,
          removed,
          remaining: filtered.length
        });
      }
    }

    // Count filtered by type
    filtered.forEach(item => {
      report.by_type[item.type].after++;
    });

    report.final_count = filtered.length;
    report.retention_rate = filtered.length / items.length;

    return { filtered, report };
  }

  /**
   * Get filter functions based on options
   */
  getFilters(options) {
    const filters = {};

    // Comment filters
    filters.commentLength = (item) => {
      if (item.type !== 'text') return true;
      return item.quality_signals.length >= (options.filters?.minCommentLength || 30);
    };

    filters.commentSpam = (item) => {
      if (item.type !== 'text') return true;
      return !item.quality_signals.has_spam_pattern;
    };

    filters.commentQuality = (item) => {
      if (item.type !== 'text') return true;
      return item.quality_signals.quality_score >= (options.filters?.minQualityScore || 0.3);
    };

    // Video chunk filters
    filters.chunkDuration = (item) => {
      if (item.type !== 'video') return true;
      return item.quality_signals.duration >= (options.filters?.minChunkDuration || 5);
    };

    filters.chunkContent = (item) => {
      if (item.type !== 'video') return true;
      return item.quality_signals.word_count >= (options.filters?.minChunkWords || 10);
    };

    filters.chunkSilence = (item) => {
      if (item.type !== 'video') return true;
      return item.quality_signals.silence_ratio < (options.filters?.maxSilenceRatio || 0.5);
    };

    return filters;
  }

  /**
   * Utility functions
   */
  calculateInformationDensity(text) {
    // Simple heuristic: unique words / total words
    const words = text.toLowerCase().split(/\s+/);
    const unique = new Set(words).size;
    return words.length > 0 ? unique / words.length : 0;
  }

  calculateCommentQualityScore(comment) {
    let score = 0;
    
    // Length score
    if (comment.text.length > 50) score += 0.2;
    if (comment.text.length > 100) score += 0.1;
    
    // Engagement score
    if (comment.like_count > 0) score += 0.2;
    if (comment.like_count > 10) score += 0.1;
    
    // Content score
    if (/[.!?]/.test(comment.text)) score += 0.2;
    if (comment.text.split(/\s+/).length > 10) score += 0.2;
    
    return Math.min(score, 1);
  }

  detectSpamPatterns(text) {
    const spamPatterns = [
      /^first\s*!*$/i,
      /^notification\s+squad/i,
      /^who's\s+watching\s+in\s+\d{4}/i,
      /^sub\s+to\s+me/i,
      /^\d+$/
    ];
    
    return spamPatterns.some(pattern => pattern.test(text.trim()));
  }

  /**
   * Separate items by media type
   */
  separateByMediaType(items) {
    return {
      video: items.filter(item => item.type === 'video'),
      text: items.filter(item => item.type === 'text')
    };
  }

  /**
   * Create a balanced mixed sample
   */
  createMixedSample(separated, targetSize) {
    const halfSize = Math.floor(targetSize / 2);
    const videoSample = this.stratifiedSample(separated.video, halfSize);
    const textSample = this.stratifiedSample(separated.text, halfSize);
    
    return [...videoSample, ...textSample];
  }

  stratifiedSample(items, targetSize) {
    if (items.length <= targetSize) return items;
    
    // Sort by quality score
    const sorted = [...items].sort((a, b) => 
      (b.quality_signals.quality_score || 0) - (a.quality_signals.quality_score || 0)
    );
    
    // Take from different quality tiers
    const tiers = {
      high: sorted.slice(0, sorted.length * 0.2),
      medium: sorted.slice(sorted.length * 0.2, sorted.length * 0.6),
      low: sorted.slice(sorted.length * 0.6)
    };
    
    const sample = [];
    const perTier = Math.floor(targetSize / 3);
    
    sample.push(...this.randomSample(tiers.high, perTier));
    sample.push(...this.randomSample(tiers.medium, perTier));
    sample.push(...this.randomSample(tiers.low, targetSize - sample.length));
    
    return sample;
  }

  randomSample(items, n) {
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
  }

  // ... Additional methods for creating CARDS structure, saving files, etc.
}

module.exports = EnhancedCARDSExporter;