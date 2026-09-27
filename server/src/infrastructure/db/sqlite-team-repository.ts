import type { Database } from 'better-sqlite3';
import type { MenteeConProyecto } from '../../domain/model.js';
import type { TeamRepository } from '../../domain/ports.js';

/** Adaptador SQLite del puerto de equipo: mentees del manager con su proyecto actual. */
export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: Database) {}

  async teamOf(managerId: string): Promise<MenteeConProyecto[]> {
    const rows = this.db
      .prepare(
        `SELECT m.id, m.name, p.id AS projectId, p.name AS projectName
         FROM mentees m
         LEFT JOIN projects p ON p.id = m.project_id
         WHERE m.manager_id = ?
         ORDER BY m.name`,
      )
      .all(managerId) as MenteeRow[];
    return rows.map(toMenteeConProyecto);
  }
}

interface MenteeRow {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
}

function toMenteeConProyecto(row: MenteeRow): MenteeConProyecto {
  return {
    id: row.id,
    name: row.name,
    project:
      row.projectId !== null && row.projectName !== null
        ? { id: row.projectId, name: row.projectName }
        : null,
  };
}
