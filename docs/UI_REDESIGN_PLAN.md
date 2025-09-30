# VR Data Collector - UI Redesign & Enhancement Plan

## Current State
The app currently has:
- 3 separate tabs for YouTube settings (Basic, Advanced, Data Extraction)
- Basic collection viewer with side-by-side videos/comments
- No video playback capability
- Limited YouTube integration

## Proposed Improvements

### 1. Enhanced Collection Viewer
Transform the collection viewer into a YouTube-like experience:

#### Video Player Integration
- **Embedded Video Player**: Use HTML5 video element to play downloaded videos
- **Player Controls**: Play/pause, seek, volume, fullscreen
- **Playback Options**: Speed control, quality selection
- **Fallback**: If video not downloaded, show thumbnail with "Play on YouTube" button

#### YouTube-Style Layout
```
┌─────────────────────────────────────────┐
│  Video Player / Thumbnail               │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │         Video Playback           │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Title, Views, Likes                   │
│  Channel • Published Date               │
│  [Play on YouTube] [Download] [Share]  │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Comments (1,234)        Sort: [▼]     │
│  ┌───────────────────────────────────┐  │
│  │  Scrollable Comments Area         │  │
│  │  • Comment 1                      │  │
│  │    └─ Reply 1                     │  │
│  │    └─ Reply 2                     │  │
│  │  • Comment 2                      │  │
│  │  • Comment 3                      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Features to Add:
1. **Video Playback**
   - Direct playback of downloaded videos
   - Thumbnail preview if not downloaded
   - Link to YouTube source

2. **Enhanced Comments**
   - Nested reply threads (collapsible)
   - Load more pagination
   - Comment highlighting on search
   - Show commenter's channel link
   - Timestamp parsing (e.g., "2:34" links to video time)

3. **Action Buttons**
   - "Open in YouTube" - Direct link to video
   - "Download Video" - If not already downloaded
   - "Export Comments" - CSV of this video's comments
   - "Copy Link" - Copy YouTube URL

### 2. Single-Page YouTube Search UI

Combine all three tabs into one streamlined interface:

```
YouTube Data Collection
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Search ────────────────────────────────
│ Search Term: [_______________] 🔍    │
│ Max Videos: [50] Date: [This Month▼] │
│ Sort: [Relevance▼]                   │
└──────────────────────────────────────┘

Filters (collapsible) ─────────────────
│ ▼ Video Filters                      │
│   Duration: [Any▼] Quality: [Any▼]   │
│   Views: [____] to [____]            │
│   Language: [English▼]               │
│                                      │
│ ▼ Data Collection                    │
│   ☑ Download Videos (720p)           │
│   ☑ Extract Comments (100/video)     │
│   ☑ Include Replies                  │
│   ☑ Transcribe Audio (Whisper)       │
└──────────────────────────────────────┘

[Search YouTube]
```

Benefits:
- All options visible at once
- Smart defaults pre-selected
- Collapsible sections for advanced users
- Faster workflow

### 3. Implementation Details

#### Video Player Component
```javascript
// New video-player.js component
class VideoPlayer {
  constructor(videoPath, youtubeUrl) {
    this.videoPath = videoPath;
    this.youtubeUrl = youtubeUrl;
  }
  
  render() {
    if (this.videoPath && fs.existsSync(this.videoPath)) {
      return `<video controls src="${this.videoPath}"></video>`;
    } else {
      return `<div class="video-placeholder">
        <img src="${thumbnail}" />
        <button onclick="window.open('${this.youtubeUrl}')">
          Play on YouTube
        </button>
      </div>`;
    }
  }
}
```

#### Comment Thread Component
```javascript
// Nested comment display with replies
class CommentThread {
  renderComment(comment, replies = []) {
    return `
      <div class="comment-thread">
        <div class="comment-main">
          <div class="comment-author">${comment.author}</div>
          <div class="comment-text">${this.parseTimestamps(comment.text)}</div>
          <div class="comment-actions">
            <span>👍 ${comment.likes}</span>
            <button onclick="toggleReplies('${comment.id}')">
              ${replies.length} replies ▼
            </button>
          </div>
        </div>
        <div class="comment-replies" id="replies-${comment.id}">
          ${replies.map(r => this.renderReply(r)).join('')}
        </div>
      </div>
    `;
  }
  
  parseTimestamps(text) {
    // Convert "2:34" to clickable video timestamps
    return text.replace(/(\d+:\d+)/g, '<a href="#" onclick="seekTo(\'$1\')">$1</a>');
  }
}
```

#### Single Page Layout
```javascript
// Combine all options into one view
function renderSearchOptions() {
  return {
    basic: {
      searchTerm: true,
      maxResults: true,
      dateRange: true,
      orderBy: true
    },
    filters: {
      collapsed: true,
      videoDuration: true,
      videoQuality: true,
      viewRange: true,
      language: true
    },
    collection: {
      collapsed: false,
      downloadVideo: { default: true },
      extractComments: { default: true },
      includeReplies: { default: true },
      enableTranscription: { default: true }
    }
  };
}
```

### 4. Database Schema Updates

Add fields to support enhanced features:
```sql
-- Add to videos table
ALTER TABLE videos ADD COLUMN youtube_url TEXT;
ALTER TABLE videos ADD COLUMN thumbnail_local_path TEXT;

-- Add to comments table  
ALTER TABLE comments ADD COLUMN timestamp_refs TEXT; -- JSON array of timestamps
ALTER TABLE comments ADD COLUMN author_channel_url TEXT;
```

### 5. Technical Considerations

#### Video Playback
- Use Electron's `<video>` tag with local file:// URLs
- Support formats: MP4, WebM
- Implement custom controls for consistency

#### Performance
- Lazy load comments (show 50, load more on scroll)
- Virtual scrolling for large comment lists
- Cache rendered comment HTML

#### Security
- Sanitize all user content (comments, titles)
- Validate video file paths
- Restrict file:// access to app directories only

### 6. Migration Path

1. **Phase 1**: Single-page search UI
   - Combine three tabs into one
   - Maintain all existing functionality
   - Add collapsible sections

2. **Phase 2**: Enhanced viewer
   - Add video playback
   - Implement YouTube-style layout
   - Add comment threads

3. **Phase 3**: Polish
   - Keyboard shortcuts (space=play/pause)
   - Comment permalinks
   - Export improvements

## Benefits

1. **Better UX**: YouTube-familiar interface
2. **Faster Workflow**: Everything on one page
3. **Richer Features**: Video playback, nested comments
4. **More Useful**: Can actually watch and analyze content in-app

## Next Steps

1. Implement single-page search UI
2. Add video player component
3. Enhance comment viewer with threads
4. Add YouTube integration buttons
5. Test with real collections

---

This redesign will transform the VR Data Collector from a data extraction tool into a comprehensive YouTube research platform.