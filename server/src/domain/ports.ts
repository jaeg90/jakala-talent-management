import type { Acuerdo } from './agreements.js';
import type {
  Manager,
  ManagerId,
  MenteeConProyecto,
  NotaPorTema,
  Objetivo,
  EstadoObjetivo,
  OneToOne,
  TemaPropio,
} from './model.js';

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

/**
 * Puerto de temas propios de una mentee: alta, baja y consulta de los vigentes.
 * Las operaciones se acotan por manager (aislamiento).
 */
export interface TemaPropioRepository {
  /** Temas propios vigentes de una mentee (solo si es del manager). */
  temasPropiosOf(managerId: ManagerId, menteeId: string): Promise<TemaPropio[]>;
  /** Da de alta un tema propio; lanza si el nombre está vacío o repetido. */
  addTemaPropio(managerId: ManagerId, menteeId: string, tema: string): Promise<TemaPropio>;
  /** Da de baja un tema propio; devuelve false si no existe o no pertenece al manager. */
  removeTemaPropio(managerId: ManagerId, temaPropioId: string): Promise<boolean>;
}

/** Datos para dar de alta un objetivo anual. */
export interface NuevoObjetivo {
  menteeId: string;
  titulo: string;
  descripcion: string;
  fechaLimite: string;
}

/** Datos para editar un objetivo en curso. */
export interface EditarObjetivo {
  titulo: string;
  descripcion: string;
  fechaLimite: string;
}

/**
 * Puerto de objetivos anuales de una mentee: alta, edición, consulta y cambio
 * de estado. Las operaciones se acotan por manager (aislamiento).
 */
export interface ObjetivoRepository {
  /** Los objetivos de una mentee (solo si es del manager). */
  objetivosOf(managerId: ManagerId, menteeId: string): Promise<Objetivo[]>;
  /** Da de alta un objetivo en curso; lanza si la mentee no es del manager. */
  addObjetivo(managerId: ManagerId, nuevo: NuevoObjetivo): Promise<Objetivo>;
  /** Edita un objetivo en curso; lanza si no existe, no es del manager o está cerrado. */
  updateObjetivo(managerId: ManagerId, objetivoId: string, cambios: EditarObjetivo): Promise<Objetivo>;
  /** Cambia el estado de un objetivo en curso; lanza si no existe, no es del manager o está cerrado. */
  cambiarEstado(managerId: ManagerId, objetivoId: string, estado: EstadoObjetivo): Promise<Objetivo>;
}

/** Puerto de sesiones: crear/consultar/cerrar sesiones por token. */
export interface SessionStore {
  create(manager: Manager): Promise<string>;
  find(token: string): Promise<Manager | null>;
  revoke(token: string): Promise<void>;
}
