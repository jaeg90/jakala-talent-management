import { describe, expect, it } from 'vitest';
import type { Ticket } from '../src/domain/model.js';
import {
  extraerDevolucion,
  extraerResumen,
  extraerVeredicto,
  modeloDe,
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
    tipo: null,
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

  it('criterios OK sin la línea «SIN HALLAZGOS» es verde (regresión de #28, 5-oct)', () => {
    // La revisora emitió los cuatro criterios OK sin la línea canónica: el
    // extractor cayó al fallback de 500, la máquina la leyó como roja y quemó
    // una reparadora contra un diff limpio. Formato verbatim de esa ronda.
    const salida = [
      'CRITERIO 1: OK — La pantalla permite añadir, editar, reordenar, retirar y volver a usar temas.',
      'CRITERIO 2: OK — Impide retirar el último tema vigente y muestra el copy exacto.',
      'CRITERIO 3: OK — El E2E verifica que los temas y notas de un 1-to-1 registrado conservan sus valores.',
      'CRITERIO 4: OK — Cubre nombres accesibles, límites de reordenación, anuncio y foco.',
    ].join('\n');

    expect(extraerVeredicto(salida)).toEqual({ hallazgos: null, dudas: [] });
  });

  it('criterios OK sin «SIN HALLAZGOS» pero con un hallazgo no es verde: el hallazgo gana', () => {
    const salida = [
      'CRITERIO 1: OK — Añadir, editar y reordenar están implementados.',
      'CRITERIO 2: HALLAZGO — El botón «Cancelar» sigue habilitado durante el envío.',
    ].join('\n');

    expect(extraerVeredicto(salida)).toEqual({
      hallazgos: 'El botón «Cancelar» sigue habilitado durante el envío.',
      dudas: [],
    });
  });

  it('prosa que cita «CRITERIO n: OK» a mitad de línea no es verde: solo las líneas de veredicto cuentan', () => {
    expect(extraerVeredicto('Revisé según «CRITERIO 1: OK» del contrato y creo que va bien.')).toEqual({
      hallazgos: 'Revisé según «CRITERIO 1: OK» del contrato y creo que va bien.',
      dudas: [],
    });
  });

  it('sin formato claro no hay verde: la cola de la salida como hallazgo', () => {
    expect(extraerVeredicto('Pues viniendo, viniendo, esto no cumple la spec.')).toEqual({
      hallazgos: 'Pues viniendo, viniendo, esto no cumple la spec.',
      dudas: [],
    });
    expect(extraerVeredicto('')).toEqual({ hallazgos: 'La revisora respondió sin formato.', dudas: [] });
  });

  it('las negritas de la revisora no esconden el hallazgo (regresión de #38, 2-oct)', () => {
    const salida = [
      '### Criterios de aceptación',
      '',
      '**CRITERIO 1 — Ninguna clase Lino queda en `styles.css`.**  ',
      'Los estilos están en `lino.css`.',
      '**CRITERIO 1: OK**',
      '',
      '**CRITERIO 2 — El fondo computado de `<body>`.**  ',
      'El E2E existente solo comprueba el atributo `data-tema`.',
      '**CRITERIO 2: HALLAZGO — falta la aserción E2E explícita del fondo computado de `<body>` en claro y oscuro.**',
      '**CRITERIO 3: OK**',
      '',
      'No encontré incumplimientos adicionales de estándares del repo.',
    ].join('\n');

    expect(extraerVeredicto(salida)).toEqual({
      hallazgos: 'falta la aserción E2E explícita del fondo computado de `<body>` en claro y oscuro.',
      dudas: [],
    });
  });

  it('la DUDA dentro de la tabla de criterios, con negritas y guion largo, viaja (regresión de #24)', () => {
    const salida = [
      '**CRITERIO 1: DUDA** — «Contraseña nueva ≥ 10 caracteres»: `nueva.length` cuenta unidades UTF-16; contar puntos de código trataría cinco emoji como cinco. El ticket no determina qué unidad define «carácter».',
      '**CRITERIO 2: OK** — El cambio de contraseña requiere la actual y la nueva es distinta.',
    ].join('\n');

    const veredicto = extraerVeredicto(salida);

    expect(veredicto.hallazgos).toBeNull();
    expect(veredicto.dudas).toHaveLength(1);
    expect(veredicto.dudas[0]).toContain('unidades UTF-16');
  });

  it('DUDA y DEVOLVER con negritas también viajan limpios', () => {
    const salida = '**DEVOLVER**\n**DUDA 1:** ¿La tarjeta de 420px es ancho total o de contenido?**';

    expect(extraerDevolucion(salida)).toBe('¿La tarjeta de 420px es ancho total o de contenido?');
  });

  it('la DUDA enumerada en lista numerada con negritas viaja (regresión de #20, 3-oct)', () => {
    // Formato verbatim de la revisora de la ronda 1 de la 4ª pasada de #20: la
    // línea de veredicto numerada como lista — «7. **CRITERIO 7: DUDA** — …» —
    // no matcheaba y la máquina degradó la DUDA a ciclo de reparación.
    const salida = [
      '## Criterios revisados',
      '',
      '6. **CRITERIO 6: OK** — El timeline usa listas `<ol>` y eventos `<li>`.',
      '7. **CRITERIO 7: DUDA** — Para un 1-to-1 sin notas no vacías, el contrato no determina qué mostrar en lugar de «inicio de nota…».',
      '8. **CRITERIO 8: OK** — El 1-to-1 cuenta temas con nota.',
    ].join('\n');

    const veredicto = extraerVeredicto(salida);

    expect(veredicto.hallazgos).toBeNull();
    expect(veredicto.dudas).toHaveLength(1);
    expect(veredicto.dudas[0]).toContain('qué mostrar en lugar de «inicio de nota…»');
  });

  it('la DUDA con anotación parentizada tras el número de criterio viaja (regresión de #20, 3-oct)', () => {
    // Formato verbatim de la revisora de la ronda 2: «CRITERIO 10 (CA: …): **DUDA** — …».
    const salida = [
      '### Criterios auditados',
      '',
      'CRITERIO 9 (CA: marcadores y accesibilidad): **OK** — Los marcadores son decorativos.',
      'CRITERIO 10 (CA: resumen del 1-to-1): **DUDA** — «80 caracteres» admite lecturas con resultados distintos: 80 unidades UTF-16 o 80 puntos de código.',
      'CRITERIO 11 (CA: incidencia): **OK** — Muestra «Incidencia» como título visible.',
    ].join('\n');

    const veredicto = extraerVeredicto(salida);

    expect(veredicto.hallazgos).toBeNull();
    expect(veredicto.dudas).toHaveLength(1);
    expect(veredicto.dudas[0]).toContain('80 unidades UTF-16');
  });

  it('el HALLAZGO enumerado y con anotación parentizada también viaja', () => {
    const salida = [
      '10. **CRITERIO 10: HALLAZGO** — El badge del timeline queda a 12 px, pero su padding horizontal es 8px.',
      '11. **CRITERIO 11: OK** — La agregación consulta las tablas existentes.',
    ].join('\n');

    expect(extraerVeredicto(salida)).toEqual({
      hallazgos: 'El badge del timeline queda a 12 px, pero su padding horizontal es 8px.',
      dudas: [],
    });
  });

  it('el resumen enumerado o con negritas llega limpio (regresión de #20, 3-oct)', () => {
    expect(extraerResumen('2. **RESUMEN:** Implementado el historial con su agregación.**')).toBe(
      'Implementado el historial con su agregación.',
    );
  });

  it('el resumen con negritas llega sin marcadores', () => {
    expect(extraerResumen('**RESUMEN:** Movidos los estilos a `lino.css`.**')).toBe(
      'Movidos los estilos a `lino.css`.',
    );
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

describe('Sesiones: modelo por tipo (ADR-0013)', () => {
  it('la cadena plana se usa tal cual', () => {
    expect(modeloDe('openrouter/openai/gpt-6-luna-pro', 'pantalla')).toBe(
      'openrouter/openai/gpt-6-luna-pro',
    );
  });

  it('el tipo declarado en el cuerpo encamina a su modelo y el resto al defecto', () => {
    const papel = {
      defecto: 'openrouter/~deepseek/deepseek-pro-latest',
      porTipo: { pantalla: 'openrouter/openai/gpt-6.1-sol-pro' },
    };
    expect(modeloDe(papel, 'pantalla')).toBe('openrouter/openai/gpt-6.1-sol-pro');
    expect(modeloDe(papel, 'dominio')).toBe('openrouter/~deepseek/deepseek-pro-latest');
    expect(modeloDe(papel, null)).toBe('openrouter/~deepseek/deepseek-pro-latest');
  });
});

describe('Sesiones: recuperación de párrafo corrido (regresión de #22, 4-oct)', () => {
  it('el veredicto entero en un párrafo sin saltos de línea viaja igual, sin caer al fallback de 500', () => {
    // Formato verbatim de la clase: la revisora de la ronda 3 de #22 separó los
    // veredictos con saltos simples; un paso más allá, todo en una línea, los
    // regexes ^-anclados no ven nada y la máquina degrada al fallback.
    const salida = [
      'CRITERIO 1: OK — El ciclo completo funciona. ',
      'CRITERIO 2: OK — Los diálogos cubren foco, Esc y descarte. ',
      'CRITERIO 3: HALLAZGO — Una respuesta obsoleta puede sobrescribir la lista local.',
    ].join('');

    const veredicto = extraerVeredicto(salida);
    expect(veredicto.hallazgos).toBe(
      'Una respuesta obsoleta puede sobrescribir la lista local.',
    );
    expect(veredicto.dudas).toEqual([]);
  });

  it('la DUDA en párrafo corrido también viaja (la devolución no se pierde)', () => {
    const salida =
      'He revisado el diff. CRITERIO 1: OK — Bien. DUDA 1: El cuerpo no fija el formato de la fecha.';
    const veredicto = extraerVeredicto(salida);
    expect(veredicto.dudas).toEqual(['El cuerpo no fija el formato de la fecha.']);
    expect(veredicto.hallazgos).toBeNull();
  });

  it('la prosa que cita el contrato sin emitir veredicto no matchea ni en la recuperación', () => {
    const salida =
      'El diff cumple. Según el cuerpo, «DUDA n:» solo procede ante ambigüedades reales; no hay ninguna.';
    const veredicto = extraerVeredicto(salida);
    expect(veredicto.hallazgos).not.toBeNull(); // fallback de 500: ambigüedad nunca es verde
    expect(veredicto.dudas).toEqual([]);
  });

  it('dudas legibles sin la línea «DEVOLVER» también son devolución (nunca diff entregado)', () => {
    expect(extraerDevolucion('Antes de adivinar, devuelvo: DUDA 1: ¿píxeles CSS o puntos de código?')).toBe(
      '¿píxeles CSS o puntos de código?',
    );
  });
});
