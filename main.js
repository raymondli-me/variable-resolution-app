const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
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

// Simple encryption for API keys (replace with better encryption in production)
function encrypt(text) {
  const algorithm = 'aes-256-ctr';
  const secretKey = 'vr-collector-secret-key-32-chars';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(hash) {
  try {
    const algorithm = 'aes-256-ctr';
    const secretKey = 'vr-collector-secret-key-32-chars';
    const parts = hash.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    return null;
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

// YouTube search handler - REAL API
ipcMain.handle('youtube:search', async (event, { searchTerm, options }) => {
  try {
    const { google } = require('googleapis');
    const youtube = google.youtube({
      version: 'v3',
      auth: options.apiKey
    });

    // Search for videos
    const searchResponse = await youtube.search.list({
      q: searchTerm,
      part: 'snippet',
      type: 'video',
      maxResults: Math.min(options.maxResults || 50, 50),
      order: options.orderBy || 'relevance', // Default to relevance
      publishedAfter: getPublishedAfter(options.dateRange),
      videoDefinition: options.advanced?.videoDefinition === 'high' ? 'high' : undefined,
      videoDuration: options.advanced?.videoDuration || undefined,
      relevanceLanguage: options.advanced?.videoLanguage || 'en'
    });

    const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');

    // Get detailed video information
    const videosResponse = await youtube.videos.list({
      id: videoIds,
      part: 'snippet,statistics,contentDetails'
    });

    // Transform to our format
    const results = videosResponse.data.items.map(video => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      channelId: video.snippet.channelId,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      thumbnails: video.snippet.thumbnails,
      duration: parseDuration(video.contentDetails.duration),
      viewCount: parseInt(video.statistics.viewCount || 0),
      likeCount: parseInt(video.statistics.likeCount || 0),
      commentCount: parseInt(video.statistics.commentCount || 0),
      definition: video.contentDetails.definition,
      caption: video.contentDetails.caption === 'true',
      tags: video.snippet.tags || []
    }));

    // Filter by view count if specified
    let filteredResults = results;
    if (options.advanced?.minViews) {
      filteredResults = filteredResults.filter(v => v.viewCount >= options.advanced.minViews);
    }
    if (options.advanced?.maxViews) {
      filteredResults = filteredResults.filter(v => v.viewCount <= options.advanced.maxViews);
    }

    return { success: true, data: filteredResults };
  } catch (error) {
    console.error('YouTube API Error:', error);
    return { success: false, error: error.message };
  }
});

// Helper to parse ISO 8601 duration
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Helper to get published after date
function getPublishedAfter(dateRange) {
  if (!dateRange || dateRange === 'all') return undefined;
  
  const now = new Date();
  switch (dateRange) {
    case 'today':
      now.setHours(0, 0, 0, 0);
      break;
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      now.setFullYear(now.getFullYear() - 1);
      break;
  }
  return now.toISOString();
}

// YouTube collect handler with real comment collection
ipcMain.handle('youtube:collect', async (event, { jobId, videos, options }) => {
  try {
    const { google } = require('googleapis');
    const youtube = google.youtube({
      version: 'v3',
      auth: options.apiKey
    });
    
    // Create a new collection in the database
    const db = await getDatabase();
    
    // Create a detailed report of all settings used
    const collectionReport = {
      searchTerm: options.searchTerm,
      timestamp: new Date().toISOString(),
      searchSettings: {
        maxResults: options.maxResults,
        dateRange: options.dateRange,
        orderBy: options.orderBy
      },
      advancedFilters: {
        videoDuration: options.advanced?.videoDuration || 'any',
        videoDefinition: options.advanced?.videoDefinition || 'any',
        minViews: options.advanced?.minViews || null,
        maxViews: options.advanced?.maxViews || null,
        minComments: options.advanced?.minComments || 0,
        videoLanguage: options.advanced?.videoLanguage || '',
        channelType: options.advanced?.channelType || 'any',
        embeddable: options.advanced?.embeddable || false,
        syndicated: options.advanced?.syndicated || true,
        apiQuotaLimit: options.advanced?.apiQuotaLimit || 1000,
        rateLimitDelay: options.advanced?.rateLimitDelay || 500
      },
      extractionSettings: options.extraction || {},
      apiKey: options.apiKey ? 'PROVIDED' : 'NOT_PROVIDED',
      environment: {
        platform: process.platform,
        nodeVersion: process.version,
        appVersion: app.getVersion()
      },
      totalVideosRequested: videos.length
    };
    
    // Check if this is a resume operation by looking for existing manifest
    let collectionPath, collectionFolder, folders, manifest;
    const collectionsDir = path.join(app.getPath('userData'), 'collections');
    
    // Try to find existing manifest for this job
    let isResume = false;
    if (jobId) {
      const existingFolders = require('fs').readdirSync(collectionsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const folder of existingFolders) {
        const manifestPath = path.join(collectionsDir, folder, 'collection_manifest.json');
        if (require('fs').existsSync(manifestPath)) {
          const existingManifest = JSON.parse(require('fs').readFileSync(manifestPath, 'utf8'));
          if (existingManifest.jobId === jobId) {
            // Found existing collection for this job
            isResume = true;
            collectionFolder = folder;
            collectionPath = path.join(collectionsDir, folder);
            folders = existingManifest.folders;
            manifest = existingManifest;
            console.log(`Resuming collection in existing folder: ${collectionFolder}`);
            break;
          }
        }
      }
    }
    
    // If not resuming, create new folder structure
    if (!isResume) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const searchTermClean = (options.searchTerm || 'collection').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 50).trim();
      collectionFolder = `${timestamp}_${searchTermClean}`;
      collectionPath = path.join(collectionsDir, collectionFolder);
      
      // Create folder structure
      folders = {
        root: collectionPath,
        videos: path.join(collectionPath, 'videos'),
        thumbnails: path.join(collectionPath, 'thumbnails'),
        transcriptions: path.join(collectionPath, 'transcriptions'),
        chunks: path.join(collectionPath, 'video_chunks'),
        exports: path.join(collectionPath, 'exports'),
        logs: path.join(collectionPath, 'logs')
      };
      
      // Create all folders
      const fs = require('fs');
      Object.values(folders).forEach(folder => {
        fs.mkdirSync(folder, { recursive: true });
      });
      
      // Save collection manifest for resume capability
      manifest = {
        jobId,
        searchTerm: options.searchTerm,
        timestamp: new Date().toISOString(),
        totalVideos: videos.length,
        settings: {
          ...options,
          videos: videos  // Store the full video list for resume
        },
        folders,
        status: 'in_progress',
        completed: [],
        failed: [],
        collectionId: null  // Will be set after collection creation
      };
    }
    
    const manifestPath = path.join(collectionPath, 'collection_manifest.json');
    const fs = require('fs');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Update collection report with folder info
    collectionReport.collectionFolder = collectionFolder;
    collectionReport.collectionPath = collectionPath;
    collectionReport.folders = folders;
    
    // Create collection record or reuse existing one
    let collectionId;
    if (isResume && manifest.collectionId) {
      // Use existing collection ID
      collectionId = manifest.collectionId;
      console.log(`Resuming with existing collection ID: ${collectionId}`);
    } else {
      // Create new collection record
      const collectionSettings = {
        ...options,
        collectionFolder,
        collectionPath,
        folders
      };
      collectionId = await db.createCollection(options.searchTerm, collectionSettings, collectionReport);
      
      // Update manifest with collection ID
      manifest.collectionId = collectionId;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    const collectedVideos = [];
    let totalComments = 0;

    for (const video of videos) {
      try {
        const videoData = { ...video, collectedAt: new Date().toISOString() };
        
        // Collect comments if requested
        if (options.extraction?.includeComments && video.commentCount > 0) {
          const comments = await collectComments(youtube, video.id, {
            maxResults: options.extraction.maxComments || 100,
            order: options.extraction.commentSort || 'relevance', // Default to relevance
            includeReplies: options.extraction.includeReplies || false
          });
          
          videoData.comments = comments;
          totalComments += comments.length;
        }

        // Download video if requested and yt-dlp is available
        if (options.extraction?.downloadVideo) {
          // Send download start notification
          mainWindow.webContents.send('collection:download-start', { 
            jobId, 
            videoId: video.id, 
            title: video.title 
          });
          
          const downloadResult = await downloadVideo(video.id, { ...options, outputDir: folders.videos }, (videoId, progress) => {
            // Send download progress updates
            mainWindow.webContents.send('collection:download-progress', { 
              jobId, 
              videoId, 
              progress 
            });
          });
          
          if (downloadResult.success) {
            videoData.localPath = downloadResult.path;
            videoData.downloadedFiles = downloadResult.files;
            
            // Send download complete notification
            mainWindow.webContents.send('collection:download-complete', { 
              jobId, 
              videoId: video.id, 
              path: downloadResult.path 
            });
            
            // Transcribe if requested and whisper is available
            if (options.extraction?.enableTranscription && downloadResult.files?.video) {
              console.log('Starting transcription for video:', video.id);
              console.log('Video file path:', downloadResult.files.video);
              let transcriptionResult = await transcribeVideo(downloadResult.files.video, options);
              
              // Retry with CPU if MPS backend fails on macOS
              if (!transcriptionResult.success && 
                  process.platform === 'darwin' && 
                  transcriptionResult.error && 
                  (transcriptionResult.error.includes('SparseMPS') || 
                   transcriptionResult.error.includes('aten::_sparse_coo_tensor'))) {
                console.log('MPS backend failed, retrying with CPU...');
                const cpuOptions = { ...options, _forceDevice: 'cpu' };
                transcriptionResult = await transcribeVideo(downloadResult.files.video, cpuOptions);
              }
              
              if (transcriptionResult.success) {
                console.log('Transcription successful for video:', video.id);
                console.log('Transcription data keys:', Object.keys(transcriptionResult.transcription));
                videoData.transcription = transcriptionResult.transcription;
                
                // Create video chunks if enabled
                if (options.extraction?.enableVideoChunking && transcriptionResult.transcription.segments) {
                  console.log('Starting video chunking for:', video.id);
                  const videoName = path.basename(downloadResult.files.video, path.extname(downloadResult.files.video));
                  const chunkResult = await chunkVideoByTranscription(
                    downloadResult.files.video,
                    transcriptionResult.transcription,
                    { 
                      videoId: video.id,
                      chunksDir: path.join(folders.chunks, videoName)
                    }
                  );
                  
                  if (chunkResult.success) {
                    console.log('Video chunking successful:', chunkResult.chunks.length, 'chunks created');
                    videoData.chunks = chunkResult.chunks;
                    videoData.chunksDir = chunkResult.chunksDir;
                  } else {
                    console.error('Video chunking failed:', chunkResult.error);
                  }
                }
              } else {
                console.error('Transcription failed for video:', video.id, transcriptionResult.error);
              }
            }
          } else {
            // Send download error notification
            mainWindow.webContents.send('collection:download-error', { 
              jobId, 
              videoId: video.id, 
              error: downloadResult.error 
            });
          }
        }

        // Save video to database
        await db.saveVideo(videoData, collectionId);
        
        // Save comments to database
        if (videoData.comments) {
          await db.saveComments(videoData.comments, video.id, collectionId);
        }
        
        // Save video chunks to database
        if (videoData.chunks && videoData.chunks.length > 0) {
          await db.saveVideoChunks(videoData.chunks, collectionId);
        }
        
        // Update manifest with completed video
        manifest.completed.push(video.id);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        // Send progress update
        mainWindow.webContents.send('collection:video-complete', { jobId, video: videoData });
        
        collectedVideos.push(videoData);
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, options.advanced?.rateLimitDelay || 500));
        
      } catch (error) {
        console.error(`Error collecting video ${video.id}:`, error);
        
        // Update manifest with failed video
        manifest.failed.push({ 
          videoId: video.id, 
          error: error.message,
          timestamp: new Date().toISOString()
        });
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        if (!options.extraction?.continueOnError) {
          throw error;
        }
      }
    }
    
    // Update collection with final counts
    await db.updateCollection(collectionId, collectedVideos.length, totalComments);
    
    // Update manifest to completed status
    manifest.status = 'completed';
    manifest.completedAt = new Date().toISOString();
    manifest.summary = {
      totalVideos: videos.length,
      successfulVideos: collectedVideos.length,
      failedVideos: manifest.failed.length,
      totalComments
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Generate final collection report
    const finalReport = {
      ...collectionReport,
      completedAt: new Date().toISOString(),
      duration: Date.now() - new Date(collectionReport.timestamp).getTime(),
      results: {
        totalVideosCollected: collectedVideos.length,
        totalCommentsCollected: totalComments,
        videosWithComments: collectedVideos.filter(v => v.comments && v.comments.length > 0).length,
        videosDownloaded: collectedVideos.filter(v => v.localPath).length,
        videosTranscribed: collectedVideos.filter(v => v.transcription).length
      }
    };
    
    // Save final report to a file in the collection directory
    // Save reports to the collection folder
    const reportPath = path.join(folders.root, 'collection_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    
    // Also save a human-readable report
    const readableReport = generateReadableReport(finalReport, collectedVideos);
    const readableReportPath = path.join(folders.root, 'collection_report.txt');
    fs.writeFileSync(readableReportPath, readableReport);

    return { 
      success: true, 
      data: collectedVideos,
      collectionId: collectionId,
      reportPath: reportPath,
      summary: {
        videosCollected: collectedVideos.length,
        commentsCollected: totalComments
      }
    };
  } catch (error) {
    console.error('Collection error:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to fetch all replies for a comment thread
async function fetchAllReplies(youtube, parentId, videoId, alreadyFetched = 0) {
  const replies = [];
  let pageToken = null;
  
  try {
    while (true) {
      const response = await youtube.comments.list({
        parentId: parentId,
        part: 'snippet',
        maxResults: 100,
        pageToken: pageToken
      });
      
      if (!response.data.items || response.data.items.length === 0) break;
      
      // Skip the first 'alreadyFetched' replies as they were already included
      const itemsToProcess = alreadyFetched > 0 ? response.data.items.slice(alreadyFetched) : response.data.items;
      alreadyFetched = 0; // Reset after first page
      
      for (const reply of itemsToProcess) {
        const replyData = reply.snippet;
        replies.push({
          id: reply.id,
          authorChannelId: replyData.authorChannelId?.value,
          authorDisplayName: replyData.authorDisplayName,
          textOriginal: replyData.textOriginal,
          textDisplay: replyData.textDisplay,
          publishedAt: replyData.publishedAt,
          updatedAt: replyData.updatedAt,
          likeCount: replyData.likeCount,
          totalReplyCount: 0,
          parentId: parentId
        });
      }
      
      pageToken = response.data.nextPageToken;
      if (!pageToken) break;
    }
  } catch (error) {
    console.error(`Error fetching replies for comment ${parentId}:`, error.message);
  }
  
  return replies;
}

// Helper to collect comments
async function collectComments(youtube, videoId, options) {
  const comments = [];
  let pageToken = null;
  
  try {
    while (comments.length < options.maxResults) {
      const response = await youtube.commentThreads.list({
        videoId: videoId,
        part: options.includeReplies ? 'snippet,replies' : 'snippet',
        maxResults: Math.min(100, options.maxResults - comments.length),
        order: options.order || 'relevance', // Default to relevance
        pageToken: pageToken
      });

      if (!response.data.items) break;

      for (const item of response.data.items) {
        const comment = item.snippet.topLevelComment.snippet;
        const topLevelComment = {
          id: item.id,
          authorChannelId: comment.authorChannelId?.value,
          authorDisplayName: comment.authorDisplayName,
          textOriginal: comment.textOriginal,
          textDisplay: comment.textDisplay,
          publishedAt: comment.publishedAt,
          updatedAt: comment.updatedAt,
          likeCount: comment.likeCount,
          totalReplyCount: item.snippet.totalReplyCount || 0,
          parentId: null // Top-level comments have no parent
        };
        comments.push(topLevelComment);
        
        // Process replies if includeReplies is true and replies exist
        if (options.includeReplies && item.replies?.comments) {
          for (const reply of item.replies.comments) {
            const replyData = reply.snippet;
            comments.push({
              id: reply.id,
              authorChannelId: replyData.authorChannelId?.value,
              authorDisplayName: replyData.authorDisplayName,
              textOriginal: replyData.textOriginal,
              textDisplay: replyData.textDisplay,
              publishedAt: replyData.publishedAt,
              updatedAt: replyData.updatedAt,
              likeCount: replyData.likeCount,
              totalReplyCount: 0, // Replies don't have replies
              parentId: item.id // Link to parent comment
            });
          }
          
          // Check if there are more replies than what was returned
          const returnedReplies = item.replies.comments.length;
          const totalReplies = item.snippet.totalReplyCount || 0;
          
          if (totalReplies > returnedReplies && totalReplies > 5) {
            // YouTube API returns max 5 replies in the initial response
            // We need to fetch remaining replies using comments.list
            try {
              const additionalReplies = await fetchAllReplies(youtube, item.id, videoId, returnedReplies);
              comments.push(...additionalReplies);
            } catch (error) {
              console.warn(`Failed to fetch all replies for comment ${item.id}:`, error.message);
            }
          }
        }
      }

      pageToken = response.data.nextPageToken;
      if (!pageToken || comments.length >= options.maxResults) break;
    }

    return comments.slice(0, options.maxResults);
  } catch (error) {
    console.error(`Error fetching comments for video ${videoId}:`, error);
    return [];
  }
}

// Database handlers
const { getDatabase } = require('./src/database/db');

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

// Export handler
ipcMain.handle('export:collection', async (event, { collectionId }) => {
  try {
    const db = await getDatabase();
    const outputPath = path.join(
      app.getPath('downloads'),
      `collection_${collectionId}_${Date.now()}.json`
    );
    
    await db.exportCollection(collectionId, outputPath);
    
    return {
      success: true,
      filePath: outputPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Import handler
ipcMain.handle('import:collection', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Collection Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const db = await getDatabase();
      const collectionId = await db.importCollection(result.filePaths[0]);
      
      return {
        success: true,
        collectionId: collectionId
      };
    }
    
    return { success: false, error: 'No file selected' };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

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

// Cancel collection handler
ipcMain.handle('youtube:cancel', async (event, jobId) => {
  // For now, just return success as we don't have active job tracking
  return { success: true };
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

// Download single video handler
ipcMain.handle('youtube:downloadSingleVideo', async (event, { video, options }) => {
  try {
    const outputDir = path.join(app.getPath('userData'), 'videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const result = await downloadVideo(video.id, outputDir, options);
    
    if (result.success) {
      // Update database with local path
      const dbPath = path.join(app.getPath('userData'), 'collections.db');
      const db = require('./src/database/db');
      await db.initialize(dbPath);
      
      await new Promise((resolve, reject) => {
        db.db.run(
          'UPDATE videos SET local_path = ? WHERE id = ?',
          [result.path, video.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      return {
        success: true,
        localPath: result.path
      };
    } else {
      return result;
    }
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

// Helper function to get yt-dlp format string for video quality
function getVideoQualityFormat(quality) {
  switch(quality) {
    case 'lowest':
      return 'worst';
    case '360p':
      return 'bestvideo[height<=360]+bestaudio/best[height<=360]';
    case '480p':
      return 'bestvideo[height<=480]+bestaudio/best[height<=480]';
    case '720p':
      return 'bestvideo[height<=720]+bestaudio/best[height<=720]';
    case '1080p':
      return 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
    case 'highest':
      return 'bestvideo+bestaudio/best';
    default:
      return 'bestvideo[height<=480]+bestaudio/best[height<=480]'; // Default to 480p
  }
}

// Generate human-readable collection report
function generateReadableReport(report, videos) {
  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  let text = `YOUTUBE COLLECTION REPORT
${'='.repeat(50)}

Collection Information:
- Search Term: ${report.searchTerm}
- Started: ${new Date(report.timestamp).toLocaleString()}
- Completed: ${new Date(report.completedAt).toLocaleString()}
- Duration: ${formatDuration(report.duration)}

Search Settings:
- Max Results: ${report.searchSettings.maxResults}
- Date Range: ${report.searchSettings.dateRange}
- Sort By: ${report.searchSettings.orderBy}

Advanced Filters:
${Object.entries(report.advancedFilters).map(([key, value]) => `- ${key}: ${value}`).join('\n') || '- None'}

Extraction Settings:
- Include Comments: ${report.extractionSettings.includeComments || false}
- Max Comments per Video: ${report.extractionSettings.maxComments || 'N/A'}
- Comment Sort Order: ${report.extractionSettings.commentSort || 'relevance'}
- Include Reply Threads: ${report.extractionSettings.includeReplies || false}
- Min Comment Likes: ${report.extractionSettings.minCommentLikes || 0}
- Comment Author Channel ID: ${report.extractionSettings.commentAuthorChannelId || false}
- Comment Timestamps: ${report.extractionSettings.commentTimestamps || false}

Video Extraction:
- Download Videos: ${report.extractionSettings.downloadVideo || false}
- Video Quality: ${report.extractionSettings.videoQuality || 'N/A'}
- Video Format: ${report.extractionSettings.videoFormat || 'mp4'}
- Max File Size (MB): ${report.extractionSettings.maxFileSize || 'N/A'}
- Extract Audio Only: ${report.extractionSettings.extractAudioOnly || false}
- Download Thumbnails: ${report.extractionSettings.downloadThumbnail || false}

Metadata Extraction:
- Extract Title: ${report.extractionSettings.extractTitle !== false}
- Extract Description: ${report.extractionSettings.extractDescription !== false}
- Extract Tags: ${report.extractionSettings.extractTags !== false}
- Extract Thumbnails: ${report.extractionSettings.extractThumbnails !== false}
- Extract Captions: ${report.extractionSettings.extractCaptions || false}
- Extract Statistics: ${report.extractionSettings.extractStatistics !== false}
- Extract Publish Date: ${report.extractionSettings.extractPublishDate !== false}

Channel Information:
- Extract Channel Title: ${report.extractionSettings.extractChannelTitle !== false}
- Extract Channel ID: ${report.extractionSettings.extractChannelId !== false}
- Extract Channel Stats: ${report.extractionSettings.extractChannelStats || false}
- Extract Channel Description: ${report.extractionSettings.extractChannelDescription || false}

Transcription:
- Enable Transcription: ${report.extractionSettings.enableTranscription || false}
- Whisper Model: ${report.extractionSettings.whisperModel || 'N/A'}
- Whisper Device: ${report.extractionSettings.whisperDevice || 'N/A'}
- Whisper Language: ${report.extractionSettings.whisperLanguage || 'auto'}
- Word-level Timestamps: ${report.extractionSettings.whisperTimestamps || false}

Processing Options:
- Text Processing: ${report.extractionSettings.textProcessing || 'none'}
- Skip Duplicates: ${report.extractionSettings.skipDuplicates !== false}
- Continue on Error: ${report.extractionSettings.continueOnError !== false}

Results Summary:
- Total Videos Requested: ${report.totalVideosRequested}
- Total Videos Collected: ${report.results.totalVideosCollected}
- Videos with Comments: ${report.results.videosWithComments}
- Total Comments: ${report.results.totalCommentsCollected}
- Videos Downloaded: ${report.results.videosDownloaded}
- Videos Transcribed: ${report.results.videosTranscribed}

Video List:
${'='.repeat(50)}
`;

  videos.forEach((video, index) => {
    text += `
${index + 1}. ${video.title}
   - Channel: ${video.channelTitle}
   - Views: ${video.viewCount?.toLocaleString() || 0}
   - Comments: ${video.comments?.length || 0}
   - Duration: ${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}
   - Published: ${new Date(video.publishedAt).toLocaleDateString()}
   - URL: https://youtube.com/watch?v=${video.id}
   ${video.localPath ? `- Downloaded: ✓` : ''}
   ${video.transcription ? `- Transcribed: ✓` : ''}
`;
  });
  
  return text;
}

// Video download function
async function downloadVideo(videoId, options, progressCallback = null) {
  const { spawn } = require('child_process');
  const fs = require('fs');
  const os = require('os');
  
  // Check for yt-dlp in multiple locations
  const homedir = require('os').homedir();
  const ytdlpPaths = [
    path.join(homedir, '.local', 'bin', 'yt-dlp'),  // pipx
    '/opt/homebrew/bin/yt-dlp',  // Homebrew on Apple Silicon
    '/usr/local/bin/yt-dlp',      // Homebrew on Intel / standard location
    'yt-dlp'                      // System PATH
  ];
  
  let ytdlpCommand = 'yt-dlp';
  for (const ytdlpPath of ytdlpPaths) {
    if (ytdlpPath === 'yt-dlp' || fs.existsSync(ytdlpPath)) {
      ytdlpCommand = ytdlpPath;
      console.log('Using yt-dlp at:', ytdlpCommand);
      break;
    }
  }
  
  const outputDir = options.outputDir || path.join(app.getPath('userData'), 'videos');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, `${videoId}.mp4`);
  
  return new Promise((resolve) => {
    const args = [
      `https://youtube.com/watch?v=${videoId}`,
      '-f', getVideoQualityFormat(options.extraction?.videoQuality || '480p'),
      '-o', outputPath,
      '--merge-output-format', 'mp4',
      '--progress',
      '--newline',
      '--no-warnings'
    ];
    
    // Add cookies if available
    if (options.cookiesPath) {
      args.push('--cookies', options.cookiesPath);
    }
    
    // Spawn with proper environment for macOS
    const env = { ...process.env };
    if (os.platform() === 'darwin') {
      const homebrewPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
      const currentPath = env.PATH || '';
      env.PATH = homebrewPaths.filter(p => !currentPath.includes(p)).join(':') + ':' + currentPath;
    }
    
    const ytdlp = spawn(ytdlpCommand, args, { env });
    
    let downloadInfo = {
      percent: 0,
      speed: 'N/A',
      eta: 'N/A',
      size: 'N/A'
    };
    
    // Parse yt-dlp output for progress
    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Parse download progress
      const percentMatch = output.match(/(\d+\.?\d*)%/);
      const speedMatch = output.match(/at\s+([\d.]+\s*[KMG]iB\/s)/);
      const etaMatch = output.match(/ETA\s+(\d+:\d+|\d+:\d+:\d+)/);
      const sizeMatch = output.match(/of\s+([\d.]+\s*[KMG]iB)/);
      
      if (percentMatch) downloadInfo.percent = parseFloat(percentMatch[1]);
      if (speedMatch) downloadInfo.speed = speedMatch[1];
      if (etaMatch) downloadInfo.eta = etaMatch[1];
      if (sizeMatch) downloadInfo.size = sizeMatch[1];
      
      // Send progress update
      if (progressCallback) {
        progressCallback(videoId, downloadInfo);
      }
      
      // Also log to console for debugging
      console.log(`[${videoId}] Download: ${downloadInfo.percent.toFixed(1)}% | Speed: ${downloadInfo.speed} | ETA: ${downloadInfo.eta} | Size: ${downloadInfo.size}`);
    });
    
    ytdlp.stderr.on('data', (data) => {
      const error = data.toString();
      // Some info goes to stderr, check if it's actually an error
      if (error.includes('ERROR') || error.includes('error')) {
        console.error('yt-dlp stderr:', error);
      }
    });
    
    ytdlp.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({
          success: true,
          path: outputPath,
          files: { video: outputPath }
        });
      } else {
        resolve({
          success: false,
          error: 'Download failed'
        });
      }
    });
    
    ytdlp.on('error', (err) => {
      console.error('yt-dlp error:', err);
      resolve({
        success: false,
        error: err.message
      });
    });
  });
}

// Video chunking function
async function chunkVideoByTranscription(videoPath, transcription, options = {}) {
  const { spawn } = require('child_process');
  const fs = require('fs').promises;
  
  console.log('Starting video chunking for:', videoPath);
  console.log('Number of segments:', transcription.segments?.length || 0);
  
  const chunks = [];
  const videoName = path.basename(videoPath, path.extname(videoPath));
  // Use provided chunks directory if available, otherwise create alongside video
  const chunksDir = options.chunksDir || path.join(path.dirname(videoPath), `${videoName}_chunks`);
  
  try {
    // Create chunks directory
    await fs.mkdir(chunksDir, { recursive: true });
    
    // Process each segment
    for (let i = 0; i < transcription.segments.length; i++) {
      const segment = transcription.segments[i];
      const chunkPath = path.join(chunksDir, `chunk_${String(i + 1).padStart(4, '0')}.mp4`);
      
      // Extract segment using FFmpeg
      const success = await extractVideoSegment(videoPath, segment.start, segment.end, chunkPath);
      
      if (success) {
        chunks.push({
          chunkNumber: i + 1,
          filePath: chunkPath,
          startTime: segment.start,
          endTime: segment.end,
          duration: segment.end - segment.start,
          text: segment.text,
          videoId: options.videoId
        });
      }
    }
    
    console.log(`Created ${chunks.length} video chunks`);
    return { success: true, chunks, chunksDir };
  } catch (error) {
    console.error('Error chunking video:', error);
    return { success: false, error: error.message };
  }
}

// Extract a video segment using FFmpeg
async function extractVideoSegment(inputPath, startTime, endTime, outputPath) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    const duration = endTime - startTime;
    
    const args = [
      '-ss', startTime.toString(),
      '-i', inputPath,
      '-t', duration.toString(),
      '-c', 'copy',  // Copy codec for speed
      '-avoid_negative_ts', 'make_zero',
      outputPath
    ];
    
    const ffmpeg = spawn('ffmpeg', args);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        console.error(`FFmpeg failed for chunk: ${outputPath}`);
        console.error(stderr);
        resolve(false);
      }
    });
  });
}

// Video transcription function
async function transcribeVideo(videoPath, options) {
  const { spawn } = require('child_process');
  const fs = require('fs');
  const os = require('os');
  
  console.log('transcribeVideo called with:', { videoPath, options });
  
  // Check for pipx-installed whisper first
  const homedir = require('os').homedir();
  const pipxBin = path.join(homedir, '.local', 'bin');
  const pipxWhisper = path.join(pipxBin, 'whisper');
  const whisperCommand = fs.existsSync(pipxWhisper) ? pipxWhisper : 'whisper';
  
  console.log('Using whisper command:', whisperCommand);
  
  return new Promise((resolve) => {
    const outputDir = path.dirname(videoPath);
    
    const args = [
      videoPath,
      '--model', options.extraction?.whisperModel || 'base',
      '--language', options.extraction?.whisperLanguage || 'en',
      '--output_dir', outputDir,
      '--output_format', 'json',
      '--verbose', 'False'
    ];
    
    // Handle device selection
    const device = options.extraction?.whisperDevice || 'auto';
    
    // Check if this is a retry after MPS failure
    const forceDevice = options._forceDevice;
    
    if (forceDevice) {
      // Use the forced device from retry
      args.push('--device', forceDevice);
    } else if (device !== 'auto') {
      // Use user-specified device
      args.push('--device', device);
    }
    // If device is 'auto' and not forcing, let Whisper auto-detect
    
    // Add fp16 False to avoid potential issues with CPU
    args.push('--fp16', 'False')
    
    const whisper = spawn(whisperCommand, args);
    let output = '';
    let error = '';
    
    whisper.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    whisper.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    whisper.on('close', (code) => {
      if (code === 0) {
        const jsonPath = videoPath.replace('.mp4', '.json');
        const fs = require('fs');
        
        if (fs.existsSync(jsonPath)) {
          try {
            const transcription = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            resolve({
              success: true,
              transcription: {
                text: transcription.text,
                segments: transcription.segments,
                language: transcription.language
              }
            });
          } catch (err) {
            resolve({
              success: false,
              error: 'Failed to parse transcription'
            });
          }
        } else {
          resolve({
            success: false,
            error: 'Transcription file not found'
          });
        }
      } else {
        resolve({
          success: false,
          error: error || output || 'Transcription failed'
        });
      }
    });
    
    whisper.on('error', (err) => {
      console.error('Whisper error:', err);
      resolve({
        success: false,
        error: err.message
      });
    });
  });
}

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

ipcMain.handle('ai:getItemCounts', async (event, { collectionId }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'collections.db');
    const db = require('./src/database/db');
    await db.initialize(dbPath);
    
    // Get chunk and comment counts
    const chunks = await db.all(
      'SELECT COUNT(*) as count FROM video_chunks WHERE collection_id = ?',
      [collectionId]
    );
    const comments = await db.all(
      'SELECT COUNT(*) as count FROM comments WHERE collection_id = ?',
      [collectionId]
    );
    
    return {
      success: true,
      data: {
        chunks: chunks[0].count,
        comments: comments[0].count
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
    
    // Create and start rating engine
    ratingEngine = new RatingEngine(db, geminiRater);
    
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
        return { success: false, error: 'Cannot mix video chunks and comments in BWS experiment' };
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
        null // No projectId
      );

      if (rawItems.length === 0) {
        return { success: false, error: 'No items found in collection' };
      }

      // Determine item type
      const itemTypes = new Set(rawItems.map(item => item.type));
      if (itemTypes.size > 1) {
        return { success: false, error: 'Cannot mix video chunks and comments in BWS experiment. Uncheck one type.' };
      }
      item_type = rawItems[0].type === 'comment' ? 'comment' : 'video_chunk';

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

ipcMain.handle('database:getItemsForRating', async (event, collectionId, includeChunks, includeComments, projectId) => {
  try {
    const db = await getDatabase();
    return await db.getItemsForRating(collectionId, includeChunks, includeComments, projectId);
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