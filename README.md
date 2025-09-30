# VR Data Collector

Offline desktop application for collecting YouTube data (videos, metadata, and comments) for Variable Resolution BWS rating studies.

## Features

- 🎥 **YouTube Data Collection**
  - Search by keywords with advanced filters
  - Collect video metadata (views, likes, duration, etc.)
  - Collect comments with reply threads
  - Optional video downloading (multiple quality options)
  - Automatic transcription using Whisper
  - Video chunking based on transcription segments
  - Batch processing support

- 💾 **Local Storage & Organization**
  - SQLite database for all collected data
  - Organized folder structure (timestamped collections)
  - Checkpointing & resume capability
  - No cloud dependencies
  - Export to multiple formats (CSV, JSON, CARDS)
  - Export to Supabase (optional)

- 🖥️ **Cross-Platform**
  - Works on Linux (primary)
  - Works on macOS
  - Windows support available

- 🔒 **Privacy Focused**
  - All data stored locally
  - API keys encrypted
  - No telemetry

## Installation

### From Source

1. Clone the repository:
```bash
git clone <repository-url>
cd vr-collector
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run dev
```

### Building Executables

Build for your platform:

```bash
# Linux
npm run build-linux

# macOS
npm run build-mac

# All platforms
npm run build-all
```

Built applications will be in the `dist` folder.

## Usage

### 1. Initial Setup

1. Launch the application
2. Click Settings (gear icon)
3. Enter your YouTube Data API v3 key
4. Choose output directory for downloads
5. (Optional) Add Supabase credentials

### 2. Collecting YouTube Data

1. Go to YouTube tab
2. Enter search term (e.g., "ADHD")
3. Configure collection options:
   - Max videos to collect
   - Date range filter
   - Include comments (yes/no)
   - Download videos (optional)
4. Click "Search YouTube"
5. Select videos from results
6. Click "Start Collection"

### 3. Managing Collections

- View saved collections in Collections tab
- Export to CARDS format for BWS rating
- Export to Supabase for online rating

## System Requirements

- **OS**: Linux (Ubuntu 18.04+), macOS 10.13+, Windows 10+
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: Depends on video downloads
  - Metadata only: ~1MB per 100 videos
  - With videos: ~50-200MB per video

## Resource Usage

### CPU
- Search: Minimal
- Comment collection: Low (API calls)
- Video download: Moderate (encoding)

### Memory
- Base: ~200MB
- Active collection: ~500MB
- Large datasets: Up to 2GB

### Network
- API calls: Minimal bandwidth
- Video downloads: Depends on quality

## API Quotas

YouTube Data API v3:
- Default: 10,000 units/day
- Search: 100 units
- Video details: 1 unit
- Comments: 1 unit per page

Typical usage:
- 50 video search + metadata + comments ≈ 300 units

## Data Storage

### Database Schema

```
collections/
├── id (unique identifier)
├── search_term
├── parameters
└── created_at

videos/
├── id (YouTube video ID)
├── collection_id
├── title, description
├── channel info
├── statistics
└── local_path (if downloaded)

comments/
├── id (YouTube comment ID)
├── video_id
├── author info
├── text
├── like_count
└── timestamps
```

### File Organization

```
~/VR-Collections/
├── database.db
├── videos/
│   ├── [video-id-1].mp4
│   └── [video-id-2].mp4
└── exports/
    ├── collection_1.json
    └── collection_2.cards
```

## Export Formats

### CARDS 2.0 Format

```json
{
  "cards_version": "2.0",
  "project": {
    "id": "youtube_adhd_2024",
    "source": "YouTube",
    "search_term": "ADHD"
  },
  "items": [
    {
      "id": "yt_video_123",
      "content": "Video title or description",
      "media": {
        "type": "text|video",
        "source_url": "https://youtube.com/watch?v=..."
      }
    }
  ]
}
```

## Troubleshooting

### "API key invalid"
- Check key in Google Cloud Console
- Ensure YouTube Data API v3 is enabled

### "Rate limit exceeded"
- Wait until quota resets (daily)
- Reduce batch size

### "Download failed"
- Check internet connection
- Try lower video quality
- Ensure sufficient disk space

## Security

- API keys stored encrypted locally
- No external analytics
- All data remains on your machine
- Open source for transparency

## Development

### Tech Stack
- Electron (desktop framework)
- SQLite (local database)
- Node.js (runtime)
- YouTube API (data source)

### Project Structure
```
vr-collector/
├── main.js           # Main process
├── preload.js        # Security bridge
├── src/
│   ├── collectors/   # Data collectors
│   ├── database/     # Database management
│   ├── export/       # Export formats
│   └── renderer.js   # UI logic
└── index.html        # UI
```

## License

MIT License - See LICENSE file

## Contributing

1. Fork the repository
2. Create feature branch
3. Test on Linux and macOS
4. Submit pull request

## Documentation

- [Collection Structure Guide](docs/COLLECTION_STRUCTURE.md) - How data is organized
- [Resume & Recovery Guide](docs/RESUME_GUIDE.md) - Handling interrupted collections
- [API Documentation](docs/API.md) - Developer reference
- [User Guide](docs/USER_GUIDE.md) - Getting started

## Support

- GitHub Issues for bugs
- Discussions for features
- Wiki for documentation