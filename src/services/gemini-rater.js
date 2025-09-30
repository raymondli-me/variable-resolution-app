// Gemini API Integration for Content Rating
const fs = require('fs').promises;

class GeminiRater {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = 'gemini-2.5-flash';
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
            maxOutputTokens: 1000,
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
            maxOutputTokens: 1000,
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