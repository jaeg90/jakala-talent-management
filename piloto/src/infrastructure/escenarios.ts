import type { Ticket } from '../domain/model.js';
import type { GuionSimulacion } from './simulacion.js';

/**
 * Escenarios de simulación (ADR-0004): guiones prefabricados para
 * `npm run piloto -- --simular[=<escenario>]`. Sin gh, sin sesiones, sin
 * arnés: cada escenario ensaya un desenlace distinto del loop.
 */

/** La frontera de esta mañana (la del prototipo): #3 cerrado; #4–#8 en lista, con sus bloqueos. */
export const TICKETS_DEMO: Ticket[] = [
  { numero: 3, titulo: 'Ticket 2: Mi equipo', cuerpo: '', estado: 'cerrado', bloqueadoPor: [], tipo: null },
  { numero: 4, titulo: 'Ticket 3: Ficha de mentee y 1-to-1s', cuerpo: 'Spec del ticket 3.', estado: 'lista', bloqueadoPor: [], tipo: 'pantalla' },
  { numero: 5, titulo: 'Ticket 4: Temas propios', cuerpo: 'Spec del ticket 4.', estado: 'lista', bloqueadoPor: [4], tipo: 'pantalla' },
  { numero: 6, titulo: 'Ticket 5: Objetivos anuales', cuerpo: 'Spec del ticket 5.', estado: 'lista', bloqueadoPor: [4], tipo: 'pantalla' },
  { numero: 7, titulo: 'Ticket 6: Incidencias', cuerpo: 'Spec del ticket 6.', estado: 'lista', bloqueadoPor: [4], tipo: 'pantalla' },
  { numero: 8, titulo: 'Ticket 7: Catálogo de proyectos', cuerpo: 'Spec del ticket 7.', estado: 'lista', bloqueadoPor: [3], tipo: 'pantalla' },
];

/** Un escenario de simulación: nombre legible y guión que lo produce. */
export type NombreEscenario =
  | 'feliz'
  | 'reparacion'
  | 'puerta-roja'
  | 'escalado'
  | 'devolucion-revisora'
  | 'devolucion-implementadora';

/** Los guiones prefabricados, cada uno con su descripción. */
export const ESCENARIOS: Record<NombreEscenario, { descripcion: string; guion: GuionSimulacion }> = {
  feliz: {
    descripcion:
      'Todo en verde: la revisora no encuentra nada y las puertas pasan; la pasada cierra la frontera entera.',
    guion: { tickets: TICKETS_DEMO, hallazgos: [null], rojos: [null] },
  },
  reparacion: {
    descripcion:
      'La revisora encuentra un hallazgo en el primer ticket; la reparadora lo arregla y el ticket vuelve a revisión hasta el verde.',
    guion: {
      tickets: TICKETS_DEMO,
      hallazgos: [
        'CRITERIO 2: HALLAZGO — el botón Guardar no se deshabilita mientras se envía el formulario.',
        null,
      ],
      rojos: [null],
    },
  },
  'puerta-roja': {
    descripcion:
      'La revisora da el OK pero una puerta del arnés falla: solo las puertas firman verde, así que entra la reparadora.',
    guion: {
      tickets: TICKETS_DEMO,
      hallazgos: [null],
      rojos: [
        { puerta: 'e2e', salida: '1 failed — e2e/mi-equipo.spec.ts › el panel de atención ordena por quién me necesita' },
        null,
      ],
    },
  },
  escalado: {
    descripcion:
      'El hallazgo se repite en cada ronda: se agotan los reintentos, el ticket se escala al humano y la pasada se detiene.',
    guion: {
      tickets: TICKETS_DEMO,
      hallazgos: ['CRITERIO 3: HALLAZGO — la lista vacía no muestra el estado vacío que pide la spec.'],
      rojos: [null],
    },
  },
  'devolucion-revisora': {
    descripcion:
      'La revisora encuentra una ambigüedad en la spec: el ticket vuelve al humano (needs-grill) sin consumir reintentos.',
    guion: {
      tickets: TICKETS_DEMO,
      hallazgos: [null],
      dudas: [['¿«tarjeta 420px» es el ancho total o el ancho de contenido?']],
      rojos: [null],
    },
  },
  'devolucion-implementadora': {
    descripcion:
      'La implementadora detecta la ambigüedad antes de construir y devuelve el ticket sin gastar revisión ni reintentos.',
    guion: {
      tickets: TICKETS_DEMO,
      hallazgos: [null],
      devoluciones: ['¿El alta de la mentee notifica por email o solo con un aviso en la app?'],
      rojos: [null],
    },
  },
};

/** El modo en que arranca el Piloto según los argumentos de la línea de comandos. */
export type Modo =
  | { tipo: 'real' }
  | { tipo: 'simulado'; nombre: NombreEscenario }
  | { tipo: 'error'; mensaje: string };

/** Elige el modo a partir de los argumentos: real, simulado con escenario, o error con la lista. */
export function elegirModo(argv: readonly string[]): Modo {
  const argumento = argv.find((a) => a.startsWith('--simular'));
  if (argumento === undefined) return { tipo: 'real' };
  if (argumento === '--simular') return { tipo: 'simulado', nombre: 'feliz' };
  const nombre = argumento.slice('--simular='.length) as NombreEscenario;
  if (!(nombre in ESCENARIOS)) {
    const disponibles = Object.entries(ESCENARIOS)
      .map(([n, { descripcion }]) => `  ${n} — ${descripcion}`)
      .join('\n');
    return {
      tipo: 'error',
      mensaje: `Escenario desconocido: «${nombre}». Escenarios disponibles:\n${disponibles}`,
    };
  }
  return { tipo: 'simulado', nombre };
}