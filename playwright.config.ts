import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  // Un solo worker: los E2E comparten la base de datos del servidor (una única
  // instancia por pasada), así que se ejecutan en serie para no pisarse los fixtures.
  fullyParallel: false,
  workers: 1,
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
