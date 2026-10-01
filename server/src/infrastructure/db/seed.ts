import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/passwords.js';
import { validarUnManagerPorMentee } from '../../domain/rules.js';
import { TEMAS_INICIALES } from '../../domain/plantilla.js';
import type { Mentee } from '../../domain/model.js';

/** Contraseña ficticia común a todos los managers semilla (datos de TFM). */
export const SEED_PASSWORD = 'secreta123';

export const SEED_MANAGERS = [
  { id: 'seed-manager-1', email: 'manager@jakala.example', name: 'Marta Manager' },
  { id: 'seed-manager-2', email: 'diego@jakala.example', name: 'Diego Domínguez' },
  { id: 'seed-manager-3', email: 'lucia@jakala.example', name: 'Lucía López' },
];

export const SEED_PROJECTS = [
  { id: 'pr-atlas', name: 'Atlas Bank' },
  { id: 'pr-nova', name: 'Retail Nova' },
  { id: 'pr-aurora', name: 'Aurora Health' },
  { id: 'pr-campus', name: 'Campus EdTech' },
  { id: 'pr-green', name: 'Green Energy' },
];

/** Mentee de la semilla: dominio + asignación de proyecto actual. */
export interface MenteeSemilla extends Mentee {
  projectId: string | null;
}

export const SEED_MENTEES: MenteeSemilla[] = [
  { id: 'me-ana', managerId: 'seed-manager-1', name: 'Ana Alonso', projectId: 'pr-atlas' },
  { id: 'me-bea', managerId: 'seed-manager-1', name: 'Beatriz Blanco', projectId: 'pr-nova' },
  { id: 'me-carla', managerId: 'seed-manager-1', name: 'Carla Cano', projectId: 'pr-aurora' },
  { id: 'me-david', managerId: 'seed-manager-2', name: 'David Duarte', projectId: 'pr-nova' },
  { id: 'me-elena', managerId: 'seed-manager-2', name: 'Elena Estévez', projectId: 'pr-campus' },
  { id: 'me-fernando', managerId: 'seed-manager-2', name: 'Fernando Fuentes', projectId: 'pr-green' },
  { id: 'me-gabriela', managerId: 'seed-manager-3', name: 'Gabriela Gómez', projectId: 'pr-atlas' },
  { id: 'me-hugo', managerId: 'seed-manager-3', name: 'Hugo Herrera', projectId: null },
];

/**
 * Mecanismo que da la plantilla inicial de 1-to-1 a una cuenta de manager:
 * inserta los temas iniciales (`TEMAS_INICIALES`) en orden, todos vigentes.
 * Lo usa la semilla y lo disparará el alta de cuentas de manager (#25).
 */
export function insertarPlantillaInicial(db: Database, managerId: string): void {
  const insert = db.prepare(
    'INSERT INTO plantilla (id, manager_id, tema, orden, estado) VALUES (?, ?, ?, ?, ?)',
  );
  TEMAS_INICIALES.forEach((tema, orden) => {
    insert.run(randomUUID(), managerId, tema, orden, 'vigente');
  });
}

/**
 * Carga el dominio ficticio del TFM si la base de datos está vacía:
 * 3 managers, 8 mentees y 5 proyectos con asignaciones, y la plantilla
 * inicial de 1-to-1 de cada manager.
 */
export function seed(db: Database): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM managers').get() as { n: number };
  if (count.n > 0) return;

  validarUnManagerPorMentee(SEED_MENTEES);

  const hash = hashPassword(SEED_PASSWORD);
  const insertManager = db.prepare(
    'INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
  );
  for (const m of SEED_MANAGERS) {
    insertManager.run(m.id, m.email, m.name, hash);
    insertarPlantillaInicial(db, m.id);
  }

  const insertProject = db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)');
  for (const p of SEED_PROJECTS) {
    insertProject.run(p.id, p.name);
  }

  const insertMentee = db.prepare(
    'INSERT INTO mentees (id, manager_id, name, project_id) VALUES (?, ?, ?, ?)',
  );
  for (const m of SEED_MENTEES) {
    insertMentee.run(m.id, m.managerId, m.name, m.projectId);
  }
}
