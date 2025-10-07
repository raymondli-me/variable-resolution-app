const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// The path to the test results directory
const resultsDir = path.join(__dirname, '../../test-results');

// Ensure the test results directory exists and is clean
test.beforeAll(() => {
  if (fs.existsSync(resultsDir)) {
    fs.rmSync(resultsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(resultsDir, { recursive: true });
});

test.describe('State Discovery Protocol', () => {
  let electronApp;
  let window;
  const consoleMessages = [];

  test.beforeAll(async () => {
    // Launch the Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../main.js')],
      timeout: 60000
    });

    // Get the first window that opens
    window = await electronApp.firstWindow();

    // Capture all console messages
    window.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
  });

  test.afterAll(async () => {
    // Save console logs to a file
    fs.writeFileSync(path.join(resultsDir, 'console-log.txt'), consoleMessages.join('\n'));
    // Close the app
    await electronApp.close();
  });

  test('01: Capture Collections Hub (Default View)', async () => {
    await window.waitForSelector('#collections-hub-container');
    await window.screenshot({ path: path.join(resultsDir, '01-collections-hub.png') });
    const title = await window.title();
    expect(title).toBe('VR Data Collector');
  });

  test('02: Capture New Collection Modal', async () => {
    await window.click('#new-collection-btn');
    await window.waitForSelector('#source-selection-modal');
    await window.screenshot({ path: path.join(resultsDir, '02-new-collection-modal.png') });
    await window.click('#source-selection-modal .close-btn'); // Close the modal
  });

  test('03: Capture Collection Context Menu', async () => {
    // This assumes at least one collection card exists. If not, this test will fail.
    const firstCard = await window.locator('.collection-card').first();
    if (await firstCard.isVisible()) {
      await firstCard.click({ button: 'right' });
      await window.waitForSelector('#folder-context-menu');
      await window.screenshot({ path: path.join(resultsDir, '03-collection-context-menu.png') });
      // Click somewhere else to dismiss the menu
      await window.click('h2.hub-title');
    } else {
      console.log('Skipping context menu test: No collections found.');
      test.skip(true, 'No collections found to right-click.');
    }
  });

  test('04: Capture Settings Modal', async () => {
    await window.click('#settingsBtn');
    await window.waitForSelector('#settingsModal');
    await window.screenshot({ path: path.join(resultsDir, '04-settings-modal.png') });
    await window.click('#closeSettingsBtn'); // Close the modal
  });

});
