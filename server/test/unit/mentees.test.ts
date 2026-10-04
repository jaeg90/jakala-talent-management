import { afterEach, describe, expect, it, vi } from 'vitest';
import { validarNombreMentee, validarEnEquipoDesde, MOTIVO_ALTA_EN_EL_EQUIPO } from '../../src/domain/mentees.js';
import { fechaHaceDias } from '../../src/domain/fechas.js';

afterEach(() => { vi.useRealTimers(); });

describe('alta de mentee', () => {
  it('requiere nombre y recorta los espacios exteriores', () => {
    expect(validarNombreMentee(' Irene Iglesias ')).toBe('Irene Iglesias');
    expect(() => validarNombreMentee('')).toThrow('Escribe el nombre y apellidos.');
    expect(() => validarNombreMentee(' \t ')).toThrow('Escribe el nombre y apellidos.');
  });

  it('admite hoy y fechas pasadas reales, recortando espacios', () => {
    expect(validarEnEquipoDesde(' 2026-10-04 ', '2026-10-04')).toBe('2026-10-04');
    expect(validarEnEquipoDesde('2026-09-01', '2026-10-04')).toBe('2026-09-01');
    expect(validarEnEquipoDesde('2024-02-29', '2026-10-04')).toBe('2024-02-29');
  });

  it.each(['', ' ', '2026-02-29', '2026-13-01', '04/10/2026'])('rechaza fecha inválida %s', (fecha) => {
    expect(() => validarEnEquipoDesde(fecha, '2026-10-04')).toThrow('Escribe una fecha válida.');
  });

  it('rechaza mañana con el copy exacto y usa hoy UTC por defecto', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:30:00Z'));
    expect(validarEnEquipoDesde('2026-10-04')).toBe('2026-10-04');
    expect(() => validarEnEquipoDesde('2026-10-05')).toThrow('La fecha no puede ser futura.');
    expect(MOTIVO_ALTA_EN_EL_EQUIPO).toBe('Alta en el equipo');
  });

  it('comparte la fecha ficticia de alta en UTC entre semilla y migración', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:30:00Z'));
    expect(fechaHaceDias(90)).toBe('2026-07-06');
    expect(fechaHaceDias(0)).toBe('2026-10-04');
  });
});
