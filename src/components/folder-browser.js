/**
 * Folder Browser Component
 * Hierarchical tree view for organizing collections into folders
 */
class FolderBrowser {
  constructor() {
    this.currentFolderId = null;  // null = root level
    this.expandedFolders = new Set();  // Track which folders are expanded
    this.selectedItem = null;  // Currently selected folder or collection
    this.contextMenu = null;
    this.contextMenuTarget = null;

    this.initializeElements();
    this.attachEventListeners();
    this.loadFolderTree();
  }

  initializeElements() {
    this.treeContainer = document.getElementById('folder-tree');
    this.createFolderBtn = document.getElementById('create-folder-btn');
    this.importCollectionBtn = document.getElementById('import-collection-btn');
    this.exportDatabaseBtn = document.getElementById('export-database-btn');
    this.contextMenu = document.getElementById('folder-context-menu');

    if (!this.treeContainer) {
      console.error('Folder tree container not found');
      return;
    }
  }

  attachEventListeners() {
    // Create folder button
    if (this.createFolderBtn) {
      this.createFolderBtn.addEventListener('click', () => this.createFolder());
    }

    // Import collection button
    if (this.importCollectionBtn) {
      this.importCollectionBtn.addEventListener('click', () => this.importCollection());
    }

    // Export database button
    if (this.exportDatabaseBtn) {
      this.exportDatabaseBtn.addEventListener('click', () => this.exportDatabaseToSQLite());
    }

    // Context menu actions
    if (this.contextMenu) {
      this.contextMenu.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action && this.contextMenuTarget) {
          this.handleContextMenuAction(action);
        }
        this.hideContextMenu();
      });
    }

    // Close context menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // Prevent default context menu
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.folder-item') || e.target.closest('.collection-item')) {
        e.preventDefault();
      }
    });
  }

  async loadFolderTree(folderId = null) {
    try {
      const result = await window.api.folders.getContents(folderId);
      if (!result.success) {
        console.error('Failed to load folder contents:', result.error);
        this.showError('Failed to load folders');
        return;
      }

      const { folders, collections } = result.data;
      await this.renderTree(folders, collections, folderId);
    } catch (error) {
      console.error('Error loading folder tree:', error);
      this.showError('Error loading folder tree');
    }
  }

  async renderTree(folders, collections, parentId) {
    if (!this.treeContainer) return;

    // If rendering root, clear container
    if (parentId === null) {
      this.treeContainer.innerHTML = '';
    }

    const container = parentId === null ? this.treeContainer : document.querySelector(`[data-folder-id="${parentId}"] + .folder-children`);
    if (!container) return;

    let html = '';

    // Render folders first
    for (const folder of folders) {
      const isExpanded = this.expandedFolders.has(folder.id);
      const arrowClass = isExpanded ? 'expanded' : '';

      html += `
        <div class="folder-item-wrapper" data-folder-id="${folder.id}">
          <div class="folder-item"
               data-folder-id="${folder.id}"
               draggable="true">
            <span class="expand-arrow ${arrowClass}">▶</span>
            <span class="folder-icon">📁</span>
            <span class="folder-name">${this.escapeHtml(folder.name)}</span>
            <span class="folder-count">(${folder.collection_count || 0})</span>
          </div>
          <div class="folder-children" style="display: ${isExpanded ? 'block' : 'none'};">
            ${isExpanded ? '<div class="loading">Loading...</div>' : ''}
          </div>
        </div>
      `;
    }

    // Render collections
    for (const collection of collections) {
      const starredClass = collection.starred ? 'starred' : '';
      const archivedClass = collection.archived ? 'archived' : '';

      html += `
        <div class="collection-item ${starredClass} ${archivedClass}"
             data-collection-id="${collection.id}"
             draggable="true">
          <span class="collection-icon">📊</span>
          <span class="collection-name">${this.escapeHtml(collection.search_term)}</span>
          <span class="collection-count">${collection.video_count || 0} items</span>
        </div>
      `;
    }

    // Render special views at root level
    if (parentId === null) {
      html += await this.renderSpecialViews();
    }

    if (parentId === null) {
      this.treeContainer.innerHTML = html;
    } else {
      container.innerHTML = html;
    }

    // Attach event listeners to rendered elements
    this.attachTreeEventListeners();

    // Load expanded folders' contents
    for (const folder of folders) {
      if (this.expandedFolders.has(folder.id)) {
        await this.loadFolderContents(folder.id);
      }
    }
  }

  async renderSpecialViews() {
    let html = '<div class="special-view">';

    // Get starred collections count
    try {
      const allCollections = await window.api.database.getCollections(1000, 0);
      const starredCount = allCollections.filter(c => c.starred).length;
      const archivedCount = allCollections.filter(c => c.archived).length;

      html += `
        <div class="special-view-item" data-view="starred">
          <span class="special-icon">⭐</span>
          <span class="special-name">Starred Collections</span>
          <span class="special-count">(${starredCount})</span>
        </div>
        <div class="special-view-item" data-view="archived">
          <span class="special-icon">🗑️</span>
          <span class="special-name">Archived</span>
          <span class="special-count">(${archivedCount})</span>
        </div>
      `;
    } catch (error) {
      console.error('Error loading special views:', error);
    }

    html += '</div>';
    return html;
  }

  attachTreeEventListeners() {
    // Folder expand/collapse
    const folderItems = this.treeContainer.querySelectorAll('.folder-item');
    folderItems.forEach(item => {
      const folderId = parseInt(item.dataset.folderId);

      // Click to expand/collapse
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.folder-name')) {
          this.toggleFolderExpand(folderId);
        }
      });

      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, folderId, 'folder');
      });

      // Drag events
      item.addEventListener('dragstart', (e) => this.onDragStart(e, folderId, 'folder'));
      item.addEventListener('dragover', (e) => this.onDragOver(e));
      item.addEventListener('dragleave', (e) => this.onDragLeave(e));
      item.addEventListener('drop', (e) => this.onDrop(e, folderId));
    });

    // Collection items
    const collectionItems = this.treeContainer.querySelectorAll('.collection-item');
    collectionItems.forEach(item => {
      const collectionId = parseInt(item.dataset.collectionId);

      // Click to view collection - detect PDF vs YouTube collections
      item.addEventListener('click', async () => {
        await this.openCollection(collectionId);
      });

      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, collectionId, 'collection');
      });

      // Drag events
      item.addEventListener('dragstart', (e) => this.onDragStart(e, collectionId, 'collection'));
    });

    // Special view items
    const specialItems = this.treeContainer.querySelectorAll('.special-view-item');
    specialItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.showSpecialView(view);
      });
    });
  }

  async loadFolderContents(folderId) {
    try {
      const result = await window.api.folders.getContents(folderId);
      if (!result.success) {
        console.error('Failed to load folder contents:', result.error);
        return;
      }

      const { folders, collections } = result.data;
      await this.renderTree(folders, collections, folderId);
    } catch (error) {
      console.error('Error loading folder contents:', error);
    }
  }

  toggleFolderExpand(folderId) {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }

    const wrapper = this.treeContainer.querySelector(`[data-folder-id="${folderId}"]`);
    if (wrapper) {
      const arrow = wrapper.querySelector('.expand-arrow');
      const children = wrapper.nextElementSibling;

      if (this.expandedFolders.has(folderId)) {
        arrow.classList.add('expanded');
        if (children && children.classList.contains('folder-children')) {
          children.style.display = 'block';
          this.loadFolderContents(folderId);
        }
      } else {
        arrow.classList.remove('expanded');
        if (children && children.classList.contains('folder-children')) {
          children.style.display = 'none';
        }
      }
    }
  }

  async createFolder() {
    const name = prompt('Enter folder name:');
    if (!name || !name.trim()) return;

    try {
      const result = await window.api.folders.create(name.trim(), this.currentFolderId, {
        color: '#6366f1'
      });

      if (result.success) {
        await this.loadFolderTree(this.currentFolderId);
        this.showSuccess('Folder created successfully');
      } else {
        this.showError('Failed to create folder: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      this.showError('Error creating folder');
    }
  }

  async renameFolder(folderId) {
    const folder = await this.getFolder(folderId);
    if (!folder) return;

    const newName = prompt('Enter new folder name:', folder.name);
    if (!newName || !newName.trim() || newName === folder.name) return;

    try {
      const result = await window.api.folders.rename(folderId, newName.trim());
      if (result.success) {
        await this.loadFolderTree(this.currentFolderId);
        this.showSuccess('Folder renamed successfully');
      } else {
        this.showError('Failed to rename folder: ' + result.error);
      }
    } catch (error) {
      console.error('Error renaming folder:', error);
      this.showError('Error renaming folder');
    }
  }

  async deleteFolder(folderId) {
    const confirmed = confirm('Delete this folder? (Collections and subfolders will be moved to parent)');
    if (!confirmed) return;

    try {
      const result = await window.api.folders.delete(folderId, false);  // cascade=false
      if (result.success) {
        await this.loadFolderTree(this.currentFolderId);
        this.showSuccess('Folder deleted successfully');
      } else {
        this.showError('Failed to delete folder: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      this.showError('Error deleting folder');
    }
  }

  async archiveFolder(folderId) {
    try {
      const result = await window.api.folders.archive(folderId, true);
      if (result.success) {
        await this.loadFolderTree(this.currentFolderId);
        this.showSuccess('Folder archived successfully');
      } else {
        this.showError('Failed to archive folder: ' + result.error);
      }
    } catch (error) {
      console.error('Error archiving folder:', error);
      this.showError('Error archiving folder');
    }
  }

  async starCollection(collectionId) {
    try {
      const result = await window.api.collections.star(collectionId, true);
      if (result.success) {
        await this.loadFolderTree(this.currentFolderId);
        this.showSuccess('Collection starred');
      }
    } catch (error) {
      console.error('Error starring collection:', error);
      this.showError('Error starring collection');
    }
  }

  async archiveCollection(collectionId) {
    try {
      const result = await window.api.collections.archive(collectionId, true);
      if (result.success) {
        await this.loadFolderTree(this.currentFolderId);
        this.showSuccess('Collection archived');
      }
    } catch (error) {
      console.error('Error archiving collection:', error);
      this.showError('Error archiving collection');
    }
  }

  showContextMenu(event, itemId, itemType) {
    if (!this.contextMenu) return;

    this.contextMenuTarget = { id: itemId, type: itemType };

    // Update menu items based on type
    const menuItems = this.contextMenu.querySelectorAll('.context-menu-item');
    menuItems.forEach(item => {
      const action = item.dataset.action;

      // Show/hide items based on context
      if (itemType === 'folder') {
        item.style.display = ['rename', 'delete', 'archive', 'color', 'export'].includes(action) ? 'block' : 'none';
      } else if (itemType === 'collection') {
        item.style.display = ['star', 'archive', 'move', 'export'].includes(action) ? 'block' : 'none';
      }
    });

    // Position menu at click location
    this.contextMenu.style.display = 'block';
    this.contextMenu.style.left = event.pageX + 'px';
    this.contextMenu.style.top = event.pageY + 'px';
  }

  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
    this.contextMenuTarget = null;
  }

  async handleContextMenuAction(action) {
    if (!this.contextMenuTarget) return;

    const { id, type } = this.contextMenuTarget;

    if (type === 'folder') {
      switch (action) {
        case 'rename':
          await this.renameFolder(id);
          break;
        case 'delete':
          await this.deleteFolder(id);
          break;
        case 'archive':
          await this.archiveFolder(id);
          break;
        case 'color':
          // TODO: Implement color picker
          console.log('Color picker not implemented yet');
          break;
        case 'export':
          await this.exportFolderToZIP(id);
          break;
      }
    } else if (type === 'collection') {
      switch (action) {
        case 'star':
          await this.starCollection(id);
          break;
        case 'archive':
          await this.archiveCollection(id);
          break;
        case 'move':
          // TODO: Implement move dialog
          console.log('Move dialog not implemented yet');
          break;
        case 'export':
          await this.exportCollectionToJSON(id);
          break;
      }
    }
  }

  /**
   * Open collection - routes to appropriate viewer based on type
   */
  async openCollection(collectionId) {
    try {
      const collection = await window.api.database.getCollection(collectionId);
      if (!collection) {
        this.showError('Collection not found');
        return;
      }

      // Check collection type - handle settings being string or already-parsed object
      const settings = typeof collection.settings === 'string'
        ? JSON.parse(collection.settings || '{}')
        : (collection.settings || {});
      const isPDF = settings.type === 'pdf';

      if (isPDF) {
        // Route to dedicated PDF excerpt viewer
        if (window.pdfExcerptViewer) {
          window.pdfExcerptViewer.show(collectionId);
        } else {
          console.warn('PDF excerpt viewer not loaded, falling back to collection viewer');
          if (window.collectionViewer) {
            window.collectionViewer.show(collectionId);
          }
        }
      } else {
        // Route to regular collection viewer (for YouTube videos)
        if (window.collectionViewer) {
          window.collectionViewer.show(collectionId);
        } else {
          this.showError('Collection viewer not loaded');
        }
      }
    } catch (error) {
      console.error('Error opening collection:', error);
      this.showError('Error opening collection: ' + error.message);
    }
  }

  // ============================================
  // EXPORT/IMPORT METHODS
  // ============================================

  async exportCollectionToJSON(collectionId) {
    // In production, this would open a file picker dialog
    // For now, use a fixed path for testing
    const outputPath = `/Users/raymondli701/Desktop/exports/collection-${collectionId}.json`;

    try {
      const result = await window.api.collections.exportToJSON(collectionId, outputPath);

      if (result.success) {
        this.showSuccess(`Collection exported to ${result.data.filePath} (${result.data.itemCount} items, ${(result.data.fileSize / 1024).toFixed(1)} KB)`);
        console.log('Export result:', result.data);
      } else {
        this.showError(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showError(`Export error: ${error.message}`);
    }
  }

  async exportFolderToZIP(folderId) {
    const outputPath = `/Users/raymondli701/Desktop/exports/folder-${folderId}.zip`;

    try {
      const result = await window.api.folders.exportToZIP(folderId, outputPath, {
        includeSubfolders: true,
        includeArchived: false
      });

      if (result.success) {
        this.showSuccess(
          `Folder exported: ${result.data.collectionCount} collections in ${result.data.folderCount} folders (${(result.data.fileSize / 1024).toFixed(1)} KB)`
        );
        console.log('Export result:', result.data);
      } else {
        this.showError(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showError(`Export error: ${error.message}`);
    }
  }

  async exportDatabaseToSQLite() {
    const outputPath = `/Users/raymondli701/Desktop/exports/database-backup.db`;

    try {
      const result = await window.api.database.exportToSQLite(outputPath);

      if (result.success) {
        this.showSuccess(
          `Database exported: ${result.data.tableCount} tables, ${result.data.totalRecords} records (${(result.data.fileSize / 1024 / 1024).toFixed(1)} MB)`
        );
        console.log('Export result:', result.data);
      } else {
        this.showError(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showError(`Export error: ${error.message}`);
    }
  }

  async importCollection() {
    // In production, this would open a file picker
    // For now, use a mock path
    const filePath = '/Users/raymondli701/Desktop/exports/sample-export.json';

    try {
      const result = await window.api.collections.importFromJSON(filePath, {
        targetFolderId: null,
        conflictResolution: 'rename',
        preserveUUID: true
      });

      if (result.success) {
        const conflictMsg = result.data.conflicts.length > 0
          ? ` (${result.data.conflicts.length} conflicts resolved)`
          : '';

        this.showSuccess(
          `Imported ${result.data.itemsImported} items to collection #${result.data.collectionId}${conflictMsg}`
        );
        console.log('Import result:', result.data);

        // Refresh tree to show new collection
        await this.loadFolderTree();
      } else {
        this.showError(`Import failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      this.showError(`Import error: ${error.message}`);
    }
  }

  async importFolder() {
    const filePath = '/Users/raymondli701/Desktop/exports/sample-folder.zip';

    try {
      const result = await window.api.folders.importFromZIP(filePath, {
        targetFolderId: null,
        conflictResolution: 'rename',
        recreateFolderStructure: true
      });

      if (result.success) {
        this.showSuccess(
          `Imported ${result.data.collectionsImported} collections in ${result.data.foldersCreated} folders (${result.data.totalItems} total items)`
        );
        console.log('Import result:', result.data);

        // Refresh tree
        await this.loadFolderTree();
      } else {
        this.showError(`Import failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      this.showError(`Import error: ${error.message}`);
    }
  }

  // Drag-and-drop handlers
  onDragStart(event, itemId, itemType) {
    event.dataTransfer.setData('itemId', itemId.toString());
    event.dataTransfer.setData('itemType', itemType);
    event.dataTransfer.effectAllowed = 'move';

    // Add dragging class
    event.target.classList.add('dragging');
  }

  onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Highlight drop target
    const folderItem = event.target.closest('.folder-item');
    if (folderItem) {
      folderItem.classList.add('drag-over');
    }
  }

  onDragLeave(event) {
    const folderItem = event.target.closest('.folder-item');
    if (folderItem) {
      folderItem.classList.remove('drag-over');
    }
  }

  async onDrop(event, targetFolderId) {
    event.preventDefault();

    const itemId = parseInt(event.dataTransfer.getData('itemId'));
    const itemType = event.dataTransfer.getData('itemType');

    // Remove drag styling
    const folderItem = event.target.closest('.folder-item');
    if (folderItem) {
      folderItem.classList.remove('drag-over');
    }

    document.querySelectorAll('.dragging').forEach(el => {
      el.classList.remove('dragging');
    });

    try {
      if (itemType === 'folder') {
        const result = await window.api.folders.move(itemId, targetFolderId);
        if (result.success) {
          await this.loadFolderTree(this.currentFolderId);
          this.showSuccess('Folder moved successfully');
        } else {
          this.showError('Failed to move folder: ' + result.error);
        }
      } else if (itemType === 'collection') {
        const result = await window.api.collections.moveToFolder(itemId, targetFolderId);
        if (result.success) {
          await this.loadFolderTree(this.currentFolderId);
          this.showSuccess('Collection moved successfully');
        } else {
          this.showError('Failed to move collection: ' + result.error);
        }
      }
    } catch (error) {
      console.error('Error during drop:', error);
      this.showError('Error moving item');
    }
  }

  async showSpecialView(viewType) {
    try {
      const allCollections = await window.api.database.getCollections(1000, 0);
      let filtered;

      if (viewType === 'starred') {
        filtered = allCollections.filter(c => c.starred);
      } else if (viewType === 'archived') {
        filtered = allCollections.filter(c => c.archived);
      }

      // Render filtered collections
      // TODO: Implement special view rendering
      console.log(`Showing ${viewType} view:`, filtered);
    } catch (error) {
      console.error('Error showing special view:', error);
      this.showError('Error loading special view');
    }
  }

  async getFolder(folderId) {
    try {
      const result = await window.api.folders.get(folderId);
      if (result.success) {
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting folder:', error);
      return null;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showSuccess(message) {
    console.log('✓', message);
    if (window.toastNotification) {
      window.toastNotification.success(message);
    }
  }

  showError(message) {
    console.error('✗', message);
    if (window.toastNotification) {
      window.toastNotification.error(message);
    }
  }

  showInfo(message) {
    console.log('ℹ', message);
    if (window.toastNotification) {
      window.toastNotification.info(message);
    }
  }

  // ========== NEW COLLECTION WORKFLOW METHODS ==========

  /**
   * Show the main "New Collection" modal with source selection
   */
  showNewCollectionModal() {
    this.showSourceSelectionModal();
  }

  /**
   * Show source selection modal (YouTube, PDF, Reddit, News)
   */
  showSourceSelectionModal() {
    const modalHTML = `
      <div class="modal-overlay" id="source-selection-modal">
        <div class="modal-content source-selection-content">
          <div class="modal-header">
            <h3>Create New Collection</h3>
            <button class="close-btn" onclick="document.getElementById('source-selection-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="source-grid">
              <button class="source-card" onclick="window.folderBrowser.showYouTubeForm()">
                <div class="source-icon">📹</div>
                <h4>YouTube</h4>
                <p>Search and collect YouTube videos with comments</p>
              </button>

              <button class="source-card" onclick="window.folderBrowser.showPDFForm()">
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

            <hr style="margin: 24px 0;" />

            <h4>Or, transform an existing collection:</h4>
            <div class="transform-actions">
              <button class="action-btn" onclick="window.folderBrowser.showDuplicateForm()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                </svg>
                Duplicate Collection
              </button>

              <button class="action-btn" onclick="window.folderBrowser.showSubsampleForm()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
                </svg>
                Random Subsample
              </button>

              <button class="action-btn" onclick="window.folderBrowser.showFilterForm()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                Filter by Criteria
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Close on background click
    const modal = document.getElementById('source-selection-modal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Show YouTube collection creation form
   */
  async showYouTubeForm() {
    // Close source selection modal
    document.getElementById('source-selection-modal')?.remove();

    const modalHTML = `
      <div class="modal-overlay" id="youtube-form-modal">
        <div class="modal-content youtube-form-content">
          <div class="modal-header">
            <h3>Create YouTube Collection</h3>
            <button class="close-btn" onclick="document.getElementById('youtube-form-modal').remove()">×</button>
          </div>
          <div class="modal-body">
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

              <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="document.getElementById('youtube-form-modal').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Collection</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('youtube-form-modal');
    const form = document.getElementById('youtubeCollectionForm');

    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createYouTubeCollection({
        searchTerm: document.getElementById('searchTerm').value,
        maxResults: parseInt(document.getElementById('maxResults').value),
        orderBy: document.getElementById('orderBy').value,
        includeComments: document.getElementById('includeComments').checked,
        maxComments: parseInt(document.getElementById('maxComments').value)
      });
    });

    // Toggle comment options
    document.getElementById('includeComments').addEventListener('change', (e) => {
      document.getElementById('commentOptions').style.display = e.target.checked ? 'block' : 'none';
    });
  }

  /**
   * Create YouTube collection (uses existing search→collect workflow)
   */
  async createYouTubeCollection(params) {
    try {
      this.showInfo('Searching YouTube...');
      document.getElementById('youtube-form-modal')?.remove();

      // Get API key
      const apiKeyResult = await window.api.settings.getApiKey('youtube');
      if (!apiKeyResult?.success || !apiKeyResult.apiKey) {
        this.showError('YouTube API key not configured. Please add it in Settings.');
        return;
      }

      // Step 1: Search YouTube
      const searchOptions = {
        apiKey: apiKeyResult.apiKey,
        maxResults: params.maxResults,
        orderBy: params.orderBy
      };

      const searchResult = await window.api.youtube.search({
        searchTerm: params.searchTerm,
        options: searchOptions
      });

      if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
        this.showError('No videos found for this search term');
        return;
      }

      // Step 2: Collect all videos
      this.showInfo(`Found ${searchResult.data.length} videos. Starting collection...`);

      const collectOptions = {
        apiKey: apiKeyResult.apiKey,
        searchTerm: params.searchTerm,
        includeComments: params.includeComments,
        maxComments: params.maxComments,
        downloadVideo: false, // Don't download by default
        downloadThumbnail: true
      };

      const jobId = `job_${Date.now()}`;
      const collectResult = await window.api.youtube.collect({
        jobId,
        videos: searchResult.data,
        options: collectOptions
      });

      if (collectResult.success) {
        this.showSuccess(`Collection "${params.searchTerm}" created with ${searchResult.data.length} videos!`);
        this.loadFolderTree();
      } else {
        this.showError(`Collection failed: ${collectResult.error}`);
      }
    } catch (error) {
      console.error('[FolderBrowser] YouTube collection creation failed:', error);
      this.showError('Error creating collection: ' + error.message);
    }
  }

  /**
   * Show PDF upload form
   */
  async showPDFForm() {
    // Close source selection modal
    document.getElementById('source-selection-modal')?.remove();

    const modalHTML = `
      <div class="modal-overlay" id="pdf-form-modal">
        <div class="modal-content pdf-form-content">
          <div class="modal-header">
            <h3>Upload PDF Document</h3>
            <button class="close-btn" onclick="document.getElementById('pdf-form-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <form id="pdfUploadForm">
              <div class="form-group">
                <label>Collection Name *</label>
                <input type="text" id="pdfCollectionNameModal" placeholder="e.g., Research Papers" required />
              </div>

              <div class="form-group">
                <label>Select PDF File *</label>
                <div class="file-upload-area" id="pdfDropZoneModal">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <p>Drag & drop PDF here or click to browse</p>
                  <input type="file" id="pdfFileInputModal" accept=".pdf" style="display: none;" />
                  <button type="button" class="btn" onclick="document.getElementById('pdfFileInputModal').click()">
                    Choose File
                  </button>
                  <div id="selectedFileNameModal" style="margin-top: 12px; color: #4ade80;"></div>
                </div>
              </div>

              <div class="form-group">
                <label>Document Title (Optional)</label>
                <input type="text" id="pdfTitleModal" placeholder="Will use filename if not provided" />
              </div>

              <div class="form-group">
                <label>Chunking Strategy</label>
                <select id="pdfChunkingStrategyModal">
                  <option value="page">Page-based (one excerpt per page)</option>
                  <option value="sentence" selected>Sentence-based (recommended for visual highlighting)</option>
                  <option value="paragraph">Paragraph-based</option>
                  <option value="section">Section-based</option>
                  <option value="fixed">Fixed size (500 words)</option>
                </select>
                <small style="color: #808080; display: block; margin-top: 4px;">
                  Sentence-based chunking provides the best granularity for visual PDF viewer with highlighting
                </small>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="document.getElementById('pdf-form-modal').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary" id="uploadPDFBtnModal">Upload & Process</button>
              </div>
            </form>

            <div id="uploadProgressModal" style="display: none; margin-top: 20px;">
              <div class="progress-bar">
                <div class="progress-fill" id="progressFillModal" style="width: 0%;"></div>
              </div>
              <p id="progressTextModal">Uploading...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('pdf-form-modal');
    const fileInput = document.getElementById('pdfFileInputModal');
    const dropZone = document.getElementById('pdfDropZoneModal');
    let selectedFile = null;

    // File selection handler
    fileInput.addEventListener('change', (e) => {
      selectedFile = e.target.files[0];
      if (selectedFile) {
        document.getElementById('selectedFileNameModal').textContent = `📄 ${selectedFile.name}`;
      }
    });

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        selectedFile = files[0];
        fileInput.files = files;
        document.getElementById('selectedFileNameModal').textContent = `📄 ${files[0].name}`;
      }
    });

    // Form submission
    document.getElementById('pdfUploadForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!selectedFile) {
        this.showError('Please select a PDF file');
        return;
      }

      await this.uploadPDFFromModal({
        file: selectedFile,
        collectionName: document.getElementById('pdfCollectionNameModal').value,
        title: document.getElementById('pdfTitleModal').value || selectedFile.name.replace(/\.pdf$/i, ''),
        chunkingStrategy: document.getElementById('pdfChunkingStrategyModal').value
      });
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Upload PDF from folder browser modal
   */
  async uploadPDFFromModal(params) {
    try {
      // Show progress
      document.getElementById('pdfUploadForm').style.display = 'none';
      document.getElementById('uploadProgressModal').style.display = 'block';
      const progressFill = document.getElementById('progressFillModal');
      const progressText = document.getElementById('progressTextModal');

      // Step 1: Create collection
      progressText.textContent = 'Creating collection...';
      progressFill.style.width = '10%';

      const createResult = await window.api.collections.createPDFCollection({ name: params.collectionName });
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create collection');
      }

      const collectionId = createResult.collectionId;

      // Step 2: Upload PDF
      progressText.textContent = 'Uploading PDF...';
      progressFill.style.width = '30%';

      const uploadResult = await window.api.pdf.upload({
        filePath: params.file.path,
        collectionId,
        title: params.title,
        chunkingStrategy: params.chunkingStrategy,
        chunkSize: 500
      });

      if (uploadResult.success) {
        progressText.textContent = 'PDF processed successfully!';
        progressFill.style.width = '100%';

        this.showSuccess(`PDF collection "${params.collectionName}" created with ${uploadResult.excerpts} excerpts!`);

        // Reload folder tree
        this.loadFolderTree();

        // Close modal after short delay
        setTimeout(() => {
          document.getElementById('pdf-form-modal')?.remove();
        }, 1500);
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    } catch (error) {
      console.error('[FolderBrowser] PDF upload failed:', error);
      this.showError('Error uploading PDF: ' + error.message);
      document.getElementById('pdfUploadForm').style.display = 'block';
      document.getElementById('uploadProgressModal').style.display = 'none';
    }
  }

  /**
   * Show collection duplication form
   */
  async showDuplicateForm() {
    document.getElementById('source-selection-modal')?.remove();

    // Get all collections
    const collections = await window.api.database.getCollections(1000, 0);

    const modalHTML = `
      <div class="modal-overlay" id="duplicate-form-modal">
        <div class="modal-content youtube-form-content">
          <div class="modal-header">
            <h3>Duplicate Collection</h3>
            <button class="close-btn" onclick="document.getElementById('duplicate-form-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <form id="duplicateForm">
              <div class="form-group">
                <label>Select Collection to Duplicate *</label>
                <select id="sourceCollection" required>
                  <option value="">-- Choose Collection --</option>
                  ${collections.map(c => `
                    <option value="${c.id}">${this.escapeHtml(c.search_term)} (${c.video_count || 0} videos)</option>
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

              <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="document.getElementById('duplicate-form-modal').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">Duplicate</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('duplicateForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.duplicateCollection({
        sourceId: parseInt(document.getElementById('sourceCollection').value),
        newName: document.getElementById('newCollectionName').value,
        includeComments: document.getElementById('includeComments').checked
      });
    });
  }

  async duplicateCollection(params) {
    try {
      this.showInfo('Duplicating collection...');
      document.getElementById('duplicate-form-modal')?.remove();

      const result = await window.api.collections.duplicate(params);

      if (result.success) {
        this.showSuccess('Collection duplicated successfully!');
        this.loadFolderTree();
      } else {
        this.showError(`Duplication failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[FolderBrowser] Duplication failed:', error);
      this.showError('Error duplicating collection: ' + error.message);
    }
  }

  /**
   * Show random subsample form
   */
  async showSubsampleForm() {
    document.getElementById('source-selection-modal')?.remove();

    const collections = await window.api.database.getCollections(1000, 0);

    const modalHTML = `
      <div class="modal-overlay" id="subsample-form-modal">
        <div class="modal-content youtube-form-content">
          <div class="modal-header">
            <h3>Random Subsample</h3>
            <button class="close-btn" onclick="document.getElementById('subsample-form-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <form id="subsampleForm">
              <div class="form-group">
                <label>Source Collection *</label>
                <select id="sourceCollection" required>
                  <option value="">-- Choose Collection --</option>
                  ${collections.map(c => `
                    <option value="${c.id}">${this.escapeHtml(c.search_term)} (${c.video_count || 0} videos)</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label>Sample Size *</label>
                <input type="number" id="sampleSize" min="1" placeholder="e.g., 10" required />
                <small style="color: #94a3b8;">Number of videos to randomly select</small>
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

              <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="document.getElementById('subsample-form-modal').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Sample</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('subsampleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createSubsample({
        sourceId: parseInt(document.getElementById('sourceCollection').value),
        sampleSize: parseInt(document.getElementById('sampleSize').value),
        newName: document.getElementById('newCollectionName').value,
        withReplacement: document.getElementById('withReplacement').checked
      });
    });
  }

  async createSubsample(params) {
    try {
      this.showInfo('Creating subsample...');
      document.getElementById('subsample-form-modal')?.remove();

      const result = await window.api.collections.subsample(params);

      if (result.success) {
        this.showSuccess('Subsample created successfully!');
        this.loadFolderTree();
      } else {
        this.showError(`Subsample failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[FolderBrowser] Subsample failed:', error);
      this.showError('Error creating subsample: ' + error.message);
    }
  }

  /**
   * Show filter form
   */
  async showFilterForm() {
    document.getElementById('source-selection-modal')?.remove();

    const collections = await window.api.database.getCollections(1000, 0);

    const modalHTML = `
      <div class="modal-overlay" id="filter-form-modal">
        <div class="modal-content youtube-form-content">
          <div class="modal-header">
            <h3>Filter Collection</h3>
            <button class="close-btn" onclick="document.getElementById('filter-form-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <form id="filterForm">
              <div class="form-group">
                <label>Source Collection *</label>
                <select id="sourceCollection" required>
                  <option value="">-- Choose Collection --</option>
                  ${collections.map(c => `
                    <option value="${c.id}">${this.escapeHtml(c.search_term)} (${c.video_count || 0} videos)</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label>Filter Criteria</label>

                <div style="margin-bottom: 12px;">
                  <label style="font-size: 13px; color: #94a3b8;">Min Views:</label>
                  <input type="number" id="minViews" placeholder="e.g., 1000" style="margin-top: 4px;" />
                </div>

                <div style="margin-bottom: 12px;">
                  <label style="font-size: 13px; color: #94a3b8;">Min Comments:</label>
                  <input type="number" id="minComments" placeholder="e.g., 10" style="margin-top: 4px;" />
                </div>

                <div style="margin-bottom: 12px;">
                  <label style="font-size: 13px; color: #94a3b8;">Date Range:</label>
                  <select id="dateRange" style="margin-top: 4px;">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>
                </div>

                <div>
                  <label style="font-size: 13px; color: #94a3b8;">Title Contains:</label>
                  <input type="text" id="titleKeyword" placeholder="keyword" style="margin-top: 4px;" />
                </div>
              </div>

              <div class="form-group">
                <label>New Collection Name *</label>
                <input type="text" id="newCollectionName" placeholder="Filtered..." required />
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="document.getElementById('filter-form-modal').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">Apply Filter</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('filterForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.filterCollection({
        sourceId: parseInt(document.getElementById('sourceCollection').value),
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
      this.showInfo('Applying filters...');
      document.getElementById('filter-form-modal')?.remove();

      const result = await window.api.collections.filter(params);

      if (result.success) {
        this.showSuccess(`Filtered collection created with ${result.matchCount || 0} items`);
        this.loadFolderTree();
      } else {
        this.showError(`Filter failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[FolderBrowser] Filter failed:', error);
      this.showError('Error filtering collection: ' + error.message);
    }
  }
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.folderBrowser = new FolderBrowser();
  });
} else {
  window.folderBrowser = new FolderBrowser();
}
