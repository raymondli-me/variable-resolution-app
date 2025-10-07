const { ipcMain, app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

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

// Helper function for checking commands
function checkCommand(command, args = ['-version']) {
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
}

// Create virtual environment
async function createVirtualEnvironment() {
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

function registerUtilityHandlers(getDatabase, getMainWindow) {
  // Import CARDS export service
  const CARDSExportService = require('../services/cards-export');

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

  // Dialog handlers for file pickers
  ipcMain.handle('dialog:openFile', async (event, options) => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options.filters || []
    });
    return result.filePaths[0]; // Return first selected file or undefined
  });

  ipcMain.handle('dialog:saveFile', async (event, options) => {
    const mainWindow = getMainWindow();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options.defaultPath || '',
      filters: options.filters || []
    });
    return result.filePath; // Return selected path or undefined
  });

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

  // Export to CARDS handler
  ipcMain.handle('export:cards', async (event, { collectionId, options }) => {
    try {
      console.log('Starting CARDS export for collection:', collectionId);

      // Initialize database
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('../database/db');
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
      const db = require('../database/db');
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
      const db = require('../database/db');
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

  // Tool detection handler
  ipcMain.handle('tools:check', async () => {
    // Check virtual environment
    const venvPath = path.join(app.getPath('userData'), 'venv');
    const venvBin = os.platform() === 'win32' ?
      path.join(venvPath, 'Scripts') :
      path.join(venvPath, 'bin');
    const venvYtdlp = path.join(venvBin, 'yt-dlp');
    const venvWhisper = path.join(venvBin, 'whisper');

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
}

module.exports = {
  registerUtilityHandlers
};
