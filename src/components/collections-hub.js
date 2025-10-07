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
      } else {
        console.error('Failed to load collections:', result.error);
        this.collections = [];
      }
    } catch (error) {
      console.error('Error loading collections:', error);
      this.collections = [];
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
        console.log('Export collection:', collectionId);
        // TODO: Implement export functionality
        break;
      case 'duplicate':
        console.log('Duplicate collection:', collectionId);
        // TODO: Implement duplicate functionality
        break;
      case 'delete':
        console.log('Delete collection:', collectionId);
        // TODO: Implement delete functionality
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
        <div class="card-enrichments">
          <span>Enrichments: 0</span>
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
