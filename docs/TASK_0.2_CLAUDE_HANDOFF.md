# Task 0.2 Handoff: Folder Browser UI (Frontend)

**From:** Consultant Agent
**To:** Claude Implementation Agent (Frontend Specialist)
**Date:** October 6, 2025
**Task:** Phase 0, Task 0.2 - Folder Browser UI
**Estimated Time:** 3-4 hours
**Dependencies:** ✅ Task 0.1 Complete (Schema + Folder API)

---

## YOUR ROLE: FRONTEND SPECIALIST

You are the **Frontend Implementation Agent**. Your focus is on:
- User interface components
- User interactions (clicks, drag-and-drop)
- Visual rendering and styling
- Frontend state management

**You do NOT touch:**
- Database files
- Backend services
- IPC handlers (already exist from Task 0.1)
- Preload API (already exists from Task 0.1)

---

## GOAL STATEMENT

Create a hierarchical folder browser UI component that allows users to:
1. View folder hierarchy in a tree structure
2. Navigate through folders (expand/collapse)
3. Create, rename, and delete folders
4. Move collections between folders via drag-and-drop
5. View special collections (Starred, Archived)

**User Value:** Organize research collections into projects/semesters/topics instead of a flat list.

---

## WHAT YOU'RE BUILDING

### Visual Reference

```
┌─────────────────────────────────────────────────────┐
│  Collections                     [+ New Folder] [⚙️] │
├─────────────────────────────────────────────────────┤
│  📁 Research                                   (12) │  ← Expandable folder
│    📁 CTE Study                                (8)  │
│      📁 2025                                   (5)  │
│        📊 High CTE Symptoms              300 items │  ← Collection
│        📊 Diagnostic Criteria             80 items │
│      📁 Archived                               (3)  │
│    📁 Eye Contact Analysis                     (4)  │
│  📁 Pilot Tests                                (6)  │
│  ⭐ Starred Collections                        (3)  │  ← Special view
│  🗑️  Archived                                  (15) │
│                                                     │
│  [Right-click folder for options]                  │
└─────────────────────────────────────────────────────┘
```

### Features Checklist

- [ ] Tree structure with expand/collapse arrows
- [ ] Folders show collection count
- [ ] Collections show item count
- [ ] Create new folder button
- [ ] Right-click context menu (rename, delete, archive)
- [ ] Drag-and-drop to move folders
- [ ] Drag-and-drop to move collections to folders
- [ ] Folder colors displayed
- [ ] Click collection to open viewer
- [ ] Special views: "All Collections", "Starred", "Archived"

---

## FILES YOU WILL CREATE

```
src/components/
  └── folder-browser.js          (Main component - ~400 lines)

src/styles/
  └── folder-browser.css         (Styles - ~200 lines)
```

## FILES YOU WILL MODIFY

```
index-advanced.html               (Add folder browser to collections tab)
```

**DO NOT MODIFY:**
- `src/database/` (anything in database folder)
- `main.js` (IPC handlers already exist)
- `preload.js` (API already exposed)
- Any backend files

---

## EXISTING API (FROM TASK 0.1)

**You have these methods available via `window.api.folders.*`:**

```javascript
// Create folder
const result = await window.api.folders.create('Research', null, {
  description: 'Research projects',
  color: '#6366f1'
});
// Returns: { success: true, data: folderId }

// Get folder contents
const contents = await window.api.folders.getContents(folderId);
// Returns: { success: true, data: { folders: [...], collections: [...] } }

// Rename folder
await window.api.folders.rename(folderId, 'New Name');

// Delete folder
await window.api.folders.delete(folderId, cascade);
// cascade=true: delete children, cascade=false: move to parent

// Move folder to new parent
await window.api.folders.move(folderId, newParentId);

// Get folder path
const path = await window.api.folders.getPath(folderId);
// Returns: { success: true, data: "/Research/CTE Study" }

// Archive/unarchive folder
await window.api.folders.archive(folderId, true);

// Move collection to folder
await window.api.collections.moveToFolder(collectionId, folderId);

// Star/unstar collection
await window.api.collections.star(collectionId, true);

// Archive/unarchive collection
await window.api.collections.archive(collectionId, true);
```

**You call these APIs. You do NOT implement them.**

---

## COMPONENT ARCHITECTURE

### File: `src/components/folder-browser.js`

Create a class-based component following the pattern of existing components:

```javascript
/**
 * Folder Browser Component
 * Hierarchical tree view for organizing collections into folders
 */
class FolderBrowser {
  constructor() {
    this.currentFolderId = null;  // null = root level
    this.expandedFolders = new Set();  // Track which folders are expanded
    this.selectedItem = null;  // Currently selected folder or collection

    this.initializeElements();
    this.attachEventListeners();
    this.loadFolderTree();
  }

  initializeElements() {
    this.treeContainer = document.getElementById('folder-tree');
    this.createFolderBtn = document.getElementById('create-folder-btn');
    // ... other element references
  }

  async loadFolderTree(folderId = null) {
    try {
      const result = await window.api.folders.getContents(folderId);
      if (!result.success) {
        console.error('Failed to load folder contents:', result.error);
        return;
      }

      const { folders, collections } = result.data;
      this.renderTree(folders, collections, folderId);
    } catch (error) {
      console.error('Error loading folder tree:', error);
    }
  }

  renderTree(folders, collections, parentId) {
    // Render folder tree with folders first, then collections
    // Add expand/collapse arrows
    // Add click handlers
  }

  async createFolder() {
    const name = prompt('Folder name:');
    if (!name) return;

    const result = await window.api.folders.create(name, this.currentFolderId, {
      color: '#6366f1'
    });

    if (result.success) {
      this.loadFolderTree(this.currentFolderId);  // Refresh view
    }
  }

  async renameFolder(folderId) {
    const newName = prompt('New folder name:');
    if (!newName) return;

    await window.api.folders.rename(folderId, newName);
    this.loadFolderTree(this.currentFolderId);
  }

  async deleteFolder(folderId) {
    const confirm = window.confirm('Delete this folder? (Children will be moved to parent)');
    if (!confirm) return;

    await window.api.folders.delete(folderId, false);  // cascade=false
    this.loadFolderTree(this.currentFolderId);
  }

  showContextMenu(event, folderId) {
    event.preventDefault();
    // Show context menu with: Rename, Delete, Archive, Change Color
  }

  toggleFolderExpand(folderId) {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
    this.loadFolderTree();
  }

  // Drag-and-drop methods
  onDragStart(event, item, itemType) {
    event.dataTransfer.setData('itemId', item.id);
    event.dataTransfer.setData('itemType', itemType); // 'folder' or 'collection'
  }

  onDrop(event, targetFolderId) {
    event.preventDefault();
    const itemId = event.dataTransfer.getData('itemId');
    const itemType = event.dataTransfer.getData('itemType');

    if (itemType === 'folder') {
      window.api.folders.move(parseInt(itemId), targetFolderId);
    } else if (itemType === 'collection') {
      window.api.collections.moveToFolder(parseInt(itemId), targetFolderId);
    }

    this.loadFolderTree();
  }
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.folderBrowser = new FolderBrowser();
  });
} else {
  window.folderBrowser = new FolderBrowser();
}
```

### UI Patterns to Follow

**Expand/Collapse:**
```html
<div class="folder-item" data-folder-id="1">
  <span class="expand-arrow">▶</span>  <!-- Rotates 90° when expanded -->
  <span class="folder-icon">📁</span>
  <span class="folder-name">Research</span>
  <span class="folder-count">(12)</span>
</div>

<!-- When expanded, show children indented -->
<div class="folder-children" style="margin-left: 20px;">
  <!-- Child folders and collections here -->
</div>
```

**Collection Item:**
```html
<div class="collection-item" data-collection-id="5" draggable="true">
  <span class="collection-icon">📊</span>
  <span class="collection-name">High CTE Symptoms</span>
  <span class="collection-count">300 items</span>
</div>
```

**Context Menu:**
```html
<div class="context-menu" id="folder-context-menu">
  <div class="context-menu-item" data-action="rename">Rename</div>
  <div class="context-menu-item" data-action="delete">Delete</div>
  <div class="context-menu-item" data-action="archive">Archive</div>
  <div class="context-menu-item" data-action="color">Change Color</div>
</div>
```

---

## STYLING GUIDE

### File: `src/styles/folder-browser.css`

Match the existing dark theme of the app:

```css
/* Folder Tree Container */
.folder-tree {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

/* Folder Item */
.folder-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  user-select: none;
}

.folder-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.folder-item.selected {
  background: rgba(99, 102, 241, 0.2);
}

/* Expand Arrow */
.expand-arrow {
  width: 20px;
  font-size: 0.8rem;
  transition: transform 0.2s;
  color: rgba(255, 255, 255, 0.5);
}

.expand-arrow.expanded {
  transform: rotate(90deg);
}

/* Folder Icon */
.folder-icon {
  margin: 0 0.5rem;
  font-size: 1.2rem;
}

/* Folder Name */
.folder-name {
  flex: 1;
  color: var(--text-primary);
  font-weight: 500;
}

/* Folder Count */
.folder-count {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-left: 0.5rem;
}

/* Folder Children (Indented) */
.folder-children {
  margin-left: 24px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding-left: 4px;
}

/* Collection Item */
.collection-item {
  display: flex;
  align-items: center;
  padding: 0.4rem 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.collection-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.collection-item.starred::before {
  content: '⭐';
  margin-right: 0.5rem;
}

.collection-item.archived {
  opacity: 0.6;
}

/* Drag-and-Drop States */
.folder-item.drag-over {
  background: rgba(99, 102, 241, 0.3);
  border: 2px dashed #6366f1;
}

.dragging {
  opacity: 0.5;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: var(--bg-tertiary);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 0.5rem 0;
  min-width: 150px;
  z-index: 1000;
}

.context-menu-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.context-menu-item:hover {
  background: rgba(99, 102, 241, 0.2);
}

/* Special Views */
.special-view {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.special-view-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
}

.special-view-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Create Folder Button */
#create-folder-btn {
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

#create-folder-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
}
```

---

## INTEGRATION WITH EXISTING UI

### File: `index-advanced.html`

Add the folder browser to the collections tab:

```html
<!-- Inside Collections tab content -->
<div class="collections-tab-content">
  <!-- NEW: Folder Browser -->
  <div class="folder-browser-container">
    <div class="folder-browser-header">
      <h3>Collections</h3>
      <button id="create-folder-btn" class="btn btn-primary">
        <span>📁</span> New Folder
      </button>
    </div>

    <div id="folder-tree" class="folder-tree">
      <!-- Tree will be rendered here by folder-browser.js -->
    </div>
  </div>

  <!-- Context menu (hidden by default) -->
  <div id="folder-context-menu" class="context-menu" style="display: none;">
    <div class="context-menu-item" data-action="rename">Rename</div>
    <div class="context-menu-item" data-action="delete">Delete</div>
    <div class="context-menu-item" data-action="archive">Archive</div>
    <div class="context-menu-item" data-action="color">Change Color</div>
  </div>
</div>

<!-- Load folder browser component -->
<script src="src/components/folder-browser.js"></script>
<link rel="stylesheet" href="src/styles/folder-browser.css">
```

---

## SUCCESS CRITERIA

Test each feature manually in Electron:

### Visual Rendering
- [ ] Folder tree renders with proper hierarchy
- [ ] Expand/collapse arrows work
- [ ] Collections display under correct folders
- [ ] Folder and collection counts show correctly
- [ ] Icons display properly (📁, 📊, ⭐, 🗑️)
- [ ] Indentation shows hierarchy clearly

### User Interactions
- [ ] Click folder to expand/collapse
- [ ] Click collection to open viewer (existing functionality)
- [ ] Create folder button opens prompt
- [ ] Right-click folder shows context menu
- [ ] Context menu actions work (rename, delete, archive)
- [ ] Context menu closes when clicking outside

### Drag-and-Drop
- [ ] Can drag folder to another folder
- [ ] Can drag collection to folder
- [ ] Drop zones highlight when dragging over
- [ ] Items move to correct location after drop
- [ ] Tree refreshes after move

### Special Views
- [ ] "All Collections" shows everything
- [ ] "Starred" shows only starred collections
- [ ] "Archived" shows only archived items
- [ ] Count badges update when collections change

### Error Handling
- [ ] No console errors on any action
- [ ] Graceful handling of API failures
- [ ] User-friendly error messages

---

## TESTING PROCEDURE

1. **Create Test Data:**
   ```javascript
   // In Electron console
   const r = await window.api.folders.create('Research', null, {});
   const cte = await window.api.folders.create('CTE Study', r.data, {});
   await window.api.folders.create('2025', cte.data, {});
   ```

2. **Test UI:**
   - Verify tree shows: Research > CTE Study > 2025
   - Click arrows to expand/collapse
   - Right-click "Research" → Rename
   - Drag a collection into "2025" folder

3. **Test Edge Cases:**
   - Empty folders
   - Deeply nested folders (4+ levels)
   - Many collections in one folder (20+)
   - Long folder names
   - Special characters in names

---

## WHAT NOT TO DO

❌ **Don't modify backend files** - Your work is frontend only
❌ **Don't implement new API methods** - Use existing ones from Task 0.1
❌ **Don't add database queries** - Call window.api.folders.* instead
❌ **Don't change IPC handlers** - They already exist
❌ **Don't add features not in this spec** - Stay focused

---

## COMPLETION CHECKLIST

Before reporting completion:

- [ ] `src/components/folder-browser.js` created
- [ ] `src/styles/folder-browser.css` created
- [ ] `index-advanced.html` modified to include component
- [ ] All visual rendering tests pass
- [ ] All user interaction tests pass
- [ ] Drag-and-drop works
- [ ] No console errors
- [ ] Code follows existing patterns
- [ ] Comments added for complex logic
- [ ] Manual testing completed

---

## REPORTING COMPLETION

When done, provide:

1. **Files Changed:**
   - List of created/modified files
   - Line counts

2. **Features Working:**
   - Checklist of success criteria met

3. **Screenshots:**
   - Folder tree with expanded folders
   - Context menu open
   - Drag-and-drop in action (if possible)

4. **Testing Results:**
   - What you tested
   - Any edge cases found

5. **Known Issues:**
   - Any limitations or bugs to address later

---

## ESTIMATED TIMELINE

- **Hour 1:** Set up component structure, basic rendering
- **Hour 2:** Expand/collapse, folder navigation
- **Hour 3:** Context menu, create/rename/delete
- **Hour 4:** Drag-and-drop, polish, testing

**Total: 3-4 hours**

---

**Ready to build! Focus on clean, user-friendly UI that makes organizing collections a joy. Good luck! 🚀**
