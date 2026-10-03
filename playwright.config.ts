import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // The map shows once every texture of the hand-made art has loaded: on a cold start with
  // several browsers at once (software WebGL), that can take longer than the default 5 s.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:4174',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // Software WebGL, so the map renders on machines without a GPU (CI, containers).
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
