// Collection Viewer Component
class CollectionViewer {
  constructor() {
    this.currentCollection = null;
    this.currentVideoId = null;
    this.createModal();
  }

  createModal() {
    const modalHtml = `
      <div id="collectionViewerModal" class="modal" style="display: none;">
        <div class="modal-content collection-viewer">
          <div class="modal-header">
            <div>
              <h2 id="collectionTitle">Collection Viewer</h2>
              <div class="collection-meta" id="collectionMeta"></div>
            </div>
            <button class="close-btn" onclick="collectionViewer.close()">×</button>
          </div>
          
          <div class="viewer-layout">
            <!-- Videos List -->
            <div class="videos-panel">
              <div class="panel-header">
                <h3>Videos</h3>
                <span id="videoCount">0 videos</span>
              </div>
              <div id="videosList" class="videos-list"></div>
            </div>
            
            <!-- Comments Panel -->
            <div class="comments-panel">
              <div class="panel-header">
                <h3>Comments</h3>
                <div class="comment-actions">
                  <input type="text" id="commentSearch" placeholder="Search comments..." />
                  <select id="commentSort">
                    <option value="likes">Most Liked</option>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                </div>
              </div>
              <div id="commentsList" class="comments-list">
                <div class="empty-state">Select a video to view comments</div>
              </div>
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="collectionViewer.exportCSV()">
              Export to CSV
            </button>
            <button class="btn" onclick="collectionViewer.exportJSON()">
              Export to JSON
            </button>
            <button class="btn" onclick="collectionViewer.close()">Close</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.bindEvents();
  }

  bindEvents() {
    // Comment search
    document.getElementById('commentSearch').addEventListener('input', (e) => {
      this.filterComments(e.target.value);
    });
    
    // Comment sort
    document.getElementById('commentSort').addEventListener('change', (e) => {
      this.sortComments(e.target.value);
    });
  }

  async show(collectionId) {
    try {
      const result = await window.api.db.getCollection(collectionId);
      if (result.success && result.data) {
        this.currentCollection = result.data;
        this.render();
        document.getElementById('collectionViewerModal').style.display = 'flex';
      } else {
        showNotification('Failed to load collection', 'error');
      }
    } catch (error) {
      showNotification('Error loading collection: ' + error.message, 'error');
    }
  }

  render() {
    if (!this.currentCollection) return;
    
    // Update header
    document.getElementById('collectionTitle').textContent = this.currentCollection.search_term;
    document.getElementById('collectionMeta').textContent = 
      `${new Date(this.currentCollection.created_at).toLocaleString()} • ${this.currentCollection.video_count} videos • ${this.currentCollection.comment_count} comments`;
    
    // Render videos list
    this.renderVideos();
  }

  renderVideos() {
    const videosList = document.getElementById('videosList');
    const videos = this.currentCollection.videos || [];
    
    document.getElementById('videoCount').textContent = `${videos.length} videos`;
    
    videosList.innerHTML = videos.map(video => `
      <div class="video-item ${video.id === this.currentVideoId ? 'active' : ''}" data-video-id="${video.id}">
        <div class="video-thumbnail">
          ${video.thumbnails ? 
            `<img src="${JSON.parse(video.thumbnails).medium?.url}" alt="${video.title}" />` : 
            '<div class="no-thumbnail">📹</div>'
          }
        </div>
        <div class="video-info">
          <div class="video-title">${this.escapeHtml(video.title)}</div>
          <div class="video-stats">
            <span>${this.formatNumber(video.view_count)} views</span>
            <span>${this.formatNumber(video.comment_count)} comments</span>
          </div>
        </div>
      </div>
    `).join('');
    
    // Add click handlers
    videosList.querySelectorAll('.video-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectVideo(item.dataset.videoId);
      });
    });
    
    // Select first video if none selected
    if (!this.currentVideoId && videos.length > 0) {
      this.selectVideo(videos[0].id);
    }
  }

  async selectVideo(videoId) {
    this.currentVideoId = videoId;
    
    // Update active state
    document.querySelectorAll('.video-item').forEach(item => {
      item.classList.toggle('active', item.dataset.videoId === videoId);
    });
    
    // Load comments for this video
    await this.loadComments(videoId);
  }

  async loadComments(videoId) {
    const commentsList = document.getElementById('commentsList');
    
    try {
      const result = await window.api.db.getComments(videoId);
      
      if (result.success && result.data.length > 0) {
        this.currentComments = result.data;
        this.renderComments();
      } else {
        commentsList.innerHTML = '<div class="empty-state">No comments found for this video</div>';
      }
    } catch (error) {
      commentsList.innerHTML = '<div class="empty-state error">Error loading comments</div>';
    }
  }

  renderComments(comments = this.currentComments) {
    const commentsList = document.getElementById('commentsList');
    
    if (!comments || comments.length === 0) {
      commentsList.innerHTML = '<div class="empty-state">No comments to display</div>';
      return;
    }
    
    commentsList.innerHTML = comments.map(comment => `
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author">${this.escapeHtml(comment.author_name)}</span>
          <span class="comment-date">${new Date(comment.published_at).toLocaleDateString()}</span>
        </div>
        <div class="comment-text">${this.escapeHtml(comment.text)}</div>
        <div class="comment-footer">
          <span class="comment-likes">👍 ${comment.like_count}</span>
          ${comment.reply_count > 0 ? `<span class="comment-replies">💬 ${comment.reply_count} replies</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  filterComments(searchTerm) {
    if (!this.currentComments) return;
    
    const filtered = this.currentComments.filter(comment => 
      comment.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.author_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    this.renderComments(filtered);
  }

  sortComments(sortBy) {
    if (!this.currentComments) return;
    
    const sorted = [...this.currentComments];
    
    switch(sortBy) {
      case 'likes':
        sorted.sort((a, b) => b.like_count - a.like_count);
        break;
      case 'newest':
        sorted.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
        break;
    }
    
    this.currentComments = sorted;
    this.renderComments();
  }

  async exportCSV() {
    if (!this.currentCollection) return;
    
    try {
      const result = await window.api.export.toCSV({ 
        collectionId: this.currentCollection.id 
      });
      
      if (result.success) {
        showNotification(`Exported to: ${result.filePath}`, 'success');
      } else {
        showNotification('Export failed: ' + result.error, 'error');
      }
    } catch (error) {
      showNotification('Export error: ' + error.message, 'error');
    }
  }

  async exportJSON() {
    if (!this.currentCollection) return;
    
    try {
      const result = await window.api.export.collection({ 
        collectionId: this.currentCollection.id 
      });
      
      if (result.success) {
        showNotification(`Exported to: ${result.filePath}`, 'success');
      } else {
        showNotification('Export failed: ' + result.error, 'error');
      }
    } catch (error) {
      showNotification('Export error: ' + error.message, 'error');
    }
  }

  close() {
    document.getElementById('collectionViewerModal').style.display = 'none';
    this.currentCollection = null;
    this.currentVideoId = null;
    this.currentComments = null;
  }

  // Helpers
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
}

// Initialize
const collectionViewer = new CollectionViewer();