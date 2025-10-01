/**
 * BWS (Best-Worst Scaling) Manager
 * Handles UI logic for creating and managing BWS experiments
 */

let bwsState = {
  selectedProjectId: null,
  selectedProjectData: null,
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

  // Rating project selection
  const projectSelect = document.getElementById('bws-rating-project-select');
  if (projectSelect) {
    projectSelect.addEventListener('change', onBWSProjectSelect);
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

  // Hide sections initially
  document.getElementById('bws-project-info').style.display = 'none';
  document.getElementById('bws-filter-section').style.display = 'none';
  document.getElementById('bws-config-section').style.display = 'none';

  // Reset state
  bwsState = {
    selectedProjectId: null,
    selectedProjectData: null,
    filteredItemCount: 0
  };

  // Load available rating projects
  await loadBWSRatingProjects();

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
    document.getElementById('bws-project-info').style.display = 'none';
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

  // Display project info
  document.getElementById('bws-selected-project-name').textContent = projectData.project_name;
  document.getElementById('bws-total-items').textContent = projectData.total_items;

  // Determine item type from project (assume it's in the name or we need to query)
  document.getElementById('bws-item-type').textContent = 'Mixed (comments + video chunks)';

  // Show project info and filter section
  document.getElementById('bws-project-info').style.display = 'block';
  document.getElementById('bws-filter-section').style.display = 'block';

  // Calculate filtered count
  await updateBWSFilteredCount();

  validateBWSForm();
}

/**
 * Update filtered item count based on score threshold
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
  const hasProject = bwsState.selectedProjectId !== null;
  const hasEnoughItems = bwsState.filteredItemCount >= 2;

  const isValid = hasProject && hasEnoughItems && name.length > 0 && intent.length > 0;

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
      rating_project_id: bwsState.selectedProjectId,
      tuple_size: parseInt(document.getElementById('bws-tuple-size').value),
      target_appearances: parseInt(document.getElementById('bws-target-appearances').value),
      design_method: document.getElementById('bws-design-method').value,
      scoring_method: document.getElementById('bws-scoring-method').value,
      rater_type: document.getElementById('bws-rater-type').value,
      research_intent: document.getElementById('bws-research-intent').value.trim(),
      min_score: parseFloat(document.getElementById('bws-min-score').value)
    };

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
          `<button class="btn btn-sm btn-primary" onclick="startBWSRating(${exp.id})">Start Rating</button>` :
          `<button class="btn btn-sm btn-secondary" onclick="viewBWSResults(${exp.id})">View Results</button>
           ${exp.status === 'completed' && exp.rater_type === 'ai' ?
             `<button class="btn btn-sm btn-primary" onclick="addHumanRatingsToExperiment(${exp.id})" title="Add human ratings to this experiment">
               👤 Add Human Ratings
             </button>` : ''
           }`
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
 * Start AI BWS Rating
 */
async function startAIBWSRating(experimentId, experiment) {
  try {
    // Show confirmation
    const confirmed = confirm(`Start AI rating for "${experiment.name}"?\n\nThis will process ${experiment.total_tuples} comparisons using Gemini AI.`);
    if (!confirmed) return;

    // Store current experiment ID for progress tracking
    window.currentAIRatingExperimentId = experimentId;

    // Setup progress listeners (also shows overlay)
    setupAIBWSProgressListeners();

    // Initialize progress display
    const totalTuples = experiment.total_tuples || 0;
    const alreadyCompleted = experiment.total_judgments || 0;
    document.getElementById('bws-ai-progress-count').textContent = `${alreadyCompleted} / ${totalTuples}`;
    document.getElementById('bws-ai-progress-percentage').textContent = `${Math.round((alreadyCompleted / totalTuples) * 100)}%`;
    document.getElementById('bws-ai-progress-fill').style.width = `${(alreadyCompleted / totalTuples) * 100}%`;
    document.getElementById('bws-ai-progress-text').textContent = `Processing ${totalTuples} comparisons with Gemini AI...`;

    // Start AI rating (runs in background)
    const result = await window.api.bws.startAIRating({ experimentId });

    if (!result.success) {
      // Hide overlay on error
      document.getElementById('bws-ai-progress-overlay').style.display = 'none';
      showNotification(`AI rating failed: ${result.error}`, 'error');
      window.currentAIRatingExperimentId = null;
    }

  } catch (error) {
    console.error('Error starting AI BWS rating:', error);
    // Hide overlay on error
    document.getElementById('bws-ai-progress-overlay').style.display = 'none';
    showNotification('Failed to start AI rating', 'error');
    window.currentAIRatingExperimentId = null;
  }
}

/**
 * Add human ratings to a completed AI experiment
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
      ? `Add human ratings to "${experiment.name}"?\n\nYou've already completed ${humanJudgments}/${totalTuples} comparisons.\n${remaining} remaining.`
      : `Add human ratings to "${experiment.name}"?\n\nThis will let you rate the same ${totalTuples} comparisons that AI completed.\nYour ratings will be combined for multi-rater analysis.`;

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
 * Start Human BWS Rating
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
      raterType: 'human'
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

    // Load first tuple (filtered by rater)
    await loadNextBWSTuple();

  } catch (error) {
    console.error('Error starting human BWS rating:', error);
    showNotification('Failed to start rating interface', 'error');
  }
}

/**
 * Setup AI BWS progress listeners
 */
function setupAIBWSProgressListeners() {
  // Remove old listeners
  window.api.removeAllListeners('bws:ai-progress');
  window.api.removeAllListeners('bws:ai-item-rated');
  window.api.removeAllListeners('bws:ai-complete');
  window.api.removeAllListeners('bws:ai-error');

  // Show progress overlay
  document.getElementById('bws-ai-progress-overlay').style.display = 'flex';

  // Close button for overlay
  const closeBtn = document.getElementById('bws-ai-progress-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      document.getElementById('bws-ai-progress-overlay').style.display = 'none';
    };
  }

  // Progress updates
  window.api.on('bws:ai-progress', (data) => {
    console.log(`[BWS AI Progress] ${data.current}/${data.total} (${data.percentage}%)`);

    // Update progress overlay
    document.getElementById('bws-ai-progress-count').textContent = `${data.current} / ${data.total}`;
    document.getElementById('bws-ai-progress-percentage').textContent = `${data.percentage}%`;
    document.getElementById('bws-ai-progress-fill').style.width = `${data.percentage}%`;

    // Update experiment card in gallery
    updateExperimentCardProgress(data);
  });

  // Item rated
  window.api.on('bws:ai-item-rated', (data) => {
    console.log(`[BWS AI] Tuple ${data.tupleId} rated - Best: ${data.best}, Worst: ${data.worst}`);

    // Show latest result
    const latestDiv = document.getElementById('bws-ai-latest-result');
    const latestText = document.getElementById('bws-ai-latest-text');

    if (latestDiv && latestText) {
      latestDiv.style.display = 'block';
      latestText.textContent = `Best: Item ${data.best + 1}, Worst: Item ${data.worst + 1} - ${data.reasoning?.substring(0, 150) || 'Processing...'}`;
    }
  });

  // Completion
  window.api.on('bws:ai-complete', async (data) => {
    console.log(`[BWS AI Complete] ${data.scoresCount} items ranked`);

    // Hide progress overlay
    document.getElementById('bws-ai-progress-overlay').style.display = 'none';

    showNotification(`AI rating complete! ${data.scoresCount} items ranked.`, 'success');

    // Clear current experiment ID
    window.currentAIRatingExperimentId = null;

    // Reload experiments to show updated status
    await loadBWSExperiments();
  });

  // Errors
  window.api.on('bws:ai-error', (data) => {
    console.error(`[BWS AI Error] Tuple ${data.tupleId}:`, data.error);
  });
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
    document.getElementById('bws-rating-skip-btn').addEventListener('click', loadNextBWSTuple);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', handleRatingKeyboard);
}

/**
 * Load next BWS tuple
 */
async function loadNextBWSTuple() {
  try {
    // Pause all videos from previous tuple
    pauseAllBWSVideos();

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
 * Render BWS item cards
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
    // Stagger by 100ms each to avoid overwhelming decoder
    setTimeout(() => {
      video.play().catch(err => {
        console.error(`Failed to auto-play video ${index}:`, err);
        // Fallback: show play button overlay
        const container = video.closest('.bws-video-container');
        if (container) {
          container.classList.add('needs-interaction');
        }
      });

      // All videos start muted (hover for audio)
      video.muted = true;
    }, index * 100);
  });

  // Setup hover interactions for audio
  setupVideoHoverInteractions();

  // Setup progress bar updates
  setupVideoProgressBars();
}

/**
 * Setup hover interactions for video cards
 */
function setupVideoHoverInteractions() {
  const videoContainers = document.querySelectorAll('.bws-video-container');

  videoContainers.forEach((container, index) => {
    const video = container.querySelector('.bws-video-player');

    // Hover = enlarge + audio
    container.addEventListener('mouseenter', () => {
      container.style.transform = 'scale(1.15)';
      container.style.zIndex = '10';

      // Unmute this video, mute others
      document.querySelectorAll('.bws-video-player').forEach(v => v.muted = true);
      video.muted = false;

      // Update button states
      updateAudioButtonStates(index);
    });

    container.addEventListener('mouseleave', () => {
      container.style.transform = 'scale(1)';
      container.style.zIndex = '1';
      video.muted = true;

      // Reset button states
      updateAudioButtonStates(-1);
    });

    // Click = open full-size modal
    container.addEventListener('click', () => {
      openVideoDetailModal(index);
    });
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

    // Load next tuple
    await loadNextBWSTuple();

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
