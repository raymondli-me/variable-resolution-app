/**
 * PDF Excerpt Viewer Component
 * Dedicated viewer for browsing PDF excerpts with pagination
 */
class PDFExcerptViewer {
  constructor() {
    this.currentCollection = null;
    this.currentPDF = null;
    this.allExcerpts = [];
    this.filteredExcerpts = [];
    this.currentPage = 1;
    this.excerptsPerPage = 20;
    this.searchTerm = '';
    this.createModal();
  }

  createModal() {
    const modalHtml = `
      <div id="pdfExcerptViewerModal" class="pdf-modal" style="display: none;">
        <div class="pdf-modal-content">
          <div class="pdf-modal-header">
            <div class="pdf-header-info">
              <h2 id="pdfCollectionTitle">PDF Collection</h2>
              <div class="pdf-meta" id="pdfCollectionMeta"></div>
            </div>
            <button class="pdf-close-btn" onclick="window.pdfExcerptViewer.close()">×</button>
          </div>

          <!-- PDF Selector (if multiple PDFs) -->
          <div id="pdfSelectorSection" class="pdf-selector-section" style="display: none;">
            <label>Select PDF:</label>
            <select id="pdfSelector" onchange="window.pdfExcerptViewer.switchPDF(this.value)">
            </select>
          </div>

          <!-- Search Bar -->
          <div class="pdf-search-section">
            <input
              type="text"
              id="excerptSearch"
              placeholder="Search within excerpts..."
              oninput="window.pdfExcerptViewer.handleSearch(this.value)"
            />
            <span id="searchResultCount"></span>
          </div>

          <!-- Excerpts List -->
          <div class="pdf-excerpts-container">
            <div id="excerptsList" class="excerpts-list">
              <div class="loading">Loading excerpts...</div>
            </div>
          </div>

          <!-- Pagination Controls -->
          <div class="pdf-pagination">
            <button
              id="prevPageBtn"
              class="pagination-btn"
              onclick="window.pdfExcerptViewer.prevPage()"
              disabled
            >
              « Previous
            </button>
            <span id="pageInfo">Page 1 of 1</span>
            <button
              id="nextPageBtn"
              class="pagination-btn"
              onclick="window.pdfExcerptViewer.nextPage()"
              disabled
            >
              Next »
            </button>
          </div>

          <!-- Actions -->
          <div class="pdf-modal-actions">
            <button class="btn btn-secondary" onclick="window.pdfExcerptViewer.exportExcerpts()">
              Export to Text
            </button>
            <button class="btn" onclick="window.pdfExcerptViewer.close()">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async show(collectionId) {
    try {
      // Load collection metadata
      const collection = await window.api.database.getCollection(collectionId);
      if (!collection) {
        this.showNotification('Failed to load collection', 'error');
        return;
      }

      this.currentCollection = collection;

      // Load PDFs in collection
      const pdfsResult = await window.api.pdf.list(collectionId);
      if (!pdfsResult.success || !pdfsResult.data || pdfsResult.data.length === 0) {
        this.showNotification('No PDFs found in this collection', 'error');
        return;
      }

      const pdfs = pdfsResult.data;
      this.currentCollection.pdfs = pdfs;

      // Update header
      document.getElementById('pdfCollectionTitle').textContent = collection.search_term;

      const totalExcerpts = pdfs.reduce((sum, pdf) => sum + (pdf.excerpts_count || 0), 0);
      const metaText = `${pdfs.length} PDF${pdfs.length > 1 ? 's' : ''} • ${totalExcerpts} excerpts • Created ${new Date(collection.created_at).toLocaleDateString()}`;
      document.getElementById('pdfCollectionMeta').textContent = metaText;

      // Setup PDF selector if multiple PDFs
      if (pdfs.length > 1) {
        this.setupPDFSelector(pdfs);
      } else {
        document.getElementById('pdfSelectorSection').style.display = 'none';
      }

      // Load excerpts for first PDF
      await this.switchPDF(pdfs[0].id);

      // Show modal
      document.getElementById('pdfExcerptViewerModal').style.display = 'flex';

      // Close on Escape key
      this.escapeHandler = (e) => {
        if (e.key === 'Escape') {
          this.close();
        }
      };
      document.addEventListener('keydown', this.escapeHandler);

    } catch (error) {
      console.error('[PDFExcerptViewer] Error loading collection:', error);
      this.showNotification('Error loading collection: ' + error.message, 'error');
    }
  }

  setupPDFSelector(pdfs) {
    const selector = document.getElementById('pdfSelector');
    selector.innerHTML = pdfs.map(pdf => `
      <option value="${pdf.id}">
        ${this.escapeHtml(pdf.title)} (${pdf.num_pages || 0} pages, ${pdf.excerpts_count || 0} excerpts)
      </option>
    `).join('');

    document.getElementById('pdfSelectorSection').style.display = 'block';
  }

  async switchPDF(pdfId) {
    try {
      this.currentPDF = this.currentCollection.pdfs.find(p => p.id == pdfId);
      if (!this.currentPDF) {
        console.error('PDF not found:', pdfId);
        return;
      }

      // Show loading state
      document.getElementById('excerptsList').innerHTML = '<div class="loading">Loading excerpts...</div>';

      // Load excerpts
      const result = await window.api.pdf.getExcerpts(pdfId);
      if (!result.success || !result.data) {
        document.getElementById('excerptsList').innerHTML = '<div class="empty-state">No excerpts found</div>';
        return;
      }

      this.allExcerpts = result.data;
      this.filteredExcerpts = [...this.allExcerpts];
      this.currentPage = 1;
      this.searchTerm = '';
      document.getElementById('excerptSearch').value = '';

      this.renderExcerpts();
    } catch (error) {
      console.error('[PDFExcerptViewer] Error loading excerpts:', error);
      document.getElementById('excerptsList').innerHTML = '<div class="empty-state error">Error loading excerpts</div>';
    }
  }

  renderExcerpts() {
    const excerptsList = document.getElementById('excerptsList');

    if (this.filteredExcerpts.length === 0) {
      excerptsList.innerHTML = this.searchTerm
        ? '<div class="empty-state">No excerpts match your search</div>'
        : '<div class="empty-state">No excerpts found</div>';
      this.updatePagination();
      return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(this.filteredExcerpts.length / this.excerptsPerPage);
    const startIdx = (this.currentPage - 1) * this.excerptsPerPage;
    const endIdx = Math.min(startIdx + this.excerptsPerPage, this.filteredExcerpts.length);
    const pageExcerpts = this.filteredExcerpts.slice(startIdx, endIdx);

    // Render excerpt cards
    excerptsList.innerHTML = pageExcerpts.map(excerpt => {
      const text = excerpt.text_content || '';
      const highlightedText = this.searchTerm
        ? this.highlightText(text, this.searchTerm)
        : this.escapeHtml(text);

      return `
        <div class="excerpt-card">
          <div class="excerpt-card-header">
            <span class="excerpt-number">Excerpt ${excerpt.excerpt_number || '?'}</span>
            <span class="excerpt-page-badge">Page ${excerpt.page_number || '?'}</span>
          </div>
          <div class="excerpt-text">${highlightedText}</div>
          <div class="excerpt-card-footer">
            <span class="excerpt-meta">${text.length} characters</span>
          </div>
        </div>
      `;
    }).join('');

    this.updatePagination();
  }

  updatePagination() {
    const totalPages = Math.ceil(this.filteredExcerpts.length / this.excerptsPerPage);

    // Update page info
    const pageInfo = document.getElementById('pageInfo');
    if (this.filteredExcerpts.length === 0) {
      pageInfo.textContent = 'No results';
    } else {
      const startIdx = (this.currentPage - 1) * this.excerptsPerPage + 1;
      const endIdx = Math.min(this.currentPage * this.excerptsPerPage, this.filteredExcerpts.length);
      pageInfo.textContent = `${startIdx}-${endIdx} of ${this.filteredExcerpts.length} excerpts (Page ${this.currentPage} of ${totalPages})`;
    }

    // Update button states
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = this.currentPage >= totalPages || totalPages === 0;

    // Update search result count
    if (this.searchTerm) {
      document.getElementById('searchResultCount').textContent =
        `${this.filteredExcerpts.length} results`;
    } else {
      document.getElementById('searchResultCount').textContent = '';
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.filteredExcerpts.length / this.excerptsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderExcerpts();
      document.querySelector('.pdf-excerpts-container').scrollTop = 0;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderExcerpts();
      document.querySelector('.pdf-excerpts-container').scrollTop = 0;
    }
  }

  handleSearch(searchTerm) {
    this.searchTerm = searchTerm.toLowerCase().trim();

    if (!this.searchTerm) {
      this.filteredExcerpts = [...this.allExcerpts];
    } else {
      this.filteredExcerpts = this.allExcerpts.filter(excerpt =>
        excerpt.text_content.toLowerCase().includes(this.searchTerm)
      );
    }

    this.currentPage = 1;
    this.renderExcerpts();
  }

  highlightText(text, searchTerm) {
    if (!searchTerm) return this.escapeHtml(text);

    const escapedText = this.escapeHtml(text);
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, 'gi');

    return escapedText.replace(regex, '<mark>$1</mark>');
  }

  async exportExcerpts() {
    if (!this.currentPDF || !this.filteredExcerpts || this.filteredExcerpts.length === 0) {
      this.showNotification('No excerpts to export', 'error');
      return;
    }

    try {
      // Generate text content
      const title = this.currentPDF.title || 'PDF Excerpts';
      const date = new Date().toLocaleString();
      let content = `${title}\n`;
      content += `Exported: ${date}\n`;
      content += `Total excerpts: ${this.filteredExcerpts.length}\n`;
      content += `\n${'='.repeat(80)}\n\n`;

      this.filteredExcerpts.forEach((excerpt, idx) => {
        content += `Excerpt ${excerpt.excerpt_number || idx + 1} (Page ${excerpt.page_number || '?'})\n`;
        content += `${'-'.repeat(80)}\n`;
        content += `${excerpt.text_content}\n\n`;
      });

      // Create blob and download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentPDF.title.replace(/[^a-z0-9]/gi, '_')}_excerpts.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification('Excerpts exported successfully', 'success');
    } catch (error) {
      console.error('[PDFExcerptViewer] Export error:', error);
      this.showNotification('Export failed: ' + error.message, 'error');
    }
  }

  close() {
    document.getElementById('pdfExcerptViewerModal').style.display = 'none';

    // Remove escape key handler
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }

    // Reset state
    this.currentCollection = null;
    this.currentPDF = null;
    this.allExcerpts = [];
    this.filteredExcerpts = [];
    this.currentPage = 1;
    this.searchTerm = '';
  }

  // Helpers
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    if (window.toastNotification) {
      window.toastNotification[type](message);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
}

// Initialize and expose globally
const pdfExcerptViewer = new PDFExcerptViewer();
window.pdfExcerptViewer = pdfExcerptViewer;
