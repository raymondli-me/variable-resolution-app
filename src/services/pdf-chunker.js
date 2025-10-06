/**
 * PDF Chunker Service
 *
 * Handles intelligent PDF text chunking with multiple strategies:
 * - Page-based: One chunk per page
 * - Semantic: Paragraph/section-based chunks
 * - Fixed-size: Fixed word count chunks
 * - Sentence-based: Sentence-level chunks with bounding boxes (NEW!)
 */

const nlp = require('compromise');

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

  /**
   * Chunk PDF by sentences with bounding box extraction
   * This is the GAME-CHANGING feature for visual PDF viewing!
   *
   * @param {Object} pdfData - Enhanced PDF data with textItems per page
   * @param {string} pdfPath - Path to PDF file (for reference)
   * @returns {Array} Array of sentence-level excerpt objects with accurate bboxes
   */
  async chunkBySentence(pdfData, pdfPath) {
    const excerpts = [];
    let excerptNumber = 1;

    console.log(`[PDFChunker] Starting sentence-level chunking for ${pdfData.numpages} pages`);

    // Process each page
    for (let pageNum = 1; pageNum <= pdfData.numpages; pageNum++) {
      // Get text items for this page (with position information)
      const textItems = pdfData.pageTextItems && pdfData.pageTextItems[pageNum - 1];

      if (!textItems || textItems.length === 0) {
        console.log(`[PDFChunker] Page ${pageNum} has no text items, skipping`);
        continue;
      }

      // Concatenate all text items to get full page text
      const pageText = textItems.map(item => item.str).join(' ');

      // Segment into sentences using compromise NLP
      const sentences = nlp(pageText).sentences().out('array');

      console.log(`[PDFChunker] Page ${pageNum}: Found ${sentences.length} sentences`);

      // For each sentence, find corresponding text items and calculate bbox
      for (const sentenceText of sentences) {
        // Skip very short sentences (likely artifacts)
        if (sentenceText.trim().length < 10) {
          continue;
        }

        // Find text items that make up this sentence
        const bbox = this.findSentenceBbox(sentenceText, textItems, pageText);

        if (bbox) {
          excerpts.push({
            excerpt_number: excerptNumber,
            page_number: pageNum,
            text_content: sentenceText.trim(),
            char_start: null, // Not needed for sentence-based
            char_end: null,
            bbox: bbox
          });

          excerptNumber++;
        }
      }
    }

    console.log(`[PDFChunker] Sentence chunking complete: ${excerpts.length} excerpts created`);
    return excerpts;
  }

  /**
   * Find bounding box for a sentence by matching it to text items
   * @param {string} sentenceText - The sentence to find
   * @param {Array} textItems - Array of text items with position info from PDF.js
   * @param {string} pageText - Full page text for reference
   * @returns {Object} Bounding box {x, y, width, height, page}
   */
  findSentenceBbox(sentenceText, textItems, pageText) {
    // Find where the sentence starts in the page text
    const sentenceStart = pageText.indexOf(sentenceText);

    if (sentenceStart === -1) {
      // Sentence not found (might be due to text extraction differences)
      // Return null to skip this sentence
      return null;
    }

    const sentenceEnd = sentenceStart + sentenceText.length;

    // Find which text items correspond to this sentence
    let currentPos = 0;
    const matchingItems = [];

    for (const item of textItems) {
      const itemStart = currentPos;
      const itemEnd = currentPos + item.str.length + 1; // +1 for space

      // Check if this item overlaps with the sentence
      if (itemEnd > sentenceStart && itemStart < sentenceEnd) {
        matchingItems.push(item);
      }

      currentPos = itemEnd;

      // Stop once we've passed the sentence
      if (itemStart > sentenceEnd) {
        break;
      }
    }

    if (matchingItems.length === 0) {
      return null;
    }

    // Merge bounding boxes of all matching items
    return this.mergeBboxes(matchingItems);
  }

  /**
   * Merge bounding boxes from multiple text items
   * @param {Array} textItems - Array of text items with transform and dimensions
   * @returns {Object} Merged bounding box
   */
  mergeBboxes(textItems) {
    if (textItems.length === 0) {
      return null;
    }

    // Extract coordinates from each text item
    // PDF.js format: item.transform = [scaleX, skewY, skewX, scaleY, x, y]
    const bboxes = textItems.map(item => {
      const x = item.transform[4];
      const y = item.transform[5];
      const width = item.width || 0;
      const height = item.height || 12; // Default height if not provided

      return { x, y, width, height };
    });

    // Find the bounding rectangle that contains all items
    const minX = Math.min(...bboxes.map(b => b.x));
    const minY = Math.min(...bboxes.map(b => b.y));
    const maxX = Math.max(...bboxes.map(b => b.x + b.width));
    const maxY = Math.max(...bboxes.map(b => b.y + b.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}

module.exports = { PDFChunker };
