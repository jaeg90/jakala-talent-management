import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SeedAuthenticator } from '../../src/infrastructure/auth/seed-authenticator.js';
import { SqliteTeamRepository } from '../../src/infrastructure/db/sqlite-team-repository.js';
import { MemorySessionStore } from '../../src/infrastructure/sessions/memory-session-store.js';
import { LoginService, TeamService } from '../../src/application/services.js';
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
  async function login(): Promise<string> {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'manager@jakala.example', password: 'secreta123' }),
    });
    return res.headers.get('set-cookie')!.split(';')[0]!;
  }

  it('GET /api/session devuelve al manager', async () => {
    const res = await fetch(`${baseUrl}/api/session`, { headers: { cookie: await login() } });
    expect(res.status).toBe(200);
  });

  it('GET /api/team devuelve el equipo (vacío en el esqueleto)', async () => {
    const res = await fetch(`${baseUrl}/api/team`, { headers: { cookie: await login() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mentees: [] });
  });

  it('POST /api/logout revoca la sesión', async () => {
    const cookie = await login();
    const logout = await fetch(`${baseUrl}/api/logout`, { method: 'POST', headers: { cookie } });
    expect(logout.status).toBe(204);
    const after = await fetch(`${baseUrl}/api/team`, { headers: { cookie } });
    expect(after.status).toBe(401);
  });
});
