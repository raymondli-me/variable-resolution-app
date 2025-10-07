/**
 * YouTube IPC Handlers
 *
 * Thin wrapper that delegates all YouTube operations to the YouTubeCollector service.
 * Provides IPC interface for the renderer process.
 */

const { ipcMain } = require('electron');
const { YouTubeCollector } = require('../services/youtube-collector');

// ============================================================================
// IPC HANDLERS
// ============================================================================

function registerYouTubeHandlers(getDatabase, getMainWindow) {
  // Create a single YouTubeCollector instance to handle all operations
  const youtubeCollector = new YouTubeCollector(getDatabase, getMainWindow);

  // YouTube search handler
  ipcMain.handle('youtube:search', async (event, { searchTerm, options }) => {
    return await youtubeCollector.search(searchTerm, options);
  });

  // YouTube collect handler
  ipcMain.handle('youtube:collect', async (event, { jobId, videos, options }) => {
    return await youtubeCollector.collect(jobId, videos, options);
  });

  // Cancel collection handler
  ipcMain.handle('youtube:cancel', async (event, jobId) => {
    return await youtubeCollector.cancel(jobId);
  });

  // Download single video handler
  ipcMain.handle('youtube:downloadSingleVideo', async (event, { video, options }) => {
    return await youtubeCollector.downloadSingleVideo(video, options);
  });
}

module.exports = { registerYouTubeHandlers };
