import { describe, expect, it } from 'vitest';
import {
  badgeAntiguedad,
  necesitaAtencion,
  ordenarEquipo,
  type FilaDeEquipo,
} from '../../src/domain/equipo.js';

function fila(partial: Partial<Omit<FilaDeEquipo, 'name'>> & { name: string }): FilaDeEquipo {
  const { name, ...resto } = partial;
  return {
    id: name,
    name,
    proyectos: [],
    acuerdosPendientes: 0,
    incidenciasAbiertas: 0,
    objetivosEnCurso: 0,
    ultimoUnoAUno: '2026-09-15',
    necesitaAtencion: false,
    badgeAntiguedad: false,
    ...resto,
  };
}

describe('badgeAntiguedad', () => {
  const HOY = '2026-09-29';

  it('con el último 1-to-1 hace más de 14 días, sí', () => {
    expect(badgeAntiguedad('2026-09-14', HOY)).toBe(true);
  });

  it('con el último 1-to-1 hace exactamente 14 días, no', () => {
    expect(badgeAntiguedad('2026-09-15', HOY)).toBe(false);
  });

  it('sin ningún 1-to-1 previo, no (la celda muestra «Sin 1-to-1s», derivado de null)', () => {
    expect(badgeAntiguedad(null, HOY)).toBe(false);
  });

  it('con el último 1-to-1 reciente, no', () => {
    expect(badgeAntiguedad('2026-09-29', HOY)).toBe(false);
  });
});

describe('necesitaAtencion', () => {
  const HOY = '2026-09-29';

  it('con incidencias abiertas, sí', () => {
    expect(necesitaAtencion(1, '2026-09-29', HOY)).toBe(true);
  });

  it('con el último 1-to-1 hace más de 14 días, sí', () => {
    expect(necesitaAtencion(0, '2026-09-14', HOY)).toBe(true);
  });

  it('sin incidencias y sin ningún 1-to-1 previo, no', () => {
    expect(necesitaAtencion(0, null, HOY)).toBe(false);
  });

  it('con incidencias y sin 1-to-1 previo, sí', () => {
    expect(necesitaAtencion(1, null, HOY)).toBe(true);
  });

  it('con el último 1-to-1 hace exactamente 14 días, no', () => {
    expect(necesitaAtencion(0, '2026-09-15', HOY)).toBe(false);
  });

  it('al día, no', () => {
    expect(necesitaAtencion(0, '2026-09-29', HOY)).toBe(false);
  });
});

describe('ordenarEquipo', () => {
  it('orden: atención · más acuerdos pendientes · nombre', () => {
    const filas = [
      fila({ name: 'Berta', necesitaAtencion: false, acuerdosPendientes: 9 }),
      fila({ name: 'Ana', necesitaAtencion: true, acuerdosPendientes: 2 }),
      fila({ name: 'Zoe', necesitaAtencion: true, acuerdosPendientes: 3 }),
      fila({ name: 'Carla', necesitaAtencion: true, acuerdosPendientes: 2 }),
      fila({ name: 'Berta2', necesitaAtencion: false, acuerdosPendientes: 5 }),
    ];

    expect(ordenarEquipo(filas).map((m) => m.name)).toEqual([
      'Zoe',
      'Ana',
      'Carla',
      'Berta',
      'Berta2',
    ]);
  });

  it('no muta la lista original', () => {
    const filas = [fila({ name: 'Ana' }), fila({ name: 'Berta' })];

    ordenarEquipo(filas);

    expect(filas.map((m) => m.name)).toEqual(['Ana', 'Berta']);
  });

  it('adelanta a quien necesita atención aunque parta después', () => {
    const filas = [
      fila({ name: 'Berta', necesitaAtencion: false }),
      fila({ name: 'Ana', necesitaAtencion: true }),
    ];

    expect(ordenarEquipo(filas).map((m) => m.name)).toEqual(['Ana', 'Berta']);
  });

  it('desempata por acuerdos pendientes también cuando el orden de entrada es el contrario', () => {
    const filas = [
      fila({ name: 'Ana', necesitaAtencion: true, acuerdosPendientes: 1 }),
      fila({ name: 'Zoe', necesitaAtencion: true, acuerdosPendientes: 5 }),
    ];

    expect(ordenarEquipo(filas).map((m) => m.name)).toEqual(['Zoe', 'Ana']);
  });

  it('con los mismos acuerdos resuelve por nombre también si el orden de entrada es el contrario', () => {
    const filas = [
      fila({ name: 'Zoe', necesitaAtencion: true, acuerdosPendientes: 2 }),
      fila({ name: 'Ana', necesitaAtencion: true, acuerdosPendientes: 2 }),
    ];

    expect(ordenarEquipo(filas).map((m) => m.name)).toEqual(['Ana', 'Zoe']);
  });
});