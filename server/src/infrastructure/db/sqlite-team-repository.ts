import type { Database } from 'better-sqlite3';
import type { MenteeConProyecto, Project } from '../../domain/model.js';
import type { TeamRepository } from '../../domain/ports.js';

/** Adaptador SQLite del puerto de equipo: mentees del manager con sus proyectos vigentes. */
export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: Database) {}

  async teamOf(managerId: string): Promise<MenteeConProyecto[]> {
    const rows = this.db
      .prepare(
        `SELECT m.id, m.name, a.proyecto_id, p.name AS project_name, a.desde
         FROM mentees m
         LEFT JOIN asignaciones a ON a.mentee_id = m.id AND a.hasta IS NULL
         LEFT JOIN projects p ON p.id = a.proyecto_id
         WHERE m.manager_id = ?
         ORDER BY m.name`,
      )
      .all(managerId) as MenteeRow[];

    const porMentee = new Map<string, VigenteRow[]>();
    for (const row of rows) {
      if (row.proyecto_id === null || row.project_name === null || row.desde === null) continue;
      const filas = porMentee.get(row.id) ?? [];
      filas.push({
        proyecto_id: row.proyecto_id,
        project_name: row.project_name,
        desde: row.desde,
      });
      porMentee.set(row.id, filas);
    }

    return rows
      .filter((row, i, all) => all.findIndex((r) => r.id === row.id) === i)
      .map((mentee) => {
        const filas = porMentee.get(mentee.id) ?? [];
        return {
          id: mentee.id,
          name: mentee.name,
          project: proyectoReciente(filas),
          proyectos: filas.map((f) => f.project_name).sort((a, b) => a.localeCompare(b)),
        };
      });
  }
}

interface MenteeRow {
  id: string;
  name: string;
  proyecto_id: string | null;
  project_name: string | null;
  desde: string | null;
}

interface VigenteRow {
  proyecto_id: string;
  project_name: string;
  desde: string;
}

/** Proyecto vigente con la entrada más reciente (desempate: orden alfabético). */
function proyectoReciente(filas: VigenteRow[]): Project | null {
  if (filas.length === 0) return null;
  const reciente = filas
    .slice()
    .sort(
      (a, b) => b.desde.localeCompare(a.desde) || a.project_name.localeCompare(b.project_name),
    )[0]!;
  return { id: reciente.proyecto_id, name: reciente.project_name };
}