import type { Database } from 'better-sqlite3';
import type { MenteeDeEquipo } from '../../domain/model.js';
import type { TeamRepository } from '../../domain/ports.js';

interface TeamRow {
  id: string;
  name: string;
  en_equipo_desde: string | null;
  acuerdos_pendientes: number;
  incidencias_abiertas: number;
  objetivos_en_curso: number;
  ultimo_1to1: string | null;
}

interface ProyectoRow {
  mentee_id: string;
  name: string;
}

/**
 * Adaptador SQLite del puerto de equipo: agrega por mentee el nº de acuerdos
 * pendientes, incidencias abiertas, objetivos en curso, la fecha del último
 * 1-to-1 y la lista de proyectos vigentes (orden alfabético). Los proyectos
 * viajan como array de nombres —nunca como cadena concatenada: un nombre con
 * coma partiría el render en el cliente (ticket #17). El orden del panel no se
 * resuelve aquí: lo aplica la regla de dominio (TeamService).
 *
 * El orden alfabético de los proyectos no se delega en la colación de SQLite
 * (`ORDER BY` usaría la binaria por defecto, insensible a mayúsculas y
 * diacríticos): se ordena aquí con `localeCompare`, igual que el desempate por
 * nombre de la regla de dominio.
 */
export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: Database) {}

  async teamOf(managerId: string): Promise<MenteeDeEquipo[]> {
    const rows = this.db
      .prepare(
        `SELECT
           m.id,
           m.name,
           m.en_equipo_desde,
           (SELECT COUNT(*)
              FROM acuerdos ac
              JOIN onetoones o ON o.id = ac.onetoone_id
             WHERE o.mentee_id = m.id AND ac.done = 0) AS acuerdos_pendientes,
           (SELECT COUNT(*)
              FROM incidencias i
             WHERE i.mentee_id = m.id AND i.estado = 'abierta') AS incidencias_abiertas,
           (SELECT COUNT(*)
              FROM objetivos ob
             WHERE ob.mentee_id = m.id AND ob.estado = 'en curso') AS objetivos_en_curso,
           (SELECT MAX(date) FROM onetoones o WHERE o.mentee_id = m.id) AS ultimo_1to1
         FROM mentees m
         WHERE m.manager_id = ?`,
      )
      .all(managerId) as TeamRow[];

    const proyectos = this.db
      .prepare(
        `SELECT a.mentee_id, p.name
           FROM asignaciones a
           JOIN projects p ON p.id = a.proyecto_id
           JOIN mentees m ON m.id = a.mentee_id
          WHERE a.hasta IS NULL AND m.manager_id = ?`,
      )
      .all(managerId) as ProyectoRow[];

    const porMentee = new Map<string, string[]>();
    for (const row of proyectos) {
      const nombres = porMentee.get(row.mentee_id) ?? [];
      nombres.push(row.name);
      porMentee.set(row.mentee_id, nombres);
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      enEquipoDesde: row.en_equipo_desde,
      // Orden alfabético con la colación del runtime (no la binaria de SQLite):
      // mayúsculas/minúsculas y diacríticos siguen el orden esperado.
      proyectos: (porMentee.get(row.id) ?? []).sort((a, b) => a.localeCompare(b, 'es')),
      acuerdosPendientes: row.acuerdos_pendientes,
      incidenciasAbiertas: row.incidencias_abiertas,
      objetivosEnCurso: row.objetivos_en_curso,
      ultimoUnoAUno: row.ultimo_1to1,
    }));
  }
}
