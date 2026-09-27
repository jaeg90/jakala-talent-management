import type { Acuerdo } from './agreements.js';

export type { Acuerdo };

export type ManagerId = string;

/** Manager autenticado en JTM. Ver glosario en CONTEXT.md. */
export interface Manager {
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
 * Tema propio añadido por un manager a una mentee. Persiste entre 1-to-1s hasta
 * que se retira (la baja no borra los temas ya tratados en 1-to-1s registrados).
 * Ver "Tema" en CONTEXT.md.
 */
export interface TemaPropio {
  id: string;
  menteeId: string;
  tema: string;
}

/** Proyecto de cliente en el que trabaja una mentee. Catálogo compartido. */
export interface Project {
  id: string;
  name: string;
}

/** Mentee tal y como la ve su manager en "Mi equipo": con su proyecto actual o ninguno. */
export interface MenteeConProyecto {
  id: string;
  name: string;
  project: Project | null;
}

/** Nota tomada sobre un tema genérico en un 1-to-1. */
export interface NotaPorTema {
  tema: string;
  nota: string;
}

/** 1-to-1 registrado: fecha, notas por tema y acuerdos. Ver CONTEXT.md. */
export interface OneToOne {
  id: string;
  menteeId: string;
  /** Fecha ISO (YYYY-MM-DD). */
  date: string;
  notas: NotaPorTema[];
  acuerdos: Acuerdo[];
}

/** Temas genéricos de plantilla común a todos los 1-to-1s. */
export const TEMAS_GENERICOS = [
  '¿Cómo estás?',
  '¿Qué tal el proyecto?',
  '¿Qué tal los objetivos?',
] as const;
