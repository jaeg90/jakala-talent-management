import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { SqliteTraspasoRepository } from '../../src/infrastructure/db/sqlite-traspaso-repository.js';
import { SqliteTeamRepository } from '../../src/infrastructure/db/sqlite-team-repository.js';
import { SqliteOneToOneRepository } from '../../src/infrastructure/db/sqlite-onetoone-repository.js';
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

function repos() {
  const db = openDatabase(tempDbPath());
  seed(db);
  dbs.push(db);
  return {
    traspaso: new SqliteTraspasoRepository(db),
    team: new SqliteTeamRepository(db),
    onetoone: new SqliteOneToOneRepository(db),
  };
}

describe('catálogo de managers', () => {
  it('lista los managers semilla ordenados por nombre', async () => {
    const { traspaso } = repos();

    const managers = await traspaso.managers();

    expect(managers.map((m) => m.name)).toEqual([
      'Diego Domínguez',
      'Julia Jiménez',
      'Lucía López',
      'Marta Manager',
    ]);
  });

  it('no expone el flag de contraseña temporal en el catálogo', async () => {
    const { traspaso } = repos();

    const managers = await traspaso.managers();

    for (const manager of managers) {
      expect(Object.keys(manager).sort()).toEqual(['email', 'id', 'name']);
    }
  });
});

describe('traspaso de una mentee entre managers', () => {
  it('mueve a la mentee y queda bajo un único manager', async () => {
    const { traspaso, team } = repos();

    const creado = await traspaso.traspasar(MARTA, ANA, {
      fecha: '2026-09-27',
      destinoId: DIEGO,
      motivo: 'Reorganización',
    });

    expect(creado).toMatchObject({
      id: expect.any(String),
      menteeId: ANA,
      origenId: MARTA,
      destinoId: DIEGO,
      fecha: '2026-09-27',
      motivo: 'Reorganización',
    });

    // La mentee ya no está en el equipo de origen y sí en el de destino.
    const equipoMarta = await team.teamOf(MARTA);
    const equipoDiego = await team.teamOf(DIEGO);
    expect(equipoMarta.map((m) => m.id)).not.toContain(ANA);
    expect(equipoDiego.map((m) => m.id)).toContain(ANA);
  });

  it('deja el historial en la mentee: el destino lo hereda y el origen deja de verlo', async () => {
    const { traspaso, onetoone } = repos();

    await onetoone.save(MARTA, {
      menteeId: ANA,
      date: '2026-09-20',
      notas: [{ tema: '¿Cómo estás?', nota: 'Animada', propio: false }],
      acuerdos: [{ text: 'Preparar dossier' }],
    });

    await traspaso.traspasar(MARTA, ANA, { fecha: '2026-09-27', destinoId: DIEGO, motivo: 'Reorganización' });

    const historialDiego = await onetoone.historyOf(DIEGO, ANA);
    const historialMarta = await onetoone.historyOf(MARTA, ANA);

    expect(historialDiego).toHaveLength(1);
    expect(historialDiego[0]!.date).toBe('2026-09-20');
    expect(historialMarta).toEqual([]);
  });

  it('registra el traspaso en el historial de la mentee', async () => {
    const { traspaso } = repos();

    await traspaso.traspasar(MARTA, ANA, { fecha: '2026-09-27', destinoId: DIEGO, motivo: 'Reorganización' });

    const historial = await traspaso.historialDe(DIEGO, ANA);
    expect(historial).toHaveLength(1);
    expect(historial[0]!).toMatchObject({ origenId: MARTA, destinoId: DIEGO, motivo: 'Reorganización' });

    // El manager de origen ya no ve el historial de la mentee traspasada.
    await expect(traspaso.historialDe(MARTA, ANA)).resolves.toEqual([]);
  });

  it('rechaza un traspaso al mismo manager', async () => {
    const { traspaso } = repos();

    await expect(
      traspaso.traspasar(MARTA, ANA, { fecha: '2026-09-27', destinoId: MARTA, motivo: 'Sin cambio' }),
    ).rejects.toThrow(/distinto/);
  });

  it('rechaza un destino que no existe', async () => {
    const { traspaso } = repos();

    await expect(
      traspaso.traspasar(MARTA, ANA, { fecha: '2026-09-27', destinoId: 'manager-fantasma', motivo: 'Error' }),
    ).rejects.toThrow(/no encontrado/);
  });

  it('rechaza traspasar una mentee de otro manager', async () => {
    const { traspaso } = repos();

    await expect(
      traspaso.traspasar(MARTA, DAVID, { fecha: '2026-09-27', destinoId: DIEGO, motivo: 'Intruso' }),
    ).rejects.toThrow(/no pertenece/);
  });
});