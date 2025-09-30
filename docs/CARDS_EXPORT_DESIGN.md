# CARDS Export Design for VR Collector

## Overview
This document outlines the design for exporting VR Collector data to CARDS 2.0 format for multimodal BWS rating experiments.

## Export Options

### 1. Full Video Export
Export complete videos as individual items for rating overall quality, content, or other holistic dimensions.

**Use Cases:**
- Overall video quality assessment
- Content appropriateness rating
- Educational value comparison
- Production quality evaluation

**Data Included:**
- Video file or thumbnail
- Title and description
- Channel information
- Engagement metrics
- Tags and categories

### 2. Segmented Export (Chunks)
Export video chunks based on transcription segments for fine-grained content analysis.

**Use Cases:**
- Information density comparison
- Clarity of explanation rating
- Topic coherence assessment
- Speaker effectiveness evaluation

**Data Included:**
- Video segment file
- Transcribed text
- Timing information
- Parent video context

### 3. Comments Export
Export high-quality comments for text-based rating tasks.

**Use Cases:**
- Comment quality assessment
- Sentiment analysis validation
- Helpfulness rating
- Toxicity evaluation

**Filtering Options:**
- Minimum like count
- Minimum text length
- Exclude replies
- Language filtering

### 4. Multimodal Mixed Export
Combine videos, segments, and comments for cross-media comparison studies.

**Use Cases:**
- Compare video content vs viewer interpretation
- Assess alignment between content and comments
- Multi-perspective quality evaluation

## Export Configuration

```javascript
{
  "export_type": "cards_v2",
  "options": {
    // Content Selection
    "include_videos": true,
    "include_chunks": true,
    "include_comments": true,
    "include_transcripts": true,
    
    // Video Options
    "video_export_mode": "thumbnail|clip|full",
    "max_video_duration": 30,
    "video_quality": "medium",
    
    // Chunk Options
    "chunk_selection": "all|sampled|top_coherence",
    "chunks_per_video": 5,
    "min_chunk_duration": 5,
    "max_chunk_duration": 30,
    
    // Comment Options
    "min_comment_likes": 10,
    "min_comment_length": 50,
    "max_comments_per_video": 10,
    "comment_sort": "likes|relevance|time",
    
    // CARDS Configuration
    "assessment_method": "bws",
    "dimensions": [
      {
        "id": "quality",
        "name": "Content Quality",
        "description": "Overall quality of the content"
      }
    ],
    "set_size": 4,
    "media_balance": "mixed",
    
    // Output Options
    "output_format": "standalone|supabase_ready",
    "include_media_files": true,
    "compress_media": true
  }
}
```

## Data Transformation Pipeline

### 1. Data Collection
```javascript
async function collectExportData(collectionId, options) {
  const videos = await db.getCollectionVideos(collectionId);
  const items = [];
  
  for (const video of videos) {
    // Add video as item
    if (options.include_videos) {
      items.push(transformVideoToItem(video));
    }
    
    // Add chunks as items
    if (options.include_chunks) {
      const chunks = await db.getVideoChunks(video.id);
      items.push(...transformChunksToItems(chunks, video));
    }
    
    // Add comments as items
    if (options.include_comments) {
      const comments = await db.getVideoComments(video.id);
      items.push(...transformCommentsToItems(comments, video));
    }
  }
  
  return items;
}
```

### 2. CARDS Structure Generation
```javascript
function generateCARDSStructure(items, collection, options) {
  return {
    cards_version: "2.0",
    
    project: {
      id: `vr_collector_${collection.id}`,
      title: collection.search_term,
      description: `YouTube collection: ${collection.search_term}`,
      created_by: "VR Collector",
      source_platform: "youtube"
    },
    
    metadata: {
      id: `collection_${collection.id}_export`,
      created: new Date().toISOString(),
      domain: "social_media",
      subdomain: "youtube",
      tags: ["youtube", "video", "multimodal"],
      media_summary: calculateMediaSummary(items),
      collection_settings: collection.settings
    },
    
    items: items,
    
    assessment_config: {
      method: options.assessment_method || "bws",
      dimensions: options.dimensions,
      bws_config: {
        set_size: options.set_size || 4,
        selection_type: "best_worst",
        media_balance: {
          strategy: options.media_balance || "mixed"
        }
      }
    },
    
    assessment_sets: generateAssessmentSets(items, options),
    
    quality_control: {
      gold_standard_sets: [],
      attention_checks: []
    }
  };
}
```

### 3. Media Handling
```javascript
async function prepareMediaFiles(items, outputPath) {
  const mediaPath = path.join(outputPath, 'media');
  
  for (const item of items) {
    if (item.media.type === 'video') {
      // Copy or compress video files
      await processVideoFile(item, mediaPath);
    } else if (item.media.type === 'image') {
      // Process thumbnails
      await processThumbnail(item, mediaPath);
    }
    
    // Update URLs to relative paths
    item.media.url = path.relative(outputPath, item.media.url);
  }
}
```

## Supabase Integration

### Direct Upload Flow
```javascript
async function uploadToSupabase(cardsData, options) {
  const supabase = createClient(options.supabaseUrl, options.supabaseKey);
  
  // 1. Upload media files to storage
  for (const item of cardsData.items) {
    if (item.media.type !== 'text') {
      const { data, error } = await supabase.storage
        .from('media')
        .upload(`${cardsData.project.id}/${item.id}`, item.media.file);
      
      item.file_url = data?.path;
    }
  }
  
  // 2. Insert items
  const { data: insertedItems } = await supabase
    .from('items')
    .insert(cardsData.items.map(transformToSupabaseItem))
    .select();
  
  // 3. Create assessment sets
  const { data: sets } = await supabase
    .from('assessment_sets')
    .insert(cardsData.assessment_sets)
    .select();
  
  return { items: insertedItems, sets };
}
```

## Usage Examples

### Example 1: Export Educational Video Chunks
```javascript
// Export 10-second chunks from educational videos
const exportOptions = {
  include_videos: false,
  include_chunks: true,
  include_comments: false,
  chunk_selection: "all",
  max_chunk_duration: 10,
  dimensions: [{
    id: "clarity",
    name: "Explanation Clarity",
    description: "How clearly is the concept explained?"
  }],
  set_size: 4
};
```

### Example 2: Comment Quality Assessment
```javascript
// Export high-engagement comments for quality rating
const exportOptions = {
  include_videos: false,
  include_chunks: false,
  include_comments: true,
  min_comment_likes: 50,
  min_comment_length: 100,
  dimensions: [{
    id: "helpfulness",
    name: "Comment Helpfulness",
    description: "How helpful is this comment?"
  }]
};
```

### Example 3: Multimodal Content Comparison
```javascript
// Mix videos, chunks, and comments for cross-media rating
const exportOptions = {
  include_videos: true,
  include_chunks: true,
  include_comments: true,
  video_export_mode: "thumbnail",
  chunks_per_video: 3,
  max_comments_per_video: 5,
  dimensions: [{
    id: "relevance",
    name: "Content Relevance",
    description: "How relevant is this content to the topic?"
  }],
  media_balance: "stratified"
};
```

## Export Workflow

1. **Configure Export**: User selects export type and options
2. **Preview Items**: Show sample of items to be exported
3. **Generate Sets**: Create balanced assessment sets
4. **Prepare Media**: Process and package media files
5. **Validate**: Ensure CARDS structure is valid
6. **Export Package**: Create .cards archive or upload to Supabase

## Future Enhancements

1. **Smart Filtering**
   - ML-based quality filtering
   - Duplicate detection
   - Content moderation

2. **Baseline Integration**
   - Add GPT-4 rankings
   - Include YouTube algorithm signals
   - Engagement-based baselines

3. **Advanced Chunking**
   - Scene-based segmentation
   - Topic-based splitting
   - Speaker diarization

4. **Rich Metadata**
   - Sentiment scores
   - Toxicity ratings
   - Topic modeling results

5. **Batch Processing**
   - Export multiple collections
   - Cross-collection studies
   - Longitudinal tracking