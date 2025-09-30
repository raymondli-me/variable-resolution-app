# Resume & Recovery Guide

This guide explains how to resume interrupted collections and recover from failures in VR Collector.

## Understanding Collection State

Every collection creates a `collection_manifest.json` file that tracks:
- Which videos have been successfully collected
- Which videos failed (with error messages)
- Current collection status
- All settings used

## Automatic Checkpointing

The manifest is updated after EACH video is processed:
1. ✅ Video downloaded → Added to `completed` array
2. ❌ Video failed → Added to `failed` array with error
3. 💾 Manifest saved to disk immediately

This means you NEVER lose more than one video's worth of progress.

## Finding Incomplete Collections

### Method 1: Check App Data Folder
```
userData/collections/
├── 2025-09-30T07-45-23_nba/
│   └── collection_manifest.json  ← Check "status" field
└── 2025-09-30T08-00-00_cooking/
    └── collection_manifest.json
```

Look for collections where `"status": "in_progress"`

### Method 2: Use the API (for developers)
```javascript
// Check for incomplete collections
const result = await window.api.collections.checkIncomplete();

// Example response:
{
  success: true,
  incomplete: [
    {
      folder: "2025-09-30T07-45-23_nba",
      folderPath: "/path/to/collection",
      manifest: { /* full manifest */ },
      remainingVideos: 3,
      failedCount: 1
    }
  ]
}
```

## Resuming a Collection

### What Gets Resumed?
- ✅ Skips already downloaded videos
- 🔄 Retries failed videos
- ▶️ Continues with remaining videos
- 📁 Uses the SAME folder structure

### How to Resume

1. **Find the manifest path**:
   ```
   /userData/collections/2025-09-30T07-45-23_nba/collection_manifest.json
   ```

2. **Call the resume handler**:
   ```javascript
   const result = await window.api.collections.resume({
     manifestPath: '/path/to/collection_manifest.json',
     videos: originalVideoList  // The original search results
   });
   ```

3. **Collection continues** exactly where it left off!

## Common Scenarios

### Scenario 1: App Crashed
```json
// Manifest shows:
{
  "status": "in_progress",
  "totalVideos": 10,
  "completed": ["video1", "video2", "video3"],
  "failed": []
}
```
**Resume**: Will continue from video 4

### Scenario 2: Network Issues
```json
{
  "status": "in_progress",
  "totalVideos": 10,
  "completed": ["video1", "video2"],
  "failed": [{
    "videoId": "video3",
    "error": "Network timeout",
    "timestamp": "2025-09-30T08:00:00Z"
  }]
}
```
**Resume**: Will retry video 3, then continue with video 4

### Scenario 3: API Quota Exceeded
```json
{
  "status": "in_progress",
  "failed": [{
    "videoId": "video5",
    "error": "YouTube API quota exceeded",
    "timestamp": "2025-09-30T08:00:00Z"
  }]
}
```
**Resume**: Wait for quota reset, then resume from video 5

## Manual Recovery

If the app can't resume automatically, you can:

1. **Check the manifest** to see what was completed
2. **Verify downloaded files** in the videos folder
3. **Create a new collection** with only the missing videos
4. **Merge data later** using the export/import features

## Best Practices

### 1. Check Before Starting Large Collections
- Ensure stable internet connection
- Verify sufficient disk space
- Check API quota status

### 2. Monitor Progress
- Watch the collection log
- Check manifest periodically
- Note any failed videos

### 3. Handle Failures
- Failed videos are tracked with error messages
- Resume will retry them automatically
- Some failures may be permanent (deleted videos, etc.)

### 4. Backup Important Collections
- Export completed portions before resuming
- Keep manifest backups
- Consider copying the entire collection folder

## Troubleshooting

### "No videos left to collect"
- All videos are either completed or permanently failed
- Check the failed array for unrecoverable errors

### Resume Not Working?
1. Verify manifest file exists and is valid JSON
2. Ensure video list matches original search
3. Check folder permissions
4. Look for error messages in logs

### Partial Downloads
- Check video file sizes in the videos folder
- Incomplete downloads will be re-downloaded on resume
- Delete partial files if corrupted

## Advanced: Manual Manifest Editing

⚠️ **Caution**: Only edit if you understand the structure

You can manually edit the manifest to:
- Remove videos from the failed list to retry them
- Mark videos as completed to skip them
- Change the status to force completion

Example: Force retry of a failed video
```json
// Before:
"failed": [{"videoId": "abc123", "error": "Timeout"}],
"completed": ["video1", "video2"]

// After (move to neither list to retry):
"failed": [],
"completed": ["video1", "video2"]
```

## Future Improvements

Planned enhancements:
- Auto-resume on app restart
- Retry failed videos with exponential backoff
- UI for managing incomplete collections
- Scheduled resume for quota issues