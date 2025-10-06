/**
 * PDF Page Image Generator Service
 *
 * Generates page images with highlighted excerpts for AI rating.
 * Uses PDFRenderer + PDFHighlighter but renders to in-memory canvas
 * instead of DOM, then exports as base64 image for Gemini API.
 *
 * Architecture:
 * - Creates offscreen canvas (not attached to DOM)
 * - Renders PDF page at 2x scale for quality
 * - Draws yellow highlight over excerpt bbox
 * - Exports as base64 PNG
 * - Caches results in memory for performance
 */

class PDFPageImageGenerator {
  constructor() {
    // Cache: Map<pdfPath, Map<pageNum, Map<excerptId, base64Image>>>
    this.cache = new Map();
    this.maxCacheSize = 100; // Max images to cache (each ~400KB)
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Generate page image with highlighted excerpt
   *
   * @param {string} pdfPath - Absolute path to PDF file
   * @param {number} pageNumber - Page number (1-indexed)
   * @param {Object} bbox - Bounding box {x, y, width, height} in PDF coordinates
   * @param {string} excerptId - Unique identifier for caching
   * @param {number} scale - Render scale (default 2.0 for retina quality)
   * @returns {Promise<Object>} { imageDataURL, width, height, cached }
   */
  async generatePageImage(pdfPath, pageNumber, bbox, excerptId, scale = 2.0) {
    // Check cache first
    const cached = this.getCached(pdfPath, pageNumber, excerptId);
    if (cached) {
      this.cacheHits++;
      console.log(`[PDFPageImageGenerator] Cache hit! (${this.cacheHits} hits, ${this.cacheMisses} misses)`);
      return { ...cached, cached: true };
    }

    this.cacheMisses++;
    console.log(`[PDFPageImageGenerator] Generating image for ${pdfPath} page ${pageNumber}...`);

    try {
      // Step 1: Load PDF with PDF.js
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        throw new Error('PDF.js library not loaded');
      }

      const loadingTask = pdfjsLib.getDocument(pdfPath);
      const pdfDoc = await loadingTask.promise;

      // Step 2: Get the specific page
      const page = await pdfDoc.getPage(pageNumber);

      // Step 3: Calculate viewport dimensions
      const viewport = page.getViewport({ scale });

      // Step 4: Create offscreen canvas for PDF rendering
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Step 5: Render PDF page to canvas
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Step 6: Draw highlight overlay on the same canvas
      if (bbox) {
        this.drawHighlight(ctx, bbox, scale, canvas.height);
      }

      // Step 7: Convert canvas to base64 PNG
      const imageDataURL = canvas.toDataURL('image/png', 0.9); // 90% quality

      const result = {
        imageDataURL,
        width: canvas.width,
        height: canvas.height,
        cached: false
      };

      // Step 8: Cache the result
      this.setCached(pdfPath, pageNumber, excerptId, result);

      console.log(`[PDFPageImageGenerator] Generated ${canvas.width}x${canvas.height}px image (${Math.round(imageDataURL.length / 1024)}KB)`);

      return result;

    } catch (error) {
      console.error('[PDFPageImageGenerator] Error generating image:', error);
      throw error;
    }
  }

  /**
   * Draw yellow highlight overlay on canvas
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} bbox - Bounding box {x, y, width, height}
   * @param {number} scale - Current render scale
   * @param {number} canvasHeight - Canvas height for Y-axis flipping
   */
  drawHighlight(ctx, bbox, scale, canvasHeight) {
    // Parse bbox if it's a JSON string
    const box = typeof bbox === 'string' ? JSON.parse(bbox) : bbox;

    // PDF.js uses bottom-left origin, canvas uses top-left
    // Flip Y coordinate: canvasY = canvasHeight - (pdfY + height)
    const flippedY = canvasHeight - ((box.y + box.height) * scale);

    // Draw semi-transparent yellow rectangle
    ctx.save();
    ctx.fillStyle = 'rgba(255, 235, 59, 0.4)'; // Yellow with 40% opacity
    ctx.fillRect(
      box.x * scale,
      flippedY,
      box.width * scale,
      box.height * scale
    );

    // Draw border for emphasis
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)'; // Darker yellow border
    ctx.lineWidth = 2;
    ctx.strokeRect(
      box.x * scale,
      flippedY,
      box.width * scale,
      box.height * scale
    );

    ctx.restore();

    console.log(`[PDFPageImageGenerator] Drew highlight at (${box.x}, ${box.y}) size ${box.width}x${box.height}`);
  }

  /**
   * Get cached image
   */
  getCached(pdfPath, pageNumber, excerptId) {
    if (!this.cache.has(pdfPath)) return null;
    const pdfCache = this.cache.get(pdfPath);

    if (!pdfCache.has(pageNumber)) return null;
    const pageCache = pdfCache.get(pageNumber);

    return pageCache.get(excerptId) || null;
  }

  /**
   * Set cached image
   */
  setCached(pdfPath, pageNumber, excerptId, result) {
    // Enforce cache size limit (simple FIFO eviction)
    const totalCached = this.getTotalCacheSize();
    if (totalCached >= this.maxCacheSize) {
      console.log(`[PDFPageImageGenerator] Cache full (${totalCached} items), clearing oldest entries`);
      this.clearOldestCache();
    }

    // Create nested maps if they don't exist
    if (!this.cache.has(pdfPath)) {
      this.cache.set(pdfPath, new Map());
    }
    const pdfCache = this.cache.get(pdfPath);

    if (!pdfCache.has(pageNumber)) {
      pdfCache.set(pageNumber, new Map());
    }
    const pageCache = pdfCache.get(pageNumber);

    pageCache.set(excerptId, result);
  }

  /**
   * Get total number of cached images
   */
  getTotalCacheSize() {
    let total = 0;
    for (const pdfCache of this.cache.values()) {
      for (const pageCache of pdfCache.values()) {
        total += pageCache.size;
      }
    }
    return total;
  }

  /**
   * Clear oldest cache entries (simple FIFO)
   */
  clearOldestCache() {
    // Clear the first PDF's cache entirely
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      console.log(`[PDFPageImageGenerator] Cleared cache for ${firstKey}`);
    }
  }

  /**
   * Clear all cached images
   */
  clearCache() {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log('[PDFPageImageGenerator] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      totalCached: this.getTotalCacheSize(),
      maxCacheSize: this.maxCacheSize,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: this.cacheHits + this.cacheMisses > 0
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

// Create singleton instance
const pdfPageImageGenerator = new PDFPageImageGenerator();

// Export for use in Node.js (rating-engine.js) and browser (bws-manager.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = pdfPageImageGenerator;
}

// Also expose globally for browser
if (typeof window !== 'undefined') {
  window.PDFPageImageGenerator = pdfPageImageGenerator;
}
