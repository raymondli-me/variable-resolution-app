import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import { TranscriptionService } from '../services/transcription.js';

export class EnhancedYouTubeCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.outputDir = options.outputDir || './output';
    this.transcriptionService = new TranscriptionService(options.whisper || {});
    this.useYtDlp = options.useYtDlp !== false; // Default to true
  }

  /**
   * Check available tools
   */
  async checkTools() {
    const tools = {
      ytDlp: false,
      youtubeDl: false,
      ffmpeg: false,
      whisper: false,
      gpuAcceleration: false
    };

    // Check yt-dlp
    const ytDlpCheck = await this.runCommand('yt-dlp', ['--version']);
    tools.ytDlp = ytDlpCheck.success;
    
    // Check youtube-dl as fallback
    if (!tools.ytDlp) {
      const youtubeDlCheck = await this.runCommand('youtube-dl', ['--version']);
      tools.youtubeDl = youtubeDlCheck.success;
    }

    // Check ffmpeg
    const ffmpegCheck = await this.runCommand('ffmpeg', ['-version']);
    tools.ffmpeg = ffmpegCheck.success;

    // Check Whisper and GPU
    const whisperCaps = await this.transcriptionService.checkCapabilities();
    tools.whisper = whisperCaps.whisperInstalled;
    tools.gpuAcceleration = whisperCaps.gpuAcceleration;
    tools.whisperDetails = whisperCaps;

    return tools;
  }

  /**
   * Download video using yt-dlp with advanced options
   */
  async downloadVideo(videoUrl, options = {}) {
    const {
      quality = 'bestvideo[height<=720]+bestaudio/best[height<=720]',
      format = 'mp4',
      subtitles = true,
      thumbnail = true,
      metadata = true,
      chapters = true,
      comments = false,
      outputPath = null,
      rateLimit = null,
      cookies = null,
      proxy = null
    } = options;

    const videoId = this.extractVideoId(videoUrl);
    const outputDir = path.join(this.outputDir, 'videos');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = outputPath || path.join(outputDir, `${videoId}.${format}`);
    
    // Build yt-dlp command
    const command = this.useYtDlp ? 'yt-dlp' : 'youtube-dl';
    const args = [
      videoUrl,
      '-f', quality,
      '-o', outputFile,
      '--merge-output-format', format
    ];

    // Add optional features
    if (subtitles) {
      args.push('--write-subs', '--write-auto-subs', '--sub-langs', 'en,en-US');
    }

    if (thumbnail) {
      args.push('--write-thumbnail');
    }

    if (metadata) {
      args.push('--write-info-json', '--write-description');
    }

    if (chapters) {
      args.push('--write-chapters');
    }

    if (comments && this.useYtDlp) {
      args.push('--write-comments');
    }

    if (rateLimit) {
      args.push('--limit-rate', rateLimit);
    }

    if (cookies) {
      args.push('--cookies', cookies);
    }

    if (proxy) {
      args.push('--proxy', proxy);
    }

    // Progress tracking
    args.push('--newline', '--progress');

    console.log(`Downloading video ${videoId} with ${command}...`);
    
    const result = await this.runYtDlp(command, args, (progress) => {
      this.emit('download:progress', {
        videoId,
        ...progress
      });
    });

    if (result.success) {
      // Gather all downloaded files
      const files = {
        video: outputFile,
        info: outputFile.replace(`.${format}`, '.info.json'),
        thumbnail: null,
        subtitles: null,
        chapters: null,
        comments: null
      };

      // Check for additional files
      try {
        const dir = path.dirname(outputFile);
        const base = path.basename(outputFile, `.${format}`);
        
        const dirFiles = await fs.readdir(dir);
        
        // Find thumbnail
        const thumbFile = dirFiles.find(f => f.startsWith(base) && (f.endsWith('.jpg') || f.endsWith('.webp')));
        if (thumbFile) files.thumbnail = path.join(dir, thumbFile);
        
        // Find subtitles
        const subFile = dirFiles.find(f => f.startsWith(base) && f.includes('.en.') && f.endsWith('.vtt'));
        if (subFile) files.subtitles = path.join(dir, subFile);
        
        // Find chapters
        const chapFile = dirFiles.find(f => f.startsWith(base) && f.endsWith('.chapters.json'));
        if (chapFile) files.chapters = path.join(dir, chapFile);
        
        // Find comments (yt-dlp only)
        const commFile = dirFiles.find(f => f.startsWith(base) && f.endsWith('.comments.json'));
        if (commFile) files.comments = path.join(dir, commFile);
        
      } catch (e) {
        console.error('Error checking for additional files:', e);
      }

      return {
        success: true,
        files,
        videoId,
        duration: result.duration
      };
    } else {
      throw new Error(`Download failed: ${result.error}`);
    }
  }

  /**
   * Download video and transcribe with Whisper
   */
  async downloadAndTranscribe(videoUrl, options = {}) {
    const {
      downloadOptions = {},
      transcriptionOptions = {},
      keepVideo = true,
      extractAudioOnly = false
    } = options;

    try {
      // Step 1: Download video
      let downloadResult;
      
      if (extractAudioOnly) {
        // Download audio only
        downloadResult = await this.downloadAudio(videoUrl, downloadOptions);
      } else {
        // Download full video
        downloadResult = await this.downloadVideo(videoUrl, downloadOptions);
      }

      this.emit('download:complete', downloadResult);

      // Step 2: Transcribe
      const inputFile = extractAudioOnly ? downloadResult.files.audio : downloadResult.files.video;
      
      console.log('Starting transcription...');
      this.emit('transcription:start', { videoId: downloadResult.videoId });

      const transcription = await this.transcriptionService.transcribe(inputFile, {
        ...transcriptionOptions,
        onProgress: (progress) => {
          this.emit('transcription:progress', {
            videoId: downloadResult.videoId,
            ...progress
          });
        }
      });

      this.emit('transcription:complete', {
        videoId: downloadResult.videoId,
        transcription
      });

      // Step 3: Clean up if requested
      if (!keepVideo && !extractAudioOnly) {
        await fs.unlink(downloadResult.files.video).catch(() => {});
      }

      return {
        ...downloadResult,
        transcription
      };

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Download audio only
   */
  async downloadAudio(videoUrl, options = {}) {
    const {
      quality = 'bestaudio',
      format = 'mp3',
      bitrate = '192k'
    } = options;

    const audioOptions = {
      ...options,
      quality: `${quality}/best`,
      format: format
    };

    // Add audio extraction flags
    const videoId = this.extractVideoId(videoUrl);
    const outputPath = path.join(this.outputDir, 'audio', `${videoId}.${format}`);
    
    const command = this.useYtDlp ? 'yt-dlp' : 'youtube-dl';
    const args = [
      videoUrl,
      '-f', audioOptions.quality,
      '-o', outputPath,
      '--extract-audio',
      '--audio-format', format,
      '--audio-quality', bitrate,
      '--no-video'
    ];

    if (options.metadata) {
      args.push('--write-info-json');
    }

    const result = await this.runYtDlp(command, args);

    if (result.success) {
      return {
        success: true,
        files: { audio: outputPath },
        videoId,
        format
      };
    } else {
      throw new Error(`Audio download failed: ${result.error}`);
    }
  }

  /**
   * Get video metadata without downloading
   */
  async getMetadata(videoUrl) {
    const command = this.useYtDlp ? 'yt-dlp' : 'youtube-dl';
    const args = [
      videoUrl,
      '--dump-json',
      '--no-download'
    ];

    const result = await this.runCommand(command, args);
    
    if (result.success) {
      try {
        return JSON.parse(result.output);
      } catch (e) {
        throw new Error('Failed to parse video metadata');
      }
    } else {
      throw new Error(`Metadata fetch failed: ${result.error}`);
    }
  }

  /**
   * Batch download with queue management
   */
  async batchDownload(urls, options = {}) {
    const {
      concurrent = 3,
      continueOnError = true,
      transcribe = false
    } = options;

    const results = [];
    const queue = [...urls];
    const processing = new Map();

    const processNext = async () => {
      if (queue.length === 0) return;

      const url = queue.shift();
      const promise = transcribe
        ? this.downloadAndTranscribe(url, options)
        : this.downloadVideo(url, options.downloadOptions);

      processing.set(url, promise);

      try {
        const result = await promise;
        results.push({ url, success: true, result });
      } catch (error) {
        results.push({ url, success: false, error: error.message });
        
        if (!continueOnError) {
          throw error;
        }
      } finally {
        processing.delete(url);
        if (queue.length > 0) {
          await processNext();
        }
      }
    };

    // Start concurrent downloads
    const promises = [];
    for (let i = 0; i < Math.min(concurrent, urls.length); i++) {
      promises.push(processNext());
    }

    await Promise.all(promises);

    return results;
  }

  /**
   * Run yt-dlp with progress parsing
   */
  async runYtDlp(command, args, onProgress) {
    return new Promise((resolve) => {
      const proc = spawn(command, args);
      
      let output = '';
      let error = '';
      let duration = null;

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;

        // Parse progress
        if (text.includes('%')) {
          const match = text.match(/\[download\]\s+(\d+\.?\d*)%.*?at\s+([^\s]+).*?ETA\s+([^\s]+)/);
          if (match) {
            const progress = parseFloat(match[1]);
            const speed = match[2];
            const eta = match[3];
            
            if (onProgress) {
              onProgress({
                percentage: progress,
                speed,
                eta
              });
            }
          }
        }

        // Extract duration
        if (text.includes('Duration:')) {
          const durMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+)/);
          if (durMatch) {
            duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]);
          }
        }
      });

      proc.stderr.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error,
          duration
        });
      });
    });
  }

  /**
   * Helper: Run command
   */
  async runCommand(command, args) {
    return new Promise((resolve) => {
      const proc = spawn(command, args);
      
      let output = '';
      let error = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          output,
          error: err.message
        });
      });
    });
  }

  /**
   * Extract video ID from URL
   */
  extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : 'unknown';
  }
}