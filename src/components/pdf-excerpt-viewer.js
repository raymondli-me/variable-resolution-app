/**
 * PDF Excerpt Viewer Component - Visual PDF Rendering with Highlights
 * Displays PDF with sentence-level excerpts highlighted on the actual document
 */
class PDFExcerptViewer {
  constructor() {
    this.currentCollection = null;
    this.currentPDF = null;
    this.allExcerpts = [];
    this.filteredExcerpts = [];
    this.currentPage = 1;
    this.excerptsPerPage = 50;
    this.searchTerm = '';
    this.renderer = null;
    this.highlighter = null;
    this.activeExcerptId = null;
    this.createModal();
  }

  createModal() {
    const modalHtml = `
      <div id="pdfExcerptViewerModal" class="pdf-viewer-modal" style="display: none;">
        <!-- Header -->
        <div class="pdf-viewer-header">
          <div>
            <h2 id="pdfCollectionTitle">PDF Collection</h2>
            <small id="pdfCollectionMeta"></small>
          </div>
          <button onclick="window.pdfExcerptViewer.close()">✕ Close</button>
        </div>

        <!-- PDF Selector (if multiple PDFs) -->
        <div id="pdfSelectorSection" class="pdf-selector-section" style="display: none; padding: 12px 24px; background: #2a2a2a; border-bottom: 1px solid #3a3a3a;">
          <label style="color: #e0e0e0; margin-right: 8px;">Select PDF:</label>
          <select id="pdfSelector" onchange="window.pdfExcerptViewer.switchPDF(this.value)" style="background: #1e1e1e; border: 1px solid #3a3a3a; color: #e0e0e0; padding: 6px 12px; border-radius: 4px;">
          </select>
        </div>

        <!-- Main Content: Side-by-side -->
        <div class="pdf-viewer-main">
          <!-- LEFT: PDF Viewer Panel (60%) -->
          <div class="pdf-viewer-panel">
            <div id="pdfViewerContainer" class="pdf-viewer-container">
              <div class="pdf-loading" id="pdfLoadingState">Loading PDF...</div>
            </div>
            <div class="pdf-controls">
              <button id="pdfPrevPage">◀ Prev</button>
              <span>Page <span id="pdfCurrentPage">1</span> / <span id="pdfTotalPages">1</span></span>
              <button id="pdfNextPage">Next ▶</button>
              <span style="margin-left: 16px;">|</span>
              <button id="pdfZoomOut">-</button>
              <span id="pdfZoomLevel">100%</span>
              <button id="pdfZoomIn">+</button>
            </div>
          </div>

          <!-- RIGHT: Excerpt List Panel (40%) -->
          <div class="excerpt-list-panel">
            <!-- Search Bar -->
            <div class="excerpt-search">
              <input type="text" id="excerptSearch" placeholder="Search excerpts..." oninput="window.pdfExcerptViewer.handleSearch(this.value)" />
              <span id="searchResultCount" style="color: #808080; font-size: 13px; margin-left: 8px;"></span>
            </div>

            <!-- Excerpts List -->
            <div class="excerpt-list" id="excerptsList">
              <div class="loading">Loading excerpts...</div>
            </div>

            <!-- Pagination -->
            <div class="excerpt-pagination">
              <button id="excerptPrevBtn" onclick="window.pdfExcerptViewer.prevPage()">◀</button>
              <span id="excerptPageInfo">Page 1</span>
              <button id="excerptNextBtn" onclick="window.pdfExcerptViewer.nextPage()">▶</button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="pdf-viewer-footer">
          <button onclick="window.pdfExcerptViewer.exportExcerpts()">Export</button>
          <button onclick="window.pdfExcerptViewer.close()">Close</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async show(collectionId) {
    try {
      // Load collection metadata
      const collection = await window.api.database.getCollection(collectionId);
      if (!collection) {
        this.showNotification('Failed to load collection', 'error');
        return;
      }

      this.currentCollection = collection;

      // Load PDFs in collection
      const pdfsResult = await window.api.pdf.list(collectionId);
      if (!pdfsResult.success || !pdfsResult.pdfs || pdfsResult.pdfs.length === 0) {
        this.showNotification('No PDFs found in this collection', 'error');
        return;
      }

      const pdfs = pdfsResult.pdfs;
      this.currentCollection.pdfs = pdfs;

      // Update header
      const titleEl = this.getElement('pdfCollectionTitle');
      if (titleEl) titleEl.textContent = collection.search_term;

      const totalExcerpts = pdfs.reduce((sum, pdf) => sum + (pdf.excerpts_count || 0), 0);
      const metaText = `${pdfs.length} PDF${pdfs.length > 1 ? 's' : ''} • ${totalExcerpts} excerpts • Created ${new Date(collection.created_at).toLocaleDateString()}`;
      const metaEl = this.getElement('pdfCollectionMeta');
      if (metaEl) metaEl.textContent = metaText;

      // Setup PDF selector if multiple PDFs
      if (pdfs.length > 1) {
        this.setupPDFSelector(pdfs);
      } else {
        const selectorSection = this.getElement('pdfSelectorSection');
        if (selectorSection) selectorSection.style.display = 'none';
      }

      // Load first PDF with visual viewer
      await this.switchPDF(pdfs[0].id);

      // Show modal
      const modal = this.getElement('pdfExcerptViewerModal');
      if (modal) modal.style.display = 'flex';

      // Close on Escape key
      this.escapeHandler = (e) => {
        if (e.key === 'Escape') {
          this.close();
        }
      };
      document.addEventListener('keydown', this.escapeHandler);

    } catch (error) {
      console.error('[PDFExcerptViewer] Error loading collection:', error);
      this.showNotification('Error loading collection: ' + error.message, 'error');
    }
  }

  setupPDFSelector(pdfs) {
    const selector = this.getElement('pdfSelector');
    if (selector) {
      selector.innerHTML = pdfs.map(pdf => `
        <option value="${pdf.id}">
          ${this.escapeHtml(pdf.title)} (${pdf.num_pages || 0} pages, ${pdf.excerpts_count || 0} excerpts)
        </option>
      `).join('');
    }

    const selectorSection = this.getElement('pdfSelectorSection');
    if (selectorSection) selectorSection.style.display = 'block';
  }

  async switchPDF(pdfId) {
    try {
      this.currentPDF = this.currentCollection.pdfs.find(p => p.id == pdfId);
      if (!this.currentPDF) {
        console.error('PDF not found:', pdfId);
        return;
      }

      // Show loading state
      const excerptsList = this.getElement('excerptsList');
      const loadingState = this.getElement('pdfLoadingState');

      if (excerptsList) excerptsList.innerHTML = '<div class="loading">Loading excerpts...</div>';
      if (loadingState) loadingState.style.display = 'flex';

      // Load excerpts
      const result = await window.api.pdf.getExcerpts(pdfId);
      if (!result.success || !result.data) {
        if (excerptsList) excerptsList.innerHTML = '<div class="empty-state">No excerpts found</div>';
        if (loadingState) loadingState.textContent = 'No excerpts available';
        return;
      }

      this.allExcerpts = result.data;
      this.filteredExcerpts = [...this.allExcerpts];
      this.currentPage = 1;
      this.searchTerm = '';

      const searchInput = this.getElement('excerptSearch');
      if (searchInput) searchInput.value = '';

      // Initialize visual PDF viewer
      await this.initializePDFViewer(pdfId);

      // Render excerpts list
      this.renderExcerpts();

    } catch (error) {
      console.error('[PDFExcerptViewer] Error loading excerpts:', error);
      const excerptsList = this.getElement('excerptsList');
      if (excerptsList) excerptsList.innerHTML = '<div class="empty-state error">Error loading excerpts</div>';
      const loadingState = this.getElement('pdfLoadingState');
      if (loadingState) loadingState.textContent = 'Error loading PDF';
    }
  }

  async initializePDFViewer(pdfId) {
    try {
      // Check if PDF.js is loaded
      if (typeof pdfjsLib === 'undefined') {
        console.error('[PDFExcerptViewer] PDF.js library not loaded');
        const loadingState = this.getElement('pdfLoadingState');
        if (loadingState) loadingState.textContent = 'PDF.js library not found';
        return;
      }

      // Get PDF file path
      const filePathResult = await window.api.pdf.getFilePath(pdfId);
      if (!filePathResult || !filePathResult.success) {
        console.error('[PDFExcerptViewer] Failed to get PDF file path:', filePathResult?.error);
        const loadingState = this.getElement('pdfLoadingState');
        if (loadingState) loadingState.textContent = 'Failed to locate PDF file';
        return;
      }

      const filePath = filePathResult.filePath;
      console.log('[PDFExcerptViewer] Loading PDF from:', filePath);

      // Clear container
      const container = this.getElement('pdfViewerContainer');
      if (!container) {
        console.error('[PDFExcerptViewer] pdfViewerContainer not found');
        return;
      }
      container.innerHTML = '';

      // Create renderer
      if (!window.PDFRenderer) {
        console.error('[PDFExcerptViewer] PDFRenderer class not found');
        container.innerHTML = '<div class="pdf-error">PDFRenderer component not loaded</div>';
        return;
      }

      this.renderer = new PDFRenderer(container);

      // Create highlighter
      if (!window.PDFHighlighter) {
        console.error('[PDFExcerptViewer] PDFHighlighter class not found');
      } else {
        this.highlighter = new PDFHighlighter(container, this.renderer);
      }

      // Load PDF (use file:// protocol for local files)
      const pdfUrl = filePath.startsWith('file://') ? filePath : 'file://' + filePath;
      await this.renderer.loadPDF(pdfUrl);

      console.log('[PDFExcerptViewer] PDF loaded successfully');

      // Load highlights if highlighter exists
      if (this.highlighter && this.allExcerpts.length > 0) {
        this.highlighter.loadExcerpts(this.allExcerpts);
      }

      // Setup controls
      this.setupControls();

    } catch (error) {
      console.error('[PDFExcerptViewer] Error initializing PDF viewer:', error);
      const loadingState = this.getElement('pdfLoadingState');
      if (loadingState) {
        loadingState.innerHTML = `
          <div class="pdf-error">
            <p>Failed to load PDF</p>
            <small>${error.message}</small>
          </div>
        `;
      }
    }
  }

  setupControls() {
    // Page navigation
    const prevBtn = this.getElement('pdfPrevPage');
    const nextBtn = this.getElement('pdfNextPage');

    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this.renderer) {
          this.renderer.prevPage();
        }
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        if (this.renderer) {
          this.renderer.nextPage();
        }
      };
    }

    // Zoom controls
    const zoomInBtn = this.getElement('pdfZoomIn');
    const zoomOutBtn = this.getElement('pdfZoomOut');

    if (zoomInBtn) {
      zoomInBtn.onclick = () => {
        if (this.renderer) {
          const scale = this.renderer.getScale() * 1.25;
          this.renderer.setZoom(Math.min(scale, 2.0));
          this.updateZoom();
        }
      };
    }

    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => {
        if (this.renderer) {
          const scale = this.renderer.getScale() / 1.25;
          this.renderer.setZoom(Math.max(scale, 0.5));
          this.updateZoom();
        }
      };
    }

    // Listen for page render events
    document.addEventListener('pdfRenderer:pageRendered', (e) => {
      const currentPageEl = this.getElement('pdfCurrentPage');
      const totalPagesEl = this.getElement('pdfTotalPages');

      if (currentPageEl) currentPageEl.textContent = e.detail.pageNum;
      if (totalPagesEl) totalPagesEl.textContent = this.renderer?.getTotalPages() || '?';

      // Update highlights when page changes
      if (this.highlighter) {
        this.highlighter.redraw();
      }
    });

    // Update initial zoom display
    this.updateZoom();
  }

  updateZoom() {
    if (this.renderer) {
      const scale = this.renderer.getScale();
      const zoomEl = this.getElement('pdfZoomLevel');
      if (zoomEl) zoomEl.textContent = Math.round(scale * 100) + '%';
    }
  }

  renderExcerpts() {
    const excerptsList = this.getElement('excerptsList');
    if (!excerptsList) return;

    if (this.filteredExcerpts.length === 0) {
      excerptsList.innerHTML = this.searchTerm
        ? '<div class="empty-state">No excerpts match your search</div>'
        : '<div class="empty-state">No excerpts found</div>';
      this.updatePagination();
      return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(this.filteredExcerpts.length / this.excerptsPerPage);
    const startIdx = (this.currentPage - 1) * this.excerptsPerPage;
    const endIdx = Math.min(startIdx + this.excerptsPerPage, this.filteredExcerpts.length);
    const pageExcerpts = this.filteredExcerpts.slice(startIdx, endIdx);

    // Render excerpt items for sidebar
    excerptsList.innerHTML = pageExcerpts.map(excerpt => {
      const text = excerpt.text_content || '';
      const activeClass = excerpt.id === this.activeExcerptId ? ' active' : '';

      return `
        <div class="excerpt-list-item${activeClass}" data-excerpt-id="${excerpt.id}" onclick="window.pdfExcerptViewer.onExcerptClick(${excerpt.id})">
          <div class="excerpt-page-number">Page ${excerpt.page_number || '?'} • Excerpt ${excerpt.excerpt_number || '?'}</div>
          <div class="excerpt-text">${this.escapeHtml(text.substring(0, 200))}${text.length > 200 ? '...' : ''}</div>
        </div>
      `;
    }).join('');

    this.updatePagination();
  }

  onExcerptClick(excerptId) {
    // Find the excerpt
    const excerpt = this.allExcerpts.find(e => e.id === excerptId);
    if (!excerpt) return;

    // Set as active
    this.activeExcerptId = excerptId;

    // Update visual state in list
    document.querySelectorAll('.excerpt-list-item').forEach(el => {
      el.classList.remove('active');
    });
    const element = document.querySelector(`[data-excerpt-id="${excerptId}"]`);
    if (element) {
      element.classList.add('active');
    }

    // Jump to page in PDF viewer
    if (this.renderer && excerpt.page_number) {
      this.renderer.goToPage(excerpt.page_number);
    }

    // Highlight in PDF
    if (this.highlighter) {
      this.highlighter.setActiveExcerpt(excerptId);
    }
  }

  updatePagination() {
    const totalPages = Math.ceil(this.filteredExcerpts.length / this.excerptsPerPage);

    // Update page info
    const pageInfo = this.getElement('excerptPageInfo');
    if (pageInfo) {
      if (this.filteredExcerpts.length === 0) {
        pageInfo.textContent = 'No results';
      } else {
        const startIdx = (this.currentPage - 1) * this.excerptsPerPage + 1;
        const endIdx = Math.min(this.currentPage * this.excerptsPerPage, this.filteredExcerpts.length);
        pageInfo.textContent = `Showing ${startIdx}-${endIdx} of ${this.filteredExcerpts.length} (Page ${this.currentPage}/${totalPages})`;
      }
    }

    // Update button states
    const prevBtn = this.getElement('excerptPrevBtn');
    const nextBtn = this.getElement('excerptNextBtn');

    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages || totalPages === 0;

    // Update search result count
    const searchResultCount = this.getElement('searchResultCount');
    if (searchResultCount) {
      if (this.searchTerm) {
        searchResultCount.textContent = `${this.filteredExcerpts.length} results`;
      } else {
        searchResultCount.textContent = '';
      }
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.filteredExcerpts.length / this.excerptsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderExcerpts();
      document.querySelector('.excerpt-list').scrollTop = 0;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderExcerpts();
      document.querySelector('.excerpt-list').scrollTop = 0;
    }
  }

  handleSearch(searchTerm) {
    this.searchTerm = searchTerm.toLowerCase().trim();

    if (!this.searchTerm) {
      this.filteredExcerpts = [...this.allExcerpts];
    } else {
      this.filteredExcerpts = this.allExcerpts.filter(excerpt =>
        excerpt.text_content.toLowerCase().includes(this.searchTerm)
      );
    }

    this.currentPage = 1;
    this.renderExcerpts();

    // TODO: Highlight search matches in PDF (future enhancement)
  }

  async exportExcerpts() {
    if (!this.currentPDF || !this.filteredExcerpts || this.filteredExcerpts.length === 0) {
      this.showNotification('No excerpts to export', 'error');
      return;
    }

    try {
      // Generate text content
      const title = this.currentPDF.title || 'PDF Excerpts';
      const date = new Date().toLocaleString();
      let content = `${title}\n`;
      content += `Exported: ${date}\n`;
      content += `Total excerpts: ${this.filteredExcerpts.length}\n`;
      content += `\n${'='.repeat(80)}\n\n`;

      this.filteredExcerpts.forEach((excerpt, idx) => {
        content += `Excerpt ${excerpt.excerpt_number || idx + 1} (Page ${excerpt.page_number || '?'})\n`;
        content += `${'-'.repeat(80)}\n`;
        content += `${excerpt.text_content}\n\n`;
      });

      // Create blob and download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentPDF.title.replace(/[^a-z0-9]/gi, '_')}_excerpts.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification('Excerpts exported successfully', 'success');
    } catch (error) {
      console.error('[PDFExcerptViewer] Export error:', error);
      this.showNotification('Export failed: ' + error.message, 'error');
    }
  }

  close() {
    const modal = this.getElement('pdfExcerptViewerModal');
    if (modal) modal.style.display = 'none';

    // Remove escape key handler
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }

    // Cleanup PDF renderer
    if (this.renderer) {
      this.renderer.destroy && this.renderer.destroy();
      this.renderer = null;
    }

    if (this.highlighter) {
      this.highlighter.destroy && this.highlighter.destroy();
      this.highlighter = null;
    }

    // Reset state
    this.currentCollection = null;
    this.currentPDF = null;
    this.allExcerpts = [];
    this.filteredExcerpts = [];
    this.currentPage = 1;
    this.searchTerm = '';
    this.activeExcerptId = null;
  }

  // Helpers
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /**
   * Safely get element by ID with null check
   * @param {string} id - Element ID
   * @returns {HTMLElement|null}
   */
  getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[PDFExcerptViewer] Element not found: ${id}`);
    }
    return el;
  }

  showNotification(message, type = 'info') {
    if (window.toastNotification) {
      window.toastNotification[type](message);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
}

// Initialize and expose globally
const pdfExcerptViewer = new PDFExcerptViewer();
window.pdfExcerptViewer = pdfExcerptViewer;
