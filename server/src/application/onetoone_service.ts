import type { Acuerdo, Manager, OneToOne } from '../domain/model.js';
import type { NuevoOneToOne, OneToOneRepository } from '../domain/ports.js';
import { crearAcuerdoPendiente } from '../domain/agreements.js';
import {
  validarContenidoOneToOne,
  validarFechaOneToOne,
  validarNotasPorTema,
} from '../domain/onetoonetopics.js';

/** Caso de uso: registrar y consultar 1-to-1s de una mentee. */
export class OneToOneService {
  constructor(private readonly repository: OneToOneRepository) {}

  /** Historial cronológico de 1-to-1s de la mentee (solo si es del manager). */
  async historyOf(manager: Manager, menteeId: string): Promise<OneToOne[]> {
    return this.repository.historyOf(manager.id, menteeId);
  }

  /** Un 1-to-1 concreto de la mentee (null si no existe o no es de la mentee/manager). */
  async oneToOneOf(manager: Manager, menteeId: string, unoAUnoId: string): Promise<OneToOne | null> {
    return this.repository.oneToOneOf(manager.id, menteeId, unoAUnoId);
  }

  /**
   * Registra un 1-to-1: valida la fecha (presente, ISO y no futura), que haya
   * al menos una nota o un acuerdo, una nota por tema y crea los acuerdos
   * pendientes. `hoy` se inyecta para que los tests sean deterministas.
   */
  async save(manager: Manager, nuevo: NuevoOneToOne, hoy: string = hoyISO()): Promise<OneToOne> {
    validarFechaOneToOne(nuevo.date, hoy);
    validarContenidoOneToOne(nuevo.notas, nuevo.acuerdos);
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

/** Hoy en ISO (YYYY-MM-DD), para que la validación de fecha no futura sea determinista en tests. */
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export { crearAcuerdoPendiente };
