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
    console.log('View collection:', collectionId);
    // TODO: This will be wired up to the actual viewer in a future task
  }

  handleMenuClick(collectionId) {
    console.log('Open menu for collection:', collectionId);
    // TODO: This will be wired up to the context menu in a future task
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
        this.handleMenuClick(collectionId);
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
