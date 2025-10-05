/**
 * PDF Chunker Service
 *
 * Handles intelligent PDF text chunking with multiple strategies:
 * - Page-based: One chunk per page
 * - Semantic: Paragraph/section-based chunks
 * - Fixed-size: Fixed word count chunks
 */

class PDFChunker {
  /**
   * Chunk PDF by page (simplest, recommended for start)
   * @param {Object} pdfData - PDF data from pdfjs-dist or pdf-parse
   * @param {string} pdfPath - Path to PDF file (unused but kept for compatibility)
   * @returns {Array} Array of excerpt objects
   */
  async chunkByPage(pdfData, pdfPath) {
    const excerpts = [];
    const numPages = pdfData.numpages;

    // If pdfjs-dist provided individual page texts, use them directly
    if (pdfData.pageTexts && Array.isArray(pdfData.pageTexts)) {
      // Use accurate page-by-page text from pdfjs-dist
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const pageText = pdfData.pageTexts[pageNum - 1].trim();

        if (pageText.length > 0) {
          excerpts.push({
            excerpt_number: pageNum,
            page_number: pageNum,
            text_content: pageText,
            char_start: null,
            char_end: null,
            bbox: {
              page: pageNum,
              x: 0,
              y: 0,
              width: 612, // Standard letter width in points
              height: 792  // Standard letter height in points
            }
          });
        }
      }
    } else {
      // Fallback: approximate splitting (legacy behavior)
      const text = pdfData.text;
      const avgCharsPerPage = Math.ceil(text.length / numPages);

      let currentPos = 0;
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        let endPos = Math.min(currentPos + avgCharsPerPage, text.length);

        // Try to break at paragraph boundary
        if (endPos < text.length) {
          const nextBreak = text.indexOf('\n\n', endPos);
          if (nextBreak !== -1 && nextBreak < endPos + 200) {
            endPos = nextBreak;
          }
        }

        const pageText = text.substring(currentPos, endPos).trim();

        if (pageText.length > 0) {
          excerpts.push({
            excerpt_number: pageNum,
            page_number: pageNum,
            text_content: pageText,
            char_start: currentPos,
            char_end: endPos,
            bbox: {
              page: pageNum,
              x: 0,
              y: 0,
              width: 612,
              height: 792
            }
          });
        }

        currentPos = endPos;
      }
    }

    return excerpts;
  }

  /**
   * Chunk PDF by semantic boundaries (paragraphs)
   * @param {string} text - Full PDF text
   * @returns {Array} Array of excerpt objects
   */
  async chunkBySemantic(text) {
    const excerpts = [];

    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    let excerptNumber = 1;
    let currentPos = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();

      // Skip very short paragraphs (likely headers or artifacts)
      if (trimmedParagraph.length < 50) {
        currentPos += paragraph.length + 2; // +2 for \n\n
        continue;
      }

      excerpts.push({
        excerpt_number: excerptNumber,
        page_number: null, // Unknown for semantic chunks
        text_content: trimmedParagraph,
        char_start: currentPos,
        char_end: currentPos + trimmedParagraph.length,
        bbox: null
      });

      excerptNumber++;
      currentPos += paragraph.length + 2; // +2 for \n\n
    }

    return excerpts;
  }

  /**
   * Chunk PDF by fixed word count
   * @param {string} text - Full PDF text
   * @param {number} wordsPerChunk - Words per chunk
   * @returns {Array} Array of excerpt objects
   */
  chunkBySize(text, wordsPerChunk = 500) {
    const excerpts = [];
    const words = text.split(/\s+/);

    let excerptNumber = 1;
    let currentPos = 0;

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const chunkText = chunkWords.join(' ');

      excerpts.push({
        excerpt_number: excerptNumber,
        page_number: null,
        text_content: chunkText,
        char_start: currentPos,
        char_end: currentPos + chunkText.length,
        bbox: null
      });

      excerptNumber++;
      currentPos += chunkText.length + 1; // +1 for space
    }

    return excerpts;
  }

  /**
   * Extract bounding box for a text span (advanced - requires PDF.js)
   * This is a placeholder for future implementation with PDF.js
   * @param {string} pdfPath - Path to PDF file
   * @param {number} pageNum - Page number
   * @param {number} charStart - Character start position
   * @param {number} charEnd - Character end position
   * @returns {Object} Bounding box {x, y, width, height, page}
   */
  async extractBoundingBox(pdfPath, pageNum, charStart, charEnd) {
    // TODO: Implement with PDF.js for accurate bounding boxes
    // For now, return a default full-page bounding box
    return {
      page: pageNum,
      x: 0,
      y: 0,
      width: 612,
      height: 792
    };
  }
}

module.exports = { PDFChunker };
