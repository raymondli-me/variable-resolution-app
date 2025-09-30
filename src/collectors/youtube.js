import ytdl from 'ytdl-core';
import ytsr from 'ytsr';
import { google } from 'googleapis';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import PQueue from 'p-queue';

export class YouTubeCollector extends EventEmitter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    });
    this.queue = new PQueue({ concurrency: 3 });
    this.cancelled = false;
  }

  /**
   * Search YouTube for videos
   */
  async search(searchTerm, options = {}) {
    const {
      maxResults = 50,
      orderBy = 'viewCount',
      dateRange = 'month',
      videoDuration = 'any'
    } = options;

    try {
      // Calculate publishedAfter date
      const publishedAfter = this.getPublishedAfter(dateRange);

      // Search using YouTube API
      const searchResponse = await this.youtube.search.list({
        q: searchTerm,
        part: 'snippet',
        type: 'video',
        maxResults: Math.min(maxResults, 50), // API limit
        order: orderBy,
        publishedAfter: publishedAfter,
        videoDuration: videoDuration
      });

      const videoIds = searchResponse.data.items.map(item => item.id.videoId);

      // Get detailed video information
      const videosResponse = await this.youtube.videos.list({
        id: videoIds.join(','),
        part: 'snippet,statistics,contentDetails'
      });

      // Transform and return results
      return videosResponse.data.items.map(video => ({
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
        commentCount: parseInt(video.statistics.commentCount || 0)
      }));
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`YouTube search failed: ${error.message}`);
    }
  }

  /**
   * Collect videos with metadata and comments
   */
  async collectVideos(videos, options = {}) {
    const {
      includeComments = true,
      maxComments = 100,
      downloadVideo = false,
      videoQuality = '720p',
      outputDir = './output'
    } = options;

    const results = [];
    let completed = 0;

    for (const video of videos) {
      if (this.cancelled) break;

      await this.queue.add(async () => {
        try {
          const videoData = {
            ...video,
            collectedAt: new Date().toISOString()
          };

          // Collect comments if requested
          if (includeComments && video.commentCount > 0) {
            videoData.comments = await this.collectComments(video.id, maxComments);
          }

          // Download video if requested
          if (downloadVideo) {
            const videoPath = await this.downloadVideo(video.id, videoQuality, outputDir);
            videoData.localPath = videoPath;
          }

          results.push(videoData);
          completed++;

          this.emit('video:collected', videoData);
          this.emit('progress', {
            completed,
            total: videos.length,
            percentage: Math.round((completed / videos.length) * 100)
          });
        } catch (error) {
          console.error(`Error collecting video ${video.id}:`, error);
          this.emit('video:error', { video, error: error.message });
        }
      });
    }

    await this.queue.onEmpty();
    return results;
  }

  /**
   * Collect comments for a video
   */
  async collectComments(videoId, maxComments = 100) {
    const comments = [];
    let pageToken = null;

    try {
      while (comments.length < maxComments) {
        const response = await this.youtube.commentThreads.list({
          videoId: videoId,
          part: 'snippet',
          maxResults: Math.min(100, maxComments - comments.length),
          order: 'relevance',
          pageToken: pageToken
        });

        const threads = response.data.items;
        
        for (const thread of threads) {
          const topComment = thread.snippet.topLevelComment.snippet;
          comments.push({
            id: thread.id,
            authorId: topComment.authorChannelId?.value,
            authorName: topComment.authorDisplayName,
            text: topComment.textOriginal,
            textDisplay: topComment.textDisplay,
            publishedAt: topComment.publishedAt,
            updatedAt: topComment.updatedAt,
            likeCount: topComment.likeCount,
            replyCount: thread.snippet.totalReplyCount
          });
        }

        pageToken = response.data.nextPageToken;
        if (!pageToken) break;
      }

      return comments.slice(0, maxComments);
    } catch (error) {
      console.error(`Error collecting comments for ${videoId}:`, error);
      return [];
    }
  }

  /**
   * Download video file
   */
  async downloadVideo(videoId, quality = '720p', outputDir) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(outputDir, `${videoId}.mp4`);

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Get video info
      const info = await ytdl.getInfo(videoUrl);
      
      // Select quality
      let format;
      if (quality === 'highest') {
        format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
      } else if (quality === 'lowest') {
        format = ytdl.chooseFormat(info.formats, { quality: 'lowestvideo' });
      } else {
        // Try to get specific quality
        const qualityMap = {
          '360p': '18',
          '720p': '22',
          '1080p': '137'
        };
        const itag = qualityMap[quality] || '22';
        format = info.formats.find(f => f.itag === parseInt(itag)) || 
                 ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
      }

      // Download
      const stream = ytdl.downloadFromInfo(info, { format });
      const writeStream = fs.createWriteStream(outputPath);
      
      return new Promise((resolve, reject) => {
        stream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', () => resolve(outputPath));
        stream.pipe(writeStream);
      });
    } catch (error) {
      console.error(`Error downloading video ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel collection
   */
  cancel() {
    this.cancelled = true;
    this.queue.clear();
  }

  /**
   * Helper: Get published after date
   */
  getPublishedAfter(dateRange) {
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
      default:
        return undefined;
    }
    
    return now.toISOString();
  }

  /**
   * Helper: Parse ISO 8601 duration to seconds
   */
  parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!match) return 0;
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds;
  }
}