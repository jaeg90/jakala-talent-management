import { describe, expect, it } from 'vitest';
import {
  contarTemasConNota,
  esFiltroHistorial,
  inicioDeNota,
  ordenarHistorial,
  primeraNotaNoVacia,
  tipoDesdeFiltro,
} from '../../src/domain/historial.js';
import type { EventoHistorial, TipoEventoHistorial } from '../../src/domain/historial.js';

/** Evento mínimo para probar el orden: fecha, tipo e id (los campos extra se ignoran al ordenar). */
function evento(tipo: TipoEventoHistorial, fecha: string, id: string): EventoHistorial {
  switch (tipo) {
    case '1-to-1':
      return { tipo, fecha, id, temasConNota: 0, acuerdos: 0, inicioNota: null };
    case 'incidencia':
      return { tipo, fecha, id, estado: 'abierta', descripcion: 'D' };
    case 'objetivo':
      return { tipo, fecha, id, estado: 'cumplido', titulo: 'T' };
    case 'proyecto':
      return { tipo, fecha, id, direccion: 'entrada', proyecto: 'P', motivo: 'M' };
    case 'traspaso':
      return { tipo, fecha, id, origen: 'A', destino: 'B' };
  }
}

describe('ordenarHistorial', () => {
  it('ordena por fecha descendente', () => {
    const eventos = [
      evento('1-to-1', '2026-02-01', 'a'),
      evento('traspaso', '2026-09-30', 'b'),
      evento('incidencia', '2025-12-31', 'c'),
    ];

    expect(ordenarHistorial(eventos).map((e) => e.fecha)).toEqual([
      '2026-09-30',
      '2026-02-01',
      '2025-12-31',
    ]);
  });

  it('el mismo día prioriza por tipo en el orden de los filtros de §07', () => {
    const orden = ['proyecto', 'incidencia', '1-to-1', 'traspaso', 'objetivo'] as const;
    const eventos = orden.map((tipo, i) => evento(tipo, '2026-09-01', `id-${i}`));

    expect(ordenarHistorial(eventos).map((e) => e.tipo)).toEqual([
      '1-to-1',
      'objetivo',
      'incidencia',
      'proyecto',
      'traspaso',
    ]);
  });

  it('dentro del mismo tipo y día desempata por id ascendente', () => {
    const eventos = [
      evento('1-to-1', '2026-09-01', 'id-c'),
      evento('1-to-1', '2026-09-01', 'id-a'),
      evento('1-to-1', '2026-09-01', 'id-b'),
    ];

    expect(ordenarHistorial(eventos).map((e) => e.id)).toEqual(['id-a', 'id-b', 'id-c']);
  });

  it('no muta la lista de entrada', () => {
    const eventos = [evento('proyecto', '2026-09-01', '1'), evento('1-to-1', '2026-09-01', '2')];
    const copia = eventos.map((e) => ({ ...e }));
    ordenarHistorial(eventos);
    expect(eventos).toEqual(copia);
  });

  it('sin eventos devuelve una lista vacía', () => {
    expect(ordenarHistorial([])).toEqual([]);
  });
});

describe('esFiltroHistorial', () => {
  it('reconoce los cinco valores de §07', () => {
    expect(esFiltroHistorial('1-to-1s')).toBe(true);
    expect(esFiltroHistorial('objetivos')).toBe(true);
    expect(esFiltroHistorial('incidencias')).toBe(true);
    expect(esFiltroHistorial('proyectos')).toBe(true);
    expect(esFiltroHistorial('traspasos')).toBe(true);
  });

  it('rechaza valores desconocidos y no string', () => {
    expect(esFiltroHistorial('todo')).toBe(false);
    expect(esFiltroHistorial('')).toBe(false);
    expect(esFiltroHistorial(undefined)).toBe(false);
    expect(esFiltroHistorial(1)).toBe(false);
  });
});

describe('tipoDesdeFiltro', () => {
  it('mapea cada filtro a su tipo de evento', () => {
    expect(tipoDesdeFiltro('1-to-1s')).toBe('1-to-1');
    expect(tipoDesdeFiltro('objetivos')).toBe('objetivo');
    expect(tipoDesdeFiltro('incidencias')).toBe('incidencia');
    expect(tipoDesdeFiltro('proyectos')).toBe('proyecto');
    expect(tipoDesdeFiltro('traspasos')).toBe('traspaso');
  });
});

describe('contarTemasConNota', () => {
  it('cuenta solo las notas no vacías', () => {
    expect(
      contarTemasConNota([
        { tema: 'A', nota: 'nota' },
        { tema: 'B', nota: '   ' },
        { tema: 'C', nota: '' },
        { tema: 'D', nota: 'otra' },
      ]),
    ).toBe(2);
  });

  it('sin notas devuelve cero', () => {
    expect(contarTemasConNota([])).toBe(0);
  });
});

describe('primeraNotaNoVacia', () => {
  it('devuelve la primera nota no vacía', () => {
    expect(
      primeraNotaNoVacia([
        { tema: 'A', nota: '   ' },
        { tema: 'B', nota: 'primera real' },
        { tema: 'C', nota: 'segunda' },
      ]),
    ).toBe('primera real');
  });

  it('sin notas no vacías devuelve null', () => {
    expect(primeraNotaNoVacia([{ tema: 'A', nota: '  ' }])).toBeNull();
    expect(primeraNotaNoVacia([])).toBeNull();
  });
});

describe('inicioDeNota', () => {
  it('devuelve la primera nota no vacía sin truncar si es corta', () => {
    expect(
      inicioDeNota([
        { tema: 'A', nota: '   ' },
        { tema: 'B', nota: 'Atlas va bien' },
      ]),
    ).toBe('Atlas va bien');
  });

  it('trunca la primera nota no vacía a 80 caracteres', () => {
    const larga = 'x'.repeat(120);
    expect(inicioDeNota([{ tema: 'A', nota: larga }])).toBe('x'.repeat(80));
  });

  it('no trunca una nota de exactamente 80 caracteres', () => {
    const exacta = 'y'.repeat(80);
    expect(inicioDeNota([{ tema: 'A', nota: exacta }])).toBe(exacta);
  });

  it('trunca por puntos de código Unicode, no por unidades UTF-16 (regla de #24)', () => {
    // 41 emoji ocupan 82 unidades UTF-16 pero son 41 caracteres: no hay corte.
    const nota = '😀'.repeat(41);
    expect(inicioDeNota([{ tema: 'A', nota }])).toBe(nota);
    // 81 emoji (162 unidades UTF-16) se cortan a 80 puntos de código exactos,
    // sin partir ningún par sustituto.
    const larga = '😀'.repeat(81);
    expect(inicioDeNota([{ tema: 'A', nota: larga }])).toBe('😀'.repeat(80));
  });

  it('sin notas no vacías devuelve null', () => {
    expect(inicioDeNota([{ tema: 'A', nota: '  ' }])).toBeNull();
    expect(inicioDeNota([])).toBeNull();
  });
});