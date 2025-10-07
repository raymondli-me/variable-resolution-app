const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

test.describe('VR Data Collector - Smoke Test', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    // Launch the Electron app using the electron package
    // This will use the locally installed electron from node_modules
    electronApp = await electron.launch({
      executablePath: require('electron'),
      args: [path.join(__dirname, '../../main.js')],
      timeout: 60000
    });

    // Wait for the app to emit the window event
    // This waits for the BrowserWindow to be created
    window = await electronApp.firstWindow({ timeout: 60000 });

    // Wait for the window to be ready
    await window.waitForLoadState('domcontentloaded', { timeout: 60000 });
  }, 120000);

  test.afterAll(async () => {
    // Close the app
    await electronApp.close();
  });

  test('should launch application and verify title', async () => {
    // Get the window title
    const title = await window.title();

    // Assert that the title is correct
    expect(title).toBe('VR Data Collector');
  });

  test('should take a screenshot of the main window', async () => {
    // Wait a bit for the app to fully render
    await window.waitForTimeout(2000);

    // Take a screenshot
    await window.screenshot({
      path: path.join(__dirname, '../../test-results/main-window.png'),
      fullPage: true
    });

    // Assert that the window is visible
    expect(await window.isVisible('body')).toBe(true);
  });
});
