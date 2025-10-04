/**
 * BWS Tuple Generator Service
 *
 * Generates item comparison sets (tuples) for Best-Worst Scaling experiments.
 *
 * Design Methods:
 * - Random: Simple random sampling (fast, may have imbalanced coverage)
 * - Balanced: Ensures each item appears approximately equal times
 * - MaxDiff: Maximizes information gain (future implementation)
 */

class BwsTupleGenerator {
  /**
   * Generate tuples for a BWS experiment
   *
   * @param {Array} items - Array of item IDs to compare
   * @param {Object} config - Configuration object
   * @param {number} config.tupleSize - Number of items per tuple (2-5)
   * @param {number} config.targetAppearances - Target times each item should appear (default: 3-5)
   * @param {string} config.method - Generation method: 'random', 'balanced', 'maxdiff'
   * @param {Object} config.itemVideoMap - Optional map of item_id -> video_id for diversity constraint
   * @returns {Array<Array<number>>} - Array of tuples, each tuple is an array of item IDs
   */
  static generateTuples(items, config = {}) {
    const {
      tupleSize = 3,
      targetAppearances = 4,
      method = 'random',
      itemVideoMap = null
    } = config;

    // Validation
    if (!items || items.length === 0) {
      throw new Error('Items array cannot be empty');
    }

    if (tupleSize < 2 || tupleSize > 5) {
      throw new Error('Tuple size must be between 2 and 5');
    }

    if (tupleSize > items.length) {
      throw new Error(`Tuple size (${tupleSize}) cannot exceed number of items (${items.length})`);
    }

    // Select generation method
    switch (method) {
      case 'random':
        return this.generateRandomTuples(items, tupleSize, targetAppearances, itemVideoMap);
      case 'balanced':
        return this.generateBalancedTuples(items, tupleSize, targetAppearances, itemVideoMap);
      case 'maxdiff':
        // Future implementation - falls back to balanced for now
        console.warn('MaxDiff not yet implemented, using balanced method');
        return this.generateBalancedTuples(items, tupleSize, targetAppearances, itemVideoMap);
      default:
        throw new Error(`Unknown generation method: ${method}`);
    }
  }

  /**
   * Random tuple generation
   * Fast but may result in uneven item coverage
   */
  static generateRandomTuples(items, tupleSize, targetAppearances, itemVideoMap = null) {
    const numItems = items.length;
    const totalTuples = Math.ceil((numItems * targetAppearances) / tupleSize);
    const tuples = [];
    const maxAttemptsPerTuple = 100;

    for (let i = 0; i < totalTuples; i++) {
      let tuple = null;
      let attempts = 0;

      // Try to generate a diverse tuple (if video mapping provided)
      while (attempts < maxAttemptsPerTuple) {
        const candidate = this.sampleWithoutReplacement(items, tupleSize);

        // If no video map, accept any tuple
        if (!itemVideoMap) {
          tuple = candidate;
          break;
        }

        // Check if tuple has diverse videos
        if (this.hasDiverseVideos(candidate, itemVideoMap)) {
          tuple = candidate;
          break;
        }

        attempts++;
      }

      // If we couldn't find a diverse tuple after max attempts, accept last candidate
      if (!tuple) {
        tuple = this.sampleWithoutReplacement(items, tupleSize);
      }

      tuples.push(tuple);
    }

    return tuples;
  }

  /**
   * Balanced tuple generation
   * Ensures each item appears approximately the same number of times
   */
  static generateBalancedTuples(items, tupleSize, targetAppearances, itemVideoMap = null) {
    const numItems = items.length;
    const tuples = [];
    const appearanceCounts = new Map();

    // Initialize appearance counts
    items.forEach(item => appearanceCounts.set(item, 0));

    // Calculate target total tuples
    const targetTuples = Math.ceil((numItems * targetAppearances) / tupleSize);

    let attempts = 0;
    const maxAttempts = targetTuples * 20; // Prevent infinite loops (increased for diversity constraint)
    let diversityFailures = 0;

    while (tuples.length < targetTuples && attempts < maxAttempts) {
      attempts++;

      // Select items that have appeared least
      const sortedItems = [...items].sort((a, b) =>
        appearanceCounts.get(a) - appearanceCounts.get(b)
      );

      // Take tupleSize items with lowest appearance counts
      // Add some randomness to avoid always picking the same order
      const candidatePoolSize = Math.min(tupleSize * 3, sortedItems.length);
      const candidates = sortedItems.slice(0, candidatePoolSize);

      // Try multiple times to get a diverse tuple
      let tuple = null;
      let diversityAttempts = 0;
      const maxDiversityAttempts = 50;

      while (diversityAttempts < maxDiversityAttempts) {
        const candidateTuple = this.sampleWithoutReplacement(candidates, tupleSize);

        // If no video map or tuple is diverse, accept it
        if (!itemVideoMap || this.hasDiverseVideos(candidateTuple, itemVideoMap)) {
          tuple = candidateTuple;
          break;
        }

        diversityAttempts++;
      }

      // If we couldn't find a diverse tuple, accept a non-diverse one
      if (!tuple) {
        tuple = this.sampleWithoutReplacement(candidates, tupleSize);
        diversityFailures++;
      }

      // Check for duplicate tuples
      if (!this.containsTuple(tuples, tuple)) {
        tuples.push(tuple);

        // Update appearance counts
        tuple.forEach(item => {
          appearanceCounts.set(item, appearanceCounts.get(item) + 1);
        });
      }
    }

    // Log balance statistics
    const appearances = Array.from(appearanceCounts.values());
    const minAppearances = Math.min(...appearances);
    const maxAppearances = Math.max(...appearances);
    const avgAppearances = appearances.reduce((a, b) => a + b, 0) / appearances.length;

    console.log(`[BWS Tuple Generator] Balanced generation complete:`);
    console.log(`  Total tuples: ${tuples.length}`);
    console.log(`  Items: ${numItems}`);
    console.log(`  Appearances: min=${minAppearances}, max=${maxAppearances}, avg=${avgAppearances.toFixed(1)}`);

    if (itemVideoMap) {
      const diverseTuples = tuples.filter(t => this.hasDiverseVideos(t, itemVideoMap)).length;
      const diversityRate = (diverseTuples / tuples.length * 100).toFixed(1);
      console.log(`  Video diversity: ${diverseTuples}/${tuples.length} tuples (${diversityRate}%) have all different videos`);
      if (diversityFailures > 0) {
        console.log(`  Note: ${diversityFailures} tuples had to accept same-video chunks due to constraints`);
      }
    }

    return tuples;
  }

  /**
   * Check if a tuple has items from diverse videos (no two items from same video)
   * @param {Array} tuple - Array of item IDs
   * @param {Object} itemVideoMap - Map of item_id -> video_id
   * @returns {boolean} - True if all items are from different videos
   */
  static hasDiverseVideos(tuple, itemVideoMap) {
    if (!itemVideoMap) return true;

    const videoIds = tuple.map(itemId => itemVideoMap[itemId]).filter(v => v !== undefined);

    // Check if all video IDs are unique
    const uniqueVideoIds = new Set(videoIds);
    return uniqueVideoIds.size === videoIds.length;
  }

  /**
   * Sample n items from array without replacement
   */
  static sampleWithoutReplacement(array, n) {
    const shuffled = [...array];

    // Fisher-Yates shuffle for first n elements
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (shuffled.length - i));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, n);
  }

  /**
   * Check if tuples array contains a tuple (order-independent)
   */
  static containsTuple(tuples, tuple) {
    const tupleSet = new Set(tuple);

    return tuples.some(existingTuple => {
      if (existingTuple.length !== tuple.length) return false;
      return existingTuple.every(item => tupleSet.has(item));
    });
  }

  /**
   * Validate generated tuples
   * Checks for duplicates and coverage
   */
  static validateTuples(tuples, items, tupleSize) {
    const issues = [];

    // Check tuple sizes
    const invalidSizes = tuples.filter(t => t.length !== tupleSize);
    if (invalidSizes.length > 0) {
      issues.push(`${invalidSizes.length} tuples have incorrect size`);
    }

    // Check for duplicates within tuples
    const dupesWithin = tuples.filter(t => new Set(t).size !== t.length);
    if (dupesWithin.length > 0) {
      issues.push(`${dupesWithin.length} tuples contain duplicate items`);
    }

    // Check for duplicate tuples
    const uniqueTuples = new Set(tuples.map(t => JSON.stringify([...t].sort())));
    if (uniqueTuples.size !== tuples.length) {
      issues.push(`${tuples.length - uniqueTuples.size} duplicate tuples found`);
    }

    // Check coverage (all items appear at least once)
    const appearedItems = new Set(tuples.flat());
    const missingItems = items.filter(item => !appearedItems.has(item));
    if (missingItems.length > 0) {
      issues.push(`${missingItems.length} items never appear in any tuple`);
    }

    // Calculate appearance statistics
    const appearanceCounts = new Map();
    items.forEach(item => appearanceCounts.set(item, 0));
    tuples.flat().forEach(item => {
      appearanceCounts.set(item, (appearanceCounts.get(item) || 0) + 1);
    });

    const appearances = Array.from(appearanceCounts.values());
    const minAppearances = Math.min(...appearances);
    const maxAppearances = Math.max(...appearances);
    const avgAppearances = appearances.reduce((a, b) => a + b, 0) / appearances.length;

    return {
      valid: issues.length === 0,
      issues,
      statistics: {
        totalTuples: tuples.length,
        totalItems: items.length,
        minAppearances,
        maxAppearances,
        avgAppearances: Math.round(avgAppearances * 10) / 10,
        coverage: ((items.length - missingItems.length) / items.length * 100).toFixed(1) + '%'
      }
    };
  }

  /**
   * Estimate optimal tuple count given items and appearances
   */
  static estimateTupleCount(numItems, tupleSize, targetAppearances) {
    return Math.ceil((numItems * targetAppearances) / tupleSize);
  }

  /**
   * Calculate expected appearances per item
   */
  static calculateExpectedAppearances(numItems, numTuples, tupleSize) {
    return (numTuples * tupleSize) / numItems;
  }
}

module.exports = BwsTupleGenerator;
