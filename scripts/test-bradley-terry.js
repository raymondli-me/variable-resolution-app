#!/usr/bin/env node
/**
 * Test script for Bradley-Terry scoring
 * Recalculates scores for existing BWS experiments
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Determine database path
const appDataPath = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'vr-collector')
  : process.platform === 'win32'
  ? path.join(process.env.APPDATA, 'vr-collector')
  : path.join(os.homedir(), '.config', 'vr-collector');

const dbPath = path.join(appDataPath, 'collections.db');

console.log(`[BT Test] Database: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[BT Test] Failed to connect:', err);
    process.exit(1);
  }
});

// Promisified database methods
const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

/**
 * Extract pairwise comparisons from BWS judgments
 */
function extractPairwiseComparisons(judgments) {
  const wins = new Map();
  const totals = new Map();

  const pairKey = (id1, id2) => {
    const [a, b] = id1 < id2 ? [id1, id2] : [id2, id1];
    return `${a}_${b}`;
  };

  for (const judgment of judgments) {
    const itemIds = JSON.parse(judgment.item_ids);
    const bestId = judgment.best_item_id;
    const worstId = judgment.worst_item_id;

    // Best beats all others
    for (const otherId of itemIds) {
      if (otherId !== bestId) {
        const key = pairKey(bestId, otherId);
        wins.set(key, (wins.get(key) || 0) + (bestId < otherId ? 1 : 0));
        totals.set(key, (totals.get(key) || 0) + 1);
      }
    }

    // All others beat worst
    for (const otherId of itemIds) {
      if (otherId !== worstId && otherId !== bestId) {
        const key = pairKey(otherId, worstId);
        wins.set(key, (wins.get(key) || 0) + (otherId < worstId ? 1 : 0));
        totals.set(key, (totals.get(key) || 0) + 1);
      }
    }
  }

  return { wins, totals };
}

/**
 * Calculate Bradley-Terry scores
 */
function calculateBradleyTerryScores(itemIds, pairwiseData) {
  const { wins, totals } = pairwiseData;

  const strengths = new Map();
  itemIds.forEach(id => strengths.set(id, 1.0));

  const getWins = (id1, id2) => {
    const key = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
    const w = wins.get(key) || 0;
    const t = totals.get(key) || 0;
    return id1 < id2 ? w : t - w;
  };

  const getTotalComparisons = (id1, id2) => {
    const key = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
    return totals.get(key) || 0;
  };

  const maxIterations = 100;
  const convergenceThreshold = 1e-6;

  for (let iter = 0; iter < maxIterations; iter++) {
    const newStrengths = new Map();
    let maxChange = 0;

    for (const itemId of itemIds) {
      let numerator = 0;
      let denominator = 0;

      for (const opponentId of itemIds) {
        if (itemId !== opponentId) {
          const winsAgainst = getWins(itemId, opponentId);
          const totalGames = getTotalComparisons(itemId, opponentId);

          if (totalGames > 0) {
            numerator += winsAgainst;
            denominator += totalGames / (strengths.get(itemId) + strengths.get(opponentId));
          }
        }
      }

      const newStrength = denominator > 0 ? numerator / denominator : strengths.get(itemId);
      newStrengths.set(itemId, newStrength);

      const change = Math.abs(newStrength - strengths.get(itemId));
      maxChange = Math.max(maxChange, change);
    }

    for (const [id, strength] of newStrengths) {
      strengths.set(id, strength);
    }

    if (maxChange < convergenceThreshold) {
      console.log(`[BT Test] Converged after ${iter + 1} iterations`);
      break;
    }
  }

  // Normalize
  const totalStrength = Array.from(strengths.values()).reduce((sum, s) => sum + s, 0);
  const normalizationFactor = itemIds.length / totalStrength;

  for (const [id, strength] of strengths) {
    strengths.set(id, strength * normalizationFactor);
  }

  // Calculate standard errors
  const stdErrors = new Map();
  for (const itemId of itemIds) {
    let totalComps = 0;
    for (const opponentId of itemIds) {
      if (itemId !== opponentId) {
        totalComps += getTotalComparisons(itemId, opponentId);
      }
    }
    const se = totalComps > 0 ? Math.sqrt(1 / totalComps) : 1.0;
    stdErrors.set(itemId, se);
  }

  const results = new Map();
  for (const itemId of itemIds) {
    results.set(itemId, {
      strength: strengths.get(itemId),
      stdError: stdErrors.get(itemId)
    });
  }

  return results;
}

async function testBradleyTerry() {
  try {
    // Get experiments
    const experiments = await all('SELECT * FROM bws_experiments ORDER BY id');
    console.log(`[BT Test] Found ${experiments.length} experiment(s)\n`);

    for (const experiment of experiments) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Experiment #${experiment.id}: ${experiment.name}`);
      console.log('='.repeat(70));

      // Get judgments
      const judgments = await all(`
        SELECT j.*, t.item_ids
        FROM bws_judgments j
        JOIN bws_tuples t ON j.tuple_id = t.id
        WHERE t.experiment_id = ?
      `, [experiment.id]);

      console.log(`Judgments: ${judgments.length}`);

      if (judgments.length === 0) {
        console.log('No judgments to process.\n');
        continue;
      }

      // Calculate counting scores
      const scores = {};
      for (const judgment of judgments) {
        const itemIds = JSON.parse(judgment.item_ids);

        for (const itemId of itemIds) {
          if (!scores[itemId]) {
            scores[itemId] = {
              item_id: itemId,
              num_appearances: 0,
              num_best: 0,
              num_worst: 0
            };
          }
          scores[itemId].num_appearances++;
        }

        if (scores[judgment.best_item_id]) {
          scores[judgment.best_item_id].num_best++;
        }
        if (scores[judgment.worst_item_id]) {
          scores[judgment.worst_item_id].num_worst++;
        }
      }

      const items = Object.values(scores);
      for (const item of items) {
        item.score_counting = item.num_best - item.num_worst;
      }

      console.log(`Items: ${items.length}\n`);

      // Calculate Bradley-Terry scores
      const itemIds = items.map(item => item.item_id);
      const pairwiseData = extractPairwiseComparisons(judgments);
      const btResults = calculateBradleyTerryScores(itemIds, pairwiseData);

      // Merge results
      for (const item of items) {
        const btResult = btResults.get(item.item_id);
        if (btResult) {
          item.score_bt = btResult.strength;
          const margin = 1.96 * btResult.stdError;
          item.confidence_interval_lower = btResult.strength - margin;
          item.confidence_interval_upper = btResult.strength + margin;
        }
      }

      // Sort by BT score
      items.sort((a, b) => {
        const scoreA = a.score_bt !== undefined ? a.score_bt : a.score_counting;
        const scoreB = b.score_bt !== undefined ? b.score_bt : b.score_counting;
        return scoreB - scoreA;
      });

      items.forEach((item, index) => {
        item.rank = index + 1;
      });

      // Display results
      console.log('Top 10 items:\n');
      console.log('Rank | Item ID | Count  | BT Score | 95% CI             | Appearances | Best | Worst');
      console.log('-'.repeat(90));

      items.slice(0, 10).forEach(item => {
        const countStr = (item.score_counting > 0 ? '+' : '') + item.score_counting.toFixed(0);
        const btStr = item.score_bt?.toFixed(2) || 'N/A';
        const ciStr = item.score_bt
          ? `[${item.confidence_interval_lower.toFixed(2)}, ${item.confidence_interval_upper.toFixed(2)}]`
          : 'N/A';

        console.log(
          `${item.rank.toString().padStart(4)} | ` +
          `${item.item_id.toString().padStart(7)} | ` +
          `${countStr.padStart(6)} | ` +
          `${btStr.padStart(8)} | ` +
          `${ciStr.padEnd(18)} | ` +
          `${item.num_appearances.toString().padStart(11)} | ` +
          `${item.num_best.toString().padStart(4)} | ` +
          `${item.num_worst.toString().padStart(5)}`
        );
      });

      // Update database
      console.log('\n[BT Test] Updating database...');
      await run('DELETE FROM bws_scores WHERE experiment_id = ?', [experiment.id]);

      const sql = `
        INSERT INTO bws_scores (
          experiment_id, item_id, score_counting, score_bt,
          confidence_interval_lower, confidence_interval_upper,
          num_appearances, num_best, num_worst, rank
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const score of items) {
        await run(sql, [
          experiment.id,
          score.item_id,
          score.score_counting,
          score.score_bt || null,
          score.confidence_interval_lower || null,
          score.confidence_interval_upper || null,
          score.num_appearances,
          score.num_best,
          score.num_worst,
          score.rank
        ]);
      }

      console.log(`[BT Test] ✓ Updated ${items.length} scores in database`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Bradley-Terry scoring test complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n[BT Test] Error:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

testBradleyTerry();
