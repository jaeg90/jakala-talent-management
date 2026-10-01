import { describe, expect, it } from 'vitest';
import {
  TEMAS_INICIALES,
  reordenarVigentes,
  temasVigentes,
  validarRetirarTema,
  validarTextoDeTema,
} from '../../src/domain/plantilla.js';
import type { TemaPlantilla } from '../../src/domain/model.js';

function tema(id: string, orden: number, estado: 'vigente' | 'retirado' = 'vigente'): TemaPlantilla {
  return { id, managerId: 'm-1', tema: `Tema ${id}`, orden, estado };
}

describe('TEMAS_INICIALES', () => {
  it('son los tres temas con los que nace cada manager', () => {
    expect(TEMAS_INICIALES).toEqual([
      '¿Cómo estás?',
      '¿Qué tal el proyecto?',
      '¿Qué tal los objetivos?',
    ]);
  });
});

describe('validarTextoDeTema', () => {
  it('devuelve el texto recortado cuando no está vacío', () => {
    expect(validarTextoDeTema('  ¿Cómo estás?  ')).toBe('¿Cómo estás?');
  });

  it('lanza si el texto queda vacío al recortar', () => {
    expect(() => validarTextoDeTema('   ')).toThrow();
  });
});

describe('validarRetirarTema', () => {
  it('permite retirar un tema vigente si quedan otros vigentes', () => {
    const plantilla = [tema('a', 0), tema('b', 1), tema('c', 2)];
    expect(() => validarRetirarTema(plantilla, 'a')).not.toThrow();
  });

  it('lanza al intentar retirar el último tema vigente', () => {
    const plantilla = [tema('a', 0, 'vigente'), tema('b', 1, 'retirado')];
    expect(() => validarRetirarTema(plantilla, 'a')).toThrow(/último/);
  });

  it('no lanza si el tema a retirar ya está retirado', () => {
    const plantilla = [tema('a', 0, 'retirado')];
    expect(() => validarRetirarTema(plantilla, 'a')).not.toThrow();
  });

  it('no lanza si el tema no existe (la existencia la valida el repositorio)', () => {
    const plantilla = [tema('a', 0)];
    expect(() => validarRetirarTema(plantilla, 'desconocido')).not.toThrow();
  });
});

describe('reordenarVigentes', () => {
  const tres = [tema('a', 0), tema('b', 1), tema('c', 2)];

  it('sube un tema una posición', () => {
    const resultado = reordenarVigentes(tres, 'c', -1);
    expect(resultado.map((t) => t.id)).toEqual(['a', 'c', 'b']);
    expect(resultado.map((t) => t.orden)).toEqual([0, 1, 2]);
  });

  it('baja un tema una posición', () => {
    const resultado = reordenarVigentes(tres, 'a', 1);
    expect(resultado.map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(resultado.map((t) => t.orden)).toEqual([0, 1, 2]);
  });

  it('no mueve fuera del rango (subir el primero / bajar el último)', () => {
    expect(reordenarVigentes(tres, 'a', -1).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(reordenarVigentes(tres, 'c', 1).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('devuelve la lista intacta si el tema no está', () => {
    const resultado = reordenarVigentes(tres, 'desconocido', 1);
    expect(resultado.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('temasVigentes', () => {
  it('devuelve solo los vigentes, en orden', () => {
    const plantilla = [tema('a', 2), tema('b', 0), tema('c', 1, 'retirado')];
    expect(temasVigentes(plantilla).map((t) => t.id)).toEqual(['b', 'a']);
  });
});