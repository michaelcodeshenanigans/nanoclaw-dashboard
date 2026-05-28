import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: {
      // Skip Authelia in test environments by passing a pre-auth header
      // (configure Authelia bypass rule for this header in staging/test)
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
