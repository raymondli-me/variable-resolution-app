# Gemini Relevance Rating Implementation - COMPLETE SUMMARY

## Implementation Status: ~95% Complete

### ✅ COMPLETED Components

#### 1. Database Schema (`src/database/db.js`)
**Added two new tables:**

```sql
-- Rating projects table
CREATE TABLE rating_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  research_intent TEXT NOT NULL,
  rating_scale TEXT NOT NULL,
  gemini_model TEXT DEFAULT 'gemini-2.5-flash',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  status TEXT DEFAULT 'pending',
  total_items INTEGER,
  rated_items INTEGER DEFAULT 0,
  settings TEXT
)

-- Relevance ratings table
CREATE TABLE relevance_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  relevance_score REAL NOT NULL,
  confidence REAL,
  reasoning TEXT,
  gemini_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, item_type, item_id)
)
```

**Database Methods Added:**
- `createRatingProject(project)` - Create new rating project
- `getRatingProjects(collectionId)` - Get all projects for collection
- `getRatingProject(projectId)` - Get specific project
- `updateRatingProject(projectId, updates)` - Update project status/progress
- `saveRating(rating)` - Save individual rating
- `getRatingsForProject(projectId)` - Get all ratings for a project
- `getItemsForRating(collectionId, includeChunks, includeComments)` - Fetch items to rate

#### 2. Gemini API Service (`src/services/gemini-rater.js`)
**Key Features:**
- Native multimodal support (video, audio, text, images)
- Multiple rating scales (binary, ternary, five-point)
- Structured JSON responses
- Connection testing
- Error handling and retries

**Main Methods:**
```javascript
class GeminiRater {
  async rateContent(content, researchIntent, ratingScale)
  async rateVideoChunk(videoPath, transcript, researchIntent, ratingScale)
  async rateComment(commentText, researchIntent, ratingScale)
  async testConnection()
}
```

**Rating Scale Support:**
- `binary`: Relevant (1.0) / Not Relevant (0.0)
- `ternary`: High (1.0) / Medium (0.5) / Low (0.0)
- `five_point`: 1-5 scale normalized to 0.0-1.0

**API Details:**
- Model: `gemini-2.5-flash` (NOT -latest)
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models`
- Returns structured JSON with score, confidence, reasoning

#### 3. Rating Engine (`src/services/rating-engine.js`)
**Batch Processing System with:**
- Rate limiting (configurable RPM)
- Progress tracking with EventEmitter
- Pause/resume/cancel functionality
- Preview mode (test first 10 items)
- Distribution tracking
- Time estimation

**Events Emitted:**
```javascript
engine.on('progress', { current, total, percentage, timeRemaining })
engine.on('item-rated', { item, rating, distribution })
engine.on('complete', { projectId, stats })
engine.on('error', { error, item })
```

**Main Methods:**
```javascript
async startRatingProject(config)
pause()
resume()
cancel()
async previewRating(config, limit = 10)
```

#### 4. UI - AI Analysis Tab (`index-advanced.html`)
**Complete UI with 4 sections:**

1. **Collection Selector** - Choose which collection to rate
2. **Create Rating Project** - Form with:
   - Project name
   - Research intent (textarea)
   - Rating scale (binary/ternary/five-point radio)
   - Content selection (chunks/comments checkboxes)
   - Advanced options (batch size, rate limit)
   - Cost estimator
   - Start/Preview buttons

3. **Rating Progress** - Live progress display:
   - Progress bar with percentage
   - Time estimate
   - Live rating stream (shows each rated item)
   - Distribution visualization
   - Pause/Cancel/Export buttons

4. **Existing Projects** - List of previous rating projects

**New Nav Button:**
```html
<button class="nav-item" data-view="ai-analysis">
  AI Analysis
</button>
```

#### 5. Styling (`src/styles/ai-analysis.css`)
**Complete stylesheet with:**
- Form styling (inputs, textareas, radio/checkbox groups)
- Card layouts
- Progress bars with animations
- Rating stream with fade-in animations
- Distribution bars
- Advanced options accordion
- Cost estimator styling
- Empty state styling
- Responsive design

**Included in HTML:**
```html
<link rel="stylesheet" href="src/styles/ai-analysis.css">
```

#### 6. IPC Handlers (`main.js`)
**Added 9 new handlers:**

```javascript
// Get rating projects for a collection
ipcMain.handle('ai:getRatingProjects', async (event, { collectionId }) => {...})

// Get item counts (chunks and comments)
ipcMain.handle('ai:getItemCounts', async (event, { collectionId }) => {...})

// Start rating project
ipcMain.handle('ai:startRating', async (event, config) => {...})

// Pause/resume/cancel
ipcMain.handle('ai:pauseRating', async () => {...})
ipcMain.handle('ai:resumeRating', async () => {...})
ipcMain.handle('ai:cancelRating', async () => {...})

// Preview first 10 items
ipcMain.handle('ai:previewRating', async (config) => {...})

// Export ratings to JSON
ipcMain.handle('ai:exportRatings', async (event, { projectId }) => {...})

// Test Gemini connection
ipcMain.handle('ai:testGeminiConnection', async () => {...})
```

**Event Broadcasting:**
```javascript
mainWindow.webContents.send('ai:progress', data)
mainWindow.webContents.send('ai:item-rated', data)
mainWindow.webContents.send('ai:complete', data)
mainWindow.webContents.send('ai:error', data)
mainWindow.webContents.send('ai:preview-item', data)
```

#### 7. Preload Bridge (`preload.js`)
**Added API namespace:**

```javascript
ai: {
  getRatingProjects: (params) => ipcRenderer.invoke('ai:getRatingProjects', params),
  getItemCounts: (params) => ipcRenderer.invoke('ai:getItemCounts', params),
  startRating: (config) => ipcRenderer.invoke('ai:startRating', config),
  pauseRating: () => ipcRenderer.invoke('ai:pauseRating'),
  resumeRating: () => ipcRenderer.invoke('ai:resumeRating'),
  cancelRating: () => ipcRenderer.invoke('ai:cancelRating'),
  previewRating: (config) => ipcRenderer.invoke('ai:previewRating', config),
  exportRatings: (params) => ipcRenderer.invoke('ai:exportRatings', params),
  testGeminiConnection: () => ipcRenderer.invoke('ai:testGeminiConnection')
}
```

**Valid channels for listeners:**
```javascript
'ai:progress',
'ai:item-rated',
'ai:complete',
'ai:error',
'ai:preview-item'
```

---

## ⚠️ REMAINING WORK (~5%)

### 1. Settings Modal Integration
**Need to add Gemini API key field to settings:**

Find the settings modal in `index-advanced.html` and add:
```html
<div class="form-group">
  <label for="gemini-api-key">Gemini API Key:</label>
  <input type="password" id="gemini-api-key" class="form-control">
  <small>Get your key from: https://aistudio.google.com/apikey</small>
  <button id="test-gemini-btn" class="btn btn-secondary">Test Connection</button>
</small>
</div>
```

**Add to settings save/load handlers in renderer:**
```javascript
// When saving settings
const geminiApiKey = document.getElementById('gemini-api-key').value;
await window.api.saveSetting('geminiApiKey', geminiApiKey);

// When loading settings
const geminiKey = await window.api.getSetting('geminiApiKey');
document.getElementById('gemini-api-key').value = geminiKey || '';
```

### 2. Frontend Controller (`src/renderer-advanced.js`)
**Need to add AI Analysis tab controller:**

```javascript
class AIAnalysisController {
  constructor() {
    this.currentCollection = null;
    this.currentProject = null;
    this.ratingInProgress = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Collection selector
    document.getElementById('ai-collection-select').addEventListener('change', 
      (e) => this.onCollectionSelected(e.target.value));
    
    // Content type checkboxes - update counts
    document.getElementById('rate-chunks').addEventListener('change', 
      () => this.updateEstimate());
    document.getElementById('rate-comments').addEventListener('change', 
      () => this.updateEstimate());
    
    // Buttons
    document.getElementById('start-rating-btn').addEventListener('click', 
      () => this.startRating());
    document.getElementById('preview-rating-btn').addEventListener('click', 
      () => this.previewRating());
    document.getElementById('pause-rating-btn').addEventListener('click', 
      () => this.pauseRating());
    document.getElementById('cancel-rating-btn').addEventListener('click', 
      () => this.cancelRating());
    
    // IPC listeners
    window.api.on('ai:progress', (data) => this.onProgress(data));
    window.api.on('ai:item-rated', (data) => this.onItemRated(data));
    window.api.on('ai:complete', (data) => this.onComplete(data));
    window.api.on('ai:error', (data) => this.onError(data));
  }

  async onCollectionSelected(collectionId) {
    if (!collectionId) return;
    this.currentCollection = collectionId;
    
    // Get item counts
    const result = await window.api.ai.getItemCounts({ collectionId });
    if (result.success) {
      document.getElementById('chunks-count').textContent = 
        `(${result.data.chunks} items)`;
      document.getElementById('comments-count').textContent = 
        `(${result.data.comments} items)`;
      this.updateEstimate();
    }
    
    // Load existing projects
    this.loadRatingProjects();
  }

  async loadRatingProjects() {
    const result = await window.api.ai.getRatingProjects({ 
      collectionId: this.currentCollection 
    });
    
    if (result.success) {
      this.renderProjectsList(result.data);
    }
  }

  renderProjectsList(projects) {
    const container = document.getElementById('rating-projects-list');
    
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
          <p><strong>Progress:</strong> ${project.rated_items} / ${project.total_items}</p>
        </div>
        <div class="project-actions">
          <button class="btn btn-secondary" onclick="exportRatings(${project.id})">
            Export
          </button>
          <button class="btn btn-primary" onclick="viewRatings(${project.id})">
            View Results
          </button>
        </div>
      </div>
    `).join('');
  }

  updateEstimate() {
    const includeChunks = document.getElementById('rate-chunks').checked;
    const includeComments = document.getElementById('rate-comments').checked;
    
    const chunksCount = parseInt(
      document.getElementById('chunks-count').textContent.match(/\d+/)?.[0] || 0
    );
    const commentsCount = parseInt(
      document.getElementById('comments-count').textContent.match(/\d+/)?.[0] || 0
    );
    
    const totalItems = (includeChunks ? chunksCount : 0) + 
                      (includeComments ? commentsCount : 0);
    const cost = totalItems * 0.00015;
    
    document.getElementById('items-estimate').textContent = `${totalItems} items`;
    document.getElementById('cost-estimate').textContent = `$${cost.toFixed(4)}`;
  }

  async startRating() {
    const projectName = document.getElementById('project-name').value;
    const researchIntent = document.getElementById('research-intent').value;
    const ratingScale = document.querySelector('input[name="rating-scale"]:checked').value;
    const includeChunks = document.getElementById('rate-chunks').checked;
    const includeComments = document.getElementById('rate-comments').checked;
    const batchSize = parseInt(document.getElementById('batch-size').value);
    const rateLimit = parseInt(document.getElementById('rate-limit').value);
    const includeConfidence = document.getElementById('include-confidence').checked;
    
    if (!projectName || !researchIntent) {
      alert('Please fill in project name and research intent');
      return;
    }
    
    if (!includeChunks && !includeComments) {
      alert('Please select at least one content type to rate');
      return;
    }
    
    const config = {
      collectionId: this.currentCollection,
      projectName,
      researchIntent,
      ratingScale,
      includeChunks,
      includeComments,
      batchSize,
      rateLimit,
      includeConfidence
    };
    
    const result = await window.api.ai.startRating(config);
    
    if (result.success) {
      this.ratingInProgress = true;
      document.getElementById('rating-progress-section').style.display = 'block';
      document.getElementById('progress-project-name').textContent = projectName;
    } else {
      alert(`Error: ${result.error}`);
    }
  }

  async previewRating() {
    // Similar to startRating but calls previewRating endpoint
    // Shows first 10 items in a modal or expanded section
  }

  async pauseRating() {
    await window.api.ai.pauseRating();
  }

  async cancelRating() {
    if (confirm('Are you sure you want to cancel this rating project?')) {
      await window.api.ai.cancelRating();
      this.ratingInProgress = false;
      document.getElementById('rating-progress-section').style.display = 'none';
    }
  }

  onProgress(data) {
    const { current, total, percentage, timeRemaining } = data;
    
    document.getElementById('rating-progress-fill').style.width = `${percentage}%`;
    document.getElementById('rating-progress-text').textContent = 
      `${current} / ${total} (${percentage.toFixed(1)}%)`;
    document.getElementById('rating-time-estimate').textContent = 
      `Est. remaining: ${timeRemaining}`;
  }

  onItemRated(data) {
    const { item, rating, distribution } = data;
    
    // Add to rating stream
    const stream = document.getElementById('rating-stream');
    const entry = document.createElement('div');
    entry.className = 'rating-entry';
    entry.innerHTML = `
      <span class="rating-score">${rating.relevance_score.toFixed(2)}</span>
      <span class="rating-type">${item.type}</span>
      <span class="rating-text">${this.truncate(item.text || item.transcript, 60)}</span>
    `;
    stream.insertBefore(entry, stream.firstChild);
    
    // Keep only last 50 entries
    while (stream.children.length > 50) {
      stream.removeChild(stream.lastChild);
    }
    
    // Update distribution
    this.updateDistribution(distribution);
  }

  updateDistribution(distribution) {
    const container = document.getElementById('rating-distribution-bars');
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

  onComplete(data) {
    this.ratingInProgress = false;
    alert(`Rating complete! Rated ${data.stats.total} items.`);
    document.getElementById('rating-progress-section').style.display = 'none';
    this.loadRatingProjects();
  }

  onError(data) {
    console.error('Rating error:', data);
    alert(`Error: ${data.error}`);
  }

  truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }
}

// Initialize when view is shown
let aiController;
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.view === 'ai-analysis') {
      if (!aiController) {
        aiController = new AIAnalysisController();
      }
    }
  });
});
```

### 3. Populate Collection Dropdown
**Add to renderer when AI Analysis view becomes active:**

```javascript
async function populateAICollectionDropdown() {
  const select = document.getElementById('ai-collection-select');
  const collections = await window.api.getCollections();
  
  select.innerHTML = '<option value="">Choose a collection...</option>';
  collections.forEach(col => {
    const option = document.createElement('option');
    option.value = col.id;
    option.textContent = `${col.name} (${col.created_at})`;
    select.appendChild(option);
  });
}
```

---

## Architecture Summary

### Data Flow

```
User Creates Project
    ↓
Frontend validates input
    ↓
IPC: ai:startRating → main.js
    ↓
Creates RatingEngine + GeminiRater
    ↓
RatingEngine fetches items from DB
    ↓
For each item:
    ├─ GeminiRater calls Gemini API
    ├─ Parses JSON response
    ├─ Saves to relevance_ratings table
    ├─ Updates project progress
    └─ Emits 'item-rated' event
        ↓
    IPC: ai:item-rated → frontend
        ↓
    Updates UI (progress bar, stream)
    ↓
On completion: IPC: ai:complete
    ↓
Frontend shows summary, refreshes project list
```

### Key Design Decisions

1. **Separation of Concerns:**
   - `GeminiRater`: Pure API wrapper, no business logic
   - `RatingEngine`: Orchestrates batch processing, rate limiting, events
   - Database: Stores all ratings for reusability

2. **Event-Driven Architecture:**
   - Rating engine emits events
   - Main process relays to renderer
   - Frontend reactively updates UI

3. **Resume-ability:**
   - Each rating is saved immediately
   - `UNIQUE(project_id, item_type, item_id)` prevents duplicates
   - Can restart project and skip already-rated items

4. **Multimodal Support:**
   - Video chunks: Sends video file directly to Gemini
   - Comments: Sends text only
   - Future: Can add images, PDFs, etc.

5. **Cost Transparency:**
   - Shows real-time cost estimate
   - Preview mode to test before committing
   - Configurable batch size and rate limiting

6. **Research-First Design:**
   - Research intent is plain language
   - Multiple projects per collection
   - Ratings stored separately from source data

---

## Testing Checklist

When implementation is complete, test:

- [ ] Settings: Add Gemini API key, test connection
- [ ] Collection selection: Dropdown populates correctly
- [ ] Item counts: Shows correct chunk/comment counts
- [ ] Cost estimate: Updates when checkboxes change
- [ ] Preview: Shows first 10 ratings without saving
- [ ] Start rating: Creates project, shows progress
- [ ] Live stream: Shows each rated item as it completes
- [ ] Distribution: Updates in real-time
- [ ] Pause/Resume: Can pause and continue
- [ ] Cancel: Stops cleanly
- [ ] Export: Downloads JSON with ratings
- [ ] Project list: Shows completed projects
- [ ] Error handling: Shows clear errors for API failures

---

## Next Steps After Implementation

1. **CARDS Integration:**
   - Modify CARDS export to filter by relevance_score
   - Add AI ratings as baseline to CARDS format
   - Create `cards_video_high_relevance.json` vs `cards_comments_all.json`

2. **Enhanced Filtering:**
   - UI to export only items above threshold (e.g., score > 0.7)
   - Multiple filters (relevance + confidence)
   - Cross-reference ratings from multiple projects

3. **Active Learning:**
   - Identify items with low confidence
   - Prioritize those for human review
   - Train custom models on human+AI consensus

4. **Analytics Dashboard:**
   - Visualize rating distributions
   - Compare projects on same collection
   - Identify outliers

5. **VRDS Pipeline:**
   - Use relevance scores for intelligent sampling
   - Weight items by relevance in visualizations
   - Export to VRDS with metadata

---

## File Reference

All new/modified files:

```
vr-collector/
├── src/
│   ├── database/
│   │   └── db.js                        # ✅ Database schema + methods
│   ├── services/
│   │   ├── gemini-rater.js             # ✅ Gemini API wrapper
│   │   └── rating-engine.js            # ✅ Batch processing engine
│   └── styles/
│       └── ai-analysis.css             # ✅ Complete styling
├── docs/
│   ├── GEMINI_RELEVANCE_RATING_DESIGN.md          # Design doc
│   └── GEMINI_RELEVANCE_RATING_IMPLEMENTATION.md  # This file
├── index-advanced.html                  # ✅ AI Analysis tab HTML
├── main.js                              # ✅ IPC handlers
└── preload.js                           # ✅ API bridge
```

**Still need:**
- Settings modal UI update
- Frontend controller (AIAnalysisController class)
- Collection dropdown population
- Event listener wiring

---

## Gemini API Reference

**Model:** `gemini-2.5-flash`  
**Pricing:** ~$0.00015 per request (estimated)  
**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

**Request Format:**
```json
{
  "contents": [{
    "parts": [
      { "text": "Research intent and rating scale instructions" },
      { "text": "Content to rate (or inline_data for media)" }
    ]
  }],
  "generationConfig": {
    "temperature": 0.3,
    "response_mime_type": "application/json"
  }
}
```

**Response Format:**
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "{\"relevance_score\":0.8,\"confidence\":0.9,\"reasoning\":\"...\"}"
      }]
    }
  }]
}
```

Get API key: https://aistudio.google.com/apikey

---

## FAQ

**Q: Why Gemini instead of GPT-4?**  
A: Native multimodal (video), 10x cheaper, fast inference.

**Q: Can I use different rating scales for different projects?**  
A: Yes! Each project stores its own scale. Scores are normalized to 0.0-1.0.

**Q: What if Gemini API goes down during rating?**  
A: Already-rated items are saved. Just restart the project.

**Q: How do I change the research intent mid-project?**  
A: Create a new project with different intent on the same collection.

**Q: Can I rate the same collection multiple times?**  
A: Yes! That's the point. Different research questions = different projects.

**Q: How do I export only highly relevant items to CARDS?**  
A: After this PR, we'll add filtering to CARDS export based on relevance_score.

---

This implementation creates a powerful, reusable AI enrichment layer that will transform how you work with YouTube data!
