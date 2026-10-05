/** Acuerdo: compromiso que nace de un 1-to-1; pendiente hasta cumplirse. Ver CONTEXT.md. */
export interface Acuerdo {
  text: string;
  /** Fecha ISO (YYYY-MM-DD) de nacimiento. */
  date: string;
  done: boolean;
  /** Fecha ISO (YYYY-MM-DD) del cumplimiento; null mientras esté pendiente. */
  cumplidoEl: string | null;
}

/** Crea un acuerdo pendiente. Regla de dominio: los acuerdos nacen pendientes. */
export function crearAcuerdoPendiente(text: string, date: string): Acuerdo {
  return { text, date, done: false, cumplidoEl: null };
}

/** Marca el acuerdo cumplido con su fecha de cumplimiento; idempotente. */
export function marcarCumplido(acuerdo: Acuerdo, cumplidoEl: string): Acuerdo {
  return acuerdo.done ? acuerdo : { ...acuerdo, done: true, cumplidoEl };
}
