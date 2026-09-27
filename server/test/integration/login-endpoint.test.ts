import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed, SEED_MANAGERS } from '../../src/infrastructure/db/seed.js';
import { SeedAuthenticator } from '../../src/infrastructure/auth/seed-authenticator.js';
import { SqliteTeamRepository } from '../../src/infrastructure/db/sqlite-team-repository.js';
import { SqliteOneToOneRepository } from '../../src/infrastructure/db/sqlite-onetoone-repository.js';
import { SqliteTemaPropioRepository } from '../../src/infrastructure/db/sqlite-tema-propio-repository.js';
import { SqliteObjetivoRepository } from '../../src/infrastructure/db/sqlite-objetivo-repository.js';
import { SqliteIncidenciaRepository } from '../../src/infrastructure/db/sqlite-incidencia-repository.js';
import { SqliteProyectoRepository } from '../../src/infrastructure/db/sqlite-proyecto-repository.js';
import { MemorySessionStore } from '../../src/infrastructure/sessions/memory-session-store.js';
import { LoginService, TeamService } from '../../src/application/services.js';
import { OneToOneService } from '../../src/application/onetoone_service.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import { ObjetivoService } from '../../src/application/objetivo_service.js';
import { IncidenciaService } from '../../src/application/incidencia_service.js';
import { ProyectoService } from '../../src/application/proyecto_service.js';
import { TraspasoService } from '../../src/application/traspaso_service.js';
import { SqliteTraspasoRepository } from '../../src/infrastructure/db/sqlite-traspaso-repository.js';
import { createApp, SESSION_COOKIE } from '../../src/infrastructure/http/app.js';
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
    incidencias: new IncidenciaService(new SqliteIncidenciaRepository(db)),
    proyectos: new ProyectoService(new SqliteProyectoRepository(db)),
    traspasos: new TraspasoService(new SqliteTraspasoRepository(db)),
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

describe('POST /api/login', () => {
  it('acepta al manager semilla y devuelve cookie de sesión', async () => {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'manager@jakala.example', password: 'secreta123' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { manager: { email: string } };
    expect(body.manager.email).toBe('manager@jakala.example');
    expect(res.headers.get('set-cookie')).toContain(SESSION_COOKIE);
  });

  it('rechaza credenciales incorrectas con 401', async () => {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'manager@jakala.example', password: 'incorrecta' }),
    });

    expect(res.status).toBe(401);
  });
});

describe('acceso sin sesión', () => {
  it('GET /api/team rechaza con 401', async () => {
    const res = await fetch(`${baseUrl}/api/team`);
    expect(res.status).toBe(401);
  });

  it('GET /api/session rechaza con 401', async () => {
    const res = await fetch(`${baseUrl}/api/session`);
    expect(res.status).toBe(401);
  });
});

describe('con sesión', () => {
  async function login(email: string): Promise<string> {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'secreta123' }),
    });
    return res.headers.get('set-cookie')!.split(';')[0]!;
  }

  const MARTA = SEED_MANAGERS[0]!.email;
  const DIEGO = SEED_MANAGERS[1]!.email;

  interface MenteeApi {
    id: string;
    name: string;
    project: { id: string; name: string } | null;
  }

  async function teamOf(email: string): Promise<MenteeApi[]> {
    const res = await fetch(`${baseUrl}/api/team`, { headers: { cookie: await login(email) } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mentees: MenteeApi[] };
    return body.mentees;
  }

  it('GET /api/session devuelve al manager', async () => {
    const res = await fetch(`${baseUrl}/api/session`, { headers: { cookie: await login(MARTA) } });
    expect(res.status).toBe(200);
  });

  it('GET /api/team lista los mentees del manager con su proyecto actual', async () => {
    const mentees = await teamOf(MARTA);

    expect(mentees).toEqual([
      { id: 'me-ana', name: 'Ana Alonso', project: { id: 'pr-atlas', name: 'Atlas Bank' } },
      { id: 'me-bea', name: 'Beatriz Blanco', project: { id: 'pr-nova', name: 'Retail Nova' } },
      { id: 'me-carla', name: 'Carla Cano', project: { id: 'pr-aurora', name: 'Aurora Health' } },
    ]);
  });

  it('aislamiento: Marta no ve mentees de otros managers', async () => {
    const marta = await teamOf(MARTA);
    const otros = (await teamOf(DIEGO)).concat(await teamOf('lucia@jakala.example'));

    for (const mentee of otros) {
      expect(marta.map((m) => m.id)).not.toContain(mentee.id);
    }
    expect(marta.length).toBe(3);
  });

  it('la mentee sin proyecto de Lucía aparece con project null', async () => {
    const lucia = await teamOf('lucia@jakala.example');
    const hugo = lucia.find((m) => m.id === 'me-hugo');
    expect(hugo?.project).toBeNull();
  });

  it('POST /api/logout revoca la sesión', async () => {
    const cookie = await login(MARTA);
    const logout = await fetch(`${baseUrl}/api/logout`, { method: 'POST', headers: { cookie } });
    expect(logout.status).toBe(204);
    const after = await fetch(`${baseUrl}/api/team`, { headers: { cookie } });
    expect(after.status).toBe(401);
  });
});
