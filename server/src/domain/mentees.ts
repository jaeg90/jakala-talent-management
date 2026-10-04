import { esFechaISO, hoyISO } from './fechas.js';

/** Nombre obligatorio de la mentee, sin espacios exteriores. */
export function validarNombreMentee(nombre: string): string {
  const n = nombre.trim();
  if (n === '') throw new Error('Escribe el nombre y apellidos.');
  return n;
}

/** La fecha de entrada en el equipo es real y nunca posterior a hoy. */
export function validarEnEquipoDesde(fecha: string, hoy: string = hoyISO()): string {
  const f = fecha.trim();
  if (!esFechaISO(f)) throw new Error('Escribe una fecha válida.');
  if (f > hoy) throw new Error('La fecha no puede ser futura.');
  return f;
}

/** Motivo de las entradas en proyectos generadas por el alta de una mentee. */
export const MOTIVO_ALTA_EN_EL_EQUIPO = 'Alta en el equipo';
