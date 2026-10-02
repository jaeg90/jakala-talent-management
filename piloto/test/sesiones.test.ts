import { describe, expect, it } from 'vitest';
import type { Ticket } from '../src/domain/model.js';
import {
  extraerDevolucion,
  extraerResumen,
  extraerVeredicto,
  promptImplementadora,
  promptReparadora,
  promptRevisora,
} from '../src/infrastructure/opencode.js';

/**
 * Los prompts y extractores del adaptador de sesiones (ADR-0010 + ADR-0012):
 * la implementadora y la reparadora autochequean con las puertas antes de
 * presentarse; la revisora audita criterio a criterio y distingue hallazgos
 * (defectos del diff) de dudas (ambigüedades del cuerpo que fuerzan devolución).
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
  it('la implementadora recibe la spec, la retoma explícita, las puertas y el contrato de devolución', () => {
    const prompt = promptImplementadora(ticketDePrueba(), PUERTAS);

    expect(prompt).toContain('Fundación Lino');
    expect(prompt).toContain('Router con el mapa de URLs.');
    expect(prompt).toContain('retómalo');
    expect(prompt).toContain('criterios de aceptación');
    expect(prompt).toContain('- typecheck: npm run typecheck');
    expect(prompt).toContain('- e2e: npm run test:e2e');
    expect(prompt).toContain('RESUMEN:');
    expect(prompt).toContain('NO lo adivines');
    expect(prompt).toContain('un valor o un contrato');
    expect(prompt).toContain('DEVOLVER');
    expect(prompt).toContain('DUDA n: <el criterio, las lecturas y qué decide cada una>');
  });

  it('la revisora audita criterio a criterio y distingue hallazgos de dudas', () => {
    const prompt = promptRevisora(ticketDePrueba());

    expect(prompt).toContain('SIN SALTARTE NINGUNO');
    expect(prompt).toContain('CRITERIO n: OK');
    expect(prompt).toContain('CRITERIO n: HALLAZGO');
    expect(prompt).toContain('un valor o de un contrato');
    expect(prompt).toContain('DUDA n:');
    expect(prompt).toContain('No reserves problemas para una próxima ronda');
    expect(prompt).toContain('SIN HALLAZGOS');
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

describe('Sesiones: veredicto de la revisora', () => {
  it('«SIN HALLAZGOS» con la tabla de criterios alrededor es verde', () => {
    expect(extraerVeredicto('CRITERIO 1: OK\nCRITERIO 2: OK\nSIN HALLAZGOS')).toEqual({
      hallazgos: null,
      dudas: [],
    });
  });

  it('el contrato por criterio produce hallazgos: «CRITERIO n: HALLAZGO — …»', () => {
    const salida = [
      'CRITERIO 1: OK',
      'CRITERIO 2: HALLAZGO — El avatar solo tiene el tamaño 28px.',
      'HALLAZGO 2: styles.css conserva un panel global.',
    ].join('\n');

    expect(extraerVeredicto(salida)).toEqual({
      hallazgos: 'El avatar solo tiene el tamaño 28px.\nstyles.css conserva un panel global.',
      dudas: [],
    });
  });

  it('una duda viaja con sus hallazgos: defectos al diff, ambigüedad al grill', () => {
    const salida = [
      'CRITERIO 1: HALLAZGO — El botón primario no muestra el anillo de foco.',
      'DUDA 1: ¿«tarjeta 420px» es ancho total o de contenido?',
    ].join('\n');

    expect(extraerVeredicto(salida)).toEqual({
      hallazgos: 'El botón primario no muestra el anillo de foco.',
      dudas: ['¿«tarjeta 420px» es ancho total o de contenido?'],
    });
  });

  it('«SIN HALLAZGOS» con dudas no es verde: las dudas ganan', () => {
    const veredicto = extraerVeredicto('CRITERIO 1: OK\nSIN HALLAZGOS\nDUDA 1: ¿El aviso es modal o en línea?');

    expect(veredicto.hallazgos).toBeNull();
    expect(veredicto.dudas).toEqual(['¿El aviso es modal o en línea?']);
  });

  it('sin formato claro no hay verde: la cola de la salida como hallazgo', () => {
    expect(extraerVeredicto('Pues viniendo, viniendo, esto no cumple la spec.')).toEqual({
      hallazgos: 'Pues viniendo, viniendo, esto no cumple la spec.',
      dudas: [],
    });
    expect(extraerVeredicto('')).toEqual({ hallazgos: 'La revisora respondió sin formato.', dudas: [] });
  });
});

describe('Sesiones: devolución de la implementadora', () => {
  it('sin línea «DEVOLVER» no hay devolución, aunque hable de dudas en prosa', () => {
    expect(
      extraerDevolucion('Tuve dudas, pero las resolví a favor del criterio más simple.\nRESUMEN: Hecho.'),
    ).toBeNull();
  });

  it('«DEVOLVER» con dudas numeradas viaja entero', () => {
    const salida = [
      'DEVOLVER',
      'DUDA 1: ¿«tarjeta 420px» es ancho total o de contenido?',
      'DUDA 2: ¿El error del login es un aviso inline o un diálogo modal?',
    ].join('\n');

    expect(extraerDevolucion(salida)).toBe(
      '¿«tarjeta 420px» es ancho total o de contenido?\n¿El error del login es un aviso inline o un diálogo modal?',
    );
  });

  it('«DEVOLVER» sin dudas legibles también devuelve: nunca se trata como diff listo', () => {
    expect(
      extraerDevolucion('La spec no determina el alto mínimo; mejor lo decide un humano.\nDEVOLVER'),
    ).toBe('La implementadora devolvió el ticket sin dudas legibles.');
  });
});

describe('Sesiones: resumen', () => {
  it('el resumen del diff es la última línea RESUMEN', () => {
    expect(extraerResumen('RESUMEN: Primera versión.\nRESUMEN: Versión que vale.')).toBe(
      'Versión que vale.',
    );
  });
});
