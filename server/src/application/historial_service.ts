import type { Manager } from '../domain/model.js';
import type { EventoHistorial, FiltroHistorial } from '../domain/historial.js';
import { tipoDesdeFiltro } from '../domain/historial.js';
import type { HistorialRepository } from '../domain/ports.js';

/**
 * Caso de uso: historial unificado de una mentee (ADR-0007). La agregación (y su
 * orden descendente con criterio estable del mismo día) vive en el puerto; aquí
 * solo se aplica el filtro opcional `?tipo=`.
 */
export class HistorialService {
  constructor(private readonly repository: HistorialRepository) {}

  /** Feed de la mentee, filtrado por tipo si `filtro` no es null. */
  async historialDe(
    manager: Manager,
    menteeId: string,
    filtro: FiltroHistorial | null,
  ): Promise<EventoHistorial[]> {
    const eventos = await this.repository.historialDe(manager.id, menteeId);
    if (filtro === null) return eventos;
    const tipo = tipoDesdeFiltro(filtro);
    return eventos.filter((evento) => evento.tipo === tipo);
  }
}