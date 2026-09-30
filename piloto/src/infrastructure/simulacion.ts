import type { ErrorEnMano, Ticket } from '../domain/model.js';
import type { Puertos } from '../domain/ports.js';

/**
 * Puertos simulados (ADR-0004): el mismo contrato, sin GitHub, sin sesiones,
 * sin arnés. Sirven para los tests de la pasada y para `npm run piloto -- --simular`.
 */

/** El guión de la simulación: qué tickets hay y qué responde el mundo. */
export interface GuionSimulacion {
  /** La frontera inicial. */
  tickets: Ticket[];
  /** Respuestas de la revisora en orden (null = sin hallazgos); la última se repite. */
  hallazgos: (string | null)[];
  /** Veredictos de las puertas en orden (null = todas en verde); el último se repite. */
  rojos: ({ puerta: string; salida: string } | null)[];
}

/** Lo que la simulación registró, para que los tests asserts sobre los efectos. */
export interface RegistroSimulacion {
  etiquetados: { ticket: number; etiqueta: string }[];
  comentarios: { ticket: number; texto: string }[];
  cierres: { ticket: number; resumen: string }[];
  avisos: string[];
  empujes: number[];
  reparaciones: number[];
}

/** Crea los puertos simulados y el registro de sus efectos. */
export function crearPuertosSimulados(guion: GuionSimulacion): { puertos: Puertos; registro: RegistroSimulacion } {
  const registro: RegistroSimulacion = {
    etiquetados: [],
    comentarios: [],
    cierres: [],
    avisos: [],
    empujes: [],
    reparaciones: [],
  };
  let revisiones = 0;
  let veredictos = 0;

  const siguienteHallazgo = (): string | null => {
    const respuesta = guion.hallazgos[Math.min(revisiones, guion.hallazgos.length - 1)] ?? null;
    revisiones++;
    return respuesta;
  };
  const siguienteVeredicto = (): { puerta: string; salida: string } | null => {
    const veredicto = guion.rojos[Math.min(veredictos, guion.rojos.length - 1)] ?? null;
    veredictos++;
    return veredicto;
  };

  const puertos: Puertos = {
    frontera: {
      cargarTickets: async () => guion.tickets,
      etiquetar: async (ticket, poner, _quitar) => {
        registro.etiquetados.push({ ticket, etiqueta: poner });
      },
      comentar: async (ticket, texto) => {
        registro.comentarios.push({ ticket, texto });
      },
      cerrar: async (ticket, resumen) => {
        registro.cierres.push({ ticket, resumen });
      },
    },
    sesiones: {
      implementar: async (ticket) => `Implementado: ${ticket.titulo}.`,
      revisar: async (_ticket) => siguienteHallazgo(),
      reparar: async (_ticket: Ticket, _error: ErrorEnMano, reintento) => {
        registro.reparaciones.push(reintento);
      },
    },
    puertas: {
      ejecutar: async () => siguienteVeredicto(),
    },
    avisos: {
      avisar: async (mensaje) => {
        registro.avisos.push(mensaje);
      },
    },
    entrega: {
      empujar: async (ticket) => {
        registro.empujes.push(ticket.numero);
      },
    },
  };
  return { puertos, registro };
}
