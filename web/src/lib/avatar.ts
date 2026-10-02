/**
 * Avatares de JTM (componentes.md §Avatar): círculo con las iniciales del nombre,
 * tonalidad derivada del id (`hash del id mod 4` → `.avatar--1..4`).
 */

/** Iniciales (hasta dos palabras) de un nombre: «Marta Manager» → «MM». */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const primera = partes[0]?.charAt(0) ?? '';
  const segunda = partes.length > 1 ? (partes[1]?.charAt(0) ?? '') : '';
  return (primera + segunda).toUpperCase();
}

/** Tono 1–4 derivado del id (hash estable por id). */
export function tonoAvatar(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 4) + 1;
}