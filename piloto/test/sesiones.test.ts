import { describe, expect, it } from 'vitest';
import type { Ticket } from '../src/domain/model.js';
import {
  extraerHallazgo,
  extraerResumen,
  promptImplementadora,
  promptReparadora,
  promptRevisora,
} from '../src/infrastructure/opencode.js';

/**
 * Los prompts y extractores del adaptador de sesiones (ADR-0010): la
 * implementadora y la reparadora autochequean con las puertas antes de
 * presentarse; la revisora enumera todos sus hallazgos en un solo veredicto.
 */

const PUERTAS = [
  { nombre: 'typecheck', comando: 'npm run typecheck' },
  { nombre: 'lint', comando: 'npm run lint' },
  { nombre: 'tests', comando: 'npm test' },
  { nombre: 'e2e', comando: 'npm run test:e2e' },
];

function ticketDePrueba(): Ticket {
  return {
    numero: 14,
    titulo: 'Fundación Lino',
    cuerpo: '## Criterios\n- Router con el mapa de URLs.',
    estado: 'lista',
    bloqueadoPor: [],
  };
}

describe('Sesiones: prompts', () => {
  it('la implementadora recibe la spec, la retoma explícita y las puertas como autochequeo', () => {
    const prompt = promptImplementadora(ticketDePrueba(), PUERTAS);

    expect(prompt).toContain('Fundación Lino');
    expect(prompt).toContain('Router con el mapa de URLs.');
    expect(prompt).toContain('retómalo');
    expect(prompt).toContain('criterios de aceptación');
    expect(prompt).toContain('- typecheck: npm run typecheck');
    expect(prompt).toContain('- e2e: npm run test:e2e');
    expect(prompt).toContain('RESUMEN:');
  });

  it('la revisora debe enumerar todos los hallazgos en la misma respuesta', () => {
    const prompt = promptRevisora(ticketDePrueba());

    expect(prompt).toContain('SIN HALLAZGOS');
    expect(prompt).toContain('HALLAZGO n:');
    expect(prompt).toContain('TODOS');
    expect(prompt).toContain('criterio por criterio');
  });

  it('la reparadora recibe el ticket, el error y las puertas', () => {
    const prompt = promptReparadora(
      ticketDePrueba(),
      { origen: 'revisión', texto: 'Falla el E2E de registro de 1-to-1.' },
      PUERTAS,
    );

    expect(prompt).toContain('#14');
    expect(prompt).toContain('Falla el E2E de registro de 1-to-1.');
    expect(prompt).toContain('La spec del ticket:');
    expect(prompt).toContain('Router con el mapa de URLs.');
    expect(prompt).toContain('- tests: npm test');
  });
});

describe('Sesiones: extractores', () => {
  it('«SIN HALLAZGOS» es verde aunque haya ruido alrededor', () => {
    expect(extraerHallazgo('Reviso el diff entero.\nSIN HALLAZGOS')).toBeNull();
  });

  it('un único hallazgo viaja entero', () => {
    expect(extraerHallazgo('HALLAZGO: El botón primario no muestra el anillo de foco.')).toBe(
      'El botón primario no muestra el anillo de foco.',
    );
  });

  it('todos los hallazgos de un veredicto viajan juntos, numerados o no', () => {
    const salida = [
      'HALLAZGO 1: El botón primario no muestra el anillo de foco.',
      'HALLAZGO 2: styles.css conserva un panel global.',
    ].join('\n');

    expect(extraerHallazgo(salida)).toBe(
      'El botón primario no muestra el anillo de foco.\nstyles.css conserva un panel global.',
    );
  });

  it('sin formato claro no hay verde: la cola de la salida como hallazgo', () => {
    expect(extraerHallazgo('Pues viniendo, viniendo, esto no cumple la spec.')).toBe(
      'Pues viniendo, viniendo, esto no cumple la spec.',
    );
    expect(extraerHallazgo('')).toBe('La revisora respondió sin formato.');
  });

  it('el resumen del diff es la última línea RESUMEN', () => {
    expect(extraerResumen('RESUMEN: Primera versión.\nRESUMEN: Versión que vale.')).toBe(
      'Versión que vale.',
    );
  });
});
