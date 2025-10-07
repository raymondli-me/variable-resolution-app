/**
 * YouTube Collector Service
 *
 * Modern, class-based service for collecting YouTube data.
 * Provides rich UI feedback through IPC messages and toast notifications.
 *
 * @class YouTubeCollector
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

class YouTubeCollector {
  /**
   * Create a new YouTube Collector instance
   * @param {Function} getDatabase - Function that returns the database instance
   * @param {Function} getMainWindow - Function that returns the main window instance
   */
  constructor(getDatabase, getMainWindow) {
    this.getDatabase = getDatabase;
    this.getMainWindow = getMainWindow;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Parse ISO 8601 duration to seconds
   */
  parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Get published after date for filtering
   */
  getPublishedAfter(dateRange) {
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

  /**
   * Fetch all replies for a comment thread
   */
  async fetchAllReplies(youtube, parentId, videoId, alreadyFetched = 0) {
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

        const itemsToProcess = alreadyFetched > 0 ? response.data.items.slice(alreadyFetched) : response.data.items;
        alreadyFetched = 0;

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
      this.sendProgress({
        type: 'warning',
        message: `Error fetching replies for comment ${parentId}: ${error.message}`
      });
    }

    return replies;
  }

  /**
   * Collect comments for a video
   */
  async collectComments(youtube, videoId, options) {
    const comments = [];
    let pageToken = null;

    try {
      while (comments.length < options.maxResults) {
        const response = await youtube.commentThreads.list({
          videoId: videoId,
          part: options.includeReplies ? 'snippet,replies' : 'snippet',
          maxResults: Math.min(100, options.maxResults - comments.length),
          order: options.order || 'relevance',
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
            parentId: null
          };
          comments.push(topLevelComment);

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
                totalReplyCount: 0,
                parentId: item.id
              });
            }

            const returnedReplies = item.replies.comments.length;
            const totalReplies = item.snippet.totalReplyCount || 0;

            if (totalReplies > returnedReplies && totalReplies > 5) {
              try {
                const additionalReplies = await this.fetchAllReplies(youtube, item.id, videoId, returnedReplies);
                comments.push(...additionalReplies);
              } catch (error) {
                this.sendProgress({
                  type: 'warning',
                  message: `Failed to fetch all replies for comment ${item.id}: ${error.message}`
                });
              }
            }
          }
        }

        pageToken = response.data.nextPageToken;
        if (!pageToken || comments.length >= options.maxResults) break;
      }

      return comments.slice(0, options.maxResults);
    } catch (error) {
      this.sendProgress({
        type: 'error',
        message: `Error fetching comments for video ${videoId}: ${error.message}`
      });
      return [];
    }
  }

  /**
   * Get video quality format for yt-dlp
   */
  getVideoQualityFormat(quality) {
    switch (quality) {
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
        return 'bestvideo[height<=480]+bestaudio/best[height<=480]';
    }
  }

  /**
   * Generate human-readable collection report
   */
  generateReadableReport(report, videos) {
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

  /**
   * Download a video using yt-dlp
   */
  async downloadVideo(videoId, options, progressCallback = null) {
    const { spawn } = require('child_process');
    const os = require('os');

    const homedir = require('os').homedir();
    const ytdlpPaths = [
      path.join(homedir, '.local', 'bin', 'yt-dlp'),
      '/opt/homebrew/bin/yt-dlp',
      '/usr/local/bin/yt-dlp',
      'yt-dlp'
    ];

    let ytdlpCommand = 'yt-dlp';
    for (const ytdlpPath of ytdlpPaths) {
      if (ytdlpPath === 'yt-dlp' || fs.existsSync(ytdlpPath)) {
        ytdlpCommand = ytdlpPath;
        this.sendProgress({
          type: 'info',
          message: `Using yt-dlp at: ${ytdlpCommand}`
        });
        break;
      }
    }

    const outputDir = options.outputDir || path.join(app.getPath('userData'), 'videos');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${videoId}.mp4`);

    return new Promise((resolve) => {
      const args = [
        `https://youtube.com/watch?v=${videoId}`,
        '-f', this.getVideoQualityFormat(options.extraction?.videoQuality || '480p'),
        '-o', outputPath,
        '--merge-output-format', 'mp4',
        '--progress',
        '--newline',
        '--no-warnings'
      ];

      if (options.cookiesPath) {
        args.push('--cookies', options.cookiesPath);
      }

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

      ytdlp.stdout.on('data', (data) => {
        const output = data.toString();

        const percentMatch = output.match(/(\d+\.?\d*)%/);
        const speedMatch = output.match(/at\s+([\d.]+\s*[KMG]iB\/s)/);
        const etaMatch = output.match(/ETA\s+(\d+:\d+|\d+:\d+:\d+)/);
        const sizeMatch = output.match(/of\s+([\d.]+\s*[KMG]iB)/);

        if (percentMatch) downloadInfo.percent = parseFloat(percentMatch[1]);
        if (speedMatch) downloadInfo.speed = speedMatch[1];
        if (etaMatch) downloadInfo.eta = etaMatch[1];
        if (sizeMatch) downloadInfo.size = sizeMatch[1];

        if (progressCallback) {
          progressCallback(videoId, downloadInfo);
        }

        this.sendProgress({
          type: 'info',
          message: `[${videoId}] Download: ${downloadInfo.percent.toFixed(1)}% | Speed: ${downloadInfo.speed} | ETA: ${downloadInfo.eta}`
        });
      });

      ytdlp.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('ERROR') || error.includes('error')) {
          this.sendProgress({
            type: 'error',
            message: `yt-dlp error: ${error}`
          });
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
        this.sendProgress({
          type: 'error',
          message: `yt-dlp error: ${err.message}`
        });
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  /**
   * Chunk video by transcription segments
   */
  async chunkVideoByTranscription(videoPath, transcription, options = {}) {
    const { spawn } = require('child_process');
    const fsPromises = require('fs').promises;

    this.sendProgress({
      type: 'info',
      message: `Starting video chunking for: ${path.basename(videoPath)}`
    });

    const chunks = [];
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const chunksDir = options.chunksDir || path.join(path.dirname(videoPath), `${videoName}_chunks`);

    try {
      await fsPromises.mkdir(chunksDir, { recursive: true });

      for (let i = 0; i < transcription.segments.length; i++) {
        const segment = transcription.segments[i];
        const chunkPath = path.join(chunksDir, `chunk_${String(i + 1).padStart(4, '0')}.mp4`);

        const success = await this.extractVideoSegment(videoPath, segment.start, segment.end, chunkPath);

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

      this.sendProgress({
        type: 'success',
        message: `Created ${chunks.length} video chunks`
      });
      return { success: true, chunks, chunksDir };
    } catch (error) {
      this.sendProgress({
        type: 'error',
        message: `Error chunking video: ${error.message}`
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract a video segment using FFmpeg
   */
  async extractVideoSegment(inputPath, startTime, endTime, outputPath) {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      const duration = endTime - startTime;

      const args = [
        '-ss', startTime.toString(),
        '-i', inputPath,
        '-t', duration.toString(),
        '-c', 'copy',
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
          this.sendProgress({
            type: 'error',
            message: `FFmpeg failed for chunk: ${path.basename(outputPath)}`
          });
          resolve(false);
        }
      });
    });
  }

  /**
   * Transcribe video using Whisper
   */
  async transcribeVideo(videoPath, options) {
    const { spawn } = require('child_process');

    this.sendProgress({
      type: 'info',
      message: `Starting transcription for: ${path.basename(videoPath)}`
    });

    const homedir = require('os').homedir();
    const pipxBin = path.join(homedir, '.local', 'bin');
    const pipxWhisper = path.join(pipxBin, 'whisper');
    const whisperCommand = fs.existsSync(pipxWhisper) ? pipxWhisper : 'whisper';

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

      const device = options.extraction?.whisperDevice || 'auto';
      const forceDevice = options._forceDevice;

      if (forceDevice) {
        args.push('--device', forceDevice);
      } else if (device !== 'auto') {
        args.push('--device', device);
      }

      args.push('--fp16', 'False');

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

          if (fs.existsSync(jsonPath)) {
            try {
              const transcription = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
              this.sendProgress({
                type: 'success',
                message: `Transcription complete for: ${path.basename(videoPath)}`
              });
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
        this.sendProgress({
          type: 'error',
          message: `Whisper error: ${err.message}`
        });
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  // ============================================================================
  // UI FEEDBACK METHODS
  // ============================================================================

  /**
   * Send progress update to UI
   */
  sendProgress(data) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('collection:progress', data);
    }
  }

  /**
   * Send error to UI
   */
  sendError(error, jobId = null) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('collection:error', { error, jobId });
    }
  }

  /**
   * Send video completion to UI
   */
  sendVideoComplete(jobId, video) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('collection:video-complete', { jobId, video });
    }
  }

  /**
   * Send toast notification to UI
   */
  sendToast(type, message, options = {}) {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('show-toast', { type, message, options });
    }
  }

  // ============================================================================
  // PUBLIC METHODS (IPC Handlers)
  // ============================================================================

  /**
   * Search for YouTube videos
   */
  async search(searchTerm, options) {
    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: options.apiKey
      });

      this.sendProgress({
        type: 'info',
        message: `Searching YouTube for: "${searchTerm}"`
      });

      const searchResponse = await youtube.search.list({
        q: searchTerm,
        part: 'snippet',
        type: 'video',
        maxResults: Math.min(options.maxResults || 50, 50),
        order: options.orderBy || 'relevance',
        publishedAfter: this.getPublishedAfter(options.dateRange),
        videoDefinition: options.advanced?.videoDefinition === 'high' ? 'high' : undefined,
        videoDuration: options.advanced?.videoDuration || undefined,
        relevanceLanguage: options.advanced?.videoLanguage || 'en'
      });

      const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');

      const videosResponse = await youtube.videos.list({
        id: videoIds,
        part: 'snippet,statistics,contentDetails'
      });

      const results = videosResponse.data.items.map(video => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        channelId: video.snippet.channelId,
        channelTitle: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt,
        thumbnails: video.snippet.thumbnails,
        duration: this.parseDuration(video.contentDetails.duration),
        viewCount: parseInt(video.statistics.viewCount || 0),
        likeCount: parseInt(video.statistics.likeCount || 0),
        commentCount: parseInt(video.statistics.commentCount || 0),
        definition: video.contentDetails.definition,
        caption: video.contentDetails.caption === 'true',
        tags: video.snippet.tags || []
      }));

      let filteredResults = results;
      if (options.advanced?.minViews) {
        filteredResults = filteredResults.filter(v => v.viewCount >= options.advanced.minViews);
      }
      if (options.advanced?.maxViews) {
        filteredResults = filteredResults.filter(v => v.viewCount <= options.advanced.maxViews);
      }

      this.sendProgress({
        type: 'success',
        message: `Found ${filteredResults.length} videos`
      });

      return { success: true, data: filteredResults };
    } catch (error) {
      this.sendError(error.message);
      this.sendToast('error', `Search failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Collect YouTube videos with full metadata
   */
  async collect(jobId, videos, options) {
    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: options.apiKey
      });

      this.sendProgress({
        type: 'info',
        message: `Starting collection of ${videos.length} videos`
      });

      this.sendToast('info', `Starting collection of ${videos.length} videos`);

      const db = await this.getDatabase();

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

      const collectionsDir = path.join(app.getPath('userData'), 'collections');

      let collectionPath, collectionFolder, folders, manifest;
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
              isResume = true;
              collectionFolder = folder;
              collectionPath = path.join(collectionsDir, folder);
              folders = existingManifest.folders;
              manifest = existingManifest;
              this.sendProgress({
                type: 'info',
                message: `Resuming collection in existing folder: ${collectionFolder}`
              });
              break;
            }
          }
        }
      }

      if (!isResume) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const searchTermClean = (options.searchTerm || 'collection').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 50).trim();
        collectionFolder = `${timestamp}_${searchTermClean}`;
        collectionPath = path.join(collectionsDir, collectionFolder);

        folders = {
          root: collectionPath,
          videos: path.join(collectionPath, 'videos'),
          thumbnails: path.join(collectionPath, 'thumbnails'),
          transcriptions: path.join(collectionPath, 'transcriptions'),
          chunks: path.join(collectionPath, 'video_chunks'),
          exports: path.join(collectionPath, 'exports'),
          logs: path.join(collectionPath, 'logs')
        };

        Object.values(folders).forEach(folder => {
          fs.mkdirSync(folder, { recursive: true });
        });

        manifest = {
          jobId,
          searchTerm: options.searchTerm,
          timestamp: new Date().toISOString(),
          totalVideos: videos.length,
          settings: {
            ...options,
            videos: videos
          },
          folders,
          status: 'in_progress',
          completed: [],
          failed: [],
          collectionId: null
        };
      }

      const manifestPath = path.join(collectionPath, 'collection_manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      collectionReport.collectionFolder = collectionFolder;
      collectionReport.collectionPath = collectionPath;
      collectionReport.folders = folders;

      let collectionId;
      if (isResume && manifest.collectionId) {
        collectionId = manifest.collectionId;
        this.sendProgress({
          type: 'info',
          message: `Resuming with existing collection ID: ${collectionId}`
        });
      } else {
        const collectionSettings = {
          ...options,
          collectionFolder,
          collectionPath,
          folders
        };
        collectionId = await db.createCollection(options.searchTerm, collectionSettings, collectionReport);

        manifest.collectionId = collectionId;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }

      const collectedVideos = [];
      let totalComments = 0;

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];

        try {
          this.sendProgress({
            type: 'info',
            message: `Processing video ${i + 1}/${videos.length}: ${video.title}`
          });

          const videoData = { ...video, collectedAt: new Date().toISOString() };

          if (options.extraction?.includeComments && video.commentCount > 0) {
            this.sendProgress({
              type: 'info',
              message: `Collecting comments for: ${video.title}`
            });

            const comments = await this.collectComments(youtube, video.id, {
              maxResults: options.extraction.maxComments || 100,
              order: options.extraction.commentSort || 'relevance',
              includeReplies: options.extraction.includeReplies || false
            });

            videoData.comments = comments;
            totalComments += comments.length;

            this.sendProgress({
              type: 'success',
              message: `Collected ${comments.length} comments`
            });
          }

          if (options.extraction?.downloadVideo) {
            const mainWindow = this.getMainWindow();
            if (mainWindow) {
              mainWindow.webContents.send('collection:download-start', {
                jobId,
                videoId: video.id,
                title: video.title
              });
            }

            const downloadResult = await this.downloadVideo(video.id, { ...options, outputDir: folders.videos }, (videoId, progress) => {
              const mainWindow = this.getMainWindow();
              if (mainWindow) {
                mainWindow.webContents.send('collection:download-progress', {
                  jobId,
                  videoId,
                  progress
                });
              }
            });

            if (downloadResult.success) {
              videoData.localPath = downloadResult.path;
              videoData.downloadedFiles = downloadResult.files;

              const mainWindow = this.getMainWindow();
              if (mainWindow) {
                mainWindow.webContents.send('collection:download-complete', {
                  jobId,
                  videoId: video.id,
                  path: downloadResult.path
                });
              }

              if (options.extraction?.enableTranscription && downloadResult.files?.video) {
                this.sendProgress({
                  type: 'info',
                  message: `Starting transcription for: ${video.title}`
                });

                let transcriptionResult = await this.transcribeVideo(downloadResult.files.video, options);

                if (!transcriptionResult.success &&
                  process.platform === 'darwin' &&
                  transcriptionResult.error &&
                  (transcriptionResult.error.includes('SparseMPS') ||
                    transcriptionResult.error.includes('aten::_sparse_coo_tensor'))) {
                  this.sendProgress({
                    type: 'warning',
                    message: 'MPS backend failed, retrying with CPU...'
                  });
                  const cpuOptions = { ...options, _forceDevice: 'cpu' };
                  transcriptionResult = await this.transcribeVideo(downloadResult.files.video, cpuOptions);
                }

                if (transcriptionResult.success) {
                  videoData.transcription = transcriptionResult.transcription;

                  if (options.extraction?.enableVideoChunking && transcriptionResult.transcription.segments) {
                    this.sendProgress({
                      type: 'info',
                      message: `Starting video chunking for: ${video.title}`
                    });

                    const videoName = path.basename(downloadResult.files.video, path.extname(downloadResult.files.video));
                    const chunkResult = await this.chunkVideoByTranscription(
                      downloadResult.files.video,
                      transcriptionResult.transcription,
                      {
                        videoId: video.id,
                        chunksDir: path.join(folders.chunks, videoName)
                      }
                    );

                    if (chunkResult.success) {
                      videoData.chunks = chunkResult.chunks;
                      videoData.chunksDir = chunkResult.chunksDir;
                    }
                  }
                } else {
                  this.sendProgress({
                    type: 'error',
                    message: `Transcription failed for ${video.title}: ${transcriptionResult.error}`
                  });
                }
              }
            } else {
              const mainWindow = this.getMainWindow();
              if (mainWindow) {
                mainWindow.webContents.send('collection:download-error', {
                  jobId,
                  videoId: video.id,
                  error: downloadResult.error
                });
              }
            }
          }

          await db.saveVideo(videoData, collectionId);

          if (videoData.comments) {
            await db.saveComments(videoData.comments, video.id, collectionId);
          }

          if (videoData.chunks && videoData.chunks.length > 0) {
            await db.saveVideoChunks(videoData.chunks, collectionId);
          }

          manifest.completed.push(video.id);
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

          this.sendVideoComplete(jobId, videoData);

          collectedVideos.push(videoData);

          await new Promise(resolve => setTimeout(resolve, options.advanced?.rateLimitDelay || 500));

        } catch (error) {
          this.sendProgress({
            type: 'error',
            message: `Error collecting video ${video.id}: ${error.message}`
          });

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

      await db.updateCollection(collectionId, collectedVideos.length, totalComments);

      manifest.status = 'completed';
      manifest.completedAt = new Date().toISOString();
      manifest.summary = {
        totalVideos: videos.length,
        successfulVideos: collectedVideos.length,
        failedVideos: manifest.failed.length,
        totalComments
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

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

      const reportPath = path.join(folders.root, 'collection_report.json');
      fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));

      const readableReport = this.generateReadableReport(finalReport, collectedVideos);
      const readableReportPath = path.join(folders.root, 'collection_report.txt');
      fs.writeFileSync(readableReportPath, readableReport);

      this.sendProgress({
        type: 'success',
        message: `Collection complete! Collected ${collectedVideos.length} videos with ${totalComments} comments`
      });

      this.sendToast('success', `Collection complete! ${collectedVideos.length} videos collected`);

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
      this.sendError(error.message, jobId);
      this.sendToast('error', `Collection failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel a collection job
   */
  async cancel(jobId) {
    this.sendProgress({
      type: 'info',
      message: `Cancelling job ${jobId}`
    });
    this.sendToast('info', 'Collection cancelled');
    return { success: true };
  }

  /**
   * Download a single video
   */
  async downloadSingleVideo(video, options) {
    try {
      const outputDir = path.join(app.getPath('userData'), 'videos');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.sendProgress({
        type: 'info',
        message: `Downloading video: ${video.title}`
      });

      const result = await this.downloadVideo(video.id, { outputDir, extraction: options });

      if (result.success) {
        const dbPath = path.join(app.getPath('userData'), 'collections.db');
        const db = require('../database/db');
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

        this.sendProgress({
          type: 'success',
          message: `Video downloaded successfully: ${video.title}`
        });

        this.sendToast('success', 'Video downloaded successfully');

        return {
          success: true,
          localPath: result.path
        };
      } else {
        this.sendToast('error', `Download failed: ${result.error}`);
        return result;
      }
    } catch (error) {
      this.sendToast('error', `Download failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { YouTubeCollector };
