// Modern Single Page UI Component with Beautiful Design
class ModernSinglePageUI {
  constructor() {
    this.settings = this.getDefaultSettings();
    this.selectedVideos = new Map();
    this.currentVideos = [];
    this.collectionJob = null;
    this.init();
  }

  getDefaultSettings() {
    return {
      searchTerm: '',
      maxResults: 50,
      dateRange: 'month',
      orderBy: 'relevance',
      
      advanced: {
        videoDuration: 'any',
        videoDefinition: 'any',
        minViews: null,
        maxViews: null,
        videoLanguage: 'en',
        channelType: 'any',
        embeddable: false,
        syndicated: true
      },
      
      extraction: {
        includeComments: true,
        maxComments: 100,
        commentSort: 'relevance',
        includeReplies: true,
        downloadVideo: true,
        videoQuality: '480p',
        videoFormat: 'mp4',
        enableTranscription: true,
        whisperModel: 'base',
        whisperDevice: 'auto',
        enableVideoChunking: true
      }
    };
  }

  init() {
    this.createModernUI();
    this.bindEvents();
    this.loadSettings();
    this.checkTools();
    this.checkForIncompleteCollections();
  }

  createModernUI() {
    const youtubeView = document.getElementById('youtubeView');
    if (!youtubeView) return;

    youtubeView.innerHTML = `
      <div class="modern-container">
        <!-- Header -->
        <div class="modern-header">
          <div class="header-content">
            <div class="header-left">
              <h1 class="header-title">
                <svg class="header-icon" width="32" height="32" viewBox="0 0 24 24" fill="#FF0000">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube Data Collector
              </h1>
              <div class="header-subtitle">Collect videos, comments, and transcripts with ease</div>
            </div>
            <div class="tools-status" id="toolsStatusBar"></div>
          </div>
        </div>

        <!-- Main Search Area -->
        <div class="search-card">
          <div class="search-input-group">
            <input 
              type="text" 
              id="modern-searchTerm" 
              class="search-input" 
              placeholder="Search YouTube videos..."
              autocomplete="off"
            />
            <button id="modern-searchBtn" class="search-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Search
            </button>
          </div>

          <!-- Quick Settings Bar -->
          <div class="quick-settings">
            <div class="setting-group">
              <label class="setting-label">Videos</label>
              <input type="number" id="modern-maxResults" class="setting-input" value="50" min="1" max="500" />
            </div>
            
            <div class="setting-group">
              <label class="setting-label">Time</label>
              <select id="modern-dateRange" class="setting-select">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month" selected>This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            
            <div class="setting-group">
              <label class="setting-label">Sort</label>
              <select id="modern-orderBy" class="setting-select">
                <option value="relevance" selected>Relevance</option>
                <option value="date">Date</option>
                <option value="viewCount">Views</option>
                <option value="rating">Rating</option>
              </select>
            </div>

            <button class="toggle-advanced" id="toggleAdvanced">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m4.22-10.22l1.42-1.42m-1.42 10.88l1.42 1.42M20 12h-6m-6 0H2m10.22-4.22L10.8 6.36m1.42 10.88l-1.42 1.42"/>
              </svg>
              Advanced
            </button>
          </div>
        </div>

        <!-- Advanced Options (Hidden by default) -->
        <div class="advanced-panel" id="advancedPanel" style="display: none;">
          <div class="options-grid">
            <!-- Filters -->
            <div class="option-card">
              <h3 class="option-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filters
              </h3>
              <div class="option-content">
                <div class="option-row">
                  <div class="option-field">
                    <label>Duration</label>
                    <select id="modern-videoDuration" class="option-select">
                      <option value="any">Any</option>
                      <option value="short">Short (< 4 min)</option>
                      <option value="medium">Medium (4-20 min)</option>
                      <option value="long">Long (> 20 min)</option>
                    </select>
                  </div>
                  <div class="option-field">
                    <label>Quality</label>
                    <select id="modern-videoDefinition" class="option-select">
                      <option value="any">Any</option>
                      <option value="high">HD Only</option>
                    </select>
                  </div>
                </div>
                <div class="option-row">
                  <div class="option-field">
                    <label>Min Views</label>
                    <input type="number" id="modern-minViews" class="option-input" placeholder="0" />
                  </div>
                  <div class="option-field">
                    <label>Max Views</label>
                    <input type="number" id="modern-maxViews" class="option-input" placeholder="∞" />
                  </div>
                </div>
                <div class="option-field">
                  <label>Language</label>
                  <select id="modern-videoLanguage" class="option-select">
                    <option value="">Any</option>
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
            </div>

            <!-- Collection Settings -->
            <div class="option-card">
              <h3 class="option-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                Collection
              </h3>
              <div class="option-content">
                <label class="switch-label">
                  <input type="checkbox" id="modern-includeComments" class="switch-input" checked />
                  <span class="switch-slider"></span>
                  <span class="switch-text">Comments</span>
                </label>
                
                <div class="sub-options" id="modernCommentOptions">
                  <div class="option-row">
                    <div class="option-field">
                      <label>Max/Video</label>
                      <input type="number" id="modern-maxComments" class="option-input" value="100" />
                    </div>
                    <div class="option-field">
                      <label>Sort</label>
                      <select id="modern-commentSort" class="option-select">
                        <option value="relevance">Relevance</option>
                        <option value="time">Newest</option>
                      </select>
                    </div>
                  </div>
                  <div class="option-row" style="margin-top: 12px;">
                    <div class="option-field" style="flex: 1;">
                      <label style="color: #fbbf24;">Filter: Min Comments</label>
                      <input type="number" id="modern-minComments" class="option-input" 
                             value="0" min="0" placeholder="0" 
                             title="Grey out videos with fewer comments" />
                    </div>
                  </div>
                  <label class="checkbox-label">
                    <input type="checkbox" id="modern-includeReplies" checked />
                    <span>Include reply threads</span>
                  </label>
                </div>

                <label class="switch-label">
                  <input type="checkbox" id="modern-downloadVideo" class="switch-input" checked />
                  <span class="switch-slider"></span>
                  <span class="switch-text">Download Videos</span>
                </label>
                
                <div class="sub-options" id="modernDownloadOptions">
                  <div class="option-row">
                    <div class="option-field">
                      <label>Quality</label>
                      <select id="modern-videoQuality" class="option-select">
                        <option value="360p">360p</option>
                        <option value="480p" selected>480p</option>
                        <option value="720p">720p HD</option>
                        <option value="1080p">1080p FHD</option>
                        <option value="highest">Best</option>
                      </select>
                    </div>
                    <div class="option-field">
                      <label>Max Size</label>
                      <input type="number" id="modern-maxFileSize" class="option-input" value="500" placeholder="MB" />
                    </div>
                  </div>
                </div>

                <label class="switch-label">
                  <input type="checkbox" id="modern-enableTranscription" class="switch-input" checked />
                  <span class="switch-slider"></span>
                  <span class="switch-text">Transcribe Audio</span>
                  <span class="switch-status" id="modernTranscriptionStatus"></span>
                </label>
                
                <div class="sub-options" id="modernTranscriptionOptions">
                  <div class="option-row">
                    <div class="option-field">
                      <label>Model</label>
                      <select id="modern-whisperModel" class="option-select">
                        <option value="tiny">Tiny</option>
                        <option value="base" selected>Base</option>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                      </select>
                    </div>
                    <div class="option-field">
                      <label>Device</label>
                      <select id="modern-whisperDevice" class="option-select">
                        <option value="auto" selected>Auto</option>
                        <option value="cuda">NVIDIA</option>
                        <option value="mps">Apple</option>
                        <option value="cpu">CPU</option>
                      </select>
                    </div>
                  </div>
                  <label class="checkbox-label" style="margin-top: 10px;">
                    <input type="checkbox" id="modern-enableVideoChunking" checked />
                    <span>Create video chunks based on transcription segments</span>
                  </label>
                  <small style="color: #94a3b8; font-size: 12px; display: block; margin-left: 24px;">
                    Splits videos into smaller files matching transcript segments (requires more storage)
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Results Section -->
        <div class="results-section" id="modernResults" style="display: none;">
          <div class="results-header">
            <h2 class="results-title">
              <span id="modernResultsCount">0</span> videos found
            </h2>
            <div class="results-actions">
              <button class="action-button secondary" id="modernSelectAll">Select All</button>
              <button class="action-button secondary" id="modernDeselectAll">Deselect All</button>
              <button class="action-button primary" id="modernStartCollection" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 3 12 21 5 3"/>
                </svg>
                Start Collection (<span id="modernSelectedCount">0</span>)
              </button>
            </div>
          </div>
          
          <!-- Resume Banner (shown when incomplete collections detected) -->
          <div class="resume-banner" id="resumeBanner" style="display: none;">
            <div class="resume-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              <span class="resume-text">Found incomplete collection: <strong id="incompleteSearchTerm"></strong></span>
              <span class="resume-details">(<span id="remainingCount">0</span> videos remaining)</span>
              <button class="resume-button" id="resumeCollectionBtn">Resume Collection</button>
              <button class="dismiss-button" id="dismissResumeBtn" title="Dismiss">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="results-grid" id="modernResultsList"></div>
        </div>

        <!-- Progress Section -->
        <div class="progress-section" id="modernProgress" style="display: none;">
          <div class="progress-card">
            <h2 class="progress-title">Collection in Progress</h2>
            
            <div class="progress-stats">
              <div class="stat-item">
                <div class="stat-label">Videos</div>
                <div class="stat-value" id="modernVideoProgress">0 / 0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Comments</div>
                <div class="stat-value" id="modernCommentProgress">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Time</div>
                <div class="stat-value" id="modernTimeElapsed">00:00</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Status</div>
                <div class="stat-value" id="modernStatus">Starting...</div>
              </div>
            </div>

            <div class="progress-bar-container">
              <div class="progress-bar">
                <div class="progress-fill" id="modernProgressFill" style="width: 0%"></div>
              </div>
              <div class="progress-percentage" id="modernProgressPercent">0%</div>
            </div>

            <div class="progress-actions">
              <button class="action-button secondary" id="modernPauseBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
                Pause
              </button>
              <button class="action-button danger" id="modernCancelBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                Cancel
              </button>
            </div>

            <div class="progress-log" id="modernLog"></div>
          </div>
        </div>
      </div>
    `;

    this.addModernStyles();
  }

  addModernStyles() {
    const styles = `
      <style id="modern-ui-styles">
        /* Modern Container - Dark Theme */
        .modern-container {
          background: #0a0a0a;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #e0e0e0;
        }

        /* Header */
        .modern-header {
          background: #1a1a1a;
          border-bottom: 1px solid #2a2a2a;
          padding: 24px 32px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .header-left {
          flex: 1;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 28px;
          font-weight: 600;
          color: #ffffff;
          margin: 0;
        }

        .header-subtitle {
          color: #999;
          margin-top: 4px;
          margin-left: 44px;
        }

        .tools-status {
          margin-left: auto;
          display: flex;
          gap: 16px;
          font-size: 13px;
          align-items: center;
        }

        .tool-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tool-indicator.available { color: #4ade80; }
        .tool-indicator.unavailable { color: #f87171; }

        /* Search Card */
        .search-card {
          max-width: 1200px;
          margin: 32px auto;
          padding: 0 32px;
        }

        .search-input-group {
          display: flex;
          gap: 0;
          margin-bottom: 16px;
        }

        .search-input {
          flex: 1;
          padding: 16px 20px;
          font-size: 18px;
          background: #1a1a1a;
          border: 2px solid #2a2a2a;
          border-radius: 12px 0 0 12px;
          outline: none;
          transition: all 0.2s;
          color: #ffffff;
        }

        .search-input::placeholder {
          color: #666;
        }

        .search-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
          background: #222;
        }

        .search-button {
          padding: 16px 32px;
          background: #3b82f6;
          color: white;
          border: 2px solid #3b82f6;
          border-radius: 0 12px 12px 0;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .search-button:hover {
          background: #2563eb;
          border-color: #2563eb;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .search-button:active {
          transform: scale(0.98);
        }

        /* Quick Settings */
        .quick-settings {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .setting-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .setting-label {
          font-size: 14px;
          color: #999;
          font-weight: 500;
        }

        .setting-input, .setting-select {
          padding: 8px 12px;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #1a1a1a;
          color: #e0e0e0;
        }

        .setting-select option {
          background: #1a1a1a;
          color: #e0e0e0;
        }

        .setting-input {
          width: 80px;
        }

        .setting-input:focus, .setting-select:focus {
          border-color: #3b82f6;
          background: #222;
        }

        .setting-select {
          cursor: pointer;
        }

        .toggle-advanced {
          margin-left: auto;
          padding: 8px 16px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          color: #e0e0e0;
        }

        .toggle-advanced:hover {
          background: #2a2a2a;
          border-color: #3a3a3a;
        }

        /* Advanced Panel */
        .advanced-panel {
          max-width: 1200px;
          margin: 0 auto 32px;
          padding: 0 32px;
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .options-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
        }

        .option-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .option-card:hover {
          border-color: #3a3a3a;
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }

        .option-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #ffffff;
        }

        .option-title svg {
          color: #3b82f6;
        }

        .option-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .option-row {
          display: flex;
          gap: 12px;
        }

        .option-field {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .option-field label {
          font-size: 13px;
          color: #999;
          font-weight: 500;
        }

        .option-input, .option-select {
          padding: 8px 12px;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #0a0a0a;
          color: #e0e0e0;
        }

        .option-input::placeholder {
          color: #666;
        }

        .option-input:focus, .option-select:focus {
          border-color: #3b82f6;
          background: #111;
        }

        /* Switch */
        .switch-label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          padding: 8px 0;
        }

        .switch-input {
          display: none;
        }

        .switch-slider {
          width: 44px;
          height: 24px;
          background: #2a2a2a;
          border-radius: 24px;
          position: relative;
          transition: background 0.2s;
          border: 1px solid #3a3a3a;
        }

        .switch-slider::after {
          content: '';
          width: 18px;
          height: 18px;
          background: #666;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: all 0.2s;
        }

        .switch-input:checked + .switch-slider {
          background: #1e40af;
          border-color: #3b82f6;
        }

        .switch-input:checked + .switch-slider::after {
          transform: translateX(20px);
          background: #3b82f6;
        }

        .switch-text {
          font-size: 14px;
          font-weight: 500;
          color: #e0e0e0;
        }

        .switch-status {
          margin-left: auto;
          font-size: 12px;
          color: #999;
        }

        .sub-options {
          margin-left: 56px;
          padding: 12px;
          background: #0a0a0a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #e0e0e0;
        }

        .checkbox-label input[type="checkbox"] {
          accent-color: #3b82f6;
        }

        /* Results */
        .results-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 32px;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .results-title {
          font-size: 24px;
          font-weight: 600;
          color: #ffffff;
        }

        .results-actions {
          display: flex;
          gap: 12px;
        }

        .action-button {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          border: none;
        }

        .action-button.primary {
          background: #3b82f6;
          color: white;
        }

        .action-button.primary:hover:not(:disabled) {
          background: #2563eb;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .action-button.secondary {
          background: #1a1a1a;
          color: #e0e0e0;
          border: 1px solid #2a2a2a;
        }

        .action-button.secondary:hover {
          background: #2a2a2a;
          border-color: #3a3a3a;
        }

        .action-button.danger {
          background: #dc2626;
          color: white;
        }

        .action-button.danger:hover {
          background: #b91c1c;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .video-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .video-card:hover {
          border-color: #3a3a3a;
          box-shadow: 0 8px 16px rgba(0,0,0,0.4);
          transform: translateY(-4px);
        }

        .video-card.selected {
          box-shadow: 0 0 0 3px #3b82f6;
          border-color: #3b82f6;
        }
        
        .video-card.filtered {
          opacity: 0.3;
          filter: grayscale(100%);
          pointer-events: none;
        }
        
        .video-card.filtered .video-stats {
          color: #666;
        }

        .video-checkbox {
          position: absolute;
          top: 12px;
          left: 12px;
          width: 24px;
          height: 24px;
          background: rgba(10, 10, 10, 0.8);
          border: 2px solid #666;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1;
          backdrop-filter: blur(8px);
        }

        .video-card.selected .video-checkbox {
          background: #3b82f6;
          border-color: #3b82f6;
        }

        .video-card.selected .video-checkbox::after {
          content: '✓';
          color: white;
          font-size: 16px;
        }

        .video-thumbnail {
          width: 100%;
          aspect-ratio: 16/9;
          object-fit: cover;
          background: #0a0a0a;
        }

        .video-info {
          padding: 12px;
        }

        .video-title {
          font-size: 14px;
          font-weight: 500;
          color: #ffffff;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .video-channel {
          font-size: 13px;
          color: #999;
          margin-bottom: 8px;
        }

        .video-channel:hover {
          color: #3b82f6;
        }

        .video-stats {
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: #666;
        }

        .video-stats span {
          display: flex;
          align-items: center;
        }

        /* Progress */
        .progress-section {
          max-width: 800px;
          margin: 32px auto;
          padding: 0 32px;
        }

        .progress-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .progress-title {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 24px 0;
          text-align: center;
          color: #ffffff;
        }

        .progress-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #ffffff;
        }

        .progress-bar-container {
          position: relative;
          margin-bottom: 32px;
        }

        .progress-bar {
          height: 8px;
          background: #2a2a2a;
          border-radius: 8px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          transition: width 0.3s ease;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }

        .progress-percentage {
          position: absolute;
          top: -24px;
          right: 0;
          font-size: 14px;
          font-weight: 500;
          color: #999;
        }

        .progress-actions {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .progress-log {
          max-height: 200px;
          overflow-y: auto;
          background: #0a0a0a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 12px;
          font-size: 13px;
          font-family: 'Consolas', 'Monaco', monospace;
        }

        .progress-log::-webkit-scrollbar {
          width: 8px;
        }

        .progress-log::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-radius: 4px;
        }

        .progress-log::-webkit-scrollbar-thumb {
          background: #3a3a3a;
          border-radius: 4px;
        }

        .progress-log::-webkit-scrollbar-thumb:hover {
          background: #4a4a4a;
        }

        .log-entry {
          padding: 4px 0;
          color: #999;
        }

        .log-entry.success { color: #4ade80; }
        .log-entry.error { color: #f87171; }
        .log-entry.warning { color: #fbbf24; }
        
        /* Resume Banner */
        .resume-banner {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          border: 1px solid #475569;
          border-radius: 12px;
          padding: 16px 20px;
          margin: 16px 0;
        }
        
        .resume-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .resume-content svg {
          color: #fbbf24;
          flex-shrink: 0;
        }
        
        .resume-text {
          flex: 1;
          color: #f1f5f9;
          font-size: 14px;
        }
        
        .resume-text strong {
          color: #fbbf24;
        }
        
        .resume-details {
          color: #94a3b8;
          font-size: 13px;
        }
        
        .resume-button {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 20px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .resume-button:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        
        .dismiss-button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #94a3b8;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        
        .dismiss-button:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #f1f5f9;
          border-color: rgba(255, 255, 255, 0.3);
        }

        /* Tool install button */
        .btn-warning {
          background: #f59e0b;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .btn-warning:hover {
          background: #d97706;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .modern-header { padding: 16px; }
          .search-card { padding: 0 16px; }
          .results-section { padding: 0 16px; }
          .progress-section { padding: 0 16px; }
          
          .header-title { font-size: 20px; }
          .header-content {
            flex-direction: column;
            align-items: flex-start;
          }
          .tools-status { 
            margin-top: 12px;
            margin-left: 0;
            flex-wrap: wrap;
          }
          
          .quick-settings {
            flex-wrap: wrap;
          }
          
          .options-grid {
            grid-template-columns: 1fr;
          }
          
          .results-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }
          
          .results-grid {
            grid-template-columns: 1fr;
          }
          
          .progress-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      </style>
    `;

    if (!document.getElementById('modern-ui-styles')) {
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  bindEvents() {
    // Search
    document.getElementById('modern-searchBtn')?.addEventListener('click', () => this.searchYouTube());
    document.getElementById('modern-searchTerm')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchYouTube();
    });

    // Advanced toggle
    document.getElementById('toggleAdvanced')?.addEventListener('click', () => {
      const panel = document.getElementById('advancedPanel');
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
    });

    // Sub-option toggles
    document.getElementById('modern-includeComments')?.addEventListener('change', (e) => {
      document.getElementById('modernCommentOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('modern-downloadVideo')?.addEventListener('change', (e) => {
      document.getElementById('modernDownloadOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('modern-enableTranscription')?.addEventListener('change', (e) => {
      document.getElementById('modernTranscriptionOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    // Results actions
    document.getElementById('modernSelectAll')?.addEventListener('click', () => this.selectAllVideos());
    document.getElementById('modernDeselectAll')?.addEventListener('click', () => this.deselectAllVideos());
    document.getElementById('modernStartCollection')?.addEventListener('click', () => this.startCollection());
    document.getElementById('resumeCollectionBtn')?.addEventListener('click', () => this.resumeCollection());
    document.getElementById('dismissResumeBtn')?.addEventListener('click', () => this.dismissResumeBanner());

    // Progress actions
    document.getElementById('modernPauseBtn')?.addEventListener('click', () => this.pauseCollection());
    document.getElementById('modernCancelBtn')?.addEventListener('click', () => this.cancelCollection());
    
    // Live filtering for minimum comments
    document.getElementById('modern-minComments')?.addEventListener('input', (e) => this.applyCommentFilter(e.target.value));
  }

  async checkTools() {
    try {
      const tools = await window.api.tools.check();
      const statusBar = document.getElementById('toolsStatusBar');
      
      if (statusBar) {
        statusBar.innerHTML = `
          <div class="tool-indicator ${tools.ytDlp?.available ? 'available' : 'unavailable'}">
            ${tools.ytDlp?.available ? '✓' : '✗'} yt-dlp
          </div>
          <div class="tool-indicator ${tools.ffmpeg?.available ? 'available' : 'unavailable'}">
            ${tools.ffmpeg?.available ? '✓' : '✗'} FFmpeg
          </div>
          <div class="tool-indicator ${tools.whisper?.available ? 'available' : 'unavailable'}">
            ${tools.whisper?.available ? '✓' : '✗'} Whisper
          </div>
        `;
      }

      // Update transcription status
      const transcriptionStatus = document.getElementById('modernTranscriptionStatus');
      if (transcriptionStatus) {
        transcriptionStatus.textContent = tools.whisper?.available ? '✓ Available' : '✗ Not installed';
        transcriptionStatus.style.color = tools.whisper?.available ? '#10b981' : '#ef4444';
      }
    } catch (error) {
      console.error('Error checking tools:', error);
    }
  }

  async searchYouTube() {
    const searchTerm = document.getElementById('modern-searchTerm').value.trim();
    if (!searchTerm) return;

    const apiKeyResult = await window.api.settings.getApiKey('youtube');
    if (!apiKeyResult?.success || !apiKeyResult.apiKey) {
      if (typeof showSettings === 'function') showSettings();
      return;
    }

    const searchBtn = document.getElementById('modern-searchBtn');
    searchBtn.disabled = true;
    searchBtn.textContent = 'Searching...';

    try {
      const settings = this.collectSettings();
      const options = {
        apiKey: apiKeyResult.apiKey,
        maxResults: settings.maxResults,
        dateRange: settings.dateRange,
        orderBy: settings.orderBy,
        advanced: settings.advanced
      };

      const result = await window.api.youtube.search({ searchTerm, options });
      
      if (result.success) {
        this.displayResults(result.data);
      } else {
        this.showNotification(`Search failed: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showNotification(`Search error: ${error.message}`, 'error');
    } finally {
      searchBtn.disabled = false;
      searchBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        Search
      `;
    }
  }

  displayResults(videos) {
    const resultsSection = document.getElementById('modernResults');
    const resultsList = document.getElementById('modernResultsList');
    const resultsCount = document.getElementById('modernResultsCount');
    
    resultsSection.style.display = 'block';
    resultsCount.textContent = videos.length;
    
    this.selectedVideos.clear();
    this.currentVideos = videos;  // Store videos for filtering
    
    resultsList.innerHTML = videos.map(video => this.renderVideoCard(video)).join('');
    
    // Bind video card events
    resultsList.querySelectorAll('.video-card').forEach((card, index) => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.video-checkbox')) {
          this.toggleVideoSelection(videos[index]);
        }
      });
      
      card.querySelector('.video-checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleVideoSelection(videos[index]);
      });
    });
    
    this.updateSelectedCount();
    
    // Apply any existing comment filter
    const minComments = document.getElementById('modern-minComments')?.value;
    if (minComments && parseInt(minComments) > 0) {
      this.applyCommentFilter(minComments);
    }
  }

  renderVideoCard(video) {
    const thumbnail = video.thumbnails?.medium?.url || video.thumbnails?.default?.url || '';
    const duration = video.duration ? this.formatDuration(video.duration) : '';
    
    return `
      <div class="video-card" data-video-id="${video.id}" data-comment-count="${video.commentCount || 0}">
        <div class="video-checkbox"></div>
        <img class="video-thumbnail" src="${thumbnail}" alt="${this.escapeHtml(video.title)}" />
        <div class="video-info">
          <div class="video-title">${this.escapeHtml(video.title)}</div>
          <div class="video-channel">${this.escapeHtml(video.channelTitle)}</div>
          <div class="video-stats">
            <span>${this.formatNumber(video.viewCount)} views</span>
            <span>•</span>
            <span>${this.formatNumber(video.commentCount)} comments</span>
            ${duration ? `<span>•</span><span>${duration}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  toggleVideoSelection(video) {
    const card = document.querySelector(`.video-card[data-video-id="${video.id}"]`);
    
    if (this.selectedVideos.has(video.id)) {
      this.selectedVideos.delete(video.id);
      card.classList.remove('selected');
    } else {
      this.selectedVideos.set(video.id, video);
      card.classList.add('selected');
    }
    
    this.updateSelectedCount();
  }

  selectAllVideos() {
    document.querySelectorAll('.video-card:not(.filtered)').forEach((card, index) => {
      const videoId = card.dataset.videoId;
      if (!this.selectedVideos.has(videoId)) {
        card.click();
      }
    });
  }

  deselectAllVideos() {
    document.querySelectorAll('.video-card.selected').forEach(card => {
      card.click();
    });
  }

  updateSelectedCount() {
    const count = this.selectedVideos.size;
    document.getElementById('modernSelectedCount').textContent = count;
    document.getElementById('modernStartCollection').disabled = count === 0;
  }
  
  applyCommentFilter(minComments) {
    const min = parseInt(minComments) || 0;
    const cards = document.querySelectorAll('.video-card');
    let filteredCount = 0;
    
    cards.forEach(card => {
      const commentCount = parseInt(card.dataset.commentCount) || 0;
      
      if (commentCount < min) {
        card.classList.add('filtered');
        // Remove from selection if filtered
        const videoId = card.dataset.videoId;
        if (this.selectedVideos.has(videoId)) {
          this.selectedVideos.delete(videoId);
          card.classList.remove('selected');
        }
        filteredCount++;
      } else {
        card.classList.remove('filtered');
      }
    });
    
    // Update counts
    this.updateSelectedCount();
    
    // Update visible count
    const totalCount = cards.length;
    const visibleCount = totalCount - filteredCount;
    document.getElementById('modernResultsCount').textContent = 
      min > 0 ? `${visibleCount} of ${totalCount}` : totalCount;
  }

  collectSettings() {
    return {
      searchTerm: document.getElementById('modern-searchTerm').value,
      maxResults: parseInt(document.getElementById('modern-maxResults').value),
      dateRange: document.getElementById('modern-dateRange').value,
      orderBy: document.getElementById('modern-orderBy').value,
      
      advanced: {
        videoDuration: document.getElementById('modern-videoDuration').value,
        videoDefinition: document.getElementById('modern-videoDefinition').value,
        minViews: document.getElementById('modern-minViews').value ? parseInt(document.getElementById('modern-minViews').value) : null,
        maxViews: document.getElementById('modern-maxViews').value ? parseInt(document.getElementById('modern-maxViews').value) : null,
        videoLanguage: document.getElementById('modern-videoLanguage').value,
      },
      
      extraction: {
        includeComments: document.getElementById('modern-includeComments').checked,
        maxComments: parseInt(document.getElementById('modern-maxComments').value),
        commentSort: document.getElementById('modern-commentSort').value,
        includeReplies: document.getElementById('modern-includeReplies').checked,
        
        downloadVideo: document.getElementById('modern-downloadVideo').checked,
        videoQuality: document.getElementById('modern-videoQuality').value,
        videoFormat: 'mp4',
        maxFileSize: parseInt(document.getElementById('modern-maxFileSize').value),
        
        enableTranscription: document.getElementById('modern-enableTranscription').checked,
        whisperModel: document.getElementById('modern-whisperModel').value,
        whisperDevice: document.getElementById('modern-whisperDevice').value,
        enableVideoChunking: document.getElementById('modern-enableVideoChunking')?.checked || false,
        
        // Add all the fields expected by the main collection handler
        extractTitle: true,
        extractDescription: true,
        extractTags: true,
        extractThumbnails: true,
        extractStatistics: true,
        extractPublishDate: true,
        extractChannelTitle: true,
        extractChannelId: true,
        commentAuthorChannelId: true,
        commentTimestamps: true,
        downloadThumbnail: true,
        skipDuplicates: true,
        continueOnError: true,
        textProcessing: 'clean'
      }
    };
  }

  async startCollection() {
    if (this.selectedVideos.size === 0) return;

    const apiKeyResult = await window.api.settings.getApiKey('youtube');
    if (!apiKeyResult?.success || !apiKeyResult.apiKey) {
      this.showNotification('API key not found', 'error');
      return;
    }

    const settings = this.collectSettings();
    const options = {
      apiKey: apiKeyResult.apiKey,
      ...settings
    };

    const jobId = `job_${Date.now()}`;
    const videos = Array.from(this.selectedVideos.values());

    // Show progress
    document.getElementById('modernResults').style.display = 'none';
    document.getElementById('modernProgress').style.display = 'block';
    
    this.collectionJob = { jobId, startTime: Date.now(), total: videos.length, completed: 0 };
    this.updateTimer();

    try {
      const result = await window.api.youtube.collect({ jobId, videos, options });
      
      if (result.success) {
        this.showNotification('Collection completed successfully!', 'success');
        this.addLogEntry(`✓ Collection complete: ${result.data.length} videos collected`, 'success');
        document.getElementById('modernStatus').textContent = 'Complete!';
      } else {
        this.showNotification(`Collection failed: ${result.error}`, 'error');
        document.getElementById('modernStatus').textContent = 'Failed';
      }
    } catch (error) {
      this.showNotification(`Collection error: ${error.message}`, 'error');
      document.getElementById('modernStatus').textContent = 'Error';
    } finally {
      this.collectionJob = null;
    }
  }

  updateTimer() {
    if (!this.collectionJob) return;

    const elapsed = Date.now() - this.collectionJob.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    document.getElementById('modernTimeElapsed').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    requestAnimationFrame(() => this.updateTimer());
  }

  addLogEntry(message, type = 'info') {
    const log = document.getElementById('modernLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  pauseCollection() {
    this.showNotification('Pause not implemented yet', 'warning');
  }

  async cancelCollection() {
    if (!this.collectionJob || !confirm('Cancel the current collection?')) return;

    await window.api.youtube.cancel(this.collectionJob.jobId);
    this.collectionJob = null;
    
    document.getElementById('modernProgress').style.display = 'none';
    document.getElementById('modernResults').style.display = 'block';
    
    this.showNotification('Collection cancelled', 'warning');
  }

  loadSettings() {
    // Apply any saved settings or defaults
  }

  // Utilities
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  formatDuration(seconds) {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Could add toast notifications here
  }
  
  async checkForIncompleteCollections() {
    try {
      const result = await window.api.collections?.checkIncomplete?.();
      if (!result || !result.success) return;
      
      const incomplete = result.incomplete;
      if (incomplete && incomplete.length > 0) {
        // Show the most recent incomplete collection
        const latest = incomplete[0];
        
        // Check if this collection was already dismissed
        const dismissedKey = `dismissed_${latest.folder}`;
        if (sessionStorage.getItem(dismissedKey) === 'true') {
          return; // Don't show if already dismissed
        }
        
        this.incompleteCollection = latest;
        
        // Update resume banner
        document.getElementById('incompleteSearchTerm').textContent = latest.manifest.searchTerm || 'Unknown';
        document.getElementById('remainingCount').textContent = latest.remainingVideos;
        document.getElementById('resumeBanner').style.display = 'block';
      }
    } catch (error) {
      console.error('Error checking for incomplete collections:', error);
    }
  }
  
  async resumeCollection() {
    if (!this.incompleteCollection) return;
    
    try {
      this.showNotification('Resuming collection...', 'info');
      
      // Hide resume banner
      document.getElementById('resumeBanner').style.display = 'none';
      
      const manifestPath = this.incompleteCollection.manifestPath || 
        `${this.incompleteCollection.folderPath}/collection_manifest.json`;
      
      // Call the resume handler directly with the manifest path
      const result = await window.api.collections.resume({ manifestPath });
      
      if (result.success) {
        this.showNotification('Collection resumed successfully!', 'success');
        
        // Show results or redirect to collections
        document.getElementById('modernProgress').style.display = 'none';
        document.getElementById('modernResults').style.display = 'block';
        
        // Could also trigger a refresh of collections view
        if (window.showView) {
          window.showView('collections');
        }
      } else {
        this.showNotification(`Resume failed: ${result.error}`, 'error');
        document.getElementById('resumeBanner').style.display = 'block';
      }
    } catch (error) {
      this.showNotification(`Resume error: ${error.message}`, 'error');
      document.getElementById('resumeBanner').style.display = 'block';
    }
  }
  
  dismissResumeBanner() {
    // Hide the resume banner
    document.getElementById('resumeBanner').style.display = 'none';
    
    // Save dismissed state in session storage to prevent re-showing until next app restart
    if (this.incompleteCollection) {
      const dismissedKey = `dismissed_${this.incompleteCollection.folder}`;
      sessionStorage.setItem(dismissedKey, 'true');
    }
    
    // Clear the incomplete collection reference
    this.incompleteCollection = null;
    
    this.showNotification('Resume notification dismissed. You can resume from the Collections view.', 'info');
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Listen for collection progress updates
  window.api.on('collection:video-complete', ({ jobId, video }) => {
    if (window.modernUI?.collectionJob?.jobId !== jobId) return;
    
    window.modernUI.collectionJob.completed++;
    const progress = window.modernUI.collectionJob.completed / window.modernUI.collectionJob.total;
    
    document.getElementById('modernProgressFill').style.width = `${progress * 100}%`;
    document.getElementById('modernProgressPercent').textContent = `${Math.round(progress * 100)}%`;
    document.getElementById('modernVideoProgress').textContent = 
      `${window.modernUI.collectionJob.completed} / ${window.modernUI.collectionJob.total}`;
    document.getElementById('modernStatus').textContent = 
      `Collecting: ${video.title.substring(0, 50)}${video.title.length > 50 ? '...' : ''}`;
    
    window.modernUI.addLogEntry(`✓ Collected: ${video.title}`, 'success');
    
    if (video.comments) {
      const currentCount = parseInt(document.getElementById('modernCommentProgress').textContent);
      document.getElementById('modernCommentProgress').textContent = currentCount + video.comments.length;
    }
  });
  
  // Listen for download events
  window.api.on('collection:download-start', ({ jobId, videoId, title }) => {
    if (window.modernUI?.collectionJob?.jobId !== jobId) return;
    window.modernUI.addLogEntry(`📥 Starting download: ${title}`, 'info');
  });
  
  window.api.on('collection:download-progress', ({ jobId, videoId, progress }) => {
    if (window.modernUI?.collectionJob?.jobId !== jobId) return;
    
    // Update the current status with download progress
    const statusText = `Downloading: ${progress.percent.toFixed(1)}% | ${progress.speed} | ETA: ${progress.eta} | Size: ${progress.size}`;
    document.getElementById('modernStatus').textContent = statusText;
    
    // You could also update a specific download progress bar here if needed
  });
  
  window.api.on('collection:download-complete', ({ jobId, videoId, path }) => {
    if (window.modernUI?.collectionJob?.jobId !== jobId) return;
    window.modernUI.addLogEntry(`✅ Download complete: ${path.split('/').pop()}`, 'success');
  });
  
  window.api.on('collection:download-error', ({ jobId, videoId, error }) => {
    if (window.modernUI?.collectionJob?.jobId !== jobId) return;
    window.modernUI.addLogEntry(`❌ Download failed: ${error}`, 'error');
  });

  // Initialize modern UI
  window.modernUI = new ModernSinglePageUI();
});