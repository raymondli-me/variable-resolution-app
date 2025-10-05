/**
 * PDF Collector
 *
 * Handles PDF file upload, text extraction, and excerpt creation.
 * Integrates with the multi-source architecture (items table).
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const { PDFChunker } = require('../services/pdf-chunker.js');

// pdfjs-dist v2.x has proper CommonJS support
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

class PDFCollector extends EventEmitter {
  constructor(db, userDataPath) {
    super();
    this.db = db;
    this.userDataPath = userDataPath;
    this.chunker = new PDFChunker();
  }

  /**
   * Extract text and metadata from PDF using pdfjs-dist
   * @param {Buffer} dataBuffer - PDF file buffer
   * @returns {Object} PDF data (text, metadata, page count)
   */
  async extractPDFData(dataBuffer) {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(dataBuffer),
      useSystemFonts: true,
      disableFontFace: false
    });

    const pdf = await loadingTask.promise;

    // Extract metadata
    const metadata = await pdf.getMetadata();

    // Extract text page by page
    let fullText = '';
    const pageTexts = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');

      fullText += pageText + '\n\n';
      pageTexts.push(pageText);
    }

    // Return in pdf-parse compatible format
    return {
      text: fullText.trim(),
      numpages: pdf.numPages,
      info: metadata.info || {},
      pageTexts: pageTexts // Extra: individual page texts
    };
  }

  /**
   * Upload and process a PDF file
   * @param {string} sourcePath - Path to PDF file
   * @param {number} collectionId - Collection ID to add PDF to
   * @param {Object} options - Processing options
   * @returns {Object} PDF data with excerpts
   */
  async uploadPDF(sourcePath, collectionId, options = {}) {
    const {
      chunkingStrategy = 'page', // 'page', 'semantic', 'fixed'
      chunkSize = 500, // words per chunk (for fixed strategy)
      title = null
    } = options;

    try {
      this.emit('status', 'Reading PDF file...');

      // Read PDF file
      const dataBuffer = await fs.readFile(sourcePath);

      // Extract metadata and text using pdfjs-dist
      this.emit('status', 'Extracting PDF metadata and text...');
      const pdfData = await this.extractPDFData(dataBuffer);

      // Extract metadata
      const metadata = {
        title: title || pdfData.info?.Title || path.basename(sourcePath, '.pdf'),
        author: pdfData.info?.Author || 'Unknown',
        num_pages: pdfData.numpages,
        file_size: dataBuffer.length,
        producer: pdfData.info?.Producer,
        creator: pdfData.info?.Creator,
        creation_date: pdfData.info?.CreationDate
      };

      this.emit('status', `PDF loaded: ${metadata.num_pages} pages, ${(metadata.file_size / 1024).toFixed(1)} KB`);

      // Create collection directory
      const collectionDir = path.join(this.userDataPath, 'collections', collectionId.toString(), 'pdfs');
      await fs.mkdir(collectionDir, { recursive: true });

      // Copy PDF file to collection directory
      const fileName = `${Date.now()}_${path.basename(sourcePath)}`;
      const destPath = path.join(collectionDir, fileName);
      await fs.copyFile(sourcePath, destPath);

      this.emit('status', 'Saving PDF metadata to database...');

      // Save PDF metadata to database
      const pdfResult = await this.db.run(`
        INSERT INTO pdfs (
          collection_id, file_path, title, author,
          num_pages, file_size, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        collectionId,
        destPath,
        metadata.title,
        metadata.author,
        metadata.num_pages,
        metadata.file_size,
        JSON.stringify(metadata)
      ]);

      const pdfId = pdfResult.id;

      this.emit('status', `Chunking PDF using ${chunkingStrategy} strategy...`);

      // Chunk the PDF text
      let excerpts;
      if (chunkingStrategy === 'page') {
        excerpts = await this.chunker.chunkByPage(pdfData, sourcePath);
      } else if (chunkingStrategy === 'semantic') {
        excerpts = await this.chunker.chunkBySemantic(pdfData.text);
      } else if (chunkingStrategy === 'fixed') {
        excerpts = this.chunker.chunkBySize(pdfData.text, chunkSize);
      } else {
        throw new Error(`Unknown chunking strategy: ${chunkingStrategy}`);
      }

      this.emit('status', `Created ${excerpts.length} excerpts, saving to database...`);

      // Save excerpts to database
      let savedCount = 0;
      for (const excerpt of excerpts) {
        // Save to pdf_excerpts table
        const excerptResult = await this.db.run(`
          INSERT INTO pdf_excerpts (
            pdf_id, collection_id, excerpt_number, page_number,
            text_content, char_start, char_end, bbox
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          pdfId,
          collectionId,
          excerpt.excerpt_number,
          excerpt.page_number,
          excerpt.text_content,
          excerpt.char_start || null,
          excerpt.char_end || null,
          excerpt.bbox ? JSON.stringify(excerpt.bbox) : null
        ]);

        const excerptId = excerptResult.id;

        // Save to items table (unified abstraction)
        await this.db.run(`
          INSERT INTO items (
            id, collection_id, item_type, text_content, metadata
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          `pdf:${excerptId}`,
          collectionId,
          'pdf_excerpt',
          excerpt.text_content,
          JSON.stringify({
            pdf_id: pdfId,
            excerpt_number: excerpt.excerpt_number,
            page_number: excerpt.page_number,
            pdf_title: metadata.title
          })
        ]);

        savedCount++;
        if (savedCount % 10 === 0) {
          this.emit('progress', {
            current: savedCount,
            total: excerpts.length,
            percentage: Math.round((savedCount / excerpts.length) * 100)
          });
        }
      }

      this.emit('status', `✓ PDF processed successfully`);
      this.emit('complete', {
        pdfId,
        metadata,
        excerptCount: excerpts.length,
        filePath: destPath
      });

      return {
        pdfId,
        metadata,
        excerpts: excerpts.length,
        filePath: destPath
      };

    } catch (error) {
      this.emit('error', error);
      throw new Error(`PDF upload failed: ${error.message}`);
    }
  }

  /**
   * Get all PDFs in a collection
   */
  async getPDFsForCollection(collectionId) {
    return await this.db.all(`
      SELECT * FROM pdfs WHERE collection_id = ?
    `, [collectionId]);
  }

  /**
   * Get all excerpts for a PDF
   */
  async getExcerptsForPDF(pdfId) {
    return await this.db.all(`
      SELECT * FROM pdf_excerpts WHERE pdf_id = ?
      ORDER BY excerpt_number ASC
    `, [pdfId]);
  }

  /**
   * Get PDF metadata by ID
   */
  async getPDF(pdfId) {
    return await this.db.get(`
      SELECT * FROM pdfs WHERE id = ?
    `, [pdfId]);
  }

  /**
   * Delete a PDF and all its excerpts
   */
  async deletePDF(pdfId) {
    const pdf = await this.getPDF(pdfId);
    if (!pdf) {
      throw new Error('PDF not found');
    }

    // Delete file
    try {
      await fs.unlink(pdf.file_path);
    } catch (error) {
      console.warn('Failed to delete PDF file:', error.message);
    }

    // Delete from items table
    await this.db.run(`
      DELETE FROM items
      WHERE item_type = 'pdf_excerpt'
      AND id IN (
        SELECT 'pdf:' || id FROM pdf_excerpts WHERE pdf_id = ?
      )
    `, [pdfId]);

    // Delete from pdf_excerpts (cascades to pdfs)
    await this.db.run(`DELETE FROM pdf_excerpts WHERE pdf_id = ?`, [pdfId]);
    await this.db.run(`DELETE FROM pdfs WHERE id = ?`, [pdfId]);

    this.emit('deleted', pdfId);
  }
}

module.exports = { PDFCollector };
