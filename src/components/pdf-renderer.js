/**
 * PDF Renderer Component
 *
 * Wraps PDF.js for rendering PDF pages to canvas
 * Handles zoom, page navigation, and loading states
 */

class PDFRenderer {
  constructor(containerEl) {
    this.container = containerEl;
    this.pdfDoc = null;
    this.currentPage = 1;
    this.scale = 1.0;
    this.canvas = null;
    this.ctx = null;
    this.renderTask = null; // Track ongoing render task for cancellation

    this.createCanvas();
  }

  /**
   * Create canvas element for PDF rendering
   */
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pdf-render-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
  }

  /**
   * Load PDF from file path
   * @param {string} filePath - Absolute file path to PDF
   */
  async loadPDF(filePath) {
    console.log('[PDFRenderer] Loading PDF from:', filePath);

    try {
      // Access PDF.js library (loaded via script tag in index-advanced.html)
      const pdfjsLib = window.pdfjsLib;

      if (!pdfjsLib) {
        throw new Error('PDF.js library not loaded. Make sure to include it in your HTML.');
      }

      // Worker path is already set in index-advanced.html
      // pdfjsLib.GlobalWorkerOptions.workerSrc is configured there

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument(filePath);

      loadingTask.onProgress = (progress) => {
        console.log(`[PDFRenderer] Loading: ${Math.round(progress.loaded / progress.total * 100)}%`);
      };

      this.pdfDoc = await loadingTask.promise;

      console.log(`[PDFRenderer] PDF loaded: ${this.pdfDoc.numPages} pages`);

      // Render first page
      await this.renderPage(1);

      return {
        success: true,
        numPages: this.pdfDoc.numPages
      };

    } catch (error) {
      console.error('[PDFRenderer] Error loading PDF:', error);
      this.showError('Failed to load PDF: ' + error.message);
      throw error;
    }
  }

  /**
   * Render a specific page
   * @param {number} pageNum - Page number (1-indexed)
   */
  async renderPage(pageNum) {
    if (!this.pdfDoc) {
      console.error('[PDFRenderer] No PDF loaded');
      return;
    }

    if (pageNum < 1 || pageNum > this.pdfDoc.numPages) {
      console.error('[PDFRenderer] Invalid page number:', pageNum);
      return;
    }

    // Cancel any ongoing render task
    if (this.renderTask) {
      this.renderTask.cancel();
    }

    this.currentPage = pageNum;

    console.log(`[PDFRenderer] Rendering page ${pageNum} at scale ${this.scale}`);

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });

      // Set canvas dimensions
      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;

      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Render page
      this.renderTask = page.render({
        canvasContext: this.ctx,
        viewport: viewport
      });

      await this.renderTask.promise;
      this.renderTask = null;

      console.log(`[PDFRenderer] Page ${pageNum} rendered successfully`);

      // Notify listeners (for highlight overlay updates)
      this.dispatchEvent('pageRendered', {
        pageNum,
        viewport,
        canvas: this.canvas
      });

    } catch (error) {
      if (error.name === 'RenderingCancelledException') {
        console.log('[PDFRenderer] Rendering cancelled (normal during rapid page changes)');
      } else {
        console.error('[PDFRenderer] Error rendering page:', error);
        this.showError('Failed to render page: ' + error.message);
      }
    }
  }

  /**
   * Set zoom level
   * @param {number} scale - Zoom scale (0.5 = 50%, 1.0 = 100%, 2.0 = 200%)
   */
  async setZoom(scale) {
    this.scale = scale;
    await this.renderPage(this.currentPage);
  }

  /**
   * Navigate to next page
   */
  async nextPage() {
    if (this.currentPage < this.pdfDoc.numPages) {
      await this.renderPage(this.currentPage + 1);
    }
  }

  /**
   * Navigate to previous page
   */
  async prevPage() {
    if (this.currentPage > 1) {
      await this.renderPage(this.currentPage - 1);
    }
  }

  /**
   * Jump to specific page
   * @param {number} pageNum - Page number to jump to
   */
  async goToPage(pageNum) {
    await this.renderPage(pageNum);
  }

  /**
   * Get current page number
   * @returns {number}
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get total number of pages
   * @returns {number}
   */
  getTotalPages() {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  /**
   * Get current scale/zoom
   * @returns {number}
   */
  getScale() {
    return this.scale;
  }

  /**
   * Get canvas dimensions
   * @returns {Object} {width, height}
   */
  getCanvasDimensions() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  /**
   * Show error message on canvas
   * @param {string} message - Error message
   */
  showError(message) {
    this.ctx.fillStyle = '#1e1e1e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = '16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
  }

  /**
   * Event dispatcher for component communication
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   */
  dispatchEvent(eventName, data) {
    const event = new CustomEvent('pdfRenderer:' + eventName, {
      detail: data
    });
    document.dispatchEvent(event);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.renderTask) {
      this.renderTask.cancel();
    }

    if (this.pdfDoc) {
      this.pdfDoc.destroy();
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// Expose globally for browser use
window.PDFRenderer = PDFRenderer;
