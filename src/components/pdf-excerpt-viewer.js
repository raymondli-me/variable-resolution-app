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
    this.currentExcerpt = null;

    // Layout state
    this.layoutState = this.loadLayoutState();
    this.isResizingHorizontal = false;
    this.isResizingVertical = false;

    // Text size state
    this.detailPanelFontSize = this.loadTextSize();

    // Rating variables state
    this.availableVariables = [];
    this.selectedVariable = null;
    this.selectedDepth = 'brief';
    this.autoSaveTimeout = null;
    this.progressUpdateTimeout = null;

    // AI rating cache: Map<"excerptId_variableId", rating>
    this.aiRatingCache = new Map();

    // Rate All state
    this.rateAllInProgress = false;
    this.rateAllPaused = false;
    this.rateAllCurrentIndex = 0;
    this.rateAllExcerpts = [];
    this.currentlyRatingExcerptId = null;
    this.rateAllBatchSize = 10; // Number of excerpts to rate in parallel
    this.currentBatchExcerptIds = new Set(); // IDs of excerpts in current batch

    // Track excerpts currently being rated to prevent duplicates
    this.excerptRatingLocks = new Set(); // Set of "excerptId_variableId" strings

    // AI rating on click toggle
    this.aiRatingOnClick = true; // Enable/disable AI rating when clicking excerpts

    // Speech recognition
    this.recognition = null;
    this.isRecording = false;

    this.createModal();
    this.setupResizers();
    this.setupSpeechRecognition();
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
          <div class="pdf-viewer-panel" id="pdfViewerPanel">
            <div id="pdfViewerContainer" class="pdf-viewer-container">
              <div class="pdf-loading" id="pdfLoadingState">Loading PDF...</div>
            </div>
            <div class="pdf-controls">
              <button id="pdfPrevPage">◀ Prev</button>
              <span>Page <span id="pdfCurrentPage">1</span> / <span id="pdfTotalPages">1</span></span>
              <button id="pdfNextPage">Next ▶</button>
              <span style="margin-left: 16px;">|</span>
              <button id="pdfZoomOut" style="min-width: 32px;">-</button>
              <span id="pdfZoomLevel" style="display: inline-block; min-width: 50px; text-align: center;">100%</span>
              <button id="pdfZoomIn" style="min-width: 32px;">+</button>
            </div>
          </div>

          <!-- Horizontal Resizer -->
          <div class="panel-resizer horizontal-resizer" id="horizontalResizer"></div>

          <!-- RIGHT: Excerpt Detail & Analysis Panel (40%) -->
        <div id="excerptDetailPanel" class="excerpt-detail-panel">
          <div class="detail-panel-header">
            <h3>Qualitative Coding Dashboard</h3>
            <div class="text-size-controls">
              <button class="text-size-btn text-size-small" onclick="window.pdfExcerptViewer.decreaseTextSize()" title="Decrease text size">a</button>
              <button class="text-size-btn text-size-large" onclick="window.pdfExcerptViewer.increaseTextSize()" title="Increase text size">A</button>
            </div>
            <button onclick="window.pdfExcerptViewer.hideDetailPanel()">✕</button>
          </div>

          <div class="detail-panel-content" style="overflow-y: auto; flex: 1;">
            <!-- Excerpt Text -->
            <div class="detail-section">
              <h4>Excerpt Text</h4>
              <div id="detailExcerptText" class="detail-excerpt-text" style="padding: 12px; background: #111827; border-radius: 4px; line-height: 1.6; color: #e5e7eb;"></div>
            </div>

            <!-- Variable Info Section -->
            <div class="detail-section" id="variableInfoSection" style="display: none;">
              <h4>Variable Information</h4>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <label style="color: #9ca3af; font-weight: 600;">Variable:</label>
                <select id="variableSelector" onchange="window.pdfExcerptViewer.onVariableChanged()" style="flex: 1; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #e5e7eb; border-radius: 4px; font-size: 14px;">
                  <option value="">Loading variables...</option>
                </select>
              </div>
              <div id="variableInfo" style="padding: 12px; background: #111827; border-radius: 4px; font-size: 13px; color: #9ca3af; display: none;">
                <div id="variableDefinition" style="margin-bottom: 12px; line-height: 1.6; color: #d1d5db;"></div>
                <div style="display: flex; gap: 24px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid #374151; margin-bottom: 12px;">
                  <div><span style="color: #6b7280; font-weight: 600;">Scale:</span> <span id="variableScaleType" style="color: #e5e7eb;"></span></div>
                  <div><span style="color: #6b7280; font-weight: 600;">Depth:</span> <span id="variableReasoningDepth" style="color: #e5e7eb;"></span></div>
                </div>
                <button id="toggleAnchorsBtn" onclick="window.pdfExcerptViewer.toggleAnchors()" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; cursor: pointer; color: #e5e7eb; font-size: 12px; margin-bottom: 8px;">
                  <span id="anchorsToggleIcon">▶</span> Show Anchor Definitions
                </button>
                <div id="variableAnchors" style="display: none; padding: 12px; background: #0f1419; border-radius: 4px; border: 1px solid #374151;">
                  <!-- Dynamically populated -->
                </div>
              </div>
            </div>

            <!-- Rating Dashboard (Two Columns) -->
            <div class="detail-section">
              <div class="rating-dashboard">
                <!-- Your Analysis Column -->
                <div class="rating-column your-analysis">
                  <h5>👤 Your Analysis</h5>
                  <div class="rating-field">
                    <label>Variable:</label>
                    <div id="humanVariable" class="variable-display">-</div>
                  </div>
                  <div class="rating-field" id="scoreField">
                    <label>Score:</label>
                    <div class="score-buttons" id="humanScoreButtons">
                      <!-- Dynamically generated based on variable scale type -->
                    </div>
                  </div>
                  <div class="rating-field">
                    <label style="display: flex; align-items: center; gap: 8px;">
                      <span>Reasoning / Notes:</span>
                      <button id="speechToTextBtn" style="padding: 4px 8px; background: #374151; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;" title="Speech to Text">🎤</button>
                    </label>
                    <textarea id="detailNotes" class="detail-notes" placeholder="Enter your reasoning and notes..." style="min-height: 150px;"></textarea>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 12px; margin-top: 8px;">
                    <span id="autoSaveStatus">Auto-save enabled</span>
                  </div>
                </div>

                <!-- AI Co-Pilot Analysis Column -->
                <div class="rating-column ai-analysis">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #334155);">
                    <h5 style="margin: 0;">🤖 AI Co-Pilot Analysis</h5>
                    <button id="rerateBtn" onclick="window.pdfExcerptViewer.rerateWithAI()" style="padding: 6px 12px; background: #10b981; border: none; border-radius: 4px; color: white; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Generate a new AI rating">
                      <span style="font-size: 14px;">🔄</span> Re-rate
                    </button>
                  </div>
                  <div id="aiCopilotDisplay" class="ai-copilot-display">
                    <div class="ai-copilot-loading" id="aiCopilotLoading" style="display: none; text-align: center; padding: 40px; color: #10b981;">
                      <span style="font-size: 24px;">🤖</span>
                      <div style="margin-top: 8px;">AI is analyzing...</div>
                    </div>
                    <div class="ai-copilot-content" id="aiCopilotContent" style="display: none;">
                      <div class="rating-field">
                        <label>Variable:</label>
                        <div id="aiVariable" class="variable-display">-</div>
                      </div>
                      <div class="rating-field">
                        <label>Score:</label>
                        <div id="aiScore" class="score-display" style="font-size: 18px; font-weight: 600; color: #10b981;">N/A</div>
                      </div>
                      <div class="rating-field">
                        <label>Reasoning / Notes:</label>
                        <div id="aiReasoning" class="ai-reasoning" style="min-height: 150px; padding: 12px; background: rgba(30, 41, 59, 0.4); border-radius: 4px; line-height: 1.6; color: #d1d5db;">N/A</div>
                      </div>
                    </div>
                    <div class="ai-copilot-error" id="aiCopilotError" style="display: none; color: #ef4444; padding: 20px; text-align: center;">
                      <span id="aiErrorMessage">Error loading AI analysis</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Vertical Resizer between Rating Dashboard and Excerpts -->
            <div class="panel-resizer vertical-resizer" id="verticalResizer"></div>

            <!-- Excerpt List Section (at bottom of rating panel) -->
            <div class="detail-section" id="excerptListSection" style="flex: 1; min-height: 200px; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0;">Excerpts</h4>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <div id="ratingProgress" class="rating-progress-indicator" style="display: flex; gap: 12px; font-size: 11px; color: #9ca3af;">
                    <span id="humanProgress" title="Human ratings">👤 <span style="color: #3b82f6; font-weight: 600;">0/0</span></span>
                    <span id="aiProgress" title="AI ratings">🤖 <span style="color: #10b981; font-weight: 600;">0/0</span></span>
                  </div>
                  <button id="rateAllBtn" onclick="window.pdfExcerptViewer.rateAllWithAI()" style="padding: 4px 10px; background: #10b981; border: none; border-radius: 4px; color: white; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;" title="Rate all unrated excerpts with AI">
                    🤖 Rate All
                  </button>
                  <button id="pauseRateAllBtn" onclick="window.pdfExcerptViewer.pauseRateAll()" style="display: none; padding: 4px 10px; background: #f59e0b; border: none; border-radius: 4px; color: white; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;" title="Pause AI rating">
                    ⏸ Pause
                  </button>
                  <button id="resumeRateAllBtn" onclick="window.pdfExcerptViewer.resumeRateAll()" style="display: none; padding: 4px 10px; background: #10b981; border: none; border-radius: 4px; color: white; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;" title="Resume AI rating">
                    ▶ Resume
                  </button>
                </div>
              </div>
              <div id="rateAllStatus" style="display: none; padding: 8px; background: #1e293b; border-radius: 4px; margin-bottom: 8px; color: #10b981; font-size: 12px; text-align: center;">
                AI Rating in Progress...
              </div>
              <div id="rateAllSettings" style="display: flex; flex-direction: column; gap: 8px; padding: 8px; background: #111827; border-radius: 4px; margin-bottom: 8px; font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <label style="color: #9ca3af;">Batch Size:</label>
                  <input type="number" id="batchSizeInput" min="1" max="50" value="10" onchange="window.pdfExcerptViewer.updateBatchSize(this.value)" style="width: 60px; padding: 4px 8px; background: #1f2937; border: 1px solid #374151; color: #e5e7eb; border-radius: 4px;" />
                  <span style="color: #6b7280; font-size: 11px;">(excerpts rated in parallel)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" id="aiRatingOnClickToggle" checked onchange="window.pdfExcerptViewer.toggleAIRatingOnClick(this.checked)" style="cursor: pointer;" />
                  <label for="aiRatingOnClickToggle" style="color: #9ca3af; cursor: pointer;">Auto-rate with AI when clicking excerpts</label>
                </div>
              </div>
              <div class="excerpt-list-panel" id="excerptListPanel" style="flex: 1; margin: 0; border: none; background: transparent;">
                <!-- Search Bar -->
                <div class="excerpt-search" style="padding: 8px; background: #111827; border-radius: 4px;">
                  <input type="text" id="excerptSearch" placeholder="Search excerpts..." oninput="window.pdfExcerptViewer.handleSearch(this.value)" style="width: 100%; padding: 6px; background: #1f2937; border: 1px solid #374151; color: #e5e7eb; border-radius: 4px;" />
                  <span id="searchResultCount" style="color: #808080; font-size: 12px; margin-top: 4px; display: block;"></span>
                </div>

                <!-- Excerpts List -->
                <div class="excerpt-list" id="excerptsList" style="flex: 1;">
                  <div class="loading">Loading excerpts...</div>
                </div>

                <!-- Pagination -->
                <div class="excerpt-pagination" style="padding: 8px; background: #111827;">
                  <button id="excerptPrevBtn" onclick="window.pdfExcerptViewer.prevPage()">◀</button>
                  <span id="excerptPageInfo">Page 1</span>
                  <button id="excerptNextBtn" onclick="window.pdfExcerptViewer.nextPage()">▶</button>
                </div>
              </div>
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

  async show(collectionId, pdfId = null) {
    try {
      console.log('[PDFExcerptViewer] show() called with collectionId:', collectionId, 'pdfId:', pdfId);

      // Load collection metadata
      const collection = await window.api.database.getCollection(collectionId);
      console.log('[PDFExcerptViewer] getCollection result:', collection);

      if (!collection) {
        console.error('[PDFExcerptViewer] Failed to load collection - getCollection returned null/undefined for collectionId:', collectionId);
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

      let pdfs = pdfsResult.pdfs;

      // Filter to specific PDF if pdfId is provided
      if (pdfId) {
        pdfs = pdfs.filter(pdf => pdf.id === pdfId);
        if (pdfs.length === 0) {
          this.showNotification('PDF not found', 'error');
          return;
        }
      }

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

      // Load rating variables for this collection
      await this.loadVariables();

      // Setup auto-save on textarea
      setTimeout(() => {
        const textarea = document.querySelector('#detailNotes');
        if (textarea) {
          textarea.addEventListener('input', () => this.triggerAutoSave());
        }

        // Trigger auto-save when score buttons are clicked
        const humanScoreButtons = document.querySelector('#humanScoreButtons');
        if (humanScoreButtons) {
          humanScoreButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('score-btn')) {
              this.triggerAutoSave();
            }
          });
        }
      }, 500);

      // Show modal
      const modal = this.getElement('pdfExcerptViewerModal');
      if (modal) modal.style.display = 'flex';

      // Apply saved layout state
      this.applyLayoutState();

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
      const loadingState = this.getElement('pdfLoadingState', true); // Silent - may not exist after container cleared

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

      // Update rating progress indicators
      this.throttledUpdateProgress();

    } catch (error) {
      console.error('[PDFExcerptViewer] Error loading excerpts:', error);
      const excerptsList = this.getElement('excerptsList');
      if (excerptsList) excerptsList.innerHTML = '<div class="empty-state error">Error loading excerpts</div>';
      const loadingState = this.getElement('pdfLoadingState', true);
      if (loadingState) loadingState.textContent = 'Error loading PDF';
    }
  }

  async initializePDFViewer(pdfId) {
    try {
      // Check if PDF.js is loaded
      if (typeof pdfjsLib === 'undefined') {
        console.error('[PDFExcerptViewer] PDF.js library not loaded');
        const loadingState = this.getElement('pdfLoadingState', true);
        if (loadingState) loadingState.textContent = 'PDF.js library not found';
        return;
      }

      // Get PDF file path
      const filePathResult = await window.api.pdf.getFilePath(pdfId);
      if (!filePathResult || !filePathResult.success) {
        console.error('[PDFExcerptViewer] Failed to get PDF file path:', filePathResult?.error);
        const loadingState = this.getElement('pdfLoadingState', true);
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

      // Set initial zoom to 200%
      await this.renderer.setZoom(2.0);
      this.updateZoom();

      // Load highlights if highlighter exists
      if (this.highlighter && this.allExcerpts.length > 0) {
        this.highlighter.loadExcerpts(this.allExcerpts);
      }

      // Setup controls
      this.setupControls();

      // Setup bi-directional linking: listen for highlight clicks
      this.setupHighlightClickListener();

    } catch (error) {
      console.error('[PDFExcerptViewer] Error initializing PDF viewer:', error);
      const loadingState = this.getElement('pdfLoadingState', true);
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
          this.renderer.setZoom(Math.min(scale, 4.0));
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

  /**
   * Setup listener for highlight clicks (bi-directional linking)
   */
  setupHighlightClickListener() {
    // Remove existing listeners if any
    if (this.highlightClickHandler) {
      document.removeEventListener('highlight:clicked', this.highlightClickHandler);
    }
    if (this.highlightClearHandler) {
      document.removeEventListener('highlight:cleared', this.highlightClearHandler);
    }

    // Create click handler
    this.highlightClickHandler = (event) => {
      const excerptId = event.detail.excerptId;
      console.log('[PDFExcerptViewer] Highlight clicked, scrolling to excerpt:', excerptId);

      // Find the excerpt in our list
      const excerpt = this.allExcerpts.find(e => e.id === excerptId);
      if (!excerpt) {
        console.warn('[PDFExcerptViewer] Excerpt not found:', excerptId);
        return;
      }

      // Calculate which page of the excerpt list this excerpt is on
      const excerptIndex = this.filteredExcerpts.findIndex(e => e.id === excerptId);
      if (excerptIndex === -1) {
        console.warn('[PDFExcerptViewer] Excerpt not in filtered list:', excerptId);
        return;
      }

      // Navigate to the correct page
      const targetPage = Math.floor(excerptIndex / this.excerptsPerPage) + 1;
      if (targetPage !== this.currentPage) {
        this.currentPage = targetPage;
        this.renderExcerpts();
      }

      // Set as active and scroll into view
      this.activeExcerptId = excerptId;
      this.currentExcerpt = excerpt;

      // Update highlighter to show active state (green highlight)
      if (this.highlighter) {
        this.highlighter.setActiveExcerpt(excerptId);
      }

      // Show detail panel with excerpt data
      this.showDetailPanel(excerpt);

      // Trigger AI Co-Pilot rating in parallel (same as onExcerptClick)
      this.triggerAICopilotRating(excerpt);

      // Wait a bit for render to complete, then scroll
      setTimeout(() => {
        // Remove active class from all items first
        document.querySelectorAll('.excerpt-list-item').forEach(el => {
          el.classList.remove('active');
        });

        const element = document.querySelector(`[data-excerpt-id="${excerptId}"]`);
        if (element) {
          element.classList.add('active');
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    };

    // Create clear handler
    this.highlightClearHandler = () => {
      console.log('[PDFExcerptViewer] Highlight cleared');

      // Clear active state
      this.activeExcerptId = null;
      this.currentExcerpt = null;

      // Remove active class from all excerpt items
      document.querySelectorAll('.excerpt-list-item').forEach(el => {
        el.classList.remove('active');
      });

      // Clear active highlight in PDF if highlighter exists
      if (this.highlighter) {
        this.highlighter.clearActiveExcerpt();
      }

      // Hide detail panel (currently a no-op but kept for future compatibility)
      this.hideDetailPanel();
    };

    // Add listeners
    document.addEventListener('highlight:clicked', this.highlightClickHandler);
    document.addEventListener('highlight:cleared', this.highlightClearHandler);
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
      const batchClass = this.currentBatchExcerptIds.has(excerpt.id) ? ' batch-rating' : '';
      const ratingIndicator = this.currentBatchExcerptIds.has(excerpt.id) ? '<span style="color: #10b981; font-size: 14px; margin-left: 8px; animation: pulse 1.5s ease-in-out infinite;">🤖</span>' : '';

      return `
        <div class="excerpt-list-item${activeClass}${batchClass}" data-excerpt-id="${excerpt.id}" onclick="window.pdfExcerptViewer.onExcerptClick(${excerpt.id})">
          <div class="excerpt-page-number">Page ${excerpt.page_number || '?'} • Excerpt ${excerpt.excerpt_number || '?'}${ratingIndicator}</div>
          <div class="excerpt-text">${this.escapeHtml(text.substring(0, 200))}${text.length > 200 ? '...' : ''}</div>
        </div>
      `;
    }).join('');

    this.updatePagination();

    // Apply current text size to newly rendered items
    this.applyTextSize();
  }

  onExcerptClick(excerptId) {
    // Find the excerpt
    const excerpt = this.allExcerpts.find(e => e.id === excerptId);
    if (!excerpt) return;

    // Set as active
    this.activeExcerptId = excerptId;
    this.currentExcerpt = excerpt;

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

    // Show and populate detail panel
    this.showDetailPanel(excerpt);

    // Trigger AI Co-Pilot rating in parallel (if API is available)
    this.triggerAICopilotRating(excerpt);
  }

  /**
   * Trigger AI Co-Pilot rating for an excerpt
   * @param {Object} excerpt - The excerpt to rate
   */
  async triggerAICopilotRating(excerpt) {
    // Check if API is available
    if (!window.api?.ai?.rateSingleExcerpt) {
      console.warn('[PDFExcerptViewer] AI rating API not available');
      return;
    }

    // Check if a variable is selected
    if (!this.selectedVariable) {
      this.showAICopilotError('No variable selected. Please select a variable to rate.');
      return;
    }

    // Check cache first
    const cacheKey = `${excerpt.id}_${this.selectedVariable.id}`;
    if (this.aiRatingCache.has(cacheKey)) {
      const cachedRating = this.aiRatingCache.get(cacheKey);
      this.updateAICopilotDisplay(cachedRating);
      console.log('[PDFExcerptViewer] Using cached AI rating:', cachedRating);
      return;
    }

    // Load existing AI rating from database
    try {
      const dbResult = await window.api.pdf.getAIExcerptRating({
        excerpt_id: excerpt.id,
        variable_id: this.selectedVariable.id
      });

      if (dbResult.success && dbResult.data) {
        // Found existing AI rating in database
        const rating = {
          score: dbResult.data.score,
          reasoning: dbResult.data.reasoning
        };

        // Cache it
        this.aiRatingCache.set(cacheKey, rating);

        // Display it
        this.updateAICopilotDisplay(rating);
        console.log('[PDFExcerptViewer] Loaded AI rating from database:', rating);
        return;
      }
    } catch (error) {
      console.error('[PDFExcerptViewer] Error loading AI rating from database:', error);
      // Continue to check if we should generate new rating
    }

    // No existing rating found - check if we should generate a NEW one
    const shouldGenerateNewRating = this.aiRatingOnClick && !(this.rateAllInProgress && !this.rateAllPaused);

    if (!shouldGenerateNewRating) {
      // Don't generate new rating, but show a dimmed message
      const reason = !this.aiRatingOnClick
        ? 'Enable "Auto-rate with AI" toggle to generate ratings on click.'
        : 'Rate All is running. New ratings will be generated automatically.';

      this.showAICopilotDisabled(reason);
      console.log('[PDFExcerptViewer] Not generating new rating:', reason);
      return;
    }

    // Check if this excerpt is already being rated (prevent double-rating)
    if (this.excerptRatingLocks.has(cacheKey)) {
      console.log('[PDFExcerptViewer] Excerpt already being rated, skipping duplicate request:', cacheKey);
      this.showAICopilotLoading(); // Show loading state while waiting
      return;
    }

    // Acquire lock to prevent double-rating
    this.excerptRatingLocks.add(cacheKey);

    // Show loading state
    this.showAICopilotLoading();

    try {
      // Build research intent from selected variable
      const researchIntent = `Rate this excerpt on the variable "${this.selectedVariable.label}". ${this.selectedVariable.definition || ''}`;

      // Build PDF context
      const pdfContext = {
        title: this.currentPDF?.title || 'PDF Document',
        page_number: excerpt.page_number,
        variable: {
          label: this.selectedVariable.label,
          definition: this.selectedVariable.definition,
          scale_type: this.selectedVariable.scale_type,
          anchors: this.selectedVariable.anchors,
          reasoning_depth: this.selectedVariable.reasoning_depth
        }
      };

      // Call AI rating API
      const result = await window.api.ai.rateSingleExcerpt({
        excerptText: excerpt.text_content,
        pdfContext: pdfContext,
        researchIntent: researchIntent
      });

      if (result.success && result.rating) {
        // Cache the rating
        this.aiRatingCache.set(cacheKey, result.rating);

        // Store AI rating in excerpt
        excerpt.aiRating = result.rating;

        // Update display with variable-specific information
        this.updateAICopilotDisplay(result.rating);

        console.log('[PDFExcerptViewer] AI rating received and cached:', result.rating);

        // Save AI rating to database for persistence
        try {
          await window.api.pdf.saveAIExcerptRating({
            excerpt_id: excerpt.id,
            variable_id: this.selectedVariable.id,
            score: result.rating.score || result.rating.relevance || 'N/A',
            reasoning: result.rating.reasoning || result.rating.analysis || null
          });
          console.log('[PDFExcerptViewer] AI rating saved to database');
        } catch (dbError) {
          console.error('[PDFExcerptViewer] Failed to save AI rating to database:', dbError);
        }

        // Update rating progress after AI rating
        this.throttledUpdateProgress();
      } else {
        this.showAICopilotError(result.error || 'Failed to get AI rating');
      }
    } catch (error) {
      console.error('[PDFExcerptViewer] AI rating error:', error);
      this.showAICopilotError(error.message || 'Error getting AI rating');
    } finally {
      // Release lock
      this.excerptRatingLocks.delete(cacheKey);
    }
  }

  /**
   * Show and populate the detail panel with excerpt data
   * @param {Object} excerpt - The excerpt to display
   */
  async showDetailPanel(excerpt) {
    const panel = this.getElement('excerptDetailPanel');
    if (!panel) return;

    // Populate full text
    const textEl = this.getElement('detailExcerptText');
    if (textEl) {
      textEl.textContent = excerpt.text_content || 'No text available';
    }

    // Reset AI Co-Pilot display to initial state BEFORE loading human rating
    // This prevents the AI data from being cleared after it's loaded
    this.resetAICopilotDisplay();

    // Load existing human rating from database
    await this.loadHumanRating(excerpt);

    // Panel is now always visible on the right, no need to show/hide
    // Just apply layout state and text size
    this.applyLayoutState();
    this.applyTextSize();
  }

  /**
   * Load existing human rating for an excerpt
   */
  async loadHumanRating(excerpt) {
    const notesEl = this.getElement('detailNotes');
    if (!notesEl) return;

    // Need a selected variable to load rating
    if (!this.selectedVariable) {
      // Clear UI
      this.currentSelectedScore = null;
      const buttons = document.querySelectorAll('.score-btn');
      buttons.forEach(btn => btn.classList.remove('selected'));
      notesEl.value = '';
      return;
    }

    try {
      // Load rating from database
      const result = await window.api.pdf.getExcerptRating({
        excerpt_id: excerpt.id,
        variable_id: this.selectedVariable.id
      });

      if (result.success && result.data) {
        // Set selected score and update button states
        this.selectScore(result.data.score);
        notesEl.value = result.data.reasoning || '';
        console.log('[PDFExcerptViewer] Loaded human rating:', result.data);
      } else {
        // Clear UI - no rating exists
        this.currentSelectedScore = null;
        const buttons = document.querySelectorAll('.score-btn');
        buttons.forEach(btn => btn.classList.remove('selected'));
        notesEl.value = '';
      }
    } catch (error) {
      console.error('[PDFExcerptViewer] Error loading human rating:', error);
      // Clear UI on error
      this.currentSelectedScore = null;
      const buttons = document.querySelectorAll('.score-btn');
      buttons.forEach(btn => btn.classList.remove('selected'));
      notesEl.value = '';
    }
  }

  /**
   * Hide the detail panel (no-op now, panel is always visible)
   */
  hideDetailPanel() {
    // Panel is now always on the right, no need to hide
  }

  /**
   * Select a score (for button-based scoring)
   */
  selectScore(score) {
    this.currentSelectedScore = score;

    // Update button states
    const buttons = document.querySelectorAll('.score-btn');
    buttons.forEach(btn => {
      const btnScore = parseInt(btn.getAttribute('data-score'), 10);
      if (btnScore === score) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  /**
   * Save rating (score + notes) for the current active excerpt
   */
  async saveRating() {
    if (!this.activeExcerptId) {
      this.showNotification('No excerpt selected', 'error');
      return;
    }

    const notesEl = this.getElement('detailNotes');
    if (!notesEl) return;

    const score = this.currentSelectedScore;
    const notes = notesEl.value.trim();

    // Validate that a score was selected
    if (!score) {
      this.showNotification('Please select a score', 'error');
      return;
    }

    // Find the excerpt and update rating in memory
    const excerpt = this.allExcerpts.find(e => e.id === this.activeExcerptId);
    if (excerpt) {
      excerpt.humanRating = {
        score: parseInt(score, 10),
        notes: notes,
        timestamp: new Date().toISOString()
      };
    }

    // TODO: Save rating to database when backend API is ready
    // await window.api.pdf.saveExcerptRating(this.activeExcerptId, { score, notes });

    console.log('[PDFExcerptViewer] Rating saved for excerpt:', this.activeExcerptId, { score, notes });
    this.showNotification('Rating saved successfully', 'success');
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

    // Remove highlight event handlers
    if (this.highlightClickHandler) {
      document.removeEventListener('highlight:clicked', this.highlightClickHandler);
      this.highlightClickHandler = null;
    }
    if (this.highlightClearHandler) {
      document.removeEventListener('highlight:cleared', this.highlightClearHandler);
      this.highlightClearHandler = null;
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
   * @param {boolean} silent - Skip warning if true
   * @returns {HTMLElement|null}
   */
  getElement(id, silent = false) {
    const el = document.getElementById(id);
    if (!el && !silent) {
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

  /**
   * Load layout state from localStorage
   */
  loadLayoutState() {
    try {
      const saved = localStorage.getItem('pdfViewerLayout');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('[PDFExcerptViewer] Failed to load layout state:', error);
    }
    // Default layout
    return {
      pdfPanelWidth: 60,
      detailPanelWidth: 40,
      ratingAreaHeight: 60,  // Rating dashboard takes 60% of detail panel content
      excerptListHeight: 40   // Excerpt list takes 40% of detail panel content
    };
  }

  /**
   * Save layout state to localStorage
   */
  saveLayoutState() {
    try {
      localStorage.setItem('pdfViewerLayout', JSON.stringify(this.layoutState));
    } catch (error) {
      console.warn('[PDFExcerptViewer] Failed to save layout state:', error);
    }
  }

  /**
   * Apply layout state to panels
   */
  applyLayoutState() {
    const pdfPanel = this.getElement('pdfViewerPanel', true);
    const detailPanel = this.getElement('excerptDetailPanel', true);

    if (pdfPanel) {
      pdfPanel.style.flex = `0 0 ${this.layoutState.pdfPanelWidth}%`;
    }
    if (detailPanel) {
      detailPanel.style.flex = `0 0 ${this.layoutState.detailPanelWidth}%`;
    }

    // Also apply vertical layout
    this.applyVerticalLayout();
  }

  /**
   * Setup resizer event listeners
   */
  setupResizers() {
    // Horizontal resizer (between PDF and Rating panels)
    const horizontalResizer = this.getElement('horizontalResizer', true);
    if (horizontalResizer) {
      horizontalResizer.addEventListener('mousedown', (e) => {
        this.isResizingHorizontal = true;
        e.preventDefault();
      });
    }

    // Vertical resizer (between Rating Dashboard and Excerpts)
    const verticalResizer = this.getElement('verticalResizer', true);
    if (verticalResizer) {
      verticalResizer.addEventListener('mousedown', (e) => {
        this.isResizingVertical = true;
        e.preventDefault();
      });
    }

    // Global mouse move and mouse up handlers
    document.addEventListener('mousemove', (e) => {
      if (this.isResizingHorizontal) {
        this.handleHorizontalResize(e);
      } else if (this.isResizingVertical) {
        this.handleVerticalResize(e);
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizingHorizontal || this.isResizingVertical) {
        this.isResizingHorizontal = false;
        this.isResizingVertical = false;
        this.saveLayoutState();
      }
    });
  }

  /**
   * Handle horizontal panel resizing (PDF vs Detail panels)
   */
  handleHorizontalResize(e) {
    const mainContainer = this.getElement('pdfExcerptViewerModal', true);
    if (!mainContainer) return;

    const containerRect = mainContainer.getBoundingClientRect();
    const offsetX = e.clientX - containerRect.left;
    const containerWidth = containerRect.width - 32; // Subtract padding

    // Calculate percentage (with bounds)
    let pdfWidth = (offsetX / containerWidth) * 100;
    pdfWidth = Math.max(30, Math.min(70, pdfWidth)); // Limit between 30% and 70%

    this.layoutState.pdfPanelWidth = pdfWidth;
    this.layoutState.detailPanelWidth = 100 - pdfWidth;

    this.applyLayoutState();
  }

  /**
   * Handle vertical panel resizing (Rating Dashboard vs Excerpts List)
   */
  handleVerticalResize(e) {
    const detailPanelContent = document.querySelector('.detail-panel-content');
    if (!detailPanelContent) return;

    const contentRect = detailPanelContent.getBoundingClientRect();
    const offsetY = e.clientY - contentRect.top;
    const contentHeight = contentRect.height;

    // Calculate percentage (with bounds)
    let ratingHeight = (offsetY / contentHeight) * 100;
    ratingHeight = Math.max(30, Math.min(70, ratingHeight)); // Limit between 30% and 70%

    this.layoutState.ratingAreaHeight = ratingHeight;
    this.layoutState.excerptListHeight = 100 - ratingHeight;

    this.applyVerticalLayout();
  }

  /**
   * Apply vertical layout to detail panel sections
   */
  applyVerticalLayout() {
    // Get all detail sections that need vertical sizing
    const detailSections = document.querySelectorAll('.detail-panel-content > .detail-section');
    if (detailSections.length < 2) return;

    // The last section is the excerpt list section
    const excerptListSection = document.querySelector('#excerptListSection');

    if (excerptListSection) {
      // Set flex-basis for the excerpt list section
      excerptListSection.style.flexBasis = `${this.layoutState.excerptListHeight}%`;
      excerptListSection.style.flexGrow = '0';
      excerptListSection.style.flexShrink = '0';
    }

    // Set all other sections to share the remaining space
    const otherSections = Array.from(detailSections).filter(s => s.id !== 'excerptListSection');
    otherSections.forEach(section => {
      section.style.flexBasis = 'auto';
      section.style.flexGrow = '0';
      section.style.flexShrink = '0';
    });
  }

  /**
   * Load text size preference from localStorage
   */
  loadTextSize() {
    try {
      const saved = localStorage.getItem('pdfViewerTextSize');
      return saved ? parseInt(saved, 10) : 14;
    } catch (error) {
      return 14; // Default font size
    }
  }

  /**
   * Save text size preference to localStorage
   */
  saveTextSize() {
    try {
      localStorage.setItem('pdfViewerTextSize', this.detailPanelFontSize.toString());
    } catch (error) {
      console.warn('[PDFExcerptViewer] Failed to save text size:', error);
    }
  }

  /**
   * Apply text size to all UI text elements
   */
  applyTextSize() {
    // Detail panel elements
    const detailText = this.getElement('detailExcerptText', true);
    const detailNotes = this.getElement('detailNotes', true);
    const detailMetadata = this.getElement('detailMetadata', true);

    if (detailText) {
      detailText.style.fontSize = `${this.detailPanelFontSize}px`;
    }
    if (detailNotes) {
      detailNotes.style.fontSize = `${this.detailPanelFontSize}px`;
    }
    if (detailMetadata) {
      detailMetadata.style.fontSize = `${this.detailPanelFontSize}px`;
    }

    // Excerpt list items
    const excerptItems = document.querySelectorAll('.excerpt-list-item');
    excerptItems.forEach(item => {
      const excerptText = item.querySelector('.excerpt-text');
      if (excerptText) {
        excerptText.style.fontSize = `${this.detailPanelFontSize}px`;
      }
    });
  }

  /**
   * Increase text size in detail panel
   */
  increaseTextSize() {
    if (this.detailPanelFontSize < 24) {
      this.detailPanelFontSize += 2;
      this.applyTextSize();
      this.saveTextSize();
    }
  }

  /**
   * Decrease text size in detail panel
   */
  decreaseTextSize() {
    if (this.detailPanelFontSize > 10) {
      this.detailPanelFontSize -= 2;
      this.applyTextSize();
      this.saveTextSize();
    }
  }

  /**
   * Reset AI Co-Pilot display to initial/loading state
   */
  resetAICopilotDisplay() {
    const loading = this.getElement('aiCopilotLoading', true);
    const content = this.getElement('aiCopilotContent', true);
    const error = this.getElement('aiCopilotError', true);

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'none';
    if (error) error.style.display = 'none';
  }

  /**
   * Show AI Co-Pilot loading state
   */
  showAICopilotLoading() {
    const loading = this.getElement('aiCopilotLoading', true);
    const content = this.getElement('aiCopilotContent', true);
    const error = this.getElement('aiCopilotError', true);

    if (loading) loading.style.display = 'block';
    if (content) content.style.display = 'none';
    if (error) error.style.display = 'none';
  }

  /**
   * Update AI Co-Pilot display with rating results
   * @param {Object} rating - AI rating result { score, reasoning, etc. }
   */
  updateAICopilotDisplay(rating) {
    const loading = this.getElement('aiCopilotLoading', true);
    const content = this.getElement('aiCopilotContent', true);
    const error = this.getElement('aiCopilotError', true);

    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'none';
    if (content) content.style.display = 'block';

    // Update variable name
    const aiVariableEl = this.getElement('aiVariable', true);
    if (aiVariableEl && this.selectedVariable) {
      aiVariableEl.textContent = this.selectedVariable.label;
    }

    // Update score
    const aiScoreEl = this.getElement('aiScore', true);
    if (aiScoreEl) {
      // The rating might have different field names depending on API response
      const score = rating.score || rating.relevance || 'N/A';
      aiScoreEl.textContent = score;
    }

    // Update reasoning
    const aiReasoningEl = this.getElement('aiReasoning', true);
    if (aiReasoningEl) {
      aiReasoningEl.textContent = rating.reasoning || rating.analysis || 'No reasoning provided';
    }
  }

  /**
   * Show AI Co-Pilot error state
   * @param {string} errorMessage - Error message to display
   */
  showAICopilotError(errorMessage) {
    const loading = this.getElement('aiCopilotLoading', true);
    const content = this.getElement('aiCopilotContent', true);
    const error = this.getElement('aiCopilotError', true);
    const errorMessageEl = this.getElement('aiErrorMessage', true);

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'none';
    if (error) error.style.display = 'block';

    if (errorMessageEl) {
      errorMessageEl.textContent = errorMessage || 'Error loading AI analysis';
    }
  }

  /**
   * Show AI Co-Pilot disabled state (dimmed message, not red error)
   * @param {string} message - Informational message to display
   */
  showAICopilotDisabled(message) {
    const loading = this.getElement('aiCopilotLoading', true);
    const content = this.getElement('aiCopilotContent', true);
    const error = this.getElement('aiCopilotError', true);
    const errorMessageEl = this.getElement('aiErrorMessage', true);

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'none';
    if (error) {
      error.style.display = 'block';
      error.style.opacity = '0.5'; // Dimmed, not bright red
    }

    if (errorMessageEl) {
      errorMessageEl.textContent = message || 'AI rating on click is disabled';
      errorMessageEl.style.color = '#9ca3af'; // Gray instead of red
    }
  }

  // ============================================
  // RATING VARIABLES METHODS
  // ============================================

  /**
   * Load rating variables for the current collection
   */
  async loadVariables() {
    if (!this.currentCollection) return;

    try {
      // Load global variables for PDF genre
      const result = await window.api.pdf.getGlobalRatingVariables();
      if (result.success && result.data) {
        // Filter by PDF genre (or 'both')
        this.availableVariables = result.data.filter(v =>
          v.genre === 'pdf' || v.genre === 'both'
        );
        this.populateVariableSelector();
      }
    } catch (error) {
      console.error('Error loading variables:', error);
    }
  }

  /**
   * Populate the variable selector dropdown
   */
  populateVariableSelector() {
    const selector = document.querySelector('#variableSelector');
    if (!selector) return;

    if (this.availableVariables.length === 0) {
      selector.innerHTML = '<option value="">No variables defined - use Collections Hub to create</option>';
      selector.disabled = true;
      return;
    }

    selector.innerHTML = this.availableVariables.map(v =>
      `<option value="${v.id}">${v.label}</option>`
    ).join('');
    selector.disabled = false;

    // Select first variable by default
    if (this.availableVariables.length > 0 && !this.selectedVariable) {
      this.selectedVariable = this.availableVariables[0];
      selector.value = this.selectedVariable.id;
      this.onVariableChanged();
    }
  }

  /**
   * Handle variable selection change
   */
  onVariableChanged() {
    const selector = document.querySelector('#variableSelector');
    if (!selector) return;

    const variableId = parseInt(selector.value);
    this.selectedVariable = this.availableVariables.find(v => v.id === variableId);

    if (this.selectedVariable) {
      // Show variable info section
      const infoSection = document.querySelector('#variableInfoSection');
      if (infoSection) {
        infoSection.style.display = 'block';
      }

      // Show variable info card
      const infoCard = document.querySelector('#variableInfo');
      const defEl = document.querySelector('#variableDefinition');
      const scaleTypeEl = document.querySelector('#variableScaleType');
      const reasoningDepthEl = document.querySelector('#variableReasoningDepth');

      if (infoCard) {
        infoCard.style.display = 'block';
      }

      // Update human variable display to mirror AI
      const humanVariableEl = document.querySelector('#humanVariable');
      if (humanVariableEl) {
        humanVariableEl.textContent = this.selectedVariable.label;
      }

      if (defEl) {
        defEl.textContent = this.selectedVariable.definition || 'No definition provided';
      }

      if (scaleTypeEl) {
        const scaleLabels = {
          'binary': 'Binary (0/1)',
          '3point': '3-Point (1-3)',
          '4point': '4-Point (1-4)',
          '5point': '5-Point (1-5)',
          '7point': '7-Point (1-7)',
          '10point': '10-Point (1-10)',
          '100point': '100-Point (0-100)'
        };
        scaleTypeEl.textContent = scaleLabels[this.selectedVariable.scale_type] || this.selectedVariable.scale_type;
      }

      if (reasoningDepthEl) {
        const depthLabels = {
          'brief': 'Brief (1-2 sentences)',
          'moderate': 'Moderate (3-5 sentences)',
          'lengthy': 'Lengthy (6+ sentences)'
        };
        reasoningDepthEl.textContent = depthLabels[this.selectedVariable.reasoning_depth] || this.selectedVariable.reasoning_depth;
      }

      // Update score buttons based on scale type
      this.renderScoreButtons();

      // Populate anchors
      this.populateAnchors();

      // Set reasoning depth from variable (not user-selectable anymore)
      this.selectedDepth = this.selectedVariable.reasoning_depth || 'brief';

      // Reload human rating for current excerpt with new variable
      if (this.currentExcerpt) {
        this.loadHumanRating(this.currentExcerpt);
        this.triggerAICopilotRating(this.currentExcerpt);
      }

      // Update rating progress for new variable
      this.throttledUpdateProgress();
    }
  }

  /**
   * Populate anchor definitions
   */
  populateAnchors() {
    const anchorsContainer = document.querySelector('#variableAnchors');
    if (!anchorsContainer || !this.selectedVariable || !this.selectedVariable.anchors) return;

    const anchors = this.selectedVariable.anchors;
    const entries = Object.entries(anchors);

    if (entries.length === 0) {
      anchorsContainer.innerHTML = '<p style="color: #6b7280; font-style: italic;">No anchor definitions available</p>';
      return;
    }

    anchorsContainer.innerHTML = entries.map(([score, definition]) => `
      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #374151; last-child:border-bottom-none;">
        <div style="font-weight: 600; color: #10b981; margin-bottom: 4px;">Score ${score}:</div>
        <div style="color: #d1d5db; line-height: 1.5;">${definition}</div>
      </div>
    `).join('');
  }

  /**
   * Toggle anchor definitions visibility
   */
  toggleAnchors() {
    const anchorsContainer = document.querySelector('#variableAnchors');
    const toggleIcon = document.querySelector('#anchorsToggleIcon');
    const toggleBtn = document.querySelector('#toggleAnchorsBtn');

    if (!anchorsContainer || !toggleIcon || !toggleBtn) return;

    const isVisible = anchorsContainer.style.display !== 'none';

    if (isVisible) {
      anchorsContainer.style.display = 'none';
      toggleIcon.textContent = '▶';
      toggleBtn.innerHTML = '<span id="anchorsToggleIcon">▶</span> Show Anchor Definitions';
    } else {
      anchorsContainer.style.display = 'block';
      toggleIcon.textContent = '▼';
      toggleBtn.innerHTML = '<span id="anchorsToggleIcon">▼</span> Hide Anchor Definitions';
    }
  }

  /**
   * Render score buttons based on selected variable's scale type
   */
  renderScoreButtons() {
    const container = document.querySelector('#humanScoreButtons');
    if (!container || !this.selectedVariable) return;

    const scaleConfigs = {
      'binary': [0, 1],
      '3point': [1, 2, 3],
      '4point': [1, 2, 3, 4],
      '5point': [1, 2, 3, 4, 5],
      '7point': [1, 2, 3, 4, 5, 6, 7],
      '10point': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      '100point': 'slider'
    };

    const points = scaleConfigs[this.selectedVariable.scale_type];

    if (points === 'slider') {
      // Render slider for 100-point scale
      container.innerHTML = `
        <input type="range" min="0" max="100" value="50" id="scoreSlider"
          style="width: 100%; margin: 8px 0;"
          oninput="window.pdfExcerptViewer.onSliderChange(this.value)">
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af;">
          <span>0</span>
          <span id="sliderValue" style="font-size: 16px; font-weight: bold; color: #e5e7eb;">50</span>
          <span>100</span>
        </div>
      `;
    } else if (Array.isArray(points)) {
      // Render buttons
      container.innerHTML = points.map(point => {
        const anchor = this.selectedVariable.anchors && this.selectedVariable.anchors[point];
        return `<button class="score-btn" data-score="${point}"
          onclick="window.pdfExcerptViewer.selectScore(${point})"
          ${anchor ? `title="${anchor}"` : ''}>${point}</button>`;
      }).join('');
    }
  }

  /**
   * Handle slider change for 100-point scale
   */
  onSliderChange(value) {
    const valueEl = document.querySelector('#sliderValue');
    if (valueEl) {
      valueEl.textContent = value;
    }
    this.currentSelectedScore = parseInt(value);
    this.triggerAutoSave();
  }

  // ============================================
  // SPEECH-TO-TEXT METHODS
  // ============================================

  /**
   * Setup speech recognition
   */
  setupSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    try {
      this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event) => {
        const textarea = document.querySelector('#detailNotes');
        if (!textarea) return;

        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');

        textarea.value = transcript;
        this.triggerAutoSave();
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.stopRecording();
        this.showNotification('Speech recognition error: ' + event.error, 'error');
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        this.updateRecordingButton();
      };

      // Setup button click handler
      setTimeout(() => {
        const btn = document.querySelector('#speechToTextBtn');
        if (btn) {
          btn.addEventListener('click', () => this.toggleRecording());
        }
      }, 500);

    } catch (error) {
      console.error('Failed to setup speech recognition:', error);
    }
  }

  /**
   * Toggle speech-to-text recording
   */
  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  /**
   * Start recording
   */
  startRecording() {
    if (!this.recognition) {
      this.showNotification('Speech recognition not available in this browser', 'error');
      return;
    }

    try {
      this.recognition.start();
      this.isRecording = true;
      this.updateRecordingButton();
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showNotification('Failed to start recording', 'error');
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
      this.updateRecordingButton();
    }
  }

  /**
   * Update recording button appearance
   */
  updateRecordingButton() {
    const btn = document.querySelector('#speechToTextBtn');
    if (!btn) return;

    if (this.isRecording) {
      btn.textContent = '🔴';
      btn.style.background = '#ef4444';
      btn.title = 'Stop Recording';
    } else {
      btn.textContent = '🎤';
      btn.style.background = '#374151';
      btn.title = 'Speech to Text';
    }
  }

  // ============================================
  // AUTO-SAVE METHODS
  // ============================================

  /**
   * Trigger auto-save with debounce
   */
  triggerAutoSave() {
    // Clear existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    // Set new timeout for 1 second
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSaveRating();
    }, 1000);

    // Update status
    this.updateAutoSaveStatus('Saving...');
  }

  /**
   * Auto-save rating
   */
  async autoSaveRating() {
    if (!this.activeExcerptId || !this.selectedVariable) {
      return;
    }

    const notesEl = document.querySelector('#detailNotes');
    const score = this.currentSelectedScore;
    const notes = notesEl ? notesEl.value.trim() : '';

    // Only save if score is selected
    if (!score && score !== 0) {
      this.updateAutoSaveStatus('Auto-save enabled');
      return;
    }

    try {
      const result = await window.api.pdf.saveExcerptRating({
        excerpt_id: this.activeExcerptId,
        variable_id: this.selectedVariable.id,
        score: score,
        reasoning: notes,
        reasoning_depth: this.selectedDepth
      });

      if (result.success) {
        this.updateAutoSaveStatus('✓ Saved');
        setTimeout(() => {
          this.updateAutoSaveStatus('Auto-save enabled');
        }, 2000);

        // Update rating progress after successful save
        this.throttledUpdateProgress();
      } else {
        this.updateAutoSaveStatus('Save failed');
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      this.updateAutoSaveStatus('Save failed');
    }
  }

  /**
   * Update auto-save status message
   */
  updateAutoSaveStatus(message) {
    const statusEl = document.querySelector('#autoSaveStatus');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  // ============================================
  // RATING PROGRESS METHODS
  // ============================================

  /**
   * Update rating progress indicators (fast SQL COUNT queries)
   */
  async updateRatingProgress() {
    if (!this.selectedVariable || !this.currentPDF || !this.allExcerpts || this.allExcerpts.length === 0) {
      console.warn('[PDFExcerptViewer] Cannot update progress: missing required data');
      return;
    }

    try {
      const totalExcerpts = this.allExcerpts.length;

      // Use efficient SQL COUNT queries instead of looping through all excerpts
      const [humanResult, aiResult] = await Promise.all([
        window.api.pdf.countHumanRatingsForPDF({
          pdf_id: this.currentPDF.id,
          variable_id: this.selectedVariable.id
        }),
        window.api.pdf.countAIRatingsForPDF({
          pdf_id: this.currentPDF.id,
          variable_id: this.selectedVariable.id
        })
      ]);

      const humanRatedCount = humanResult.success ? humanResult.count : 0;
      const aiRatedCount = aiResult.success ? aiResult.count : 0;

      // Update UI
      const humanProgressEl = document.querySelector('#humanProgress span');
      const aiProgressEl = document.querySelector('#aiProgress span');

      if (humanProgressEl) {
        const humanPercent = totalExcerpts > 0 ? Math.round((humanRatedCount / totalExcerpts) * 100) : 0;
        humanProgressEl.textContent = `${humanRatedCount}/${totalExcerpts} (${humanPercent}%)`;
        humanProgressEl.style.color = humanRatedCount === totalExcerpts ? '#10b981' : '#3b82f6';
      }

      if (aiProgressEl) {
        const aiPercent = totalExcerpts > 0 ? Math.round((aiRatedCount / totalExcerpts) * 100) : 0;
        aiProgressEl.textContent = `${aiRatedCount}/${totalExcerpts} (${aiPercent}%)`;
        aiProgressEl.style.color = aiRatedCount === totalExcerpts ? '#10b981' : '#10b981';
      }

      console.log(`[PDFExcerptViewer] Progress updated: Human ${humanRatedCount}/${totalExcerpts}, AI ${aiRatedCount}/${totalExcerpts}`);

    } catch (error) {
      console.error('[PDFExcerptViewer] Error updating rating progress:', error);
    }
  }

  /**
   * Update rating progress (throttled to avoid excessive database queries)
   */
  throttledUpdateProgress() {
    if (this.progressUpdateTimeout) {
      clearTimeout(this.progressUpdateTimeout);
    }

    this.progressUpdateTimeout = setTimeout(() => {
      this.updateRatingProgress();
    }, 500);
  }

  // ============================================
  // RE-RATE METHODS
  // ============================================

  /**
   * Re-trigger AI rating for current excerpt
   */
  async rerateWithAI() {
    if (!this.currentExcerpt) {
      this.showNotification('No excerpt selected', 'error');
      return;
    }

    if (!this.selectedVariable) {
      this.showNotification('No variable selected', 'error');
      return;
    }

    console.log('[PDFExcerptViewer] Re-rating excerpt with AI');

    // Clear cache for this excerpt/variable pair
    const cacheKey = `${this.currentExcerpt.id}_${this.selectedVariable.id}`;
    this.aiRatingCache.delete(cacheKey);

    // Show loading state
    this.showAICopilotLoading();

    // Trigger new AI rating
    await this.triggerAICopilotRating(this.currentExcerpt);

    this.showNotification('AI is generating a new rating...', 'info');
  }

  /**
   * View AI rating history for current excerpt
   */
  async viewAIRatingHistory() {
    if (!this.currentExcerpt || !this.selectedVariable) {
      return;
    }

    try {
      const result = await window.api.pdf.getAIExcerptRatingHistory({
        excerpt_id: this.currentExcerpt.id,
        variable_id: this.selectedVariable.id
      });

      if (result.success && result.data && result.data.length > 0) {
        console.log(`[PDFExcerptViewer] AI rating history (${result.data.length} ratings):`, result.data);
        // Could display this in a modal or expand the AI section to show history
        this.showNotification(`${result.data.length} AI rating(s) in history`, 'info');
      } else {
        console.log('[PDFExcerptViewer] No AI rating history found');
      }
    } catch (error) {
      console.error('[PDFExcerptViewer] Error fetching AI rating history:', error);
    }
  }

  // ============================================
  // RATE ALL METHODS
  // ============================================

  /**
   * Rate all unrated excerpts with AI
   */
  async rateAllWithAI() {
    // Check if a variable is selected
    if (!this.selectedVariable) {
      this.showNotification('Please select a variable first', 'error');
      return;
    }

    // Check if current PDF is loaded
    if (!this.currentPDF) {
      this.showNotification('No PDF loaded', 'error');
      return;
    }

    // Check if already in progress
    if (this.rateAllInProgress) {
      this.showNotification('AI rating is already in progress', 'info');
      return;
    }

    // Check if API is available
    if (!window.api?.ai?.rateSingleExcerpt) {
      this.showNotification('AI rating API not available', 'error');
      return;
    }

    try {
      // Get all excerpts that need AI ratings for the current variable
      // IMPORTANT: Only rate excerpts from the CURRENT PDF, not the entire collection
      const unratedExcerpts = [];

      // Filter to only excerpts from current PDF
      const currentPDFExcerpts = this.allExcerpts.filter(e => e.pdf_id === this.currentPDF.id);

      console.log(`[PDFExcerptViewer] Rate All: Current PDF has ${currentPDFExcerpts.length} excerpts`);

      for (const excerpt of currentPDFExcerpts) {
        const cacheKey = `${excerpt.id}_${this.selectedVariable.id}`;

        // Check cache first
        if (this.aiRatingCache.has(cacheKey)) {
          continue; // Already rated (in cache)
        }

        // Check database
        try {
          const dbResult = await window.api.pdf.getAIExcerptRating({
            excerpt_id: excerpt.id,
            variable_id: this.selectedVariable.id
          });

          if (dbResult.success && dbResult.data) {
            // Already rated in database, cache it
            const rating = {
              score: dbResult.data.score,
              reasoning: dbResult.data.reasoning
            };
            this.aiRatingCache.set(cacheKey, rating);
            continue;
          }
        } catch (error) {
          console.error('[PDFExcerptViewer] Error checking AI rating:', error);
        }

        // Not rated - add to list
        unratedExcerpts.push(excerpt);
      }

      if (unratedExcerpts.length === 0) {
        this.showNotification('All excerpts are already rated!', 'info');
        return;
      }

      // Start rating process
      this.rateAllExcerpts = unratedExcerpts;
      this.rateAllCurrentIndex = 0;
      this.rateAllInProgress = true;
      this.rateAllPaused = false;

      // Update UI
      this.updateRateAllUI();

      console.log(`[PDFExcerptViewer] Starting Rate All: ${unratedExcerpts.length} excerpts to rate`);
      this.showNotification(`Starting AI rating: ${unratedExcerpts.length} excerpts`, 'info');

      // Start the rating loop
      await this.processNextExcerpt();

    } catch (error) {
      console.error('[PDFExcerptViewer] Error starting Rate All:', error);
      this.showNotification('Error starting Rate All: ' + error.message, 'error');
      this.stopRateAll();
    }
  }

  /**
   * Update batch size for parallel rating
   */
  updateBatchSize(value) {
    const batchSize = parseInt(value);
    if (batchSize >= 1 && batchSize <= 50) {
      this.rateAllBatchSize = batchSize;
      console.log(`[PDFExcerptViewer] Batch size updated to ${batchSize}`);
    }
  }

  /**
   * Toggle AI rating on click
   */
  toggleAIRatingOnClick(enabled) {
    this.aiRatingOnClick = enabled;
    console.log(`[PDFExcerptViewer] AI rating on click: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Process the next batch of excerpts in the Rate All queue (in parallel)
   */
  async processNextExcerpt() {
    // Check if we should stop
    if (!this.rateAllInProgress || this.rateAllPaused) {
      return;
    }

    // Check if we're done
    if (this.rateAllCurrentIndex >= this.rateAllExcerpts.length) {
      this.completeRateAll();
      return;
    }

    // Get next batch of excerpts
    const batchStart = this.rateAllCurrentIndex;
    const batchEnd = Math.min(batchStart + this.rateAllBatchSize, this.rateAllExcerpts.length);
    const batch = [];

    // Clear previous batch tracking
    this.currentBatchExcerptIds.clear();

    // Collect excerpts for this batch (skip already-locked ones)
    for (let i = batchStart; i < batchEnd; i++) {
      const excerpt = this.rateAllExcerpts[i];
      const cacheKey = `${excerpt.id}_${this.selectedVariable.id}`;

      // Skip if already being rated
      if (this.excerptRatingLocks.has(cacheKey)) {
        console.log('[PDFExcerptViewer] Skipping locked excerpt:', cacheKey);
        continue;
      }

      // Acquire lock
      this.excerptRatingLocks.add(cacheKey);
      batch.push({ excerpt, cacheKey });

      // Track for visual highlighting
      this.currentBatchExcerptIds.add(excerpt.id);
    }

    // Update UI to show batch glow
    this.renderExcerpts();

    if (batch.length === 0) {
      // All excerpts in this batch are locked, move to next batch
      this.rateAllCurrentIndex = batchEnd;
      setTimeout(() => this.processNextExcerpt(), 500);
      return;
    }

    // Update status
    this.updateRateAllStatus(`Rating batch: ${batchStart + 1}-${batchEnd} of ${this.rateAllExcerpts.length} (${batch.length} in parallel)...`);

    console.log(`[PDFExcerptViewer] Processing batch of ${batch.length} excerpts in parallel`);

    // Process all excerpts in batch in parallel
    const promises = batch.map(async ({ excerpt, cacheKey }) => {
      try {
        // Build research intent
        const researchIntent = `Rate this excerpt on the variable "${this.selectedVariable.label}". ${this.selectedVariable.definition || ''}`;

        // Build PDF context
        const pdfContext = {
          title: this.currentPDF?.title || 'PDF Document',
          page_number: excerpt.page_number,
          variable: {
            label: this.selectedVariable.label,
            definition: this.selectedVariable.definition,
            scale_type: this.selectedVariable.scale_type,
            anchors: this.selectedVariable.anchors,
            reasoning_depth: this.selectedVariable.reasoning_depth
          }
        };

        // Call AI rating API
        const result = await window.api.ai.rateSingleExcerpt({
          excerptText: excerpt.text_content,
          pdfContext: pdfContext,
          researchIntent: researchIntent
        });

        if (result.success && result.rating) {
          // Cache the rating
          this.aiRatingCache.set(cacheKey, result.rating);

          // Save to database
          try {
            await window.api.pdf.saveAIExcerptRating({
              excerpt_id: excerpt.id,
              variable_id: this.selectedVariable.id,
              score: result.rating.score || result.rating.relevance || 'N/A',
              reasoning: result.rating.reasoning || result.rating.analysis || null
            });
            console.log(`[PDFExcerptViewer] AI rating saved for excerpt ${excerpt.id}`);
          } catch (dbError) {
            console.error('[PDFExcerptViewer] Failed to save AI rating:', dbError);
          }

          // If this is the current excerpt, update AI display
          if (this.currentExcerpt && this.currentExcerpt.id === excerpt.id) {
            this.updateAICopilotDisplay(result.rating);
          }

          return { success: true, excerpt };
        } else {
          console.error('[PDFExcerptViewer] AI rating failed for excerpt:', excerpt.id, result.error);
          return { success: false, excerpt, error: result.error };
        }
      } catch (error) {
        console.error('[PDFExcerptViewer] Error rating excerpt:', error);
        return { success: false, excerpt, error };
      } finally {
        // Release lock
        this.excerptRatingLocks.delete(cacheKey);
      }
    });

    // Wait for all ratings in batch to complete
    await Promise.all(promises);

    // Clear batch tracking
    this.currentBatchExcerptIds.clear();

    // Update progress counters after batch completes
    this.updateRatingProgress();

    // Update UI to remove batch glow
    this.renderExcerpts();

    // Move to next batch
    this.rateAllCurrentIndex = batchEnd;

    // Continue with next batch (small delay)
    setTimeout(() => {
      this.processNextExcerpt();
    }, 500);
  }

  /**
   * Navigate to a specific excerpt
   */
  navigateToExcerpt(excerpt) {
    // Set as active
    this.activeExcerptId = excerpt.id;
    this.currentExcerpt = excerpt;

    // Calculate which page of the excerpt list this excerpt is on
    const excerptIndex = this.filteredExcerpts.findIndex(e => e.id === excerpt.id);
    if (excerptIndex !== -1) {
      const targetPage = Math.floor(excerptIndex / this.excerptsPerPage) + 1;
      if (targetPage !== this.currentPage) {
        this.currentPage = targetPage;
        this.renderExcerpts();
      }
    }

    // Update visual state
    document.querySelectorAll('.excerpt-list-item').forEach(el => {
      el.classList.remove('active');
    });
    const element = document.querySelector(`[data-excerpt-id="${excerpt.id}"]`);
    if (element) {
      element.classList.add('active');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Jump to page in PDF viewer
    if (this.renderer && excerpt.page_number) {
      this.renderer.goToPage(excerpt.page_number);
    }

    // Highlight in PDF
    if (this.highlighter) {
      this.highlighter.setActiveExcerpt(excerpt.id);
    }

    // Update detail panel text
    const textEl = this.getElement('detailExcerptText');
    if (textEl) {
      textEl.textContent = excerpt.text_content || 'No text available';
    }

    // Load human rating
    this.loadHumanRating(excerpt);
  }

  /**
   * Pause the Rate All process
   */
  pauseRateAll() {
    if (!this.rateAllInProgress) {
      return;
    }

    this.rateAllPaused = true;
    this.updateRateAllUI();
    this.updateRateAllStatus(`Paused at excerpt ${this.rateAllCurrentIndex} of ${this.rateAllExcerpts.length}`);
    this.showNotification('AI rating paused', 'info');
    console.log('[PDFExcerptViewer] Rate All paused');
  }

  /**
   * Resume the Rate All process
   */
  async resumeRateAll() {
    if (!this.rateAllInProgress || !this.rateAllPaused) {
      return;
    }

    this.rateAllPaused = false;
    this.updateRateAllUI();
    this.showNotification('AI rating resumed', 'info');
    console.log('[PDFExcerptViewer] Rate All resumed');

    // Continue processing
    await this.processNextExcerpt();
  }

  /**
   * Stop the Rate All process
   */
  stopRateAll() {
    this.rateAllInProgress = false;
    this.rateAllPaused = false;
    this.rateAllCurrentIndex = 0;
    this.rateAllExcerpts = [];
    this.currentlyRatingExcerptId = null;
    this.currentBatchExcerptIds.clear();
    this.updateRateAllUI();
    this.renderExcerpts(); // Clear visual indicators
  }

  /**
   * Complete the Rate All process
   */
  completeRateAll() {
    const totalRated = this.rateAllExcerpts.length;
    this.stopRateAll();
    this.updateRateAllStatus('');
    this.showNotification(`AI rating complete! Rated ${totalRated} excerpts`, 'success');
    console.log(`[PDFExcerptViewer] Rate All complete: ${totalRated} excerpts rated`);
  }

  /**
   * Update Rate All UI elements
   */
  updateRateAllUI() {
    const rateAllBtn = this.getElement('rateAllBtn', true);
    const pauseBtn = this.getElement('pauseRateAllBtn', true);
    const resumeBtn = this.getElement('resumeRateAllBtn', true);
    const statusDiv = this.getElement('rateAllStatus', true);

    if (this.rateAllInProgress && !this.rateAllPaused) {
      // In progress - show Pause button
      if (rateAllBtn) rateAllBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'block';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'block';
    } else if (this.rateAllInProgress && this.rateAllPaused) {
      // Paused - show Resume button
      if (rateAllBtn) rateAllBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'block';
      if (statusDiv) statusDiv.style.display = 'block';
    } else {
      // Not in progress - show Rate All button
      if (rateAllBtn) rateAllBtn.style.display = 'block';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
    }
  }

  /**
   * Update Rate All status message
   */
  updateRateAllStatus(message) {
    const statusDiv = this.getElement('rateAllStatus', true);
    if (statusDiv) {
      statusDiv.textContent = message || 'AI Rating in Progress...';
    }
  }
}

// Initialize and expose globally
const pdfExcerptViewer = new PDFExcerptViewer();
window.pdfExcerptViewer = pdfExcerptViewer;
