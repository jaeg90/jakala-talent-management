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
import { MemorySessionStore } from '../../src/infrastructure/sessions/memory-session-store.js';
import { LoginService, TeamService } from '../../src/application/services.js';
import { OneToOneService } from '../../src/application/onetoone_service.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import { ObjetivoService } from '../../src/application/objetivo_service.js';
import { IncidenciaService } from '../../src/application/incidencia_service.js';
import { ProyectoService } from '../../src/application/proyecto_service.js';
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
    incidencias: new IncidenciaService(new SqliteIncidenciaRepository(db)),
    proyectos: new ProyectoService(new SqliteProyectoRepository(db)),
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

/** Mentees de Marta: Ana (Atlas), Beatriz (Nova) y Carla (Aurora). David es de Diego. */
const ANA = 'me-ana';
const BEA = 'me-bea';
const CARLA = 'me-carla';
const DAVID_DIEGO = 'me-david';

interface ProyectoApi {
  id: string;
  name: string;
}

interface CambioApi {
  id: string;
  menteeId: string;
  fecha: string;
  origenId: string | null;
  destinoId: string | null;
  motivo: string;
}

interface GrupoApi {
  projectId: string | null;
  projectName: string | null;
  mentees: { id: string; name: string }[];
}

async function catalogo(email: string): Promise<ProyectoApi[]> {
  const res = await fetch(`${baseUrl}/api/proyectos`, { headers: { cookie: await login(email) } });
  const body = (await res.json()) as { proyectos: ProyectoApi[] };
  return body.proyectos;
}

async function miembros(email: string): Promise<GrupoApi[]> {
  const res = await fetch(`${baseUrl}/api/proyectos/miembros`, { headers: { cookie: await login(email) } });
  const body = (await res.json()) as { proyectos: GrupoApi[] };
  return body.proyectos;
}

async function situacion(menteeId: string, email: string): Promise<{ project: ProyectoApi | null; cambios: CambioApi[] }> {
  const res = await fetch(`${baseUrl}/api/mentees/${menteeId}/cambios-proyecto`, {
    headers: { cookie: await login(email) },
  });
  return (await res.json()) as { project: ProyectoApi | null; cambios: CambioApi[] };
}

async function registrar(menteeId: string, email: string, body: { fecha: string; destinoId: string | null; motivo: string }): Promise<Response> {
  return fetch(`${baseUrl}/api/mentees/${menteeId}/cambios-proyecto`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await login(email) },
    body: JSON.stringify(body),
  });
}

describe('GET/POST /api/proyectos', () => {
  it('lista el catálogo y permite ampliarlo', async () => {
    const antes = await catalogo(MARTA);
    expect(antes.map((p) => p.name)).toContain('Atlas Bank');

    const res = await fetch(`${baseUrl}/api/proyectos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ name: 'Nueva Cuenta' }),
    });
    expect(res.status).toBe(201);
    const nuevo = (await res.json()) as ProyectoApi;
    expect(nuevo.name).toBe('Nueva Cuenta');

    const despues = await catalogo(MARTA);
    expect(despues.map((p) => p.name)).toContain('Nueva Cuenta');
  });

  it('rechaza un nombre duplicado con 409', async () => {
    const res = await fetch(`${baseUrl}/api/proyectos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ name: 'Atlas Bank' }),
    });
    expect(res.status).toBe(409);
  });

  it('rechaza un alta sin nombre', async () => {
    const res = await fetch(`${baseUrl}/api/proyectos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ name: '   ' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('vista "quién está en cada proyecto"', () => {
  it('agrupa los mentees del manager por proyecto (estado inicial)', async () => {
    const grupos = await miembros(MARTA);

    expect(grupos).toEqual([
      { projectId: 'pr-atlas', projectName: 'Atlas Bank', mentees: [{ id: 'me-ana', name: 'Ana Alonso' }] },
      { projectId: 'pr-aurora', projectName: 'Aurora Health', mentees: [{ id: 'me-carla', name: 'Carla Cano' }] },
      { projectId: 'pr-nova', projectName: 'Retail Nova', mentees: [{ id: 'me-bea', name: 'Beatriz Blanco' }] },
    ]);
  });

  it('tras un cambio, la mentee aparece en el proyecto nuevo', async () => {
    await registrar(ANA, MARTA, { fecha: '2026-09-27', destinoId: 'pr-nova', motivo: 'Rotación' });

    const grupos = await miembros(MARTA);

    // Atlas Bank queda sin mentees de Marta (Ana era la única).
    expect(grupos.find((g) => g.projectName === 'Atlas Bank')).toBeUndefined();
    const nova = grupos.find((g) => g.projectName === 'Retail Nova');
    expect(nova?.mentees.map((m) => m.name)).toContain('Ana Alonso');
  });
});

describe('registro de un cambio de proyecto', () => {
  it('actualiza el proyecto actual y queda en el historial', async () => {
    const antes = await situacion(BEA, MARTA);
    expect(antes).toEqual({ project: { id: 'pr-nova', name: 'Retail Nova' }, cambios: [] });

    const res = await registrar(BEA, MARTA, { fecha: '2026-09-27', destinoId: 'pr-atlas', motivo: 'Reorganización' });
    expect(res.status).toBe(201);
    const cambio = (await res.json()) as CambioApi;
    expect(cambio).toMatchObject({
      menteeId: BEA,
      fecha: '2026-09-27',
      origenId: 'pr-nova',
      destinoId: 'pr-atlas',
      motivo: 'Reorganización',
    });

    const despues = await situacion(BEA, MARTA);
    expect(despues.project).toEqual({ id: 'pr-atlas', name: 'Atlas Bank' });
    expect(despues.cambios).toEqual([cambio]);
  });

  it('rechaza un cambio al mismo proyecto con 409', async () => {
    const res = await registrar(CARLA, MARTA, { fecha: '2026-09-27', destinoId: 'pr-aurora', motivo: 'Sin cambio' });
    expect(res.status).toBe(409);
  });

  it('rechaza un cambio sin motivo', async () => {
    const res = await registrar(CARLA, MARTA, { fecha: '2026-09-27', destinoId: 'pr-nova', motivo: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('aislamiento por manager', () => {
  it('Marta no registra un cambio para la mentee de Diego', async () => {
    const res = await registrar(DAVID_DIEGO, MARTA, { fecha: '2026-09-27', destinoId: 'pr-atlas', motivo: 'Intruso' });
    expect(res.status).toBe(404);
  });

  it('Diego no ve la situación de la mentee de Marta', async () => {
    await registrar(ANA, MARTA, { fecha: '2026-09-27', destinoId: 'pr-atlas', motivo: 'Rotación' });

    await expect(situacion(ANA, DIEGO)).resolves.toEqual({ project: null, cambios: [] });
    const gruposDiego = await miembros(DIEGO);
    const ids = gruposDiego.flatMap((g) => g.mentees.map((m) => m.id));
    expect(ids).not.toContain(ANA);
  });
});