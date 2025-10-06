// Collection Viewer Component
class CollectionViewer {
  constructor() {
    this.currentCollection = null;
    this.currentVideoId = null;
    this.currentPdfId = null;
    this.pdfsLoaded = false;
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

          <!-- Content Tabs -->
          <div class="content-tabs">
            <button class="tab-btn active" data-tab="videos">
              📹 Videos (<span id="videoTabCount">0</span>)
            </button>
            <button class="tab-btn" data-tab="pdfs">
              📄 PDFs (<span id="pdfTabCount">0</span>)
            </button>
          </div>

          <div class="tab-content">
            <!-- Videos Tab -->
            <div id="videosTab" class="tab-pane active">
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
            </div>

            <!-- PDFs Tab -->
            <div id="pdfsTab" class="tab-pane">
              <div class="viewer-layout">
                <!-- PDFs List -->
                <div class="pdfs-panel">
                  <div class="panel-header">
                    <h3>PDF Documents</h3>
                    <span id="pdfCount">0 PDFs</span>
                  </div>
                  <div id="pdfsList" class="pdfs-list"></div>
                </div>

                <!-- Excerpts Panel -->
                <div class="excerpts-panel">
                  <div class="panel-header">
                    <h3>Excerpts</h3>
                    <span id="excerptCount"></span>
                  </div>
                  <div id="excerptsPane" class="excerpts-list">
                    <div class="empty-state">Select a PDF to view excerpts</div>
                  </div>
                </div>
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

      <style>
        /* Make modal wider and responsive */
        #collectionViewerModal .modal-content {
          width: 90vw;
          max-width: 1400px;
          height: 85vh;
          max-height: 900px;
        }

        /* Tabs styling */
        .content-tabs {
          display: flex;
          gap: 8px;
          padding: 16px 20px 0;
          background: var(--bg-primary, #fff);
          border-bottom: 2px solid var(--border-color, #e0e0e0);
        }

        .tab-btn {
          background: none;
          border: none;
          padding: 12px 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary, #666);
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
          margin-bottom: -2px;
        }

        .tab-btn:hover {
          color: var(--text-primary, #000);
          background: var(--bg-hover, #f5f5f5);
        }

        .tab-btn.active {
          color: var(--accent-primary, #3b82f6);
          border-bottom-color: var(--accent-primary, #3b82f6);
        }

        /* Tab content */
        .tab-content {
          flex: 1;
          overflow: hidden;
        }

        .tab-pane {
          display: none;
          height: 100%;
        }

        .tab-pane.active {
          display: block;
        }

        /* PDF list styling */
        .pdfs-panel {
          flex: 0 0 350px;
          border-right: 1px solid var(--border-color, #e0e0e0);
          overflow-y: auto;
          background: var(--bg-secondary, #f9f9f9);
        }

        .pdfs-list {
          padding: 8px;
        }

        .pdf-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          margin-bottom: 8px;
          cursor: pointer;
          border-radius: 8px;
          background: white;
          border: 1px solid var(--border-color, #e0e0e0);
          transition: all 0.2s;
        }

        .pdf-item:hover {
          background: var(--bg-hover, #f5f5f5);
          border-color: var(--accent-primary, #3b82f6);
        }

        .pdf-item.active {
          background: var(--accent-light, #eff6ff);
          border-color: var(--accent-primary, #3b82f6);
        }

        .pdf-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .pdf-info {
          flex: 1;
          min-width: 0;
        }

        .pdf-title {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .pdf-meta {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        /* Excerpts panel */
        .excerpts-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .excerpts-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .excerpt-item {
          background: white;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
        }

        .excerpt-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .excerpt-number {
          font-weight: 600;
          color: var(--accent-primary, #3b82f6);
          font-size: 14px;
        }

        .excerpt-page {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        .excerpt-text {
          white-space: pre-wrap;
          line-height: 1.6;
          color: var(--text-primary, #000);
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary, #666);
        }

        /* Responsive layout */
        @media (max-width: 1200px) {
          #collectionViewerModal .modal-content {
            width: 95vw;
          }

          .pdfs-panel {
            flex: 0 0 300px;
          }
        }

        @media (max-width: 768px) {
          #collectionViewerModal .modal-content {
            width: 100vw;
            height: 100vh;
            max-width: none;
            max-height: none;
            border-radius: 0;
          }

          .viewer-layout {
            flex-direction: column;
          }

          .pdfs-panel,
          .excerpts-panel {
            flex: 1;
            border-right: none;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
          }

          .content-tabs {
            overflow-x: auto;
          }

          .tab-btn {
            white-space: nowrap;
          }
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.bindEvents();
    this.initTabs();
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

  initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;

        // Update active states
        document.querySelectorAll('.tab-btn').forEach(b =>
          b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p =>
          p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');

        // Load PDFs when tab is first opened
        if (tabName === 'pdfs' && !this.pdfsLoaded) {
          this.renderPDFs();
          this.pdfsLoaded = true;
        }
      });
    });
  }

  async show(collectionId) {
    try {
      const collection = await window.api.database.getCollection(collectionId);
      if (collection) {
        this.currentCollection = collection;
        this.currentCollection.isMerge = false;

        // Load videos and PDFs
        const videosResult = await window.api.database.getVideos(collectionId);
        const pdfsResult = await window.api.pdf.list(collectionId);

        this.currentCollection.videos = videosResult.success ? videosResult.data : [];
        this.currentCollection.pdfs = pdfsResult.success ? pdfsResult.data : [];

        // Reset state
        this.pdfsLoaded = false;
        this.currentPdfId = null;

        this.render();
        document.getElementById('collectionViewerModal').style.display = 'flex';
      } else {
        showNotification('Failed to load collection', 'error');
      }
    } catch (error) {
      console.error('Error loading collection:', error);
      showNotification('Error loading collection: ' + error.message, 'error');
    }
  }

  async showMerge(mergeId) {
    try {
      // Load merge details
      const merge = await window.api.database.getMerge(mergeId);
      const videos = await window.api.database.getMergeVideos(mergeId);

      if (!merge) {
        showNotification('Failed to load merged collection', 'error');
        return;
      }

      // Create a collection-like object for the merge
      this.currentCollection = {
        id: merge.id,
        search_term: merge.name,
        created_at: merge.created_at,
        video_count: videos.length,
        comment_count: 0, // Will be calculated
        videos: videos,
        isMerge: true,
        mergeData: merge
      };

      this.render();
      document.getElementById('collectionViewerModal').style.display = 'flex';
    } catch (error) {
      console.error('[CollectionViewer] Error loading merge:', error);
      showNotification('Error loading merged collection: ' + error.message, 'error');
    }
  }

  render() {
    if (!this.currentCollection) return;

    // Update header
    const title = this.currentCollection.isMerge
      ? `${this.currentCollection.search_term} (Merged)`
      : this.currentCollection.search_term;
    document.getElementById('collectionTitle').textContent = title;

    const videoCount = this.currentCollection.videos?.length || 0;
    const pdfCount = this.currentCollection.pdfs?.length || 0;

    const meta = this.currentCollection.isMerge
      ? `Created ${new Date(this.currentCollection.created_at).toLocaleDateString()} • ${videoCount} videos from ${this.currentCollection.mergeData.source_collections.length} collections`
      : `${new Date(this.currentCollection.created_at).toLocaleString()} • ${videoCount} videos • ${pdfCount} PDFs • ${this.currentCollection.comment_count} comments`;

    document.getElementById('collectionMeta').textContent = meta;

    // Update tab counts
    document.getElementById('videoTabCount').textContent = videoCount;
    document.getElementById('pdfTabCount').textContent = pdfCount;

    // Render videos list
    this.renderVideos();
  }

  renderVideos() {
    const videosList = document.getElementById('videosList');
    const videos = this.currentCollection.videos || [];

    document.getElementById('videoCount').textContent = `${videos.length} videos`;

    videosList.innerHTML = videos.map(video => {
      // Show source collection badge for merged collections
      const sourceBadge = this.currentCollection.isMerge && video.source_collection_name
        ? `<span class="source-badge" title="From: ${video.source_collection_name}">${video.source_collection_name}</span>`
        : '';

      return `
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
            ${sourceBadge}
          </div>
        </div>
      `;
    }).join('');

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
      const result = await window.api.database.getComments(videoId);
      
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

  renderPDFs() {
    const pdfsList = document.getElementById('pdfsList');
    const pdfs = this.currentCollection.pdfs || [];

    document.getElementById('pdfCount').textContent = `${pdfs.length} PDF${pdfs.length !== 1 ? 's' : ''}`;

    if (pdfs.length === 0) {
      pdfsList.innerHTML = '<div class="empty-state">No PDFs in this collection</div>';
      return;
    }

    pdfsList.innerHTML = pdfs.map(pdf => `
      <div class="pdf-item ${pdf.id === this.currentPdfId ? 'active' : ''}" data-pdf-id="${pdf.id}">
        <div class="pdf-icon">📄</div>
        <div class="pdf-info">
          <div class="pdf-title">${this.escapeHtml(pdf.title)}</div>
          <div class="pdf-meta">
            ${pdf.author ? `By ${this.escapeHtml(pdf.author)} • ` : ''}${pdf.num_pages || 0} pages • ${pdf.excerpts_count || 0} excerpts
          </div>
        </div>
      </div>
    `).join('');

    // Add click handlers
    pdfsList.querySelectorAll('.pdf-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectPDF(item.dataset.pdfId);
      });
    });

    // Select first PDF if none selected
    if (!this.currentPdfId && pdfs.length > 0) {
      this.selectPDF(pdfs[0].id);
    }
  }

  async selectPDF(pdfId) {
    this.currentPdfId = pdfId;

    // Update active state
    document.querySelectorAll('.pdf-item').forEach(item => {
      item.classList.toggle('active', item.dataset.pdfId === pdfId);
    });

    // Load excerpts for this PDF
    await this.loadExcerpts(pdfId);
  }

  async loadExcerpts(pdfId) {
    const excerptsPane = document.getElementById('excerptsPane');

    try {
      excerptsPane.innerHTML = '<div class="loading">Loading excerpts...</div>';

      const result = await window.api.pdf.getExcerpts(pdfId);

      if (result.success && result.data && result.data.length > 0) {
        const excerpts = result.data;

        document.getElementById('excerptCount').textContent = `${excerpts.length} excerpt${excerpts.length !== 1 ? 's' : ''}`;

        excerptsPane.innerHTML = excerpts.map((excerpt, idx) => `
          <div class="excerpt-item">
            <div class="excerpt-header">
              <span class="excerpt-number">Excerpt ${excerpt.excerpt_number || idx + 1}</span>
              <span class="excerpt-page">Page ${excerpt.page_number || '?'}</span>
            </div>
            <div class="excerpt-text">${this.escapeHtml(excerpt.text_content)}</div>
          </div>
        `).join('');
      } else {
        document.getElementById('excerptCount').textContent = '';
        excerptsPane.innerHTML = '<div class="empty-state">No excerpts found for this PDF</div>';
      }
    } catch (error) {
      console.error('Error loading excerpts:', error);
      document.getElementById('excerptCount').textContent = '';
      excerptsPane.innerHTML = '<div class="empty-state error">Error loading excerpts</div>';
    }
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
    this.currentPdfId = null;
    this.currentComments = null;
    this.pdfsLoaded = false;

    // Reset to videos tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="videos"]')?.classList.add('active');
    document.getElementById('videosTab')?.classList.add('active');
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

// Initialize and expose globally
const collectionViewer = new CollectionViewer();
window.collectionViewer = collectionViewer;