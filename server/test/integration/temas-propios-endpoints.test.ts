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
import { MenteeService } from '../../src/application/mentee_service.js';
import { SqliteMenteeRepository } from '../../src/infrastructure/db/sqlite-mentee-repository.js';
import { OneToOneService } from '../../src/application/onetoone_service.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import { ObjetivoService } from '../../src/application/objetivo_service.js';
import { IncidenciaService } from '../../src/application/incidencia_service.js';
import { ProyectoService } from '../../src/application/proyecto_service.js';
import { SqliteObjetivoRepository } from '../../src/infrastructure/db/sqlite-objetivo-repository.js';
import { SqliteIncidenciaRepository } from '../../src/infrastructure/db/sqlite-incidencia-repository.js';
import { SqliteProyectoRepository } from '../../src/infrastructure/db/sqlite-proyecto-repository.js';
import { TraspasoService } from '../../src/application/traspaso_service.js';
import { PlantillaService } from '../../src/application/plantilla_service.js';
import { CuentaService } from '../../src/application/cuenta_service.js';
import { HistorialService } from '../../src/application/historial_service.js';
import { SqliteTraspasoRepository } from '../../src/infrastructure/db/sqlite-traspaso-repository.js';
import { SqlitePlantillaRepository } from '../../src/infrastructure/db/sqlite-plantilla-repository.js';
import { SqliteCuentaRepository } from '../../src/infrastructure/db/sqlite-cuenta-repository.js';
import { SqliteHistorialRepository } from '../../src/infrastructure/db/sqlite-historial-repository.js';
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
    mentees: new MenteeService(new SqliteMenteeRepository(db)),
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
// Beatriz es también de Marta: para verificar que la retirada acota por mentee
// (una URL que identifica a otra mentee no retira temas ajenos).
const BEA_MARTA = 'me-bea';

interface TemaPropioApi {
  id: string;
  menteeId: string;
  tema: string;
  desde: string;
  estado: 'vigente' | 'retirado';
  retiradoEl: string | null;
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

async function retirar(menteeId: string, email: string, temaPropioId: string): Promise<Response> {
  return fetch(`${baseUrl}/api/mentees/${menteeId}/temas/${temaPropioId}/retirar`, {
    method: 'POST',
    headers: { cookie: await login(email) },
  });
}

describe('temas propios de una mentee', () => {
  it('parte sin temas y los da de alta y retira (sin borrado)', async () => {
    expect(await temasDe(ANA_MARTA, MARTA)).toEqual([]);

    const res = await alta(ANA_MARTA, MARTA, 'formación en curso');
    expect(res.status).toBe(201);
    const tema = (await res.json()) as TemaPropioApi;
    expect(tema.tema).toBe('formación en curso');
    expect(tema.estado).toBe('vigente');
    expect(tema.retiradoEl).toBeNull();
    expect(await temasDe(ANA_MARTA, MARTA)).toEqual([tema]);

    const baja = await retirar(ANA_MARTA, MARTA, tema.id);
    expect(baja.status).toBe(204);
    const despues = await temasDe(ANA_MARTA, MARTA);
    expect(despues).toHaveLength(1);
    expect(despues[0]).toMatchObject({ id: tema.id, estado: 'retirado', retiradoEl: expect.any(String) });
  });

  it('rechaza un nombre vacío', async () => {
    const res = await alta(ANA_MARTA, MARTA, '   ');
    expect(res.status).toBe(400);
  });

  it('rechaza un tema propio vigente repetido (copy §14)', async () => {
    await alta(ANA_MARTA, MARTA, 'plan de crecimiento');
    const res = await alta(ANA_MARTA, MARTA, 'PLAN DE CRECIMIENTO');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      'Ana ya tiene un tema propio con ese nombre.',
    );
  });

  it('rechaza un tema propio retirado con el copy «Volver a usar»', async () => {
    const altaRes = await alta(ANA_MARTA, MARTA, 'formación en certificaciones');
    const tema = (await altaRes.json()) as TemaPropioApi;
    await retirar(ANA_MARTA, MARTA, tema.id);

    const res = await alta(ANA_MARTA, MARTA, 'FORMACIÓN EN CERTIFICACIONES');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      'Ya lo tienes en retirados. Pulsa «Volver a usar».',
    );
  });

  it('rechaza un tema genérico vigente de la plantilla (copy §14)', async () => {
    const res = await alta(ANA_MARTA, MARTA, '¿Cómo estás?');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      'Tu plantilla ya tiene un tema con ese nombre.',
    );
  });

  it('aislamiento: Marta no da de alta temas para la mentee de Diego', async () => {
    const res = await alta(DAVID_DIEGO, MARTA, 'formación');
    expect(res.status).toBe(404);
  });

  it('aislamiento: Diego no retira un tema de la mentee de Marta', async () => {
    const res = await alta(ANA_MARTA, MARTA, 'adaptación al equipo');
    const tema = (await res.json()) as TemaPropioApi;

    const baja = await retirar(ANA_MARTA, DIEGO, tema.id);
    expect(baja.status).toBe(404);
    // El tema sigue vigente para Marta.
    const temas = await temasDe(ANA_MARTA, MARTA);
    expect(temas.find((t) => t.id === tema.id)).toMatchObject({ estado: 'vigente' });
  });

  it('no retira un tema de Ana por la URL de otra mentee (acota por mentee)', async () => {
    const res = await alta(ANA_MARTA, MARTA, 'plan de carrera');
    const tema = (await res.json()) as TemaPropioApi;

    // Marta gestiona a Ana y a Beatriz; retirar el tema de Ana por la URL de Beatriz
    // debe fallar (404) y el tema seguir vigente para Ana.
    const baja = await retirar(BEA_MARTA, MARTA, tema.id);
    expect(baja.status).toBe(404);
    const temas = await temasDe(ANA_MARTA, MARTA);
    expect(temas.find((t) => t.id === tema.id)).toMatchObject({ estado: 'vigente' });
  });
});
