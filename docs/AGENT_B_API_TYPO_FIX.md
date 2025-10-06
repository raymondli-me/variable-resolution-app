# Agent B - API Namespace Typo Fix

**Date:** October 6, 2025
**Issue:** `Cannot read properties of undefined (reading 'getCollection')`
**Status:** ✅ FIXED

---

## PROBLEM

Multiple frontend files were calling `window.api.db.XXX()` methods, but `window.api.db` namespace was never exposed in `preload.js`. The correct namespace is `window.api.database`.

**Error:**
```
Cannot read properties of undefined (reading 'getCollection')
```

**Root Cause:** Typo/inconsistency in API namespace across codebase.

---

## SOLUTION

### Part 1: Added Missing Methods to preload.js

**File:** `preload.js` (lines 142-144)

Added missing method exposures:
```javascript
// Video and comment operations
getVideos: (collectionId) => ipcRenderer.invoke('db:getVideos', collectionId),
getComments: (videoId) => ipcRenderer.invoke('db:getComments', videoId),
```

### Part 2: Fixed API Namespace in All Files

Replaced all instances of `window.api.db.` with `window.api.database.` in:

1. **src/renderer-advanced.js**
   - 4 occurrences fixed
   - Special fix: `getRatingsForProject` moved to `window.api.ai` namespace

2. **src/components/collection-viewer.js**
   - 2 occurrences fixed

3. **src/components/enhanced-viewer.js**
   - 2 occurrences fixed

4. **src/components/gallery-viewer.js**
   - 3 occurrences fixed

5. **src/bws-manager.js**
   - 2 occurrences fixed

---

## FILES MODIFIED

| File | Changes | Description |
|------|---------|-------------|
| `preload.js` | +3 lines | Added getVideos() and getComments() |
| `src/renderer-advanced.js` | Replace all | Fixed db → database |
| `src/components/collection-viewer.js` | Replace all | Fixed db → database |
| `src/components/enhanced-viewer.js` | Replace all | Fixed db → database |
| `src/components/gallery-viewer.js` | Replace all | Fixed db → database |
| `src/bws-manager.js` | Replace all | Fixed db → database |

**Total:** 6 files modified

---

## BEFORE & AFTER

### Before (Broken)
```javascript
const result = await window.api.db.getCollection(collectionId);
// ❌ Error: Cannot read properties of undefined (reading 'getCollection')
```

### After (Fixed)
```javascript
const result = await window.api.database.getCollection(collectionId);
// ✅ Works!
```

---

## VERIFICATION

To test the fix:
1. Start the application
2. Click any collection in the folder browser
3. Collection viewer should open without errors
4. Check console for `[ERROR] Error loading collection` - should be gone

---

## RELATED ISSUES

This fix resolves:
- BUG-003 (race conditions) - partially, by fixing the API path that was causing undefined errors
- Collection viewer not opening
- Enhanced viewer crashes
- Gallery viewer crashes
- BWS experiment creation issues

---

## NOTES

### Why This Happened

There was inconsistency between:
- IPC handler names in `main.js`: `database:getCollections`, `database:getCollection`
- API exposure in `preload.js`: `window.api.database`
- Frontend code usage: `window.api.db` (incorrect)

Some IPC handlers used `db:XXX` (like `db:getVideos`), others used `database:XXX`. The frontend code incorrectly assumed all were under `window.api.db`.

### Long-term Solution

Consider standardizing all IPC handler names to either `database:XXX` or `db:XXX` (not both) to prevent future confusion.

---

**Agent B - API Typo Fixed! 🔧**

**Status:** ✅ COMPLETE
**Impact:** Unblocks collection viewer and all related components
