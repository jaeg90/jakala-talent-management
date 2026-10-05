import type { Acuerdo } from './agreements.js';
import type {
  Manager,
  ManagerCatalogo,
  ManagerId,
  Mentee,
  MenteeDeEquipo,
  NotaPorTema,
  Objetivo,
  EstadoObjetivo,
  OneToOne,
  TemaPropio,
  Incidencia,
  Project,
  ProyectoCatalogo,
  CambioProyecto,
  Traspaso,
  TemaPlantilla,
} from './model.js';
import type { Asignacion, ProyectoConEstado } from './asignaciones.js';
import type { EventoHistorial } from './historial.js';

/**
 * Puerto de autenticación (ADR-0002): comprobar credenciales de manager.
 * Adaptador actual: usuarios semilla en SQLite. Futuro: Entra ID.
 */
export interface Authenticator {
  /** Devuelve el manager si las credenciales son correctas; null en caso contrario. */
  authenticate(email: string, password: string): Promise<Manager | null>;
}

/** Puerto de equipo: los mentees de un manager, con sus señales agregadas. */
export interface TeamRepository {
  teamOf(managerId: ManagerId): Promise<MenteeDeEquipo[]>;
}

/** Alta con historial vacío y entradas en los proyectos seleccionados. */
export interface NuevaMentee {
  name: string;
  proyectos: string[];
  enEquipoDesde: string;
}

export interface MenteeRepository {
  /** Guarda la mentee y todas sus asignaciones de forma atómica. */
  addMentee(managerId: ManagerId, nueva: NuevaMentee): Promise<Mentee & { enEquipoDesde: string }>;
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
  /** Un 1-to-1 concreto de una mentee; null si no existe o no es de la mentee/manager. */
  oneToOneOf(managerId: ManagerId, menteeId: string, unoAUnoId: string): Promise<OneToOne | null>;
  /** Registra un 1-to-1; sus acuerdos nacen pendientes. */
  save(managerId: ManagerId, oneToOne: NuevoOneToOne): Promise<OneToOne>;
  /** Los acuerdos pendientes de una mentee. */
  pendingAgreementsOf(managerId: ManagerId, menteeId: string): Promise<Acuerdo[]>;
  /** Marca un acuerdo cumplido; devuelve false si no pertenece a una mentee del manager. */
  completeAgreement(managerId: ManagerId, acuerdoId: string): Promise<boolean>;
}

/**
 * Puerto de temas propios de una mentee: alta, retirada (sin borrado físico) y
 * consulta de vigentes y retirados. Las operaciones se acotan por manager
 * (aislamiento).
 */
export interface TemaPropioRepository {
  /** Nombre de una mentee (solo si es del manager); null si no pertenece. */
  nombreDeMentee(managerId: ManagerId, menteeId: string): Promise<string | null>;
  /** Temas propios de una mentee, vigentes y retirados (solo si es del manager). */
  temasPropiosOf(managerId: ManagerId, menteeId: string): Promise<TemaPropio[]>;
  /** Da de alta un tema propio (vigente); lanza si el nombre está vacío o repetido. */
  addTemaPropio(managerId: ManagerId, menteeId: string, tema: string): Promise<TemaPropio>;
  /** Retira un tema propio de una mentee; devuelve false si no existe, no
   *  pertenece a la mentee indicada o no es del manager. La mentee acota la
   *  retirada para que una URL de otra mentee no retire un tema ajeno. */
  retirarTemaPropio(managerId: ManagerId, menteeId: string, temaPropioId: string): Promise<boolean>;
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

/** Datos para entrar a una mentee en un proyecto (alta de asignación). */
export interface NuevaAsignacion {
  proyecto: string;
  desde: string;
  motivoEntrada: string;
}

/** Datos para salir de un proyecto (cierre de la asignación vigente). */
export interface SalidaDeProyecto {
  hasta: string;
  motivoSalida: string;
}

/** Situación actual de una mentee: su proyecto actual y el historial de cambios. */
export interface SituacionProyecto {
  project: Project | null;
  cambios: CambioProyecto[];
}

/** Proyecto vigente de una mentee con la fecha de su entrada. */
export interface ProyectoActual {
  id: string;
  name: string;
  /** Fecha ISO (YYYY-MM-DD) de entrada en el proyecto. */
  desde: string;
}

/**
 * Puerto del catálogo de proyectos y de los cambios de proyecto de una mentee.
 * Las operaciones sobre una mentee se acotan por manager (aislamiento).
 */
export interface ProyectoRepository {
  /** Catálogo completo de proyectos (vigentes y retirados), con su estado. */
  proyectos(): Promise<ProyectoCatalogo[]>;
  /** Da de alta un proyecto vigente; lanza si el nombre está vacío o repetido. */
  addProyecto(name: string): Promise<Project>;
  /** Proyecto actual e historial de cambios de una mentee, solo si es del manager. */
  situacionDe(managerId: ManagerId, menteeId: string): Promise<SituacionProyecto>;
  /** Registra un cambio (origen = proyecto actual); escribe doble en el histórico y en asignaciones. */
  registrarCambio(managerId: ManagerId, menteeId: string, cambio: NuevoCambioProyecto): Promise<CambioProyecto>;
  /** Proyectos vigentes de una mentee (con la fecha de entrada), en orden alfabético. */
  proyectosActualesDe(managerId: ManagerId, menteeId: string): Promise<ProyectoActual[]>;
  /** Entra a una mentee en un proyecto; lanza si ya tiene una asignación vigente al mismo. */
  entrarEnProyecto(managerId: ManagerId, menteeId: string, entrada: NuevaAsignacion): Promise<Asignacion>;
  /** Cierra la asignación vigente de una mentee a un proyecto (salida con fecha y motivo). */
  salirDeProyecto(
    managerId: ManagerId,
    menteeId: string,
    proyectoId: string,
    salida: SalidaDeProyecto,
  ): Promise<Asignacion>;
  /** Retira un proyecto vigente (fechaRetirada = hoy); lanza si tiene asignaciones vigentes. */
  retirarProyecto(proyectoId: string): Promise<ProyectoConEstado>;
  /** Reactiva un proyecto retirado (fechaRetirada = null). */
  reactivarProyecto(proyectoId: string): Promise<ProyectoConEstado>;
}

/** Puerto de sesiones: crear/consultar/cerrar sesiones por token. */
export interface SessionStore {
  create(manager: Manager): Promise<string>;
  find(token: string): Promise<Manager | null>;
  revoke(token: string): Promise<void>;
  /** Invalida todas las sesiones de un manager salvo la actual (`keepToken`). */
  invalidateOtherSessions(managerId: ManagerId, keepToken: string): Promise<void>;
  /** Actualiza el manager de una sesión (p. ej. al despejar el flag de contraseña temporal). */
  updateManager(token: string, manager: Manager): Promise<void>;
}

/**
 * Puerto de cuentas de manager: alta, censo y cambio de contraseña. La verificación de la
 * contraseña vigente y el guardado de la nueva despejan el flag de contraseña
 * temporal. Ver "Cambiar contraseña" en decisiones.md.
 */
export interface CuentaRepository {
  /** Censo sin credenciales ni flag, con el tamaño actual de cada equipo. */
  managers(): Promise<(ManagerCatalogo & { numMentees: number })[]>;
  /** Alta atómica con contraseña temporal, flag activo y plantilla inicial. */
  crearManager(name: string, email: string, temporal: string): Promise<ManagerCatalogo & { numMentees: number }>;
  /** Devuelve true si `actual` es la contraseña vigente del manager. */
  verificarContrasena(managerId: ManagerId, actual: string): Promise<boolean>;
  /** Guarda la nueva contraseña y despeja el flag; devuelve el manager actualizado. */
  cambiarContrasena(managerId: ManagerId, nueva: string): Promise<Manager>;
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
  /** Da de alta una incidencia abierta en una mentee con su fecha de apertura
   *  (≤ hoy, elegida por el manager); lanza si no es del manager. */
  addIncidencia(
    managerId: ManagerId,
    menteeId: string,
    descripcion: string,
    fechaApertura: string,
  ): Promise<Incidencia>;
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
 * Puerto del historial unificado de una mentee (ADR-0007): la agregación en
 * consulta de 1-to-1s, incidencias, objetivos cerrados, entradas/salidas de
 * proyecto y traspasos, ya ordenada por fecha descendente (criterio estable del
 * mismo día en domain/historial.ts). El filtrado por `?tipo=` lo aplica el caso
 * de uso; el puerto devuelve el feed completo de la mentee, acotado por manager.
 */
export interface HistorialRepository {
  /** Feed cronológico completo (descendente) de una mentee, solo si es del manager. */
  historialDe(managerId: ManagerId, menteeId: string): Promise<EventoHistorial[]>;
}

/**
 * Puerto de traspasos: catálogo de managers, historial de traspasos de una
 * mentee y el propio traspaso entre managers. El traspaso actualiza la asignación
 * de la mentee manteniendo "un manager por mentee a la vez"; el historial
 * (1-to-1s, acuerdos, objetivos, incidencias, cambios de proyecto) permanece
 * ligado a la mentee y lo hereda completo el manager de destino.
 */
export interface TraspasoRepository {
  /** Catálogo de managers (para elegir el destino de un traspaso). Sin el flag de contraseña. */
  managers(): Promise<ManagerCatalogo[]>;
  /** Historial de traspasos de una mentee, solo si es del manager. */
  historialDe(managerId: ManagerId, menteeId: string): Promise<Traspaso[]>;
  /** Traspasa una mentee a otro manager; lanza si no es del manager, el destino no existe o es el mismo. */
  traspasar(managerId: ManagerId, menteeId: string, traspaso: NuevoTraspaso): Promise<Traspaso>;
}
