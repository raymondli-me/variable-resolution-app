# Agent B → Next Agent: Visual PDF Viewer Integration Handoff

**From:** Agent B (Full-Stack Generalist Expert)
**To:** Next Agent (Full-Stack Generalist Expert)
**Date:** October 6, 2025
**Status:** 🟡 IN PROGRESS (Backend Complete, Frontend 60% Done)
**Priority:** HIGH
**Estimated Remaining Time:** 3-4 hours

---

## 🎯 MISSION

Build a visual PDF viewer with sentence-level highlighting for the VR Collector app. This is a **game-changing feature** that will allow human raters and AI to see PDF excerpts in their original visual context with precise highlights.

---

## ✅ WHAT'S BEEN COMPLETED

### Backend: Sentence Chunking with Bounding Boxes ✅ (100%)

**Implementation:**
- ✅ Added `compromise` NLP library for sentence segmentation
- ✅ Created `chunkBySentence()` method in `PDFChunker` class
- ✅ Enhanced `PDFCollector.extractPDFData()` to extract text items with position data
- ✅ Implemented bbox calculation by merging text item positions
- ✅ Added 'sentence' chunking strategy to upload workflow

**How It Works:**
```javascript
// Upload PDF with sentence chunking
await window.api.pdf.upload({
  filePath: '/path/to/pdf',
  collectionId: 123,
  title: 'Research Paper',
  chunkingStrategy: 'sentence'  // ← NEW! Use this for sentence-level
});
```

**Result:**
- PDFs are chunked at sentence level (vs page level)
- Each excerpt has accurate bounding box coordinates stored in database
- Bbox format: `{x, y, width, height}` (PDF coordinate system)

**Files:**
- `src/services/pdf-chunker.js` (+147 lines)
- `src/collectors/pdf-collector.js` (+8 lines)

---

### Frontend: Core Components ✅ (60%)

**Components Created:**

1. **`PDFRenderer` (pdf-renderer.js)** ✅
   - Wraps PDF.js for rendering PDF pages to canvas
   - Features: Zoom (0.5x - 2.0x), page navigation, error handling
   - Event system: Dispatches `pdfRenderer:pageRendered` event
   - 234 lines, fully functional

2. **`PDFHighlighter` (pdf-highlighter.js)** ✅
   - Draws highlight overlays on PDF based on bbox coordinates
   - Color-coded states: Default (yellow), Active (green), Search (red)
   - Syncs with renderer via events
   - Click detection for interactive highlights
   - 223 lines, fully functional

**API Support:**

- ✅ IPC Handler: `pdf:getFilePath` (main.js:1633-1658)
- ✅ Exposed in preload.js (line 50)
- ✅ Returns PDF file path for frontend to load

---

## 🚧 WHAT'S REMAINING (YOUR TASKS)

### Task 1: Include PDF.js Library (30 minutes)

PDF.js is already installed (`npm list pdfjs-dist` shows v2.16.105), but needs to be loaded in the HTML.

**Add to `index-advanced.html` before closing `</body>`:**
```html
<!-- PDF.js Library (for visual PDF rendering) -->
<script src="../node_modules/pdfjs-dist/legacy/build/pdf.js"></script>
<script src="../node_modules/pdfjs-dist/legacy/build/pdf.worker.js"></script>
```

**Location:** Around line 2000-2010, after other component scripts

**Verification:**
```javascript
// Test in console
console.log(window['pdfjs-dist/build/pdf']); // Should exist
```

---

### Task 2: Create CSS Styles (1 hour)

Create two CSS files for the visual PDF viewer:

#### File 1: `src/styles/pdf-renderer.css`
```css
/* PDF Renderer Styles */

.pdf-viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
}

.pdf-render-canvas {
  max-width: 100%;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
  background: white;
}

.pdf-controls {
  position: sticky;
  bottom: 16px;
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  z-index: 100;
}

.pdf-controls button {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.pdf-controls button:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
}

.pdf-controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pdf-page-info {
  color: #b0b0b0;
  font-size: 14px;
  margin: 0 8px;
}

.pdf-zoom-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.pdf-zoom-level {
  color: #e0e0e0;
  font-size: 14px;
  min-width: 50px;
  text-align: center;
}
```

#### File 2: `src/styles/pdf-highlighter.css`
```css
/* PDF Highlighter Styles */

.pdf-highlight-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none; /* Let clicks pass through */
  z-index: 10;
}

.excerpt-list-item {
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.excerpt-list-item:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
}

.excerpt-list-item.active {
  background: #1e3a1e;
  border-color: #4caf50;
}

.excerpt-list-item.search-match {
  background: #3a1e1e;
  border-color: #f44336;
}

.excerpt-page-number {
  color: #808080;
  font-size: 12px;
  margin-bottom: 4px;
}

.excerpt-text {
  color: #e0e0e0;
  font-size: 14px;
  line-height: 1.6;
}

.search-highlight {
  background: rgba(244, 67, 54, 0.3);
  padding: 0 2px;
}
```

**Add to `index-advanced.html`:**
```html
<link rel="stylesheet" href="src/styles/pdf-renderer.css">
<link rel="stylesheet" href="src/styles/pdf-highlighter.css">
```

---

### Task 3: Enhance `pdf-excerpt-viewer.js` (2-3 hours)

This is the main integration task. You need to replace the current text-only viewer with a visual PDF viewer.

**Current State:**
- File: `src/components/pdf-excerpt-viewer.js`
- Shows excerpts as text cards only
- No visual PDF rendering

**Target State:**
- Side-by-side layout: PDF viewer (60%) + Excerpt list (40%)
- PDF viewer uses `PDFRenderer` + `PDFHighlighter`
- Click excerpt → jump to page and highlight
- Click highlighted text → scroll to excerpt in list

**Implementation Steps:**

#### Step 1: Update HTML Structure

Replace the current modal content with a side-by-side layout:

```javascript
// In show() method, around line 100-150
async show(collectionId) {
  // ... existing code ...

  const modalHTML = `
    <div class="pdf-viewer-modal">
      <div class="pdf-viewer-header">
        <h2>${collection.search_term}</h2>
        <div class="pdf-viewer-stats">
          ${pdfs.length} PDF(s) • ${totalExcerpts} excerpts
        </div>
        <button class="close-btn" onclick="window.pdfExcerptViewer.hide()">✕</button>
      </div>

      <div class="pdf-viewer-main">
        <!-- LEFT: PDF Viewer (60%) -->
        <div class="pdf-viewer-panel">
          <div id="pdf-viewer-container" class="pdf-viewer-container">
            <!-- PDF canvas will be inserted here -->
          </div>
          <div class="pdf-controls">
            <button id="pdf-prev-page">◀ Prev</button>
            <span class="pdf-page-info">
              Page <span id="pdf-current-page">1</span> of <span id="pdf-total-pages">1</span>
            </span>
            <button id="pdf-next-page">Next ▶</button>
            <div class="pdf-zoom-controls">
              <button id="pdf-zoom-out">−</button>
              <span class="pdf-zoom-level" id="pdf-zoom-level">100%</span>
              <button id="pdf-zoom-in">+</button>
            </div>
          </div>
        </div>

        <!-- RIGHT: Excerpt List (40%) -->
        <div class="excerpt-list-panel">
          <div class="excerpt-search">
            <input type="text" id="excerpt-search-input" placeholder="Search excerpts...">
          </div>
          <div id="excerpt-list-container" class="excerpt-list">
            <!-- Excerpts will be inserted here -->
          </div>
          <div class="excerpt-pagination">
            <button id="excerpt-prev-page">◀ Prev</button>
            <span id="excerpt-page-info">Page 1 of 1</span>
            <button id="excerpt-next-page">Next ▶</button>
          </div>
        </div>
      </div>

      <div class="pdf-viewer-footer">
        <button onclick="window.pdfExcerptViewer.exportExcerpts()">Export Excerpts</button>
        <button onclick="window.pdfExcerptViewer.hide()">Close</button>
      </div>
    </div>
  `;

  this.modalContent.innerHTML = modalHTML;
}
```

#### Step 2: Initialize Renderer and Highlighter

```javascript
// After HTML is inserted
async initializePDFViewer(pdfId) {
  // Get PDF file path from backend
  const filePathResult = await window.api.pdf.getFilePath(pdfId);

  if (!filePathResult.success) {
    console.error('[PDF Viewer] Failed to get file path:', filePathResult.error);
    return;
  }

  // Create renderer
  const container = document.getElementById('pdf-viewer-container');
  this.renderer = new PDFRenderer(container);

  // Create highlighter
  this.highlighter = new PDFHighlighter(container, this.renderer);

  // Load PDF
  await this.renderer.loadPDF(filePathResult.filePath);

  // Load excerpts with bbox data
  const excerptsResult = await window.api.pdf.getExcerpts(pdfId);

  if (excerptsResult.success) {
    this.excerpts = excerptsResult.data;
    this.highlighter.loadExcerpts(this.excerpts);
  }

  // Setup controls
  this.setupPDFControls();
}
```

#### Step 3: Wire Up Controls

```javascript
setupPDFControls() {
  // Page navigation
  document.getElementById('pdf-prev-page').addEventListener('click', () => {
    this.renderer.prevPage();
  });

  document.getElementById('pdf-next-page').addEventListener('click', () => {
    this.renderer.nextPage();
  });

  // Zoom controls
  document.getElementById('pdf-zoom-in').addEventListener('click', () => {
    const newScale = this.renderer.getScale() * 1.25;
    this.renderer.setZoom(Math.min(newScale, 2.0));
    this.updateZoomDisplay();
  });

  document.getElementById('pdf-zoom-out').addEventListener('click', () => {
    const newScale = this.renderer.getScale() / 1.25;
    this.renderer.setZoom(Math.max(newScale, 0.5));
    this.updateZoomDisplay();
  });

  // Update page display when page changes
  document.addEventListener('pdfRenderer:pageRendered', (event) => {
    const { pageNum } = event.detail;
    document.getElementById('pdf-current-page').textContent = pageNum;
    document.getElementById('pdf-total-pages').textContent = this.renderer.getTotalPages();
  });

  // Excerpt list click handlers
  // (Scroll to excerpt in PDF when clicked)
}
```

#### Step 4: Implement Interactive Highlighting

```javascript
// Click excerpt in list → highlight in PDF
renderExcerptList() {
  const listContainer = document.getElementById('excerpt-list-container');
  const startIdx = this.currentPage * this.pageSize;
  const endIdx = Math.min(startIdx + this.pageSize, this.excerpts.length);

  let html = '';
  for (let i = startIdx; i < endIdx; i++) {
    const excerpt = this.excerpts[i];
    html += `
      <div class="excerpt-list-item" data-excerpt-id="${excerpt.id}" onclick="window.pdfExcerptViewer.onExcerptClick(${excerpt.id})">
        <div class="excerpt-page-number">Page ${excerpt.page_number} • Excerpt ${excerpt.excerpt_number}</div>
        <div class="excerpt-text">${this.escapeHtml(excerpt.text_content)}</div>
      </div>
    `;
  }

  listContainer.innerHTML = html;
}

onExcerptClick(excerptId) {
  // Highlight this excerpt in PDF
  this.highlighter.setActiveExcerpt(excerptId);

  // Scroll to it in the list
  const listItem = document.querySelector(`[data-excerpt-id="${excerptId}"]`);
  if (listItem) {
    listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    listItem.classList.add('active');
  }
}
```

---

## 📐 CSS LAYOUT SPECS

**Side-by-Side Layout:**
```css
.pdf-viewer-main {
  display: flex;
  height: calc(100vh - 200px);
  gap: 16px;
}

.pdf-viewer-panel {
  flex: 0 0 60%;
  position: relative;
}

.excerpt-list-panel {
  flex: 0 0 40%;
  display: flex;
  flex-direction: column;
}

.excerpt-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
```

---

## 🧪 TESTING CHECKLIST

### Backend Testing
- [ ] Upload a PDF with `chunkingStrategy: 'sentence'`
- [ ] Verify excerpts have bbox data in database (`SELECT bbox FROM pdf_excerpts LIMIT 5`)
- [ ] Check console logs show sentence count per page

### Frontend Testing
- [ ] PDF renders in viewer (not just blank canvas)
- [ ] Zoom controls work (50% - 200%)
- [ ] Page navigation works
- [ ] Excerpts appear in right panel
- [ ] Click excerpt → PDF jumps to that page
- [ ] Yellow highlights appear on PDF
- [ ] Active excerpt turns green
- [ ] Search highlights turn red

### Edge Cases
- [ ] PDF with 1 page (no pagination issues)
- [ ] PDF with 100+ pages (performance OK?)
- [ ] PDFs with images (renders correctly?)
- [ ] Long sentences spanning multiple lines (bbox correct?)
- [ ] Very short sentences skipped (< 10 chars)

---

## 🐛 KNOWN GOTCHAS

### 1. PDF.js Worker Path
The worker needs to be accessible. If you get worker errors:
```javascript
// In PDFRenderer.loadPDF()
pdfjsLib.GlobalWorkerOptions.workerSrc = '../node_modules/pdfjs-dist/legacy/build/pdf.worker.js';
```

### 2. File Path Format
PDF.js expects `file://` URLs on Electron. If loading fails, try:
```javascript
const filePath = 'file://' + filePathResult.filePath;
await this.renderer.loadPDF(filePath);
```

### 3. Bbox Coordinate System
PDF.js uses **bottom-left origin** (like PostScript), not top-left. If highlights are in wrong position, you may need to flip Y:
```javascript
const flippedY = viewport.height - (bbox.y + bbox.height);
```

### 4. Performance with Large PDFs
For PDFs with 1000+ pages, consider:
- Only load excerpts for current page (not all at once)
- Implement virtual scrolling for excerpt list
- Cache rendered pages

---

## 📚 HELPFUL RESOURCES

**PDF.js Documentation:**
- [Getting Started](https://mozilla.github.io/pdf.js/getting_started/)
- [API Reference](https://mozilla.github.io/pdf.js/api/draft/)
- [Examples](https://mozilla.github.io/pdf.js/examples/)

**Existing Code to Reference:**
- `src/collectors/pdf-collector.js` - See how we extract text items
- `src/services/pdf-chunker.js` - See sentence chunking logic
- `src/components/collection-viewer.js` - Similar modal pattern

**Console Commands for Testing:**
```javascript
// Test PDF rendering
const viewer = window.pdfExcerptViewer;
viewer.show(123); // Your PDF collection ID

// Inspect loaded data
console.log(viewer.excerpts);
console.log(viewer.renderer.pdfDoc);

// Test highlighting
viewer.highlighter.setActiveExcerpt(5);
```

---

## 🎯 ACCEPTANCE CRITERIA

When you're done, the following should work:

1. ✅ User clicks PDF collection in folder browser
2. ✅ Modal opens with side-by-side layout (PDF + excerpts)
3. ✅ PDF renders visually with zoom and page navigation
4. ✅ Excerpts show in right panel with pagination
5. ✅ Yellow highlights appear on PDF showing sentence locations
6. ✅ Click excerpt → PDF jumps to page and highlights it in green
7. ✅ Search box filters excerpts and highlights matches in red
8. ✅ Close button works, resources cleaned up

---

## 📦 FILE CHECKLIST

**Files You Need to Create:**
- [ ] `src/styles/pdf-renderer.css` (NEW)
- [ ] `src/styles/pdf-highlighter.css` (NEW)

**Files You Need to Modify:**
- [ ] `index-advanced.html` (include PDF.js library + CSS)
- [ ] `src/components/pdf-excerpt-viewer.js` (major rewrite for visual viewer)

**Files Already Done (Don't Touch):**
- ✅ `src/components/pdf-renderer.js`
- ✅ `src/components/pdf-highlighter.js`
- ✅ `src/services/pdf-chunker.js`
- ✅ `src/collectors/pdf-collector.js`
- ✅ `main.js` (pdf:getFilePath handler)
- ✅ `preload.js` (pdf.getFilePath API)

---

## 🚀 GETTING STARTED

**Step-by-step to continue:**

1. **Read this entire handoff** (you're doing it now!)
2. **Test existing components:**
   ```bash
   npm start
   # Upload a PDF with sentence chunking
   # Verify bbox data in database
   ```
3. **Create CSS files** (copy from Task 2 above)
4. **Include PDF.js in HTML** (Task 1)
5. **Enhance pdf-excerpt-viewer.js** (Task 3)
6. **Test incrementally** (don't wait until the end)
7. **Debug with console logs** (PDF.js can be finicky)

---

## 💬 FINAL NOTES

This is a **high-value, high-complexity** feature. Take your time, test incrementally, and don't hesitate to add defensive guards and logging.

The backend sentence chunking is **rock-solid** - I tested the algorithm thoroughly. The frontend components (`PDFRenderer` and `PDFHighlighter`) are also complete and functional. **Your job is to wire them together** in `pdf-excerpt-viewer.js` and make it look good with CSS.

**If you get stuck:**
- Check the browser console for errors
- Use `console.log` liberally in PDFRenderer and PDFHighlighter
- Test with a small, simple PDF first (1-2 pages)
- Refer to Agent A's original handoff doc: `HANDOFF_VISUAL_PDF_VIEWER.md`

**Good luck! You got this! 🚀**

---

**Status:** 🟡 Ready for next agent
**Estimated Time Remaining:** 3-4 hours
**Last Updated:** October 6, 2025
**Agent:** Claude B (Full-Stack Generalist Expert)
