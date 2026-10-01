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
import { TraspasoService } from '../../src/application/traspaso_service.js';
import { PlantillaService } from '../../src/application/plantilla_service.js';
import { SqliteTraspasoRepository } from '../../src/infrastructure/db/sqlite-traspaso-repository.js';
import { SqlitePlantillaRepository } from '../../src/infrastructure/db/sqlite-plantilla-repository.js';
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
    traspasos: new TraspasoService(new SqliteTraspasoRepository(db)),
    plantilla: new PlantillaService(new SqlitePlantillaRepository(db)),
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

interface IncidenciaApi {
  id: string;
  menteeId: string;
  descripcion: string;
  estado: 'abierta' | 'resuelta';
  notaResolucion: string;
  fechaAlta: string;
  fechaResolucion: string | null;
  menteeName?: string;
}

async function abiertasDe(email: string): Promise<IncidenciaApi[]> {
  const res = await fetch(`${baseUrl}/api/incidencias`, { headers: { cookie: await login(email) } });
  const body = (await res.json()) as { incidencias: IncidenciaApi[] };
  return body.incidencias;
}

async function historialDe(menteeId: string, email: string): Promise<IncidenciaApi[]> {
  const res = await fetch(`${baseUrl}/api/mentees/${menteeId}/incidencias`, {
    headers: { cookie: await login(email) },
  });
  const body = (await res.json()) as { incidencias: IncidenciaApi[] };
  return body.incidencias;
}

async function alta(menteeId: string, email: string, descripcion: string): Promise<Response> {
  return fetch(`${baseUrl}/api/mentees/${menteeId}/incidencias`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await login(email) },
    body: JSON.stringify({ descripcion }),
  });
}

describe('incidencias con ciclo abierto → resuelta', () => {
  it('ciclo completo: alta, listado de equipo, resolución y sin reapertura', async () => {
    expect(await abiertasDe(MARTA)).toEqual([]);
    expect(await historialDe(ANA_MARTA, MARTA)).toEqual([]);

    const res = await alta(ANA_MARTA, MARTA, 'Baja médica');
    expect(res.status).toBe(201);
    const incidencia = (await res.json()) as IncidenciaApi;
    expect(incidencia.estado).toBe('abierta');

    // Aparece en las incidencias abiertas del equipo, con el nombre de la mentee.
    const abiertas = await abiertasDe(MARTA);
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0]).toMatchObject({ id: incidencia.id, menteeName: 'Ana Alonso' });

    // Y en el historial de la ficha.
    expect((await historialDe(ANA_MARTA, MARTA)).map((i) => i.id)).toContain(incidencia.id);

    // Se resuelve con nota: pasa a resuelta y desaparece de las abiertas.
    const resolver = await fetch(`${baseUrl}/api/incidencias/${incidencia.id}/resolver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ nota: 'Reincorporada tras la baja' }),
    });
    expect(resolver.status).toBe(200);
    const resuelta = (await resolver.json()) as IncidenciaApi;
    expect(resuelta).toMatchObject({
      id: incidencia.id,
      estado: 'resuelta',
      notaResolucion: 'Reincorporada tras la baja',
    });

    expect(await abiertasDe(MARTA)).toEqual([]);
    const historial = await historialDe(ANA_MARTA, MARTA);
    expect(historial.find((i) => i.id === incidencia.id)?.estado).toBe('resuelta');

    // No se reabre ni se vuelve a resolver.
    const deNuevo = await fetch(`${baseUrl}/api/incidencias/${incidencia.id}/resolver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ nota: 'Otra nota' }),
    });
    expect(deNuevo.status).toBe(409);
  });

  it('rechaza una alta sin descripción', async () => {
    const res = await alta(ANA_MARTA, MARTA, '   ');
    expect(res.status).toBe(400);
  });

  it('rechaza una resolución sin nota', async () => {
    const res = await alta(ANA_MARTA, MARTA, 'Conflicto');
    const incidencia = (await res.json()) as IncidenciaApi;

    const resolver = await fetch(`${baseUrl}/api/incidencias/${incidencia.id}/resolver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ nota: '   ' }),
    });
    expect(resolver.status).toBe(400);
  });

  it('aislamiento: Marta no da de alta incidencias para la mentee de Diego', async () => {
    const res = await alta(DAVID_DIEGO, MARTA, 'Baja médica');
    expect(res.status).toBe(404);
  });

  it('aislamiento: Diego no ve ni resuelve la incidencia de la mentee de Marta', async () => {
    const res = await alta(ANA_MARTA, MARTA, 'Retraso en una entrega');
    const incidencia = (await res.json()) as IncidenciaApi;

    expect(await abiertasDe(DIEGO)).toEqual([]);
    expect(await historialDe(ANA_MARTA, DIEGO)).toEqual([]);

    const intento = await fetch(`${baseUrl}/api/incidencias/${incidencia.id}/resolver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(DIEGO) },
      body: JSON.stringify({ nota: 'Intruso' }),
    });
    expect(intento.status).toBe(404);
    // La incidencia sigue abierta para Marta.
    expect((await historialDe(ANA_MARTA, MARTA)).find((i) => i.id === incidencia.id)?.estado).toBe(
      'abierta',
    );
  });
});