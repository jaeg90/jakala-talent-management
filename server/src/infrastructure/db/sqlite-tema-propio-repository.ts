import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { EstadoTemaPropio, ManagerId, TemaPropio } from '../../domain/model.js';
import { retirarTemaPropio } from '../../domain/temas-propios.js';
import type { TemaPropioRepository } from '../../domain/ports.js';

interface TemaPropioRow {
  id: string;
  mentee_id: string;
  tema: string;
  desde: string;
  estado: EstadoTemaPropio;
  retirado_el: string | null;
}

/**
 * Adaptador SQLite del puerto de temas propios. Todas las consultas cruzan por
 * mentees.manager_id para garantizar el aislamiento por manager. La retirada es
 * real y sin borrado físico (el tema queda `retirado` y los 1-to-1s registrados
 * conservan sus notas por nombre).
 */
export class SqliteTemaPropioRepository implements TemaPropioRepository {
  constructor(private readonly db: Database) {}

  private menteeOf(managerId: ManagerId, menteeId: string): { id: string; name: string } | null {
    const row = this.db
      .prepare('SELECT id, name FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId) as { id: string; name: string } | undefined;
    return row ?? null;
  }

  async nombreDeMentee(managerId: ManagerId, menteeId: string): Promise<string | null> {
    const row = this.menteeOf(managerId, menteeId);
    return row?.name ?? null;
  }

  async temasPropiosOf(managerId: ManagerId, menteeId: string): Promise<TemaPropio[]> {
    if (this.menteeOf(managerId, menteeId) === null) return [];
    const rows = this.db
      .prepare(
        `SELECT id, mentee_id, tema, desde, estado, retirado_el
         FROM temas_propios WHERE mentee_id = ? ORDER BY rowid`,
      )
      .all(menteeId) as TemaPropioRow[];
    return rows.map(toTemaPropio);
  }

  async addTemaPropio(managerId: ManagerId, menteeId: string, tema: string): Promise<TemaPropio> {
    if (this.menteeOf(managerId, menteeId) === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    // Red de seguridad por contrato (la validación de duplicados con su copy la
    // hace el servicio contra la plantilla y los propios vigentes/retirados); el
    // `UNIQUE (mentee_id, tema)` y esta comprobación exacta evitan persistir un
    // duplicado exacto que se colara por carrera.
    const repetido = this.db
      .prepare('SELECT 1 FROM temas_propios WHERE mentee_id = ? AND tema = ?')
      .get(menteeId, tema);
    if (repetido !== undefined) {
      throw new Error(`Ya existe el tema propio "${tema}"`);
    }
    const id = randomUUID();
    const desde = new Date().toISOString().slice(0, 10);
    this.db
      .prepare(
        'INSERT INTO temas_propios (id, mentee_id, tema, desde, estado, retirado_el) VALUES (?, ?, ?, ?, ?, NULL)',
      )
      .run(id, menteeId, tema, desde, 'vigente');
    return { id, menteeId, tema, desde, estado: 'vigente', retiradoEl: null };
  }

  async retirarTemaPropio(managerId: ManagerId, menteeId: string, temaPropioId: string): Promise<boolean> {
    const row = this.db
      .prepare(
        `SELECT t.id, t.mentee_id, t.tema, t.desde, t.estado, t.retirado_el
         FROM temas_propios t
         JOIN mentees m ON m.id = t.mentee_id
         WHERE t.id = ? AND t.mentee_id = ? AND m.manager_id = ?`,
      )
      .get(temaPropioId, menteeId, managerId) as TemaPropioRow | undefined;
    if (row === undefined) return false;
    const retirado = retirarTemaPropio(toTemaPropio(row), new Date().toISOString().slice(0, 10));
    this.db
      .prepare('UPDATE temas_propios SET estado = ?, retirado_el = ? WHERE id = ?')
      .run(retirado.estado, retirado.retiradoEl, temaPropioId);
    return true;
  }
}

function toTemaPropio(row: TemaPropioRow): TemaPropio {
  return {
    id: row.id,
    menteeId: row.mentee_id,
    tema: row.tema,
    desde: row.desde,
    estado: row.estado,
    retiradoEl: row.retirado_el,
  };
}