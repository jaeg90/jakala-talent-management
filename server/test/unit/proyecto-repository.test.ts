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
    await expect(repo.proyectos()).resolves.toContainEqual(nuevo);
  });

  it('rechaza un nombre de proyecto repetido', async () => {
    const repo = repos();

    await expect(repo.addProyecto('Atlas Bank')).rejects.toThrow(/Ya existe/);
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
});

describe('quién está en cada proyecto', () => {
  it('agrupa los mentees del manager por proyecto, en orden', async () => {
    const repo = repos();

    const grupos = await repo.miembrosPorProyecto(MARTA);

    expect(grupos).toEqual([
      { projectId: 'pr-atlas', projectName: 'Atlas Bank', mentees: [{ id: 'me-ana', name: 'Ana Alonso' }] },
      { projectId: 'pr-aurora', projectName: 'Aurora Health', mentees: [{ id: 'me-carla', name: 'Carla Cano' }] },
      { projectId: 'pr-nova', projectName: 'Retail Nova', mentees: [{ id: 'me-bea', name: 'Beatriz Blanco' }] },
    ]);
  });

  it('el mentee sin proyecto agrupa bajo "sin proyecto"', async () => {
    const repo = repos();

    const grupos = await repo.miembrosPorProyecto('seed-manager-3');

    const sinProyecto = grupos.find((g) => g.projectId === null);
    expect(sinProyecto).toEqual({
      projectId: null,
      projectName: null,
      mentees: [{ id: 'me-hugo', name: 'Hugo Herrera' }],
    });
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
    await expect(repo.miembrosPorProyecto(DIEGO)).resolves.not.toContainEqual(
      expect.objectContaining({ mentees: expect.arrayContaining([{ id: ANA }]) }),
    );
  });

  it('el mentee sin proyecto (Hugo) no aparece para otra manager', async () => {
    const repo = repos();

    const grupos = await repo.miembrosPorProyecto(MARTA);
    const ids = grupos.flatMap((g) => g.mentees.map((m) => m.id));
    expect(ids).not.toContain(HUGO);
  });
});