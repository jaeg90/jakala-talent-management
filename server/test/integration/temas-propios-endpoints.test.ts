import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SeedAuthenticator } from '../../src/infrastructure/auth/seed-authenticator.js';
import { SqliteTeamRepository } from '../../src/infrastructure/db/sqlite-team-repository.js';
import { SqliteOneToOneRepository } from '../../src/infrastructure/db/sqlite-onetoone-repository.js';
import { SqliteTemaPropioRepository } from '../../src/infrastructure/db/sqlite-tema-propio-repository.js';
import { MemorySessionStore } from '../../src/infrastructure/sessions/memory-session-store.js';
import { LoginService, TeamService } from '../../src/application/services.js';
import { OneToOneService } from '../../src/application/onetoone_service.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import { ObjetivoService } from '../../src/application/objetivo_service.js';
import { SqliteObjetivoRepository } from '../../src/infrastructure/db/sqlite-objetivo-repository.js';
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

const ANA_MARTA = 'me-ana';
const DAVID_DIEGO = 'me-david';

interface TemaPropioApi {
  id: string;
  menteeId: string;
  tema: string;
}

async function temasDe(menteeId: string, email: string): Promise<TemaPropioApi[]> {
  const res = await fetch(`${baseUrl}/api/mentees/${menteeId}/temas`, {
    headers: { cookie: await login(email) },
  });
  const body = (await res.json()) as { temas: TemaPropioApi[] };
  return body.temas;
}

async function alta(menteeId: string, email: string, tema: string): Promise<Response> {
  return fetch(`${baseUrl}/api/mentees/${menteeId}/temas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await login(email) },
    body: JSON.stringify({ tema }),
  });
}

describe('temas propios de una mentee', () => {
  it('parte sin temas y los da de alta y de baja', async () => {
    expect(await temasDe(ANA_MARTA, MARTA)).toEqual([]);

    const res = await alta(ANA_MARTA, MARTA, 'formación en curso');
    expect(res.status).toBe(201);
    const tema = (await res.json()) as TemaPropioApi;
    expect(tema.tema).toBe('formación en curso');
    expect(await temasDe(ANA_MARTA, MARTA)).toEqual([tema]);

    const baja = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/temas/${tema.id}`, {
      method: 'DELETE',
      headers: { cookie: await login(MARTA) },
    });
    expect(baja.status).toBe(204);
    expect(await temasDe(ANA_MARTA, MARTA)).toEqual([]);
  });

  it('rechaza un nombre vacío', async () => {
    const res = await alta(ANA_MARTA, MARTA, '   ');
    expect(res.status).toBe(400);
  });

  it('rechaza un tema repetido', async () => {
    await alta(ANA_MARTA, MARTA, 'formación en curso');
    const res = await alta(ANA_MARTA, MARTA, 'formación en curso');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('Ya existe');
  });

  it('aislamiento: Marta no da de alta temas para la mentee de Diego', async () => {
    const res = await alta(DAVID_DIEGO, MARTA, 'formación');
    expect(res.status).toBe(404);
  });

  it('aislamiento: Diego no da de baja un tema de la mentee de Marta', async () => {
    const res = await alta(ANA_MARTA, MARTA, 'formación en curso');
    const tema = (await res.json()) as TemaPropioApi;

    const baja = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/temas/${tema.id}`, {
      method: 'DELETE',
      headers: { cookie: await login(DIEGO) },
    });
    expect(baja.status).toBe(404);
    // El tema sigue vigente para Marta.
    expect(await temasDe(ANA_MARTA, MARTA)).toHaveLength(1);
  });
});