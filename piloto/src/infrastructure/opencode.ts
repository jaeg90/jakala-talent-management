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

/**
 * Modelo por papel: una cadena única, o por tipo de ticket (ADR-0013) — la
 * métrica por tipo de ADR-0011 disparó tres veces en «pantalla» (#14, #18, #22:
 * escalados por acumulación de hallazgos finos); ese tipo va a un modelo
 * superior y el resto al defecto. El coste por sesión es igual o menor que el
 * del modelo barato: las sesiones son lectura de caché dominante (24M de
 * re-lecturas frente a 0.4M nuevos en la #22) y los premium descuentan la
 * caché 10-20×, mientras deepseek la cobra a precio completo.
 */
export interface ModeloPorTipo {
  defecto: string;
  /** Modelo por tipo declarado en el cuerpo («**Tipo:** pantalla»). */
  porTipo?: Record<string, string>;
}

export interface Modelos {
  implementadora: string | ModeloPorTipo;
  reparadora: string | ModeloPorTipo;
  revisora: string;
}

/** El modelo de un papel para un ticket: la cadena plana, o el mapa por tipo con su defecto (ADR-0013). */
export const modeloDe = (papel: string | ModeloPorTipo, tipo: string | null): string => {
  if (typeof papel === 'string') return papel;
  const porTipo = tipo === null ? undefined : papel.porTipo?.[tipo];
  return porTipo ?? papel.defecto;
};

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
    'Si un valor o un contrato que vas a construir no está determinado por el cuerpo del',
    'ticket (dos lecturas razonables que producirían implementaciones distintas),',
    'NO lo adivines: termina ya, sin construir, con una línea «DEVOLVER» seguida de',
    'una línea por duda, «DUDA n: <el criterio, las lecturas y qué decide cada una>» (n: 1, 2, …).',
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
    '   Formato plano: empieza cada línea de veredicto por «CRITERIO n:» (o la',
    '   palabra clave), sin numeración de lista delante ni paréntesis tras el',
    '   número — el extractor lee líneas, no prosa: un veredicto por línea física',
    '   separada por saltos de línea, nunca un párrafo corrido ni bloques resumen',
    '   (nada de «Criterios auditados:»), y sin reagrupar los criterios del ticket.',
    '3. Si el diff incumple algo que no es criterio del ticket (estándares del repo), añade',
    '   «HALLAZGO n: <qué falla y por qué>» por cada problema.',
    '4. Si un criterio depende de un valor o de un contrato que el cuerpo del ticket NO',
    '   determina — dos lecturas razonables que producirían implementaciones distintas —,',
    '   no lo juzgues: emite ese criterio como «CRITERIO n: DUDA — <el criterio, las',
    '   lecturas y qué decide cada una>». La duda nunca se marca OK ni HALLAZGO:',
    '   viaja a devolución, igual que las dudas sueltas («DUDA n: …»).',
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

const SIN_RESUMEN = 'Implementado por el Piloto (la sesión no dejó resumen).';

export function extraerResumen(salida: string): string {
  // La línea RESUMEN puede llegar con prefijo de lista numerada o énfasis
  // (misma familia de formatos que los veredictos; anclada a inicio de línea
  // para no capturar la palabra clave citada a mitad de línea).
  const lineas = [
    ...salida.matchAll(
      /^(?:\d+[.)][ \t]+)?(?:[-*_>#]+[ \t]*)*RESUMEN[ \t]*:(?:\*\*)?[ \t]*(.+)$/gm,
    ),
  ].map((m) => sinMarcasDeCierre(m[1]?.trim() ?? ''));
  const ultima = lineas.at(-1);
  return ultima === undefined || ultima === '' ? SIN_RESUMEN : ultima;
}

/**
 * Énfasis markdown alrededor de las palabras clave de los contratos (HALLAZGO,
 * DUDA, DEVOLVER, RESUMEN): la revisora escribe tablas con negritas —
 * «**CRITERIO n: HALLAZGO — …**» — y los contratos deben leerse a través del
 * formato, no romperse contra él (ajuste ADR-0012, 2-oct: el veredicto de #38
 * se negó con ** y el extractor cayó a la cola de 500; la reparadora recibió
 * criterios OK como si fueran el hallazgo y el hallazgo real se perdió).
 *
 * Ajuste (3-oct, regresión de #20): la revisora también enumera sus líneas de
 * veredicto — «7. **CRITERIO 7: DUDA** — …» — y anota el criterio entre
 * paréntesis — «CRITERIO 10 (CA: resumen del 1-to-1): **DUDA** — …». La
 * APERTURA tolera el prefijo de lista numerada, y el prefijo de criterio la
 * anotación parentizada; los dos formatos se tragaron sendas DUDAs de la 4ª
 * pasada de #20 y la máquina las degradó a ciclos de reparación.
 */
const APERTURA = String.raw`[ \t]*(?:\d+[.)][ \t]+)?(?:[-*_>#]+[ \t]*)*`;
const CIERRE = String.raw`[*_ \t]*`;

/** Prefijo de criterio: «CRITERIO n:» opcional, con énfasis o anotación parentizada tras el número. */
const CRITERIO = String.raw`(?:CRITERIO[ \t]*\d+(?:[ \t]*\([^)]*\))?[ \t]*:[ \t]*)?`;

/** Quita los marcadores de énfasis de cierre que quedan pegados al texto capturado. */
const sinMarcasDeCierre = (texto: string): string => texto.replace(/[\s*_]+$/, '');

const RE_HALLAZGO = new RegExp(
  String.raw`^${APERTURA}${CRITERIO}[*_ \t]*HALLAZGO(?:[ \t]+\d+)?[*_ \t]*(?::|—)[ \t]*${CIERRE}(.+)$`,
  'gm',
);
// La duda admite el prefijo de criterio y ambos separadores — el formato natural del
// contrato por criterio es «CRITERIO n: DUDA — …» (regresión de #24, 2-oct noche: la
// revisora la emitió así y el extractor la ignoró, degradando una decisión humana a
// un ciclo de reparación).
const RE_DUDA = new RegExp(
  String.raw`^${APERTURA}${CRITERIO}[*_ \t]*DUDA(?:[ \t]+\d+)?[*_ \t]*(?::|—)[ \t]*${CIERRE}(.+)$`,
  'gm',
);

/**
 * Recuperación de párrafo corrido (regresión de #22, 4-oct): la revisora puede
 * emitir el veredicto entero en un solo párrafo sin saltos de línea — los
 * regexes ^-anclados no ven nada y la máquina degradaría al fallback de 500.
 * Solo cuando el pase anclado no encuentra NADA se reintenta sin el ancla: el
 * propio patrón (palabra clave + separador de veredicto) filtra la prosa que
 * cita el contrato sin emitir veredicto, y cualquier lectura que sale de aquí
 * es mejor que la cola truncada.
 */
const RE_HALLAZGO_SIN_ANCLA = new RegExp(
  String.raw`${APERTURA}${CRITERIO}[*_ \t]*HALLAZGO(?:[ \t]+\d+)?[*_ \t]*(?::|—)[ \t]*${CIERRE}(.+)`,
  'g',
);
const RE_DUDA_SIN_ANCLA = new RegExp(
  String.raw`${APERTURA}${CRITERIO}[*_ \t]*DUDA(?:[ \t]+\d+)?[*_ \t]*(?::|—)[ \t]*${CIERRE}(.+)`,
  'g',
);

const RE_DEVOLVER = new RegExp(String.raw`^${APERTURA}[*_ \t]*DEVOLVER[*_ \t]*:?[ \t]*${CIERRE}$`, 'm');

const extraer = (salida: string, anclada: RegExp, sinAncla: RegExp): string[] => {
  const conLineas = [...salida.matchAll(anclada)]
    .map((m) => sinMarcasDeCierre(m[1]?.trim() ?? ''))
    .filter((t) => t !== '');
  if (conLineas.length > 0) return conLineas;
  return [...salida.matchAll(sinAncla)]
    .map((m) => sinMarcasDeCierre(m[1]?.trim() ?? ''))
    .filter((t) => t !== '');
};

/** Las dudas numeradas de una respuesta: «DUDA n: …», compartidas por implementadora y revisora (ADR-0012). */
export function extraerDudas(salida: string): string[] {
  return extraer(salida, RE_DUDA, RE_DUDA_SIN_ANCLA);
}

export function extraerVeredicto(salida: string): Veredicto {
  // Una línea por hallazgo — «HALLAZGO n: …» de siempre (ADR-0010) o
  // «CRITERIO n: HALLAZGO — …» del contrato por criterio —, con o sin énfasis
  // markdown alrededor; todos viajan juntos a la reparadora en un solo ciclo.
  const hallazgos = extraer(salida, RE_HALLAZGO, RE_HALLAZGO_SIN_ANCLA);
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
  const dudas = extraerDudas(salida);
  if (RE_DEVOLVER.test(salida)) {
    return dudas.length > 0 ? dudas.join('\n') : 'La implementadora devolvió el ticket sin dudas legibles.';
  }
  // Recuperación de párrafo corrido (regresión de #22, 4-oct): dudas legibles
  // sin la línea «DEVOLVER» también son una devolución — un ciclo que devolvió
  // dudas jamás se trata como diff entregado.
  if (dudas.length > 0) return dudas.join('\n');
  return null;
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
          modelo: modeloDe(modelos.implementadora, ticket.tipo),
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
          modelo: modeloDe(modelos.reparadora, ticket.tipo),
          prompt: promptReparadora(ticket, error, puertas),
          titulo: `Piloto · reparadora · #${ticket.numero} · reintento ${reintento}`,
          auto: true,
        }),
        { minutos: config.tiempoMaxMinutos },
      );
    },
  };
}
