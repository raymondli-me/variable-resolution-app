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
      return { success: true, data: filepath };
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
            collection_id, video_id, title, channel_title, view_count, like_count,
            comment_count, publish_date, duration, thumbnail_url, video_file_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newCollectionId, video.video_id, video.title, video.channel_title,
          video.view_count, video.like_count, video.comment_count, video.publish_date,
          video.duration, video.thumbnail_url, video.video_file_path
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

  // Subsample collection
  ipcMain.handle('collections:subsample', async (event, params) => {
    try {
      const db = await getDatabase();

      // Get source collection
      const sourceCollection = await db.getCollection(params.sourceId);
      if (!sourceCollection) {
        return { success: false, error: 'Source collection not found' };
      }

      // Get all videos from source
      const videos = await db.all('SELECT * FROM videos WHERE collection_id = ?', [params.sourceId]);

      if (videos.length === 0) {
        return { success: false, error: 'Source collection has no videos' };
      }

      if (params.sampleSize > videos.length && !params.withReplacement) {
        return { success: false, error: `Cannot sample ${params.sampleSize} videos from collection of ${videos.length} without replacement` };
      }

      // Random subsample
      let sampledVideos = [];
      if (params.withReplacement) {
        // Sample with replacement
        for (let i = 0; i < params.sampleSize; i++) {
          const randomIndex = Math.floor(Math.random() * videos.length);
          sampledVideos.push(videos[randomIndex]);
        }
      } else {
        // Sample without replacement (Fisher-Yates shuffle)
        const shuffled = [...videos];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        sampledVideos = shuffled.slice(0, params.sampleSize);
      }

      // Create new collection
      const newCollectionId = await db.createCollection(params.newName, sourceCollection.settings || {});

      // Copy sampled videos
      for (const video of sampledVideos) {
        await db.run(`
          INSERT INTO videos (
            collection_id, video_id, title, channel_title, view_count, like_count,
            comment_count, publish_date, duration, thumbnail_url, video_file_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newCollectionId, video.video_id, video.title, video.channel_title,
          video.view_count, video.like_count, video.comment_count, video.publish_date,
          video.duration, video.thumbnail_url, video.video_file_path
        ]);

        // Copy comments for this video
        const comments = await db.all('SELECT * FROM comments WHERE collection_id = ? AND video_id = ?', [params.sourceId, video.video_id]);
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

      // Create new collection
      const newCollectionId = await db.createCollection(params.newName, sourceCollection.settings || {});

      // Copy filtered videos
      for (const video of filteredVideos) {
        await db.run(`
          INSERT INTO videos (
            collection_id, video_id, title, channel_title, view_count, like_count,
            comment_count, publish_date, duration, thumbnail_url, video_file_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newCollectionId, video.video_id, video.title, video.channel_title,
          video.view_count, video.like_count, video.comment_count, video.publish_date,
          video.duration, video.thumbnail_url, video.video_file_path
        ]);

        // Copy comments for this video
        const comments = await db.all('SELECT * FROM comments WHERE collection_id = ? AND video_id = ?', [params.sourceId, video.video_id]);
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
}

module.exports = { registerCollectionHandlers };
