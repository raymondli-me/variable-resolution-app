// Gemini API Integration for Content Rating
const fs = require('fs').promises;
const path = require('path');

class GeminiRater {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = 'gemini-2.5-flash';
    // Cache for uploaded files to avoid re-uploading same videos
    this.uploadedFilesCache = new Map(); // key: file_path -> { uri, expiresAt }
  }

  /**
   * Rate a video chunk using Gemini's multimodal capabilities
   */
  async rateVideoChunk(chunkPath, transcriptText, researchIntent, ratingScale, retries = 3) {
    console.log(`[GeminiRater] Rating video chunk: ${chunkPath}`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Read video file
        const videoBytes = await fs.readFile(chunkPath);
        const videoBase64 = videoBytes.toString('base64');
        
        console.log(`[GeminiRater] Video file read successfully, size: ${videoBytes.length} bytes`);
        
        const prompt = this.buildVideoPrompt(researchIntent, ratingScale, transcriptText);
        
        const requestBody = {
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: "video/mp4",
                  data: videoBase64
                }
              },
              {
                text: prompt
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 3000,  // Increased to account for thinking tokens (~1000) + response
            responseMimeType: 'application/json'
          }
        };

        const response = await fetch(
          `${this.baseURL}/${this.model}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`[GeminiRater] Video chunk rated successfully on attempt ${attempt}`);
        return this.parseResponse(result, transcriptText);
        
      } catch (error) {
        console.error(`[GeminiRater] Error rating video chunk (attempt ${attempt}/${retries}):`, error.message);
        if (attempt === retries) {
          throw error;
        }
        // Wait before retry (exponential backoff)
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`[GeminiRater] Waiting ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  /**
   * Rate a comment using text analysis
   */
  async rateComment(commentText, videoContext, researchIntent, ratingScale, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const prompt = this.buildCommentPrompt(commentText, videoContext, researchIntent, ratingScale);

        const requestBody = {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 3000,  // Increased to account for thinking tokens (~1000) + response
            responseMimeType: 'application/json'
          }
        };

        const response = await fetch(
          `${this.baseURL}/${this.model}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        return this.parseResponse(result, commentText);

      } catch (error) {
        console.error(`Error rating comment (attempt ${attempt}/${retries}):`, error);
        if (attempt === retries) {
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Rate a PDF excerpt using text analysis (with optional visual context)
   *
   * @param {string} excerptText - The text content to rate
   * @param {Object} pdfContext - Context object with title, page_number, pageImageDataURL (optional)
   * @param {string} researchIntent - The research question
   * @param {string} ratingScale - Rating scale type
   * @param {number} retries - Number of retry attempts
   */
  async ratePDFExcerpt(excerptText, pdfContext, researchIntent, ratingScale, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const hasImage = pdfContext.pageImageDataURL && pdfContext.pageImageDataURL.length > 0;
        const prompt = this.buildPDFPrompt(excerptText, pdfContext, researchIntent, ratingScale, hasImage);

        // Build parts array: always include text, optionally include image
        const parts = [{ text: prompt }];

        if (hasImage) {
          // Extract base64 data from data URL (format: "data:image/png;base64,...")
          const base64Data = pdfContext.pageImageDataURL.split(',')[1];

          parts.push({
            inline_data: {
              mime_type: 'image/png',
              data: base64Data
            }
          });

          console.log(`[GeminiRater] Sending PDF excerpt with page image (${Math.round(base64Data.length / 1024)}KB)`);
        } else {
          console.log(`[GeminiRater] Sending PDF excerpt (text-only mode)`);
        }

        const requestBody = {
          contents: [{
            parts: parts
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 3000,  // Increased to account for thinking tokens (~1000) + response
            responseMimeType: 'application/json'
          }
        };

        const response = await fetch(
          `${this.baseURL}/${this.model}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        return this.parseResponse(result, excerptText);

      } catch (error) {
        console.error(`Error rating PDF excerpt (attempt ${attempt}/${retries}):`, error);
        if (attempt === retries) {
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Build prompt for video chunk rating
   */
  buildVideoPrompt(researchIntent, ratingScale, transcript) {
    return `You are rating content relevance for research purposes.

Research Intent: ${researchIntent}

${transcript ? `Video Transcript: "${transcript}"` : 'Analyze the video content shown.'}

${this.getRatingInstructions(ratingScale)}

Consider:
- Does the content directly relate to the research intent?
- Is there substantive discussion of the topic?
- Would this be useful for understanding the research question?

IMPORTANT: Respond with ONLY valid JSON. No markdown, no code blocks, no explanatory text. Just the JSON object.`;
  }

  /**
   * Build prompt for comment rating
   */
  buildCommentPrompt(commentText, videoContext, researchIntent, ratingScale) {
    return `You are rating content relevance for research purposes.

Research Intent: ${researchIntent}

Video Context: "${videoContext.title}"

Comment to rate: "${commentText}"

${this.getRatingInstructions(ratingScale)}

Consider:
- Does the comment relate to the research intent?
- Is it substantive or just spam/reaction?
- Does it add value to understanding the topic?

IMPORTANT: Respond with ONLY valid JSON. No markdown, no code blocks, no explanatory text. Just the JSON object.`;
  }

  /**
   * Build prompt for PDF excerpt rating (with optional image context)
   */
  buildPDFPrompt(excerptText, pdfContext, researchIntent, ratingScale, hasImage = false) {
    const imageInstructions = hasImage
      ? `\n\nVISUAL CONTEXT: An image of the PDF page is provided showing the excerpt highlighted in yellow. Use this visual context to understand:
- Document layout and typography (heading vs body text)
- Surrounding content and context
- Visual emphasis (bold, italic, font size)
- Position within the document structure`
      : '';

    return `You are rating content relevance for research purposes.

Research Intent: ${researchIntent}

PDF Document: "${pdfContext.title}"${pdfContext.page_number ? ` (Page ${pdfContext.page_number})` : ''}

Excerpt to rate: "${excerptText}"${imageInstructions}

${this.getRatingInstructions(ratingScale)}

Consider:
- Does the excerpt directly relate to the research intent?
- Is there substantive discussion or analysis of the topic?
- Would this excerpt be useful for understanding the research question?
- Is this academic/technical content relevant to the topic?${hasImage ? '\n- What does the visual layout tell you about the importance/context of this text?' : ''}

IMPORTANT: Respond with ONLY valid JSON. No markdown, no code blocks, no explanatory text. Just the JSON object.`;
  }

  /**
   * Get rating instructions based on scale
   */
  getRatingInstructions(scale) {
    const instructions = {
      binary: `Rate as:
{
  "relevance": 1.0 or 0.0,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation (max 50 words)"
}`,
      
      ternary: `Rate as:
{
  "relevance": 1.0 (highly relevant), 0.5 (somewhat relevant), or 0.0 (not relevant),
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation (max 50 words)"
}`,
      
      five_point: `Rate as:
{
  "relevance": 1.0 (5 - highly relevant), 0.75 (4), 0.5 (3), 0.25 (2), or 0.0 (1 - not relevant),
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation (max 50 words)"
}`
    };
    
    return instructions[scale] || instructions.binary;
  }

  /**
   * Parse Gemini response
   */
  parseResponse(geminiResponse, contextForDebug = '') {
    // Extract text from Gemini response structure
    let text = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      console.error('Empty response from Gemini for:', contextForDebug);
      console.error('Full response:', JSON.stringify(geminiResponse, null, 2));
      throw new Error('Empty response from Gemini API');
    }
    
    // Remove markdown code blocks if present (sometimes Gemini ignores the mime type)
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      // Try to extract JSON if there's extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse JSON from Gemini:', text);
          console.error('Context:', contextForDebug);
          throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
        }
      } else {
        console.error('No JSON found in Gemini response:', text);
        console.error('Context:', contextForDebug);
        throw new Error(`No JSON found in response: ${text.substring(0, 200)}`);
      }
    }
    
    // Strict validation - require all fields
    if (parsed.relevance === undefined || parsed.relevance === null) {
      console.error('Missing relevance field in:', parsed);
      throw new Error('Gemini response missing required field: relevance');
    }
    
    if (parsed.confidence === undefined || parsed.confidence === null) {
      console.error('Missing confidence field in:', parsed);
      throw new Error('Gemini response missing required field: confidence');
    }
    
    if (!parsed.reasoning) {
      console.error('Missing reasoning field in:', parsed);
      throw new Error('Gemini response missing required field: reasoning');
    }
    
    // Validate and normalize response
    return {
      relevance: this.normalizeScore(parsed.relevance),
      confidence: this.normalizeScore(parsed.confidence),
      reasoning: parsed.reasoning.substring(0, 200)
    };
  }

  /**
   * Normalize score to 0-1 range
   */
  normalizeScore(score) {
    if (typeof score !== 'number') return 0.5;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Best-Worst Scaling: Compare items and select BEST and WORST
   * Now supports MULTIMODAL comparison (videos + text)
   */
  async compareBWSItems(items, researchIntent, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[GeminiRater BWS] Comparing ${items.length} items (attempt ${attempt}/${retries})`);

        // Build multimodal parts (videos + text)
        const parts = await this.buildBWSMultimodalParts(items, researchIntent);

        console.log(`[GeminiRater BWS] Built ${parts.length} parts for comparison`);

        const requestBody = {
          contents: [{
            parts: parts
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 3000,  // Increased to account for thinking tokens (~1000) + response
            responseMimeType: 'application/json'
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_ONLY_HIGH'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_ONLY_HIGH'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_ONLY_HIGH'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_ONLY_HIGH'
            }
          ]
        };

        const response = await fetch(
          `${this.baseURL}/${this.model}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`[GeminiRater BWS] Received response from Gemini`);
        return this.parseBWSResponse(result);

      } catch (error) {
        console.error(`Error comparing BWS items (attempt ${attempt}/${retries}):`, error);
        if (attempt === retries) {
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Build multimodal parts for BWS comparison
   * Handles video chunks (with actual video files), comments (text), and PDF excerpts (text)
   * INLINE ONLY: Videos must be < 20MB (File API upload can be added later if needed)
   */
  async buildBWSMultimodalParts(items, researchIntent) {
    const parts = [];
    const videoCount = items.filter(item => item.item_type === 'video_chunk' && item.file_path).length;
    const commentCount = items.filter(item => item.item_type === 'comment').length;
    const pdfCount = items.filter(item => item.item_type === 'pdf_excerpt').length;

    console.log(`[BWS Multimodal] Building parts for ${items.length} items (${videoCount} videos, ${commentCount} comments, ${pdfCount} PDFs)`);

    // Add each item (video or text)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isComment = item.item_type === 'comment';
      const isPDF = item.item_type === 'pdf_excerpt';
      const isVideo = item.item_type === 'video_chunk' && item.file_path;

      if (isVideo) {
        try {
          const stats = await fs.stat(item.file_path);
          const fileSizeMB = stats.size / (1024 * 1024);

          console.log(`[BWS Video ${i + 1}] ${path.basename(item.file_path)} - ${fileSizeMB.toFixed(2)} MB`);

          if (fileSizeMB < 20) {
            // Inline video data (< 20MB)
            const videoBytes = await fs.readFile(item.file_path);
            parts.push({
              inline_data: {
                mime_type: "video/mp4",
                data: videoBytes.toString('base64')
              }
            });
            console.log(`[BWS Video ${i + 1}] ✅ Loaded inline video (${fileSizeMB.toFixed(2)} MB)`);
          } else {
            // File too large - fallback to transcript only
            console.warn(`[BWS Video ${i + 1}] ⚠️ File too large (${fileSizeMB.toFixed(2)} MB > 20 MB), using transcript only`);
            parts.push({
              text: `Video ${i + 1} (file too large for inline upload, using transcript): "${item.transcript_text || 'No transcript available'}"`
            });
          }

          // Add transcript as supplementary context (only if video was loaded)
          if (fileSizeMB < 20) {
            parts.push({
              text: `Video ${i + 1} Transcript: "${item.transcript_text || 'No transcript available'}"`
            });
          }
        } catch (error) {
          console.error(`[BWS Video ${i + 1}] ❌ Failed to load video, falling back to transcript only:`, error.message);
          // Fallback to text-only if video fails
          parts.push({
            text: `Video ${i + 1} (video unavailable, using transcript): "${item.transcript_text || 'No transcript available'}"`
          });
        }
      } else if (isPDF) {
        // PDF excerpt (text only)
        const pdfLabel = item.pdf_title ? `from "${item.pdf_title}"` : 'from PDF';
        const pageInfo = item.page_number ? ` (Page ${item.page_number})` : '';
        parts.push({
          text: `PDF Excerpt ${i + 1} ${pdfLabel}${pageInfo}: "${item.text_content || 'No content'}"`
        });
      } else {
        // Comment (text only)
        parts.push({
          text: `Comment ${i + 1}: "${item.text || 'No content'}"`
        });
      }
    }

    // Add instruction prompt AFTER all items
    parts.push({
      text: `You are comparing items for research purposes using Best-Worst Scaling.

Research Intent: ${researchIntent}

Task: Select which item is MOST relevant (BEST) and which is LEAST relevant (WORST) to the research intent.

Consider both VISUAL content (from videos) and TEXTUAL content (from transcripts/comments).

Respond with ONLY valid JSON (no other text before or after):
{
  "best": <item number>,
  "worst": <item number>,
  "reasoning": "Explain in 1-2 sentences (max 50 words)"
}

CRITICAL RULES:
- If videos don't match research intent, still pick best/worst based on closest relevance
- Keep reasoning VERY brief - you have limited tokens
- DO NOT explain why the task is difficult - just answer
- best and worst must be different numbers (1-${items.length})
- Respond with ONLY the JSON object, no markdown, no code blocks`
    });

    return parts;
  }

  /**
   * Build prompt for BWS comparison (legacy text-only, kept for fallback)
   */
  buildBWSPrompt(items, researchIntent) {
    const itemsList = items.map((item, i) => {
      const isComment = item.item_type === 'comment';
      const content = isComment ? item.text : item.transcript_text;
      const label = isComment ? 'Comment' : 'Video Chunk';

      return `${i + 1}. [${label}] ${content?.substring(0, 500) || 'No content'}`;
    }).join('\n\n');

    return `You are comparing items for research purposes using Best-Worst Scaling.

Research Intent: ${researchIntent}

Items to compare:
${itemsList}

Task: Select which item is MOST relevant (BEST) and which is LEAST relevant (WORST) to the research intent.

Respond with ONLY valid JSON:
{
  "best": <item number 1-${items.length}>,
  "worst": <item number 1-${items.length}>,
  "reasoning": "Brief explanation (max 100 words)"
}

IMPORTANT:
- best and worst must be different numbers
- Numbers must be 1-${items.length}
- Respond with ONLY the JSON object, no markdown, no code blocks`;
  }

  /**
   * Parse BWS comparison response
   */
  parseBWSResponse(geminiResponse) {
    let text = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      // Enhanced logging to understand WHY the response is empty
      console.error('[parseBWSResponse] Empty response - Full API response:');
      console.error(JSON.stringify(geminiResponse, null, 2));

      // Check for safety ratings or other blocking
      const candidate = geminiResponse.candidates?.[0];
      if (candidate) {
        console.error('[parseBWSResponse] Candidate exists but empty text:');
        console.error('  - finishReason:', candidate.finishReason);
        console.error('  - safetyRatings:', JSON.stringify(candidate.safetyRatings, null, 2));
      }

      throw new Error('Empty response from Gemini API');
    }

    // Remove markdown code blocks if present
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      // Try to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          // Log the actual text to see if it's truncated
          console.error('[parseBWSResponse] Failed to parse JSON:');
          console.error('  - Text length:', text.length);
          console.error('  - Text preview:', text.substring(0, 500));
          console.error('  - Full text:', text);
          throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
        }
      } else {
        console.error('[parseBWSResponse] No JSON found in text:');
        console.error('  - Text length:', text.length);
        console.error('  - Full text:', text);
        throw new Error(`No JSON found in response: ${text.substring(0, 200)}`);
      }
    }

    // Validate required fields
    if (!parsed.best || !parsed.worst) {
      throw new Error('Gemini response missing best or worst field');
    }

    if (parsed.best === parsed.worst) {
      throw new Error('Best and worst must be different items');
    }

    if (!Number.isInteger(parsed.best) || !Number.isInteger(parsed.worst)) {
      throw new Error('Best and worst must be integers');
    }

    return {
      best: parsed.best,
      worst: parsed.worst,
      reasoning: parsed.reasoning || 'No reasoning provided'
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await this.rateComment(
        "Test comment",
        { title: "Test video" },
        "Test research intent",
        "binary"
      );
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = GeminiRater;