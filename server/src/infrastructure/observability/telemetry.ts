import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

/** Asa para apagar la telemetría al terminar el proceso (flush de spans). */
export interface TelemetryHandle {
  shutdown: () => Promise<void>;
}

/** Configuración de la telemetría; los valores por defecto no requieren red externa. */
export interface TelemetryConfig {
  /** Nombre del servicio en las trazas (por defecto jtm-server). */
  serviceName?: string;
  /**
   * Endpoint OTLP/HTTP de un colector (p. ej. http://localhost:4318). Cuando
   * está presente las trazas se exportan a él; si no, se vuelcan a consola.
   */
  otlpEndpoint?: string;
  /** Procesadores de spans adicionales (usado por los tests con exportador en memoria). */
  extraSpanProcessors?: SpanProcessor[];
  /** Suprime el exportador de consola (no dejar trazas visibles sin exportador real). */
  disableConsole?: boolean;
}

/** Endpoint base OTLP → URL de trazas (http://host:4318 → http://host:4318/v1/traces). */
function tracesUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return base.endsWith('/v1/traces') ? base : `${base}/v1/traces`;
}

/**
 * Arranca el SDK de OpenTelemetry con auto-instrumentación (HTTP/Express): cada
 * petición a la API genera una traza. Sin endpoint OTLP configurado exporta a
 * consola, de modo que las trazas son visibles sin levantar infraestructura.
 */
export function startTelemetry(config: TelemetryConfig = {}): TelemetryHandle {
  const spanProcessors: SpanProcessor[] = [...(config.extraSpanProcessors ?? [])];

  if (config.otlpEndpoint) {
    spanProcessors.push(new SimpleSpanProcessor(new OTLPTraceExporter({ url: tracesUrl(config.otlpEndpoint) })));
  } else if (!config.disableConsole) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  const sdk = new NodeSDK({
    serviceName: config.serviceName ?? 'jtm-server',
    spanProcessors,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  return { shutdown: () => sdk.shutdown() };
}