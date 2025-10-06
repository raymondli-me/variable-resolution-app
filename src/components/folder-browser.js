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

      // Click to view collection (existing functionality)
      item.addEventListener('click', () => {
        // Trigger existing collection viewer
        // This would integrate with existing collection viewing code
        console.log('Open collection:', collectionId);
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
    // TODO: Implement toast notification
  }

  showError(message) {
    console.error('✗', message);
    // TODO: Implement toast notification
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
