const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Register all collection-related IPC handlers
 * @param {Function} getDatabase - Database instance getter function
 */
function registerCollectionHandlers(getDatabase) {
  // ============================================
  // COLLECTION EXPORT/IMPORT HANDLERS
  // ============================================

  ipcMain.handle('collections:export', async (event, collectionId, outputPath, options) => {
    try {
      const db = await getDatabase();
      const filepath = await db.exportCollection(collectionId, outputPath, options);

      // Get file size
      const stats = fs.statSync(filepath);
      const fileSize = stats.size;

      // Get item count from collection
      const videos = await db.all('SELECT COUNT(*) as count FROM videos WHERE collection_id = ?', [collectionId]);
      const itemCount = videos[0]?.count || 0;

      return {
        success: true,
        data: {
          filePath: filepath,
          itemCount,
          fileSize
        }
      };
    } catch (error) {
      console.error('Error exporting collection:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('collections:import', async (event, filePath, options) => {
    try {
      const db = await getDatabase();
      const result = await db.importCollection(filePath, options);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error importing collection:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // COLLECTION LIFECYCLE HANDLERS
  // ============================================

  // Check for incomplete collections handler
  ipcMain.handle('collections:checkIncomplete', async (event) => {
    try {
      const fs = require('fs').promises;
      const collectionsDir = path.join(app.getPath('userData'), 'collections');

      // Check if collections directory exists
      try {
        await fs.access(collectionsDir);
      } catch {
        return { success: true, incomplete: [] };
      }

      // Read all collection folders
      const folders = await fs.readdir(collectionsDir);
      const incompleteCollections = [];

      for (const folder of folders) {
        const folderPath = path.join(collectionsDir, folder);
        const manifestPath = path.join(folderPath, 'collection_manifest.json');

        try {
          // Check if manifest exists
          const manifestData = await fs.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestData);

          // Check if collection is incomplete
          if (manifest.status === 'in_progress') {
            incompleteCollections.push({
              folder,
              folderPath,
              manifest,
              remainingVideos: manifest.totalVideos - manifest.completed.length,
              failedCount: manifest.failed.length
            });
          }
        } catch (err) {
          // Skip if no manifest or invalid
          continue;
        }
      }

      return { success: true, incomplete: incompleteCollections };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Resume collection handler - simpler approach
  ipcMain.handle('collections:resume', async (event, { manifestPath }) => {
    try {
      const fs = require('fs');
      const manifestData = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);

      // Get remaining videos from the stored video list
      const allVideos = manifest.settings.videos || [];
      if (allVideos.length === 0) {
        return { success: false, error: 'No video list found in manifest' };
      }

      // Get videos that haven't been collected yet
      const completedIds = new Set(manifest.completed);
      const failedIds = new Set((manifest.failed || []).map(f => f.videoId));

      const remainingVideos = allVideos.filter(v =>
        !completedIds.has(v.id) && !failedIds.has(v.id)
      );

      if (remainingVideos.length === 0) {
        return { success: false, error: 'No videos left to collect' };
      }

      // Simply call the existing youtube:collect handler with the remaining videos
      // The manifest checking in the collection handler will handle resuming in the same folder
      return await event.sender.invoke('youtube:collect', {
        jobId: manifest.jobId,
        videos: remainingVideos,
        options: manifest.settings
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Mark collection as complete handler
  ipcMain.handle('collections:markComplete', async (event, { manifestPath }) => {
    try {
      const fs = require('fs').promises;
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);

      // Update status to completed
      manifest.status = 'completed';
      manifest.markedCompleteAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Create a PDF collection
  ipcMain.handle('collections:createPDFCollection', async (event, { name }) => {
    try {
      const db = await getDatabase();

      // Create collection with PDF-specific settings
      const settings = {
        type: 'pdf',
        createdAt: new Date().toISOString()
      };

      const collectionId = await db.createCollection(name, settings);

      // Create collection folder structure
      const collectionsDir = path.join(app.getPath('userData'), 'collections');
      const collectionFolder = path.join(collectionsDir, collectionId.toString());
      const pdfsFolder = path.join(collectionFolder, 'pdfs');

      const fs = require('fs');
      if (!fs.existsSync(pdfsFolder)) {
        fs.mkdirSync(pdfsFolder, { recursive: true });
      }

      return {
        success: true,
        collectionId,
        collectionFolder,
        pdfsFolder
      };
    } catch (error) {
      console.error('Error creating PDF collection:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // COLLECTION ORGANIZATION HANDLERS
  // ============================================

  ipcMain.handle('collections:moveToFolder', async (event, collectionId, folderId) => {
    try {
      const db = await getDatabase();
      await db.moveCollectionToFolder(collectionId, folderId);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error moving collection to folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('collections:archive', async (event, collectionId, archived) => {
    try {
      const db = await getDatabase();
      await db.archiveCollection(collectionId, archived);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error archiving collection:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('collections:star', async (event, collectionId, starred) => {
    try {
      const db = await getDatabase();
      await db.starCollection(collectionId, starred);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error starring collection:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // COLLECTION TRANSFORMATION HANDLERS
  // ============================================

  // Duplicate collection (genre-aware: supports both video and PDF collections)
  ipcMain.handle('collections:duplicate', async (event, params) => {
    try {
      const db = await getDatabase();

      // Get source collection
      const sourceCollection = await db.getCollection(params.sourceId);
      if (!sourceCollection) {
        return { success: false, error: 'Source collection not found' };
      }

      // Parse settings to determine collection type
      const settings = typeof sourceCollection.settings === 'string'
        ? JSON.parse(sourceCollection.settings)
        : sourceCollection.settings || {};

      const collectionType = settings.type || 'video'; // Default to video for backwards compatibility

      // Create new collection
      const newCollectionId = await db.createCollection(params.newName, settings);

      if (collectionType === 'pdf') {
        // PDF collection: copy PDFs and excerpts
        const pdfs = await db.all('SELECT * FROM pdfs WHERE collection_id = ?', [params.sourceId]);

        // Map old PDF IDs to new PDF IDs
        const pdfIdMap = {};

        // Copy PDFs
        for (const pdf of pdfs) {
          const result = await db.run(`
            INSERT INTO pdfs (
              collection_id, file_path, title, author, num_pages, file_size, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            newCollectionId, pdf.file_path, pdf.title, pdf.author,
            pdf.num_pages, pdf.file_size, pdf.metadata
          ]);
          pdfIdMap[pdf.id] = result.id;
        }

        // Copy excerpts
        const excerpts = await db.all(`
          SELECT * FROM pdf_excerpts
          WHERE pdf_id IN (SELECT id FROM pdfs WHERE collection_id = ?)
        `, [params.sourceId]);

        for (const excerpt of excerpts) {
          const newPdfId = pdfIdMap[excerpt.pdf_id];
          if (!newPdfId) continue;

          await db.run(`
            INSERT INTO pdf_excerpts (
              pdf_id, collection_id, excerpt_number, page_number,
              text_content, char_start, char_end, bbox
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newPdfId, newCollectionId, excerpt.excerpt_number, excerpt.page_number,
            excerpt.text_content, excerpt.char_start, excerpt.char_end, excerpt.bbox
          ]);

          const newExcerptId = (await db.get('SELECT last_insert_rowid() as id')).id;

          // Copy ratings if requested
          if (params.includeRatings !== false) {
            // Copy human ratings
            const humanRatings = await db.all('SELECT * FROM excerpt_ratings WHERE excerpt_id = ?', [excerpt.id]);
            for (const rating of humanRatings) {
              await db.run(`
                INSERT INTO excerpt_ratings (excerpt_id, variable_id, score, reasoning, reasoning_depth, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `, [newExcerptId, rating.variable_id, rating.score, rating.reasoning, rating.reasoning_depth, rating.source, rating.created_at, rating.updated_at]);
            }

            // Copy AI ratings
            const aiRatings = await db.all('SELECT * FROM ai_excerpt_ratings WHERE excerpt_id = ?', [excerpt.id]);
            for (const rating of aiRatings) {
              await db.run(`
                INSERT INTO ai_excerpt_ratings (excerpt_id, variable_id, score, reasoning, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [newExcerptId, rating.variable_id, rating.score, rating.reasoning, rating.created_at, rating.updated_at]);
            }
          }
        }

      } else {
        // Video collection: copy videos and comments (original behavior)
        const videos = await db.all('SELECT * FROM videos WHERE collection_id = ?', [params.sourceId]);

        for (const video of videos) {
          await db.run(`
            INSERT INTO videos (
              collection_id, id, title, channel_title, view_count, like_count,
              comment_count, published_at, duration, thumbnails, local_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newCollectionId, video.id, video.title, video.channel_title,
            video.view_count, video.like_count, video.comment_count, video.published_at,
            video.duration, video.thumbnails, video.local_path
          ]);
        }

        // Copy comments if requested
        if (params.includeComments) {
          const comments = await db.all('SELECT * FROM comments WHERE collection_id = ?', [params.sourceId]);
          for (const comment of comments) {
            await db.run(`
              INSERT INTO comments (
                collection_id, video_id, comment_id, author, text, like_count, published_at, parent_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              newCollectionId, comment.video_id, comment.comment_id, comment.author,
              comment.text, comment.like_count, comment.published_at, comment.parent_id
            ]);
          }
        }

        // Update video/comment counts
        await db.run(`
          UPDATE collections
          SET video_count = (SELECT COUNT(*) FROM videos WHERE collection_id = ?),
              comment_count = (SELECT COUNT(*) FROM comments WHERE collection_id = ?)
          WHERE id = ?
        `, [newCollectionId, newCollectionId, newCollectionId]);
      }

      return { success: true, collectionId: newCollectionId };
    } catch (error) {
      console.error('[IPC] Error duplicating collection:', error);
      return { success: false, error: error.message };
    }
  });

  // Subsample collection (genre-aware: supports both video and PDF collections)
  ipcMain.handle('collections:subsample', async (event, params) => {
    try {
      const db = await getDatabase();

      // Get source collection
      const sourceCollection = await db.getCollection(params.sourceId);
      if (!sourceCollection) {
        return { success: false, error: 'Source collection not found' };
      }

      // Parse settings to determine collection type
      const settings = typeof sourceCollection.settings === 'string'
        ? JSON.parse(sourceCollection.settings)
        : sourceCollection.settings || {};

      const collectionType = settings.type || 'video'; // Default to video for backwards compatibility

      // Determine what to sample based on collection type
      let items = [];
      let itemType = '';

      if (collectionType === 'pdf') {
        // PDF collection: sample excerpts
        itemType = 'pdf_excerpt';
        items = await db.all('SELECT * FROM pdf_excerpts WHERE collection_id = ?', [params.sourceId]);

        if (items.length === 0) {
          return { success: false, error: 'Source collection has no PDF excerpts' };
        }
      } else {
        // Video collection: sample videos (original behavior)
        itemType = 'video';
        items = await db.all('SELECT * FROM videos WHERE collection_id = ?', [params.sourceId]);

        if (items.length === 0) {
          return { success: false, error: 'Source collection has no videos' };
        }
      }

      // Validate sample size
      if (params.sampleSize > items.length && !params.withReplacement) {
        return { success: false, error: `Cannot sample ${params.sampleSize} items from collection of ${items.length} without replacement` };
      }

      // Random subsample (same algorithm for both types)
      let sampledItems = [];
      if (params.withReplacement) {
        // Sample with replacement
        for (let i = 0; i < params.sampleSize; i++) {
          const randomIndex = Math.floor(Math.random() * items.length);
          sampledItems.push(items[randomIndex]);
        }
      } else {
        // Sample without replacement (Fisher-Yates shuffle)
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        sampledItems = shuffled.slice(0, params.sampleSize);
      }

      // Create new derived collection with lineage tracking
      const derivationInfo = {
        method: 'subsample',
        parameters: {
          sampleSize: params.sampleSize,
          withReplacement: params.withReplacement || false
        }
      };

      const newCollectionId = await db.createCollection(
        params.newName,
        settings,
        null, // report
        params.sourceId, // parentCollectionId
        derivationInfo
      );

      // Copy sampled items based on type
      if (itemType === 'pdf_excerpt') {
        // Get unique PDF IDs from sampled excerpts
        const uniquePdfIds = [...new Set(sampledItems.map(e => e.pdf_id))];

        console.log(`[Subsample] Source collection: ${params.sourceId}`);
        console.log(`[Subsample] Unique PDF IDs in excerpts: ${uniquePdfIds.join(', ')}`);

        // Map old PDF IDs to new PDF IDs (PDFs get new auto-increment IDs in new collection)
        const pdfIdMap = {};

        // Copy PDF records first (excerpts reference these via pdf_id)
        for (const oldPdfId of uniquePdfIds) {
          const pdfRecord = await db.get('SELECT * FROM pdfs WHERE id = ? AND collection_id = ?', [oldPdfId, params.sourceId]);
          console.log(`[Subsample] Looking for PDF ${oldPdfId} in collection ${params.sourceId}: ${pdfRecord ? 'FOUND' : 'NOT FOUND'}`);
          if (pdfRecord) {
            // Insert PDF with new collection_id but keep original file_path
            const result = await db.run(`
              INSERT INTO pdfs (
                collection_id, file_path, title, author, num_pages, file_size, metadata
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              newCollectionId, pdfRecord.file_path, pdfRecord.title, pdfRecord.author,
              pdfRecord.num_pages, pdfRecord.file_size, pdfRecord.metadata
            ]);

            // Store mapping: old PDF ID -> new PDF ID
            pdfIdMap[oldPdfId] = result.id;
            console.log(`[Subsample] Mapped old PDF ID ${oldPdfId} -> new PDF ID ${result.id}`);
          }
        }

        // Now copy PDF excerpts using the new PDF IDs
        for (const excerpt of sampledItems) {
          const newPdfId = pdfIdMap[excerpt.pdf_id];
          if (!newPdfId) {
            console.error(`[Subsample] No mapping found for pdf_id ${excerpt.pdf_id}`);
            continue;
          }

          await db.run(`
            INSERT INTO pdf_excerpts (
              pdf_id, collection_id, excerpt_number, page_number,
              text_content, char_start, char_end, bbox
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newPdfId, newCollectionId, excerpt.excerpt_number, excerpt.page_number,
            excerpt.text_content, excerpt.char_start, excerpt.char_end, excerpt.bbox
          ]);
        }

        // Note: We don't update an excerpt_count on collections table (it doesn't exist yet)
        // The count can be queried dynamically when needed
      } else {
        // Copy videos (original behavior)
        for (const video of sampledItems) {
          await db.run(`
            INSERT INTO videos (
              collection_id, id, title, channel_title, view_count, like_count,
              comment_count, published_at, duration, thumbnails, local_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newCollectionId, video.id, video.title, video.channel_title,
            video.view_count, video.like_count, video.comment_count, video.published_at,
            video.duration, video.thumbnails, video.local_path
          ]);

          // Copy comments for this video
          const comments = await db.all('SELECT * FROM comments WHERE collection_id = ? AND video_id = ?', [params.sourceId, video.id]);
          for (const comment of comments) {
            await db.run(`
              INSERT INTO comments (
                collection_id, video_id, comment_id, author, text, like_count, published_at, parent_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              newCollectionId, comment.video_id, comment.comment_id, comment.author,
              comment.text, comment.like_count, comment.published_at, comment.parent_id
            ]);
          }
        }

        // Update counts for video collections
        await db.run(`
          UPDATE collections
          SET video_count = (SELECT COUNT(*) FROM videos WHERE collection_id = ?),
              comment_count = (SELECT COUNT(*) FROM comments WHERE collection_id = ?)
          WHERE id = ?
        `, [newCollectionId, newCollectionId, newCollectionId]);
      }

      return { success: true, collectionId: newCollectionId };
    } catch (error) {
      console.error('[IPC] Error creating subsample:', error);
      return { success: false, error: error.message };
    }
  });

  // Filter collection
  ipcMain.handle('collections:filter', async (event, params) => {
    try {
      const db = await getDatabase();

      console.log('[FILTER DEBUG] === Start Filter Request ===');
      console.log('[FILTER DEBUG] params.filters:', JSON.stringify(params.filters, null, 2));

      // Get source collection
      const sourceCollection = await db.getCollection(params.sourceId);
      if (!sourceCollection) {
        return { success: false, error: 'Source collection not found' };
      }

      // Determine collection genre
      let isPdfCollection = false;
      try {
        const settings = typeof sourceCollection.settings === 'string'
          ? JSON.parse(sourceCollection.settings)
          : sourceCollection.settings;
        isPdfCollection = settings.source === 'pdf' || settings.type === 'pdf';
      } catch (e) {
        // Default to video collection
      }

      console.log('[FILTER DEBUG] isPdfCollection:', isPdfCollection);

      let filteredItems;
      let matchCount = 0;

      if (isPdfCollection) {
        // PDF Collection Filtering
        let query = 'SELECT DISTINCT pe.* FROM pdf_excerpts pe WHERE pe.pdf_id IN (SELECT id FROM pdfs WHERE collection_id = ?)';
        let queryParams = [params.sourceId];

        console.log('[FILTER DEBUG] Initial query:', query);
        console.log('[FILTER DEBUG] Initial queryParams:', queryParams);

        // Page range filter
        if (params.filters.pageStart) {
          query += ' AND pe.page_number >= ?';
          queryParams.push(params.filters.pageStart);
        }
        if (params.filters.pageEnd) {
          query += ' AND pe.page_number <= ?';
          queryParams.push(params.filters.pageEnd);
        }

        // Minimum excerpt length filter
        if (params.filters.minExcerptLength > 0) {
          query += ' AND LENGTH(pe.text_content) >= ?';
          queryParams.push(params.filters.minExcerptLength);
        }

        // Text keyword filter
        if (params.filters.textKeyword) {
          query += ' AND pe.text_content LIKE ?';
          queryParams.push(`%${params.filters.textKeyword}%`);
        }

        // Variable-based filtering
        if (params.filters.variableFilters && params.filters.variableFilters.length > 0) {
          console.log('[FILTER DEBUG] Processing variableFilters:', params.filters.variableFilters.length, 'filters');

          for (const vf of params.filters.variableFilters) {
            const varId = vf.variableId;
            const ratingType = vf.ratingType || 'any';
            const minScore = vf.minScore;
            const maxScore = vf.maxScore;
            const status = vf.status || 'all';

            console.log('[FILTER DEBUG] Processing filter:', { varId, ratingType, minScore, maxScore, status });

            if (status === 'unrated') {
              // Only excerpts WITHOUT ratings for this variable
              query += ` AND pe.id NOT IN (
                SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ?
                UNION
                SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ?
              )`;
              queryParams.push(varId, varId);
            } else if (status === 'rated') {
              // Only excerpts WITH ratings (AI or human or both based on ratingType)
              if (ratingType === 'ai') {
                query += ` AND pe.id IN (SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ?)`;
                queryParams.push(varId);
              } else if (ratingType === 'human') {
                query += ` AND pe.id IN (SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ?)`;
                queryParams.push(varId);
              } else if (ratingType === 'both') {
                query += ` AND pe.id IN (SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ?)
                          AND pe.id IN (SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ?)`;
                queryParams.push(varId, varId);
              } else {
                // 'any' - has either AI or human rating
                query += ` AND (pe.id IN (SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ?)
                           OR pe.id IN (SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ?))`;
                queryParams.push(varId, varId);
              }
            }

            // Score range filtering (applies only if status is not 'unrated')
            if (status !== 'unrated' && (minScore !== null || maxScore !== null)) {
              if (ratingType === 'any') {
                // For 'any', use OR logic: excerpt must have EITHER AI rating OR human rating meeting criteria
                const conditions = [];
                if (minScore !== null && maxScore !== null) {
                  conditions.push(`pe.id IN (SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) >= ? AND CAST(score AS REAL) <= ?)`);
                  queryParams.push(varId, minScore, maxScore);
                  conditions.push(`pe.id IN (SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) >= ? AND CAST(score AS REAL) <= ?)`);
                  queryParams.push(varId, minScore, maxScore);
                } else if (minScore !== null) {
                  conditions.push(`pe.id IN (SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) >= ?)`);
                  queryParams.push(varId, minScore);
                  conditions.push(`pe.id IN (SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) >= ?)`);
                  queryParams.push(varId, minScore);
                } else if (maxScore !== null) {
                  conditions.push(`pe.id IN (SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) <= ?)`);
                  queryParams.push(varId, maxScore);
                  conditions.push(`pe.id IN (SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) <= ?)`);
                  queryParams.push(varId, maxScore);
                }
                if (conditions.length > 0) {
                  query += ` AND (${conditions.join(' OR ')})`;
                }
              } else if (ratingType === 'ai') {
                if (minScore !== null) {
                  query += ` AND pe.id IN (SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) >= ?)`;
                  queryParams.push(varId, minScore);
                }
                if (maxScore !== null) {
                  query += ` AND pe.id IN (SELECT excerpt_id FROM ai_excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) <= ?)`;
                  queryParams.push(varId, maxScore);
                }
              } else if (ratingType === 'human') {
                if (minScore !== null) {
                  query += ` AND pe.id IN (SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) >= ?)`;
                  queryParams.push(varId, minScore);
                }
                if (maxScore !== null) {
                  query += ` AND pe.id IN (SELECT excerpt_id FROM excerpt_ratings WHERE variable_id = ? AND CAST(score AS REAL) <= ?)`;
                  queryParams.push(varId, maxScore);
                }
              }
            }
          }
        }

        console.log('[FILTER DEBUG] === Final Query ===');
        console.log('[FILTER DEBUG] Query:', query);
        console.log('[FILTER DEBUG] QueryParams:', queryParams);

        // Debug: Check what's actually in the database
        const debugPdfs = await db.all('SELECT id, collection_id FROM pdfs WHERE collection_id = ?', [params.sourceId]);
        console.log('[FILTER DEBUG] PDFs in collection:', debugPdfs);

        const debugExcerpts = await db.all('SELECT id, pdf_id, collection_id FROM pdf_excerpts WHERE collection_id = ? LIMIT 5', [params.sourceId]);
        console.log('[FILTER DEBUG] Sample excerpts:', debugExcerpts);

        if (params.filters.variableFilters && params.filters.variableFilters.length > 0) {
          const varId = params.filters.variableFilters[0].variableId;
          const debugAiRatings = await db.all('SELECT excerpt_id, variable_id, score FROM ai_excerpt_ratings WHERE variable_id = ? LIMIT 5', [varId]);
          console.log('[FILTER DEBUG] Sample AI ratings for variable', varId, ':', debugAiRatings);

          const debugHumanRatings = await db.all('SELECT excerpt_id, variable_id, score FROM excerpt_ratings WHERE variable_id = ? LIMIT 5', [varId]);
          console.log('[FILTER DEBUG] Sample human ratings for variable', varId, ':', debugHumanRatings);
        }

        filteredItems = await db.all(query, queryParams);
        matchCount = filteredItems.length;

        console.log('[FILTER DEBUG] Query result: Found', matchCount, 'items');

        if (filteredItems.length === 0) {
          return { success: false, error: 'No excerpts match the filter criteria' };
        }

        // Create new collection
        const derivationInfo = {
          method: 'filter',
          parameters: params.filters
        };
        const newCollectionId = await db.createCollection(
          params.newName,
          sourceCollection.settings || {},
          null,
          params.sourceId,
          derivationInfo
        );

        // Get unique PDF IDs
        const pdfIds = [...new Set(filteredItems.map(e => e.pdf_id))];

        // Map old PDF IDs to new PDF IDs
        const pdfIdMap = {};

        // Copy PDFs (let SQLite auto-generate new IDs)
        for (const pdfId of pdfIds) {
          const pdf = await db.get('SELECT * FROM pdfs WHERE id = ?', [pdfId]);
          if (pdf) {
            const result = await db.run(`
              INSERT INTO pdfs (collection_id, file_path, title, author, num_pages, file_size, metadata)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [newCollectionId, pdf.file_path, pdf.title, pdf.author, pdf.num_pages, pdf.file_size, pdf.metadata]);
            pdfIdMap[pdfId] = result.id;
          }
        }

        // Copy excerpts
        for (const excerpt of filteredItems) {
          const newPdfId = pdfIdMap[excerpt.pdf_id];
          if (!newPdfId) {
            console.error('[FILTER] No mapping found for pdf_id', excerpt.pdf_id);
            continue;
          }

          await db.run(`
            INSERT INTO pdf_excerpts (pdf_id, collection_id, excerpt_number, page_number, text_content, char_start, char_end, bbox)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [newPdfId, newCollectionId, excerpt.excerpt_number, excerpt.page_number, excerpt.text_content, excerpt.char_start, excerpt.char_end, excerpt.bbox]);

          const newExcerptId = await db.get('SELECT last_insert_rowid() as id');

          // Copy human ratings
          const humanRatings = await db.all('SELECT * FROM excerpt_ratings WHERE excerpt_id = ?', [excerpt.id]);
          for (const rating of humanRatings) {
            await db.run(`
              INSERT INTO excerpt_ratings (excerpt_id, variable_id, score, reasoning, reasoning_depth, source, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [newExcerptId.id, rating.variable_id, rating.score, rating.reasoning, rating.reasoning_depth, rating.source, rating.created_at, rating.updated_at]);
          }

          // Copy AI ratings
          const aiRatings = await db.all('SELECT * FROM ai_excerpt_ratings WHERE excerpt_id = ?', [excerpt.id]);
          for (const rating of aiRatings) {
            await db.run(`
              INSERT INTO ai_excerpt_ratings (excerpt_id, variable_id, score, reasoning, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [newExcerptId.id, rating.variable_id, rating.score, rating.reasoning, rating.created_at, rating.updated_at]);
          }
        }

        // Update excerpt count
        await db.run(`
          UPDATE collections
          SET excerpt_count = (SELECT COUNT(*) FROM pdf_excerpts pe JOIN pdfs p ON pe.pdf_id = p.id WHERE p.collection_id = ?)
          WHERE id = ?
        `, [newCollectionId, newCollectionId]);

      } else {
        // Video Collection Filtering (existing logic)
        let query = 'SELECT * FROM videos WHERE collection_id = ?';
        let queryParams = [params.sourceId];

        if (params.filters.minViews > 0) {
          query += ' AND CAST(view_count AS INTEGER) >= ?';
          queryParams.push(params.filters.minViews);
        }

        if (params.filters.minComments > 0) {
          query += ' AND CAST(comment_count AS INTEGER) >= ?';
          queryParams.push(params.filters.minComments);
        }

        if (params.filters.titleKeyword) {
          query += ' AND title LIKE ?';
          queryParams.push(`%${params.filters.titleKeyword}%`);
        }

        if (params.filters.dateRange && params.filters.dateRange !== 'all') {
          const now = new Date();
          let dateThreshold;

          switch (params.filters.dateRange) {
            case 'today':
              dateThreshold = new Date(now.setHours(0, 0, 0, 0));
              break;
            case 'week':
              dateThreshold = new Date(now.setDate(now.getDate() - 7));
              break;
            case 'month':
              dateThreshold = new Date(now.setMonth(now.getMonth() - 1));
              break;
            case 'year':
              dateThreshold = new Date(now.setFullYear(now.getFullYear() - 1));
              break;
          }

          if (dateThreshold) {
            query += ' AND publish_date >= ?';
            queryParams.push(dateThreshold.toISOString());
          }
        }

        filteredItems = await db.all(query, queryParams);
        matchCount = filteredItems.length;

        if (filteredItems.length === 0) {
          return { success: false, error: 'No videos match the filter criteria' };
        }

        const derivationInfo = {
          method: 'filter',
          parameters: params.filters
        };
        const newCollectionId = await db.createCollection(
          params.newName,
          sourceCollection.settings || {},
          null,
          params.sourceId,
          derivationInfo
        );

        for (const video of filteredItems) {
          await db.run(`
            INSERT INTO videos (
              collection_id, id, title, channel_title, view_count, like_count,
              comment_count, published_at, duration, thumbnails, local_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newCollectionId, video.id, video.title, video.channel_title,
            video.view_count, video.like_count, video.comment_count, video.published_at,
            video.duration, video.thumbnails, video.local_path
          ]);

          const comments = await db.all('SELECT * FROM comments WHERE collection_id = ? AND video_id = ?', [params.sourceId, video.id]);
          for (const comment of comments) {
            await db.run(`
              INSERT INTO comments (
                collection_id, video_id, comment_id, author, text, like_count, published_at, parent_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              newCollectionId, comment.video_id, comment.comment_id, comment.author,
              comment.text, comment.like_count, comment.published_at, comment.parent_id
            ]);
          }
        }

        await db.run(`
          UPDATE collections
          SET video_count = (SELECT COUNT(*) FROM videos WHERE collection_id = ?),
              comment_count = (SELECT COUNT(*) FROM comments WHERE collection_id = ?)
          WHERE id = ?
        `, [newCollectionId, newCollectionId, newCollectionId]);
      }

      return { success: true, collectionId: await db.get('SELECT last_insert_rowid() as id').then(r => r.id), matchCount };
    } catch (error) {
      console.error('[IPC] Error filtering collection:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete collection
  ipcMain.handle('collections:delete', async (event, collectionId) => {
    try {
      const db = await getDatabase();

      // Check if collection exists
      const collection = await db.getCollection(collectionId);
      if (!collection) {
        return { success: false, error: 'Collection not found' };
      }

      // Delete all related data
      // 1. Delete videos
      await db.run('DELETE FROM videos WHERE collection_id = ?', [collectionId]);

      // 2. Delete comments
      await db.run('DELETE FROM comments WHERE collection_id = ?', [collectionId]);

      // 3. Delete video chunks (if exists)
      await db.run('DELETE FROM video_chunks WHERE collection_id = ?', [collectionId]).catch(() => {});

      // 4. Delete AI ratings (if exists)
      await db.run('DELETE FROM ai_ratings WHERE collection_id = ?', [collectionId]).catch(() => {});

      // 5. Delete BWS tuples and judgments (if exists)
      await db.run('DELETE FROM bws_judgments WHERE experiment_id IN (SELECT id FROM bws_experiments WHERE collection_id = ?)', [collectionId]).catch(() => {});
      await db.run('DELETE FROM bws_tuples WHERE experiment_id IN (SELECT id FROM bws_experiments WHERE collection_id = ?)', [collectionId]).catch(() => {});
      await db.run('DELETE FROM bws_experiments WHERE collection_id = ?', [collectionId]).catch(() => {});

      // 6. Delete PDFs and excerpts (if exists)
      await db.run('DELETE FROM pdf_excerpts WHERE pdf_id IN (SELECT id FROM pdfs WHERE collection_id = ?)', [collectionId]).catch(() => {});
      await db.run('DELETE FROM pdfs WHERE collection_id = ?', [collectionId]).catch(() => {});

      // 7. Finally, delete the collection itself
      await db.run('DELETE FROM collections WHERE id = ?', [collectionId]);

      return { success: true };
    } catch (error) {
      console.error('[IPC] Error deleting collection:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerCollectionHandlers };
