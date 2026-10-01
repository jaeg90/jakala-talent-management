import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { ManagerCatalogo, ManagerId, Traspaso } from '../../domain/model.js';
import type { NuevoTraspaso, TraspasoRepository } from '../../domain/ports.js';
import { crearTraspaso } from '../../domain/traspasos.js';

interface ManagerRow {
  id: string;
  email: string;
  name: string;
}

interface TraspasoRow {
  id: string;
  mentee_id: string;
  origen_id: string;
  destino_id: string;
  fecha: string;
  motivo: string;
}

/**
 * Adaptador SQLite del puerto de traspasos. El traspaso mueve la asignación
 * `mentees.manager_id` en una transacción, de modo que la mentee queda bajo un
 * único manager (origen deja de verla; destino hereda su historial completo).
 */
export class SqliteTraspasoRepository implements TraspasoRepository {
  constructor(private readonly db: Database) {}

  async managers(): Promise<ManagerCatalogo[]> {
    const rows = this.db
      .prepare('SELECT id, email, name FROM managers ORDER BY name')
      .all() as ManagerRow[];
    return rows.map((row) => ({ id: row.id, email: row.email, name: row.name }));
  }

  async historialDe(managerId: ManagerId, menteeId: string): Promise<Traspaso[]> {
    if (!this.menteeOf(managerId, menteeId)) return [];
    const rows = this.db
      .prepare(
        `SELECT id, mentee_id, origen_id, destino_id, fecha, motivo
         FROM traspasos WHERE mentee_id = ? ORDER BY fecha, rowid`,
      )
      .all(menteeId) as TraspasoRow[];
    return rows.map(toTraspaso);
  }

  async traspasar(managerId: ManagerId, menteeId: string, traspaso: NuevoTraspaso): Promise<Traspaso> {
    const mentee = this.db
      .prepare('SELECT id, manager_id FROM mentees WHERE id = ?')
      .get(menteeId) as { id: string; manager_id: string } | undefined;
    if (mentee === undefined || mentee.manager_id !== managerId) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    const destino = this.db
      .prepare('SELECT id FROM managers WHERE id = ?')
      .get(traspaso.destinoId) as { id: string } | undefined;
    if (destino === undefined) {
      throw new Error(`Manager ${traspaso.destinoId} no encontrado`);
    }
    const creado = crearTraspaso(managerId, traspaso.destinoId, traspaso.fecha, traspaso.motivo);
    const id = randomUUID();
    this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO traspasos (id, mentee_id, origen_id, destino_id, fecha, motivo) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(id, menteeId, creado.origenId, creado.destinoId, creado.fecha, creado.motivo);
      this.db.prepare('UPDATE mentees SET manager_id = ? WHERE id = ?').run(creado.destinoId, menteeId);
    })();
    return { id, menteeId, ...creado };
  }

  private menteeOf(managerId: ManagerId, menteeId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId);
    return row !== undefined;
  }
}

function toTraspaso(row: TraspasoRow): Traspaso {
  return {
    id: row.id,
    menteeId: row.mentee_id,
    origenId: row.origen_id,
    destinoId: row.destino_id,
    fecha: row.fecha,
    motivo: row.motivo,
  };
}