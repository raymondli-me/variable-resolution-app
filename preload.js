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
    markComplete: (params) => ipcRenderer.invoke('collections:markComplete', params),
    list: () => ipcRenderer.invoke('db:getCollections'),
    createPDFCollection: (params) => ipcRenderer.invoke('collections:createPDFCollection', params)
  },

  // PDF operations
  pdf: {
    upload: (params) => ipcRenderer.invoke('pdf:upload', params),
    list: (collectionId) => ipcRenderer.invoke('pdf:list', collectionId),
    getExcerpts: (pdfId) => ipcRenderer.invoke('pdf:getExcerpts', pdfId),
    delete: (pdfId) => ipcRenderer.invoke('pdf:delete', pdfId)
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
    getAllRatingProjects: () => ipcRenderer.invoke('ai:getAllRatingProjects'),
    getRatingProject: (params) => ipcRenderer.invoke('ai:getRatingProject', params),
    getItemCounts: (params) => ipcRenderer.invoke('ai:getItemCounts', params),
    startRating: (config) => ipcRenderer.invoke('ai:startRating', config),
    pauseRating: () => ipcRenderer.invoke('ai:pauseRating'),
    resumeRating: () => ipcRenderer.invoke('ai:resumeRating'),
    cancelRating: () => ipcRenderer.invoke('ai:cancelRating'),
    previewRating: (config) => ipcRenderer.invoke('ai:previewRating', config),
    exportRatings: (params) => ipcRenderer.invoke('ai:exportRatings', params),
    testGeminiConnection: () => ipcRenderer.invoke('ai:testGeminiConnection'),
    // Hierarchical rating project methods
    getChildProjects: (params) => ipcRenderer.invoke('ai:getChildProjects', params),
    getProjectLineage: (params) => ipcRenderer.invoke('ai:getProjectLineage', params),
    getFilteredItemCount: (params) => ipcRenderer.invoke('ai:getFilteredItemCount', params),
    // BWS-related helper
    getRatingsForProject: (params) => ipcRenderer.invoke('ai:getRatingsForProject', params)
  },

  // BWS (Best-Worst Scaling) operations
  bws: {
    getAllExperiments: () => ipcRenderer.invoke('bws:getAllExperiments'),
    getExperiment: (params) => ipcRenderer.invoke('bws:getExperiment', params),
    createExperiment: (config) => ipcRenderer.invoke('bws:createExperiment', config),
    updateExperiment: (params) => ipcRenderer.invoke('bws:updateExperiment', params),
    getNextTuple: (params) => ipcRenderer.invoke('bws:getNextTuple', params),
    saveJudgment: (data) => ipcRenderer.invoke('bws:saveJudgment', data),
    calculateScores: (params) => ipcRenderer.invoke('bws:calculateScores', params),
    getScores: (params) => ipcRenderer.invoke('bws:getScores', params),
    deleteExperiment: (params) => ipcRenderer.invoke('bws:deleteExperiment', params),
    startAIRating: (params) => ipcRenderer.invoke('bws:startAIRating', params),
    getRaterJudgmentCount: (params) => ipcRenderer.invoke('bws:getRaterJudgmentCount', params),
    // List view methods
    getAllTuples: (params) => ipcRenderer.invoke('bws:getAllTuples', params),
    getJudgments: (params) => ipcRenderer.invoke('bws:getJudgments', params),
    getTupleWithItems: (params) => ipcRenderer.invoke('bws:getTupleWithItems', params)
  },

  // Database operations (direct access to DB methods)
  database: {
    // Collection operations
    getCollections: (limit, offset) => ipcRenderer.invoke('database:getCollections', limit, offset),
    getCollection: (id) => ipcRenderer.invoke('database:getCollection', id),

    // Merge operations
    getAllMerges: () => ipcRenderer.invoke('database:getAllMerges'),
    getMerge: (mergeId) => ipcRenderer.invoke('database:getMerge', mergeId),
    createMerge: (name, collectionIds, options) => ipcRenderer.invoke('database:createMerge', name, collectionIds, options),
    updateMerge: (mergeId, updates) => ipcRenderer.invoke('database:updateMerge', mergeId, updates),
    deleteMerge: (mergeId, hard) => ipcRenderer.invoke('database:deleteMerge', mergeId, hard),
    addCollectionToMerge: (mergeId, collectionId) => ipcRenderer.invoke('database:addCollectionToMerge', mergeId, collectionId),
    removeCollectionFromMerge: (mergeId, collectionId) => ipcRenderer.invoke('database:removeCollectionFromMerge', mergeId, collectionId),
    getMergeStatistics: (mergeId) => ipcRenderer.invoke('database:getMergeStatistics', mergeId),
    getMergeVideos: (mergeId) => ipcRenderer.invoke('database:getMergeVideos', mergeId),
    getMergeComments: (mergeId) => ipcRenderer.invoke('database:getMergeComments', mergeId),
    getMergeVideoChunks: (mergeId) => ipcRenderer.invoke('database:getMergeVideoChunks', mergeId),
    getMergePDFs: (mergeId) => ipcRenderer.invoke('database:getMergePDFs', mergeId),
    getMergePDFExcerpts: (mergeId) => ipcRenderer.invoke('database:getMergePDFExcerpts', mergeId),

    // Rating/BWS operations
    getItemsForRating: (collectionId, includeChunks, includeComments, projectId, includePDFs) =>
      ipcRenderer.invoke('database:getItemsForRating', collectionId, includeChunks, includeComments, projectId, includePDFs)
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
      'ai:preview-item',
      'bws:ai-progress',
      'bws:ai-item-rated',
      'bws:ai-complete',
      'bws:ai-error'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});