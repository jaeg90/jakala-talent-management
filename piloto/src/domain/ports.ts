import type { ErrorEnMano, Ticket } from './model.js';

/**
 * Los cinco puertos del Piloto (ADR-0004). El núcleo decide; los adaptadores
 * ejecutan. Cambiar de tracker, de runner de sesiones o de arnés es escribir
 * otro adaptador, no tocar el núcleo.
 */

/**
 * Puerto de frontera: el tracker. Carga la frontera inicial y ejecuta los
 * efectos sobre los issues (etiquetar, comentar, cerrar).
 * Adaptador actual: gh CLI.
 */
export interface PuertoFrontera {
  /** Los tickets abiertos y listos, con sus bloqueos; base del estado inicial. */
  cargarTickets(): Promise<Ticket[]>;
  /** Cambia la etiqueta del ticket: pone la nueva y (opcionalmente) quita la anterior. */
  etiquetar(ticket: number, poner: string, quitar?: string): Promise<void>;
  /** Deja un comentario en el ticket. */
  comentar(ticket: number, comentario: string): Promise<void>;
  /** Cierra el ticket dejando un comentario resumen. */
  cerrar(ticket: number, resumen: string): Promise<void>;
}

/**
 * Puerto de sesiones: cada papel es una sesión nueva, no interactiva y de
 * contexto fresco (ADR-0003). Nadie se autoevalúa; la revisora no hereda nada
 * de la implementadora.
 * Adaptador actual: opencode run, un modelo por papel según configuración.
 */
export interface PuertoSesiones {
  /** Implementadora: recibe solo el ticket; devuelve un resumen para el cierre. */
  implementar(ticket: Ticket): Promise<string>;
  /** Revisora: revisa el diff contra estándares y spec; null = sin hallazgos. */
  revisar(ticket: Ticket): Promise<string | null>;
  /** Reparadora: recibe solo el error en mano. */
  reparar(error: ErrorEnMano, reintento: number): Promise<void>;
}

/**
 * Puerto de puertas: el arnés determinista, único juez del verde/rojo (ADR-0003).
 * Adaptador actual: los comandos de la configuración (npm run typecheck, lint, test…).
 */
export interface PuertoPuertas {
  /** Ejecuta todas las puertas en orden; la primera en rojo con su salida, o null si todas en verde. */
  ejecutar(): Promise<{ puerta: string; salida: string } | null>;
}

/** Puerto de avisos: cómo se entera el humano de un escalado. */
export interface PuertoAvisos {
  avisar(mensaje: string): Promise<void>;
}

/** Puerto de entrega: empujar el cambio validado (push a main o rama+PR, según configuración). */
export interface PuertoEntrega {
  empujar(ticket: Ticket): Promise<void>;
}

/** Los cinco puertos juntos: lo que recibe el loop de la pasada. */
export interface Puertos {
  frontera: PuertoFrontera;
  sesiones: PuertoSesiones;
  puertas: PuertoPuertas;
  avisos: PuertoAvisos;
  entrega: PuertoEntrega;
}
