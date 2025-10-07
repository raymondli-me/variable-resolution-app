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
}

module.exports = { registerPDFHandlers };
