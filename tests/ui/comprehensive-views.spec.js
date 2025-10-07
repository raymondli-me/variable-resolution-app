const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

test.describe('VR Data Collector - Comprehensive View Tests', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      executablePath: require('electron'),
      args: [path.join(__dirname, '../../main.js')],
      timeout: 60000
    });

    window = await electronApp.firstWindow({ timeout: 60000 });
    await window.waitForLoadState('domcontentloaded', { timeout: 60000 });
  }, 120000);

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('should capture Collections Hub main view', async () => {
    // Wait for the collections hub to load
    await window.waitForTimeout(2000);

    // Take screenshot of Collections Hub
    await window.screenshot({
      path: path.join(__dirname, '../../test-results/01-collections-hub.png'),
      fullPage: true
    });

    expect(await window.isVisible('#collections-hub-container')).toBe(true);
  });

  test('should capture Export view', async () => {
    // Click on Export in the sidebar
    await window.click('[data-view="export"]');
    await window.waitForTimeout(1000);

    // Take screenshot
    await window.screenshot({
      path: path.join(__dirname, '../../test-results/02-export-view.png'),
      fullPage: true
    });

    expect(await window.isVisible('#exportView')).toBe(true);
  });

  test('should navigate back to Collections', async () => {
    // Click on Collections in the sidebar
    await window.click('[data-view="collections"]');
    await window.waitForTimeout(1000);

    // Take screenshot
    await window.screenshot({
      path: path.join(__dirname, '../../test-results/03-back-to-collections.png'),
      fullPage: true
    });

    expect(await window.isVisible('#collections-hub-container')).toBe(true);
  });

  test('should capture Settings modal', async () => {
    // Click settings button
    await window.click('#settingsBtn');
    await window.waitForTimeout(1000);

    // Take screenshot
    await window.screenshot({
      path: path.join(__dirname, '../../test-results/04-settings-modal.png'),
      fullPage: true
    });

    // Close settings by clicking outside or escape
    await window.keyboard.press('Escape');
    await window.waitForTimeout(500);
  });
});
