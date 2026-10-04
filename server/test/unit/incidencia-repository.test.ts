import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SqliteIncidenciaRepository } from '../../src/infrastructure/db/sqlite-incidencia-repository.js';
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

function repos(): SqliteIncidenciaRepository {
  const db = openDatabase(tempDbPath());
  seed(db);
  dbs.push(db);
  return new SqliteIncidenciaRepository(db);
}

describe('incidencias de una mentee (alta, listado de equipo y resolución)', () => {
  it('una incidencia dada de alta nace abierta y aparece en el equipo y el historial', async () => {
    const repo = repos();

    const alta = await repo.addIncidencia(MARTA, ANA, 'Baja médica', '2026-09-27');

    expect(alta).toMatchObject({
      id: expect.any(String),
      menteeId: ANA,
      descripcion: 'Baja médica',
      estado: 'abierta',
      notaResolucion: '',
      fechaResolucion: null,
    });
    await expect(repo.historialDe(MARTA, ANA)).resolves.toEqual([alta]);

    const abiertas = await repo.abiertasDe(MARTA);
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0]).toMatchObject({ id: alta.id, menteeName: 'Ana Alonso', estado: 'abierta' });
  });

  it('resuelve una incidencia abierta con nota; queda resuelta y sale de las abiertas', async () => {
    const repo = repos();
    const alta = await repo.addIncidencia(MARTA, ANA, 'Conflicto en el proyecto', '2026-09-27');

    const resuelta = await repo.resolverIncidencia(MARTA, alta.id, 'Mediado con el equipo');

    expect(resuelta).toMatchObject({
      id: alta.id,
      estado: 'resuelta',
      notaResolucion: 'Mediado con el equipo',
      fechaResolucion: expect.any(String),
    });
    await expect(repo.historialDe(MARTA, ANA)).resolves.toEqual([resuelta]);
    await expect(repo.abiertasDe(MARTA)).resolves.toEqual([]);
  });

  it('no resuelve una incidencia ya resuelta', async () => {
    const repo = repos();
    const alta = await repo.addIncidencia(MARTA, ANA, 'Baja médica', '2026-09-27');
    await repo.resolverIncidencia(MARTA, alta.id, 'Reincorporada');

    await expect(repo.resolverIncidencia(MARTA, alta.id, 'Otra nota')).rejects.toThrow(
      /no puede resolverse de nuevo/,
    );
  });
});

describe('aislamiento por manager', () => {
  it('no da de alta una incidencia para una mentee de otro manager', async () => {
    const repo = repos();

    await expect(repo.addIncidencia(MARTA, DAVID, 'Baja médica', '2026-09-27')).rejects.toThrow(/no pertenece/);
  });

  it('otro manager no ve el historial de la mentee', async () => {
    const repo = repos();
    await repo.addIncidencia(MARTA, ANA, 'Baja médica', '2026-09-27');

    await expect(repo.historialDe(DIEGO, ANA)).resolves.toEqual([]);
    await expect(repo.abiertasDe(DIEGO)).resolves.toEqual([]);
  });

  it('otro manager no puede resolver la incidencia de la mentee', async () => {
    const repo = repos();
    const alta = await repo.addIncidencia(MARTA, ANA, 'Baja médica', '2026-09-27');

    await expect(repo.resolverIncidencia(DIEGO, alta.id, 'Intruso')).rejects.toThrow(
      /no encontrada/,
    );
  });
});