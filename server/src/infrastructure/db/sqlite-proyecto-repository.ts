import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { CambioProyecto, ManagerId, Project } from '../../domain/model.js';
import type {
  MiembrosPorProyecto,
  NuevoCambioProyecto,
  ProyectoRepository,
  SituacionProyecto,
} from '../../domain/ports.js';
import { crearCambioProyecto } from '../../domain/proyectos.js';

interface ProyectoRow {
  id: string;
  name: string;
}

interface MenteeProyectoRow {
  id: string;
  name: string;
  project_id: string | null;
  project_name: string | null;
}

interface CambioRow {
  id: string;
  mentee_id: string;
  fecha: string;
  origen_id: string | null;
  destino_id: string | null;
  motivo: string;
}

/**
 * Adaptador SQLite del puerto de proyectos. Las operaciones sobre una mentee
 * cruzan por mentees.manager_id para garantizar el aislamiento por manager.
 */
export class SqliteProyectoRepository implements ProyectoRepository {
  constructor(private readonly db: Database) {}

  private menteeOf(managerId: ManagerId, menteeId: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  async proyectos(): Promise<Project[]> {
    const rows = this.db.prepare('SELECT id, name FROM projects ORDER BY name').all() as ProyectoRow[];
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async addProyecto(name: string): Promise<Project> {
    const repetido = this.db.prepare('SELECT 1 FROM projects WHERE name = ?').get(name);
    if (repetido !== undefined) {
      throw new Error(`Ya existe el proyecto "${name}"`);
    }
    const id = randomUUID();
    this.db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id, name);
    return { id, name };
  }

  async situacionDe(managerId: ManagerId, menteeId: string): Promise<SituacionProyecto> {
    if (this.menteeOf(managerId, menteeId) === null) {
      return { project: null, cambios: [] };
    }
    const mentee = this.db
      .prepare(
        `SELECT p.id AS project_id, p.name AS project_name
         FROM mentees m
         LEFT JOIN projects p ON p.id = m.project_id
         WHERE m.id = ?`,
      )
      .get(menteeId) as { project_id: string | null; project_name: string | null } | undefined;
    const cambios = this.db
      .prepare(
        `SELECT id, mentee_id, fecha, origen_id, destino_id, motivo
         FROM cambios_proyecto WHERE mentee_id = ? ORDER BY fecha, rowid`,
      )
      .all(menteeId) as CambioRow[];
    return {
      project:
        mentee?.project_id !== null && mentee?.project_id !== undefined && mentee.project_name !== null
          ? { id: mentee.project_id, name: mentee.project_name }
          : null,
      cambios: cambios.map(toCambio),
    };
  }

  async registrarCambio(
    managerId: ManagerId,
    menteeId: string,
    cambio: NuevoCambioProyecto,
  ): Promise<CambioProyecto> {
    if (this.menteeOf(managerId, menteeId) === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    if (cambio.destinoId !== null) {
      const destino = this.db.prepare('SELECT id FROM projects WHERE id = ?').get(cambio.destinoId);
      if (destino === undefined) {
        throw new Error(`Proyecto ${cambio.destinoId} no encontrado`);
      }
    }
    const mentee = this.db
      .prepare('SELECT project_id FROM mentees WHERE id = ?')
      .get(menteeId) as { project_id: string | null };
    const creado = crearCambioProyecto(mentee.project_id, cambio.destinoId, cambio.fecha, cambio.motivo);
    const id = randomUUID();
    this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO cambios_proyecto (id, mentee_id, fecha, origen_id, destino_id, motivo) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(id, menteeId, creado.fecha, creado.origenId, creado.destinoId, creado.motivo);
      this.db.prepare('UPDATE mentees SET project_id = ? WHERE id = ?').run(creado.destinoId, menteeId);
    })();
    return { id, menteeId, ...creado };
  }

  async miembrosPorProyecto(managerId: ManagerId): Promise<MiembrosPorProyecto[]> {
    const rows = this.db
      .prepare(
        `SELECT m.id, m.name, m.project_id, p.name AS project_name
         FROM mentees m
         LEFT JOIN projects p ON p.id = m.project_id
         WHERE m.manager_id = ?
         ORDER BY p.name, m.name`,
      )
      .all(managerId) as MenteeProyectoRow[];
    const groups = new Map<string, MiembrosPorProyecto>();
    for (const row of rows) {
      const key = row.project_id ?? '';
      let grupo = groups.get(key);
      if (grupo === undefined) {
        grupo = { projectId: row.project_id, projectName: row.project_name, mentees: [] };
        groups.set(key, grupo);
      }
      grupo.mentees.push({ id: row.id, name: row.name });
    }
    return [...groups.values()].sort((a, b) => {
      if (a.projectName === null && b.projectName === null) return 0;
      if (a.projectName === null) return 1;
      if (b.projectName === null) return -1;
      return a.projectName.localeCompare(b.projectName);
    });
  }
}

function toCambio(row: CambioRow): CambioProyecto {
  return {
    id: row.id,
    menteeId: row.mentee_id,
    fecha: row.fecha,
    origenId: row.origen_id,
    destinoId: row.destino_id,
    motivo: row.motivo,
  };
}