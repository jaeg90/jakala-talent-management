/** Hoy en ISO (YYYY-MM-DD), la convención UTC del paquete (misma que los servicios
 *  de aplicación y los repositorios). Única copia: las reglas de dominio que
 *  necesitan «hoy» (incidencias, objetivos) importan esta función en vez de
 *  repetir la conversión. */
export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ¿Es una fecha ISO real (`YYYY-MM-DD`, mes 1–12 y día válido para ese mes)?
 *  Única copia: las reglas de dominio que validan fechas ISO (objetivos,
 *  incidencias) importan esta función en vez de repetir la expresión regular
 *  y la validación de calendario. */
export function esFechaISO(fecha: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (m === null) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12) return false;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}
