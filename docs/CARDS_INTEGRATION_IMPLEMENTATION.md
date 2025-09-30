# CARDS Integration Implementation Guide

## 1. Main Process Handler

Add to `main.js`:

```javascript
const CARDSExportService = require('./src/services/cards-export');

// Initialize CARDS export service
const cardsExporter = new CARDSExportService(db);

// Add IPC handler for CARDS export
ipcMain.handle('export:cards', async (event, { collectionId, options }) => {
  try {
    const result = await cardsExporter.exportToCARDS(collectionId, options);
    return result;
  } catch (error) {
    console.error('CARDS export error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Add IPC handler for CARDS export preview
ipcMain.handle('export:cards-preview', async (event, { collectionId, options }) => {
  try {
    // Just collect items without saving
    const collection = await db.getCollection(collectionId);
    const items = await cardsExporter.collectItems(collectionId, options);
    
    return {
      success: true,
      preview: {
        total_items: items.length,
        sample_items: items.slice(0, 10),
        media_summary: cardsExporter.calculateMediaSummary(items)
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## 2. Renderer UI Component

Create `src/components/cards-export-dialog.js`:

```javascript
class CARDSExportDialog {
  constructor() {
    this.currentOptions = this.getDefaultOptions();
  }

  getDefaultOptions() {
    return {
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
  }

  show(collectionId) {
    this.collectionId = collectionId;
    
    const dialog = document.createElement('div');
    dialog.className = 'cards-export-dialog modal';
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Export to CARDS Format</h2>
          <button class="close-btn" onclick="cardsExportDialog.hide()">×</button>
        </div>
        
        <div class="modal-body">
          <!-- Content Selection -->
          <div class="export-section">
            <h3>Content to Include</h3>
            <div class="option-group">
              <label class="checkbox-label">
                <input type="checkbox" id="cards-include-videos" checked>
                <span>Full Videos</span>
                <span class="option-hint">Export complete videos as items</span>
              </label>
              
              <label class="checkbox-label">
                <input type="checkbox" id="cards-include-chunks" checked>
                <span>Video Segments</span>
                <span class="option-hint">Export transcribed chunks as items</span>
              </label>
              
              <label class="checkbox-label">
                <input type="checkbox" id="cards-include-comments" checked>
                <span>Comments</span>
                <span class="option-hint">Export high-quality comments as items</span>
              </label>
            </div>
          </div>

          <!-- Video Options -->
          <div class="export-section" id="cards-video-options">
            <h3>Video Export Options</h3>
            <div class="option-group">
              <label>Export Mode</label>
              <select id="cards-video-mode">
                <option value="thumbnail">Thumbnail Only</option>
                <option value="clip">Short Clips (30s)</option>
                <option value="full">Full Video</option>
              </select>
            </div>
          </div>

          <!-- Chunk Options -->
          <div class="export-section" id="cards-chunk-options">
            <h3>Segment Options</h3>
            <div class="option-group">
              <label>Chunks per Video</label>
              <input type="number" id="cards-chunks-per-video" value="5" min="1" max="20">
              
              <label>Selection Method</label>
              <select id="cards-chunk-selection">
                <option value="all">All Chunks</option>
                <option value="sampled">Evenly Sampled</option>
                <option value="top_coherence">Most Coherent</option>
              </select>
            </div>
          </div>

          <!-- Comment Options -->
          <div class="export-section" id="cards-comment-options">
            <h3>Comment Filters</h3>
            <div class="option-group">
              <label>Minimum Likes</label>
              <input type="number" id="cards-min-likes" value="10" min="0">
              
              <label>Minimum Length</label>
              <input type="number" id="cards-min-length" value="50" min="10">
              
              <label>Max per Video</label>
              <input type="number" id="cards-max-comments" value="10" min="1">
            </div>
          </div>

          <!-- BWS Configuration -->
          <div class="export-section">
            <h3>BWS Rating Configuration</h3>
            <div class="option-group">
              <label>Assessment Method</label>
              <select id="cards-method">
                <option value="bws">Best-Worst Scaling</option>
                <option value="likert">Likert Scale</option>
                <option value="ranking">Ranking</option>
              </select>
              
              <label>Items per Set</label>
              <input type="number" id="cards-set-size" value="4" min="3" max="7">
              
              <label>Media Balance</label>
              <select id="cards-media-balance">
                <option value="mixed">Mixed Media Types</option>
                <option value="homogeneous">Same Type per Set</option>
                <option value="stratified">Stratified Sampling</option>
              </select>
            </div>
          </div>

          <!-- Dimensions -->
          <div class="export-section">
            <h3>Rating Dimensions</h3>
            <div id="cards-dimensions-list">
              <div class="dimension-item">
                <input type="text" placeholder="Dimension Name" value="Content Quality">
                <input type="text" placeholder="Description" value="Overall quality and value of the content">
                <button class="remove-btn" style="display:none;">Remove</button>
              </div>
            </div>
            <button class="add-dimension-btn" onclick="cardsExportDialog.addDimension()">
              + Add Dimension
            </button>
          </div>

          <!-- Preview -->
          <div class="export-preview" id="cards-export-preview">
            <button class="preview-btn" onclick="cardsExportDialog.preview()">
              Preview Export
            </button>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="cardsExportDialog.hide()">Cancel</button>
          <button class="btn btn-primary" onclick="cardsExportDialog.export()">
            Export to CARDS
          </button>
          <button class="btn btn-success" onclick="cardsExportDialog.exportToSupabase()">
            Export & Upload to Supabase
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    this.bindEvents();
    this.updateVisibility();
  }

  async preview() {
    const options = this.collectOptions();
    const result = await window.api.export.cardsPreview({ 
      collectionId: this.collectionId, 
      options 
    });
    
    if (result.success) {
      const preview = result.preview;
      document.getElementById('cards-export-preview').innerHTML = `
        <div class="preview-stats">
          <h4>Export Preview</h4>
          <p>Total Items: ${preview.total_items}</p>
          <div class="media-summary">
            ${Object.entries(preview.media_summary)
              .filter(([type, count]) => count > 0)
              .map(([type, count]) => `<span>${type}: ${count}</span>`)
              .join(' • ')
            }
          </div>
          <div class="sample-items">
            <h5>Sample Items:</h5>
            ${preview.sample_items.slice(0, 5).map(item => `
              <div class="sample-item">
                <span class="item-type">[${item.media.type}]</span>
                <span class="item-content">${this.truncate(item.content, 100)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  async export() {
    const options = this.collectOptions();
    const exportBtn = document.querySelector('.btn-primary');
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    
    try {
      const result = await window.api.export.cards({ 
        collectionId: this.collectionId, 
        options 
      });
      
      if (result.success) {
        showNotification(`CARDS export saved to: ${result.path}`, 'success');
        
        // Show stats
        const stats = result.stats;
        showNotification(
          `Exported ${stats.total_items} items (${stats.videos} videos, ${stats.text_items} text) ` +
          `into ${stats.assessment_sets} assessment sets`,
          'info'
        );
        
        // Ask if user wants to open the file
        if (confirm('Export complete! Would you like to open the export folder?')) {
          await window.api.system.openFolder(result.path);
        }
        
        this.hide();
      } else {
        showNotification('Export failed: ' + result.error, 'error');
      }
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export to CARDS';
    }
  }

  collectOptions() {
    return {
      include_videos: document.getElementById('cards-include-videos').checked,
      include_chunks: document.getElementById('cards-include-chunks').checked,
      include_comments: document.getElementById('cards-include-comments').checked,
      video_export_mode: document.getElementById('cards-video-mode').value,
      chunks_per_video: parseInt(document.getElementById('cards-chunks-per-video').value),
      chunk_selection: document.getElementById('cards-chunk-selection').value,
      min_comment_likes: parseInt(document.getElementById('cards-min-likes').value),
      min_comment_length: parseInt(document.getElementById('cards-min-length').value),
      max_comments_per_video: parseInt(document.getElementById('cards-max-comments').value),
      assessment_method: document.getElementById('cards-method').value,
      set_size: parseInt(document.getElementById('cards-set-size').value),
      media_balance: document.getElementById('cards-media-balance').value,
      dimensions: this.collectDimensions()
    };
  }

  collectDimensions() {
    const dimensions = [];
    document.querySelectorAll('.dimension-item').forEach((item, index) => {
      const name = item.querySelector('input:first-child').value;
      const description = item.querySelector('input:nth-child(2)').value;
      if (name) {
        dimensions.push({
          id: name.toLowerCase().replace(/\s+/g, '_'),
          name: name,
          description: description,
          scale_type: 'unipolar',
          anchors: ['Low', 'High']
        });
      }
    });
    return dimensions;
  }

  // ... additional UI methods ...
}

// Create global instance
const cardsExportDialog = new CARDSExportDialog();
```

## 3. Update Export Menu

In `src/renderer-advanced.js`, update the export menu:

```javascript
// In the exportCollection function, add CARDS option:
menu.innerHTML = `
  <div class="export-menu-options">
    <button class="export-option" onclick="exportCollectionCARDS(${collectionId})">
      <svg><!-- icon --></svg>
      Export to CARDS (BWS Rating)
    </button>
    <button class="export-option" onclick="exportCollectionCSV(${collectionId})">
      <svg><!-- icon --></svg>
      Export CSV (with transcriptions)
    </button>
    <!-- other options ... -->
  </div>
`;

// Add the export function:
async function exportCollectionCARDS(collectionId) {
  cardsExportDialog.show(collectionId);
  document.querySelector('.export-menu')?.remove();
}
```

## 4. Preload Bridge

Add to `preload.js`:

```javascript
contextBridge.exposeInMainWorld('api', {
  // ... existing methods ...
  
  export: {
    // ... existing exports ...
    cards: (params) => ipcRenderer.invoke('export:cards', params),
    cardsPreview: (params) => ipcRenderer.invoke('export:cards-preview', params)
  }
});
```

## 5. Styling

Add to `styles.css`:

```css
/* CARDS Export Dialog */
.cards-export-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.cards-export-dialog .modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.cards-export-dialog .modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.export-section {
  margin-bottom: 25px;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.export-section h3 {
  margin: 0 0 15px 0;
  color: var(--text-primary);
  font-size: 16px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-group label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.checkbox-label .option-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: auto;
}

.dimension-item {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.dimension-item input {
  flex: 1;
}

.preview-stats {
  padding: 15px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.media-summary {
  display: flex;
  gap: 15px;
  margin: 10px 0;
  font-size: 14px;
}

.sample-item {
  padding: 8px;
  margin: 5px 0;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 13px;
}

.item-type {
  font-weight: 500;
  color: var(--color-primary);
  margin-right: 10px;
}
```

## 6. Example Usage

```javascript
// Basic export
await exportCollectionCARDS(collectionId);

// With custom options
await window.api.export.cards({
  collectionId: 123,
  options: {
    include_videos: false,
    include_chunks: true,
    include_comments: true,
    chunks_per_video: 3,
    min_comment_likes: 100,
    dimensions: [{
      id: 'educational_value',
      name: 'Educational Value',
      description: 'How educational is this content?'
    }]
  }
});

// Preview before export
const preview = await window.api.export.cardsPreview({
  collectionId: 123,
  options: { include_chunks: true }
});
console.log(`Will export ${preview.total_items} items`);
```

## 7. Testing Plan

1. **Unit Tests**
   - Test item transformation functions
   - Test set generation algorithms
   - Test CARDS structure validation

2. **Integration Tests**
   - Test full export flow
   - Test with various collection sizes
   - Test media file handling

3. **Manual Testing**
   - Export small collection
   - Export large collection
   - Test all option combinations
   - Verify CARDS file validity

## Next Steps

1. Implement Supabase direct upload
2. Add baseline AI rankings
3. Implement smart set generation
4. Add progress tracking for large exports
5. Create CARDS file viewer component