const { ipcMain } = require('electron');

function registerDatabaseHandlers(getDatabase) {
  // Database handlers
  ipcMain.handle('db:getCollections', async () => {
    try {
      const db = await getDatabase();
      const collections = await db.getCollections();
      return {
        success: true,
        data: collections
      };
    } catch (error) {
      console.error('Error getting collections:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('db:getCollection', async (event, collectionId) => {
    try {
      const db = await getDatabase();
      const collection = await db.getCollection(collectionId);
      return {
        success: true,
        data: collection
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Get videos for a collection
  ipcMain.handle('db:getVideos', async (event, collectionId) => {
    try {
      const db = await getDatabase();
      const videos = await db.all(
        'SELECT * FROM videos WHERE collection_id = ? ORDER BY published_at DESC',
        [collectionId]
      );

      // Get comment count for each video
      for (const video of videos) {
        const commentCount = await db.get(
          'SELECT COUNT(*) as count FROM comments WHERE video_id = ?',
          [video.id]
        );
        video.comment_count = commentCount?.count || 0;
      }

      return {
        success: true,
        data: videos
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  });

  // Get comments for a video
  ipcMain.handle('db:getComments', async (event, videoId) => {
    try {
      const db = await getDatabase();
      const comments = await db.all(
        'SELECT * FROM comments WHERE video_id = ? ORDER BY like_count DESC',
        [videoId]
      );
      return {
        success: true,
        data: comments
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  });

  ipcMain.handle('db:getRatingsForProject', async (event, projectId) => {
    try {
      const db = await getDatabase();
      const ratings = await db.getRatingsForProject(projectId);
      return {
        success: true,
        data: ratings
      };
    } catch (error) {
      console.error('Error getting ratings:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  });

  // Database export handler
  ipcMain.handle('database:export', async (event, outputPath) => {
    try {
      const db = await getDatabase();
      const filepath = await db.exportDatabase(outputPath);
      return { success: true, data: filepath };
    } catch (error) {
      console.error('Error exporting database:', error);
      return { success: false, error: error.message };
    }
  });

  // ========================================
  // Database Merge IPC Handlers
  // ========================================

  ipcMain.handle('database:getCollections', async (event, limit = 50, offset = 0) => {
    try {
      const db = await getDatabase();
      return await db.getCollections(limit, offset);
    } catch (error) {
      console.error('[IPC] Error getting collections:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getCollection', async (event, id) => {
    try {
      const db = await getDatabase();
      return await db.getCollection(id);
    } catch (error) {
      console.error('[IPC] Error getting collection:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getAllMerges', async () => {
    try {
      const db = await getDatabase();
      return await db.getAllMerges();
    } catch (error) {
      console.error('[IPC] Error getting all merges:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getMerge', async (event, mergeId) => {
    try {
      const db = await getDatabase();
      return await db.getMerge(mergeId);
    } catch (error) {
      console.error('[IPC] Error getting merge:', error);
      throw error;
    }
  });

  ipcMain.handle('database:createMerge', async (event, name, collectionIds, options) => {
    try {
      const db = await getDatabase();
      return await db.createMerge(name, collectionIds, options);
    } catch (error) {
      console.error('[IPC] Error creating merge:', error);
      throw error;
    }
  });

  ipcMain.handle('database:updateMerge', async (event, mergeId, updates) => {
    try {
      const db = await getDatabase();
      return await db.updateMerge(mergeId, updates);
    } catch (error) {
      console.error('[IPC] Error updating merge:', error);
      throw error;
    }
  });

  ipcMain.handle('database:deleteMerge', async (event, mergeId, hard = false) => {
    try {
      const db = await getDatabase();
      return await db.deleteMerge(mergeId, hard);
    } catch (error) {
      console.error('[IPC] Error deleting merge:', error);
      throw error;
    }
  });

  ipcMain.handle('database:addCollectionToMerge', async (event, mergeId, collectionId) => {
    try {
      const db = await getDatabase();
      return await db.addCollectionToMerge(mergeId, collectionId);
    } catch (error) {
      console.error('[IPC] Error adding collection to merge:', error);
      throw error;
    }
  });

  ipcMain.handle('database:removeCollectionFromMerge', async (event, mergeId, collectionId) => {
    try {
      const db = await getDatabase();
      return await db.removeCollectionFromMerge(mergeId, collectionId);
    } catch (error) {
      console.error('[IPC] Error removing collection from merge:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getMergeStatistics', async (event, mergeId) => {
    try {
      const db = await getDatabase();
      return await db.getMergeStatistics(mergeId);
    } catch (error) {
      console.error('[IPC] Error getting merge statistics:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getMergeVideos', async (event, mergeId) => {
    try {
      const db = await getDatabase();
      return await db.getMergeVideos(mergeId);
    } catch (error) {
      console.error('[IPC] Error getting merge videos:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getMergeComments', async (event, mergeId) => {
    try {
      const db = await getDatabase();
      return await db.getMergeComments(mergeId);
    } catch (error) {
      console.error('[IPC] Error getting merge comments:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getMergeVideoChunks', async (event, mergeId) => {
    try {
      const db = await getDatabase();
      return await db.getMergeVideoChunks(mergeId);
    } catch (error) {
      console.error('[IPC] Error getting merge video chunks:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getMergePDFs', async (event, mergeId) => {
    try {
      const db = await getDatabase();
      return await db.getMergePDFs(mergeId);
    } catch (error) {
      console.error('[IPC] Error getting merge PDFs:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getMergePDFExcerpts', async (event, mergeId) => {
    try {
      const db = await getDatabase();
      return await db.getMergePDFExcerpts(mergeId);
    } catch (error) {
      console.error('[IPC] Error getting merge PDF excerpts:', error);
      throw error;
    }
  });

  ipcMain.handle('database:getItemsForRating', async (event, collectionId, includeChunks, includeComments, projectId, includePDFs) => {
    try {
      const db = await getDatabase();
      return await db.getItemsForRating(collectionId, includeChunks, includeComments, projectId, includePDFs);
    } catch (error) {
      console.error('[IPC] Error getting items for rating:', error);
      throw error;
    }
  });
}

module.exports = {
  registerDatabaseHandlers
};
