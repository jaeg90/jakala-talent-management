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

/** Ana es de Marta; David es de Diego. */
const ANA_MARTA = 'me-ana';
const DAVID_DIEGO = 'me-david';
// Beatriz es de Marta y no participa en las demás aserciones de esta suite:
// se usa para los 1-to-1s del mismo día sin contaminar el historial de Ana.
const BEA_MARTA = 'me-bea';

const ONETOONE_ANA = {
  date: '2026-09-20',
  notas: [
    { tema: '¿Cómo estás?', nota: 'Animada, con ganas' },
    { tema: '¿Qué tal el proyecto?', nota: 'Atlas Bank va bien' },
    { tema: '¿Qué tal los objetivos?', nota: 'Objetivo 1 en curso' },
  ],
  acuerdos: [{ text: 'Preparar dossier de Atlas Bank' }],
};

describe('POST /api/mentees/:id/onetoones', () => {
  it('registra el 1-to-1 con notas y acuerdos pendientes', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify(ONETOONE_ANA),
    });

    expect(res.status).toBe(201);
    const saved = (await res.json()) as {
      date: string;
      notas: { tema: string; nota: string }[];
      acuerdos: { text: string; done: boolean }[];
      registradoPor: string;
      registradoEn: string;
    };
    expect(saved.date).toBe('2026-09-20');
    expect(saved.notas).toHaveLength(3);
    expect(saved.acuerdos).toEqual([{ id: expect.any(String), text: 'Preparar dossier de Atlas Bank', date: '2026-09-20', done: false }]);
    // Persistencia [v2]: guarda quién lo registró y cuándo (base del plazo de #35).
    expect(saved.registradoPor).toBe('seed-manager-1');
    expect(saved.registradoEn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('permite varios 1-to-1s el mismo día (los identifica el id, no la fecha)', async () => {
    const cookie = await login(MARTA);
    const cuerpo = {
      date: '2026-10-03',
      notas: [{ tema: '¿Cómo estás?', nota: 'Primero del día' }],
      acuerdos: [{ text: 'Acuerdo del primero' }],
    };
    const primero = await fetch(`${baseUrl}/api/mentees/${BEA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(cuerpo),
    });
    const segundo = await fetch(`${baseUrl}/api/mentees/${BEA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        ...cuerpo,
        notas: [{ tema: '¿Cómo estás?', nota: 'Segundo del día' }],
        acuerdos: [{ text: 'Acuerdo del segundo' }],
      }),
    });
    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(201);
    const idA = ((await primero.json()) as { id: string }).id;
    const idB = ((await segundo.json()) as { id: string }).id;
    expect(idA).not.toBe(idB);

    const ficha = await fetch(`${baseUrl}/api/mentees/${BEA_MARTA}/onetoones`, {
      headers: { cookie },
    });
    const { history } = (await ficha.json()) as { history: { id: string; date: string }[] };
    const delDia = history.filter((h) => h.date === '2026-10-03');
    expect(delDia).toHaveLength(2);
  });

  it('aislamiento: Marta no puede registrar un 1-to-1 para la mentee de Diego', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${DAVID_DIEGO}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify(ONETOONE_ANA),
    });

    expect(res.status).toBe(404);
  });

  it('rechaza dos notas del mismo tema', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-09-21',
        notas: [
          { tema: '¿Cómo estás?', nota: 'Bien' },
          { tema: '¿Cómo estás?', nota: 'Duplicada' },
        ],
        acuerdos: [],
      }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('duplicado');
  });

  it('rechaza una fecha vacía', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '',
        notas: [{ tema: '¿Cómo estás?', nota: 'Bien' }],
        acuerdos: [],
      }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('Elige una fecha.');
  });

  it('rechaza una fecha no ISO', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-02-30',
        notas: [{ tema: '¿Cómo estás?', nota: 'Bien' }],
        acuerdos: [],
      }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('ISO');
  });

  it('rechaza una fecha futura', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2999-12-31',
        notas: [{ tema: '¿Cómo estás?', nota: 'Bien' }],
        acuerdos: [],
      }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('La fecha no puede ser futura.');
  });

  it('rechaza un 1-to-1 sin notas ni acuerdos', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-09-28',
        notas: [{ tema: '¿Cómo estás?', nota: '   ' }],
        acuerdos: [],
      }),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      'Escribe al menos una nota o un acuerdo antes de guardar.',
    );
  });
});

describe('GET /api/mentees/:id/onetoones', () => {
  it('devuelve historial cronológico y acuerdos pendientes', async () => {
    // Segundo 1-to-1 de Ana, anterior en fecha al ya registrado
    await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-09-10',
        notas: [{ tema: '¿Cómo estás?', nota: 'Al inicio del mes' }],
        acuerdos: [],
      }),
    });

    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      headers: { cookie: await login(MARTA) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      history: { date: string }[];
      pending: { text: string; done: boolean }[];
    };
    expect(body.history.map((h) => h.date)).toEqual(['2026-09-10', '2026-09-20']);
    expect(body.pending.map((p) => p.text)).toEqual(['Preparar dossier de Atlas Bank']);
  });

  it('aislamiento: Diego no ve el historial de la mentee de Marta', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      headers: { cookie: await login(DIEGO) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { history: unknown[] };
    expect(body.history).toEqual([]);
  });
});

describe('POST /api/acuerdos/:id/complete', () => {
  it('marca un acuerdo cumplido y desaparece de pendientes', async () => {
    const ficha = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      headers: { cookie: await login(MARTA) },
    });
    const { pending } = (await ficha.json()) as { pending: { id: string }[] };
    const acuerdoId = pending[0]!.id;

    const complete = await fetch(`${baseUrl}/api/acuerdos/${acuerdoId}/complete`, {
      method: 'POST',
      headers: { cookie: await login(MARTA) },
    });
    expect(complete.status).toBe(204);

    const despues = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      headers: { cookie: await login(MARTA) },
    });
    expect(((await despues.json()) as { pending: unknown[] }).pending).toEqual([]);
  });

  it('aislamiento: Diego no puede cumplir el acuerdo de la mentee de Marta', async () => {
    // Registrado por Marta en el primer test de esta suite; a pesar de haberse
    // cumplido ya, otro acuerdo nuevo sirve para el aislamiento.
    const res = await fetch(`${baseUrl}/api/mentees/${ANA_MARTA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-09-25',
        notas: [],
        acuerdos: [{ text: 'Otro acuerdo de prueba' }],
      }),
    });
    const saved = (await res.json()) as { acuerdos: { id: string }[] };
    const acuerdoId = saved.acuerdos[0]!.id;

    const intento = await fetch(`${baseUrl}/api/acuerdos/${acuerdoId}/complete`, {
      method: 'POST',
      headers: { cookie: await login(DIEGO) },
    });

    expect(intento.status).toBe(404);
  });
});
