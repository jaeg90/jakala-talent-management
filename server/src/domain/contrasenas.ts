/** Longitud mínima de una contraseña de manager (spec §Ajustes · 3a). */
export const LONGITUD_MINIMA = 10;

/**
 * Regla de dominio: la nueva contraseña debe tener al menos `LONGITUD_MINIMA`
 * caracteres y ser distinta de la actual. Un carácter es un punto de código
 * Unicode (no una unidad UTF-16), de ahí `[...nueva].length`. Ver "Cambiar
 * contraseña" en decisiones.md.
 */
export function validarNuevaContrasena(actual: string, nueva: string): void {
  if ([...nueva].length < LONGITUD_MINIMA) {
    throw new Error('La contraseña nueva debe tener al menos 10 caracteres');
  }
  if (nueva === actual) {
    throw new Error('La contraseña nueva debe ser distinta de la actual');
  }
}