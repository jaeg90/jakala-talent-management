/** Acuerdo: compromiso que nace de un 1-to-1; pendiente hasta cumplirse. Ver CONTEXT.md. */
export interface Acuerdo {
  text: string;
  /** Fecha ISO (YYYY-MM-DD) de nacimiento. */
  date: string;
  done: boolean;
}

/** Crea un acuerdo pendiente. Regla de dominio: los acuerdos nacen pendientes. */
export function crearAcuerdoPendiente(text: string, date: string): Acuerdo {
  return { text, date, done: false };
}

/** Marca el acuerdo cumplido; idempotente. */
export function marcarCumplido(acuerdo: Acuerdo): Acuerdo {
  return acuerdo.done ? acuerdo : { ...acuerdo, done: true };
}
