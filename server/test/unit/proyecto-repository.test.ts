import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SqliteProyectoRepository } from '../../src/infrastructure/db/sqlite-proyecto-repository.js';
import { cleanupTempDirs, tempDbPath } from '../helpers/tempdb.js';

const dbs: Database[] = [];

afterAll(() => {
  for (const db of dbs) db.close();
  cleanupTempDirs();
});

const MARTA = 'seed-manager-1';
const DIEGO = 'seed-manager-2';
const ANA = 'me-ana';
const DAVID = 'me-david';
const HUGO = 'me-hugo';

function repos(): SqliteProyectoRepository {
  const db = openDatabase(tempDbPath());
  seed(db);
  dbs.push(db);
  return new SqliteProyectoRepository(db);
}

describe('catálogo de proyectos', () => {
  it('lista el catálogo ordenado por nombre', async () => {
    const repo = repos();

    const proyectos = await repo.proyectos();
    expect(proyectos.map((p) => p.name)).toEqual([
      'Atlas Bank',
      'Aurora Health',
      'Campus EdTech',
      'Green Energy',
      'Retail Nova',
    ]);
  });

  it('da de alta un proyecto y lo añade al catálogo', async () => {
    const repo = repos();

    const nuevo = await repo.addProyecto('Nueva Cuenta');

    expect(nuevo).toMatchObject({ id: expect.any(String), name: 'Nueva Cuenta' });
    await expect(repo.proyectos()).resolves.toContainEqual(
      expect.objectContaining({ id: nuevo.id, name: 'Nueva Cuenta', estado: 'vigente', fechaRetirada: null }),
    );
  });

  it('rechaza un nombre de proyecto repetido', async () => {
    const repo = repos();

    await expect(repo.addProyecto('Atlas Bank')).rejects.toThrow(/Ya existe/);
  });

  it('cuenta cada asignación vigente, incluidas las de otros managers, sin contar salidas pasadas', async () => {
    const repo = repos();
    const primero = await repo.addProyecto('Recuento A');
    const segundo = await repo.addProyecto('Recuento B');
    const entrada = { desde: '2026-09-27', motivoEntrada: 'Prueba' };
    await repo.entrarEnProyecto(MARTA, ANA, { ...entrada, proyecto: primero.id });
    await repo.entrarEnProyecto(MARTA, ANA, { ...entrada, proyecto: segundo.id });
    await repo.entrarEnProyecto(DIEGO, DAVID, { ...entrada, proyecto: primero.id });
    await repo.entrarEnProyecto('seed-manager-3', HUGO, { ...entrada, proyecto: segundo.id });
    await repo.salirDeProyecto('seed-manager-3', HUGO, segundo.id, { hasta: '2026-09-28', motivoSalida: 'Fin' });
    const catalogo = await repo.proyectos();
    expect(catalogo.find((p) => p.id === primero.id)?.numMentees).toBe(2);
    expect(catalogo.find((p) => p.id === segundo.id)?.numMentees).toBe(1);
    await repo.salirDeProyecto(MARTA, ANA, segundo.id, { hasta: '2026-09-28', motivoSalida: 'Fin' });
    expect((await repo.proyectos()).find((p) => p.id === segundo.id)?.numMentees).toBe(0);
  });
});

describe('historial y registro de cambios de proyecto', () => {
  it('la situación inicial es el proyecto de la semilla sin cambios', async () => {
    const repo = repos();

    await expect(repo.situacionDe(MARTA, ANA)).resolves.toEqual({
      project: { id: 'pr-atlas', name: 'Atlas Bank' },
      cambios: [],
    });
  });

  it('registra un cambio: actualiza el proyecto actual y lo añade al historial', async () => {
    const repo = repos();

    const cambio = await repo.registrarCambio(MARTA, ANA, {
      fecha: '2026-09-27',
      destinoId: 'pr-nova',
      motivo: 'Rotación',
    });

    expect(cambio).toMatchObject({
      id: expect.any(String),
      menteeId: ANA,
      fecha: '2026-09-27',
      origenId: 'pr-atlas',
      destinoId: 'pr-nova',
      motivo: 'Rotación',
    });

    const situacion = await repo.situacionDe(MARTA, ANA);
    expect(situacion.project).toEqual({ id: 'pr-nova', name: 'Retail Nova' });
    expect(situacion.cambios).toEqual([cambio]);
  });

  it('puede dejar a la mentee sin proyecto', async () => {
    const repo = repos();

    const cambio = await repo.registrarCambio(MARTA, ANA, {
      fecha: '2026-09-27',
      destinoId: null,
      motivo: 'Fin de proyecto',
    });

    expect(cambio).toMatchObject({ origenId: 'pr-atlas', destinoId: null });
    const situacion = await repo.situacionDe(MARTA, ANA);
    expect(situacion.project).toBeNull();
  });

  it('rechaza un cambio que no cambia de proyecto', async () => {
    const repo = repos();

    await expect(
      repo.registrarCambio(MARTA, ANA, { fecha: '2026-09-27', destinoId: 'pr-atlas', motivo: 'Sin cambio' }),
    ).rejects.toThrow(/distinto/);
  });

  it('rechaza un destino que no existe', async () => {
    const repo = repos();

    await expect(
      repo.registrarCambio(MARTA, ANA, { fecha: '2026-09-27', destinoId: 'pr-fantasma', motivo: 'Error' }),
    ).rejects.toThrow(/no encontrado/);
  });

  it('un cambio legado hacia un proyecto ya vigente no crea una segunda entrada', async () => {
    const repo = repos();

    // Ana entra en Nova con fecha antigua, de modo que Atlas (entrada de la
    // semilla, más reciente) siga siendo su proyecto actual.
    await repo.entrarEnProyecto(MARTA, ANA, {
      proyecto: 'pr-nova',
      desde: '2020-01-01',
      motivoEntrada: 'Apoyo',
    });

    // El cambio legado (Atlas → Nova) cerraría Atlas y crearía una segunda
    // asignación vigente a Nova; la regla de dominio lo rechaza y revierte todo.
    await expect(
      repo.registrarCambio(MARTA, ANA, { fecha: '2026-09-27', destinoId: 'pr-nova', motivo: 'Rotación' }),
    ).rejects.toThrow(/ya está/);

    const situacion = await repo.situacionDe(MARTA, ANA);
    expect(situacion.project).toEqual({ id: 'pr-atlas', name: 'Atlas Bank' });
    expect(situacion.cambios).toEqual([]);
  });
});

describe('entrar y salir de proyectos (asignaciones)', () => {
  it('entrar crea una asignación vigente y rechaza entrar dos veces', async () => {
    const repo = repos();

    const entrada = await repo.entrarEnProyecto(MARTA, ANA, {
      proyecto: 'pr-green',
      desde: '2026-09-01',
      motivoEntrada: 'Apoyo',
    });

    expect(entrada).toEqual({
      mentee: ANA,
      proyecto: 'pr-green',
      desde: '2026-09-01',
      motivoEntrada: 'Apoyo',
      hasta: null,
      motivoSalida: null,
    });

    await expect(
      repo.entrarEnProyecto(MARTA, ANA, { proyecto: 'pr-green', desde: '2026-10-01', motivoEntrada: 'Otra' }),
    ).rejects.toThrow(/ya está/);
  });

  it('salir cierra la asignación vigente; salir del último deja sin proyecto', async () => {
    const repo = repos();

    const salida = await repo.salirDeProyecto(MARTA, ANA, 'pr-atlas', {
      hasta: '2026-09-30',
      motivoSalida: 'Fin',
    });

    expect(salida).toMatchObject({ mentee: ANA, proyecto: 'pr-atlas', hasta: '2026-09-30', motivoSalida: 'Fin' });
    const situacion = await repo.situacionDe(MARTA, ANA);
    expect(situacion.project).toBeNull();
  });

  it('salir rechaza una fecha de salida anterior a la entrada', async () => {
    const repo = repos();

    await repo.entrarEnProyecto(MARTA, ANA, { proyecto: 'pr-green', desde: '2026-09-01', motivoEntrada: 'Apoyo' });

    await expect(
      repo.salirDeProyecto(MARTA, ANA, 'pr-green', { hasta: '2026-08-31', motivoSalida: 'Error' }),
    ).rejects.toThrow(/anterior/);
  });

  it('salir de un proyecto en el que no está rebota', async () => {
    const repo = repos();

    await expect(
      repo.salirDeProyecto(MARTA, ANA, 'pr-green', { hasta: '2026-09-30', motivoSalida: 'No está' }),
    ).rejects.toThrow(/no está/);
  });

  it('desde sin proyecto, un cambio solo genera la entrada (y al revés)', async () => {
    const repo = repos();

    await repo.registrarCambio(MARTA, ANA, { fecha: '2026-09-25', destinoId: null, motivo: 'Fin' });
    expect((await repo.situacionDe(MARTA, ANA)).project).toBeNull();

    const cambio = await repo.registrarCambio(MARTA, ANA, {
      fecha: '2026-09-27',
      destinoId: 'pr-green',
      motivo: 'Alta',
    });
    expect(cambio.origenId).toBeNull();
    expect((await repo.situacionDe(MARTA, ANA)).project).toEqual({ id: 'pr-green', name: 'Green Energy' });
  });
});

describe('retirar y reactivar proyectos', () => {
  it('rechaza retirar un proyecto con asignaciones vigentes', async () => {
    const repo = repos();

    await expect(repo.retirarProyecto('pr-atlas')).rejects.toThrow(/asignaciones vigentes/);
  });

  it('retira un proyecto sin asignaciones y reactivar lo devuelve', async () => {
    const repo = repos();

    const nuevo = await repo.addProyecto('Proyecto Nuevo');
    const retirado = await repo.retirarProyecto(nuevo.id);
    expect(retirado).toMatchObject({ id: nuevo.id, estado: 'retirado' });
    expect(retirado.fechaRetirada).toBe(new Date().toISOString().slice(0, 10));

    const catalogo = await repo.proyectos();
    expect(catalogo.find((p) => p.id === nuevo.id)?.estado).toBe('retirado');

    const reactivado = await repo.reactivarProyecto(nuevo.id);
    expect(reactivado).toEqual({ id: nuevo.id, estado: 'vigente', fechaRetirada: null });
  });

  it('rechaza retirar uno ya retirado y reactivar uno vigente', async () => {
    const repo = repos();

    const nuevo = await repo.addProyecto('Proyecto Nuevo');
    await repo.retirarProyecto(nuevo.id);
    await expect(repo.retirarProyecto(nuevo.id)).rejects.toThrow(/vigente/);

    const otro = await repo.addProyecto('Otro');
    await expect(repo.reactivarProyecto(otro.id)).rejects.toThrow(/retirado/);
  });
});

describe('aislamiento por manager', () => {
  it('no registra un cambio para una mentee de otro manager', async () => {
    const repo = repos();

    await expect(
      repo.registrarCambio(MARTA, DAVID, { fecha: '2026-09-27', destinoId: 'pr-atlas', motivo: 'Intruso' }),
    ).rejects.toThrow(/no pertenece/);
  });

  it('otro manager no ve la situación ni los cambios de la mentee', async () => {
    const repo = repos();
    await repo.registrarCambio(MARTA, ANA, { fecha: '2026-09-27', destinoId: 'pr-nova', motivo: 'Rotación' });

    await expect(repo.situacionDe(DIEGO, ANA)).resolves.toEqual({ project: null, cambios: [] });
  });
});
