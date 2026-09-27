import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SqliteObjetivoRepository } from '../../src/infrastructure/db/sqlite-objetivo-repository.js';
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

function repos(): SqliteObjetivoRepository {
  const db = openDatabase(tempDbPath());
  seed(db);
  dbs.push(db);
  return new SqliteObjetivoRepository(db);
}

const NUEVO = {
  menteeId: ANA,
  titulo: 'Certificar en AWS',
  descripcion: 'Aprobar el examen de Solutions Architect',
  fechaLimite: '2026-12-31',
};

describe('objetivos anuales de una mentee (alta, listado y edición)', () => {
  it('un objetivo dado de alta nace en curso y aparece en el listado', async () => {
    const repo = repos();

    const alta = await repo.addObjetivo(MARTA, NUEVO);

    expect(alta).toEqual({ id: expect.any(String), ...NUEVO, estado: 'en curso' });
    await expect(repo.objetivosOf(MARTA, ANA)).resolves.toEqual([alta]);
  });

  it('edita un objetivo en curso', async () => {
    const repo = repos();
    const alta = await repo.addObjetivo(MARTA, NUEVO);

    const editado = await repo.updateObjetivo(MARTA, alta.id, {
      titulo: 'Certificar en Azure',
      descripcion: 'Examen AZ-104',
      fechaLimite: '2026-11-30',
    });

    expect(editado.estado).toBe('en curso');
    expect(editado.titulo).toBe('Certificar en Azure');
    await expect(repo.objetivosOf(MARTA, ANA)).resolves.toEqual([editado]);
  });

  it('no edita un objetivo cerrado', async () => {
    const repo = repos();
    const alta = await repo.addObjetivo(MARTA, NUEVO);
    await repo.cambiarEstado(MARTA, alta.id, 'cumplido');

    await expect(
      repo.updateObjetivo(MARTA, alta.id, {
        titulo: 'Otro',
        descripcion: '',
        fechaLimite: '2026-12-01',
      }),
    ).rejects.toThrow(/no puede editarse/);
  });
});

describe('transiciones de estado del objetivo en SQLite', () => {
  it('en curso → cumplido y no se revive', async () => {
    const repo = repos();
    const alta = await repo.addObjetivo(MARTA, NUEVO);

    const cumplido = await repo.cambiarEstado(MARTA, alta.id, 'cumplido');
    expect(cumplido.estado).toBe('cumplido');
    await expect(repo.objetivosOf(MARTA, ANA)).resolves.toEqual([cumplido]);

    await expect(repo.cambiarEstado(MARTA, alta.id, 'en curso')).rejects.toThrow(
      /no puede cambiar de estado/,
    );
  });

  it('en curso → no cumplido', async () => {
    const repo = repos();
    const alta = await repo.addObjetivo(MARTA, NUEVO);

    const noCumplido = await repo.cambiarEstado(MARTA, alta.id, 'no cumplido');
    expect(noCumplido.estado).toBe('no cumplido');
  });
});

describe('aislamiento por manager', () => {
  it('no da de alta un objetivo para una mentee de otro manager', async () => {
    const repo = repos();

    await expect(repo.addObjetivo(MARTA, { ...NUEVO, menteeId: DAVID })).rejects.toThrow(
      /no pertenece/,
    );
  });

  it('otro manager no ve los objetivos de la mentee', async () => {
    const repo = repos();
    await repo.addObjetivo(MARTA, NUEVO);

    await expect(repo.objetivosOf(DIEGO, ANA)).resolves.toEqual([]);
  });

  it('otro manager no puede editar ni cambiar el estado', async () => {
    const repo = repos();
    const alta = await repo.addObjetivo(MARTA, NUEVO);

    await expect(
      repo.updateObjetivo(DIEGO, alta.id, {
        titulo: 'Intruso',
        descripcion: '',
        fechaLimite: '2026-12-01',
      }),
    ).rejects.toThrow(/no encontrado/);
    await expect(repo.cambiarEstado(DIEGO, alta.id, 'cumplido')).rejects.toThrow(/no encontrado/);
  });
});