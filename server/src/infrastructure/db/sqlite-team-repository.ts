import type { Database } from 'better-sqlite3';
import type { Mentee } from '../../domain/model.js';
import type { TeamRepository } from '../../domain/ports.js';

/** Adaptador SQLite del puerto de equipo. */
export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: Database) {}

  async menteesOf(managerId: string): Promise<Mentee[]> {
    const rows = this.db
      .prepare('SELECT id, manager_id AS managerId, name FROM mentees WHERE manager_id = ? ORDER BY name')
      .all(managerId) as Mentee[];
    return rows;
  }
}
