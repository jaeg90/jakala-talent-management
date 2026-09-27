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
  `);
  return db;
}
