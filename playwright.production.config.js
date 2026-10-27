const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testMatch: '**/production.spec.js', fullyParallel:true, workers:2,
  outputDir: 'test-results/production',
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {baseURL:'http://127.0.0.1:8001',headless:true,
    trace:'retain-on-failure',screenshot:'only-on-failure',
    launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{}},
  webServer:{command:'node scripts/serve-production.cjs',url:'http://127.0.0.1:8001/launchpad-career/',reuseExistingServer:false}
});
