import { describe, expect, it } from 'vitest';
import { generarContrasenaTemporal, LONGITUD_MINIMA, validarNuevaContrasena } from '../../src/domain/contrasenas.js';

describe('generarContrasenaTemporal', () => {
  it('genera 16 caracteres hexadecimales aleatorios, suficientes para la regla de cambio', () => {
    const primera = generarContrasenaTemporal();
    const segunda = generarContrasenaTemporal();
    expect(primera).toMatch(/^[0-9a-f]{16}$/);
    expect(segunda).toMatch(/^[0-9a-f]{16}$/);
    expect(primera).not.toBe(segunda);
    expect(primera.length).toBeGreaterThanOrEqual(LONGITUD_MINIMA);
  });
});

describe('validarNuevaContrasena (regla de dominio)', () => {
  it('acepta una contraseña de 10 caracteres distinta de la actual', () => {
    expect(() => validarNuevaContrasena('secreta123', 'abcdefghij')).not.toThrow();
  });

  it('acepta una contraseña de más de 10 caracteres', () => {
    expect(() => validarNuevaContrasena('secreta123', 'nueva-clave-123')).not.toThrow();
  });

  it('rechaza una contraseña de 9 caracteres', () => {
    expect(() => validarNuevaContrasena('secreta123', 'abcdefghi')).toThrow(
      'La contraseña nueva debe tener al menos 10 caracteres',
    );
  });

  it('rechaza una contraseña igual a la actual', () => {
    expect(() => validarNuevaContrasena('secreta123', 'secreta123')).toThrow(
      'La contraseña nueva debe ser distinta de la actual',
    );
  });

  it('cuenta los caracteres como puntos de código Unicode (9 emojis = 9 caracteres)', () => {
    // 9 emojis ocupan 18 unidades UTF-16 pero son 9 caracteres: debe rechazarse.
    expect(() => validarNuevaContrasena('secreta123', '😀😀😀😀😀😀😀😀😀')).toThrow(
      'La contraseña nueva debe tener al menos 10 caracteres',
    );
  });

  it('acepta 10 caracteres como puntos de código Unicode (10 emojis)', () => {
    expect(() => validarNuevaContrasena('secreta123', '😀😀😀😀😀😀😀😀😀😀')).not.toThrow();
  });

  it('expone la longitud mínima de 10', () => {
    expect(LONGITUD_MINIMA).toBe(10);
  });
});
