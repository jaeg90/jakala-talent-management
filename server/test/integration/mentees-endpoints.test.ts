import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { buildApp } from '../helpers/app.js';
import { cleanupTempDirs } from '../helpers/tempdb.js';
import { hoyISO } from '../../src/domain/fechas.js';
import type { MenteeDeEquipo } from '../../src/domain/model.js';
import type { EventoHistorial } from '../../src/domain/historial.js';

const { app, db } = buildApp();
let server: Server;
let baseUrl: string;
let cookie: string;

beforeAll(async () => {
  server = app.listen(0);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('sin puerto');
  baseUrl = `http://127.0.0.1:${address.port}`;
  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'manager@jakala.example', password: 'secreta123' }),
  });
  cookie = login.headers.get('set-cookie')!.split(';')[0]!;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  cleanupTempDirs();
});

function alta(data: unknown, sesion = cookie) {
  return fetch(`${baseUrl}/api/mentees`, {
    method: 'POST', headers: { cookie: sesion, 'content-type': 'application/json' }, body: JSON.stringify(data),
  });
}

describe('POST /api/mentees', () => {
  it.each([{ proyectos: ['pr-atlas', 'pr-aurora'] }, { proyectos: [] }])('alta con $proyectos, señales vacías y eventos derivados', async ({ proyectos }) => {
    const res = await alta({ name: ' Irene Iglesias ', proyectos, enEquipoDesde: '2026-01-15', managerId: 'seed-manager-2' });
    expect(res.status).toBe(201);
    const nueva = await res.json() as { id: string; name: string; managerId: string; enEquipoDesde: string };
    expect(nueva).toMatchObject({ name: 'Irene Iglesias', managerId: 'seed-manager-1', enEquipoDesde: '2026-01-15' });
    const team = await fetch(`${baseUrl}/api/team`, { headers: { cookie } });
    const { mentees } = await team.json() as { mentees: MenteeDeEquipo[] };
    expect(mentees.find((m) => m.id === nueva.id)).toMatchObject({
      enEquipoDesde: '2026-01-15', proyectos: proyectos.length ? ['Atlas Bank', 'Aurora Health'] : [],
      acuerdosPendientes: 0, incidenciasAbiertas: 0, objetivosEnCurso: 0, ultimoUnoAUno: null,
    });
    const feed = await fetch(`${baseUrl}/api/mentees/${nueva.id}/historial`, { headers: { cookie } });
    const { eventos } = await feed.json() as { eventos: EventoHistorial[] };
    expect(eventos).toHaveLength(proyectos.length);
    for (const evento of eventos) {
      expect(evento).toMatchObject({ tipo: 'proyecto', direccion: 'entrada', fecha: '2026-01-15', motivo: 'Alta en el equipo' });
    }
    expect(eventos.map((e) => e.tipo === 'proyecto' ? e.proyecto : '').sort()).toEqual(proyectos.length ? ['Atlas Bank', 'Aurora Health'] : []);
    const ficha = await fetch(`${baseUrl}/api/mentees/${nueva.id}/onetoones`, { headers: { cookie } });
    expect(await ficha.json()).toEqual({ history: [], pending: [] });
  });

  it('admite hoy, sin duplicar una entrada si la API repite un proyecto', async () => {
    const res = await alta({ name: 'Alta hoy', proyectos: ['pr-atlas', 'pr-atlas'], enEquipoDesde: hoyISO() });
    expect(res.status).toBe(201);
    const nueva = await res.json() as { id: string };
    expect(db.prepare('SELECT * FROM asignaciones WHERE mentee_id = ?').all(nueva.id)).toHaveLength(1);
  });

  it('rechaza fechas futuras en dominio, sin crear datos', async () => {
    const res = await alta({ name: 'Futura', proyectos: [], enEquipoDesde: '2999-01-01' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'La fecha no puede ser futura.' });
    expect(db.prepare("SELECT * FROM mentees WHERE name = 'Futura'").all()).toHaveLength(0);
  });

  it.each(['', '2026-02-30'])('rechaza fecha inválida %s', async (enEquipoDesde) => {
    expect((await alta({ name: 'Inválida', proyectos: [], enEquipoDesde })).status).toBe(400);
  });

  it('rechaza nombre vacío, estructura incorrecta y sesión ausente', async () => {
    expect((await alta({ name: ' ', proyectos: [], enEquipoDesde: hoyISO() })).status).toBe(400);
    for (const proyectos of [null, 'pr-atlas', [3]]) {
      expect((await alta({ name: 'Inválida', proyectos, enEquipoDesde: hoyISO() })).status).toBe(400);
    }
    expect((await alta({ name: 'Sin sesión', proyectos: [], enEquipoDesde: hoyISO() }, '')).status).toBe(401);
  });

  it('un proyecto inexistente o retirado no deja un alta parcial', async () => {
    db.prepare("INSERT INTO projects (id, name, fecha_retirada) VALUES ('retirado', 'Retirado', '2026-01-01')").run();
    const antes = db.prepare('SELECT COUNT(*) AS n FROM mentees').get();
    const asignacionesAntes = db.prepare('SELECT COUNT(*) AS n FROM asignaciones').get();
    for (const id of ['inexistente', 'retirado']) {
      const res = await alta({ name: 'No debe crearse', proyectos: ['pr-atlas', id], enEquipoDesde: hoyISO() });
      expect(res.status).toBe(400);
    }
    expect(db.prepare('SELECT COUNT(*) AS n FROM mentees').get()).toEqual(antes);
    expect(db.prepare('SELECT COUNT(*) AS n FROM asignaciones').get()).toEqual(asignacionesAntes);
  });
});
