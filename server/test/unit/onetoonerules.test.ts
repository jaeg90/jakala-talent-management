import { describe, expect, it } from 'vitest';
import { crearAcuerdoPendiente, marcarCumplido } from '../../src/domain/agreements.js';
import {
  esFechaISO,
  validarContenidoOneToOne,
  validarFechaOneToOne,
  validarNotasPorTema,
} from '../../src/domain/onetoonetopics.js';

describe('ciclo del acuerdo: pendiente → cumplido', () => {
  it('nace pendiente con texto y fecha', () => {
    const acuerdo = crearAcuerdoPendiente('Revisar CV con RRHH', '2026-09-27');

    expect(acuerdo).toEqual({ text: 'Revisar CV con RRHH', date: '2026-09-27', done: false });
  });

  it('marcar cumplido lo deja done', () => {
    const acuerdo = marcarCumplido(crearAcuerdoPendiente('Revisar CV', '2026-09-27'));

    expect(acuerdo.done).toBe(true);
    // el texto y la fecha no cambian
    expect(acuerdo.text).toBe('Revisar CV');
    expect(acuerdo.date).toBe('2026-09-27');
  });

  it('cumplir dos veces es idempotente', () => {
    const una = marcarCumplido(crearAcuerdoPendiente('A', '2026-09-27'));
    const dos = marcarCumplido(una);

    expect(dos).toEqual(una);
  });
});

describe('notas por tema del 1-to-1', () => {
  it('acepta una nota por cada tema genérico', () => {
    expect(() =>
      validarNotasPorTema([
        { tema: '¿Cómo estás?', nota: 'Animada' },
        { tema: '¿Qué tal el proyecto?', nota: 'Bien' },
        { tema: '¿Qué tal los objetivos?', nota: 'En curso' },
      ]),
    ).not.toThrow();
  });

  it('acepta notas vacías (tema no tratado)', () => {
    expect(() =>
      validarNotasPorTema([{ tema: '¿Cómo estás?', nota: '' }]),
    ).not.toThrow();
  });

  it('lanza si dos notas son del mismo tema', () => {
    expect(() =>
      validarNotasPorTema([
        { tema: '¿Cómo estás?', nota: 'Animada' },
        { tema: '¿Cómo estás?', nota: 'Otra vez' },
      ]),
    ).toThrow(/¿Cómo estás\?/);
  });
});

describe('esFechaISO', () => {
  it('acepta una fecha ISO real', () => {
    expect(esFechaISO('2026-09-20')).toBe(true);
  });

  it('rechaza fechas con formato o calendario inválidos', () => {
    expect(esFechaISO('')).toBe(false);
    expect(esFechaISO('20-09-2026')).toBe(false);
    expect(esFechaISO('2026-09-20T10:00:00Z')).toBe(false);
    expect(esFechaISO('2026-13-40')).toBe(false);
    expect(esFechaISO('2026-02-30')).toBe(false);
  });
});

describe('validarFechaOneToOne', () => {
  const HOY = '2026-10-03';

  it('acepta una fecha presente o pasada', () => {
    expect(() => validarFechaOneToOne('2026-10-03', HOY)).not.toThrow();
    expect(() => validarFechaOneToOne('2026-09-20', HOY)).not.toThrow();
  });

  it('lanza con una fecha vacía', () => {
    expect(() => validarFechaOneToOne('', HOY)).toThrow('Elige una fecha.');
  });

  it('lanza con una fecha no ISO', () => {
    expect(() => validarFechaOneToOne('no-es-una-fecha', HOY)).toThrow('ISO');
  });

  it('lanza con una fecha futura', () => {
    expect(() => validarFechaOneToOne('2026-10-04', HOY)).toThrow('La fecha no puede ser futura.');
  });
});

describe('validarContenidoOneToOne', () => {
  it('acepta con al menos una nota no vacía', () => {
    expect(() =>
      validarContenidoOneToOne([{ tema: '¿Cómo estás?', nota: 'Bien' }], []),
    ).not.toThrow();
  });

  it('acepta con al menos un acuerdo', () => {
    expect(() => validarContenidoOneToOne([], [{ text: 'Revisar CV' }])).not.toThrow();
  });

  it('lanza sin notas no vacías ni acuerdos', () => {
    expect(() =>
      validarContenidoOneToOne([{ tema: '¿Cómo estás?', nota: '   ' }], []),
    ).toThrow('Escribe al menos una nota o un acuerdo antes de guardar.');
  });
});
