const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // YouTube operations
  youtube: {
    search: (params) => ipcRenderer.invoke('youtube:search', params),
    collect: (params) => ipcRenderer.invoke('youtube:collect', params),
    cancel: (jobId) => ipcRenderer.invoke('youtube:cancel', jobId),
    downloadSingleVideo: (params) => ipcRenderer.invoke('youtube:downloadSingleVideo', params)
  },
  
  // Database operations
  db: {
    getCollections: () => ipcRenderer.invoke('db:getCollections'),
    getCollection: (id) => ipcRenderer.invoke('db:getCollection', id),
    getVideos: (collectionId) => ipcRenderer.invoke('db:getVideos', collectionId),
    getComments: (videoId) => ipcRenderer.invoke('db:getComments', videoId),
    getRatingsForProject: (projectId) => ipcRenderer.invoke('db:getRatingsForProject', projectId)
  },
  
  // Collections operations
  collections: {
    checkIncomplete: () => ipcRenderer.invoke('collections:checkIncomplete'),
    resume: (params) => ipcRenderer.invoke('collections:resume', params),
    markComplete: (params) => ipcRenderer.invoke('collections:markComplete', params)
  },
  
  // Export operations
  export: {
    collection: (params) => ipcRenderer.invoke('export:collection', params),
    cards: (params) => ipcRenderer.invoke('export:cards', params),
    cardsPreview: (params) => ipcRenderer.invoke('export:cards-preview', params),
    toCSV: (params) => ipcRenderer.invoke('export:toCSV', params),
    toSupabase: (params) => ipcRenderer.invoke('export:supabase', params),
    videoComments: (params) => ipcRenderer.invoke('export:videoComments', params)
  },
  
  // Import operations
  import: {
    collection: () => ipcRenderer.invoke('import:collection')
  },
  
  // Dialog operations
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory')
  },
  
  // System operations
  system: {
    openFolder: (path) => ipcRenderer.invoke('system:openFolder', path)
  },
  
  // Settings
  settings: {
    saveApiKey: (params) => ipcRenderer.invoke('settings:saveApiKey', params),
    getApiKey: (service) => ipcRenderer.invoke('settings:getApiKey', service)
  },
  
  // Tools
  tools: {
    check: () => ipcRenderer.invoke('tools:check'),
    install: (toolName) => ipcRenderer.invoke('tools:install', toolName)
  },
  
  // Video path
  getVideoPath: (relativePath) => ipcRenderer.invoke('getVideoPath', relativePath),
  
  // AI Analysis operations
  ai: {
    getRatingProjects: (params) => ipcRenderer.invoke('ai:getRatingProjects', params),
    getItemCounts: (params) => ipcRenderer.invoke('ai:getItemCounts', params),
    startRating: (config) => ipcRenderer.invoke('ai:startRating', config),
    pauseRating: () => ipcRenderer.invoke('ai:pauseRating'),
    resumeRating: () => ipcRenderer.invoke('ai:resumeRating'),
    cancelRating: () => ipcRenderer.invoke('ai:cancelRating'),
    previewRating: (config) => ipcRenderer.invoke('ai:previewRating', config),
    exportRatings: (params) => ipcRenderer.invoke('ai:exportRatings', params),
    testGeminiConnection: () => ipcRenderer.invoke('ai:testGeminiConnection')
  },
  
  // Platform info
  platform: process.platform + '-' + process.arch,
  
  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      'collection:progress',
      'collection:video-complete',
      'collection:error',
      'collection:download-start',
      'collection:download-progress',
      'collection:download-complete',
      'collection:download-error',
      'new-collection',
      'export-cards',
      'export-supabase',
      'ai:progress',
      'ai:item-rated',
      'ai:complete',
      'ai:error',
      'ai:preview-item'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});