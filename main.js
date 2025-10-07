const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let settings = {};
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Load settings on startup
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = {};
  }
}

// Save settings to file
function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'VR Data Collector'
  });

  mainWindow.loadFile('index-advanced.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Create application menu with Edit menu for paste support
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

// Database and IPC handler setup
const { getDatabase } = require('./src/database/db');

// Register modular IPC handlers
const { registerFolderHandlers } = require('./src/ipc/folder-handlers');
const { registerCollectionHandlers } = require('./src/ipc/collection-handlers');
const { registerPDFHandlers } = require('./src/ipc/pdf-handlers');
const { registerYouTubeHandlers } = require('./src/ipc/youtube-handlers');
const { registerAIHandlers } = require('./src/ipc/ai-handlers');
const { registerBWSHandlers } = require('./src/ipc/bws-handlers');
const { registerSettingsHandlers, migrateApiKeys, decrypt } = require('./src/ipc/settings-handlers');
const { registerDatabaseHandlers } = require('./src/ipc/database-handlers');
const { registerUtilityHandlers } = require('./src/ipc/utility-handlers');

// Initialize rating engine
let ratingEngine = null;

// Register all handlers
registerFolderHandlers(getDatabase);
registerCollectionHandlers(getDatabase);
registerPDFHandlers(getDatabase);
registerYouTubeHandlers(getDatabase, () => mainWindow);
registerAIHandlers(
  getDatabase,
  () => mainWindow,
  () => settings,
  decrypt,
  () => ratingEngine,
  (value) => { ratingEngine = value; }
);
registerBWSHandlers(getDatabase, () => mainWindow, () => settings, decrypt);
registerSettingsHandlers(() => settings, saveSettings);
registerDatabaseHandlers(getDatabase);
registerUtilityHandlers(getDatabase, () => mainWindow);

app.whenReady().then(async () => {
  // Run database migration
  try {
    const { migrateDatabase } = require('./src/database/migrate');
    await migrateDatabase();
    console.log('[APP] Database migration complete');
  } catch (error) {
    console.error('[APP] Migration failed:', error);
  }
  
  // Ensure PATH includes homebrew on macOS
  if (process.platform === 'darwin') {
    const currentPath = process.env.PATH || '';
    const homebrewPaths = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin'];
    const pathsToAdd = homebrewPaths.filter(p => !currentPath.includes(p));
    if (pathsToAdd.length > 0) {
      process.env.PATH = pathsToAdd.join(':') + ':' + currentPath;
    }
  }
  
  loadSettings();

  // Migrate API keys from old encryption to new safeStorage encryption
  migrateApiKeys(settings, saveSettings);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});