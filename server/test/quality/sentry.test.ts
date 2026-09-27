import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { buildApp } from '../helpers/app.js';
import { cleanupTempDirs } from '../helpers/tempdb.js';
import { drenarSentry, initSentry, Sentry, setupSentryErrorHandler } from '../../src/infrastructure/observability/sentry.js';

let server: Server;
let baseUrl: string;
let relay: Server;
let received: Array<{ method?: string; url?: string; body: string }> = [];
let db: ReturnType<typeof buildApp>['db'];

beforeAll(async () => {
  // Relé local que hace de "Sentry": captura los envelopes que el SDK envía.
  received = [];
  relay = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      received.push({ method: req.method, url: req.url, body });
      res.statusCode = 200;
      res.end();
    });
  });
  await new Promise<void>((resolve) => relay.listen(0, '127.0.0.1', () => resolve()));
  const relayPort = (relay.address() as AddressInfo).port;

  // DSN configurado por entorno (criterio de aceptación): apunta al relé local.
  process.env.SENTRY_DSN = `http://public@127.0.0.1:${relayPort}/2`;
  initSentry();

  const built = buildApp();
  db = built.db;
  setupSentryErrorHandler(built.app);
  server = built.app.listen(0);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('sin puerto');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.close();
  relay.close();
  await Sentry.close();
  delete process.env.SENTRY_DSN;
  db.close();
  cleanupTempDirs();
});

describe('Sentry captura errores del servidor (DSN por entorno)', () => {
  it('un error simulado en la API llega a Sentry como envelope', async () => {
    const res = await fetch(`${baseUrl}/api/debug/sentry-error`);
    expect(res.status).toBe(500);

    await drenarSentry();

    const envelope = received.find(
      (r) => (r.url ?? '').startsWith('/api/2/envelope/') && r.body.includes('Error simulado para Sentry'),
    );
    expect(envelope).toBeDefined();
  });
});