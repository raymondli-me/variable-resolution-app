/**
 * BWS Workspace Component
 * Manages the four-quadrant PDF comparison interface for BWS experiments
 */

class BWSWorkspace {
  constructor(containerId, collectionId = null) {
    console.log(`BWS Workspace: Constructor called with containerId="${containerId}", collectionId=${collectionId}`);
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`BWS Workspace: Container with id "${containerId}" not found`);
      return;
    }
    console.log('BWS Workspace: Container found:', this.container);

    this.state = {
      collectionId: collectionId,
      experiments: [],
      selectedExperiment: null,
      currentTupleIndex: 0,
      isLoading: false,
      view: 'experiments-list', // 'experiments-list' or 'comparison-view'
      // Rating state for human input
      rating: {
        bestExcerptIndex: null,  // Index of quadrant marked as "Best"
        worstExcerptIndex: null, // Index of quadrant marked as "Worst"
        startTime: null          // Timestamp when rating started
      },
      sidebarCollapsed: false // Toggle sidebar visibility for more space
    };

    console.log('BWS Workspace: About to render, view =', this.state.view);
    this.render();
    console.log('BWS Workspace: Render complete, HTML length =', this.container.innerHTML.length);

    if (collectionId) {
      this.loadExperiments();
    }
  }

  /**
   * Render the workspace UI
   */
  render() {
    if (this.state.view === 'experiments-list') {
      this.renderExperimentsList();
    } else {
      this.renderComparisonView();
    }
  }

  /**
   * Render the experiments list view
   */
  renderExperimentsList() {
    this.container.innerHTML = `
      <div class="bws-workspace-container">
        <!-- Header -->
        <div class="bws-workspace-header">
          <div>
            <h2 class="bws-workspace-title">BWS Experiments</h2>
            <p style="margin: 4px 0 0; color: var(--text-secondary, #9ca3af); font-size: 13px;">
              Manage Best-Worst Scaling experiments for this collection
            </p>
          </div>
          <div class="bws-workspace-actions">
            <button class="bws-btn bws-btn-primary" id="bws-new-experiment">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 6px;">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Experiment
            </button>
            <button class="bws-btn" id="bws-close" title="Close Workspace">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 6px;">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Close
            </button>
          </div>
        </div>

        <!-- Main Area - Experiments Cards -->
        <div class="bws-workspace-main" style="display: block; padding: 24px; overflow-y: auto;">
          <div id="bws-experiments-container">
            ${this.renderExperimentCards()}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render experiment cards
   */
  renderExperimentCards() {
    if (this.state.isLoading) {
      return `
        <div class="bws-workspace-loading">
          Loading experiments...
        </div>
      `;
    }

    if (!this.state.experiments || this.state.experiments.length === 0) {
      return `
        <div class="bws-workspace-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          <h3>No experiments yet</h3>
          <p>Create your first BWS experiment to get started</p>
        </div>
      `;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
        ${this.state.experiments.map(exp => `
          <div class="bws-experiment-card" data-experiment-id="${exp.id}">
            <div class="bws-experiment-card-header">
              <h3>${exp.name || 'Untitled Experiment'}</h3>
              <span class="bws-experiment-status">${exp.status || 'Draft'}</span>
            </div>
            <div class="bws-experiment-card-body">
              <div class="bws-experiment-stat">
                <span class="bws-stat-label">Tuples</span>
                <span class="bws-stat-value">${exp.tupleCount || 0}</span>
              </div>
              <div class="bws-experiment-stat">
                <span class="bws-stat-label">Appearances</span>
                <span class="bws-stat-value">${exp.appearances || 0}</span>
              </div>
              <div class="bws-experiment-stat">
                <span class="bws-stat-label">Progress</span>
                <span class="bws-stat-value">${exp.progress || 0}%</span>
              </div>
            </div>
            <div class="bws-experiment-card-footer">
              <button class="bws-btn" data-action="configure" data-experiment-id="${exp.id}">
                Configure
              </button>
              <button class="bws-btn bws-btn-primary" data-action="open" data-experiment-id="${exp.id}">
                Open
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render the comparison view (4 quadrants)
   */
  renderComparisonView() {
    this.container.innerHTML = `
      <div class="bws-workspace-container">
        <!-- Header -->
        <div class="bws-workspace-header">
          <div>
            <h2 class="bws-workspace-title">BWS Workspace</h2>
            <p style="margin: 4px 0 0; color: var(--text-secondary, #9ca3af); font-size: 13px;">
              Compare PDF excerpts to determine best and worst
            </p>
          </div>
          <div class="bws-workspace-actions">
            <!-- AI Controls -->
            <div class="bws-ai-controls" style="display: flex; align-items: center; gap: 12px; margin-right: 12px; padding-right: 12px; border-right: 1px solid var(--border-color, #374151);">
              <label class="bws-toggle-switch" title="Enable AI Auto-Rating">
                <input type="checkbox" id="bws-ai-toggle">
                <span class="bws-toggle-slider"></span>
                <span style="margin-left: 8px; font-size: 12px;">AI</span>
              </label>
              <select id="bws-rating-variable" class="bws-select" style="min-width: 120px; font-size: 12px;">
                <option value="">Select Variable...</option>
              </select>
              <button class="bws-btn bws-btn-small" id="bws-rate-all" title="Rate All with AI" style="font-size: 12px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-right: 4px;">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
                Rate All
              </button>
            </div>
            <button class="bws-btn bws-btn-icon" title="Hide Sidebar" id="bws-toggle-sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
            <button class="bws-btn bws-btn-icon" title="Zoom In" id="bws-zoom-in">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <button class="bws-btn bws-btn-icon" title="Zoom Out" id="bws-zoom-out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <button class="bws-btn bws-btn-icon" title="Settings" id="bws-settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m4.22-10.22l1.42-1.42m-1.42 10.88l1.42 1.42M20 12h-6m-6 0H2m10.22-4.22L10.8 6.36m1.42 10.88l-1.42 1.42"></path>
              </svg>
            </button>
            <button class="bws-btn" id="bws-back-to-list" title="Back to Experiments">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 6px;">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Back
            </button>
            <button class="bws-btn" id="bws-close" title="Close Workspace">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 6px;">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Close
            </button>
          </div>
        </div>

        <!-- Main 4-Quadrant Area with Browser Sidebar -->
        <div class="bws-workspace-main" style="display: flex; gap: 0;">
          <!-- Quadrants Container -->
          <div id="bws-quadrants-container" style="flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 1px; background: #374151; overflow: hidden;">
            ${this.renderQuadrants()}
          </div>

          <!-- Comparison Set Browser Sidebar (Visible by default) -->
          <div id="bws-browser-sidebar" style="width: 280px; background: #1f2937; border-left: 1px solid #374151; display: flex; flex-direction: column; overflow: hidden;">
            ${this.renderBrowserSidebar()}
          </div>
        </div>

        <!-- Footer -->
        <div class="bws-workspace-footer">
          <div class="bws-workspace-status">
            <span id="bws-status-text">Ready to begin</span>
          </div>
          <div class="bws-workspace-actions">
            <button class="bws-btn" id="bws-prev-tuple" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 6px;">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Previous
            </button>
            <button class="bws-btn bws-btn-success" id="bws-submit-rating" style="display: none;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 6px;">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Submit Rating
            </button>
            <button class="bws-btn bws-btn-primary" id="bws-next-tuple">
              Next
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-left: 6px;">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render the four quadrants with PDF placeholders
   */
  renderQuadrants() {
    const positions = ['A', 'B', 'C', 'D'];

    return positions.map((position, index) => `
      <div class="bws-pdf-quadrant" data-position="${position}" style="background: #111827; position: relative;">
        <!-- Quadrant Header -->
        <div class="bws-quadrant-header">
          <span class="bws-quadrant-label">PDF Excerpt</span>
          <div class="bws-quadrant-controls">
            <button class="bws-btn bws-btn-icon" title="Zoom Out" data-action="zoom-out" data-quadrant="${index}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <button class="bws-btn bws-btn-icon" title="Zoom In" data-action="zoom-in" data-quadrant="${index}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <button class="bws-btn bws-btn-icon" title="Expand" data-action="expand" data-quadrant="${index}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- PDF Renderer Area -->
        <div class="bws-pdf-renderer" id="bws-pdf-${index}" data-quadrant="${index}">
          <div class="bws-pdf-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <p><strong>Position ${position}</strong></p>
            <p>PDF excerpt will appear here</p>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render the comparison set browser sidebar
   */
  renderBrowserSidebar() {
    const totalTuples = this.state.experimentData?.tuples_generated || 0;
    const currentIndex = this.state.currentTupleIndex;

    // Get the selected variable information
    const selectedVar = this.selectedVariableInfo;

    return `
      <!-- Browser Header -->
      <div style="padding: 12px; border-bottom: 1px solid #374151; background: #1f2937;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 13px; color: #9ca3af;">Comparison Sets</h4>
          <span class="bws-browser-counter" style="font-size: 12px; color: #6b7280;">${totalTuples > 0 ? `${currentIndex + 1}/${totalTuples}` : '0/0'}</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="bws-btn bws-btn-icon" id="bws-browser-prev" title="Previous" style="flex: 1; font-size: 11px; padding: 4px 8px;" ${currentIndex <= 0 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button class="bws-btn bws-btn-icon" id="bws-browser-next" title="Next" style="flex: 1; font-size: 11px; padding: 4px 8px;" ${currentIndex >= totalTuples - 1 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <!-- Variable Information -->
      ${selectedVar ? `
        <div style="padding: 12px; border-bottom: 1px solid #374151; background: #111827;">
          <h5 style="margin: 0 0 8px 0; font-size: 12px; color: #60a5fa; font-weight: 600;">
            ${selectedVar.name}
          </h5>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
            ${selectedVar.description || 'No description available'}
          </p>
          ${selectedVar.anchors && selectedVar.anchors.best ? `
            <div style="margin-top: 8px;">
              <div style="margin-bottom: 6px;">
                <span style="font-size: 10px; color: #10b981; font-weight: 600;">BEST:</span>
                <p style="margin: 2px 0; font-size: 10px; color: #6ee7b7; line-height: 1.4;">
                  ${selectedVar.anchors.best}
                </p>
              </div>
              <div>
                <span style="font-size: 10px; color: #ef4444; font-weight: 600;">WORST:</span>
                <p style="margin: 2px 0; font-size: 10px; color: #fca5a5; line-height: 1.4;">
                  ${selectedVar.anchors.worst}
                </p>
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Browser List -->
      <div id="bws-browser-list" style="flex: 1; overflow-y: auto; padding: 8px;">
        ${this.renderBrowserItems()}
      </div>

      <!-- Browser Legend -->
      <div style="padding: 12px; border-top: 1px solid #374151; background: #1f2937; font-size: 11px;">
        <div style="color: #9ca3af; margin-bottom: 6px; font-weight: 500;">Status Legend</div>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="color: #10b981; font-size: 16px;">●</span>
          <span style="color: #9ca3af;">Human Rated</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="color: #3b82f6; font-size: 16px;">◐</span>
          <span style="color: #9ca3af;">AI Rated</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="color: #8b5cf6; font-size: 16px;">◉</span>
          <span style="color: #9ca3af;">Both Rated</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="color: #6b7280; font-size: 16px;">○</span>
          <span style="color: #9ca3af;">Unrated</span>
        </div>
      </div>
    `;
  }

  /**
   * Render browser list items
   */
  renderBrowserItems() {
    const totalTuples = this.state.experimentData?.tuples_generated || 0;
    const currentIndex = this.state.currentTupleIndex;

    if (totalTuples === 0) {
      return `
        <div style="padding: 24px; text-align: center; color: #6b7280; font-size: 12px;">
          No comparison sets available
        </div>
      `;
    }

    const items = [];
    for (let i = 0; i < totalTuples; i++) {
      const isActive = i === currentIndex;

      // Get judgment status for this tuple
      const tupleData = this.state.allTuples ? this.state.allTuples[i] : null;
      const hasHumanRating = tupleData?.judgments?.some(j => j.rater_type === 'human') || false;
      const hasAIRating = tupleData?.judgments?.some(j => j.rater_type === 'ai') || false;

      // Determine status and color
      let status = 'unrated';
      let statusColor = '#6b7280';
      let statusIcon = '○';

      if (hasHumanRating && hasAIRating) {
        status = 'both';
        statusColor = '#8b5cf6'; // Purple for both
        statusIcon = '◉';
      } else if (hasHumanRating) {
        status = 'human';
        statusColor = '#10b981'; // Green for human
        statusIcon = '●';
      } else if (hasAIRating) {
        status = 'ai';
        statusColor = '#3b82f6'; // Blue for AI
        statusIcon = '◐';
      }

      items.push(`
        <div class="bws-browser-item ${isActive ? 'bws-browser-item-current' : ''}" data-tuple-index="${i}"
          style="
            padding: 8px;
            margin-bottom: 4px;
            border-radius: 4px;
            cursor: pointer;
            background: ${isActive ? '#374151' : 'transparent'};
            border: 2px solid ${isActive ? '#3b82f6' : 'transparent'};
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.15s;
            position: relative;
          "
          onmouseover="this.style.background='#374151'"
          onmouseout="this.style.background='${isActive ? '#374151' : 'transparent'}'"
        >
          <span style="color: ${statusColor}; font-size: 16px; flex-shrink: 0; width: 20px; text-align: center;">${statusIcon}</span>
          <div style="flex: 1;">
            <div style="font-size: 12px; color: ${isActive ? '#f3f4f6' : '#9ca3af'}; font-weight: ${isActive ? '600' : '400'};">
              Set ${i + 1}
              ${hasHumanRating || hasAIRating ? `
                <span style="font-size: 10px; margin-left: 8px; color: ${statusColor};">
                  ${hasHumanRating && hasAIRating ? '(Both)' : hasHumanRating ? '(Human)' : '(AI)'}
                </span>
              ` : ''}
            </div>
          </div>
          ${isActive ? `
            <div style="position: absolute; left: -4px; top: 50%; transform: translateY(-50%); width: 3px; height: 70%; background: #3b82f6; border-radius: 2px;"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; color: #3b82f6;">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          ` : ''}
        </div>
      `);
    }

    return items.join('');
  }

  /**
   * Attach event listeners to UI elements
   */
  attachEventListeners() {
    // Close button
    const closeBtn = document.getElementById('bws-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Zoom controls
    const zoomInBtn = document.getElementById('bws-zoom-in');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => this.zoomIn());
    }

    const zoomOutBtn = document.getElementById('bws-zoom-out');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => this.zoomOut());
    }

    // Settings
    const settingsBtn = document.getElementById('bws-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }

    // AI Controls
    const aiToggle = document.getElementById('bws-ai-toggle');
    if (aiToggle) {
      aiToggle.addEventListener('change', (e) => this.toggleAIRating(e.target.checked));
    }

    const ratingVariable = document.getElementById('bws-rating-variable');
    if (ratingVariable) {
      // Load rating variables on initialization
      this.loadRatingVariables();
      ratingVariable.addEventListener('change', (e) => this.selectRatingVariable(e.target.value));
    }

    const rateAllBtn = document.getElementById('bws-rate-all');
    if (rateAllBtn) {
      rateAllBtn.addEventListener('click', () => this.startAIRateAll());
    }

    // Navigation
    const prevBtn = document.getElementById('bws-prev-tuple');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previousTuple());
    }

    const nextBtn = document.getElementById('bws-next-tuple');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextTuple());
    }

    // Submit button
    const submitBtn = document.getElementById('bws-submit-rating');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitRating());
    }

    // Quadrant zoom-in buttons
    const zoomInBtns = document.querySelectorAll('[data-action="zoom-in"]');
    zoomInBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const quadrant = parseInt(e.target.closest('button').dataset.quadrant, 10);
        this.zoomQuadrant(quadrant, 1.2);
      });
    });

    // Quadrant zoom-out buttons
    const zoomOutBtns = document.querySelectorAll('[data-action="zoom-out"]');
    zoomOutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const quadrant = parseInt(e.target.closest('button').dataset.quadrant, 10);
        this.zoomQuadrant(quadrant, 0.8);
      });
    });

    // Quadrant expand buttons
    const expandBtns = document.querySelectorAll('[data-action="expand"]');
    expandBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const quadrant = e.target.closest('button').dataset.quadrant;
        this.expandQuadrant(quadrant);
      });
    });

    // New Experiment button (experiments list view)
    const newExpBtn = document.getElementById('bws-new-experiment');
    if (newExpBtn) {
      newExpBtn.addEventListener('click', () => this.createNewExperiment());
    }

    // Back to list button (comparison view)
    const backBtn = document.getElementById('bws-back-to-list');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.backToList());
    }

    // Experiment card buttons
    const configBtns = document.querySelectorAll('[data-action="configure"]');
    configBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const experimentId = e.target.dataset.experimentId;
        this.configureExperiment(experimentId);
      });
    });

    const openBtns = document.querySelectorAll('[data-action="open"]');
    openBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const experimentId = e.target.dataset.experimentId;
        this.openExperiment(experimentId);
      });
    });

    // Browser sidebar navigation
    const browserPrevBtn = document.getElementById('bws-browser-prev');
    if (browserPrevBtn) {
      browserPrevBtn.addEventListener('click', () => this.previousTuple());
    }

    const browserNextBtn = document.getElementById('bws-browser-next');
    if (browserNextBtn) {
      browserNextBtn.addEventListener('click', () => this.nextTuple());
    }

    // Browser item clicks
    const browserItems = document.querySelectorAll('.bws-browser-item');
    browserItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const tupleIndex = parseInt(e.currentTarget.dataset.tupleIndex, 10);
        this.goToTuple(tupleIndex);
      });
    });

    // PDF quadrant clicks for rating
    const quadrants = document.querySelectorAll('.bws-pdf-quadrant');
    quadrants.forEach((quadrant, index) => {
      quadrant.addEventListener('click', (e) => {
        // Don't trigger rating if clicking on controls
        if (e.target.closest('.bws-quadrant-controls')) {
          return;
        }
        this.handleQuadrantClick(index);
      });
    });

    // Sidebar toggle button
    const sidebarToggleBtn = document.getElementById('bws-toggle-sidebar');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.addEventListener('click', () => this.toggleSidebar());
    }
  }

  /**
   * Load all BWS experiments for the current collection
   */
  async loadExperiments() {
    if (!this.state.collectionId) {
      console.error('BWS Workspace: No collection ID set');
      return;
    }

    console.log('BWS Workspace: Loading experiments for collection', this.state.collectionId);

    this.state.isLoading = true;
    this.renderExperimentsList();

    try {
      const result = await window.api.bws.getExperimentsForCollection({ collectionId: this.state.collectionId });

      if (result && result.success) {
        this.state.experiments = result.experiments || [];
        console.log(`BWS Workspace: Loaded ${this.state.experiments.length} experiments`);

        if (this.state.experiments.length === 0) {
          this.updateStatus('No experiments yet - create one to get started');
        } else {
          this.updateStatus(`${this.state.experiments.length} experiment${this.state.experiments.length === 1 ? '' : 's'} found`);
        }
      } else {
        throw new Error(result.error || 'Failed to load experiments');
      }
    } catch (error) {
      console.error('Failed to load experiments:', error);
      this.state.experiments = [];
      this.updateStatus('Error loading experiments');
    } finally {
      this.state.isLoading = false;
      this.renderExperimentsList();
    }
  }

  /**
   * Load an experiment into the workspace
   * @param {string} experimentId - The ID of the BWS experiment to load
   */
  async loadExperiment(experimentId) {
    this.state.isLoading = true;
    this.state.selectedExperiment = experimentId;
    this.updateStatus('Loading experiment...');

    try {
      // Load experiment data
      const experimentResult = await window.api.bws.getExperiment({ experimentId });
      if (!experimentResult || !experimentResult.success) {
        throw new Error(experimentResult?.error || 'Failed to load experiment');
      }

      this.state.experimentData = experimentResult.experiment;
      this.currentExperiment = experimentResult.experiment; // For AI rating functions
      console.log('BWS Workspace: Experiment loaded:', this.state.experimentData);

      // Load all tuples with judgments for sidebar indicators
      console.log('BWS Workspace: Loading all tuples for sidebar...');
      await this.loadAllTuplesWithJudgments();

      // Load first tuple
      console.log('BWS Workspace: About to call loadCurrentTuple() from loadExperiment...');
      await this.loadCurrentTuple();
      console.log('BWS Workspace: loadCurrentTuple() returned');

      this.updateStatus(`Tuple 1 of ${this.state.experimentData.tuples_generated || 0}`);
    } catch (error) {
      console.error('Failed to load experiment:', error);
      this.updateStatus('Error loading experiment');
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Load all tuples with judgments for sidebar indicators
   */
  async loadAllTuplesWithJudgments() {
    try {
      const experimentId = this.state.selectedExperiment;
      if (!experimentId) return;

      // Get all tuples
      const tuplesResult = await window.api.bws.getAllTuples({ experimentId });
      console.log('BWS Workspace: All tuples result:', tuplesResult?.length || 0, 'tuples');

      // Get all judgments for this experiment
      const judgmentsResult = await window.api.bws.getJudgments({ experimentId });
      console.log('BWS Workspace: Judgments result:', judgmentsResult?.length || 0, 'judgments');

      // Combine tuples with their judgments
      if (tuplesResult && Array.isArray(tuplesResult)) {
        this.state.allTuples = tuplesResult.map(tuple => {
          const tupleJudgments = judgmentsResult?.filter(j => j.tuple_id === tuple.id) || [];
          return {
            ...tuple,
            judgments: tupleJudgments
          };
        });
      }

      console.log('BWS Workspace: Loaded', this.state.allTuples?.length || 0, 'tuples with judgments');
    } catch (error) {
      console.error('Failed to load all tuples:', error);
      this.state.allTuples = [];
    }
  }

  /**
   * Load current tuple from database
   */
  async loadCurrentTuple() {
    console.log('BWS Workspace: loadCurrentTuple called, experimentId:', this.state.selectedExperiment);
    try {
      console.log('BWS Workspace: Fetching all tuples...');
      const tuplesResult = await window.api.bws.getAllTuples({ experimentId: this.state.selectedExperiment });
      console.log('BWS Workspace: Tuples result:', tuplesResult);

      // Handle both response formats: array or object with success/tuples
      let tuples;
      if (Array.isArray(tuplesResult)) {
        tuples = tuplesResult;
      } else if (tuplesResult && tuplesResult.success && tuplesResult.tuples) {
        tuples = tuplesResult.tuples;
      } else {
        console.log('BWS Workspace: No tuples found');
        this.updateStatus('No tuples found for this experiment');
        return;
      }

      if (!tuples || tuples.length === 0) {
        console.log('BWS Workspace: Tuples array is empty');
        this.updateStatus('No tuples found for this experiment');
        return;
      }
      console.log(`BWS Workspace: Found ${tuples.length} tuples, loading index ${this.state.currentTupleIndex}`);

      // Get the specific tuple at current index
      const tuple = tuples[this.state.currentTupleIndex];
      if (!tuple) {
        console.error('Tuple not found at index:', this.state.currentTupleIndex);
        return;
      }

      console.log('BWS Workspace: Fetching tuple with items, tupleId:', tuple.id);

      // Fetch tuple with items (PDF excerpts)
      const tupleWithItemsResult = await window.api.bws.getTupleWithItems({ tupleId: tuple.id });
      console.log('BWS Workspace: Tuple with items result:', tupleWithItemsResult);

      // Handle both response formats: direct object or wrapped with success/tuple
      let tupleWithItems;
      if (tupleWithItemsResult && tupleWithItemsResult.success && tupleWithItemsResult.tuple) {
        tupleWithItems = tupleWithItemsResult.tuple;
      } else if (tupleWithItemsResult && tupleWithItemsResult.id) {
        // Direct tuple object
        tupleWithItems = tupleWithItemsResult;
      } else {
        console.error('Failed to load tuple items');
        return;
      }

      this.state.currentTuple = tupleWithItems;
      console.log('BWS Workspace: Current tuple set, items:', tupleWithItems.items);

      // Load PDF excerpts into quadrants
      console.log('BWS Workspace: About to call loadExcerpts...');
      await this.loadExcerpts(tupleWithItems.items);
      console.log('BWS Workspace: loadExcerpts completed');

      // Clear all previous rating visuals first
      this.clearAllRatingVisuals();

      // Check for existing judgments for this tuple and display them
      if (this.state.allTuples && this.state.allTuples[this.state.currentTupleIndex]) {
        const tupleWithJudgments = this.state.allTuples[this.state.currentTupleIndex];
        if (tupleWithJudgments.judgments && tupleWithJudgments.judgments.length > 0) {
          console.log('BWS Workspace: Found existing judgments:', tupleWithJudgments.judgments);

          // Show AI and human ratings if they exist
          const aiJudgment = tupleWithJudgments.judgments.find(j => j.rater_type === 'ai');
          const humanJudgment = tupleWithJudgments.judgments.find(j => j.rater_type === 'human');

          // Use setTimeout to ensure DOM is ready
          setTimeout(() => {
            if (aiJudgment) {
              this.showAIRating(aiJudgment.best_item_index, aiJudgment.worst_item_index);
            }

            if (humanJudgment) {
              this.showHumanRating(humanJudgment.best_item_index, humanJudgment.worst_item_index);
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Failed to load tuple:', error);
      this.updateStatus('Error loading tuple');
    }
  }

  /**
   * Load PDF excerpts into the quadrants
   * @param {Array} excerpts - Array of 4 PDF excerpt objects
   */
  async loadExcerpts(excerpts) {
    console.log('BWS Workspace: loadExcerpts called with:', excerpts);

    if (!excerpts || excerpts.length < 1) {
      console.error('BWS Workspace: No excerpts to load');
      return;
    }

    console.log(`BWS Workspace: Loading ${excerpts.length} excerpts`);

    // Clean up old highlighters to stop them from drawing old excerpts
    if (this.pdfHighlighters) {
      this.pdfHighlighters.forEach((highlighter) => {
        if (highlighter && highlighter.cleanup) {
          highlighter.cleanup();
        }
      });
    }

    // Clear previous renderers and highlighters arrays to start fresh
    this.pdfRenderers = [];
    this.pdfHighlighters = [];

    // Ensure we have exactly 4 excerpts (pad with nulls if needed)
    const paddedExcerpts = [...excerpts];
    while (paddedExcerpts.length < 4) {
      paddedExcerpts.push(null);
    }

    for (let index = 0; index < 4; index++) {
      const excerpt = paddedExcerpts[index];
      const rendererDiv = document.getElementById(`bws-pdf-${index}`);

      console.log(`BWS Workspace: Processing quadrant ${index}, excerpt:`, excerpt ? `ID ${excerpt.id}` : 'null');

      if (!rendererDiv) {
        console.warn(`Renderer div not found for quadrant ${index}`);
        continue;
      }

      if (!excerpt) {
        // No excerpt for this quadrant, show placeholder
        console.log(`BWS Workspace: Showing placeholder for quadrant ${index}`);
        rendererDiv.innerHTML = `
          <div class="bws-pdf-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <p>No excerpt</p>
          </div>
        `;
        continue;
      }

      // Clear previous content
      rendererDiv.innerHTML = '';

      try {
        console.log(`BWS Workspace: Getting file path for PDF ${excerpt.pdf_id}`);

        // Get PDF file path
        const filePathResult = await window.api.pdf.getFilePath(excerpt.pdf_id);
        if (!filePathResult || !filePathResult.success) {
          throw new Error('Failed to get PDF file path');
        }

        const filePath = filePathResult.filePath;
        const pdfUrl = filePath.startsWith('file://') ? filePath : 'file://' + filePath;

        console.log(`BWS Workspace: PDF URL for quadrant ${index}: ${pdfUrl}`);

        // Create PDF renderer
        const renderer = new PDFRenderer(rendererDiv);
        this.pdfRenderers[index] = renderer;

        // Create highlighter for this quadrant
        if (!this.pdfHighlighters) {
          this.pdfHighlighters = [];
        }
        const highlighter = new PDFHighlighter(rendererDiv, renderer);
        this.pdfHighlighters[index] = highlighter;

        // Store zoom scale for this renderer
        if (!this.quadrantScales) {
          this.quadrantScales = [1.0, 1.0, 1.0, 1.0]; // Default 100% zoom for better overview
        }

        console.log(`BWS Workspace: Loading PDF for quadrant ${index}...`);

        // Load PDF
        await renderer.loadPDF(pdfUrl);

        console.log(`BWS Workspace: PDF loaded for quadrant ${index}, setting zoom...`);

        // Set zoom to 200% for readability
        await renderer.setZoom(this.quadrantScales[index]);

        console.log(`BWS Workspace: Navigating to excerpt page ${excerpt.page_number} for quadrant ${index}...`);

        // Navigate to the excerpt's page
        await renderer.goToPage(excerpt.page_number);

        console.log(`BWS Workspace: Loading highlights for quadrant ${index}...`);

        // Load this single excerpt as a highlight (with bounding box)
        highlighter.loadExcerpts([excerpt]);

        console.log(`BWS Workspace: Adding text overlay for quadrant ${index}...`);

        // Add excerpt text overlay
        this.addExcerptTextOverlay(rendererDiv, excerpt, index);

        console.log(`BWS Workspace: Quadrant ${index} fully loaded!`);

        console.log(`Loaded PDF excerpt in quadrant ${index}:`, excerpt);
      } catch (error) {
        console.error(`Failed to load PDF for quadrant ${index}:`, error);
        rendererDiv.innerHTML = `
          <div class="bws-pdf-placeholder">
            <p style="color: #ef4444;"><strong>Error loading PDF</strong></p>
            <p style="font-size: 12px;">${error.message}</p>
          </div>
        `;
      }
    }
  }

  /**
   * Add excerpt text overlay to a quadrant
   * @param {HTMLElement} container - The container element
   * @param {Object} excerpt - The excerpt object
   * @param {number} index - Quadrant index
   */
  addExcerptTextOverlay(container, excerpt, index) {
    const overlay = document.createElement('div');
    overlay.className = 'bws-excerpt-text-overlay';
    overlay.innerHTML = `
      <div class="bws-excerpt-text-header">
        <span class="bws-excerpt-label">Excerpt Text</span>
        <button class="bws-btn bws-btn-icon" onclick="this.parentElement.parentElement.classList.toggle('minimized')" title="Toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
      <div class="bws-excerpt-text-content">
        ${excerpt.text_content || excerpt.excerpt_text || excerpt.text || 'No text available'}
      </div>
    `;
    container.appendChild(overlay);
  }

  /**
   * Update status text
   * @param {string} text - Status text to display
   */
  updateStatus(text) {
    const statusEl = document.getElementById('bws-status-text');
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  /**
   * Navigation: Go to previous tuple
   */
  async previousTuple() {
    if (this.state.currentTupleIndex > 0) {
      this.state.currentTupleIndex--;
      this.resetRating(); // Clear rating when navigating
      await this.loadCurrentTuple();
      this.updateStatus(`Tuple ${this.state.currentTupleIndex + 1} of ${this.state.experimentData?.tuples_generated || 0}`);
      // Update browser sidebar without re-rendering entire view
      this.updateBrowserSidebar();
    }
  }

  /**
   * Navigation: Go to next tuple
   */
  async nextTuple() {
    const maxTuples = this.state.experimentData?.tuples_generated || 0;
    if (this.state.currentTupleIndex < maxTuples - 1) {
      this.state.currentTupleIndex++;
      this.resetRating(); // Clear rating when navigating
      await this.loadCurrentTuple();
      this.updateStatus(`Tuple ${this.state.currentTupleIndex + 1} of ${maxTuples}`);
      // Update browser sidebar without re-rendering entire view
      this.updateBrowserSidebar();
    }
  }

  /**
   * Navigation: Go to specific tuple
   * @param {number} tupleIndex - Index of the tuple to load
   */
  async goToTuple(tupleIndex) {
    const maxTuples = this.state.experimentData?.tuples_generated || 0;
    if (tupleIndex >= 0 && tupleIndex < maxTuples) {
      this.state.currentTupleIndex = tupleIndex;
      this.resetRating(); // Clear rating when navigating
      await this.loadCurrentTuple();
      this.updateStatus(`Tuple ${this.state.currentTupleIndex + 1} of ${maxTuples}`);
      // Update browser sidebar without re-rendering entire view
      this.updateBrowserSidebar();
    }
  }

  /**
   * Update browser sidebar without re-rendering entire view
   */
  updateBrowserSidebar() {
    // Re-render the entire sidebar to update everything
    const sidebarEl = document.getElementById('bws-browser-sidebar');
    if (sidebarEl) {
      sidebarEl.innerHTML = this.renderBrowserSidebar();

      // Re-attach event listeners for browser items
      const browserItems = document.querySelectorAll('.bws-browser-item');
      browserItems.forEach(item => {
        item.addEventListener('click', (e) => {
          const tupleIndex = parseInt(e.currentTarget.dataset.tupleIndex, 10);
          this.goToTuple(tupleIndex);
        });
      });

      // Re-attach navigation buttons in sidebar
      const browserPrevBtn = document.getElementById('bws-browser-prev');
      if (browserPrevBtn) {
        browserPrevBtn.addEventListener('click', () => this.previousTuple());
      }

      const browserNextBtn = document.getElementById('bws-browser-next');
      if (browserNextBtn) {
        browserNextBtn.addEventListener('click', () => this.nextTuple());
      }
    }

    // Update main navigation buttons
    const prevBtn = document.getElementById('bws-prev-tuple');
    const nextBtn = document.getElementById('bws-next-tuple');
    const maxTuples = this.state.experimentData?.tuples_generated || 0;

    if (prevBtn) {
      prevBtn.disabled = this.state.currentTupleIndex === 0;
    }

    if (nextBtn) {
      nextBtn.disabled = this.state.currentTupleIndex >= maxTuples - 1;
    }
  }

  /**
   * Zoom a specific quadrant
   * @param {number} quadrant - Index of the quadrant
   * @param {number} factor - Zoom factor (e.g., 1.2 for zoom in, 0.8 for zoom out)
   */
  async zoomQuadrant(quadrant, factor) {
    if (!this.pdfRenderers || !this.pdfRenderers[quadrant]) {
      console.warn(`No renderer for quadrant ${quadrant}`);
      return;
    }

    const renderer = this.pdfRenderers[quadrant];

    // Update scale
    if (!this.quadrantScales) {
      this.quadrantScales = [1.0, 1.0, 1.0, 1.0];
    }

    this.quadrantScales[quadrant] *= factor;
    await renderer.setZoom(this.quadrantScales[quadrant]);

    console.log(`Zoomed quadrant ${quadrant} to ${this.quadrantScales[quadrant]}x`);
  }

  /**
   * Zoom in on all PDFs
   */
  zoomIn() {
    console.log('BWS Workspace: Zoom in');
    // TODO: Implement zoom functionality
  }

  /**
   * Zoom out on all PDFs
   */
  zoomOut() {
    console.log('BWS Workspace: Zoom out');
    // TODO: Implement zoom functionality
  }

  /**
   * Open settings modal
   */
  openSettings() {
    console.log('BWS Workspace: Open settings');
    // TODO: Implement settings modal
  }

  /**
   * Expand a specific quadrant to fullscreen
   * @param {number} quadrant - Index of the quadrant to expand
   */
  expandQuadrant(quadrant) {
    console.log('BWS Workspace: Expand quadrant', quadrant);
    // TODO: Implement quadrant expansion
  }

  /**
   * Create a new BWS experiment
   */
  async createNewExperiment() {
    console.log('BWS Workspace: Create new experiment');

    if (!this.state.collectionId) {
      alert('No collection selected');
      return;
    }

    this.showNewExperimentModal();
  }

  /**
   * Show the new experiment configuration modal
   */
  showNewExperimentModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Create BWS Experiment</h3>
          <button class="close-btn" id="bws-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="bws-experiment-form">
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 4px; color: #9ca3af; font-size: 13px;">Experiment Name</label>
              <input type="text" id="exp-name" required
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;"
                placeholder="My BWS Experiment">
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 4px; color: #9ca3af; font-size: 13px;">
                Appearances per Excerpt
              </label>
              <input type="number" id="exp-appearances" value="4" min="1" max="20" required
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
              <small style="color: #6b7280;">How many times each excerpt should appear across all tuples</small>
            </div>

            <div style="padding: 12px; background: #111827; border-radius: 4px; border: 1px solid #374151;">
              <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Settings</div>
              <div style="font-size: 12px; color: #6b7280;">
                • Tuple size: <strong style="color: #f3f4f6;">4 excerpts</strong> (fixed)<br>
                • Item type: <strong style="color: #f3f4f6;">PDF Excerpts</strong><br>
                • Raters: <strong style="color: #f3f4f6;">Human + AI</strong><br>
                • Design: <strong style="color: #f3f4f6;">Balanced</strong><br>
                • Scoring: <strong style="color: #f3f4f6;">Bradley-Terry</strong>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="bws-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="bws-modal-create">Create Experiment</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('#bws-modal-close');
    const cancelBtn = modal.querySelector('#bws-modal-cancel');
    const createBtn = modal.querySelector('#bws-modal-create');

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    createBtn.addEventListener('click', async () => {
      const form = document.getElementById('bws-experiment-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const config = {
        name: document.getElementById('exp-name').value,
        source_type: 'collection',
        collection_id: this.state.collectionId,
        include_pdfs: true,
        include_chunks: false,
        include_comments: false,
        tuple_size: 4, // Fixed
        target_appearances: parseInt(document.getElementById('exp-appearances').value, 10),
        design_method: 'balanced',
        scoring_method: 'bradley_terry',
        rater_type: 'hybrid' // Always human + AI
      };

      console.log('Creating BWS experiment with config:', config);

      try {
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';

        const result = await window.api.bws.createExperiment(config);

        if (result && result.success) {
          console.log('Experiment created successfully:', result);
          closeModal();
          // Reload experiments list
          await this.loadExperiments();
        } else {
          throw new Error(result.error || 'Failed to create experiment');
        }
      } catch (error) {
        console.error('Failed to create experiment:', error);
        alert('Failed to create experiment: ' + error.message);
        createBtn.disabled = false;
        createBtn.textContent = 'Create Experiment';
      }
    });
  }

  /**
   * Configure an existing experiment
   * @param {string} experimentId - ID of the experiment to configure
   */
  configureExperiment(experimentId) {
    console.log('BWS Workspace: Configure experiment', experimentId);
    // TODO: Open configuration modal
  }

  /**
   * Open an experiment in comparison view
   * @param {string} experimentId - ID of the experiment to open
   */
  async openExperiment(experimentId) {
    console.log('BWS Workspace: Opening experiment', experimentId);
    this.state.view = 'comparison-view';
    this.state.selectedExperiment = experimentId;

    // First render the comparison view structure
    this.render();

    // Then load the experiment data and PDFs
    await this.loadExperiment(experimentId);
  }

  /**
   * Return to experiments list view
   */
  backToList() {
    console.log('BWS Workspace: Back to list');
    this.state.view = 'experiments-list';
    this.state.selectedExperiment = null;
    this.render();
  }

  /**
   * Handle quadrant click for Best/Worst rating
   * @param {number} quadrantIndex - Index of the clicked quadrant (0-3)
   */
  handleQuadrantClick(quadrantIndex) {
    // Initialize rating start time if this is the first click
    if (this.state.rating.startTime === null) {
      this.state.rating.startTime = Date.now();
    }

    // Check if clicking on already-selected quadrant (deselect)
    if (this.state.rating.bestExcerptIndex === quadrantIndex) {
      this.state.rating.bestExcerptIndex = null;
      this.updateQuadrantVisuals();
      this.updateStatus('Best selection cleared. Click to select Best.');
      return;
    }

    if (this.state.rating.worstExcerptIndex === quadrantIndex) {
      this.state.rating.worstExcerptIndex = null;
      this.updateQuadrantVisuals();
      this.updateStatus('Worst selection cleared. Click to select Worst.');
      return;
    }

    // If no "Best" selected yet, mark this as "Best"
    if (this.state.rating.bestExcerptIndex === null) {
      this.state.rating.bestExcerptIndex = quadrantIndex;
      this.updateQuadrantVisuals();
      this.updateStatus('Best selected. Now select Worst.');
      return;
    }

    // If "Best" already selected but no "Worst", mark this as "Worst"
    if (this.state.rating.worstExcerptIndex === null) {
      this.state.rating.worstExcerptIndex = quadrantIndex;
      this.updateQuadrantVisuals();
      this.updateStatus('Best and Worst selected. Click Submit to save.');
      this.updateSubmitButton();
      return;
    }

    // If both are already selected, clicking on a new quadrant replaces Worst
    this.state.rating.worstExcerptIndex = quadrantIndex;
    this.updateQuadrantVisuals();
    this.updateStatus('Worst changed. Click Submit to save.');
    this.updateSubmitButton();
  }

  /**
   * Update submit button visibility
   */
  updateSubmitButton() {
    const submitBtn = document.getElementById('bws-submit-rating');
    if (submitBtn) {
      // Show submit button only when both best and worst are selected
      if (this.state.rating.bestExcerptIndex !== null &&
          this.state.rating.worstExcerptIndex !== null) {
        submitBtn.style.display = 'inline-flex';
      } else {
        submitBtn.style.display = 'none';
      }
    }
  }

  /**
   * Submit the current rating
   */
  submitRating() {
    if (this.state.rating.bestExcerptIndex !== null &&
        this.state.rating.worstExcerptIndex !== null) {
      this.saveJudgment();
    }
  }

  /**
   * Update visual feedback on quadrants based on current rating state
   */
  updateQuadrantVisuals() {
    const quadrants = document.querySelectorAll('.bws-pdf-quadrant');

    quadrants.forEach((quadrant, index) => {
      // Remove all rating classes
      quadrant.classList.remove('bws-rated-best', 'bws-rated-worst');

      // Add appropriate class based on rating state
      if (this.state.rating.bestExcerptIndex === index) {
        quadrant.classList.add('bws-rated-best');
      } else if (this.state.rating.worstExcerptIndex === index) {
        quadrant.classList.add('bws-rated-worst');
      }
    });
  }

  /**
   * Save the current Best/Worst judgment to database
   */
  async saveJudgment() {
    if (!this.state.currentTuple ||
        this.state.rating.bestExcerptIndex === null ||
        this.state.rating.worstExcerptIndex === null) {
      console.warn('Cannot save judgment: incomplete rating');
      return;
    }

    try {
      // Get the actual excerpt IDs from the current tuple
      const bestItem = this.state.currentTuple.items[this.state.rating.bestExcerptIndex];
      const worstItem = this.state.currentTuple.items[this.state.rating.worstExcerptIndex];

      if (!bestItem || !worstItem) {
        console.error('Cannot find excerpt items for rating');
        return;
      }

      // Calculate response time
      const responseTimeMs = this.state.rating.startTime
        ? Date.now() - this.state.rating.startTime
        : null;

      // Prepare judgment data
      const judgmentData = {
        tuple_id: this.state.currentTuple.id,
        rater_type: 'human',
        rater_id: 'user', // TODO: Get actual user ID if multi-user system
        best_item_id: bestItem.id,
        worst_item_id: worstItem.id,
        reasoning: null, // Optional: could add a text box for user to explain their choice
        response_time_ms: responseTimeMs
      };

      console.log('Saving judgment:', judgmentData);

      // Save via IPC
      const result = await window.api.bws.saveJudgment(judgmentData);

      if (result && result.success) {
        console.log('Judgment saved successfully');
        this.updateStatus('✓ Rating saved! Ready for next comparison.');

        // Update the local state to reflect the new judgment
        if (this.state.allTuples && this.state.allTuples[this.state.currentTupleIndex]) {
          const newJudgment = {
            tuple_id: tupleId,
            best_item_index: bestIndex,
            worst_item_index: worstIndex,
            rater_type: 'human',
            created_at: new Date().toISOString()
          };

          // Add or update the human judgment in the local state
          const existingJudgments = this.state.allTuples[this.state.currentTupleIndex].judgments || [];
          const updatedJudgments = existingJudgments.filter(j => j.rater_type !== 'human');
          updatedJudgments.push(newJudgment);
          this.state.allTuples[this.state.currentTupleIndex].judgments = updatedJudgments;

          // Update the sidebar to show the new rating
          this.updateBrowserSidebar();
        }

        // Optional: Auto-advance to next tuple after a short delay
        setTimeout(() => {
          this.resetRating();
          this.nextTuple();
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to save judgment');
      }
    } catch (error) {
      console.error('Error saving judgment:', error);
      this.updateStatus('Error saving rating: ' + error.message);
    }
  }

  /**
   * Reset rating state for next tuple
   */
  resetRating() {
    this.state.rating = {
      bestExcerptIndex: null,
      worstExcerptIndex: null,
      startTime: null
    };
    this.updateQuadrantVisuals();
  }

  /**
   * Toggle sidebar visibility to maximize space
   */
  toggleSidebar() {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;

    const sidebar = document.getElementById('bws-browser-sidebar');
    const toggleBtn = document.getElementById('bws-toggle-sidebar');

    if (sidebar) {
      if (this.state.sidebarCollapsed) {
        sidebar.style.width = '0';
        sidebar.style.display = 'none';
        if (toggleBtn) {
          toggleBtn.title = 'Show Sidebar';
          toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          `;
        }
      } else {
        sidebar.style.width = '280px';
        sidebar.style.display = 'flex';
        if (toggleBtn) {
          toggleBtn.title = 'Hide Sidebar';
          toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          `;
        }
      }
    }
  }

  /**
   * Close the workspace and return to main view
   */
  close() {
    console.log('BWS Workspace: Closing');
    if (this.container) {
      this.container.innerHTML = '';
    }
    // Navigate back to collections view
    if (window.showView) {
      window.showView('collections');
    }
  }

  /**
   * Toggle AI auto-rating on/off
   * @param {boolean} enabled - Whether AI rating is enabled
   */
  toggleAIRating(enabled) {
    this.aiRatingEnabled = enabled;
    console.log(`BWS AI Rating: ${enabled ? 'Enabled' : 'Disabled'}`);

    if (enabled && this.selectedRatingVariable) {
      // Start monitoring for new tuples to auto-rate
      this.startAIMonitoring();
    } else {
      this.stopAIMonitoring();
    }
  }

  /**
   * Load available rating variables
   */
  async loadRatingVariables() {
    try {
      // Get rating variables from database
      const variables = await window.api.bws.getRatingVariables();

      // Store variables globally for reference
      this.allVariables = variables || [];

      const dropdown = document.getElementById('bws-rating-variable');
      if (dropdown && variables) {
        dropdown.innerHTML = '<option value="">Select Variable...</option>';

        // Add BWS variables first
        const bwsVars = variables.filter(v => v.variable_type === 'bws');
        if (bwsVars.length > 0) {
          const bwsGroup = document.createElement('optgroup');
          bwsGroup.label = 'BWS Variables';
          bwsVars.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable.id;
            option.textContent = variable.name;
            bwsGroup.appendChild(option);
          });
          dropdown.appendChild(bwsGroup);
        }

        // Add rating variables
        const ratingVars = variables.filter(v => v.variable_type === 'rating');
        if (ratingVars.length > 0) {
          const ratingGroup = document.createElement('optgroup');
          ratingGroup.label = 'Rating Variables';
          ratingVars.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable.id;
            option.textContent = variable.name;
            ratingGroup.appendChild(option);
          });
          dropdown.appendChild(ratingGroup);
        }
      }
    } catch (error) {
      console.error('Failed to load rating variables:', error);
    }
  }

  /**
   * Select a rating variable for AI rating
   * @param {string} variableId - The selected variable ID
   */
  selectRatingVariable(variableId) {
    this.selectedRatingVariable = variableId;

    // Find and store the variable information
    if (this.allVariables && variableId) {
      this.selectedVariableInfo = this.allVariables.find(v => v.id == variableId);
      console.log(`BWS Selected rating variable:`, this.selectedVariableInfo);

      // Update the sidebar to show variable information
      this.updateBrowserSidebar();
    } else {
      this.selectedVariableInfo = null;
    }
  }

  /**
   * Start AI rating for all unrated tuples
   */
  async startAIRateAll() {
    if (!this.currentExperiment) {
      this.updateStatusText('No experiment loaded');
      return;
    }

    if (!this.selectedRatingVariable) {
      this.updateStatusText('Please select a rating variable first');
      return;
    }

    try {
      const rateAllBtn = document.getElementById('bws-rate-all');
      if (rateAllBtn) {
        rateAllBtn.disabled = true;
        rateAllBtn.textContent = 'Rating...';
      }

      // Start AI rating process
      const result = await window.api.bws.startAIRating({
        experimentId: this.currentExperiment.id,
        variableId: this.selectedRatingVariable
      });

      if (result.success) {
        this.updateStatusText(`AI Rating started. Processing ${result.tupleCount} tuples...`);

        // Monitor progress
        this.monitorAIProgress();
      } else {
        this.updateStatusText(`AI Rating failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to start AI rating:', error);
      this.updateStatusText('Failed to start AI rating');
    } finally {
      const rateAllBtn = document.getElementById('bws-rate-all');
      if (rateAllBtn) {
        rateAllBtn.disabled = false;
        rateAllBtn.textContent = 'Rate All';
      }
    }
  }

  /**
   * Start monitoring for AI auto-rating
   */
  startAIMonitoring() {
    // Check for new unrated tuples periodically
    this.aiMonitorInterval = setInterval(() => {
      if (this.aiRatingEnabled && this.currentTuple && !this.currentTuple.ai_rating) {
        this.rateCurrentTupleWithAI();
      }
    }, 1000);
  }

  /**
   * Stop AI monitoring
   */
  stopAIMonitoring() {
    if (this.aiMonitorInterval) {
      clearInterval(this.aiMonitorInterval);
      this.aiMonitorInterval = null;
    }
  }

  /**
   * Rate the current tuple with AI
   */
  async rateCurrentTupleWithAI() {
    if (!this.currentTuple || !this.selectedRatingVariable) return;

    try {
      const result = await window.api.bws.rateTupleWithAI({
        tupleId: this.currentTuple.id,
        variableId: this.selectedRatingVariable,
        items: this.currentTuple.items
      });

      if (result.success) {
        // Update UI to show AI rating
        this.showAIRating(result.bestIndex, result.worstIndex);
        this.currentTuple.ai_rating = {
          best_index: result.bestIndex,
          worst_index: result.worstIndex
        };
      }
    } catch (error) {
      console.error('Failed to rate tuple with AI:', error);
    }
  }

  /**
   * Clear all rating visuals from quadrants
   */
  clearAllRatingVisuals() {
    const quadrants = document.querySelectorAll('.bws-pdf-quadrant');
    quadrants.forEach(quadrant => {
      quadrant.classList.remove('ai-best', 'ai-worst', 'human-best', 'human-worst', 'selected-best', 'selected-worst');
    });
  }

  /**
   * Show AI rating visually
   * @param {number} bestIndex - Index of best item
   * @param {number} worstIndex - Index of worst item
   */
  showAIRating(bestIndex, worstIndex) {
    // Add visual indicators for AI ratings
    const quadrants = document.querySelectorAll('.bws-pdf-quadrant');

    quadrants.forEach((quadrant, index) => {
      quadrant.classList.remove('ai-best', 'ai-worst');

      if (index === bestIndex) {
        quadrant.classList.add('ai-best');
      } else if (index === worstIndex) {
        quadrant.classList.add('ai-worst');
      }
    });
  }

  /**
   * Show human rating visually
   * @param {number} bestIndex - Index of best item
   * @param {number} worstIndex - Index of worst item
   */
  showHumanRating(bestIndex, worstIndex) {
    // Add visual indicators for human ratings
    const quadrants = document.querySelectorAll('.bws-pdf-quadrant');

    quadrants.forEach((quadrant, index) => {
      quadrant.classList.remove('human-best', 'human-worst');

      if (index === bestIndex) {
        quadrant.classList.add('human-best');
      } else if (index === worstIndex) {
        quadrant.classList.add('human-worst');
      }
    });
  }

  /**
   * Monitor AI rating progress
   */
  monitorAIProgress() {
    let checkCount = 0;
    const progressInterval = setInterval(async () => {
      try {
        const progress = await window.api.bws.getAIRatingProgress(this.currentExperiment.id);

        if (progress.completed >= progress.total) {
          clearInterval(progressInterval);
          this.updateStatusText(`AI Rating completed! Rated ${progress.total} tuples.`);

          // Refresh current tuple to show AI rating
          await this.loadCurrentTuple();
        } else {
          this.updateStatusText(`AI Rating progress: ${progress.completed}/${progress.total} tuples`);
        }

        checkCount++;
        if (checkCount > 300) { // Stop after 5 minutes
          clearInterval(progressInterval);
        }
      } catch (error) {
        console.error('Failed to get AI progress:', error);
        clearInterval(progressInterval);
      }
    }, 1000);
  }

  /**
   * Clean up and destroy the workspace
   */
  destroy() {
    this.stopAIMonitoring();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.state = null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BWSWorkspace;
}
