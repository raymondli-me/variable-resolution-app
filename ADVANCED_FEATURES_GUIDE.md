# VR Data Collector - Advanced Features Guide

## Quick Start

1. **Install and Launch:**
```bash
cd /Users/raymondli701/workspace_2025_09_29/vr-collector
npm start
```

2. **Set up API Key:**
- Click the Settings gear icon
- Enter your YouTube Data API v3 key
- Click "Test API Key" to verify
- Save settings

## Advanced Features Overview

### 1. Basic Search Tab
- **Search Term**: Your keywords (e.g., "ADHD", "mental health")
- **Max Videos**: Up to 500 videos per search
- **Date Range**: Filter by upload date
- **Order By**: Sort results by relevance, views, date, or rating

### 2. Advanced Options Tab

#### Video Filters
- **Video Duration**: Short (<4min), Medium (4-20min), Long (>20min)
- **Video Quality**: HD only or any quality
- **View Count Range**: Set minimum and maximum views
- **Language**: Filter by video language
- **Channel Type**: Regular channels, TV shows, or movies
- **Embeddable**: Only videos that can be embedded
- **Syndicated**: Videos playable outside YouTube

#### API Configuration
- **API Quota Limit**: Stop when reaching unit limit (default: 1000)
- **Rate Limit Delay**: Milliseconds between requests (default: 500ms)

### 3. Data Extraction Tab

#### Video Metadata Options
- ✓ **Title**: Video title
- ✓ **Full Description**: Complete video description
- ✓ **Tags**: All video tags
- ✓ **Thumbnails**: All resolution thumbnails
- ✓ **Closed Captions**: Subtitle tracks (if available)
- ✓ **Statistics**: Views, likes, dislikes, favorites
- ✓ **Publish Date**: Upload date and time

#### Channel Information
- ✓ **Channel Name**: Channel title
- ✓ **Channel ID**: Unique channel identifier
- ✓ **Channel Statistics**: Subscriber count, video count
- ✓ **Channel Description**: About section

#### Comment Settings
- **Extract Comments**: Toggle comment collection
- **Max Comments per Video**: Up to 10,000
- **Sort Order**: Relevance or newest first
- **Min Comment Likes**: Filter by popularity
- **Include Reply Threads**: Get nested replies
- **Comment Metadata**: Author info, timestamps

#### Video Download Options
- **Download Video Files**: Save videos locally
- **Quality**: 360p to 1080p or highest/lowest
- **Format**: MP4, WebM, or best available
- **Max File Size**: Skip large files
- **Audio Only**: Extract just audio track
- **Download Thumbnail**: Save thumbnail image

#### Processing Options
- **Text Processing**: Clean text or sentiment analysis
- **Skip Duplicates**: Avoid re-collecting videos
- **Continue on Errors**: Don't stop for failures

## Presets

### Built-in Presets
1. **Minimal**: Just titles and channel names
2. **Metadata Only**: All metadata, no downloads
3. **Full Collection**: Everything except video files
4. **Research Grade**: Complete data with downloads

### Custom Presets
- Configure your settings
- Click "Save as Preset"
- Name your preset
- Load anytime from dropdown

## API Usage Guide

### YouTube API Units Cost
- Search: 100 units
- Video details: 1 unit per video
- Comments: 1 unit per page (up to 100 comments)
- Channel details: 1 unit

### Example Calculations
- 50 video search with metadata: ~150 units
- + 100 comments each: +50 units
- + Channel stats: +50 units
- **Total**: ~250 units

### Daily Quota
- Default: 10,000 units/day
- Typical collection: 200-500 units
- Can collect ~20-50 full datasets daily

## Collection Process

### Before Starting
1. Set API key in Settings
2. Choose output directory
3. Configure extraction options
4. Select appropriate preset

### During Collection
- Monitor progress in real-time
- Track API units usage
- View time estimates
- Check collection log

### After Collection
- Export to CARDS format
- Export to CSV for analysis
- Upload to Supabase
- View in Collections tab

## Best Practices

### For Research Studies
1. Use "Research Grade" preset
2. Enable all metadata extraction
3. Set high comment limits (500+)
4. Download thumbnails for reference
5. Enable text cleaning

### For Quick Analysis
1. Use "Metadata Only" preset
2. Disable video downloads
3. Limit comments to 100
4. Focus on recent videos

### For Large Collections
1. Set API quota limits
2. Enable "Continue on Errors"
3. Use rate limiting (1000ms+)
4. Monitor disk space
5. Run overnight

## Troubleshooting

### "API Key Invalid"
- Verify key in Google Cloud Console
- Ensure YouTube Data API v3 is enabled
- Check for typos or spaces

### "Rate Limit Exceeded"
- Increase rate limit delay to 2000ms
- Reduce concurrent operations
- Wait for quota reset (midnight PT)

### "Collection Stopped"
- Check API quota limit setting
- Verify disk space available
- Look for errors in log

### "Missing Data"
- Some videos may have disabled features
- Comments might be turned off
- Channel might be terminated

## Data Storage

### File Organization
```
output_directory/
├── collections.db          # All metadata
├── videos/
│   ├── [video-id].mp4     # Video files
│   └── [video-id].jpg     # Thumbnails
├── exports/
│   ├── collection_1.json  # CARDS format
│   └── collection_1.csv   # CSV export
└── logs/
    └── collection.log     # Detailed logs
```

### Database Contents
- Video metadata
- Channel information
- Comments with threading
- Collection parameters
- Timestamps and relations

## Advanced Tips

### Filtering Results
Use bulk actions to quickly select:
- HD videos only
- Popular videos (>100k views)
- Recent uploads (<1 month)

### Custom Workflows
1. Search broadly
2. Filter by quality metrics
3. Review selections
4. Apply custom extraction
5. Export for specific use

### Performance Optimization
- Close other apps during collection
- Use wired internet connection
- Limit concurrent downloads
- Clear cache periodically

## Security & Privacy

### API Key Safety
- Never share your API key
- Stored encrypted locally
- Not sent to any servers
- Regenerate if compromised

### Data Privacy
- All data stored locally
- No analytics or tracking
- You control all exports
- Delete anytime

## Support

For issues or questions:
- Check the collection log
- Review API quotas
- Verify all settings
- Test with small batches first