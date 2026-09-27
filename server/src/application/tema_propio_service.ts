import type { Manager, TemaPropio } from '../domain/model.js';
import type { TemaPropioRepository } from '../domain/ports.js';
import { validarNombreTemaPropio } from '../domain/temas-propios.js';

/** Caso de uso: alta, baja y consulta de temas propios de una mentee. */
export class TemaPropioService {
  constructor(private readonly repository: TemaPropioRepository) {}

  /** Temas propios vigentes de la mentee (solo si es del manager). */
  async temasPropiosOf(manager: Manager, menteeId: string): Promise<TemaPropio[]> {
    return this.repository.temasPropiosOf(manager.id, menteeId);
  }

  /** Da de alta un tema propio con su nombre validado (no vacío). */
  async addTemaPropio(manager: Manager, menteeId: string, tema: string): Promise<TemaPropio> {
    const nombre = validarNombreTemaPropio(tema);
    return this.repository.addTemaPropio(manager.id, menteeId, nombre);
  }

  /** Da de baja un tema propio; devuelve false si no existe o no es del manager. */
  async removeTemaPropio(manager: Manager, temaPropioId: string): Promise<boolean> {
    return this.repository.removeTemaPropio(manager.id, temaPropioId);
  }
}