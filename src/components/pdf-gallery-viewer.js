/**
 * PDF Gallery Viewer
 * Displays a grid of PDF documents within a collection
 */
class PDFGalleryViewer {
  constructor() {
    this.currentCollection = null;
    this.pdfs = [];
    this.createModal();
  }

  createModal() {
    const modal = document.createElement('div');
    modal.className = 'gallery-modal pdf-gallery-modal';
    modal.innerHTML = `
      <div class="gallery-container">
        <div class="gallery-header">
          <div class="gallery-title">
            <h2 id="pdfGalleryTitle">PDF Collection</h2>
            <div class="collection-stats">
              <span id="pdfGalleryStats"></span>
            </div>
          </div>
          <div class="gallery-controls">
            <button class="close-btn" onclick="pdfGalleryViewer.close()">×</button>
          </div>
        </div>

        <div class="gallery-body">
          <div id="pdfGalleryView" class="pdf-gallery-view">
            <div id="pdfGrid" class="pdf-grid"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
  }

  async show(collectionId) {
    this.currentCollection = collectionId;
    await this.loadPDFs(collectionId);
    this.render();
    this.modal.classList.add('active');
  }

  async loadPDFs(collectionId) {
    try {
      // Get collection info
      const collection = await window.api.database.getCollection(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }

      // Get all PDFs in this collection
      const result = await window.api.pdf.list(collectionId);
      if (result.success && result.pdfs) {
        this.pdfs = result.pdfs;
      } else {
        this.pdfs = [];
      }

      // Update title and stats
      const titleEl = document.getElementById('pdfGalleryTitle');
      if (titleEl) {
        titleEl.textContent = collection.search_term || 'PDF Collection';
      }

      const statsEl = document.getElementById('pdfGalleryStats');
      if (statsEl) {
        const totalExcerpts = this.pdfs.reduce((sum, pdf) => sum + (pdf.excerpts_count || 0), 0);
        statsEl.textContent = `${this.pdfs.length} PDFs • ${totalExcerpts} Excerpts`;
      }
    } catch (error) {
      console.error('Error loading PDFs:', error);
      this.pdfs = [];
    }
  }

  render() {
    const grid = document.getElementById('pdfGrid');
    if (!grid) return;

    if (this.pdfs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <h3>No PDFs Found</h3>
          <p>This collection doesn't contain any PDF documents yet.</p>
        </div>
      `;
      return;
    }

    // Render PDF cards
    grid.innerHTML = this.pdfs.map(pdf => this.renderPDFCard(pdf)).join('');

    // Attach click handlers
    grid.querySelectorAll('.pdf-card').forEach(card => {
      card.addEventListener('click', () => {
        const pdfId = parseInt(card.dataset.pdfId);
        this.openPDF(pdfId);
      });
    });
  }

  renderPDFCard(pdf) {
    const createdDate = new Date(pdf.created_at).toLocaleDateString();

    return `
      <div class="pdf-card" data-pdf-id="${pdf.id}">
        <div class="pdf-card-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <div class="pdf-card-content">
          <h3 class="pdf-card-title">${this.escapeHtml(pdf.title)}</h3>
          <div class="pdf-card-stats">
            <span class="pdf-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
              </svg>
              ${pdf.num_pages} pages
            </span>
            <span class="pdf-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              ${pdf.excerpts_count} excerpts
            </span>
          </div>
          <div class="pdf-card-date">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${createdDate}
          </div>
        </div>
      </div>
    `;
  }

  openPDF(pdfId) {
    // Save collectionId before closing (close() sets it to null)
    const collectionId = this.currentCollection;

    // Close the gallery and open the PDF excerpt viewer for this specific PDF
    this.close();

    // Open the PDF excerpt viewer
    if (window.pdfExcerptViewer) {
      window.pdfExcerptViewer.show(collectionId, pdfId);
    } else {
      console.error('PDF Excerpt Viewer not available');
    }
  }

  close() {
    this.modal.classList.remove('active');
    this.currentCollection = null;
    this.pdfs = [];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
let pdfGalleryViewer;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    pdfGalleryViewer = new PDFGalleryViewer();
    window.pdfGalleryViewer = pdfGalleryViewer;
  });
} else {
  pdfGalleryViewer = new PDFGalleryViewer();
  window.pdfGalleryViewer = pdfGalleryViewer;
}
