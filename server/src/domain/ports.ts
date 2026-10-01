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
  Incidencia,
  Project,
  CambioProyecto,
  Traspaso,
  TemaPlantilla,
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

/**
 * Puerto de la plantilla de 1-to-1 de un manager (temas genéricos con orden y
 * estado vigente/retirado). Las operaciones se acotan por manager (aislamiento).
 */
export interface PlantillaRepository {
  /** Plantilla completa del manager: vigentes en orden y después los retirados. */
  plantillaOf(managerId: ManagerId): Promise<TemaPlantilla[]>;
  /** Añade un tema vigente al final de la plantilla; lanza si el texto está vacío o repetido. */
  addTema(managerId: ManagerId, tema: string): Promise<TemaPlantilla>;
  /** Edita el texto de un tema; lanza si no existe o no es del manager. */
  editarTema(managerId: ManagerId, temaId: string, tema: string): Promise<TemaPlantilla>;
  /** Mueve un tema vigente una posición (delta -1 sube, +1 baja); devuelve la plantilla. */
  moverTema(managerId: ManagerId, temaId: string, delta: -1 | 1): Promise<TemaPlantilla[]>;
  /** Retira un tema vigente (queda retirado); lanza si no existe o no es del manager. */
  retirarTema(managerId: ManagerId, temaId: string): Promise<TemaPlantilla>;
  /** Vuelve a activar un tema retirado, al final de los vigentes; lanza si no existe o no es del manager. */
  reactivarTema(managerId: ManagerId, temaId: string): Promise<TemaPlantilla>;
  /** Restablece la plantilla a sus temas iniciales; devuelve la plantilla resultante. */
  restablecerPlantilla(managerId: ManagerId): Promise<TemaPlantilla[]>;
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

/** Datos para registrar un cambio de proyecto. El origen se deriva del proyecto actual. */
export interface NuevoCambioProyecto {
  fecha: string;
  destinoId: string | null;
  motivo: string;
}

/** Mentee tal y como aparece agrupada en la vista "quién está en cada proyecto". */
export interface MiembroDeProyecto {
  id: string;
  name: string;
}

/** Proyecto (o el grupo "sin proyecto") con los mentees del manager que están hoy en él. */
export interface MiembrosPorProyecto {
  projectId: string | null;
  projectName: string | null;
  mentees: MiembroDeProyecto[];
}

/** Situación actual de una mentee: su proyecto actual y el historial de cambios. */
export interface SituacionProyecto {
  project: Project | null;
  cambios: CambioProyecto[];
}

/**
 * Puerto del catálogo de proyectos y de los cambios de proyecto de una mentee.
 * Las operaciones sobre una mentee se acotan por manager (aislamiento).
 */
export interface ProyectoRepository {
  /** Catálogo de proyectos (compartido). */
  proyectos(): Promise<Project[]>;
  /** Da de alta un proyecto; lanza si el nombre está vacío o repetido. */
  addProyecto(name: string): Promise<Project>;
  /** Proyecto actual e historial de cambios de una mentee, solo si es del manager. */
  situacionDe(managerId: ManagerId, menteeId: string): Promise<SituacionProyecto>;
  /** Registra un cambio (origen = proyecto actual) y actualiza el proyecto actual. */
  registrarCambio(managerId: ManagerId, menteeId: string, cambio: NuevoCambioProyecto): Promise<CambioProyecto>;
  /** Mentees del manager agrupados por su proyecto actual (incluye "sin proyecto"). */
  miembrosPorProyecto(managerId: ManagerId): Promise<MiembrosPorProyecto[]>;
}

/** Puerto de sesiones: crear/consultar/cerrar sesiones por token. */
export interface SessionStore {
  create(manager: Manager): Promise<string>;
  find(token: string): Promise<Manager | null>;
  revoke(token: string): Promise<void>;
}

/** Incidencia tal y como la ve su manager en la vista de equipo: incluye el nombre de la mentee. */
export interface IncidenciaConMentee extends Incidencia {
  menteeName: string;
}

/** Puerto de incidencias: alta, consulta, listado de equipo y resolución. */
export interface IncidenciaRepository {
  /** Incidencias abiertas de todo el equipo del manager. */
  abiertasDe(managerId: ManagerId): Promise<IncidenciaConMentee[]>;
  /** Historial (abiertas y resueltas) de una mentee, solo si es del manager. */
  historialDe(managerId: ManagerId, menteeId: string): Promise<Incidencia[]>;
  /** Da de alta una incidencia abierta en una mentee; lanza si no es del manager. */
  addIncidencia(managerId: ManagerId, menteeId: string, descripcion: string): Promise<Incidencia>;
  /** Resuelve una incidencia con nota; lanza si no existe, no es del manager o ya está resuelta. */
  resolverIncidencia(managerId: ManagerId, incidenciaId: string, nota: string): Promise<Incidencia>;
}

/** Datos para registrar un traspaso de mentee. El origen se deriva del manager actual. */
export interface NuevoTraspaso {
  fecha: string;
  destinoId: ManagerId;
  motivo: string;
}

/**
 * Puerto de traspasos: catálogo de managers, historial de traspasos de una
 * mentee y el propio traspaso entre managers. El traspaso actualiza la asignación
 * de la mentee manteniendo "un manager por mentee a la vez"; el historial
 * (1-to-1s, acuerdos, objetivos, incidencias, cambios de proyecto) permanece
 * ligado a la mentee y lo hereda completo el manager de destino.
 */
export interface TraspasoRepository {
  /** Catálogo de managers (para elegir el destino de un traspaso). */
  managers(): Promise<Manager[]>;
  /** Historial de traspasos de una mentee, solo si es del manager. */
  historialDe(managerId: ManagerId, menteeId: string): Promise<Traspaso[]>;
  /** Traspasa una mentee a otro manager; lanza si no es del manager, el destino no existe o es el mismo. */
  traspasar(managerId: ManagerId, menteeId: string, traspaso: NuevoTraspaso): Promise<Traspaso>;
}
