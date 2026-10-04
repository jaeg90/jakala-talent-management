import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type {
  Asignacion,
  CambioProyecto,
  ManagerId,
  Project,
  ProyectoCatalogo,
  ProyectoConEstado,
} from '../../domain/model.js';
import type {
  NuevaAsignacion,
  NuevoCambioProyecto,
  ProyectoActual,
  ProyectoRepository,
  SalidaDeProyecto,
  SituacionProyecto,
} from '../../domain/ports.js';
import { crearCambioProyecto, validarNombreProyecto } from '../../domain/proyectos.js';
import {
  crearEntradaEnProyecto,
  reactivarProyecto,
  retirarProyecto,
  salirDeProyecto,
  validarRetirarProyecto,
} from '../../domain/asignaciones.js';

interface ProyectoRow {
  id: string;
  name: string;
  fecha_retirada: string | null;
}

interface AsignacionRow {
  mentee_id: string;
  proyecto_id: string;
  desde: string;
  motivo_entrada: string;
  hasta: string | null;
  motivo_salida: string | null;
}

interface CambioRow {
  id: string;
  mentee_id: string;
  fecha: string;
  origen_id: string | null;
  destino_id: string | null;
  motivo: string;
}

/**
 * Adaptador SQLite del puerto de proyectos. Las operaciones sobre una mentee
 * cruzan por mentees.manager_id para garantizar el aislamiento por manager.
 * La fuente única de verdad de los proyectos actuales son las asignaciones
 * vigentes (sin `hasta`); `cambios_proyecto` es el histórico legado del
 * estrangulador. Ver docs/adr/0008 y decisiones.md §Cambios de dominio 12.
 */
export class SqliteProyectoRepository implements ProyectoRepository {
  constructor(private readonly db: Database) {}

  private menteeOf(managerId: ManagerId, menteeId: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  async proyectos(): Promise<ProyectoCatalogo[]> {
    const rows = this.db
      .prepare(`SELECT p.id, p.name, p.fecha_retirada,
        (SELECT COUNT(*) FROM asignaciones a WHERE a.proyecto_id = p.id AND a.hasta IS NULL) AS num_mentees
        FROM projects p ORDER BY p.name`)
      .all() as (ProyectoRow & { num_mentees: number })[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      estado: row.fecha_retirada === null ? 'vigente' : 'retirado',
      fechaRetirada: row.fecha_retirada,
      numMentees: row.num_mentees,
    }));
  }

  async addProyecto(name: string): Promise<Project> {
    // Revalida de forma síncrona junto a la escritura para cubrir altas concurrentes.
    name = validarNombreProyecto(name, this.db.prepare('SELECT name FROM projects').all() as { name: string }[]);
    const id = randomUUID();
    this.db.prepare('INSERT INTO projects (id, name, fecha_retirada) VALUES (?, ?, NULL)').run(id, name);
    return { id, name };
  }

  async situacionDe(managerId: ManagerId, menteeId: string): Promise<SituacionProyecto> {
    if (this.menteeOf(managerId, menteeId) === null) {
      return { project: null, cambios: [] };
    }
    const cambios = this.db
      .prepare(
        `SELECT id, mentee_id, fecha, origen_id, destino_id, motivo
         FROM cambios_proyecto WHERE mentee_id = ? ORDER BY fecha, rowid`,
      )
      .all(menteeId) as CambioRow[];
    const project = this.projectById(this.proyectoVigenteActual(menteeId));
    return { project, cambios: cambios.map((c) => toCambio(c)) };
  }

  async registrarCambio(
    managerId: ManagerId,
    menteeId: string,
    cambio: NuevoCambioProyecto,
  ): Promise<CambioProyecto> {
    if (this.menteeOf(managerId, menteeId) === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    if (cambio.destinoId !== null) {
      const destino = this.db.prepare('SELECT id FROM projects WHERE id = ?').get(cambio.destinoId);
      if (destino === undefined) {
        throw new Error(`Proyecto ${cambio.destinoId} no encontrado`);
      }
    }
    const origenId = this.proyectoVigenteActual(menteeId);
    const creado = crearCambioProyecto(origenId, cambio.destinoId, cambio.fecha, cambio.motivo);
    const id = randomUUID();
    const insertCambio = this.db.prepare(
      'INSERT INTO cambios_proyecto (id, mentee_id, fecha, origen_id, destino_id, motivo) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const cerrarSalida = this.db.prepare(
      `UPDATE asignaciones SET hasta = ?, motivo_salida = ?
       WHERE mentee_id = ? AND proyecto_id = ? AND hasta IS NULL`,
    );
    const insertEntrada = this.db.prepare(
      'INSERT INTO asignaciones (mentee_id, proyecto_id, desde, motivo_entrada, hasta, motivo_salida) VALUES (?, ?, ?, ?, NULL, NULL)',
    );
    this.db.transaction(() => {
      insertCambio.run(id, menteeId, creado.fecha, creado.origenId, creado.destinoId, creado.motivo);
      if (creado.origenId !== null) {
        // La salida cierra la asignación vigente aplicando la regla de dominio:
        // la fecha de salida no puede ser anterior a la de entrada (`salirDeProyecto`).
        const vigente = this.asignacionVigenteDe(menteeId, creado.origenId);
        if (vigente !== undefined) {
          const cerrada = salirDeProyecto(toAsignacion(vigente), creado.fecha, creado.motivo);
          cerrarSalida.run(cerrada.hasta, cerrada.motivoSalida, menteeId, creado.origenId);
        }
      }
      if (creado.destinoId !== null) {
        // Regla de dominio: no se puede entrar dos veces al mismo proyecto sin salir
        // antes. El adaptador del estrangulador pasa por la misma validación que
        // `entrarEnProyecto` para no duplicar una asignación vigente ya existente.
        crearEntradaEnProyecto(
          menteeId,
          creado.destinoId,
          creado.fecha,
          creado.motivo,
          this.asignacionesDeMentee(menteeId),
        );
        insertEntrada.run(menteeId, creado.destinoId, creado.fecha, creado.motivo);
      }
    })();
    return { id, menteeId, ...creado };
  }

  async proyectosActualesDe(managerId: ManagerId, menteeId: string): Promise<ProyectoActual[]> {
    if (this.menteeOf(managerId, menteeId) === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    const rows = this.db
      .prepare(
        `SELECT p.id AS id, p.name AS name, a.desde AS desde
         FROM asignaciones a
         JOIN projects p ON p.id = a.proyecto_id
         WHERE a.mentee_id = ? AND a.hasta IS NULL`,
      )
      .all(menteeId) as { id: string; name: string; desde: string }[];
    // Orden alfabético con la colación del runtime (no la binaria de SQLite):
    // mayúsculas/minúsculas y diacríticos siguen el orden esperado (como en
    // SqliteTeamRepository, que lee los proyectos con `localeCompare(..., 'es')`).
    return rows
      .map((row) => ({ id: row.id, name: row.name, desde: row.desde }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async entrarEnProyecto(
    managerId: ManagerId,
    menteeId: string,
    entrada: NuevaAsignacion,
  ): Promise<Asignacion> {
    if (this.menteeOf(managerId, menteeId) === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    const proyecto = this.db.prepare('SELECT id FROM projects WHERE id = ?').get(entrada.proyecto);
    if (proyecto === undefined) {
      throw new Error(`Proyecto ${entrada.proyecto} no encontrado`);
    }
    const creada = crearEntradaEnProyecto(
      menteeId,
      entrada.proyecto,
      entrada.desde,
      entrada.motivoEntrada,
      this.asignacionesDeMentee(menteeId),
    );
    this.db
      .prepare(
        'INSERT INTO asignaciones (mentee_id, proyecto_id, desde, motivo_entrada, hasta, motivo_salida) VALUES (?, ?, ?, ?, NULL, NULL)',
      )
      .run(menteeId, entrada.proyecto, entrada.desde, entrada.motivoEntrada);
    return creada;
  }

  async salirDeProyecto(
    managerId: ManagerId,
    menteeId: string,
    proyectoId: string,
    salida: SalidaDeProyecto,
  ): Promise<Asignacion> {
    if (this.menteeOf(managerId, menteeId) === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    const vigente = this.db
      .prepare(
        `SELECT mentee_id, proyecto_id, desde, motivo_entrada, hasta, motivo_salida
         FROM asignaciones WHERE mentee_id = ? AND proyecto_id = ? AND hasta IS NULL`,
      )
      .get(menteeId, proyectoId) as AsignacionRow | undefined;
    if (vigente === undefined) {
      throw new Error(`La mentee no está en el proyecto ${proyectoId}`);
    }
    const cerrada = salirDeProyecto(toAsignacion(vigente), salida.hasta, salida.motivoSalida);
    this.db
      .prepare(
        `UPDATE asignaciones SET hasta = ?, motivo_salida = ?
         WHERE mentee_id = ? AND proyecto_id = ? AND hasta IS NULL`,
      )
      .run(cerrada.hasta, cerrada.motivoSalida, menteeId, proyectoId);
    return cerrada;
  }

  async retirarProyecto(proyectoId: string): Promise<ProyectoConEstado> {
    const row = this.db
      .prepare('SELECT id, fecha_retirada FROM projects WHERE id = ?')
      .get(proyectoId) as { id: string; fecha_retirada: string | null } | undefined;
    if (row === undefined) {
      throw new Error(`Proyecto ${proyectoId} no encontrado`);
    }
    retirarProyecto({ id: row.id, estado: row.fecha_retirada === null ? 'vigente' : 'retirado' });
    validarRetirarProyecto(this.asignacionesVigentesDeProyecto(proyectoId), proyectoId);
    const hoy = hoyISO();
    this.db.prepare('UPDATE projects SET fecha_retirada = ? WHERE id = ?').run(hoy, proyectoId);
    return { id: row.id, estado: 'retirado', fechaRetirada: hoy };
  }

  async reactivarProyecto(proyectoId: string): Promise<ProyectoConEstado> {
    const row = this.db
      .prepare('SELECT id, fecha_retirada FROM projects WHERE id = ?')
      .get(proyectoId) as { id: string; fecha_retirada: string | null } | undefined;
    if (row === undefined) {
      throw new Error(`Proyecto ${proyectoId} no encontrado`);
    }
    reactivarProyecto({ id: row.id, estado: row.fecha_retirada === null ? 'vigente' : 'retirado' });
    this.db.prepare('UPDATE projects SET fecha_retirada = NULL WHERE id = ?').run(proyectoId);
    return { id: row.id, estado: 'vigente', fechaRetirada: null };
  }

  /** Proyecto vigente más reciente de una mentee (desempate: orden alfabético). */
  private proyectoVigenteActual(menteeId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT a.proyecto_id AS id
         FROM asignaciones a
         JOIN projects p ON p.id = a.proyecto_id
         WHERE a.mentee_id = ? AND a.hasta IS NULL
         ORDER BY a.desde DESC, p.name ASC
         LIMIT 1`,
      )
      .get(menteeId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  private projectById(id: string | null): Project | null {
    if (id === null) return null;
    const row = this.db
      .prepare('SELECT id, name FROM projects WHERE id = ?')
      .get(id) as { id: string; name: string } | undefined;
    return row === undefined ? null : { id: row.id, name: row.name };
  }

  /** Asignación vigente (sin `hasta`) de una mentee a un proyecto concreto, si existe. */
  private asignacionVigenteDe(menteeId: string, proyectoId: string): AsignacionRow | undefined {
    return this.db
      .prepare(
        `SELECT mentee_id, proyecto_id, desde, motivo_entrada, hasta, motivo_salida
         FROM asignaciones WHERE mentee_id = ? AND proyecto_id = ? AND hasta IS NULL`,
      )
      .get(menteeId, proyectoId) as AsignacionRow | undefined;
  }

  private asignacionesDeMentee(menteeId: string): Asignacion[] {
    const rows = this.db
      .prepare(
        'SELECT mentee_id, proyecto_id, desde, motivo_entrada, hasta, motivo_salida FROM asignaciones WHERE mentee_id = ?',
      )
      .all(menteeId) as AsignacionRow[];
    return rows.map((r) => toAsignacion(r));
  }

  private asignacionesVigentesDeProyecto(proyectoId: string): Asignacion[] {
    const rows = this.db
      .prepare(
        `SELECT mentee_id, proyecto_id, desde, motivo_entrada, hasta, motivo_salida
         FROM asignaciones WHERE proyecto_id = ? AND hasta IS NULL`,
      )
      .all(proyectoId) as AsignacionRow[];
    return rows.map((r) => toAsignacion(r));
  }
}

function toAsignacion(row: AsignacionRow): Asignacion {
  return {
    mentee: row.mentee_id,
    proyecto: row.proyecto_id,
    desde: row.desde,
    motivoEntrada: row.motivo_entrada,
    hasta: row.hasta,
    motivoSalida: row.motivo_salida,
  };
}

function toCambio(row: CambioRow): CambioProyecto {
  return {
    id: row.id,
    menteeId: row.mentee_id,
    fecha: row.fecha,
    origenId: row.origen_id,
    destinoId: row.destino_id,
    motivo: row.motivo,
  };
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
