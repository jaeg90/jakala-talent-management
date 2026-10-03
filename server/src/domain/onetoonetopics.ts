/** Nota tomada sobre un tema en un 1-to-1. */
export interface NotaPorTema {
  tema: string;
  nota: string;
}

/**
 * Regla de dominio: a lo sumo una nota por tema en cada 1-to-1.
 * Lanza si dos notas comparten tema.
 */
export function validarNotasPorTema(notas: NotaPorTema[]): void {
  const vistos = new Set<string>();
  for (const { tema } of notas) {
    if (vistos.has(tema)) {
      throw new Error(`Tema duplicado en el 1-to-1: ${tema}`);
    }
    vistos.add(tema);
  }
}

/** True si `fecha` es una fecha ISO YYYY-MM-DD real (contrato del modelo). */
export function esFechaISO(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const año = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  const día = Number(fecha.slice(8, 10));
  const calendario = new Date(Date.UTC(año, mes - 1, día));
  return (
    calendario.getUTCFullYear() === año &&
    calendario.getUTCMonth() === mes - 1 &&
    calendario.getUTCDate() === día
  );
}

/**
 * Regla de dominio: la fecha de un 1-to-1 debe estar presente, ser una fecha
 * ISO YYYY-MM-DD real (contrato del modelo) y no ser futura. Lanza con un copy
 * propio para cada violación (spec §04: «Fecha no futura»).
 */
export function validarFechaOneToOne(fecha: string, hoy: string): void {
  if (fecha === '') {
    throw new Error('Elige una fecha.');
  }
  if (!esFechaISO(fecha)) {
    throw new Error('La fecha debe ser una fecha ISO YYYY-MM-DD válida.');
  }
  if (fecha > hoy) {
    throw new Error('La fecha no puede ser futura.');
  }
}

/**
 * Regla de dominio: un 1-to-1 debe llevar al menos una nota no vacía o un
 * acuerdo (spec §04). Lanza con el copy exacto de la spec.
 */
export function validarContenidoOneToOne(notas: NotaPorTema[], acuerdos: { text: string }[]): void {
  const hayNota = notas.some((n) => n.nota.trim() !== '');
  if (!hayNota && acuerdos.length === 0) {
    throw new Error('Escribe al menos una nota o un acuerdo antes de guardar.');
  }
}
