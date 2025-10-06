// Enhanced Collection Viewer with Video Playback
class EnhancedCollectionViewer {
  constructor() {
    this.currentCollection = null;
    this.currentVideo = null;
    this.currentComments = [];
    this.allComments = [];
    this.createModal();
    this.setupVideoPlayer();
  }

  createModal() {
    const modalHtml = `
      <div id="enhancedViewerModal" class="modal enhanced-viewer-modal" style="display: none;">
        <div class="modal-content enhanced-viewer">
          <div class="viewer-header">
            <h2 id="viewerTitle">Collection Viewer</h2>
            <button class="close-btn" onclick="enhancedViewer.close()">×</button>
          </div>
          
          <div class="viewer-container">
            <!-- Video Player Section -->
            <div class="video-section">
              <div class="video-player-wrapper">
                <video id="videoPlayer" class="video-player" controls style="display: none;">
                  Your browser does not support the video tag.
                </video>
                <div id="videoPlaceholder" class="video-placeholder">
                  <img id="videoThumbnail" src="" alt="Video thumbnail" />
                  <div class="play-overlay">
                    <button class="play-button" onclick="enhancedViewer.playOnYouTube()">
                      <svg width="68" height="48" viewBox="0 0 68 48" fill="#fff">
                        <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"/>
                        <path d="M 45,24 27,14 27,34" fill="#212121"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="video-info">
                <h3 id="videoTitle" class="video-title"></h3>
                <div class="video-meta">
                  <span id="videoChannel" class="channel-name"></span>
                  <span class="separator">•</span>
                  <span id="videoStats" class="video-stats"></span>
                </div>
                <div class="video-actions">
                  <button class="btn btn-sm" onclick="enhancedViewer.playOnYouTube()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10 13V6.414a1 1 0 01.293-.707l3-3A1 1 0 0114 2h7a1 1 0 011 1v7a1 1 0 01-.293.707l-3 3A1 1 0 0118 14h-7a1 1 0 01-1-1z"/>
                      <path d="M14 10h7M10 14v7a1 1 0 01-1 1H2a1 1 0 01-1-1v-7a1 1 0 011-1h7a1 1 0 011 1z"/>
                    </svg>
                    Open in YouTube
                  </button>
                  <button class="btn btn-sm" id="downloadVideoBtn" onclick="enhancedViewer.downloadVideo()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download Video
                  </button>
                  <button class="btn btn-sm" onclick="enhancedViewer.exportVideoComments()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Export Comments
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Comments Section -->
            <div class="comments-section">
              <div class="comments-header">
                <h4><span id="commentCount">0</span> Comments</h4>
                <div class="comment-controls">
                  <input type="text" id="commentSearchInput" placeholder="Search comments..." class="comment-search" />
                  <select id="commentSortSelect" class="comment-sort">
                    <option value="top">Top Comments</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
              
              <div id="commentsList" class="comments-list">
                <div class="loading-spinner">Loading comments...</div>
              </div>
            </div>
            
            <!-- Video List Sidebar -->
            <div class="videos-sidebar">
              <div class="sidebar-header">
                <h4>Videos in Collection</h4>
                <span id="collectionStats" class="collection-stats"></span>
              </div>
              <div id="videosList" class="videos-list"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    const styles = `
      <style>
        .enhanced-viewer-modal .modal-content {
          max-width: 1400px;
          width: 95%;
          height: 90vh;
          display: flex;
          flex-direction: column;
        }
        
        .enhanced-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        .viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .viewer-container {
          display: grid;
          grid-template-columns: 1fr 320px;
          grid-template-rows: auto 1fr;
          gap: 20px;
          padding: 20px;
          height: 100%;
          overflow: hidden;
        }
        
        .video-section {
          grid-column: 1;
          grid-row: 1;
        }
        
        .video-player-wrapper {
          position: relative;
          width: 100%;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 16/9;
        }
        
        .video-player {
          width: 100%;
          height: 100%;
          background: #000;
        }
        
        .video-placeholder {
          position: relative;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
        
        .video-placeholder img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .play-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        .play-button {
          background: rgba(0, 0, 0, 0.8);
          border: none;
          border-radius: 8px;
          padding: 16px 24px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .play-button:hover {
          background: rgba(0, 0, 0, 0.9);
        }
        
        .video-info {
          margin-top: 16px;
        }
        
        .video-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }
        
        .video-meta {
          color: #666;
          font-size: 14px;
          margin-bottom: 12px;
        }
        
        .video-actions {
          display: flex;
          gap: 8px;
        }
        
        .comments-section {
          grid-column: 1;
          grid-row: 2;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .comments-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .comment-controls {
          display: flex;
          gap: 8px;
        }
        
        .comment-search {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .comment-sort {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background: white;
        }
        
        .comments-list {
          overflow-y: auto;
          flex: 1;
        }
        
        .comment-item {
          padding: 16px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .comment-item:last-child {
          border-bottom: none;
        }
        
        .comment-author {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        .author-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #666;
        }
        
        .author-info {
          flex: 1;
        }
        
        .author-name {
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          color: #030303;
        }
        
        .author-name:hover {
          text-decoration: underline;
        }
        
        .comment-date {
          font-size: 12px;
          color: #666;
        }
        
        .comment-text {
          margin-bottom: 8px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        
        .comment-text .timestamp {
          color: #065fd4;
          cursor: pointer;
          text-decoration: none;
        }
        
        .comment-text .timestamp:hover {
          text-decoration: underline;
        }
        
        .comment-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          color: #666;
        }
        
        .reply-thread {
          margin-left: 44px;
          margin-top: 12px;
        }
        
        .reply-toggle {
          color: #065fd4;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .reply-toggle:hover {
          text-decoration: underline;
        }
        
        .videos-sidebar {
          grid-column: 2;
          grid-row: 1 / 3;
          overflow-y: auto;
          background: #f9f9f9;
          border-radius: 8px;
          padding: 16px;
        }
        
        .sidebar-header {
          margin-bottom: 16px;
        }
        
        .sidebar-header h4 {
          margin: 0 0 4px 0;
        }
        
        .collection-stats {
          font-size: 12px;
          color: #666;
        }
        
        .video-list-item {
          display: flex;
          gap: 8px;
          padding: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.2s;
        }
        
        .video-list-item:hover {
          background: #e0e0e0;
        }
        
        .video-list-item.active {
          background: #e3f2fd;
        }
        
        .video-list-thumbnail {
          width: 120px;
          height: 67px;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
        }
        
        .video-list-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .duration-badge {
          position: absolute;
          bottom: 4px;
          right: 4px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 2px 4px;
          border-radius: 2px;
          font-size: 11px;
        }
        
        .video-list-info {
          flex: 1;
          min-width: 0;
        }
        
        .video-list-title {
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        
        .video-list-meta {
          font-size: 11px;
          color: #666;
        }
        
        @media (max-width: 1200px) {
          .viewer-container {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto 1fr;
          }
          
          .videos-sidebar {
            grid-column: 1;
            grid-row: 3;
            max-height: 200px;
          }
        }
      </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.bindEvents();
  }

  bindEvents() {
    // Comment search
    document.getElementById('commentSearchInput').addEventListener('input', (e) => {
      this.filterComments(e.target.value);
    });
    
    // Comment sort
    document.getElementById('commentSortSelect').addEventListener('change', (e) => {
      this.sortComments(e.target.value);
    });
    
    // Video player ended event
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.addEventListener('ended', () => {
      this.onVideoEnded();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('enhancedViewerModal').style.display === 'none') return;
      
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        this.seekVideo(-10);
      } else if (e.code === 'ArrowRight') {
        this.seekVideo(10);
      } else if (e.code === 'Escape') {
        this.close();
      }
    });
  }

  setupVideoPlayer() {
    const videoPlayer = document.getElementById('videoPlayer');
    
    // Add error handling for video loading
    videoPlayer.addEventListener('error', (e) => {
      console.error('Video loading error:', e);
      this.showVideoError();
    });
    
    // Add loading states
    videoPlayer.addEventListener('loadstart', () => {
      console.log('Video loading started');
    });
    
    videoPlayer.addEventListener('canplay', () => {
      console.log('Video can play');
    });
  }

  async show(collectionId) {
    try {
      const collection = await window.api.database.getCollection(collectionId);
      if (collection) {
        this.currentCollection = collection;
        this.render();
        document.getElementById('enhancedViewerModal').style.display = 'flex';
      } else {
        this.showNotification('Failed to load collection', 'error');
      }
    } catch (error) {
      console.error('Error loading collection:', error);
      this.showNotification('Error loading collection: ' + error.message, 'error');
    }
  }

  render() {
    if (!this.currentCollection) return;
    
    // Update header
    document.getElementById('viewerTitle').textContent = 
      `Collection: ${this.currentCollection.search_term}`;
    
    // Render videos list
    this.renderVideosList();
    
    // Select first video
    if (this.currentCollection.videos && this.currentCollection.videos.length > 0) {
      this.selectVideo(this.currentCollection.videos[0]);
    }
  }

  renderVideosList() {
    const videosList = document.getElementById('videosList');
    const videos = this.currentCollection.videos || [];
    
    document.getElementById('collectionStats').textContent = 
      `${videos.length} videos • ${this.currentCollection.comment_count} comments`;
    
    videosList.innerHTML = videos.map((video, index) => this.renderVideoListItem(video, index)).join('');
    
    // Add click handlers
    videosList.querySelectorAll('.video-list-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectVideo(videos[index]);
      });
    });
  }

  renderVideoListItem(video, index) {
    const thumbnails = video.thumbnails ? JSON.parse(video.thumbnails) : {};
    const thumbnail = thumbnails.medium?.url || thumbnails.default?.url || '';
    
    return `
      <div class="video-list-item ${video.id === this.currentVideo?.id ? 'active' : ''}" data-index="${index}">
        <div class="video-list-thumbnail">
          <img src="${thumbnail}" alt="${this.escapeHtml(video.title)}" onerror="this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"67\" fill=\"%23ccc\"><rect width=\"120\" height=\"67\"/><text x=\"50%\" y=\"50%\" text-anchor=\"middle\" dy=\".3em\" font-family=\"sans-serif\" font-size=\"14\">📹</text></svg>'">
          ${video.duration ? `<span class="duration-badge">${this.formatDuration(video.duration)}</span>` : ''}
        </div>
        <div class="video-list-info">
          <div class="video-list-title">${this.escapeHtml(video.title)}</div>
          <div class="video-list-meta">
            ${this.formatNumber(video.view_count)} views • ${video.comment_count} comments
          </div>
        </div>
      </div>
    `;
  }

  async selectVideo(video) {
    this.currentVideo = video;
    
    // Update active state in sidebar
    document.querySelectorAll('.video-list-item').forEach((item) => {
      item.classList.toggle('active', 
        this.currentCollection.videos[item.dataset.index].id === video.id);
    });
    
    // Update video section
    this.updateVideoSection(video);
    
    // Load comments
    await this.loadComments(video.id);
    
    // Check if video is downloaded and load it
    if (video.local_path) {
      this.loadVideoFile(video.local_path);
    }
  }

  updateVideoSection(video) {
    const thumbnails = video.thumbnails ? JSON.parse(video.thumbnails) : {};
    const thumbnail = thumbnails.maxres?.url || thumbnails.high?.url || 
                      thumbnails.medium?.url || thumbnails.default?.url || '';
    
    document.getElementById('videoTitle').textContent = video.title;
    document.getElementById('videoChannel').textContent = video.channel_title;
    document.getElementById('videoStats').textContent = 
      `${this.formatNumber(video.view_count)} views • ${this.formatNumber(video.like_count)} likes • Published ${new Date(video.published_at).toLocaleDateString()}`;
    
    document.getElementById('videoThumbnail').src = thumbnail;
    
    // Update download button state
    const downloadBtn = document.getElementById('downloadVideoBtn');
    if (video.local_path) {
      downloadBtn.textContent = 'Video Downloaded';
      downloadBtn.disabled = true;
    } else {
      downloadBtn.textContent = 'Download Video';
      downloadBtn.disabled = false;
    }
  }

  async loadVideoFile(localPath) {
    const videoPlayer = document.getElementById('videoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');
    
    try {
      // Convert local path to file:// URL for cross-platform compatibility
      const videoUrl = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
      
      videoPlayer.src = videoUrl;
      videoPlayer.style.display = 'block';
      placeholder.style.display = 'none';
      
      // Auto-play muted to avoid browser restrictions
      videoPlayer.muted = true;
      await videoPlayer.play();
      videoPlayer.muted = false;
    } catch (error) {
      console.error('Failed to load video:', error);
      this.showVideoError();
    }
  }

  showVideoError() {
    const videoPlayer = document.getElementById('videoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');
    
    videoPlayer.style.display = 'none';
    placeholder.style.display = 'block';
  }

  async loadComments(videoId) {
    const commentsList = document.getElementById('commentsList');
    
    try {
      const result = await window.api.database.getComments(videoId);
      
      if (result.success && result.data.length > 0) {
        this.allComments = result.data;
        this.currentComments = [...this.allComments];
        
        // Group comments by parent
        this.commentThreads = this.buildCommentThreads(this.allComments);
        
        document.getElementById('commentCount').textContent = this.allComments.length;
        this.renderComments();
      } else {
        commentsList.innerHTML = '<div class="empty-state">No comments found for this video</div>';
        document.getElementById('commentCount').textContent = '0';
      }
    } catch (error) {
      commentsList.innerHTML = '<div class="empty-state error">Error loading comments</div>';
    }
  }

  buildCommentThreads(comments) {
    const threads = {};
    const topLevel = [];
    
    comments.forEach(comment => {
      if (!comment.parent_id) {
        topLevel.push(comment);
        threads[comment.comment_id] = [];
      }
    });
    
    comments.forEach(comment => {
      if (comment.parent_id && threads[comment.parent_id]) {
        threads[comment.parent_id].push(comment);
      }
    });
    
    return { topLevel, threads };
  }

  renderComments() {
    const commentsList = document.getElementById('commentsList');
    
    if (!this.commentThreads || this.commentThreads.topLevel.length === 0) {
      commentsList.innerHTML = '<div class="empty-state">No comments to display</div>';
      return;
    }
    
    commentsList.innerHTML = this.commentThreads.topLevel
      .map(comment => this.renderCommentItem(comment))
      .join('');
  }

  renderCommentItem(comment, isReply = false) {
    const authorInitial = comment.author_name ? comment.author_name[0].toUpperCase() : '?';
    const replies = this.commentThreads.threads[comment.comment_id] || [];
    const processedText = this.processCommentText(comment.text);
    
    return `
      <div class="comment-item ${isReply ? 'reply' : ''}">
        <div class="comment-author">
          <div class="author-avatar">${authorInitial}</div>
          <div class="author-info">
            <span class="author-name" onclick="enhancedViewer.openChannel('${comment.author_channel_id}')">${this.escapeHtml(comment.author_name)}</span>
            <span class="comment-date">${this.formatRelativeTime(comment.published_at)}</span>
          </div>
        </div>
        <div class="comment-text">${processedText}</div>
        <div class="comment-stats">
          <span>👍 ${this.formatNumber(comment.like_count)}</span>
          ${replies.length > 0 && !isReply ? `
            <span class="reply-toggle" onclick="enhancedViewer.toggleReplies('${comment.comment_id}')">
              ▼ ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}
            </span>
          ` : ''}
        </div>
        ${replies.length > 0 && !isReply ? `
          <div class="reply-thread" id="replies-${comment.comment_id}" style="display: none;">
            ${replies.map(reply => this.renderCommentItem(reply, true)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  processCommentText(text) {
    // Escape HTML first
    let processed = this.escapeHtml(text);
    
    // Convert timestamps to clickable links (e.g., 1:23, 01:23, 1:23:45)
    processed = processed.replace(/(\d{1,2}):(\d{2})(?::(\d{2}))?/g, (match, h, m, s) => {
      let seconds = parseInt(m) + (parseInt(h) * 60);
      if (s) seconds = parseInt(s) + (parseInt(m) * 60) + (parseInt(h) * 3600);
      return `<a class="timestamp" href="#" onclick="enhancedViewer.seekToTime(${seconds}); return false;">${match}</a>`;
    });
    
    return processed;
  }

  seekToTime(seconds) {
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer.src) {
      videoPlayer.currentTime = seconds;
      if (videoPlayer.paused) {
        videoPlayer.play();
      }
    } else {
      this.showNotification('Video not loaded. Download the video to use timestamps.', 'info');
    }
  }

  toggleReplies(commentId) {
    const repliesDiv = document.getElementById(`replies-${commentId}`);
    if (repliesDiv) {
      const isVisible = repliesDiv.style.display !== 'none';
      repliesDiv.style.display = isVisible ? 'none' : 'block';
    }
  }

  filterComments(searchTerm) {
    if (!searchTerm) {
      this.currentComments = [...this.allComments];
    } else {
      const term = searchTerm.toLowerCase();
      this.currentComments = this.allComments.filter(comment => 
        comment.text.toLowerCase().includes(term) ||
        comment.author_name.toLowerCase().includes(term)
      );
    }
    
    this.commentThreads = this.buildCommentThreads(this.currentComments);
    this.renderComments();
  }

  sortComments(sortBy) {
    const topLevel = [...this.commentThreads.topLevel];
    
    switch(sortBy) {
      case 'top':
        topLevel.sort((a, b) => b.like_count - a.like_count);
        break;
      case 'newest':
        topLevel.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        break;
      case 'oldest':
        topLevel.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
        break;
    }
    
    this.commentThreads.topLevel = topLevel;
    this.renderComments();
  }

  togglePlayPause() {
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer.src) {
      if (videoPlayer.paused) {
        videoPlayer.play();
      } else {
        videoPlayer.pause();
      }
    }
  }

  seekVideo(seconds) {
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer.src) {
      videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime + seconds);
    }
  }

  onVideoEnded() {
    // Auto-play next video if available
    const videos = this.currentCollection.videos;
    const currentIndex = videos.findIndex(v => v.id === this.currentVideo.id);
    if (currentIndex < videos.length - 1) {
      this.selectVideo(videos[currentIndex + 1]);
    }
  }

  playOnYouTube() {
    if (this.currentVideo) {
      const url = `https://www.youtube.com/watch?v=${this.currentVideo.id}`;
      window.open(url, '_blank');
    }
  }

  openChannel(channelId) {
    if (channelId) {
      const url = `https://www.youtube.com/channel/${channelId}`;
      window.open(url, '_blank');
    }
  }

  async downloadVideo() {
    if (!this.currentVideo || this.currentVideo.local_path) return;
    
    const btn = document.getElementById('downloadVideoBtn');
    btn.disabled = true;
    btn.textContent = 'Downloading...';
    
    try {
      // Trigger download through main process
      const result = await window.api.youtube.downloadSingleVideo({
        video: this.currentVideo,
        options: {
          videoQuality: '720p',
          videoFormat: 'mp4'
        }
      });
      
      if (result.success) {
        this.currentVideo.local_path = result.localPath;
        btn.textContent = 'Video Downloaded';
        this.showNotification('Video downloaded successfully!', 'success');
        
        // Automatically load the video
        this.loadVideoFile(result.localPath);
      } else {
        btn.disabled = false;
        btn.textContent = 'Download Video';
        this.showNotification('Download failed: ' + result.error, 'error');
      }
    } catch (error) {
      btn.disabled = false;
      btn.textContent = 'Download Video';
      this.showNotification('Download error: ' + error.message, 'error');
    }
  }

  async exportVideoComments() {
    if (!this.currentVideo) return;
    
    try {
      const result = await window.api.export.videoComments({
        videoId: this.currentVideo.id,
        videoTitle: this.currentVideo.title
      });
      
      if (result.success) {
        this.showNotification(`Comments exported to: ${result.filePath}`, 'success');
        // Open the folder
        await window.api.system.openFolder(result.filePath);
      } else {
        this.showNotification('Export failed: ' + result.error, 'error');
      }
    } catch (error) {
      this.showNotification('Export error: ' + error.message, 'error');
    }
  }

  close() {
    document.getElementById('enhancedViewerModal').style.display = 'none';
    
    // Stop video playback
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.pause();
    videoPlayer.src = '';
    
    // Reset state
    this.currentCollection = null;
    this.currentVideo = null;
    this.currentComments = [];
    this.allComments = [];
  }

  // Helper methods
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

  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  showNotification(message, type = 'info') {
    // Use the global notification function if available
    if (typeof showNotification === 'function') {
      showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
}

// Initialize
const enhancedViewer = new EnhancedCollectionViewer();