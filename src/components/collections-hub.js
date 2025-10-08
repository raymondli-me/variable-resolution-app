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
    this.mergedCollections = [];
    this.currentView = 'grid'; // 'grid' or 'list'
    this.setupEventListeners();
    this.init();
  }

  setupEventListeners() {
    // Listen for collection created events and refresh
    window.addEventListener('collectionCreated', (e) => {
      console.log('[CollectionsHub] Collection created event received:', e.detail);
      this.loadCollections().then(() => this.render());
    });
  }

  async init() {
    await this.loadCollections();
    await this.loadMergedCollections();
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

  async loadMergedCollections() {
    try {
      const merges = await window.api.database.getAllMerges();
      this.mergedCollections = merges || [];
    } catch (error) {
      console.error('Error loading merged collections:', error);
      this.mergedCollections = [];
    }
  }

  async loadEnrichments() {
    // Load enrichments (rating projects and BWS experiments) for all collections
    for (const collection of this.collections) {
      try {
        // Get rating projects for this collection using the correct API
        const result = await window.api.ai.getRatingProjects({ collectionId: collection.id });

        collection.enrichments = {
          rating_projects: result.success ? (result.data || []) : [],
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

  getCollectionType(collection) {
    // Determine collection type: 'base', 'merged', or 'derived'

    // Check if it's a merged collection (has merge_id or is from mergedCollections array)
    if (collection.merge_id || collection.source_collections) {
      return 'merged';
    }

    // Check if it's a derived collection (has parent_collection_id or derivation_info)
    if (collection.parent_collection_id || collection.derivation_info) {
      return 'derived';
    }

    // Default to base collection (original data source)
    return 'base';
  }

  getGenre(collection) {
    // Determine collection genre: 'youtube' or 'pdf'
    try {
      if (collection.settings) {
        const settings = typeof collection.settings === 'string'
          ? JSON.parse(collection.settings)
          : collection.settings;

        if (settings.source === 'pdf' || settings.type === 'pdf') {
          return 'pdf';
        }
      }
    } catch (e) {
      // If parsing fails, default to YouTube
    }

    // Default to YouTube for video collections
    return 'youtube';
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

  async handleViewClick(collectionId) {
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
      // For PDF collections, check how many PDFs exist
      try {
        const result = await window.api.pdf.list(collectionId);
        const pdfCount = result.success && result.pdfs ? result.pdfs.length : 0;

        if (pdfCount > 1) {
          // Multi-PDF collection → show gallery viewer
          if (window.pdfGalleryViewer) {
            window.pdfGalleryViewer.show(collectionId);
          } else {
            console.error('PDF Gallery Viewer not available');
          }
        } else if (pdfCount === 1) {
          // Single PDF → show excerpt viewer directly
          if (window.pdfExcerptViewer) {
            window.pdfExcerptViewer.show(collectionId);
          } else {
            console.error('PDF Excerpt Viewer not available');
          }
        } else {
          // No PDFs found
          console.warn('No PDFs found in this collection');
          if (window.pdfExcerptViewer) {
            window.pdfExcerptViewer.show(collectionId);
          }
        }
      } catch (error) {
        console.error('Error checking PDF count:', error);
        // Fallback to excerpt viewer
        if (window.pdfExcerptViewer) {
          window.pdfExcerptViewer.show(collectionId);
        }
      }
    } else {
      // Default to Gallery Viewer for YouTube/video collections
      if (window.galleryViewer) {
        window.galleryViewer.show(collectionId);
      } else if (window.collectionViewer) {
        // Fallback to old viewer if gallery viewer not available
        window.collectionViewer.show(collectionId);
      } else {
        console.error('Gallery Viewer not available');
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

    // Find the collection to check if it's a PDF collection
    const collection = this.collections.find(c => c.id === collectionId);
    const isPDFCollection = collection && this.getGenre(collection) === 'pdf';

    // Menu items - base items that appear for all collections
    const menuItems = [
      { label: 'Rate Collection', action: 'rate', icon: '⭐' },
    ];

    // Add genre-specific BWS options
    if (isPDFCollection) {
      menuItems.push({ label: 'Manage Variables', action: 'manage-variables', icon: '📝' });
      menuItems.push({ label: 'BWS Experiment (PDF)', action: 'bws-pdf', icon: '📊' });
    } else {
      // Video collection - keep old BWS for later revival
      menuItems.push({ label: 'BWS Experiment (Video)', action: 'bws-video', icon: '📊', disabled: true });
    }

    // Add remaining common options
    menuItems.push(
      { label: 'Export', action: 'export', icon: '📤' },
      { label: 'Duplicate', action: 'duplicate', icon: '📋' },
      { label: 'Subsample', action: 'subsample', icon: '🎲' },
      { label: 'Filter', action: 'filter', icon: '🔍' }
    );

    menuItems.push({ label: 'Delete', action: 'delete', icon: '🗑️', danger: true });

    menuItems.forEach(item => {
      const menuItem = document.createElement('button');
      menuItem.className = `context-menu-item${item.danger ? ' danger' : ''}`;
      menuItem.innerHTML = `<span class="menu-icon">${item.icon}</span><span>${item.label}</span>`;

      if (item.disabled) {
        menuItem.disabled = true;
        menuItem.style.opacity = '0.5';
        menuItem.style.cursor = 'not-allowed';
        menuItem.title = 'Coming soon - Video BWS will be available in a future update';
      } else {
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleContextMenuAction(item.action, collectionId);
        });
      }

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
      case 'bws-pdf':
        await this.showCreatePDFBwsModal(collectionId);
        break;
      case 'bws-video':
        // Old video BWS - will be revived later
        await this.showCreateBwsModal(collectionId);
        break;
      case 'manage-variables':
        await this.showManageVariablesModal(collectionId);
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

  async showCreatePDFBwsModal(collectionId) {
    console.log('[CollectionsHub] Creating PDF BWS Experiment for collection:', collectionId);

    // For now, just log the configuration
    // TODO: Implement the full PDF BWS workflow with:
    // 1. Select BWS variable (from global_rating_variables where variable_type='bws')
    // 2. Configure experiment (name, research intent)
    // 3. Generate tuples of 4 PDF excerpts
    // 4. Launch the 4-excerpt comparison interface

    const collection = this.collections.find(c => c.id === collectionId);
    console.log('[CollectionsHub] Collection for PDF BWS:', {
      id: collection?.id,
      name: collection?.search_term,
      genre: this.getGenre(collection)
    });

    // Placeholder: Show success message
    this.showSuccess('PDF BWS Experiment setup coming soon! Collection: ' + collection?.search_term);
  }

  render() {
    // Log collection data to verify lineage tracking
    console.log('[CollectionsHub] Rendering collections:', this.collections.map(c => ({
      id: c.id,
      name: c.search_term,
      parent_collection_id: c.parent_collection_id,
      derivation_info: c.derivation_info
    })));

    const totalItems = this.collections.length + this.mergedCollections.length;

    if (totalItems === 0) {
      this.container.innerHTML = `
        <div class="hub-empty-state">
          <div class="empty-icon">📚</div>
          <h2>No Collections Yet</h2>
          <p>Create your first collection to get started</p>
        </div>
      `;
      return;
    }

    // Render regular collection cards
    const regularCardsHTML = this.collections.map(collection => {
      const collectionType = this.getCollectionType(collection);
      const collectionGenre = this.getGenre(collection);
      const genreLabel = collectionGenre === 'pdf' ? 'PDF' : 'VIDEO';
      const typeLabel = collectionType.toUpperCase();

      return `
        <div class="collection-card genre-${collectionGenre} type-${collectionType}" data-collection-id="${collection.id}" data-action="view">
          <div class="card-header">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span class="card-genre-badge">${genreLabel}</span>
              <span class="card-type-badge">${typeLabel}</span>
            </div>
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
        </div>
      `;
    }).join('');

    // Render merged collection cards
    const mergedCardsHTML = this.mergedCollections.map(merge => this.renderMergedCard(merge)).join('');

    this.container.innerHTML = `
      <div class="hub-header">
        <div>
          <h2 class="hub-title">Collections</h2>
          <p class="hub-subtitle">Browse and manage your data collections</p>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <button class="btn-create-merge" id="create-collection-btn-hub" title="Create New Collection">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Collection
          </button>
          <button class="btn-create-merge" id="create-merge-btn-hub" title="Create Merge" style="opacity: 0.8;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
              <polyline points="12 22 12 12"></polyline>
              <polyline points="7 9 12 12 17 9"></polyline>
            </svg>
            Merge
          </button>
          <button class="btn-create-merge" id="manage-variables-btn-hub" title="Manage Variables" style="opacity: 0.8;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Manage Variables
          </button>
          <!-- View toggle temporarily disabled - list view not implemented yet -->
          <div class="view-toggle-container" style="display: none;">
            <button class="view-toggle-btn ${this.currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="collection-grid" id="collection-grid">
        ${regularCardsHTML}
        ${mergedCardsHTML}
      </div>
    `;

    // Attach event listeners to buttons
    this.attachEventListeners();
  }

  renderMergedCard(merge) {
    const sourceCount = merge.collection_count || merge.source_collections?.length || 0;
    let totalVideos = 0;
    let totalComments = 0;

    if (merge.source_collections) {
      merge.source_collections.forEach(c => {
        totalVideos += c.video_count || 0;
        totalComments += c.comment_count || 0;
      });
    }

    const sourceNames = merge.source_collections
      ? merge.source_collections.slice(0, 2).map(c => c.search_term).join(', ')
      : '';
    const moreText = sourceCount > 2 ? ` +${sourceCount - 2} more` : '';

    const collectionType = this.getCollectionType(merge);
    const collectionGenre = this.getGenre(merge);
    const genreLabel = collectionGenre === 'pdf' ? 'PDF' : 'VIDEO';
    const typeLabel = collectionType.toUpperCase();

    return `
      <div class="collection-card genre-${collectionGenre} type-${collectionType}" data-merge-id="${merge.id}" data-action="view-merge">
        <div class="card-header">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="card-genre-badge">${genreLabel}</span>
            <span class="card-type-badge">${typeLabel}</span>
          </div>
          <button class="card-menu-btn" data-action="menu-merge" data-id="${merge.id}">⋯</button>
        </div>
        <div class="card-body">
          <h3 class="card-title">${this.escapeHtml(merge.name)}</h3>
          <div class="card-stats">
            <span class="stat-item">${totalVideos} Videos</span>
          </div>
          <div class="card-date">Created ${this.formatDate(merge.created_at)}</div>
        </div>
        <div class="card-enrichments" data-action="toggle-enrichments" data-id="${merge.id}">
          <span style="color: #718096;">No enrichments</span>
        </div>
      </div>
    `;
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
    // Create New Collection button
    const createCollectionBtn = document.getElementById('create-collection-btn-hub');
    if (createCollectionBtn) {
      createCollectionBtn.addEventListener('click', () => {
        if (window.folderBrowser && window.folderBrowser.showNewCollectionModal) {
          window.folderBrowser.showNewCollectionModal();
        } else {
          console.error('Folder browser or showNewCollectionModal not available');
        }
      });
    }

    // Create Merge button
    const createMergeBtn = document.getElementById('create-merge-btn-hub');
    if (createMergeBtn) {
      createMergeBtn.addEventListener('click', () => {
        if (window.mergeManager) {
          window.mergeManager.openCreateModal();
        }
      });
    }

    // Manage Variables button
    const manageVariablesBtn = document.getElementById('manage-variables-btn-hub');
    if (manageVariablesBtn) {
      manageVariablesBtn.addEventListener('click', () => {
        console.log('[CollectionsHub] Manage Variables button clicked');
        this.showGlobalManageVariablesModal();
      });
    } else {
      console.warn('[CollectionsHub] Manage Variables button not found');
    }

    // View toggle button clicks
    this.container.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const view = btn.dataset.view;
        this.switchView(view);
      });
    });

    // Card clicks for regular collections (entire card is clickable)
    this.container.querySelectorAll('.collection-card[data-collection-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking on menu button or enrichments
        if (e.target.closest('[data-action="menu"]') || e.target.closest('[data-action="toggle-enrichments"]')) {
          return;
        }
        const collectionId = card.dataset.collectionId;
        this.handleViewClick(collectionId);
      });
    });

    // Card clicks for merged collections (entire card is clickable)
    this.container.querySelectorAll('.collection-card[data-merge-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking on menu button or enrichments
        if (e.target.closest('[data-action="menu-merge"]') || e.target.closest('[data-action="toggle-enrichments"]')) {
          return;
        }
        const mergeId = card.dataset.mergeId;
        this.handleViewMergeClick(mergeId);
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

    // Menu button clicks (merged collections)
    this.container.querySelectorAll('[data-action="menu-merge"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mergeId = btn.dataset.id;
        this.handleMergeMenuClick(mergeId, e);
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

  handleViewMergeClick(mergeId) {
    // Browse content of the merge using the collection viewer
    if (window.mergeManager) {
      window.mergeManager.browseContent(parseInt(mergeId));
    } else if (window.collectionViewer) {
      window.collectionViewer.showMerge(parseInt(mergeId));
    }
  }

  handleMergeMenuClick(mergeId, event) {
    // Close any existing context menu
    this.closeContextMenu();

    // Create context menu for merged collection
    const menu = document.createElement('div');
    menu.className = 'collection-context-menu';
    menu.dataset.mergeId = mergeId;

    const menuItems = [
      { label: 'View Details', action: 'view-details', icon: '👁️' },
      { label: 'Browse Content', action: 'browse', icon: '📂' },
      { label: 'Export', action: 'export', icon: '📤' },
      { label: 'Delete Merge', action: 'delete', icon: '🗑️', danger: true }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('button');
      menuItem.className = `context-menu-item${item.danger ? ' danger' : ''}`;
      menuItem.innerHTML = `<span class="menu-icon">${item.icon}</span><span>${item.label}</span>`;
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleMergeContextMenuAction(item.action, mergeId);
      });
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
    const buttonRect = event.target.getBoundingClientRect();
    menu.style.top = `${buttonRect.bottom + 5}px`;
    menu.style.left = `${buttonRect.right - menu.offsetWidth}px`;

    setTimeout(() => {
      document.addEventListener('click', this.closeContextMenuHandler, { once: true });
    }, 0);
  }

  async handleMergeContextMenuAction(action, mergeId) {
    this.closeContextMenu();

    switch (action) {
      case 'view-details':
        if (window.mergeManager) {
          window.mergeManager.viewMerge(parseInt(mergeId));
        }
        break;
      case 'browse':
        this.handleViewMergeClick(mergeId);
        break;
      case 'export':
        if (window.mergeManager) {
          window.mergeManager.exportMerge(parseInt(mergeId));
        }
        break;
      case 'delete':
        if (window.mergeManager) {
          if (confirm('Delete this merged collection? This cannot be undone.')) {
            await window.api.database.deleteMerge(parseInt(mergeId));
            this.showSuccess('Merged collection deleted');
            await this.loadMergedCollections();
            this.render();
          }
        }
        break;
    }
  }

  switchView(view) {
    if (view === this.currentView) return;

    this.currentView = view;

    // Get references to both views
    const gridView = this.container;
    const listView = document.querySelector('.folder-browser-container');

    if (view === 'grid') {
      // Show Grid View, hide List View
      gridView.style.display = 'block';
      if (listView) listView.style.display = 'none';
    } else if (view === 'list') {
      // Hide Grid View, show List View
      gridView.style.display = 'none';
      if (listView) listView.style.display = 'block';
    }

    // Update toggle button states
    this.container.querySelectorAll('.view-toggle-btn').forEach(btn => {
      if (btn.dataset.view === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
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
      const collectionGenre = collection ? this.getGenre(collection) : 'youtube';

      // Load rating variables if PDF collection
      let variables = [];
      if (collectionGenre === 'pdf') {
        try {
          // Load collection-specific variables
          const collectionVarsResult = await window.api.pdf.getRatingVariables(collectionId);
          const collectionVars = collectionVarsResult?.success ? (collectionVarsResult.data || []) : [];

          // Load global variables that apply to PDF collections
          const globalVarsResult = await window.api.pdf.getGlobalRatingVariables();
          const globalVars = globalVarsResult?.success ? (globalVarsResult.data || []) : [];
          const pdfGlobalVars = globalVars.filter(v => v.genre === 'pdf' || v.genre === 'both');

          // Combine both (collection-specific first, then global)
          variables = [...collectionVars, ...pdfGlobalVars];

          console.log('[FilterCollection] Loaded variables:', variables.length, 'total (collection:', collectionVars.length, ', global:', pdfGlobalVars.length, ')');
        } catch (error) {
          console.error('Error loading variables:', error);
        }
      }

      // Show modal to gather filter parameters
      const params = await this.showFilterModal(collectionName, collectionGenre, variables);
      if (!params) return; // User canceled

      // Call filter API
      const result = await window.api.collections.filter({
        sourceId: collectionId,
        newName: params.newName,
        filters: params.filters
      });

      if (result.success) {
        this.showSuccess(`Filtered collection created successfully! ${result.matchCount} items matched.`);
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

  showFilterModal(sourceName, genre = 'youtube', variables = []) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';

      // Generate genre-specific filter fields
      let filterFieldsHtml = '';

      if (genre === 'pdf') {
        // PDF-specific filter options
        filterFieldsHtml = `
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; color: #d1d5db;">Page Range (optional)</label>
            <div style="display: flex; gap: 8px;">
              <input type="number" id="filter-page-start" min="1" placeholder="From page"
                style="flex: 1; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
              <input type="number" id="filter-page-end" min="1" placeholder="To page"
                style="flex: 1; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; color: #d1d5db;">Minimum Excerpt Length (words)</label>
            <input type="number" id="filter-min-excerpt-length" min="0" value="0"
              style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; color: #d1d5db;">Keyword in Excerpt Text (optional)</label>
            <input type="text" id="filter-text-keyword" placeholder="Search within excerpts..."
              style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
          </div>
        `;

        // Add variable-based filtering if variables exist
        if (variables && variables.length > 0) {
          filterFieldsHtml += `
            <div style="margin: 20px 0; border-top: 1px solid #374151; padding-top: 16px;">
              <h4 style="margin: 0 0 12px 0; color: #f3f4f6; font-size: 14px; font-weight: 600;">Filter by Rating Variables</h4>
              <div id="variable-filters-container">
                ${variables.map(v => `
                  <div style="background: #111827; border: 1px solid #374151; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                      <input type="checkbox" id="enable-var-${v.id}" onchange="document.getElementById('var-filters-${v.id}').style.display = this.checked ? 'block' : 'none';" style="cursor: pointer;">
                      <label for="enable-var-${v.id}" style="color: #e5e7eb; font-weight: 600; cursor: pointer;">${this.escapeHtml(v.label)}</label>
                      <span style="padding: 2px 6px; background: #374151; color: #9ca3af; border-radius: 3px; font-size: 11px;">${this.escapeHtml(v.scale_type)}</span>
                    </div>
                    <div id="var-filters-${v.id}" style="display: none; padding-left: 24px;">
                      <div style="display: grid; gap: 8px;">
                        <div>
                          <label style="display: block; margin-bottom: 4px; color: #9ca3af; font-size: 12px;">Rating Type</label>
                          <select id="var-${v.id}-rating-type" style="width: 100%; padding: 6px; border: 1px solid #374151; background: #0f172a; color: #f3f4f6; border-radius: 4px; font-size: 13px;">
                            <option value="any">Any (AI or Human)</option>
                            <option value="ai">AI Ratings Only</option>
                            <option value="human">Human Ratings Only</option>
                            <option value="both">Both AI and Human</option>
                          </select>
                        </div>
                        <div>
                          <label style="display: block; margin-bottom: 4px; color: #9ca3af; font-size: 12px;">Score Range</label>
                          <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="number" id="var-${v.id}-min" placeholder="Min" style="flex: 1; padding: 6px; border: 1px solid #374151; background: #0f172a; color: #f3f4f6; border-radius: 4px; font-size: 13px;">
                            <span style="color: #6b7280;">to</span>
                            <input type="number" id="var-${v.id}-max" placeholder="Max" style="flex: 1; padding: 6px; border: 1px solid #374151; background: #0f172a; color: #f3f4f6; border-radius: 4px; font-size: 13px;">
                          </div>
                        </div>
                        <div>
                          <label style="display: block; margin-bottom: 4px; color: #9ca3af; font-size: 12px;">Rating Status</label>
                          <select id="var-${v.id}-status" style="width: 100%; padding: 6px; border: 1px solid #374151; background: #0f172a; color: #f3f4f6; border-radius: 4px; font-size: 13px;">
                            <option value="all">All excerpts</option>
                            <option value="rated">Only rated excerpts</option>
                            <option value="unrated">Only unrated excerpts</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }
      } else {
        // Video-specific filter options (YouTube)
        filterFieldsHtml = `
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
        `;
      }

      const genreLabel = genre === 'pdf' ? '📄 PDF' : '📹 Video';

      modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; max-height: 90vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <h3>Filter Collection <span style="font-size: 0.85em; color: #9ca3af;">(${genreLabel})</span></h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body" style="flex: 1; overflow-y: auto; max-height: calc(90vh - 140px);">
            <p style="margin-bottom: 16px; color: #9ca3af;">
              Creating a filtered collection from <strong>${this.escapeHtml(sourceName)}</strong>
            </p>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; color: #d1d5db;">New Collection Name</label>
              <input type="text" id="filter-name" value="Filtered ${this.escapeHtml(sourceName)}"
                style="width: 100%; padding: 8px; border: 1px solid #374151; background: #1f2937; color: #f3f4f6; border-radius: 4px;">
            </div>
            ${filterFieldsHtml}
          </div>
          <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; border-top: 1px solid #374151; padding-top: 16px;">
            <button class="btn btn-cancel">Cancel</button>
            <button class="btn btn-primary">Create Filtered Collection</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const nameInput = modal.querySelector('#filter-name');

      nameInput.focus();
      nameInput.select();

      const cleanup = () => modal.remove();

      const submit = () => {
        const newName = nameInput.value.trim();

        if (!newName) {
          alert('Please provide a collection name');
          return;
        }

        let filters = {};

        if (genre === 'pdf') {
          // Collect PDF-specific filters
          const pageStart = modal.querySelector('#filter-page-start')?.value;
          const pageEnd = modal.querySelector('#filter-page-end')?.value;
          const minExcerptLength = parseInt(modal.querySelector('#filter-min-excerpt-length')?.value) || 0;
          const textKeyword = modal.querySelector('#filter-text-keyword')?.value.trim();

          filters = {
            pageStart: pageStart ? parseInt(pageStart) : null,
            pageEnd: pageEnd ? parseInt(pageEnd) : null,
            minExcerptLength,
            textKeyword
          };

          // Collect variable-based filters
          const variableFilters = [];
          variables.forEach(v => {
            const enableCheckbox = modal.querySelector(`#enable-var-${v.id}`);
            if (enableCheckbox && enableCheckbox.checked) {
              const ratingType = modal.querySelector(`#var-${v.id}-rating-type`)?.value;
              const minScore = modal.querySelector(`#var-${v.id}-min`)?.value;
              const maxScore = modal.querySelector(`#var-${v.id}-max`)?.value;
              const status = modal.querySelector(`#var-${v.id}-status`)?.value;

              variableFilters.push({
                variableId: v.id,
                variableLabel: v.label,
                ratingType: ratingType || 'any',
                minScore: minScore ? parseFloat(minScore) : null,
                maxScore: maxScore ? parseFloat(maxScore) : null,
                status: status || 'all'
              });
            }
          });

          if (variableFilters.length > 0) {
            filters.variableFilters = variableFilters;
          }
        } else {
          // Collect video-specific filters
          const minViews = parseInt(modal.querySelector('#filter-min-views')?.value) || 0;
          const minComments = parseInt(modal.querySelector('#filter-min-comments')?.value) || 0;
          const titleKeyword = modal.querySelector('#filter-keyword')?.value.trim();
          const dateRange = modal.querySelector('#filter-date-range')?.value;

          filters = {
            minViews,
            minComments,
            titleKeyword,
            dateRange
          };
        }

        cleanup();
        resolve({
          newName,
          filters
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

  async showManageVariablesModal(collectionId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return;

    // Load existing variables
    const variables = await window.api.pdf.getRatingVariables(collectionId);

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fullscreen-modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh;">
          <div class="modal-header">
            <h3>Manage Rating Variables - ${this.escapeHtml(collection.search_term)}</h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body" style="max-height: calc(90vh - 120px); overflow-y: auto;">
            <p style="margin-bottom: 16px; color: #9ca3af;">
              Define custom rating variables for qualitative coding of PDF excerpts.
            </p>

            <!-- Existing Variables List -->
            <div id="variables-list" style="margin-bottom: 24px;">
              ${variables.length > 0 ? this.renderVariablesList(variables) : '<p style="color: #6b7280; text-align: center; padding: 24px;">No variables defined yet. Create your first variable below.</p>'}
            </div>

            <!-- Create New Variable Form -->
            <div style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 20px; margin-top: 16px;">
              <h4 style="margin-bottom: 16px; color: #f3f4f6;">Create New Variable</h4>

              <div style="display: grid; gap: 16px;">
                <!-- Variable Label -->
                <div>
                  <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Variable Label *</label>
                  <input type="text" id="variable-label" placeholder="e.g., Stigma Level, Emotional Valence"
                    style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                </div>

                <!-- Scale Type -->
                <div>
                  <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Scale Type *</label>
                  <select id="scale-type" onchange="window.collectionsHub.updateAnchorFields()"
                    style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                    <option value="">-- Select Scale --</option>
                    <option value="binary">Binary (0/1)</option>
                    <option value="3point">3-Point Scale</option>
                    <option value="4point">4-Point Scale</option>
                    <option value="5point">5-Point Scale</option>
                    <option value="7point">7-Point Scale</option>
                    <option value="10point">10-Point Scale</option>
                    <option value="100point">100-Point Scale</option>
                  </select>
                </div>

                <!-- Variable Definition -->
                <div>
                  <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Variable Definition</label>
                  <textarea id="variable-definition" rows="3" placeholder="What does this variable measure? (optional)"
                    style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px; resize: vertical;"></textarea>
                  <button id="ai-suggest-btn" style="margin-top: 8px; padding: 6px 12px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    🤖 Ask AI to Suggest Definition & Anchors
                  </button>
                </div>

                <!-- Dynamic Scale Anchors -->
                <div id="scale-anchors" style="display: none;">
                  <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Scale Anchors</label>
                  <div id="anchors-container" style="display: grid; gap: 8px;">
                    <!-- Dynamically generated anchor fields will go here -->
                  </div>
                </div>

                <!-- Reasoning Depth Preference -->
                <div>
                  <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Default Reasoning Depth</label>
                  <select id="reasoning-depth" style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                    <option value="brief">Brief (1-2 sentences)</option>
                    <option value="moderate">Moderate (3-5 sentences)</option>
                    <option value="lengthy">Lengthy (6+ sentences, for scale development)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button class="btn btn-cancel">Close</button>
            <button class="btn btn-primary" id="create-variable-btn">Create Variable</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const cleanup = () => {
        modal.remove();
      };

      // Close button
      modal.querySelector('.close-btn').addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      // Cancel button
      modal.querySelector('.btn-cancel').addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      // AI Suggest button
      modal.querySelector('#ai-suggest-btn').addEventListener('click', async () => {
        const label = modal.querySelector('#variable-label').value.trim();
        const scaleType = modal.querySelector('#scale-type').value;

        if (!label) {
          this.showError('Please enter a variable label first');
          return;
        }

        if (!scaleType) {
          this.showError('Please select a scale type first');
          return;
        }

        try {
          const btn = modal.querySelector('#ai-suggest-btn');
          btn.disabled = true;
          btn.textContent = '🤖 Generating suggestions...';

          const result = await window.api.ai.suggestVariableDefinition({ label, scaleType });

          if (result.success && result.data) {
            // Fill in the definition
            modal.querySelector('#variable-definition').value = result.data.definition || '';

            // Fill in the anchors
            if (result.data.anchors) {
              const anchorsContainer = modal.querySelector('#anchors-container');
              Object.keys(result.data.anchors).forEach(key => {
                const input = anchorsContainer.querySelector(`input[data-anchor="${key}"]`);
                if (input) {
                  input.value = result.data.anchors[key];
                }
              });
            }

            this.showSuccess('AI suggestions applied');
          } else {
            this.showError(result.error || 'Failed to generate suggestions');
          }

          btn.disabled = false;
          btn.textContent = '🤖 Ask AI to Suggest Definition & Anchors';
        } catch (error) {
          console.error('Error getting AI suggestions:', error);
          this.showError('Error getting AI suggestions');
          const btn = modal.querySelector('#ai-suggest-btn');
          btn.disabled = false;
          btn.textContent = '🤖 Ask AI to Suggest Definition & Anchors';
        }
      });

      // Create Variable button
      modal.querySelector('#create-variable-btn').addEventListener('click', async () => {
        const label = modal.querySelector('#variable-label').value.trim();
        const scaleType = modal.querySelector('#scale-type').value;
        const definition = modal.querySelector('#variable-definition').value.trim();
        const reasoningDepth = modal.querySelector('#reasoning-depth').value;

        if (!label) {
          this.showError('Please enter a variable label');
          return;
        }

        if (!scaleType) {
          this.showError('Please select a scale type');
          return;
        }

        // Collect anchors
        const anchors = {};
        const anchorInputs = modal.querySelectorAll('#anchors-container input[data-anchor]');
        anchorInputs.forEach(input => {
          const key = input.dataset.anchor;
          const value = input.value.trim();
          if (value) {
            anchors[key] = value;
          }
        });

        try {
          const result = await window.api.pdf.createRatingVariable({
            collection_id: collectionId,
            label,
            definition,
            scale_type: scaleType,
            anchors,
            reasoning_depth: reasoningDepth
          });

          if (result.success) {
            this.showSuccess(`Variable "${label}" created successfully`);

            // Refresh the variables list
            const updatedVariables = await window.api.pdf.getRatingVariables(collectionId);
            const listContainer = modal.querySelector('#variables-list');
            listContainer.innerHTML = this.renderVariablesList(updatedVariables);

            // Clear form
            modal.querySelector('#variable-label').value = '';
            modal.querySelector('#scale-type').value = '';
            modal.querySelector('#variable-definition').value = '';
            modal.querySelector('#scale-anchors').style.display = 'none';
          } else {
            this.showError(result.error || 'Failed to create variable');
          }
        } catch (error) {
          console.error('Error creating variable:', error);
          this.showError('Error creating variable');
        }
      });

      // Click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  async showGlobalManageVariablesModal() {
    console.log('[CollectionsHub] showGlobalManageVariablesModal called');

    // Load all existing global variables
    let variables = [];
    try {
      console.log('[CollectionsHub] Fetching global variables...');
      const result = await window.api.pdf.getGlobalRatingVariables();
      console.log('[CollectionsHub] Global variables result:', result);
      if (result && result.success) {
        variables = result.data || [];
      }
    } catch (error) {
      console.error('[CollectionsHub] Error loading global variables:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2>📝 Global Variable Management</h2>
          <button class="close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af;">&times;</button>
        </div>
        <div class="modal-body" style="max-height: calc(90vh - 120px); overflow-y: auto;">
          <p style="margin-bottom: 16px; color: #9ca3af;">
            Define custom rating variables once and apply them to collections by genre (PDF or YouTube).
          </p>

          <!-- Existing Variables List -->
          <div id="global-variables-list" style="margin-bottom: 24px;">
            ${variables.length > 0 ? this.renderGlobalVariablesList(variables) : '<p style="color: #6b7280; text-align: center; padding: 24px; background: #1f2937; border-radius: 8px;">No global variables defined yet. Create your first variable below.</p>'}
          </div>

          <!-- Create New Variable Form -->
          <div style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 20px; margin-top: 16px;">
            <h4 style="margin-bottom: 16px; color: #f3f4f6;">Create New Variable</h4>

            <div style="display: grid; gap: 16px;">
              <!-- Variable Label -->
              <div>
                <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Variable Label *</label>
                <input type="text" id="global-variable-label" placeholder="e.g., Stigma Level, Emotional Valence"
                  style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
              </div>

              <!-- Genre Selection -->
              <div>
                <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Genre *</label>
                <select id="global-variable-genre"
                  style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                  <option value="">-- Select Genre --</option>
                  <option value="pdf">PDF Collections</option>
                  <option value="youtube">YouTube Collections</option>
                  <option value="both">Both (Universal)</option>
                </select>
                <small style="display: block; margin-top: 4px; color: #6b7280; font-size: 12px;">
                  Which type of collections should use this variable?
                </small>
              </div>

              <!-- Variable Type -->
              <div>
                <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Variable Type *</label>
                <select id="global-variable-type" onchange="window.collectionsHub.updateGlobalVariableType()"
                  style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                  <option value="">-- Select Type --</option>
                  <option value="rating">Rating (Numeric Scale)</option>
                  <option value="bws">BWS (Best-Worst Scaling)</option>
                </select>
                <small style="display: block; margin-top: 4px; color: #6b7280; font-size: 12px;">
                  Choose between traditional rating scales or Best-Worst Scaling comparisons
                </small>
              </div>

              <!-- Scale Type (for Rating variables) -->
              <div id="global-scale-type-container" style="display: none;">
                <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Scale Type *</label>
                <select id="global-scale-type" onchange="window.collectionsHub.updateGlobalAnchorFields()"
                  style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                  <option value="">-- Select Scale --</option>
                  <option value="binary">Binary (0/1)</option>
                  <option value="3point">3-Point Scale</option>
                  <option value="4point">4-Point Scale</option>
                  <option value="5point">5-Point Scale</option>
                  <option value="7point">7-Point Scale</option>
                  <option value="10point">10-Point Scale</option>
                  <option value="100point">100-Point Scale</option>
                </select>
              </div>

              <!-- BWS Anchors (for BWS variables) -->
              <div id="global-bws-anchors-container" style="display: none;">
                <div style="margin-bottom: 12px;">
                  <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Anchor for Best *</label>
                  <input type="text" id="global-bws-anchor-best" placeholder="e.g., Extremely Positive, Highest Quality"
                    style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                  <small style="display: block; margin-top: 4px; color: #6b7280; font-size: 12px;">
                    Label for the "best" item in a comparison set
                  </small>
                </div>
                <div>
                  <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Anchor for Worst *</label>
                  <input type="text" id="global-bws-anchor-worst" placeholder="e.g., Extremely Negative, Lowest Quality"
                    style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                  <small style="display: block; margin-top: 4px; color: #6b7280; font-size: 12px;">
                    Label for the "worst" item in a comparison set
                  </small>
                </div>
              </div>

              <!-- Variable Definition -->
              <div>
                <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Variable Definition</label>
                <textarea id="global-variable-definition" rows="3" placeholder="What does this variable measure? (optional)"
                  style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px; resize: vertical;"></textarea>
                <button id="global-ai-suggest-btn" style="margin-top: 8px; padding: 6px 12px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                  🤖 Ask AI to Suggest Definition & Anchors
                </button>
              </div>

              <!-- Dynamic Scale Anchors -->
              <div id="global-scale-anchors" style="display: none;">
                <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Scale Anchors</label>
                <div id="global-anchors-container" style="display: grid; gap: 8px;">
                  <!-- Dynamically generated anchor fields will go here -->
                </div>
              </div>

              <!-- Reasoning Depth Preference -->
              <div>
                <label style="display: block; margin-bottom: 6px; color: #e5e7eb; font-size: 14px;">Default Reasoning Depth</label>
                <select id="global-reasoning-depth" style="width: 100%; padding: 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px;">
                  <option value="brief">Brief (1-2 sentences)</option>
                  <option value="moderate">Moderate (3-5 sentences)</option>
                  <option value="lengthy">Lengthy (6+ sentences, for scale development)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid #374151;">
          <button class="btn" style="padding: 8px 16px; background: #374151; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
          <button class="btn btn-primary" id="create-global-variable-btn" style="padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer;">Create Variable</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    console.log('[CollectionsHub] Modal appended to DOM, should be visible now');

    const cleanup = () => {
      console.log('[CollectionsHub] Closing modal');
      modal.remove();
    };

    // Close button (X in header)
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', cleanup);
    }

    // Cancel/Close button in footer
    const cancelBtn = modal.querySelector('.btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cleanup);
    }

    // AI Suggest button
    const aiSuggestBtn = modal.querySelector('#global-ai-suggest-btn');
    if (aiSuggestBtn) {
      aiSuggestBtn.addEventListener('click', async () => {
        const label = modal.querySelector('#global-variable-label').value.trim();
        const variableType = modal.querySelector('#global-variable-type').value;
        const scaleType = modal.querySelector('#global-scale-type').value;

        if (!label) {
          this.showError('Please enter a variable label first');
          return;
        }

        if (!variableType) {
          this.showError('Please select a variable type first');
          return;
        }

        // Only check for scale type if it's a rating variable
        if (variableType === 'rating' && !scaleType) {
          this.showError('Please select a scale type first');
          return;
        }

        // Check if AI API is available
        if (!window.api?.ai?.suggestVariableDefinition) {
          this.showError('AI suggestions not available. Please configure Gemini API key in Settings.');
          return;
        }

        try {
          const btn = modal.querySelector('#global-ai-suggest-btn');
          btn.disabled = true;
          btn.textContent = '🤖 Generating suggestions...';

          const result = await window.api.ai.suggestVariableDefinition({
            label,
            scaleType: variableType === 'rating' ? scaleType : null,
            variableType
          });

          if (result.success && result.data) {
            // Fill in the definition
            modal.querySelector('#global-variable-definition').value = result.data.definition || '';

            // Fill in the anchors based on variable type
            if (result.data.anchors) {
              if (variableType === 'rating') {
                // Fill in numeric scale anchors
                const anchorsContainer = modal.querySelector('#global-anchors-container');
                Object.keys(result.data.anchors).forEach(key => {
                  const input = anchorsContainer.querySelector(`input[data-anchor="${key}"]`);
                  if (input) {
                    input.value = result.data.anchors[key];
                  }
                });
              } else if (variableType === 'bws') {
                // Fill in BWS best/worst anchors
                if (result.data.anchors.best) {
                  modal.querySelector('#global-bws-anchor-best').value = result.data.anchors.best;
                }
                if (result.data.anchors.worst) {
                  modal.querySelector('#global-bws-anchor-worst').value = result.data.anchors.worst;
                }
              }
            }

            this.showSuccess('AI suggestions applied');
          } else {
            this.showError(result.error || 'Failed to generate suggestions');
          }

          btn.disabled = false;
          btn.textContent = '🤖 Ask AI to Suggest Definition & Anchors';
        } catch (error) {
          console.error('Error getting AI suggestions:', error);
          this.showError('AI feature unavailable. Check that Gemini API is configured.');
          const btn = modal.querySelector('#global-ai-suggest-btn');
          btn.disabled = false;
          btn.textContent = '🤖 Ask AI to Suggest Definition & Anchors';
        }
      });
    }

    // Create Variable button
    modal.querySelector('#create-global-variable-btn').addEventListener('click', async () => {
      const label = modal.querySelector('#global-variable-label').value.trim();
      const genre = modal.querySelector('#global-variable-genre').value;
      const variableType = modal.querySelector('#global-variable-type').value;
      const definition = modal.querySelector('#global-variable-definition').value.trim();
      const reasoningDepth = modal.querySelector('#global-reasoning-depth').value;

      if (!label) {
        this.showError('Please enter a variable label');
        return;
      }

      if (!genre) {
        this.showError('Please select a genre');
        return;
      }

      if (!variableType) {
        this.showError('Please select a variable type');
        return;
      }

      let scaleType;
      const anchors = {};

      if (variableType === 'rating') {
        // For rating variables, collect scale type and anchors
        scaleType = modal.querySelector('#global-scale-type').value;

        if (!scaleType) {
          this.showError('Please select a scale type');
          return;
        }

        // Collect numeric scale anchors
        const anchorInputs = modal.querySelectorAll('#global-anchors-container input[data-anchor]');
        anchorInputs.forEach(input => {
          const key = input.dataset.anchor;
          const value = input.value.trim();
          if (value) {
            anchors[key] = value;
          }
        });
      } else if (variableType === 'bws') {
        // For BWS variables, set scale_type to 'bws'
        scaleType = 'bws';

        // Collect best/worst anchors
        const bestAnchor = modal.querySelector('#global-bws-anchor-best').value.trim();
        const worstAnchor = modal.querySelector('#global-bws-anchor-worst').value.trim();

        if (!bestAnchor) {
          this.showError('Please enter an anchor for "Best"');
          return;
        }

        if (!worstAnchor) {
          this.showError('Please enter an anchor for "Worst"');
          return;
        }

        anchors.best = bestAnchor;
        anchors.worst = worstAnchor;
      }

      try {
        const result = await window.api.pdf.createGlobalRatingVariable({
          label,
          genre,
          definition,
          variable_type: variableType,
          scale_type: scaleType,
          anchors,
          reasoning_depth: reasoningDepth
        });

        if (result.success) {
          this.showSuccess(`Variable "${label}" created successfully`);

          // Refresh the variables list
          const updatedResult = await window.api.pdf.getGlobalRatingVariables();
          const updatedVariables = updatedResult.success ? updatedResult.data : [];
          const listContainer = modal.querySelector('#global-variables-list');
          listContainer.innerHTML = this.renderGlobalVariablesList(updatedVariables);

          // Clear form
          modal.querySelector('#global-variable-label').value = '';
          modal.querySelector('#global-variable-genre').value = '';
          modal.querySelector('#global-variable-type').value = '';
          modal.querySelector('#global-scale-type').value = '';
          modal.querySelector('#global-variable-definition').value = '';
          modal.querySelector('#global-bws-anchor-best').value = '';
          modal.querySelector('#global-bws-anchor-worst').value = '';
          modal.querySelector('#global-scale-anchors').style.display = 'none';
          modal.querySelector('#global-scale-type-container').style.display = 'none';
          modal.querySelector('#global-bws-anchors-container').style.display = 'none';
        } else {
          this.showError(result.error || 'Failed to create variable');
        }
      } catch (error) {
        console.error('Error creating variable:', error);
        this.showError('Error creating variable');
      }
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
      }
    });
  }

  renderGlobalVariablesList(variables) {
    if (!variables || variables.length === 0) {
      return '<p style="color: #6b7280; text-align: center; padding: 24px; background: #1f2937; border-radius: 8px;">No global variables defined yet.</p>';
    }

    return `
      <div style="display: grid; gap: 12px;">
        ${variables.map(v => `
          <div style="background: #111827; border: 1px solid #374151; border-radius: 6px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <h5 style="margin: 0; color: #f3f4f6;">${this.escapeHtml(v.label)}</h5>
                  <span style="padding: 2px 8px; background: ${v.genre === 'pdf' ? '#7c3aed' : v.genre === 'youtube' ? '#ef4444' : '#10b981'}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">
                    ${v.genre === 'pdf' ? '📄 PDF' : v.genre === 'youtube' ? '📹 YouTube' : '🌐 Universal'}
                  </span>
                </div>
                <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px;">${this.escapeHtml(v.definition || 'No definition')}</p>
                <div style="display: flex; gap: 12px; font-size: 12px; color: #6b7280;">
                  <span>Scale: ${this.escapeHtml(v.scale_type)}</span>
                  <span>•</span>
                  <span>Depth: ${this.escapeHtml(v.reasoning_depth)}</span>
                </div>
              </div>
              <button onclick="window.collectionsHub.deleteGlobalVariable(${v.id}, '${this.escapeHtml(v.label)}')"
                style="padding: 6px 12px; background: #7f1d1d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                Delete
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  updateGlobalVariableType() {
    const variableType = document.querySelector('#global-variable-type')?.value;
    const scaleTypeContainer = document.querySelector('#global-scale-type-container');
    const bwsAnchorsContainer = document.querySelector('#global-bws-anchors-container');
    const scaleAnchorsSection = document.querySelector('#global-scale-anchors');

    if (!variableType) {
      // Hide both if no type selected
      if (scaleTypeContainer) scaleTypeContainer.style.display = 'none';
      if (bwsAnchorsContainer) bwsAnchorsContainer.style.display = 'none';
      if (scaleAnchorsSection) scaleAnchorsSection.style.display = 'none';
      return;
    }

    if (variableType === 'rating') {
      // Show rating fields, hide BWS fields
      if (scaleTypeContainer) scaleTypeContainer.style.display = 'block';
      if (bwsAnchorsContainer) bwsAnchorsContainer.style.display = 'none';
      if (scaleAnchorsSection) scaleAnchorsSection.style.display = 'none';
    } else if (variableType === 'bws') {
      // Show BWS fields, hide rating fields
      if (scaleTypeContainer) scaleTypeContainer.style.display = 'none';
      if (bwsAnchorsContainer) bwsAnchorsContainer.style.display = 'block';
      if (scaleAnchorsSection) scaleAnchorsSection.style.display = 'none';
    }
  }

  updateGlobalAnchorFields() {
    const scaleType = document.querySelector('#global-scale-type')?.value;
    const anchorsSection = document.querySelector('#global-scale-anchors');
    const anchorsContainer = document.querySelector('#global-anchors-container');

    if (!scaleType || !anchorsSection || !anchorsContainer) return;

    // Scale type configurations
    const scaleConfigs = {
      'binary': [0, 1],
      '3point': [1, 2, 3],
      '4point': [1, 2, 3, 4],
      '5point': [1, 2, 3, 4, 5],
      '7point': [1, 2, 3, 4, 5, 6, 7],
      '10point': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      '100point': [0, 100]  // Only endpoints for 100-point
    };

    const points = scaleConfigs[scaleType];
    if (!points) {
      anchorsSection.style.display = 'none';
      return;
    }

    anchorsSection.style.display = 'block';
    anchorsContainer.innerHTML = points.map(point => `
      <div style="display: flex; gap: 8px; align-items: center;">
        <label style="min-width: 40px; color: #e5e7eb; font-size: 14px;">${point}:</label>
        <input type="text" data-anchor="${point}" placeholder="Define what ${point} means..."
          style="flex: 1; padding: 6px 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px; font-size: 13px;">
      </div>
    `).join('');
  }

  async deleteGlobalVariable(variableId, variableLabel) {
    if (!confirm(`Are you sure you want to delete the global variable "${variableLabel}"? This will affect all collections using this variable.`)) {
      return;
    }

    try {
      const result = await window.api.pdf.deleteGlobalRatingVariable(variableId);
      if (result.success) {
        this.showSuccess(`Variable "${variableLabel}" deleted`);
        // Re-open the modal to refresh
        await this.showGlobalManageVariablesModal();
      } else {
        this.showError(result.error || 'Failed to delete variable');
      }
    } catch (error) {
      console.error('Error deleting variable:', error);
      this.showError('Error deleting variable');
    }
  }

  renderVariablesList(variables) {
    if (!variables || variables.length === 0) {
      return '<p style="color: #6b7280; text-align: center; padding: 24px;">No variables defined yet.</p>';
    }

    return `
      <div style="display: grid; gap: 12px;">
        ${variables.map(v => `
          <div style="background: #111827; border: 1px solid #374151; border-radius: 6px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <h5 style="margin: 0 0 8px 0; color: #f3f4f6;">${this.escapeHtml(v.label)}</h5>
                <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px;">${this.escapeHtml(v.definition || 'No definition')}</p>
                <div style="display: flex; gap: 12px; font-size: 12px; color: #6b7280;">
                  <span>Scale: ${this.escapeHtml(v.scale_type)}</span>
                  <span>•</span>
                  <span>Depth: ${this.escapeHtml(v.reasoning_depth)}</span>
                </div>
              </div>
              <button onclick="window.collectionsHub.deleteVariable(${v.id}, '${this.escapeHtml(v.label)}')"
                style="padding: 6px 12px; background: #7f1d1d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                Delete
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  updateAnchorFields() {
    const scaleType = document.querySelector('#scale-type')?.value;
    const anchorsSection = document.querySelector('#scale-anchors');
    const anchorsContainer = document.querySelector('#anchors-container');

    if (!scaleType || !anchorsSection || !anchorsContainer) return;

    // Scale type configurations
    const scaleConfigs = {
      'binary': [0, 1],
      '3point': [1, 2, 3],
      '4point': [1, 2, 3, 4],
      '5point': [1, 2, 3, 4, 5],
      '7point': [1, 2, 3, 4, 5, 6, 7],
      '10point': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      '100point': [0, 100]  // Only endpoints for 100-point
    };

    const points = scaleConfigs[scaleType];
    if (!points) {
      anchorsSection.style.display = 'none';
      return;
    }

    anchorsSection.style.display = 'block';
    anchorsContainer.innerHTML = points.map(point => `
      <div style="display: flex; gap: 8px; align-items: center;">
        <label style="min-width: 40px; color: #e5e7eb; font-size: 14px;">${point}:</label>
        <input type="text" data-anchor="${point}" placeholder="Define what ${point} means..."
          style="flex: 1; padding: 6px 8px; border: 1px solid #374151; background: #111827; color: #f3f4f6; border-radius: 4px; font-size: 13px;">
      </div>
    `).join('');
  }

  async deleteVariable(variableId, variableLabel) {
    if (!confirm(`Are you sure you want to delete the variable "${variableLabel}"? This will also delete all ratings for this variable.`)) {
      return;
    }

    try {
      const result = await window.api.pdf.deleteRatingVariable(variableId);
      if (result.success) {
        this.showSuccess(`Variable "${variableLabel}" deleted`);
        // The list will be refreshed when the modal is reopened
        location.reload(); // Simple way to refresh - could be improved
      } else {
        this.showError(result.error || 'Failed to delete variable');
      }
    } catch (error) {
      console.error('Error deleting variable:', error);
      this.showError('Error deleting variable');
    }
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
    window.collectionsHub = new CollectionsHub();
  });
} else {
  // DOM is already ready
  window.collectionsHub = new CollectionsHub();
}
