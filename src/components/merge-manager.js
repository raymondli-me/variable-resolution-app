/**
 * Merge Manager Component
 * Handles UI for creating and managing merged collections
 */

class MergeManager {
  constructor() {
    this.currentMerges = [];
    this.availableCollections = [];
    this.selectedCollections = new Set();

    this.initializeElements();
    this.attachEventListeners();
  }

  initializeElements() {
    // Main view elements
    this.mergeListEl = document.getElementById('mergeList');
    this.createMergeBtn = document.getElementById('createMergeBtn');

    // Create modal elements
    this.createModal = document.getElementById('createMergeModal');
    this.mergeNameInput = document.getElementById('mergeName');
    this.mergeDescInput = document.getElementById('mergeDescription');
    this.collectionsListEl = document.getElementById('mergeCollectionsList');
    this.previewEl = document.getElementById('mergePreview');
    this.confirmBtn = document.getElementById('confirmCreateMergeBtn');

    // View modal elements
    this.viewModal = document.getElementById('viewMergeModal');
    this.viewMergeNameEl = document.getElementById('viewMergeName');
    this.viewMergeContentEl = document.getElementById('viewMergeContent');
    this.deleteMergeBtn = document.getElementById('deleteMergeBtn');

    this.currentViewingMergeId = null;
  }

  attachEventListeners() {
    // Create merge button
    if (this.createMergeBtn) {
      this.createMergeBtn.addEventListener('click', () => this.openCreateModal());
    }

    // Confirm create button
    if (this.confirmBtn) {
      this.confirmBtn.addEventListener('click', () => this.createMerge());
    }

    // Delete merge button
    if (this.deleteMergeBtn) {
      this.deleteMergeBtn.addEventListener('click', () => this.deleteMerge());
    }

    // Listen for navigation to collections view
    document.addEventListener('viewChanged', (e) => {
      if (e.detail.view === 'collections') {
        // Check if merged tab is active
        const mergedTab = document.getElementById('mergedTab');
        if (mergedTab && mergedTab.classList.contains('active')) {
          this.loadMerges();
        }
      }
    });

    // Listen for tab changes within collections view
    const tabButtons = document.querySelectorAll('.tab-btn[data-tab="merged"]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Small delay to ensure tab is switched
        setTimeout(() => this.loadMerges(), 100);
      });
    });
  }

  /**
   * Load and display all merges
   */
  async loadMerges() {
    try {
      const merges = await window.api.database.getAllMerges();
      this.currentMerges = merges;
      this.renderMergeList();
    } catch (error) {
      console.error('[MergeManager] Error loading merges:', error);
      this.showError('Failed to load merged collections');
    }
  }

  /**
   * Render the list of merges
   */
  renderMergeList() {
    if (this.currentMerges.length === 0) {
      this.mergeListEl.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 7h16M4 12h16M4 17h16"></path>
            <path d="M12 3v18" opacity="0.3"></path>
          </svg>
          <h3>No Merged Collections</h3>
          <p>Combine multiple collections into one dataset for analysis or rating</p>
          <button class="btn btn-primary" onclick="mergeManager.openCreateModal()">Create Your First Merge</button>
        </div>
      `;
      return;
    }

    const cardsHTML = this.currentMerges.map(merge => this.renderMergeCard(merge)).join('');
    this.mergeListEl.innerHTML = cardsHTML;

    // Attach click handlers
    this.mergeListEl.querySelectorAll('.merge-card').forEach((card, index) => {
      card.addEventListener('click', () => this.viewMerge(this.currentMerges[index].id));
    });
  }

  /**
   * Render a single merge card
   */
  renderMergeCard(merge) {
    const created = new Date(merge.created_at).toLocaleDateString();
    const sourceCount = merge.collection_count || merge.source_collections?.length || 0;

    // Calculate approximate stats
    let totalVideos = 0;
    let totalComments = 0;

    if (merge.source_collections) {
      merge.source_collections.forEach(c => {
        totalVideos += c.video_count || 0;
        totalComments += c.comment_count || 0;
      });
    }

    const sourceChips = merge.source_collections
      ? merge.source_collections.slice(0, 3).map(c =>
          `<span class="source-chip" title="${c.search_term}">${c.search_term}</span>`
        ).join('')
      : '';

    const moreChip = sourceCount > 3
      ? `<span class="source-chip">+${sourceCount - 3} more</span>`
      : '';

    return `
      <div class="merge-card" data-merge-id="${merge.id}">
        <div class="merge-card-header">
          <h3 class="merge-card-title">${merge.name}</h3>
          <span class="merge-card-badge">${sourceCount} Collections</span>
        </div>

        ${merge.description ? `<p class="merge-card-description">${merge.description}</p>` : ''}

        <div class="merge-card-stats">
          <div class="merge-stat">
            <span class="merge-stat-value">${sourceCount}</span>
            <span class="merge-stat-label">Collections</span>
          </div>
          <div class="merge-stat">
            <span class="merge-stat-value">~${totalVideos}</span>
            <span class="merge-stat-label">Videos</span>
          </div>
          <div class="merge-stat">
            <span class="merge-stat-value">~${totalComments}</span>
            <span class="merge-stat-label">Comments</span>
          </div>
        </div>

        ${sourceChips || moreChip ? `
          <div class="merge-source-chips">
            ${sourceChips}${moreChip}
          </div>
        ` : ''}

        <div class="merge-card-footer">
          <span>Created ${created}</span>
          <span>ID: ${merge.id}</span>
        </div>
      </div>
    `;
  }

  /**
   * Open the create merge modal
   */
  async openCreateModal() {
    try {
      // Load available collections
      const collections = await window.api.database.getCollections(100, 0);
      this.availableCollections = collections;
      this.selectedCollections.clear();

      // Render collection checkboxes
      this.renderCollectionCheckboxes();

      // Reset form
      this.mergeNameInput.value = '';
      this.mergeDescInput.value = '';
      this.previewEl.style.display = 'none';
      this.confirmBtn.disabled = true;

      // Show modal
      this.createModal.style.display = 'flex';
    } catch (error) {
      console.error('[MergeManager] Error opening create modal:', error);
      this.showError('Failed to load collections');
    }
  }

  /**
   * Render collection checkboxes in the modal
   */
  renderCollectionCheckboxes() {
    if (this.availableCollections.length === 0) {
      this.collectionsListEl.innerHTML = `
        <div class="empty-state" style="padding: 2rem;">
          <p>No collections available to merge</p>
          <p style="font-size: 0.875rem; margin-top: 0.5rem;">Create some collections first!</p>
        </div>
      `;
      return;
    }

    const checkboxesHTML = this.availableCollections.map(collection => {
      const settings = typeof collection.settings === 'string'
        ? JSON.parse(collection.settings)
        : collection.settings || {};

      return `
        <div class="collection-checkbox-item">
          <input
            type="checkbox"
            id="coll_${collection.id}"
            value="${collection.id}"
            onchange="mergeManager.onCollectionToggle(${collection.id}, this.checked)"
          />
          <label for="coll_${collection.id}" class="collection-checkbox-label">
            <div class="collection-checkbox-name">${collection.search_term}</div>
            <div class="collection-checkbox-stats">
              ${collection.video_count || 0} videos · ${collection.comment_count || 0} comments
              ${collection.created_at ? '· ' + new Date(collection.created_at).toLocaleDateString() : ''}
            </div>
          </label>
        </div>
      `;
    }).join('');

    this.collectionsListEl.innerHTML = checkboxesHTML;
  }

  /**
   * Handle collection checkbox toggle
   */
  onCollectionToggle(collectionId, checked) {
    if (checked) {
      this.selectedCollections.add(collectionId);
    } else {
      this.selectedCollections.delete(collectionId);
    }

    this.updatePreview();
  }

  /**
   * Update the merge preview
   */
  updatePreview() {
    const selectedCount = this.selectedCollections.size;

    // Enable/disable confirm button
    this.confirmBtn.disabled = selectedCount < 2 || !this.mergeNameInput.value.trim();

    // Show/hide preview
    if (selectedCount >= 2) {
      const selectedColls = this.availableCollections.filter(c =>
        this.selectedCollections.has(c.id)
      );

      let totalVideos = 0;
      let totalComments = 0;
      selectedColls.forEach(c => {
        totalVideos += c.video_count || 0;
        totalComments += c.comment_count || 0;
      });

      document.getElementById('previewCollectionCount').textContent = selectedCount;
      document.getElementById('previewVideoCount').textContent = `~${totalVideos}`;
      document.getElementById('previewCommentCount').textContent = `~${totalComments}`;

      this.previewEl.style.display = 'block';
    } else {
      this.previewEl.style.display = 'none';
    }
  }

  /**
   * Create the merge
   */
  async createMerge() {
    const name = this.mergeNameInput.value.trim();
    const description = this.mergeDescInput.value.trim();
    const collectionIds = Array.from(this.selectedCollections);

    if (!name || collectionIds.length < 2) {
      this.showError('Please provide a name and select at least 2 collections');
      return;
    }

    try {
      this.confirmBtn.disabled = true;
      this.confirmBtn.textContent = 'Creating...';

      const mergeId = await window.api.database.createMerge(name, collectionIds, { description });

      console.log(`[MergeManager] Created merge #${mergeId}: "${name}"`);

      // Close modal
      this.createModal.style.display = 'none';

      // Reload merges
      await this.loadMerges();

      // Show success
      this.showSuccess(`Merged collection "${name}" created successfully!`);

      // Open the new merge
      this.viewMerge(mergeId);

    } catch (error) {
      console.error('[MergeManager] Error creating merge:', error);
      this.showError('Failed to create merge: ' + error.message);
      this.confirmBtn.disabled = false;
      this.confirmBtn.textContent = 'Create Merge';
    }
  }

  /**
   * View a merge
   */
  async viewMerge(mergeId) {
    try {
      this.currentViewingMergeId = mergeId;

      const merge = await window.api.database.getMerge(mergeId);
      const stats = await window.api.database.getMergeStatistics(mergeId);

      if (!merge) {
        this.showError('Merge not found');
        return;
      }

      // Update modal title
      this.viewMergeNameEl.textContent = merge.name;

      // Render merge details
      this.viewMergeContentEl.innerHTML = this.renderMergeDetails(merge, stats);

      // Show modal
      this.viewModal.style.display = 'flex';

    } catch (error) {
      console.error('[MergeManager] Error viewing merge:', error);
      this.showError('Failed to load merge details');
    }
  }

  /**
   * Render merge detail view
   */
  renderMergeDetails(merge, stats) {
    return `
      ${merge.description ? `
        <div class="merge-detail-section">
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${merge.description}</p>
        </div>
      ` : ''}

      <div class="merge-detail-section">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          Statistics
        </h3>
        <div class="preview-stats">
          <div class="stat-item">
            <span class="stat-label">Collections</span>
            <span class="stat-value">${stats.total_collections}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Videos</span>
            <span class="stat-value">${stats.total_videos}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Unique Videos</span>
            <span class="stat-value">${stats.unique_videos}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Comments</span>
            <span class="stat-value">${stats.total_comments}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Video Chunks</span>
            <span class="stat-value">${stats.total_chunks}</span>
          </div>
          ${stats.duplicate_videos > 0 ? `
            <div class="stat-item">
              <span class="stat-label">Duplicates</span>
              <span class="stat-value" style="color: var(--warning);">${stats.duplicate_videos}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="merge-detail-section">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
          Source Collections
        </h3>
        <div class="source-collection-list">
          ${merge.source_collections.map(c => `
            <div class="source-collection-item">
              <div>
                <div class="source-collection-name">${c.search_term}</div>
                <div class="source-collection-stats">
                  ${c.video_count || 0} videos · ${c.comment_count || 0} comments
                </div>
              </div>
              <button class="remove-source-btn" onclick="mergeManager.removeSource(${merge.id}, ${c.id})">
                Remove
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="merge-detail-section" style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
        <button class="btn btn-primary" onclick="mergeManager.browseContent(${merge.id})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Browse Content
        </button>
        <button class="btn" onclick="mergeManager.exportMerge(${merge.id})">
          Export This Merge
        </button>
      </div>
    `;
  }

  /**
   * Remove a source collection from merge
   */
  async removeSource(mergeId, collectionId) {
    if (!confirm('Remove this collection from the merge?')) return;

    try {
      await window.api.database.removeCollectionFromMerge(mergeId, collectionId);
      this.viewMerge(mergeId); // Refresh
      this.showSuccess('Collection removed from merge');
    } catch (error) {
      console.error('[MergeManager] Error removing source:', error);
      this.showError('Failed to remove collection');
    }
  }

  /**
   * Delete a merge
   */
  async deleteMerge() {
    if (!this.currentViewingMergeId) return;

    if (!confirm('Delete this merged collection? This cannot be undone.')) return;

    try {
      await window.api.database.deleteMerge(this.currentViewingMergeId);

      this.viewModal.style.display = 'none';
      this.loadMerges();
      this.showSuccess('Merged collection deleted');

    } catch (error) {
      console.error('[MergeManager] Error deleting merge:', error);
      this.showError('Failed to delete merge');
    }
  }

  /**
   * Browse content of a merge
   */
  browseContent(mergeId) {
    // Close the merge detail modal
    this.viewModal.style.display = 'none';

    // Open the viewer for this merge (using the same viewer as regular collections)
    if (typeof galleryViewer !== 'undefined') {
      galleryViewer.showMerge(mergeId);
    } else if (typeof enhancedViewer !== 'undefined') {
      enhancedViewer.showMerge(mergeId);
    } else if (window.collectionViewer) {
      window.collectionViewer.showMerge(mergeId);
    } else {
      this.showError('Collection viewer not available');
    }
  }

  /**
   * Export a merge
   */
  async exportMerge(mergeId) {
    this.showInfo('Export functionality coming soon! Merges will be exportable just like regular collections.');
  }

  /**
   * Show error message
   */
  showError(message) {
    if (window.toastManager) {
      window.toastManager.show(message, 'error');
    } else {
      alert('Error: ' + message);
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    if (window.toastManager) {
      window.toastManager.show(message, 'success');
    } else {
      alert(message);
    }
  }

  /**
   * Show info message
   */
  showInfo(message) {
    if (window.toastManager) {
      window.toastManager.show(message, 'info');
    } else {
      alert(message);
    }
  }
}

// Initialize when DOM is ready
let mergeManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mergeManager = new MergeManager();
    window.mergeManager = mergeManager;
  });
} else {
  mergeManager = new MergeManager();
  window.mergeManager = mergeManager;
}

// Also check when merge name input changes
if (document.getElementById('mergeName')) {
  document.getElementById('mergeName').addEventListener('input', () => {
    if (window.mergeManager) {
      window.mergeManager.updatePreview();
    }
  });
}
