/**
 * Tipos del núcleo del Piloto (ADR-0003): fases, tickets, pasada, eventos y comandos.
 * El núcleo es puro: no conoce GitHub, sesiones ni arnés; solo decide y narra.
 */

/** Fases de una pasada. Las de espera (implementacion, revision, puertas, reparacion) aguardan un evento del mundo. */
export type Fase =
  | 'frontera'
  | 'implementación'
  | 'revisión'
  | 'puertas'
  | 'reparación'
  | 'verde'
  | 'rojo'
  | 'escalado'
  | 'devuelta'
  | 'fin';

export type EstadoTicket = 'lista' | 'cerrado' | 'escalado' | 'devuelto';

/** Un ticket del tracker: lo que reciben la implementadora y la reparadora (contexto fresco: datos del tracker, no conversación). */
export interface Ticket {
  numero: number;
  titulo: string;
  cuerpo: string;
  estado: EstadoTicket;
  bloqueadoPor: number[];
  /** Tipo que declara el cuerpo («**Tipo:** pantalla»); null si no lo declara. Encamina el modelo del papel (ADR-0013). */
  tipo: string | null;
}

/** El error en mano que provoca un rojo y viaja a la reparadora. */
export interface ErrorEnMano {
  origen: 'revisión' | 'puerta';
  /** Puerta que falló, cuando el origen es una puerta. */
  puerta?: string;
  texto: string;
}

/** El veredicto de la revisora (ADR-0010 + ADR-0012): defectos del diff y ambigüedades del cuerpo. */
export interface Veredicto {
  /** Hallazgos: defectos del diff contra la spec, una línea por hallazgo; null = ninguno. */
  hallazgos: string | null;
  /** Dudas: valores que el cuerpo del ticket no determina; cualquier duda fuerza devolución. */
  dudas: string[];
}

/** Estado completo de una pasada: lo único que el Piloto recuerda. */
export interface Pasada {
  fase: Fase;
  reintentosConfigurados: number;
  tickets: Ticket[];
  ticketActual: number | null;
  reintentosUsados: number;
  error: ErrorEnMano | null;
  /** Resumen de la implementadora, para el comentario de cierre del issue. */
  resumen: string | null;
  /** La salida del Piloto narra cada paso (criterio del ticket #11). */
  narracion: string[];
}

/** Resultados que el mundo trae: cada sesión y cada puerta responde con un evento. */
export type Evento =
  | { tipo: 'diffListo'; resumen: string }
  | { tipo: 'ticketDevuelto'; dudas: string }
  | { tipo: 'revisiónSinHallazgos' }
  | { tipo: 'revisiónConHallazgo'; texto: string }
  | { tipo: 'revisiónConDuda'; hallazgos: string | null; dudas: string }
  | { tipo: 'puertasEnVerde' }
  | { tipo: 'puertaEnRojo'; puerta: string; salida: string }
  | { tipo: 'parcheListo' };

/** Lo que el núcleo ordena ejecutar contra los puertos (ADR-0004). */
export type Comando =
  | { tipo: 'lanzarImplementadora'; ticket: Ticket }
  | { tipo: 'lanzarRevisora'; ticket: Ticket }
  | { tipo: 'abrirPuertas' }
  | { tipo: 'lanzarReparadora'; ticket: Ticket; reintento: number; reintentosConfigurados: number; error: ErrorEnMano }
  | { tipo: 'empujarYCerrar'; ticket: Ticket; resumen: string | null }
  | { tipo: 'escalar'; ticket: Ticket; error: ErrorEnMano }
  | {
      tipo: 'devolver';
      ticket: Ticket;
      /** Dudas numeradas que una sesión de grill con el humano debe resolver (ADR-0012). */
      dudas: string;
      /** Hallazgos que viajan como contexto para el grill, cuando la revisora trajo dudas y defectos. */
      hallazgos: string | null;
    }
  | { tipo: 'terminar'; motivo: 'fronteraVacia' | 'escalado' | 'devolución'; abiertos: number[] };

/** Etiquetas del tracker que marcan los tickets del Piloto (configuración). */
export interface Etiquetas {
  /** Tickets candidatos: desbloqueados y listos (ready-for-agent). */
  lista: string;
  /** Tickets devueltos al humano tras agotar los reintentos (ready-for-human). */
  escalado: string;
  /** Tickets devueltos por dudas de spec: requieren una sesión de grill (needs-grill, ADR-0012). */
  devolución: string;
}

/** Una puerta del arnés: nombre y el comando que la ejecuta (configuración). */
export interface PuertaConfig {
  nombre: string;
  comando: string;
}

/** Describe el origen de un error para prompts y comentarios: «revisión» o «puerta X». */
export function describirOrigen(error: ErrorEnMano): string {
  return error.puerta === undefined ? 'revisión' : `puerta ${error.puerta}`;
}

/** Un movimiento del núcleo: la pasada resultante y los comandos que lo acompañan. */
export interface Movimiento {
  pasada: Pasada;
  comandos: Comando[];
}
