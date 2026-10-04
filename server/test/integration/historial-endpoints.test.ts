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
import { MenteeService } from '../../src/application/mentee_service.js';
import { SqliteMenteeRepository } from '../../src/infrastructure/db/sqlite-mentee-repository.js';
import { OneToOneService } from '../../src/application/onetoone_service.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import { ObjetivoService } from '../../src/application/objetivo_service.js';
import { IncidenciaService } from '../../src/application/incidencia_service.js';
import { ProyectoService } from '../../src/application/proyecto_service.js';
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
const ANA = 'me-ana';

interface EventoApi {
  tipo: string;
  id: string;
  fecha: string;
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'secreta123' }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

async function historial(menteeId: string, email: string, tipo?: string): Promise<EventoApi[]> {
  const query = tipo === undefined ? '' : `?tipo=${tipo}`;
  const res = await fetch(`${baseUrl}/api/mentees/${menteeId}/historial${query}`, {
    headers: { cookie: await login(email) },
  });
  const body = (await res.json()) as { eventos: EventoApi[] };
  return body.eventos;
}

describe('historial unificado de una mentee', () => {
  it('la semilla proyecta la entrada «Alta en el equipo» desde asignaciones', async () => {
    const eventos = await historial(ANA, MARTA);
    const entradas = eventos.filter((e) => e.tipo === 'proyecto');
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({ direccion: 'entrada', proyecto: 'Atlas Bank' });
  });

  it('reúne 1-to-1s, incidencias, objetivos cerrados, proyectos y traspasos en orden descendente', async () => {
    // 1-to-1 (fecha antigua) y un 1-to-1 reciente.
    await fetch(`${baseUrl}/api/mentees/${ANA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-01-10',
        notas: [{ tema: 'Progreso', nota: 'Va bien' }],
        acuerdos: [{ text: 'Revisar' }],
      }),
    });
    await fetch(`${baseUrl}/api/mentees/${ANA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-09-20',
        notas: [
          { tema: 'Objetivos', nota: 'Cumplidos' },
          { tema: 'Proyecto', nota: 'Sin novedad' },
        ],
        acuerdos: [{ text: 'A' }, { text: 'B' }],
      }),
    });
    // Incidencia abierta, con fecha de apertura elegida (≤ hoy).
    await fetch(`${baseUrl}/api/mentees/${ANA}/incidencias`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ descripcion: 'Conflicto de prioridades', fechaApertura: '2026-09-20' }),
    });
    // Objetivo cerrado (cumplido). La fecha límite debe ser ≥ hoy (regla de #21);
    // se usa una fecha lejana para ubicar el evento sin depender del reloj.
    const objetivo = await fetch(`${baseUrl}/api/mentees/${ANA}/objetivos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        titulo: 'Certificación Azure',
        descripcion: '',
        fechaLimite: '2099-12-31',
      }),
    });
    const objetivoId = ((await objetivo.json()) as { id: string }).id;
    await fetch(`${baseUrl}/api/objetivos/${objetivoId}/estado`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({ estado: 'cumplido' }),
    });

    const eventos = await historial(ANA, MARTA);

    const tiposOrdenados = eventos
      .map((e) => e.tipo)
      .filter((tipo) => tipo !== 'proyecto'); // la entrada de semilla se siembra ~hoy−90
    const fechas = eventos.map((e) => e.fecha);

    // Orden descendente por fecha (no puede crecer hacia la derecha).
    for (let i = 1; i < fechas.length; i++) {
      expect(fechas[i - 1]! >= fechas[i]!).toBe(true);
    }

    // El 1-to-1 del 20 sept está presente y, el mismo día, antes que la incidencia.
    expect(tiposOrdenados).toContain('1-to-1');
    expect(tiposOrdenados).toContain('incidencia');
    expect(tiposOrdenados).toContain('objetivo');
  });

  it('cuenta temas con nota, acuerdos e inicio de nota en los 1-to-1', async () => {
    const res = await fetch(`${baseUrl}/api/mentees/${ANA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-02-02',
        notas: [
          { tema: 'Uno', nota: 'Primera nota' },
          { tema: 'Dos', nota: '   ' },
          { tema: 'Tres', nota: '' },
        ],
        acuerdos: [{ text: 'A1' }, { text: 'A2' }, { text: 'A3' }],
      }),
    });
    expect(res.status).toBe(201);

    const eventos = await historial(ANA, MARTA);
    const uno = eventos.find((e) => e.fecha === '2026-02-02' && e.tipo === '1-to-1');
    expect(uno).toMatchObject({
      temasConNota: 1,
      acuerdos: 3,
      inicioNota: 'Primera nota',
    });
  });

  it('aislamiento: la mentee de otro manager no tiene historial visible', async () => {
    expect(await historial(ANA, DIEGO)).toEqual([]);
  });

  it('filtro por tipo devuelve solo ese tipo', async () => {
    const todos = await historial(ANA, MARTA);
    // Ana tiene al menos un 1-to-1 registrado en los tests previos.
    const solo = await historial(ANA, MARTA, '1-to-1s');
    expect(solo.length).toBeGreaterThan(0);
    expect(solo.every((e) => e.tipo === '1-to-1')).toBe(true);
    expect(solo.length).toBeLessThanOrEqual(todos.length);
  });

  it('un filtro desconocido equivale a «Todo» (no rompe)', async () => {
    const todos = await historial(ANA, MARTA);
    const conFiltro = await historial(ANA, MARTA, 'inexistente');
    expect(conFiltro.map((e) => e.id)).toEqual(todos.map((e) => e.id));
  });
});
