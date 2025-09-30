// Renderer process JavaScript
let currentView = 'youtube';
let selectedVideos = new Set();
let collectionJob = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadSettings();
  showView('youtube');
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

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', showSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', hideSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('selectDirBtn').addEventListener('click', selectDirectory);

  // YouTube search
  document.getElementById('searchBtn').addEventListener('click', searchYouTube);
  document.getElementById('selectAllBtn').addEventListener('click', selectAllVideos);
  document.getElementById('deselectAllBtn').addEventListener('click', deselectAllVideos);
  document.getElementById('startCollectionBtn').addEventListener('click', startCollection);
  
  // Collection controls
  document.getElementById('pauseBtn').addEventListener('click', pauseCollection);
  document.getElementById('cancelBtn').addEventListener('click', cancelCollection);

  // Enter key on search
  document.getElementById('searchTerm').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchYouTube();
  });
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

  if (viewName === 'collections') {
    loadCollections();
  }
}

// Settings
async function loadSettings() {
  const apiKey = await window.api.settings.getApiKey('youtube');
  if (apiKey) {
    document.getElementById('youtubeApiKey').value = apiKey;
  }
}

function showSettings() {
  document.getElementById('settingsModal').style.display = 'flex';
}

function hideSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

async function saveSettings() {
  const apiKey = document.getElementById('youtubeApiKey').value;
  const outputDir = document.getElementById('outputDir').value;
  
  if (apiKey) {
    await window.api.settings.saveApiKey({ service: 'youtube', apiKey });
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

// YouTube search
async function searchYouTube() {
  const searchTerm = document.getElementById('searchTerm').value.trim();
  if (!searchTerm) {
    showNotification('Please enter a search term', 'error');
    return;
  }

  const apiKey = await window.api.settings.getApiKey('youtube');
  if (!apiKey) {
    showNotification('Please set your YouTube API key in settings', 'error');
    showSettings();
    return;
  }

  const searchBtn = document.getElementById('searchBtn');
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';

  try {
    const options = {
      apiKey,
      maxResults: parseInt(document.getElementById('maxResults').value),
      dateRange: document.getElementById('dateRange').value,
      orderBy: document.getElementById('orderBy').value
    };

    const result = await window.api.youtube.search({ searchTerm, options });
    
    if (result.success) {
      displaySearchResults(result.data);
      document.getElementById('searchResults').style.display = 'block';
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

  const apiKey = await window.api.settings.getApiKey('youtube');
  const options = {
    apiKey,
    searchTerm: document.getElementById('searchTerm').value,
    includeComments: document.getElementById('includeComments').checked,
    maxComments: parseInt(document.getElementById('maxComments').value),
    downloadVideo: document.getElementById('downloadVideo').checked,
    videoQuality: document.getElementById('videoQuality').value,
    outputDir: document.getElementById('outputDir').value || './output'
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
  collectionJob = { jobId, startTime: Date.now() };
  updateTimer();

  try {
    const result = await window.api.youtube.collect({ jobId, videos, options });
    
    if (result.success) {
      showNotification('Collection completed successfully!', 'success');
      addLogEntry(`Collection completed: ${result.data.length} videos collected`, 'success');
    } else {
      showNotification(`Collection failed: ${result.error}`, 'error');
      addLogEntry(`Collection failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Collection error: ${error.message}`, 'error');
    addLogEntry(`Collection error: ${error.message}`, 'error');
  } finally {
    collectionJob = null;
  }
}

// Progress updates
window.api.on('collection:progress', ({ jobId, progress }) => {
  if (collectionJob?.jobId !== jobId) return;

  document.getElementById('progressFill').style.width = `${progress.percentage}%`;
  document.getElementById('progressText').textContent = `${progress.completed} / ${progress.total}`;
  document.getElementById('collectionStatus').textContent = `Collecting video ${progress.completed} of ${progress.total}...`;
});

window.api.on('collection:video-complete', ({ jobId, video }) => {
  if (collectionJob?.jobId !== jobId) return;
  
  addLogEntry(`✓ Collected: ${video.title}`, 'success');
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

// Collections view
async function loadCollections() {
  const result = await window.api.db.getCollections();
  
  if (result.success) {
    displayCollections(result.data);
  } else {
    showNotification('Failed to load collections', 'error');
  }
}

function displayCollections(collections) {
  const list = document.getElementById('collectionsList');
  list.innerHTML = '';

  if (collections.length === 0) {
    list.innerHTML = '<p>No collections yet. Start by searching YouTube!</p>';
    return;
  }

  collections.forEach(collection => {
    const card = document.createElement('div');
    card.className = 'collection-card';
    card.innerHTML = `
      <div class="collection-title">${escapeHtml(collection.search_term)}</div>
      <div class="collection-meta">
        ${new Date(collection.created_at).toLocaleDateString()}
      </div>
      <div class="collection-stats">
        <span>${collection.video_count} videos</span>
        <span>${collection.source}</span>
      </div>
    `;
    
    card.addEventListener('click', () => viewCollection(collection.id));
    list.appendChild(card);
  });
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
  const result = await window.api.db.getCollection(collectionId);
  
  if (result.success) {
    // Implement collection viewer
    console.log('Collection data:', result.data);
    showNotification('Collection viewer not implemented yet', 'info');
  }
}