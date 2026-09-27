import * as Sentry from '@sentry/node';
import type { Express } from 'express';

/**
 * Inicializa Sentry en el servidor leyendo el DSN del entorno (configurable).
 * Sin DSN configurado no hace nada: el arnés y el servidor siguen siendo
 * deterministas y sin dependencia de red externa. Ver AGENTS.md.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || dsn === '') return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    // En JTM (todos los datos ficticios) muestrear el 100% es barato y útil.
    tracesSampleRate: 1,
  });
}

/**
 * Registra el manejador de errores de Express en Sentry: los errores no
 * capturados del servidor (5xx) se envían a Sentry con su contexto de petición.
 * Solo tiene efecto si Sentry está inicializado (DSN configurado).
 */
export function setupSentryErrorHandler(app: Express): void {
  if (!Sentry.isInitialized()) return;
  Sentry.setupExpressErrorHandler(app);
}

/** Espera a que se envíen los eventos pendientes a Sentry. */
export async function drenarSentry(ms = 2000): Promise<void> {
  await Sentry.flush(ms);
}

export { Sentry };