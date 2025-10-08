const { ipcMain } = require('electron');
const { AiRaterService } = require('../services/ai-rater-service');

/**
 * Register AI Rating IPC Handlers
 *
 * This is a thin wrapper that creates an AiRaterService instance
 * and delegates all IPC calls to the service methods.
 */
function registerAIHandlers(getDatabase, getMainWindow, getSettings, decrypt, getRatingEngine, setRatingEngine) {
  // Create the AI Rater Service
  const aiRaterService = new AiRaterService(
    getDatabase,
    getMainWindow,
    getSettings,
    decrypt,
    getRatingEngine,
    setRatingEngine
  );

  // AI Analysis IPC Handlers
  ipcMain.handle('ai:getRatingProjects', async (event, { collectionId }) => {
    return await aiRaterService.getRatingProjects(collectionId);
  });

  ipcMain.handle('ai:getRatingProject', async (event, { projectId }) => {
    return await aiRaterService.getRatingProject(projectId);
  });

  ipcMain.handle('ai:getAllRatingProjects', async () => {
    return await aiRaterService.getAllRatingProjects();
  });

  ipcMain.handle('ai:getItemCounts', async (event, { collectionId }) => {
    return await aiRaterService.getItemCounts(collectionId);
  });

  // Hierarchical rating project IPC handlers
  ipcMain.handle('ai:getChildProjects', async (event, { projectId }) => {
    return await aiRaterService.getChildProjects(projectId);
  });

  ipcMain.handle('ai:getProjectLineage', async (event, { projectId }) => {
    return await aiRaterService.getProjectLineage(projectId);
  });

  ipcMain.handle('ai:getFilteredItemCount', async (event, { parentProjectId, filterCriteria }) => {
    return await aiRaterService.getFilteredItemCount(parentProjectId, filterCriteria);
  });

  // Preview rating (first 5 items)
  ipcMain.handle('ai:previewRating', async (event, config) => {
    return await aiRaterService.previewRating(config);
  });

  ipcMain.handle('ai:startRating', async (event, config) => {
    return await aiRaterService.startRating(config);
  });

  ipcMain.handle('ai:pauseRating', async () => {
    return await aiRaterService.pauseRating();
  });

  ipcMain.handle('ai:resumeRating', async () => {
    return await aiRaterService.resumeRating();
  });

  ipcMain.handle('ai:cancelRating', async () => {
    return await aiRaterService.cancelRating();
  });

  ipcMain.handle('ai:exportRatings', async (event, { projectId }) => {
    return await aiRaterService.exportRatings(projectId);
  });

  ipcMain.handle('ai:testGeminiConnection', async () => {
    return await aiRaterService.testGeminiConnection();
  });

  ipcMain.handle('ai:getRatingsForProject', async (event, { projectId }) => {
    return await aiRaterService.getRatingsForProject(projectId);
  });

  // Single excerpt rating for Co-Pilot feature
  ipcMain.handle('ai:rateSingleExcerpt', async (event, { excerptText, pdfContext, researchIntent }) => {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');

      // Get Gemini API key from settings
      const settings = getSettings();
      const apiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;

      if (!apiKey) {
        return {
          success: false,
          error: 'Gemini API key not configured. Please add your API key in Settings.'
        };
      }

      // Get variable information from context
      const variable = pdfContext.variable;
      if (!variable) {
        return {
          success: false,
          error: 'No variable information provided'
        };
      }

      // Build scale-specific prompt
      const scaleMap = {
        'binary': { range: '0 or 1', anchors: variable.anchors },
        '3point': { range: '1, 2, or 3', anchors: variable.anchors },
        '4point': { range: '1, 2, 3, or 4', anchors: variable.anchors },
        '5point': { range: '1, 2, 3, 4, or 5', anchors: variable.anchors },
        '7point': { range: '1, 2, 3, 4, 5, 6, or 7', anchors: variable.anchors },
        '10point': { range: '1 through 10', anchors: variable.anchors },
        '100point': { range: '0 through 100', anchors: variable.anchors }
      };

      const scaleInfo = scaleMap[variable.scale_type] || scaleMap['5point'];

      // Build anchors description
      let anchorsText = '';
      if (scaleInfo.anchors && Object.keys(scaleInfo.anchors).length > 0) {
        anchorsText = '\n\nScale anchors:\n' + Object.entries(scaleInfo.anchors)
          .map(([score, desc]) => `${score}: ${desc}`)
          .join('\n');
      }

      const prompt = `You are a research coding assistant. Rate the following excerpt on the variable "${variable.label}".

Variable Definition: ${variable.definition}

Scale: ${scaleInfo.range}${anchorsText}

Excerpt to rate:
"${excerptText}"

Context: ${pdfContext.title}, page ${pdfContext.page_number}

Please provide your rating as JSON:
{
  "score": <number in range ${scaleInfo.range}>,
  "reasoning": "<${variable.reasoning_depth === 'brief' ? '1-2 sentences' : variable.reasoning_depth === 'moderate' ? '3-5 sentences' : '6+ sentences detailed explanation'}>"
}`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Extract JSON from response
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const rating = JSON.parse(jsonText);

      return {
        success: true,
        rating: rating
      };
    } catch (error) {
      console.error('[ai:rateSingleExcerpt] Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to rate excerpt'
      };
    }
  });

  // AI Variable Definition Suggester
  ipcMain.handle('ai:suggestVariableDefinition', async (event, { label, scaleType, variableType }) => {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');

      // Get Gemini API key from settings
      const settings = getSettings();
      const apiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;

      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

      const decryptedKey = apiKey;
      const genAI = new GoogleGenerativeAI(decryptedKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      let prompt;

      if (variableType === 'bws') {
        // BWS (Best-Worst Scaling) prompt
        prompt = `You are a research methods expert helping define a Best-Worst Scaling (BWS) variable.

Variable Label: "${label}"
Variable Type: Best-Worst Scaling (BWS)

Please provide:
1. A clear, academic definition of this variable (2-3 sentences that operationalize what this variable measures)
2. Anchor descriptions for "best" and "worst" that clearly define the extremes

Format your response as JSON:
{
  "definition": "...",
  "anchors": {
    "best": "Description of what represents the BEST/highest quality/most positive on this dimension",
    "worst": "Description of what represents the WORST/lowest quality/most negative on this dimension"
  }
}

Make the anchors specific and actionable so raters can reliably identify the best and worst items in a comparison set.`;
      } else {
        // Rating scale prompt
        const scaleDescriptions = {
          'binary': 'binary (0/1)',
          '3point': '3-point scale (1=Low, 2=Medium, 3=High)',
          '4point': '4-point scale (1-4)',
          '5point': '5-point scale (1-5)',
          '7point': '7-point scale (1-7)',
          '10point': '10-point scale (1-10)',
          '100point': '100-point scale (0-100)'
        };

        const scaleDesc = scaleDescriptions[scaleType] || scaleType;

        prompt = `You are a research methods expert helping define a qualitative coding variable.

Variable Label: "${label}"
Scale Type: ${scaleDesc}

Please provide:
1. A clear, academic definition of this variable (2-3 sentences that operationalize what this variable measures)
2. Anchor definitions for each scale point that clearly differentiate between levels

Format your response as JSON:
{
  "definition": "...",
  "anchors": {
    "1": "...",
    "2": "...",
    ...
  }
}

For binary scales, use keys "0" and "1".
For 100-point scales, only provide anchors for "0" and "100" (endpoints).
Make the anchors specific and actionable so raters can reliably distinguish between levels.`;
      }

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Extract JSON from response (it might be wrapped in markdown code blocks)
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const suggestion = JSON.parse(jsonText);

      return {
        success: true,
        data: suggestion
      };

    } catch (error) {
      console.error('[ai:suggestVariableDefinition] Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate suggestions'
      };
    }
  });

  // ============================================
  // GLOBAL RATING VARIABLES IPC HANDLERS
  // ============================================

  ipcMain.handle('ai:createGlobalRatingVariable', async (event, variableData) => {
    try {
      const db = require('../database/db');
      const variableId = await db.createGlobalRatingVariable(variableData);

      return {
        success: true,
        variableId
      };

    } catch (error) {
      console.error('Create global rating variable error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('ai:getGlobalRatingVariables', async (event) => {
    try {
      const db = require('../database/db');
      const variables = await db.getGlobalRatingVariables();

      return {
        success: true,
        data: variables
      };

    } catch (error) {
      console.error('Get global rating variables error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('ai:deleteGlobalRatingVariable', async (event, variableId) => {
    try {
      const db = require('../database/db');
      await db.deleteGlobalRatingVariable(variableId);

      return {
        success: true
      };

    } catch (error) {
      console.error('Delete global rating variable error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}

module.exports = { registerAIHandlers };
