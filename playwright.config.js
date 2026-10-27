const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testIgnore: '**/production.spec.js', fullyParallel: true, workers: 2,
  use: { baseURL: 'http://127.0.0.1:8000', headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {} },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:8000', reuseExistingServer: !process.env.CI }
});
