const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');  // npm package for ZIP extraction

class CollectionImporter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Import collection from JSON file
   * @param {string} importFilePath - Path to JSON export file
   * @param {Object} options - { strategy, targetFolder }
   * @returns {Promise<Object>} Import result with new collection ID
   */
  async importCollectionJSON(importFilePath, options = {}) {
    const {
      strategy = 'duplicate',  // 'new', 'merge', 'replace', 'skip', 'duplicate'
      targetFolderId = null
    } = options;

    // Read and parse JSON
    const fileContent = await fs.readFile(importFilePath, 'utf8');
    const importData = JSON.parse(fileContent);

    // Validate format
    if (importData.format_version !== "2.0") {
      throw new Error(`Unsupported format version: ${importData.format_version}`);
    }

    // Check for conflicts
    const conflicts = await this.detectConflicts(importData);

    // Apply resolution strategy
    const resolution = this.resolveConflicts(conflicts, strategy);

    // Perform import with ID remapping
    const result = await this.performImport(importData, resolution, targetFolderId);

    // Track import in database
    await this.trackImport(importData, result, strategy, importFilePath);

    return result;
  }

  /**
   * Import folder bundle from ZIP
   */
  async importFolderZIP(zipFilePath, options = {}) {
    // Extract ZIP to temp directory
    const tempDir = path.join(path.dirname(zipFilePath), `temp_import_${Date.now()}`);
    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(tempDir, true);

    // Read manifest
    const manifestPath = path.join(tempDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    // Import each collection
    const results = [];
    for (const collectionInfo of manifest.collections) {
      const jsonPath = path.join(tempDir, 'collections', collectionInfo.filename);
      const result = await this.importCollectionJSON(jsonPath, options);
      results.push(result);
    }

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true });

    return {
      folder: manifest.folder,
      collections: results,
      total_imported: results.length
    };
  }

  /**
   * Detect conflicts between import data and existing database
   */
  async detectConflicts(importData) {
    const conflicts = {
      collection_uuid: null,
      collection_name: null,
      pdf_uuids: [],
      folder_path: null
    };

    // Check if collection UUID already exists
    const existingByUUID = await this.db.get(
      'SELECT id FROM collections WHERE uuid = ?',
      [importData.collection.uuid]
    );
    if (existingByUUID) {
      conflicts.collection_uuid = existingByUUID.id;
    }

    // Check if collection name already exists
    const existingByName = await this.db.get(
      'SELECT id FROM collections WHERE search_term = ?',
      [importData.collection.name]
    );
    if (existingByName) {
      conflicts.collection_name = existingByName.id;
    }

    // Check for PDF conflicts
    for (const pdf of importData.dependencies.pdfs || []) {
      const existing = await this.db.get(
        'SELECT id FROM pdfs WHERE uuid = ? OR file_path = ?',
        [pdf.uuid, pdf.file_path]
      );
      if (existing) {
        conflicts.pdf_uuids.push({ importId: pdf.id, existingId: existing.id });
      }
    }

    // Check if folder path exists
    if (importData.collection.folder_path) {
      // Parse folder path (e.g., "/Research/CTE Study/2025")
      const pathParts = importData.collection.folder_path.split('/').filter(p => p);

      let currentParentId = null;
      let folderExists = true;

      for (const folderName of pathParts) {
        // Check if folder exists
        const existing = await this.db.get(
          'SELECT id FROM folders WHERE name = ? AND parent_folder_id IS ?',
          [folderName, currentParentId]
        );

        if (existing) {
          currentParentId = existing.id;
        } else {
          // Folder doesn't exist - will need to create it during import
          folderExists = false;
          break;
        }
      }

      conflicts.folder_path = {
        path: importData.collection.folder_path,
        exists: folderExists,
        folderId: folderExists ? currentParentId : null
      };
    }

    return conflicts;
  }

  /**
   * Resolve conflicts based on strategy
   */
  resolveConflicts(conflicts, strategy) {
    const resolution = {
      action: strategy,  // 'new', 'merge', 'replace', 'skip', 'duplicate'
      idMapping: {},
      warnings: []
    };

    switch (strategy) {
      case 'skip':
        if (conflicts.collection_uuid) {
          resolution.action = 'skip';
          resolution.warnings.push('Collection already exists (same UUID). Skipping import.');
        }
        break;

      case 'duplicate':
        // Always create new, even if UUID exists
        // Will generate new UUID
        resolution.action = 'new';
        break;

      case 'merge':
        // Combine items from import with existing collection
        if (conflicts.collection_uuid) {
          resolution.targetCollectionId = conflicts.collection_uuid;
        }
        break;

      case 'replace':
        // Delete existing collection and import new
        if (conflicts.collection_uuid) {
          resolution.deleteCollectionId = conflicts.collection_uuid;
        }
        break;

      case 'new':
      default:
        // Create new collection with new ID
        break;
    }

    return resolution;
  }

  /**
   * Perform the actual import with ID remapping
   */
  async performImport(importData, resolution, targetFolderId) {
    const idMap = {};

    // Skip if strategy says so
    if (resolution.action === 'skip') {
      return {
        success: false,
        message: 'Import skipped due to conflicts',
        warnings: resolution.warnings
      };
    }

    // Delete existing if replace strategy
    if (resolution.deleteCollectionId) {
      await this.db.run('DELETE FROM collections WHERE id = ?', [resolution.deleteCollectionId]);
    }

    // Import PDFs first (they need to exist before items reference them)
    for (const pdf of importData.dependencies.pdfs || []) {
      const existingPdf = await this.db.get(
        'SELECT id FROM pdfs WHERE uuid = ?',
        [pdf.uuid]
      );

      if (existingPdf) {
        // PDF already exists, reuse it
        idMap[`pdf_${pdf.id}`] = existingPdf.id;
      } else {
        // Create new PDF
        const newPdfId = await this.db.run(`
          INSERT INTO pdfs (
            uuid, title, author, file_path, num_pages, file_size, metadata, collection_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          pdf.uuid || crypto.randomUUID(),
          pdf.title,
          pdf.author,
          pdf.file_path,
          pdf.num_pages,
          pdf.file_size_mb * 1024 * 1024,
          JSON.stringify(pdf.metadata),
          null  // Will be set when collection is created
        ]);

        idMap[`pdf_${pdf.id}`] = newPdfId.id;
      }
    }

    // Determine final folder ID (either targetFolderId or recreate folder structure)
    let finalFolderId = targetFolderId;

    if (importData.collection.folder_path && !targetFolderId) {
      // Recreate folder structure
      const pathParts = importData.collection.folder_path.split('/').filter(p => p);
      let currentParentId = null;

      for (const folderName of pathParts) {
        const existing = await this.db.get(
          'SELECT id FROM folders WHERE name = ? AND parent_folder_id IS ?',
          [folderName, currentParentId]
        );

        if (existing) {
          currentParentId = existing.id;
        } else {
          // Create folder
          const result = await this.db.run(`
            INSERT INTO folders (name, parent_folder_id, color)
            VALUES (?, ?, ?)
          `, [folderName, currentParentId, '#6366f1']);
          currentParentId = result.lastID;
        }
      }

      finalFolderId = currentParentId;
    }

    // Create collection
    const newCollectionUUID = resolution.action === 'duplicate'
      ? crypto.randomUUID()
      : importData.collection.uuid;

    const newCollectionId = await this.db.run(`
      INSERT INTO collections (
        uuid, search_term, folder_id, archived, starred,
        source_type, derivation_method, derivation_params,
        video_count, comment_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newCollectionUUID,
      importData.collection.name,
      finalFolderId,
      importData.collection.archived ? 1 : 0,
      importData.collection.starred ? 1 : 0,
      importData.collection.source_type || 'youtube',
      importData.collection.derivation_method,
      importData.collection.derivation_params
        ? JSON.stringify(importData.collection.derivation_params)
        : null,
      importData.collection.video_count || 0,
      importData.collection.comment_count || 0,
      importData.collection.created_at
    ]);

    idMap[`collection_${importData.collection.id}`] = newCollectionId.id;

    // Import items with remapped IDs
    for (const item of importData.items) {
      await this.importItem(item, newCollectionId.id, idMap);
    }

    return {
      success: true,
      newCollectionId: newCollectionId.id,
      idMapping: idMap,
      itemsImported: importData.items.length,
      warnings: resolution.warnings
    };
  }

  /**
   * Import a single item with remapped IDs
   */
  async importItem(item, collectionId, idMap) {
    if (item.item_type === 'pdf_excerpt') {
      const remappedPdfId = idMap[`pdf_${item.source_metadata.pdf_id}`];

      await this.db.run(`
        INSERT INTO pdf_excerpts (
          pdf_id, collection_id, excerpt_number, page_number,
          text_content, char_start, char_end
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        remappedPdfId,
        collectionId,
        item.source_metadata.excerpt_number,
        item.source_metadata.page_number,
        item.text_content,
        0,  // char_start (not in export, default to 0)
        item.text_content.length  // char_end
      ]);
    }

    else if (item.item_type === 'video_chunk') {
      // First, ensure the video exists
      let videoId = null;

      // Check if video exists by YouTube video_id
      const existingVideo = await this.db.get(
        'SELECT id FROM videos WHERE video_id = ?',
        [item.source_metadata.video_id]
      );

      if (existingVideo) {
        videoId = existingVideo.id;
      } else {
        // Create placeholder video entry
        const result = await this.db.run(`
          INSERT INTO videos (
            video_id, title, channel_title, published_at
          ) VALUES (?, ?, ?, ?)
        `, [
          item.source_metadata.video_id || 'imported_' + crypto.randomUUID(),
          item.source_metadata.video_title || 'Imported Video',
          item.source_metadata.channel_title || 'Unknown Channel',
          new Date().toISOString()
        ]);
        videoId = result.lastID;
      }

      // Create video chunk
      await this.db.run(`
        INSERT INTO video_chunks (
          video_id, collection_id, chunk_number,
          start_time, end_time, transcript_text, file_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        videoId,
        collectionId,
        item.source_metadata.chunk_number || 0,
        item.source_metadata.start_time || 0,
        item.source_metadata.end_time || 0,
        item.text_content,
        item.source_metadata.file_path || null
      ]);
    }

    else if (item.item_type === 'comment') {
      // First, ensure the video exists
      let videoId = null;

      // Check if video exists by YouTube video_id
      const existingVideo = await this.db.get(
        'SELECT id FROM videos WHERE video_id = ?',
        [item.source_metadata.video_id]
      );

      if (existingVideo) {
        videoId = existingVideo.id;
      } else {
        // Create placeholder video entry
        const result = await this.db.run(`
          INSERT INTO videos (
            video_id, title, channel_title, published_at
          ) VALUES (?, ?, ?, ?)
        `, [
          item.source_metadata.video_id || 'imported_' + crypto.randomUUID(),
          item.source_metadata.video_title || 'Imported Video',
          'Unknown Channel',
          new Date().toISOString()
        ]);
        videoId = result.lastID;
      }

      // Create comment
      await this.db.run(`
        INSERT INTO comments (
          video_id, collection_id, comment_id,
          text, author_name, like_count
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        videoId,
        collectionId,
        'imported_' + crypto.randomUUID(),
        item.text_content,
        item.source_metadata.author_name || 'Unknown',
        item.source_metadata.like_count || 0
      ]);
    }

    else {
      console.warn(`Unknown item type: ${item.item_type}`);
    }
  }

  /**
   * Track import in database
   */
  async trackImport(importData, result, strategy, importFilePath) {
    await this.db.run(`
      INSERT INTO collection_imports (
        source_uuid, source_name, source_folder_path,
        target_collection_id, import_strategy,
        id_remapping, items_imported, warnings, import_file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      importData.export_uuid,
      importData.collection.name,
      importData.collection.folder_path,
      result.newCollectionId,
      strategy,
      JSON.stringify(result.idMapping),
      result.itemsImported,
      JSON.stringify(result.warnings),
      importFilePath
    ]);
  }
}

module.exports = CollectionImporter;
