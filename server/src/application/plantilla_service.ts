import type { Manager, TemaPlantilla } from '../domain/model.js';
import type { PlantillaRepository } from '../domain/ports.js';
import { validarTextoDeTema, validarRetirarTema } from '../domain/plantilla.js';

/**
 * Caso de uso: plantilla de 1-to-1 de un manager. Añadir, editar, reordenar,
 * retirar y reactivar temas genéricos, y restablecer la plantilla inicial.
 * Editar la plantilla solo afecta a los siguientes 1-to-1s: los ya registrados
 * conservan sus notas tal como estaban (el formulario consume esta plantilla).
 */
export class PlantillaService {
  constructor(private readonly repository: PlantillaRepository) {}

  /** Plantilla completa del manager (vigentes en orden y retirados). */
  async plantillaOf(manager: Manager): Promise<TemaPlantilla[]> {
    return this.repository.plantillaOf(manager.id);
  }

  /** Añade un tema vigente al final, con su texto validado (no vacío). */
  async addTema(manager: Manager, tema: string): Promise<TemaPlantilla> {
    return this.repository.addTema(manager.id, validarTextoDeTema(tema));
  }

  /** Edita el texto de un tema de la plantilla. */
  async editarTema(manager: Manager, temaId: string, tema: string): Promise<TemaPlantilla> {
    return this.repository.editarTema(manager.id, temaId, validarTextoDeTema(tema));
  }

  /** Mueve un tema una posición (delta -1 sube, +1 baja). */
  async moverTema(manager: Manager, temaId: string, delta: -1 | 1): Promise<TemaPlantilla[]> {
    return this.repository.moverTema(manager.id, temaId, delta);
  }

  /** Sube un tema una posición (hacia el primer lugar). */
  async subir(manager: Manager, temaId: string): Promise<TemaPlantilla[]> {
    return this.repository.moverTema(manager.id, temaId, -1);
  }

  /** Baja un tema una posición (hacia el último lugar). */
  async bajar(manager: Manager, temaId: string): Promise<TemaPlantilla[]> {
    return this.repository.moverTema(manager.id, temaId, 1);
  }

  /** Retira un tema; no se puede retirar el último vigente (regla de dominio). */
  async retirarTema(manager: Manager, temaId: string): Promise<TemaPlantilla> {
    const plantilla = await this.repository.plantillaOf(manager.id);
    validarRetirarTema(plantilla, temaId);
    return this.repository.retirarTema(manager.id, temaId);
  }

  /** Vuelve a activar un tema retirado, al final de los vigentes. */
  async reactivarTema(manager: Manager, temaId: string): Promise<TemaPlantilla> {
    return this.repository.reactivarTema(manager.id, temaId);
  }

  /** Restablece la plantilla a sus temas iniciales. */
  async restablecerPlantilla(manager: Manager): Promise<TemaPlantilla[]> {
    return this.repository.restablecerPlantilla(manager.id);
  }
}