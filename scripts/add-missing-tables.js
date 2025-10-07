#!/usr/bin/env node
/**
 * Comprehensive Database Migration Script
 *
 * This script ensures all necessary database tables and columns exist
 * by running all migration scripts in the correct order.
 *
 * It's safe to run multiple times (idempotent).
 *
 * Usage: node scripts/add-missing-tables.js
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('='.repeat(80));
console.log('  DATABASE MIGRATION: Ensuring All Tables Exist');
console.log('='.repeat(80));
console.log();

// Define migrations in dependency order
const migrations = [
  {
    name: 'Collection Management (folders)',
    script: 'migrate-collection-management.js',
    description: 'Creates folders table and adds collection organization support'
  },
  {
    name: 'Hierarchical Rating Projects',
    script: 'add-hierarchical-rating.js',
    description: 'Adds parent_project_id and filter_criteria to rating_projects'
  },
  {
    name: 'PDF Support',
    script: 'add-pdf-support.js',
    description: 'Creates items, pdfs, and pdf_excerpts tables'
  },
  {
    name: 'Best-Worst Scaling (BWS)',
    script: 'add-bws-tables.js',
    description: 'Creates bws_experiments, bws_tuples, bws_judgments, bws_scores tables'
  },
  {
    name: 'Merge Support for Ratings',
    script: 'add-merge-support-to-ratings.js',
    description: 'Adds merge_id support to rating_projects'
  }
];

let successCount = 0;
let failCount = 0;
const errors = [];

// Run each migration
for (const migration of migrations) {
  const scriptPath = path.join(__dirname, migration.script);

  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    console.log(`⚠️  SKIP: ${migration.name}`);
    console.log(`   Script not found: ${migration.script}`);
    console.log();
    continue;
  }

  console.log(`🔄 Running: ${migration.name}`);
  console.log(`   ${migration.description}`);
  console.log(`   Script: ${migration.script}`);
  console.log();

  // Run the migration script
  const result = spawnSync('node', [scriptPath], {
    encoding: 'utf-8',
    stdio: 'inherit'
  });

  if (result.status === 0) {
    successCount++;
    console.log(`✅ SUCCESS: ${migration.name}`);
  } else {
    failCount++;
    errors.push({
      name: migration.name,
      script: migration.script,
      status: result.status,
      error: result.error
    });
    console.log(`❌ FAILED: ${migration.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error.message}`);
    }
  }
  console.log();
}

// Summary
console.log('='.repeat(80));
console.log('  MIGRATION SUMMARY');
console.log('='.repeat(80));
console.log(`Total migrations: ${migrations.length}`);
console.log(`Successful: ${successCount}`);
console.log(`Failed: ${failCount}`);
console.log();

if (errors.length > 0) {
  console.log('❌ The following migrations failed:');
  errors.forEach(err => {
    console.log(`   - ${err.name} (${err.script})`);
    if (err.error) {
      console.log(`     ${err.error.message}`);
    }
  });
  console.log();
  console.log('Please review the errors above and run this script again after fixing them.');
  process.exit(1);
} else {
  console.log('✅ All migrations completed successfully!');
  console.log();
  console.log('Your database is now up to date with all required tables:');
  console.log('  ✓ folders - Collection organization');
  console.log('  ✓ rating_projects (enhanced) - Hierarchical and merged collection support');
  console.log('  ✓ items, pdfs, pdf_excerpts - PDF document support');
  console.log('  ✓ bws_experiments, bws_tuples, bws_judgments, bws_scores - BWS support');
  console.log();
  console.log('Next step: Restart your application to use the updated schema.');
  process.exit(0);
}
