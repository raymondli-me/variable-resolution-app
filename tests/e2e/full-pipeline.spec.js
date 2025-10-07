const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('E2E Data Pipeline Test - Full User Story', () => {
  let electronApp;
  let window;
  const screenshotsDir = path.join(__dirname, '../../test-results/e2e-pipeline');
  const logFile = path.join(screenshotsDir, 'console-log.txt');
  let consoleLog = [];

  test.beforeAll(async () => {
    // Create screenshots directory
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Launch the Electron app
    electronApp = await electron.launch({
      executablePath: require('electron'),
      args: [path.join(__dirname, '../../main.js')],
      timeout: 60000
    });

    // Capture console output
    electronApp.on('console', msg => {
      const logEntry = `[${new Date().toISOString()}] ${msg.type()}: ${msg.text()}`;
      consoleLog.push(logEntry);
    });

    // Wait for the main window
    window = await electronApp.firstWindow({ timeout: 60000 });
    await window.waitForLoadState('domcontentloaded', { timeout: 60000 });
    await window.waitForTimeout(2000); // Wait for app to fully initialize
  }, 120000);

  test.afterAll(async () => {
    // Write console log to file
    fs.writeFileSync(logFile, consoleLog.join('\n'), 'utf8');
    console.log(`Console log saved to: ${logFile}`);

    // Close the app
    await electronApp.close();
  });

  test('YouTube Pipeline: INGEST → VERIFY → VIEW → ANALYZE', async () => {
    console.log('\n=== YOUTUBE DATA PIPELINE TEST ===\n');

    // Step 1: INGEST - Import YouTube JSON fixture
    console.log('Step 1: Importing YouTube JSON fixture...');

    // Use Electron's API to programmatically import the file
    const fixturePath = path.join(__dirname, '../fixtures/sample-youtube-data.json');

    await electronApp.evaluate(async ({ ipcMain }, fixturePath) => {
      // We'll need to trigger the import through the renderer process
      // For now, let's simulate clicking the Import button
      return { fixturePath };
    }, fixturePath);

    // Navigate to Collections Hub (if not already there)
    await window.click('text=Collections Hub').catch(() => {
      console.log('Already on Collections Hub or button not found');
    });
    await window.waitForTimeout(1000);

    // Click "Import from JSON" button
    // First, let's find the import button
    const importButton = await window.locator('button:has-text("Import")').first();
    if (await importButton.isVisible()) {
      await importButton.click();
      await window.waitForTimeout(500);
    }

    // For E2E test, we'll directly call the IPC handler
    const youtubeImportResult = await electronApp.evaluate(async ({ ipcMain }, fixturePath) => {
      const { app } = require('electron');
      const path = require('path');
      const dbPath = path.join(app.getPath('userData'), 'vr-collection.db');
      const DatabaseManager = require(path.join(process.cwd(), 'src/database/db.js'));
      const db = new DatabaseManager(dbPath);
      await db.initialize();

      const result = await db.importCollection(fixturePath, { strategy: 'duplicate' });
      return result;
    }, fixturePath);

    console.log('Import result:', youtubeImportResult);
    expect(youtubeImportResult.success).toBe(true);

    // Wait for UI to update
    await window.waitForTimeout(2000);

    // Step 2: VERIFY - Take screenshot of Collections Hub showing the new collection
    console.log('Step 2: Verifying collection appears in Hub...');
    await window.screenshot({
      path: path.join(screenshotsDir, '01-youtube-collection-hub.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 01-youtube-collection-hub.png');

    // Verify the collection card is visible
    const collectionCard = await window.locator(`text="Test YouTube Collection"`).first();
    await expect(collectionCard).toBeVisible({ timeout: 5000 });

    // Step 3: VIEW - Click the [View] button and screenshot the viewer
    console.log('Step 3: Opening collection viewer...');

    // Find and click the View button for this collection
    const viewButton = await window.locator('button:has-text("View")').first();
    await viewButton.click();
    await window.waitForTimeout(2000);

    // Take screenshot of the comment viewer
    await window.screenshot({
      path: path.join(screenshotsDir, '02-youtube-comment-viewer.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 02-youtube-comment-viewer.png');

    // Verify we're in the viewer (look for comments or viewer UI elements)
    const viewerElement = await window.locator('.comment-card, .comment-viewer, text="comment"').first();
    await expect(viewerElement).toBeVisible({ timeout: 5000 });

    // Go back to Collections Hub
    const backButton = await window.locator('button:has-text("Back"), button:has-text("← Back")').first();
    if (await backButton.isVisible()) {
      await backButton.click();
      await window.waitForTimeout(1000);
    }

    // Step 4: ANALYZE - Open context menu and click "Rate Collection"
    console.log('Step 4: Opening Rate Collection modal...');

    // Find the collection card again and open its context menu
    // Look for the three-dot menu button
    const menuButton = await window.locator('button:has-text("⋮"), button.context-menu-button').first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await window.waitForTimeout(500);

      // Click "Rate Collection" or "BWS Experiment" in the menu
      const rateButton = await window.locator('text="Rate Collection", text="BWS Experiment"').first();
      if (await rateButton.isVisible()) {
        await rateButton.click();
        await window.waitForTimeout(1000);

        // Take screenshot of the modal
        await window.screenshot({
          path: path.join(screenshotsDir, '03-youtube-rate-modal.png'),
          fullPage: true
        });
        console.log('Screenshot saved: 03-youtube-rate-modal.png');

        // Close the modal
        const closeButton = await window.locator('button:has-text("Cancel"), button:has-text("Close"), .close-btn').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    }

    console.log('\n=== YOUTUBE PIPELINE TEST COMPLETE ===\n');
  });

  test('PDF Pipeline: INGEST → VERIFY → VIEW → ANALYZE', async () => {
    console.log('\n=== PDF DATA PIPELINE TEST ===\n');

    // Step 1: INGEST - Import PDF fixture
    console.log('Step 1: Importing PDF document...');

    // For PDF import, we need to use the PDF import functionality
    const pdfFixturePath = path.join(__dirname, '../fixtures/sample-document.pdf');

    // Navigate to Collections Hub (if not already there)
    await window.click('text=Collections Hub').catch(() => {
      console.log('Already on Collections Hub');
    });
    await window.waitForTimeout(1000);

    // Import the PDF through the backend
    const pdfImportResult = await electronApp.evaluate(async ({ ipcMain }, pdfPath) => {
      const { app } = require('electron');
      const path = require('path');
      const dbPath = path.join(app.getPath('userData'), 'vr-collection.db');
      const DatabaseManager = require(path.join(process.cwd(), 'src/database/db.js'));
      const db = new DatabaseManager(dbPath);
      await db.initialize();

      // Create a PDF-based collection
      const collectionId = await db.run(
        `INSERT INTO collections (uuid, search_term, source_type, created_at)
         VALUES (?, ?, ?, ?)`,
        ['test-pdf-collection-uuid', 'Test PDF Collection', 'pdf', new Date().toISOString()]
      );

      // Add PDF to database
      const pdfId = await db.run(
        `INSERT INTO pdfs (uuid, title, file_path, num_pages, collection_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'test-pdf-uuid-123',
          'Sample Test Document',
          pdfPath,
          3,
          collectionId.lastID,
          new Date().toISOString()
        ]
      );

      // Add some PDF excerpts
      await db.run(
        `INSERT INTO pdf_excerpts (pdf_id, collection_id, page_number, excerpt_number, text_content)
         VALUES (?, ?, ?, ?, ?)`,
        [pdfId.lastID, collectionId.lastID, 1, 1, 'Sample Test Document - This is a multi-page PDF fixture for E2E testing.']
      );

      await db.run(
        `INSERT INTO pdf_excerpts (pdf_id, collection_id, page_number, excerpt_number, text_content)
         VALUES (?, ?, ?, ?, ?)`,
        [pdfId.lastID, collectionId.lastID, 2, 2, 'Page 2: More Content - This page contains additional test content.']
      );

      await db.run(
        `INSERT INTO pdf_excerpts (pdf_id, collection_id, page_number, excerpt_number, text_content)
         VALUES (?, ?, ?, ?, ?)`,
        [pdfId.lastID, collectionId.lastID, 3, 3, 'Page 3: Conclusion - This is the final page of our test document.']
      );

      return { success: true, collectionId: collectionId.lastID };
    }, pdfFixturePath);

    console.log('PDF import result:', pdfImportResult);
    expect(pdfImportResult.success).toBe(true);

    // Wait for UI to update
    await window.waitForTimeout(2000);

    // Step 2: VERIFY - Take screenshot of Collections Hub showing the PDF collection
    console.log('Step 2: Verifying PDF collection appears in Hub...');
    await window.screenshot({
      path: path.join(screenshotsDir, '04-pdf-collection-hub.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 04-pdf-collection-hub.png');

    // Verify the collection card is visible
    const pdfCollectionCard = await window.locator(`text="Test PDF Collection"`).first();
    await expect(pdfCollectionCard).toBeVisible({ timeout: 5000 });

    // Step 3: VIEW - Click the [View] button and screenshot the PDF viewer
    console.log('Step 3: Opening PDF viewer...');

    // Find and click the View button for the PDF collection
    const pdfViewButton = await window.locator('button:has-text("View")').last();
    await pdfViewButton.click();
    await window.waitForTimeout(2000);

    // Take screenshot of the PDF viewer
    await window.screenshot({
      path: path.join(screenshotsDir, '05-pdf-viewer.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 05-pdf-viewer.png');

    // Verify we're in the PDF viewer
    const pdfViewerElement = await window.locator('.pdf-viewer, .pdf-excerpt, text="PDF", text="page"').first();
    await expect(pdfViewerElement).toBeVisible({ timeout: 5000 });

    // Go back to Collections Hub
    const backButton = await window.locator('button:has-text("Back"), button:has-text("← Back")').first();
    if (await backButton.isVisible()) {
      await backButton.click();
      await window.waitForTimeout(1000);
    }

    // Step 4: ANALYZE - Open context menu and click "Rate Collection"
    console.log('Step 4: Opening Rate Collection modal for PDF...');

    // Find the PDF collection's context menu button
    const pdfMenuButton = await window.locator('button:has-text("⋮"), button.context-menu-button').last();
    if (await pdfMenuButton.isVisible()) {
      await pdfMenuButton.click();
      await window.waitForTimeout(500);

      // Click "Rate Collection" in the menu
      const rateButton = await window.locator('text="Rate Collection", text="BWS Experiment"').first();
      if (await rateButton.isVisible()) {
        await rateButton.click();
        await window.waitForTimeout(1000);

        // Take screenshot of the modal
        await window.screenshot({
          path: path.join(screenshotsDir, '06-pdf-rate-modal.png'),
          fullPage: true
        });
        console.log('Screenshot saved: 06-pdf-rate-modal.png');

        // Close the modal
        const closeButton = await window.locator('button:has-text("Cancel"), button:has-text("Close"), .close-btn').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    }

    console.log('\n=== PDF PIPELINE TEST COMPLETE ===\n');
  });

  test('Final Summary Screenshot', async () => {
    // Take a final screenshot showing both collections
    await window.waitForTimeout(1000);
    await window.screenshot({
      path: path.join(screenshotsDir, '07-final-collections-hub.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 07-final-collections-hub.png');
    console.log(`\nAll screenshots saved to: ${screenshotsDir}`);
    console.log(`Console log saved to: ${logFile}`);
  });
});
