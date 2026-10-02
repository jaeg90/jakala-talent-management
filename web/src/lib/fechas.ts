/**
 * Fechas de JTM: exactas y relativas con Intl `es-ES`.
 * Meses abreviados: ene, feb, mar, abr, may, jun, jul, ago, sept, oct, nov, dic
 * (componentes.md §Fechas). Todas las fechas son ISO `YYYY-MM-DD`.
 */

const CORTO = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const CON_ANIO = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/* Relativas con `Intl.RelativeTimeFormat('es-ES')` (sin cadenas manuales):
   «hace 9 días», «hace 3 semanas», «hace 2 meses». `numeric: 'always'` para
   conservar «hace 1 día» (el 'auto' devolvería «ayer»); el «hoy» sale del
   formato automático del 0. */
const RELATIVO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'always' });
const HOY = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/** Parsea una fecha ISO sin desviarla por la zona horaria local. */
function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

/** «20 sept» — día y mes abreviado, sin año. */
export function fechaCorta(fecha: string): string {
  return CORTO.format(parseFecha(fecha));
}

/** «29 sept 2026» — día, mes abreviado y año. */
export function fechaConAnio(fecha: string): string {
  return CON_ANIO.format(parseFecha(fecha));
}

/**
 * «20 sept» o «18 nov 2024» — el año solo si no es el actual.
 * Para el atributo `datetime` de `<time>` usa `fechaISO`.
 */
export function fechaExacta(fecha: string, hoy: Date = new Date()): string {
  return parseFecha(fecha).getUTCFullYear() === hoy.getFullYear()
    ? fechaCorta(fecha)
    : fechaConAnio(fecha);
}

/** «2026-09-20» — el valor ISO para `<time datetime>` o `title`. */
export function fechaISO(fecha: string): string {
  return parseFecha(fecha).toISOString().slice(0, 10);
}

/** «hace 9 días», «hace 3 semanas», «hace 2 meses»… contando días naturales hasta hoy. */
export function fechaRelativa(fecha: string, hoy: Date = new Date()): string {
  const objetivo = parseFecha(fecha).getTime();
  const referencia = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.round((referencia - objetivo) / MILISEGUNDOS_POR_DIA);

  // Escalera: hoy → días (<7) → semanas (<5) → meses (hasta 12) → años desde
  // 365 días exactos («hace 9 días», «hace 3 semanas», «hace 2 meses»; nunca un
  // contador a cero: los 360–364 días son «hace 12 meses», no «hace 0 años»).
  if (dias <= 0) return HOY.format(0, 'day');
  if (dias < 7) return RELATIVO.format(-dias, 'day');

  const semanas = Math.floor(dias / 7);
  if (semanas < 5) return RELATIVO.format(-semanas, 'week');

  const meses = Math.floor(dias / 30); // 360–364 días → «hace 12 meses»
  if (dias < 365) return RELATIVO.format(-meses, 'month');

  return RELATIVO.format(-Math.floor(dias / 365), 'year');
}