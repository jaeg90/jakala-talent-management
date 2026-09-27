import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SqliteTemaPropioRepository } from '../../src/infrastructure/db/sqlite-tema-propio-repository.js';
import { SqliteOneToOneRepository } from '../../src/infrastructure/db/sqlite-onetoone-repository.js';
import { cleanupTempDirs, tempDbPath } from '../helpers/tempdb.js';

const dbs: Database[] = [];

afterAll(() => {
  for (const db of dbs) db.close();
  cleanupTempDirs();
});

const MARTA = 'seed-manager-1';
const ANA = 'me-ana';

/** BD temporal sembrada; los repositorios comparten la misma conexión. */
function repos(): { temas: SqliteTemaPropioRepository; onetoones: SqliteOneToOneRepository } {
  const db = openDatabase(tempDbPath());
  seed(db);
  dbs.push(db);
  return { temas: new SqliteTemaPropioRepository(db), onetoones: new SqliteOneToOneRepository(db) };
}

describe('vigencia de los temas propios (alta y baja)', () => {
  it('un tema dado de alta aparece entre los vigentes', async () => {
    const { temas } = repos();

    const alta = await temas.addTemaPropio(MARTA, ANA, 'formación en curso');

    expect(alta).toEqual({ id: expect.any(String), menteeId: ANA, tema: 'formación en curso' });
    await expect(temas.temasPropiosOf(MARTA, ANA)).resolves.toEqual([
      { id: alta.id, menteeId: ANA, tema: 'formación en curso' },
    ]);
  });

  it('la baja retira el tema de los vigentes', async () => {
    const { temas } = repos();
    const alta = await temas.addTemaPropio(MARTA, ANA, 'formación en curso');

    expect(await temas.removeTemaPropio(MARTA, alta.id)).toBe(true);
    await expect(temas.temasPropiosOf(MARTA, ANA)).resolves.toEqual([]);
  });

  it('rechaza un nombre repetido para la misma mentee', async () => {
    const { temas } = repos();
    await temas.addTemaPropio(MARTA, ANA, 'formación en curso');

    await expect(temas.addTemaPropio(MARTA, ANA, 'formación en curso')).rejects.toThrow(/Ya existe/);
  });

  it('no da de alta un tema para una mentee de otro manager', async () => {
    const { temas } = repos();

    await expect(temas.addTemaPropio(MARTA, 'me-david', 'formación')).rejects.toThrow(
      /no pertenece/,
    );
  });

  it('la baja de un tema ajeno devuelve false', async () => {
    const { temas } = repos();
    const alta = await temas.addTemaPropio(MARTA, ANA, 'formación');

    // David es de Diego, no de Marta.
    expect(await temas.removeTemaPropio('seed-manager-2', alta.id)).toBe(false);
  });
});

describe('persistencia de temas tratados en 1-to-1s ya registrados', () => {
  it('un 1-to-1 conserva la nota de un tema propio retirado después', async () => {
    const { temas, onetoones } = repos();
    const alta = await temas.addTemaPropio(MARTA, ANA, 'formación en curso');

    const registrado = await onetoones.save(MARTA, {
      menteeId: ANA,
      date: '2026-09-27',
      notas: [{ tema: 'formación en curso', nota: 'Termina el 15 de octubre' }],
      acuerdos: [],
    });

    await temas.removeTemaPropio(MARTA, alta.id);

    const historial = await onetoones.historyOf(MARTA, ANA);
    expect(historial).toHaveLength(1);
    expect(historial[0]?.id).toBe(registrado.id);
    expect(historial[0]?.notas).toEqual([
      { tema: 'formación en curso', nota: 'Termina el 15 de octubre' },
    ]);
  });
});