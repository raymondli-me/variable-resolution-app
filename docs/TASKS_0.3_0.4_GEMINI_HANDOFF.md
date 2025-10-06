# Tasks 0.3 & 0.4 Handoff: Export/Import System (Backend)

**From:** Consultant Agent
**To:** Gemini Implementation Agent (Backend Specialist)
**Date:** October 6, 2025
**Tasks:** Phase 0, Tasks 0.3 & 0.4 - Export/Import System
**Estimated Time:** 6-8 hours combined
**Dependencies:** ✅ Task 0.1 Complete (Schema + Folder API + UUIDs)

---

## YOUR ROLE: BACKEND SPECIALIST

You are the **Backend Implementation Agent**. Your focus is on:
- Data processing and transformation
- Database operations
- Business logic
- File I/O and serialization
- ID remapping algorithms

**You do NOT touch:**
- UI components
- Styling
- Frontend state management
- HTML files

---

## GOAL STATEMENT

Implement a complete export/import system that enables:
1. **Export collections** in 3 formats (JSON, ZIP, SQLite)
2. **Import collections** with ID remapping and conflict resolution
3. **Track exports/imports** for provenance
4. **Preserve lineage** across databases
5. **Enable collaboration** by sharing refined datasets

**User Value:** Researchers can share collections with collaborators, work across computers, and back up critical data.

---

## TWO-PART IMPLEMENTATION

### Task 0.3: Export System (3-4 hours)

Export collections in multiple formats with full metadata.

**Formats:**
1. **JSON** - Single collection with full lineage
2. **ZIP** - Folder bundle with multiple collections + assets
3. **SQLite** - Full database backup

### Task 0.4: Import System (3-4 hours)

Import collections with smart ID remapping to prevent conflicts.

**Features:**
- Parse JSON/ZIP imports
- Detect ID conflicts
- Remap IDs automatically
- Recreate folder structure
- Track import provenance

---

## TASK 0.3: EXPORT SYSTEM

### Files to Create

```
src/services/
  └── collection-exporter.js      (Export logic - ~300 lines)
```

### Files to Modify

```
src/database/db.js                (Add export methods)
main.js                           (Add export IPC handlers)
preload.js                        (Expose export API)
```

### Export Format Specifications

#### 1. JSON Format (Single Collection)

**File:** `collection_name_export.json`

```json
{
  "format_version": "2.0",
  "export_type": "collection",
  "export_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "exported_at": "2025-10-06T12:00:00Z",
  "exported_by": "Variable Resolution App v3.0",

  "collection": {
    "uuid": "collection-uuid-here",
    "id": 5,
    "name": "High CTE Symptoms",
    "search_term": "concussion CTE symptoms",
    "source_type": "derived",
    "derivation_method": "filter",
    "derivation_params": {
      "min_score": 0.8,
      "item_types": ["pdf_excerpt"]
    },
    "folder_path": "/Research/CTE Study/2025/Active",
    "created_at": "2025-10-05T10:30:00Z",
    "archived": false,
    "starred": true,
    "video_count": 0,
    "comment_count": 0,
    "item_count": 300
  },

  "lineage": [
    {
      "uuid": "parent-uuid-1",
      "id": 1,
      "name": "Concussion Research PDFs",
      "source_type": "pdf",
      "derivation_method": null
    },
    {
      "uuid": "parent-uuid-2",
      "id": 2,
      "name": "CTE-Relevant",
      "source_type": "derived",
      "derivation_method": "rate",
      "derivation_params": {
        "research_intent": "CTE symptoms"
      }
    }
  ],

  "items": [
    {
      "item_type": "pdf_excerpt",
      "item_id": 123,
      "text_content": "Chronic traumatic encephalopathy...",
      "relevance_score": 0.85,
      "bws_score": null,
      "bws_rank": null,
      "analysis_metadata": {
        "reasoning": "Discusses CTE symptoms...",
        "confidence": 0.9
      },
      "source_metadata": {
        "pdf_id": 1,
        "pdf_uuid": "pdf-uuid-here",
        "pdf_title": "CTE Diagnostic Guidelines 2024",
        "page_number": 12,
        "excerpt_number": 3
      }
    }
    // ... more items
  ],

  "dependencies": {
    "pdfs": [
      {
        "uuid": "pdf-uuid-here",
        "id": 1,
        "title": "CTE Diagnostic Guidelines 2024",
        "author": "Smith et al.",
        "file_path": "/path/to/pdfs/cte_guidelines_2024.pdf",
        "num_pages": 45,
        "file_size_mb": 2.3,
        "metadata": {}
      }
    ],
    "videos": [],
    "parent_collections": [1, 2]
  },

  "statistics": {
    "total_items": 300,
    "item_type_breakdown": {
      "pdf_excerpt": 300,
      "video_chunk": 0,
      "comment": 0
    },
    "score_distribution": {
      "min": 0.80,
      "max": 0.95,
      "mean": 0.87,
      "median": 0.86
    }
  }
}
```

#### 2. ZIP Format (Folder Bundle)

**File:** `folder_name_export.zip`

**Structure:**
```
folder_name_export.zip
├── manifest.json
├── collections/
│   ├── collection_1.json
│   ├── collection_2.json
│   └── collection_5.json
├── assets/
│   └── pdfs/
│       ├── cte_guidelines_2024.pdf
│       └── concussion_review.pdf
└── README.txt
```

**manifest.json:**
```json
{
  "format_version": "2.0",
  "export_type": "folder",
  "export_uuid": "folder-export-uuid",
  "exported_at": "2025-10-06T12:00:00Z",

  "folder": {
    "name": "CTE Study 2025",
    "path": "/Research/CTE Study/2025",
    "description": "Complete CTE research dataset",
    "color": "#6366f1"
  },

  "collections": [
    {
      "filename": "collection_1.json",
      "uuid": "...",
      "name": "Concussion Research PDFs",
      "item_count": 2000
    },
    {
      "filename": "collection_5.json",
      "uuid": "...",
      "name": "High CTE Symptoms",
      "item_count": 300
    }
  ],

  "assets": {
    "pdf_files": 15,
    "video_files": 0,
    "total_size_mb": 245
  }
}
```

**README.txt:**
```
Variable Resolution App - Collection Export
===========================================

Export Date: 2025-10-06
Export Type: Folder Bundle
Folder: /Research/CTE Study/2025

Contents:
- 3 collections
- 15 PDF files
- 2,300 total items

To Import:
1. Open Variable Resolution App
2. Go to Collections > Import
3. Select this ZIP file
4. Choose import options
5. Collections will be imported with folder structure preserved

Full documentation: https://github.com/raymondli-me/variable-resolution-app
```

#### 3. SQLite Format (Full Database Backup)

**File:** `vr-app-backup-2025-10-06.db`

Simple file copy of the entire SQLite database with timestamp.

---

### Implementation: `src/services/collection-exporter.js`

```javascript
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
   * @param {string} outputPath - Directory to save export
   * @param {Object} options - { includeDependencies, includeAssets }
   * @returns {Promise<string>} Path to exported file
   */
  async exportCollectionJSON(collectionId, outputPath, options = {}) {
    const {
      includeDependencies = true,
      includeAssets = true
    } = options;

    // Get collection
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

    // Build export object
    const exportData = {
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

    // Write to file
    const filename = `${this.sanitizeFilename(collection.search_term)}_export.json`;
    const filepath = path.join(outputPath, filename);
    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2), 'utf8');

    // Track export in database
    await this.trackExport(collectionId, filepath, 'json', exportData.export_uuid, includeDependencies, includeAssets);

    return filepath;
  }

  /**
   * Export folder (multiple collections) to ZIP bundle
   */
  async exportFolderZIP(folderId, outputPath, options = {}) {
    // Get folder info
    const folder = await this.db.getFolder(folderId);
    const folderPath = await this.db.getFolderPath(folderId);

    // Get all collections in folder (recursive)
    const collections = await this.getCollectionsInFolderRecursive(folderId);

    // Create temp directory for export preparation
    const tempDir = path.join(outputPath, `temp_export_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(path.join(tempDir, 'collections'), { recursive: true });

    // Export each collection to JSON in temp dir
    const collectionManifest = [];
    for (const collection of collections) {
      const jsonPath = path.join(tempDir, 'collections', `collection_${collection.id}.json`);
      // ... export logic similar to exportCollectionJSON
      collectionManifest.push({
        filename: `collection_${collection.id}.json`,
        uuid: collection.uuid,
        name: collection.search_term,
        item_count: collection.item_count || 0
      });
    }

    // Copy PDF/video assets if requested
    if (options.includeAssets) {
      await this.copyAssets(collections, path.join(tempDir, 'assets'));
    }

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
      collections: collectionManifest,
      assets: {
        pdf_files: 0,  // Count from copied assets
        video_files: 0,
        total_size_mb: 0
      }
    };
    await fs.writeFile(
      path.join(tempDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // Create README.txt
    const readme = this.generateREADME(manifest);
    await fs.writeFile(path.join(tempDir, 'README.txt'), readme, 'utf8');

    // Create ZIP file
    const zipFilename = `${this.sanitizeFilename(folder.name)}_export.zip`;
    const zipPath = path.join(outputPath, zipFilename);
    await this.createZIP(tempDir, zipPath);

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true });

    return zipPath;
  }

  /**
   * Export full database (SQLite backup)
   */
  async exportFullDatabase(outputPath) {
    const dbPath = this.db.db.filename;  // Path to SQLite file
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFilename = `vr-app-backup-${timestamp}.db`;
    const backupPath = path.join(outputPath, backupFilename);

    // Simple file copy
    await fs.copyFile(dbPath, backupPath);

    return backupPath;
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
- ${manifest.assets?.pdf_files || 0} PDF files
- ${manifest.assets?.video_files || 0} video files

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
```

---

## TASK 0.4: IMPORT SYSTEM

### Files to Create

```
src/services/
  └── collection-importer.js      (Import logic with ID remapping - ~350 lines)
```

### Files to Modify

```
src/database/db.js                (Add import methods)
main.js                           (Add import IPC handlers)
preload.js                        (Expose import API)
```

### Core Challenge: ID Remapping

**Problem:** Exported collection has `id: 5`, but importing database already has a collection with `id: 5`.

**Solution:** Remap all IDs during import and track the mapping.

**Example:**
```
Export:              Import (Remapped):
collection.id = 5 →  collection.id = 23 (new)
pdf.id = 1       →  pdf.id = 8 (if PDF already exists, reuse; else create new)
item.id = 123    →  item.id = 456 (new)
```

### Implementation: `src/services/collection-importer.js`

```javascript
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
      // Parse folder path and check if folders exist
      // Implementation depends on folder structure
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
      targetFolderId,
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

    // Similar for video_chunks and comments...
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
```

---

## DATABASE INTEGRATION

Add to `src/database/db.js`:

```javascript
const CollectionExporter = require('../services/collection-exporter');
const CollectionImporter = require('../services/collection-importer');

class Database {
  async init() {
    // ... existing code ...

    this.exporter = new CollectionExporter(this);
    this.importer = new CollectionImporter(this);
  }

  // Export methods
  async exportCollection(collectionId, outputPath, options) {
    return await this.exporter.exportCollectionJSON(collectionId, outputPath, options);
  }

  async exportFolder(folderId, outputPath, options) {
    return await this.exporter.exportFolderZIP(folderId, outputPath, options);
  }

  async exportDatabase(outputPath) {
    return await this.exporter.exportFullDatabase(outputPath);
  }

  // Import methods
  async importCollection(filePath, options) {
    return await this.importer.importCollectionJSON(filePath, options);
  }

  async importFolder(zipPath, options) {
    return await this.importer.importFolderZIP(zipPath, options);
  }
}
```

---

## IPC HANDLERS

Add to `main.js`:

```javascript
// Export handlers
ipcMain.handle('collections:export', async (event, collectionId, outputPath, options) => {
  try {
    const filepath = await db.exportCollection(collectionId, outputPath, options);
    return { success: true, data: filepath };
  } catch (error) {
    console.error('Error exporting collection:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:export', async (event, folderId, outputPath, options) => {
  try {
    const filepath = await db.exportFolder(folderId, outputPath, options);
    return { success: true, data: filepath };
  } catch (error) {
    console.error('Error exporting folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('database:export', async (event, outputPath) => {
  try {
    const filepath = await db.exportDatabase(outputPath);
    return { success: true, data: filepath };
  } catch (error) {
    console.error('Error exporting database:', error);
    return { success: false, error: error.message };
  }
});

// Import handlers
ipcMain.handle('collections:import', async (event, filePath, options) => {
  try {
    const result = await db.importCollection(filePath, options);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error importing collection:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('folders:import', async (event, zipPath, options) => {
  try {
    const result = await db.importFolder(zipPath, options);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error importing folder:', error);
    return { success: false, error: error.message };
  }
});
```

---

## PRELOAD API

Add to `preload.js`:

```javascript
contextBridge.exposeInMainWorld('api', {
  // ... existing API ...

  export: {
    collection: (collectionId, outputPath, options) =>
      ipcRenderer.invoke('collections:export', collectionId, outputPath, options),
    folder: (folderId, outputPath, options) =>
      ipcRenderer.invoke('folders:export', folderId, outputPath, options),
    database: (outputPath) =>
      ipcRenderer.invoke('database:export', outputPath)
  },

  import: {
    collection: (filePath, options) =>
      ipcRenderer.invoke('collections:import', filePath, options),
    folder: (zipPath, options) =>
      ipcRenderer.invoke('folders:import', zipPath, options)
  }
});
```

---

## SUCCESS CRITERIA

### Task 0.3 (Export)
- [ ] Can export collection to JSON with all required fields
- [ ] JSON includes lineage, items, dependencies, statistics
- [ ] Can export folder to ZIP with manifest
- [ ] ZIP includes all collection JSONs
- [ ] Can export full database (SQLite copy)
- [ ] Export tracked in `collection_exports` table
- [ ] Export UUID generated
- [ ] File sizes calculated correctly

### Task 0.4 (Import)
- [ ] Can import JSON collection file
- [ ] ID remapping prevents collisions
- [ ] Conflict detection identifies duplicates
- [ ] Strategy 'duplicate' creates new collection
- [ ] Strategy 'skip' prevents duplicate imports
- [ ] Lineage preserved after import
- [ ] Dependencies resolved (PDFs created/reused)
- [ ] Import tracked in `collection_imports` table
- [ ] Folder structure recreated

---

## TESTING PROCEDURE

1. **Export Test:**
   ```javascript
   // In Electron console
   const exportPath = '/Users/raymondli701/Desktop/exports';
   const result = await window.api.export.collection(1, exportPath, {
     includeDependencies: true,
     includeAssets: true
   });
   console.log('Exported to:', result.data);
   ```

2. **Import Test:**
   ```javascript
   const importPath = '/Users/raymondli701/Desktop/exports/concussion_research_export.json';
   const result = await window.api.import.collection(importPath, {
     strategy: 'duplicate',
     targetFolderId: null
   });
   console.log('Imported collection ID:', result.data.newCollectionId);
   ```

3. **Verify:**
   - Check exported JSON has all fields
   - Import creates new collection with different ID
   - Items preserved
   - No duplicate PDFs created

---

## COMPLETION CHECKLIST

Before reporting completion:

- [ ] `src/services/collection-exporter.js` created
- [ ] `src/services/collection-importer.js` created
- [ ] Database methods added
- [ ] IPC handlers added
- [ ] Preload API exposed
- [ ] JSON export works
- [ ] ZIP export works
- [ ] SQLite backup works
- [ ] JSON import works
- [ ] ID remapping works
- [ ] No duplicate IDs created
- [ ] Export/import tracked in database
- [ ] All tests pass

---

## ESTIMATED TIMELINE

**Task 0.3 (Export):**
- Hour 1: Set up exporter class, JSON export skeleton
- Hour 2: Implement lineage/dependencies/statistics
- Hour 3: ZIP export with manifest
- Hour 4: SQLite backup, testing

**Task 0.4 (Import):**
- Hour 1: Set up importer class, parse JSON
- Hour 2: Conflict detection logic
- Hour 3: ID remapping algorithm
- Hour 4: Import execution, testing

**Total: 6-8 hours**

---

**Ready to build the backbone of collection portability! Focus on robust ID remapping—this is critical for collaboration. Good luck! 🚀**
