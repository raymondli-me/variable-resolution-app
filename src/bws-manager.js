/**
 * BWS (Best-Worst Scaling) Manager
 * Handles UI logic for creating and managing BWS experiments
 */

let bwsState = {
  sourceType: 'rating-project', // 'rating-project' or 'collection'
  selectedProjectId: null,
  selectedProjectData: null,
  selectedCollectionId: null,
  selectedCollectionData: null,
  includeComments: true,
  includeChunks: false,
  filteredItemCount: 0
};

/**
 * Initialize BWS UI
 */
async function initializeBWS() {
  setupBWSEventListeners();
  await loadBWSExperiments();
}

/**
 * Setup event listeners for BWS UI
 */
function setupBWSEventListeners() {
  // Create BWS button
  const createBWSBtn = document.getElementById('create-bws-btn');
  if (createBWSBtn) {
    createBWSBtn.addEventListener('click', openCreateBWSModal);
  }

  // Modal close buttons
  const closeBWSModal = document.getElementById('close-bws-modal');
  if (closeBWSModal) {
    closeBWSModal.addEventListener('click', closeCreateBWSModal);
  }

  const cancelBWSBtn = document.getElementById('bws-cancel-btn');
  if (cancelBWSBtn) {
    cancelBWSBtn.addEventListener('click', closeCreateBWSModal);
  }

  // Source type radio buttons
  const sourceTypeRadios = document.querySelectorAll('input[name="bws-source-type"]');
  sourceTypeRadios.forEach(radio => {
    radio.addEventListener('change', onBWSSourceTypeChange);
  });

  // Rating project selection
  const projectSelect = document.getElementById('bws-rating-project-select');
  if (projectSelect) {
    projectSelect.addEventListener('change', onBWSProjectSelect);
  }

  // Collection selection
  const collectionSelect = document.getElementById('bws-collection-select');
  if (collectionSelect) {
    collectionSelect.addEventListener('change', onBWSCollectionSelect);
  }

  // Collection content type checkboxes
  const includeComments = document.getElementById('bws-include-comments');
  if (includeComments) {
    includeComments.addEventListener('change', updateBWSCollectionCount);
  }

  const includeChunks = document.getElementById('bws-include-chunks');
  if (includeChunks) {
    includeChunks.addEventListener('change', updateBWSCollectionCount);
  }

  // Filter score change
  const minScoreInput = document.getElementById('bws-min-score');
  if (minScoreInput) {
    minScoreInput.addEventListener('input', updateBWSFilteredCount);
  }

  // Config changes (for estimates)
  const configInputs = [
    'bws-tuple-size',
    'bws-target-appearances',
    'bws-rater-type'
  ];

  configInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('change', updateBWSEstimates);
    }
  });

  // Create button
  const createBtn = document.getElementById('bws-create-btn');
  if (createBtn) {
    createBtn.addEventListener('click', createBWSExperiment);
  }

  // Form inputs for validation
  const nameInput = document.getElementById('bws-experiment-name');
  const intentInput = document.getElementById('bws-research-intent');

  if (nameInput) nameInput.addEventListener('input', validateBWSForm);
  if (intentInput) intentInput.addEventListener('input', validateBWSForm);
}

/**
 * Open create BWS modal
 */
async function openCreateBWSModal() {
  const modal = document.getElementById('create-bws-modal');
  if (!modal) return;

  // Reset form
  document.getElementById('bws-experiment-name').value = '';
  document.getElementById('bws-research-intent').value = '';
  document.getElementById('bws-min-score').value = '0.7';
  document.getElementById('bws-tuple-size').value = '3';
  document.getElementById('bws-target-appearances').value = '4';
  document.getElementById('bws-design-method').value = 'balanced';
  document.getElementById('bws-rater-type').value = 'ai';
  document.getElementById('bws-scoring-method').value = 'counting';
  document.getElementById('bws-include-comments').checked = true;
  document.getElementById('bws-include-chunks').checked = false;

  // Reset source type to rating-project
  document.querySelector('input[name="bws-source-type"][value="rating-project"]').checked = true;

  // Hide sections initially
  document.getElementById('bws-source-info').style.display = 'none';
  document.getElementById('bws-filter-section').style.display = 'none';
  document.getElementById('bws-config-section').style.display = 'none';
  document.getElementById('bws-rating-project-section').style.display = 'block';
  document.getElementById('bws-collection-section').style.display = 'none';
  document.getElementById('bws-collection-content-section').style.display = 'none';

  // Reset state
  bwsState = {
    sourceType: 'rating-project',
    selectedProjectId: null,
    selectedProjectData: null,
    selectedCollectionId: null,
    selectedCollectionData: null,
    includeComments: true,
    includeChunks: false,
    filteredItemCount: 0
  };

  // Load available rating projects and collections
  await Promise.all([
    loadBWSRatingProjects(),
    loadBWSCollections()
  ]);

  // Show modal
  modal.style.display = 'flex';
  validateBWSForm();
}

/**
 * Close create BWS modal
 */
function closeCreateBWSModal() {
  const modal = document.getElementById('create-bws-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Load rating projects into dropdown
 */
async function loadBWSRatingProjects() {
  try {
    // Get all collections to find their rating projects
    const collectionsData = await window.api.db.getCollections();

    // Handle different return formats
    let collections = collectionsData;
    if (collectionsData && collectionsData.collections) {
      collections = collectionsData.collections;
    } else if (collectionsData && collectionsData.success) {
      collections = collectionsData.data || [];
    }

    console.log('Collections loaded:', collections);

    if (!collections || !Array.isArray(collections) || collections.length === 0) {
      console.warn('No collections found');
      const select = document.getElementById('bws-rating-project-select');
      select.innerHTML = '<option value="">No collections available</option>';
      select.disabled = true;
      return;
    }

    const select = document.getElementById('bws-rating-project-select');
    select.innerHTML = '<option value="">Choose a rating project...</option>';

    // Fetch rating projects for each collection
    const allProjects = [];

    for (const collection of collections) {
      const projectsResult = await window.api.ai.getRatingProjects({ collectionId: collection.id });

      if (projectsResult.success && projectsResult.data) {
        projectsResult.data.forEach(project => {
          allProjects.push({
            ...project,
            collection_name: collection.search_term
          });
        });
      }
    }

    console.log('All rating projects:', allProjects);

    // Filter to only completed projects with items
    const completedProjects = allProjects.filter(p =>
      p.status === 'completed' && p.total_items > 0
    );

    console.log('Completed projects:', completedProjects);

    if (completedProjects.length === 0) {
      // Show helpful message
      const totalProjects = allProjects.length;
      if (totalProjects === 0) {
        select.innerHTML = '<option value="">No rating projects exist yet - create one first in the Ratings tab</option>';
      } else {
        select.innerHTML = `<option value="">No completed rating projects (found ${totalProjects} in progress/draft)</option>`;
      }
      select.disabled = true;
      return;
    }

    select.disabled = false;

    // Add projects to dropdown
    completedProjects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = `${project.project_name} (${project.total_items} items from "${project.collection_name}")`;
      option.dataset.projectData = JSON.stringify(project);
      select.appendChild(option);
    });

  } catch (error) {
    console.error('Error loading rating projects:', error);
    showNotification('Failed to load rating projects', 'error');
  }
}

/**
 * Handle rating project selection
 */
async function onBWSProjectSelect(event) {
  const select = event.target;
  const selectedOption = select.options[select.selectedIndex];

  if (!select.value) {
    // Hide sections if no project selected
    document.getElementById('bws-source-info').style.display = 'none';
    document.getElementById('bws-filter-section').style.display = 'none';
    document.getElementById('bws-config-section').style.display = 'none';
    bwsState.selectedProjectId = null;
    bwsState.selectedProjectData = null;
    validateBWSForm();
    return;
  }

  // Get project data
  const projectData = JSON.parse(selectedOption.dataset.projectData);
  bwsState.selectedProjectId = parseInt(select.value);
  bwsState.selectedProjectData = projectData;

  // Display project info (using shared source-info elements)
  document.getElementById('bws-selected-source-name').textContent = projectData.project_name;
  document.getElementById('bws-total-items').textContent = projectData.total_items;

  // Determine item type from project (assume it's in the name or we need to query)
  document.getElementById('bws-item-type').textContent = 'Mixed (comments + video chunks)';

  // Show source info and filter section
  document.getElementById('bws-source-info').style.display = 'block';
  document.getElementById('bws-filter-section').style.display = 'block';

  // Calculate filtered count
  await updateBWSFilteredCount();

  validateBWSForm();
}

/**
 * Handle source type change (rating project vs collection)
 */
function onBWSSourceTypeChange(event) {
  const sourceType = event.target.value;
  bwsState.sourceType = sourceType;

  // Update hint text
  const hint = document.getElementById('bws-source-type-hint');
  if (sourceType === 'rating-project') {
    hint.textContent = 'Use rated items filtered by relevance score';
  } else {
    hint.textContent = 'Compare raw items from a collection without needing ratings first';
  }

  // Show/hide appropriate sections
  if (sourceType === 'rating-project') {
    document.getElementById('bws-rating-project-section').style.display = 'block';
    document.getElementById('bws-collection-section').style.display = 'none';
    document.getElementById('bws-collection-content-section').style.display = 'none';
    document.getElementById('bws-filter-section').style.display = 'none';
  } else {
    document.getElementById('bws-rating-project-section').style.display = 'none';
    document.getElementById('bws-collection-section').style.display = 'block';
    document.getElementById('bws-collection-content-section').style.display = 'none';
    document.getElementById('bws-filter-section').style.display = 'none';
  }

  // Hide info and config sections
  document.getElementById('bws-source-info').style.display = 'none';
  document.getElementById('bws-config-section').style.display = 'none';

  // Reset selections
  bwsState.selectedProjectId = null;
  bwsState.selectedProjectData = null;
  bwsState.selectedCollectionId = null;
  bwsState.selectedCollectionData = null;
  bwsState.filteredItemCount = 0;

  validateBWSForm();
}

/**
 * Load collections into dropdown
 */
async function loadBWSCollections() {
  try {
    // Load both regular collections and merged collections (same as AI Analysis)
    const [collectionsResult, mergesResult] = await Promise.all([
      window.api.db.getCollections(),
      window.api.database.getAllMerges()
    ]);

    const collections = [];

    // Add regular collections
    if (collectionsResult.success && collectionsResult.data) {
      collectionsResult.data.forEach(c => {
        collections.push({
          ...c,
          isMerge: false
        });
      });
    }

    // Add merged collections
    if (mergesResult && Array.isArray(mergesResult)) {
      mergesResult.forEach(merge => {
        let videoCount = 0;
        let commentCount = 0;
        if (merge.source_collections) {
          merge.source_collections.forEach(sc => {
            videoCount += sc.video_count || 0;
            commentCount += sc.comment_count || 0;
          });
        }

        collections.push({
          id: merge.id,
          search_term: merge.name,
          name: merge.name,
          video_count: videoCount,
          comment_count: commentCount,
          isMerge: true,
          mergeData: merge
        });
      });
    }

    const select = document.getElementById('bws-collection-select');
    select.innerHTML = '<option value="">Choose a collection...</option>';

    if (collections.length === 0) {
      select.innerHTML = '<option value="">No collections available</option>';
      select.disabled = true;
      return;
    }

    select.disabled = false;

    // Add collections to dropdown
    collections.forEach(collection => {
      const option = document.createElement('option');
      option.value = collection.id;
      const mergeLabel = collection.isMerge ? ' [MERGED]' : '';
      option.textContent = `${collection.search_term || collection.name}${mergeLabel}`;
      option.dataset.collectionData = JSON.stringify(collection);
      select.appendChild(option);
    });

  } catch (error) {
    console.error('Error loading collections:', error);
    showNotification('Failed to load collections', 'error');
  }
}

/**
 * Handle collection selection
 */
async function onBWSCollectionSelect(event) {
  const select = event.target;
  const selectedOption = select.options[select.selectedIndex];

  if (!select.value) {
    // Hide sections if no collection selected
    document.getElementById('bws-source-info').style.display = 'none';
    document.getElementById('bws-collection-content-section').style.display = 'none';
    document.getElementById('bws-config-section').style.display = 'none';
    bwsState.selectedCollectionId = null;
    bwsState.selectedCollectionData = null;
    validateBWSForm();
    return;
  }

  // Get collection data
  const collectionData = JSON.parse(selectedOption.dataset.collectionData);
  bwsState.selectedCollectionId = parseInt(select.value);
  bwsState.selectedCollectionData = collectionData;

  // Show content type selection
  document.getElementById('bws-collection-content-section').style.display = 'block';

  // Calculate item count
  await updateBWSCollectionCount();

  validateBWSForm();
}

/**
 * Update collection item count based on content type checkboxes
 */
async function updateBWSCollectionCount() {
  if (!bwsState.selectedCollectionId) return;

  const includeComments = document.getElementById('bws-include-comments').checked;
  const includeChunks = document.getElementById('bws-include-chunks').checked;

  bwsState.includeComments = includeComments;
  bwsState.includeChunks = includeChunks;

  if (!includeComments && !includeChunks) {
    document.getElementById('bws-source-info').style.display = 'none';
    document.getElementById('bws-config-section').style.display = 'none';
    bwsState.filteredItemCount = 0;
    validateBWSForm();
    return;
  }

  try {
    // Get items from collection (same logic as getItemsForRating but without projectId)
    const items = await window.api.database.getItemsForRating(
      bwsState.selectedCollectionId,
      includeChunks,
      includeComments,
      null // No projectId since we're not filtering by ratings
    );

    bwsState.filteredItemCount = items.length;

    // Display collection info
    const collectionData = bwsState.selectedCollectionData;
    document.getElementById('bws-selected-source-name').textContent =
      collectionData.search_term || collectionData.name;
    document.getElementById('bws-total-items').textContent = items.length;

    const itemTypes = [];
    if (includeComments) itemTypes.push('Comments');
    if (includeChunks) itemTypes.push('Video Chunks');
    document.getElementById('bws-item-type').textContent = itemTypes.join(' + ');

    // Show info section
    document.getElementById('bws-source-info').style.display = 'block';

    // Show config section if we have enough items
    if (items.length >= 2) {
      document.getElementById('bws-config-section').style.display = 'block';
      updateBWSEstimates();
    } else {
      document.getElementById('bws-config-section').style.display = 'none';
      showNotification('Need at least 2 items for BWS experiment', 'warning');
    }

  } catch (error) {
    console.error('Error calculating collection item count:', error);
    showNotification('Failed to load collection items', 'error');
  }

  validateBWSForm();
}

/**
 * Update filtered item count based on score threshold (for rating projects)
 */
async function updateBWSFilteredCount() {
  if (!bwsState.selectedProjectId) return;

  const minScore = parseFloat(document.getElementById('bws-min-score').value);

  try {
    const result = await window.api.ai.getRatingsForProject({ projectId: bwsState.selectedProjectId });

    if (result.success) {
      const filteredItems = result.ratings.filter(r =>
        r.status === 'success' && r.relevance_score >= minScore
      );

      bwsState.filteredItemCount = filteredItems.length;

      document.getElementById('bws-filtered-count').textContent = `${filteredItems.length} items`;

      // Display project info (already set in onBWSProjectSelect, but update total)
      document.getElementById('bws-total-items').textContent = bwsState.selectedProjectData.total_items;

      // Show info section (should already be visible from onBWSProjectSelect)
      document.getElementById('bws-source-info').style.display = 'block';

      // Show config section if we have enough items
      if (filteredItems.length >= 2) {
        document.getElementById('bws-config-section').style.display = 'block';
        updateBWSEstimates();
      } else {
        document.getElementById('bws-config-section').style.display = 'none';
        showNotification('Need at least 2 items for BWS experiment', 'warning');
      }
    }
  } catch (error) {
    console.error('Error calculating filtered count:', error);
  }

  validateBWSForm();
}

/**
 * Update tuple and cost estimates
 */
function updateBWSEstimates() {
  const itemCount = bwsState.filteredItemCount;
  const tupleSize = parseInt(document.getElementById('bws-tuple-size').value);
  const targetAppearances = parseInt(document.getElementById('bws-target-appearances').value);
  const raterType = document.getElementById('bws-rater-type').value;

  if (itemCount === 0) return;

  // Calculate estimated tuple count
  const estimatedTuples = Math.ceil((itemCount * targetAppearances) / tupleSize);

  document.getElementById('bws-estimate-tuples').textContent = estimatedTuples;
  document.getElementById('bws-estimate-items').textContent = itemCount;

  // Show/hide AI cost estimate
  const aiCostRow = document.getElementById('bws-ai-cost-row');
  if (raterType === 'ai' || raterType === 'hybrid') {
    // Rough estimate: $0.00015 per comparison (Gemini Flash pricing)
    const estimatedCost = estimatedTuples * 0.00015;
    document.getElementById('bws-estimate-cost').textContent = `$${estimatedCost.toFixed(4)}`;
    aiCostRow.style.display = 'flex';
  } else {
    aiCostRow.style.display = 'none';
  }
}

/**
 * Validate form and enable/disable create button
 */
function validateBWSForm() {
  const createBtn = document.getElementById('bws-create-btn');
  const name = document.getElementById('bws-experiment-name').value.trim();
  const intent = document.getElementById('bws-research-intent').value.trim();

  let hasSource = false;
  if (bwsState.sourceType === 'rating-project') {
    hasSource = bwsState.selectedProjectId !== null;
  } else {
    hasSource = bwsState.selectedCollectionId !== null;
  }

  const hasEnoughItems = bwsState.filteredItemCount >= 2;

  const isValid = hasSource && hasEnoughItems && name.length > 0 && intent.length > 0;

  createBtn.disabled = !isValid;
}

/**
 * Create BWS experiment
 */
async function createBWSExperiment() {
  const createBtn = document.getElementById('bws-create-btn');
  createBtn.disabled = true;
  createBtn.textContent = 'Creating...';

  try {
    const config = {
      name: document.getElementById('bws-experiment-name').value.trim(),
      source_type: bwsState.sourceType,
      tuple_size: parseInt(document.getElementById('bws-tuple-size').value),
      target_appearances: parseInt(document.getElementById('bws-target-appearances').value),
      design_method: document.getElementById('bws-design-method').value,
      scoring_method: document.getElementById('bws-scoring-method').value,
      rater_type: document.getElementById('bws-rater-type').value,
      research_intent: document.getElementById('bws-research-intent').value.trim()
    };

    // Add source-specific parameters
    if (bwsState.sourceType === 'rating-project') {
      config.rating_project_id = bwsState.selectedProjectId;
      config.min_score = parseFloat(document.getElementById('bws-min-score').value);
    } else {
      config.collection_id = bwsState.selectedCollectionId;
      config.include_comments = bwsState.includeComments;
      config.include_chunks = bwsState.includeChunks;
    }

    const result = await window.api.bws.createExperiment(config);

    if (result.success) {
      showNotification(`BWS experiment created! ${result.tuple_count} comparisons generated.`, 'success');
      closeCreateBWSModal();
      await loadBWSExperiments();

      // Show the BWS tab if not already visible
      const bwsTab = document.querySelector('[data-tab="bws"]');
      if (bwsTab) bwsTab.click();
    } else {
      showNotification(`Failed to create experiment: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error creating BWS experiment:', error);
    showNotification('Failed to create BWS experiment', 'error');
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = 'Create Experiment';
  }
}

/**
 * Load and display BWS experiments
 */
async function loadBWSExperiments() {
  try {
    const result = await window.api.bws.getAllExperiments();

    if (!result.success) {
      console.error('Failed to load BWS experiments:', result.error);
      showNotification(`Failed to load BWS experiments: ${result.error || 'Unknown error'}`, 'error');
      return;
    }

    const gallery = document.getElementById('bws-experiments-gallery');
    const experiments = result.experiments;

    // Update stats
    updateBWSStats(experiments);

    // If no experiments, show empty state
    if (experiments.length === 0) {
      gallery.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="7.8 2 12 5.4 16.2 2"></polyline>
            <polyline points="7.8 22 12 18.6 16.2 22"></polyline>
          </svg>
          <p>No BWS experiments yet</p>
          <p class="hint">First, create rating projects to filter your data, then run BWS experiments for fine-grained rankings</p>
          <button class="btn btn-primary" onclick="document.getElementById('create-bws-btn').click()">
            Create Your First Experiment
          </button>
        </div>
      `;
      return;
    }

    // Display experiment cards
    gallery.innerHTML = experiments.map(exp => createBWSExperimentCard(exp)).join('');

  } catch (error) {
    console.error('Error loading BWS experiments:', error);
  }
}

/**
 * Create HTML for a BWS experiment card
 */
function createBWSExperimentCard(exp) {
  const progress = exp.tuples_generated > 0
    ? Math.round((exp.judgments_count / exp.tuples_generated) * 100)
    : 0;

  const statusClass = `bws-status-badge status-${exp.status}`;
  const statusText = exp.status.replace('_', ' ').toUpperCase();

  return `
    <div class="bws-experiment-card" data-experiment-id="${exp.id}">
      <div class="project-card-header">
        <div>
          <h3 class="project-card-title">🔀 ${exp.name}</h3>
          <span class="${statusClass}">${statusText}</span>
        </div>
      </div>

      <div class="project-card-meta">
        <span>Source: ${exp.rating_project_name || 'Unknown'}</span>
        <span>${exp.tuple_count || 0} comparisons · ${exp.tuple_size}-item tuples · ${exp.design_method}</span>
      </div>

      <div class="bws-progress-mini">
        <div class="bws-progress-fill" style="width: ${progress}%"></div>
      </div>

      <div class="project-card-stats">
        <div class="stat">
          <span class="stat-label">Progress</span>
          <span class="stat-value">${exp.judgments_count} / ${exp.tuples_generated || 0} (${progress}%)</span>
        </div>
        <div class="stat">
          <span class="stat-label">Method</span>
          <span class="stat-value">${exp.scoring_method}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Rater</span>
          <span class="stat-value">${exp.rater_type}</span>
        </div>
      </div>

      <div class="project-card-actions">
        ${exp.status === 'draft' || exp.status === 'in_progress' ?
          `<button class="btn btn-sm btn-primary" onclick="startBWSRating(${exp.id})">
             ${exp.status === 'in_progress' ? '▶️ Continue' : '▶️ Start'} Rating
           </button>` :
          `<button class="btn btn-sm btn-secondary" onclick="viewBWSResults(${exp.id})">📊 View Results</button>
           <button class="btn btn-sm btn-primary" onclick="addHumanRatingsToExperiment(${exp.id})" title="Browse and rate tuples (see AI + your ratings)">
             🔍 Browse & Rate
           </button>`
        }
        <button class="btn btn-sm btn-secondary" onclick="deleteBWSExperiment(${exp.id})">Delete</button>
      </div>
    </div>
  `;
}

/**
 * Update BWS stats bar
 */
function updateBWSStats(experiments) {
  const totalExperiments = experiments.length;
  const totalJudgments = experiments.reduce((sum, exp) => sum + (exp.judgments_count || 0), 0);
  const totalCost = experiments.reduce((sum, exp) => sum + (exp.total_cost || 0), 0);

  document.getElementById('totalBWSExperiments').textContent = totalExperiments;
  document.getElementById('totalJudgments').textContent = totalJudgments;
  document.getElementById('totalBWSCost').textContent = `$${totalCost.toFixed(2)}`;

  // AI-human agreement placeholder (requires implementation)
  document.getElementById('aiHumanAgreement').textContent = '0%';
}

/**
 * BWS Rating State
 */
let bwsRatingState = {
  experimentId: null,
  experiment: null,
  currentTuple: null,
  currentTupleData: null,
  selectedBest: null,
  selectedWorst: null,
  totalJudgments: 0,
  totalTuples: 0
};

/**
 * Start rating a BWS experiment
 */
async function startBWSRating(experimentId) {
  try {
    // Load experiment details
    const expResult = await window.api.bws.getExperiment({ experimentId });

    if (!expResult.success) {
      showNotification(`Failed to load experiment: ${expResult.error}`, 'error');
      return;
    }

    // Route to AI or Human rating based on rater_type
    if (expResult.experiment.rater_type === 'ai') {
      await startAIBWSRating(experimentId, expResult.experiment);
    } else {
      await startHumanBWSRating(experimentId, expResult.experiment);
    }

  } catch (error) {
    console.error('Error starting BWS rating:', error);
    showNotification('Failed to start rating interface', 'error');
  }
}

/**
 * Start Unified BWS Rating (AI + Human)
 *
 * This opens a single interface where:
 * - AI ratings are shown in bright green/red borders
 * - Human ratings are shown in light green/red borders
 * - You can rate anytime (auto-saves)
 * - AI can be started/paused/resumed
 */
async function startAIBWSRating(experimentId, experiment) {
  try {
    // Show confirmation
    const confirmed = confirm(
      `Start rating "${experiment.name}"?\n\n` +
      `• Browse ${experiment.total_tuples} comparisons\n` +
      `• AI rating will run in background (Gemini AI)\n` +
      `• You can add your own ratings anytime\n` +
      `• All progress auto-saves`
    );
    if (!confirmed) return;

    // Store current experiment ID for progress tracking
    window.currentAIRatingExperimentId = experimentId;

    // ✅ CRITICAL: Store experiment info in state (unified AI + Human)
    bwsRatingState.experimentId = experimentId;
    bwsRatingState.experiment = experiment;
    bwsRatingState.raterType = 'human';  // Primary rater is human (for submit button)
    bwsRatingState.raterId = 'human-user';  // Human ratings will be saved with this ID
    bwsRatingState.aiRaterType = 'ai';  // Track that AI is also active
    bwsRatingState.aiRaterId = 'gemini-2.5-flash';

    // ✅ Show rating interface
    document.getElementById('bws-rating-interface').style.display = 'flex';

    // Update header
    document.getElementById('bws-rating-exp-name').textContent = experiment.name;
    document.getElementById('bws-rating-exp-desc').textContent = experiment.research_intent;

    // ✅ Setup interface event listeners (Close, Pause, Submit buttons)
    setupRatingInterfaceListeners();

    // ✅ Initialize single-tuple browser (NOT list view)
    // This sets up Next/Prev/Skip buttons
    setupBWSNavigation();

    // ✅ Show inline progress banner
    showInlineAIProgress(experimentId, experiment);

    // Setup progress listeners to update banner
    setupInlineAIProgressListeners();

    // ✅ Load first tuple so user can start browsing immediately
    // AI will rate in background, user can browse as ratings appear
    await loadBWSTuple({ tupleIndex: 0, filter: 'all' });

    // Start AI rating (runs in background)
    const result = await window.api.bws.startAIRating({ experimentId });

    if (!result.success) {
      hideInlineAIProgress();
      showNotification(`AI rating failed: ${result.error}`, 'error');
      window.currentAIRatingExperimentId = null;
    }

  } catch (error) {
    console.error('Error starting AI BWS rating:', error);
    hideInlineAIProgress();
    showNotification('Failed to start AI rating', 'error');
    window.currentAIRatingExperimentId = null;
  }
}

/**
 * Show inline AI progress banner
 */
function showInlineAIProgress(experimentId, experiment) {
  const banner = document.getElementById('bws-ai-progress-banner');
  if (!banner) {
    console.error('[showInlineAIProgress] Banner element not found!');
    return;
  }

  // Initialize progress display
  const totalTuples = experiment.total_tuples || 0;
  const alreadyCompleted = experiment.total_judgments || 0;
  const percentage = totalTuples > 0 ? Math.round((alreadyCompleted / totalTuples) * 100) : 0;

  // Update banner content
  document.getElementById('bws-ai-progress-title').textContent = 'AI Rating in Progress';
  document.getElementById('bws-ai-progress-count-inline').textContent = `${alreadyCompleted} / ${totalTuples}`;
  document.getElementById('bws-ai-progress-percentage-inline').textContent = `${percentage}%`;
  document.getElementById('bws-ai-progress-bar-fill').style.width = `${percentage}%`;

  // Remove any previous state classes
  banner.classList.remove('completed', 'error');

  // Show banner with animation
  banner.style.display = 'block';

  console.log(`[AI Progress Banner] Initialized: ${alreadyCompleted}/${totalTuples} (${percentage}%)`);
}

/**
 * Hide inline AI progress banner
 */
function hideInlineAIProgress() {
  const banner = document.getElementById('bws-ai-progress-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

/**
 * Update inline AI progress banner
 */
function updateInlineAIProgress(current, total) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  // Update count
  const countElement = document.getElementById('bws-ai-progress-count-inline');
  if (countElement) {
    countElement.textContent = `${current} / ${total}`;
  }

  // Update percentage
  const percentageElement = document.getElementById('bws-ai-progress-percentage-inline');
  if (percentageElement) {
    percentageElement.textContent = `${percentage}%`;
  }

  // Update progress bar fill
  const fillElement = document.getElementById('bws-ai-progress-bar-fill');
  if (fillElement) {
    fillElement.style.width = `${percentage}%`;
  }

  console.log(`[AI Progress Banner] Updated: ${current}/${total} (${percentage}%)`);
}

/**
 * Mark inline AI progress as completed
 */
function markInlineAIProgressComplete(total) {
  const banner = document.getElementById('bws-ai-progress-banner');
  if (!banner) return;

  // Update to completed state
  banner.classList.add('completed');
  document.getElementById('bws-ai-progress-title').textContent = '✅ AI Rating Complete';
  document.getElementById('bws-ai-progress-count-inline').textContent = `${total} / ${total}`;
  document.getElementById('bws-ai-progress-percentage-inline').textContent = '100%';
  document.getElementById('bws-ai-progress-bar-fill').style.width = '100%';

  // Hide latest result
  const latestElement = document.getElementById('bws-ai-latest-inline');
  if (latestElement) {
    latestElement.style.display = 'none';
  }

  console.log(`[AI Progress Banner] Completed: ${total}/${total}`);

  // Auto-hide banner after 5 seconds
  setTimeout(() => {
    if (banner) {
      banner.style.display = 'none';
    }
  }, 5000);
}

/**
 * Mark inline AI progress as error
 */
function markInlineAIProgressError(errorMessage) {
  const banner = document.getElementById('bws-ai-progress-banner');
  if (!banner) return;

  // Update to error state
  banner.classList.add('error');
  document.getElementById('bws-ai-progress-title').textContent = '❌ AI Rating Error';

  // Show error in latest section
  const latestElement = document.getElementById('bws-ai-latest-inline');
  const latestTextElement = document.getElementById('bws-ai-latest-text-inline');
  if (latestElement && latestTextElement) {
    latestTextElement.textContent = errorMessage;
    latestElement.style.display = 'flex';
  }

  console.error(`[AI Progress Banner] Error: ${errorMessage}`);
}

/**
 * Setup event listeners for inline AI progress updates
 */
function setupInlineAIProgressListeners() {
  // Listen for progress updates
  window.api.on('bws:ai-progress', (data) => {
    const { experimentId, current, total, percentage } = data;

    // Only update if this is the current experiment
    if (experimentId === window.currentAIRatingExperimentId) {
      updateInlineAIProgress(current, total);

      // ✅ Smart refresh: Only reload current tuple if viewing single-tuple browser
      // (Don't call loadBWSList() - that creates 2,320 videos!)
      if (bwsRatingState.currentTuple && bwsRatingState.currentTupleIndex !== undefined) {
        // Reload current tuple to show updated AI judgment if it was just rated
        loadBWSTuple({
          tupleIndex: bwsRatingState.currentTupleIndex,
          filter: bwsRatingState.currentFilter || 'all'
        });
      }

      console.log(`[BWS AI Progress] ${current}/${total} (${percentage}%)`);
    }
  });

  // Listen for individual tuple ratings
  window.api.on('bws:ai-item-rated', (data) => {
    const { experimentId, tupleId, best, worst } = data;

    // Only update if this is the current experiment
    if (experimentId === window.currentAIRatingExperimentId) {
      // Show latest result in banner
      const latestElement = document.getElementById('bws-ai-latest-inline');
      const latestTextElement = document.getElementById('bws-ai-latest-text-inline');

      if (latestElement && latestTextElement) {
        latestTextElement.textContent = `Tuple #${tupleId} rated (Best: ${best}, Worst: ${worst})`;
        latestElement.style.display = 'flex';
      }

      // ✅ Smart refresh: Only reload if currently viewing the tuple that was just rated
      if (bwsRatingState.currentTuple && bwsRatingState.currentTuple.id === tupleId) {
        loadBWSTuple({
          tupleIndex: bwsRatingState.currentTupleIndex,
          filter: bwsRatingState.currentFilter || 'all'
        });
      }

      console.log(`[BWS AI] Tuple ${tupleId} rated - Best: ${best}, Worst: ${worst}`);
    }
  });

  // Listen for completion
  window.api.on('bws:ai-complete', (data) => {
    const { experimentId, totalCompleted } = data;

    // Only update if this is the current experiment
    if (experimentId === window.currentAIRatingExperimentId) {
      markInlineAIProgressComplete(totalCompleted);

      // ✅ Final refresh: Reload current tuple to show completion state
      if (bwsRatingState.currentTuple && bwsRatingState.currentTupleIndex !== undefined) {
        loadBWSTuple({
          tupleIndex: bwsRatingState.currentTupleIndex,
          filter: bwsRatingState.currentFilter || 'all'
        });
      }

      // Clear current experiment ID
      window.currentAIRatingExperimentId = null;

      console.log(`[BWS AI] Completed: ${totalCompleted} tuples rated`);
      showNotification(`AI rating complete! ${totalCompleted} tuples rated.`, 'success');
    }
  });

  // Listen for errors
  window.api.on('bws:ai-error', (data) => {
    const { experimentId, tupleId, error } = data;

    // Only update if this is the current experiment
    if (experimentId === window.currentAIRatingExperimentId) {
      console.error(`[BWS AI Error] Tuple ${tupleId}: ${error}`);

      // Don't stop on individual errors, just log them
      // The AI will continue with next tuple
    }
  });
}

/**
 * Add human ratings to an experiment (unified interface)
 *
 * Same as startBWSRating but with human-focused messaging
 */
async function addHumanRatingsToExperiment(experimentId) {
  try {
    // Load experiment details
    const expResult = await window.api.bws.getExperiment({ experimentId });

    if (!expResult.success) {
      showNotification(`Failed to load experiment: ${expResult.error}`, 'error');
      return;
    }

    const experiment = expResult.experiment;

    // Count human judgments already made
    const humanJudgmentsResult = await window.api.bws.getRaterJudgmentCount({
      experimentId,
      raterId: 'human-user'
    });

    const humanJudgments = humanJudgmentsResult.success ? humanJudgmentsResult.count : 0;
    const totalTuples = experiment.total_tuples || 0;
    const remaining = totalTuples - humanJudgments;

    // Show confirmation with progress info
    const message = humanJudgments > 0
      ? `Continue rating "${experiment.name}"?\n\n✅ You've completed ${humanJudgments}/${totalTuples} comparisons\n⏳ ${remaining} remaining\n\n• See AI ratings alongside yours\n• All progress auto-saves`
      : `Start rating "${experiment.name}"?\n\n• Browse ${totalTuples} comparisons\n• See AI ratings (if completed)\n• Add your own ratings\n• Compare AI vs Human judgments`;

    const confirmed = confirm(message);
    if (!confirmed) return;

    // Start human rating with rater_id tracking
    await startHumanBWSRating(experimentId, experiment, 'human-user');

  } catch (error) {
    console.error('Error adding human ratings:', error);
    showNotification('Failed to start human rating', 'error');
  }
}

/**
 * Start Human BWS Rating (Unified with AI)
 *
 * Opens the same interface as AI rating, but:
 * - Focuses on human rating (no auto-start AI)
 * - Shows existing AI ratings if any
 * - Human can trigger AI from within interface
 */
async function startHumanBWSRating(experimentId, experiment, raterId = 'human-user') {
  try {
    // Update status to in_progress if draft
    if (experiment.status === 'draft') {
      await window.api.bws.updateExperiment({
        experimentId,
        updates: { status: 'in_progress' }
      });
    }

    // Initialize rating state with rater tracking
    bwsRatingState = {
      experimentId,
      experiment,
      currentTuple: null,
      currentTupleData: null,
      selectedBest: null,
      selectedWorst: null,
      totalJudgments: experiment.total_judgments || 0,
      totalTuples: experiment.total_tuples || 0,
      raterId: raterId,  // Track rater ID for multi-rater support
      raterType: 'human'  // Primary rater is human, but AI ratings still visible
    };

    // Setup event listeners for rating interface
    setupRatingInterfaceListeners();

    // Show interface
    document.getElementById('bws-rating-interface').style.display = 'flex';

    // Update header
    document.getElementById('bws-rating-exp-name').textContent = experiment.name;
    document.getElementById('bws-rating-exp-desc').textContent = experiment.research_intent;

    // Add rater info to header
    const raterInfo = document.getElementById('bws-rating-rater-info');
    if (raterInfo) {
      raterInfo.textContent = `Rating as: ${raterId}`;
      raterInfo.style.display = 'block';
    }

    // ✅ Initialize single-tuple browser with navigation
    setupBWSNavigation();

    // Load first tuple (you can navigate with Prev/Next or filter)
    await loadBWSTuple({ tupleIndex: 0, filter: 'unrated' });

  } catch (error) {
    console.error('Error starting human BWS rating:', error);
    showNotification('Failed to start rating interface', 'error');
  }
}

/**
 * Setup AI BWS Progress Listeners (OLD VERSION - DEPRECATED)
 *
 * @deprecated - Replaced by setupInlineAIProgressListeners()
 * This function showed a full-screen blocking overlay.
 * Now using inline banner instead.
 */
function setupAIBWSProgressListenersOLD() {
  // OLD CODE - DISABLED
  console.log('[setupAIBWSProgressListeners] Using inline banner instead of overlay');

  // The code below is kept for reference but not used:
  //
  // // Remove old listeners
  // window.api.removeAllListeners('bws:ai-progress');
  // window.api.removeAllListeners('bws:ai-item-rated');
  // window.api.removeAllListeners('bws:ai-complete');
  // window.api.removeAllListeners('bws:ai-error');
  //
  // // Show progress overlay
  // document.getElementById('bws-ai-progress-overlay').style.display = 'flex';
  //
  // // Close button for overlay
  // const closeBtn = document.getElementById('bws-ai-progress-close');
  // if (closeBtn) {
  //   closeBtn.onclick = () => {
  //     document.getElementById('bws-ai-progress-overlay').style.display = 'none';
  //   };
  // }
  //
  // // Progress updates
  // window.api.on('bws:ai-progress', (data) => {
  //   console.log(`[BWS AI Progress] ${data.current}/${data.total} (${data.percentage}%)`);
  //
  //   // Update progress overlay
  //   document.getElementById('bws-ai-progress-count').textContent = `${data.current} / ${data.total}`;
  //   document.getElementById('bws-ai-progress-percentage').textContent = `${data.percentage}%`;
  //   document.getElementById('bws-ai-progress-fill').style.width = `${data.percentage}%`;
  //
  //   // Update experiment card in gallery
  //   updateExperimentCardProgress(data);
  // });
  //
  // // Item rated
  // window.api.on('bws:ai-item-rated', (data) => {
  //   console.log(`[BWS AI] Tuple ${data.tupleId} rated - Best: ${data.best}, Worst: ${data.worst}`);
  //
  //   // Show latest result
  //   const latestDiv = document.getElementById('bws-ai-latest-result');
  //   const latestText = document.getElementById('bws-ai-latest-text');
  //
  //   if (latestDiv && latestText) {
  //     latestDiv.style.display = 'block';
  //     latestText.textContent = `Best: Item ${data.best + 1}, Worst: Item ${data.worst + 1} - ${data.reasoning?.substring(0, 150) || 'Processing...'}`;
  //   }
  // });
  //
  // // Completion
  // window.api.on('bws:ai-complete', async (data) => {
  //   console.log(`[BWS AI Complete] ${data.scoresCount} items ranked`);
  //
  //   // Hide progress overlay
  //   document.getElementById('bws-ai-progress-overlay').style.display = 'none';
  //
  //   showNotification(`AI rating complete! ${data.scoresCount} items ranked.`, 'success');
  //
  //   // Clear current experiment ID
  //   window.currentAIRatingExperimentId = null;
  //
  //   // Reload experiments to show updated status
  //   await loadBWSExperiments();
  // });
  //
  // // Errors
  // window.api.on('bws:ai-error', (data) => {
  //   console.error(`[BWS AI Error] Tuple ${data.tupleId}:`, data.error);
  // });
}

/**
 * Update experiment card with live progress
 */
function updateExperimentCardProgress(progressData) {
  // Find the specific experiment card
  const card = document.querySelector(`.bws-experiment-card[data-experiment-id="${progressData.experimentId}"]`);
  if (!card) return;

  // Update progress text (find the "Progress" stat)
  const stats = card.querySelectorAll('.stat');
  stats.forEach(stat => {
    const label = stat.querySelector('.stat-label');
    if (label && label.textContent === 'Progress') {
      const value = stat.querySelector('.stat-value');
      if (value) {
        value.textContent = `${progressData.current} / ${progressData.total} (${progressData.percentage}%)`;
      }
    }
  });

  // Update progress bar
  const progressBar = card.querySelector('.bws-progress-fill');
  if (progressBar) {
    progressBar.style.width = `${progressData.percentage}%`;
  }
}

/**
 * Setup rating interface event listeners
 */
function setupRatingInterfaceListeners() {
  // Close button
  const closeBtn = document.getElementById('bws-rating-close-btn');
  if (closeBtn) {
    closeBtn.replaceWith(closeBtn.cloneNode(true)); // Remove old listeners
    document.getElementById('bws-rating-close-btn').addEventListener('click', closeBWSRating);
  }

  // Pause button
  const pauseBtn = document.getElementById('bws-rating-pause-btn');
  if (pauseBtn) {
    pauseBtn.replaceWith(pauseBtn.cloneNode(true));
    document.getElementById('bws-rating-pause-btn').addEventListener('click', pauseBWSRating);
  }

  // Submit button
  const submitBtn = document.getElementById('bws-rating-submit-btn');
  if (submitBtn) {
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    document.getElementById('bws-rating-submit-btn').addEventListener('click', submitBWSJudgment);
  }

  // Skip button
  const skipBtn = document.getElementById('bws-rating-skip-btn');
  if (skipBtn) {
    skipBtn.replaceWith(skipBtn.cloneNode(true));
    document.getElementById('bws-rating-skip-btn').addEventListener('click', () => loadNextBWSTuple(true));
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', handleRatingKeyboard);
}

/**
 * Load next BWS tuple
 */
async function loadNextBWSTuple(isSkip = false) {
  try {
    // Pause all videos from previous tuple
    pauseAllBWSVideos();

    // If this is a skip, save a skip judgment so tuple is marked as "seen"
    if (isSkip && bwsRatingState.currentTuple) {
      try {
        await window.api.bws.saveJudgment({
          tuple_id: bwsRatingState.currentTuple.id,
          rater_type: bwsRatingState.raterType || 'human',
          rater_id: bwsRatingState.raterId || 'human-user',
          best_item_id: -1,  // Special marker for skipped
          worst_item_id: -2, // Different value to pass CHECK constraint
          reasoning: 'SKIPPED',
          response_time_ms: null
        });

        console.log('[Skip] Saved skip record for tuple', bwsRatingState.currentTuple.id);

        // Increment judgment count for progress tracking
        bwsRatingState.totalJudgments++;
      } catch (skipError) {
        console.error('[Skip] Failed to save skip record:', skipError);
        // Continue anyway - not critical
      }
    }

    // Show loading
    document.getElementById('bws-rating-loading').style.display = 'flex';

    // Get next tuple
    const result = await window.api.bws.getNextTuple({
      experimentId: bwsRatingState.experimentId,
      raterType: bwsRatingState.raterType || 'human',
      raterId: bwsRatingState.raterId || 'human-user'
    });

    // Hide loading
    document.getElementById('bws-rating-loading').style.display = 'none';

    if (!result.success) {
      showNotification(`Error loading tuple: ${result.error}`, 'error');
      return;
    }

    // Check if experiment is complete
    if (!result.tuple) {
      showNotification('All comparisons completed! Calculating scores...', 'success');
      await finishBWSRating();
      return;
    }

    // Update state
    bwsRatingState.currentTuple = result.tuple;
    bwsRatingState.currentTupleData = result;
    bwsRatingState.selectedBest = null;
    bwsRatingState.selectedWorst = null;

    // Render items
    renderBWSItemCards(result.items);

    // Update progress
    updateBWSRatingProgress();

    // Disable submit button
    document.getElementById('bws-rating-submit-btn').disabled = true;

  } catch (error) {
    console.error('Error loading next tuple:', error);
    document.getElementById('bws-rating-loading').style.display = 'none';
    showNotification('Failed to load next comparison', 'error');
  }
}

/**
 * Load a specific BWS tuple with navigation and filtering support
 *
 * @param {Object} options - Loading options
 * @param {number} options.tupleIndex - Load specific tuple by index (0-based)
 * @param {string} options.direction - 'next' or 'prev' for navigation
 * @param {string} options.filter - 'all', 'ai-rated', 'unrated', 'human-rated'
 *
 * Education: This is the navigation engine. It:
 * - Fetches all tuples for the experiment
 * - Filters them based on rating status
 * - Loads the target tuple with AI/human judgments
 * - Renders with overlays showing what AI/human picked
 */
async function loadBWSTuple(options = {}) {
  const {
    tupleIndex = null,
    direction = 'next',
    filter = 'all'
  } = options;

  try {
    // Pause videos from previous tuple
    pauseAllBWSVideos();

    const experimentId = bwsRatingState.experimentId;
    if (!experimentId) {
      console.error('[loadBWSTuple] No experiment ID');
      return;
    }

    // Show loading
    document.getElementById('bws-rating-loading').style.display = 'flex';

    // Fetch all tuples for this experiment
    const allTuples = await window.api.bws.getAllTuples({ experimentId });

    if (!allTuples || allTuples.length === 0) {
      showNotification('No tuples found for this experiment', 'info');
      document.getElementById('bws-rating-loading').style.display = 'none';
      return;
    }

    // Fetch AI judgments (what AI has rated)
    const aiJudgments = await window.api.bws.getJudgments({
      experimentId,
      raterType: 'ai'
    });

    // Fetch human judgments (what you've rated)
    const humanJudgments = await window.api.bws.getJudgments({
      experimentId,
      raterType: 'human',
      raterId: bwsRatingState.raterId || 'default-rater'
    });

    // Build lookup maps for fast filtering
    const aiJudgmentMap = new Map();
    aiJudgments.forEach(j => aiJudgmentMap.set(j.tuple_id, j));

    const humanJudgmentMap = new Map();
    humanJudgments.forEach(j => humanJudgmentMap.set(j.tuple_id, j));

    // Filter tuples based on filter option
    let filteredTuples = allTuples;

    if (filter === 'ai-rated') {
      filteredTuples = allTuples.filter(t => aiJudgmentMap.has(t.id));
    } else if (filter === 'unrated') {
      filteredTuples = allTuples.filter(t =>
        !aiJudgmentMap.has(t.id) && !humanJudgmentMap.has(t.id)
      );
    } else if (filter === 'human-rated') {
      filteredTuples = allTuples.filter(t => humanJudgmentMap.has(t.id));
    }
    // else filter === 'all', use all tuples

    if (filteredTuples.length === 0) {
      showNotification(`No tuples match filter: ${filter}`, 'info');
      document.getElementById('bws-rating-loading').style.display = 'none';
      return;
    }

    // Determine which tuple to load
    let targetTupleIndex;

    if (tupleIndex !== null) {
      // Load specific tuple by index
      targetTupleIndex = Math.max(0, Math.min(tupleIndex, filteredTuples.length - 1));
    } else {
      // Navigate from current position
      const currentIndex = bwsRatingState.currentTupleIndex !== undefined
        ? bwsRatingState.currentTupleIndex
        : 0;

      if (direction === 'next') {
        targetTupleIndex = Math.min(currentIndex + 1, filteredTuples.length - 1);
      } else if (direction === 'prev') {
        targetTupleIndex = Math.max(currentIndex - 1, 0);
      } else {
        targetTupleIndex = currentIndex;
      }
    }

    // Store navigation state
    bwsRatingState.currentTupleIndex = targetTupleIndex;
    bwsRatingState.currentFilter = filter;
    bwsRatingState.filteredTuples = filteredTuples;

    // Load the specific tuple with all its items
    const tupleToLoad = filteredTuples[targetTupleIndex];
    const tupleWithItems = await window.api.bws.getTupleWithItems({
      tupleId: tupleToLoad.id
    });

    // Get judgments for this specific tuple
    const aiJudgment = aiJudgmentMap.get(tupleToLoad.id);
    const humanJudgment = humanJudgmentMap.get(tupleToLoad.id);

    // Store in state for later use
    bwsRatingState.currentTuple = tupleWithItems;
    bwsRatingState.currentTupleData = tupleWithItems;
    bwsRatingState.currentAIJudgment = aiJudgment;
    bwsRatingState.currentHumanJudgment = humanJudgment;
    bwsRatingState.selectedBest = null;
    bwsRatingState.selectedWorst = null;

    // Render the tuple with AI/human overlays
    renderBWSTuple(tupleWithItems, aiJudgment, humanJudgment);

    // Update navigation UI (position counter, enable/disable buttons)
    updateNavigationUI(targetTupleIndex, filteredTuples.length);

    // Update progress
    updateBWSRatingProgress();

    // Hide loading
    document.getElementById('bws-rating-loading').style.display = 'none';

    console.log(`[loadBWSTuple] Loaded tuple ${tupleToLoad.id} (index ${targetTupleIndex + 1}/${filteredTuples.length}, filter: ${filter})`);

  } catch (error) {
    console.error('[loadBWSTuple] Error:', error);
    document.getElementById('bws-rating-loading').style.display = 'none';
    showNotification('Failed to load tuple', 'error');
  }
}

/**
 * Render a single BWS tuple with AI/human judgment overlays
 *
 * Education: This is the visual renderer. It:
 * - Shows tuple status (AI-rated? Human-rated? Both?)
 * - Renders 4 video cards with green/red borders
 * - Displays AI reasoning below the videos
 * - Shows agreement % if both AI and human rated
 *
 * @param {Object} tuple - The tuple with items
 * @param {Object} aiJudgment - AI's judgment (best_item_id, worst_item_id, reasoning)
 * @param {Object} humanJudgment - Human's judgment
 */
function renderBWSTuple(tuple, aiJudgment, humanJudgment) {
  // Get container elements
  const itemsGrid = document.getElementById('bws-rating-items-grid');
  const singleRatingView = document.getElementById('bws-single-rating-view');

  if (!itemsGrid || !singleRatingView) {
    console.error('[renderBWSTuple] Required elements not found');
    return;
  }

  // Show single-rating view (hide list view if it exists)
  singleRatingView.style.display = 'block';

  // Update tuple info header (status, agreement)
  updateTupleInfoHeader(tuple, aiJudgment, humanJudgment);

  // Clear existing items
  itemsGrid.innerHTML = '';

  // Apply smart layout class based on tuple size
  itemsGrid.className = 'bws-rating-items-grid';
  if (tuple.items.length === 2) {
    itemsGrid.classList.add('grid-2-items');
  } else if (tuple.items.length === 3) {
    itemsGrid.classList.add('grid-3-items');
  } else if (tuple.items.length === 4) {
    itemsGrid.classList.add('grid-4-items');
  }

  // Render each item (video or comment) with AI/human overlays
  tuple.items.forEach((item, index) => {
    const itemCard = renderBWSItemCard(item, index, aiJudgment, humanJudgment);
    itemsGrid.appendChild(itemCard);
  });

  // Display AI reasoning (if exists and blind mode off)
  displayAIReasoning(aiJudgment);

  // Update action buttons (Submit vs Update)
  updateActionButtons(humanJudgment);

  // ✅ CRITICAL: Start videos and setup interactions after DOM insertion
  // This enables hover-for-audio, click-to-expand, and progress bars
  const allVideos = tuple.items.every(item => item.item_type !== 'comment' && item.file_path);
  if (allVideos) {
    startBWSVideos();
  }

  console.log(`[renderBWSTuple] Rendered tuple ${tuple.id} with ${tuple.items.length} items`);
}

/**
 * Update tuple info header showing status and agreement
 *
 * Education: This creates/updates the header above the 4 videos.
 * Shows: "Tuple #123 - ✅ AI + Human Rated | ✅ Perfect Agreement (100%)"
 */
function updateTupleInfoHeader(tuple, aiJudgment, humanJudgment) {
  let header = document.getElementById('bws-tuple-info-header');

  if (!header) {
    // Create header element if it doesn't exist
    header = document.createElement('div');
    header.id = 'bws-tuple-info-header';
    header.className = 'bws-tuple-info-header';

    // Insert before single-rating-view
    const singleView = document.getElementById('bws-single-rating-view');
    if (singleView && singleView.parentNode) {
      singleView.parentNode.insertBefore(header, singleView);
    }
  }

  // Determine status HTML
  let statusHTML = '';

  if (aiJudgment && humanJudgment) {
    statusHTML = '<span class="status-both">✅ AI + Human Rated</span>';
  } else if (aiJudgment) {
    const timeAgo = getTimeAgo(aiJudgment.created_at);
    statusHTML = `<span class="status-ai">🤖 AI Rated (${timeAgo})</span>`;
  } else if (humanJudgment) {
    const timeAgo = getTimeAgo(humanJudgment.created_at);
    statusHTML = `<span class="status-human">👤 You Rated (${timeAgo})</span>`;
  } else {
    statusHTML = '<span class="status-unrated">⚪ Not Rated</span>';
  }

  // Agreement indicator (if both rated)
  let agreementHTML = '';
  if (aiJudgment && humanJudgment) {
    const bestAgree = aiJudgment.best_item_id === humanJudgment.best_item_id;
    const worstAgree = aiJudgment.worst_item_id === humanJudgment.worst_item_id;
    const agreementPct = (bestAgree && worstAgree) ? 100 : (bestAgree || worstAgree) ? 50 : 0;

    const icon = agreementPct === 100 ? '✅' : agreementPct === 50 ? '⚠️' : '❌';
    const text = agreementPct === 100 ? 'Perfect Agreement' :
                 agreementPct === 50 ? 'Partial Agreement' :
                 'Disagreement';

    agreementHTML = `
      <span class="agreement-indicator agreement-${agreementPct}">
        ${icon} ${text} (${agreementPct}%)
      </span>
    `;
  }

  header.innerHTML = `
    <div class="tuple-header-left">
      <h3>Tuple #${tuple.id}</h3>
      ${statusHTML}
    </div>
    <div class="tuple-header-right">
      ${agreementHTML}
    </div>
  `;
}

/**
 * Display AI reasoning below the video grid
 *
 * Education: Shows why AI picked BEST/WORST.
 * Hidden in blind mode to prevent bias.
 */
function displayAIReasoning(aiJudgment) {
  let reasoningContainer = document.getElementById('bws-ai-reasoning-display');

  if (!reasoningContainer) {
    // Create container
    reasoningContainer = document.createElement('div');
    reasoningContainer.id = 'bws-ai-reasoning-display';
    reasoningContainer.className = 'bws-ai-reasoning-display';

    // Insert after items grid
    const itemsGrid = document.getElementById('bws-rating-items-grid');
    if (itemsGrid && itemsGrid.parentNode) {
      itemsGrid.parentNode.insertBefore(reasoningContainer, itemsGrid.nextSibling);
    }
  }

  // Check blind mode
  const blindMode = document.getElementById('bws-blind-mode')?.checked || false;

  if (aiJudgment && aiJudgment.reasoning && !blindMode) {
    reasoningContainer.style.display = 'block';
    reasoningContainer.innerHTML = `
      <div class="reasoning-label">🤖 AI Reasoning:</div>
      <div class="reasoning-text">${aiJudgment.reasoning}</div>
    `;
  } else {
    reasoningContainer.style.display = 'none';
  }
}

/**
 * Update action buttons based on rating state
 *
 * Education: If human already rated, button says "Update Rating".
 * If not rated, button says "Submit Judgment" (disabled until BEST/WORST selected).
 */
function updateActionButtons(humanJudgment) {
  const submitBtn = document.getElementById('bws-rating-submit-btn');

  if (humanJudgment) {
    // Already rated - allow updating
    if (submitBtn) {
      submitBtn.textContent = 'Update Rating';
      submitBtn.disabled = false;
    }
  } else {
    // Not rated - normal submit
    if (submitBtn) {
      submitBtn.textContent = 'Submit Judgment';
      submitBtn.disabled = true; // Enable when BEST/WORST selected
    }
  }
}

/**
 * Helper: Get human-readable time ago
 *
 * Education: Converts "2025-10-04 10:30:00" → "2m ago" or "5h ago"
 */
function getTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Render a single BWS item card with AI/human overlay badges
 *
 * Education: This creates ONE video card with:
 * - Green border if AI picked BEST
 * - Red border if AI picked WORST
 * - Badges showing "🟢 BEST (AI)" or "🔴 WORST (AI)"
 * - Blue badges for human choices
 * - Blind mode hides AI overlays
 *
 * @param {Object} item - The video/comment item
 * @param {number} index - Position in tuple (0-3)
 * @param {Object} aiJudgment - AI's judgment (best_item_id, worst_item_id)
 * @param {Object} humanJudgment - Human's judgment
 * @returns {HTMLElement} The card element
 */
function renderBWSItemCard(item, index, aiJudgment, humanJudgment) {
  const card = document.createElement('div');
  card.className = 'bws-item-card';
  card.dataset.index = index;
  card.dataset.itemId = item.id;

  // Check blind mode
  const blindMode = document.getElementById('bws-blind-mode')?.checked || false;

  // Determine AI overlay classes and badges
  let aiOverlayClass = '';
  let aiBadgeHTML = '';

  if (aiJudgment && !blindMode) {
    if (item.id === aiJudgment.best_item_id) {
      aiOverlayClass = 'ai-best-overlay';
      aiBadgeHTML = '<div class="ai-badge badge-best">🟢 BEST (AI)</div>';
    } else if (item.id === aiJudgment.worst_item_id) {
      aiOverlayClass = 'ai-worst-overlay';
      aiBadgeHTML = '<div class="ai-badge badge-worst">🔴 WORST (AI)</div>';
    }
  }

  // Determine human overlay classes and badges
  let humanOverlayClass = '';
  let humanBadgeHTML = '';

  if (humanJudgment) {
    if (item.id === humanJudgment.best_item_id) {
      humanOverlayClass = 'human-best-overlay';
      humanBadgeHTML = '<div class="human-badge badge-best">🟢 BEST (You)</div>';
    } else if (item.id === humanJudgment.worst_item_id) {
      humanOverlayClass = 'human-worst-overlay';
      humanBadgeHTML = '<div class="human-badge badge-worst">🔴 WORST (You)</div>';
    }
  }

  // Apply overlay classes
  if (aiOverlayClass) card.classList.add(aiOverlayClass);
  if (humanOverlayClass) card.classList.add(humanOverlayClass);

  // Build card HTML
  const isComment = item.item_type === 'comment';
  const isVideo = !isComment && item.file_path;
  const content = isComment ? item.text : item.transcript_text;
  const typeLabel = isComment ? 'Comment' : 'Video Chunk';
  const duration = isVideo ? item.end_time - item.start_time : 0;

  card.innerHTML = `
    <div class="bws-item-header">
      <span class="bws-item-number">${index + 1}</span>
      <span class="bws-item-type">${typeLabel}</span>
      ${isVideo ? `<span class="bws-item-duration">${duration.toFixed(1)}s</span>` : ''}
    </div>

    ${isVideo ? `
      <!-- Video Player Container -->
      <div class="bws-video-container" data-index="${index}">
        <video
          class="bws-video-player"
          loop
          muted
          playsinline
          data-index="${index}"
          data-start="${item.start_time}"
          data-end="${item.end_time}"
        >
          <source src="file://${item.file_path}" type="video/mp4">
        </video>

        <!-- Audio indicator -->
        <div class="bws-audio-indicator">🔇</div>

        <!-- Progress bar -->
        <div class="bws-video-progress-bar">
          <div class="bws-video-progress-fill" data-index="${index}"></div>
        </div>

        <!-- AI Badge (conditionally shown) -->
        ${aiBadgeHTML}

        <!-- Human Badge (conditionally shown) -->
        ${humanBadgeHTML}
      </div>

      <!-- Transcript -->
      <div class="bws-transcript">
        <div class="bws-transcript-label">📝 Transcript</div>
        <div class="bws-transcript-text">
          ${content || 'No transcript available'}
        </div>
      </div>
    ` : `
      <!-- Text Content (for comments) -->
      <div class="bws-item-content">
        ${aiBadgeHTML}
        ${humanBadgeHTML}
        ${content || 'No content available'}
      </div>
    `}

    ${isComment ? `
      <div class="bws-item-meta">
        <span>👤 ${item.author || 'Unknown'}</span>
        <span>👍 ${item.likes || 0}</span>
      </div>
    ` : `
      <div class="bws-item-meta">
        <span>⏱️ ${formatTimestamp(item.start_time)} - ${formatTimestamp(item.end_time)}</span>
        <span>📊 Score: ${(item.relevance_score || 0).toFixed(2)}</span>
      </div>
    `}

    <div class="bws-item-actions">
      <button class="bws-item-btn btn-best" data-index="${index}" onclick="selectBest(${index})">
        ✓ BEST
      </button>
      <button class="bws-item-btn btn-worst" data-index="${index}" onclick="selectWorst(${index})">
        ✗ WORST
      </button>
    </div>
  `;

  return card;
}

/**
 * Setup navigation event listeners for single-tuple browser
 *
 * Education: This wires up the Next/Prev/Skip buttons.
 * Called once when rating interface opens.
 */
function setupBWSNavigation() {
  // Next button - load next tuple in current filter
  const nextBtn = document.getElementById('bws-nav-next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const filter = bwsRatingState.currentFilter || 'all';
      loadBWSTuple({ direction: 'next', filter });
    });
  }

  // Previous button - load previous tuple in current filter
  const prevBtn = document.getElementById('bws-nav-prev-btn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const filter = bwsRatingState.currentFilter || 'all';
      loadBWSTuple({ direction: 'prev', filter });
    });
  }

  // Skip button - jump to next unrated tuple
  const skipBtn = document.getElementById('bws-rating-skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      loadBWSTuple({ direction: 'next', filter: 'unrated' });
    });
  }

  // Filter dropdown - reload with new filter
  const filterSelect = document.getElementById('bws-filter-mode');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      const filter = e.target.value;
      loadBWSTuple({ tupleIndex: 0, filter }); // Load first tuple of filtered set
    });
  }

  // Blind mode toggle - re-render to hide/show AI overlays
  const blindModeCheckbox = document.getElementById('bws-blind-mode');
  const blindModeLabel = document.getElementById('bws-blind-mode-label');

  if (blindModeCheckbox) {
    blindModeCheckbox.addEventListener('change', (e) => {
      const blindMode = e.target.checked;

      // Update label
      if (blindModeLabel) {
        blindModeLabel.textContent = blindMode ? '🙈 Blind Mode: ON' : '👁 Blind Mode: OFF';
      }

      // Toggle class on interface container
      const ratingInterface = document.getElementById('bws-rating-interface');
      if (ratingInterface) {
        ratingInterface.classList.toggle('blind-mode-active', blindMode);
      }

      // Re-render current tuple to apply blind mode
      const currentTuple = bwsRatingState.currentTuple;
      const aiJudgment = bwsRatingState.currentAIJudgment;
      const humanJudgment = bwsRatingState.currentHumanJudgment;

      if (currentTuple) {
        renderBWSTuple(currentTuple, aiJudgment, humanJudgment);
      }
    });
  }

  console.log('[setupBWSNavigation] Navigation event listeners attached');
}

/**
 * Update navigation UI (position counter, button states)
 *
 * Education: Updates "Tuple 5 of 45" and enables/disables Prev/Next
 * based on whether you're at the start/end of the filtered list.
 *
 * @param {number} currentIndex - Current position (0-based)
 * @param {number} totalCount - Total tuples in current filter
 */
function updateNavigationUI(currentIndex, totalCount) {
  // Update position counter
  const currentIndexElement = document.getElementById('bws-current-index');
  const totalCountElement = document.getElementById('bws-total-count');

  if (currentIndexElement) {
    currentIndexElement.textContent = currentIndex + 1; // Display 1-based
  }

  if (totalCountElement) {
    totalCountElement.textContent = totalCount;
  }

  // Enable/disable prev button (disabled at first tuple)
  const prevBtn = document.getElementById('bws-nav-prev-btn');
  if (prevBtn) {
    prevBtn.disabled = (currentIndex === 0);
  }

  // Enable/disable next button (disabled at last tuple)
  const nextBtn = document.getElementById('bws-nav-next-btn');
  if (nextBtn) {
    nextBtn.disabled = (currentIndex === totalCount - 1);
  }

  console.log(`[updateNavigationUI] Position: ${currentIndex + 1}/${totalCount}`);
}

/**
 * Render BWS item cards (OLD VERSION - for backward compatibility)
 */
function renderBWSItemCards(items) {
  const grid = document.getElementById('bws-rating-items-grid');
  if (!grid) return;

  grid.innerHTML = '';

  // Apply smart layout class based on tuple size
  grid.className = 'bws-rating-items-grid';
  if (items.length === 2) {
    grid.classList.add('grid-2-items');
  } else if (items.length === 3) {
    grid.classList.add('grid-3-items');
  } else if (items.length === 4) {
    grid.classList.add('grid-4-items');
  }

  // Check if all items are video chunks
  const allVideos = items.every(item => item.item_type !== 'comment' && item.file_path);

  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'bws-item-card';
    card.dataset.index = index;

    // Determine item type and content
    const isComment = item.item_type === 'comment';
    const isVideo = !isComment && item.file_path;
    const content = isComment ? item.text : item.transcript_text;
    const typeLabel = isComment ? 'Comment' : 'Video Chunk';
    const duration = isVideo ? item.end_time - item.start_time : 0;

    card.innerHTML = `
      <div class="bws-item-header">
        <span class="bws-item-number">${index + 1}</span>
        <span class="bws-item-type">${typeLabel}</span>
        ${isVideo ? `<span class="bws-item-duration">${duration.toFixed(1)}s</span>` : ''}
      </div>

      ${isVideo ? `
        <!-- Video Player Container -->
        <div class="bws-video-container" data-index="${index}">
          <video
            class="bws-video-player"
            loop
            muted
            playsinline
            data-index="${index}"
            data-start="${item.start_time}"
            data-end="${item.end_time}"
          >
            <source src="file://${item.file_path}" type="video/mp4">
          </video>

          <!-- Audio indicator (hidden, updated by JS) -->
          <div class="bws-audio-indicator">🔇</div>

          <!-- Subtle progress bar at bottom -->
          <div class="bws-video-progress-bar">
            <div class="bws-video-progress-fill" data-index="${index}"></div>
          </div>
        </div>

        <!-- Transcript (always visible) -->
        <div class="bws-transcript">
          <div class="bws-transcript-label">📝 Transcript</div>
          <div class="bws-transcript-text">
            ${content || 'No transcript available'}
          </div>
        </div>
      ` : `
        <!-- Text Content (for comments) -->
        <div class="bws-item-content">
          ${content || 'No content available'}
        </div>
      `}

      ${isComment ? `
        <div class="bws-item-meta">
          <span>👤 ${item.author || 'Unknown'}</span>
          <span>👍 ${item.likes || 0}</span>
        </div>
      ` : `
        <div class="bws-item-meta">
          <span>⏱️ ${formatTimestamp(item.start_time)} - ${formatTimestamp(item.end_time)}</span>
          <span>📊 Score: ${(item.relevance_score || 0).toFixed(2)}</span>
        </div>
      `}

      <div class="bws-item-actions">
        <button class="bws-item-btn btn-best" data-index="${index}" onclick="selectBest(${index})">
          ✓ BEST
        </button>
        <button class="bws-item-btn btn-worst" data-index="${index}" onclick="selectWorst(${index})">
          ✗ WORST
        </button>
      </div>
    `;

    grid.appendChild(card);
  });

  // Start videos after DOM insertion (staggered for performance)
  if (allVideos) {
    startBWSVideos();
  }
}

/**
 * Start all BWS videos (staggered for performance)
 */
function startBWSVideos() {
  const videos = document.querySelectorAll('.bws-video-player');

  console.log(`[startBWSVideos] Starting ${videos.length} videos with staggered loading`);

  videos.forEach((video, index) => {
    // Stagger by 150ms each to avoid race condition with pauseAllBWSVideos()
    setTimeout(() => {
      video.play().catch(err => {
        // Ignore "interrupted by pause" errors - they're harmless during tuple loading
        if (!err.message.includes('interrupted')) {
          console.warn(`Video ${index} autoplay blocked:`, err.message);
          // Fallback: show play button overlay
          const container = video.closest('.bws-video-container');
          if (container) {
            container.classList.add('needs-interaction');
          }
        }
      });

      // All videos start muted (hover for audio)
      video.muted = true;
    }, index * 150 + 200); // Extra 200ms delay after pause completes
  });

  // Setup hover interactions for audio
  setupVideoHoverInteractions();

  // Setup progress bar updates
  setupVideoProgressBars();
}

/**
 * Setup hover interactions for video cards
 *
 * Note: We recreate event listeners each time because itemsGrid.innerHTML = ''
 * removes old elements, so no need to manually remove listeners
 */
function setupVideoHoverInteractions() {
  const videoContainers = document.querySelectorAll('.bws-video-container');

  videoContainers.forEach((container, index) => {
    const video = container.querySelector('.bws-video-player');

    if (!video) return;

    // Hover = enlarge + audio
    const handleMouseEnter = () => {
      container.style.transform = 'scale(1.15)';
      container.style.zIndex = '10';

      // Unmute this video, mute others
      document.querySelectorAll('.bws-video-player').forEach(v => v.muted = true);
      video.muted = false;

      // Update button states
      updateAudioButtonStates(index);
    };

    const handleMouseLeave = () => {
      container.style.transform = 'scale(1)';
      container.style.zIndex = '1';
      video.muted = true;

      // Reset button states
      updateAudioButtonStates(-1);
    };

    const handleClick = () => {
      openVideoDetailModal(index);
    };

    // Add event listeners
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);
  });
}

/**
 * Update audio indicator visual states
 */
function updateAudioButtonStates(activeIndex) {
  const audioIndicators = document.querySelectorAll('.bws-audio-indicator');
  audioIndicators.forEach((indicator, i) => {
    indicator.textContent = i === activeIndex ? '🔊' : '🔇';
    indicator.classList.toggle('active', i === activeIndex);
  });
}

/**
 * Setup video progress bars (subtle playback progress indicators)
 */
function setupVideoProgressBars() {
  const videos = document.querySelectorAll('.bws-video-player');

  videos.forEach((video, index) => {
    const progressFill = document.querySelector(`.bws-video-progress-fill[data-index="${index}"]`);

    if (!progressFill) return;

    // Update progress bar on timeupdate
    video.addEventListener('timeupdate', () => {
      if (video.duration > 0) {
        const percentage = (video.currentTime / video.duration) * 100;
        progressFill.style.width = `${percentage}%`;
      }
    });

    // Reset on loop
    video.addEventListener('ended', () => {
      progressFill.style.width = '0%';
    });
  });

  console.log(`[setupVideoProgressBars] Setup progress tracking for ${videos.length} videos`);
}

/**
 * Open video detail modal for close inspection
 */
function openVideoDetailModal(index) {
  const items = bwsRatingState.currentTupleData?.items || [];
  const item = items[index];

  if (!item || item.item_type === 'comment') return;

  const modal = document.getElementById('bws-video-detail-modal');
  if (!modal) {
    console.error('Video detail modal not found');
    return;
  }

  // Pause all grid videos
  pauseAllBWSVideos();

  // Populate modal
  const modalVideo = document.getElementById('bws-modal-video');
  const modalTranscript = document.getElementById('bws-modal-transcript');
  const modalMeta = document.getElementById('bws-modal-meta');
  const modalTitle = document.getElementById('bws-modal-title');

  modalVideo.src = `file://${item.file_path}`;
  modalVideo.loop = true;
  modalVideo.controls = true;

  modalTitle.textContent = `Item ${index + 1}: Video Chunk`;
  modalTranscript.textContent = item.transcript_text || 'No transcript available';

  const duration = item.end_time - item.start_time;
  modalMeta.innerHTML = `
    <span>⏱️ ${formatTimestamp(item.start_time)} - ${formatTimestamp(item.end_time)} (${duration.toFixed(1)}s)</span>
    <span>📊 Score: ${(item.relevance_score || 0).toFixed(2)}</span>
  `;

  // Show modal
  modal.style.display = 'flex';

  // Play video
  modalVideo.play().catch(err => console.error('Modal video play failed:', err));

  console.log(`[openVideoDetailModal] Opened detail view for video ${index}`);
}

/**
 * Close video detail modal
 */
function closeBWSVideoDetailModal() {
  const modal = document.getElementById('bws-video-detail-modal');
  const modalVideo = document.getElementById('bws-modal-video');

  if (modal) {
    modal.style.display = 'none';
  }

  if (modalVideo) {
    modalVideo.pause();
    modalVideo.src = '';
  }

  // Resume grid videos
  document.querySelectorAll('.bws-video-player').forEach(v => v.play());

  console.log('[closeBWSVideoDetailModal] Closed detail view');
}

/**
 * Toggle audio for a specific video (mute all others)
 */
function toggleBWSAudio(index) {
  const videos = document.querySelectorAll('.bws-video-player');
  const audioButtons = document.querySelectorAll('.bws-audio-toggle');

  videos.forEach((video, i) => {
    if (i === index) {
      video.muted = false;
      console.log(`[toggleBWSAudio] Unmuted video ${index}`);
    } else {
      video.muted = true;
    }
  });

  // Update button states
  audioButtons.forEach((btn, i) => {
    btn.textContent = i === index ? '🔊' : '🔇';
    btn.classList.toggle('active', i === index);
  });
}

/**
 * Toggle pause/play for a specific video
 */
function toggleBWSPause(index) {
  const video = document.querySelector(`.bws-video-player[data-index="${index}"]`);
  const pauseBtn = document.querySelector(`.bws-pause-toggle[data-index="${index}"]`);

  if (!video || !pauseBtn) return;

  if (video.paused) {
    video.play();
    pauseBtn.textContent = '⏸️';
    console.log(`[toggleBWSPause] Playing video ${index}`);
  } else {
    video.pause();
    pauseBtn.textContent = '▶️';
    console.log(`[toggleBWSPause] Paused video ${index}`);
  }
}

/**
 * Pause all BWS videos (called on submit)
 */
function pauseAllBWSVideos() {
  const videos = document.querySelectorAll('.bws-video-player');
  videos.forEach(video => {
    video.pause();
  });
}

/**
 * Select item as BEST
 */
function selectBest(index) {
  // Clear previous best selection
  if (bwsRatingState.selectedBest !== null) {
    const prevCard = document.querySelector(`.bws-item-card[data-index="${bwsRatingState.selectedBest}"]`);
    const prevBtn = prevCard?.querySelector('.btn-best');
    if (prevCard) prevCard.classList.remove('selected-best');
    if (prevBtn) prevBtn.classList.remove('active');

    // Remove badge
    const prevBadge = prevCard?.querySelector('.bws-selection-badge.badge-best');
    if (prevBadge) prevBadge.remove();
  }

  // Prevent same item being both best and worst
  if (index === bwsRatingState.selectedWorst) {
    bwsRatingState.selectedWorst = null;
    const worstCard = document.querySelector(`.bws-item-card[data-index="${index}"]`);
    const worstBtn = worstCard?.querySelector('.btn-worst');
    if (worstCard) worstCard.classList.remove('selected-worst');
    if (worstBtn) worstBtn.classList.remove('active');

    const worstBadge = worstCard?.querySelector('.bws-selection-badge.badge-worst');
    if (worstBadge) worstBadge.remove();
  }

  // Set new best
  bwsRatingState.selectedBest = index;
  const card = document.querySelector(`.bws-item-card[data-index="${index}"]`);
  const btn = card?.querySelector('.btn-best');

  if (card) {
    card.classList.add('selected-best');

    // Add badge
    const badge = document.createElement('div');
    badge.className = 'bws-selection-badge badge-best';
    badge.textContent = '✓';
    card.appendChild(badge);
  }
  if (btn) btn.classList.add('active');

  validateBWSSelection();
}

/**
 * Select item as WORST
 */
function selectWorst(index) {
  // Clear previous worst selection
  if (bwsRatingState.selectedWorst !== null) {
    const prevCard = document.querySelector(`.bws-item-card[data-index="${bwsRatingState.selectedWorst}"]`);
    const prevBtn = prevCard?.querySelector('.btn-worst');
    if (prevCard) prevCard.classList.remove('selected-worst');
    if (prevBtn) prevBtn.classList.remove('active');

    const prevBadge = prevCard?.querySelector('.bws-selection-badge.badge-worst');
    if (prevBadge) prevBadge.remove();
  }

  // Prevent same item being both best and worst
  if (index === bwsRatingState.selectedBest) {
    bwsRatingState.selectedBest = null;
    const bestCard = document.querySelector(`.bws-item-card[data-index="${index}"]`);
    const bestBtn = bestCard?.querySelector('.btn-best');
    if (bestCard) bestCard.classList.remove('selected-best');
    if (bestBtn) bestBtn.classList.remove('active');

    const bestBadge = bestCard?.querySelector('.bws-selection-badge.badge-best');
    if (bestBadge) bestBadge.remove();
  }

  // Set new worst
  bwsRatingState.selectedWorst = index;
  const card = document.querySelector(`.bws-item-card[data-index="${index}"]`);
  const btn = card?.querySelector('.btn-worst');

  if (card) {
    card.classList.add('selected-worst');

    // Add badge
    const badge = document.createElement('div');
    badge.className = 'bws-selection-badge badge-worst';
    badge.textContent = '✗';
    card.appendChild(badge);
  }
  if (btn) btn.classList.add('active');

  validateBWSSelection();
}

/**
 * Validate BWS selection (enable submit if both selected)
 */
function validateBWSSelection() {
  const submitBtn = document.getElementById('bws-rating-submit-btn');
  const isValid = bwsRatingState.selectedBest !== null &&
                  bwsRatingState.selectedWorst !== null &&
                  bwsRatingState.selectedBest !== bwsRatingState.selectedWorst;

  if (submitBtn) {
    submitBtn.disabled = !isValid;
  }
}

/**
 * Handle keyboard shortcuts
 */
function handleRatingKeyboard(e) {
  // Only handle if rating interface is visible
  const ratingInterface = document.getElementById('bws-rating-interface');
  if (!ratingInterface || ratingInterface.style.display === 'none') {
    return;
  }

  const items = bwsRatingState.currentTupleData?.items || [];

  // Numbers 1-4 for BEST
  if (e.key >= '1' && e.key <= '4') {
    const index = parseInt(e.key) - 1;
    if (index < items.length) {
      selectBest(index);
    }
    e.preventDefault();
  }

  // Q, W, E, R for WORST
  const worstKeys = { 'q': 0, 'w': 1, 'e': 2, 'r': 3 };
  if (worstKeys.hasOwnProperty(e.key.toLowerCase())) {
    const index = worstKeys[e.key.toLowerCase()];
    if (index < items.length) {
      selectWorst(index);
    }
    e.preventDefault();
  }

  // Enter to submit
  if (e.key === 'Enter') {
    const submitBtn = document.getElementById('bws-rating-submit-btn');
    if (submitBtn && !submitBtn.disabled) {
      submitBWSJudgment();
    }
    e.preventDefault();
  }

  // Escape to close
  if (e.key === 'Escape') {
    closeBWSRating();
    e.preventDefault();
  }
}

/**
 * Submit BWS judgment
 */
async function submitBWSJudgment() {
  if (bwsRatingState.selectedBest === null || bwsRatingState.selectedWorst === null) {
    showNotification('Please select both BEST and WORST items', 'error');
    return;
  }

  if (bwsRatingState.selectedBest === bwsRatingState.selectedWorst) {
    showNotification('BEST and WORST must be different items', 'error');
    return;
  }

  try {
    // Show loading
    document.getElementById('bws-rating-loading').style.display = 'flex';

    // Convert indices to actual item IDs
    const items = bwsRatingState.currentTupleData.items || [];
    const bestItemId = items[bwsRatingState.selectedBest]?.id;
    const worstItemId = items[bwsRatingState.selectedWorst]?.id;

    if (!bestItemId || !worstItemId) {
      document.getElementById('bws-rating-loading').style.display = 'none';
      showNotification('Error: Could not find item IDs', 'error');
      return;
    }

    const result = await window.api.bws.saveJudgment({
      tuple_id: bwsRatingState.currentTuple.id,
      rater_type: bwsRatingState.raterType || 'human',
      rater_id: bwsRatingState.raterId || 'human-user',
      best_item_id: bestItemId,
      worst_item_id: worstItemId,
      reasoning: null,
      response_time_ms: 0 // Can track this if needed
    });

    if (!result.success) {
      document.getElementById('bws-rating-loading').style.display = 'none';
      showNotification(`Failed to save judgment: ${result.error}`, 'error');
      return;
    }

    // Increment judgment count
    bwsRatingState.totalJudgments++;

    // ✅ Keep selection visible! Reload current tuple to show both:
    // - Your selection (light green/red DASHED outline - same color as your rating)
    // - AI rating (bright green/red SOLID border)
    // - Human rating (light green/red SOLID border)
    // The dashed outline shows OUTSIDE the solid border so you can see overlap!
    const currentIndex = bwsRatingState.currentTupleIndex;
    const currentFilter = bwsRatingState.currentFilter || 'all';

    if (currentIndex !== undefined) {
      await loadBWSTuple({ tupleIndex: currentIndex, filter: currentFilter });

      // Restore selection state after reload
      if (bwsRatingState.selectedBest !== null) {
        const bestCard = document.querySelector(`.bws-item-card[data-index="${bwsRatingState.selectedBest}"]`);
        if (bestCard) bestCard.classList.add('selected-best');
      }
      if (bwsRatingState.selectedWorst !== null) {
        const worstCard = document.querySelector(`.bws-item-card[data-index="${bwsRatingState.selectedWorst}"]`);
        if (worstCard) worstCard.classList.add('selected-worst');
      }
    }

    // Update progress display
    updateBWSRatingProgress();

    // Hide loading
    document.getElementById('bws-rating-loading').style.display = 'none';

    showNotification('✅ Saved! Dashed = your pick, solid = AI rating (if exists)', 'success');

  } catch (error) {
    console.error('Error submitting judgment:', error);
    document.getElementById('bws-rating-loading').style.display = 'none';
    showNotification('Failed to submit judgment', 'error');
  }
}

/**
 * Update rating progress bar
 */
function updateBWSRatingProgress() {
  const progressText = document.getElementById('bws-rating-progress-text');
  const progressFill = document.getElementById('bws-rating-progress-fill');

  const completed = bwsRatingState.totalJudgments;
  const total = bwsRatingState.totalTuples;
  const percentage = total > 0 ? (completed / total * 100) : 0;

  if (progressText) {
    progressText.textContent = `${completed} / ${total} (${percentage.toFixed(0)}%)`;
  }

  if (progressFill) {
    progressFill.style.width = `${percentage}%`;
  }
}

/**
 * Finish BWS rating (all tuples completed)
 */
async function finishBWSRating() {
  try {
    const experimentId = bwsRatingState.experimentId;
    const raterId = bwsRatingState.raterId;

    showNotification('Calculating scores...', 'info');

    // Calculate combined scores (all raters)
    const combinedResult = await window.api.bws.calculateScores({
      experimentId,
      raterId: null  // null = combined
    });

    if (!combinedResult.success) {
      showNotification(`Failed to calculate combined scores: ${combinedResult.error}`, 'error');
      return;
    }

    // Calculate rater-specific scores
    if (raterId) {
      const raterResult = await window.api.bws.calculateScores({
        experimentId,
        raterId: raterId
      });

      if (!raterResult.success) {
        console.error(`Failed to calculate ${raterId} scores:`, raterResult.error);
      }
    }

    // If this was human rating, also calculate AI-only scores if AI judgments exist
    if (raterId === 'human-user') {
      const aiCount = await window.api.bws.getRaterJudgmentCount({
        experimentId,
        raterId: 'gemini-2.5-flash'
      });

      if (aiCount.success && aiCount.count > 0) {
        const aiResult = await window.api.bws.calculateScores({
          experimentId,
          raterId: 'gemini-2.5-flash'
        });

        if (!aiResult.success) {
          console.error('Failed to calculate AI scores:', aiResult.error);
        }
      }
    }

    showNotification(`Experiment complete! ${combinedResult.scores?.length || 0} items ranked.`, 'success');

    // Close rating interface
    closeBWSRating();

    // Reload experiments list
    await loadBWSExperiments();

  } catch (error) {
    console.error('Error finishing BWS rating:', error);
    showNotification('Failed to complete experiment', 'error');
  }
}

/**
 * Pause BWS rating (take a break)
 */
function pauseBWSRating() {
  // Pause all videos
  pauseAllBWSVideos();

  // Hide interface
  document.getElementById('bws-rating-interface').style.display = 'none';

  // Remove keyboard listener temporarily
  document.removeEventListener('keydown', handleRatingKeyboard);

  // Show notification with resume option
  showNotification('Rating paused. Your progress is saved. Return to the experiment to resume.', 'info');

  console.log('[pauseBWSRating] Paused rating for experiment', bwsRatingState.experimentId);

  // Note: We keep bwsRatingState intact so user can resume from the same tuple
  // The experiment will show as "in_progress" in the gallery with a "Start Rating" button
}

/**
 * Close BWS rating interface
 */
function closeBWSRating() {
  if (confirm('Are you sure you want to exit? Progress is saved automatically.')) {
    // ✅ Cleanup list view (stop auto-refresh, reset state)
    cleanupBWSListView();

    // ✅ Hide inline AI progress banner
    hideInlineAIProgress();

    // Pause all videos
    pauseAllBWSVideos();

    // Remove keyboard listener
    document.removeEventListener('keydown', handleRatingKeyboard);

    // Hide interface
    document.getElementById('bws-rating-interface').style.display = 'none';

    // Reset state
    bwsRatingState = {
      experimentId: null,
      experiment: null,
      currentTuple: null,
      currentTupleData: null,
      selectedBest: null,
      selectedWorst: null,
      totalJudgments: 0,
      totalTuples: 0
    };

    // Reload experiments to show updated progress
    loadBWSExperiments();
  }
}

/**
 * Format timestamp (seconds to MM:SS)
 */
function formatTimestamp(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * BWS Results State
 */
let bwsResultsState = {
  experimentId: null,
  experiment: null,
  scores: [],
  sortColumn: 'rank',
  sortDirection: 'asc',
  currentRaterId: 'combined'
};

/**
 * View BWS results
 */
async function viewBWSResults(experimentId, raterId = 'combined') {
  try {
    // Load experiment and scores
    const expResult = await window.api.bws.getExperiment({ experimentId });
    const scoresResult = await window.api.bws.getScores({ experimentId, raterId });

    if (!expResult.success || !scoresResult.success) {
      showNotification('Failed to load results', 'error');
      return;
    }

    const experiment = expResult.experiment;
    const scores = scoresResult.scores || [];

    // Store in state for sorting and view switching
    bwsResultsState.experimentId = experimentId;
    bwsResultsState.experiment = experiment;
    bwsResultsState.scores = scores;
    bwsResultsState.sortColumn = 'rank';
    bwsResultsState.sortDirection = 'asc';
    bwsResultsState.currentRaterId = raterId;

    // Show results overlay
    document.getElementById('bws-results-overlay').style.display = 'flex';

    // Update header
    document.getElementById('bws-results-title').textContent = `Results: ${experiment.name}`;
    document.getElementById('bws-results-subtitle').textContent = experiment.research_intent;

    // Setup rater selector dropdown
    setupRaterSelector(experimentId);

    // Update stats
    document.getElementById('bws-results-total').textContent = scores.length;
    document.getElementById('bws-results-comparisons').textContent = experiment.tuples_generated || 0;
    document.getElementById('bws-results-method').textContent = experiment.scoring_method || 'Counting';

    // Render results table
    renderBWSResultsTable(scores);

    // Setup sortable headers
    setupSortableHeaders();

    // Setup close button
    document.getElementById('bws-results-close').onclick = () => {
      document.getElementById('bws-results-overlay').style.display = 'none';
    };

    // Setup export buttons
    setupBWSExportButtons(experimentId, experiment, scores);

  } catch (error) {
    console.error('Error viewing BWS results:', error);
    showNotification('Failed to load results', 'error');
  }
}

/**
 * Setup rater selector dropdown
 */
async function setupRaterSelector(experimentId) {
  const selector = document.getElementById('bws-rater-selector');
  if (!selector) {
    console.warn('Rater selector element not found - skipping setup');
    return;
  }

  // Check if human judgments exist
  const humanCount = await window.api.bws.getRaterJudgmentCount({
    experimentId,
    raterId: 'human-user'
  });

  // Check if AI judgments exist
  const aiCount = await window.api.bws.getRaterJudgmentCount({
    experimentId,
    raterId: 'gemini-2.5-flash'
  });

  const hasHuman = humanCount.success && humanCount.count > 0;
  const hasAI = aiCount.success && aiCount.count > 0;

  // Build selector options
  let options = '<option value="combined">🔀 Combined (All Raters)</option>';

  if (hasAI) {
    options += '<option value="gemini-2.5-flash">🤖 AI Only (Gemini)</option>';
  }

  if (hasHuman) {
    options += '<option value="human-user">👤 Human Only</option>';
  }

  selector.innerHTML = options;
  selector.value = bwsResultsState.currentRaterId;

  // Setup change listener
  selector.onchange = (e) => switchRaterView(e.target.value);

  // Show selector if multiple raters exist
  if (hasHuman && hasAI) {
    selector.parentElement.style.display = 'block';
  } else {
    selector.parentElement.style.display = 'none';
  }
}

/**
 * Switch rater view (reload scores for different rater)
 */
async function switchRaterView(raterId) {
  try {
    // Load scores for selected rater
    const result = await window.api.bws.getScores({
      experimentId: bwsResultsState.experimentId,
      raterId: raterId
    });

    if (!result.success) {
      showNotification(`Failed to load ${raterId} scores`, 'error');
      return;
    }

    // Update state
    bwsResultsState.scores = result.scores || [];
    bwsResultsState.currentRaterId = raterId;
    bwsResultsState.sortColumn = 'rank';
    bwsResultsState.sortDirection = 'asc';

    // Re-render table
    renderBWSResultsTable(result.scores);

    // Update stats
    document.getElementById('bws-results-total').textContent = result.scores.length;

    console.log(`[switchRaterView] Switched to ${raterId} view (${result.scores.length} items)`);

  } catch (error) {
    console.error('Error switching rater view:', error);
    showNotification('Failed to switch rater view', 'error');
  }
}

/**
 * Render BWS results table
 */
function renderBWSResultsTable(scores) {
  const tbody = document.getElementById('bws-results-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  scores.forEach((score, index) => {
    const rank = index + 1;
    const scoreValue = score.score_counting || 0;

    // Determine score class (positive/negative/neutral)
    let scoreClass = 'bws-score-neutral';
    if (scoreValue > 0) scoreClass = 'bws-score-positive';
    if (scoreValue < 0) scoreClass = 'bws-score-negative';

    // Format Bradley-Terry score with confidence interval
    let btScoreDisplay = 'N/A';
    if (score.score_bt !== null && score.score_bt !== undefined) {
      const btScore = score.score_bt.toFixed(2);
      const ciLower = score.confidence_interval_lower?.toFixed(2) || '?';
      const ciUpper = score.confidence_interval_upper?.toFixed(2) || '?';
      btScoreDisplay = `<span class="bws-bt-score">${btScore}</span><br><span class="bws-bt-ci">[${ciLower}, ${ciUpper}]</span>`;
    }

    // Get item content - check both comment_text and chunk_text
    const isComment = score.comment_text != null;
    const content = isComment ? score.comment_text : score.chunk_text;
    const preview = content ? content.substring(0, 200) + (content.length > 200 ? '...' : '') : 'No content';

    const row = document.createElement('tr');

    // Add video-chunk-row class and click handler for video chunks
    if (!isComment && score.chunk_file_path) {
      row.className = 'video-chunk-row';
      row.onclick = () => openBWSVideoModal(score);
    }

    row.innerHTML = `
      <td>${rank}</td>
      <td>
        <div class="bws-item-preview">${preview}</div>
        <div class="bws-item-meta-inline">
          <span>${isComment ? '💬 Comment' : '🎬 Video Chunk'}</span>
          ${isComment ? `<span>👤 ${score.author_name || 'Unknown'}</span>` : ''}
        </div>
      </td>
      <td class="bws-bt-score-cell">${btScoreDisplay}</td>
      <td class="${scoreClass}">${scoreValue > 0 ? '+' : ''}${scoreValue}</td>
      <td class="bws-score-positive">${score.num_best || 0}</td>
      <td class="bws-score-negative">${score.num_worst || 0}</td>
      <td>${score.num_appearances || 0}</td>
    `;

    tbody.appendChild(row);
  });
}

/**
 * Setup sortable table headers
 */
function setupSortableHeaders() {
  const headers = document.querySelectorAll('.bws-results-table th.sortable');

  headers.forEach(header => {
    header.onclick = () => {
      const sortColumn = header.dataset.sort;
      sortBWSResults(sortColumn);
    };
  });
}

/**
 * Sort BWS results
 */
function sortBWSResults(column) {
  // Toggle direction if same column, otherwise default to descending for value columns
  if (bwsResultsState.sortColumn === column) {
    bwsResultsState.sortDirection = bwsResultsState.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    bwsResultsState.sortColumn = column;
    bwsResultsState.sortDirection = column === 'rank' ? 'asc' : 'desc';
  }

  // Sort the scores array
  const sorted = [...bwsResultsState.scores].sort((a, b) => {
    let aVal, bVal;

    switch (column) {
      case 'rank':
        aVal = a.rank;
        bVal = b.rank;
        break;
      case 'score_bt':
        aVal = a.score_bt !== null && a.score_bt !== undefined ? a.score_bt : -999;
        bVal = b.score_bt !== null && b.score_bt !== undefined ? b.score_bt : -999;
        break;
      case 'score':
        aVal = a.score_counting || 0;
        bVal = b.score_counting || 0;
        break;
      case 'best':
        aVal = a.num_best || 0;
        bVal = b.num_best || 0;
        break;
      case 'worst':
        aVal = a.num_worst || 0;
        bVal = b.num_worst || 0;
        break;
      case 'appearances':
        aVal = a.num_appearances || 0;
        bVal = b.num_appearances || 0;
        break;
      default:
        return 0;
    }

    if (bwsResultsState.sortDirection === 'asc') {
      return aVal - bVal;
    } else {
      return bVal - aVal;
    }
  });

  // Update header classes
  document.querySelectorAll('.bws-results-table th.sortable').forEach(h => {
    h.classList.remove('sorted-asc', 'sorted-desc');
  });

  const activeHeader = document.querySelector(`.bws-results-table th[data-sort="${column}"]`);
  if (activeHeader) {
    activeHeader.classList.add(`sorted-${bwsResultsState.sortDirection}`);
  }

  // Re-render table
  renderBWSResultsTable(sorted);
}

/**
 * Open video chunk modal
 */
async function openBWSVideoModal(score) {
  try {
    console.log('[BWS Video Modal] Opening for score:', score);
    console.log('[BWS Video Modal] Chunk file path:', score.chunk_file_path);

    if (!score.chunk_file_path) {
      showNotification('Video file path not found', 'error');
      return;
    }

    // The path is already absolute, use it directly with file:// protocol
    const videoPath = score.chunk_file_path.startsWith('file://')
      ? score.chunk_file_path
      : `file://${score.chunk_file_path}`;
    console.log('[BWS Video Modal] Using video path:', videoPath);

    // Update modal content
    document.getElementById('bws-video-modal-title').textContent = `Rank #${score.rank} - Video Chunk`;
    document.getElementById('bws-video-transcript').textContent = score.chunk_text || 'No transcript available';
    document.getElementById('bws-video-time').textContent = `⏱️ ${formatTimestamp(score.start_time)} - ${formatTimestamp(score.end_time)}`;
    document.getElementById('bws-video-score').textContent = `📊 Score: ${score.score_counting > 0 ? '+' : ''}${score.score_counting} (Best: ${score.num_best}, Worst: ${score.num_worst})`;

    // Set video source directly on video element
    const videoPlayer = document.getElementById('bws-video-player');
    videoPlayer.src = videoPath;

    // Show modal
    document.getElementById('bws-video-modal').style.display = 'flex';

    // Auto-play with muted trick to avoid browser restrictions
    videoPlayer.muted = true;
    try {
      await videoPlayer.play();
      videoPlayer.muted = false;
      console.log('[BWS Video Modal] Video loaded and playing');
    } catch (error) {
      console.error('[BWS Video Modal] Autoplay failed:', error);
      videoPlayer.muted = false;
    }

    videoPlayer.addEventListener('error', (e) => {
      console.error('[BWS Video Modal] Video load error:', e);
      console.error('[BWS Video Modal] Error details:', videoPlayer.error);
      showNotification('Failed to load video', 'error');
    }, { once: true });

  } catch (error) {
    console.error('Error opening video modal:', error);
    showNotification('Failed to load video', 'error');
  }
}

/**
 * Close video modal
 */
function closeBWSVideoModal() {
  const videoPlayer = document.getElementById('bws-video-player');
  videoPlayer.pause();
  document.getElementById('bws-video-modal').style.display = 'none';
}

// Make globally accessible for onclick
window.closeBWSVideoModal = closeBWSVideoModal;

/**
 * Setup BWS export buttons
 */
function setupBWSExportButtons(experimentId, experiment, scores) {
  // CSV Export
  document.getElementById('bws-export-csv').onclick = () => {
    exportBWSToCSV(experiment, scores);
  };

  // JSON Export
  document.getElementById('bws-export-json').onclick = () => {
    exportBWSToJSON(experiment, scores);
  };
}

/**
 * Export BWS results to CSV
 */
function exportBWSToCSV(experiment, scores) {
  const headers = ['Rank', 'Item Type', 'Content', 'Score', 'Best Count', 'Worst Count', 'Appearance Count'];

  const rows = scores.map((score, index) => {
    const rank = index + 1;
    const isComment = score.comment_text != null;
    const content = isComment ? score.comment_text : score.chunk_text;
    const cleanContent = (content || '').replace(/"/g, '""'); // Escape quotes

    return [
      rank,
      isComment ? 'Comment' : 'Video Chunk',
      `"${cleanContent}"`,
      score.score_counting || 0,
      score.num_best || 0,
      score.num_worst || 0,
      score.num_appearances || 0
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${experiment.name}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showNotification('CSV exported successfully', 'success');
}

/**
 * Export BWS results to JSON
 */
function exportBWSToJSON(experiment, scores) {
  const exportData = {
    experiment: {
      name: experiment.name,
      research_intent: experiment.research_intent,
      scoring_method: experiment.scoring_method,
      rater_type: experiment.rater_type,
      created_at: experiment.created_at,
      completed_at: experiment.completed_at
    },
    results: scores.map((score, index) => {
      const isComment = score.comment_text != null;
      return {
        rank: index + 1,
        item_id: score.item_id,
        item_type: isComment ? 'comment' : 'video_chunk',
        content: isComment ? score.comment_text : score.chunk_text,
        score: score.score_counting,
        best_count: score.num_best,
        worst_count: score.num_worst,
        appearance_count: score.num_appearances,
        author: isComment ? score.author_name : null,
        start_time: !isComment ? score.start_time : null,
        end_time: !isComment ? score.end_time : null
      };
    })
  };

  const json = JSON.stringify(exportData, null, 2);

  // Download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${experiment.name}-results.json`;
  a.click();
  URL.revokeObjectURL(url);

  showNotification('JSON exported successfully', 'success');
}

/**
 * Delete BWS experiment
 */
async function deleteBWSExperiment(experimentId) {
  if (!confirm('Are you sure you want to delete this BWS experiment? This cannot be undone.')) {
    return;
  }

  try {
    const result = await window.api.bws.deleteExperiment({ experimentId });

    if (result.success) {
      showNotification('BWS experiment deleted', 'success');
      await loadBWSExperiments();
    } else {
      showNotification(`Failed to delete: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error deleting BWS experiment:', error);
    showNotification('Failed to delete BWS experiment', 'error');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBWS);
} else {
  initializeBWS();
}

// ============================================
// BWS LIVE VIEWER - SCROLLABLE LIST VIEW
// Phase 1A: Inline Integration
// ============================================

let bwsListViewState = {
  currentFilter: 'all',
  blindMode: false,
  autoRefresh: true,
  refreshInterval: null,
  currentExperimentId: null
};

/**
 * Initialize BWS List View
 *
 * @deprecated - DISABLED: Causes video player limit errors (2320 videos at once)
 * Now using single-tuple browser instead (shows 4 videos at a time)
 */
function initializeBWSListView(experimentId) {
  console.log('[initializeBWSListView] SKIPPED - Using single-tuple browser to avoid video limit errors');
  return;

  // OLD CODE - Disabled because showing all 580 tuples = 2320 video elements
  // This hits browser limit: "[Intervention] Blocked attempt to create WebMediaPlayer"
  //
  // bwsListViewState.currentExperimentId = experimentId;
  // setupListViewListeners();
  // loadBWSList();
  // if (bwsListViewState.autoRefresh) {
  //   startAutoRefresh();
  // }
}

/**
 * Setup event listeners for list view controls
 */
function setupListViewListeners() {
  // Filter dropdown
  const filterSelect = document.getElementById('bws-filter-mode');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      bwsListViewState.currentFilter = e.target.value;
      loadBWSList();
    });
  }
  
  // Blind mode toggle
  const blindModeCheckbox = document.getElementById('bws-blind-mode');
  const blindModeLabel = document.getElementById('bws-blind-mode-label');
  if (blindModeCheckbox) {
    blindModeCheckbox.addEventListener('change', (e) => {
      bwsListViewState.blindMode = e.target.checked;
      
      // Update label
      if (blindModeLabel) {
        blindModeLabel.textContent = e.target.checked ? '🙈 Blind Mode: ON' : '👁 Blind Mode: OFF';
      }
      
      // Toggle class on container
      const ratingInterface = document.getElementById('bws-rating-interface');
      if (ratingInterface) {
        ratingInterface.classList.toggle('blind-mode-active', e.target.checked);
      }
      
      // Reload list to apply blind mode
      loadBWSList();
    });
  }
  
  // Auto-refresh toggle
  const autoRefreshCheckbox = document.getElementById('bws-auto-refresh');
  if (autoRefreshCheckbox) {
    autoRefreshCheckbox.addEventListener('change', (e) => {
      bwsListViewState.autoRefresh = e.target.checked;
      
      if (e.target.checked) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });
  }
}

/**
 * Load and display BWS tuple list
 */
async function loadBWSList() {
  const listView = document.getElementById('bws-list-view');
  if (!listView) return;
  
  // Show loading state
  listView.innerHTML = '<div class="bws-list-loading"><div class="spinner"></div><p>Loading tuples...</p></div>';
  
  try {
    const experimentId = bwsListViewState.currentExperimentId || bwsRatingState.experimentId;
    
    // Get all tuples for this experiment
    const tuples = await window.api.bws.getAllTuples({ experimentId });
    
    // Get AI judgments
    const aiJudgments = await window.api.bws.getJudgments({
      experimentId,
      raterType: 'ai'
    });
    
    // Get human judgments for current rater
    const humanJudgments = await window.api.bws.getJudgments({
      experimentId,
      raterType: 'human',
      raterId: bwsRatingState.raterId || 'default-rater'
    });
    
    // Build judgment maps
    const aiJudgmentMap = new Map();
    aiJudgments.forEach(j => aiJudgmentMap.set(j.tuple_id, j));
    
    const humanJudgmentMap = new Map();
    humanJudgments.forEach(j => humanJudgmentMap.set(j.tuple_id, j));
    
    // Filter tuples based on current filter
    let filteredTuples = tuples;
    
    if (bwsListViewState.currentFilter === 'ai-rated') {
      filteredTuples = tuples.filter(t => aiJudgmentMap.has(t.id));
    } else if (bwsListViewState.currentFilter === 'human-rated') {
      filteredTuples = tuples.filter(t => humanJudgmentMap.has(t.id));
    } else if (bwsListViewState.currentFilter === 'unrated') {
      filteredTuples = tuples.filter(t => !aiJudgmentMap.has(t.id) && !humanJudgmentMap.has(t.id));
    }
    
    // Render tuples
    if (filteredTuples.length === 0) {
      listView.innerHTML = `
        <div class="bws-empty-state">
          <div class="bws-empty-state-icon">📭</div>
          <div class="bws-empty-state-text">No tuples found</div>
          <div class="bws-empty-state-subtext">Try changing the filter or create a BWS experiment</div>
        </div>
      `;
      return;
    }
    
    // Build HTML for all tuples
    const tuplesHTML = filteredTuples.map(tuple => {
      const aiJudgment = aiJudgmentMap.get(tuple.id);
      const humanJudgment = humanJudgmentMap.get(tuple.id);
      
      return renderTupleCard(tuple, aiJudgment, humanJudgment);
    }).join('');
    
    listView.innerHTML = tuplesHTML;
    
    // Setup individual tuple card listeners
    setupTupleCardListeners();
    
  } catch (error) {
    console.error('[loadBWSList] Error loading list:', error);
    listView.innerHTML = `
      <div class="bws-empty-state">
        <div class="bws-empty-state-icon">⚠️</div>
        <div class="bws-empty-state-text">Error loading tuples</div>
        <div class="bws-empty-state-subtext">${error.message}</div>
      </div>
    `;
  }
}

/**
 * Render a single tuple card
 */
function renderTupleCard(tuple, aiJudgment, humanJudgment) {
  // Determine status
  let status = 'unrated';
  let statusLabel = '⚪ Not rated';
  
  if (aiJudgment && humanJudgment) {
    status = 'both';
    statusLabel = '✅ AI + Human';
  } else if (aiJudgment) {
    status = 'ai';
    const timeAgo = getTimeAgo(aiJudgment.created_at);
    statusLabel = `🤖 AI (${timeAgo})`;
  } else if (humanJudgment) {
    status = 'human';
    const timeAgo = getTimeAgo(humanJudgment.created_at);
    statusLabel = `👤 Human (${timeAgo})`;
  }
  
  // Build items HTML
  const itemsHTML = tuple.items.map((item, index) => {
    let highlightClass = '';
    let badgeHTML = '';
    
    // AI highlights (unless blind mode)
    if (!bwsListViewState.blindMode && aiJudgment) {
      if (item.id === aiJudgment.best_item_id) {
        highlightClass = 'ai-best';
        badgeHTML = '<div class="bws-judgment-badge badge-best">✓ BEST (AI)</div>';
      } else if (item.id === aiJudgment.worst_item_id) {
        highlightClass = 'ai-worst';
        badgeHTML = '<div class="bws-judgment-badge badge-worst">✗ WORST (AI)</div>';
      }
    }
    
    // Human highlights
    if (humanJudgment) {
      if (item.id === humanJudgment.best_item_id) {
        highlightClass += ' human-best';
        badgeHTML += '<div class="bws-judgment-badge badge-best badge-human">✓ BEST (You)</div>';
      } else if (item.id === humanJudgment.worst_item_id) {
        highlightClass += ' human-worst';
        badgeHTML += '<div class="bws-judgment-badge badge-worst badge-human">✗ WORST (You)</div>';
      }
    }
    
    const isVideo = item.item_type === 'video_chunk';
    const content = isVideo 
      ? `<video src="${item.file_path}" muted loop></video>`
      : `<div class="bws-tuple-item-text">${item.text || 'No content'}</div>`;
    
    return `
      <div class="bws-tuple-item ${highlightClass}" data-item-id="${item.id}">
        ${badgeHTML}
        ${content}
      </div>
    `;
  }).join('');
  
  // AI reasoning (unless blind mode)
  let reasoningHTML = '';
  if (!bwsListViewState.blindMode && aiJudgment && aiJudgment.reasoning) {
    reasoningHTML = `
      <div class="bws-ai-reasoning">
        <div class="bws-ai-reasoning-label">🤖 AI Reasoning:</div>
        <div class="bws-ai-reasoning-text">${aiJudgment.reasoning}</div>
      </div>
    `;
  }
  
  // Agreement indicator (if both AI and human rated)
  let agreementHTML = '';
  if (aiJudgment && humanJudgment) {
    const bestAgree = aiJudgment.best_item_id === humanJudgment.best_item_id;
    const worstAgree = aiJudgment.worst_item_id === humanJudgment.worst_item_id;
    const agreementPct = (bestAgree && worstAgree) ? 100 : (bestAgree || worstAgree) ? 50 : 0;
    
    const agreementClass = `agreement-${agreementPct}`;
    const agreementIcon = agreementPct === 100 ? '✅' : agreementPct === 50 ? '⚠️' : '❌';
    const agreementText = agreementPct === 100 ? 'Perfect Agreement' : 
                         agreementPct === 50 ? 'Partial Agreement' : 
                         'Disagreement';
    
    agreementHTML = `
      <div class="bws-agreement-indicator ${agreementClass}">
        ${agreementIcon} ${agreementText} (${agreementPct}%)
      </div>
    `;
  }
  
  // Action buttons
  const actionButtonsHTML = !humanJudgment ? `
    <div class="bws-tuple-actions">
      <button class="bws-tuple-btn btn-primary" onclick="rateTupleFromList(${tuple.id})">
        ▶ Rate This Tuple
      </button>
    </div>
  ` : '';
  
  return `
    <div class="bws-tuple-card" data-tuple-id="${tuple.id}">
      <div class="bws-tuple-header">
        <div class="bws-tuple-number">Tuple #${tuple.id}</div>
        <div class="bws-tuple-status status-${status}">${statusLabel}</div>
      </div>
      
      <div class="bws-tuple-items">
        ${itemsHTML}
      </div>
      
      ${reasoningHTML}
      ${agreementHTML}
      ${actionButtonsHTML}
    </div>
  `;
}

/**
 * Get time ago string from ISO timestamp
 */
function getTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now - then) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Setup listeners for tuple cards (video hover play, etc.)
 */
function setupTupleCardListeners() {
  // Play videos on hover
  document.querySelectorAll('.bws-tuple-item video').forEach(video => {
    video.addEventListener('mouseenter', () => {
      video.play();
    });
    
    video.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });
  });
}

/**
 * Rate a specific tuple from the list
 */
async function rateTupleFromList(tupleId) {
  // Hide list view, show single rating view
  document.getElementById('bws-list-view').style.display = 'none';
  document.getElementById('bws-single-rating-view').style.display = 'block';
  
  // Load the tuple for rating
  const tupleWithItems = await window.api.bws.getTupleWithItems({ tupleId });
  
  // Set current tuple data
  bwsRatingState.currentTuple = tupleWithItems;
  bwsRatingState.currentTupleData = tupleWithItems;
  
  // Render the tuple for rating (reuse existing function)
  renderBWSTuple(tupleWithItems.items);
  
  // Reset selections
  bwsRatingState.selectedBest = null;
  bwsRatingState.selectedWorst = null;
  updateSubmitButton();
}

/**
 * Return to list view after rating
 */
function returnToListView() {
  document.getElementById('bws-single-rating-view').style.display = 'none';
  document.getElementById('bws-list-view').style.display = 'block';
  
  // Reload list to show new rating
  loadBWSList();
}

/**
 * Start auto-refresh polling
 */
function startAutoRefresh() {
  if (bwsListViewState.refreshInterval) {
    clearInterval(bwsListViewState.refreshInterval);
  }
  
  bwsListViewState.refreshInterval = setInterval(() => {
    if (bwsListViewState.autoRefresh && bwsListViewState.currentExperimentId) {
      loadBWSList();
    }
  }, 2000); // Refresh every 2 seconds
  
  console.log('[BWS List View] Auto-refresh started');
}

/**
 * Stop auto-refresh polling
 */
function stopAutoRefresh() {
  if (bwsListViewState.refreshInterval) {
    clearInterval(bwsListViewState.refreshInterval);
    bwsListViewState.refreshInterval = null;
  }
  
  console.log('[BWS List View] Auto-refresh stopped');
}

/**
 * Cleanup when leaving BWS interface
 */
function cleanupBWSListView() {
  stopAutoRefresh();
  bwsListViewState = {
    currentFilter: 'all',
    blindMode: false,
    autoRefresh: true,
    refreshInterval: null,
    currentExperimentId: null
  };
}

