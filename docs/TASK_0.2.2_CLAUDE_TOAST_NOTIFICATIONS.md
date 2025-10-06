# Task 0.2.2: Toast Notifications System (Frontend Polish)

**To:** Claude Implementation Agent (Frontend Specialist)
**From:** Consultant Agent
**Date:** October 6, 2025
**Priority:** MEDIUM
**Estimated Time:** 2-3 hours
**Dependencies:** ✅ Task 0.2 (Folder Browser UI)

---

## OBJECTIVE

Implement a professional toast notification system to provide visual feedback for all folder and collection operations. This replaces the placeholder `showSuccess()` and `showError()` methods currently in the Folder Browser.

---

## CONTEXT

Your Task 0.2 completion report noted:

> **Toast Notifications**
> - Success/error messages log to console
> - No visual toast notifications yet
> - Marked as TODO in code

This task addresses that TODO and adds **significant polish** to the user experience.

---

## WHAT YOU WILL DO

### 1. Create Toast Notification Component

**File to Create:** `src/components/toast-notification.js`

**Component Requirements:**

- **Multiple Toast Support:** Show multiple toasts stacked vertically
- **Auto-Dismiss:** Toasts disappear after configurable timeout (default: 3 seconds)
- **Manual Dismiss:** Click X button to close early
- **Types:** Success, Error, Warning, Info
- **Animations:** Smooth slide-in from top-right, fade-out on dismiss
- **Queue Management:** New toasts push old ones down
- **Action Buttons:** Optional action button (e.g., "Undo", "View")

**API:**
```javascript
class ToastNotification {
  constructor(containerId = 'toast-container') {
    this.container = document.getElementById(containerId);
    this.toasts = [];
  }

  success(message, options = {}) { ... }
  error(message, options = {}) { ... }
  warning(message, options = {}) { ... }
  info(message, options = {}) { ... }

  show(message, type, options) {
    // type: 'success' | 'error' | 'warning' | 'info'
    // options: { duration, action, onAction, dismissible }
  }

  dismiss(toastId) { ... }
  dismissAll() { ... }
}

// Global instance
window.toastNotification = new ToastNotification();
```

**Options Object:**
```typescript
{
  duration?: number        // Auto-dismiss after ms (default: 3000, 0 = never)
  dismissible?: boolean    // Show close button (default: true)
  action?: {
    label: string          // Button text (e.g., "Undo", "View")
    callback: () => void   // Action handler
  }
}
```

### 2. Create Toast Styles

**File to Create:** `src/styles/toast-notification.css`

**Design Requirements:**

**Container:**
- Fixed position: top-right corner
- Z-index: 10000 (above all other UI)
- Stacked vertically with 10px gap
- Does not block clicks on underlying UI

**Individual Toast:**
- Width: 350px
- Padding: 16px
- Border radius: 8px
- Box shadow: `0 4px 12px rgba(0, 0, 0, 0.15)`
- Backdrop blur for modern effect
- Flexbox layout: icon, message, action button, close button

**Colors (match existing dark theme):**
```css
.toast-success {
  background: rgba(16, 185, 129, 0.95);  /* green-500 with transparency */
  color: white;
}

.toast-error {
  background: rgba(239, 68, 68, 0.95);   /* red-500 */
  color: white;
}

.toast-warning {
  background: rgba(245, 158, 11, 0.95);  /* amber-600 */
  color: white;
}

.toast-info {
  background: rgba(59, 130, 246, 0.95);  /* blue-500 */
  color: white;
}
```

**Animations:**
```css
@keyframes slideInRight {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(400px);
    opacity: 0;
  }
}

.toast {
  animation: slideInRight 0.3s ease-out;
}

.toast.dismissing {
  animation: slideOutRight 0.3s ease-in;
}
```

**Icons:**
Use emoji or Unicode symbols:
- Success: ✅ (U+2705)
- Error: ❌ (U+274C)
- Warning: ⚠️ (U+26A0)
- Info: ℹ️ (U+2139)

### 3. HTML Integration

**Modify:** `index-advanced.html`

**Add to `<head>`:**
```html
<link rel="stylesheet" href="src/styles/toast-notification.css">
```

**Add before closing `</body>`:**
```html
<!-- Toast Container -->
<div id="toast-container" class="toast-container"></div>

<!-- Toast Notification Script -->
<script src="src/components/toast-notification.js"></script>
```

### 4. Update Folder Browser

**Modify:** `src/components/folder-browser.js`

**Replace placeholder methods:**

**Old (remove these):**
```javascript
showSuccess(message) {
  console.log('[SUCCESS]', message);
  // TODO: Implement toast notifications
}

showError(message) {
  console.error('[ERROR]', message);
  // TODO: Implement toast notifications
}
```

**New (use global toast instance):**
```javascript
showSuccess(message) {
  window.toastNotification.success(message);
}

showError(message) {
  window.toastNotification.error(message);
}
```

### 5. Enhance Folder Browser with Rich Notifications

**Add these notification calls throughout folder-browser.js:**

**Create Folder:**
```javascript
const result = await window.api.folders.create(name, parentId, {});
if (result.success) {
  window.toastNotification.success(
    `Folder "${name}" created successfully`,
    { duration: 2000 }
  );
}
```

**Delete Folder (with undo):**
```javascript
const result = await window.api.folders.delete(folderId, false);
if (result.success) {
  window.toastNotification.info(
    'Folder deleted',
    {
      duration: 5000,
      action: {
        label: 'Undo',
        callback: () => this.undoDelete(folderId)  // Implement if time allows
      }
    }
  );
}
```

**Move Collection:**
```javascript
const result = await window.api.collections.moveToFolder(collectionId, targetFolderId);
if (result.success) {
  const folderName = await this.getFolderName(targetFolderId);
  window.toastNotification.success(
    `Moved to "${folderName}"`,
    { duration: 2000 }
  );
}
```

**Export Collection:**
```javascript
const result = await window.api.collections.exportToJSON(collectionId, path);
if (result.success) {
  window.toastNotification.success(
    `Exported ${result.data.itemCount} items`,
    {
      duration: 4000,
      action: {
        label: 'Open Folder',
        callback: () => {
          // Open file location in Finder/Explorer
          window.api.shell.showItemInFolder(result.data.filePath);
        }
      }
    }
  );
}
```

**Import with Conflicts:**
```javascript
const result = await window.api.collections.importFromJSON(filePath, options);
if (result.success && result.data.conflicts.length > 0) {
  window.toastNotification.warning(
    `Imported with ${result.data.conflicts.length} conflicts resolved`,
    {
      duration: 5000,
      action: {
        label: 'View Details',
        callback: () => this.showConflictDetails(result.data.conflicts)
      }
    }
  );
} else if (result.success) {
  window.toastNotification.success(
    `Imported ${result.data.itemsImported} items`
  );
}
```

**Network/Database Errors:**
```javascript
try {
  const result = await window.api.folders.getContents(folderId);
  // ...
} catch (error) {
  window.toastNotification.error(
    'Failed to load folder contents. Please try again.',
    { duration: 5000 }
  );
  console.error('Folder load error:', error);
}
```

### 6. Add Progress Toasts (Advanced)

**For long operations (export/import):**

```javascript
async exportFolderToZIP(folderId) {
  // Show progress toast
  const progressToastId = window.toastNotification.info(
    'Exporting folder...',
    { duration: 0, dismissible: false }  // Don't auto-dismiss
  );

  try {
    const result = await window.api.folders.exportToZIP(folderId, path, options);

    // Dismiss progress toast
    window.toastNotification.dismiss(progressToastId);

    // Show success
    window.toastNotification.success(
      `Exported ${result.data.collectionCount} collections`,
      {
        duration: 4000,
        action: {
          label: 'Open Folder',
          callback: () => window.api.shell.showItemInFolder(result.data.filePath)
        }
      }
    );
  } catch (error) {
    window.toastNotification.dismiss(progressToastId);
    window.toastNotification.error(`Export failed: ${error.message}`);
  }
}
```

---

## DESIGN REFERENCE

**Visual Example:**

```
┌──────────────────────────────────────┐
│ ✅  Folder "Research" created        │
│                                   ✕  │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ ℹ️  Folder deleted          [Undo] ✕ │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ ⚠️  Imported with 2 conflicts        │
│                   [View Details]  ✕  │
└──────────────────────────────────────┘
```

**Placement:**
- Top-right corner: 20px from top, 20px from right
- Stacked vertically with 10px gap
- Newest toast appears at top
- Older toasts slide down

**Behavior:**
- Slide in from right over 300ms
- Stay visible for configured duration
- Fade out and slide right over 300ms
- Remaining toasts smoothly move up to fill gap

---

## ACCESSIBILITY

**Must implement:**

- [ ] ARIA live regions for screen readers
- [ ] Keyboard navigation (Tab to action button, Enter to activate)
- [ ] Focus management (don't trap focus in toast)
- [ ] High contrast mode support
- [ ] Reduced motion support (disable animations if `prefers-reduced-motion`)

**Example ARIA:**
```html
<div class="toast toast-success" role="alert" aria-live="polite" aria-atomic="true">
  <span class="toast-icon" aria-hidden="true">✅</span>
  <span class="toast-message">Folder created successfully</span>
  <button class="toast-close" aria-label="Close notification">✕</button>
</div>
```

---

## SUCCESS CRITERIA

### Component Complete When:

- [ ] ToastNotification class created with all methods
- [ ] success(), error(), warning(), info() work correctly
- [ ] Multiple toasts display simultaneously (stacked)
- [ ] Auto-dismiss after timeout
- [ ] Manual dismiss with X button
- [ ] Smooth animations (slide in/out)
- [ ] Action buttons work
- [ ] Queue management (old toasts move down for new ones)
- [ ] No console errors

### Integration Complete When:

- [ ] All folder operations show toasts
- [ ] All collection operations show toasts
- [ ] Export/import show progress and results
- [ ] Errors display with helpful messages
- [ ] Action buttons trigger correct callbacks
- [ ] Toasts match dark theme design
- [ ] ARIA attributes present
- [ ] Keyboard navigation works

### Testing Checklist:

**Basic Operations:**
```javascript
// 1. Create folder → See success toast
// 2. Rename folder → See success toast
// 3. Delete folder → See info toast with undo button
// 4. Move collection → See success toast
// 5. Archive folder → See success toast
```

**Multiple Toasts:**
```javascript
// 1. Quickly create 3 folders
// 2. Should see 3 toasts stacked
// 3. Each should auto-dismiss after 3 seconds
// 4. Should smoothly slide out
```

**Action Buttons:**
```javascript
// 1. Export collection
// 2. Toast shows "Open Folder" button
// 3. Click button
// 4. File browser opens to export location
```

**Error Handling:**
```javascript
// 1. Try to delete folder with children (cascade=false)
// 2. Should see error toast
// 3. Error should stay longer (5 seconds)
// 4. Message should explain why it failed
```

---

## BONUS FEATURES (If Time Allows)

### 1. Toast Grouping
- Group similar toasts: "3 collections moved"
- Show count instead of multiple individual toasts

### 2. Persistent Toasts
- Option to keep toast until manually dismissed
- For critical errors that need user acknowledgment

### 3. Toast History
- Click icon in corner to see recent notifications
- Log of all toasts from current session

### 4. Sound Effects
- Optional subtle sound for errors
- Respects system sound preferences

### 5. Toast Positioning
- Allow user to choose corner (settings)
- Remember preference in localStorage

---

## NOTES

### Why Toast Notifications Matter

**Before:**
- User clicks "Create Folder"
- No feedback except console log
- Did it work? Who knows!

**After:**
- User clicks "Create Folder"
- Toast appears: "Folder 'Research' created ✅"
- Confidence that action succeeded
- Professional, polished feel

### Best Practices

**Message Writing:**
- ✅ "Folder deleted" (concise)
- ❌ "The folder has been successfully deleted from the database" (verbose)

**Timing:**
- Quick actions: 2-3 seconds
- Important info: 4-5 seconds
- Errors: 5+ seconds or manual dismiss
- Progress: 0 (don't auto-dismiss)

**Actions:**
- Undo for destructive operations
- "View" for details
- "Open" for file locations
- Keep button text short (1-2 words)

---

## ESTIMATED TIME

**Total: 2-3 hours**

- Create ToastNotification class: 45 min
- Create CSS with animations: 45 min
- Integrate into Folder Browser: 30 min
- Add rich notifications: 30 min
- Testing and polish: 30 min

---

## COMPLETION REPORT

When done, create: `docs/TASK_0.2.2_COMPLETION_REPORT.md`

Include:
- Screenshots of different toast types
- Examples of action buttons in use
- Demonstration of multiple toasts stacked
- ARIA attributes implemented
- List of all operations with toast feedback
- Before/after comparison (console logs vs visual toasts)

---

**This task significantly improves UX. Start after Task 0.2.1 (UI Stubs) is complete.**
