import { esFechaISO, hoyISO } from './fechas.js';

/** Estado de una incidencia: nace abierta y se resuelve. Ver "Incidencia" en CONTEXT.md. */
export type EstadoIncidencia = 'abierta' | 'resuelta';

/** Incidencia: suceso extraordinario que afecta al seguimiento de una mentee. */
export interface Incidencia {
  id: string;
  menteeId: string;
  descripcion: string;
  estado: EstadoIncidencia;
  /** Nota que explica cómo se resolvió; vacía mientras está abierta. */
  notaResolucion: string;
  /**
   * Fecha ISO (YYYY-MM-DD) de apertura, elegida por el manager (≤ hoy): es la
   * que cuenta en Mi equipo y en el Historial (decisiones.md §Cambios 9), no la
   * fecha de creación del registro.
   */
  fechaAlta: string;
  /** Fecha ISO (YYYY-MM-DD) de resolución; null mientras está abierta. */
  fechaResolucion: string | null;
}

/** Regla de dominio: la descripción, una vez recortada, no puede estar vacía. */
export function validarDescripcionIncidencia(descripcion: string): string {
  const d = descripcion.trim();
  if (d === '') throw new Error('La descripción de la incidencia no puede estar vacía');
  return d;
}

/**
 * Regla de dominio: la fecha de apertura, una vez recortada, no puede estar
 * vacía, no puede ser una fecha inválida y no puede ser futura (decisiones.md
 * §Cambios de dominio 9: «la fecha de apertura la elige el manager (≤ hoy)»).
 * «hoy» es una fecha ISO UTC (`hoyISO()`), inyectable para que los tests sean
 * deterministas; hoy se admite.
 */
export function validarFechaApertura(fechaApertura: string, hoy: string = hoyISO()): string {
  const f = fechaApertura.trim();
  if (f === '') throw new Error('La fecha de apertura de la incidencia no puede estar vacía');
  if (!esFechaISO(f)) throw new Error('La fecha de apertura de la incidencia no es una fecha válida');
  if (f > hoy) throw new Error('La fecha no puede ser futura');
  return f;
}

/** Regla de dominio: la nota de resolución, una vez recortada, no puede estar vacía. */
export function validarNotaResolucion(nota: string): string {
  const n = nota.trim();
  if (n === '') throw new Error('La nota de resolución no puede estar vacía');
  return n;
}

/** Crea los campos de una incidencia. Regla de dominio: las incidencias nacen abiertas. */
export function crearIncidenciaAbierta(
  descripcion: string,
  fechaApertura: string,
): { descripcion: string; estado: EstadoIncidencia; notaResolucion: string; fechaAlta: string; fechaResolucion: string | null } {
  return {
    descripcion,
    estado: 'abierta',
    notaResolucion: '',
    fechaAlta: fechaApertura,
    fechaResolucion: null,
  };
}

/**
 * Regla de dominio: una incidencia abierta pasa a resuelta con nota de resolución.
 * Una incidencia resuelta no se reabre (no se revive).
 */
export function resolverIncidencia(incidencia: Incidencia, nota: string, fechaResolucion: string): Incidencia {
  if (incidencia.estado !== 'abierta') {
    throw new Error(`Una incidencia ${incidencia.estado} no puede resolverse de nuevo`);
  }
  return {
    ...incidencia,
    estado: 'resuelta',
    notaResolucion: nota,
    fechaResolucion,
  };
}