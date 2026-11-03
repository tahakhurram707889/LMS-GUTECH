import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'./frontend/e2e',fullyParallel:false,workers:1,retries:0,
  use:{baseURL:process.env.E2E_BASE_URL??'http://localhost:5173',trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:process.env.E2E_START_SERVERS==='true'?[
    {command:'npm run dev --workspace backend',url:'http://localhost:4000/api/health',reuseExistingServer:!process.env.CI},
    {command:'npm run dev --workspace frontend',url:'http://localhost:5173',reuseExistingServer:!process.env.CI},
  ]:undefined,
});
