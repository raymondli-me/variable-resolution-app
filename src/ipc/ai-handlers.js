const { ipcMain } = require('electron');
const { AiRaterService } = require('../services/ai-rater-service');

/**
 * Register AI Rating IPC Handlers
 *
 * This is a thin wrapper that creates an AiRaterService instance
 * and delegates all IPC calls to the service methods.
 */
function registerAIHandlers(getDatabase, getMainWindow, getSettings, decrypt, getRatingEngine, setRatingEngine) {
  // Create the AI Rater Service
  const aiRaterService = new AiRaterService(
    getDatabase,
    getMainWindow,
    getSettings,
    decrypt,
    getRatingEngine,
    setRatingEngine
  );

  // AI Analysis IPC Handlers
  ipcMain.handle('ai:getRatingProjects', async (event, { collectionId }) => {
    return await aiRaterService.getRatingProjects(collectionId);
  });

  ipcMain.handle('ai:getRatingProject', async (event, { projectId }) => {
    return await aiRaterService.getRatingProject(projectId);
  });

  ipcMain.handle('ai:getAllRatingProjects', async () => {
    return await aiRaterService.getAllRatingProjects();
  });

  ipcMain.handle('ai:getItemCounts', async (event, { collectionId }) => {
    return await aiRaterService.getItemCounts(collectionId);
  });

  // Hierarchical rating project IPC handlers
  ipcMain.handle('ai:getChildProjects', async (event, { projectId }) => {
    return await aiRaterService.getChildProjects(projectId);
  });

  ipcMain.handle('ai:getProjectLineage', async (event, { projectId }) => {
    return await aiRaterService.getProjectLineage(projectId);
  });

  ipcMain.handle('ai:getFilteredItemCount', async (event, { parentProjectId, filterCriteria }) => {
    return await aiRaterService.getFilteredItemCount(parentProjectId, filterCriteria);
  });

  // Preview rating (first 5 items)
  ipcMain.handle('ai:previewRating', async (event, config) => {
    return await aiRaterService.previewRating(config);
  });

  ipcMain.handle('ai:startRating', async (event, config) => {
    return await aiRaterService.startRating(config);
  });

  ipcMain.handle('ai:pauseRating', async () => {
    return await aiRaterService.pauseRating();
  });

  ipcMain.handle('ai:resumeRating', async () => {
    return await aiRaterService.resumeRating();
  });

  ipcMain.handle('ai:cancelRating', async () => {
    return await aiRaterService.cancelRating();
  });

  ipcMain.handle('ai:exportRatings', async (event, { projectId }) => {
    return await aiRaterService.exportRatings(projectId);
  });

  ipcMain.handle('ai:testGeminiConnection', async () => {
    return await aiRaterService.testGeminiConnection();
  });

  ipcMain.handle('ai:getRatingsForProject', async (event, { projectId }) => {
    return await aiRaterService.getRatingsForProject(projectId);
  });
}

module.exports = { registerAIHandlers };
