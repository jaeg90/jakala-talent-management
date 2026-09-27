import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SeedAuthenticator } from '../../src/infrastructure/auth/seed-authenticator.js';
import { SqliteTeamRepository } from '../../src/infrastructure/db/sqlite-team-repository.js';
import { SqliteOneToOneRepository } from '../../src/infrastructure/db/sqlite-onetoone-repository.js';
import { SqliteTemaPropioRepository } from '../../src/infrastructure/db/sqlite-tema-propio-repository.js';
import { SqliteObjetivoRepository } from '../../src/infrastructure/db/sqlite-objetivo-repository.js';
import { MemorySessionStore } from '../../src/infrastructure/sessions/memory-session-store.js';
import { LoginService, TeamService } from '../../src/application/services.js';
import { OneToOneService } from '../../src/application/onetoone_service.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import { ObjetivoService } from '../../src/application/objetivo_service.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import { cleanupTempDirs, tempDbPath } from '../helpers/tempdb.js';

let server: Server;
let baseUrl: string;
let db: ReturnType<typeof openDatabase>;

beforeAll(async () => {
  db = openDatabase(tempDbPath());
  seed(db);
  const sessions = new MemorySessionStore();
  const app = createApp({
    login: new LoginService(new SeedAuthenticator(db), sessions),
    team: new TeamService(new SqliteTeamRepository(db)),
    onetoones: new OneToOneService(new SqliteOneToOneRepository(db)),
    temasPropios: new TemaPropioService(new SqliteTemaPropioRepository(db)),
    objetivos: new ObjetivoService(new SqliteObjetivoRepository(db)),
    sessions,
  });
  server = app.listen(0);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('sin puerto');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
  db.close();
  cleanupTempDirs();
});

const MARTA = 'manager@jakala.example';
const DIEGO = 'diego@jakala.example';

async function login(email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'secreta123' }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

/** Ana es de Marta; David es de Diego. */
const ANA_MARTA = 'me-ana';
const DAVID_DIEGO = 'me-david';

const OBJETIVO_ANA = {
  titulo: 'Certificar en AWS',
  descripcion: 'Aprobar el examen de Solutions Architect',
  fechaLimite: '2026-12-31',
};

interface ObjetivoApi {
  id: string;
  menteeId: string;
  titulo: string;
  descripcion: string;
  fechaLimite: string;
  estado: 'en curso' | 'cumplido' | 'no cumplido';
}

async function objetivosDe(menteeId: string, email: string): Promise<ObjetivoApi[]> {
  const res = await fetch(`${baseUrl}/api/mentees/${menteeId}/objetivos`, {
    headers: { cookie: await login(email) },
  });
  const body = (await res.json()) as { objetivos: ObjetivoApi[] };
  return body.objetivos;
}

async function alta(menteeId: string, email: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/mentees/${menteeId}/objetivos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await login(email) },
    body: JSON.stringify(body),
  });
}

describe('objetivos anuales de una mentee', () => {
  it('ciclo completo: alta, listado, cambio de estado y no revive', async () => {
    expect(await objetivosDe(ANA_MARTA, MARTA)).toEqual([]);

    const res = await alta(ANA_MARTA, MARTA, OBJETIVO_ANA);
    expect(res.status).toBe(201);
    const objetivo = (await res.json()) as ObjetivoApi;
    expect(objetivo.estado).toBe('en curso');
    expect(await objetivosDe(ANA_MARTA, MARTA)).toEqual([objetivo]);

    const cumplido = await fetch(`${baseUrl}/api/objetivos/${objetivo.id}/estado`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ estado: 'cumplido' }),
    });
    expect(cumplido.status).toBe(200);
    expect(((await cumplido.json()) as ObjetivoApi).estado).toBe('cumplido');

    // No se revive un objetivo cerrado (cumplido → no cumplido).
    const revive = await fetch(`${baseUrl}/api/objetivos/${objetivo.id}/estado`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ estado: 'no cumplido' }),
    });
    expect(revive.status).toBe(409);
  });

  it('edita un objetivo en curso', async () => {
    const res = await alta(ANA_MARTA, MARTA, OBJETIVO_ANA);
    const objetivo = (await res.json()) as ObjetivoApi;

    const editado = await fetch(`${baseUrl}/api/objetivos/${objetivo.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        titulo: 'Certificar en Azure',
        descripcion: 'Examen AZ-104',
        fechaLimite: '2026-11-30',
      }),
    });
    expect(editado.status).toBe(200);
    expect(((await editado.json()) as ObjetivoApi).titulo).toBe('Certificar en Azure');
  });

  it('rechaza un objetivo sin título', async () => {
    const res = await alta(ANA_MARTA, MARTA, { descripcion: '', fechaLimite: '2026-12-31' });
    expect(res.status).toBe(400);
  });

  it('rechaza un estado de destino no válido', async () => {
    const res = await alta(ANA_MARTA, MARTA, OBJETIVO_ANA);
    const objetivo = (await res.json()) as ObjetivoApi;

    const mal = await fetch(`${baseUrl}/api/objetivos/${objetivo.id}/estado`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ estado: 'en curso' }),
    });
    expect(mal.status).toBe(400);
  });

  it('aislamiento: Marta no da de alta objetivos para la mentee de Diego', async () => {
    const res = await alta(DAVID_DIEGO, MARTA, OBJETIVO_ANA);
    expect(res.status).toBe(404);
  });

  it('aislamiento: Diego no ve ni cambia el estado del objetivo de la mentee de Marta', async () => {
    const res = await alta(ANA_MARTA, MARTA, OBJETIVO_ANA);
    const objetivo = (await res.json()) as ObjetivoApi;

    expect(await objetivosDe(ANA_MARTA, DIEGO)).toEqual([]);

    const intento = await fetch(`${baseUrl}/api/objetivos/${objetivo.id}/estado`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(DIEGO) },
      body: JSON.stringify({ estado: 'cumplido' }),
    });
    expect(intento.status).toBe(404);
    // El objetivo sigue en curso para Marta.
    const tras = await objetivosDe(ANA_MARTA, MARTA);
    expect(tras.find((o) => o.id === objetivo.id)?.estado).toBe('en curso');
  });
});