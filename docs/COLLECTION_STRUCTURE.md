# VR Collector - Collection Structure Documentation

## Overview
The VR Collector organizes all collected data in a structured, timestamped folder hierarchy. Each collection is self-contained with its own folder, making it easy to manage, resume, and export data.

## Folder Structure

```
📁 userData/
└── 📁 collections/
    └── 📁 2025-09-30T07-45-23_nba/          # Timestamped collection folder
        ├── 📄 collection_manifest.json       # Collection state & metadata
        ├── 📄 collection_report.json         # Detailed collection report
        ├── 📄 collection_report.txt          # Human-readable report
        ├── 📁 videos/                        # Downloaded video files
        │   ├── 📹 videoId1.mp4
        │   └── 📹 videoId2.mp4
        ├── 📁 thumbnails/                    # Video thumbnails
        │   ├── 🖼️ videoId1_thumbnail.jpg
        │   └── 🖼️ videoId2_thumbnail.jpg
        ├── 📁 transcriptions/                # Whisper transcriptions
        │   ├── 📄 videoId1.json
        │   └── 📄 videoId1.txt
        ├── 📁 video_chunks/                  # Video segments (if enabled)
        │   └── 📁 videoId1/
        │       ├── 📹 chunk_0001.mp4         # "Hello everyone"
        │       ├── 📹 chunk_0002.mp4         # "Today we discuss"
        │       └── 📹 chunk_0003.mp4         # "First topic is..."
        ├── 📁 exports/                       # Export outputs
        │   └── 📁 export_2025-09-30T08-00-00/
        │       ├── 📄 videos.csv
        │       ├── 📄 comments.csv
        │       ├── 📄 transcription_segments.csv
        │       ├── 📄 video_chunks.csv
        │       └── 📄 full_export.json
        └── 📁 logs/                          # Collection logs
            └── 📄 collection.log
```

## Folder Naming Convention

### Collection Folders
Format: `{timestamp}_{searchTerm}`
- **Timestamp**: ISO 8601 format with colons/dots replaced by hyphens
- **Search Term**: Cleaned (alphanumeric + spaces, max 50 chars)
- Example: `2025-09-30T14-23-45_machine_learning_tutorials`

### Why Timestamps?
- Prevents overwrites
- Natural chronological ordering
- Easy to identify when collection occurred
- Supports multiple collections of same search term

## Key Files

### 1. Collection Manifest (`collection_manifest.json`)
The manifest is the heart of the checkpointing system. It tracks collection progress in real-time.

```json
{
  "jobId": "job_1234567890",
  "searchTerm": "nba highlights",
  "timestamp": "2025-09-30T07:45:23.123Z",
  "totalVideos": 10,
  "status": "in_progress",  // or "completed"
  "completed": ["videoId1", "videoId2", "videoId3"],
  "failed": [
    {
      "videoId": "videoId4",
      "error": "Download failed: 403 Forbidden",
      "timestamp": "2025-09-30T07:46:00.000Z"
    }
  ],
  "folders": {
    "root": "/path/to/collection",
    "videos": "/path/to/collection/videos",
    "thumbnails": "/path/to/collection/thumbnails",
    "transcriptions": "/path/to/collection/transcriptions",
    "chunks": "/path/to/collection/video_chunks",
    "exports": "/path/to/collection/exports",
    "logs": "/path/to/collection/logs"
  },
  "settings": {
    // All collection settings stored here
  },
  "completedAt": "2025-09-30T08:15:00.000Z",  // When collection finished
  "summary": {
    "totalVideos": 10,
    "successfulVideos": 8,
    "failedVideos": 2,
    "totalComments": 1523
  }
}
```

### 2. Collection Report (`collection_report.json`)
Comprehensive report of all settings used during collection:

```json
{
  "searchTerm": "nba highlights",
  "timestamp": "2025-09-30T07:45:23.123Z",
  "collectionFolder": "2025-09-30T07-45-23_nba_highlights",
  "searchSettings": {
    "maxResults": 50,
    "dateRange": "month",
    "orderBy": "relevance"
  },
  "extractionSettings": {
    "includeComments": true,
    "maxComments": 100,
    "includeReplies": true,
    "downloadVideo": true,
    "videoQuality": "480p",
    "enableTranscription": true,
    "enableVideoChunking": true,
    "whisperModel": "base"
  },
  "advancedFilters": {
    "videoDuration": "medium",
    "minViews": 1000,
    "minComments": 5
  }
}
```

### 3. Human-Readable Report (`collection_report.txt`)
A formatted text version of the collection report for easy reading.

## Video Chunking

When video chunking is enabled, videos are split into segments based on transcription timestamps:

```
📁 video_chunks/
└── 📁 videoId1/
    ├── 📹 chunk_0001.mp4  # 0:00-0:15 "Hello everyone, welcome"
    ├── 📹 chunk_0002.mp4  # 0:15-0:32 "Today we'll discuss"
    └── 📹 chunk_0003.mp4  # 0:32-0:45 "First topic is..."
```

Each chunk corresponds to a transcription segment, making it perfect for:
- Embedding generation
- Topic modeling
- Granular analysis
- BWS rating of specific segments

## Resume Capability

### How It Works
1. The manifest is updated after EACH video is processed
2. If collection is interrupted, the manifest shows current state
3. Resume skips completed videos and retries failed ones

### Resuming a Collection
```javascript
// Check for incomplete collections
const result = await api.collections.checkIncomplete();
// Returns list of collections with status: "in_progress"

// Resume specific collection
const resumeResult = await api.collections.resume({
  manifestPath: '/path/to/collection_manifest.json',
  videos: originalVideoList  // Needed to filter remaining
});
```

### Benefits
- Never lose progress
- Retry failed downloads
- Continue after crashes/restarts
- Handle API quota limits gracefully

## Export Organization

Exports are saved within the collection folder:

```
📁 exports/
├── 📁 export_2025-09-30T08-00-00/
│   ├── 📄 videos.csv                    # Video metadata
│   ├── 📄 comments.csv                  # All comments
│   ├── 📄 transcription_segments.csv    # Time-coded transcript chunks
│   ├── 📄 video_chunks.csv              # Video chunk metadata
│   ├── 📄 collection_info.csv           # Collection summary
│   ├── 📄 transcriptions.txt            # Readable transcriptions
│   └── 📄 full_export.json              # Complete data dump
└── 📁 export_2025-09-30T09-30-00/      # Another export
```

Each export is timestamped, allowing multiple exports without overwrites.

## Database Integration

The database stores collection metadata including the folder structure:

```sql
-- collections table
{
  id: 1,
  search_term: "nba highlights",
  settings: {
    collectionFolder: "2025-09-30T07-45-23_nba_highlights",
    collectionPath: "/full/path/to/collection",
    folders: {
      root: "...",
      videos: "...",
      // etc
    }
  }
}
```

## Best Practices

### 1. Storage Management
- Video chunks can use significant space (2-3x original video size)
- Consider enabling chunking only when needed
- Regularly clean old collections

### 2. Resuming Collections
- Always check manifest status before resuming
- Failed videos can be retried by resuming
- The manifest preserves all original settings

### 3. Exports
- Exports within collection folder for easy access
- Multiple export formats for different use cases
- Timestamped exports prevent overwrites

### 4. Finding Collections
Collections are organized chronologically:
```
collections/
├── 2025-09-29T14-00-00_topic_modeling/
├── 2025-09-30T07-45-23_nba_highlights/
└── 2025-09-30T10-15-00_machine_learning/
```

## Troubleshooting

### Collection Not Resuming?
1. Check if `collection_manifest.json` exists
2. Verify status is "in_progress"
3. Ensure video list matches original

### Missing Files?
- Check the manifest for folder locations
- Verify disk space during collection
- Check logs folder for errors

### Export Issues?
- Exports go to collection's export folder
- Each export creates new timestamped subfolder
- Check collection settings for folder paths

## Future Enhancements
- Automatic resume on app restart
- Collection migration tools
- Compression options for chunks
- Cloud backup integration