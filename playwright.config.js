const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testIgnore: '**/production.spec.js', fullyParallel: true, workers: 2,
  outputDir: 'test-results/source',
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: 'http://127.0.0.1:8000', headless: true,
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {} },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:8000', reuseExistingServer: !process.env.CI }
});
