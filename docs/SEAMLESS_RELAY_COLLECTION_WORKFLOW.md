# Seamless Relay Handoff: Collection Creation Workflow

**From:** Agent (Frontend/Full-Stack)
**To:** Next Agent (Full-Stack Recommended)
**Date:** October 6, 2025
**Priority:** HIGH (Core functionality missing)
**Status:** 🔄 READY FOR PICKUP

---

## Executive Summary

**User Need:** A complete workflow for creating new collections from multiple sources (YouTube, PDF, Reddit, News) with advanced features like duplicating, subsampling, and filtering existing collections.

**Current State:** Collections can be viewed, but there's no UI for creating new ones. Users must manually run backend services.

**What's Needed:**
1. ✅ "New Collection" button in UI
2. ✅ Source selection modal (YouTube / PDF / Reddit / News)
3. ✅ PDF upload flow (broken - needs fixing)
4. ✅ Collection duplication feature
5. ✅ Random subsample from existing collection
6. ✅ Filter/query existing collection

---

## LIVING DOCUMENTATION: Current State & Quirks

### ✅ What Works Right Now

1. **Collection Viewing**
   - Videos and comments display correctly in collection viewer
   - Tabbed interface exists (Videos tab / PDFs tab)
   - Modal is wide and responsive (90vw)
   - Click video → shows comments ✅

2. **Backend APIs (Already Implemented)**
   - `window.api.youtube.createCollection(params)` ✅
   - `window.api.pdf.upload(filePath)` ✅ (but broken in UI)
   - `window.api.database.getCollections()` ✅
   - `window.api.database.getVideos(collectionId)` ✅
   - `window.api.pdf.list(collectionId)` ✅

3. **Collection Storage**
   - SQLite database stores collections ✅
   - Folders and organization system works ✅
   - Drag-and-drop collections to folders ✅

### ❌ What's Broken / Missing

1. **PDF Viewing (Partially Broken)**
   - ❌ PDF tab shows in UI but excerpts don't load properly
   - ❌ Layout issues with PDF list
   - ❌ Click PDF → excerpts pane empty or crashes
   - ✅ Videos/comments work fine (don't break this!)

2. **No "New Collection" UI**
   - ❌ No button to create collections
   - ❌ No source selection modal
   - ❌ Users can't access PDF upload
   - ❌ No duplication feature
   - ❌ No subsample feature
   - ❌ No filter feature

3. **PDF Upload Flow Broken**
   - Backend API exists: `window.api.pdf.upload()`
   - Frontend doesn't call it properly
   - No progress indicator during upload
   - No error handling for invalid PDFs

---

## Technical Context

### Current Architecture

**File Locations:**
```
src/
├── renderer-advanced.js        # Main UI logic
├── components/
│   ├── folder-browser.js       # Folder tree (has create/rename/delete modals)
│   ├── collection-viewer.js    # View collections (videos/PDFs/comments)
│   ├── gallery-viewer.js       # Alternative viewer
│   └── enhanced-viewer.js      # Another viewer option
├── services/
│   ├── youtube-service.js      # YouTube data fetching
│   ├── pdf-service.js          # PDF processing
│   └── collection-importer.js  # Import collections
└── database/
    └── db.js                   # SQLite operations
```

**How Collections Are Created Now (Manual):**
1. User runs `window.api.youtube.createCollection()` in console
2. Or imports JSON file via `collections:import`
3. Collection appears in folder tree
4. User clicks collection → viewer opens

**What We Need (Automated UI):**
1. User clicks "New Collection" button
2. Modal opens: "Choose Source: YouTube | PDF | Reddit | News"
3. User selects source → form appears
4. User fills form → clicks "Create"
5. Collection is created and appears in folder tree

---

## Implementation Plan

### Phase 1: Add "New Collection" Button ⭐ START HERE

**Goal:** Add a button that opens a modal for creating collections

**Where to Add:**
- **File:** `src/components/folder-browser.js`
- **Location:** In the `.folder-browser-header` div (around line 50-60 of the HTML)

**Implementation:**

```html
<!-- In folder-browser.js createBrowser() method -->
<div class="folder-browser-header">
  <h3>Collections</h3>
  <div class="header-actions">
    <!-- NEW: Add this button -->
    <button class="icon-btn" onclick="folderBrowser.showNewCollectionModal()" title="New Collection">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
    <!-- Existing buttons follow -->
  </div>
</div>
```

**Add Method:**
```javascript
// In folder-browser.js
showNewCollectionModal() {
  // Show modal with source selection
  this.showSourceSelectionModal();
}
```

---

### Phase 2: Source Selection Modal

**Goal:** Let user choose: YouTube, PDF, Reddit, or News

**Implementation:**

```javascript
// Add to folder-browser.js
showSourceSelectionModal() {
  const modal = this.createModal({
    title: 'Create New Collection',
    content: `
      <div class="source-selection">
        <div class="source-grid">
          <button class="source-card" onclick="folderBrowser.showYouTubeForm()">
            <div class="source-icon">📹</div>
            <h4>YouTube</h4>
            <p>Search and collect YouTube videos with comments</p>
          </button>

          <button class="source-card" onclick="folderBrowser.showPDFForm()">
            <div class="source-icon">📄</div>
            <h4>PDF Document</h4>
            <p>Upload and extract excerpts from PDF files</p>
          </button>

          <button class="source-card disabled" title="Coming soon">
            <div class="source-icon">🔴</div>
            <h4>Reddit</h4>
            <p>Collect Reddit posts and comments</p>
            <span class="badge">Soon</span>
          </button>

          <button class="source-card disabled" title="Coming soon">
            <div class="source-icon">📰</div>
            <h4>News Articles</h4>
            <p>Aggregate news from multiple sources</p>
            <span class="badge">Soon</span>
          </button>
        </div>

        <hr />

        <h4>Or, transform an existing collection:</h4>
        <div class="transform-actions">
          <button class="action-btn" onclick="folderBrowser.showDuplicateForm()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
            Duplicate Collection
          </button>

          <button class="action-btn" onclick="folderBrowser.showSubsampleForm()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
            </svg>
            Random Subsample
          </button>

          <button class="action-btn" onclick="folderBrowser.showFilterForm()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Filter by Criteria
          </button>
        </div>
      </div>
    `
  });
}
```

---

### Phase 3: YouTube Collection Form

**Goal:** Let user create YouTube collection with search parameters

**Implementation:**

```javascript
// Add to folder-browser.js
async showYouTubeForm() {
  const modal = this.createModal({
    title: 'Create YouTube Collection',
    content: `
      <form id="youtubeCollectionForm">
        <div class="form-group">
          <label>Search Term *</label>
          <input type="text" id="searchTerm" placeholder="e.g., machine learning" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Max Results</label>
            <select id="maxResults">
              <option value="10">10 videos</option>
              <option value="25" selected>25 videos</option>
              <option value="50">50 videos</option>
              <option value="100">100 videos</option>
            </select>
          </div>

          <div class="form-group">
            <label>Sort By</label>
            <select id="orderBy">
              <option value="relevance" selected>Relevance</option>
              <option value="date">Upload Date</option>
              <option value="viewCount">View Count</option>
              <option value="rating">Rating</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="includeComments" checked />
            Extract comments from videos
          </label>
        </div>

        <div class="form-group" id="commentOptions">
          <label>Max Comments per Video</label>
          <input type="number" id="maxComments" value="100" min="10" max="1000" />
        </div>

        <div class="form-actions">
          <button type="button" class="btn" onclick="folderBrowser.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Collection</button>
        </div>
      </form>
    `
  });

  // Handle form submission
  document.getElementById('youtubeCollectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await this.createYouTubeCollection({
      searchTerm: document.getElementById('searchTerm').value,
      maxResults: parseInt(document.getElementById('maxResults').value),
      orderBy: document.getElementById('orderBy').value,
      includeComments: document.getElementById('includeComments').checked,
      maxComments: parseInt(document.getElementById('maxComments').value)
    });
  });
}

async createYouTubeCollection(params) {
  try {
    // Show loading state
    this.showLoading('Creating YouTube collection...');

    // Call backend API
    const result = await window.api.youtube.createCollection(params);

    if (result.success) {
      this.showNotification(`Collection "${params.searchTerm}" created!`, 'success');
      this.closeModal();
      this.refreshTree(); // Reload folder tree
    } else {
      this.showNotification(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[FolderBrowser] YouTube collection creation failed:', error);
    this.showNotification('Error creating collection', 'error');
  } finally {
    this.hideLoading();
  }
}
```

---

### Phase 4: PDF Upload Form (FIX BROKEN FLOW)

**Goal:** Fix PDF upload and make it work from UI

**Current Issue:**
- Backend API exists: `window.api.pdf.upload(filePath)`
- Frontend doesn't properly trigger file selection
- No progress indicator during PDF processing
- Excerpts don't load after upload

**Implementation:**

```javascript
// Add to folder-browser.js
async showPDFForm() {
  const modal = this.createModal({
    title: 'Upload PDF Document',
    content: `
      <form id="pdfUploadForm">
        <div class="form-group">
          <label>Collection Name *</label>
          <input type="text" id="pdfCollectionName" placeholder="e.g., Research Papers" required />
        </div>

        <div class="form-group">
          <label>Select PDF File *</label>
          <div class="file-upload-area" id="pdfDropZone">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>Drag & drop PDF here or click to browse</p>
            <input type="file" id="pdfFileInput" accept=".pdf" style="display: none;" />
            <button type="button" class="btn" onclick="document.getElementById('pdfFileInput').click()">
              Choose File
            </button>
            <div id="selectedFileName" style="margin-top: 12px; color: #4ade80;"></div>
          </div>
        </div>

        <div class="form-group">
          <label>Excerpt Strategy</label>
          <select id="excerptStrategy">
            <option value="paragraphs">By Paragraph</option>
            <option value="pages">By Page</option>
            <option value="sections">By Section</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="button" class="btn" onclick="folderBrowser.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="uploadPDFBtn">Upload & Process</button>
        </div>
      </form>

      <div id="uploadProgress" style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill" style="width: 0%;"></div>
        </div>
        <p id="progressText">Uploading...</p>
      </div>
    `
  });

  // File selection handler
  const fileInput = document.getElementById('pdfFileInput');
  const dropZone = document.getElementById('pdfDropZone');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById('selectedFileName').textContent = `📄 ${file.name}`;
    }
  });

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      fileInput.files = files;
      document.getElementById('selectedFileName').textContent = `📄 ${files[0].name}`;
    }
  });

  // Form submission
  document.getElementById('pdfUploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('pdfFileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
      this.showNotification('Please select a PDF file', 'error');
      return;
    }

    await this.uploadPDF({
      file: fileInput.files[0],
      collectionName: document.getElementById('pdfCollectionName').value,
      excerptStrategy: document.getElementById('excerptStrategy').value
    });
  });
}

async uploadPDF(params) {
  try {
    // Show progress
    document.getElementById('pdfUploadForm').style.display = 'none';
    document.getElementById('uploadProgress').style.display = 'block';

    // Upload file (backend API)
    const result = await window.api.pdf.upload({
      filePath: params.file.path,
      collectionName: params.collectionName,
      excerptStrategy: params.excerptStrategy
    });

    if (result.success) {
      this.showNotification(`PDF collection "${params.collectionName}" created!`, 'success');
      this.closeModal();
      this.refreshTree();
    } else {
      this.showNotification(`Upload failed: ${result.error}`, 'error');
      document.getElementById('pdfUploadForm').style.display = 'block';
      document.getElementById('uploadProgress').style.display = 'none';
    }
  } catch (error) {
    console.error('[FolderBrowser] PDF upload failed:', error);
    this.showNotification('Error uploading PDF', 'error');
  }
}
```

---

### Phase 5: Collection Duplication

**Goal:** Let user duplicate an existing collection

**Implementation:**

```javascript
async showDuplicateForm() {
  // Get all collections
  const collections = await window.api.database.getCollections();

  const modal = this.createModal({
    title: 'Duplicate Collection',
    content: `
      <form id="duplicateForm">
        <div class="form-group">
          <label>Select Collection to Duplicate *</label>
          <select id="sourceCollection" required>
            <option value="">-- Choose Collection --</option>
            ${collections.map(c => `
              <option value="${c.id}">${c.search_term} (${c.video_count} videos)</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>New Collection Name *</label>
          <input type="text" id="newCollectionName" placeholder="Copy of..." required />
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="includeComments" checked />
            Include all comments
          </label>
        </div>

        <div class="form-actions">
          <button type="button" class="btn" onclick="folderBrowser.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Duplicate</button>
        </div>
      </form>
    `
  });

  document.getElementById('duplicateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await this.duplicateCollection({
      sourceId: document.getElementById('sourceCollection').value,
      newName: document.getElementById('newCollectionName').value,
      includeComments: document.getElementById('includeComments').checked
    });
  });
}

async duplicateCollection(params) {
  try {
    this.showLoading('Duplicating collection...');

    // Backend API call (needs to be implemented in main.js)
    const result = await window.api.collections.duplicate(params);

    if (result.success) {
      this.showNotification('Collection duplicated!', 'success');
      this.closeModal();
      this.refreshTree();
    } else {
      this.showNotification(`Duplication failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[FolderBrowser] Duplication failed:', error);
    this.showNotification('Error duplicating collection', 'error');
  } finally {
    this.hideLoading();
  }
}
```

---

### Phase 6: Random Subsample

**Goal:** Create a new collection with random subset of videos from existing collection

**Implementation:**

```javascript
async showSubsampleForm() {
  const collections = await window.api.database.getCollections();

  const modal = this.createModal({
    title: 'Random Subsample',
    content: `
      <form id="subsampleForm">
        <div class="form-group">
          <label>Source Collection *</label>
          <select id="sourceCollection" required>
            <option value="">-- Choose Collection --</option>
            ${collections.map(c => `
              <option value="${c.id}">${c.search_term} (${c.video_count} videos)</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>Sample Size *</label>
          <input type="number" id="sampleSize" min="1" placeholder="e.g., 10" required />
          <small>Number of videos to randomly select</small>
        </div>

        <div class="form-group">
          <label>New Collection Name *</label>
          <input type="text" id="newCollectionName" placeholder="Sample of..." required />
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="withReplacement" />
            Allow duplicates (sample with replacement)
          </label>
        </div>

        <div class="form-actions">
          <button type="button" class="btn" onclick="folderBrowser.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Sample</button>
        </div>
      </form>
    `
  });

  document.getElementById('subsampleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await this.createSubsample({
      sourceId: document.getElementById('sourceCollection').value,
      sampleSize: parseInt(document.getElementById('sampleSize').value),
      newName: document.getElementById('newCollectionName').value,
      withReplacement: document.getElementById('withReplacement').checked
    });
  });
}

async createSubsample(params) {
  try {
    this.showLoading('Creating subsample...');

    // Backend API call (needs implementation)
    const result = await window.api.collections.subsample(params);

    if (result.success) {
      this.showNotification('Subsample created!', 'success');
      this.closeModal();
      this.refreshTree();
    } else {
      this.showNotification(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[FolderBrowser] Subsample failed:', error);
    this.showNotification('Error creating subsample', 'error');
  } finally {
    this.hideLoading();
  }
}
```

---

### Phase 7: Filter Collection

**Goal:** Create new collection by filtering existing one (views, comments, date, keywords)

**Implementation:**

```javascript
async showFilterForm() {
  const collections = await window.api.database.getCollections();

  const modal = this.createModal({
    title: 'Filter Collection',
    content: `
      <form id="filterForm">
        <div class="form-group">
          <label>Source Collection *</label>
          <select id="sourceCollection" required>
            <option value="">-- Choose Collection --</option>
            ${collections.map(c => `
              <option value="${c.id}">${c.search_term} (${c.video_count} videos)</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>Filter Criteria</label>

          <div class="filter-row">
            <label>Min Views:</label>
            <input type="number" id="minViews" placeholder="e.g., 1000" />
          </div>

          <div class="filter-row">
            <label>Min Comments:</label>
            <input type="number" id="minComments" placeholder="e.g., 10" />
          </div>

          <div class="filter-row">
            <label>Date Range:</label>
            <select id="dateRange">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>

          <div class="filter-row">
            <label>Title Contains:</label>
            <input type="text" id="titleKeyword" placeholder="keyword" />
          </div>
        </div>

        <div class="form-group">
          <label>New Collection Name *</label>
          <input type="text" id="newCollectionName" placeholder="Filtered..." required />
        </div>

        <div class="form-actions">
          <button type="button" class="btn" onclick="folderBrowser.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Apply Filter</button>
        </div>
      </form>
    `
  });

  document.getElementById('filterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await this.filterCollection({
      sourceId: document.getElementById('sourceCollection').value,
      filters: {
        minViews: parseInt(document.getElementById('minViews').value) || 0,
        minComments: parseInt(document.getElementById('minComments').value) || 0,
        dateRange: document.getElementById('dateRange').value,
        titleKeyword: document.getElementById('titleKeyword').value
      },
      newName: document.getElementById('newCollectionName').value
    });
  });
}

async filterCollection(params) {
  try {
    this.showLoading('Applying filters...');

    // Backend API call (needs implementation)
    const result = await window.api.collections.filter(params);

    if (result.success) {
      this.showNotification(`Filtered collection created with ${result.matchCount} items`, 'success');
      this.closeModal();
      this.refreshTree();
    } else {
      this.showNotification(`Filter failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[FolderBrowser] Filter failed:', error);
    this.showNotification('Error filtering collection', 'error');
  } finally {
    this.hideLoading();
  }
}
```

---

## Backend APIs Needed (For Agent A)

Some collection operations need backend implementation:

### 1. Collection Duplication
```javascript
// In main.js, add IPC handler:
ipcMain.handle('collections:duplicate', async (event, params) => {
  // 1. Get source collection
  // 2. Copy all videos and comments
  // 3. Create new collection with new name
  // 4. Return { success: true, collectionId: newId }
});
```

### 2. Random Subsample
```javascript
ipcMain.handle('collections:subsample', async (event, params) => {
  // 1. Get all videos from source collection
  // 2. Randomly select N videos (with or without replacement)
  // 3. Create new collection with sampled videos
  // 4. Return { success: true, collectionId: newId }
});
```

### 3. Filter Collection
```javascript
ipcMain.handle('collections:filter', async (event, params) => {
  // 1. Get all videos from source collection
  // 2. Apply filters (views, comments, date, keywords)
  // 3. Create new collection with filtered videos
  // 4. Return { success: true, collectionId: newId, matchCount: N }
});
```

### 4. PDF Upload (Fix Existing)
```javascript
// In main.js, fix existing handler:
ipcMain.handle('pdf:upload', async (event, params) => {
  // ISSUE: Needs proper error handling
  // ISSUE: Needs progress reporting
  // ISSUE: Excerpts not being stored correctly

  // 1. Validate PDF file exists
  // 2. Parse PDF and extract text
  // 3. Create excerpts based on strategy
  // 4. Store in database
  // 5. Return { success: true, collectionId, excerptCount }
});
```

---

## CSS Styling Needed

Add to `src/styles/folder-browser.css`:

```css
/* Source selection grid */
.source-selection {
  padding: 20px;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.source-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.source-card:hover:not(.disabled) {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  transform: translateY(-2px);
}

.source-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.source-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.source-card h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.source-card p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.source-card .badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #fbbf24;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

/* Transform actions */
.transform-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.action-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

/* File upload area */
.file-upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.file-upload-area:hover,
.file-upload-area.drag-over {
  border-color: #3b82f6;
  background: #eff6ff;
}

/* Progress bar */
.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width 0.3s ease;
}

/* Form styles */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-row label {
  min-width: 120px;
  font-weight: 500;
}
```

---

## CRITICAL BUGS TO FIX

### Bug 1: PDF Excerpts Not Loading

**Symptom:** Click PDF in collection viewer → excerpts pane empty

**Location:** `src/components/collection-viewer.js:408-439`

**Root Cause Investigation Needed:**
1. Is `window.api.pdf.getExcerpts()` returning data?
2. Is the data format correct?
3. Is the DOM element ID correct?
4. Are there console errors?

**Debug Steps:**
```javascript
// Add to loadExcerpts() method:
console.log('[CollectionViewer] Loading excerpts for PDF:', pdfId);
const result = await window.api.pdf.getExcerpts(pdfId);
console.log('[CollectionViewer] Excerpts result:', result);
console.log('[CollectionViewer] Excerpts data:', result.data);
```

**Likely Fix:**
- Check if `result.data` vs `result.excerpts` (API inconsistency)
- Verify database has excerpts for that PDF
- Check if `excerpt.text_content` vs `excerpt.content` (column name)

### Bug 2: Videos/Comments Layout Stable, Don't Break It

**Current State:** Videos and comments work perfectly

**Critical CSS Classes That Must Not Be Changed:**
- `.videos-panel` - Keep flex: 0 0 350px
- `.comments-panel` - Keep flex: 1
- `.tab-pane.active` - Must remain display: flex
- `.viewer-layout` - Must remain display: flex

**If you touch these, test immediately!**

---

## Testing Checklist

### Phase 1: Basic UI
- [ ] "New Collection" button appears in folder browser header
- [ ] Clicking button opens source selection modal
- [ ] Modal has 4 source cards: YouTube, PDF, Reddit (disabled), News (disabled)
- [ ] Modal has 3 transform buttons: Duplicate, Subsample, Filter

### Phase 2: YouTube Collection
- [ ] Click YouTube card → form opens
- [ ] Fill form and submit → backend API called
- [ ] Loading spinner shows during creation
- [ ] Success notification appears
- [ ] New collection appears in folder tree
- [ ] Click new collection → viewer opens with videos

### Phase 3: PDF Upload
- [ ] Click PDF card → upload form opens
- [ ] Can select PDF file via button
- [ ] Can drag & drop PDF file
- [ ] File name displays after selection
- [ ] Submit form → upload starts
- [ ] Progress bar shows during upload
- [ ] Success notification appears
- [ ] New PDF collection appears in tree
- [ ] Click PDF collection → viewer opens
- [ ] Click PDF → excerpts load properly ⭐ CRITICAL

### Phase 4: Duplication
- [ ] Click "Duplicate" → form shows all collections
- [ ] Select collection and name → duplicate created
- [ ] Duplicate has same videos as original
- [ ] Duplicate appears in tree

### Phase 5: Subsample
- [ ] Click "Random Subsample" → form opens
- [ ] Select collection and sample size → subsample created
- [ ] Subsample has correct number of videos
- [ ] Videos are random subset of original

### Phase 6: Filter
- [ ] Click "Filter by Criteria" → form opens
- [ ] Apply filters → filtered collection created
- [ ] Only matching videos appear in filtered collection
- [ ] Filter counts are accurate

---

## Known Gotchas & Quirks

### 1. Modal System (from folder-browser.js)
```javascript
// ✅ CORRECT - Use existing modal helper:
const modal = this.createModal({
  title: 'My Title',
  content: '<div>HTML here</div>'
});

// ❌ WRONG - Don't create modals manually:
const modal = document.createElement('div');
modal.className = 'modal';
// ... This breaks existing modal close() logic
```

### 2. IPC Handler Return Format
```javascript
// Backend must ALWAYS return this format:
return { success: true, data: result };
// OR
return { success: false, error: 'Error message' };

// Frontend checks:
if (result.success) {
  // Use result.data
} else {
  // Show result.error
}
```

### 3. Folder Tree Refresh
```javascript
// After creating collection, MUST refresh tree:
await this.createCollection(params);
this.refreshTree(); // ⭐ Don't forget this!
```

### 4. File Paths in Electron
```javascript
// ✅ CORRECT - Use file.path:
const filePath = fileInput.files[0].path;
await window.api.pdf.upload({ filePath });

// ❌ WRONG - Don't use File object directly:
const file = fileInput.files[0];
await window.api.pdf.upload({ file }); // Won't work, can't serialize File
```

---

## Success Criteria

✅ **User can create YouTube collections from UI**
✅ **User can upload PDF documents from UI**
✅ **PDF excerpts display properly in collection viewer**
✅ **User can duplicate existing collections**
✅ **User can create random subsamples**
✅ **User can filter collections by criteria**
✅ **Videos/comments viewing still works (not broken)**

---

## Estimated Time

**Total:** 8-10 hours

- Phase 1 (New Collection button): 30 min
- Phase 2 (Source selection modal): 1 hour
- Phase 3 (YouTube form): 2 hours
- Phase 4 (PDF upload + fix bugs): 3 hours ⭐ Most complex
- Phase 5 (Duplication): 1 hour
- Phase 6 (Subsample): 1 hour
- Phase 7 (Filter): 1.5 hours
- Testing & polish: 1 hour

---

## Files to Modify

### Frontend (Existing)
- `src/components/folder-browser.js` - Add all new collection UI
- `src/components/collection-viewer.js` - Fix PDF excerpt loading
- `src/styles/folder-browser.css` - Add new styles

### Backend (May Need Implementation)
- `main.js` - Add IPC handlers for duplicate/subsample/filter
- `preload.js` - Expose new APIs to renderer
- `src/services/collection-service.js` - (Create if needed) Collection operations

---

## Handoff Package

**Ready for Next Agent:**
- ✅ Complete technical context
- ✅ Step-by-step implementation plan
- ✅ Code examples with exact file locations
- ✅ CSS styling provided
- ✅ Testing checklist
- ✅ Known gotchas documented
- ✅ Success criteria defined

**Current Blocking Issues:**
1. PDF excerpts not loading (needs debugging)
2. Backend APIs needed for duplicate/subsample/filter

**Priority Order:**
1. Fix PDF excerpt loading (HIGH - user can't use PDFs)
2. Add "New Collection" button and YouTube form (HIGH - core workflow)
3. Fix PDF upload flow (HIGH - user can't create PDF collections)
4. Add duplicate/subsample/filter (MEDIUM - nice-to-have features)

---

**Status:** 🟢 READY FOR PICKUP

**Next Agent:** This is a full-stack task. Backend work needed for collection operations, frontend work needed for UI. A generalist agent or coordinated handoff between Agent A (backend) and Agent B (frontend) recommended.

---

**Last Updated:** October 6, 2025
**Document Version:** 1.0
**Maintained By:** Current implementing agent (update as you work!)
