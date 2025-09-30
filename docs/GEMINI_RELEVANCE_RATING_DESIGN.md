# Gemini-Powered Relevance Rating System for VR Collector

## Overview

Add a new "AI Analysis" tab to VR Collector that leverages Gemini 2.5 Flash's multimodal capabilities to rate content relevance. This creates a crucial preprocessing layer that enriches the database with relevance ratings, enabling intelligent CARDS generation later.

## Key Benefits

1. **Native Multimodality**: Gemini processes video chunks directly - no transcription needed
2. **Cost Effective**: Flash model is fast and cheap for bulk rating
3. **Flexible Research**: Same collection can support multiple research questions
4. **Quality at Scale**: Rate thousands of items quickly
5. **Reusable Enrichment**: Ratings stored in database for future use

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Collections    │────▶│  AI Analysis    │────▶│  Enhanced DB    │
│  (Raw Data)     │     │  (New Tab)      │     │  (+ Ratings)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       │                        ▼
         │                  ┌─────────────┐     ┌─────────────────┐
         │                  │   Gemini    │     │  CARDS Export   │
         └─────────────────▶│  2.5 Flash  │     │  (Filtered)     │
                            └─────────────┘     └─────────────────┘
```

## Database Schema Updates

### Add Relevance Ratings Tables

```sql
-- Store rating jobs/projects
CREATE TABLE IF NOT EXISTS rating_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  research_intent TEXT NOT NULL,
  rating_scale TEXT NOT NULL, -- 'binary', 'ternary', 'five_point'
  gemini_model TEXT DEFAULT 'gemini-2.5-flash',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  total_items INTEGER,
  rated_items INTEGER DEFAULT 0,
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- Store individual ratings
CREATE TABLE IF NOT EXISTS relevance_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  item_type TEXT NOT NULL, -- 'video_chunk', 'comment'
  item_id TEXT NOT NULL,
  relevance_score REAL NOT NULL, -- 1.0, 0.5, 0.0 for ternary
  confidence REAL,
  reasoning TEXT,
  gemini_response TEXT, -- Full response JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES rating_projects(id),
  UNIQUE(project_id, item_type, item_id)
);

-- Add indexes for performance
CREATE INDEX idx_relevance_ratings_lookup ON relevance_ratings(project_id, item_type, item_id);
CREATE INDEX idx_relevance_ratings_score ON relevance_ratings(relevance_score);
```

## UI Design

### New "AI Analysis" Tab

```
┌─────────────────────────────────────────────────────────────────┐
│ 🤖 AI Analysis                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Select Collection: [Dropdown: Depression Recovery Stories ▼]    │
│                                                                 │
│ ┌─ Create New Rating Project ─────────────────────────────────┐ │
│ │                                                             │ │
│ │ Project Name: [Mental Health Stigma Analysis              ] │ │
│ │                                                             │ │
│ │ What are you looking for? (Research Intent)                │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Content that discusses mental health challenges,        │ │ │
│ │ │ recovery experiences, treatment, or stigma. Focus on    │ │ │
│ │ │ personal narratives and community responses.            │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ Rating Scale: [●] Relevant/Not Relevant                    │ │
│ │              [ ] High/Medium/Low Relevance                 │ │
│ │              [ ] 5-Point Scale (1-5)                       │ │
│ │                                                             │ │
│ │ Content to Rate:                                            │ │
│ │ [✓] Video Chunks (523 items)                               │ │
│ │ [✓] Comments (4,231 items)                                 │ │
│ │ [ ] Video Titles & Descriptions                            │ │
│ │                                                             │ │
│ │ Advanced Options ▼                                          │ │
│ │ ├─ Batch Size: [50] items                                  │ │
│ │ ├─ Rate Limit: [60] requests/minute                        │ │
│ │ └─ Include Confidence Scores: [✓]                          │ │
│ │                                                             │ │
│ │ Estimated: ~4,754 items × ~$0.00015 = $0.71                │ │
│ │                                                             │ │
│ │ [Start Rating] [Preview First 10]                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Existing Rating Projects ──────────────────────────────────┐ │
│ │ ┌───────────────────────────────────────────────────────┐  │ │
│ │ │ 📊 Mental Health Stigma Analysis                      │  │ │
│ │ │ Status: In Progress (2,341 / 4,754 rated)            │  │ │
│ │ │ Started: 2 hours ago                                  │  │ │
│ │ │ [Resume] [View Results] [Export]                      │  │ │
│ │ └───────────────────────────────────────────────────────┘  │ │
│ │                                                             │ │
│ │ ┌───────────────────────────────────────────────────────┐  │ │
│ │ │ ✅ Educational Quality Assessment                      │  │ │
│ │ │ Status: Complete (1,523 / 1,523 rated)               │  │ │
│ │ │ Completed: Yesterday                                  │  │ │
│ │ │ [View Results] [Export] [Create CARDS]                │  │ │
│ │ └───────────────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Rating Progress View

```
┌─────────────────────────────────────────────────────────────────┐
│ Rating in Progress: Mental Health Stigma Analysis              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Progress: ████████████░░░░░░░░░░  2,341 / 4,754 (49%)         │
│ Time Elapsed: 2h 15m | Est. Remaining: 2h 20m                  │
│                                                                 │
│ ┌─ Live Rating Stream ────────────────────────────────────────┐ │
│ │ ✓ Chunk 234: "dealing with depression is..." → Relevant    │ │
│ │ ✓ Comment 892: "First!" → Not Relevant                     │ │
│ │ ✓ Chunk 235: "today we'll learn Python..." → Not Relevant  │ │
│ │ ⟳ Rating chunk 236...                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Distribution:                                                   │
│ Relevant:     ████████████ 1,234 (52.7%)                      │
│ Not Relevant: ████████     1,107 (47.3%)                      │
│                                                                 │
│ [Pause] [Cancel] [Export Current Results]                       │
└─────────────────────────────────────────────────────────────────┘
```

### Results View

```
┌─────────────────────────────────────────────────────────────────┐
│ Rating Results: Educational Quality Assessment                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Summary Statistics:                                             │
│ ├─ Total Rated: 1,523 items                                    │
│ ├─ Highly Relevant: 234 (15.4%)                                │
│ ├─ Relevant: 567 (37.2%)                                       │
│ ├─ Not Relevant: 722 (47.4%)                                   │
│ └─ Avg Confidence: 0.87                                        │
│                                                                 │
│ ┌─ Top Relevant Items ────────────────────────────────────────┐ │
│ │ 🎬 "Introduction to Neural Networks" (chunk 4:23-4:33)      │ │
│ │    Score: 1.0 | Confidence: 0.95                           │ │
│ │    "Clear explanation of backpropagation with visuals"     │ │
│ │                                                             │ │
│ │ 💬 "This finally made gradient descent click for me!"       │ │
│ │    Score: 1.0 | Confidence: 0.92                           │ │
│ │    "Expresses learning breakthrough"                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Actions:                                                        │
│ [Export to CARDS] [Export CSV] [Visualize] [Delete Project]    │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Gemini API Integration

```javascript
// gemini-rater.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

class GeminiRater {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3, // Lower for consistency
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 200, // Keep responses concise
      }
    });
  }

  async rateVideoChunk(chunkPath, transcriptText, researchIntent, ratingScale) {
    const videoBytes = await fs.readFile(chunkPath);
    
    const prompt = this.buildPrompt(researchIntent, ratingScale, transcriptText);
    
    const result = await this.model.generateContent([
      {
        inlineData: {
          mimeType: "video/mp4",
          data: Buffer.from(videoBytes).toString("base64")
        }
      },
      prompt
    ]);

    return this.parseResponse(result.response.text());
  }

  async rateComment(commentText, videoContext, researchIntent, ratingScale) {
    const prompt = `
Research Intent: ${researchIntent}

Video Context: "${videoContext.title}"

Comment to rate: "${commentText}"

${this.getRatingInstructions(ratingScale)}

Respond with JSON only.`;

    const result = await this.model.generateContent(prompt);
    return this.parseResponse(result.response.text());
  }

  buildPrompt(researchIntent, ratingScale, transcript) {
    return `
You are rating content relevance for research purposes.

Research Intent: ${researchIntent}

${transcript ? `Transcript: "${transcript}"` : 'Analyze the video content shown.'}

${this.getRatingInstructions(ratingScale)}

Consider:
- Does the content directly relate to the research intent?
- Is there substantive discussion of the topic?
- Would this be useful for understanding the research question?

Respond with JSON only.`;
  }

  getRatingInstructions(scale) {
    const instructions = {
      binary: `Rate as:
{
  "relevance": 1.0 or 0.0,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`,
      ternary: `Rate as:
{
  "relevance": 1.0 (relevant), 0.5 (uncertain), or 0.0 (not relevant),
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`,
      five_point: `Rate as:
{
  "relevance": 1.0 (highly relevant) to 0.0 (not relevant) in 0.25 increments,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`
    };
    
    return instructions[scale] || instructions.binary;
  }

  parseResponse(text) {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("No JSON found in response");
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      return {
        relevance: 0.5,
        confidence: 0.0,
        reasoning: "Failed to parse response"
      };
    }
  }
}
```

### 2. Batch Processing Engine

```javascript
// rating-engine.js
class RatingEngine {
  constructor(db, geminiRater) {
    this.db = db;
    this.gemini = geminiRater;
    this.running = false;
    this.progress = new EventEmitter();
  }

  async startRatingProject(projectConfig) {
    this.running = true;
    
    // Create project in database
    const projectId = await this.db.createRatingProject(projectConfig);
    
    // Get items to rate
    const items = await this.getItemsToRate(projectConfig);
    
    // Process in batches
    const batchSize = projectConfig.batchSize || 50;
    const rateLimit = projectConfig.rateLimit || 60; // per minute
    const delayMs = (60 * 1000) / rateLimit;
    
    for (let i = 0; i < items.length && this.running; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      await this.processBatch(batch, projectId, projectConfig);
      
      // Update progress
      const progress = Math.min((i + batchSize) / items.length * 100, 100);
      this.progress.emit('update', {
        projectId,
        current: Math.min(i + batchSize, items.length),
        total: items.length,
        percentage: progress
      });
      
      // Rate limiting delay
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs * batch.length));
      }
    }
    
    // Mark project complete
    await this.db.updateProjectStatus(projectId, 'completed');
    this.progress.emit('complete', { projectId });
  }

  async processBatch(items, projectId, config) {
    const ratings = await Promise.all(
      items.map(item => this.rateItem(item, config))
    );
    
    // Save to database
    for (let i = 0; i < items.length; i++) {
      await this.db.saveRating({
        project_id: projectId,
        item_type: items[i].type,
        item_id: items[i].id,
        relevance_score: ratings[i].relevance,
        confidence: ratings[i].confidence,
        reasoning: ratings[i].reasoning,
        gemini_response: JSON.stringify(ratings[i])
      });
      
      this.progress.emit('item-rated', {
        projectId,
        item: items[i],
        rating: ratings[i]
      });
    }
  }

  async rateItem(item, config) {
    try {
      if (item.type === 'video_chunk') {
        return await this.gemini.rateVideoChunk(
          item.file_path,
          item.transcript_text,
          config.researchIntent,
          config.ratingScale
        );
      } else if (item.type === 'comment') {
        return await this.gemini.rateComment(
          item.text,
          { title: item.video_title },
          config.researchIntent,
          config.ratingScale
        );
      }
    } catch (error) {
      console.error(`Error rating item ${item.id}:`, error);
      return {
        relevance: 0.5,
        confidence: 0.0,
        reasoning: `Error: ${error.message}`
      };
    }
  }

  async getItemsToRate(config) {
    const items = [];
    
    if (config.includeChunks) {
      const chunks = await this.db.getChunksForCollection(config.collectionId);
      items.push(...chunks.map(chunk => ({
        type: 'video_chunk',
        id: `chunk_${chunk.video_id}_${chunk.chunk_number}`,
        ...chunk
      })));
    }
    
    if (config.includeComments) {
      const comments = await this.db.getCommentsForCollection(config.collectionId);
      items.push(...comments.map(comment => ({
        type: 'comment',
        id: comment.id,
        ...comment
      })));
    }
    
    return items;
  }

  pause() {
    this.running = false;
  }
  
  resume() {
    this.running = true;
  }
}
```

### 3. Settings Integration

```javascript
// Add to settings modal
const GeminiSettings = {
  template: `
    <div class="settings-section">
      <h3>Gemini AI Settings</h3>
      <div class="setting-item">
        <label for="geminiApiKey">Gemini API Key</label>
        <input 
          type="password" 
          id="geminiApiKey" 
          placeholder="Enter your Gemini API key"
          value="${settings.geminiApiKey || ''}"
        />
        <a href="https://aistudio.google.com/app/apikey" target="_blank">
          Get API Key
        </a>
      </div>
      
      <div class="setting-item">
        <label for="geminiModel">Model</label>
        <select id="geminiModel">
          <option value="gemini-2.5-flash" selected>
            Gemini 2.5 Flash (Recommended - Fast & Cheap)
          </option>
          <option value="gemini-2.5-pro">
            Gemini 2.5 Pro (More Accurate)
          </option>
        </select>
      </div>
      
      <div class="setting-item">
        <label>Usage Estimate</label>
        <div class="usage-info">
          Flash: ~$0.075 per 1000 items
          Pro: ~$1.25 per 1000 items
        </div>
      </div>
    </div>
  `,
  
  save() {
    const apiKey = document.getElementById('geminiApiKey').value;
    const model = document.getElementById('geminiModel').value;
    
    if (apiKey) {
      // Encrypt before saving
      settings.geminiApiKey = encrypt(apiKey);
      settings.geminiModel = model;
      saveSettings();
    }
  }
};
```

### 4. Export to CARDS with Ratings

```javascript
// Enhanced CARDS export that uses relevance ratings
async function exportToFilteredCARDS(collectionId, ratingProjectId, options) {
  // Get items with high relevance scores
  const relevantItems = await db.getItemsWithRelevance(
    collectionId, 
    ratingProjectId,
    options.minRelevance || 0.7
  );
  
  // Create CARDS structure with AI ratings included
  const cardsData = {
    cards_version: "2.0-ai-filtered",
    
    filtering_metadata: {
      rating_project: ratingProjectId,
      relevance_threshold: options.minRelevance,
      items_before_filtering: await db.getCollectionItemCount(collectionId),
      items_after_filtering: relevantItems.length
    },
    
    items: relevantItems.map(item => ({
      ...transformToCARDSItem(item),
      ai_ratings: {
        relevance: {
          score: item.relevance_score,
          confidence: item.confidence,
          reasoning: item.reasoning,
          model: "gemini-2.5-flash",
          rated_at: item.rated_at
        }
      }
    })),
    
    // ... rest of CARDS structure
  };
  
  return cardsData;
}
```

## Advanced Features

### 1. Custom Rating Dimensions

Allow users to define multiple rating dimensions in one pass:

```javascript
const multiDimensionPrompt = `
Rate this content on multiple dimensions:

1. Relevance to ${researchIntent}: 0.0-1.0
2. Emotional Valence: -1.0 (negative) to 1.0 (positive)  
3. Information Quality: 0.0-1.0
4. Potential Harm: 0.0-1.0

Respond with JSON:
{
  "relevance": 0.0-1.0,
  "valence": -1.0-1.0,
  "quality": 0.0-1.0,
  "harm_potential": 0.0-1.0,
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}`;
```

### 2. Active Learning

Prioritize uncertain items for human review:

```javascript
async function getItemsForHumanReview(projectId, limit = 100) {
  // Get items where AI was uncertain
  const uncertainItems = await db.query(`
    SELECT * FROM relevance_ratings
    WHERE project_id = ? 
    AND confidence < 0.7
    ORDER BY confidence ASC
    LIMIT ?
  `, [projectId, limit]);
  
  return uncertainItems;
}
```

### 3. Cross-Collection Research

Rate items from multiple collections for the same research question:

```javascript
async function createCrossCollectionProject(collectionIds, researchIntent) {
  const project = await db.createRatingProject({
    name: "Cross-Collection: " + researchIntent,
    collection_ids: collectionIds,
    research_intent: researchIntent,
    is_cross_collection: true
  });
  
  // Rate items from all collections
  for (const collectionId of collectionIds) {
    await ratingEngine.rateCollection(collectionId, project.id);
  }
}
```

## Benefits of This Approach

1. **Separation of Concerns**: Rating is independent from CARDS generation
2. **Reusability**: Same ratings can generate multiple CARDS experiments
3. **Transparency**: Researchers see exactly what AI rated and why
4. **Quality Control**: Can audit and override AI ratings
5. **Cost Efficiency**: Rate once, use many times
6. **Research Flexibility**: Easy to try different relevance thresholds

## Migration Path

### Phase 1: Basic Implementation
- Single relevance dimension
- Binary rating scale
- Simple UI

### Phase 2: Enhanced Features
- Multiple dimensions
- Custom rating scales
- Batch management
- Progress persistence

### Phase 3: Advanced Integration
- Direct CARDS generation from ratings
- Active learning workflows
- Cross-collection analysis
- Fine-tuned models for specific domains

## Cost Estimation

Using Gemini 2.5 Flash pricing:
- Input: ~$0.075 per million tokens
- Output: ~$0.30 per million tokens

For typical usage:
- Video chunk (10 seconds): ~300 input tokens + 50 output tokens
- Comment: ~100 input tokens + 50 output tokens
- **Cost**: ~$0.00015 per item

A 5,000 item collection costs approximately **$0.75** to rate.