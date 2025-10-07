/**
 * Collections Hub - Unified Collections Interface
 * Phase 1: The Unified Hub
 *
 * This component provides a card-style gallery view of all collections,
 * serving as the central hub for collection management.
 */

class CollectionsHub {
  constructor(containerId = 'collections-hub-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`CollectionsHub: Container element #${containerId} not found`);
      return;
    }
    this.collections = [];
    this.init();
  }

  async init() {
    await this.loadCollections();
    this.render();
  }

  async loadCollections() {
    try {
      const result = await window.api.collections.list();
      if (result.success) {
        this.collections = result.data;
        // Load enrichments for each collection
        await this.loadEnrichments();
      } else {
        console.error('Failed to load collections:', result.error);
        this.collections = [];
      }
    } catch (error) {
      console.error('Error loading collections:', error);
      this.collections = [];
    }
  }

  async loadEnrichments() {
    // Load enrichments (rating projects and BWS experiments) for all collections
    for (const collection of this.collections) {
      try {
        // Get rating projects for this collection
        const ratingProjects = await window.api.database.query(
          'SELECT * FROM rating_projects WHERE collection_id = ? ORDER BY created_at DESC',
          [collection.id]
        );

        collection.enrichments = {
          rating_projects: ratingProjects || [],
          bws_experiments: [] // BWS experiments to be added when available
        };
      } catch (error) {
        console.error(`Error loading enrichments for collection ${collection.id}:`, error);
        collection.enrichments = {
          rating_projects: [],
          bws_experiments: []
        };
      }
    }
  }

  getGenreIcon(collection) {
    // Parse settings to determine collection type
    try {
      if (collection.settings) {
        const settings = typeof collection.settings === 'string'
          ? JSON.parse(collection.settings)
          : collection.settings;

        if (settings.source === 'pdf' || settings.type === 'pdf') {
          return '📄';
        }
      }
    } catch (e) {
      // If parsing fails, default to YouTube icon
    }

    // Default to YouTube icon for video collections
    return '📹';
  }

  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getItemStats(collection) {
    const videoCount = collection.video_count || 0;
    const commentCount = collection.comment_count || 0;

    // For PDF collections, show excerpt count if available
    try {
      if (collection.settings) {
        const settings = typeof collection.settings === 'string'
          ? JSON.parse(collection.settings)
          : collection.settings;

        if (settings.source === 'pdf' || settings.type === 'pdf') {
          const excerptCount = collection.excerpt_count || 0;
          return excerptCount === 1 ? '1 Excerpt' : `${excerptCount} Excerpts`;
        }
      }
    } catch (e) {
      // Continue with default video stats
    }

    return videoCount === 1 ? '1 Video' : `${videoCount} Videos`;
  }

  handleViewClick(collectionId) {
    // Find the collection object
    const collection = this.collections.find(c => c.id === parseInt(collectionId));
    if (!collection) {
      console.error('Collection not found:', collectionId);
      return;
    }

    // Determine collection genre
    let isPdf = false;
    try {
      if (collection.settings) {
        const settings = typeof collection.settings === 'string'
          ? JSON.parse(collection.settings)
          : collection.settings;

        if (settings.source === 'pdf' || settings.type === 'pdf') {
          isPdf = true;
        }
      }
    } catch (e) {
      console.error('Error parsing collection settings:', e);
    }

    // Route to the appropriate viewer
    if (isPdf) {
      if (window.pdfExcerptViewer) {
        window.pdfExcerptViewer.show(collectionId);
      } else {
        console.error('PDF Excerpt Viewer not available');
      }
    } else {
      // Default to YouTube/video collection viewer
      if (window.collectionViewer) {
        window.collectionViewer.show(collectionId);
      } else {
        console.error('Collection Viewer not available');
      }
    }
  }

  handleMenuClick(collectionId, event) {
    // Close any existing context menu
    this.closeContextMenu();

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'collection-context-menu';
    menu.dataset.collectionId = collectionId;

    // Menu items
    const menuItems = [
      { label: 'Rate Collection', action: 'rate', icon: '⭐' },
      { label: 'BWS Experiment', action: 'bws', icon: '📊' },
      { label: 'Export', action: 'export', icon: '📤' },
      { label: 'Duplicate', action: 'duplicate', icon: '📋' },
      { label: 'Subsample', action: 'subsample', icon: '🎲' },
      { label: 'Filter', action: 'filter', icon: '🔍' },
      { label: 'Delete', action: 'delete', icon: '🗑️', danger: true }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('button');
      menuItem.className = `context-menu-item${item.danger ? ' danger' : ''}`;
      menuItem.innerHTML = `<span class="menu-icon">${item.icon}</span><span>${item.label}</span>`;
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleContextMenuAction(item.action, collectionId);
      });
      menu.appendChild(menuItem);
    });

    // Position menu near the button that was clicked
    document.body.appendChild(menu);
    const buttonRect = event.target.getBoundingClientRect();
    menu.style.top = `${buttonRect.bottom + 5}px`;
    menu.style.left = `${buttonRect.right - menu.offsetWidth}px`;

    // Close menu when clicking outside
    setTimeout(() => {
      document.addEventListener('click', this.closeContextMenuHandler, { once: true });
    }, 0);
  }

  closeContextMenu() {
    const existingMenu = document.querySelector('.collection-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
  }

  closeContextMenuHandler = () => {
    this.closeContextMenu();
  }

  async handleContextMenuAction(action, collectionId) {
    this.closeContextMenu();

    switch (action) {
      case 'rate':
        await this.showCreateRatingProjectModal(collectionId);
        break;
      case 'bws':
        await this.showCreateBwsModal(collectionId);
        break;
      case 'export':
        await this.exportCollection(collectionId);
        break;
      case 'duplicate':
        await this.duplicateCollection(collectionId);
        break;
      case 'subsample':
        await this.subsampleCollection(collectionId);
        break;
      case 'filter':
        await this.filterCollection(collectionId);
        break;
      case 'delete':
        await this.deleteCollection(collectionId);
        break;
    }
  }

  async showCreateRatingProjectModal(collectionId) {
    try {
      // Get modal element
      const modal = document.getElementById('create-project-modal');
      if (!modal) {
        console.error('Rating project modal not found');
        return;
      }

      // Populate collection dropdown
      const select = document.getElementById('ai-collection-select');
      if (!select) {
        console.error('Collection selector not found');
        return;
      }

      // Load all collections
      const collections = await window.api.database.getCollections(1000, 0);
      select.innerHTML = '<option value="">Choose a collection...</option>';

      collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = `${collection.search_term} (${collection.video_count || 0} videos)`;
        select.appendChild(option);
      });

      // Pre-select the collection
      select.value = collectionId;

      // Trigger change event to update item counts
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);

      // Show the modal
      modal.style.display = 'flex';

      // Setup close button handler if not already set
      const closeBtn = document.getElementById('close-create-modal');
      if (closeBtn && !closeBtn.hasAttribute('data-listener-attached')) {
        closeBtn.addEventListener('click', () => {
          modal.style.display = 'none';
        });
        closeBtn.setAttribute('data-listener-attached', 'true');
      }

      // Close modal on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });

    } catch (error) {
      console.error('Error showing rating project modal:', error);
    }
  }

  async showCreateBwsModal(collectionId) {
    try {
      // Get modal element
      const modal = document.getElementById('create-bws-modal');
      if (!modal) {
        console.error('BWS modal not found');
        return;
      }

      // Populate collection dropdown
      const select = document.getElementById('bws-collection-select');
      if (!select) {
        console.error('BWS collection selector not found');
        return;
      }

      // Load all collections
      const collections = await window.api.database.getCollections(1000, 0);
      select.innerHTML = '<option value="">Choose a collection...</option>';

      collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = `${collection.search_term} (${collection.video_count || 0} videos)`;
        select.appendChild(option);
      });

      // Set source type to 'collection' and show collection section
      const collectionRadio = document.querySelector('input[name="bws-source-type"][value="collection"]');
      if (collectionRadio) {
        collectionRadio.checked = true;
        // Trigger change to show collection section
        const event = new Event('change', { bubbles: true });
        collectionRadio.dispatchEvent(event);
      }

      // Pre-select the collection
      select.value = collectionId;

      // Trigger change event to update item counts
      const changeEvent = new Event('change', { bubbles: true });
      select.dispatchEvent(changeEvent);

      // Show the modal
      modal.style.display = 'flex';

      // Close modal on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });

    } catch (error) {
      console.error('Error showing BWS modal:', error);
    }
  }

  render() {
    // Log collection data to verify lineage tracking
    console.log('[CollectionsHub] Rendering collections:', this.collections.map(c => ({
      id: c.id,
      name: c.search_term,
      parent_collection_id: c.parent_collection_id,
      derivation_info: c.derivation_info
    })));

    if (this.collections.length === 0) {
      this.container.innerHTML = `
        <div class="hub-empty-state">
          <div class="empty-icon">📚</div>
          <h2>No Collections Yet</h2>
          <p>Create your first collection to get started</p>
        </div>
      `;
      return;
    }

    const cardsHTML = this.collections.map(collection => `
      <div class="collection-card" data-collection-id="${collection.id}">
        <div class="card-header">
          <span class="card-genre-icon">${this.getGenreIcon(collection)}</span>
          <button class="card-menu-btn" data-action="menu" data-id="${collection.id}">⋯</button>
        </div>
        <div class="card-body">
          <h3 class="card-title">${this.escapeHtml(collection.search_term)}</h3>
          <div class="card-stats">
            <span class="stat-item">${this.getItemStats(collection)}</span>
          </div>
          <div class="card-date">Created ${this.formatDate(collection.created_at)}</div>
        </div>
        <div class="card-enrichments" data-action="toggle-enrichments" data-id="${collection.id}">
          ${this.renderEnrichmentsSummary(collection)}
        </div>
        <div class="card-footer">
          <button class="card-view-btn" data-action="view" data-id="${collection.id}">View</button>
        </div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div class="hub-header">
        <h2 class="hub-title">Collections</h2>
        <p class="hub-subtitle">Browse and manage your data collections</p>
      </div>
      <div class="collection-grid">
        ${cardsHTML}
      </div>
    `;

    // Attach event listeners to buttons
    this.attachEventListeners();
  }

  renderEnrichmentsSummary(collection) {
    const enrichments = collection.enrichments || { rating_projects: [], bws_experiments: [] };
    const totalCount = enrichments.rating_projects.length + enrichments.bws_experiments.length;

    if (totalCount === 0) {
      return '<span style="color: #718096;">No enrichments</span>';
    }

    const parts = [];
    if (enrichments.rating_projects.length > 0) {
      parts.push(`${enrichments.rating_projects.length} Rating ${enrichments.rating_projects.length === 1 ? 'Project' : 'Projects'}`);
    }
    if (enrichments.bws_experiments.length > 0) {
      parts.push(`${enrichments.bws_experiments.length} BWS ${enrichments.bws_experiments.length === 1 ? 'Experiment' : 'Experiments'}`);
    }

    return `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span>${parts.join(' • ')}</span>
        <span style="font-size: 1.2em; margin-left: 8px;">▸</span>
      </div>
    `;
  }

  attachEventListeners() {
    // View button clicks
    this.container.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const collectionId = btn.dataset.id;
        this.handleViewClick(collectionId);
      });
    });

    // Menu button clicks
    this.container.querySelectorAll('[data-action="menu"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const collectionId = btn.dataset.id;
        this.handleMenuClick(collectionId, e);
      });
    });

    // Enrichments toggle clicks
    this.container.querySelectorAll('[data-action="toggle-enrichments"]').forEach(elem => {
      elem.addEventListener('click', (e) => {
        e.stopPropagation();
        const collectionId = elem.dataset.id;
        this.toggleEnrichments(collectionId, elem);
      });
    });
  }

  toggleEnrichments(collectionId, element) {
    const collection = this.collections.find(c => c.id === parseInt(collectionId));
    if (!collection || !collection.enrichments) return;

    // Check if already expanded
    const card = element.closest('.collection-card');
    const existingDetails = card.querySelector('.enrichment-details');

    if (existingDetails) {
      // Collapse
      existingDetails.remove();
      element.querySelector('span:last-child').textContent = '▸';
    } else {
      // Expand
      const enrichments = collection.enrichments;
      const detailsHtml = this.renderEnrichmentsDetails(enrichments);

      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'enrichment-details';
      detailsDiv.innerHTML = detailsHtml;

      element.after(detailsDiv);
      element.querySelector('span:last-child').textContent = '▾';
    }
  }

  renderEnrichmentsDetails(enrichments) {
    const items = [];

    enrichments.rating_projects.forEach(project => {
      const status = project.status || 'pending';
      const progress = project.total_items > 0
        ? Math.round((project.rated_items / project.total_items) * 100)
        : 0;

      items.push(`
        <div style="padding: 8px 12px; background: #374151; border-radius: 6px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 600; color: #e2e8f0;">⭐ ${this.escapeHtml(project.project_name)}</span>
            <span style="font-size: 0.75em; padding: 2px 8px; background: #4a5568; border-radius: 4px; color: #cbd5e0;">${status}</span>
          </div>
          <div style="font-size: 0.875em; color: #a0aec0;">
            Progress: ${project.rated_items}/${project.total_items} (${progress}%)
          </div>
        </div>
      `);
    });

    enrichments.bws_experiments.forEach(experiment => {
      items.push(`
        <div style="padding: 8px 12px; background: #374151; border-radius: 6px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; color: #e2e8f0;">📊 ${this.escapeHtml(experiment.name)}</span>
          </div>
        </div>
      `);
    });

    if (items.length === 0) {
      return '<div style="padding: 12px; text-align: center; color: #718096;">No enrichments</div>';
    }

    return `<div style="padding: 12px;">${items.join('')}</div>`;
  }

  async exportCollection(collectionId) {
    try {
      // Get collection info for default filename
      const collection = this.collections.find(c => c.id === parseInt(collectionId));
      const defaultFilename = collection ? `${collection.search_term}.json` : `collection-${collectionId}.json`;

      // Show save file dialog
      const result = await window.api.dialog.saveFile({
        title: 'Export Collection',
        defaultPath: defaultFilename,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      if (!result || result.canceled || !result.filePath) {
        return; // User canceled
      }

      // Export to the selected path
      const exportResult = await window.api.collections.exportToJSON(collectionId, result.filePath);

      if (exportResult.success) {
        this.showSuccess(`Collection exported successfully! ${exportResult.data.itemCount} items exported.`);
      } else {
        this.showError(`Export failed: ${exportResult.error}`);
      }
    } catch (error) {
      console.error('Error exporting collection:', error);
      this.showError(`Error exporting collection: ${error.message}`);
    }
  }

  async duplicateCollection(collectionId) {
    try {
      // Get collection info for default name
      const collection = this.collections.find(c => c.id === parseInt(collectionId));
      const defaultName = collection ? `Copy of ${collection.search_term}` : 'Untitled Collection';

      // Show input dialog for new collection name
      const newName = await this.showInputDialog('Name of new collection:', defaultName);
      if (!newName) return; // User canceled

      // Call duplicate API
      const result = await window.api.collections.duplicate({
        sourceId: collectionId,
        newName: newName,
        includeComments: true
      });

      if (result.success) {
        this.showSuccess('Collection duplicated successfully!');
        // Refresh the collections list
        await this.loadCollections();
        this.render();
      } else {
        this.showError(`Duplication failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error duplicating collection:', error);
      this.showError(`Error duplicating collection: ${error.message}`);
    }
  }

  async deleteCollection(collectionId) {
    try {
      // Get collection info for confirmation message
      const collection = this.collections.find(c => c.id === parseInt(collectionId));
      const collectionName = collection ? collection.search_term : `Collection #${collectionId}`;

      // Show confirmation dialog
      const confirmed = confirm(`Are you sure you want to delete "${collectionName}"? This cannot be undone.`);
      if (!confirmed) return;

      // Call delete API
      const result = await window.api.collections.delete(collectionId);

      if (result.success) {
        this.showSuccess('Collection deleted successfully!');
        // Refresh the collections list
        await this.loadCollections();
        this.render();
      } else {
        this.showError(`Delete failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      this.showError(`Error deleting collection: ${error.message}`);
    }
  }

  async subsampleCollection(collectionId) {
    try {
      // Get collection info
      const collection = this.collections.find(c => c.id === parseInt(collectionId));
      const collectionName = collection ? collection.search_term : `Collection #${collectionId}`;
      const videoCount = collection ? collection.video_count : 0;

      // Show modal to gather subsample parameters
      const params = await this.showSubsampleModal(collectionName, videoCount);
      if (!params) return; // User canceled

      // Call subsample API
      const result = await window.api.collections.subsample({
        sourceId: collectionId,
        newName: params.newName,
        sampleSize: params.sampleSize,
        withReplacement: params.withReplacement
      });

      if (result.success) {
        this.showSuccess(`Subsample collection created successfully! ${params.sampleSize} videos sampled.`);
        // Refresh the collections list
        await this.loadCollections();
        this.render();
      } else {
        this.showError(`Subsample failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating subsample:', error);
      this.showError(`Error creating subsample: ${error.message}`);
    }
  }

  async filterCollection(collectionId) {
    try {
      // Get collection info
      const collection = this.collections.find(c => c.id === parseInt(collectionId));
      const collectionName = collection ? collection.search_term : `Collection #${collectionId}`;

      // Show modal to gather filter parameters
      const params = await this.showFilterModal(collectionName);
      if (!params) return; // User canceled

      // Call filter API
      const result = await window.api.collections.filter({
        sourceId: collectionId,
        newName: params.newName,
        filters: params.filters
      });

      if (result.success) {
        this.showSuccess(`Filtered collection created successfully! ${result.matchCount} videos matched.`);
        // Refresh the collections list
        await this.loadCollections();
        this.render();
      } else {
        this.showError(`Filter failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error filtering collection:', error);
      this.showError(`Error filtering collection: ${error.message}`);
    }
  }

  showInputDialog(title, defaultValue = '') {
    return new Promise((resolve) => {
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
          <div class="modal-header">
            <h3>${this.escapeHtml(title)}</h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <input type="text" class="input-field" value="${this.escapeHtml(defaultValue)}" style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
          </div>
          <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button class="btn btn-cancel">Cancel</button>
            <button class="btn btn-primary">OK</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const input = modal.querySelector('.input-field');
      input.focus();
      input.select();

      const cleanup = () => modal.remove();

      // Close button
      modal.querySelector('.close-btn').onclick = () => {
        cleanup();
        resolve(null);
      };

      // Cancel button
      modal.querySelector('.btn-cancel').onclick = () => {
        cleanup();
        resolve(null);
      };

      // OK button
      modal.querySelector('.btn-primary').onclick = () => {
        const value = input.value.trim();
        cleanup();
        resolve(value || null);
      };

      // Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = input.value.trim();
          cleanup();
          resolve(value || null);
        } else if (e.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      });

      // Click outside to cancel
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  showSubsampleModal(sourceName, videoCount) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Subsample Collection</h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 16px; color: #9ca3af;">
              Creating a random subsample from <strong>${this.escapeHtml(sourceName)}</strong> (${videoCount} videos)
            </p>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; color: #d1d5db;">Sample Size</label>
              <input type="number" id="subsample-size" min="1" max="${videoCount}" value="${Math.min(10, videoCount)}"
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; color: #d1d5db;">New Collection Name</label>
              <input type="text" id="subsample-name" value="Subsample of ${this.escapeHtml(sourceName)}"
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
              <label style="display: flex; align-items: center; color: #d1d5db; cursor: pointer;">
                <input type="checkbox" id="subsample-replacement" style="margin-right: 8px;">
                Sample with replacement (allow duplicates)
              </label>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button class="btn btn-cancel">Cancel</button>
            <button class="btn btn-primary">Create Subsample</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const sizeInput = modal.querySelector('#subsample-size');
      const nameInput = modal.querySelector('#subsample-name');
      const replacementCheckbox = modal.querySelector('#subsample-replacement');

      sizeInput.focus();
      sizeInput.select();

      const cleanup = () => modal.remove();

      const submit = () => {
        const sampleSize = parseInt(sizeInput.value);
        const newName = nameInput.value.trim();
        const withReplacement = replacementCheckbox.checked;

        if (!newName || sampleSize <= 0) {
          alert('Please provide a valid collection name and sample size');
          return;
        }

        cleanup();
        resolve({ sampleSize, newName, withReplacement });
      };

      // Close button
      modal.querySelector('.close-btn').onclick = () => {
        cleanup();
        resolve(null);
      };

      // Cancel button
      modal.querySelector('.btn-cancel').onclick = () => {
        cleanup();
        resolve(null);
      };

      // OK button
      modal.querySelector('.btn-primary').onclick = submit;

      // Click outside to cancel
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  showFilterModal(sourceName) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Filter Collection</h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 16px; color: #9ca3af;">
              Creating a filtered collection from <strong>${this.escapeHtml(sourceName)}</strong>
            </p>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; color: #d1d5db;">New Collection Name</label>
              <input type="text" id="filter-name" value="Filtered ${this.escapeHtml(sourceName)}"
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; color: #d1d5db;">Minimum Views</label>
              <input type="number" id="filter-min-views" min="0" value="0"
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; color: #d1d5db;">Minimum Comments</label>
              <input type="number" id="filter-min-comments" min="0" value="0"
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; color: #d1d5db;">Title Keyword (optional)</label>
              <input type="text" id="filter-keyword" placeholder="Search in title..."
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; color: #d1d5db;">Date Range</label>
              <select id="filter-date-range"
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
                <option value="year">Past year</option>
              </select>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button class="btn btn-cancel">Cancel</button>
            <button class="btn btn-primary">Create Filtered Collection</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const nameInput = modal.querySelector('#filter-name');
      const minViewsInput = modal.querySelector('#filter-min-views');
      const minCommentsInput = modal.querySelector('#filter-min-comments');
      const keywordInput = modal.querySelector('#filter-keyword');
      const dateRangeSelect = modal.querySelector('#filter-date-range');

      nameInput.focus();
      nameInput.select();

      const cleanup = () => modal.remove();

      const submit = () => {
        const newName = nameInput.value.trim();
        const minViews = parseInt(minViewsInput.value) || 0;
        const minComments = parseInt(minCommentsInput.value) || 0;
        const titleKeyword = keywordInput.value.trim();
        const dateRange = dateRangeSelect.value;

        if (!newName) {
          alert('Please provide a collection name');
          return;
        }

        cleanup();
        resolve({
          newName,
          filters: {
            minViews,
            minComments,
            titleKeyword,
            dateRange
          }
        });
      };

      // Close button
      modal.querySelector('.close-btn').onclick = () => {
        cleanup();
        resolve(null);
      };

      // Cancel button
      modal.querySelector('.btn-cancel').onclick = () => {
        cleanup();
        resolve(null);
      };

      // OK button
      modal.querySelector('.btn-primary').onclick = submit;

      // Click outside to cancel
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Auto-initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CollectionsHub();
  });
} else {
  // DOM is already ready
  new CollectionsHub();
}
