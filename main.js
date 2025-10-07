const { app, BrowserWindow, Menu, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Import the CARDS export service
const CARDSExportService = require('./src/services/cards-export');
// Import AI services
const GeminiRater = require('./src/services/gemini-rater');
const RatingEngine = require('./src/services/rating-engine');

let mainWindow;
let settings = {};
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let ratingEngine = null; // Global rating engine instance

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

// Secure encryption for API keys using Electron's safeStorage
// Uses OS-level encryption: macOS Keychain, Windows DPAPI, Linux libsecret
function encrypt(text) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  const encrypted = safeStorage.encryptString(text);
  // Return as base64 string prefixed with 'v2:' to distinguish from old format
  return 'v2:' + encrypted.toString('base64');
}

function decrypt(encryptedData) {
  try {
    // Check if this is new format (v2:) or old format (hex:hex)
    if (encryptedData.startsWith('v2:')) {
      // New format using safeStorage
      const buffer = Buffer.from(encryptedData.substring(3), 'base64');
      return safeStorage.decryptString(buffer);
    } else {
      // Old format - migrate from hardcoded key encryption
      return decryptLegacy(encryptedData);
    }
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Legacy decryption for migration purposes only
function decryptLegacy(hash) {
  try {
    const algorithm = 'aes-256-ctr';
    const secretKey = 'vr-collector-secret-key-32-chars';
    const parts = hash.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Legacy decryption error:', error);
    return null;
  }
}

// Migrate API keys from old encryption to new safeStorage encryption
function migrateApiKeys() {
  if (!settings.apiKeys) return;

  let migrated = false;
  for (const [service, encryptedKey] of Object.entries(settings.apiKeys)) {
    // Check if this key is in old format (doesn't start with 'v2:')
    if (!encryptedKey.startsWith('v2:')) {
      console.log(`Migrating API key for service: ${service}`);
      try {
        // Decrypt using old method
        const decryptedKey = decryptLegacy(encryptedKey);
        if (decryptedKey) {
          // Re-encrypt using new secure method
          settings.apiKeys[service] = encrypt(decryptedKey);
          migrated = true;
          console.log(`Successfully migrated API key for ${service}`);
        } else {
          console.error(`Failed to decrypt legacy key for ${service}`);
        }
      } catch (error) {
        console.error(`Error migrating key for ${service}:`, error);
      }
    }
  }

  // Save if any keys were migrated
  if (migrated) {
    saveSettings();
    console.log('API key migration completed and saved');
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

// IPC Handlers

// Settings handlers
ipcMain.handle('settings:saveApiKey', async (event, { service, apiKey }) => {
  try {
    if (!settings.apiKeys) {
      settings.apiKeys = {};
    }
    // Encrypt the API key before storing
    settings.apiKeys[service] = encrypt(apiKey);
    saveSettings();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:getApiKey', async (event, service) => {
  try {
    if (settings.apiKeys && settings.apiKeys[service]) {
      const decrypted = decrypt(settings.apiKeys[service]);
      return { success: true, apiKey: decrypted };
    }
    return { success: true, apiKey: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Database handlers
const { getDatabase } = require('./src/database/db');

// Register modular IPC handlers
const { registerFolderHandlers } = require('./src/ipc/folder-handlers');
const { registerCollectionHandlers } = require('./src/ipc/collection-handlers');
const { registerPDFHandlers } = require('./src/ipc/pdf-handlers');
const { registerYouTubeHandlers } = require('./src/ipc/youtube-handlers');
registerFolderHandlers(getDatabase);
registerCollectionHandlers(getDatabase);
registerPDFHandlers(getDatabase);
registerYouTubeHandlers(getDatabase, () => mainWindow);

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

// Get comments for a video
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

// Get video path handler
ipcMain.handle('getVideoPath', async (event, relativePath) => {
  try {
    const videosDir = path.join(app.getPath('userData'), 'videos');
    const fullPath = path.join(videosDir, relativePath);
    
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    return null;
  } catch (error) {
    console.error('Error getting video path:', error);
    return null;
  }
});

// Export handlers
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

// Dialog handlers for file pickers
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || []
  });
  return result.filePaths[0]; // Return first selected file or undefined
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultPath || '',
    filters: options.filters || []
  });
  return result.filePath; // Return selected path or undefined
});

// Export to CSV handler
ipcMain.handle('export:toCSV', async (event, { collectionId }) => {
  try {
    const db = await getDatabase();
    const collection = await db.getCollection(collectionId);
    const videos = await db.all('SELECT * FROM videos WHERE collection_id = ?', [collectionId]);
    const comments = await db.all('SELECT * FROM comments WHERE collection_id = ?', [collectionId]);
    
    // Use the collection's export folder if available, otherwise use downloads
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let outputDir;
    
    if (collection.settings?.folders?.exports) {
      // Use collection's exports folder
      outputDir = path.join(collection.settings.folders.exports, `export_${timestamp}`);
    } else {
      // Fallback to downloads for older collections
      outputDir = path.join(app.getPath('downloads'), `vr_export_${timestamp}`);
    }
    
    // Create output directory
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Parse transcriptions before export
    const videosWithParsedData = videos.map(video => {
      const parsedVideo = { ...video };
      if (video.transcription && video.transcription !== 'null') {
        try {
          const transcriptionData = JSON.parse(video.transcription);
          if (transcriptionData && typeof transcriptionData === 'object') {
            parsedVideo.transcription_text = transcriptionData.text || '';
            parsedVideo.transcription_language = transcriptionData.language || '';
          } else {
            parsedVideo.transcription_text = '';
            parsedVideo.transcription_language = '';
          }
        } catch (e) {
          parsedVideo.transcription_text = '';
          parsedVideo.transcription_language = '';
        }
      } else {
        parsedVideo.transcription_text = '';
        parsedVideo.transcription_language = '';
      }
      return parsedVideo;
    });
    
    // Export videos CSV with transcription fields
    const videosCSV = convertToCSV(videosWithParsedData, [
      'id', 'title', 'channel_title', 'published_at', 
      'view_count', 'like_count', 'comment_count', 'duration',
      'transcription_text', 'transcription_language'
    ]);
    fs.writeFileSync(path.join(outputDir, 'videos.csv'), videosCSV);
    
    // Export comments CSV
    const commentsCSV = convertToCSV(comments, [
      'id', 'video_id', 'author_name', 'text', 
      'published_at', 'like_count', 'reply_count'
    ]);
    fs.writeFileSync(path.join(outputDir, 'comments.csv'), commentsCSV);
    
    // Export collection info
    const infoCSV = `Collection Information
Search Term,${escapeCSV(collection.search_term)}
Created,${new Date(collection.created_at).toLocaleString()}
Videos,${collection.video_count}
Comments,${collection.comment_count}
`;
    fs.writeFileSync(path.join(outputDir, 'collection_info.csv'), infoCSV);
    
    // Export transcriptions as a separate text file for better readability
    const videosWithTranscriptions = videos.filter(v => v.transcription && v.transcription !== 'null');
    if (videosWithTranscriptions.length > 0) {
      let transcriptionsText = 'VIDEO TRANSCRIPTIONS\n';
      transcriptionsText += '='.repeat(80) + '\n\n';
      
      // Collect all segments for CSV export
      const allSegments = [];
      
      videosWithTranscriptions.forEach((video, index) => {
        try {
          const transcriptionData = JSON.parse(video.transcription);
          if (transcriptionData && typeof transcriptionData === 'object') {
            transcriptionsText += `${index + 1}. ${video.title}\n`;
            transcriptionsText += `   Channel: ${video.channel_title}\n`;
            transcriptionsText += `   URL: https://youtube.com/watch?v=${video.id}\n`;
            transcriptionsText += `   Language: ${transcriptionData.metadata?.language || transcriptionData.language || 'Unknown'}\n`;
            transcriptionsText += `   Transcription:\n`;
            transcriptionsText += '-'.repeat(80) + '\n';
            transcriptionsText += transcriptionData.text || 'No text available';
            transcriptionsText += '\n\n' + '='.repeat(80) + '\n\n';
            
            // Collect segments for CSV
            if (transcriptionData.segments && Array.isArray(transcriptionData.segments)) {
              transcriptionData.segments.forEach((segment, segmentIndex) => {
                allSegments.push({
                  video_id: video.id,
                  video_title: video.title,
                  segment_number: segmentIndex + 1,
                  start_time: segment.start || 0,
                  end_time: segment.end || 0,
                  text: segment.text || '',
                  language: transcriptionData.metadata?.language || transcriptionData.language || ''
                });
              });
            }
          }
        } catch (e) {
          console.error('Error parsing transcription for video', video.id, e);
        }
      });
      
      fs.writeFileSync(path.join(outputDir, 'transcriptions.txt'), transcriptionsText);
      
      // Export transcription segments as CSV
      if (allSegments.length > 0) {
        const segmentsCSV = convertToCSV(allSegments, [
          'video_id', 'video_title', 'segment_number', 
          'start_time', 'end_time', 'text', 'language'
        ]);
        fs.writeFileSync(path.join(outputDir, 'transcription_segments.csv'), segmentsCSV);
      }
    }
    
    // Export video chunks if any exist
    const chunks = await db.all('SELECT * FROM video_chunks WHERE collection_id = ?', [collectionId]);
    if (chunks.length > 0) {
      const chunksCSV = convertToCSV(chunks, [
        'video_id', 'chunk_number', 'start_time', 'end_time', 
        'duration', 'transcript_text', 'file_path'
      ]);
      fs.writeFileSync(path.join(outputDir, 'video_chunks.csv'), chunksCSV);
    }
    
    // Also export full JSON data for complete information
    const fullExportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      collection: collection,
      videos: videos.map(v => ({
        ...v,
        // Parse JSON fields for easier access
        tags: v.tags ? JSON.parse(v.tags) : [],
        thumbnails: v.thumbnails ? JSON.parse(v.thumbnails) : {},
        transcription: v.transcription ? JSON.parse(v.transcription) : null
      })),
      comments: comments,
      video_chunks: chunks
    };
    fs.writeFileSync(path.join(outputDir, 'full_export.json'), JSON.stringify(fullExportData, null, 2));
    
    return {
      success: true,
      filePath: outputDir
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Helper function to convert array of objects to CSV
function convertToCSV(data, columns) {
  if (!data || data.length === 0) return '';
  
  // Header
  const header = columns.join(',');
  
  // Rows
  const rows = data.map(item => {
    return columns.map(col => {
      let value = item[col] || '';
      // Handle special cases
      if (col === 'tags' || col === 'thumbnails') {
        try {
          value = JSON.parse(value);
          value = Array.isArray(value) ? value.join(';') : JSON.stringify(value);
        } catch (e) {
          // Keep original value if not JSON
        }
      }
      // Handle transcription text (may contain newlines and commas)
      if (col === 'transcription_text') {
        // Replace newlines with spaces for CSV compatibility
        value = value.toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      }
      return escapeCSV(value.toString());
    }).join(',');
  });
  
  return header + '\n' + rows.join('\n');
}

// Helper to escape CSV values
function escapeCSV(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Export to CARDS handler
ipcMain.handle('export:cards', async (event, { collectionId, options }) => {
  try {
    console.log('Starting CARDS export for collection:', collectionId);
    
    // Initialize database
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);
    
    // Create CARDS export service instance
    const cardsExporter = new CARDSExportService(db);
    
    // Perform the export
    const result = await cardsExporter.exportToCARDS(collectionId, options);
    
    console.log('CARDS export result:', result);
    return result;
    
  } catch (error) {
    console.error('CARDS export error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Add IPC handler for CARDS export preview
ipcMain.handle('export:cards-preview', async (event, { collectionId, options }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);
    
    const cardsExporter = new CARDSExportService(db);
    
    // Get collection info and preview items
    const collection = await db.getCollection(collectionId);
    if (!collection) {
      return { success: false, error: 'Collection not found' };
    }
    
    const items = await cardsExporter.collectItems(collectionId, options || {});
    
    return {
      success: true,
      preview: {
        collection_name: collection.search_term,
        total_items: items.length,
        sample_items: items.slice(0, 10),
        media_summary: cardsExporter.calculateMediaSummary(items)
      }
    };
  } catch (error) {
    console.error('CARDS preview error:', error);
    return { success: false, error: error.message };
  }
});

// Export video comments handler
ipcMain.handle('export:videoComments', async (event, { videoId, videoTitle }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);
    
    const comments = await new Promise((resolve, reject) => {
      db.db.all('SELECT * FROM comments WHERE video_id = ?', [videoId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    if (!comments || comments.length === 0) {
      return { success: false, error: 'No comments found' };
    }
    
    const sanitizedTitle = videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${sanitizedTitle}_comments.csv`;
    const outputDir = path.join(app.getPath('userData'), 'exports');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filePath = path.join(outputDir, fileName);
    
    const csv = convertToCSV(comments, [
      'author_name', 'text', 'published_at', 'like_count', 'reply_count'
    ]);
    
    fs.writeFileSync(filePath, csv);
    
    return {
      success: true,
      filePath: outputDir
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Dialog handler
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// Open folder handler
ipcMain.handle('system:openFolder', async (event, folderPath) => {
  const { shell } = require('electron');
  const fs = require('fs');
  
  // Default to app data folder if no path provided
  if (!folderPath) {
    folderPath = app.getPath('userData');
  }
  
  // Ensure folder exists
  if (!fs.existsSync(folderPath)) {
    // Create videos subfolder if it doesn't exist
    const videosPath = path.join(app.getPath('userData'), 'videos');
    if (!fs.existsSync(videosPath)) {
      fs.mkdirSync(videosPath, { recursive: true });
    }
    folderPath = app.getPath('userData');
  }
  
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Helper function for checking commands
const checkCommand = (command, args = ['-version']) => {
  const { spawn } = require('child_process');
  const os = require('os');
  
  return new Promise((resolve) => {
    // For macOS, ensure we check homebrew paths
    const env = { ...process.env };
    if (os.platform() === 'darwin') {
      const homebrewPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
      const currentPath = env.PATH || '';
      // Make sure homebrew paths are at the beginning
      env.PATH = homebrewPaths.filter(p => !currentPath.includes(p)).join(':') + ':' + currentPath;
    }
    
    // Don't use shell: true for direct command execution
    const proc = spawn(command, args, { 
      env,
      shell: false  // Changed from true to false for more reliable execution
    });
    
    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      // Some tools output version to stderr
      output += data.toString();
    });
    
    proc.on('close', (code) => {
      // FFmpeg returns exit code 1 with -version but still outputs version info
      // Check if we got version output regardless of exit code
      const hasVersionInfo = output.includes('version') || output.includes('ffmpeg');
      
      resolve({
        available: code === 0 || hasVersionInfo,
        version: output.trim()
      });
    });
    
    proc.on('error', () => {
      resolve({ available: false, version: null });
    });
  });
};

// Create virtual environment
async function createVirtualEnvironment() {
  const { spawn } = require('child_process');
  const venvPath = path.join(app.getPath('userData'), 'venv');
  
  return new Promise((resolve, reject) => {
    console.log('Creating virtual environment at:', venvPath);
    
    const proc = spawn('python3', ['-m', 'venv', venvPath], { shell: true });
    let error = '';
    
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('Virtual environment created successfully');
        resolve(true);
      } else {
        console.error('Failed to create virtual environment:', error);
        reject(new Error(error));
      }
    });
    
    proc.on('error', (err) => {
      console.error('Error creating virtual environment:', err);
      reject(err);
    });
  });
}

// Tool detection handler
ipcMain.handle('tools:check', async () => {
  const { spawn } = require('child_process');
  const os = require('os');
  const fs = require('fs');
  
  // Check virtual environment
  const venvPath = path.join(app.getPath('userData'), 'venv');
  const venvBin = os.platform() === 'win32' ? 
    path.join(venvPath, 'Scripts') : 
    path.join(venvPath, 'bin');
  const venvYtdlp = path.join(venvBin, 'yt-dlp');
  const venvWhisper = path.join(venvBin, 'whisper');
  
  const checkCommand = (command, args = ['-version']) => {
    return new Promise((resolve) => {
      // For macOS, ensure we check homebrew paths
      const env = { ...process.env };
      if (os.platform() === 'darwin') {
        const homebrewPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
        const currentPath = env.PATH || '';
        // Make sure homebrew paths are at the beginning
        env.PATH = homebrewPaths.filter(p => !currentPath.includes(p)).join(':') + ':' + currentPath;
      }
      
      // Use shell: false for more reliable execution
      const proc = spawn(command, args, { 
        env,
        shell: false
      });
      
      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        // Some tools output version to stderr
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        // FFmpeg returns exit code 1 with -version but still outputs version info
        // Check if we got version output regardless of exit code
        const hasVersionInfo = output.includes('version') || output.includes('ffmpeg');
        
        resolve({
          available: code === 0 || hasVersionInfo,
          version: output.trim()
        });
      });
      
      proc.on('error', () => {
        resolve({ available: false, version: null });
      });
    });
  };
  
  // Check tools - check both system and pipx locations
  const homedir = require('os').homedir();
  const pipxBin = path.join(homedir, '.local', 'bin');
  
  // Check system paths first, then pipx paths
  const ytDlpSystem = await checkCommand('yt-dlp');
  const ytDlpPipx = await checkCommand(path.join(pipxBin, 'yt-dlp'));
  
  const whisperSystem = await checkCommand('whisper', ['--help']);
  const whisperPipx = await checkCommand(path.join(pipxBin, 'whisper'), ['--help']);
  
  // Check ffmpeg with fallback to common paths
  let ffmpegCheck = await checkCommand('ffmpeg');
  if (!ffmpegCheck.available && os.platform() === 'darwin') {
    // Try common homebrew paths directly
    const ffmpegPaths = [
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg'
    ];
    for (const ffmpegPath of ffmpegPaths) {
      console.log(`Checking ffmpeg at: ${ffmpegPath}`);
      if (fs.existsSync(ffmpegPath)) {
        ffmpegCheck = await checkCommand(ffmpegPath);
        console.log(`FFmpeg at ${ffmpegPath}: ${ffmpegCheck.available}`);
        if (ffmpegCheck.available) {
          ffmpegCheck.path = ffmpegPath;
          break;
        }
      }
    }
  }
  
  console.log('FFmpeg check result:', ffmpegCheck);
  
  const tools = {
    ytDlp: ytDlpSystem.available ? ytDlpSystem : ytDlpPipx,
    youtubeDl: await checkCommand('youtube-dl'), 
    ffmpeg: ffmpegCheck,
    whisper: whisperSystem.available ? whisperSystem : whisperPipx,
    python: await checkCommand('python3', ['-V']),
    pipx: await checkCommand('pipx', ['--version'])
  };
  
  // Check GPU availability
  tools.gpu = { available: false, type: 'cpu' };
  
  if (tools.python.available) {
    const gpuCheckScript = `
import sys
try:
    import torch
    if torch.cuda.is_available():
        print('cuda')
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        print('metal')
    else:
        print('cpu')
except:
    print('cpu')
`;
    
    const gpuResult = await new Promise((resolve) => {
      const proc = spawn('python3', ['-c', gpuCheckScript], { shell: true });
      let output = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', () => {
        const gpuType = output.trim();
        resolve({
          available: gpuType !== 'cpu',
          type: gpuType
        });
      });
      
      proc.on('error', () => {
        resolve({ available: false, type: 'cpu' });
      });
    });
    
    tools.gpu = gpuResult;
  }
  
  // Add platform info
  tools.platform = {
    type: os.type(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release()
  };
  
  return { success: true, tools };
});

// Tool installation handler
ipcMain.handle('tools:install', async (event, toolName) => {
  const { spawn } = require('child_process');
  const os = require('os');
  const fs = require('fs');
  
  // On macOS, ensure pipx is installed first for Python tools
  if (os.platform() === 'darwin' && (toolName === 'ytdlp' || toolName === 'whisper')) {
    const pipxCheck = await checkCommand('pipx', ['--version']);
    if (!pipxCheck.available) {
      // Install pipx first
      const brewResult = await new Promise((resolve) => {
        const proc = spawn('brew', ['install', 'pipx'], { shell: true });
        let output = '';
        let error = '';
        
        proc.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, output });
          } else {
            resolve({ success: false, error: error || 'Failed to install pipx' });
          }
        });
      });
      
      if (!brewResult.success) {
        return {
          success: false,
          error: 'Failed to install pipx. Please run: brew install pipx'
        };
      }
      
      // Ensure pipx path
      await new Promise((resolve) => {
        const proc = spawn('pipx', ['ensurepath'], { shell: true });
        proc.on('close', () => resolve());
      });
    }
  }
  
  let command = '';
  let args = [];
  
  switch (toolName) {
    case 'ytdlp':
      if (os.platform() === 'darwin') {
        // Use pipx on macOS
        command = 'pipx';
        args = ['install', 'yt-dlp'];
      } else if (os.platform() === 'win32') {
        command = 'pip';
        args = ['install', '--user', '--upgrade', 'yt-dlp'];
      } else {
        command = 'pip3';
        args = ['install', '--user', '--upgrade', 'yt-dlp'];
      }
      break;
      
    case 'ffmpeg':
      if (os.platform() === 'darwin') {
        // macOS - use homebrew
        command = 'brew';
        args = ['install', 'ffmpeg'];
      } else if (os.platform() === 'win32') {
        // Windows - download from ffmpeg.org
        return {
          success: false,
          error: 'Please download FFmpeg from https://ffmpeg.org/download.html and add to PATH'
        };
      } else {
        // Linux - use apt
        command = 'sudo';
        args = ['apt', 'install', '-y', 'ffmpeg'];
      }
      break;
      
    case 'whisper':
      if (os.platform() === 'darwin') {
        // Use pipx on macOS
        command = 'pipx';
        args = ['install', 'openai-whisper'];
      } else if (os.platform() === 'win32') {
        command = 'pip';
        args = ['install', '--user', '--upgrade', 'openai-whisper'];
      } else {
        command = 'pip3';
        args = ['install', '--user', '--upgrade', 'openai-whisper'];
      }
      break;
      
    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      };
  }
  
  return new Promise((resolve) => {
    const proc = spawn(command, args, { shell: true });
    let output = '';
    let error = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          output: output || 'Installation completed successfully'
        });
      } else {
        resolve({
          success: false,
          error: error || output || 'Installation failed'
        });
      }
    });
    
    proc.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });
  });
});

// AI Analysis IPC Handlers
ipcMain.handle('ai:getRatingProjects', async (event, { collectionId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const projects = await db.getRatingProjects(collectionId);
    return { success: true, data: projects };
  } catch (error) {
    console.error('Error getting rating projects:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:getRatingProject', async (event, { projectId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const project = await db.getRatingProject(projectId);
    return { success: true, data: project };
  } catch (error) {
    console.error('Error getting rating project:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:getAllRatingProjects', async () => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const projects = await db.getAllRatingProjects();
    return { success: true, data: projects };
  } catch (error) {
    console.error('Error getting all rating projects:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:getItemCounts', async (event, { collectionId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    // Check if this is a merged collection
    if (typeof collectionId === 'string' && collectionId.startsWith('merge:')) {
      const mergeId = parseInt(collectionId.replace('merge:', ''));

      // Get counts from all source collections in the merge
      const chunks = await db.all(`
        SELECT COUNT(*) as count
        FROM video_chunks vc
        JOIN collection_merge_members cmm ON vc.collection_id = cmm.source_collection_id
        WHERE cmm.merge_id = ?
      `, [mergeId]);

      const comments = await db.all(`
        SELECT COUNT(*) as count
        FROM comments c
        JOIN collection_merge_members cmm ON c.collection_id = cmm.source_collection_id
        WHERE cmm.merge_id = ?
      `, [mergeId]);

      const pdfs = await db.all(`
        SELECT COUNT(*) as count
        FROM pdf_excerpts pe
        JOIN collection_merge_members cmm ON pe.collection_id = cmm.source_collection_id
        WHERE cmm.merge_id = ?
      `, [mergeId]);

      return {
        success: true,
        data: {
          chunks: chunks[0].count,
          comments: comments[0].count,
          pdfs: pdfs[0].count
        }
      };
    }

    // Regular collection - get chunk, comment, and PDF counts
    const chunks = await db.all(
      'SELECT COUNT(*) as count FROM video_chunks WHERE collection_id = ?',
      [collectionId]
    );
    const comments = await db.all(
      'SELECT COUNT(*) as count FROM comments WHERE collection_id = ?',
      [collectionId]
    );
    const pdfs = await db.all(
      'SELECT COUNT(*) as count FROM pdf_excerpts WHERE collection_id = ?',
      [collectionId]
    );

    return {
      success: true,
      data: {
        chunks: chunks[0].count,
        comments: comments[0].count,
        pdfs: pdfs[0].count
      }
    };
  } catch (error) {
    console.error('Error getting item counts:', error);
    return { success: false, error: error.message };
  }
});

// Hierarchical rating project IPC handlers
ipcMain.handle('ai:getChildProjects', async (event, { projectId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const children = await db.getChildProjects(projectId);
    return { success: true, data: children };
  } catch (error) {
    console.error('Error getting child projects:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:getProjectLineage', async (event, { projectId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const lineage = await db.getRatingProjectLineage(projectId);
    return { success: true, data: lineage };
  } catch (error) {
    console.error('Error getting project lineage:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:getFilteredItemCount', async (event, { parentProjectId, filterCriteria }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const minScore = filterCriteria.min_score || 0.0;
    const maxScore = filterCriteria.max_score || 1.0;
    const allowedTypes = filterCriteria.content_types || ['video_chunk', 'comment'];

    // Count items from parent project that match filter
    const result = await db.get(`
      SELECT COUNT(*) as count
      FROM relevance_ratings
      WHERE project_id = ?
        AND status = 'success'
        AND relevance_score >= ?
        AND relevance_score <= ?
        AND item_type IN (${allowedTypes.map(() => '?').join(',')})
    `, [parentProjectId, minScore, maxScore, ...allowedTypes]);

    return { success: true, data: { count: result.count } };
  } catch (error) {
    console.error('Error getting filtered item count:', error);
    return { success: false, error: error.message };
  }
});

// Preview rating (first 5 items)
ipcMain.handle('ai:previewRating', async (event, config) => {
  try {
    const geminiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;
    if (!geminiKey) {
      return { success: false, error: 'Gemini API key not set' };
    }

    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    let items;

    // Check if this is a child project preview
    if (config.parentProjectId && config.filterCriteria) {
      console.log('[Preview] Child project - fetching from parent ratings');
      const minScore = config.filterCriteria.min_score || 0.0;
      const maxScore = config.filterCriteria.max_score || 1.0;
      const allowedTypes = config.filterCriteria.content_types || ['video_chunk', 'comment'];

      // Get items from parent's ratings with filters
      const parentRatings = await db.all(`
        SELECT
          r.*,
          c.text as comment_text,
          c.author_name as comment_author,
          c.like_count as comment_likes,
          c.video_id as comment_video_id,
          vc.transcript_text as chunk_text,
          vc.start_time as chunk_start,
          vc.end_time as chunk_end,
          vc.file_path as chunk_file_path,
          vc.video_id as chunk_video_id,
          vc.chunk_number,
          v.title as video_title,
          v.channel_title
        FROM relevance_ratings r
        LEFT JOIN comments c ON r.item_type = 'comment' AND r.item_id = c.id
        LEFT JOIN video_chunks vc ON r.item_type = 'video_chunk' AND r.item_id = vc.id
        LEFT JOIN videos v ON (c.video_id = v.id OR vc.video_id = v.id)
        WHERE r.project_id = ?
          AND r.status = 'success'
          AND r.relevance_score >= ?
          AND r.relevance_score <= ?
          AND r.item_type IN (${allowedTypes.map(() => '?').join(',')})
        ORDER BY r.relevance_score DESC
      `, [config.parentProjectId, minScore, maxScore, ...allowedTypes]);

      // Convert to items format
      items = [];
      for (const rating of parentRatings) {
        if (rating.item_type === 'video_chunk' && config.includeChunks && rating.chunk_file_path) {
          items.push({
            type: 'video_chunk',
            id: rating.item_id,
            video_id: rating.chunk_video_id,
            chunk_number: rating.chunk_number,
            file_path: rating.chunk_file_path,
            start_time: rating.chunk_start,
            end_time: rating.chunk_end,
            transcript_text: rating.chunk_text,
            video_title: rating.video_title,
            channel_title: rating.channel_title,
            parent_rating_score: rating.relevance_score
          });
        } else if (rating.item_type === 'comment' && config.includeComments && rating.comment_text) {
          items.push({
            type: 'comment',
            id: rating.item_id,
            text: rating.comment_text,
            author_name: rating.comment_author,
            like_count: rating.comment_likes,
            video_id: rating.comment_video_id,
            video_title: rating.video_title,
            parent_rating_score: rating.relevance_score
          });
        }
      }

      console.log(`[Preview] Found ${items.length} filtered items from parent`);
    } else {
      // Root project - fetch from collection
      items = await db.getItemsForRating(
        config.collectionId,
        config.includeChunks,
        config.includeComments
      );
    }

    // Take first 5
    const previewItems = items.slice(0, 5);
    const geminiRater = new GeminiRater(geminiKey);
    
    const previews = [];
    for (const item of previewItems) {
      try {
        let result;
        if (item.type === 'video_chunk') {
          result = await geminiRater.rateComment(
            item.transcript_text || 'No transcript',
            { title: item.video_title },
            config.researchIntent,
            config.ratingScale
          );
        } else {
          result = await geminiRater.rateComment(
            item.text,
            { title: item.video_title },
            config.researchIntent,
            config.ratingScale
          );
        }
        previews.push({
          item: {
            type: item.type,
            content: item.type === 'comment' ? item.text : item.transcript_text,
            title: item.video_title
          },
          rating: result
        });
      } catch (error) {
        previews.push({
          item: {
            type: item.type,
            content: item.type === 'comment' ? item.text : item.transcript_text
          },
          error: error.message
        });
      }
    }
    
    return { success: true, previews, totalItems: items.length };
  } catch (error) {
    console.error('Preview error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:startRating', async (event, config) => {
  try {
    // Get Gemini API key
    const geminiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;
    if (!geminiKey) {
      return { success: false, error: 'Gemini API key not set. Please configure it in settings.' };
    }
    
    // Initialize services
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);
    
    const geminiRater = new GeminiRater(geminiKey);

    // Create and start rating engine (pass mainWindow for PDF image generation)
    ratingEngine = new RatingEngine(db, geminiRater, mainWindow);
    
    // Setup event listeners
    ratingEngine.on('progress', (data) => {
      mainWindow.webContents.send('ai:progress', data);
    });
    
    ratingEngine.on('item-rated', (data) => {
      mainWindow.webContents.send('ai:item-rated', data);
    });
    
    ratingEngine.on('complete', (data) => {
      mainWindow.webContents.send('ai:complete', data);
    });
    
    ratingEngine.on('error', (data) => {
      mainWindow.webContents.send('ai:error', data);
    });
    
    // Start rating
    ratingEngine.startRatingProject(config);
    
    return { success: true };
  } catch (error) {
    console.error('Error starting rating:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:pauseRating', async () => {
  if (ratingEngine) {
    ratingEngine.pause();
    return { success: true };
  }
  return { success: false, error: 'No rating in progress' };
});

ipcMain.handle('ai:resumeRating', async () => {
  if (ratingEngine) {
    ratingEngine.resume();
    return { success: true };
  }
  return { success: false, error: 'No rating to resume' };
});

ipcMain.handle('ai:cancelRating', async () => {
  if (ratingEngine) {
    ratingEngine.cancel();
    return { success: true };
  }
  return { success: false, error: 'No rating to cancel' };
});

ipcMain.handle('ai:exportRatings', async (event, { projectId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);
    
    const project = await db.getRatingProject(projectId);
    const ratings = await db.getRatingsForProject(projectId);
    
    const exportData = {
      project,
      ratings,
      exported_at: new Date().toISOString()
    };
    
    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ratings_${project.project_name.replace(/\s+/g, '_')}_${timestamp}.json`;
    const outputPath = path.join(app.getPath('downloads'), filename);
    
    require('fs').writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    
    return { success: true, path: outputPath };
  } catch (error) {
    console.error('Error exporting ratings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:testGeminiConnection', async () => {
  try {
    const geminiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;
    if (!geminiKey) {
      return { success: false, error: 'Gemini API key not set' };
    }

    const geminiRater = new GeminiRater(geminiKey);
    const result = await geminiRater.testConnection();

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:getRatingsForProject', async (event, { projectId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const ratings = await db.getRatingsForProject(projectId);

    return { success: true, ratings };
  } catch (error) {
    console.error('Error getting ratings for project:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// BWS (Best-Worst Scaling) IPC Handlers
// ========================================

// Get all BWS experiments
ipcMain.handle('bws:getAllExperiments', async () => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const experiments = await db.getAllBWSExperiments();
    return { success: true, experiments };
  } catch (error) {
    console.error('Error getting BWS experiments:', error);
    return { success: false, error: error.message };
  }
});

// Get single BWS experiment with stats
ipcMain.handle('bws:getExperiment', async (event, { experimentId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const stats = await db.getBWSExperimentStats(experimentId);
    return { success: true, experiment: stats };
  } catch (error) {
    console.error('Error getting BWS experiment:', error);
    return { success: false, error: error.message };
  }
});

// Create BWS experiment with tuple generation
ipcMain.handle('bws:createExperiment', async (event, config) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const BwsTupleGenerator = require('./src/services/bws-tuple-generator');

    const {
      name,
      source_type,
      rating_project_id,
      collection_id,
      include_comments,
      include_chunks,
      include_pdfs,
      tuple_size,
      target_appearances,
      design_method,
      scoring_method,
      rater_type,
      research_intent,
      min_score = 0.7
    } = config;

    let items = [];
    let item_type = 'mixed';
    let sourceId = null;

    // Fetch items based on source type
    if (source_type === 'rating-project') {
      sourceId = rating_project_id;

      // Fetch items from rating project with score filter
      const ratings = await db.getRatingsForProject(rating_project_id);
      const filteredRatings = ratings.filter(r =>
        r.status === 'success' &&
        r.relevance_score >= min_score
      );

      if (filteredRatings.length === 0) {
        return { success: false, error: 'No items meet the score criteria' };
      }

      // Determine item type (check if all same type)
      const itemTypes = new Set(filteredRatings.map(r => r.item_type));
      if (itemTypes.size > 1) {
        return { success: false, error: 'Cannot mix different content types in BWS experiment' };
      }
      item_type = filteredRatings[0].item_type;

      items = filteredRatings.map(r => ({ id: r.item_id, ...r }));

    } else if (source_type === 'collection') {
      sourceId = collection_id;

      // Fetch items from collection
      const rawItems = await db.getItemsForRating(
        collection_id,
        include_chunks,
        include_comments,
        null, // No projectId
        include_pdfs
      );

      if (rawItems.length === 0) {
        return { success: false, error: 'No items found in collection' };
      }

      // Determine item type
      const itemTypes = new Set(rawItems.map(item => item.type));
      if (itemTypes.size > 1) {
        return { success: false, error: 'Cannot mix different content types in BWS experiment. Uncheck one type.' };
      }
      item_type = rawItems[0].type || 'video_chunk';

      items = rawItems.map(item => ({ id: item.id, ...item }));
    } else {
      return { success: false, error: 'Invalid source_type' };
    }

    if (items.length < tuple_size) {
      return { success: false, error: `Need at least ${tuple_size} items for tuple size ${tuple_size}` };
    }

    // Generate tuples with video diversity constraint
    const itemIds = items.map(item => item.id);

    // For video chunks, build a map of item_id -> video_id to enforce diversity
    const itemVideoMap = {};
    if (item_type === 'video_chunk') {
      items.forEach(item => {
        itemVideoMap[item.id] = item.video_id;
      });
    }

    const tuples = BwsTupleGenerator.generateTuples(itemIds, {
      tupleSize: tuple_size,
      targetAppearances: target_appearances || 4,
      method: design_method || 'balanced',
      itemVideoMap: Object.keys(itemVideoMap).length > 0 ? itemVideoMap : null
    });

    // Validate tuples
    const validation = BwsTupleGenerator.validateTuples(tuples, itemIds, tuple_size);
    if (!validation.valid) {
      console.warn('Tuple validation issues:', validation.issues);
    }

    // Create experiment in database
    const experimentData = {
      name,
      item_type,
      tuple_size,
      tuple_count: tuples.length,
      design_method: design_method || 'balanced',
      scoring_method: scoring_method || 'counting',
      rater_type: rater_type || 'ai',
      research_intent,
      status: 'draft'
    };

    // Add source-specific fields
    if (source_type === 'rating-project') {
      experimentData.rating_project_id = rating_project_id;
    } else {
      experimentData.collection_id = collection_id;
    }

    const experimentId = await db.createBWSExperiment(experimentData);

    // Save tuples
    await db.saveBWSTuples(experimentId, tuples);

    return {
      success: true,
      experiment_id: experimentId,
      tuple_count: tuples.length,
      item_count: itemIds.length,
      validation: validation.statistics
    };
  } catch (error) {
    console.error('Error creating BWS experiment:', error);
    return { success: false, error: error.message };
  }
});

// Update BWS experiment
ipcMain.handle('bws:updateExperiment', async (event, { experimentId, updates }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    await db.updateBWSExperiment(experimentId, updates);

    return { success: true };
  } catch (error) {
    console.error('Error updating BWS experiment:', error);
    return { success: false, error: error.message };
  }
});

// Get next tuple for rating
ipcMain.handle('bws:getNextTuple', async (event, { experimentId, raterType, raterId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const tuple = await db.getNextBWSTuple(experimentId, raterType, raterId);

    if (!tuple) {
      return { success: true, tuple: null, items: null, complete: true };
    }

    // Extract items from tuple object (getBWSTupleWithItems adds items to tuple)
    const items = tuple.items || [];

    return { success: true, tuple, items, complete: false };
  } catch (error) {
    console.error('Error getting next tuple:', error);
    return { success: false, error: error.message };
  }
});

// Save BWS judgment
ipcMain.handle('bws:saveJudgment', async (event, judgmentData) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const judgmentId = await db.saveBWSJudgment(judgmentData);

    return { success: true, judgment_id: judgmentId };
  } catch (error) {
    console.error('Error saving BWS judgment:', error);
    return { success: false, error: error.message };
  }
});

// Calculate scores for experiment
ipcMain.handle('bws:calculateScores', async (event, { experimentId, raterId = null }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const scores = await db.calculateBWSScores(experimentId, raterId);

    // Only update experiment status to completed when calculating combined scores
    if (!raterId) {
      await db.updateBWSExperiment(experimentId, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
    }

    return { success: true, scores };
  } catch (error) {
    console.error('Error calculating BWS scores:', error);
    return { success: false, error: error.message };
  }
});

// Get scores for experiment
ipcMain.handle('bws:getScores', async (event, { experimentId, raterId = 'combined' }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const scores = await db.getBWSScores(experimentId, raterId);

    return { success: true, scores };
  } catch (error) {
    console.error('Error getting BWS scores:', error);
    return { success: false, error: error.message };
  }
});

// Delete BWS experiment
ipcMain.handle('bws:deleteExperiment', async (event, { experimentId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    await db.deleteBWSExperiment(experimentId);

    return { success: true };
  } catch (error) {
    console.error('Error deleting BWS experiment:', error);
    return { success: false, error: error.message };
  }
});

// Get rater judgment count (for multi-rater support)
ipcMain.handle('bws:getRaterJudgmentCount', async (event, { experimentId, raterId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const count = await db.getRaterJudgmentCount(experimentId, raterId);

    return { success: true, count };
  } catch (error) {
    console.error('Error getting rater judgment count:', error);
    return { success: false, error: error.message, count: 0 };
  }
});

// Start AI BWS Rating
ipcMain.handle('bws:startAIRating', async (event, { experimentId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);
    const GeminiRater = require('./src/services/gemini-rater');

    // Get experiment details
    const stats = await db.getBWSExperimentStats(experimentId);
    const experiment = stats;

    // Get API key from encrypted settings
    const geminiKey = settings.apiKeys?.gemini ? decrypt(settings.apiKeys.gemini) : null;
    if (!geminiKey) {
      return { success: false, error: 'Gemini API key not set. Please configure it in Settings.' };
    }

    const rater = new GeminiRater(geminiKey);

    // Update experiment status
    await db.updateBWSExperiment(experimentId, { status: 'in_progress' });

    // Get all tuples
    const allTuples = await db.getBWSTuples(experimentId);

    // Get already rated tuples
    const judgments = await db.getBWSJudgments(experimentId);
    const ratedTupleIds = new Set(judgments.map(j => j.tuple_id));

    // Filter to unrated tuples
    const unratedTuples = allTuples.filter(t => !ratedTupleIds.has(t.id));

    let completedCount = ratedTupleIds.size;
    const totalCount = allTuples.length;

    // Process each tuple
    for (const tuple of unratedTuples) {
      try {
        // Get tuple with items
        const tupleWithItems = await db.getBWSTupleWithItems(tuple.id);

        // Send progress event
        event.sender.send('bws:ai-progress', {
          experimentId,
          current: completedCount,
          total: totalCount,
          percentage: Math.round((completedCount / totalCount) * 100)
        });

        // Rate with Gemini
        const result = await rater.compareBWSItems(tupleWithItems.items, experiment.research_intent);

        // Convert 1-based indices to 0-based and get item IDs
        const bestIndex = result.best - 1;
        const worstIndex = result.worst - 1;
        const bestItemId = tupleWithItems.items[bestIndex]?.id;
        const worstItemId = tupleWithItems.items[worstIndex]?.id;

        if (!bestItemId || !worstItemId) {
          throw new Error('Invalid item indices from Gemini');
        }

        // Save judgment
        await db.saveBWSJudgment({
          tuple_id: tuple.id,
          rater_type: 'ai',
          rater_id: 'gemini-2.5-flash',
          best_item_id: bestItemId,
          worst_item_id: worstItemId,
          reasoning: result.reasoning,
          response_time_ms: 0
        });

        completedCount++;

        // Send item rated event
        event.sender.send('bws:ai-item-rated', {
          tupleId: tuple.id,
          best: bestIndex,
          worst: worstIndex,
          reasoning: result.reasoning
        });

        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error rating tuple ${tuple.id}:`, error);
        event.sender.send('bws:ai-error', {
          tupleId: tuple.id,
          error: error.message
        });
        // Continue with next tuple
      }
    }

    // Calculate scores
    const scores = await db.calculateBWSCountingScores(experimentId);

    // Update experiment to completed
    await db.updateBWSExperiment(experimentId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });

    // Send completion event
    event.sender.send('bws:ai-complete', {
      experimentId,
      scoresCount: scores.length
    });

    return { success: true, completed: completedCount, total: totalCount };

  } catch (error) {
    console.error('Error in AI BWS rating:', error);
    return { success: false, error: error.message };
  }
});

// BWS List View Handlers (for live viewer)
ipcMain.handle('bws:getAllTuples', async (event, { experimentId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    // Get all tuples with their items
    const tuples = await db.all(`
      SELECT id, experiment_id, item_ids, tuple_index, created_at
      FROM bws_tuples
      WHERE experiment_id = ?
      ORDER BY tuple_index
    `, [experimentId]);

    // Parse item_ids JSON and fetch items for each tuple
    const tuplesWithItems = await Promise.all(tuples.map(async (tuple) => {
      tuple.item_ids = JSON.parse(tuple.item_ids);

      // Fetch items
      const items = [];
      for (const itemId of tuple.item_ids) {
        let item = await db.get('SELECT *, "comment" as item_type FROM comments WHERE id = ?', [itemId]);
        if (!item) {
          item = await db.get('SELECT *, "video_chunk" as item_type FROM video_chunks WHERE id = ?', [itemId]);
        }
        if (item) items.push(item);
      }

      return { ...tuple, items };
    }));

    return tuplesWithItems;
  } catch (error) {
    console.error('Error getting all tuples:', error);
    return [];
  }
});

ipcMain.handle('bws:getJudgments', async (event, { experimentId, raterType = null, raterId = null }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    let query = `
      SELECT j.*, t.experiment_id
      FROM bws_judgments j
      JOIN bws_tuples t ON j.tuple_id = t.id
      WHERE t.experiment_id = ?
    `;

    const params = [experimentId];

    if (raterType) {
      query += ` AND j.rater_type = ?`;
      params.push(raterType);
    }

    if (raterId) {
      query += ` AND j.rater_id = ?`;
      params.push(raterId);
    }

    query += ` ORDER BY j.created_at DESC`;

    const judgments = await db.all(query, params);
    return judgments;
  } catch (error) {
    console.error('Error getting judgments:', error);
    return [];
  }
});

ipcMain.handle('bws:getTupleWithItems', async (event, { tupleId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);

    const tupleWithItems = await db.getBWSTupleWithItems(tupleId);
    return tupleWithItems;
  } catch (error) {
    console.error('Error getting tuple with items:', error);
    return null;
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
  migrateApiKeys();

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