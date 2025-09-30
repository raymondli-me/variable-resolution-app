# YouTube API v3 Limitations & Why We Use yt-dlp

## YouTube Data API v3 Capabilities

### ✅ What It CAN Do:
1. **Search & Discovery**
   - Search videos by keywords
   - Filter by date, duration, quality
   - Sort by relevance, views, date

2. **Metadata Retrieval**
   - Video title, description
   - View count, like count
   - Upload date, duration
   - Channel information
   - Tags and categories

3. **Comments Access**
   - Top-level comments
   - Reply threads
   - Comment authors
   - Like counts on comments

4. **Thumbnails**
   - URLs to thumbnail images
   - Multiple resolutions
   - Can download these separately

### ❌ What It CANNOT Do:
1. **Video Content**
   - Cannot download video files
   - Cannot stream video content
   - No access to video binary data

2. **Audio Content**
   - Cannot extract audio
   - No audio-only downloads
   - No access to audio streams

3. **Subtitles/Captions**
   - Can list available captions
   - Cannot download caption content
   - No access to transcript text

4. **Advanced Features**
   - No chapter information
   - No sponsor block data
   - No quality selection for downloads

## Why yt-dlp is Necessary

### Video Downloads
```python
# YouTube API v3 - NOT POSSIBLE
youtube_api.download_video(video_id)  # ❌ No such method exists

# yt-dlp - WORKS
yt-dlp "https://youtube.com/watch?v=VIDEO_ID"  # ✅ Downloads video
```

### Comparison Table

| Feature | YouTube API v3 | yt-dlp |
|---------|---------------|---------|
| Search videos | ✅ Yes | ✅ Yes |
| Get metadata | ✅ Yes | ✅ Yes |
| Download videos | ❌ No | ✅ Yes |
| Extract audio | ❌ No | ✅ Yes |
| Get subtitles | ❌ List only | ✅ Full content |
| Quality selection | ❌ No | ✅ Yes |
| Resume downloads | ❌ No | ✅ Yes |
| Bypass restrictions | ❌ No | ✅ Yes |
| No API key needed | ❌ No | ✅ Yes |
| Rate limits | ✅ 10k units/day | ✅ None |

## VR Collector's Hybrid Approach

### 1. **API-Only Mode** (When yt-dlp not installed)
```javascript
// Can still collect:
- Video metadata ✅
- Comments ✅
- Channel info ✅
- Thumbnail URLs ✅

// Cannot collect:
- Video files ❌
- Audio files ❌
- Subtitles content ❌
- Transcriptions ❌
```

### 2. **Enhanced Mode** (With yt-dlp)
```javascript
// Everything above PLUS:
- Video downloads ✅
- Audio extraction ✅
- Subtitle downloads ✅
- Multiple quality options ✅
- Resume interrupted downloads ✅
```

### 3. **Full Mode** (With yt-dlp + Whisper)
```javascript
// Everything above PLUS:
- Automatic transcription ✅
- Time-aligned captions ✅
- Multi-language support ✅
- GPU acceleration ✅
```

## Legal & Ethical Considerations

### YouTube API Terms of Service
- Must display YouTube branding
- Cannot download videos
- Must respect rate limits
- Requires API key

### yt-dlp Usage
- Respects robots.txt
- Handles rate limiting
- Works with cookies for auth
- Supports age-gate bypass

### Best Practices
1. **Respect Copyright**
   - Only download content you have rights to
   - Follow fair use guidelines
   - Credit original creators

2. **Rate Limiting**
   - Don't overwhelm servers
   - Use delays between requests
   - Respect 429 errors

3. **Research Ethics**
   - Get IRB approval if needed
   - Anonymize user data
   - Follow data retention policies

## Implementation in VR Collector

### Detection Code
```javascript
// Check what's available
const capabilities = {
  youtubeApi: true,  // Always available with API key
  ytDlp: await checkCommand('yt-dlp --version'),
  ffmpeg: await checkCommand('ffmpeg -version'),
  whisper: await checkCommand('whisper --help')
};

// Adapt functionality
if (capabilities.ytDlp) {
  // Enable video download options
  enableVideoDownloads();
} else {
  // Show message explaining limitations
  showNotification('Video downloads require yt-dlp installation');
}
```

### Fallback Chain
1. Try yt-dlp first (best option)
2. Fall back to youtube-dl (older but works)
3. Fall back to API-only mode (metadata only)

### User Messaging
```
✅ "Using yt-dlp for enhanced downloads"
⚠️  "yt-dlp not found - downloads disabled"
ℹ️  "Install yt-dlp for video downloads: pip install yt-dlp"
```

## Summary

The YouTube API v3 is great for metadata but **cannot download videos**. This is why tools like yt-dlp exist and why VR Collector uses a hybrid approach:

- **Always available**: Search, metadata, comments
- **With yt-dlp**: Video/audio downloads
- **With Whisper**: Transcription
- **Graceful degradation**: Works with whatever you have installed