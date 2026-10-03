import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SeedAuthenticator } from '../../src/infrastructure/auth/seed-authenticator.js';
import { SqliteTeamRepository } from '../../src/infrastructure/db/sqlite-team-repository.js';
import { SqliteOneToOneRepository } from '../../src/infrastructure/db/sqlite-onetoone-repository.js';
import { SqliteTemaPropioRepository } from '../../src/infrastructure/db/sqlite-tema-propio-repository.js';
import { SqliteObjetivoRepository } from '../../src/infrastructure/db/sqlite-objetivo-repository.js';
import { SqliteIncidenciaRepository } from '../../src/infrastructure/db/sqlite-incidencia-repository.js';
import { SqliteProyectoRepository } from '../../src/infrastructure/db/sqlite-proyecto-repository.js';
import { SqliteTraspasoRepository } from '../../src/infrastructure/db/sqlite-traspaso-repository.js';
import { SqlitePlantillaRepository } from '../../src/infrastructure/db/sqlite-plantilla-repository.js';
import { SqliteCuentaRepository } from '../../src/infrastructure/db/sqlite-cuenta-repository.js';
import { SqliteHistorialRepository } from '../../src/infrastructure/db/sqlite-historial-repository.js';
import { MemorySessionStore } from '../../src/infrastructure/sessions/memory-session-store.js';
import { LoginService, TeamService } from '../../src/application/services.js';
import { OneToOneService } from '../../src/application/onetoone_service.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import { ObjetivoService } from '../../src/application/objetivo_service.js';
import { IncidenciaService } from '../../src/application/incidencia_service.js';
import { ProyectoService } from '../../src/application/proyecto_service.js';
import { TraspasoService } from '../../src/application/traspaso_service.js';
import { PlantillaService } from '../../src/application/plantilla_service.js';
import { CuentaService } from '../../src/application/cuenta_service.js';
import { HistorialService } from '../../src/application/historial_service.js';
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
    temasPropios: new TemaPropioService(
      new SqliteTemaPropioRepository(db),
      new SqlitePlantillaRepository(db),
    ),
    objetivos: new ObjetivoService(new SqliteObjetivoRepository(db)),
    incidencias: new IncidenciaService(new SqliteIncidenciaRepository(db)),
    proyectos: new ProyectoService(new SqliteProyectoRepository(db)),
    traspasos: new TraspasoService(new SqliteTraspasoRepository(db)),
    plantilla: new PlantillaService(new SqlitePlantillaRepository(db)),
    cuentas: new CuentaService(new SqliteCuentaRepository(db), sessions),
    historial: new HistorialService(new SqliteHistorialRepository(db)),
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

async function login(email: string, password = 'secreta123'): Promise<string> {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

function cambiarContrasena(cookie: string, body: Record<string, string>): Promise<Response> {
  return fetch(`${baseUrl}/api/cuenta/contrasena`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MARTA = 'manager@jakala.example';
const JULIA = 'julia@jakala.example';

describe('bloqueo duro por contraseña temporal', () => {
  it('con el flag activo, /api/team devuelve 403', async () => {
    const cookie = await login(JULIA);
    const res = await fetch(`${baseUrl}/api/team`, { headers: { cookie } });
    expect(res.status).toBe(403);
  });

  it('con el flag activo, /api/session sigue respondiendo', async () => {
    const cookie = await login(JULIA);
    const res = await fetch(`${baseUrl}/api/session`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { manager: { debeCambiarContraseña: boolean } };
    expect(body.manager.debeCambiarContraseña).toBe(true);
  });

  it('con el flag activo, el logout sigue disponible', async () => {
    const cookie = await login(JULIA);
    const res = await fetch(`${baseUrl}/api/logout`, { method: 'POST', headers: { cookie } });
    expect(res.status).toBe(204);
  });
});

describe('POST /api/cuenta/contrasena', () => {
  it('rechaza con 400 si la contraseña actual no es correcta', async () => {
    const cookie = await login(MARTA);
    const res = await cambiarContrasena(cookie, { actual: 'incorrecta', nueva: 'nueva-clave-123' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('La contraseña actual no es correcta.');
  });

  it('rechaza con 400 una contraseña nueva de menos de 10 caracteres', async () => {
    const cookie = await login(MARTA);
    const res = await cambiarContrasena(cookie, { actual: 'secreta123', nueva: 'corta' });
    expect(res.status).toBe(400);
  });

  it('rechaza con 400 una contraseña nueva igual a la actual', async () => {
    const cookie = await login(MARTA);
    const res = await cambiarContrasena(cookie, { actual: 'secreta123', nueva: 'secreta123' });
    expect(res.status).toBe(400);
  });

  it('cambia la contraseña, despeja el flag e invalida las demás sesiones', async () => {
    const cookieActual = await login(MARTA);
    const cookieOtra = await login(MARTA);

    const res = await cambiarContrasena(cookieActual, {
      actual: 'secreta123',
      nueva: 'nueva-clave-123',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { manager: { email: string; debeCambiarContraseña: boolean } };
    expect(body.manager.email).toBe(MARTA);
    expect(body.manager.debeCambiarContraseña).toBe(false);

    // La sesión actual sigue viva y con el flag despejado.
    const sesion = await fetch(`${baseUrl}/api/session`, { headers: { cookie: cookieActual } });
    expect(sesion.status).toBe(200);
    const sesionBody = (await sesion.json()) as { manager: { debeCambiarContraseña: boolean } };
    expect(sesionBody.manager.debeCambiarContraseña).toBe(false);

    // La otra sesión queda invalidada.
    const otra = await fetch(`${baseUrl}/api/session`, { headers: { cookie: cookieOtra } });
    expect(otra.status).toBe(401);

    // La contraseña nueva autentica y la antigua ya no.
    const relogin = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MARTA, password: 'nueva-clave-123' }),
    });
    expect(relogin.status).toBe(200);
    const loginViejo = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MARTA, password: 'secreta123' }),
    });
    expect(loginViejo.status).toBe(401);
  });

  it('al cambiar la contraseña, el flag se despeja y /api/team vuelve a responder', async () => {
    const cookie = await login(JULIA);

    const antes = await fetch(`${baseUrl}/api/team`, { headers: { cookie } });
    expect(antes.status).toBe(403);

    const res = await cambiarContrasena(cookie, { actual: 'secreta123', nueva: 'nueva-clave-julia' });
    expect(res.status).toBe(200);

    const despues = await fetch(`${baseUrl}/api/team`, { headers: { cookie } });
    expect(despues.status).toBe(200);
  });
});