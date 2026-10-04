/**
 * Cambio de proyecto: paso de una mentee de un proyecto a otro (o a ninguno),
 * con fecha y motivo. El proyecto actual de la mentee es el destino del último
 * cambio registrado. Ver "Cambio de proyecto" en CONTEXT.md.
 */
export interface CambioProyecto {
  id: string;
  menteeId: string;
  /** Fecha ISO (YYYY-MM-DD) del cambio. */
  fecha: string;
  /** Proyecto del que sale; null si no tenía proyecto. */
  origenId: string | null;
  /** Proyecto al que pasa; null si queda sin proyecto. */
  destinoId: string | null;
  motivo: string;
}

/** Regla de dominio: el nombre de un proyecto, una vez recortado, no puede estar vacío. */
export function validarNombreProyecto(name: string, catalogo: readonly { name: string }[] = []): string {
  const n = name.trim();
  if (n === '') throw new Error('El nombre del proyecto no puede estar vacío');
  if (catalogo.some((proyecto) => proyecto.name === n)) {
    throw new Error('Ya existe un proyecto con ese nombre.');
  }
  return n;
}

/** Regla de dominio: la fecha del cambio, una vez recortada, no puede estar vacía. */
export function validarFechaCambio(fecha: string): string {
  const f = fecha.trim();
  if (f === '') throw new Error('La fecha del cambio no puede estar vacía');
  return f;
}

/** Regla de dominio: el motivo del cambio, una vez recortado, no puede estar vacío. */
export function validarMotivoCambio(motivo: string): string {
  const m = motivo.trim();
  if (m === '') throw new Error('El motivo del cambio no puede estar vacío');
  return m;
}

/**
 * Regla de dominio: el proyecto actual de una mentee es único y se determina por
 * el último cambio registrado (recibidos en orden cronológico): su destino.
 * Sin cambios no hay proyecto derivable del historial (null).
 */
export function proyectoActualDeCambios(cambios: CambioProyecto[]): string | null {
  if (cambios.length === 0) return null;
  return cambios[cambios.length - 1]!.destinoId;
}

/**
 * Regla de dominio: un cambio real cambia de proyecto; el destino debe ser
 * distinto del origen. Devuelve los campos del cambio (sin id ni mentee).
 */
export function crearCambioProyecto(
  origenId: string | null,
  destinoId: string | null,
  fecha: string,
  motivo: string,
): { origenId: string | null; destinoId: string | null; fecha: string; motivo: string } {
  if (origenId === destinoId) {
    throw new Error('El proyecto de destino debe ser distinto del proyecto actual');
  }
  return { origenId, destinoId, fecha, motivo };
}
