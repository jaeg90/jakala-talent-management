import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/passwords.js';
import { validarUnManagerPorMentee } from '../../domain/rules.js';
import { TEMAS_INICIALES } from '../../domain/plantilla.js';
import type { Mentee } from '../../domain/model.js';

/** Contraseña ficticia común a todos los managers semilla (datos de TFM). */
export const SEED_PASSWORD = 'secreta123';

export const SEED_MANAGERS = [
  { id: 'seed-manager-1', email: 'manager@jakala.example', name: 'Marta Manager', debeCambiarContraseña: false },
  { id: 'seed-manager-2', email: 'diego@jakala.example', name: 'Diego Domínguez', debeCambiarContraseña: false },
  { id: 'seed-manager-3', email: 'lucia@jakala.example', name: 'Lucía López', debeCambiarContraseña: false },
  { id: 'seed-manager-4', email: 'julia@jakala.example', name: 'Julia Jiménez', debeCambiarContraseña: true },
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
 * 4 managers, 8 mentees y 5 proyectos con asignaciones, y la plantilla
 * inicial de 1-to-1 de cada manager.
 */
export function seed(db: Database): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM managers').get() as { n: number };
  if (count.n > 0) return;

  validarUnManagerPorMentee(SEED_MENTEES);

  const hash = hashPassword(SEED_PASSWORD);
  const insertManager = db.prepare(
    'INSERT INTO managers (id, email, name, password_hash, debe_cambiar_contrasena) VALUES (?, ?, ?, ?, ?)',
  );
  for (const m of SEED_MANAGERS) {
    insertManager.run(m.id, m.email, m.name, hash, m.debeCambiarContraseña ? 1 : 0);
    insertarPlantillaInicial(db, m.id);
  }

  const insertProject = db.prepare(
    'INSERT INTO projects (id, name, fecha_retirada) VALUES (?, ?, NULL)',
  );
  for (const p of SEED_PROJECTS) {
    insertProject.run(p.id, p.name);
  }

  const insertMentee = db.prepare('INSERT INTO mentees (id, manager_id, name) VALUES (?, ?, ?)');
  for (const m of SEED_MENTEES) {
    insertMentee.run(m.id, m.managerId, m.name);
  }

  // Fuente única de verdad de los proyectos actuales: las asignaciones vigentes.
  // Cada mentee con proyecto se siembra con una entrada «Alta en el equipo» fechada
  // hoy − 90 días (ver especificacion-pantallas.md §Ajustes · 3b). Sin proyecto, sin asignación.
  const insertAsignacion = db.prepare(
    'INSERT INTO asignaciones (mentee_id, proyecto_id, desde, motivo_entrada, hasta, motivo_salida) VALUES (?, ?, ?, ?, NULL, NULL)',
  );
  const desde = fechaHaceDias(90);
  for (const m of SEED_MENTEES) {
    if (m.projectId !== null) {
      insertAsignacion.run(m.id, m.projectId, desde, MOTIVO_ALTA_EN_EL_EQUIPO);
    }
  }
}

/** Motivo canon del alta en el equipo (especificacion-pantallas.md §Ajustes · 3b). */
const MOTIVO_ALTA_EN_EL_EQUIPO = 'Alta en el equipo';

/** Fecha ISO (YYYY-MM-DD) de hace `dias` días, en UTC (coherente con toISOString). */
function fechaHaceDias(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}
