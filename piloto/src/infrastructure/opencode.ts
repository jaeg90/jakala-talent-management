import type { ErrorEnMano, PuertaConfig, Ticket } from '../domain/model.js';
import { describirOrigen } from '../domain/model.js';
import type { PuertoSesiones } from '../domain/ports.js';
import { ejecutar, recortar } from './procesos.js';

/**
 * Adaptador de sesiones: opencode run, un papel por llamada, un modelo por
 * papel según configuración. Cada llamada es una sesión nueva, no interactiva
 * y de contexto fresco (ADR-0003); la configuración del proyecto (AGENTS.md,
 * skills, docs) la carga opencode por directorio. Los prompts de implementadora
 * y reparadora llevan las puertas de la configuración como autochequeo previo
 * (ADR-0010): las sesiones presentan su trabajo sin rojos; el veredicto sigue
 * siendo del arnés del coordinador.
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
    'Comprueba que el diff cumple la spec y los estándares del repo (AGENTS.md, CONTEXT.md, docs/adr),',
    'criterio por criterio. No modifiques nada.',
    'Si el diff cumple, responde exactamente «SIN HALLAZGOS».',
    'Si hay problemas que impiden el verde, enuméralos TODOS en la misma respuesta,',
    'una línea por problema con el formato «HALLAZGO n: <qué falla y por qué>» (n: 1, 2, …).',
    'No reserves problemas para una próxima ronda: cada ronda extra consume un reintento del ticket.',
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

export function extraerHallazgo(salida: string): string | null {
  if (/SIN HALLAZGOS/.test(salida)) return null;
  // Una línea por hallazgo — «HALLAZGO: …» o «HALLAZGO n: …» —; todos viajan
  // juntos a la reparadora en un solo ciclo de reparación (ADR-0010).
  const hallazgos = [...salida.matchAll(/^\s*(?:[-*]\s*)?HALLAZGO(?:\s+\d+)?\s*:\s*(.+)$/gm)]
    .map((m) => m[1]?.trim() ?? '')
    .filter((hallazgo) => hallazgo !== '');
  if (hallazgos.length > 0) return hallazgos.join('\n');
  // Sin formato claro tampoco se pasa: la ambigüedad nunca es verde (ADR-0003).
  const cola = recortar(salida, 500);
  return cola === '' ? 'La revisora respondió sin formato.' : cola;
}

export function crearSesiones(
  modelos: Modelos,
  config: ConfigSesiones,
  puertas: PuertaConfig[],
): PuertoSesiones {
  return {
    async implementar(ticket: Ticket): Promise<string> {
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
      return extraerResumen(salida);
    },
    async revisar(ticket: Ticket): Promise<string | null> {
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
      return extraerHallazgo(salida);
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
