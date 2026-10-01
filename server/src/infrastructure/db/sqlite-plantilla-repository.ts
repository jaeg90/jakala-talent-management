import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { ManagerId, TemaPlantilla } from '../../domain/model.js';
import type { PlantillaRepository } from '../../domain/ports.js';
import { reordenarVigentes, TEMAS_INICIALES, validarRetirarTema } from '../../domain/plantilla.js';

interface PlantillaRow {
  id: string;
  manager_id: string;
  tema: string;
  orden: number;
  estado: 'vigente' | 'retirado';
}

/**
 * Adaptador SQLite del puerto de la plantilla de 1-to-1. Cada manager tiene la
 * suya: los temas genéricos viven en `plantilla` con su orden y estado. Las
 * consultas cruzan por `manager_id` (aislamiento); el formulario de 1-to-1 de
 * la web consume los vigentes en orden.
 */
export class SqlitePlantillaRepository implements PlantillaRepository {
  constructor(private readonly db: Database) {}

  async plantillaOf(managerId: ManagerId): Promise<TemaPlantilla[]> {
    const rows = this.db
      .prepare(
        `SELECT id, manager_id, tema, orden, estado
         FROM plantilla WHERE manager_id = ?
         ORDER BY (estado = 'vigente') DESC, orden ASC, rowid ASC`,
      )
      .all(managerId) as PlantillaRow[];
    return rows.map(toTemaPlantilla);
  }

  async addTema(managerId: ManagerId, tema: string): Promise<TemaPlantilla> {
    const repetido = this.db
      .prepare('SELECT 1 FROM plantilla WHERE manager_id = ? AND tema = ?')
      .get(managerId, tema);
    if (repetido !== undefined) {
      throw new Error(`Ya existe el tema "${tema}" en la plantilla`);
    }
    const orden = this.siguienteOrden(managerId);
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO plantilla (id, manager_id, tema, orden, estado) VALUES (?, ?, ?, ?, ?)')
      .run(id, managerId, tema, orden, 'vigente');
    return { id, managerId, tema, orden, estado: 'vigente' };
  }

  async editarTema(managerId: ManagerId, temaId: string, tema: string): Promise<TemaPlantilla> {
    const row = this.ownRow(managerId, temaId);
    this.db.prepare('UPDATE plantilla SET tema = ? WHERE id = ?').run(tema, temaId);
    return { ...toTemaPlantilla(row), tema };
  }

  async moverTema(managerId: ManagerId, temaId: string, delta: -1 | 1): Promise<TemaPlantilla[]> {
    // Solo se reordenan los vigentes; los retirados no participan del orden.
    const fila = this.db
      .prepare(
        `SELECT t.id FROM plantilla t WHERE t.id = ? AND t.manager_id = ? AND t.estado = 'vigente'`,
      )
      .get(temaId, managerId) as { id: string } | undefined;
    if (fila === undefined) {
      throw new Error('Tema de plantilla no encontrado');
    }
    const vigentes = this.vigentesOrdenados(managerId);
    const reordenados = reordenarVigentes(vigentes, temaId, delta);
    const update = this.db.prepare('UPDATE plantilla SET orden = ? WHERE id = ?');
    this.db.transaction(() => {
      for (const t of reordenados) update.run(t.orden, t.id);
    })();
    return this.plantillaOf(managerId);
  }

  async retirarTema(managerId: ManagerId, temaId: string): Promise<TemaPlantilla> {
    // La comprobación «no retirar el último vigente» y la escritura van en la
    // misma transacción: así dos retiradas concurrentes no pueden leer ambas el
    // mismo recuento y dejar la plantilla sin temas vigentes.
    const retirar = this.db.transaction((): TemaPlantilla => {
      const row = this.ownRow(managerId, temaId);
      if (row.estado === 'retirado') return toTemaPlantilla(row);

      const vigentes = this.vigentesOrdenados(managerId);
      validarRetirarTema(vigentes, temaId);

      this.db.prepare('UPDATE plantilla SET estado = ? WHERE id = ?').run('retirado', temaId);

      // Renumerar los vigentes restantes para que `orden` siga siendo su
      // posición entre los temas vigentes (0 = primero).
      const restantes = vigentes.filter((t) => t.id !== temaId);
      const update = this.db.prepare('UPDATE plantilla SET orden = ? WHERE id = ?');
      restantes.forEach((t, i) => {
        update.run(i, t.id);
      });

      return { ...toTemaPlantilla(row), estado: 'retirado' };
    });
    return retirar();
  }

  async reactivarTema(managerId: ManagerId, temaId: string): Promise<TemaPlantilla> {
    const row = this.ownRow(managerId, temaId);
    if (row.estado === 'vigente') return toTemaPlantilla(row);
    const orden = this.siguienteOrden(managerId);
    this.db
      .prepare('UPDATE plantilla SET estado = ?, orden = ? WHERE id = ?')
      .run('vigente', orden, temaId);
    return { ...toTemaPlantilla(row), estado: 'vigente', orden };
  }

  async restablecerPlantilla(managerId: ManagerId): Promise<TemaPlantilla[]> {
    this.db.transaction(() => {
      // Los temas actuales pasan a retirados (no se borran): así se pueden
      // volver a usar desde «Retirados». Ver Ajustes · 3d de la especificación.
      this.db.prepare(`UPDATE plantilla SET estado = 'retirado' WHERE manager_id = ?`).run(managerId);

      // Los tres temas iniciales vuelven a estar vigentes, en su orden original.
      // Si alguno ya existía (ahora retirado), se reactiva en su sitio; si no, se inserta.
      const reactivar = this.db.prepare(
        `UPDATE plantilla SET estado = 'vigente', orden = ? WHERE manager_id = ? AND tema = ?`,
      );
      const insert = this.db.prepare(
        'INSERT INTO plantilla (id, manager_id, tema, orden, estado) VALUES (?, ?, ?, ?, ?)',
      );
      TEMAS_INICIALES.forEach((tema, orden) => {
        const resultado = reactivar.run(orden, managerId, tema);
        if (resultado.changes === 0) {
          insert.run(randomUUID(), managerId, tema, orden, 'vigente');
        }
      });
    })();
    return this.plantillaOf(managerId);
  }

  /** Fila de la plantilla del manager o lanza si no existe. */
  private ownRow(managerId: ManagerId, temaId: string): PlantillaRow {
    const row = this.db
      .prepare('SELECT id, manager_id, tema, orden, estado FROM plantilla WHERE id = ? AND manager_id = ?')
      .get(temaId, managerId) as PlantillaRow | undefined;
    if (row === undefined) {
      throw new Error('Tema de plantilla no encontrado');
    }
    return row;
  }

  private vigentesOrdenados(managerId: ManagerId): TemaPlantilla[] {
    const rows = this.db
      .prepare(
        `SELECT id, manager_id, tema, orden, estado FROM plantilla
         WHERE manager_id = ? AND estado = 'vigente' ORDER BY orden ASC, rowid ASC`,
      )
      .all(managerId) as PlantillaRow[];
    return rows.map(toTemaPlantilla);
  }

  private siguienteOrden(managerId: ManagerId): number {
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(orden), -1) AS max FROM plantilla WHERE manager_id = ? AND estado = 'vigente'`)
      .get(managerId) as { max: number };
    return row.max + 1;
  }
}

function toTemaPlantilla(row: PlantillaRow): TemaPlantilla {
  return {
    id: row.id,
    managerId: row.manager_id,
    tema: row.tema,
    orden: row.orden,
    estado: row.estado,
  };
}