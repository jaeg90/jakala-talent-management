import { describe, expect, it } from 'vitest';
import { crearAcuerdoPendiente, marcarCumplido } from '../../src/domain/agreements.js';
import { validarNotasPorTema } from '../../src/domain/onetoonetopics.js';

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
