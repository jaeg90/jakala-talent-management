import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { ATTR_HTTP_REQUEST_METHOD, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import { startTelemetry } from '../../src/infrastructure/observability/telemetry.js';
import { buildApp } from '../helpers/app.js';
import { cleanupTempDirs } from '../helpers/tempdb.js';

let server: Server;
let baseUrl: string;
let exporter: InMemorySpanExporter;
let telemetry: ReturnType<typeof startTelemetry>;
let db: ReturnType<typeof buildApp>['db'];

/** Espera (con intervalo) a que aparezca una traza que cumpla el predicado. */
async function esperarTraza(predicate: (attrs: Record<string, unknown>) => boolean): Promise<void> {
  const deadLine = Date.now() + 3000;
  while (Date.now() < deadLine) {
    const spans = exporter.getFinishedSpans();
    if (spans.some((span) => predicate(span.attributes))) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('no apareció la traza esperada en el tiempo límite');
}

beforeAll(async () => {
  // Telemetría con exportador en memoria: sin red externa y determinista.
  exporter = new InMemorySpanExporter();
  telemetry = startTelemetry({
    extraSpanProcessors: [new SimpleSpanProcessor(exporter)],
    disableConsole: true,
  });

  const built = buildApp();
  db = built.db;
  server = built.app.listen(0);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('sin puerto');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.close();
  await telemetry.shutdown();
  db.close();
  cleanupTempDirs();
});

describe('trazas OpenTelemetry de la API', () => {
  it('una petición HTTP a la API genera una traza con su método y ruta', async () => {
    const res = await fetch(`${baseUrl}/api/session`);
    expect(res.status).toBe(401);

    // La instrumentación HTTP produce spans de servidor con método y ruta.
    await esperarTraza(
      (attrs) => attrs[ATTR_HTTP_REQUEST_METHOD] === 'GET' && attrs[ATTR_URL_PATH] === '/api/session',
    );
  });
});