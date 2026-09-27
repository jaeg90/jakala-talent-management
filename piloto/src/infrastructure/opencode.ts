import type { ErrorEnMano, Ticket } from '../domain/model.js';
import { describirOrigen } from '../domain/model.js';
import type { PuertoSesiones } from '../domain/ports.js';
import { ejecutar, recortar } from './procesos.js';

/**
 * Adaptador de sesiones: opencode run, un papel por llamada, un modelo por
 * papel según configuración. Cada llamada es una sesión nueva, no interactiva
 * y de contexto fresco (ADR-0003); la configuración del proyecto (AGENTS.md,
 * skills, docs) la carga opencode por directorio.
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

const promptImplementadora = (ticket: Ticket): string =>
  [
    'Eres la sesión implementadora del Piloto en este repo.',
    `Implementa el ticket #${ticket.numero} — ${ticket.titulo}, y nada más.`,
    '',
    ticket.cuerpo.trim(),
    '',
    'Reglas: trabaja sobre el árbol de trabajo sin commitear (el Piloto gestiona git).',
    'Respeta las convenciones del repo (AGENTS.md, CONTEXT.md, docs/adr).',
    'Termina tu respuesta con una única línea «RESUMEN: <qué has hecho, en una frase>».',
  ].join('\n');

const promptRevisora = (ticket: Ticket): string =>
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
    'Comprueba que el diff cumple la spec y los estándares del repo (AGENTS.md, CONTEXT.md, docs/adr).',
    'No modifiques nada.',
    'Si el diff cumple, responde exactamente «SIN HALLAZGOS».',
    'Si hay un problema que impide el verde, responde una única línea «HALLAZGO: <qué falla y por qué>».',
  ].join('\n');

const promptReparadora = (error: ErrorEnMano): string =>
  [
    'Eres la sesión reparadora del Piloto en este repo.',
    `El último ciclo quedó en rojo con este error (${describirOrigen(error)}):`,
    '',
    error.texto,
    '',
    'Arregla el diff pendiente (git diff y los archivos nuevos de git status)',
    'para que lo resuelva, sin commitear y sin cambiar nada más.',
  ].join('\n');

function extraerResumen(salida: string): string {
  const lineas = [...salida.matchAll(/RESUMEN:\s*(.+)/g)].map((m) => m[1]?.trim() ?? '');
  return lineas.at(-1) ?? 'Implementado por el Piloto (la sesión no dejó resumen).';
}

function extraerHallazgo(salida: string): string | null {
  if (/SIN HALLAZGOS/.test(salida)) return null;
  const hallazgos = [...salida.matchAll(/HALLAZGO:\s*(.+)/g)].map((m) => m[1]?.trim() ?? '');
  // Sin formato claro tampoco se pasa: la ambigüedad nunca es verde (ADR-0003).
  const cola = recortar(salida, 500);
  return hallazgos.at(-1) ?? (cola === '' ? 'La revisora respondió sin formato.' : cola);
}

export function crearSesiones(modelos: Modelos, config: ConfigSesiones): PuertoSesiones {
  return {
    async implementar(ticket: Ticket): Promise<string> {
      const salida = await ejecutar(
        config.comando,
        argsSesion({
          modelo: modelos.implementadora,
          prompt: promptImplementadora(ticket),
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
    async reparar(error: ErrorEnMano, reintento: number): Promise<void> {
      await ejecutar(
        config.comando,
        argsSesion({
          modelo: modelos.reparadora,
          prompt: promptReparadora(error),
          titulo: `Piloto · reparadora · reintento ${reintento}`,
          auto: true,
        }),
        { minutos: config.tiempoMaxMinutos },
      );
    },
  };
}
