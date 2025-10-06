const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');  // npm package for ZIP creation

class CollectionExporter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Export single collection to JSON format
   * @param {number} collectionId
   * @param {string} outputPath - Full file path for export (e.g., /path/to/file.json)
   * @param {Object} options - { includeDependencies, includeAssets }
   * @returns {Promise<string>} Path to exported file
   */
  async exportCollectionJSON(collectionId, outputPath, options = {}) {
    const {
      includeDependencies = true,
      includeAssets = true
    } = options;

    // Build export data using helper method
    const exportData = await this.buildCollectionExportData(collectionId, includeDependencies);

    // Use outputPath as the complete file path (not as a directory)
    const filepath = outputPath;

    // Ensure parent directory exists
    const parentDir = path.dirname(filepath);
    await fs.mkdir(parentDir, { recursive: true });

    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2), 'utf8');

    // Track export in database
    await this.trackExport(collectionId, filepath, 'json', exportData.export_uuid, includeDependencies, includeAssets);

    return filepath;
  }

  /**
   * Export folder (multiple collections) to ZIP bundle
   * @param {number} folderId
   * @param {string} outputPath - Full file path for ZIP export (e.g., /path/to/file.zip)
   * @param {Object} options
   */
  async exportFolderZIP(folderId, outputPath, options = {}) {
    // Get folder info
    const folder = await this.db.getFolder(folderId);
    const folderPath = await this.db.getFolderPath(folderId);

    // Get all collections in folder (recursive)
    const collections = await this.getCollectionsInFolderRecursive(folderId);

    // Create temp directory for export preparation (use system temp, not outputPath)
    const os = require('os');
    const tempDir = path.join(os.tmpdir(), `vr-export-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(path.join(tempDir, 'collections'), { recursive: true });

    // Export each collection to JSON in temp dir
    const collectionManifest = [];
    for (const collection of collections) {
      const jsonPath = path.join(tempDir, 'collections', `collection_${collection.id}.json`);

      // Export this collection to JSON
      const exportData = await this.buildCollectionExportData(collection.id, true);
      await fs.writeFile(jsonPath, JSON.stringify(exportData, null, 2), 'utf8');

      collectionManifest.push({
        filename: `collection_${collection.id}.json`,
        uuid: collection.uuid,
        name: collection.search_term,
        item_count: exportData.items.length
      });
    }

    // Note: Asset copying (PDF/video files) is deferred to Phase 1 for simplicity
    // ZIP bundle will contain collection metadata only, not the actual media files

    // Create manifest.json
    const manifest = {
      format_version: "2.0",
      export_type: "folder",
      export_uuid: crypto.randomUUID(),
      exported_at: new Date().toISOString(),
      folder: {
        name: folder.name,
        path: folderPath,
        description: folder.description,
        color: folder.color
      },
      collections: collectionManifest
    };
    await fs.writeFile(
      path.join(tempDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // Create README.txt
    const readme = this.generateREADME(manifest);
    await fs.writeFile(path.join(tempDir, 'README.txt'), readme, 'utf8');

    // Create ZIP file at the specified outputPath
    // Ensure parent directory exists
    const parentDir = path.dirname(outputPath);
    await fs.mkdir(parentDir, { recursive: true });

    await this.createZIP(tempDir, outputPath);

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true });

    return outputPath;
  }

  /**
   * Export full database (SQLite backup)
   * @param {string} outputPath - Full file path for database backup (e.g., /path/to/backup.db)
   */
  async exportFullDatabase(outputPath) {
    const dbPath = this.db.db.filename;  // Path to SQLite file

    // Ensure parent directory exists
    const parentDir = path.dirname(outputPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Simple file copy to the specified outputPath
    await fs.copyFile(dbPath, outputPath);

    return outputPath;
  }

  /**
   * Helper: Build export data for a collection (reusable for single exports and ZIP bundles)
   * @param {number} collectionId
   * @param {boolean} includeDependencies
   * @returns {Promise<Object>} Export data object
   */
  async buildCollectionExportData(collectionId, includeDependencies = true) {
    const collection = await this.db.getCollection(collectionId);
    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    // Get folder path if collection is in a folder
    let folderPath = null;
    if (collection.folder_id) {
      const pathResult = await this.db.getFolderPath(collection.folder_id);
      folderPath = pathResult;
    }

    // Get lineage (parent collections)
    const lineage = await this.getCollectionLineage(collectionId);

    // Get items
    const items = await this.getCollectionItems(collectionId);

    // Get dependencies
    const dependencies = await this.getCollectionDependencies(collectionId, items);

    // Calculate statistics
    const statistics = this.calculateStatistics(items);

    return {
      format_version: "2.0",
      export_type: "collection",
      export_uuid: crypto.randomUUID(),
      exported_at: new Date().toISOString(),
      exported_by: "Variable Resolution App v3.0",

      collection: {
        uuid: collection.uuid,
        id: collection.id,
        name: collection.search_term,
        search_term: collection.search_term,
        source_type: collection.source_type || 'youtube',
        derivation_method: collection.derivation_method,
        derivation_params: collection.derivation_params ? JSON.parse(collection.derivation_params) : null,
        folder_path: folderPath,
        created_at: collection.created_at,
        archived: collection.archived || false,
        starred: collection.starred || false,
        video_count: collection.video_count || 0,
        comment_count: collection.comment_count || 0,
        item_count: statistics.total_items
      },

      lineage: includeDependencies ? lineage : [],
      items: items,
      dependencies: includeDependencies ? dependencies : {},
      statistics: statistics
    };
  }

  /**
   * Helper: Get all collections in folder and subfolders recursively
   * @param {number} folderId - Root folder ID
   * @returns {Promise<Array>} Array of collection objects
   */
  async getCollectionsInFolderRecursive(folderId) {
    const collections = [];

    // Get collections in this folder
    const directCollections = await this.db.all(
      'SELECT * FROM collections WHERE folder_id = ? AND archived = 0',
      [folderId]
    );
    collections.push(...directCollections);

    // Get subfolders
    const subfolders = await this.db.all(
      'SELECT id FROM folders WHERE parent_folder_id = ? AND archived = 0',
      [folderId]
    );

    // Recursively get collections from subfolders
    for (const subfolder of subfolders) {
      const subCollections = await this.getCollectionsInFolderRecursive(subfolder.id);
      collections.push(...subCollections);
    }

    return collections;
  }

  /**
   * Helper: Get collection lineage (recursive parent chain)
   */
  async getCollectionLineage(collectionId) {
    const lineage = [];
    let current = await this.db.getCollection(collectionId);

    while (current.parent_collection_id) {
      const parent = await this.db.getCollection(current.parent_collection_id);
      lineage.unshift({
        uuid: parent.uuid,
        id: parent.id,
        name: parent.search_term,
        source_type: parent.source_type,
        derivation_method: parent.derivation_method,
        derivation_params: parent.derivation_params ? JSON.parse(parent.derivation_params) : null
      });
      current = parent;
    }

    return lineage;
  }

  /**
   * Helper: Get all items in collection
   */
  async getCollectionItems(collectionId) {
    // Query video_chunks, comments, pdf_excerpts for this collection
    // Return unified array with item_type, item_id, and full data
    const items = [];

    // Get videos/chunks
    const chunks = await this.db.all(`
      SELECT vc.*, v.title as video_title, v.channel_title
      FROM video_chunks vc
      JOIN videos v ON vc.video_id = v.id
      WHERE vc.collection_id = ?
    `, [collectionId]);

    for (const chunk of chunks) {
      items.push({
        item_type: 'video_chunk',
        item_id: chunk.id,
        text_content: chunk.transcript_text,
        source_metadata: {
          video_id: chunk.video_id,
          video_title: chunk.video_title,
          chunk_number: chunk.chunk_number,
          start_time: chunk.start_time,
          end_time: chunk.end_time,
          file_path: chunk.file_path
        }
      });
    }

    // Get comments
    const comments = await this.db.all(`
      SELECT c.*, v.title as video_title
      FROM comments c
      JOIN videos v ON c.video_id = v.id
      WHERE c.collection_id = ?
    `, [collectionId]);

    for (const comment of comments) {
      items.push({
        item_type: 'comment',
        item_id: comment.id,
        text_content: comment.text,
        source_metadata: {
          video_id: comment.video_id,
          video_title: comment.video_title,
          author_name: comment.author_name,
          like_count: comment.like_count
        }
      });
    }

    // Get PDF excerpts
    const excerpts = await this.db.all(`
      SELECT pe.*, pdf.title as pdf_title, pdf.uuid as pdf_uuid
      FROM pdf_excerpts pe
      JOIN pdfs pdf ON pe.pdf_id = pdf.id
      WHERE pe.collection_id = ?
    `, [collectionId]);

    for (const excerpt of excerpts) {
      items.push({
        item_type: 'pdf_excerpt',
        item_id: excerpt.id,
        text_content: excerpt.text_content,
        source_metadata: {
          pdf_id: excerpt.pdf_id,
          pdf_uuid: excerpt.pdf_uuid,
          pdf_title: excerpt.pdf_title,
          page_number: excerpt.page_number,
          excerpt_number: excerpt.excerpt_number
        }
      });
    }

    return items;
  }

  /**
   * Helper: Get dependencies (PDFs, videos)
   */
  async getCollectionDependencies(collectionId, items) {
    const dependencies = {
      pdfs: [],
      videos: [],
      parent_collections: []
    };

    // Get unique PDF IDs from items
    const pdfIds = [...new Set(
      items
        .filter(item => item.item_type === 'pdf_excerpt')
        .map(item => item.source_metadata.pdf_id)
    )];

    for (const pdfId of pdfIds) {
      const pdf = await this.db.get('SELECT * FROM pdfs WHERE id = ?', [pdfId]);
      dependencies.pdfs.push({
        uuid: pdf.uuid || crypto.randomUUID(),
        id: pdf.id,
        title: pdf.title,
        author: pdf.author,
        file_path: pdf.file_path,
        num_pages: pdf.num_pages,
        file_size_mb: pdf.file_size ? pdf.file_size / (1024 * 1024) : 0,
        metadata: pdf.metadata ? JSON.parse(pdf.metadata) : {}
      });
    }

    // Similarly for videos...

    return dependencies;
  }

  /**
   * Helper: Calculate statistics
   */
  calculateStatistics(items) {
    const typeBreakdown = {};
    const scores = [];

    for (const item of items) {
      typeBreakdown[item.item_type] = (typeBreakdown[item.item_type] || 0) + 1;
      if (item.relevance_score) scores.push(item.relevance_score);
    }

    const stats = {
      total_items: items.length,
      item_type_breakdown: typeBreakdown,
      score_distribution: null
    };

    if (scores.length > 0) {
      scores.sort((a, b) => a - b);
      stats.score_distribution = {
        min: Math.min(...scores),
        max: Math.max(...scores),
        mean: scores.reduce((sum, s) => sum + s, 0) / scores.length,
        median: scores[Math.floor(scores.length / 2)]
      };
    }

    return stats;
  }

  /**
   * Helper: Track export in database
   */
  async trackExport(collectionId, exportPath, format, uuid, includeDeps, includeAssets) {
    const stats = await fs.stat(exportPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    await this.db.run(`
      INSERT INTO collection_exports (
        collection_id, export_path, export_format, export_uuid,
        included_dependencies, included_assets, file_size_mb
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [collectionId, exportPath, format, uuid, includeDeps ? 1 : 0, includeAssets ? 1 : 0, fileSizeMB]);
  }

  /**
   * Helper: Sanitize filename
   */
  sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }

  /**
   * Helper: Create ZIP file from directory
   */
  async createZIP(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  generateREADME(manifest) {
    return `Variable Resolution App - Collection Export
===========================================

Export Date: ${manifest.exported_at}
Export Type: ${manifest.export_type}
${manifest.folder ? `Folder: ${manifest.folder.path}` : ''}

Contents:
- ${manifest.collections.length} collection(s)

Note: This export contains collection metadata only.
Media files (videos, PDFs) are not included in this bundle.

To Import:
1. Open Variable Resolution App
2. Go to Collections > Import
3. Select this file
4. Choose import options
5. Collections will be imported with structure preserved

Documentation: https://github.com/raymondli-me/variable-resolution-app
`;
  }
}

module.exports = CollectionExporter;
