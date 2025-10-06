# Seamless Relay Handoff: PDF Excerpt Browsing

**From:** Agent B (Full-Stack Generalist Expert)
**To:** Next Agent (Full-Stack Generalist Expert)
**Date:** October 6, 2025
**Priority:** MEDIUM (Feature gap - PDF collections exist but can't browse excerpts)
**Status:** 🔄 READY FOR PICKUP
**Estimated Time:** 4-6 hours

---

## CURRENT STATE

### ✅ What Works Now

1. **PDF Upload:** Fully functional
   - Drag & drop interface
   - Creates collection with correct excerpt count
   - Excerpts stored in `pdf_excerpts` table
   - Collections show correct item count (e.g., "1170 items")

2. **Collection Viewer Exists:**
   - `src/components/collection-viewer.js` - Basic modal viewer
   - `src/components/gallery-viewer.js` - Grid-based viewer for videos
   - Both can be adapted for PDF excerpts

3. **Backend APIs Work:**
   - `window.api.pdf.list(collectionId)` - Get all PDFs in collection
   - `window.api.pdf.getExcerpts(pdfId)` - Get excerpts for a specific PDF
   - Returns: `{success: true, data: [excerpts]}`

### ❌ What's Missing

1. **No UI to browse PDF excerpts**
   - Clicking a PDF collection in folder browser doesn't open a viewer
   - No way to see the 1170 excerpts that were created
   - Existing collection viewer only handles videos

2. **No excerpt display component**
   - Need text-based viewer (not video grid)
   - Should show page numbers, excerpt text
   - Ideally paginated or virtualized for large PDFs

3. **No integration**
   - Folder browser doesn't detect PDF vs video collections
   - Collection viewer doesn't route to PDF viewer

---

## THE TASK

**Goal:** Implement a smart way to browse PDF excerpts when opening a PDF collection.

**User Flow:**
1. User clicks a PDF collection in folder browser (e.g., "concussion_pdf_2014" with 1170 items)
2. A viewer opens showing the excerpts
3. User can read excerpts, see page numbers, navigate pages
4. (Bonus) Search within excerpts, highlight text, etc.

---

## TECHNICAL ARCHITECTURE

### Database Schema (Already Exists)

**Collections Table:**
```sql
CREATE TABLE collections (
  id INTEGER PRIMARY KEY,
  search_term TEXT,      -- "concussion_pdf_2014"
  video_count INTEGER,   -- 1170 (actually excerpt count for PDFs)
  settings TEXT          -- JSON with type: 'pdf'
)
```

**PDFs Table:**
```sql
CREATE TABLE pdfs (
  id INTEGER PRIMARY KEY,
  collection_id INTEGER,
  file_path TEXT,
  title TEXT,
  author TEXT,
  num_pages INTEGER,
  file_size INTEGER,
  metadata TEXT,
  created_at DATETIME
)
```

**PDF Excerpts Table:**
```sql
CREATE TABLE pdf_excerpts (
  id INTEGER PRIMARY KEY,
  pdf_id INTEGER,
  collection_id INTEGER,
  excerpt_number INTEGER,  -- 1, 2, 3, ...
  page_number INTEGER,     -- Which page this excerpt is from
  text_content TEXT,       -- The actual text
  char_start INTEGER,
  char_end INTEGER,
  bbox TEXT               -- Bounding box (JSON)
)
```

### Existing APIs (main.js)

```javascript
// Get all PDFs in a collection
ipcMain.handle('pdf:list', async (event, collectionId) => {
  // Returns: {success: true, pdfs: [...]}
  // Each PDF has: id, title, num_pages, excerpts_count
});

// Get all excerpts for a specific PDF
ipcMain.handle('pdf:getExcerpts', async (event, pdfId) => {
  // Returns: {success: true, data: [excerpts]}
  // Each excerpt: id, excerpt_number, page_number, text_content
});
```

### Frontend APIs (preload.js)

```javascript
window.api.pdf = {
  list: (collectionId) => ipcRenderer.invoke('pdf:list', collectionId),
  getExcerpts: (pdfId) => ipcRenderer.invoke('pdf:getExcerpts', pdfId),
  // ... upload, delete
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Detect PDF Collections (30 min)

**File:** `src/components/folder-browser.js:242-246`

**Current Code:**
```javascript
item.addEventListener('click', () => {
  this.openCollection(collectionId);
});
```

**What to Add:**
```javascript
item.addEventListener('click', async () => {
  // Check if it's a PDF collection
  const collection = await window.api.database.getCollection(collectionId);
  const settings = JSON.parse(collection.settings || '{}');

  if (settings.type === 'pdf') {
    // Open PDF viewer
    if (window.pdfExcerptViewer) {
      window.pdfExcerptViewer.show(collectionId);
    }
  } else {
    // Open regular collection viewer
    this.openCollection(collectionId);
  }
});
```

---

### Phase 2: Create PDF Excerpt Viewer Component (3-4 hours)

**Create New File:** `src/components/pdf-excerpt-viewer.js`

**Class Structure:**
```javascript
class PDFExcerptViewer {
  constructor() {
    this.currentCollection = null;
    this.currentPDF = null;
    this.excerpts = [];
    this.currentPage = 1;
    this.excerptsPerPage = 20; // Paginate to avoid DOM overload
  }

  async show(collectionId) {
    // Load collection metadata
    // Load PDFs in collection
    // Load excerpts for first PDF
    // Render UI
  }

  render() {
    // Modal with:
    // - Header: PDF title, page count, excerpt count
    // - Sidebar: List of PDFs (if multiple PDFs in collection)
    // - Main area: Paginated list of excerpts
    // - Footer: Pagination controls
  }

  renderExcerpts() {
    // For each excerpt:
    // - Page number badge
    // - Text content
    // - Word count
    // - (Optional) Highlight search terms
  }

  async switchPDF(pdfId) {
    // Load excerpts for different PDF
    // Reset pagination
    // Re-render
  }

  nextPage() / prevPage() {
    // Pagination
  }
}

window.pdfExcerptViewer = new PDFExcerptViewer();
```

---

### Phase 3: UI Design (1 hour)

**Modal Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│  PDF Collection: concussion_pdf_2014                    ✕   │
│  1170 excerpts from 1 PDF                                   │
├─────────┬───────────────────────────────────────────────────┤
│ PDFs    │  Excerpt Browser                                  │
│         │                                                    │
│ • 2010- │  ┌─────────────────────────────────────────────┐  │
│   2014  │  │ Page 1 | Excerpt 1                          │  │
│   (1170)│  │ Lorem ipsum dolor sit amet, consectetur... │  │
│         │  │ adipiscing elit. Sed do eiusmod tempor...  │  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                    │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ Page 1 | Excerpt 2                          │  │
│         │  │ Ut enim ad minim veniam, quis nostrud...   │  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                    │
│         │  ... (20 excerpts per page)                       │
│         │                                                    │
├─────────┴───────────────────────────────────────────────────┤
│  Search: [___________]  │  Page 1 of 59  [<] [>]           │
└─────────────────────────────────────────────────────────────┘
```

**Styling Guidelines:**
- Use existing dark theme (`src/styles/folder-browser.css` as reference)
- Excerpt cards: light background with subtle border
- Page number badges: accent color
- Monospace font for text content (or serif for readability)
- Virtualization recommended for 1000+ excerpts

---

### Phase 4: Styling (1 hour)

**Create:** `src/styles/pdf-excerpt-viewer.css`

**Key Classes:**
```css
.pdf-excerpt-viewer-modal { /* Full-screen modal */ }
.pdf-excerpt-header { /* Title, counts, close button */ }
.pdf-sidebar { /* List of PDFs if multiple */ }
.excerpt-list { /* Main scrollable area */ }
.excerpt-card {
  /* Individual excerpt:
     - Light background
     - Page number badge (top-left)
     - Text content (line-clamp or full)
     - Hover: slight lift
  */
}
.excerpt-page-badge { /* "Page 5" */ }
.excerpt-text { /* Main text, readable font */ }
.pagination-controls { /* << 1 of 59 >> */ }
```

---

### Phase 5: Integration (30 min)

**Add to `index-advanced.html`:**
```html
<!-- Before closing body tag -->
<link rel="stylesheet" href="src/styles/pdf-excerpt-viewer.css">
<script src="src/components/pdf-excerpt-viewer.js"></script>
```

**Update folder-browser.js:**
- Detect PDF collections (Phase 1)
- Route to PDF viewer instead of collection viewer

---

## CRITICAL IMPLEMENTATION NOTES

### 1. Collection Type Detection

**How to know if a collection is PDF vs YouTube:**

```javascript
const collection = await window.api.database.getCollection(collectionId);
const settings = JSON.parse(collection.settings || '{}');

if (settings.type === 'pdf') {
  // PDF collection
} else {
  // YouTube collection (or untyped)
}
```

**Set during PDF upload:** `main.js:1085-1090`
```javascript
const settings = {
  type: 'pdf',
  createdAt: new Date().toISOString()
};
const collectionId = await db.createCollection(name, settings);
```

### 2. Performance Considerations

**Problem:** 1170 excerpts = heavy DOM if rendered at once

**Solutions:**
1. **Pagination:** Show 20-50 excerpts per page (recommended)
2. **Virtualization:** Use virtual scrolling (react-window, vanilla-js equivalent)
3. **Lazy loading:** Load excerpts on-demand as user scrolls

**Recommended:** Start with pagination (simpler), add virtualization if needed.

### 3. Excerpt Text Length

**Typical excerpt:** 200-500 characters
**Display options:**
- **Truncated:** Show first 200 chars with "..." and "Read More" button
- **Full:** Show entire excerpt (can be long for page-based chunking)
- **Collapsible:** Start truncated, expand on click

**Recommended:** Start with full text, add truncation if cards feel too large.

### 4. Multiple PDFs in One Collection

**Edge Case:** User could upload multiple PDFs to same collection

**Current UI in screenshot:** Shows individual collections per PDF
**But technically possible:** Multiple PDFs → one collection

**Handle this by:**
- Sidebar listing all PDFs
- Click PDF to switch view
- Default to first PDF on open

---

## EXISTING CODE TO LEVERAGE

### Collection Viewer Modal (Adapt This)

**File:** `src/components/collection-viewer.js`

**Key Methods to Study:**
- `show(collectionId)` - Entry point
- `render()` - Modal HTML generation
- Modal overlay pattern (background click to close)

**Don't reinvent the wheel:**
- Copy modal structure
- Use same CSS classes for overlay
- Adapt content area for text instead of videos

### Gallery Viewer (Don't Use, But Study)

**File:** `src/components/gallery-viewer.js`

**What to learn:**
- Grid layout for items
- Pagination implementation
- Keyboard navigation (arrow keys)

**Why not use directly:** Designed for video thumbnails, not text excerpts

---

## API RESPONSE FORMATS

### `window.api.pdf.list(collectionId)`

**Returns:**
```javascript
{
  success: true,
  pdfs: [
    {
      id: 1,
      collection_id: 23,
      title: "2010-2014",
      author: "Unknown",
      num_pages: 1170,
      file_size: 2560000,
      excerpts_count: 1170,  // From LEFT JOIN COUNT
      created_at: "2025-10-06T..."
    }
  ]
}
```

### `window.api.pdf.getExcerpts(pdfId)`

**Returns:**
```javascript
{
  success: true,
  data: [
    {
      id: 1,
      pdf_id: 1,
      collection_id: 23,
      excerpt_number: 1,
      page_number: 1,
      text_content: "Lorem ipsum dolor sit amet...",
      char_start: 0,
      char_end: 250,
      bbox: null  // or JSON string
    },
    // ... 1169 more
  ]
}
```

---

## TESTING CHECKLIST

### Functionality
- [ ] Click PDF collection → PDF viewer opens
- [ ] Click YouTube collection → regular viewer opens (no regression)
- [ ] All excerpts load correctly
- [ ] Page numbers display correctly
- [ ] Pagination works (next/prev)
- [ ] Multiple PDFs in one collection (if applicable)
- [ ] Search within excerpts (bonus feature)
- [ ] Close button works
- [ ] Background click closes modal
- [ ] Escape key closes modal

### Performance
- [ ] 1000+ excerpts don't freeze UI
- [ ] Pagination loads quickly
- [ ] Scrolling is smooth
- [ ] No memory leaks (test with large collections)

### Edge Cases
- [ ] Empty collection (0 excerpts)
- [ ] Single excerpt
- [ ] Very long excerpt (5000+ chars)
- [ ] Special characters in text (unicode, emojis)
- [ ] Missing page_number field
- [ ] Null/undefined text_content

---

## SUCCESS CRITERIA

### Must Have ✅
1. User can click PDF collection and see excerpts
2. Excerpts display with page numbers
3. Pagination works for large collections (1000+ excerpts)
4. Modal can be closed (button, background, Escape)
5. No errors in console
6. Matches dark theme aesthetic

### Nice to Have 🎯
1. Search/filter excerpts by keyword
2. Jump to specific page number
3. Export excerpts to text file
4. Highlight search terms in text
5. Copy excerpt text to clipboard
6. Keyboard navigation (arrow keys for pagination)

### Bonus Features 🚀
1. Side-by-side PDF viewer (show original PDF alongside excerpts)
2. Excerpt rating/tagging system
3. Link excerpts to BWS rating interface
4. Full-text search across all collections

---

## KNOWN GOTCHAS

### Gotcha 1: Collection Type Field

**Issue:** Older collections may not have `type: 'pdf'` in settings

**Detection fallback:**
```javascript
const settings = JSON.parse(collection.settings || '{}');
const isPDF = settings.type === 'pdf' || collection.video_count > 0 && !hasVideos;

// Or check if collection has PDFs
const pdfs = await window.api.pdf.list(collectionId);
const isPDF = pdfs.success && pdfs.pdfs.length > 0;
```

### Gotcha 2: video_count Field Name

**Issue:** Field is named `video_count` but stores excerpt count for PDFs

**Why:** Reusing existing schema to avoid migration
**Solution:** Rename to `item_count` in display, but use `video_count` in queries

### Gotcha 3: Large Text Content

**Issue:** Some excerpts can be very long (full pages)

**Solution:** Either:
- CSS `line-clamp` to limit display
- Collapsible cards (show more/less)
- Modal within modal for full excerpt view

### Gotcha 4: Modal Z-Index Conflicts

**Issue:** PDF viewer modal may conflict with existing modals

**Solution:** Use consistent z-index hierarchy:
- Overlay: `z-index: 9998`
- Modal content: `z-index: 9999`
- Nested modals: `z-index: 10000+`

---

## FILES YOU'LL CREATE

| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `src/components/pdf-excerpt-viewer.js` | Main component | 300-400 |
| `src/styles/pdf-excerpt-viewer.css` | Styling | 200-300 |

## FILES YOU'LL MODIFY

| File | Changes | Lines |
|------|---------|-------|
| `src/components/folder-browser.js` | Add PDF detection on click | +15 |
| `index-advanced.html` | Add CSS/JS includes | +2 |

**Total Estimated:** ~550 new lines

---

## RECOMMENDED APPROACH

### If You're a Frontend Specialist
1. Start with Phase 2 (create component)
2. Hard-code a collection ID for testing
3. Build the UI/UX first
4. Then integrate with folder browser (Phase 1)

### If You're Full-Stack
1. Start with Phase 1 (detection)
2. Create basic viewer (Phase 2)
3. Add styling (Phase 4)
4. Test end-to-end
5. Polish and add features

### Time Breakdown
- Phase 1 (Detection): 30 min
- Phase 2 (Component): 3-4 hours
- Phase 3 (UI Design): 1 hour (included in Phase 2)
- Phase 4 (Styling): 1 hour
- Phase 5 (Integration): 30 min
- Testing & Polish: 1 hour
- **Total: 4-6 hours**

---

## REFERENCE SCREENSHOTS

**Current State (from user):**
- Folder browser showing PDF collections
- Collections display: "concussion_pdf_2014" (0 items) ← Fixed to show 1170
- Multiple PDF collections visible

**What User Can't Do Now:**
- Click collection → nothing happens (or wrong viewer opens)
- No way to browse the 1170 excerpts

**What You'll Build:**
- Click collection → PDF excerpt viewer modal opens
- Scrollable/paginated list of excerpts with page numbers
- Professional, readable interface

---

## QUESTIONS TO ANSWER DURING IMPLEMENTATION

1. **Excerpt Display:**
   - Truncate or show full text?
   - Card-based or list-based layout?
   - Monospace or serif font?

2. **Navigation:**
   - Pagination only or infinite scroll?
   - Items per page: 10, 20, 50?
   - Jump to page input field?

3. **Multiple PDFs:**
   - How common is this use case?
   - Sidebar or dropdown to switch?
   - Default to showing all excerpts or one PDF?

4. **Search:**
   - Client-side (filter loaded excerpts)?
   - Server-side (new API endpoint)?
   - Future feature or MVP?

**Recommendation:** Start simple (pagination, full text, single PDF focus), add features based on user feedback.

---

## WHAT'S ALREADY DONE (DON'T REDO)

✅ PDF upload working
✅ Excerpt extraction working
✅ Database schema complete
✅ Backend APIs functional
✅ Collection counts fixed
✅ Folder browser loads collections
✅ Toast notification system
✅ Dark theme CSS established

**Focus only on:** The viewer component and integration.

---

## CONCLUSION

**Current State:** PDF collections exist with excerpts in database, but no UI to view them.

**Your Mission:** Build the PDF excerpt viewer so users can actually read their 1170 excerpts.

**Outcome:** Clicking a PDF collection opens a beautiful, readable viewer showing all excerpts with page numbers and pagination.

**Difficulty:** Medium (mostly frontend work, APIs already exist)

**User Impact:** HIGH (critical feature gap - PDFs are uploaded but invisible to users)

---

**Ready for pickup! Good luck! 🚀**

**Questions?** Check:
- `src/components/collection-viewer.js` - For modal pattern reference
- `src/components/gallery-viewer.js` - For pagination reference
- `main.js:1548-1599` - For PDF API handlers
- `src/collectors/pdf-collector.js` - For understanding excerpt creation

**Agent B signing off - handoff complete! 📄➡️👨‍💻**

---

**Handoff Date:** October 6, 2025
**Priority:** MEDIUM
**Estimated Effort:** 4-6 hours
**Agent Type Needed:** Full-Stack (or Frontend with API knowledge)
