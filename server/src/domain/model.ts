import type { Acuerdo } from './agreements.js';
import type { EstadoObjetivo, Objetivo } from './objetivos.js';
import type { EstadoIncidencia, Incidencia } from './incidencias.js';
import type { CambioProyecto } from './proyectos.js';
import type {
  Asignacion,
  EstadoProyecto,
  EventoHistorialProyecto,
  ProyectoConEstado,
} from './asignaciones.js';

export type {
  Acuerdo,
  EstadoObjetivo,
  Objetivo,
  EstadoIncidencia,
  Incidencia,
  CambioProyecto,
  Asignacion,
  EstadoProyecto,
  ProyectoConEstado,
  EventoHistorialProyecto,
};

export type ManagerId = string;

/** Manager autenticado en JTM. Ver glosario en CONTEXT.md. */
export interface Manager {
  id: ManagerId;
  email: string;
  name: string;
  /**
   * Si la cuenta usa contraseña temporal: tras entrar, el cliente redirige a
   * Perfil y contraseña (ver "Contraseña temporal" en CONTEXT.md). Viaja con la
   * sesión del manager autenticado, pero no se expone en el catálogo.
   */
  debeCambiarContraseña: boolean;
}

/**
 * Proyección del catálogo de managers (para elegir el destino de un traspaso):
 * solo id, email y name. No incluye el flag de contraseña temporal.
 */
export interface ManagerCatalogo {
  id: ManagerId;
  email: string;
  name: string;
}

/** Mentee del equipo de un manager. Existe como dato; no inicia sesión. */
export interface Mentee {
  id: string;
  managerId: ManagerId;
  name: string;
}

/**
 * Traspaso: paso de una mentee de un manager a otro por reorganización.
 * El historial pertenece a la mentee y el manager de destino lo hereda completo.
 * Ver "Traspaso" en CONTEXT.md.
 */
export interface Traspaso {
  id: string;
  menteeId: string;
  /** Manager del que sale la mentee. */
  origenId: ManagerId;
  /** Manager al que pasa la mentee. */
  destinoId: ManagerId;
  /** Fecha ISO (YYYY-MM-DD) del traspaso. */
  fecha: string;
  motivo: string;
}

/** Estado de un tema propio: vigente (aparece en el formulario) o retirado. */
export type EstadoTemaPropio = 'vigente' | 'retirado';

/**
 * Tema propio añadido por un manager a una mentee. Persiste entre 1-to-1s; la
 * retirada es real y sin borrado físico: el tema queda retirado (deja de aparecer
 * en el formulario, se puede «Volver a usar») y los 1-to-1s ya registrados no
 * cambian. Ver "Tema" en CONTEXT.md.
 */
export interface TemaPropio {
  id: string;
  menteeId: string;
  tema: string;
  /** Fecha ISO (YYYY-MM-DD) del alta del tema propio. */
  desde: string;
  estado: EstadoTemaPropio;
  /** Fecha ISO (YYYY-MM-DD) del retiro; null mientras está vigente. */
  retiradoEl: string | null;
}

/** Proyecto de cliente en el que trabaja una mentee. Catálogo compartido. */
export interface Project {
  id: string;
  name: string;
}

/** Proyecto del catálogo con su estado: vigente o retirado, y la fecha del retiro. */
export interface ProyectoCatalogo extends Project {
  estado: EstadoProyecto;
  fechaRetirada: string | null;
}

/**
 * Mentee tal y como la ve su manager en "Mi equipo": los proyectos vigentes
 * (orden alfabético) y las señales agregadas por mentee — nº de acuerdos
 * pendientes, incidencias abiertas, objetivos en curso y fecha del último
 * 1-to-1. Ver decisiones.md §Cambios 5 y 12.
 */
export interface MenteeDeEquipo {
  id: string;
  name: string;
  /** Fecha ISO de entrada en el equipo; null solo como respaldo defensivo. */
  enEquipoDesde: string | null;
  /** Nombres de los proyectos vigentes, en orden alfabético. */
  proyectos: string[];
  acuerdosPendientes: number;
  incidenciasAbiertas: number;
  objetivosEnCurso: number;
  /** Fecha ISO (YYYY-MM-DD) del último 1-to-1; null si no hay ninguno. */
  ultimoUnoAUno: string | null;
}

/** Nota tomada sobre un tema en un 1-to-1. */
export interface NotaPorTema {
  tema: string;
  nota: string;
}

/** 1-to-1 registrado: fecha, notas por tema y acuerdos. Ver CONTEXT.md. */
export interface OneToOne {
  id: string;
  menteeId: string;
  /** Fecha ISO (YYYY-MM-DD). Puede haber varios el mismo día. */
  date: string;
  notas: NotaPorTema[];
  acuerdos: Acuerdo[];
  /** Manager que lo registró; base del plazo de edición de 7 días (ADR-0009). */
  registradoPor: ManagerId;
  /** Timestamp (ISO 8601) del registro; base del plazo de edición de 7 días (ADR-0009). */
  registradoEn: string;
}

/** Estado de un tema de la plantilla de 1-to-1 de un manager. */
export type EstadoTemaPlantilla = 'vigente' | 'retirado';

/**
 * Tema genérico de la plantilla de 1-to-1 de un manager: texto, posición
 * (`orden`) y estado vigente/retirado. Ver "Tema" y "Plantilla de 1-to-1" en
 * CONTEXT.md.
 */
export interface TemaPlantilla {
  id: string;
  managerId: ManagerId;
  tema: string;
  /** Posición entre los temas vigentes (0 = primero). */
  orden: number;
  estado: EstadoTemaPlantilla;
}
