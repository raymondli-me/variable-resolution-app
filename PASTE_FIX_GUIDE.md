# Paste Support Guide for VR Collector

## The paste functionality is now fully enabled!

### What's Been Fixed:

1. **Edit Menu Added**
   - Cut, Copy, Paste menu items
   - Standard keyboard shortcuts work:
     - **Cmd+V** (macOS) / **Ctrl+V** (Windows/Linux) - Paste
     - **Cmd+C** / **Ctrl+C** - Copy
     - **Cmd+X** / **Ctrl+X** - Cut
     - **Cmd+A** / **Ctrl+A** - Select All

2. **API Key Fields Enhanced**
   - Removed any paste restrictions
   - Added "📋 Paste" buttons next to API key fields
   - Auto-trims whitespace from pasted keys
   - Visual feedback when pasting

3. **Right-Click Context Menu**
   - Right-click in any input field
   - Shows Cut/Copy/Paste options
   - Works in all text fields

### How to Use:

#### Method 1: Keyboard Shortcuts
```
1. Copy your API key from Google Console
2. Click in the API key field
3. Press Cmd+V (Mac) or Ctrl+V (Windows/Linux)
```

#### Method 2: Paste Button
```
1. Copy your API key
2. Click the "📋 Paste" button next to the API key field
3. Button shows "✓ Pasted" confirmation
```

#### Method 3: Right-Click Menu
```
1. Copy your API key
2. Right-click in the API key field
3. Select "Paste" from context menu
```

#### Method 4: Edit Menu
```
1. Copy your API key
2. Click in the API key field
3. Go to Edit menu → Paste
```

### Specific Fields with Enhanced Paste:

- ✅ **YouTube API Key** - Password field with paste button
- ✅ **Supabase URL** - Standard text field
- ✅ **Supabase Key** - Password field with paste button
- ✅ **Search Term** - Standard text field
- ✅ **All Other Inputs** - Full paste support

### Troubleshooting:

**If paste doesn't work:**

1. **Check Clipboard Permissions**
   - macOS: System Preferences → Security & Privacy → Privacy → Allow
   - Some browsers block clipboard access

2. **Try Different Methods**
   - If button fails, use Cmd+V
   - If keyboard fails, use right-click menu
   - If all fail, type manually

3. **API Key Format**
   - Ensure no extra spaces or newlines
   - The app auto-trims whitespace
   - Should be one continuous string

### Security Note:

While we've enabled paste for convenience, API keys are still:
- Stored securely (encrypted locally)
- Never sent to external servers
- Only used for YouTube API calls

### Testing Your API Key:

1. Paste your API key
2. Click "Test API Key" button
3. Should show "✅ Valid" if working
4. If invalid, check:
   - YouTube Data API v3 is enabled
   - Key has no restrictions
   - Copied correctly (no extra characters)

The app now handles paste operations gracefully across all platforms!