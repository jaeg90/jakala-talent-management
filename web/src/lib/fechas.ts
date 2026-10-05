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

const DIA_SEMANA = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  timeZone: 'UTC',
});

/**
 * «Sábado 20 sept 2026» — día de la semana (en mayúscula inicial) + fecha completa
 * (día, mes abreviado y año). Fila meta del detalle de 1-to-1 (spec §11a).
 */
export function fechaConDiaSemana(fecha: string): string {
  const dia = DIA_SEMANA.format(parseFecha(fecha));
  const nombre = dia.charAt(0).toUpperCase() + dia.slice(1);
  return `${nombre} ${fechaConAnio(fecha)}`;
}

const MES_ANIO = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * «mar 2025» — compacto «mes año» sin día (componentes.md §Fechas: mes abreviado,
 * año siempre). Sirve para «desde mar 2025» (proyectos) y «hasta jun 2027»
 * (objetivos en curso).
 */
export function fechaMesAnio(fecha: string): string {
  return MES_ANIO.format(parseFecha(fecha));
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

/** Hoy en ISO (YYYY-MM-DD), la misma convención UTC del backend (`hoyISO`). */
export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Meses naturales restantes hasta la fecha límite, redondeados HACIA ARRIBA
 * (spec §05: «hasta 31 dic 2026 · quedan 3 meses» — a principios de octubre
 * quedan 2 meses y pico → 3). Suma la diferencia de meses de calendario y un
 * «pico» si el día del límite cae después del día de hoy (el aniversario mensual
 * aún no se ha cumplido). «hoy» en ISO UTC, convención `hoyISO()` del paquete.
 */
export function mesesHasta(fechaLimite: string, hoy: string = hoyISO()): number {
  const anioHoy = Number(hoy.slice(0, 4));
  const mesHoy = Number(hoy.slice(5, 7));
  const diaHoy = Number(hoy.slice(8, 10));
  const anioLimite = Number(fechaLimite.slice(0, 4));
  const mesLimite = Number(fechaLimite.slice(5, 7));
  const diaLimite = Number(fechaLimite.slice(8, 10));
  let meses = (anioLimite - anioHoy) * 12 + (mesLimite - mesHoy);
  if (diaLimite > diaHoy) meses += 1;
  return meses;
}

const MES_COMPLETO = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  timeZone: 'UTC',
});

/**
 * Etiqueta de grupo del timeline del Historial (spec §07): el año en curso se
 * agrupa por mes con el nombre COMPLETO («Septiembre 2026», «Febrero 2026») y los
 * años anteriores por año («2025»). Distinto del compacto «mes año» de `fechaMesAnio`
 * (que abrevia el mes). `anioActual` se inyecta para que el agrupado sea determinista.
 */
export function etiquetaGrupoHistorial(fecha: string, anioActual: number): string {
  const d = parseFecha(fecha);
  const anio = d.getUTCFullYear();
  if (anio !== anioActual) return String(anio);
  const mes = MES_COMPLETO.format(d);
  return mes.charAt(0).toUpperCase() + mes.slice(1) + ' ' + String(anio);
}

/**
 * Valor ISO para el `<time datetime>` del encabezado de grupo del Historial
 * (accesibilidad.md §Globales: «Fechas en `<time datetime="…">`»). El grupo por
 * mes apunta al día 1 de ese mes («2026-09-01») y el grupo por año al 1 de enero
 * («2025-01-01»): el encabezado es una marca de posición temporal, no una fecha
 * propia del evento (que el ticket excluye).
 */
export function isoGrupoHistorial(fecha: string, anioActual: number): string {
  const d = parseFecha(fecha);
  const anio = d.getUTCFullYear();
  if (anio !== anioActual) return `${anio}-01-01`;
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${anio}-${mes}-01`;
}

/** «hace 9 días», «hace 3 semanas», «hace 2 meses»… contando días naturales hasta hoy
 * (en UTC, la misma convención de «hoy» del dominio: `hoyISO()` del backend). */
export function fechaRelativa(fecha: string, hoy: Date = new Date()): string {
  const objetivo = parseFecha(fecha).getTime();
  const referencia = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
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