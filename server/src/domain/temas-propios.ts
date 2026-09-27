/**
 * Regla de dominio: el nombre de un tema propio, una vez recortado, no puede
 * estar vacío. Devuelve el nombre ya recortado para su alta.
 */
export function validarNombreTemaPropio(tema: string): string {
  const nombre = tema.trim();
  if (nombre === '') throw new Error('El nombre del tema no puede estar vacío');
  return nombre;
}