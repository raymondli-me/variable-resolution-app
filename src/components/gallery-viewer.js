// Modern Gallery Viewer for Collections
class GalleryViewer {
  constructor() {
    this.currentCollection = null;
    this.currentVideoIndex = 0;
    this.videos = [];
    this.originalVideos = []; // Store unfiltered videos for merged collections
    this.viewMode = 'gallery'; // 'gallery' or 'list'
    this.createModal();
    this.bindKeyboardShortcuts();
  }

  createModal() {
    const modal = document.createElement('div');
    modal.className = 'gallery-modal';
    modal.innerHTML = `
      <div class="gallery-container">
        <div class="gallery-header">
          <div class="gallery-title">
            <h2 id="galleryTitle">Collection</h2>
            <div class="collection-stats">
              <span id="galleryStats"></span>
            </div>
          </div>
          <div class="gallery-controls">
            <button class="view-toggle" onclick="galleryViewer.toggleView()" title="Toggle View">
              <svg id="viewIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button class="view-toggle" onclick="galleryViewer.showReport()" title="View Report">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </button>
            <button class="view-toggle" onclick="galleryViewer.exportCollection()" title="Export Collection">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button class="close-btn" onclick="galleryViewer.close()">×</button>
          </div>
        </div>

        <!-- Merge Filters (hidden by default, shown for merged collections) -->
        <div id="mergeFilters" class="merge-filters" style="display: none;">
          <div class="filter-group">
            <label>Filter by Source:</label>
            <select id="sourceCollectionFilter" onchange="galleryViewer.applyFilters()">
              <option value="all">All Sources</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Sort by:</label>
            <select id="mergeSortOrder" onchange="galleryViewer.applyFilters()">
              <option value="default">Default Order</option>
              <option value="source">Source Collection</option>
              <option value="views">Most Views</option>
              <option value="comments">Most Comments</option>
              <option value="date-newest">Newest First</option>
              <option value="date-oldest">Oldest First</option>
            </select>
          </div>
          <div class="filter-stats">
            <span id="filterResultCount"></span>
          </div>
        </div>

        <div class="gallery-body">
          <!-- Gallery View -->
          <div id="galleryView" class="gallery-view">
            <div id="videoGrid" class="video-grid"></div>
          </div>
          
          <!-- List View -->
          <div id="listView" class="list-view" style="display: none;">
            <div id="videoList" class="video-list"></div>
          </div>
          
          <!-- Report View -->
          <div id="reportView" class="report-view" style="display: none;">
            <div class="report-container">
              <h3>Collection Report</h3>
              <div id="reportContent" class="report-content">
                <div class="loading">Loading report...</div>
              </div>
              <div class="report-actions">
                <button class="action-btn" onclick="galleryViewer.backToGallery()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  Back to Gallery
                </button>
                <button class="action-btn" onclick="galleryViewer.downloadReport()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Report
                </button>
              </div>
            </div>
          </div>
          
          <!-- Video Detail View -->
          <div id="detailView" class="detail-view" style="display: none;">
            <div class="detail-navigation">
              <button class="nav-btn" onclick="galleryViewer.previousVideo()" title="Previous (←)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <div class="video-counter">
                <span id="currentVideoNum">1</span> / <span id="totalVideoNum">1</span>
              </div>
              <button class="nav-btn" onclick="galleryViewer.nextVideo()" title="Next (→)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
              <button class="back-to-gallery" onclick="galleryViewer.backToGallery()">
                Back to Gallery
              </button>
            </div>
            
            <div class="detail-content">
              <div class="video-column">
                <div class="video-player-container">
                  <video id="detailVideoPlayer" controls style="display: none;"></video>
                  <div id="detailVideoPlaceholder" class="video-placeholder">
                    <img id="detailThumbnail" src="" alt="Video thumbnail" />
                    <button class="play-youtube-btn" onclick="galleryViewer.openInYouTube()">
                      <svg width="68" height="48" viewBox="0 0 68 48" fill="#fff">
                        <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"/>
                        <path d="M 45,24 27,14 27,34" fill="#212121"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div class="video-details">
                  <h3 id="detailVideoTitle"></h3>
                  <div class="video-meta">
                    <span id="detailChannel"></span>
                    <span id="detailStats"></span>
                    <span id="detailDate"></span>
                  </div>
                  
                  <div class="video-description" id="detailDescription"></div>
                  
                  <div class="video-actions">
                    <button class="action-btn" onclick="galleryViewer.openInYouTube()">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      YouTube
                    </button>
                    <button class="action-btn" id="downloadBtn" onclick="galleryViewer.downloadVideo()">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download
                    </button>
                    <button class="action-btn" onclick="galleryViewer.copyLink()">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 13C10 15.21 11.79 17 14 17H18C20.21 17 22 15.21 22 13S20.21 9 18 9H14C11.79 9 10 10.79 10 13Z"/>
                        <path d="M14 11C14 8.79 12.21 7 10 7H6C3.79 7 2 8.79 2 11S3.79 15 6 15H10C12.21 15 14 13.21 14 11Z"/>
                      </svg>
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="comments-column">
                <div class="comments-header">
                  <h4><span id="detailCommentCount">0</span> Comments</h4>
                  <input type="text" id="commentSearch" placeholder="Search comments..." class="comment-search" />
                </div>
                <div id="detailComments" class="comments-container">
                  <div class="loading">Loading comments...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .gallery-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.95);
          z-index: 10000;
          overflow: hidden;
        }

        .gallery-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #0a0a0a;
        }

        .gallery-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 30px;
          background: #1a1a1a;
          border-bottom: 1px solid #2a2a2a;
        }

        .gallery-title h2 {
          margin: 0;
          color: #fff;
          font-size: 24px;
        }

        .collection-stats {
          color: #888;
          font-size: 14px;
          margin-top: 4px;
        }

        .gallery-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .view-toggle {
          background: none;
          border: 1px solid #3a3a3a;
          color: #ccc;
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .view-toggle:hover {
          background: #2a2a2a;
          border-color: #4a4a4a;
        }

        .close-btn {
          background: none;
          border: none;
          color: #ccc;
          font-size: 28px;
          cursor: pointer;
          padding: 0 8px;
        }

        .gallery-body {
          flex: 1;
          overflow: auto;
          padding: 20px;
        }

        /* Gallery View */
        .video-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          padding: 10px;
        }

        .video-card {
          background: #1a1a1a;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s;
          border: 1px solid #2a2a2a;
        }

        .video-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          border-color: #3a3a3a;
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
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .video-meta {
          color: #888;
          font-size: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .comment-count {
          color: #4ade80;
        }

        /* List View */
        .video-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .list-item {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: #1a1a1a;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid #2a2a2a;
        }

        .list-item:hover {
          background: #2a2a2a;
          border-color: #3a3a3a;
        }

        .list-thumbnail {
          width: 160px;
          height: 90px;
          object-fit: cover;
          border-radius: 8px;
        }

        .list-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* Detail View */
        .detail-view {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .detail-navigation {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px 30px;
          background: #1a1a1a;
          border-bottom: 1px solid #2a2a2a;
        }

        .nav-btn {
          background: none;
          border: 1px solid #3a3a3a;
          color: #ccc;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-btn:hover:not(:disabled) {
          background: #2a2a2a;
          border-color: #4a4a4a;
        }

        .nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .video-counter {
          color: #888;
          font-size: 14px;
        }

        .back-to-gallery {
          margin-left: auto;
          padding: 8px 16px;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          color: #ccc;
          border-radius: 8px;
          cursor: pointer;
        }

        .detail-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .video-column {
          flex: 1;
          padding: 30px;
          overflow-y: auto;
        }

        .video-player-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto 30px;
        }

        .video-player-container video,
        .video-placeholder {
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
        }

        .video-placeholder {
          position: relative;
          cursor: pointer;
        }

        .video-placeholder img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .play-youtube-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          border: none;
          border-radius: 12px;
          padding: 16px 24px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .play-youtube-btn:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: translate(-50%, -50%) scale(1.1);
        }

        .video-details {
          max-width: 800px;
          margin: 0 auto;
        }

        .video-details h3 {
          color: #fff;
          font-size: 20px;
          margin-bottom: 12px;
        }

        .video-meta {
          display: flex;
          gap: 16px;
          color: #888;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .video-description {
          color: #ccc;
          line-height: 1.6;
          margin-bottom: 20px;
          white-space: pre-wrap;
        }

        .video-actions {
          display: flex;
          gap: 12px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          color: #ccc;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #3a3a3a;
          border-color: #4a4a4a;
        }

        .comments-column {
          width: 400px;
          border-left: 1px solid #2a2a2a;
          display: flex;
          flex-direction: column;
          background: #0a0a0a;
        }

        .comments-header {
          padding: 20px;
          border-bottom: 1px solid #2a2a2a;
        }

        .comments-header h4 {
          margin: 0 0 12px 0;
          color: #fff;
        }

        .comment-search {
          width: 100%;
          padding: 8px 12px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          color: #fff;
          border-radius: 8px;
        }

        .comments-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        /* YouTube-like Comments */
        .comments-section {
          color: #fff;
        }
        
        .comment-thread {
          margin-bottom: 16px;
        }
        
        .comment-item {
          display: flex;
          gap: 12px;
          padding: 8px 0;
        }
        
        .comment-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: 18px;
          flex-shrink: 0;
        }
        
        .comment-content {
          flex: 1;
          min-width: 0;
        }
        
        .comment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .comment-author {
          font-weight: 600;
          font-size: 13px;
          color: #f1f1f1;
        }
        
        .comment-date {
          font-size: 12px;
          color: #aaa;
        }

        .comment-text {
          color: #f1f1f1;
          line-height: 1.4;
          margin-bottom: 8px;
          font-size: 14px;
          word-wrap: break-word;
        }
        
        .comment-text a {
          color: #3ea6ff;
          text-decoration: none;
        }
        
        .comment-text a:hover {
          text-decoration: underline;
        }
        
        .comment-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 8px;
        }
        
        .comment-likes {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #aaa;
          font-size: 12px;
        }
        
        .comment-likes svg {
          width: 14px;
          height: 14px;
        }
        
        .toggle-replies {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: #3ea6ff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          padding: 4px 8px;
          margin: -4px -8px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        
        .toggle-replies:hover {
          background: rgba(62, 166, 255, 0.1);
        }
        
        .toggle-replies svg {
          width: 16px;
          height: 16px;
          transition: transform 0.2s;
        }
        
        .replies-container {
          margin-left: 52px;
          margin-top: 8px;
          display: none;
        }
        
        .replies-container.expanded {
          display: block;
        }
        
        .replies-container .comment-avatar {
          width: 32px;
          height: 32px;
          font-size: 14px;
        }
        
        .replies-container .comment-item {
          padding: 6px 0;
        }
        
        .no-comments {
          text-align: center;
          color: #666;
          padding: 40px;
          font-size: 14px;
        }
        
        .error-message {
          text-align: center;
          color: #f87171;
          padding: 40px;
          font-size: 14px;
        }

        .loading {
          text-align: center;
          color: #666;
          padding: 40px;
        }

        /* Report View */
        .report-view {
          padding: 30px;
          height: 100%;
          overflow-y: auto;
        }

        .report-container {
          max-width: 1000px;
          margin: 0 auto;
        }

        .report-container h3 {
          color: #fff;
          font-size: 24px;
          margin-bottom: 20px;
        }

        .report-content {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 20px;
          color: #ccc;
          font-family: 'Courier New', monospace;
          white-space: pre-wrap;
          line-height: 1.6;
          max-height: 600px;
          overflow-y: auto;
        }

        .report-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .detail-content {
            flex-direction: column;
          }
          
          .comments-column {
            width: 100%;
            border-left: none;
            border-top: 1px solid #2a2a2a;
            max-height: 400px;
          }
        }

        @media (max-width: 768px) {
          .video-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
          }
          
          .gallery-header {
            padding: 16px;
          }
          
          .gallery-body {
            padding: 12px;
          }
        }

        /* Scrollbar styling */
        .gallery-body::-webkit-scrollbar,
        .comments-container::-webkit-scrollbar {
          width: 8px;
        }

        .gallery-body::-webkit-scrollbar-track,
        .comments-container::-webkit-scrollbar-track {
          background: #1a1a1a;
        }

        .gallery-body::-webkit-scrollbar-thumb,
        .comments-container::-webkit-scrollbar-thumb {
          background: #3a3a3a;
          border-radius: 4px;
        }

        /* Merge Filters */
        .merge-filters {
          padding: 15px 30px;
          background: #1a1a1a;
          border-bottom: 1px solid #2a2a2a;
          display: none;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .filter-group label {
          color: #ccc;
          font-size: 14px;
          white-space: nowrap;
        }

        .filter-group select {
          background: #0a0a0a;
          border: 1px solid #3a3a3a;
          color: #fff;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          min-width: 180px;
        }

        .filter-group select:hover {
          border-color: #4a4a4a;
        }

        .filter-group select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .filter-stats {
          margin-left: auto;
          color: #888;
          font-size: 13px;
        }

        /* Video Source Badge */
        .video-source-badge {
          display: inline-block;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          color: #3b82f6;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          margin-top: 4px;
        }
      </style>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
  }

  async show(collectionId) {
    try {
      // Get collection details
      const collResult = await window.api.db.getCollection(collectionId);
      if (!collResult.success) {
        console.error('Failed to load collection');
        return;
      }

      this.currentCollection = collResult.data;
      this.currentCollection.isMerge = false;

      // Get videos
      const videoResult = await window.api.db.getVideos(collectionId);
      if (!videoResult.success) {
        console.error('Failed to load videos');
        return;
      }

      this.videos = videoResult.data;
      this.originalVideos = [];
      this.currentVideoIndex = 0;

      console.log('Loaded videos:', this.videos.length, this.videos);

      // Update header
      document.getElementById('galleryTitle').textContent = this.currentCollection.search_term || 'Collection';
      document.getElementById('galleryStats').textContent =
        `${this.videos.length} videos • ${this.currentCollection.comment_count || 0} comments`;

      // Hide merge filters for regular collections
      const mergeFilters = document.getElementById('mergeFilters');
      if (mergeFilters) {
        mergeFilters.style.display = 'none';
      }

      // Show gallery
      this.modal.style.display = 'block';
      this.showGalleryView();
    } catch (error) {
      console.error('Error showing collection:', error);
    }
  }

  async showMerge(mergeId) {
    try {
      // Get merge details
      const merge = await window.api.database.getMerge(mergeId);
      if (!merge) {
        console.error('Failed to load merge');
        return;
      }

      // Check if this merge has PDF sources
      let hasPDFSources = false;
      if (merge.source_collections) {
        hasPDFSources = merge.source_collections.some(sc => {
          const isPDFSource = sc.settings && typeof sc.settings === 'string'
            ? JSON.parse(sc.settings).type === 'pdf'
            : sc.settings?.type === 'pdf';
          return isPDFSource;
        });
      }

      // Get videos from all source collections
      const videos = await window.api.database.getMergeVideos(mergeId);

      // If this merge has PDF sources and no videos, show PDF merge viewer instead
      if (hasPDFSources && videos.length === 0) {
        this.showMergePDFView(merge, mergeId);
        return;
      }

      // Calculate total comment count
      let totalComments = 0;
      if (merge.source_collections) {
        merge.source_collections.forEach(sc => {
          totalComments += sc.comment_count || 0;
        });
      }

      // Create a collection-like object
      this.currentCollection = {
        id: merge.id,
        search_term: merge.name,
        created_at: merge.created_at,
        video_count: videos.length,
        comment_count: totalComments,
        isMerge: true,
        mergeData: merge
      };

      this.videos = videos;
      this.originalVideos = [...videos]; // Store original unfiltered videos
      this.currentVideoIndex = 0;

      console.log('Loaded merge videos:', this.videos.length, this.videos);

      // Update header with merge badge
      const mergeBadge = `<span style="background: linear-gradient(135deg, var(--accent) 0%, #2563eb 100%); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem;">MERGED</span>`;
      document.getElementById('galleryTitle').innerHTML = `${this.currentCollection.search_term}${mergeBadge}`;
      document.getElementById('galleryStats').textContent =
        `${this.videos.length} videos from ${merge.source_collections.length} collections`;

      // Populate source collection filter
      const sourceFilter = document.getElementById('sourceCollectionFilter');
      if (sourceFilter) {
        sourceFilter.innerHTML = '<option value="all">All Sources</option>';
        if (merge.source_collections) {
          merge.source_collections.forEach(sc => {
            const option = document.createElement('option');
            option.value = sc.id;
            option.textContent = sc.search_term;
            sourceFilter.appendChild(option);
          });
        }
      }

      // Reset sort order
      const sortSelect = document.getElementById('mergeSortOrder');
      if (sortSelect) {
        sortSelect.value = 'default';
      }

      // Show merge filters
      const mergeFilters = document.getElementById('mergeFilters');
      if (mergeFilters) {
        mergeFilters.style.display = 'flex';
      }

      // Update filter stats
      this.updateFilterStats();

      // Show gallery
      this.modal.style.display = 'block';
      this.showGalleryView();

    } catch (error) {
      console.error('Error showing collection:', error);
    }
  }

  showGalleryView() {
    document.getElementById('galleryView').style.display = 'block';
    document.getElementById('listView').style.display = 'none';
    document.getElementById('detailView').style.display = 'none';

    if (this.viewMode === 'gallery') {
      this.renderGallery();
    } else {
      this.renderList();
    }
  }

  applyFilters() {
    if (!this.currentCollection?.isMerge) return;

    const sourceFilter = document.getElementById('sourceCollectionFilter');
    const sortOrder = document.getElementById('mergeSortOrder');

    if (!sourceFilter || !sortOrder) return;

    // Start with original videos
    let filtered = [...this.originalVideos];

    // Apply source collection filter
    const selectedSource = sourceFilter.value;
    if (selectedSource !== 'all') {
      filtered = filtered.filter(video =>
        video.source_collection_id === parseInt(selectedSource)
      );
    }

    // Apply sorting
    const selectedSort = sortOrder.value;
    switch (selectedSort) {
      case 'source':
        filtered.sort((a, b) => {
          const nameA = (a.source_collection_name || '').toLowerCase();
          const nameB = (b.source_collection_name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
      case 'views':
        filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        break;
      case 'comments':
        filtered.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
        break;
      case 'date-newest':
        filtered.sort((a, b) => {
          const dateA = new Date(a.published_at || 0);
          const dateB = new Date(b.published_at || 0);
          return dateB - dateA;
        });
        break;
      case 'date-oldest':
        filtered.sort((a, b) => {
          const dateA = new Date(a.published_at || 0);
          const dateB = new Date(b.published_at || 0);
          return dateA - dateB;
        });
        break;
      case 'default':
      default:
        // Keep default order (newest collected first)
        break;
    }

    // Update videos and re-render
    this.videos = filtered;
    this.updateFilterStats();

    // Re-render the current view
    if (this.viewMode === 'gallery') {
      this.renderGallery();
    } else {
      this.renderList();
    }
  }

  updateFilterStats() {
    const statsEl = document.getElementById('filterResultCount');
    if (!statsEl) return;

    if (this.currentCollection?.isMerge && this.originalVideos.length > 0) {
      const total = this.originalVideos.length;
      const showing = this.videos.length;

      if (showing === total) {
        statsEl.textContent = `Showing all ${total} videos`;
      } else {
        statsEl.textContent = `Showing ${showing} of ${total} videos`;
      }
    } else {
      statsEl.textContent = '';
    }
  }

  renderGallery() {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '';
    
    this.videos.forEach((video, index) => {
      // Parse thumbnails if stored as JSON string
      let thumbnailUrl = '';
      if (video.thumbnails) {
        try {
          const thumbnails = typeof video.thumbnails === 'string' ? JSON.parse(video.thumbnails) : video.thumbnails;
          thumbnailUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '';
          
          // For YouTube videos, thumbnails might be direct URLs or nested objects
          if (!thumbnailUrl && thumbnails.url) {
            thumbnailUrl = thumbnails.url;
          }
          
          // If still no URL, check if it's a direct string URL
          if (!thumbnailUrl && typeof video.thumbnails === 'string' && video.thumbnails.startsWith('http')) {
            thumbnailUrl = video.thumbnails;
          }
          
        } catch (e) {
          console.error('Error parsing thumbnails for video:', video.id, e);
        }
      }
      
      // Always use YouTube's direct thumbnail URL as it's more reliable
      if (video.id) {
        thumbnailUrl = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
      }
      
      const card = document.createElement('div');
      card.className = 'video-card';
      
      // Create img element separately to avoid quote escaping issues
      const img = document.createElement('img');
      img.className = 'video-thumbnail';
      img.src = thumbnailUrl;
      img.alt = video.title || 'Video thumbnail';
      img.onerror = function() {
        this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect fill="#1a1a1a" width="320" height="180"/><text fill="#666" x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif">No Thumbnail</text></svg>';
      };
      
      const infoDiv = document.createElement('div');
      infoDiv.className = 'video-info';

      // Add source collection badge for merged collections
      const sourceBadge = this.currentCollection?.isMerge && video.source_collection_name
        ? `<span class="video-source-badge" title="From: ${video.source_collection_name}">${this.escapeHtml(video.source_collection_name)}</span>`
        : '';

      infoDiv.innerHTML = `
        <div class="video-title">${this.escapeHtml(video.title || 'Untitled')}</div>
        ${sourceBadge}
        <div class="video-meta">
          <span>${this.formatViews(video.view_count)} views</span>
          <span class="comment-count">${video.comment_count || 0} comments</span>
          <span>${this.formatDate(video.published_at)}</span>
        </div>
      `;
      
      card.appendChild(img);
      card.appendChild(infoDiv);
      
      // Add click handler with closure to capture correct index
      card.addEventListener('click', () => {
        console.log('Clicked video at index:', index, video);
        this.showVideo(index);
      });
      
      grid.appendChild(card);
    });
  }

  renderList() {
    const list = document.getElementById('videoList');
    list.innerHTML = '';
    
    this.videos.forEach((video, index) => {
      // Parse thumbnails if stored as JSON string
      let thumbnailUrl = '';
      if (video.thumbnails) {
        try {
          const thumbnails = typeof video.thumbnails === 'string' ? JSON.parse(video.thumbnails) : video.thumbnails;
          thumbnailUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '';
          
          // For YouTube videos, thumbnails might be direct URLs or nested objects
          if (!thumbnailUrl && thumbnails.url) {
            thumbnailUrl = thumbnails.url;
          }
          
          // If still no URL, check if it's a direct string URL
          if (!thumbnailUrl && typeof video.thumbnails === 'string' && video.thumbnails.startsWith('http')) {
            thumbnailUrl = video.thumbnails;
          }
          
        } catch (e) {
          console.error('Error parsing thumbnails for video:', video.id, e);
        }
      }
      
      // Always use YouTube's direct thumbnail URL as it's more reliable
      if (video.id) {
        thumbnailUrl = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
      }
      
      const item = document.createElement('div');
      item.className = 'list-item';
      
      // Create img element separately to avoid quote escaping issues
      const img = document.createElement('img');
      img.className = 'list-thumbnail';
      img.src = thumbnailUrl;
      img.alt = video.title || 'Video thumbnail';
      img.onerror = function() {
        this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect fill="#1a1a1a" width="160" height="90"/><text fill="#666" x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12">No Thumbnail</text></svg>';
      };
      
      const infoDiv = document.createElement('div');
      infoDiv.className = 'list-info';
      infoDiv.innerHTML = `
        <div class="video-title">${this.escapeHtml(video.title || 'Untitled')}</div>
        <div class="video-meta">
          <span>${this.escapeHtml(video.channel_title || 'Unknown Channel')}</span>
          <span>${this.formatViews(video.view_count)} views</span>
          <span class="comment-count">${video.comment_count || 0} comments</span>
          <span>${this.formatDate(video.published_at)}</span>
        </div>
      `;
      
      item.appendChild(img);
      item.appendChild(infoDiv);
      
      // Add click handler with closure to capture correct index
      item.addEventListener('click', () => {
        console.log('Clicked video at index:', index, video);
        this.showVideo(index);
      });
      
      list.appendChild(item);
    });
  }

  async showVideo(index) {
    // Validate index
    if (index < 0 || index >= this.videos.length) {
      console.error('Invalid video index:', index);
      return;
    }
    
    this.currentVideoIndex = index;
    const video = this.videos[index];
    
    // Check if video exists
    if (!video) {
      console.error('Video not found at index:', index);
      return;
    }
    
    // Hide gallery/list view
    document.getElementById('galleryView').style.display = 'none';
    document.getElementById('listView').style.display = 'none';
    document.getElementById('detailView').style.display = 'block';
    
    // Update navigation
    document.getElementById('currentVideoNum').textContent = index + 1;
    document.getElementById('totalVideoNum').textContent = this.videos.length;
    
    // Update video details
    document.getElementById('detailVideoTitle').textContent = video.title || 'Untitled';
    document.getElementById('detailChannel').textContent = video.channel_title || 'Unknown Channel';
    document.getElementById('detailStats').textContent = 
      `${this.formatViews(video.view_count)} views • ${video.like_count || 0} likes`;
    document.getElementById('detailDate').textContent = this.formatDate(video.published_at);
    document.getElementById('detailDescription').textContent = video.description || '';
    
    // Update thumbnail
    let thumbnailUrl = '';
    if (video.thumbnails) {
      try {
        const thumbnails = typeof video.thumbnails === 'string' ? JSON.parse(video.thumbnails) : video.thumbnails;
        thumbnailUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '';
      } catch (e) {
        console.error('Error parsing thumbnails:', e);
      }
    }
    document.getElementById('detailThumbnail').src = thumbnailUrl;
    
    // Check if video is downloaded
    const player = document.getElementById('detailVideoPlayer');
    const placeholder = document.getElementById('detailVideoPlaceholder');
    
    if (video.local_path) {
      // Load local video
      try {
        const videoPath = await window.api.getVideoPath(video.local_path);
        if (videoPath) {
          player.src = `file://${videoPath}`;
          player.style.display = 'block';
          placeholder.style.display = 'none';
        }
      } catch (error) {
        console.error('Error loading video:', error);
      }
    } else {
      player.style.display = 'none';
      placeholder.style.display = 'block';
    }
    
    // Update download button
    document.getElementById('downloadBtn').style.display = video.local_path ? 'none' : 'flex';
    
    // Load comments
    await this.loadComments(video.id);
  }

  async loadComments(videoId) {
    const container = document.getElementById('detailComments');
    container.innerHTML = '<div class="loading">Loading comments...</div>';
    
    try {
      const result = await window.api.db.getComments(videoId);
      
      if (result.success && result.data.length > 0) {
        const allComments = result.data;
        
        // Separate top-level comments and replies
        const topLevelComments = allComments.filter(c => !c.parent_id);
        const replies = allComments.filter(c => c.parent_id);
        
        // Create a map of replies by parent_id for easy lookup
        const repliesMap = new Map();
        replies.forEach(reply => {
          if (!repliesMap.has(reply.parent_id)) {
            repliesMap.set(reply.parent_id, []);
          }
          repliesMap.get(reply.parent_id).push(reply);
        });
        
        // Sort top-level comments by likes (most liked first)
        topLevelComments.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        
        // Update total count and metrics
        const totalLikes = allComments.reduce((sum, c) => sum + (c.like_count || 0), 0);
        const avgLikes = allComments.length > 0 ? Math.round(totalLikes / allComments.length) : 0;
        
        document.getElementById('detailCommentCount').textContent = 
          `${allComments.length} (${topLevelComments.length} comments, ${replies.length} replies)`;
        
        // Build comments HTML with hierarchy
        container.innerHTML = `
          <div class="comments-section">
            ${this.buildCommentsHTML(topLevelComments, repliesMap)}
          </div>
        `;
        
        // Add event listeners for reply toggles
        container.querySelectorAll('.toggle-replies').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const button = e.currentTarget;
            const repliesContainer = button.closest('.comment-thread').querySelector('.replies-container');
            const isExpanded = repliesContainer.classList.contains('expanded');
            const svg = button.querySelector('svg');
            
            if (isExpanded) {
              repliesContainer.classList.remove('expanded');
              button.innerHTML = button.innerHTML.replace('Hide', 'View');
              if (svg) svg.style.transform = 'rotate(0deg)';
            } else {
              repliesContainer.classList.add('expanded');
              button.innerHTML = button.innerHTML.replace('View', 'Hide');
              if (svg) svg.style.transform = 'rotate(180deg)';
            }
          });
        });
      } else {
        container.innerHTML = '<div class="no-comments">No comments yet</div>';
        document.getElementById('detailCommentCount').textContent = '0';
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      container.innerHTML = '<div class="error-message">Error loading comments</div>';
    }
  }
  
  buildCommentsHTML(comments, repliesMap) {
    return comments.map(comment => {
      const replies = repliesMap.get(comment.id) || [];
      const hasReplies = replies.length > 0;
      
      // Sort replies by likes
      replies.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      
      return `
        <div class="comment-thread">
          <div class="comment-item ${hasReplies ? 'has-replies' : ''}">
            <div class="comment-avatar" style="background-color: ${this.getAvatarColor(comment.author_name)}">${this.getAvatarInitial(comment.author_name)}</div>
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">${this.escapeHtml(comment.author_name || 'Unknown')}</span>
                <span class="comment-date">${this.getTimeAgo(comment.published_at)}</span>
              </div>
              <div class="comment-text">${this.linkifyText(this.escapeHtml(comment.text || ''))}</div>
              <div class="comment-actions">
                <span class="comment-likes">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                  </svg>
                  ${this.formatNumber(comment.like_count || 0)}
                </span>
                ${hasReplies ? `
                  <button class="toggle-replies">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                    View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
          ${hasReplies ? `
            <div class="replies-container">
              ${this.buildCommentsHTML(replies, new Map())}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }
  
  getAvatarInitial(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }
  
  getAvatarColor(name) {
    if (!name) return '#3b82f6';
    
    // Generate consistent color based on name
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
      '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
      '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
      '#ec4899', '#f43f5e'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  getTimeAgo(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'week', seconds: 604800 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 }
    ];
    
    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count > 0) {
        return count === 1 ? `1 ${interval.label} ago` : `${count} ${interval.label}s ago`;
      }
    }
    
    return 'Just now';
  }
  
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  }
  
  linkifyText(text) {
    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  toggleView() {
    this.viewMode = this.viewMode === 'gallery' ? 'list' : 'gallery';
    
    // Update icon
    const icon = document.getElementById('viewIcon');
    if (this.viewMode === 'list') {
      icon.innerHTML = `
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      `;
    } else {
      icon.innerHTML = `
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      `;
    }
    
    if (this.viewMode === 'gallery') {
      document.getElementById('galleryView').style.display = 'block';
      document.getElementById('listView').style.display = 'none';
      this.renderGallery();
    } else {
      document.getElementById('galleryView').style.display = 'none';
      document.getElementById('listView').style.display = 'block';
      this.renderList();
    }
  }

  previousVideo() {
    if (this.currentVideoIndex > 0) {
      this.showVideo(this.currentVideoIndex - 1);
    }
  }

  nextVideo() {
    if (this.currentVideoIndex < this.videos.length - 1) {
      this.showVideo(this.currentVideoIndex + 1);
    }
  }

  backToGallery() {
    this.showGalleryView();
  }
  
  async showReport() {
    // Hide other views
    document.getElementById('galleryView').style.display = 'none';
    document.getElementById('listView').style.display = 'none';
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('reportView').style.display = 'block';
    
    const content = document.getElementById('reportContent');
    
    try {
      // Get collection settings
      if (this.currentCollection.settings) {
        const settings = typeof this.currentCollection.settings === 'string' 
          ? JSON.parse(this.currentCollection.settings) 
          : this.currentCollection.settings;
          
        if (settings.collectionReport) {
          // Format the report
          const report = settings.collectionReport;
          let reportText = `COLLECTION REPORT
${'='.repeat(60)}

Search Information:
- Search Term: ${report.searchTerm}
- Collection Started: ${new Date(report.timestamp).toLocaleString()}
- Total Videos Requested: ${report.totalVideosRequested}

Search Settings:
- Max Results: ${report.searchSettings.maxResults}
- Date Range: ${report.searchSettings.dateRange}
- Sort By: ${report.searchSettings.orderBy}

Advanced Filters:
${Object.entries(report.advancedFilters || {}).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- None'}

Comment Settings:
- Extract Comments: ${report.extractionSettings.includeComments ? 'Yes' : 'No'}
- Max Comments/Video: ${report.extractionSettings.maxComments || 'N/A'}
- Sort Order: ${report.extractionSettings.commentSort || 'relevance'}
- Include Replies: ${report.extractionSettings.includeReplies ? 'Yes' : 'No'}
- Min Comment Likes: ${report.extractionSettings.minCommentLikes || 0}

Video Settings:
- Download Videos: ${report.extractionSettings.downloadVideo ? 'Yes' : 'No'}
- Video Quality: ${report.extractionSettings.videoQuality || 'N/A'}
- Video Format: ${report.extractionSettings.videoFormat || 'mp4'}
- Max File Size: ${report.extractionSettings.maxFileSize || 'N/A'} MB
- Audio Only: ${report.extractionSettings.extractAudioOnly ? 'Yes' : 'No'}

Metadata Settings:
- Titles: ${report.extractionSettings.extractTitle !== false ? 'Yes' : 'No'}
- Descriptions: ${report.extractionSettings.extractDescription !== false ? 'Yes' : 'No'}
- Tags: ${report.extractionSettings.extractTags !== false ? 'Yes' : 'No'}
- Captions: ${report.extractionSettings.extractCaptions ? 'Yes' : 'No'}
- Channel Stats: ${report.extractionSettings.extractChannelStats ? 'Yes' : 'No'}

Transcription:
- Enabled: ${report.extractionSettings.enableTranscription ? 'Yes' : 'No'}
- Model: ${report.extractionSettings.whisperModel || 'N/A'}
- Device: ${report.extractionSettings.whisperDevice || 'N/A'}

Collection Results:
- Videos Collected: ${this.videos.length}
- Total Comments: ${this.currentCollection.comment_count || 0}

Videos in Collection:
${'='.repeat(60)}
`;

          this.videos.forEach((video, index) => {
            reportText += `
${index + 1}. ${video.title}
   Channel: ${video.channel_title}
   Views: ${this.formatViews(video.view_count)}
   Comments: ${video.comment_count || 0}
   URL: https://youtube.com/watch?v=${video.id}
`;
          });
          
          content.innerHTML = `<pre>${this.escapeHtml(reportText)}</pre>`;
        } else {
          // Basic report if no detailed settings
          content.innerHTML = `<pre>Collection: ${this.currentCollection.search_term}
Created: ${new Date(this.currentCollection.created_at).toLocaleString()}
Videos: ${this.videos.length}
Comments: ${this.currentCollection.comment_count || 0}</pre>`;
        }
      } else {
        content.innerHTML = '<div class="loading">No report data available</div>';
      }
    } catch (error) {
      console.error('Error loading report:', error);
      content.innerHTML = '<div class="loading">Error loading report</div>';
    }
  }
  
  async downloadReport() {
    // Export collection as JSON
    try {
      const exportData = {
        collection: this.currentCollection,
        videos: this.videos,
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collection_${this.currentCollection.id}_${this.currentCollection.search_term.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  }
  
  async exportCollection() {
    // Call the main export handler
    try {
      const result = await window.api.export.collection({ 
        collectionId: this.currentCollection.id 
      });
      
      if (result.success) {
        alert(`Collection exported to: ${result.filePath}`);
        // Optionally open the file location
        await window.api.system.openFolder(result.filePath);
      } else {
        alert('Export failed: ' + result.error);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export error: ' + error.message);
    }
  }

  openInYouTube() {
    const video = this.videos[this.currentVideoIndex];
    window.open(`https://youtube.com/watch?v=${video.id}`, '_blank');
  }

  async downloadVideo() {
    const video = this.videos[this.currentVideoIndex];
    // Implement download functionality
    console.log('Download video:', video.id);
  }

  copyLink() {
    const video = this.videos[this.currentVideoIndex];
    navigator.clipboard.writeText(`https://youtube.com/watch?v=${video.id}`);
  }

  close() {
    this.modal.style.display = 'none';
    
    // Clean up video player
    const player = document.getElementById('detailVideoPlayer');
    if (player) {
      player.pause();
      player.src = '';
    }
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (this.modal.style.display === 'none') return;
      
      switch(e.key) {
        case 'Escape':
          if (document.getElementById('detailView').style.display === 'block') {
            this.backToGallery();
          } else {
            this.close();
          }
          break;
        case 'ArrowLeft':
          if (document.getElementById('detailView').style.display === 'block') {
            this.previousVideo();
          }
          break;
        case 'ArrowRight':
          if (document.getElementById('detailView').style.display === 'block') {
            this.nextVideo();
          }
          break;
      }
    });
    
    // Comment search
    const searchInput = document.getElementById('commentSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.filterComments(e.target.value));
    }
  }
  
  filterComments(searchTerm) {
    const items = document.querySelectorAll('.comment-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(term) ? 'block' : 'none';
    });
  }

  async showMergePDFView(merge, mergeId) {
    try {
      // Get PDFs from all source collections
      const pdfs = await window.api.database.getMergePDFs(mergeId);

      // Calculate total excerpt count
      let totalExcerpts = 0;
      pdfs.forEach(pdf => {
        totalExcerpts += pdf.excerpts_count || 0;
      });

      // Update header
      const mergeBadge = `<span style="background: linear-gradient(135deg, var(--accent) 0%, #2563eb 100%); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem;">MERGED</span>`;
      document.getElementById('galleryTitle').innerHTML = `${merge.name}${mergeBadge}`;
      document.getElementById('galleryStats').textContent = `${pdfs.length} PDFs, ${totalExcerpts} excerpts from ${merge.source_collections.length} collections`;

      // Populate source collection filter
      const sourceFilter = document.getElementById('sourceCollectionFilter');
      if (sourceFilter) {
        sourceFilter.innerHTML = '<option value="all">All Sources</option>';
        if (merge.source_collections) {
          merge.source_collections.forEach(sc => {
            const option = document.createElement('option');
            option.value = sc.id;
            option.textContent = sc.search_term;
            sourceFilter.appendChild(option);
          });
        }
      }

      // Show merge filters
      const mergeFilters = document.getElementById('mergeFilters');
      if (mergeFilters) {
        mergeFilters.style.display = 'flex';
      }

      // Hide gallery/list view, show custom PDF list
      const galleryView = document.getElementById('galleryView');
      const listView = document.getElementById('listView');
      const reportView = document.getElementById('reportView');

      if (galleryView) galleryView.style.display = 'none';
      if (listView) listView.style.display = 'none';
      if (reportView) reportView.style.display = 'block';

      // Render PDF list in report view
      if (reportView) {
        reportView.innerHTML = `
          <div class="merged-pdf-list" style="padding: 2rem;">
            <div style="margin-bottom: 1.5rem;">
              <h3 style="margin-bottom: 1rem;">PDF Documents</h3>
              <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <select id="pdfSourceFilter" style="padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);">
                  <option value="all">All Sources</option>
                  ${merge.source_collections.map(sc => `<option value="${sc.id}">${this.escapeHtml(sc.search_term)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div id="mergedPDFContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
              ${this.renderMergedPDFs(pdfs)}
            </div>
          </div>
        `;

        // Add filter listener
        const pdfSourceFilter = document.getElementById('pdfSourceFilter');
        if (pdfSourceFilter) {
          pdfSourceFilter.addEventListener('change', () => {
            const selectedSource = pdfSourceFilter.value;
            const filteredPDFs = selectedSource === 'all'
              ? pdfs
              : pdfs.filter(pdf => pdf.source_collection_id == selectedSource);

            const container = document.getElementById('mergedPDFContainer');
            if (container) {
              container.innerHTML = this.renderMergedPDFs(filteredPDFs);
            }
          });
        }
      }

      // Show modal
      this.modal.style.display = 'block';

    } catch (error) {
      console.error('Error showing merged PDF view:', error);
    }
  }

  renderMergedPDFs(pdfs) {
    if (!pdfs || pdfs.length === 0) {
      return '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">No PDFs found</div>';
    }

    return pdfs.map(pdf => `
      <div class="pdf-card" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; cursor: pointer; transition: all 0.2s;"
           onclick="galleryViewer.viewMergedPDFExcerpts(${pdf.id}, '${this.escapeHtml(pdf.title)}', '${this.escapeHtml(pdf.source_collection_name)}')">
        <div style="display: flex; align-items: flex-start; gap: 1rem;">
          <div style="font-size: 2rem;">📄</div>
          <div style="flex: 1; min-width: 0;">
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(pdf.title)}</h4>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">
              <div>${pdf.num_pages || 0} pages</div>
              <div>${pdf.excerpts_count || 0} excerpts</div>
              <div style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: var(--accent-secondary); border-radius: 4px; display: inline-block;">
                ${this.escapeHtml(pdf.source_collection_name)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  async viewMergedPDFExcerpts(pdfId, pdfTitle, sourceName) {
    try {
      const result = await window.api.pdf.getExcerpts(pdfId);
      if (!result.success || !result.excerpts || result.excerpts.length === 0) {
        showNotification('No excerpts found for this PDF', 'warning');
        return;
      }

      // Create modal for excerpts
      const modal = document.createElement('div');
      modal.className = 'pdf-excerpts-modal';
      modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 20000;';
      modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 2rem; position: relative;">
          <button onclick="this.closest('.pdf-excerpts-modal').remove()" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: var(--text-primary); font-size: 2rem; cursor: pointer; line-height: 1;">&times;</button>
          <h2 style="margin: 0 0 0.5rem 0;">${this.escapeHtml(pdfTitle)}</h2>
          <p style="color: var(--text-secondary); margin: 0 0 1.5rem 0;">From: ${this.escapeHtml(sourceName)}</p>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${result.excerpts.map((excerpt, idx) => `
              <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <strong style="color: var(--accent-primary);">Excerpt ${excerpt.excerpt_number || idx + 1}</strong>
                  <span style="color: var(--text-secondary); font-size: 0.875rem;">Page ${excerpt.page_number || '?'}</span>
                </div>
                <div style="white-space: pre-wrap; line-height: 1.6; color: var(--text-primary);">${this.escapeHtml(excerpt.text_content)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      document.body.appendChild(modal);

    } catch (error) {
      console.error('Failed to load PDF excerpts:', error);
      showNotification('Failed to load excerpts', 'error');
    }
  }

  // Utility functions
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  formatViews(count) {
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 365) return Math.floor(days / 365) + ' years ago';
    if (days > 30) return Math.floor(days / 30) + ' months ago';
    if (days > 0) return days + ' days ago';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return hours + ' hours ago';
    
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes > 0) return minutes + ' minutes ago';
    
    return 'just now';
  }
}

// Initialize gallery viewer
window.galleryViewer = new GalleryViewer();