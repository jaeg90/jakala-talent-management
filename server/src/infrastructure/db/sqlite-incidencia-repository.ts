import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { EstadoIncidencia, Incidencia, ManagerId } from '../../domain/model.js';
import type { IncidenciaConMentee, IncidenciaRepository } from '../../domain/ports.js';
import { crearIncidenciaAbierta, resolverIncidencia } from '../../domain/incidencias.js';

interface IncidenciaRow {
  id: string;
  mentee_id: string;
  descripcion: string;
  estado: string;
  nota_resolucion: string;
  fecha_alta: string;
  fecha_resolucion: string | null;
}

interface IncidenciaConMenteeRow extends IncidenciaRow {
  mentee_name: string;
}

/**
 * Adaptador SQLite del puerto de incidencias. Todas las consultas cruzan por
 * mentees.manager_id para garantizar el aislamiento por manager.
 */
export class SqliteIncidenciaRepository implements IncidenciaRepository {
  constructor(private readonly db: Database) {}

  private menteeOf(managerId: ManagerId, menteeId: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  private incidenciaDe(managerId: ManagerId, incidenciaId: string): Incidencia | null {
    const row = this.db
      .prepare(
        `SELECT i.id, i.mentee_id, i.descripcion, i.estado, i.nota_resolucion, i.fecha_alta, i.fecha_resolucion
         FROM incidencias i
         JOIN mentees m ON m.id = i.mentee_id
         WHERE i.id = ? AND m.manager_id = ?`,
      )
      .get(incidenciaId, managerId) as IncidenciaRow | undefined;
    return row === undefined ? null : toIncidencia(row);
  }

  async abiertasDe(managerId: ManagerId): Promise<IncidenciaConMentee[]> {
    const rows = this.db
      .prepare(
        `SELECT i.id, i.mentee_id, i.descripcion, i.estado, i.nota_resolucion, i.fecha_alta, i.fecha_resolucion, m.name AS mentee_name
         FROM incidencias i
         JOIN mentees m ON m.id = i.mentee_id
         WHERE m.manager_id = ? AND i.estado = 'abierta'
         ORDER BY i.fecha_alta, i.id`,
      )
      .all(managerId) as IncidenciaConMenteeRow[];
    return rows.map((row) => ({ ...toIncidencia(row), menteeName: row.mentee_name }));
  }

  async historialDe(managerId: ManagerId, menteeId: string): Promise<Incidencia[]> {
    if (this.menteeOf(managerId, menteeId) === null) return [];
    const rows = this.db
      .prepare(
        `SELECT id, mentee_id, descripcion, estado, nota_resolucion, fecha_alta, fecha_resolucion
         FROM incidencias WHERE mentee_id = ? ORDER BY fecha_alta, id`,
      )
      .all(menteeId) as IncidenciaRow[];
    return rows.map(toIncidencia);
  }

  async addIncidencia(
    managerId: ManagerId,
    menteeId: string,
    descripcion: string,
    fechaApertura: string,
  ): Promise<Incidencia> {
    if (this.menteeOf(managerId, menteeId) === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    const id = randomUUID();
    const creada = crearIncidenciaAbierta(descripcion, fechaApertura);
    this.db
      .prepare(
        `INSERT INTO incidencias (id, mentee_id, descripcion, estado, nota_resolucion, fecha_alta, fecha_resolucion)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, menteeId, creada.descripcion, creada.estado, creada.notaResolucion, creada.fechaAlta, creada.fechaResolucion);
    return { id, menteeId, ...creada };
  }

  async resolverIncidencia(managerId: ManagerId, incidenciaId: string, nota: string): Promise<Incidencia> {
    const actual = this.incidenciaDe(managerId, incidenciaId);
    if (actual === null) throw new Error(`Incidencia ${incidenciaId} no encontrada`);
    const fechaResolucion = new Date().toISOString().slice(0, 10);
    const resuelta = resolverIncidencia(actual, nota, fechaResolucion);
    this.db
      .prepare('UPDATE incidencias SET estado = ?, nota_resolucion = ?, fecha_resolucion = ? WHERE id = ?')
      .run(resuelta.estado, resuelta.notaResolucion, resuelta.fechaResolucion, incidenciaId);
    return resuelta;
  }
}

function toIncidencia(row: IncidenciaRow): Incidencia {
  return {
    id: row.id,
    menteeId: row.mentee_id,
    descripcion: row.descripcion,
    estado: row.estado as EstadoIncidencia,
    notaResolucion: row.nota_resolucion,
    fechaAlta: row.fecha_alta,
    fechaResolucion: row.fecha_resolucion,
  };
}