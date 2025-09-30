# Variable Resolution Data Collector - Complete Documentation

## Overview
The Variable Resolution (VR) Data Collector is an Electron-based desktop application designed for collecting YouTube data for research purposes. It integrates with the Variable Resolution BWS (Best-Worst Scaling) rating system and supports comprehensive data collection including videos, comments, transcriptions, and metadata.

## Features

### Core Functionality
1. **YouTube Data Collection**
   - Search YouTube videos by keywords
   - Collect video metadata (title, description, views, likes, etc.)
   - Download videos locally (via yt-dlp)
   - Collect comments with reply threads
   - Automatic speech-to-text transcription (via Whisper)
   - Batch processing with progress tracking

2. **Data Management**
   - SQLite database for persistent storage
   - Collection history with search and filter
   - Export/Import collections as JSON
   - Automatic file organization

3. **Tool Integration**
   - YouTube Data API v3
   - yt-dlp for video downloads
   - OpenAI Whisper for transcription
   - FFmpeg for media processing
   - pipx for Python package management

## Installation & Setup

### Prerequisites
- macOS, Windows, or Linux
- Node.js 16+ and npm
- Python 3.8+
- Homebrew (macOS)

### Initial Setup
```bash
# Clone repository
cd /Users/raymondli701/workspace_2025_09_29/vr-collector

# Install dependencies
npm install

# Start application
npm start
```

### Tool Installation
The app includes an automatic tool installer accessible via the "Install Missing Tools" button:

1. **yt-dlp**: Video downloader (installed via pipx)
2. **FFmpeg**: Media processor (installed via homebrew on macOS)
3. **Whisper**: Speech-to-text (installed via pipx)

On macOS with Python 3.13+, tools are installed in isolated environments using pipx to avoid system Python conflicts.

## File Structure
```
vr-collector/
├── main.js                    # Main Electron process
├── preload.js                # Preload script for IPC
├── index-advanced.html       # Main UI
├── package.json             # Dependencies
├── src/
│   ├── renderer-advanced.js  # UI logic
│   ├── database/
│   │   └── db.js           # SQLite database handler
│   ├── components/
│   │   └── tool-installer.js # Tool installation UI
│   ├── utils/
│   │   ├── tools-check.js   # Tool availability checker
│   │   └── paste-handler.js # Paste functionality
│   └── styles/
│       ├── main.css         # Main styles
│       ├── advanced.css     # Advanced UI styles
│       ├── status.css       # Status indicators
│       ├── tool-installer.css # Installer modal
│       └── collections.css  # Collections view
└── docs/
    ├── YOUTUBE_API_LIMITATIONS.md
    └── VR_COLLECTOR_DOCUMENTATION.md

# Data stored in:
~/Library/Application Support/vr-collector/
├── settings.json           # Encrypted API keys
├── collections.db         # SQLite database
└── videos/               # Downloaded videos
```

## Key Components

### 1. YouTube API Integration
- Real-time search with configurable parameters
- Pagination support
- Rate limiting to respect API quotas
- Default sort by relevance for videos and comments

### 2. Database Schema
```sql
-- Collections table
CREATE TABLE collections (
  id INTEGER PRIMARY KEY,
  search_term TEXT,
  created_at DATETIME,
  video_count INTEGER,
  comment_count INTEGER,
  settings TEXT,
  status TEXT
);

-- Videos table  
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  collection_id INTEGER,
  title, description, channel_id, channel_title,
  published_at, view_count, like_count, comment_count,
  duration, tags, thumbnails, local_path, transcription,
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- Comments table
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  collection_id INTEGER,
  author_channel_id, author_name, text,
  published_at, updated_at, like_count,
  reply_count, parent_id,
  FOREIGN KEY (video_id) REFERENCES videos(id)
);
```

### 3. Default Settings
- **Video Download**: Enabled (720p quality)
- **Transcription**: Enabled (Whisper base model)
- **Comments**: Enabled (100 per video, sorted by relevance)
- **Reply Threads**: Enabled
- **Text Processing**: Clean text (remove emojis/links)
- **Continue on Error**: Enabled

### 4. Security Features
- Encrypted API key storage
- Secure IPC communication
- Context isolation in renderer
- No external script execution

## User Interface

### Navigation
- **YouTube**: Search and collect data
  - Basic Search: Simple keyword search
  - Advanced Options: Filters for duration, quality, views, language
  - Data Extraction: Configure what data to collect
- **Collections**: View saved collections with export options
- **Export**: Export to CARDS format, CSV, or Supabase

### Header Actions
- **Open Folder**: Quick access to output directory
- **Settings**: API key configuration and storage settings
- **Install Tools**: One-click tool installation (when needed)

## API Configuration

### YouTube Data API v3
1. Get API key from [Google Cloud Console](https://console.cloud.google.com)
2. Enable YouTube Data API v3
3. Enter key in Settings → paste supported
4. Key is encrypted and stored locally

## Data Collection Process

### Search Phase
1. Enter search term (e.g., "ADHD")
2. Configure options (max videos, date range, sort order)
3. Click "Search YouTube"
4. Select videos from results

### Collection Phase
1. Click "Start Collection"
2. For each selected video:
   - Fetch metadata via API
   - Download video file (if enabled)
   - Collect comments (if enabled)
   - Transcribe audio (if enabled)
   - Save to database
3. Progress shown in real-time with logs

### Post-Collection
- View in Collections tab
- Export individual collections
- Open video folder to access files
- Videos play in VLC (if set as default)

## Advanced Features

### 1. Virtual Environment Management
- Automatic Python venv creation
- Isolated tool installations via pipx
- No system Python pollution

### 2. GPU Acceleration
- Auto-detects NVIDIA CUDA or Apple Metal
- Falls back to CPU for transcription
- Configurable device selection

### 3. Export/Import System
- **Export Format**: JSON with all metadata
- **Location**: Downloads folder
- **Import**: Preserves all data, marks as imported
- **Use Cases**: Backup, sharing, archival

### 4. Paste Functionality
- Special handling for API keys
- Whitespace trimming
- Works on password fields
- Multiple paste methods supported

## Platform-Specific Notes

### macOS (Apple Silicon)
- Homebrew installs to `/opt/homebrew`
- Uses pipx for Python tools
- Metal acceleration for Whisper
- Path handling for Electron

### Windows
- Standard pip installations
- CUDA support detection
- Different path separators

### Linux
- apt-based tool installation
- Standard Python paths
- CUDA support available

## Troubleshooting

### Common Issues

1. **"externally-managed-environment" error**
   - Solution: App now uses pipx automatically
   - Manual fix: `brew install pipx`

2. **FFmpeg not detected**
   - Solution: Restart app after installation
   - Manual fix: Add `/opt/homebrew/bin` to PATH

3. **Paste not working**
   - Solution: Use Edit menu → Paste
   - Or: Click paste button next to fields

4. **Collection hanging**
   - Check API quota limits
   - Verify internet connection
   - Check console for errors

### Debug Mode
```bash
npm run dev  # Starts with DevTools open
```

## Future Enhancements

### Planned Features
1. CARDS 2.0 export implementation
2. Supabase cloud sync
3. Advanced collection viewer
4. Batch operations
5. Collection merging
6. Search across collections
7. CSV export with analysis templates

### Architecture Improvements
1. Progress persistence
2. Resume interrupted collections
3. Parallel video processing
4. Streaming transcription
5. Incremental database backups

## Related Documentation
- [YouTube API Limitations](./YOUTUBE_API_LIMITATIONS.md)
- [CARDS Format Specification](../cards-format-spec.md)
- [Variable Resolution BWS](../vr-bws-docs.md)

## Version History
- v1.0.0: Initial release with core functionality
- Current: Added persistent storage, export/import, tool installer

---

*Last Updated: September 29, 2025*