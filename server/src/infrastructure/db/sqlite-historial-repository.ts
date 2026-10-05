import type { Database } from 'better-sqlite3';
import type { ManagerId } from '../../domain/model.js';
import type { EventoHistorial } from '../../domain/historial.js';
import { contarTemasConNota, inicioDeNota, ordenarHistorial } from '../../domain/historial.js';
import type { HistorialRepository } from '../../domain/ports.js';

interface OneToOneRow {
  id: string;
  date: string;
}

interface NotaRow {
  tema: string;
  nota: string;
  propio: number;
}

interface IncidenciaRow {
  id: string;
  estado: string;
  descripcion: string;
  fecha_alta: string;
}

interface ObjetivoRow {
  id: string;
  titulo: string;
  estado: string;
  fecha_limite: string;
}

interface AsignacionRow {
  rowid: number;
  desde: string;
  motivo_entrada: string;
  hasta: string | null;
  motivo_salida: string | null;
  project_name: string;
}

interface TraspasoRow {
  id: string;
  fecha: string;
  origen_name: string;
  destino_name: string;
}

/**
 * Adaptador SQLite del puerto de historial (ADR-0007): agrega en consulta los
 * 1-to-1s (con sus notas y acuerdos), incidencias, objetivos cerrados, entradas
 * y salidas de proyecto (fuente de verdad: `asignaciones`, ADR-0008) y traspasos,
 * resuelve los nombres (proyecto y managers) y devuelve el feed ordenado por
 * fecha descendente con el criterio estable del mismo día (domain/historial.ts).
 * No escribe nada: es una vista agregada, sin tabla de eventos ni doble escritura.
 */
export class SqliteHistorialRepository implements HistorialRepository {
  constructor(private readonly db: Database) {}

  private menteeOf(managerId: ManagerId, menteeId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId);
    return row !== undefined;
  }

  async historialDe(managerId: ManagerId, menteeId: string): Promise<EventoHistorial[]> {
    if (!this.menteeOf(managerId, menteeId)) return [];

    const eventos: EventoHistorial[] = [
      ...this.oneToOnes(menteeId),
      ...this.incidencias(menteeId),
      ...this.objetivos(menteeId),
      ...this.proyectos(menteeId),
      ...this.traspasos(menteeId),
    ];

    return ordenarHistorial(eventos);
  }

  private oneToOnes(menteeId: string): EventoHistorial[] {
    const rows = this.db
      .prepare('SELECT id, date FROM onetoones WHERE mentee_id = ?')
      .all(menteeId) as OneToOneRow[];
    const notasStmt = this.db.prepare(
      'SELECT tema, nota, propio FROM notas_por_tema WHERE onetoone_id = ? ORDER BY id',
    );
    const acuerdosStmt = this.db.prepare('SELECT 1 FROM acuerdos WHERE onetoone_id = ?');

    return rows.map((row): EventoHistorial => {
      const notas = (notasStmt.all(row.id) as NotaRow[]).map((n) => ({
        tema: n.tema,
        nota: n.nota,
        propio: n.propio === 1,
      }));
      const acuerdos = acuerdosStmt.all(row.id).length;
      return {
        tipo: '1-to-1',
        id: row.id,
        fecha: row.date,
        temasConNota: contarTemasConNota(notas),
        acuerdos,
        inicioNota: inicioDeNota(notas),
      };
    });
  }

  private incidencias(menteeId: string): EventoHistorial[] {
    const rows = this.db
      .prepare(
        'SELECT id, estado, descripcion, fecha_alta FROM incidencias WHERE mentee_id = ?',
      )
      .all(menteeId) as IncidenciaRow[];

    return rows.map(
      (row): EventoHistorial => ({
        tipo: 'incidencia',
        id: row.id,
        fecha: row.fecha_alta,
        estado: row.estado as 'abierta' | 'resuelta',
        descripcion: row.descripcion,
      }),
    );
  }

  private objetivos(menteeId: string): EventoHistorial[] {
    const rows = this.db
      .prepare(
        `SELECT id, titulo, estado, fecha_limite
         FROM objetivos WHERE mentee_id = ? AND estado != 'en curso'`,
      )
      .all(menteeId) as ObjetivoRow[];

    return rows.map(
      (row): EventoHistorial => ({
        tipo: 'objetivo',
        id: row.id,
        fecha: row.fecha_limite,
        estado: row.estado as 'cumplido' | 'no cumplido',
        titulo: row.titulo,
      }),
    );
  }

  private proyectos(menteeId: string): EventoHistorial[] {
    // Fuente de verdad: `asignaciones` (ADR-0008); la legada `cambios_proyecto`
    // NO se consulta. Cada asignación aporta su entrada y, si está cerrada, su salida.
    const rows = this.db
      .prepare(
        `SELECT a.rowid AS rowid, a.desde, a.motivo_entrada, a.hasta, a.motivo_salida, p.name AS project_name
         FROM asignaciones a
         JOIN projects p ON p.id = a.proyecto_id
         WHERE a.mentee_id = ?`,
      )
      .all(menteeId) as AsignacionRow[];

    const eventos: EventoHistorial[] = [];
    for (const row of rows) {
      eventos.push({
        tipo: 'proyecto',
        // Id determinista para el desempate del mismo día (la tabla no tiene id):
        // el `rowid` ordena por inserción y la dirección desambigua entrada/salida.
        id: `${row.rowid}-entrada`,
        fecha: row.desde,
        direccion: 'entrada',
        proyecto: row.project_name,
        motivo: row.motivo_entrada,
      });
      if (row.hasta !== null) {
        eventos.push({
          tipo: 'proyecto',
          id: `${row.rowid}-salida`,
          fecha: row.hasta,
          direccion: 'salida',
          proyecto: row.project_name,
          motivo: row.motivo_salida ?? '',
        });
      }
    }
    return eventos;
  }

  private traspasos(menteeId: string): EventoHistorial[] {
    const rows = this.db
      .prepare(
        `SELECT t.id, t.fecha, o.name AS origen_name, d.name AS destino_name
         FROM traspasos t
         JOIN managers o ON o.id = t.origen_id
         JOIN managers d ON d.id = t.destino_id
         WHERE t.mentee_id = ?`,
      )
      .all(menteeId) as TraspasoRow[];

    return rows.map(
      (row): EventoHistorial => ({
        tipo: 'traspaso',
        id: row.id,
        fecha: row.fecha,
        origen: row.origen_name,
        destino: row.destino_name,
      }),
    );
  }
}