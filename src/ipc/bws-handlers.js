const { ipcMain } = require('electron');
const { BwsService } = require('../services/bws-service');

/**
 * Register BWS (Best-Worst Scaling) IPC Handlers
 *
 * This is a thin wrapper that creates a BwsService instance
 * and delegates all IPC calls to the service methods.
 */
function registerBWSHandlers(getDatabase, getMainWindow, getSettings, decrypt) {
  // Create the BWS Service
  const bwsService = new BwsService(
    getDatabase,
    getMainWindow,
    getSettings,
    decrypt
  );

  // BWS experiment management handlers
  ipcMain.handle('bws:getAllExperiments', async () => {
    return await bwsService.getAllExperiments();
  });

  ipcMain.handle('bws:getExperiment', async (event, { experimentId }) => {
    return await bwsService.getExperiment(experimentId);
  });

  ipcMain.handle('bws:createExperiment', async (event, config) => {
    return await bwsService.createExperiment(config);
  });

  ipcMain.handle('bws:updateExperiment', async (event, { experimentId, updates }) => {
    return await bwsService.updateExperiment(experimentId, updates);
  });

  ipcMain.handle('bws:deleteExperiment', async (event, { experimentId }) => {
    return await bwsService.deleteExperiment(experimentId);
  });

  // BWS rating handlers
  ipcMain.handle('bws:getNextTuple', async (event, { experimentId, raterType, raterId }) => {
    return await bwsService.getNextTuple(experimentId, raterType, raterId);
  });

  ipcMain.handle('bws:saveJudgment', async (event, judgmentData) => {
    return await bwsService.saveJudgment(judgmentData);
  });

  ipcMain.handle('bws:getRaterJudgmentCount', async (event, { experimentId, raterId }) => {
    return await bwsService.getRaterJudgmentCount(experimentId, raterId);
  });

  // BWS scoring handlers
  ipcMain.handle('bws:calculateScores', async (event, { experimentId, raterId = null }) => {
    return await bwsService.calculateScores(experimentId, raterId);
  });

  ipcMain.handle('bws:getScores', async (event, { experimentId, raterId = 'combined' }) => {
    return await bwsService.getScores(experimentId, raterId);
  });

  // AI rating handler
  ipcMain.handle('bws:startAIRating', async (event, { experimentId }) => {
    return await bwsService.startAIRating(experimentId);
  });

  // BWS live viewer handlers
  ipcMain.handle('bws:getAllTuples', async (event, { experimentId }) => {
    return await bwsService.getAllTuples(experimentId);
  });

  ipcMain.handle('bws:getJudgments', async (event, { experimentId, raterType = null, raterId = null }) => {
    return await bwsService.getJudgments(experimentId, raterType, raterId);
  });

  ipcMain.handle('bws:getTupleWithItems', async (event, { tupleId }) => {
    return await bwsService.getTupleWithItems(tupleId);
  });
}

module.exports = { registerBWSHandlers };
