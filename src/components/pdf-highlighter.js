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
    this.tooltip = null;
    this.currentHoverExcerpt = null;

    this.createHighlightCanvas();
    this.createTooltip();
    this.setupEventListeners();
  }

  /**
   * Create overlay canvas for highlights
   */
  createHighlightCanvas() {
    this.highlightCanvas = document.createElement('canvas');
    this.highlightCanvas.className = 'pdf-highlight-canvas';
    this.highlightCanvas.style.pointerEvents = 'auto'; // Enable click events on highlights
    this.highlightCanvas.style.cursor = 'pointer'; // Show pointer cursor over highlights
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
   * Create tooltip element for rating data
   */
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'pdf-highlight-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      display: none;
      background: rgba(30, 30, 30, 0.95);
      color: #e0e0e0;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-size: 13px;
      line-height: 1.5;
      max-width: 320px;
      z-index: 10000;
      pointer-events: none;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    document.body.appendChild(this.tooltip);
  }

  /**
   * Listen to PDF renderer events
   */
  setupEventListeners() {
    // Store bound handlers as instance properties so we can remove them later
    this.pageRenderedHandler = (event) => {
      // Only respond if this event is for our renderer
      if (event.detail && event.detail.rendererId === this.renderer.id) {
        this.syncCanvasSize();
        this.drawHighlights();
      }
    };

    this.clickHandler = (event) => {
      this.handleClick(event);
    };

    this.mouseMoveHandler = (event) => {
      this.handleMouseMove(event);
    };

    this.mouseLeaveHandler = () => {
      this.hideTooltip();
    };

    // Add listeners
    document.addEventListener('pdfRenderer:pageRendered', this.pageRenderedHandler);
    this.highlightCanvas.addEventListener('click', this.clickHandler);
    this.highlightCanvas.addEventListener('mousemove', this.mouseMoveHandler);
    this.highlightCanvas.addEventListener('mouseleave', this.mouseLeaveHandler);
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
   * Clean up resources - clear data but keep DOM intact for reuse
   */
  cleanup() {
    // Clear excerpts to stop drawing old highlights
    this.excerpts = [];

    // Clear canvas
    if (this.highlightCtx) {
      this.highlightCtx.clearRect(0, 0, this.highlightCanvas.width, this.highlightCanvas.height);
    }

    // Remove ALL event listeners to stop responding to any events
    if (this.pageRenderedHandler) {
      document.removeEventListener('pdfRenderer:pageRendered', this.pageRenderedHandler);
    }
    if (this.clickHandler) {
      this.highlightCanvas.removeEventListener('click', this.clickHandler);
    }
    if (this.mouseMoveHandler) {
      this.highlightCanvas.removeEventListener('mousemove', this.mouseMoveHandler);
    }
    if (this.mouseLeaveHandler) {
      this.highlightCanvas.removeEventListener('mouseleave', this.mouseLeaveHandler);
    }

    // Hide and clear tooltip
    this.hideTooltip();
    this.currentHoverExcerpt = null;
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
   * Handle click on highlight canvas
   * @param {MouseEvent} event - Click event
   */
  handleClick(event) {
    const rect = this.highlightCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const excerpt = this.findExcerptAtPoint(x, y);

    if (excerpt) {
      console.log('[PDFHighlighter] Clicked on excerpt:', excerpt.id);

      // Dispatch custom event for excerpt list to listen to
      const clickEvent = new CustomEvent('highlight:clicked', {
        detail: { excerptId: excerpt.id, excerpt }
      });
      document.dispatchEvent(clickEvent);
    } else {
      // Clicked on empty space - clear active highlight
      this.clearActiveExcerpt();

      // Dispatch event to clear list selection too
      const clearEvent = new CustomEvent('highlight:cleared');
      document.dispatchEvent(clearEvent);
    }
  }

  /**
   * Handle mouse movement for tooltip display
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseMove(event) {
    const rect = this.highlightCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const excerpt = this.findExcerptAtPoint(x, y);

    if (excerpt && excerpt !== this.currentHoverExcerpt) {
      this.currentHoverExcerpt = excerpt;

      // Only show tooltip if excerpt has rating data
      if (excerpt.rating) {
        this.showTooltip(excerpt, event.clientX, event.clientY);
      } else {
        this.hideTooltip();
      }
    } else if (!excerpt && this.currentHoverExcerpt) {
      this.currentHoverExcerpt = null;
      this.hideTooltip();
    } else if (excerpt && excerpt === this.currentHoverExcerpt) {
      // Update tooltip position as mouse moves
      this.updateTooltipPosition(event.clientX, event.clientY);
    }
  }

  /**
   * Show tooltip with rating data
   * @param {Object} excerpt - Excerpt with rating data
   * @param {number} x - Mouse X position
   * @param {number} y - Mouse Y position
   */
  showTooltip(excerpt, x, y) {
    if (!excerpt.rating) return;

    const rating = excerpt.rating;

    // Format the tooltip content
    const scorePercent = Math.round(rating.relevance_score * 100);
    const confidencePercent = Math.round(rating.confidence * 100);

    let content = `<div style="margin-bottom: 8px;">`;
    content += `<strong style="color: #4fc3f7;">Rating Analysis</strong>`;
    content += `</div>`;

    content += `<div style="margin-bottom: 6px;">`;
    content += `<span style="color: #aaa;">Score:</span> `;
    content += `<strong style="color: ${scorePercent >= 70 ? '#66bb6a' : scorePercent >= 40 ? '#ffa726' : '#ef5350'}">${scorePercent}%</strong>`;
    content += `</div>`;

    content += `<div style="margin-bottom: 6px;">`;
    content += `<span style="color: #aaa;">Confidence:</span> `;
    content += `<strong style="color: #e0e0e0;">${confidencePercent}%</strong>`;
    content += `</div>`;

    if (rating.reasoning) {
      content += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">`;
      content += `<span style="color: #aaa; font-size: 11px;">Reasoning:</span><br>`;
      content += `<span style="color: #e0e0e0; font-size: 12px;">${this.escapeHtml(rating.reasoning)}</span>`;
      content += `</div>`;
    }

    this.tooltip.innerHTML = content;
    this.updateTooltipPosition(x, y);
    this.tooltip.style.display = 'block';
  }

  /**
   * Update tooltip position
   * @param {number} x - Mouse X position
   * @param {number} y - Mouse Y position
   */
  updateTooltipPosition(x, y) {
    const offset = 15;
    const tooltipRect = this.tooltip.getBoundingClientRect();

    let left = x + offset;
    let top = y + offset;

    // Keep tooltip within viewport
    if (left + tooltipRect.width > window.innerWidth) {
      left = x - tooltipRect.width - offset;
    }

    if (top + tooltipRect.height > window.innerHeight) {
      top = y - tooltipRect.height - offset;
    }

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    this.tooltip.style.display = 'none';
  }

  /**
   * Escape HTML for safe display
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /**
   * Find excerpt at canvas coordinates (for click handling)
   * Prefers smaller/more specific excerpts when multiple overlap
   * @param {number} x - Canvas X coordinate
   * @param {number} y - Canvas Y coordinate
   * @returns {Object|null} Excerpt at coordinates, or null
   */
  findExcerptAtPoint(x, y) {
    const currentPage = this.renderer.getCurrentPage();
    const scale = this.renderer.getScale();
    const canvasHeight = this.highlightCanvas.height;

    const pageExcerpts = this.excerpts.filter(e => e.page_number === currentPage && e.bbox);

    // Find all excerpts that contain this point
    const matchingExcerpts = [];

    for (const excerpt of pageExcerpts) {
      const bbox = typeof excerpt.bbox === 'string' ? JSON.parse(excerpt.bbox) : excerpt.bbox;

      // Apply same Y-flip transformation as in drawHighlights
      const flippedY = canvasHeight - ((bbox.y + bbox.height) * scale);

      const scaledBbox = {
        x: bbox.x * scale,
        y: flippedY,
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
        matchingExcerpts.push({
          excerpt,
          area: scaledBbox.width * scaledBbox.height
        });
      }
    }

    // If no matches, return null
    if (matchingExcerpts.length === 0) {
      return null;
    }

    // If multiple matches, return the one with the smallest area (most specific)
    matchingExcerpts.sort((a, b) => a.area - b.area);
    return matchingExcerpts[0].excerpt;
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

    // Remove tooltip
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
      this.tooltip = null;
    }
  }
}

// Expose globally for browser use
window.PDFHighlighter = PDFHighlighter;
