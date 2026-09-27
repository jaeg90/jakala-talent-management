import type { Incidencia, Manager } from '../domain/model.js';
import type { IncidenciaConMentee, IncidenciaRepository } from '../domain/ports.js';
import { validarDescripcionIncidencia, validarNotaResolucion } from '../domain/incidencias.js';

/** Caso de uso: alta, consulta, listado de equipo y resolución de incidencias. */
export class IncidenciaService {
  constructor(private readonly repository: IncidenciaRepository) {}

  /** Incidencias abiertas de todo el equipo del manager. */
  async abiertasDe(manager: Manager): Promise<IncidenciaConMentee[]> {
    return this.repository.abiertasDe(manager.id);
  }

  /** Historial de incidencias de la mentee (solo si es del manager). */
  async historialDe(manager: Manager, menteeId: string): Promise<Incidencia[]> {
    return this.repository.historialDe(manager.id, menteeId);
  }

  /** Da de alta una incidencia abierta con la descripción validada. */
  async addIncidencia(manager: Manager, menteeId: string, descripcion: string): Promise<Incidencia> {
    const d = validarDescripcionIncidencia(descripcion);
    return this.repository.addIncidencia(manager.id, menteeId, d);
  }

  /** Resuelve una incidencia con la nota de resolución validada. */
  async resolverIncidencia(manager: Manager, incidenciaId: string, nota: string): Promise<Incidencia> {
    const n = validarNotaResolucion(nota);
    return this.repository.resolverIncidencia(manager.id, incidenciaId, n);
  }
}