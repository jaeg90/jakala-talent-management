import type { Acuerdo, Manager, OneToOne } from '../domain/model.js';
import type { NuevoOneToOne, OneToOneRepository } from '../domain/ports.js';
import { crearAcuerdoPendiente } from '../domain/agreements.js';
import { validarNotasPorTema } from '../domain/onetoonetopics.js';

/** Caso de uso: registrar y consultar 1-to-1s de una mentee. */
export class OneToOneService {
  constructor(private readonly repository: OneToOneRepository) {}

  /** Historial cronológico de 1-to-1s de la mentee (solo si es del manager). */
  async historyOf(manager: Manager, menteeId: string): Promise<OneToOne[]> {
    return this.repository.historyOf(manager.id, menteeId);
  }

  /**
   * Registra un 1-to-1: valida una nota por tema y crea los acuerdos pendientes.
   */
  async save(manager: Manager, nuevo: NuevoOneToOne): Promise<OneToOne> {
    validarNotasPorTema(nuevo.notas);
    return this.repository.save(manager.id, nuevo);
  }

  /** Acuerdos pendientes de la mentee, de un vistazo. */
  async pendingAgreementsOf(manager: Manager, menteeId: string): Promise<Acuerdo[]> {
    return this.repository.pendingAgreementsOf(manager.id, menteeId);
  }

  /** Marca un acuerdo cumplido. */
  async completeAgreement(manager: Manager, acuerdoId: string): Promise<boolean> {
    return this.repository.completeAgreement(manager.id, acuerdoId);
  }
}

export { crearAcuerdoPendiente };
