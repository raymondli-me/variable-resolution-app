/**
 * PDF Highlighter Component
 *
 * Draws highlight overlays on PDF pages based on bounding box coordinates
 * Handles multiple highlight states (default, active, search match)
 */

class PDFHighlighter {
  constructor(containerEl, pdfRenderer) {
    this.container = containerEl;
    this.renderer = pdfRenderer;
    this.highlightCanvas = null;
    this.highlightCtx = null;
    this.excerpts = [];
    this.activeExcerptId = null;
    this.searchMatches = new Set();

    this.createHighlightCanvas();
    this.setupEventListeners();
  }

  /**
   * Create overlay canvas for highlights
   */
  createHighlightCanvas() {
    this.highlightCanvas = document.createElement('canvas');
    this.highlightCanvas.className = 'pdf-highlight-canvas';
    this.highlightCanvas.style.pointerEvents = 'none'; // Let clicks pass through to PDF
    this.highlightCtx = this.highlightCanvas.getContext('2d');

    // Append to the canvas wrapper (not container) so it overlays the PDF canvas
    const wrapper = this.renderer.getCanvasWrapper();
    if (wrapper) {
      wrapper.appendChild(this.highlightCanvas);
    } else {
      // Fallback to container if wrapper not available
      this.container.appendChild(this.highlightCanvas);
    }
  }

  /**
   * Listen to PDF renderer events
   */
  setupEventListeners() {
    // Redraw highlights when page is rendered
    document.addEventListener('pdfRenderer:pageRendered', (event) => {
      this.syncCanvasSize();
      this.drawHighlights();
    });
  }

  /**
   * Sync highlight canvas size with PDF canvas
   */
  syncCanvasSize() {
    const dims = this.renderer.getCanvasDimensions();
    this.highlightCanvas.width = dims.width;
    this.highlightCanvas.height = dims.height;
  }

  /**
   * Load excerpts for highlighting
   * @param {Array} excerpts - Array of excerpt objects with bbox data
   */
  loadExcerpts(excerpts) {
    this.excerpts = excerpts;
    this.drawHighlights();
  }

  /**
   * Draw all highlights for current page
   */
  drawHighlights() {
    // Clear canvas
    this.highlightCtx.clearRect(0, 0, this.highlightCanvas.width, this.highlightCanvas.height);

    if (!this.excerpts || this.excerpts.length === 0) {
      return;
    }

    const currentPage = this.renderer.getCurrentPage();
    const scale = this.renderer.getScale();

    // Filter excerpts for current page
    const pageExcerpts = this.excerpts.filter(e => e.page_number === currentPage);

    console.log(`[PDFHighlighter] Drawing ${pageExcerpts.length} highlights for page ${currentPage}`);

    // Draw each excerpt's highlight
    for (const excerpt of pageExcerpts) {
      if (!excerpt.bbox) {
        continue; // Skip excerpts without bounding box data
      }

      const bbox = typeof excerpt.bbox === 'string' ? JSON.parse(excerpt.bbox) : excerpt.bbox;

      // PDF.js uses bottom-left origin, canvas uses top-left
      // Flip Y coordinate: canvasY = canvasHeight - (pdfY + height)
      const canvasHeight = this.highlightCanvas.height;
      const flippedY = canvasHeight - ((bbox.y + bbox.height) * scale);

      // Scale bbox to current zoom level with flipped Y
      const scaledBbox = {
        x: bbox.x * scale,
        y: flippedY,
        width: bbox.width * scale,
        height: bbox.height * scale
      };

      // Determine highlight color based on state
      const color = this.getHighlightColor(excerpt.id);

      // Draw highlight rectangle
      this.drawHighlightRect(scaledBbox, color);
    }
  }

  /**
   * Get highlight color based on excerpt state
   * @param {number} excerptId - Excerpt ID
   * @returns {string} RGBA color string
   */
  getHighlightColor(excerptId) {
    // Active excerpt (clicked/selected)
    if (excerptId === this.activeExcerptId) {
      return 'rgba(76, 175, 80, 0.5)'; // Green, 50% opacity
    }

    // Search match
    if (this.searchMatches.has(excerptId)) {
      return 'rgba(244, 67, 54, 0.5)'; // Red, 50% opacity
    }

    // Default excerpt
    return 'rgba(255, 235, 59, 0.4)'; // Yellow, 40% opacity
  }

  /**
   * Draw a single highlight rectangle
   * @param {Object} bbox - Bounding box {x, y, width, height}
   * @param {string} color - Fill color (RGBA)
   */
  drawHighlightRect(bbox, color) {
    // Fill rectangle
    this.highlightCtx.fillStyle = color;
    this.highlightCtx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);

    // Optional: Add border for better visibility
    // this.highlightCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    // this.highlightCtx.lineWidth = 1;
    // this.highlightCtx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
  }

  /**
   * Set active excerpt (highlight it differently)
   * @param {number} excerptId - Excerpt ID to highlight
   */
  setActiveExcerpt(excerptId) {
    this.activeExcerptId = excerptId;

    // Find which page this excerpt is on and navigate to it
    const excerpt = this.excerpts.find(e => e.id === excerptId);
    if (excerpt && excerpt.page_number !== this.renderer.getCurrentPage()) {
      this.renderer.goToPage(excerpt.page_number).then(() => {
        this.drawHighlights();
      });
    } else {
      this.drawHighlights();
    }
  }

  /**
   * Clear active excerpt
   */
  clearActiveExcerpt() {
    this.activeExcerptId = null;
    this.drawHighlights();
  }

  /**
   * Set search matches (highlight search results)
   * @param {Set|Array} excerptIds - Set or Array of excerpt IDs matching search
   */
  setSearchMatches(excerptIds) {
    this.searchMatches = excerptIds instanceof Set ? excerptIds : new Set(excerptIds);
    this.drawHighlights();
  }

  /**
   * Clear search matches
   */
  clearSearchMatches() {
    this.searchMatches.clear();
    this.drawHighlights();
  }

  /**
   * Redraw highlights (alias for drawHighlights)
   * Provided for convenience and semantic clarity
   */
  redraw() {
    this.drawHighlights();
  }

  /**
   * Find excerpt at canvas coordinates (for click handling)
   * @param {number} x - Canvas X coordinate
   * @param {number} y - Canvas Y coordinate
   * @returns {Object|null} Excerpt at coordinates, or null
   */
  findExcerptAtPoint(x, y) {
    const currentPage = this.renderer.getCurrentPage();
    const scale = this.renderer.getScale();

    const pageExcerpts = this.excerpts.filter(e => e.page_number === currentPage && e.bbox);

    for (const excerpt of pageExcerpts) {
      const bbox = typeof excerpt.bbox === 'string' ? JSON.parse(excerpt.bbox) : excerpt.bbox;
      const scaledBbox = {
        x: bbox.x * scale,
        y: bbox.y * scale,
        width: bbox.width * scale,
        height: bbox.height * scale
      };

      // Check if point is inside this bbox
      if (
        x >= scaledBbox.x &&
        x <= scaledBbox.x + scaledBbox.width &&
        y >= scaledBbox.y &&
        y <= scaledBbox.y + scaledBbox.height
      ) {
        return excerpt;
      }
    }

    return null;
  }

  /**
   * Get all excerpts for current page
   * @returns {Array} Excerpts on current page
   */
  getCurrentPageExcerpts() {
    const currentPage = this.renderer.getCurrentPage();
    return this.excerpts.filter(e => e.page_number === currentPage);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.highlightCanvas && this.highlightCanvas.parentNode) {
      this.highlightCanvas.parentNode.removeChild(this.highlightCanvas);
    }
  }
}

// Expose globally for browser use
window.PDFHighlighter = PDFHighlighter;
