import { afterEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { cleanupTempDirs, tempDbPath } from '../helpers/tempdb.js';

afterEach(() => { vi.useRealTimers(); cleanupTempDirs(); });

it('migra una sola vez: asignación más antigua (también cerrada) o hoy−90; conserva el null defensivo', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  const path = tempDbPath();
  const vieja = new Database(path);
  vieja.exec(`
    CREATE TABLE mentees (id TEXT PRIMARY KEY, manager_id TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE asignaciones (mentee_id TEXT NOT NULL, proyecto_id TEXT NOT NULL, desde TEXT NOT NULL, motivo_entrada TEXT NOT NULL, hasta TEXT, motivo_salida TEXT);
    INSERT INTO mentees VALUES ('con', 'm1', 'Con proyectos'), ('sin', 'm1', 'Sin proyectos');
    INSERT INTO asignaciones VALUES ('con', 'p2', '2026-09-10', 'Otro', NULL, NULL), ('con', 'p1', '2025-03-20', 'Alta en el equipo', '2026-01-01', 'Salida');
  `);
  vieja.close();
  const db = openDatabase(path);
  expect(db.prepare('SELECT id, en_equipo_desde FROM mentees ORDER BY id').all()).toEqual([
    { id: 'con', en_equipo_desde: '2025-03-20' }, { id: 'sin', en_equipo_desde: '2026-07-06' },
  ]);
  db.prepare("UPDATE mentees SET en_equipo_desde = NULL WHERE id = 'sin'").run();
  db.close();
  vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  const otra = openDatabase(path);
  expect(otra.prepare('SELECT id, en_equipo_desde FROM mentees ORDER BY id').all()).toEqual([
    { id: 'con', en_equipo_desde: '2025-03-20' }, { id: 'sin', en_equipo_desde: null },
  ]);
  otra.close();
});

it('la semilla usa una única fecha de alta, incluso para quien no tiene proyecto', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  const db = openDatabase(tempDbPath());
  seed(db);
  expect(db.prepare('SELECT DISTINCT en_equipo_desde FROM mentees').all()).toEqual([{ en_equipo_desde: '2026-07-06' }]);
  expect(db.prepare('SELECT DISTINCT desde FROM asignaciones').all()).toEqual([{ desde: '2026-07-06' }]);
  db.close();
});
