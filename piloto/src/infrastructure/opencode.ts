import type { ErrorEnMano, Ticket } from '../domain/model.js';
import type { PuertoSesiones } from '../domain/ports.js';
import { ejecutar } from './procesos.js';

/**
 * Adaptador de sesiones: opencode run, un papel por llamada, un modelo por
 * papel según configuración. Cada llamada es una sesión nueva, no interactiva
 * y de contexto fresco (ADR-0003); la configuración del proyecto (AGENTS.md,
 * skills, docs) la carga opencode por directorio.
 *
 * El formato de invocación vive solo en argsSesion: verificarlo contra
 * `opencode run --help` en el primer arranque real (paso 4 del plan).
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

const argsSesion = (modelo: string, prompt: string): string[] => ['run', '--model', modelo, prompt];

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
    `Revisa el diff pendiente (git diff) del ticket #${ticket.numero} — ${ticket.titulo}.`,
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
    `El último ciclo quedó en rojo con este error (${error.puerta === undefined ? 'revisión' : `puerta ${error.puerta}`}):`,
    '',
    error.texto,
    '',
    'Arregla el diff pendiente (git diff) para que lo resuelva, sin commitear y sin cambiar nada más.',
  ].join('\n');

function extraerResumen(salida: string): string {
  const lineas = [...salida.matchAll(/RESUMEN:\s*(.+)/g)].map((m) => m[1]?.trim() ?? '');
  return lineas.at(-1) ?? 'Implementado por el Piloto (la sesión no dejó resumen).';
}

function extraerHallazgo(salida: string): string | null {
  if (/SIN HALLAZGOS/.test(salida)) return null;
  const hallazgos = [...salida.matchAll(/HALLAZGO:\s*(.+)/g)].map((m) => m[1]?.trim() ?? '');
  // Sin formato claro tampoco se pasa: la ambigüedad nunca es verde (ADR-0003).
  return hallazgos.at(-1) ?? recortar(salida);
}

function recortar(texto: string): string {
  const limpio = texto.trim();
  return limpio.length <= 500 ? limpio || 'La revisora respondió sin formato.' : `…${limpio.slice(-500)}`;
}

export function crearSesiones(modelos: Modelos, config: ConfigSesiones): PuertoSesiones {
  return {
    async implementar(ticket: Ticket): Promise<string> {
      const salida = await ejecutar(
        config.comando,
        argsSesion(modelos.implementadora, promptImplementadora(ticket)),
        { minutos: config.tiempoMaxMinutos },
      );
      return extraerResumen(salida);
    },
    async revisar(ticket: Ticket): Promise<string | null> {
      const salida = await ejecutar(
        config.comando,
        argsSesion(modelos.revisora, promptRevisora(ticket)),
        { minutos: config.tiempoMaxMinutos },
      );
      return extraerHallazgo(salida);
    },
    async reparar(error: ErrorEnMano, _reintento: number): Promise<void> {
      await ejecutar(config.comando, argsSesion(modelos.reparadora, promptReparadora(error)), {
        minutos: config.tiempoMaxMinutos,
      });
    },
  };
}
