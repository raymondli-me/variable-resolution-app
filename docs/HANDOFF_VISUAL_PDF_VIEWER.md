# Seamless Relay Handoff: Visual PDF Viewer with Sentence Chunking

**From:** Agent A (Full-Stack Generalist Expert)
**To:** Next Agent (Full-Stack Generalist Expert)
**Date:** October 6, 2025
**Status:** 🔄 READY FOR PICKUP
**Priority:** HIGH (Game-changing feature for raters and AI workflows)
**Estimated Time:** 10-15 hours (complex but high-value)

---

## 📊 CURRENT STATE

### What Exists Now ✅

**Text-Based Excerpt Viewer** (Just Implemented)
- File: `src/components/pdf-excerpt-viewer.js`
- Shows excerpts as text cards with page numbers
- Pagination (20 per page), search, export
- Works but **lacks visual context**

**Backend Infrastructure** (Already Built)
- PDF upload and processing (`src/collectors/pdf-collector.js`)
- Database schema with `pdfs` and `pdf_excerpts` tables
- IPC handlers: `pdf:list`, `pdf:getExcerpts`, `pdf:upload`
- File storage in `output/pdfs/`

**Current Chunking Strategy**
- Page-based: One excerpt per page
- Simple but loses granularity
- No bounding boxes (bbox = null)

### What's Missing ❌

1. **Visual PDF Rendering** - Can't see the actual document
2. **Excerpt Highlighting** - No visual indication of excerpt location
3. **Sentence-Level Chunking** - Too coarse-grained for rating tasks
4. **Bounding Box Data** - No coordinate information for excerpts
5. **Context Preservation** - Raters can't see surrounding text

---

## 🎯 THE VISION

### User Experience Goal

**Before (Current Text Viewer):**
```
User clicks PDF collection
  ↓
Modal shows text cards:
  ┌─────────────────────────────┐
  │ Page 5 | Excerpt 12          │
  │ "Lorem ipsum dolor sit..."  │
  └─────────────────────────────┘
```
**Limitation:** No visual context, hard to verify accuracy, can't see formatting/images

**After (Visual PDF Viewer):**
```
User clicks PDF collection
  ↓
Modal shows actual PDF with highlights:
  ┌─────────────┬─────────────────────┐
  │ PDF Render  │  Excerpt List       │
  │             │                     │
  │  [Page 5]   │  • Excerpt 12 ✓     │
  │  ┌────────┐ │  • Excerpt 13       │
  │  │ Lorem  │ │  • Excerpt 14       │
  │  │🟡ipsum│ │                     │
  │  │ dolor  │ │  Click to jump →   │
  │  └────────┘ │                     │
  │             │  Search: [____]     │
  └─────────────┴─────────────────────┘
```
**Benefits:**
- Raters see **actual document context**
- AI can **verify excerpt accuracy**
- **Sentence-level** granularity for precise rating
- **Visual feedback** (highlighting) shows excerpt location
- **Better UX** - feels like a real PDF reader

---

## 🏗️ TECHNICAL ARCHITECTURE

### Frontend Stack

#### PDF Rendering Library: PDF.js
**Why PDF.js:**
- ✅ Industry standard (used by Firefox, Google Docs)
- ✅ Maintained by Mozilla
- ✅ Full-featured: text layer, annotations, rendering
- ✅ Works in Electron/web environments
- ✅ MIT licensed, no restrictions
- ✅ ~400KB gzipped (acceptable size)

**Installation:**
```bash
npm install pdfjs-dist
```

**Alternative Considered:**
- `react-pdf` - Too React-specific, we use vanilla JS
- `pdf-lib` - For editing PDFs, not viewing
- `pdf.js-viewer` - Wrapper around PDF.js, extra complexity

#### Highlighting Strategy: Canvas Overlay
**Approach:**
1. Render PDF page to canvas (PDF.js)
2. Get text layer positions (PDF.js TextLayer API)
3. Match excerpt text to text layer positions
4. Draw highlight rectangles on overlay canvas
5. Store bbox coordinates for future use

**Why Canvas (not SVG):**
- Better performance for large documents
- Easier to layer over PDF.js canvas
- Built-in PDF.js support

### Backend Enhancements

#### Sentence-Level Chunking

**Current (Page-Based):**
```javascript
// pdf-collector.js
const excerpts = [];
for (let page = 1; page <= pdfDoc.numPages; page++) {
  const text = await extractPageText(page);
  excerpts.push({
    excerpt_number: page,
    page_number: page,
    text_content: text,
    bbox: null  // ❌ No granularity
  });
}
```

**New (Sentence-Based):**
```javascript
// Enhanced pdf-collector.js
const excerpts = [];
let excerptNum = 0;

for (let page = 1; page <= pdfDoc.numPages; page++) {
  const textItems = await extractPageTextWithCoords(page);
  const sentences = segmentIntoSentences(textItems);

  for (const sentence of sentences) {
    excerpts.push({
      excerpt_number: ++excerptNum,
      page_number: page,
      text_content: sentence.text,
      bbox: JSON.stringify(sentence.bbox),  // ✅ Store coordinates
      char_start: sentence.charStart,
      char_end: sentence.charEnd
    });
  }
}
```

#### Sentence Segmentation Library

**Option 1: `compromise` (NLP Library)**
```bash
npm install compromise
```
```javascript
const nlp = require('compromise');
const sentences = nlp(text).sentences().out('array');
```
**Pros:** Smart segmentation, handles edge cases
**Cons:** 150KB, might be overkill

**Option 2: `sentence-splitter`**
```bash
npm install sentence-splitter
```
**Pros:** Lightweight (20KB), purpose-built
**Cons:** Simpler rules

**Option 3: Regex-Based (Custom)**
```javascript
function splitSentences(text) {
  // Split on .!? followed by whitespace and capital letter
  const regex = /(?<=[.!?])\s+(?=[A-Z])/g;
  return text.split(regex).filter(s => s.trim().length > 0);
}
```
**Pros:** Zero dependencies, fast
**Cons:** Less accurate (e.g., "Dr. Smith" splits incorrectly)

**Recommendation:** Start with **compromise** (best accuracy), can optimize later.

#### Bounding Box Extraction

**PDF.js Text Layer API:**
```javascript
const page = await pdfDoc.getPage(pageNum);
const textContent = await page.getTextContent();

const textItems = textContent.items.map(item => ({
  text: item.str,
  bbox: {
    x: item.transform[4],      // X position
    y: item.transform[5],      // Y position
    width: item.width,
    height: item.height
  }
}));
```

**Merge Text Items into Sentences:**
```javascript
function mergeBbox(bboxes) {
  return {
    x: Math.min(...bboxes.map(b => b.x)),
    y: Math.min(...bboxes.map(b => b.y)),
    width: Math.max(...bboxes.map(b => b.x + b.width)) - Math.min(...bboxes.map(b => b.x)),
    height: Math.max(...bboxes.map(b => b.y + b.height)) - Math.min(...bboxes.map(b => b.y))
  };
}
```

### Database Updates

**No Schema Changes Needed!** ✅

The `pdf_excerpts` table already has all required fields:
```sql
CREATE TABLE pdf_excerpts (
  id INTEGER PRIMARY KEY,
  pdf_id INTEGER,
  collection_id INTEGER,
  excerpt_number INTEGER,  -- ✅ Sequential numbering
  page_number INTEGER,     -- ✅ Which page
  text_content TEXT,       -- ✅ Sentence text
  char_start INTEGER,      -- ✅ Character offset (for reconstruction)
  char_end INTEGER,        -- ✅ Character offset
  bbox TEXT                -- ✅ JSON string: {"x":100,"y":200,"w":500,"h":20}
)
```

**Only change:** Populate `bbox` field instead of leaving it `null`.

---

## 📐 UI/UX DESIGN

### Layout Options

#### Option A: Side-by-Side (Recommended)
```
┌─────────────────────────────────────────────────────┐
│  PDF Collection: concussion_pdf_2014          ✕     │
│  1 PDF • 1168 excerpts • Created Oct 6, 2025        │
├───────────────────┬─────────────────────────────────┤
│  PDF Viewer       │  Excerpts List                  │
│  (60% width)      │  (40% width)                    │
│                   │                                  │
│  ┌──────────────┐ │  Search: [______________] 🔍    │
│  │              │ │                                  │
│  │  [Page 1]    │ │  ┌──────────────────────────┐  │
│  │              │ │  │ Page 1 • Excerpt 1    ⬅️ │  │
│  │  Lorem ipsum │ │  │ "Lorem ipsum dolor..."   │  │
│  │  🟡dolor sit │ │  └──────────────────────────┘  │
│  │  amet...     │ │                                  │
│  │              │ │  ┌──────────────────────────┐  │
│  │              │ │  │ Page 1 • Excerpt 2       │  │
│  │              │ │  │ "Consectetur adipiscing" │  │
│  │  [Zoom: 100%]│ │  └──────────────────────────┘  │
│  │  ◀ Page 1/50 │ │                                  │
│  └──────────────┘ │  ... (20 per page)              │
│                   │                                  │
│                   │  [◀ Prev] Page 1 of 59 [Next ▶]│
├───────────────────┴─────────────────────────────────┤
│  [Copy Text] [Download PDF] [Export Excerpts] [Close]│
└─────────────────────────────────────────────────────┘
```

**Interactions:**
1. **Click excerpt in list** → PDF jumps to that page and highlights it
2. **Click highlighted text in PDF** → Scroll list to that excerpt
3. **Zoom controls** → 50%, 75%, 100%, 125%, 150%, 200%
4. **Page navigation** → Previous/Next buttons, page input field
5. **Search** → Filters excerpts AND highlights matches in PDF

#### Option B: Tabs (Fallback for Smaller Screens)
```
┌─────────────────────────────────────────────────────┐
│  PDF Collection: concussion_pdf_2014          ✕     │
├─────────────────────────────────────────────────────┤
│  [📄 PDF View] [📝 Excerpts List]                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  (Shows either PDF viewer OR excerpts list)         │
│                                                      │
└─────────────────────────────────────────────────────┘
```
**When to use:** Mobile, small screens, or user preference

### Visual Design Specs

**Highlight Colors:**
- Default excerpt: `rgba(255, 235, 59, 0.4)` - Yellow, 40% opacity
- Active excerpt (clicked): `rgba(76, 175, 80, 0.5)` - Green, 50% opacity
- Search match: `rgba(244, 67, 54, 0.5)` - Red, 50% opacity

**Typography:**
- PDF renders at actual size (or scaled proportionally)
- Excerpt list: 14px, line-height 1.6, sans-serif

**Spacing:**
- PDF viewer: 16px padding
- Excerpt cards: 12px padding, 8px gap
- Modal: 24px padding overall

**Responsiveness:**
- Desktop (>1200px): Side-by-side 60/40 split
- Tablet (768-1200px): Side-by-side 50/50 split
- Mobile (<768px): Tabs or stacked layout

---

## 🔧 IMPLEMENTATION PHASES

### Phase 1: PDF.js Integration (3-4 hours)

**Tasks:**
1. Install PDF.js: `npm install pdfjs-dist`
2. Create `src/components/pdf-viewer.js` component
3. Load PDF from file path
4. Render first page to canvas
5. Add zoom controls (50%-200%)
6. Add page navigation (prev/next, jump to page)
7. Test with sample PDF

**Deliverables:**
- Basic PDF viewer component (no highlighting yet)
- Zoom and navigation working
- Loads PDF from `file://` path

**Code Skeleton:**
```javascript
class PDFViewer {
  constructor(containerEl) {
    this.container = containerEl;
    this.pdfDoc = null;
    this.currentPage = 1;
    this.scale = 1.0;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  async loadPDF(filePath) {
    const pdfjsLib = await import('pdfjs-dist/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

    this.pdfDoc = await pdfjsLib.getDocument(filePath).promise;
    this.renderPage(1);
  }

  async renderPage(pageNum) {
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale });

    this.canvas.width = viewport.width;
    this.canvas.height = viewport.height;

    await page.render({
      canvasContext: this.ctx,
      viewport: viewport
    }).promise;
  }

  setZoom(scale) {
    this.scale = scale;
    this.renderPage(this.currentPage);
  }
}
```

### Phase 2: Sentence Chunking Backend (4-5 hours)

**Tasks:**
1. Install NLP library: `npm install compromise`
2. Update `src/collectors/pdf-collector.js`:
   - Extract text with bounding boxes
   - Segment into sentences
   - Calculate merged bboxes for each sentence
   - Store bbox as JSON string in database
3. Add new IPC handler: `pdf:reprocessWithSentences(pdfId)`
4. Create migration script to reprocess existing PDFs
5. Test with sample PDF (verify bbox accuracy)

**Deliverables:**
- Enhanced PDF upload that extracts sentence-level excerpts
- Bounding box data stored in database
- Reprocessing tool for existing PDFs

**Code Example:**
```javascript
// src/collectors/pdf-collector.js
async function extractSentencesWithBbox(pdfPath) {
  const pdfDoc = await pdfjsLib.getDocument(pdfPath).promise;
  const excerpts = [];
  let excerptNum = 0;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Concatenate all text items
    const pageText = textContent.items.map(item => item.str).join(' ');

    // Segment into sentences
    const nlp = require('compromise');
    const sentences = nlp(pageText).sentences().out('array');

    // For each sentence, find corresponding text items and merge bboxes
    for (const sentenceText of sentences) {
      const matchingItems = findTextItems(textContent.items, sentenceText);
      const bbox = mergeBboxes(matchingItems);

      excerpts.push({
        excerpt_number: ++excerptNum,
        page_number: pageNum,
        text_content: sentenceText,
        bbox: JSON.stringify({
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          page: pageNum
        })
      });
    }
  }

  return excerpts;
}
```

### Phase 3: Visual Highlighting (3-4 hours)

**Tasks:**
1. Create highlight overlay canvas
2. Parse bbox JSON from excerpts
3. Draw highlight rectangles on overlay
4. Sync highlighting with excerpt list
5. Implement click handlers:
   - Click excerpt → highlight in PDF
   - Click highlighted text → scroll to excerpt
6. Add color coding (default, active, search)

**Deliverables:**
- Excerpts visually highlighted on PDF
- Interactive highlighting (click to jump)
- Color-coded highlighting states

**Code Example:**
```javascript
class PDFHighlighter {
  constructor(pdfViewer) {
    this.viewer = pdfViewer;
    this.highlightCanvas = document.createElement('canvas');
    this.highlightCtx = this.highlightCanvas.getContext('2d');
    this.activeExcerpt = null;
  }

  drawHighlights(excerpts) {
    this.highlightCtx.clearRect(0, 0, this.highlightCanvas.width, this.highlightCanvas.height);

    for (const excerpt of excerpts) {
      if (!excerpt.bbox) continue;

      const bbox = JSON.parse(excerpt.bbox);
      if (bbox.page !== this.viewer.currentPage) continue;

      // Scale bbox to current zoom level
      const scaledBbox = {
        x: bbox.x * this.viewer.scale,
        y: bbox.y * this.viewer.scale,
        width: bbox.width * this.viewer.scale,
        height: bbox.height * this.viewer.scale
      };

      // Choose color
      const color = excerpt.id === this.activeExcerpt
        ? 'rgba(76, 175, 80, 0.5)'   // Green for active
        : 'rgba(255, 235, 59, 0.4)'; // Yellow for default

      // Draw rectangle
      this.highlightCtx.fillStyle = color;
      this.highlightCtx.fillRect(
        scaledBbox.x,
        scaledBbox.y,
        scaledBbox.width,
        scaledBbox.height
      );
    }
  }

  setActive(excerptId) {
    this.activeExcerpt = excerptId;
    this.redraw();
  }
}
```

### Phase 4: Enhanced UI Integration (2-3 hours)

**Tasks:**
1. Replace current text-only viewer with new PDF+list viewer
2. Implement side-by-side layout (60/40 split)
3. Add search that highlights in both PDF and list
4. Add keyboard shortcuts:
   - Arrow keys: Navigate pages
   - +/- : Zoom in/out
   - Escape: Close modal
5. Add responsive breakpoints
6. Polish animations and transitions

**Deliverables:**
- Full UI integration
- Search works across PDF and excerpts
- Keyboard navigation
- Responsive design

### Phase 5: Testing & Polish (1-2 hours)

**Tasks:**
1. Test with various PDFs:
   - Small (10 pages)
   - Medium (100 pages)
   - Large (1000+ pages)
2. Test edge cases:
   - PDFs with images
   - Multi-column layouts
   - Non-English text
   - Encrypted/password-protected PDFs
3. Performance optimization:
   - Lazy load PDF pages (only render visible page)
   - Cache rendered pages
   - Throttle search/filter operations
4. Accessibility:
   - Keyboard navigation
   - Screen reader support
   - Focus management

**Deliverables:**
- Comprehensive testing checklist
- Performance benchmarks
- Bug fixes
- User documentation

---

## 🔌 API SPECIFICATIONS

### New IPC Handlers Needed

#### 1. Reprocess PDF with Sentence Chunking
```javascript
ipcMain.handle('pdf:reprocessWithSentences', async (event, pdfId) => {
  // Load PDF from file system
  // Re-extract with sentence-level chunking
  // Update pdf_excerpts table (delete old, insert new)
  // Return new excerpt count

  return {
    success: true,
    excerptCount: 1168,
    chunkingStrategy: 'sentence'
  };
});
```

#### 2. Get PDF File Path for Rendering
```javascript
ipcMain.handle('pdf:getFilePath', async (event, pdfId) => {
  const db = require('./src/database/db');
  const pdf = await db.get('SELECT file_path FROM pdfs WHERE id = ?', [pdfId]);

  return {
    success: true,
    filePath: pdf.file_path  // e.g., /Users/.../output/pdfs/doc.pdf
  };
});
```

#### 3. Batch Get Excerpts with Bbox (Optimized)
```javascript
ipcMain.handle('pdf:getExcerptsWithBbox', async (event, { pdfId, pageNumbers }) => {
  // If pageNumbers provided, only fetch excerpts for those pages (optimization)
  const db = require('./src/database/db');

  const excerpts = await db.all(`
    SELECT id, excerpt_number, page_number, text_content, bbox
    FROM pdf_excerpts
    WHERE pdf_id = ?
      ${pageNumbers ? 'AND page_number IN (?)' : ''}
    ORDER BY excerpt_number ASC
  `, pageNumbers ? [pdfId, pageNumbers.join(',')] : [pdfId]);

  return {
    success: true,
    excerpts: excerpts.map(e => ({
      ...e,
      bbox: e.bbox ? JSON.parse(e.bbox) : null
    }))
  };
});
```

### Frontend API Usage

```javascript
// In pdf-excerpt-viewer.js (enhanced version)

// Load PDF for rendering
const filePathResult = await window.api.pdf.getFilePath(pdfId);
await pdfViewer.loadPDF(filePathResult.filePath);

// Load excerpts with bboxes
const excerptsResult = await window.api.pdf.getExcerptsWithBbox({ pdfId });
const excerpts = excerptsResult.excerpts;

// Render highlights
highlighter.drawHighlights(excerpts.filter(e => e.bbox));
```

---

## 🎨 UI COMPONENT STRUCTURE

### File Organization

```
src/components/
├── pdf-excerpt-viewer.js          (Enhanced - orchestrator component)
├── pdf-renderer.js                (NEW - PDF.js wrapper)
├── pdf-highlighter.js             (NEW - Highlight overlay manager)
└── excerpt-list-panel.js          (NEW - Sidebar list component)

src/styles/
├── pdf-excerpt-viewer.css         (Enhanced - layout for side-by-side)
├── pdf-renderer.css               (NEW - PDF canvas styles)
└── pdf-highlighter.css            (NEW - Highlight overlay styles)

src/collectors/
└── pdf-collector.js               (Enhanced - add sentence chunking)
```

### Component Hierarchy

```
PDFExcerptViewer (main orchestrator)
├── PDFRenderer (left panel - 60%)
│   ├── Canvas (PDF page rendering)
│   ├── HighlightOverlay (excerpt highlights)
│   └── Controls (zoom, page nav)
├── ExcerptListPanel (right panel - 40%)
│   ├── SearchBar
│   ├── ExcerptList (scrollable)
│   │   └── ExcerptCard (x20 per page)
│   └── Pagination
└── Actions (footer)
    ├── Copy Text
    ├── Download PDF
    ├── Export Excerpts
    └── Close
```

---

## 📚 DEPENDENCIES TO INSTALL

```bash
# PDF rendering
npm install pdfjs-dist

# Sentence segmentation
npm install compromise

# Optional: Better PDF text extraction (if needed)
npm install pdf-parse
```

**Total Bundle Size Impact:** ~600KB (PDF.js: 400KB, compromise: 150KB, other: 50KB)

---

## 🧪 TESTING PLAN

### Unit Tests

1. **Sentence Segmentation**
   - Input: "Dr. Smith said hello. How are you? I'm fine!"
   - Expected: 3 sentences
   - Verify: No split on "Dr."

2. **Bbox Merging**
   - Input: [{x:0,y:0,w:10,h:5}, {x:10,y:0,w:10,h:5}]
   - Expected: {x:0, y:0, w:20, h:5}

3. **Highlight Rendering**
   - Input: Excerpt with bbox on page 1, viewing page 1
   - Expected: Highlight drawn
   - Input: Excerpt with bbox on page 1, viewing page 2
   - Expected: No highlight drawn

### Integration Tests

1. **Upload New PDF**
   - Upload test.pdf
   - Verify: Excerpts created with sentence-level chunking
   - Verify: All excerpts have valid bbox JSON

2. **View PDF Collection**
   - Click PDF collection
   - Verify: Modal opens with PDF rendered
   - Verify: Excerpts list populated
   - Verify: Highlights appear on PDF

3. **Navigation**
   - Click excerpt in list
   - Verify: PDF jumps to correct page
   - Verify: Excerpt highlighted in green (active state)

4. **Search**
   - Type "concussion" in search
   - Verify: Filtered excerpts in list
   - Verify: All matches highlighted in PDF (red)

### Performance Tests

1. **Large PDF (1000 pages)**
   - Verify: PDF loads within 3 seconds
   - Verify: Page navigation is instant (<100ms)
   - Verify: Highlighting doesn't lag

2. **Many Excerpts (10,000+)**
   - Verify: Pagination prevents rendering all at once
   - Verify: Search completes within 500ms
   - Verify: Memory usage stays under 500MB

### User Acceptance Tests

1. **Rater Workflow**
   - Rater uploads PDF
   - Rater views excerpts with context
   - Rater rates individual sentences
   - Rater exports rated excerpts

2. **AI Verification Workflow**
   - AI extracts excerpts
   - Human verifies excerpt accuracy in visual viewer
   - Human sees surrounding context
   - Human confirms or corrects extraction

---

## 🚨 CRITICAL CONSIDERATIONS

### 1. File Path Access in Electron

**Issue:** Electron renderer process may not have direct file:// access

**Solution:**
```javascript
// In preload.js, expose file reading
contextBridge.exposeInMainWorld('api', {
  pdf: {
    readFileAsBuffer: (filePath) => ipcRenderer.invoke('pdf:readFile', filePath)
  }
});

// In main.js
ipcMain.handle('pdf:readFile', async (event, filePath) => {
  const fs = require('fs').promises;
  return await fs.readFile(filePath);
});

// In renderer
const buffer = await window.api.pdf.readFileAsBuffer(filePath);
const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
```

### 2. PDF.js Worker Setup

**Issue:** PDF.js requires a web worker for parsing

**Solution:**
```javascript
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```

**Alternative (CDN for simplicity):**
```javascript
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
```

### 3. Bounding Box Accuracy

**Issue:** PDF.js bbox coordinates are in PDF space (72 DPI), need conversion to canvas space

**Solution:**
```javascript
function pdfToCanvasCoords(pdfBbox, viewport) {
  return {
    x: pdfBbox.x * viewport.scale,
    y: (viewport.height - pdfBbox.y - pdfBbox.height) * viewport.scale, // PDF Y is bottom-up
    width: pdfBbox.width * viewport.scale,
    height: pdfBbox.height * viewport.scale
  };
}
```

### 4. Memory Management

**Issue:** Large PDFs can consume lots of memory

**Solutions:**
- Only render current page (not all pages)
- Unload pages when navigating away
- Use thumbnail cache for page previews
- Limit max zoom to 200%

### 5. Text Extraction Accuracy

**Issue:** PDF.js text extraction can be imperfect (scanned PDFs, complex layouts)

**Fallback:**
- If PDF.js fails, try `pdf-parse` library
- If still fails, show warning: "OCR not supported, excerpts may be inaccurate"
- Future: Integrate Tesseract.js for OCR

---

## 🎯 SUCCESS CRITERIA

### Must Have ✅

1. ✅ Upload PDF with sentence-level chunking
2. ✅ Visual PDF rendering with zoom (50%-200%)
3. ✅ Excerpts highlighted on PDF pages
4. ✅ Click excerpt → jump to page and highlight
5. ✅ Search filters excerpts and highlights matches
6. ✅ Side-by-side layout (PDF + list)
7. ✅ Bounding boxes stored in database
8. ✅ Works with 1000+ page PDFs

### Nice to Have 🎯

1. 🎯 Click highlighted text in PDF → scroll to excerpt in list
2. 🎯 Keyboard shortcuts (arrows, +/-, Escape)
3. 🎯 Page thumbnails sidebar for quick navigation
4. 🎯 Copy excerpt text from PDF (not just list)
5. 🎯 Multi-select excerpts for batch export
6. 🎯 Annotation mode (add notes to excerpts)

### Bonus Features 🚀

1. 🚀 OCR for scanned PDFs (Tesseract.js)
2. 🚀 Compare two PDFs side-by-side
3. 🚀 Excerpt rating directly in viewer (thumbs up/down)
4. 🚀 Link excerpts to BWS rating interface
5. 🚀 Export annotated PDF with highlights burned in

---

## 🐛 KNOWN CHALLENGES & SOLUTIONS

### Challenge 1: Sentence Boundary Detection

**Problem:** NLP may incorrectly split on abbreviations (Dr., Mr., etc.)

**Solution:**
```javascript
const nlp = require('compromise');
nlp.extend((Doc, world) => {
  // Add custom abbreviations
  world.addWords({
    'dr.': 'Abbreviation',
    'mr.': 'Abbreviation',
    'mrs.': 'Abbreviation',
    'vs.': 'Abbreviation'
  });
});
```

### Challenge 2: Multi-Column PDFs

**Problem:** Text extraction may return columns in wrong order

**Solution:**
- Use `textContent.items` and sort by Y then X position
- Group items by visual columns (cluster by X position)
- Read left column, then right column

```javascript
function sortTextItems(items) {
  return items.sort((a, b) => {
    // Sort by Y (top to bottom), then X (left to right)
    if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
      return a.transform[4] - b.transform[4]; // Same row, sort by X
    }
    return b.transform[5] - a.transform[5]; // Different rows, sort by Y (descending)
  });
}
```

### Challenge 3: Scanned PDFs (Images)

**Problem:** No text layer, can't extract sentences

**Solutions:**
1. **Detect:** Check if `textContent.items.length === 0`
2. **Warn:** Show message: "This PDF appears to be scanned. Text extraction may be unavailable."
3. **Future:** Integrate Tesseract.js for OCR (5-10 hours additional work)

### Challenge 4: Password-Protected PDFs

**Problem:** PDF.js can't open encrypted PDFs without password

**Solution:**
```javascript
try {
  const pdfDoc = await pdfjsLib.getDocument({
    data: buffer,
    password: userEnteredPassword  // Prompt user for password
  }).promise;
} catch (error) {
  if (error.name === 'PasswordException') {
    // Show password input modal
    const password = await promptForPassword();
    // Retry with password
  }
}
```

---

## 📊 ESTIMATED EFFORT BREAKDOWN

| Phase | Task | Hours |
|-------|------|-------|
| 1 | PDF.js integration + basic rendering | 3-4 |
| 2 | Sentence chunking backend | 4-5 |
| 3 | Visual highlighting + bbox | 3-4 |
| 4 | Enhanced UI integration | 2-3 |
| 5 | Testing & polish | 1-2 |
| **Total** | | **13-18 hours** |

**Breakdown by Skillset:**
- Backend (sentence chunking, bbox): 4-5 hours
- Frontend (PDF.js, highlighting): 6-8 hours
- UI/UX (layout, styling): 2-3 hours
- Testing & debugging: 1-2 hours

---

## 🎓 LEARNING RESOURCES

### PDF.js Documentation
- Official Docs: https://mozilla.github.io/pdf.js/
- Examples: https://github.com/mozilla/pdf.js/tree/master/examples
- API Reference: https://mozilla.github.io/pdf.js/api/

### NLP Libraries
- Compromise: https://github.com/spencermountain/compromise
- Sentence Splitter: https://github.com/ldkrsi/sentence-splitter

### Tutorials
- PDF.js Basics: https://pspdfkit.com/blog/2018/how-to-use-pdfjs/
- Text Layer Extraction: https://github.com/mozilla/pdf.js/blob/master/examples/components/pageviewer.html
- Highlighting: https://stackoverflow.com/questions/13615801/how-to-highlight-text-in-pdf-using-pdf-js

---

## 🚀 GETTING STARTED

### Step 1: Install Dependencies
```bash
npm install pdfjs-dist compromise
```

### Step 2: Create PDF Viewer Component
```bash
touch src/components/pdf-renderer.js
touch src/components/pdf-highlighter.js
touch src/styles/pdf-renderer.css
```

### Step 3: Update PDF Collector
Edit `src/collectors/pdf-collector.js` to add sentence chunking.

### Step 4: Test with Sample PDF
Use the existing `concussion_pdf_2014` collection (1168 excerpts) as the test case.

### Step 5: Integrate with Viewer
Replace text-only viewer with enhanced PDF+highlights viewer.

---

## 💡 FINAL NOTES

### Why This Is a Game-Changer

**For Raters:**
- See **actual document context** instead of isolated text
- Verify excerpt accuracy visually
- Understand formatting, emphasis, surrounding paragraphs
- More confident ratings with visual proof

**For AI Workflows:**
- Train models with **visual grounding** (text + bounding boxes)
- Verify AI-extracted excerpts against source
- Annotate directly on PDF for training data
- Export structured data (text + coordinates)

**For Research:**
- Cite specific sentences with page and coordinates
- Compare excerpts across multiple PDFs
- Analyze document structure and layout
- Preserve original context for reproducibility

### User Impact

**Before:** "Did the AI extract this correctly? I can't tell without opening the PDF."

**After:** "I can see exactly where this excerpt comes from, in context, with highlighting. ✅"

This feature transforms the app from a **text excerpt database** into a **visual document analysis tool**.

---

## 🔗 RELATED FILES

- Current text viewer: `src/components/pdf-excerpt-viewer.js`
- PDF collector: `src/collectors/pdf-collector.js`
- Database schema: `src/database/schema.sql`
- Backend handlers: `main.js` (lines 1548-1600)
- Agent B's original handoff: `docs/HANDOFF_PDF_EXCERPT_BROWSING.md`
- My implementation doc: `docs/AGENT_A_PDF_VIEWER_IMPLEMENTATION.md`

---

**Ready for pickup! This is a high-impact, technically challenging feature that will significantly enhance the app's value for both human raters and AI workflows. Good luck! 🚀📄**

**Handoff Date:** October 6, 2025
**Priority:** HIGH
**Estimated Effort:** 13-18 hours
**Complexity:** High (but well-scoped)
**User Impact:** VERY HIGH (game-changing feature)
**Technical Debt:** Low (builds on solid foundation)

---

**Agent A signing off - comprehensive handoff complete! 📄✨**
