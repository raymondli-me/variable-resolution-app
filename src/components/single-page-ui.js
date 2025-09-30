// Single Page UI Component
class SinglePageUI {
  constructor() {
    this.settings = this.getDefaultSettings();
    this.init();
  }

  getDefaultSettings() {
    return {
      // Basic settings
      searchTerm: '',
      maxResults: 50,
      dateRange: 'month',
      orderBy: 'relevance',
      
      // Advanced settings
      advanced: {
        videoDuration: 'any',
        videoDefinition: 'any',
        minViews: null,
        maxViews: null,
        videoLanguage: 'en',
        channelType: 'any',
        embeddable: false,
        syndicated: true,
        apiQuotaLimit: 1000,
        rateLimitDelay: 500
      },
      
      // Extraction settings
      extraction: {
        // Metadata
        extractTitle: true,
        extractDescription: true,
        extractTags: true,
        extractThumbnails: true,
        extractCaptions: true,
        extractStatistics: true,
        extractPublishDate: true,
        
        // Channel
        extractChannelTitle: true,
        extractChannelId: true,
        extractChannelStats: false,
        extractChannelDescription: false,
        
        // Comments
        includeComments: true,
        maxComments: 100,
        commentSort: 'relevance',
        minCommentLikes: 0,
        includeReplies: true,
        commentAuthorChannelId: true,
        commentTimestamps: true,
        
        // Download
        downloadVideo: true,
        videoQuality: '720p',
        videoFormat: 'mp4',
        maxFileSize: 500,
        extractAudioOnly: false,
        downloadThumbnail: true,
        
        // Transcription
        enableTranscription: true,
        whisperModel: 'base',
        whisperDevice: 'auto',
        whisperLanguage: 'auto',
        whisperTimestamps: true,
        
        // Processing
        textProcessing: 'clean',
        skipDuplicates: true,
        continueOnError: true
      }
    };
  }

  init() {
    // Create the single-page UI structure
    this.createUI();
    this.bindEvents();
    this.loadSettings();
  }

  createUI() {
    const youtubeView = document.getElementById('youtubeView');
    if (!youtubeView) return;

    // Replace the tabbed interface with a single page
    youtubeView.innerHTML = `
      <div class="single-page-container">
        <h2>YouTube Data Collection</h2>
        
        <!-- Main Search Section -->
        <div class="search-section card">
          <div class="search-form">
            <div class="form-group">
              <label for="sp-searchTerm">Search Term</label>
              <input type="text" id="sp-searchTerm" placeholder="e.g., ADHD, mental health, climate change" />
              <small>Enter keywords to search for YouTube videos</small>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="sp-maxResults">Max Videos</label>
                <input type="number" id="sp-maxResults" min="1" max="500" value="50" />
              </div>
              
              <div class="form-group">
                <label for="sp-dateRange">Date Range</label>
                <select id="sp-dateRange">
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month" selected>This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="sp-orderBy">Sort By</label>
                <select id="sp-orderBy">
                  <option value="relevance" selected>Relevance</option>
                  <option value="date">Upload Date</option>
                  <option value="viewCount">View Count</option>
                  <option value="rating">Rating</option>
                  <option value="title">Title (A-Z)</option>
                </select>
              </div>
            </div>
            
            <button id="sp-searchBtn" class="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Search YouTube
            </button>
          </div>
        </div>

        <!-- Collapsible Options -->
        <div class="options-container">
          <!-- Advanced Filters -->
          <div class="option-section">
            <button class="section-toggle" data-section="filters">
              <svg class="toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Advanced Filters
              <span class="section-summary" id="filtersSummary"></span>
            </button>
            <div class="section-content" id="filtersContent" style="display: none;">
              <div class="form-row">
                <div class="form-group">
                  <label for="sp-videoDuration">Duration</label>
                  <select id="sp-videoDuration">
                    <option value="any">Any Duration</option>
                    <option value="short">< 4 minutes</option>
                    <option value="medium">4-20 minutes</option>
                    <option value="long">> 20 minutes</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="sp-videoDefinition">Quality</label>
                  <select id="sp-videoDefinition">
                    <option value="any">Any Quality</option>
                    <option value="high">HD Only</option>
                    <option value="standard">Standard</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="sp-videoLanguage">Language</label>
                  <select id="sp-videoLanguage">
                    <option value="">Any Language</option>
                    <option value="en" selected>English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="sp-minViews">Min Views</label>
                  <input type="number" id="sp-minViews" placeholder="e.g., 10000" />
                </div>
                
                <div class="form-group">
                  <label for="sp-maxViews">Max Views</label>
                  <input type="number" id="sp-maxViews" placeholder="e.g., 1000000" />
                </div>
              </div>
            </div>
          </div>

          <!-- Data Collection Options -->
          <div class="option-section">
            <button class="section-toggle active" data-section="collection">
              <svg class="toggle-icon rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Data Collection
              <span class="section-summary" id="collectionSummary">
                <span class="summary-tag active">Videos</span>
                <span class="summary-tag active">Comments</span>
                <span class="summary-tag active">Transcripts</span>
              </span>
            </button>
            <div class="section-content" id="collectionContent">
              <!-- Comments -->
              <div class="option-group">
                <label class="checkbox-group">
                  <input type="checkbox" id="sp-includeComments" checked />
                  <span>Extract Comments</span>
                </label>
                <div class="sub-options" id="sp-commentOptions">
                  <div class="form-row">
                    <div class="form-group">
                      <label for="sp-maxComments">Max per Video</label>
                      <input type="number" id="sp-maxComments" value="100" min="1" max="10000" />
                    </div>
                    <div class="form-group">
                      <label for="sp-commentSort">Sort</label>
                      <select id="sp-commentSort">
                        <option value="relevance" selected>Relevance</option>
                        <option value="time">Newest</option>
                      </select>
                    </div>
                  </div>
                  <label class="checkbox-group">
                    <input type="checkbox" id="sp-includeReplies" checked />
                    <span>Include Reply Threads</span>
                  </label>
                </div>
              </div>

              <!-- Downloads -->
              <div class="option-group">
                <label class="checkbox-group">
                  <input type="checkbox" id="sp-downloadVideo" checked />
                  <span>Download Videos</span>
                </label>
                <div class="sub-options" id="sp-downloadOptions">
                  <div class="form-row">
                    <div class="form-group">
                      <label for="sp-videoQuality">Quality</label>
                      <select id="sp-videoQuality">
                        <option value="lowest">Lowest</option>
                        <option value="360p">360p</option>
                        <option value="480p">480p</option>
                        <option value="720p" selected>720p HD</option>
                        <option value="1080p">1080p FHD</option>
                        <option value="highest">Highest</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="sp-maxFileSize">Max Size (MB)</label>
                      <input type="number" id="sp-maxFileSize" value="500" min="10" max="5000" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Transcription -->
              <div class="option-group">
                <label class="checkbox-group">
                  <input type="checkbox" id="sp-enableTranscription" checked />
                  <span>Transcribe Audio</span>
                  <small class="transcription-status" id="sp-transcriptionStatus">Checking...</small>
                </label>
                <div class="sub-options" id="sp-transcriptionOptions">
                  <div class="form-row">
                    <div class="form-group">
                      <label for="sp-whisperModel">Model</label>
                      <select id="sp-whisperModel">
                        <option value="tiny">Tiny (fast)</option>
                        <option value="base" selected>Base</option>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large (best)</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="sp-whisperDevice">Device</label>
                      <select id="sp-whisperDevice">
                        <option value="auto" selected>Auto</option>
                        <option value="cuda">NVIDIA GPU</option>
                        <option value="mps">Apple Silicon</option>
                        <option value="cpu">CPU Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Processing Options -->
          <div class="option-section">
            <button class="section-toggle" data-section="processing">
              <svg class="toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Processing Options
              <span class="section-summary" id="processingSummary"></span>
            </button>
            <div class="section-content" id="processingContent" style="display: none;">
              <label class="checkbox-group">
                <input type="checkbox" id="sp-skipDuplicates" checked />
                <span>Skip duplicate videos</span>
              </label>
              <label class="checkbox-group">
                <input type="checkbox" id="sp-continueOnError" checked />
                <span>Continue on errors</span>
              </label>
              <div class="form-group">
                <label for="sp-textProcessing">Text Processing</label>
                <select id="sp-textProcessing">
                  <option value="none">No Processing</option>
                  <option value="clean" selected>Clean Text</option>
                  <option value="sentiment">With Sentiment</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Search Results (hidden initially) -->
        <div id="sp-searchResults" class="search-results" style="display: none;">
          <h3>Search Results</h3>
          <div class="results-header">
            <div class="results-actions">
              <button id="sp-selectAllBtn" class="btn btn-sm">Select All</button>
              <button id="sp-deselectAllBtn" class="btn btn-sm">Deselect All</button>
            </div>
            <div class="results-summary">
              <span id="sp-resultsCount">0 videos found</span>
              <button id="sp-startCollectionBtn" class="btn btn-primary" disabled>
                Start Collection (<span id="sp-selectedCount">0</span> selected)
              </button>
            </div>
          </div>
          <div id="sp-resultsList" class="results-list"></div>
        </div>

        <!-- Collection Progress (hidden initially) -->
        <div id="sp-collectionProgress" class="collection-progress" style="display: none;">
          <h3>Collection Progress</h3>
          <div class="progress-stats">
            <div class="stat">
              <span class="label">Status:</span>
              <span id="sp-collectionStatus" class="value">Initializing...</span>
            </div>
            <div class="stat">
              <span class="label">Videos:</span>
              <span id="sp-progressText" class="value">0 / 0</span>
            </div>
            <div class="stat">
              <span class="label">Time:</span>
              <span id="sp-timeElapsed" class="value">00:00</span>
            </div>
          </div>
          <div class="progress-bar">
            <div id="sp-progressFill" class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-actions">
            <button id="sp-pauseBtn" class="btn">Pause</button>
            <button id="sp-cancelBtn" class="btn btn-danger">Cancel</button>
          </div>
          <div id="sp-collectionLog" class="collection-log"></div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();
  }

  addStyles() {
    const styles = `
      <style>
        .single-page-container {
          padding: 20px;
          max-width: 1000px;
          margin: 0 auto;
        }
        
        .card {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        
        .options-container {
          margin-bottom: 20px;
        }
        
        .option-section {
          background: white;
          border-radius: 8px;
          margin-bottom: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .section-toggle {
          width: 100%;
          padding: 16px 20px;
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          font-size: 16px;
          font-weight: 500;
        }
        
        .section-toggle:hover {
          background: #f5f5f5;
        }
        
        .toggle-icon {
          transition: transform 0.2s;
        }
        
        .toggle-icon.rotate {
          transform: rotate(180deg);
        }
        
        .section-summary {
          margin-left: auto;
          font-size: 14px;
          font-weight: normal;
          color: #666;
        }
        
        .summary-tag {
          background: #e0e0e0;
          padding: 2px 8px;
          border-radius: 12px;
          margin-left: 4px;
          font-size: 12px;
        }
        
        .summary-tag.active {
          background: #2196F3;
          color: white;
        }
        
        .section-content {
          padding: 20px;
          border-top: 1px solid #e0e0e0;
        }
        
        .option-group {
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .option-group:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        
        .sub-options {
          margin-left: 28px;
          margin-top: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 4px;
        }
        
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          margin-bottom: 8px;
        }
        
        .checkbox-group input[type="checkbox"] {
          cursor: pointer;
        }
        
        .checkbox-group small {
          margin-left: 8px;
          color: #666;
          font-size: 12px;
        }
        
        @media (max-width: 768px) {
          .form-row {
            flex-direction: column;
          }
          
          .form-group {
            width: 100%;
          }
        }
      </style>
    `;
    
    if (!document.getElementById('single-page-styles')) {
      const styleElement = document.createElement('div');
      styleElement.id = 'single-page-styles';
      styleElement.innerHTML = styles;
      document.head.appendChild(styleElement);
    }
  }

  bindEvents() {
    // Section toggles
    document.querySelectorAll('.section-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const section = e.currentTarget.dataset.section;
        this.toggleSection(section);
      });
    });

    // Main search button
    const searchBtn = document.getElementById('sp-searchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.searchYouTube());
    }

    // Enter key on search
    const searchInput = document.getElementById('sp-searchTerm');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchYouTube();
      });
    }

    // Checkbox toggles for sub-options
    this.bindCheckboxToggle('sp-includeComments', 'sp-commentOptions');
    this.bindCheckboxToggle('sp-downloadVideo', 'sp-downloadOptions');
    this.bindCheckboxToggle('sp-enableTranscription', 'sp-transcriptionOptions');

    // Selection buttons
    document.getElementById('sp-selectAllBtn')?.addEventListener('click', () => this.selectAllVideos());
    document.getElementById('sp-deselectAllBtn')?.addEventListener('click', () => this.deselectAllVideos());
    document.getElementById('sp-startCollectionBtn')?.addEventListener('click', () => this.startCollection());

    // Collection controls
    document.getElementById('sp-pauseBtn')?.addEventListener('click', () => this.pauseCollection());
    document.getElementById('sp-cancelBtn')?.addEventListener('click', () => this.cancelCollection());

    // Update summaries on change
    this.bindSummaryUpdates();
  }

  bindCheckboxToggle(checkboxId, targetId) {
    const checkbox = document.getElementById(checkboxId);
    const target = document.getElementById(targetId);
    
    if (checkbox && target) {
      checkbox.addEventListener('change', (e) => {
        target.style.display = e.target.checked ? 'block' : 'none';
        this.updateSectionSummary('collection');
      });
      
      // Set initial state
      target.style.display = checkbox.checked ? 'block' : 'none';
    }
  }

  toggleSection(section) {
    const content = document.getElementById(`${section}Content`);
    const toggle = document.querySelector(`[data-section="${section}"]`);
    const icon = toggle.querySelector('.toggle-icon');
    
    if (content && toggle && icon) {
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'block';
      toggle.classList.toggle('active', !isVisible);
      icon.classList.toggle('rotate', !isVisible);
    }
  }

  updateSectionSummary(section) {
    const summary = document.getElementById(`${section}Summary`);
    if (!summary) return;

    switch(section) {
      case 'filters':
        const filters = [];
        if (document.getElementById('sp-videoDuration').value !== 'any') filters.push('Duration');
        if (document.getElementById('sp-videoDefinition').value !== 'any') filters.push('HD');
        if (document.getElementById('sp-minViews').value) filters.push('Views');
        summary.textContent = filters.length > 0 ? filters.join(', ') : '';
        break;
        
      case 'collection':
        summary.innerHTML = '';
        if (document.getElementById('sp-downloadVideo').checked) {
          summary.innerHTML += '<span class="summary-tag active">Videos</span>';
        }
        if (document.getElementById('sp-includeComments').checked) {
          summary.innerHTML += '<span class="summary-tag active">Comments</span>';
        }
        if (document.getElementById('sp-enableTranscription').checked) {
          summary.innerHTML += '<span class="summary-tag active">Transcripts</span>';
        }
        break;
        
      case 'processing':
        const processing = [];
        if (document.getElementById('sp-skipDuplicates').checked) processing.push('Skip Dupes');
        if (document.getElementById('sp-textProcessing').value !== 'none') processing.push('Clean Text');
        summary.textContent = processing.length > 0 ? processing.join(', ') : '';
        break;
    }
  }

  bindSummaryUpdates() {
    // Filters
    ['sp-videoDuration', 'sp-videoDefinition', 'sp-videoLanguage'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.updateSectionSummary('filters'));
    });
    ['sp-minViews', 'sp-maxViews'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateSectionSummary('filters'));
    });

    // Collection
    ['sp-includeComments', 'sp-downloadVideo', 'sp-enableTranscription'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.updateSectionSummary('collection'));
    });

    // Processing
    ['sp-skipDuplicates', 'sp-continueOnError', 'sp-textProcessing'].forEach(id => {
      const element = document.getElementById(id);
      element?.addEventListener('change', () => this.updateSectionSummary('processing'));
    });
  }

  collectSettings() {
    return {
      // Basic
      searchTerm: document.getElementById('sp-searchTerm').value,
      maxResults: parseInt(document.getElementById('sp-maxResults').value),
      dateRange: document.getElementById('sp-dateRange').value,
      orderBy: document.getElementById('sp-orderBy').value,
      
      // Advanced
      advanced: {
        videoDuration: document.getElementById('sp-videoDuration').value,
        videoDefinition: document.getElementById('sp-videoDefinition').value,
        minViews: document.getElementById('sp-minViews').value ? parseInt(document.getElementById('sp-minViews').value) : null,
        maxViews: document.getElementById('sp-maxViews').value ? parseInt(document.getElementById('sp-maxViews').value) : null,
        videoLanguage: document.getElementById('sp-videoLanguage').value,
      },
      
      // Extraction
      extraction: {
        includeComments: document.getElementById('sp-includeComments').checked,
        maxComments: parseInt(document.getElementById('sp-maxComments').value),
        commentSort: document.getElementById('sp-commentSort').value,
        includeReplies: document.getElementById('sp-includeReplies').checked,
        
        downloadVideo: document.getElementById('sp-downloadVideo').checked,
        videoQuality: document.getElementById('sp-videoQuality').value,
        maxFileSize: parseInt(document.getElementById('sp-maxFileSize').value),
        
        enableTranscription: document.getElementById('sp-enableTranscription').checked,
        whisperModel: document.getElementById('sp-whisperModel').value,
        whisperDevice: document.getElementById('sp-whisperDevice').value,
        
        textProcessing: document.getElementById('sp-textProcessing').value,
        skipDuplicates: document.getElementById('sp-skipDuplicates').checked,
        continueOnError: document.getElementById('sp-continueOnError').checked
      }
    };
  }

  async searchYouTube() {
    const settings = this.collectSettings();
    
    // Reuse the existing search functionality
    if (typeof searchYouTube === 'function') {
      // Temporarily update the form values to use existing function
      document.getElementById('searchTerm').value = settings.searchTerm;
      document.getElementById('maxResults').value = settings.maxResults;
      document.getElementById('dateRange').value = settings.dateRange;
      document.getElementById('orderBy').value = settings.orderBy;
      
      // Call the existing search function
      await searchYouTube();
      
      // Copy results to single-page UI
      const results = document.getElementById('searchResults');
      const spResults = document.getElementById('sp-searchResults');
      if (results && spResults) {
        spResults.style.display = results.style.display;
        document.getElementById('sp-resultsList').innerHTML = document.getElementById('resultsList').innerHTML;
        document.getElementById('sp-resultsCount').textContent = document.getElementById('resultsCount').textContent;
        
        // Re-bind event handlers for the copied elements
        this.bindResultsEvents();
      }
    }
  }

  bindResultsEvents() {
    // Re-bind checkbox events for video selection
    document.querySelectorAll('#sp-resultsList .result-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const videoId = e.target.dataset.videoId;
        const item = e.target.closest('.result-item');
        
        // Update the original checkbox too
        const originalCheckbox = document.querySelector(`#resultsList .result-checkbox[data-video-id="${videoId}"]`);
        if (originalCheckbox) {
          originalCheckbox.checked = e.target.checked;
          originalCheckbox.dispatchEvent(new Event('change'));
        }
        
        // Update UI
        item.classList.toggle('selected', e.target.checked);
        this.updateSelectedCount();
      });
    });
  }

  updateSelectedCount() {
    const count = document.querySelectorAll('#sp-resultsList .result-checkbox:checked').length;
    document.getElementById('sp-selectedCount').textContent = count;
    document.getElementById('sp-startCollectionBtn').disabled = count === 0;
  }

  selectAllVideos() {
    document.querySelectorAll('#sp-resultsList .result-checkbox').forEach(cb => {
      if (!cb.checked) cb.click();
    });
  }

  deselectAllVideos() {
    document.querySelectorAll('#sp-resultsList .result-checkbox').forEach(cb => {
      if (cb.checked) cb.click();
    });
  }

  async startCollection() {
    // Use the existing collection functionality
    if (typeof startCollection === 'function') {
      await startCollection();
      
      // Copy progress UI to single-page
      const progress = document.getElementById('collectionProgress');
      const spProgress = document.getElementById('sp-collectionProgress');
      if (progress && spProgress) {
        spProgress.style.display = progress.style.display;
        document.getElementById('sp-searchResults').style.display = 'none';
      }
    }
  }

  pauseCollection() {
    if (typeof pauseCollection === 'function') {
      pauseCollection();
    }
  }

  async cancelCollection() {
    if (typeof cancelCollection === 'function') {
      await cancelCollection();
      document.getElementById('sp-collectionProgress').style.display = 'none';
      document.getElementById('sp-searchResults').style.display = 'block';
    }
  }

  loadSettings() {
    // Load any saved settings
    this.updateSectionSummary('filters');
    this.updateSectionSummary('collection');
    this.updateSectionSummary('processing');
    
    // Check transcription availability
    this.checkTranscriptionAvailability();
  }

  async checkTranscriptionAvailability() {
    const status = document.getElementById('sp-transcriptionStatus');
    if (status && typeof checkToolsAvailability === 'function') {
      const tools = await checkToolsAvailability();
      if (tools?.whisper?.available) {
        status.textContent = 'Available';
        status.style.color = '#4CAF50';
      } else {
        status.textContent = 'Not installed';
        status.style.color = '#f44336';
      }
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.singlePageUI = new SinglePageUI();
  });
} else {
  window.singlePageUI = new SinglePageUI();
}