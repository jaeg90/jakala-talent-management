import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { EstadoObjetivo, ManagerId, Objetivo } from '../../domain/model.js';
import type { EditarObjetivo, NuevoObjetivo, ObjetivoRepository } from '../../domain/ports.js';
import { crearObjetivoEnCurso, editarObjetivo, transicionarEstado } from '../../domain/objetivos.js';

interface ObjetivoRow {
  id: string;
  mentee_id: string;
  titulo: string;
  descripcion: string;
  fecha_limite: string;
  estado: string;
}

/**
 * Adaptador SQLite del puerto de objetivos anuales. Todas las consultas cruzan
 * por mentees.manager_id para garantizar el aislamiento por manager.
 */
export class SqliteObjetivoRepository implements ObjetivoRepository {
  constructor(private readonly db: Database) {}

  private menteeOf(managerId: ManagerId, menteeId: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  private objetivoDe(managerId: ManagerId, objetivoId: string): Objetivo | null {
    const row = this.db
      .prepare(
        `SELECT o.id, o.mentee_id, o.titulo, o.descripcion, o.fecha_limite, o.estado
         FROM objetivos o
         JOIN mentees m ON m.id = o.mentee_id
         WHERE o.id = ? AND m.manager_id = ?`,
      )
      .get(objetivoId, managerId) as ObjetivoRow | undefined;
    return row === undefined ? null : toObjetivo(row);
  }

  async objetivosOf(managerId: ManagerId, menteeId: string): Promise<Objetivo[]> {
    if (this.menteeOf(managerId, menteeId) === null) return [];
    const rows = this.db
      .prepare(
        'SELECT id, mentee_id, titulo, descripcion, fecha_limite, estado FROM objetivos WHERE mentee_id = ? ORDER BY rowid',
      )
      .all(menteeId) as ObjetivoRow[];
    return rows.map(toObjetivo);
  }

  async addObjetivo(managerId: ManagerId, nuevo: NuevoObjetivo): Promise<Objetivo> {
    if (this.menteeOf(managerId, nuevo.menteeId) === null) {
      throw new Error(`Mentee ${nuevo.menteeId} no pertenece al manager`);
    }
    const id = randomUUID();
    const creado = crearObjetivoEnCurso(nuevo.titulo, nuevo.descripcion, nuevo.fechaLimite);
    this.db
      .prepare(
        'INSERT INTO objetivos (id, mentee_id, titulo, descripcion, fecha_limite, estado) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, nuevo.menteeId, creado.titulo, creado.descripcion, creado.fechaLimite, creado.estado);
    return { id, menteeId: nuevo.menteeId, ...creado };
  }

  async updateObjetivo(
    managerId: ManagerId,
    objetivoId: string,
    cambios: EditarObjetivo,
  ): Promise<Objetivo> {
    const actual = this.objetivoDe(managerId, objetivoId);
    if (actual === null) throw new Error(`Objetivo ${objetivoId} no encontrado`);
    const editado = editarObjetivo(actual, cambios);
    this.db
      .prepare('UPDATE objetivos SET titulo = ?, descripcion = ?, fecha_limite = ? WHERE id = ?')
      .run(editado.titulo, editado.descripcion, editado.fechaLimite, objetivoId);
    return editado;
  }

  async cambiarEstado(
    managerId: ManagerId,
    objetivoId: string,
    estado: EstadoObjetivo,
  ): Promise<Objetivo> {
    const actual = this.objetivoDe(managerId, objetivoId);
    if (actual === null) throw new Error(`Objetivo ${objetivoId} no encontrado`);
    const cambiado = transicionarEstado(actual, estado);
    this.db.prepare('UPDATE objetivos SET estado = ? WHERE id = ?').run(cambiado.estado, objetivoId);
    return cambiado;
  }
}

function toObjetivo(row: ObjetivoRow): Objetivo {
  return {
    id: row.id,
    menteeId: row.mentee_id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    fechaLimite: row.fecha_limite,
    estado: row.estado as EstadoObjetivo,
  };
}