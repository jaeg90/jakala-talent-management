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

/** Mentees de Marta: Ana, Beatriz y Carla. David es de Diego. */
const ANA = 'me-ana';
const BEA = 'me-bea';
const CARLA = 'me-carla';
const DAVID = 'me-david';

async function teamOf(email: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${baseUrl}/api/team`, { headers: { cookie: await login(email) } });
  const body = (await res.json()) as { mentees: { id: string; name: string }[] };
  return body.mentees;
}

async function traspasar(
  menteeId: string,
  email: string,
  body: { fecha: string; destinoId: string; motivo: string },
): Promise<Response> {
  return fetch(`${baseUrl}/api/mentees/${menteeId}/traspasos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await login(email) },
    body: JSON.stringify(body),
  });
}

describe('GET /api/managers', () => {
  it('lista el catálogo de managers para elegir destino', async () => {
    const res = await fetch(`${baseUrl}/api/managers`, { headers: { cookie: await login(MARTA) } });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { managers: { id: string; email: string; name: string }[] };
    expect(body.managers.map((m) => m.name)).toEqual([
      'Diego Domínguez',
      'Julia Jiménez',
      'Lucía López',
      'Marta Manager',
    ]);
  });

  it('no expone el flag de contraseña temporal en el catálogo', async () => {
    const res = await fetch(`${baseUrl}/api/managers`, { headers: { cookie: await login(MARTA) } });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      managers: Array<Record<string, unknown>>;
    };
    for (const manager of body.managers) {
      expect(Object.keys(manager).sort()).toEqual(['email', 'id', 'name']);
      expect(manager).not.toHaveProperty('debeCambiarContraseña');
    }
  });
});

describe('POST /api/mentees/:id/traspasos', () => {
  it('rechaza un traspaso al mismo manager con 409', async () => {
    const res = await traspasar(CARLA, MARTA, {
      fecha: '2026-09-27',
      destinoId: 'seed-manager-1',
      motivo: 'Sin cambio',
    });

    expect(res.status).toBe(409);
  });

  it('rechaza un traspaso sin motivo con 400', async () => {
    const res = await traspasar(CARLA, MARTA, {
      fecha: '2026-09-27',
      destinoId: 'seed-manager-2',
      motivo: '   ',
    });

    expect(res.status).toBe(400);
  });

  it('aislamiento: Marta no traspasa la mentee de Diego (404)', async () => {
    const res = await traspasar(DAVID, MARTA, {
      fecha: '2026-09-27',
      destinoId: 'seed-manager-1',
      motivo: 'Intruso',
    });

    expect(res.status).toBe(404);
  });

  it('traspasa a la mentee y queda bajo un único manager', async () => {
    const res = await traspasar(ANA, MARTA, {
      fecha: '2026-09-27',
      destinoId: 'seed-manager-2',
      motivo: 'Reorganización',
    });

    expect(res.status).toBe(201);
    const traspaso = (await res.json()) as {
      menteeId: string;
      origenId: string;
      destinoId: string;
      fecha: string;
      motivo: string;
    };
    expect(traspaso).toMatchObject({
      menteeId: ANA,
      origenId: 'seed-manager-1',
      destinoId: 'seed-manager-2',
      fecha: '2026-09-27',
      motivo: 'Reorganización',
    });

    const equipoMarta = await teamOf(MARTA);
    const equipoDiego = await teamOf(DIEGO);
    expect(equipoMarta.map((m) => m.id)).not.toContain(ANA);
    expect(equipoDiego.map((m) => m.id)).toContain(ANA);
  });

  it('el destino hereda el historial íntegro (1-to-1s) y el origen deja de verlo', async () => {
    // 1-to-1 registrado por Marta antes del traspaso.
    await fetch(`${baseUrl}/api/mentees/${BEA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-09-20',
        notas: [{ tema: '¿Cómo estás?', nota: 'Animada' }],
        acuerdos: [{ text: 'Preparar dossier' }],
      }),
    });

    const res = await traspasar(BEA, MARTA, {
      fecha: '2026-09-27',
      destinoId: 'seed-manager-2',
      motivo: 'Reorganización',
    });
    expect(res.status).toBe(201);

    const fichaDiego = await fetch(`${baseUrl}/api/mentees/${BEA}/onetoones`, {
      headers: { cookie: await login(DIEGO) },
    });
    const fichaMarta = await fetch(`${baseUrl}/api/mentees/${BEA}/onetoones`, {
      headers: { cookie: await login(MARTA) },
    });

    const deDiego = (await fichaDiego.json()) as { history: { date: string }[] };
    const deMarta = (await fichaMarta.json()) as { history: unknown[] };
    expect(deDiego.history.map((h) => h.date)).toContain('2026-09-20');
    expect(deMarta.history).toEqual([]);
  });

  it('registra el traspaso en el historial visible para el destino', async () => {
    await traspasar(CARLA, MARTA, { fecha: '2026-09-27', destinoId: 'seed-manager-2', motivo: 'Reorganización' });

    const res = await fetch(`${baseUrl}/api/mentees/${CARLA}/traspasos`, {
      headers: { cookie: await login(DIEGO) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { traspasos: { motivo: string }[] };
    expect(body.traspasos.map((t) => t.motivo)).toContain('Reorganización');
  });
});