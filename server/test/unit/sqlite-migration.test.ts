import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { cleanupTempDirs, tempDbPath } from '../helpers/tempdb.js';

/**
 * Migración de `onetoones` a ADR-0009 (Cambios de dominio 7): una base creada
 * antes del cambio no tiene `registrado_por`/`registrado_en`; `openDatabase`
 * debe añadirlas (ALTER TABLE) y rellenarlas sin tocar el resto. La autoría se
 * reconstruye desde la cronología de traspasos (el historial pertenece a la
 * mentee y se hereda completo), no desde el manager actual.
 */
describe('openDatabase migra la tabla onetoones existente', () => {
  afterEach(() => {
    cleanupTempDirs();
  });

  /** Esquema previo al cambio: `onetoones` sin las dos columnas nuevas. */
  function crearBaseVieja(path: string): Database.Database {
    const vieja = new Database(path);
    vieja.exec(`
      CREATE TABLE managers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, debe_cambiar_contrasena INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE mentees (id TEXT PRIMARY KEY, manager_id TEXT NOT NULL REFERENCES managers(id), name TEXT NOT NULL);
      CREATE TABLE onetoones (id TEXT PRIMARY KEY, mentee_id TEXT NOT NULL REFERENCES mentees(id), date TEXT NOT NULL);
      CREATE TABLE notas_por_tema (id INTEGER PRIMARY KEY AUTOINCREMENT, onetoone_id TEXT NOT NULL REFERENCES onetoones(id), tema TEXT NOT NULL, nota TEXT NOT NULL, UNIQUE (onetoone_id, tema));
      CREATE TABLE acuerdos (id TEXT PRIMARY KEY, onetoone_id TEXT NOT NULL REFERENCES onetoones(id), text TEXT NOT NULL, date TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE traspasos (id TEXT PRIMARY KEY, mentee_id TEXT NOT NULL REFERENCES mentees(id), origen_id TEXT NOT NULL REFERENCES managers(id), destino_id TEXT NOT NULL REFERENCES managers(id), fecha TEXT NOT NULL, motivo TEXT NOT NULL);
    `);
    return vieja;
  }

  it('añade y rellena registrado_por/registrado_en con el manager actual sin traspasos', () => {
    const path = tempDbPath();
    const vieja = crearBaseVieja(path);
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m1', 'm@example.com', 'Marta', 'x');
    vieja.prepare('INSERT INTO mentees (id, manager_id, name) VALUES (?, ?, ?)').run('me-ana', 'm1', 'Ana Alonso');
    vieja.prepare('INSERT INTO onetoones (id, mentee_id, date) VALUES (?, ?, ?)').run('o1', 'me-ana', '2026-09-20');
    vieja.close();

    const db = openDatabase(path);
    const columnas = db.prepare('PRAGMA table_info(onetoones)').all() as { name: string }[];
    expect(columnas.map((c) => c.name)).toEqual(
      expect.arrayContaining(['registrado_por', 'registrado_en']),
    );
    const fila = db
      .prepare('SELECT registrado_por, registrado_en FROM onetoones WHERE id = ?')
      .get('o1') as { registrado_por: string; registrado_en: string };
    expect(fila.registrado_por).toBe('m1');
    expect(fila.registrado_en).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    db.close();
  });

  it('atribuye cada registro al manager de su fecha, no al actual tras un traspaso', () => {
    const path = tempDbPath();
    const vieja = crearBaseVieja(path);
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m1', 'marta@example.com', 'Marta', 'x');
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m2', 'diego@example.com', 'Diego', 'x');
    // Beatriz fue traspasada de Marta (m1) a Diego (m2) el 27 sept.
    vieja.prepare('INSERT INTO mentees (id, manager_id, name) VALUES (?, ?, ?)').run('me-bea', 'm2', 'Beatriz Blanco');
    vieja.prepare('INSERT INTO traspasos (id, mentee_id, origen_id, destino_id, fecha, motivo) VALUES (?, ?, ?, ?, ?, ?)')
      .run('t1', 'me-bea', 'm1', 'm2', '2026-09-27', 'Reorganización');
    // Dos 1-to-1s: uno anterior al traspaso (lo registró Marta) y otro posterior (Diego).
    vieja.prepare('INSERT INTO onetoones (id, mentee_id, date) VALUES (?, ?, ?)').run('o1', 'me-bea', '2026-09-20');
    vieja.prepare('INSERT INTO onetoones (id, mentee_id, date) VALUES (?, ?, ?)').run('o2', 'me-bea', '2026-10-01');
    vieja.close();

    const db = openDatabase(path);
    const autor = db.prepare('SELECT id, registrado_por FROM onetoones ORDER BY date').all() as {
      id: string;
      registrado_por: string;
    }[];
    expect(autor.find((r) => r.id === 'o1')?.registrado_por).toBe('m1');
    expect(autor.find((r) => r.id === 'o2')?.registrado_por).toBe('m2');
    db.close();
  });

  it('un traspaso y un 1-to-1 del mismo día atribuyen el registro al manager de DESTINO', () => {
    const path = tempDbPath();
    const vieja = crearBaseVieja(path);
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m1', 'marta@example.com', 'Marta', 'x');
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m2', 'diego@example.com', 'Diego', 'x');
    vieja.prepare('INSERT INTO mentees (id, manager_id, name) VALUES (?, ?, ?)').run('me-bea', 'm2', 'Beatriz Blanco');
    vieja.prepare('INSERT INTO traspasos (id, mentee_id, origen_id, destino_id, fecha, motivo) VALUES (?, ?, ?, ?, ?, ?)')
      .run('t1', 'me-bea', 'm1', 'm2', '2026-09-27', 'Reorganización');
    // Comparte fecha con el traspaso: lo registró el manager de DESTINO (m2).
    vieja.prepare('INSERT INTO onetoones (id, mentee_id, date) VALUES (?, ?, ?)').run('o1', 'me-bea', '2026-09-27');
    vieja.close();

    const db = openDatabase(path);
    const autor = db.prepare('SELECT id, registrado_por FROM onetoones').all() as {
      id: string;
      registrado_por: string;
    }[];
    expect(autor.find((r) => r.id === 'o1')?.registrado_por).toBe('m2');
    db.close();
  });

  it('varios traspasos el mismo día: manda el último por orden de inserción (rowid)', () => {
    const path = tempDbPath();
    const vieja = crearBaseVieja(path);
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m1', 'marta@example.com', 'Marta', 'x');
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m2', 'diego@example.com', 'Diego', 'x');
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m3', 'laura@example.com', 'Laura', 'x');
    vieja.prepare('INSERT INTO mentees (id, manager_id, name) VALUES (?, ?, ?)').run('me-bea', 'm3', 'Beatriz Blanco');
    // Dos traspasos el MISMO día (27 sept): m1→m2 y, después por inserción, m2→m3.
    // El 1-to-1 de ese día pertenece al destino del último por orden de inserción (m3).
    vieja.prepare('INSERT INTO traspasos (id, mentee_id, origen_id, destino_id, fecha, motivo) VALUES (?, ?, ?, ?, ?, ?)')
      .run('t1', 'me-bea', 'm1', 'm2', '2026-09-27', 'Primero del día');
    vieja.prepare('INSERT INTO traspasos (id, mentee_id, origen_id, destino_id, fecha, motivo) VALUES (?, ?, ?, ?, ?, ?)')
      .run('t2', 'me-bea', 'm2', 'm3', '2026-09-27', 'Último del día');
    vieja.prepare('INSERT INTO onetoones (id, mentee_id, date) VALUES (?, ?, ?)').run('o1', 'me-bea', '2026-09-27');
    vieja.close();

    const db = openDatabase(path);
    const autor = db.prepare('SELECT id, registrado_por FROM onetoones').all() as {
      id: string;
      registrado_por: string;
    }[];
    expect(autor.find((r) => r.id === 'o1')?.registrado_por).toBe('m3');
    db.close();
  });
});

/**
 * Migraciones del detalle de 1-to-1 (spec §11a): `acuerdos.cumplido_el` (fecha de
 * cumplimiento) y `notas_por_tema.propio` (chip «propio» persistido). Cada migración
 * declara su política para el dato que no es recuperable: un acuerdo ya cumplido
 * queda con `cumplido_el` NULL («Cumplido» sin fecha, no se inventa) y una nota
 * registrada antes del chip queda con `propio` = 0 (sin chip, no se deduce).
 */
describe('openDatabase migra cumplido_el y propio (spec §11a)', () => {
  afterEach(() => {
    cleanupTempDirs();
  });

  /** Esquema previo al cambio: `acuerdos` sin `cumplido_el` y `notas_por_tema` sin `propio`. */
  function crearBaseVieja(path: string): Database.Database {
    const vieja = new Database(path);
    vieja.exec(`
      CREATE TABLE managers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, debe_cambiar_contrasena INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE mentees (id TEXT PRIMARY KEY, manager_id TEXT NOT NULL REFERENCES managers(id), name TEXT NOT NULL);
      CREATE TABLE onetoones (id TEXT PRIMARY KEY, mentee_id TEXT NOT NULL REFERENCES mentees(id), date TEXT NOT NULL);
      CREATE TABLE notas_por_tema (id INTEGER PRIMARY KEY AUTOINCREMENT, onetoone_id TEXT NOT NULL REFERENCES onetoones(id), tema TEXT NOT NULL, nota TEXT NOT NULL, UNIQUE (onetoone_id, tema));
      CREATE TABLE acuerdos (id TEXT PRIMARY KEY, onetoone_id TEXT NOT NULL REFERENCES onetoones(id), text TEXT NOT NULL, date TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
    `);
    return vieja;
  }

  it('un acuerdo ya cumplido queda sin fecha (NULL) y una nota previa sin chip (propio = 0)', () => {
    const path = tempDbPath();
    const vieja = crearBaseVieja(path);
    vieja
      .prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run('m1', 'm@example.com', 'Marta', 'x');
    vieja.prepare('INSERT INTO mentees (id, manager_id, name) VALUES (?, ?, ?)').run('me-ana', 'm1', 'Ana Alonso');
    vieja.prepare('INSERT INTO onetoones (id, mentee_id, date) VALUES (?, ?, ?)').run('o1', 'me-ana', '2026-09-20');
    vieja.prepare('INSERT INTO notas_por_tema (onetoone_id, tema, nota) VALUES (?, ?, ?)').run('o1', '¿Cómo estás?', 'Animada');
    // Ya cumplido antes de la migración: no hay fecha de cumplimiento recuperable.
    vieja.prepare('INSERT INTO acuerdos (id, onetoone_id, text, date, done) VALUES (?, ?, ?, ?, ?)')
      .run('a1', 'o1', 'Acuerdo histórico', '2026-09-20', 1);
    vieja.close();

    const db = openDatabase(path);
    const acuerdo = db.prepare('SELECT done, cumplido_el FROM acuerdos WHERE id = ?').get('a1') as {
      done: number;
      cumplido_el: string | null;
    };
    expect(acuerdo.done).toBe(1);
    expect(acuerdo.cumplido_el).toBeNull();
    const nota = db.prepare('SELECT propio FROM notas_por_tema WHERE onetoone_id = ?').get('o1') as {
      propio: number;
    };
    expect(nota.propio).toBe(0);
    db.close();
  });
});