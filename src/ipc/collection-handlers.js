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

  // Duplicate collection
  ipcMain.handle('collections:duplicate', async (event, params) => {
    try {
      const db = await getDatabase();

      // Get source collection
      const sourceCollection = await db.getCollection(params.sourceId);
      if (!sourceCollection) {
        return { success: false, error: 'Source collection not found' };
      }

      // Get all videos from source
      const videos = await db.all('SELECT * FROM videos WHERE collection_id = ?', [params.sourceId]);

      // Create new collection
      const newCollectionId = await db.createCollection(params.newName, sourceCollection.settings || {});

      // Copy videos
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

      // Get source collection
      const sourceCollection = await db.getCollection(params.sourceId);
      if (!sourceCollection) {
        return { success: false, error: 'Source collection not found' };
      }

      // Build filter query
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

      // Date range filter
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

      // Get filtered videos
      const filteredVideos = await db.all(query, queryParams);

      if (filteredVideos.length === 0) {
        return { success: false, error: 'No videos match the filter criteria' };
      }

      // Create new collection with lineage tracking
      const derivationInfo = {
        method: 'filter',
        parameters: params.filters
      };
      const newCollectionId = await db.createCollection(
        params.newName,
        sourceCollection.settings || {},
        null, // report
        params.sourceId, // parentCollectionId
        derivationInfo
      );

      // Copy filtered videos
      for (const video of filteredVideos) {
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

      // Update counts
      await db.run(`
        UPDATE collections
        SET video_count = (SELECT COUNT(*) FROM videos WHERE collection_id = ?),
            comment_count = (SELECT COUNT(*) FROM comments WHERE collection_id = ?)
        WHERE id = ?
      `, [newCollectionId, newCollectionId, newCollectionId]);

      return { success: true, collectionId: newCollectionId, matchCount: filteredVideos.length };
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
