import type { ManagerId } from './model.js';

/** Regla de dominio: la fecha del traspaso, una vez recortada, no puede estar vacía. */
export function validarFechaTraspaso(fecha: string): string {
  const f = fecha.trim();
  if (f === '') throw new Error('La fecha del traspaso no puede estar vacía');
  return f;
}

/** Regla de dominio: el motivo del traspaso, una vez recortado, no puede estar vacío. */
export function validarMotivoTraspaso(motivo: string): string {
  const m = motivo.trim();
  if (m === '') throw new Error('El motivo del traspaso no puede estar vacío');
  return m;
}

/**
 * Regla de dominio: un traspaso preserva "un manager por mentee a la vez".
 * La mentee no puede quedarse en el mismo manager (no habría paso) y el destino
 * debe ser distinto del origen; así una mentee siempre acaba bajo un único manager.
 * Devuelve los campos del traspaso (sin id ni mentee).
 */
export function crearTraspaso(
  origenId: ManagerId,
  destinoId: ManagerId,
  fecha: string,
  motivo: string,
): { origenId: ManagerId; destinoId: ManagerId; fecha: string; motivo: string } {
  if (origenId === destinoId) {
    throw new Error('El manager de destino debe ser distinto del manager actual');
  }
  return { origenId, destinoId, fecha, motivo };
}