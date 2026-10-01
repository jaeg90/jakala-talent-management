import type { Manager, ManagerCatalogo, Traspaso } from '../domain/model.js';
import type { NuevoTraspaso, TraspasoRepository } from '../domain/ports.js';
import { validarFechaTraspaso, validarMotivoTraspaso } from '../domain/traspasos.js';

/** Caso de uso: traspaso de una mentee de un manager a otro. */
export class TraspasoService {
  constructor(private readonly repository: TraspasoRepository) {}

  /** Catálogo de managers (para elegir el destino). Sin el flag de contraseña. */
  async managers(): Promise<ManagerCatalogo[]> {
    return this.repository.managers();
  }

  /** Historial de traspasos de la mentee (solo si es del manager). */
  async historialDe(manager: Manager, menteeId: string): Promise<Traspaso[]> {
    return this.repository.historialDe(manager.id, menteeId);
  }

  /** Traspasa la mentee con fecha y motivo validados (no vacíos). */
  async traspasar(manager: Manager, menteeId: string, traspaso: NuevoTraspaso): Promise<Traspaso> {
    const fecha = validarFechaTraspaso(traspaso.fecha);
    const motivo = validarMotivoTraspaso(traspaso.motivo);
    return this.repository.traspasar(manager.id, menteeId, {
      fecha,
      destinoId: traspaso.destinoId,
      motivo,
    });
  }
}