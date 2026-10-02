import type { ErrorEnMano, PuertaConfig, Ticket, Veredicto } from '../domain/model.js';
import { describirOrigen } from '../domain/model.js';
import type { PuertoSesiones, ResultadoImplementación } from '../domain/ports.js';
import { ejecutar, recortar } from './procesos.js';

/**
 * Adaptador de sesiones: opencode run, un papel por llamada, un modelo por
 * papel según configuración. Cada llamada es una sesión nueva, no interactiva
 * y de contexto fresco (ADR-0003); la configuración del proyecto (AGENTS.md,
 * skills, docs) la carga opencode por directorio. Los prompts de implementadora
 * y reparadora llevan las puertas de la configuración como autochequeo previo
 * (ADR-0010): las sesiones presentan su trabajo sin rojos; el veredicto sigue
 * siendo del arnés del coordinador. Implementadora y revisora pueden devolver
 * el ticket con dudas cuando el cuerpo no determina la implementación
 * (ADR-0012): antes de adivinar, «DEVOLVER» / «DUDA n: …».
 *
 * Flags verificados contra `opencode run --help` (v2.0.18): --model admite
 * «provider/model», --title nombra la sesión (evidencia) y --auto aprueba los
 * permisos no denegados explícitamente. La revisora va SIN --auto: su bash
 * está permitido (ve el diff), pero cualquier edición necesita un permiso
 * que en sesión no interactiva nadie le dará. Las reglas de opencode.json
 * deniegan external_directory y todo git push/commit/merge en sesiones: un
 * «ask» imprevisto mata una sesión no interactiva (auto-rechazo), pero un
 * «deny» configurado solo bloquea la operación y la sesión continúa. Lo
 * irreversible lo hace el coordinador, nunca una sesión.
 */

export interface ConfigSesiones {
  comando: string;
  tiempoMaxMinutos: number;
}

export interface Modelos {
  implementadora: string;
  reparadora: string;
  revisora: string;
}

interface LlamadaSesion {
  modelo: string;
  prompt: string;
  titulo: string;
  auto: boolean;
}

const argsSesion = (llamada: LlamadaSesion): string[] => [
  'run',
  ...(llamada.auto ? ['--auto'] : []),
  '--model',
  llamada.modelo,
  '--title',
  llamada.titulo,
  llamada.prompt,
];

export const promptImplementadora = (ticket: Ticket, puertas: PuertaConfig[]): string =>
  [
    'Eres la sesión implementadora del Piloto en este repo.',
    `Implementa el ticket #${ticket.numero} — ${ticket.titulo}, y nada más.`,
    '',
    ticket.cuerpo.trim(),
    '',
    'Reglas: trabaja sobre el árbol de trabajo sin commitear (el Piloto gestiona git).',
    'Respeta las convenciones del repo (AGENTS.md, CONTEXT.md, docs/adr).',
    'Si el árbol ya tiene un diff pendiente de un intento anterior de este ticket, retómalo:',
    'verifícalo contra la spec en vez de rehacerlo desde cero.',
    '',
    'Si un valor que vas a construir no está determinado por el cuerpo del ticket',
    '(dos lecturas razonables que producirían diffs distintos), NO lo adivines:',
    'termina ya, sin construir, con una línea «DEVOLVER» seguida de una línea por duda,',
    '«DUDA n: <el criterio, las lecturas y qué decide cada una>» (n: 1, 2, …).',
    'Devolver el ticket es legítimo y barato; adivinar quema reintentos del ticket.',
    '',
    'Antes de dar el diff por listo:',
    '1. Relee el ticket y enumera sus criterios de aceptación; comprueba cada uno contra el diff.',
    '2. Ejecuta las puertas del arnés, una a una, y corrige el código hasta verlas todas en verde:',
    ...puertas.map((p) => `   - ${p.nombre}: ${p.comando}`),
    '   Ejecútalas de verdad: no declares el diff listo con alguna en rojo o sin correrlas.',
    '3. Solo entonces termina.',
    '',
    'Termina tu respuesta con una única línea «RESUMEN: <qué has hecho, en una frase>».',
  ].join('\n');

export const promptRevisora = (ticket: Ticket): string =>
  [
    'Eres la sesión revisora del Piloto: independiente; no sabes cómo se razonó el cambio.',
    `Revisa el diff pendiente del ticket #${ticket.numero} — ${ticket.titulo}:`,
    'ejecuta «git diff» para los cambios y «git status» para los archivos nuevos,',
    'que también son parte del diff.',
    'No salgas del directorio del repo: cada comando bash arranca en la raíz del proyecto',
    'y el cwd no persiste entre llamadas.',
    '',
    'La spec del ticket:',
    ticket.cuerpo.trim(),
    '',
    'Audita el diff contra esta spec y los estándares del repo (AGENTS.md, CONTEXT.md, docs/adr),',
    'criterio por criterio, SIN SALTARTE NINGUNO:',
    '1. Enumera los criterios de aceptación del ticket, incluidos los valores que cita',
    '   (tokens, paddings, tamaños, copy exacto…).',
    '2. Por CADA criterio emite una línea: «CRITERIO n: OK» si el diff lo cumple,',
    '   o «CRITERIO n: HALLAZGO — <qué falla y por qué>» si no.',
    '3. Si el diff incumple algo que no es criterio del ticket (estándares del repo), añade',
    '   «HALLAZGO n: <qué falla y por qué>» por cada problema.',
    '4. Si un criterio depende de un valor que el cuerpo del ticket NO determina — dos lecturas',
    '   razonables que producirían diffs distintos —, no lo juzgues: emite',
    '   «DUDA n: <el criterio, las lecturas y qué decide cada una>».',
    '5. No reserves problemas para una próxima ronda: cada ronda extra consume un reintento',
    '   del ticket.',
    'No modifiques nada.',
    '',
    'Si todos los criterios están OK y no hay dudas, responde exactamente «SIN HALLAZGOS».',
  ].join('\n');

export const promptReparadora = (ticket: Ticket, error: ErrorEnMano, puertas: PuertaConfig[]): string =>
  [
    'Eres la sesión reparadora del Piloto en este repo.',
    `El último ciclo del ticket #${ticket.numero} — ${ticket.titulo} quedó en rojo con este error (${describirOrigen(error)}):`,
    '',
    error.texto,
    '',
    'La spec del ticket:',
    ticket.cuerpo.trim(),
    '',
    'Arregla el diff pendiente (git diff y los archivos nuevos de git status)',
    'para que resuelva el error y cumpla la spec, sin commitear y sin cambiar nada más.',
    'Después ejecuta las puertas del arnés, una a una, y corrige hasta verlas todas en verde:',
    ...puertas.map((p) => `- ${p.nombre}: ${p.comando}`),
    'Ejecútalas de verdad: no des el parche por listo con alguna en rojo o sin correrlas.',
  ].join('\n');

export function extraerResumen(salida: string): string {
  const lineas = [...salida.matchAll(/RESUMEN:\s*(.+)/g)].map((m) => m[1]?.trim() ?? '');
  return lineas.at(-1) ?? 'Implementado por el Piloto (la sesión no dejó resumen).';
}

/** Las dudas numeradas de una respuesta: «DUDA n: …», compartidas por implementadora y revisora (ADR-0012). */
export function extraerDudas(salida: string): string[] {
  return [...salida.matchAll(/^[ \t]*(?:[-*][ \t]*)?DUDA(?:[ \t]+\d+)?[ \t]*:[ \t]*(.+)$/gm)]
    .map((m) => m[1]?.trim() ?? '')
    .filter((duda) => duda !== '');
}

export function extraerVeredicto(salida: string): Veredicto {
  // Una línea por hallazgo — «HALLAZGO n: …» de siempre (ADR-0010) o
  // «CRITERIO n: HALLAZGO — …» del contrato por criterio —; todos viajan
  // juntos a la reparadora en un solo ciclo de reparación.
  const hallazgos = [
    ...salida.matchAll(/^[ \t]*(?:[-*][ \t]*)?(?:CRITERIO[ \t]+\d+[ \t]*:[ \t]*)?HALLAZGO(?:[ \t]+\d+)?[ \t]*(?::|—)[ \t]*(.+)$/gm),
  ]
    .map((m) => m[1]?.trim() ?? '')
    .filter((hallazgo) => hallazgo !== '');
  const dudas = extraerDudas(salida);
  if (hallazgos.length === 0 && dudas.length === 0 && /SIN HALLAZGOS/.test(salida)) {
    return { hallazgos: null, dudas: [] };
  }
  if (hallazgos.length > 0 || dudas.length > 0) {
    return { hallazgos: hallazgos.length > 0 ? hallazgos.join('\n') : null, dudas };
  }
  // Sin formato claro tampoco se pasa: la ambigüedad nunca es verde (ADR-0003).
  const cola = recortar(salida, 500);
  return { hallazgos: cola === '' ? 'La revisora respondió sin formato.' : cola, dudas: [] };
}

/** La devolución de la implementadora (ADR-0012): null = entregó el diff; string = dudas para el grill. */
export function extraerDevolucion(salida: string): string | null {
  if (!/^[ \t]*DEVOLVER[ \t]*:?[ \t]*$/m.test(salida)) return null;
  const dudas = extraerDudas(salida);
  // Devolvió sin dudas legibles: se devuelve igual — nunca se trata como diff listo.
  return dudas.length > 0 ? dudas.join('\n') : 'La implementadora devolvió el ticket sin dudas legibles.';
}

export function crearSesiones(
  modelos: Modelos,
  config: ConfigSesiones,
  puertas: PuertaConfig[],
): PuertoSesiones {
  return {
    async implementar(ticket: Ticket): Promise<ResultadoImplementación> {
      const salida = await ejecutar(
        config.comando,
        argsSesion({
          modelo: modelos.implementadora,
          prompt: promptImplementadora(ticket, puertas),
          titulo: `Piloto · implementadora · #${ticket.numero}`,
          auto: true,
        }),
        { minutos: config.tiempoMaxMinutos },
      );
      const dudas = extraerDevolucion(salida);
      if (dudas !== null) return { tipo: 'ticketDevuelto', dudas };
      return { tipo: 'diffListo', resumen: extraerResumen(salida) };
    },
    async revisar(ticket: Ticket): Promise<Veredicto> {
      const salida = await ejecutar(
        config.comando,
        argsSesion({
          modelo: modelos.revisora,
          prompt: promptRevisora(ticket),
          titulo: `Piloto · revisora · #${ticket.numero}`,
          auto: false,
        }),
        { minutos: config.tiempoMaxMinutos },
      );
      return extraerVeredicto(salida);
    },
    async reparar(ticket: Ticket, error: ErrorEnMano, reintento: number): Promise<void> {
      await ejecutar(
        config.comando,
        argsSesion({
          modelo: modelos.reparadora,
          prompt: promptReparadora(ticket, error, puertas),
          titulo: `Piloto · reparadora · #${ticket.numero} · reintento ${reintento}`,
          auto: true,
        }),
        { minutos: config.tiempoMaxMinutos },
      );
    },
  };
}
