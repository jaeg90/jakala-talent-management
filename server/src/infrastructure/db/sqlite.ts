import Database from 'better-sqlite3';

/** Abre la base de datos SQLite y crea el esquema si no existe. */
export function openDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS managers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS mentees (
      id TEXT PRIMARY KEY,
      manager_id TEXT NOT NULL REFERENCES managers(id),
      name TEXT NOT NULL,
      project_id TEXT REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS onetoones (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notas_por_tema (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      onetoone_id TEXT NOT NULL REFERENCES onetoones(id),
      tema TEXT NOT NULL,
      nota TEXT NOT NULL,
      UNIQUE (onetoone_id, tema)
    );
    CREATE TABLE IF NOT EXISTS acuerdos (
      id TEXT PRIMARY KEY,
      onetoone_id TEXT NOT NULL REFERENCES onetoones(id),
      text TEXT NOT NULL,
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS temas_propios (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      tema TEXT NOT NULL,
      UNIQUE (mentee_id, tema)
    );
    CREATE TABLE IF NOT EXISTS objetivos (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      fecha_limite TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'en curso'
    );
    CREATE TABLE IF NOT EXISTS incidencias (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      descripcion TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'abierta',
      nota_resolucion TEXT NOT NULL DEFAULT '',
      fecha_alta TEXT NOT NULL,
      fecha_resolucion TEXT
    );
  `);
  return db;
}
