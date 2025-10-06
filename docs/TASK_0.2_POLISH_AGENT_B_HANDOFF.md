# Task 0.2 Polish & Integration: Frontend Completion (Agent B)

**To:** Claude Implementation Agent B (Frontend Specialist)
**From:** Consultant Agent
**Date:** October 6, 2025
**Status:** 🎨 Frontend Polish & Integration Required
**Estimated Time:** 6-8 hours

---

## SITUATION

You are taking over frontend UI completion from a previous Claude agent who delivered excellent work (5/5 stars) but ran out of context. The folder browser UI is 90% complete but lacks polish and has some integration issues.

**Current State:**
- ✅ Folder browser component 90% complete
- ✅ Tree view, drag-and-drop, context menus working
- ⚠️ Stub file has API mismatch (throws errors)
- ⚠️ No toast notifications (using console.log)
- ⚠️ Hardcoded file paths (no dialogs)
- ⚠️ Special views incomplete

**Your Mission:**
Polish the UI to production quality and fix integration issues.

---

## WHAT YOU NEED TO READ FIRST

**Critical Documents (Read in Order):**
1. `docs/API_CONTRACT_PHASE_0.md` - Exact API specifications
2. `docs/CODEBASE_AUDIT_OCT_6_2025.md` - Current state analysis
3. `docs/TASK_0.2_COMPLETION_REPORT.md` - What previous agent did
4. `docs/TASK_0.2.2_CLAUDE_TOAST_NOTIFICATIONS.md` - Toast system spec

**Key Files to Understand:**
1. `src/components/folder-browser.js` - Your main work file
2. `src/components/folder-browser-stubs.js` - BROKEN, needs fixing
3. `index-advanced.html` - Integration point
4. `preload.js` - Real API structure (lines 100-150)

---

## YOUR TASKS

### Task 1: Fix Stub File Integration

**Problem:** Stub file tries to create `window.api.export` but real API uses `window.api.collections.exportToJSON`

**File:** `src/components/folder-browser-stubs.js`

**Option A (Recommended): Remove Stubs Entirely**

The backend is implemented, stubs are no longer needed:

```javascript
// Remove the script tag from index-advanced.html
// Find and delete:
<script src="src/components/folder-browser-stubs.js"></script>

// Delete the file entirely (or rename to .old)
```

**Option B: Fix Stubs to Match Real API** (If you want to keep for testing)

Update stubs to use correct API structure:
```javascript
// Instead of:
window.api.export.collection = async (...) => { ... }

// Use:
if (!window.api.collections.exportToJSON) {
  window.api.collections.exportToJSON = async (...) => { ... }
}
```

**Verification:**
```javascript
// In Electron console
console.log(window.api);
// Should show: { collections: { exportToJSON, importFromJSON }, folders: { ... }, ... }
// Should NOT show: { export: { ... } }
```

---

### Task 2: Implement Toast Notification System

**Follow:** `docs/TASK_0.2.2_CLAUDE_TOAST_NOTIFICATIONS.md` (complete spec exists!)

#### 2.1: Create Toast Component

**File to Create:** `src/components/toast-notification.js`

```javascript
/**
 * Toast Notification System
 * Provides visual feedback for all user actions
 */
class ToastNotification {
  constructor(containerId = 'toast-container') {
    this.container = document.getElementById(containerId);
    this.toasts = new Map(); // Track active toasts
    this.nextId = 1;
  }

  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  error(message, options = {}) {
    return this.show(message, 'error', { ...options, duration: options.duration || 5000 });
  }

  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  show(message, type = 'info', options = {}) {
    const {
      duration = 3000,
      dismissible = true,
      action = null
    } = options;

    const toastId = this.nextId++;
    const toast = this.createToastElement(toastId, message, type, dismissible, action);

    this.container.appendChild(toast);
    this.toasts.set(toastId, toast);

    // Slide in animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-dismiss if duration > 0
    if (duration > 0) {
      setTimeout(() => this.dismiss(toastId), duration);
    }

    return toastId;
  }

  createToastElement(id, message, type, dismissible, action) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.dataset.toastId = id;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type]}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
      ${action ? `<button class="toast-action">${action.label}</button>` : ''}
      ${dismissible ? '<button class="toast-close" aria-label="Close notification">✕</button>' : ''}
    `;

    // Action button click
    if (action) {
      toast.querySelector('.toast-action').addEventListener('click', () => {
        action.callback();
        this.dismiss(id);
      });
    }

    // Close button click
    if (dismissible) {
      toast.querySelector('.toast-close').addEventListener('click', () => {
        this.dismiss(id);
      });
    }

    return toast;
  }

  dismiss(toastId) {
    const toast = this.toasts.get(toastId);
    if (!toast) return;

    toast.classList.add('dismissing');
    setTimeout(() => {
      toast.remove();
      this.toasts.delete(toastId);
    }, 300); // Match animation duration
  }

  dismissAll() {
    for (const toastId of this.toasts.keys()) {
      this.dismiss(toastId);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance
window.toastNotification = new ToastNotification();
```

---

#### 2.2: Create Toast Styles

**File to Create:** `src/styles/toast-notification.css`

```css
/* Toast Container */
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

/* Individual Toast */
.toast {
  width: 350px;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  opacity: 0;
  transform: translateX(400px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast.show {
  opacity: 1;
  transform: translateX(0);
}

.toast.dismissing {
  opacity: 0;
  transform: translateX(400px);
}

/* Toast Types */
.toast-success {
  background: rgba(16, 185, 129, 0.95);
  color: white;
}

.toast-error {
  background: rgba(239, 68, 68, 0.95);
  color: white;
}

.toast-warning {
  background: rgba(245, 158, 11, 0.95);
  color: white;
}

.toast-info {
  background: rgba(59, 130, 246, 0.95);
  color: white;
}

/* Toast Elements */
.toast-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.toast-action {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.2s;
}

.toast-action:hover {
  background: rgba(255, 255, 255, 0.3);
}

.toast-close {
  background: transparent;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-close:hover {
  opacity: 1;
}

/* Responsive */
@media (max-width: 500px) {
  .toast-container {
    right: 10px;
    left: 10px;
    top: 10px;
  }

  .toast {
    width: auto;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .toast {
    transition: opacity 0.1s;
    transform: none !important;
  }
}
```

---

#### 2.3: Integrate Toast System

**Update:** `index-advanced.html`

Add in `<head>`:
```html
<link rel="stylesheet" href="src/styles/toast-notification.css">
```

Add before closing `</body>`:
```html
<!-- Toast Container -->
<div id="toast-container" class="toast-container"></div>

<!-- Toast Script -->
<script src="src/components/toast-notification.js"></script>
```

**Update:** `src/components/folder-browser.js`

Replace placeholder methods (around lines 585-595):
```javascript
showSuccess(message, options = {}) {
  window.toastNotification.success(message, options);
}

showError(message, options = {}) {
  window.toastNotification.error(message, options);
}

showInfo(message, options = {}) {
  window.toastNotification.info(message, options);
}
```

**Add Rich Notifications Throughout:**

```javascript
// In createFolder() method
if (result.success) {
  this.showSuccess(`Folder "${name}" created`, { duration: 2000 });
  await this.loadFolderTree();
}

// In deleteFolder() method
if (result.success) {
  this.showInfo('Folder deleted', {
    duration: 5000,
    action: {
      label: 'Undo',
      callback: () => console.log('Undo not implemented yet')
    }
  });
}

// In exportCollectionToJSON() method
if (result.success) {
  this.showSuccess(
    `Exported ${result.data.itemCount} items (${(result.data.fileSize / 1024).toFixed(1)} KB)`,
    {
      duration: 4000,
      action: {
        label: 'Open Folder',
        callback: () => {
          // Open file location (requires Electron API)
          require('electron').shell.showItemInFolder(result.data.filePath);
        }
      }
    }
  );
}
```

---

### Task 3: Add File Picker Dialogs

**Problem:** Export/import use hardcoded paths

**Solution:** Use Electron's dialog API

#### 3.1: Add Dialog IPC Handler

**File:** `main.js` (add near other IPC handlers)

```javascript
const { dialog } = require('electron');

ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || []
  });
  return result.filePaths[0]; // Return first selected file or undefined
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultPath || '',
    filters: options.filters || []
  });
  return result.filePath; // Return selected path or undefined
});
```

#### 3.2: Expose in Preload

**File:** `preload.js` (add to window.api)

```javascript
dialog: {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options)
}
```

#### 3.3: Update Export/Import Methods

**In folder-browser.js:**

```javascript
async exportCollectionToJSON(collectionId) {
  // Get collection name for default filename
  const collection = await window.api.database.getCollection(collectionId);
  const defaultName = `${collection.search_term.replace(/[^a-z0-9]/gi, '_')}_export.json`;

  // Show save dialog
  const outputPath = await window.api.dialog.saveFile({
    defaultPath: defaultName,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!outputPath) return; // User cancelled

  try {
    const result = await window.api.collections.exportToJSON(collectionId, outputPath);

    if (result.success) {
      this.showSuccess(
        `Exported ${result.data.itemCount} items to ${result.data.filePath}`,
        {
          action: {
            label: 'Open Folder',
            callback: () => require('electron').shell.showItemInFolder(result.data.filePath)
          }
        }
      );
    }
  } catch (error) {
    this.showError(`Export failed: ${error.message}`);
  }
}

async importCollection() {
  // Show open dialog
  const filePath = await window.api.dialog.openFile({
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!filePath) return; // User cancelled

  try {
    const result = await window.api.collections.importFromJSON(filePath, {
      targetFolderId: null,
      conflictResolution: 'rename',
      preserveUUID: true
    });

    if (result.success) {
      const message = result.data.conflicts?.length > 0
        ? `Imported with ${result.data.conflicts.length} conflicts resolved`
        : `Imported ${result.data.itemsImported} items successfully`;

      this.showSuccess(message);
      await this.loadFolderTree(); // Refresh
    }
  } catch (error) {
    this.showError(`Import failed: ${error.message}`);
  }
}
```

---

### Task 4: Implement Special Views

**Problem:** Starred and Archived views show counts but do nothing when clicked

**Location:** `src/components/folder-browser.js`

#### 4.1: Add Click Handlers

Find the special views rendering (around line 150-180) and add click handlers:

```javascript
// In renderTree() method, special views section
const specialViewsHTML = `
  <div class="special-views">
    <div class="special-view-item" data-view="starred" style="cursor: pointer;">
      <span class="icon">⭐</span>
      <span class="label">Starred Collections</span>
      <span class="count">${starredCount}</span>
    </div>
    <div class="special-view-item" data-view="archived" style="cursor: pointer;">
      <span class="icon">🗑️</span>
      <span class="label">Archived</span>
      <span class="count">${archivedCount}</span>
    </div>
  </div>
`;

// Add event listeners
document.querySelectorAll('.special-view-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    this.showSpecialView(view);
  });
});
```

#### 4.2: Implement Show Special View Method

```javascript
async showSpecialView(viewType) {
  try {
    let collections = [];

    if (viewType === 'starred') {
      const result = await window.api.database.getCollections(1000, 0);
      collections = result.filter(c => c.starred === 1);
    } else if (viewType === 'archived') {
      const result = await window.api.database.getCollections(1000, 0);
      collections = result.filter(c => c.archived === 1);
    }

    // Render collections in a modal or dedicated panel
    this.renderSpecialViewModal(viewType, collections);

  } catch (error) {
    this.showError(`Failed to load ${viewType} view: ${error.message}`);
  }
}

renderSpecialViewModal(viewType, collections) {
  const title = viewType === 'starred' ? 'Starred Collections' : 'Archived Collections';
  const icon = viewType === 'starred' ? '⭐' : '🗑️';

  const modalHTML = `
    <div class="modal-overlay" id="special-view-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${icon} ${title}</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          ${collections.length === 0
            ? `<p class="empty-state">No ${viewType} collections</p>`
            : collections.map(c => `
                <div class="collection-list-item" data-collection-id="${c.id}">
                  <span class="collection-name">${c.search_term}</span>
                  <span class="collection-count">${c.video_count || 0} items</span>
                </div>
              `).join('')
          }
        </div>
      </div>
    </div>
  `;

  // Add to document
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Close handlers
  document.getElementById('special-view-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
      document.getElementById('special-view-modal').remove();
    }
  });

  // Collection click handlers
  document.querySelectorAll('.collection-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const collectionId = parseInt(item.dataset.collectionId);
      this.openCollection(collectionId);
      document.getElementById('special-view-modal').remove();
    });
  });
}
```

#### 4.3: Add Modal Styles

**In:** `src/styles/folder-browser.css` (add at end)

```css
/* Special View Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-secondary, #1e293b);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #f1f5f9);
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--text-secondary, #94a3b8);
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
}

.modal-close:hover {
  color: var(--text-primary, #f1f5f9);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.collection-list-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;
}

.collection-list-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.collection-name {
  font-weight: 500;
  color: var(--text-primary, #f1f5f9);
}

.collection-count {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.empty-state {
  text-align: center;
  color: var(--text-secondary, #94a3b8);
  padding: 40px 20px;
  font-style: italic;
}
```

---

### Task 5: Collection Viewer Integration

**Problem:** Clicking a collection just logs to console

**Solution:** Integrate with existing collection viewer

**Find:** `openCollection()` method in folder-browser.js

```javascript
openCollection(collectionId) {
  // Option 1: If collection viewer exists as separate component
  if (window.CollectionViewer) {
    window.CollectionViewer.show(collectionId);
  }

  // Option 2: If using existing viewer in index-advanced.html
  else if (typeof loadCollection === 'function') {
    loadCollection(collectionId);
  }

  // Option 3: Emit event for other components to handle
  else {
    document.dispatchEvent(new CustomEvent('collection:open', {
      detail: { collectionId }
    }));
  }

  // Also show toast
  this.showInfo(`Opening collection #${collectionId}...`);
}
```

**Test which option works** by checking the existing codebase for collection viewing logic.

---

## SUCCESS CRITERIA

### Must Complete ✅

- [ ] Stub file removed OR fixed to match API
- [ ] Toast notification system working
- [ ] File picker dialogs for export/import
- [ ] Special views (Starred, Archived) functional
- [ ] Collection viewer integration working
- [ ] No console errors
- [ ] Professional UX (smooth animations, good feedback)

### Quality Bar

- [ ] Matches existing dark theme
- [ ] Accessible (ARIA attributes)
- [ ] Responsive design
- [ ] Smooth animations
- [ ] Clear user feedback for all actions

---

## DELIVERABLES

When complete, create: `docs/AGENT_B_COMPLETION_REPORT.md`

**Include:**
1. Summary of what was implemented
2. Screenshots or descriptions of UI features
3. How toast system works
4. How special views work
5. Integration points verified
6. Known limitations
7. Time spent vs estimated

---

## TESTING CHECKLIST

### Toast Notifications
```javascript
// Test in console
window.toastNotification.success('Test success message');
window.toastNotification.error('Test error message');
window.toastNotification.info('Test info with action', {
  action: {
    label: 'Click Me',
    callback: () => console.log('Action clicked!')
  }
});
```

### File Pickers
- Create a folder
- Right-click → Export
- Should see native save dialog
- Select location and export
- Toast should show success

### Special Views
- Click "Starred Collections"
- Should see modal with starred items
- Click a collection
- Should open collection viewer

---

## COORDINATION WITH AGENT A

**Agent A is working on:**
- Backend services (collection-exporter.js, collection-importer.js)
- Database methods

**No conflicts expected** because:
- You work on src/components/* (frontend)
- Agent A works on src/services/* (backend)

**If you need backend changes:**
- Wait for Agent A to complete
- OR coordinate via consultant

---

## IMPORTANT NOTES

### What You Should NOT Do

- ❌ Don't modify backend services (collection-exporter.js, etc.)
- ❌ Don't change database methods
- ❌ Don't modify API contract
- ❌ Don't change IPC handlers (unless adding dialog)

### What You SHOULD Do

- ✅ Follow existing UI patterns
- ✅ Match dark theme colors
- ✅ Test all interactions in browser
- ✅ Add accessibility features
- ✅ Document decisions

---

## TIMELINE

**Estimated:** 6-8 hours

**Breakdown:**
- Read docs: 1 hour
- Fix stub integration: 0.5 hours
- Implement toast system: 2-3 hours
- Add file pickers: 1-2 hours
- Implement special views: 1-2 hours
- Collection viewer integration: 0.5 hours
- Testing and polish: 1-2 hours
- Documentation: 0.5 hours

**Start ASAP, target completion: Within 2 days**

---

Good luck! The frontend is almost there - you're adding the professional polish that makes it production-ready.

**Remember:** UX matters. Every interaction should feel smooth and provide clear feedback.

---

**Handoff Date:** October 6, 2025
**Start When:** Consultant approval received
