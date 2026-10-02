import type { Database } from 'better-sqlite3';
import type { MenteeConProyecto } from '../../domain/model.js';
import type { TeamRepository } from '../../domain/ports.js';

/** Adaptador SQLite del puerto de equipo: mentees del manager con sus proyectos vigentes. */
export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: Database) {}

  async teamOf(managerId: string): Promise<MenteeConProyecto[]> {
    const rows = this.db
      .prepare(
        `SELECT m.id, m.name, p.name AS project_name
         FROM mentees m
         LEFT JOIN asignaciones a ON a.mentee_id = m.id AND a.hasta IS NULL
         LEFT JOIN projects p ON p.id = a.proyecto_id
         WHERE m.manager_id = ?
         ORDER BY m.name`,
      )
      .all(managerId) as MenteeRow[];

    const porMentee = new Map<string, string[]>();
    for (const row of rows) {
      if (row.project_name === null) continue;
      const nombres = porMentee.get(row.id) ?? [];
      nombres.push(row.project_name);
      porMentee.set(row.id, nombres);
    }

    return rows
      .filter((row, i, all) => all.findIndex((r) => r.id === row.id) === i)
      .map((mentee) => ({
        id: mentee.id,
        name: mentee.name,
        proyectos: (porMentee.get(mentee.id) ?? []).sort((a, b) => a.localeCompare(b)),
      }));
  }
}

interface MenteeRow {
  id: string;
  name: string;
  project_name: string | null;
}