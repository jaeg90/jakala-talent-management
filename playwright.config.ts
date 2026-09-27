import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: 'npm run build && npm start',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      JTM_DB: join(mkdtempSync(join(tmpdir(), 'jtm-e2e-')), 'jtm.db'),
    },
  },
});
