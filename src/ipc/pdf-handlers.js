const { ipcMain, app } = require('electron');

/**
 * Register all PDF-related IPC handlers
 * @param {Function} getDatabase - Database instance getter function (not used, kept for consistency)
 */
function registerPDFHandlers(getDatabase) {
  // ============================================
  // PDF MANAGEMENT IPC HANDLERS
  // ============================================

  ipcMain.handle('pdf:upload', async (event, { filePath, collectionId, title, chunkingStrategy, chunkSize }) => {
    try {
      const db = require('../database/db');
      const { PDFCollector } = require('../collectors/pdf-collector');

      // Initialize PDF collector
      const pdfCollector = new PDFCollector(db, app.getPath('userData'));

      // Upload and process PDF
      const result = await pdfCollector.uploadPDF(filePath, collectionId, {
        title,
        chunkingStrategy,
        chunkSize
      });

      // CRITICAL FIX: Update collection's video_count to show excerpt count
      const dbInstance = await require('../database/db').getDatabase();
      const totalExcerpts = await dbInstance.get(
        'SELECT COUNT(*) as count FROM pdf_excerpts WHERE collection_id = ?',
        [collectionId]
      );
      await dbInstance.run(
        'UPDATE collections SET video_count = ? WHERE id = ?',
        [totalExcerpts.count, collectionId]
      );

      return {
        success: true,
        pdfId: result.pdfId,
        metadata: result.metadata,
        excerpts: result.excerpts,
        filePath: result.filePath
      };

    } catch (error) {
      console.error('PDF upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:list', async (event, collectionId) => {
    try {
      const db = require('../database/db');

      const pdfs = await db.all(`
        SELECT
          p.*,
          COUNT(pe.id) as excerpts_count
        FROM pdfs p
        LEFT JOIN pdf_excerpts pe ON p.id = pe.pdf_id
        WHERE p.collection_id = ?
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, [collectionId]);

      return {
        success: true,
        pdfs
      };

    } catch (error) {
      console.error('PDF list error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getExcerpts', async (event, pdfId) => {
    try {
      const db = require('../database/db');

      const excerpts = await db.all(`
        SELECT * FROM pdf_excerpts
        WHERE pdf_id = ?
        ORDER BY excerpt_number ASC
      `, [pdfId]);

      return {
        success: true,
        data: excerpts  // Fixed: renamed 'excerpts' to 'data' for API consistency
      };

    } catch (error) {
      console.error('PDF excerpts error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:delete', async (event, pdfId) => {
    try {
      const db = require('../database/db');
      const { PDFCollector } = require('../collectors/pdf-collector');

      const pdfCollector = new PDFCollector(db, app.getPath('userData'));
      await pdfCollector.deletePDF(pdfId);

      return {
        success: true
      };

    } catch (error) {
      console.error('PDF delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getFilePath', async (event, pdfId) => {
    try {
      const db = require('../database/db');

      const pdf = await db.get('SELECT file_path FROM pdfs WHERE id = ?', [pdfId]);

      if (!pdf) {
        return {
          success: false,
          error: 'PDF not found'
        };
      }

      return {
        success: true,
        filePath: pdf.file_path
      };

    } catch (error) {
      console.error('PDF getFilePath error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:generatePageImage', async (event, { pdfPath, pageNumber, bbox, excerptId, scale }) => {
    try {
      console.log(`[Main] Generating page image for ${pdfPath} page ${pageNumber}...`);

      // Execute image generation in the renderer process (which has access to browser APIs)
      const result = await event.sender.executeJavaScript(`
        (async () => {
          try {
            const generator = window.PDFPageImageGenerator;
            if (!generator) {
              throw new Error('PDFPageImageGenerator not available');
            }

            const result = await generator.generatePageImage(
              ${JSON.stringify(pdfPath)},
              ${pageNumber},
              ${JSON.stringify(bbox)},
              ${JSON.stringify(excerptId)},
              ${scale || 2.0}
            );

            return { success: true, ...result };
          } catch (error) {
            return { success: false, error: error.message };
          }
        })()
      `);

      return result;

    } catch (error) {
      console.error('[Main] Error generating page image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // RATING VARIABLES IPC HANDLERS
  // ============================================

  ipcMain.handle('pdf:createRatingVariable', async (event, variableData) => {
    try {
      const db = require('../database/db');
      const variableId = await db.createRatingVariable(variableData);

      return {
        success: true,
        variableId
      };

    } catch (error) {
      console.error('Create rating variable error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getRatingVariables', async (event, collectionId) => {
    try {
      const db = require('../database/db');
      const variables = await db.getRatingVariables(collectionId);

      return {
        success: true,
        data: variables
      };

    } catch (error) {
      console.error('Get rating variables error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getRatingVariable', async (event, variableId) => {
    try {
      const db = require('../database/db');
      const variable = await db.getRatingVariable(variableId);

      return {
        success: true,
        data: variable
      };

    } catch (error) {
      console.error('Get rating variable error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:updateRatingVariable', async (event, { variableId, updates }) => {
    try {
      const db = require('../database/db');
      await db.updateRatingVariable(variableId, updates);

      return {
        success: true
      };

    } catch (error) {
      console.error('Update rating variable error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:deleteRatingVariable', async (event, variableId) => {
    try {
      const db = require('../database/db');
      await db.deleteRatingVariable(variableId);

      return {
        success: true
      };

    } catch (error) {
      console.error('Delete rating variable error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // EXCERPT RATINGS IPC HANDLERS
  // ============================================

  ipcMain.handle('pdf:saveExcerptRating', async (event, ratingData) => {
    try {
      const db = require('../database/db');
      const ratingId = await db.saveExcerptRating(ratingData);

      return {
        success: true,
        ratingId
      };

    } catch (error) {
      console.error('Save excerpt rating error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getExcerptRatings', async (event, excerptId) => {
    try {
      const db = require('../database/db');
      const ratings = await db.getExcerptRatings(excerptId);

      return {
        success: true,
        data: ratings
      };

    } catch (error) {
      console.error('Get excerpt ratings error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getExcerptRating', async (event, { excerptId, variableId }) => {
    try {
      const db = require('../database/db');
      const rating = await db.getExcerptRating(excerptId, variableId);

      return {
        success: true,
        data: rating
      };

    } catch (error) {
      console.error('Get excerpt rating error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // AI EXCERPT RATINGS IPC HANDLERS
  ipcMain.handle('pdf:saveAIExcerptRating', async (event, ratingData) => {
    try {
      const db = require('../database/db');
      const ratingId = await db.saveAIExcerptRating(ratingData);

      return {
        success: true,
        ratingId
      };

    } catch (error) {
      console.error('Save AI excerpt rating error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getAIExcerptRating', async (event, { excerptId, variableId }) => {
    try {
      const db = require('../database/db');
      const rating = await db.getAIExcerptRating(excerptId, variableId);

      return {
        success: true,
        data: rating
      };

    } catch (error) {
      console.error('Get AI excerpt rating error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getAIRatingsForPDF', async (event, { pdfId, variableId }) => {
    try {
      const db = require('../database/db');
      const ratings = await db.getAIRatingsForPDF(pdfId, variableId);

      return {
        success: true,
        data: ratings
      };

    } catch (error) {
      console.error('Get AI ratings for PDF error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getAIExcerptRatingHistory', async (event, { excerptId, variableId }) => {
    try {
      const db = require('../database/db');
      const history = await db.getAIExcerptRatingHistory(excerptId, variableId);

      return {
        success: true,
        data: history
      };

    } catch (error) {
      console.error('Get AI excerpt rating history error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:countAIRatingsForPDF', async (event, { pdfId, variableId }) => {
    try {
      const db = require('../database/db');
      const count = await db.countAIRatingsForPDF(pdfId, variableId);

      return {
        success: true,
        count
      };

    } catch (error) {
      console.error('Count AI ratings for PDF error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:countHumanRatingsForPDF', async (event, { pdfId, variableId }) => {
    try {
      const db = require('../database/db');
      const count = await db.countHumanRatingsForPDF(pdfId, variableId);

      return {
        success: true,
        count
      };

    } catch (error) {
      console.error('Count human ratings for PDF error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getRatingsByVariable', async (event, variableId) => {
    try {
      const db = require('../database/db');
      const ratings = await db.getRatingsByVariable(variableId);

      return {
        success: true,
        data: ratings
      };

    } catch (error) {
      console.error('Get ratings by variable error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:deleteExcerptRating', async (event, { excerptId, variableId }) => {
    try {
      const db = require('../database/db');
      await db.deleteExcerptRating(excerptId, variableId);

      return {
        success: true
      };

    } catch (error) {
      console.error('Delete excerpt rating error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('pdf:getVariableRatingStats', async (event, variableId) => {
    try {
      const db = require('../database/db');
      const stats = await db.getVariableRatingStats(variableId);

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('Get variable rating stats error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}

module.exports = { registerPDFHandlers };
