import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SeedAuthenticator } from '../../src/infrastructure/auth/seed-authenticator.js';
import { SqliteTeamRepository } from '../../src/infrastructure/db/sqlite-team-repository.js';
import { SqlitePlantillaRepository } from '../../src/infrastructure/db/sqlite-plantilla-repository.js';
import { SqliteCuentaRepository } from '../../src/infrastructure/db/sqlite-cuenta-repository.js';
import { SqliteHistorialRepository } from '../../src/infrastructure/db/sqlite-historial-repository.js';
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
import { SqliteOneToOneRepository } from '../../src/infrastructure/db/sqlite-onetoone-repository.js';
import { SqliteTemaPropioRepository } from '../../src/infrastructure/db/sqlite-tema-propio-repository.js';
import { SqliteObjetivoRepository } from '../../src/infrastructure/db/sqlite-objetivo-repository.js';
import { SqliteIncidenciaRepository } from '../../src/infrastructure/db/sqlite-incidencia-repository.js';
import { SqliteProyectoRepository } from '../../src/infrastructure/db/sqlite-proyecto-repository.js';
import { SqliteTraspasoRepository } from '../../src/infrastructure/db/sqlite-traspaso-repository.js';
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

interface TemaApi {
  id: string;
  managerId: string;
  tema: string;
  orden: number;
  estado: 'vigente' | 'retirado';
}

async function plantillaDe(email: string): Promise<TemaApi[]> {
  const res = await fetch(`${baseUrl}/api/plantilla`, {
    headers: { cookie: await login(email) },
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { temas: TemaApi[] }).temas;
}

async function accion(email: string, path: string, method = 'POST', body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: await login(email) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('plantilla de 1-to-1 por manager', () => {
  it('una cuenta nueva nace con los tres temas iniciales, vigentes y en orden', async () => {
    const temas = await plantillaDe(MARTA);
    expect(temas.map((t) => t.tema)).toEqual([
      '¿Cómo estás?',
      '¿Qué tal el proyecto?',
      '¿Qué tal los objetivos?',
    ]);
    expect(temas.every((t) => t.estado === 'vigente')).toBe(true);
    expect(temas.map((t) => t.orden)).toEqual([0, 1, 2]);
  });

  it('cada manager tiene su propia plantilla', async () => {
    // Diego también nace con la inicial; editar la de Marta no toca la de Diego.
    const [martaA, martaB] = await plantillaDe(MARTA);

    const edit = await accion(MARTA, `/api/plantilla/temas/${martaA!.id}`, 'PATCH', {
      tema: '¿Qué tal la semana?',
    });
    expect(edit.status).toBe(200);

    const diego = await plantillaDe(DIEGO);
    expect(diego.find((t) => t.id === martaA!.id)).toBeUndefined();
    expect(diego.map((t) => t.tema)).toEqual([
      '¿Cómo estás?',
      '¿Qué tal el proyecto?',
      '¿Qué tal los objetivos?',
    ]);
    // Marta conserva el resto de su plantilla intacta.
    const marta = await plantillaDe(MARTA);
    expect(marta.find((t) => t.id === martaB!.id)?.tema).toBe('¿Qué tal el proyecto?');
  });

  it('añade un tema al final, edita texto y lo mueve', async () => {
    const creado = await accion(MARTA, '/api/plantilla/temas', 'POST', { tema: 'Formación' });
    expect(creado.status).toBe(201);
    const tema = (await creado.json()) as TemaApi;
    expect(tema.estado).toBe('vigente');

    const editado = await accion(MARTA, `/api/plantilla/temas/${tema.id}`, 'PATCH', {
      tema: 'Formación continua',
    });
    expect(editado.status).toBe(200);
    expect(((await editado.json()) as TemaApi).tema).toBe('Formación continua');

    // Baja una posición; el tema recién creado estaba al final.
    const mover = await accion(MARTA, `/api/plantilla/temas/${tema.id}/mover`, 'POST', { delta: -1 });
    expect(mover.status).toBe(200);
    const plantilla = ((await mover.json()) as { temas: TemaApi[] }).temas;
    expect(plantilla.filter((t) => t.estado === 'vigente').map((t) => t.tema)).toEqual([
      '¿Qué tal la semana?',
      '¿Qué tal el proyecto?',
      'Formación continua',
      '¿Qué tal los objetivos?',
    ]);
  });

  it('rechaza un movimiento con delta no válido', async () => {
    const temas = await plantillaDe(MARTA);
    const res = await accion(MARTA, `/api/plantilla/temas/${temas[0]!.id}/mover`, 'POST', { delta: 0 });
    expect(res.status).toBe(400);
  });

  it('no se puede retirar el último tema vigente (error de dominio)', async () => {
    // Diego aún tiene la plantilla inicial de 3; retira dos y luego el último.
    let temas = await plantillaDe(DIEGO);
    for (const t of temas.slice(0, 2)) {
      const res = await accion(DIEGO, `/api/plantilla/temas/${t!.id}/retirar`);
      expect(res.status).toBe(200);
    }
    temas = await plantillaDe(DIEGO);
    const unico = temas.find((t) => t.estado === 'vigente')!;
    const res = await accion(DIEGO, `/api/plantilla/temas/${unico.id}/retirar`);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain('último');
  });

  it('retira un tema, lo reactiva y restablece la plantilla inicial', async () => {
    const temas = await plantillaDe(MARTA);
    const primero = temas.find((t) => t.estado === 'vigente')!;

    const retirar = await accion(MARTA, `/api/plantilla/temas/${primero.id}/retirar`);
    expect(retirar.status).toBe(200);
    expect(((await retirar.json()) as TemaApi).estado).toBe('retirado');

    const reactivar = await accion(MARTA, `/api/plantilla/temas/${primero.id}/reactivar`);
    expect(reactivar.status).toBe(200);
    expect(((await reactivar.json()) as TemaApi).estado).toBe('vigente');

    const restablecer = await accion(MARTA, '/api/plantilla/restablecer');
    expect(restablecer.status).toBe(200);
    const plantilla = ((await restablecer.json()) as { temas: TemaApi[] }).temas;
    // Los tres temas iniciales vuelven a estar vigentes, en su orden original.
    expect(plantilla.filter((t) => t.estado === 'vigente').map((t) => t.tema)).toEqual([
      '¿Cómo estás?',
      '¿Qué tal el proyecto?',
      '¿Qué tal los objetivos?',
    ]);
    // Los temas que había antes no se pierden: pasan a retirados y se pueden volver a usar.
    expect(plantilla.filter((t) => t.estado === 'retirado').map((t) => t.tema).sort()).toEqual([
      'Formación continua',
      '¿Qué tal la semana?',
    ].sort());
  });

  it('aislamiento: Diego no puede editar la plantilla de Marta', async () => {
    const temas = await plantillaDe(MARTA);
    const res = await accion(DIEGO, `/api/plantilla/temas/${temas[0]!.id}`, 'PATCH', {
      tema: 'Intruso',
    });
    expect(res.status).toBe(404);
  });

  it('editar la plantilla no altera los 1-to-1s ya registrados', async () => {
    const ANA = 'me-ana';
    // Registra un 1-to-1 con la plantilla actual de Marta.
    await fetch(`${baseUrl}/api/mentees/${ANA}/onetoones`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await login(MARTA) },
      body: JSON.stringify({
        date: '2026-09-20',
        notas: [{ tema: '¿Cómo estás?', nota: 'Animada' }],
        acuerdos: [],
      }),
    });
    // Retira el tema «¿Cómo estás?» de la plantilla de Marta.
    const temas = await plantillaDe(MARTA);
    const objetivo = temas.find((t) => t.tema === '¿Cómo estás?')!;
    await accion(MARTA, `/api/plantilla/temas/${objetivo.id}/retirar`);

    // El historial conserva la nota tal como se registró.
    const res = await fetch(`${baseUrl}/api/mentees/${ANA}/onetoones`, {
      headers: { cookie: await login(MARTA) },
    });
    const body = (await res.json()) as { history: { notas: { tema: string; nota: string; propio: boolean }[] }[] };
    expect(body.history[0]!.notas).toEqual([{ tema: '¿Cómo estás?', nota: 'Animada', propio: false }]);
  });
});
