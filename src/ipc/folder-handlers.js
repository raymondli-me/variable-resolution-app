const { ipcMain } = require('electron');

/**
 * Register all folder-related IPC handlers
 * @param {Object} db - Database instance (getDatabase function result)
 */
function registerFolderHandlers(getDatabase) {
  // ============================================
  // FOLDER MANAGEMENT IPC HANDLERS
  // ============================================

  ipcMain.handle('folders:create', async (event, name, parentFolderId, options) => {
    try {
      const db = await getDatabase();
      const folderId = await db.createFolder(name, parentFolderId, options);
      return { success: true, data: folderId };
    } catch (error) {
      console.error('[IPC] Error creating folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folders:get', async (event, folderId) => {
    try {
      const db = await getDatabase();
      const folder = await db.getFolder(folderId);
      return { success: true, data: folder };
    } catch (error) {
      console.error('[IPC] Error getting folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folders:getContents', async (event, folderId) => {
    try {
      const db = await getDatabase();
      const contents = await db.getFolderContents(folderId);
      return { success: true, data: contents };
    } catch (error) {
      console.error('[IPC] Error getting folder contents:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folders:move', async (event, folderId, newParentId) => {
    try {
      const db = await getDatabase();
      await db.moveFolder(folderId, newParentId);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error moving folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folders:rename', async (event, folderId, newName) => {
    try {
      const db = await getDatabase();
      await db.renameFolder(folderId, newName);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error renaming folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folders:delete', async (event, folderId, cascade) => {
    try {
      const db = await getDatabase();
      await db.deleteFolder(folderId, cascade);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error deleting folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folders:getPath', async (event, folderId) => {
    try {
      const db = await getDatabase();
      const path = await db.getFolderPath(folderId);
      return { success: true, data: path };
    } catch (error) {
      console.error('[IPC] Error getting folder path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folders:archive', async (event, folderId, archived) => {
    try {
      const db = await getDatabase();
      await db.archiveFolder(folderId, archived);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error archiving folder:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // FOLDER EXPORT/IMPORT HANDLERS
  // ============================================

  ipcMain.handle('folders:export', async (event, folderId, outputPath, options) => {
    try {
      const db = await getDatabase();
      const filepath = await db.exportFolder(folderId, outputPath, options);
      return { success: true, data: filepath };
    } catch (error) {
      console.error('Error exporting folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folders:import', async (event, zipPath, options) => {
    try {
      const db = await getDatabase();
      const result = await db.importFolder(zipPath, options);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error importing folder:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerFolderHandlers };
