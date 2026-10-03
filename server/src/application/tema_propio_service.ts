import type { Manager, TemaPropio } from '../domain/model.js';
import type { PlantillaRepository, TemaPropioRepository } from '../domain/ports.js';
import {
  primerNombre,
  validarNombreTemaPropio,
  validarSinDuplicadosTemaPropio,
} from '../domain/temas-propios.js';
import { temasVigentes } from '../domain/plantilla.js';

/** Caso de uso: alta, retirada y consulta de temas propios de una mentee. */
export class TemaPropioService {
  constructor(
    private readonly repository: TemaPropioRepository,
    private readonly plantilla: PlantillaRepository,
  ) {}

  /** Temas propios de la mentee, vigentes y retirados (solo si es del manager). */
  async temasPropiosOf(manager: Manager, menteeId: string): Promise<TemaPropio[]> {
    return this.repository.temasPropiosOf(manager.id, menteeId);
  }

  /**
   * Da de alta un tema propio vigente. Valida el nombre (no vacío) y que no
   * duplique —sin mayúsculas ni tildes— otro tema propio vigente, otro retirado
   * ni un tema genérico vigente de la plantilla del manager (copy de §14).
   */
  async addTemaPropio(manager: Manager, menteeId: string, tema: string): Promise<TemaPropio> {
    const nombre = validarNombreTemaPropio(tema);
    const nombreMentee = await this.repository.nombreDeMentee(manager.id, menteeId);
    if (nombreMentee === null) {
      throw new Error(`Mentee ${menteeId} no pertenece al manager`);
    }
    const [propios, plantilla] = await Promise.all([
      this.repository.temasPropiosOf(manager.id, menteeId),
      this.plantilla.plantillaOf(manager.id),
    ]);
    validarSinDuplicadosTemaPropio(
      nombre,
      propios,
      temasVigentes(plantilla),
      primerNombre(nombreMentee),
    );
    return this.repository.addTemaPropio(manager.id, menteeId, nombre);
  }

  /** Retira un tema propio de una mentee; devuelve false si no existe o no es
   *  del manager (la mentee acota la retirada: una URL de otra mentee no puede
   *  retirar un tema ajeno a ella). */
  async retirarTemaPropio(manager: Manager, menteeId: string, temaPropioId: string): Promise<boolean> {
    return this.repository.retirarTemaPropio(manager.id, menteeId, temaPropioId);
  }
}