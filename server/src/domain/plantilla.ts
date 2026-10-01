import type { TemaPlantilla } from './model.js';

/**
 * Temas iniciales con los que nace la plantilla de 1-to-1 de cada manager.
 * Es la única fuente de verdad: los usa la semilla, el mecanismo que da la
 * plantilla inicial a una cuenta nueva y el restablecimiento de la plantilla.
 * Ver "Plantilla de 1-to-1" en CONTEXT.md.
 */
export const TEMAS_INICIALES = ['¿Cómo estás?', '¿Qué tal el proyecto?', '¿Qué tal los objetivos?'];

/**
 * Regla de dominio: el texto de un tema de plantilla, una vez recortado, no
 * puede estar vacío. Devuelve el texto ya recortado.
 */
export function validarTextoDeTema(tema: string): string {
  const texto = tema.trim();
  if (texto === '') throw new Error('El texto del tema no puede estar vacío');
  return texto;
}

/**
 * Regla de dominio: no se puede retirar el último tema vigente de la plantilla.
 * Lanza si `temaId` señala el único tema vigente. Retirar un tema ya retirado
 * (o desconocido) es un no-op para esta regla: la existencia la valida el
 * repositorio. Ver "Plantilla de 1-to-1" en CONTEXT.md.
 */
export function validarRetirarTema(plantilla: TemaPlantilla[], temaId: string): void {
  const objetivo = plantilla.find((t) => t.id === temaId);
  if (objetivo === undefined || objetivo.estado === 'retirado') return;
  const vigentes = plantilla.filter((t) => t.estado === 'vigente');
  if (vigentes.length === 1) {
    throw new Error('No se puede retirar el último tema vigente de la plantilla');
  }
}

/**
 * Regla de dominio: mueve un tema vigente una posición dentro de la plantilla
 * (delta -1 = subir, +1 = bajar). Opera sobre los temas vigentes en orden y
 * devuelve una copia con el `orden` reasignado secuencialmente. Si el tema no
 * está en la lista o el movimiento saldría del rango, devuelve la lista intacta.
 */
export function reordenarVigentes(
  temas: TemaPlantilla[],
  temaId: string,
  delta: -1 | 1,
): TemaPlantilla[] {
  const indice = temas.findIndex((t) => t.id === temaId);
  if (indice === -1) return temas;
  const destino = indice + delta;
  if (destino < 0 || destino >= temas.length) return temas;

  const copia = [...temas];
  const [moved] = copia.splice(indice, 1);
  copia.splice(destino, 0, moved!);

  return copia.map((t, i) => ({ ...t, orden: i }));
}

/** Devuelve los temas vigentes de una plantilla, en su orden. */
export function temasVigentes(plantilla: TemaPlantilla[]): TemaPlantilla[] {
  return plantilla.filter((t) => t.estado === 'vigente').sort((a, b) => a.orden - b.orden);
}