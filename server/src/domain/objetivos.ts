/** Estado de un objetivo anual SMART. Ver "Objetivo" en CONTEXT.md. */
export type EstadoObjetivo = 'en curso' | 'cumplido' | 'no cumplido';

/** Objetivo: meta anual SMART pactada entre un manager y una mentee. Ver CONTEXT.md. */
export interface Objetivo {
  id: string;
  menteeId: string;
  titulo: string;
  descripcion: string;
  /** Fecha límite ISO (YYYY-MM-DD). */
  fechaLimite: string;
  estado: EstadoObjetivo;
}

/** Regla de dominio: el título de un objetivo, una vez recortado, no puede estar vacío. */
export function validarTituloObjetivo(titulo: string): string {
  const t = titulo.trim();
  if (t === '') throw new Error('El título del objetivo no puede estar vacío');
  return t;
}

/**
 * Regla de dominio: la fecha límite, una vez recortada, no puede estar vacía y
 * no puede quedar en el pasado (decisiones.md §Cambios de dominio 10: «fecha
 * límite ≥ hoy»). «hoy» es una fecha ISO UTC (`hoyISO()`), inyectable para que
 * los tests sean deterministas; hoy se admite.
 */
export function validarFechaLimite(fechaLimite: string, hoy: string = hoyISO()): string {
  const f = fechaLimite.trim();
  if (f === '') throw new Error('La fecha límite del objetivo no puede estar vacía');
  if (!esFechaISO(f)) throw new Error('La fecha límite del objetivo no es una fecha válida');
  if (f < hoy) throw new Error('La fecha límite no puede estar en el pasado');
  return f;
}

/** ¿Es una fecha ISO real (`YYYY-MM-DD`, mes 1–12 y día válido para ese mes)? */
function esFechaISO(fecha: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (m === null) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12) return false;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** Hoy en ISO (YYYY-MM-DD), la convención UTC del paquete (misma que el resto de servicios). */
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Crea los campos de un objetivo. Regla de dominio: los objetivos nacen en curso. */
export function crearObjetivoEnCurso(
  titulo: string,
  descripcion: string,
  fechaLimite: string,
): { titulo: string; descripcion: string; fechaLimite: string; estado: EstadoObjetivo } {
  return { titulo, descripcion, fechaLimite, estado: 'en curso' };
}

/**
 * Regla de dominio: un objetivo en curso pasa a "cumplido" o "no cumplido".
 * Un objetivo cerrado no se reabre ni se mueve al otro estado (no se revive).
 */
export function transicionarEstado(objetivo: Objetivo, nuevo: EstadoObjetivo): Objetivo {
  if (objetivo.estado !== 'en curso') {
    throw new Error(`Un objetivo ${objetivo.estado} no puede cambiar de estado`);
  }
  if (nuevo !== 'cumplido' && nuevo !== 'no cumplido') {
    throw new Error(`Estado de destino no válido: ${nuevo}`);
  }
  return { ...objetivo, estado: nuevo };
}

/** Regla de dominio: solo se edita un objetivo en curso. */
export function editarObjetivo(
  objetivo: Objetivo,
  cambios: { titulo: string; descripcion: string; fechaLimite: string },
): Objetivo {
  if (objetivo.estado !== 'en curso') {
    throw new Error(`Un objetivo ${objetivo.estado} no puede editarse`);
  }
  return { ...objetivo, ...cambios };
}