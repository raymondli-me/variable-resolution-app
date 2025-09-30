# CARDS Filtering and Multi-Stage Design

## The Problem

YouTube data contains massive quality variance:
- **Comments**: "first!", "❤️", spam, vs actual insights
- **Video chunks**: silence, transitions, "please subscribe" vs actual content
- **Metadata noise**: misleading titles, clickbait thumbnails

## Proposed Solution: Multi-Stage CARDS Pipeline

### Stage 1: Raw Export (CARDS-Raw)
Export everything with quality signals but no filtering:

```javascript
{
  "cards_version": "2.0-raw",
  "stage": "unfiltered",
  "items": [
    {
      "id": "comment_123",
      "content": "This is the best explanation I've seen",
      "quality_signals": {
        "length": 42,
        "likes": 156,
        "has_punctuation": true,
        "sentiment_score": 0.92,
        "spam_score": 0.02,
        "relevance_score": 0.88
      }
    },
    {
      "id": "comment_456",
      "content": "first!!!",
      "quality_signals": {
        "length": 8,
        "likes": 0,
        "has_punctuation": true,
        "sentiment_score": 0.5,
        "spam_score": 0.95,
        "relevance_score": 0.01
      }
    }
  ]
}
```

### Stage 2: Filtering (CARDS-Screened)
Apply quality filters to create ratable sets:

```javascript
{
  "cards_version": "2.0-screened",
  "stage": "filtered",
  "filtering": {
    "method": "threshold_based",
    "filters_applied": [
      { "field": "length", "min": 20 },
      { "field": "spam_score", "max": 0.3 },
      { "field": "relevance_score", "min": 0.5 }
    ],
    "stats": {
      "items_before": 1000,
      "items_after": 234,
      "retention_rate": 0.234
    }
  },
  "items": [/* only quality items */]
}
```

### Stage 3: Separated Media Types
Create separate CARDS files by media type:

1. **cards_video_chunks.json** - Video segments only
2. **cards_comments.json** - Text comments only  
3. **cards_mixed_sample.json** - Small curated mix for cross-media studies

## Filtering Strategies

### 1. Heuristic Filters (Fast, Cheap)
```javascript
const commentFilters = {
  // Basic quality
  minLength: 30,
  maxLength: 500,
  minWords: 5,
  
  // Engagement  
  minLikes: 5,
  minLikeRatio: 0.01, // likes/video_views
  
  // Content
  bannedPatterns: [/^first/i, /^notification squad/i],
  requiredElements: ['letter', 'punctuation'],
  
  // Spam detection
  maxEmojiRatio: 0.5,
  maxCapitalRatio: 0.8,
  maxRepeatedChars: 3
};

const videoChunkFilters = {
  // Duration
  minDuration: 5,
  maxDuration: 30,
  
  // Transcription
  minWords: 10,
  maxSilenceRatio: 0.3,
  
  // Activity
  minSceneChanges: 1,
  hasAudioPeaks: true
};
```

### 2. ML-Based Filtering (Better but Expensive)
```javascript
const mlFilters = {
  // Use embeddings
  semanticRelevance: {
    model: "all-MiniLM-L6-v2",
    minSimilarity: 0.7,
    referenceText: collection.searchTerm
  },
  
  // Use classifiers
  qualityClassifier: {
    model: "quality-bert",
    minScore: 0.6
  },
  
  // Use LLM
  gptScreening: {
    model: "gpt-3.5-turbo",
    prompt: "Is this comment substantive and worth rating?",
    batchSize: 100
  }
};
```

### 3. Hybrid Approach (Recommended)
```javascript
// Step 1: Fast heuristic filtering (remove obvious garbage)
const passedHeuristics = items.filter(item => 
  meetsBasicQuality(item) && !isObviousSpam(item)
);

// Step 2: Sampling for ML filtering (if needed)
const sample = stratifiedSample(passedHeuristics, 1000);
const mlScores = await scoreWithML(sample);

// Step 3: Apply ML thresholds
const highQuality = sample.filter(item => 
  mlScores[item.id] > threshold
);
```

## Implementation in VR Collector

### Export Options Enhancement
```javascript
{
  "export_type": "cards_multi_stage",
  "stages": {
    "raw": true,        // Export everything
    "screened": true,   // Apply filters
    "separated": true   // Split by media
  },
  
  "filtering": {
    "method": "hybrid",
    "heuristic_filters": {
      "comments": { /* ... */ },
      "videos": { /* ... */ }
    },
    "ml_filters": {
      "enabled": false, // Optional
      "model": "quality-classifier"
    }
  },
  
  "output": {
    "format": "multi_file", // or "single_file_staged"
    "include_filtering_report": true
  }
}
```

### Filtering Report
```javascript
{
  "filtering_report": {
    "timestamp": "2024-01-15T10:00:00Z",
    "total_items": 5000,
    "stages": [
      {
        "name": "length_filter",
        "removed": 3000,
        "reason": "Too short (<30 chars)"
      },
      {
        "name": "spam_filter", 
        "removed": 500,
        "reason": "Spam patterns detected"
      },
      {
        "name": "relevance_filter",
        "removed": 766,
        "reason": "Off-topic"
      }
    ],
    "final_items": 734,
    "retention_rate": 0.147,
    "quality_distribution": {
      "high": 234,
      "medium": 400,
      "low": 100
    }
  }
}
```

## Recommended Workflow

### For Research Use:
1. **Export Stage 1**: Raw CARDS with quality signals
2. **Review & Adjust**: Check filtering report, adjust thresholds
3. **Export Stage 2**: Filtered, separated CARDS files
4. **Human Rating**: Rate high-quality items only

### For Quick Studies:
1. **Export with Defaults**: Use pre-tuned filters
2. **Rate Top Items**: Focus on highest quality subset

### For Longitudinal Studies:
1. **Consistent Filters**: Same filtering across time periods
2. **Track Filter Performance**: Monitor what gets filtered
3. **Adjust Carefully**: Document any filter changes

## Benefits of This Approach

1. **Efficiency**: Don't waste human time on garbage
2. **Flexibility**: Can adjust filtering without re-collecting
3. **Transparency**: Clear record of what was filtered and why
4. **Reusability**: Raw export can be re-filtered differently
5. **Comparison**: Can compare filtered vs unfiltered results

## Next Steps

Should we:
1. Implement basic heuristic filtering first?
2. Add ML-based quality scoring?
3. Create separate export pipelines for different media?
4. Build a filtering preview UI?

The key insight is that CARDS should support multi-stage workflows where filtering is explicit and documented, not hidden.