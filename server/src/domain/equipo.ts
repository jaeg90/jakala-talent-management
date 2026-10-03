import type { MenteeDeEquipo } from './model.js';

/** Umbral (en días naturales) a partir del cual el último 1-to-1 se considera obsoleto. */
const DIAS_SIN_ATENCION = 14;

/**
 * Mentee tal y como se muestra en el panel de Mi equipo: sus señales agregadas
 * y los veredictos de señal ya calculados por el dominio.
 */
export interface FilaDeEquipo extends MenteeDeEquipo {
  /** Señal «Necesita atención» (CONTEXT.md). */
  necesitaAtencion: boolean;
  /**
   * Veredicto del badge de antigüedad de la celda «Último 1-to-1»: el último
   * 1-to-1 tiene más de 14 días. Lo calcula el dominio con la misma fecha «hoy»
   * que la señal; la celda solo lo renderiza (nunca recalcula en el cliente).
   */
  badgeAntiguedad: boolean;
}

/**
 * Veredicto del badge de antigüedad (spec §02 / ticket #17): se muestra solo
 * cuando el último 1-to-1 tiene más de 14 días. Sin ningún 1-to-1 previo no hay
 * antigüedad que evaluar (la celda muestra «Sin 1-to-1s», derivado del valor
 * null y no de este cálculo).
 */
export function badgeAntiguedad(ultimoUnoAUno: string | null, hoy: string): boolean {
  if (ultimoUnoAUno === null) return false;
  return diasDesde(ultimoUnoAUno, hoy) > DIAS_SIN_ATENCION;
}

/**
 * Regla de dominio «Necesita atención» (CONTEXT.md): una mentee necesita
 * atención si tiene alguna incidencia abierta o si su último 1-to-1 fue hace
 * más de 14 días. Sin ningún 1-to-1 previo no hay antigüedad que evaluar, así
 * que esa cláusula no aplica. Ver decisiones.md §Producto.
 */
export function necesitaAtencion(incidenciasAbiertas: number, ultimoUnoAUno: string | null, hoy: string): boolean {
  if (incidenciasAbiertas > 0) return true;
  return badgeAntiguedad(ultimoUnoAUno, hoy);
}

/**
 * Regla de dominio: orden del equipo. Primero quien necesita atención; el
 * desempate es por más acuerdos pendientes y, si empata, por nombre.
 */
export function ordenarEquipo(filas: FilaDeEquipo[]): FilaDeEquipo[] {
  return [...filas].sort(compararFilas);
}

/** Comparador de filas del panel: atención · acuerdos pendientes · nombre. */
function compararFilas(a: FilaDeEquipo, b: FilaDeEquipo): number {
  if (a.necesitaAtencion !== b.necesitaAtencion) {
    return a.necesitaAtencion ? -1 : 1;
  }
  if (a.acuerdosPendientes !== b.acuerdosPendientes) {
    return b.acuerdosPendientes - a.acuerdosPendientes;
  }
  return a.name.localeCompare(b.name);
}

/** Días naturales desde `fecha` (ISO YYYY-MM-DD) hasta `hoy` (ISO YYYY-MM-DD). */
function diasDesde(fecha: string, hoy: string): number {
  const referencia = Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1, Number(hoy.slice(8, 10)));
  const objetivo = Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)));
  return Math.round((referencia - objetivo) / (24 * 60 * 60 * 1000));
}