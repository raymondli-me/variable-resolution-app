# VR Collector to CARDS Pipeline Design: A Comprehensive Architecture

## Executive Summary

The VR Collector produces rich, multi-modal YouTube data (videos, transcripts, comments). To transform this into meaningful research instruments (CARDS format for BWS rating), we need an intelligent pipeline that can:

1. **Understand research intent** (what are we measuring?)
2. **Extract relevant content** (what data supports this measurement?)
3. **Apply AI enrichment** (pre-rate, classify, embed)
4. **Filter intelligently** (remove noise while preserving signal)
5. **Structure for human rating** (create appropriate CARDS experiments)

This is not a simple export—it's a research design system.

## The Fundamental Problem

A single YouTube collection contains data that could answer dozens of research questions:

- **Mental Health**: Stigma in depression discussions
- **Education**: Teaching quality in tutorials  
- **Politics**: Misinformation patterns
- **Culture**: Spirituality expression evolution
- **Marketing**: Engagement tactics effectiveness

Each requires:
- Different relevance criteria
- Different quality thresholds
- Different comparison dimensions
- Different media focus (video vs comments)

## Proposed Architecture: Research-Driven Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   VR Collector  │────▶│  Research Intent│────▶│   Extraction    │
│   Raw Output    │     │   Specification │     │   & Enrichment  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CARDS Output   │◀────│    Filtering    │◀────│   AI Analysis   │
│  (BWS Ready)    │     │  & Structuring  │     │   & Scoring     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  VRDS Preview   │
                                                 │ (Pre-clustered) │
                                                 └─────────────────┘
```

## Stage 1: VR Collector Output Specification

### Standard Output Structure
```javascript
{
  "collection": {
    "id": 123,
    "search_term": "depression recovery stories",
    "created_at": "2024-01-15T10:00:00Z",
    "settings": { /* collection parameters */ }
  },
  
  "videos": [{
    "id": "video_abc123",
    "title": "My Recovery Journey",
    "channel": "MentalHealthWarrior",
    "stats": { views: 150000, likes: 12000 },
    "transcript": { /* whisper output */ },
    "chunks": [
      {
        "id": "chunk_1",
        "start": 0,
        "end": 10.5,
        "text": "I want to share my story...",
        "file_path": "/chunks/video_abc123_001.mp4"
      }
    ]
  }],
  
  "comments": [{
    "id": "comment_xyz",
    "video_id": "video_abc123",
    "text": "Thank you for sharing, this helps",
    "author": "user123",
    "likes": 45,
    "replies": [/* nested structure */]
  }]
}
```

### Key Insights
- **Multi-level data**: Video → Chunks → Transcript segments
- **Rich metadata**: Engagement, temporal, authorship
- **Natural hierarchies**: Parent videos, reply threads
- **Mixed quality**: Spans from spam to profound insights

## Stage 2: Research Intent Specification

### Intent Configuration Schema
```yaml
research_project:
  name: "Mental Health Stigma in YouTube Depression Content"
  version: "1.0"
  
  objectives:
    primary: "Measure stigma levels in depression discussions"
    secondary: 
      - "Compare creator vs commenter stigma"
      - "Track stigma change over video duration"
  
  constructs:
    - name: "stigma"
      definition: "Negative attitudes, stereotypes, or discrimination"
      operationalization:
        includes:
          - "Pathologizing language"
          - "Blame attribution"
          - "Social distance preferences"
        excludes:
          - "Clinical terminology in educational context"
          - "Personal struggle descriptions"
    
    - name: "support"
      definition: "Empathetic, encouraging, or helpful content"
      operationalization:
        includes:
          - "Validation statements"
          - "Shared experiences"
          - "Resource sharing"
  
  data_requirements:
    video_chunks:
      relevance: "Must discuss mental health"
      quality: "Clear speech, >5 seconds"
      sampling: "Stratified by video section"
    
    comments:
      relevance: "Responds to mental health content"
      quality: "Substantive (>30 words)"
      sampling: "Top engagement + random sample"
  
  comparison_design:
    method: "bws"
    dimensions:
      - id: "stigma_level"
        name: "Stigmatizing Content"
        anchors: ["Not Stigmatizing", "Highly Stigmatizing"]
      - id: "support_quality"
        name: "Supportiveness"
        anchors: ["Not Supportive", "Very Supportive"]
    
    set_composition:
      homogeneous: true  # Don't mix video/comments
      size: 4
      balance_by: ["video_source", "engagement_level"]
```

## Stage 3: Intelligent Extraction & Enrichment

### 3.1 Content Extraction
```python
class ResearchExtractor:
    def extract_relevant_content(self, vr_data, research_intent):
        relevant_items = []
        
        for video in vr_data.videos:
            # Extract video chunks based on relevance
            for chunk in video.chunks:
                relevance = self.calculate_relevance(
                    chunk.text, 
                    research_intent.keywords,
                    research_intent.concepts
                )
                
                if relevance.score > threshold:
                    relevant_items.append({
                        'type': 'video_chunk',
                        'content': chunk,
                        'relevance': relevance,
                        'context': self.extract_context(chunk, video)
                    })
            
            # Extract relevant comments
            for comment in video.comments:
                if self.is_relevant_comment(comment, research_intent):
                    relevant_items.append({
                        'type': 'comment',
                        'content': comment,
                        'relevance': self.calculate_comment_relevance(comment)
                    })
        
        return relevant_items
```

### 3.2 AI Enrichment Layer
```python
class AIEnrichment:
    def __init__(self):
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.classifier = AutoModel.from_pretrained('mental-health-bert')
        self.llm = OpenAI(model='gpt-4')
    
    async def enrich_items(self, items, research_config):
        enriched = []
        
        for item in items:
            # Generate embeddings for clustering
            item['embedding'] = self.embedder.encode(item['content'])
            
            # Apply specialized classifiers
            if research_config.use_classifiers:
                item['classifications'] = {
                    'stigma_score': self.classifier.predict_stigma(item['content']),
                    'support_score': self.classifier.predict_support(item['content']),
                    'clinical_accuracy': self.classifier.predict_clinical(item['content'])
                }
            
            # LLM analysis for nuanced understanding
            if research_config.use_llm_analysis:
                llm_analysis = await self.analyze_with_llm(
                    item['content'],
                    research_config.llm_prompts
                )
                item['llm_analysis'] = llm_analysis
            
            # Extract linguistic features
            item['linguistic_features'] = self.extract_features(item['content'])
            
            enriched.append(item)
        
        return enriched
    
    async def analyze_with_llm(self, content, prompts):
        results = {}
        
        # Multi-dimensional analysis
        for dimension, prompt_template in prompts.items():
            prompt = prompt_template.format(content=content)
            response = await self.llm.complete(prompt)
            
            results[dimension] = {
                'rating': response.rating,  # 1-10 scale
                'reasoning': response.reasoning,
                'confidence': response.confidence,
                'relevant_phrases': response.highlighted_phrases
            }
        
        return results
```

### 3.3 LLM Prompt Templates
```python
STIGMA_ANALYSIS_PROMPT = """
Analyze the following content for mental health stigma:

Content: {content}

Rate the stigma level from 1-10 where:
1 = No stigma, supportive
5 = Neutral
10 = Highly stigmatizing

Consider:
- Language that pathologizes mental health
- Blame or shame attribution
- Stereotyping or generalizations
- Social distance implications

Return:
- Rating (1-10)
- Key phrases that indicate stigma
- Type of stigma (self, public, structural)
- Confidence in assessment (0-1)

Format as JSON.
"""

EDUCATIONAL_QUALITY_PROMPT = """
Assess the educational quality of this mental health content:

Content: {content}

Consider:
- Clinical accuracy
- Clarity of explanation
- Helpfulness for audience
- Potential for harm

Rate 1-10 and provide reasoning.
"""
```

## Stage 4: Intelligent Filtering System

### 4.1 Multi-Stage Filtering Pipeline
```python
class IntelligentFilter:
    def __init__(self, research_config):
        self.config = research_config
        self.filters = self.build_filter_chain()
    
    def build_filter_chain(self):
        return [
            # Stage 1: Basic quality
            BasicQualityFilter(
                min_length=self.config.min_length,
                language=self.config.language,
                remove_spam=True
            ),
            
            # Stage 2: Relevance filtering
            RelevanceFilter(
                method='embedding_similarity',
                threshold=self.config.relevance_threshold,
                reference_texts=self.config.relevance_anchors
            ),
            
            # Stage 3: Research-specific filtering
            ResearchFilter(
                must_contain_constructs=True,
                balance_demographics=True,
                ensure_variance=True
            ),
            
            # Stage 4: Statistical sampling
            StatisticalSampler(
                method='stratified',
                strata=self.config.sampling_strata,
                size_per_stratum=self.config.stratum_size
            )
        ]
    
    def apply_filters(self, items):
        filter_report = FilterReport()
        current_items = items
        
        for filter in self.filters:
            before_count = len(current_items)
            current_items, filter_stats = filter.apply(current_items)
            after_count = len(current_items)
            
            filter_report.add_stage({
                'name': filter.name,
                'removed': before_count - after_count,
                'remaining': after_count,
                'stats': filter_stats
            })
        
        return current_items, filter_report
```

### 4.2 Ensuring Quality and Diversity
```python
class DiversityBalancer:
    def balance_dataset(self, items, config):
        # Ensure representation across important dimensions
        balanced = []
        
        # Group by critical factors
        groups = self.group_items(items, by=[
            'video_source',
            'engagement_level',
            'stigma_quartile',
            'content_type'
        ])
        
        # Sample from each group
        for group_key, group_items in groups.items():
            n_from_group = self.calculate_group_size(
                group_key, 
                config.total_size,
                config.balance_strategy
            )
            
            sampled = self.smart_sample(
                group_items, 
                n_from_group,
                maximize='quality_diversity'
            )
            
            balanced.extend(sampled)
        
        return balanced
```

## Stage 5: CARDS Generation with Research Context

### 5.1 Enhanced CARDS Structure
```javascript
{
  "cards_version": "2.0-research",
  
  "research_context": {
    "project": "Mental Health Stigma YouTube Study",
    "extraction_pipeline": "vr-to-cards-v1",
    "processing_date": "2024-01-15",
    "source_collection": {
      "id": 123,
      "search_term": "depression recovery stories",
      "n_videos": 543,
      "n_comments": 45231
    }
  },
  
  "pipeline_metadata": {
    "extraction": {
      "relevance_method": "embedding_similarity",
      "relevance_threshold": 0.75,
      "items_extracted": 5420
    },
    "enrichment": {
      "embeddings_model": "all-MiniLM-L6-v2",
      "llm_model": "gpt-4",
      "classifiers": ["stigma-bert", "support-bert"],
      "items_enriched": 5420
    },
    "filtering": {
      "stages": 4,
      "items_before": 5420,
      "items_after": 834,
      "quality_distribution": {
        "high": 278,
        "medium": 400,
        "low": 156
      }
    }
  },
  
  "items": [
    {
      "id": "vr_item_001",
      "content": "I struggled with depression for years...",
      "media": {
        "type": "video",
        "url": "chunks/video_abc_001.mp4",
        "duration_seconds": 10.5
      },
      "metadata": {
        // Original VR Collector metadata
        "source_video": "abc123",
        "channel": "MentalHealthWarrior",
        "timestamp": "0:00-0:10",
        
        // AI enrichment metadata
        "ai_ratings": {
          "stigma_level": {
            "score": 2.3,
            "confidence": 0.89,
            "reasoning": "Speaker uses person-first language..."
          },
          "support_quality": {
            "score": 8.1,
            "confidence": 0.92
          }
        },
        
        // Research-specific metadata
        "research_labels": {
          "contains_personal_narrative": true,
          "stigma_type": "none_detected",
          "support_type": "experiential_sharing"
        },
        
        // For VRDS visualization
        "embedding_2d": [0.234, -0.567],
        "cluster_id": 3,
        "quality_score": 0.84
      }
    }
  ],
  
  "ai_baselines": {
    "gpt4_rankings": {
      "model": "gpt-4-turbo",
      "temperature": 0.3,
      "prompt_version": "stigma_ranking_v2",
      "rankings": [
        {
          "set_id": 0,
          "dimension": "stigma_level",
          "ranking": ["item_044", "item_023", "item_011", "item_089"],
          "confidence": 0.87,
          "reasoning": "Item 044 contains blame attribution..."
        }
      ]
    }
  }
}
```

### 5.2 Multiple CARDS Outputs
```python
def generate_research_cards(enriched_items, research_config):
    outputs = {}
    
    # Separate by media type for homogeneous comparison
    video_items = [i for i in enriched_items if i['type'] == 'video_chunk']
    comment_items = [i for i in enriched_items if i['type'] == 'comment']
    
    # Generate video CARDS
    if len(video_items) > MIN_ITEMS:
        outputs['video_stigma'] = create_cards(
            items=video_items,
            dimension='stigma_level',
            sets_config={
                'size': 4,
                'method': 'diverse_sampling',
                'n_sets': calculate_n_sets(len(video_items))
            }
        )
    
    # Generate comment CARDS
    if len(comment_items) > MIN_ITEMS:
        outputs['comment_stigma'] = create_cards(
            items=comment_items,
            dimension='stigma_level',
            sets_config={
                'size': 4,
                'method': 'stratified_by_engagement'
            }
        )
    
    # Optional: Cross-media comparison for specific research questions
    if research_config.enable_cross_media:
        outputs['cross_media_support'] = create_cards(
            items=select_comparable_items(video_items, comment_items),
            dimension='support_quality',
            sets_config={
                'size': 4,
                'method': 'balanced_media_types'
            }
        )
    
    return outputs
```

## Stage 6: VRDS Pre-Generation

### Pre-cluster and prepare for visualization
```python
class VRDSPreprocessor:
    def prepare_vrds_preview(self, enriched_items, research_config):
        # Use embeddings to create initial clustering
        embeddings = np.array([item['embedding'] for item in enriched_items])
        
        # Dimensionality reduction for visualization
        umap_embeddings = UMAP(n_components=2).fit_transform(embeddings)
        
        # Clustering for semantic groups
        clusters = HDBSCAN(min_cluster_size=10).fit_predict(embeddings)
        
        # Generate VRDS preview structure
        vrds_preview = {
            'version': '1.0',
            'metadata': {
                'source': 'vr_cards_pipeline',
                'research_project': research_config.name,
                'preprocessing': {
                    'embedding_model': 'all-MiniLM-L6-v2',
                    'reduction': 'UMAP',
                    'clustering': 'HDBSCAN'
                }
            },
            'items': []
        }
        
        # Add items with visualization data
        for i, item in enumerate(enriched_items):
            vrds_preview['items'].append({
                'id': item['id'],
                'x': float(umap_embeddings[i, 0]),
                'y': float(umap_embeddings[i, 1]),
                'cluster': int(clusters[i]),
                'color': self.score_to_color(item['ai_ratings']['stigma_level']['score']),
                'size': self.engagement_to_size(item),
                'metadata': {
                    'content_preview': item['content'][:100],
                    'stigma_score': item['ai_ratings']['stigma_level']['score'],
                    'support_score': item['ai_ratings']['support_quality']['score'],
                    'type': item['type']
                }
            })
        
        return vrds_preview
```

## Implementation Considerations

### 1. Computational Resources
- **Embedding generation**: Batch process, cache results
- **LLM calls**: Use async, implement rate limiting
- **Storage**: Consider vector database for embeddings

### 2. Quality Assurance
```python
class PipelineQualityChecker:
    def validate_pipeline_output(self, output):
        checks = {
            'sufficient_items': len(output.items) >= MIN_RESEARCH_ITEMS,
            'quality_distribution': self.check_quality_distribution(output),
            'dimension_coverage': self.check_dimension_coverage(output),
            'ai_human_agreement': self.estimate_agreement_potential(output)
        }
        
        return PipelineValidation(checks)
```

### 3. Iterative Refinement
```yaml
pipeline_versions:
  v1:
    - name: "Initial implementation"
    - changes: "Basic filtering, GPT-3.5 ratings"
    - issues: "Low relevance precision"
  
  v2:
    - name: "Improved relevance"
    - changes: "Added embedding similarity, GPT-4"
    - issues: "Imbalanced sampling"
  
  v3:
    - name: "Balanced sampling"
    - changes: "Stratified sampling, diversity metrics"
    - validation: "r=0.78 with human ratings"
```

## Example Research Configurations

### 1. Misinformation Detection
```yaml
research: "COVID Vaccine Misinformation"
extraction:
  keywords: ["vaccine", "covid", "mRNA", "side effects"]
  exclude: ["official CDC", "peer-reviewed"]
enrichment:
  classifiers: ["fact-check-bert", "conspiracy-detector"]
  llm_analysis:
    - factual_accuracy
    - emotional_manipulation
    - logical_fallacies
filtering:
  balance_by: ["stance", "engagement", "channel_size"]
```

### 2. Educational Quality
```yaml
research: "Programming Tutorial Effectiveness"
extraction:
  topics: ["python", "machine learning", "tutorial"]
  min_duration: 30
enrichment:
  features:
    - code_to_explanation_ratio
    - concept_clarity_score
    - prerequisite_explanation
filtering:
  require: ["actual_code_shown", "explanation_present"]
  balance_by: ["difficulty_level", "teaching_style"]
```

## Conclusion

This pipeline transforms VR Collector from a data gathering tool into a **research instrument factory**. By separating:

1. **Data Collection** (VR Collector's job)
2. **Research Design** (Intent specification)
3. **Intelligent Processing** (Extraction, enrichment, filtering)
4. **Instrument Creation** (CARDS generation)

We create a flexible system that can support diverse research questions while maintaining scientific rigor. The AI enrichment not only helps filter and organize but also provides baselines for human rating validation and pre-structures data for VRDS visualization.

The key insight: **CARDS isn't the output of VR Collector—it's the output of a research design process that uses VR Collector data as input.**