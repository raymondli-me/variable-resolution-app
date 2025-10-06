// Renderer process JavaScript
let currentView = 'youtube';
let currentTab = 'basic';
let selectedVideos = new Set();
let collectionJob = null;
let extractionSettings = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadSettings();
  showView('youtube');
  applyExtractionDefaults();
});

// Setup event listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      if (view && !e.currentTarget.disabled) {
        showView(view);
      }
    });
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.dataset.tab;
      if (tab) {
        showTab(tab);
      }
    });
  });

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', showSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', hideSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('selectDirBtn').addEventListener('click', selectDirectory);
  
  // Test API buttons
  const testGeminiBtn = document.getElementById('testGeminiBtn');
  if (testGeminiBtn) {
    testGeminiBtn.addEventListener('click', testGeminiConnection);
  }

  // YouTube search - check if elements exist (they might be replaced by single-page UI)
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) searchBtn.addEventListener('click', searchYouTube);
  
  const selectAllBtn = document.getElementById('selectAllBtn');
  if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllVideos);
  
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAllVideos);
  
  const startCollectionBtn = document.getElementById('startCollectionBtn');
  if (startCollectionBtn) startCollectionBtn.addEventListener('click', startCollection);
  
  // Collection controls
  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', pauseCollection);
  
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelCollection);

  // Enter key on search
  const searchTerm = document.getElementById('searchTerm');
  if (searchTerm) {
    searchTerm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchYouTube();
    });
  }

  // Extraction options toggles - check if elements exist
  const includeComments = document.getElementById('includeComments');
  if (includeComments) {
    includeComments.addEventListener('change', (e) => {
      const commentOptions = document.getElementById('commentOptions');
      if (commentOptions) commentOptions.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  const downloadVideo = document.getElementById('downloadVideo');
  if (downloadVideo) {
    downloadVideo.addEventListener('change', (e) => {
      const downloadOptions = document.getElementById('downloadOptions');
      if (downloadOptions) downloadOptions.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  const enableTranscription = document.getElementById('enableTranscription');
  if (enableTranscription) {
    enableTranscription.addEventListener('change', (e) => {
      const transcriptionOptions = document.getElementById('transcriptionOptions');
      if (transcriptionOptions) transcriptionOptions.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  // Export buttons
  const exportCardsBtn = document.getElementById('exportCardsBtn');
  if (exportCardsBtn) exportCardsBtn.addEventListener('click', exportToCards);
  
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
  
  const exportSupabaseBtn = document.getElementById('exportSupabaseBtn');
  if (exportSupabaseBtn) exportSupabaseBtn.addEventListener('click', exportToSupabase);
  
  // Open folder buttons
  const openOutputBtn = document.getElementById('openOutputBtn');
  if (openOutputBtn) openOutputBtn.addEventListener('click', openOutputFolder);

  const openOutputHeaderBtn = document.getElementById('openOutputHeaderBtn');
  if (openOutputHeaderBtn) openOutputHeaderBtn.addEventListener('click', openOutputFolder);

  // Collection type filter
  const collectionTypeFilter = document.getElementById('collectionTypeFilter');
  if (collectionTypeFilter) {
    collectionTypeFilter.addEventListener('change', () => {
      // Reload collections when filter changes
      loadCollections();
    });
  }

  // PDF Upload handlers
  const pdfFileBrowseBtn = document.getElementById('pdfFileBrowseBtn');
  if (pdfFileBrowseBtn) {
    pdfFileBrowseBtn.addEventListener('click', () => {
      document.getElementById('pdfFileInput').click();
    });
  }

  const pdfFileInput = document.getElementById('pdfFileInput');
  if (pdfFileInput) {
    pdfFileInput.addEventListener('change', handlePDFFileSelection);
  }

  // PDF Collection mode toggle
  const pdfNewCollection = document.getElementById('pdfNewCollection');
  const pdfExistingCollection = document.getElementById('pdfExistingCollection');
  if (pdfNewCollection && pdfExistingCollection) {
    pdfNewCollection.addEventListener('change', () => {
      document.getElementById('pdfNewCollectionSection').style.display = 'block';
      document.getElementById('pdfExistingCollectionSection').style.display = 'none';
      updatePDFUploadButton();
    });
    pdfExistingCollection.addEventListener('change', () => {
      document.getElementById('pdfNewCollectionSection').style.display = 'none';
      document.getElementById('pdfExistingCollectionSection').style.display = 'block';
      updatePDFUploadButton();
    });
  }

  const pdfCollectionName = document.getElementById('pdfCollectionName');
  if (pdfCollectionName) {
    pdfCollectionName.addEventListener('input', updatePDFUploadButton);
  }

  const pdfCollectionSelect = document.getElementById('pdfCollectionSelect');
  if (pdfCollectionSelect) {
    pdfCollectionSelect.addEventListener('change', (e) => {
      updatePDFUploadButton();
      if (e.target.value) {
        loadPDFDocuments(parseInt(e.target.value));
      }
    });
  }

  const pdfChunkingStrategy = document.getElementById('pdfChunkingStrategy');
  if (pdfChunkingStrategy) {
    pdfChunkingStrategy.addEventListener('change', (e) => {
      const fixedSizeOptions = document.getElementById('pdfFixedSizeOptions');
      if (fixedSizeOptions) {
        fixedSizeOptions.style.display = e.target.value === 'fixed' ? 'block' : 'none';
      }
    });
  }

  const uploadPDFBtn = document.getElementById('uploadPDFBtn');
  if (uploadPDFBtn) {
    uploadPDFBtn.addEventListener('click', uploadPDF);
  }
}

// Tab management
function showTab(tabName) {
  // Get the currently active view
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;

  // Only remove 'active' from tabs within the current view
  activeView.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  activeView.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  // Activate the selected tab
  const tab = document.getElementById(`${tabName}Tab`);
  if (tab) {
    tab.classList.add('active');
    currentTab = tabName;
  }

  // Activate the selected tab button
  const tabBtn = activeView.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (tabBtn) {
    tabBtn.classList.add('active');
  }
}

// View management
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById(`${viewName}View`);
  if (view) {
    view.classList.add('active');
    currentView = viewName;
  }

  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navItem) {
    navItem.classList.add('active');
  }

  // Handle view-specific initialization
  if (viewName === 'ai-analysis') {
    // Small delay to ensure DOM is ready
    setTimeout(() => showTab('ratings'), 0);
  }
}

// Settings
async function loadSettings() {
  const apiKeyResult = await window.api.settings.getApiKey('youtube');
  if (apiKeyResult?.success && apiKeyResult.apiKey) {
    document.getElementById('youtubeApiKey').value = apiKeyResult.apiKey;
    updateApiKeyStatus(true);
  }
  
  // Load Gemini API key
  const geminiKeyResult = await window.api.settings.getApiKey('gemini');
  if (geminiKeyResult?.success && geminiKeyResult.apiKey) {
    document.getElementById('geminiApiKey').value = geminiKeyResult.apiKey;
    updateGeminiApiKeyStatus(true);
  }
}

function updateApiKeyStatus(isSet) {
  const status = document.getElementById('apiKeyStatus');
  if (isSet) {
    status.textContent = 'API Key Set';
    status.style.color = '#28a745';
  } else {
    status.textContent = 'Not Set';
    status.style.color = '#dc3545';
  }
}

function updateGeminiApiKeyStatus(isSet) {
  const status = document.getElementById('geminiApiStatus');
  if (status) {
    if (isSet) {
      status.textContent = 'API Key Set';
      status.style.color = '#28a745';
    } else {
      status.textContent = 'Not Set';
      status.style.color = '#dc3545';
    }
  }
}

function showSettings() {
  document.getElementById('settingsModal').style.display = 'flex';
}

function hideSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

async function saveSettings() {
  const apiKey = document.getElementById('youtubeApiKey').value.trim();
  const geminiApiKey = document.getElementById('geminiApiKey').value.trim();
  const outputDir = document.getElementById('outputDir').value;
  
  if (apiKey) {
    const result = await window.api.settings.saveApiKey({ service: 'youtube', apiKey });
    if (result.success) {
      updateApiKeyStatus(true);
    }
  }
  
  if (geminiApiKey) {
    const result = await window.api.settings.saveApiKey({ service: 'gemini', apiKey: geminiApiKey });
    if (result.success) {
      updateGeminiApiKeyStatus(true);
    }
  }
  
  hideSettings();
  showNotification('Settings saved successfully', 'success');
}

async function selectDirectory() {
  const result = await window.api.dialog.selectDirectory();
  if (result.success) {
    document.getElementById('outputDir').value = result.path;
  }
}

async function testGeminiConnection() {
  const geminiApiKey = document.getElementById('geminiApiKey').value.trim();
  
  if (!geminiApiKey) {
    showNotification('Please enter a Gemini API key first', 'error');
    return;
  }
  
  const testBtn = document.getElementById('testGeminiBtn');
  const originalText = testBtn.textContent;
  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';
  
  try {
    // Save the key first
    await window.api.settings.saveApiKey({ service: 'gemini', apiKey: geminiApiKey });
    
    // Test the connection
    const result = await window.api.ai.testGeminiConnection();
    
    if (result.success) {
      showNotification('Gemini API connection successful!', 'success');
      updateGeminiApiKeyStatus(true);
    } else {
      showNotification(`Gemini API test failed: ${result.error}`, 'error');
      updateGeminiApiKeyStatus(false);
    }
  } catch (error) {
    showNotification(`Error testing Gemini API: ${error.message}`, 'error');
    updateGeminiApiKeyStatus(false);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = originalText;
  }
}

// Collect extraction settings
function collectExtractionSettings() {
  const settings = {
    // Basic settings
    searchTerm: document.getElementById('searchTerm').value,
    maxResults: parseInt(document.getElementById('maxResults').value),
    dateRange: document.getElementById('dateRange').value,
    orderBy: document.getElementById('orderBy').value,
    
    // Advanced settings
    advanced: {
      videoDuration: document.getElementById('videoDuration').value,
      videoDefinition: document.getElementById('videoDefinition').value,
      minViews: document.getElementById('minViews').value ? parseInt(document.getElementById('minViews').value) : null,
      maxViews: document.getElementById('maxViews').value ? parseInt(document.getElementById('maxViews').value) : null,
      videoLanguage: document.getElementById('videoLanguage').value,
      channelType: document.getElementById('channelType').value,
      embeddable: document.getElementById('embeddable').checked,
      syndicated: document.getElementById('syndicated').checked,
      apiQuotaLimit: parseInt(document.getElementById('apiQuotaLimit').value),
      rateLimitDelay: parseInt(document.getElementById('rateLimitDelay').value)
    },
    
    // Extraction settings
    extraction: {
      // Metadata
      extractTitle: document.getElementById('extractTitle').checked,
      extractDescription: document.getElementById('extractDescription').checked,
      extractTags: document.getElementById('extractTags').checked,
      extractThumbnails: document.getElementById('extractThumbnails').checked,
      extractCaptions: document.getElementById('extractCaptions').checked,
      extractStatistics: document.getElementById('extractStatistics').checked,
      extractPublishDate: document.getElementById('extractPublishDate').checked,
      
      // Channel
      extractChannelTitle: document.getElementById('extractChannelTitle').checked,
      extractChannelId: document.getElementById('extractChannelId').checked,
      extractChannelStats: document.getElementById('extractChannelStats').checked,
      extractChannelDescription: document.getElementById('extractChannelDescription').checked,
      
      // Comments
      includeComments: document.getElementById('includeComments').checked,
      maxComments: parseInt(document.getElementById('maxComments').value),
      commentSort: document.getElementById('commentSort').value,
      minCommentLikes: parseInt(document.getElementById('minCommentLikes').value) || 0,
      includeReplies: document.getElementById('includeReplies').checked,
      commentAuthorChannelId: document.getElementById('commentAuthorChannelId').checked,
      commentTimestamps: document.getElementById('commentTimestamps').checked,
      
      // Download
      downloadVideo: document.getElementById('downloadVideo').checked,
      videoQuality: document.getElementById('videoQuality').value,
      videoFormat: document.getElementById('videoFormat').value,
      maxFileSize: parseInt(document.getElementById('maxFileSize').value),
      extractAudioOnly: document.getElementById('extractAudioOnly').checked,
      downloadThumbnail: document.getElementById('downloadThumbnail').checked,
      
      // Transcription
      enableTranscription: document.getElementById('enableTranscription').checked,
      whisperModel: document.getElementById('whisperModel').value,
      whisperDevice: document.getElementById('whisperDevice').value,
      whisperLanguage: document.getElementById('whisperLanguage').value,
      whisperTimestamps: document.getElementById('whisperTimestamps').checked,
      enableVideoChunking: document.getElementById('enableVideoChunking')?.checked || false,
      
      // Processing
      textProcessing: document.getElementById('textProcessing').value,
      skipDuplicates: document.getElementById('skipDuplicates').checked,
      continueOnError: document.getElementById('continueOnError').checked
    }
  };
  
  return settings;
}

// YouTube search
async function searchYouTube() {
  const searchTerm = document.getElementById('searchTerm').value.trim();
  if (!searchTerm) {
    showNotification('Please enter a search term', 'error');
    return;
  }

  const apiKeyResult = await window.api.settings.getApiKey('youtube');
  if (!apiKeyResult?.success || !apiKeyResult.apiKey) {
    showNotification('Please set your YouTube API key in settings', 'error');
    showSettings();
    return;
  }

  const searchBtn = document.getElementById('searchBtn');
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';

  try {
    const settings = collectExtractionSettings();
    const options = {
      apiKey: apiKeyResult.apiKey,
      maxResults: settings.maxResults,
      dateRange: settings.dateRange,
      orderBy: settings.orderBy,
      advanced: settings.advanced
    };

    const result = await window.api.youtube.search({ searchTerm, options });
    
    if (result.success) {
      displaySearchResults(result.data);
      document.getElementById('searchResults').style.display = 'block';
      document.getElementById('resultsCount').textContent = `${result.data.length} videos found`;
    } else {
      showNotification(`Search failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Search error: ${error.message}`, 'error');
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search YouTube';
  }
}

// Display search results
function displaySearchResults(videos) {
  const resultsList = document.getElementById('resultsList');
  resultsList.innerHTML = '';
  selectedVideos.clear();

  videos.forEach(video => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <input type="checkbox" class="result-checkbox" data-video-id="${video.id}">
      <div class="result-thumbnail">
        <img src="${video.thumbnails?.medium?.url || ''}" alt="${video.title}">
      </div>
      <div class="result-info">
        <div class="result-title">${escapeHtml(video.title)}</div>
        <div class="result-channel">${escapeHtml(video.channelTitle)}</div>
        <div class="result-stats">
          <span>${formatNumber(video.viewCount)} views</span>
          <span>${formatNumber(video.likeCount)} likes</span>
          <span>${formatNumber(video.commentCount)} comments</span>
          <span>${formatDuration(video.duration)}</span>
        </div>
      </div>
    `;

    const checkbox = item.querySelector('.result-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedVideos.add(video);
        item.classList.add('selected');
      } else {
        selectedVideos.delete(video);
        item.classList.remove('selected');
      }
      updateSelectedCount();
    });

    item.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        checkbox.click();
      }
    });

    resultsList.appendChild(item);
  });

  updateSelectedCount();
}

// Selection controls
function selectAllVideos() {
  document.querySelectorAll('.result-checkbox').forEach(cb => {
    if (!cb.checked) cb.click();
  });
}

function deselectAllVideos() {
  document.querySelectorAll('.result-checkbox').forEach(cb => {
    if (cb.checked) cb.click();
  });
}

function updateSelectedCount() {
  const count = selectedVideos.size;
  document.getElementById('selectedCount').textContent = count;
  document.getElementById('startCollectionBtn').disabled = count === 0;
}

// Collection
async function startCollection() {
  if (selectedVideos.size === 0) return;

  const apiKeyResult = await window.api.settings.getApiKey('youtube');
  if (!apiKeyResult?.success || !apiKeyResult.apiKey) {
    showNotification('API key not found', 'error');
    return;
  }

  const settings = collectExtractionSettings();
  const options = {
    apiKey: apiKeyResult.apiKey,
    ...settings
  };

  const jobId = `job_${Date.now()}`;
  const videos = Array.from(selectedVideos);

  // Show progress section
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('collectionProgress').style.display = 'block';
  document.getElementById('collectionStatus').textContent = 'Starting collection...';
  
  // Reset progress
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressText').textContent = '0 / ' + videos.length;
  document.getElementById('collectionLog').innerHTML = '';

  // Start collection
  collectionJob = { jobId, startTime: Date.now(), total: videos.length };
  updateTimer();

  try {
    const result = await window.api.youtube.collect({ jobId, videos, options });
    
    if (result.success) {
      showNotification('Collection completed successfully!', 'success');
      addLogEntry(`Collection completed: ${result.data.length} videos collected`, 'success');
      if (result.summary) {
        addLogEntry(`Comments collected: ${result.summary.commentsCollected}`, 'info');
      }
      
      // Update status to show completion
      document.getElementById('collectionStatus').textContent = 'Collection Complete!';
      document.getElementById('progressFill').style.width = '100%';
      
      // Change buttons
      document.getElementById('pauseBtn').style.display = 'none';
      document.getElementById('cancelBtn').textContent = 'Done';
    } else {
      showNotification(`Collection failed: ${result.error}`, 'error');
      addLogEntry(`Collection failed: ${result.error}`, 'error');
      document.getElementById('collectionStatus').textContent = 'Collection Failed';
    }
  } catch (error) {
    showNotification(`Collection error: ${error.message}`, 'error');
    addLogEntry(`Collection error: ${error.message}`, 'error');
    document.getElementById('collectionStatus').textContent = 'Collection Error';
  } finally {
    collectionJob = null;
  }
}

// Progress updates
window.api.on('collection:video-complete', ({ jobId, video }) => {
  if (collectionJob?.jobId !== jobId) return;
  
  const completed = parseInt(document.getElementById('progressText').textContent.split(' / ')[0]) + 1;
  const percentage = (completed / collectionJob.total) * 100;
  
  document.getElementById('progressFill').style.width = `${percentage}%`;
  document.getElementById('progressText').textContent = `${completed} / ${collectionJob.total}`;
  document.getElementById('collectionStatus').textContent = `Collecting video ${completed} of ${collectionJob.total}...`;
  
  addLogEntry(`✓ Collected: ${video.title}`, 'success');
  if (video.comments) {
    addLogEntry(`  └─ ${video.comments.length} comments`, 'info');
  }
  if (video.localPath) {
    addLogEntry(`  └─ Downloaded to: ${video.localPath}`, 'info');
  }
  if (video.transcription) {
    addLogEntry(`  └─ Transcribed (${video.transcription.language})`, 'info');
  }
});

// Timer
function updateTimer() {
  if (!collectionJob) return;

  const elapsed = Date.now() - collectionJob.startTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  
  document.getElementById('timeElapsed').textContent = 
    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  requestAnimationFrame(updateTimer);
}

// Collection controls
function pauseCollection() {
  // Implement pause logic
  showNotification('Pause not implemented yet', 'warning');
}

async function cancelCollection() {
  if (!collectionJob) return;

  if (confirm('Are you sure you want to cancel the collection?')) {
    await window.api.youtube.cancel(collectionJob.jobId);
    collectionJob = null;
    
    document.getElementById('collectionProgress').style.display = 'none';
    document.getElementById('searchResults').style.display = 'block';
    
    showNotification('Collection cancelled', 'warning');
  }
}



// Load PDF statistics for a collection
async function loadPDFStats(collectionId) {
  try {
    const result = await window.api.pdf.list(collectionId);
    if (result.success && result.pdfs) {
      const pdfCount = result.pdfs.length;
      const excerptCount = result.pdfs.reduce((sum, pdf) => sum + (pdf.excerpts_count || 0), 0);

      const pdfCountEl = document.getElementById(`pdf-count-${collectionId}`);
      const excerptCountEl = document.getElementById(`excerpt-count-${collectionId}`);

      if (pdfCountEl) pdfCountEl.textContent = pdfCount;
      if (excerptCountEl) excerptCountEl.textContent = excerptCount;
    }
  } catch (error) {
    console.error(`Failed to load PDF stats for collection ${collectionId}:`, error);
  }
}

// Load aggregated PDF statistics for merged collections
async function loadMergedPDFStats(collection) {
  try {
    let totalPdfCount = 0;
    let totalExcerptCount = 0;

    // Iterate through source collections and aggregate PDF stats
    if (collection.mergeData && collection.mergeData.source_collections) {
      const pdfPromises = collection.mergeData.source_collections.map(async (sc) => {
        // Check if this source collection is a PDF collection
        const isPDFSource = sc.settings && typeof sc.settings === 'string'
          ? JSON.parse(sc.settings).type === 'pdf'
          : sc.settings?.type === 'pdf';

        if (isPDFSource) {
          const result = await window.api.pdf.list(sc.id);
          if (result.success && result.pdfs) {
            return {
              pdfCount: result.pdfs.length,
              excerptCount: result.pdfs.reduce((sum, pdf) => sum + (pdf.excerpts_count || 0), 0)
            };
          }
        }
        return { pdfCount: 0, excerptCount: 0 };
      });

      const results = await Promise.all(pdfPromises);
      results.forEach(r => {
        totalPdfCount += r.pdfCount;
        totalExcerptCount += r.excerptCount;
      });
    }

    // Update display
    const pdfCountEl = document.getElementById(`pdf-count-${collection.id}`);
    const excerptCountEl = document.getElementById(`excerpt-count-${collection.id}`);

    if (pdfCountEl) pdfCountEl.textContent = totalPdfCount;
    if (excerptCountEl) excerptCountEl.textContent = totalExcerptCount;

  } catch (error) {
    console.error(`Failed to load merged PDF stats for collection ${collection.id}:`, error);
  }
}

// View PDF collection with excerpts
async function viewPDFCollection(collectionId, event) {
  if (event) event.stopPropagation();

  try {
    const result = await window.api.pdf.list(collectionId);
    if (!result.success || !result.pdfs || result.pdfs.length === 0) {
      showNotification('No PDFs found in this collection', 'warning');
      return;
    }

    // Create modal viewer
    const modal = document.createElement('div');
    modal.className = 'pdf-viewer-modal';
    modal.innerHTML = `
      <div class="pdf-viewer-content">
        <div class="pdf-viewer-header">
          <h2>PDF Collection Documents</h2>
          <button class="close-btn" onclick="this.closest('.pdf-viewer-modal').remove()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="pdf-list-viewer">
          ${result.pdfs.map(pdf => `
            <div class="pdf-card" onclick="viewPDFExcerpts(${pdf.id})">
              <div class="pdf-icon">📄</div>
              <div class="pdf-details">
                <h3>${escapeHtml(pdf.title || 'Untitled')}</h3>
                <div class="pdf-meta">
                  <span>${pdf.num_pages || 0} pages</span>
                  <span>${pdf.excerpts_count || 0} excerpts</span>
                  <span>${new Date(pdf.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button class="btn btn-sm" onclick="event.stopPropagation(); deletePDF(${pdf.id}, ${collectionId})">Delete</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  } catch (error) {
    console.error('Failed to view PDF collection:', error);
    showNotification('Failed to load PDF collection', 'error');
  }
}

// View excerpts for a specific PDF
async function viewPDFExcerpts(pdfId) {
  try {
    const result = await window.api.pdf.getExcerpts(pdfId);
    if (!result.success || !result.excerpts || result.excerpts.length === 0) {
      showNotification('No excerpts found for this PDF', 'warning');
      return;
    }

    // Create excerpt viewer modal
    const modal = document.createElement('div');
    modal.className = 'pdf-excerpt-modal';
    modal.innerHTML = `
      <div class="pdf-excerpt-content">
        <div class="pdf-excerpt-header">
          <h2>${escapeHtml(result.pdfTitle || 'PDF Excerpts')}</h2>
          <button class="close-btn" onclick="this.closest('.pdf-excerpt-modal').remove()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="excerpt-list">
          ${result.excerpts.map((excerpt, index) => `
            <div class="excerpt-card">
              <div class="excerpt-number">Excerpt ${excerpt.excerpt_number}${excerpt.page_number ? ` (Page ${excerpt.page_number})` : ''}</div>
              <div class="excerpt-text">${escapeHtml(excerpt.text_content)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  } catch (error) {
    console.error('Failed to load excerpts:', error);
    showNotification('Failed to load excerpts', 'error');
  }
}

// Delete a PDF document
async function deletePDF(pdfId, collectionId) {
  if (!confirm('Are you sure you want to delete this PDF and all its excerpts?')) {
    return;
  }

  try {
    const result = await window.api.pdf.delete(pdfId);
    if (result.success) {
      showNotification('PDF deleted successfully', 'success');

      // Close any open modals and refresh the collection view
      document.querySelectorAll('.pdf-viewer-modal, .pdf-excerpt-modal').forEach(modal => modal.remove());

      // Re-open the collection viewer
      viewPDFCollection(collectionId);
    } else {
      showNotification('Failed to delete PDF: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Failed to delete PDF:', error);
    showNotification('Failed to delete PDF', 'error');
  }
}

// Export functions
async function exportToCards() {
  showNotification('Export to CARDS not implemented yet', 'info');
}

async function exportToCsv() {
  // Get the most recent collection
  const collections = await window.api.database.getCollections();
  if (collections.success && collections.data.length > 0) {
    const mostRecent = collections.data[0];
    
    const result = await window.api.export.toCSV({ collectionId: mostRecent.id });
    if (result.success) {
      showNotification(`Exported to: ${result.filePath}`, 'success');
      // Open the folder
      await window.api.system.openFolder(result.filePath);
    } else {
      showNotification('Export failed: ' + result.error, 'error');
    }
  } else {
    showNotification('No collections to export', 'warning');
  }
}

async function exportToSupabase() {
  showNotification('Export to Supabase not implemented yet', 'info');
}

// ========================================
// PDF Upload Functions
// ========================================

let selectedPDFFile = null;

function handlePDFFileSelection(e) {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    selectedPDFFile = file;
    document.getElementById('pdfFileName').textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

    // Auto-fill title from filename if empty
    const titleInput = document.getElementById('pdfTitle');
    if (!titleInput.value) {
      titleInput.value = file.name.replace(/\.pdf$/i, '');
    }

    updatePDFUploadButton();
  } else {
    showNotification('Please select a valid PDF file', 'error');
  }
}

function updatePDFUploadButton() {
  const uploadBtn = document.getElementById('uploadPDFBtn');
  const isNewCollection = document.getElementById('pdfNewCollection').checked;

  let hasValidCollection = false;
  if (isNewCollection) {
    const collectionName = document.getElementById('pdfCollectionName').value.trim();
    hasValidCollection = collectionName.length > 0;
  } else {
    const collectionId = document.getElementById('pdfCollectionSelect').value;
    hasValidCollection = collectionId !== '';
  }

  console.log('PDF Upload Button Update - Mode:', isNewCollection ? 'new' : 'existing', 'Valid:', hasValidCollection, 'File:', selectedPDFFile ? selectedPDFFile.name : 'none');

  if (uploadBtn) {
    uploadBtn.disabled = !(selectedPDFFile && hasValidCollection);
  }
}

async function uploadPDF() {
  if (!selectedPDFFile) {
    showNotification('Please select a PDF file', 'error');
    return;
  }

  const isNewCollection = document.getElementById('pdfNewCollection').checked;
  let collectionId;

  // Show progress UI
  document.getElementById('pdfUploadProgress').style.display = 'block';
  document.getElementById('uploadPDFBtn').disabled = true;

  const statusEl = document.getElementById('pdfUploadStatus');
  const percentageEl = document.getElementById('pdfUploadPercentage');
  const progressBar = document.getElementById('pdfUploadProgressBar');
  const logEl = document.getElementById('pdfUploadLog');

  function addPDFLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }

  try {
    // Create new collection if needed
    if (isNewCollection) {
      const collectionName = document.getElementById('pdfCollectionName').value.trim();
      if (!collectionName) {
        showNotification('Please enter a collection name', 'error');
        document.getElementById('uploadPDFBtn').disabled = false;
        return;
      }

      addPDFLog('Creating new collection...');
      statusEl.textContent = 'Creating collection...';
      percentageEl.textContent = '5%';
      progressBar.style.width = '5%';

      const createResult = await window.api.collections.createPDFCollection({ name: collectionName });
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create collection');
      }

      collectionId = createResult.collectionId;
      addPDFLog(`✓ Collection created: ${collectionName}`, 'success');
    } else {
      collectionId = parseInt(document.getElementById('pdfCollectionSelect').value);
      if (!collectionId) {
        showNotification('Please select a collection', 'error');
        document.getElementById('uploadPDFBtn').disabled = false;
        return;
      }
    }

    const title = document.getElementById('pdfTitle').value || selectedPDFFile.name.replace(/\.pdf$/i, '');
    const chunkingStrategy = document.getElementById('pdfChunkingStrategy').value;
    const chunkSize = parseInt(document.getElementById('pdfChunkSize').value) || 500;

    addPDFLog('Starting PDF upload...');
    statusEl.textContent = 'Uploading PDF file...';
    percentageEl.textContent = '10%';
    progressBar.style.width = '10%';

    // Call IPC to upload PDF
    const result = await window.api.pdf.upload({
      filePath: selectedPDFFile.path,
      collectionId,
      title,
      chunkingStrategy,
      chunkSize
    });

    if (result.success) {
      statusEl.textContent = 'PDF processed successfully!';
      percentageEl.textContent = '100%';
      progressBar.style.width = '100%';

      addPDFLog(`✓ PDF uploaded: ${result.metadata.title}`, 'success');
      addPDFLog(`✓ Created ${result.excerpts} excerpts`, 'success');
      addPDFLog(`✓ Chunking strategy: ${chunkingStrategy}`, 'info');

      showNotification(`PDF processed: ${result.excerpts} excerpts created`, 'success');

      // Reset form
      setTimeout(() => {
        selectedPDFFile = null;
        document.getElementById('pdfFileInput').value = '';
        document.getElementById('pdfFileName').textContent = '';
        document.getElementById('pdfTitle').value = '';
        document.getElementById('pdfUploadProgress').style.display = 'none';
        document.getElementById('uploadPDFBtn').disabled = false;
        logEl.innerHTML = '';

        // Reload PDF list
        loadPDFDocuments(collectionId);

        // CRITICAL FIX: Refresh folder browser tree to show new collection
        if (window.folderBrowser && typeof window.folderBrowser.loadFolderTree === 'function') {
          window.folderBrowser.loadFolderTree();
        }
      }, 2000);

    } else {
      throw new Error(result.error || 'Upload failed');
    }

  } catch (error) {
    console.error('PDF upload error:', error);
    addPDFLog(`✗ Error: ${error.message}`, 'error');
    statusEl.textContent = 'Upload failed';
    showNotification(`PDF upload failed: ${error.message}`, 'error');
    document.getElementById('uploadPDFBtn').disabled = false;
  }
}

async function loadPDFCollections() {
  const select = document.getElementById('pdfCollectionSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Loading collections...</option>';

  try {
    const result = await window.api.collections.list();
    console.log('PDF collections loaded:', result);

    if (result.success && result.data && result.data.length > 0) {
      select.innerHTML = '<option value="">Select a collection...</option>';
      result.data.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = `${collection.search_term} (${new Date(collection.created_at).toLocaleDateString()})`;
        select.appendChild(option);
      });
    } else {
      select.innerHTML = '<option value="">No collections found</option>';
    }
  } catch (error) {
    console.error('Failed to load collections:', error);
    select.innerHTML = '<option value="">Error loading collections</option>';
  }
}

async function loadPDFDocuments(collectionId) {
  const listEl = document.getElementById('pdfDocumentsList');
  if (!listEl || !collectionId) return;

  try {
    const result = await window.api.pdf.list(collectionId);
    if (result.success && result.pdfs && result.pdfs.length > 0) {
      listEl.innerHTML = result.pdfs.map(pdf => `
        <div class="pdf-item">
          <div class="pdf-info">
            <h4>${escapeHtml(pdf.title)}</h4>
            <p>${pdf.num_pages} pages • ${pdf.excerpts_count} excerpts</p>
            <small>${new Date(pdf.created_at).toLocaleString()}</small>
          </div>
          <div class="pdf-actions">
            <button class="btn btn-sm" onclick="viewPDFExcerpts(${pdf.id})">View Excerpts</button>
            <button class="btn btn-sm btn-danger" onclick="deletePDF(${pdf.id}, ${collectionId})">Delete</button>
          </div>
        </div>
      `).join('');
    } else {
      listEl.innerHTML = `
        <div class="empty-state">
          <h3>No PDFs in this collection</h3>
          <p>Upload a PDF to get started</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load PDF documents:', error);
  }
}

// Listen for view changes to load PDF collections
document.addEventListener('viewChanged', (e) => {
  if (e.detail.view === 'collections') {
    // Small delay to ensure tab switching is complete
    setTimeout(() => {
      const pdfsTab = document.getElementById('pdfsTab');
      if (pdfsTab && pdfsTab.classList.contains('active')) {
        loadPDFCollections();
      }
    }, 100);
  }
});

// Also listen for tab changes within collections view
document.addEventListener('DOMContentLoaded', () => {
  const collectionsTabs = document.querySelectorAll('#collectionsView .tab-btn');
  collectionsTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'pdfs') {
        loadPDFCollections();
      }
    });
  });
});

// Open output folder
async function openOutputFolder() {
  try {
    // Open the videos folder in the app data directory
    const userDataPath = await window.api.system.openFolder();
    if (!userDataPath?.success) {
      showNotification('Could not open output folder', 'error');
    }
  } catch (error) {
    showNotification('Error opening folder: ' + error.message, 'error');
  }
}

// Apply defaults to UI checkboxes
function applyExtractionDefaults() {
  // Check if we're using the modern UI (which has different element IDs)
  const isModernUI = document.querySelector('.modern-container');
  
  if (!isModernUI) {
    // Apply extraction defaults to original UI elements (with null checks)
    const setChecked = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = value;
    };
    
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    
    const setDisplay = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.style.display = value;
    };
    
    // Metadata
    setChecked('extractTitle', true);
    setChecked('extractDescription', true);
    setChecked('extractTags', true);
    setChecked('extractThumbnails', true);
    setChecked('extractCaptions', true);
    setChecked('extractStatistics', true);
    setChecked('extractPublishDate', true);
    setChecked('extractChannelTitle', true);
    setChecked('extractChannelId', true);
    
    // Comments
    setChecked('includeComments', true);
    setValue('maxComments', 100);
    setValue('commentSort', 'relevance');
    setChecked('includeReplies', true);
    
    // Downloads
    setChecked('downloadVideo', true);
    setChecked('downloadThumbnail', true);
    setValue('videoQuality', '480p');
    
    // Transcription
    setChecked('enableTranscription', true);
    setValue('whisperModel', 'base');
    setValue('whisperDevice', 'auto');
    
    // Processing
    setValue('textProcessing', 'clean');
    setChecked('skipDuplicates', true);
    setChecked('continueOnError', true);
    
    // Show/hide sub-options
    setDisplay('commentOptions', 'block');
    setDisplay('downloadOptions', 'block');
    setDisplay('transcriptionOptions', 'block');
  }
  
  // Check tools availability
  checkToolsAvailability();
}

// Helpers
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function showNotification(message, type = 'info') {
  // Simple console log for now
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // You could add a toast notification UI here
}

function addLogEntry(message, type = 'info') {
  const log = document.getElementById('collectionLog');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

async function viewCollection(collectionId) {
  // Use the new gallery viewer for better navigation
  if (typeof galleryViewer !== 'undefined') {
    galleryViewer.show(collectionId);
  } else if (typeof enhancedViewer !== 'undefined') {
    enhancedViewer.show(collectionId);
  } else {
    // Fallback to basic viewer
    collectionViewer.show(collectionId);
  }
}

// Export collection with options
async function exportCollection(collectionId, event) {
  if (event) event.stopPropagation();
  
  // Create export options menu
  const menu = document.createElement('div');
  menu.className = 'export-menu';
  menu.innerHTML = `
    <div class="export-menu-options">
      <button class="export-option" onclick="exportCollectionCARDS(${collectionId})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        Export to CARDS (BWS Rating)
      </button>
      <button class="export-option" onclick="exportCollectionCSV(${collectionId})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Export CSV (with transcriptions)
      </button>
      <button class="export-option" onclick="exportCollectionJSON(${collectionId})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        Export JSON (complete data)
      </button>
      <button class="export-option" onclick="viewCollection(${collectionId})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        View Collection
      </button>
    </div>
  `;
  
  // Position menu near the clicked button
  if (event && event.target) {
    const rect = event.target.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
  }
  
  // Close menu when clicking outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

// Export to CSV
async function exportCollectionCSV(collectionId) {
  try {
    showNotification('Exporting collection to CSV...', 'info');
    const result = await window.api.export.toCSV({ collectionId });
    if (result.success) {
      showNotification(`Exported to: ${result.filePath}`, 'success');
      await window.api.system.openFolder(result.filePath);
    } else {
      showNotification('Export failed: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Export error: ' + error.message, 'error');
  } finally {
    document.querySelector('.export-menu')?.remove();
  }
}

// Export to JSON
async function exportCollectionJSON(collectionId) {
  try {
    showNotification('Exporting collection to JSON...', 'info');
    const result = await window.api.export.collection({ collectionId });
    if (result.success) {
      showNotification(`Exported to: ${result.filePath}`, 'success');
      await window.api.system.openFolder(result.filePath);
    } else {
      showNotification('Export failed: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Export error: ' + error.message, 'error');
  } finally {
    document.querySelector('.export-menu')?.remove();
  }
}

// Export to CARDS
async function exportCollectionCARDS(collectionId) {
  try {
    // For now, let's do a simple export with default options
    // Later we'll add the dialog for configuration
    showNotification('Preparing CARDS export...', 'info');
    
    // Default options for CARDS export
    const options = {
      include_videos: true,
      include_chunks: true,
      include_comments: true,
      video_export_mode: 'thumbnail',
      chunks_per_video: 5,
      min_comment_likes: 10,
      assessment_method: 'bws',
      set_size: 4,
      dimensions: [{
        id: 'quality',
        name: 'Content Quality',
        description: 'Overall quality and value of the content',
        scale_type: 'unipolar',
        anchors: ['Low Quality', 'High Quality']
      }]
    };
    
    const result = await window.api.export.cards({ collectionId, options });
    
    if (result.success) {
      showNotification('CARDS export completed!', 'success');
      
      // Show export statistics
      if (result.stats) {
        const stats = result.stats;
        showNotification(
          `Exported ${stats.total_items} items (${stats.videos} videos, ${stats.text_items} text) into ${stats.assessment_sets} assessment sets`,
          'info'
        );
      }
      
      // Ask if user wants to open the file
      if (confirm('Export complete! Would you like to open the export folder?')) {
        await window.api.system.openFolder(result.path);
      }
    } else {
      showNotification('Export failed: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Export error: ' + error.message, 'error');
  } finally {
    document.querySelector('.export-menu')?.remove();
  }
}

// Import collection
async function importCollection() {
  try {
    const result = await window.api.import.collection();
    if (result.success) {
      showNotification('Collection imported successfully!', 'success');
      loadCollections(); // Refresh the collections list
    } else if (result.error) {
      showNotification('Import failed: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Import error: ' + error.message, 'error');
  }
}

// Resume collection from gallery
async function resumeCollectionFromGallery(manifestPath, event) {
  event.stopPropagation();
  
  showNotification('Resuming collection...', 'info');
  
  try {
    const result = await window.api.collections.resume({ manifestPath });
    
    if (result.success) {
      showNotification('Collection resumed successfully!', 'success');
      // Refresh the collections view
      await loadCollections();
    } else {
      showNotification(`Resume failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Resume error: ${error.message}`, 'error');
  }
}

// Mark collection as complete
async function markCollectionComplete(collectionId, manifestPath, event) {
  event.stopPropagation();
  
  if (!confirm('Mark this collection as complete? This will prevent it from being resumed.')) {
    return;
  }
  
  try {
    const result = await window.api.collections.markComplete({ manifestPath });
    
    if (result.success) {
      showNotification('Collection marked as complete', 'success');
      // Refresh the collections view
      await loadCollections();
    } else {
      showNotification(`Failed to mark complete: ${result.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// ============================================================================
// AI Analysis Controller
// ============================================================================

class AIAnalysisController {
  constructor() {
    this.currentCollection = null;
    this.currentProject = null;
    this.ratingInProgress = false;
    this.allProjects = [];
    this.collections = [];
    this.setupEventListeners();
    this.initialize();
  }

  async initialize() {
    await this.loadCollections();
    await this.loadAllProjects();  // This now calls updateStatsBar() and renderProjectsGallery()
    this.populateCollectionDropdown();
  }

  setupEventListeners() {
    // Create Project Button
    const createBtn = document.getElementById('create-project-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateModal());
    }
    
    // Modal close buttons
    const closeCreateModal = document.getElementById('close-create-modal');
    const closeDetailsModal = document.getElementById('close-details-modal');
    
    if (closeCreateModal) {
      closeCreateModal.addEventListener('click', () => this.hideCreateModal());
    }
    if (closeDetailsModal) {
      closeDetailsModal.addEventListener('click', () => this.hideDetailsModal());
    }
    
    // Search and filter
    const searchInput = document.getElementById('project-search');
    const filterSelect = document.getElementById('project-filter-status');
    
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterProjects());
    }
    if (filterSelect) {
      filterSelect.addEventListener('change', () => this.filterProjects());
    }
    
    // Viewer controls
    const closeViewer = document.getElementById('close-rating-viewer');
    if (closeViewer) {
      closeViewer.addEventListener('click', () => this.closeViewer());
    }

    // Create Child Project button
    const createChildBtn = document.getElementById('create-child-project-btn');
    if (createChildBtn) {
      createChildBtn.addEventListener('click', () => this.openChildProjectModal());
    }

    // Viewer tabs
    document.querySelectorAll('.rating-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchViewerTab(tabName);
      });
    });
    
    // Viewer filters
    const ratingsSearch = document.getElementById('ratings-search');
    const ratingsFilterScore = document.getElementById('ratings-filter-score');
    const ratingsFilterType = document.getElementById('ratings-filter-type');
    
    if (ratingsSearch) {
      ratingsSearch.addEventListener('input', (e) => {
        if (this.currentRatingsFilter) {
          this.currentRatingsFilter.search = e.target.value;
          this.renderRatingsList();
        }
      });
    }
    if (ratingsFilterScore) {
      ratingsFilterScore.addEventListener('change', (e) => {
        if (this.currentRatingsFilter) {
          this.currentRatingsFilter.score = e.target.value;
          this.renderRatingsList();
        }
      });
    }
    if (ratingsFilterType) {
      ratingsFilterType.addEventListener('change', (e) => {
        if (this.currentRatingsFilter) {
          this.currentRatingsFilter.type = e.target.value;
          this.renderRatingsList();
        }
      });
    }
    
    // Collection selector
    const collectionSelect = document.getElementById('ai-collection-select');
    if (collectionSelect) {
      collectionSelect.addEventListener('change', (e) => this.onCollectionSelected(e.target.value));
    }
    
    // Content type checkboxes - update counts
    const rateChunks = document.getElementById('rate-chunks');
    const rateComments = document.getElementById('rate-comments');
    const ratePDFs = document.getElementById('rate-pdfs');
    if (rateChunks) rateChunks.addEventListener('change', () => this.updateEstimate());
    if (rateComments) rateComments.addEventListener('change', () => this.updateEstimate());
    if (ratePDFs) ratePDFs.addEventListener('change', () => this.updateEstimate());
    
    // Buttons
    const startBtn = document.getElementById('start-rating-btn');
    const previewBtn = document.getElementById('preview-rating-btn');
    const pauseBtn = document.getElementById('pause-rating-btn');
    const cancelBtn = document.getElementById('cancel-rating-btn');
    const minimizeBtn = document.getElementById('minimize-rating-btn');
    
    if (startBtn) startBtn.addEventListener('click', () => this.startRating());
    if (previewBtn) previewBtn.addEventListener('click', () => this.previewRating());
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseRating());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelRating());
    if (minimizeBtn) minimizeBtn.addEventListener('click', () => this.minimizeProgress());

    // Hierarchical project filter listeners
    const filterInputs = ['filter-min-score', 'filter-max-score', 'filter-video-chunks', 'filter-comments'];
    filterInputs.forEach(id => {
      const elem = document.getElementById(id);
      if (elem) {
        elem.addEventListener('change', () => {
          const parentId = document.getElementById('parent-project-id').value;
          if (parentId) {
            this.updateFilteredItemCount(parseInt(parentId));
          }
        });
      }
    });

    // IPC listeners
    if (window.api.on) {
      window.api.on('ai:progress', (data) => this.onProgress(data));
      window.api.on('ai:item-rated', (data) => this.onItemRated(data));
      window.api.on('ai:complete', (data) => this.onComplete(data));
      window.api.on('ai:error', (data) => this.onError(data));
    }
  }

  async loadCollections() {
    try {
      // Load both regular collections and merged collections
      const [collectionsResult, mergesResult] = await Promise.all([
        window.api.database.getCollections(),
        window.api.database.getAllMerges()
      ]);

      this.collections = [];

      // Add regular collections
      if (collectionsResult.success && collectionsResult.data) {
        collectionsResult.data.forEach(c => {
          this.collections.push({
            ...c,
            isMerge: false
          });
        });
      }

      // Add merged collections
      if (mergesResult && Array.isArray(mergesResult)) {
        mergesResult.forEach(merge => {
          // Calculate total video/comment counts from source collections
          let videoCount = 0;
          let commentCount = 0;
          if (merge.source_collections) {
            merge.source_collections.forEach(sc => {
              videoCount += sc.video_count || 0;
              commentCount += sc.comment_count || 0;
            });
          }

          this.collections.push({
            id: merge.id,
            search_term: merge.name,
            name: merge.name,
            created_at: merge.created_at,
            video_count: videoCount,
            comment_count: commentCount,
            isMerge: true,
            mergeData: merge
          });
        });
      }

      // Sort by created_at descending (newest first)
      this.collections.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    } catch (error) {
      console.error('Error loading collections:', error);
    }
  }

  async loadAllProjects() {
    try {
      // For now, get projects from all collections
      // TODO: Add a getAll method to the database
      this.allProjects = [];
      
      for (const collection of this.collections) {
        const result = await window.api.ai.getRatingProjects({ collectionId: collection.id });
        if (result.success && result.data) {
          // Attach collection info to each project
          const projectsWithCollection = result.data.map(p => ({
            ...p,
            collection_name: collection.search_term || collection.name
          }));
          this.allProjects.push(...projectsWithCollection);
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  showCreateModal() {
    const modal = document.getElementById('create-project-modal');
    if (modal) modal.style.display = 'flex';
  }

  hideCreateModal() {
    const modal = document.getElementById('create-project-modal');
    if (modal) modal.style.display = 'none';
    // Reset hierarchical project fields
    this.resetCreateModalHierarchical();
  }

  hideDetailsModal() {
    const modal = document.getElementById('project-details-modal');
    if (modal) modal.style.display = 'none';
  }

  // =======================================================================
  // HIERARCHICAL RATING PROJECTS
  // =======================================================================

  async openChildProjectModal() {
    const currentProject = this.currentViewerProject;
    if (!currentProject) {
      console.error('[Hierarchical] No current project to create child from');
      return;
    }

    console.log('[Hierarchical] Opening child project modal for project:', currentProject.id);

    // Show parent project info
    document.getElementById('parent-project-info').style.display = 'block';
    document.getElementById('parent-project-name-display').textContent = currentProject.project_name;
    document.getElementById('parent-project-id').value = currentProject.id;

    // Show filter criteria section
    document.getElementById('filter-criteria-section').style.display = 'block';

    // Pre-fill collection (same as parent)
    document.getElementById('ai-collection-select').value = currentProject.collection_id;
    document.getElementById('ai-collection-select').disabled = true;
    // FIX: Set currentCollection so startRating() doesn't fail
    this.currentCollection = currentProject.collection_id;

    // Set default filters
    document.getElementById('filter-min-score').value = 0.7;
    document.getElementById('filter-max-score').value = 1.0;
    document.getElementById('filter-video-chunks').checked = true;
    document.getElementById('filter-comments').checked = true;

    // Hide redundant content type checkboxes (filter controls them)
    const rateChunksCheckbox = document.getElementById('rate-chunks');
    const contentTypeSection = rateChunksCheckbox ? rateChunksCheckbox.closest('.form-group') : null;
    if (contentTypeSection) {
      contentTypeSection.style.display = 'none';
    }

    // Calculate filtered count
    await this.updateFilteredItemCount(currentProject.id);

    // Open modal
    document.getElementById('create-project-modal').style.display = 'flex';
  }

  async updateFilteredItemCount(parentProjectId) {
    try {
      const minScore = parseFloat(document.getElementById('filter-min-score').value) || 0.0;
      const maxScore = parseFloat(document.getElementById('filter-max-score').value) || 1.0;
      const contentTypes = [];

      if (document.getElementById('filter-video-chunks').checked) {
        contentTypes.push('video_chunk');
      }
      if (document.getElementById('filter-comments').checked) {
        contentTypes.push('comment');
      }

      if (contentTypes.length === 0) {
        document.getElementById('filtered-items-count').textContent = '0 items (select at least one content type)';
        return;
      }

      const filterCriteria = {
        min_score: minScore,
        max_score: maxScore,
        content_types: contentTypes
      };

      console.log('[Hierarchical] Fetching filtered count for parent:', parentProjectId, filterCriteria);

      const result = await window.api.ai.getFilteredItemCount({ parentProjectId, filterCriteria });

      if (result.success) {
        const count = result.data.count;
        document.getElementById('filtered-items-count').textContent = `${count} item${count !== 1 ? 's' : ''}`;
        console.log('[Hierarchical] Filtered count:', count);
      } else {
        document.getElementById('filtered-items-count').textContent = 'error';
        console.error('[Hierarchical] Error getting filtered count:', result.error);
      }
    } catch (error) {
      document.getElementById('filtered-items-count').textContent = 'error';
      console.error('[Hierarchical] Error updating filtered count:', error);
    }
  }

  async displayProjectLineage(projectId) {
    try {
      const result = await window.api.ai.getProjectLineage({ projectId });

      if (!result.success || !result.data || result.data.length === 0) {
        document.getElementById('project-lineage').style.display = 'none';
        return;
      }

      const lineage = result.data;

      if (lineage.length <= 1) {
        // Root project, no lineage to show
        document.getElementById('project-lineage').style.display = 'none';
        return;
      }

      console.log('[Hierarchical] Displaying lineage for project:', projectId, lineage);

      // Build breadcrumb HTML
      const breadcrumbsHtml = lineage.map((project, index) => {
        const isLast = index === lineage.length - 1;
        const arrow = isLast ? '' : ' <span class="breadcrumb-arrow">→</span> ';

        return `
          <span class="breadcrumb-item ${isLast ? 'current' : ''}" data-project-id="${project.id}">
            ${project.project_name}
          </span>${arrow}
        `;
      }).join('');

      const lineageDiv = document.getElementById('project-lineage');
      lineageDiv.innerHTML = breadcrumbsHtml;
      lineageDiv.style.display = 'flex';

      // Make breadcrumbs clickable (navigate to parent projects)
      lineageDiv.querySelectorAll('.breadcrumb-item:not(.current)').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
          const projectId = parseInt(item.dataset.projectId);
          this.showProjectDetails(projectId);
        });
      });
    } catch (error) {
      console.error('[Hierarchical] Error displaying lineage:', error);
      document.getElementById('project-lineage').style.display = 'none';
    }
  }

  resetCreateModalHierarchical() {
    // Hide parent project sections
    document.getElementById('parent-project-info').style.display = 'none';
    document.getElementById('filter-criteria-section').style.display = 'none';
    document.getElementById('parent-project-id').value = '';

    // Re-enable collection select
    document.getElementById('ai-collection-select').disabled = false;

    // Show content type checkboxes again (for root projects)
    const rateChunksCheckbox = document.getElementById('rate-chunks');
    const contentTypeSection = rateChunksCheckbox ? rateChunksCheckbox.closest('.form-group') : null;
    if (contentTypeSection) {
      contentTypeSection.style.display = 'block';
    }

    // Reset filters to defaults
    document.getElementById('filter-min-score').value = 0.7;
    document.getElementById('filter-max-score').value = 1.0;
    document.getElementById('filter-video-chunks').checked = true;
    document.getElementById('filter-comments').checked = true;
  }

  updateStatsBar() {
    const totalProjects = this.allProjects.length;
    const totalRated = this.allProjects.reduce((sum, p) => sum + (p.rated_items || 0), 0);
    
    let avgSuccessRate = 0;
    if (this.allProjects.length > 0) {
      const completedProjects = this.allProjects.filter(p => p.total_items > 0);
      if (completedProjects.length > 0) {
        const totalSuccess = completedProjects.reduce((sum, p) => {
          const success = p.rated_items - (p.failed_items || 0);
          return sum + (success / p.total_items);
        }, 0);
        avgSuccessRate = (totalSuccess / completedProjects.length) * 100;
      }
    }

    const totalEl = document.getElementById('totalProjects');
    const ratedEl = document.getElementById('totalRated');
    const successEl = document.getElementById('avgSuccessRate');

    if (totalEl) totalEl.textContent = totalProjects;
    if (ratedEl) ratedEl.textContent = totalRated.toLocaleString();
    if (successEl) successEl.textContent = avgSuccessRate.toFixed(0) + '%';
  }

  renderProjectsGallery() {
    const gallery = document.getElementById('rating-projects-gallery');
    if (!gallery) return;

    if (this.allProjects.length === 0) {
      gallery.innerHTML = `
        <div class="empty-state">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <p>No rating projects yet</p>
          <button class="btn btn-primary" onclick="window.aiController.showCreateModal()">
            Create Your First Project
          </button>
        </div>
      `;
      return;
    }

    gallery.innerHTML = this.allProjects.map(project => this.createProjectCard(project)).join('');

    // Attach click handlers
    this.allProjects.forEach(project => {
      const card = gallery.querySelector(`[data-project-id="${project.id}"]`);
      if (card) {
        card.addEventListener('click', (e) => {
          // Don't open modal if clicking a button
          if (!e.target.closest('button')) {
            this.showProjectDetails(project.id);
          }
        });
      }
    });
  }

  createProjectCard(project) {
    const progress = project.total_items > 0 
      ? ((project.rated_items / project.total_items) * 100) 
      : 0;
    
    const successCount = project.rated_items - (project.failed_items || 0);
    const successRate = project.rated_items > 0 
      ? ((successCount / project.rated_items) * 100) 
      : 0;

    // Determine status
    let status = 'pending';
    let statusLabel = 'Pending';
    
    if (project.status === 'in_progress') {
      status = 'in_progress';
      statusLabel = 'In Progress';
    } else if (project.completed_at) {
      status = 'completed';
      statusLabel = 'Completed';
    } else if (project.rated_items > 0 && project.rated_items < project.total_items) {
      status = 'partial';
      statusLabel = 'Partial';
    } else if (project.failed_items > 0) {
      status = 'failed';
      statusLabel = 'Has Failures';
    }

    const date = new Date(project.created_at).toLocaleDateString();
    
    // Calculate circle progress
    const radius = 31.83;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return `
      <div class="rating-project-card" data-project-id="${project.id}">
        <div class="project-card-header">
          <h3 class="project-card-title">${this.escapeHtml(project.project_name)}</h3>
          <span class="project-status-badge status-${status}">${statusLabel}</span>
        </div>
        
        <div class="project-card-meta">
          <span>📁 ${this.escapeHtml(project.collection_name || 'Unknown')}</span>
          <span>🕐 ${date}</span>
        </div>

        <div class="project-progress">
          <div class="progress-ring-container">
            <svg class="progress-ring" viewBox="0 0 70 70">
              <circle class="progress-ring-circle progress-ring-bg" cx="35" cy="35" r="${radius}"></circle>
              <circle class="progress-ring-circle progress-ring-fill" cx="35" cy="35" r="${radius}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"></circle>
            </svg>
            <div class="progress-text">${progress.toFixed(0)}%</div>
          </div>
          
          <div class="progress-stats">
            <div class="progress-stat">
              <span class="progress-stat-label">✅ Success</span>
              <span class="progress-stat-value success">${successCount} (${successRate.toFixed(0)}%)</span>
            </div>
            <div class="progress-stat">
              <span class="progress-stat-label">❌ Failed</span>
              <span class="progress-stat-value failed">${project.failed_items || 0} (${(100 - successRate).toFixed(0)}%)</span>
            </div>
          </div>
        </div>

        <div class="project-card-preview">
          ${this.escapeHtml(project.research_intent.substring(0, 150))}${project.research_intent.length > 150 ? '...' : ''}
        </div>

        <div class="project-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.aiController.showProjectDetails(${project.id})">
            View Details
          </button>
          ${(project.status === 'paused' || project.status === 'in_progress') && project.rated_items < project.total_items ? `
            <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); window.aiController.resumeProject(${project.id})">
              ▶ Resume
            </button>
          ` : ''}
          ${project.failed_items > 0 ? `
            <button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); window.aiController.resumeProject(${project.id})">
              🔄 Retry Failed (${project.failed_items})
            </button>
          ` : ''}
          ${project.completed_at ? `
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.aiController.exportProject(${project.id})">
              Export
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  filterProjects() {
    const searchInput = document.getElementById('project-search');
    const filterSelect = document.getElementById('project-filter-status');
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const statusFilter = filterSelect ? filterSelect.value : 'all';

    const gallery = document.getElementById('rating-projects-gallery');
    if (!gallery) return;

    const cards = gallery.querySelectorAll('.rating-project-card');
    cards.forEach(card => {
      const projectId = parseInt(card.dataset.projectId);
      const project = this.allProjects.find(p => p.id === projectId);
      
      if (!project) {
        card.style.display = 'none';
        return;
      }

      // Search filter
      const matchesSearch = !searchTerm || 
        project.project_name.toLowerCase().includes(searchTerm) ||
        project.research_intent.toLowerCase().includes(searchTerm) ||
        (project.collection_name && project.collection_name.toLowerCase().includes(searchTerm));

      // Status filter
      let projectStatus = 'pending';
      if (project.status === 'in_progress') projectStatus = 'in_progress';
      else if (project.completed_at) projectStatus = 'completed';
      else if (project.rated_items > 0) projectStatus = 'partial';

      const matchesStatus = statusFilter === 'all' || projectStatus === statusFilter;

      card.style.display = (matchesSearch && matchesStatus) ? 'block' : 'none';
    });
  }

  async showProjectDetails(projectId) {
    const project = this.allProjects.find(p => p.id === projectId);
    if (!project) return;

    // Load ratings from database
    const ratingsResult = await window.api.ai.getRatingsForProject({ projectId });
    if (!ratingsResult.success) {
      showNotification('Failed to load ratings', 'error');
      return;
    }

    this.currentViewerProject = {
      ...project,
      ratings: ratingsResult.data || []
    };

    // Show viewer
    const viewer = document.getElementById('rating-project-viewer');
    if (viewer) {
      viewer.style.display = 'flex';
      this.populateViewer();
    }
  }

  populateViewer() {
    const project = this.currentViewerProject;
    if (!project) return;

    // Display lineage breadcrumbs for hierarchical projects
    this.displayProjectLineage(project.id);

    // Header
    document.getElementById('rating-viewer-title').textContent = project.project_name;

    // Stats
    const successfulRatings = project.ratings.filter(r => r.status === 'success');
    const failedRatings = project.ratings.filter(r => r.status === 'failed');
    const avgScore = successfulRatings.length > 0 
      ? successfulRatings.reduce((sum, r) => sum + (r.relevance_score || 0), 0) / successfulRatings.length 
      : 0;
    const successRate = project.total_items > 0 
      ? ((successfulRatings.length / project.total_items) * 100) 
      : 0;

    document.getElementById('viewer-total').textContent = project.rated_items || 0;
    document.getElementById('viewer-success-rate').textContent = successRate.toFixed(0) + '%';
    document.getElementById('viewer-avg-score').textContent = avgScore.toFixed(2);
    document.getElementById('viewer-failed').textContent = failedRatings.length;

    // Show/hide retry button
    const retryBtn = document.getElementById('retry-failed-btn');
    if (retryBtn) {
      retryBtn.style.display = failedRatings.length > 0 ? 'inline-flex' : 'none';
    }

    // Populate tabs
    this.populateOverviewTab();
    this.populateRatingsTab();
    this.populateFailedTab();
  }

  populateOverviewTab() {
    const project = this.currentViewerProject;

    // Research intent
    document.getElementById('viewer-research-intent').textContent = project.research_intent;

    // Score distribution
    const successfulRatings = project.ratings.filter(r => r.status === 'success' && r.relevance_score != null);
    const scoreRanges = {
      'High (>0.7)': successfulRatings.filter(r => r.relevance_score > 0.7).length,
      'Medium (0.4-0.7)': successfulRatings.filter(r => r.relevance_score >= 0.4 && r.relevance_score <= 0.7).length,
      'Low (<0.4)': successfulRatings.filter(r => r.relevance_score < 0.4).length
    };

    const distributionHtml = Object.entries(scoreRanges).map(([label, count]) => {
      const percentage = successfulRatings.length > 0 ? (count / successfulRatings.length) * 100 : 0;
      return `
        <div class="distribution-bar">
          <span class="distribution-label">${label}</span>
          <div class="distribution-bar-bg">
            <div class="distribution-bar-fill" style="width: ${percentage}%">${percentage.toFixed(0)}%</div>
          </div>
          <span class="distribution-count">${count} items</span>
        </div>
      `;
    }).join('');

    document.getElementById('viewer-distribution').innerHTML = distributionHtml;

    // Content type breakdown
    const chunkCount = project.ratings.filter(r => r.item_type === 'video_chunk').length;
    const commentCount = project.ratings.filter(r => r.item_type === 'comment').length;

    document.getElementById('viewer-type-breakdown').innerHTML = `
      <div class="type-card">
        <div class="type-card-icon">🎬</div>
        <div class="type-card-count">${chunkCount}</div>
        <div class="type-card-label">Video Chunks</div>
      </div>
      <div class="type-card">
        <div class="type-card-icon">💬</div>
        <div class="type-card-count">${commentCount}</div>
        <div class="type-card-label">Comments</div>
      </div>
    `;
  }

  populateRatingsTab() {
    this.currentRatingsFilter = { search: '', score: 'all', type: 'all' };
    this.renderRatingsList();
  }

  renderRatingsList() {
    const project = this.currentViewerProject;
    const successfulRatings = project.ratings.filter(r => r.status === 'success');

    // Apply filters
    let filtered = successfulRatings.filter(r => {
      const filter = this.currentRatingsFilter;
      
      // Search filter
      if (filter.search && !r.reasoning?.toLowerCase().includes(filter.search.toLowerCase())) {
        return false;
      }
      
      // Score filter
      if (filter.score === 'high' && (r.relevance_score || 0) <= 0.7) return false;
      if (filter.score === 'medium' && ((r.relevance_score || 0) < 0.4 || (r.relevance_score || 0) > 0.7)) return false;
      if (filter.score === 'low' && (r.relevance_score || 0) >= 0.4) return false;
      
      // Type filter
      if (filter.type !== 'all' && r.item_type !== filter.type) return false;
      
      return true;
    });

    const ratingsHtml = filtered.map(rating => this.createRatingCard(rating)).join('');
    
    const ratingsList = document.getElementById('ratings-list');
    if (ratingsHtml) {
      ratingsList.innerHTML = ratingsHtml;
    } else {
      ratingsList.innerHTML = '<div class="empty-state"><p>No ratings match your filters</p></div>';
    }
  }

  createRatingCard(rating) {
    const score = rating.relevance_score || 0;
    const scoreClass = score > 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
    const typeIcon = rating.item_type === 'video_chunk' ? '🎬' : '💬';
    const typeLabel = rating.item_type === 'video_chunk' ? 'Video Chunk' : 'Comment';

    // Get actual content based on item type
    let content = '';
    let contentMeta = '';
    
    if (rating.item_type === 'comment') {
      content = rating.comment_text || 'Comment text not available';
      if (rating.comment_author) {
        contentMeta = `<div style="opacity: 0.7; font-size: 0.85em; margin-top: 4px;">👤 ${this.escapeHtml(rating.comment_author)}${rating.comment_likes ? ` • 👍 ${rating.comment_likes}` : ''}</div>`;
      }
    } else if (rating.item_type === 'video_chunk') {
      content = rating.chunk_text || 'Transcript not available';
      if (rating.chunk_start !== undefined && rating.chunk_end !== undefined) {
        const formatTime = (sec) => {
          const mins = Math.floor(sec / 60);
          const secs = Math.floor(sec % 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        contentMeta = `<div style="opacity: 0.7; font-size: 0.85em; margin-top: 4px;">⏱️ ${formatTime(rating.chunk_start)} - ${formatTime(rating.chunk_end)}</div>`;
      }
    }
    
    if (rating.video_title) {
      contentMeta += `<div style="opacity: 0.6; font-size: 0.8em; margin-top: 2px;">📺 ${this.escapeHtml(rating.video_title)}</div>`;
    }

    // Add video preview button for video chunks
    let videoPreviewButton = '';
    if (rating.item_type === 'video_chunk' && rating.chunk_file_path) {
      const ratingId = rating.id || rating.item_id;
      videoPreviewButton = `
        <div class="rating-item-actions" style="margin-top: 8px;">
          <button class="btn btn-sm btn-primary" onclick="window.aiController.showVideoModal('${ratingId}')" style="padding: 4px 12px; font-size: 0.85em;">
            ▶️ Play Video Chunk
          </button>
        </div>
      `;
    }

    return `
      <div class="rating-item-card" data-rating-id="${rating.id || rating.item_id}" data-file-path="${this.escapeHtml(rating.chunk_file_path || '')}" data-start="${rating.chunk_start || 0}" data-end="${rating.chunk_end || 0}">
        <div class="rating-item-header">
          <span class="rating-item-type">${typeIcon} ${typeLabel}</span>
          <span class="rating-item-score-badge ${scoreClass}">${score.toFixed(2)}</span>
        </div>
        <div class="rating-item-content">
          ${this.escapeHtml(content.substring(0, 300))}${content.length > 300 ? '...' : ''}
          ${contentMeta}
        </div>
        <div class="rating-item-id" style="opacity: 0.5; font-size: 0.75em; font-family: monospace; margin-top: 4px;">
          ID: ${rating.item_id}
        </div>
        <div class="rating-item-reasoning">
          ${this.escapeHtml(rating.reasoning || 'No reasoning provided')}
        </div>
        <div class="rating-item-meta">
          <span>💯 Confidence: ${((rating.confidence || 0) * 100).toFixed(0)}%</span>
          <span>📅 ${new Date(rating.created_at).toLocaleString()}</span>
        </div>
        ${videoPreviewButton}
      </div>
    `;
  }

  populateFailedTab() {
    const project = this.currentViewerProject;
    const failedRatings = project.ratings.filter(r => r.status === 'failed');

    if (failedRatings.length === 0) {
      document.getElementById('failed-items-list').innerHTML = '<div class="empty-state"><p>🎉 No failed items!</p></div>';
      return;
    }

    const failedHtml = failedRatings.map(rating => {
      // Get actual content
      let content = '';
      if (rating.item_type === 'comment') {
        content = rating.comment_text || rating.item_id;
      } else if (rating.item_type === 'video_chunk') {
        content = rating.chunk_text || rating.item_id;
      }
      
      return `
        <div class="failed-item-card">
          <div class="rating-item-header">
            <span class="rating-item-type">${rating.item_type === 'video_chunk' ? '🎬 Video Chunk' : '💬 Comment'}</span>
            <span style="color: var(--danger); font-weight: 600;">Retry Count: ${rating.retry_count || 0}</span>
          </div>
          <div class="rating-item-content">
            ${this.escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}
          </div>
          <div class="rating-item-id" style="opacity: 0.5; font-size: 0.75em; font-family: monospace; margin-top: 4px;">
            ID: ${rating.item_id}
          </div>
          <div class="failed-item-error">
            ${this.escapeHtml(rating.error_message || 'Unknown error')}
          </div>
          <div class="failed-item-actions">
            <button class="btn btn-primary btn-sm" onclick="window.aiController.retryFailedItem('${rating.item_id}')">
              🔄 Retry This Item
            </button>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('failed-items-list').innerHTML = failedHtml;
  }

  switchViewerTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.rating-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.rating-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
  }

  closeViewer() {
    const viewer = document.getElementById('rating-project-viewer');
    if (viewer) viewer.style.display = 'none';
    this.currentViewerProject = null;
  }

  showVideoModal(ratingId) {
    // Find the rating card by ID
    const card = document.querySelector(`[data-rating-id="${ratingId}"]`);
    if (!card) {
      showNotification('Video not found', 'error');
      return;
    }

    const filePath = card.dataset.filePath;
    const startTime = parseFloat(card.dataset.start) || 0;
    const endTime = parseFloat(card.dataset.end) || 0;

    if (!filePath) {
      showNotification('Video file path not available', 'error');
      return;
    }

    // Find full rating data
    const rating = this.currentViewerProject?.ratings.find(r => 
      (r.id && r.id.toString() === ratingId) || r.item_id === ratingId
    );

    this.openVideoPlayer(filePath, startTime, endTime, rating);
  }

  openVideoPlayer(filePath, startTime, endTime, rating) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.innerHTML = `
      <div class="video-modal-content">
        <div class="video-modal-header">
          <h3>▶️ Video Chunk Preview</h3>
          <button class="close-btn" onclick="this.closest('.video-modal').remove()">×</button>
        </div>
        <div class="video-modal-body">
          <video id="chunk-video-player" controls autoplay style="width: 100%; max-height: 60vh; background: #000;">
            <source src="file://${filePath}" type="video/mp4">
            Your browser does not support video playback.
          </video>
          <div class="video-modal-info">
            <div class="video-info-row">
              <span class="video-info-label">⏱️ Time Range:</span>
              <span>${this.formatTime(startTime)} - ${this.formatTime(endTime)} (${(endTime - startTime).toFixed(1)}s)</span>
            </div>
            ${rating ? `
              <div class="video-info-row">
                <span class="video-info-label">📺 Video:</span>
                <span>${this.escapeHtml(rating.video_title || 'Unknown')}</span>
              </div>
              <div class="video-info-row">
                <span class="video-info-label">📊 Relevance Score:</span>
                <span style="color: ${rating.relevance_score > 0.7 ? 'var(--success)' : rating.relevance_score >= 0.4 ? 'var(--warning)' : 'var(--danger)'};">
                  ${(rating.relevance_score || 0).toFixed(2)}
                </span>
              </div>
              <div class="video-info-row">
                <span class="video-info-label">💭 AI Reasoning:</span>
                <span style="font-style: italic; opacity: 0.9;">${this.escapeHtml(rating.reasoning || 'N/A')}</span>
              </div>
              <div class="video-info-row">
                <span class="video-info-label">📝 Transcript:</span>
                <span>${this.escapeHtml(rating.chunk_text || 'No transcript')}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Add to document
    document.body.appendChild(modal);

    // Auto-close when video ends (approximately)
    const video = document.getElementById('chunk-video-player');
    if (video && endTime > startTime) {
      // Set up loop or stop at end time
      video.addEventListener('timeupdate', () => {
        if (video.currentTime >= (endTime - startTime)) {
          video.pause();
        }
      });
    }

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async retryFailedItem(itemId) {
    showNotification('Retry functionality coming soon!', 'info');
    // TODO: Implement retry logic
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async resumeProject(projectId) {
    try {
      // Get the project details
      const project = await window.api.ai.getRatingProject({ projectId });
      if (!project.success || !project.data) {
        showNotification('Failed to load project', 'error');
        return;
      }

      const proj = project.data;
      const settings = typeof proj.settings === 'string' ? JSON.parse(proj.settings) : proj.settings;

      // Resume by calling startRating with the existing config
      const config = {
        collectionId: proj.merge_id ? `merge:${proj.merge_id}` : proj.collection_id,
        projectId: proj.id,  // Pass projectId to skip already-rated items
        projectName: proj.project_name,
        researchIntent: proj.research_intent,
        ratingScale: proj.rating_scale,
        includeChunks: settings.includeChunks || false,
        includeComments: settings.includeComments || false,
        includePDFs: settings.includePDFs || false,
        batchSize: settings.batchSize || 50,
        concurrentRequests: settings.concurrentRequests || 5,
        retryDelay: settings.retryDelay || 2,
        includeConfidence: settings.includeConfidence !== false,
        parentProjectId: proj.parent_project_id || null,
        filterCriteria: proj.filter_criteria ? (typeof proj.filter_criteria === 'string' ? JSON.parse(proj.filter_criteria) : proj.filter_criteria) : null
      };

      const result = await window.api.ai.startRating(config);

      if (result.success) {
        this.ratingInProgress = true;
        const progressSection = document.getElementById('rating-progress-section');
        if (progressSection) progressSection.style.display = 'block';

        const projectNameSpan = document.getElementById('progress-project-name');
        if (projectNameSpan) projectNameSpan.textContent = proj.project_name;

        showNotification(`Resumed: ${proj.project_name}`, 'success');

        // Close modal and refresh projects list
        document.getElementById('create-project-modal').style.display = 'none';
        this.loadRatingProjects();
      } else {
        showNotification(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error resuming project:', error);
      showNotification(`Error resuming: ${error.message}`, 'error');
    }
  }

  async exportProject(projectId) {
    console.log('Export project:', projectId);
    // TODO: Implement export functionality
    alert('Export functionality coming soon!');
  }

  async populateCollectionDropdown() {
    const select = document.getElementById('ai-collection-select');
    if (!select) return;

    try {
      // Load both regular and merged collections
      const [collectionsResult, mergesResult] = await Promise.all([
        window.api.database.getCollections(),
        window.api.database.getAllMerges()
      ]);

      select.innerHTML = '<option value="">Choose a collection...</option>';

      // Add regular collections
      if (collectionsResult.success && collectionsResult.data) {
        collectionsResult.data.forEach(col => {
          const option = document.createElement('option');
          option.value = col.id;
          option.dataset.isMerge = 'false';
          const collectionName = col.search_term || col.name || 'Unnamed Collection';
          option.textContent = `${collectionName} (${new Date(col.created_at).toLocaleDateString()})`;
          select.appendChild(option);
        });
      }

      // Add merged collections
      if (mergesResult && Array.isArray(mergesResult)) {
        mergesResult.forEach(merge => {
          const option = document.createElement('option');
          option.value = `merge:${merge.id}`;
          option.dataset.isMerge = 'true';
          option.dataset.mergeId = merge.id;
          const mergeName = merge.name || 'Unnamed Merge';
          option.textContent = `${mergeName} (${new Date(merge.created_at).toLocaleDateString()}) [MERGED]`;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  }

  async onCollectionSelected(collectionId) {
    if (!collectionId) return;

    // Check if this is a merged collection
    if (collectionId.startsWith('merge:')) {
      // Keep as string for merged collections
      this.currentCollection = collectionId;
      this.isMergedCollection = true;
    } else {
      // Parse as integer for regular collections
      this.currentCollection = parseInt(collectionId);
      this.isMergedCollection = false;
    }

    // Get item counts
    try {
      const result = await window.api.ai.getItemCounts({ collectionId: this.currentCollection });
      console.log('[Rating UI] Item counts result:', result);

      if (result.success) {
        const chunksCount = document.getElementById('chunks-count');
        const commentsCount = document.getElementById('comments-count');
        const pdfsCount = document.getElementById('pdfs-count');

        if (chunksCount) chunksCount.textContent = `(${result.data.chunks} items)`;
        if (commentsCount) commentsCount.textContent = `(${result.data.comments} items)`;
        if (pdfsCount) pdfsCount.textContent = `(${result.data.pdfs || 0} items)`;

        console.log('[Rating UI] Updated counts - chunks:', result.data.chunks, 'comments:', result.data.comments, 'pdfs:', result.data.pdfs);

        this.updateEstimate();
      }
    } catch (error) {
      console.error('Error getting item counts:', error);
    }

    // Load existing projects
    this.loadRatingProjects();
  }

  async loadAllProjects() {
    try {
      console.log('[AI] Loading all rating projects...');
      const result = await window.api.ai.getAllRatingProjects();
      console.log('[AI] getAllRatingProjects result:', result);
      if (result.success) {
        console.log('[AI] Found', result.data.length, 'projects');
        this.allProjects = result.data;  // Store in the instance variable
        this.updateStatsBar();           // Update the stats bar
        this.renderProjectsGallery();    // Render the gallery
      } else {
        console.error('[AI] Failed to load projects:', result.error);
      }
    } catch (error) {
      console.error('Error loading all projects:', error);
    }
  }

  async loadRatingProjects() {
    if (!this.currentCollection) return;

    try {
      // Pass the current collection (which might be "merge:2" format)
      const result = await window.api.ai.getRatingProjects({
        collectionId: this.currentCollection
      });

      if (result.success) {
        this.renderProjectsList(result.data);
      }
    } catch (error) {
      console.error('Error loading rating projects:', error);
    }
  }

  renderProjectsList(projects) {
    const container = document.getElementById('rating-projects-list');
    if (!container) return;
    
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No rating projects yet. Create one above to get started!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = projects.map(project => `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-header">
          <h4>${project.project_name}</h4>
          <span class="status-badge status-${project.status}">${project.status}</span>
        </div>
        <div class="project-body">
          <p><strong>Intent:</strong> ${project.research_intent}</p>
          <p><strong>Scale:</strong> ${project.rating_scale}</p>
          <p><strong>Progress:</strong> ${project.rated_items || 0} / ${project.total_items || 0}</p>
        </div>
        <div class="project-actions">
          <button class="btn btn-secondary" onclick="aiController.exportRatings(${project.id})">
            Export
          </button>
        </div>
      </div>
    `).join('');
  }

  updateEstimate() {
    const includeChunks = document.getElementById('rate-chunks')?.checked || false;
    const includeComments = document.getElementById('rate-comments')?.checked || false;
    const includePDFs = document.getElementById('rate-pdfs')?.checked || false;

    const chunksText = document.getElementById('chunks-count')?.textContent || '(0 items)';
    const commentsText = document.getElementById('comments-count')?.textContent || '(0 items)';
    const pdfsText = document.getElementById('pdfs-count')?.textContent || '(0 items)';

    const chunksCount = parseInt(chunksText.match(/\d+/)?.[0] || 0);
    const commentsCount = parseInt(commentsText.match(/\d+/)?.[0] || 0);
    const pdfsCount = parseInt(pdfsText.match(/\d+/)?.[0] || 0);

    const totalItems = (includeChunks ? chunksCount : 0) +
                      (includeComments ? commentsCount : 0) +
                      (includePDFs ? pdfsCount : 0);
    const cost = totalItems * 0.00015;
    
    const itemsEstimate = document.getElementById('items-estimate');
    const costEstimate = document.getElementById('cost-estimate');
    
    if (itemsEstimate) itemsEstimate.textContent = `${totalItems} items`;
    if (costEstimate) costEstimate.textContent = `$${cost.toFixed(4)}`;
  }

  async startRating() {
    const projectName = document.getElementById('project-name')?.value;
    const researchIntent = document.getElementById('research-intent')?.value;
    const ratingScale = document.querySelector('input[name="rating-scale"]:checked')?.value;
    const batchSize = parseInt(document.getElementById('batch-size')?.value || '50');
    const concurrentRequests = parseInt(document.getElementById('concurrent-requests')?.value || '5');
    const retryDelay = parseFloat(document.getElementById('retry-delay')?.value || '2');
    const includeConfidence = document.getElementById('include-confidence')?.checked || true;

    if (!projectName || !researchIntent) {
      showNotification('Please fill in project name and research intent', 'error');
      return;
    }

    if (!this.currentCollection) {
      showNotification('Please select a collection first', 'error');
      return;
    }

    // Check if this is a child project
    const parentProjectId = document.getElementById('parent-project-id')?.value;
    let filterCriteria = null;
    let includeChunks, includeComments, includePDFs;

    if (parentProjectId) {
      // This is a CHILD PROJECT - collect filter criteria
      const minScore = parseFloat(document.getElementById('filter-min-score')?.value) || 0.0;
      const maxScore = parseFloat(document.getElementById('filter-max-score')?.value) || 1.0;
      const contentTypes = [];

      if (document.getElementById('filter-video-chunks')?.checked) {
        contentTypes.push('video_chunk');
      }
      if (document.getElementById('filter-comments')?.checked) {
        contentTypes.push('comment');
      }
      if (document.getElementById('filter-pdfs')?.checked) {
        contentTypes.push('pdf_excerpt');
      }

      filterCriteria = {
        min_score: minScore,
        max_score: maxScore,
        content_types: contentTypes
      };

      // For child projects, content types come from filter checkboxes
      includeChunks = document.getElementById('filter-video-chunks')?.checked || false;
      includeComments = document.getElementById('filter-comments')?.checked || false;
      includePDFs = document.getElementById('filter-pdfs')?.checked || false;

      console.log('[Hierarchical] Creating child project with filter:', filterCriteria);
    } else {
      // For root projects, content types come from regular checkboxes
      includeChunks = document.getElementById('rate-chunks')?.checked || false;
      includeComments = document.getElementById('rate-comments')?.checked || false;
      includePDFs = document.getElementById('rate-pdfs')?.checked || false;

      console.log('[Rating] Content types selected - chunks:', includeChunks, 'comments:', includeComments, 'pdfs:', includePDFs);
    }

    if (!includeChunks && !includeComments && !includePDFs) {
      showNotification('Please select at least one content type to rate', 'error');
      return;
    }

    const config = {
      collectionId: this.currentCollection,
      projectName,
      researchIntent,
      ratingScale,
      includeChunks,
      includeComments,
      includePDFs,
      batchSize,
      concurrentRequests,
      retryDelay,
      includeConfidence,
      parentProjectId: parentProjectId ? parseInt(parentProjectId) : null,  // NEW
      filterCriteria: filterCriteria  // NEW
    };
    
    try {
      const result = await window.api.ai.startRating(config);
      
      if (result.success) {
        this.ratingInProgress = true;
        const progressSection = document.getElementById('rating-progress-section');
        if (progressSection) progressSection.style.display = 'block';
        
        const projectNameSpan = document.getElementById('progress-project-name');
        if (projectNameSpan) projectNameSpan.textContent = projectName;
        
        showNotification('Rating started!', 'success');
      } else {
        showNotification(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      showNotification(`Error starting rating: ${error.message}`, 'error');
    }
  }

  async previewRating() {
    const projectName = document.getElementById('project-name')?.value;
    const researchIntent = document.getElementById('research-intent')?.value;
    const ratingScale = document.querySelector('input[name="rating-scale"]:checked')?.value;

    if (!projectName || !researchIntent) {
      showNotification('Please fill in project name and research intent', 'error');
      return;
    }

    if (!this.currentCollection) {
      showNotification('Please select a collection first', 'error');
      return;
    }

    // Check if this is a child project (same logic as startRating)
    const parentProjectId = document.getElementById('parent-project-id')?.value;
    let filterCriteria = null;
    let includeChunks, includeComments, includePDFs;

    if (parentProjectId) {
      // Child project - use filter checkboxes
      const minScore = parseFloat(document.getElementById('filter-min-score')?.value) || 0.0;
      const maxScore = parseFloat(document.getElementById('filter-max-score')?.value) || 1.0;
      const contentTypes = [];

      if (document.getElementById('filter-video-chunks')?.checked) {
        contentTypes.push('video_chunk');
      }
      if (document.getElementById('filter-comments')?.checked) {
        contentTypes.push('comment');
      }
      if (document.getElementById('filter-pdfs')?.checked) {
        contentTypes.push('pdf_excerpt');
      }

      filterCriteria = {
        min_score: minScore,
        max_score: maxScore,
        content_types: contentTypes
      };

      includeChunks = document.getElementById('filter-video-chunks')?.checked || false;
      includeComments = document.getElementById('filter-comments')?.checked || false;
      includePDFs = document.getElementById('filter-pdfs')?.checked || false;
    } else {
      // Root project - use regular checkboxes
      includeChunks = document.getElementById('rate-chunks')?.checked || false;
      includeComments = document.getElementById('rate-comments')?.checked || false;
      includePDFs = document.getElementById('rate-pdfs')?.checked || false;
    }

    if (!includeChunks && !includeComments && !includePDFs) {
      showNotification('Please select at least one content type to rate', 'error');
      return;
    }

    const config = {
      collectionId: this.currentCollection,
      projectName,
      researchIntent,
      ratingScale,
      includeChunks,
      includeComments,
      includePDFs,
      parentProjectId: parentProjectId ? parseInt(parentProjectId) : null,
      filterCriteria: filterCriteria
    };
    
    // Show loading state
    const previewBtn = document.getElementById('preview-rating-btn');
    const originalText = previewBtn.textContent;
    previewBtn.disabled = true;
    previewBtn.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> Loading Preview...';
    
    showNotification('🔍 Previewing first 5 items...', 'info');
    
    try {
      const result = await window.api.ai.previewRating(config);
      
      if (result.success) {
        this.showPreviewModal(result.previews, result.totalItems, config);
      } else {
        showNotification(`Preview error: ${result.error}`, 'error');
      }
    } catch (error) {
      showNotification(`Preview failed: ${error.message}`, 'error');
    } finally {
      // Restore button
      previewBtn.disabled = false;
      previewBtn.textContent = originalText;
    }
  }

  showPreviewModal(previews, totalItems, config) {
    const typeCounts = {
      chunks: config.includeChunks ? '✅' : '❌',
      comments: config.includeComments ? '✅' : '❌'
    };
    
    const previewHtml = previews.map((p, idx) => {
      if (p.error) {
        return `
          <div class="preview-item preview-error">
            <div class="preview-header">
              <span class="preview-number">#${idx + 1}</span>
              <span class="preview-type">${p.item.type}</span>
              <span class="preview-score" style="color: var(--danger);">ERROR</span>
            </div>
            <div class="preview-content">${this.escapeHtml(p.item.content?.substring(0, 200) || 'N/A')}</div>
            <div class="preview-error-msg">${this.escapeHtml(p.error)}</div>
          </div>
        `;
      }
      
      const score = p.rating.relevance || 0;
      const scoreColor = score > 0.7 ? 'var(--success)' : score > 0.4 ? 'var(--warning)' : 'var(--danger)';
      
      return `
        <div class="preview-item">
          <div class="preview-header">
            <span class="preview-number">#${idx + 1}</span>
            <span class="preview-type">${p.item.type === 'video_chunk' ? '🎬 Video Chunk' : '💬 Comment'}</span>
            <span class="preview-score" style="color: ${scoreColor};">${score.toFixed(2)}</span>
          </div>
          <div class="preview-title">${this.escapeHtml(p.item.title || 'No title')}</div>
          <div class="preview-content">${this.escapeHtml(p.item.content?.substring(0, 200) || 'N/A')}...</div>
          <div class="preview-reasoning">${this.escapeHtml(p.rating.reasoning || 'No reasoning')}</div>
        </div>
      `;
    }).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content large">
        <div class="modal-header">
          <h3>🔍 Rating Preview</h3>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="preview-summary">
            <p><strong>Total items to rate:</strong> ${totalItems}</p>
            <p><strong>Content types:</strong> ${typeCounts.chunks} Video chunks · ${typeCounts.comments} Comments</p>
            <p><strong>Research intent:</strong> ${this.escapeHtml(config.researchIntent)}</p>
          </div>
          
          <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">Preview of First 5 Items:</h4>
          <div class="preview-items">
            ${previewHtml}
          </div>
          
          <div class="preview-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            <button class="btn btn-primary" onclick="this.closest('.modal').remove(); window.aiController.startRating()">
              Looks Good - Start Rating All ${totalItems} Items
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
  }

  async pauseRating() {
    try {
      await window.api.ai.pauseRating();
      showNotification('Rating paused', 'info');
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
    }
  }

  async cancelRating() {
    if (confirm('Are you sure you want to cancel this rating project?')) {
      try {
        await window.api.ai.cancelRating();
        this.ratingInProgress = false;
        const progressSection = document.getElementById('rating-progress-section');
        if (progressSection) progressSection.style.display = 'none';
        showNotification('Rating cancelled', 'info');
        
        // Refresh gallery
        await this.loadAllProjects();
        this.updateStatsBar();
        this.renderProjectsGallery();
      } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
      }
    }
  }

  minimizeProgress() {
    const progressSection = document.getElementById('rating-progress-section');
    if (progressSection) {
      progressSection.style.display = 'none';
      showNotification('Rating continues in background. Check back later!', 'info');
    }
  }

  onProgress(data) {
    console.log('[AIAnalysisController] Progress update:', data);
    const { current, total, percentage, remainingMs, elapsedMs } = data;
    
    const progressFill = document.getElementById('rating-progress-fill');
    const progressText = document.getElementById('rating-progress-text');
    const timeEstimate = document.getElementById('rating-time-estimate');
    
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
      console.log(`[AIAnalysisController] Updated progress bar to ${percentage.toFixed(1)}%`);
    }
    
    if (progressText) {
      progressText.textContent = `${current} / ${total} (${percentage.toFixed(1)}%)`;
    }
    
    if (timeEstimate) {
      let timeString = 'calculating...';
      if (remainingMs && remainingMs > 0) {
        const seconds = Math.floor(remainingMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          timeString = `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
          timeString = `${minutes}m ${seconds % 60}s`;
        } else {
          timeString = `${seconds}s`;
        }
      }
      timeEstimate.textContent = `Est. remaining: ${timeString}`;
    }
  }

  onItemRated(data) {
    const { item, rating, distribution } = data;
    
    // Add to rating stream
    const stream = document.getElementById('rating-stream');
    if (stream && rating && rating.relevance_score !== undefined) {
      const entry = document.createElement('div');
      entry.className = 'rating-entry';
      
      entry.innerHTML = `
        <span class="rating-score">${rating.relevance_score.toFixed(2)}</span>
        <span class="rating-type">${item.type}</span>
        <span class="rating-text">${this.truncate(item.content || 'No content', 60)}</span>
      `;
      stream.insertBefore(entry, stream.firstChild);
      
      // Keep only last 50 entries
      while (stream.children.length > 50) {
        stream.removeChild(stream.lastChild);
      }
    }
    
    // Update distribution
    if (distribution) {
      this.updateDistribution(distribution);
    }
  }

  updateDistribution(distribution) {
    const container = document.getElementById('rating-distribution-bars');
    if (!container) return;
    
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    
    container.innerHTML = Object.entries(distribution).map(([label, count]) => {
      const percentage = total > 0 ? (count / total) * 100 : 0;
      return `
        <div class="dist-bar">
          <span class="dist-label">${label}</span>
          <div class="dist-bar-bg">
            <div class="dist-bar-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="dist-count">${count} (${percentage.toFixed(1)}%)</span>
        </div>
      `;
    }).join('');
  }

  async onComplete(data) {
    this.ratingInProgress = false;
    showNotification(`🎉 Rating complete! Rated ${data.stats?.total || 0} items.`, 'success');
    
    const progressSection = document.getElementById('rating-progress-section');
    if (progressSection) {
      setTimeout(() => {
        progressSection.style.display = 'none';
      }, 3000); // Hide after 3 seconds to let user see completion
    }
    
    // Refresh gallery to show updated project
    await this.loadAllProjects();
    this.updateStatsBar();
    this.renderProjectsGallery();
  }

  async onError(data) {
    console.error('Rating error:', data);
    
    // Show error in notification
    showNotification(`❌ Rating failed: ${data.error}`, 'error');
    
    // Add error to stream for visibility
    const stream = document.getElementById('rating-stream');
    if (stream) {
      const entry = document.createElement('div');
      entry.className = 'rating-entry rating-error';
      entry.innerHTML = `
        <span class="rating-score" style="background: #dc3545;">ERROR</span>
        <span class="rating-type">${data.item?.type || 'unknown'}</span>
        <span class="rating-text" style="color: #dc3545;">${data.error}</span>
      `;
      stream.insertBefore(entry, stream.firstChild);
    }
    
    // Stop the rating process on error
    this.ratingInProgress = false;
    
    // Refresh gallery to show updated state with failures
    await this.loadAllProjects();
    this.updateStatsBar();
    this.renderProjectsGallery();
    const progressSection = document.getElementById('rating-progress-section');
    if (progressSection) {
      const progressText = progressSection.querySelector('.progress-text');
      if (progressText) {
        progressText.innerHTML += '<br><span style="color: #dc3545;">⚠️ Stopped due to error. Check console for details.</span>';
      }
    }
  }

  async exportRatings(projectId) {
    try {
      const result = await window.api.ai.exportRatings({ projectId });
      
      if (result.success) {
        showNotification(`Ratings exported to: ${result.path}`, 'success');
      } else {
        showNotification(`Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showNotification(`Error exporting: ${error.message}`, 'error');
    }
  }

  truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }
}

// Initialize AI Analysis Controller when AI Analysis view is shown
let aiController = null;
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.view === 'ai-analysis') {
      if (!aiController) {
        aiController = new AIAnalysisController();
        window.aiController = aiController; // Expose globally
      }
    }
  });
});

// Make functions available globally for onclick handlers
window.exportCollection = exportCollection;
window.exportCollectionCSV = exportCollectionCSV;
window.exportCollectionJSON = exportCollectionJSON;
window.exportCollectionCARDS = exportCollectionCARDS;
window.importCollection = importCollection;
window.showView = showView;
window.viewCollection = viewCollection;
window.resumeCollectionFromGallery = resumeCollectionFromGallery;
window.markCollectionComplete = markCollectionComplete;