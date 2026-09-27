import type { Acuerdo } from './agreements.js';
import type { Manager, ManagerId, MenteeConProyecto, NotaPorTema, OneToOne } from './model.js';

/**
 * Puerto de autenticación (ADR-0002): comprobar credenciales de manager.
 * Adaptador actual: usuarios semilla en SQLite. Futuro: Entra ID.
 */
export interface Authenticator {
  /** Devuelve el manager si las credenciales son correctas; null en caso contrario. */
  authenticate(email: string, password: string): Promise<Manager | null>;
}

/** Puerto de equipo: los mentees de un manager, con su proyecto actual. */
export interface TeamRepository {
  teamOf(managerId: ManagerId): Promise<MenteeConProyecto[]>;
}

/** Datos para registrar un 1-to-1. */
export interface NuevoOneToOne {
  menteeId: string;
  date: string;
  notas: NotaPorTema[];
  acuerdos: { text: string }[];
}

/**
 * Puerto de 1-to-1s: historial de una mentee, registro y acuerdos.
 * Todas las operaciones se acotan por manager (aislamiento).
 */
export interface OneToOneRepository {
  /** Historial cronológico (ascendente por fecha) de 1-to-1s de una mentee. */
  historyOf(managerId: ManagerId, menteeId: string): Promise<OneToOne[]>;
  /** Registra un 1-to-1; sus acuerdos nacen pendientes. */
  save(managerId: ManagerId, oneToOne: NuevoOneToOne): Promise<OneToOne>;
  /** Los acuerdos pendientes de una mentee. */
  pendingAgreementsOf(managerId: ManagerId, menteeId: string): Promise<Acuerdo[]>;
  /** Marca un acuerdo cumplido; devuelve false si no pertenece a una mentee del manager. */
  completeAgreement(managerId: ManagerId, acuerdoId: string): Promise<boolean>;
}

/** Puerto de sesiones: crear/consultar/cerrar sesiones por token. */
export interface SessionStore {
  create(manager: Manager): Promise<string>;
  find(token: string): Promise<Manager | null>;
  revoke(token: string): Promise<void>;
}
