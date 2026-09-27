import type { EstadoObjetivo, Manager, Objetivo } from '../domain/model.js';
import type { EditarObjetivo, NuevoObjetivo, ObjetivoRepository } from '../domain/ports.js';
import { validarFechaLimite, validarTituloObjetivo } from '../domain/objetivos.js';

/** Caso de uso: alta, edición, consulta y cambio de estado de objetivos anuales. */
export class ObjetivoService {
  constructor(private readonly repository: ObjetivoRepository) {}

  /** Objetivos de la mentee (solo si es del manager). */
  async objetivosOf(manager: Manager, menteeId: string): Promise<Objetivo[]> {
    return this.repository.objetivosOf(manager.id, menteeId);
  }

  /** Da de alta un objetivo anual con título y fecha límite validados. */
  async addObjetivo(manager: Manager, nuevo: NuevoObjetivo): Promise<Objetivo> {
    const titulo = validarTituloObjetivo(nuevo.titulo);
    const fechaLimite = validarFechaLimite(nuevo.fechaLimite);
    const descripcion = nuevo.descripcion.trim();
    return this.repository.addObjetivo(manager.id, {
      menteeId: nuevo.menteeId,
      titulo,
      descripcion,
      fechaLimite,
    });
  }

  /** Edita un objetivo en curso con título y fecha límite validados. */
  async updateObjetivo(
    manager: Manager,
    objetivoId: string,
    cambios: EditarObjetivo,
  ): Promise<Objetivo> {
    const titulo = validarTituloObjetivo(cambios.titulo);
    const fechaLimite = validarFechaLimite(cambios.fechaLimite);
    const descripcion = cambios.descripcion.trim();
    return this.repository.updateObjetivo(manager.id, objetivoId, {
      titulo,
      descripcion,
      fechaLimite,
    });
  }

  /** Cambia el estado de un objetivo en curso (cumplido / no cumplido). */
  async cambiarEstado(
    manager: Manager,
    objetivoId: string,
    estado: EstadoObjetivo,
  ): Promise<Objetivo> {
    return this.repository.cambiarEstado(manager.id, objetivoId, estado);
  }
}