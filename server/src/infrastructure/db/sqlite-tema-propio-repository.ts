import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { ManagerId, TemaPropio } from '../../domain/model.js';
import type { TemaPropioRepository } from '../../domain/ports.js';

interface TemaPropioRow {
  id: string;
  mentee_id: string;
  tema: string;
}

/**
 * Adaptador SQLite del puerto de temas propios. Todas las consultas cruzan por
 * mentees.manager_id para garantizar el aislamiento por manager.
 */
export class SqliteTemaPropioRepository implements TemaPropioRepository {
  constructor(private readonly db: Database) {}

  private menteeOf(managerId: ManagerId, menteeId: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  async temasPropiosOf(managerId: ManagerId, menteeId: string): Promise<TemaPropio[]> {
    if (this.menteeOf(managerId, menteeId) === null) return [];
    const rows = this.db
      .prepare('SELECT id, mentee_id, tema FROM temas_propios WHERE mentee_id = ? ORDER BY rowid')
      .all(menteeId) as TemaPropioRow[];
    return rows.map((row) => ({ id: row.id, menteeId: row.mentee_id, tema: row.tema }));
  }

  async addTemaPropio(managerId: ManagerId, menteeId: string, tema: string): Promise<TemaPropio> {
    if (this.menteeOf(managerId, menteeId) === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    const repetido = this.db
      .prepare('SELECT 1 FROM temas_propios WHERE mentee_id = ? AND tema = ?')
      .get(menteeId, tema);
    if (repetido !== undefined) {
      throw new Error(`Ya existe el tema propio "${tema}"`);
    }
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO temas_propios (id, mentee_id, tema) VALUES (?, ?, ?)')
      .run(id, menteeId, tema);
    return { id, menteeId, tema };
  }

  async removeTemaPropio(managerId: ManagerId, temaPropioId: string): Promise<boolean> {
    const row = this.db
      .prepare(
        `SELECT t.id
         FROM temas_propios t
         JOIN mentees m ON m.id = t.mentee_id
         WHERE t.id = ? AND m.manager_id = ?`,
      )
      .get(temaPropioId, managerId) as { id: string } | undefined;
    if (row === undefined) return false;
    this.db.prepare('DELETE FROM temas_propios WHERE id = ?').run(temaPropioId);
    return true;
  }
}