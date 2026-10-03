import type { NotaPorTema } from './model.js';

/**
 * Historial de una mentee: feed cronológico unificado construido en consulta
 * (ADR-0007), agregando 1-to-1s, incidencias, objetivos cerrados, entradas y
 * salidas de proyecto y traspasos. No hay tabla de eventos ni doble escritura:
 * cada fuente ya vive en su tabla y aquí solo se proyecta y se ordena.
 *
 * Los eventos guardan una sola `fecha` (no un instante), de modo que no existe
 * orden cronológico cruzado posible entre eventos del mismo día: el desempate es
 * un criterio estable declarado por tipo (prioridad fija en el orden de los
 * filtros de §07) y, dentro del mismo tipo, por id ascendente. Ver "Historial" en
 * CONTEXT.md y docs/adr/0007.
 */

/** Tipo de evento del historial: uno por filtro de §07 (salvo la edición, que llega con #35). */
export type TipoEventoHistorial = '1-to-1' | 'objetivo' | 'incidencia' | 'proyecto' | 'traspaso';

/** Valores admitidos por el filtro `?tipo=` (spec §07 y decisiones.md §URLs). */
export type FiltroHistorial = '1-to-1s' | 'objetivos' | 'incidencias' | 'proyectos' | 'traspasos';

/** Evento del historial proyectado por la agregación (lo que el timeline renderiza). */
export type EventoHistorial =
  | {
      tipo: '1-to-1';
      id: string;
      /** Fecha ISO (YYYY-MM-DD) del 1-to-1. */
      fecha: string;
      /** Nº de temas con nota (notas no vacías), canon de decisiones.md §Lista de 1-to-1s. */
      temasConNota: number;
      /** Todos los acuerdos del 1-to-1 (pendientes y cumplidos). */
      acuerdos: number;
      /** Inicio de nota (spec §07): primera nota no vacía truncada a 80 puntos de
       *  código Unicode; null si no hay notas no vacías. El frontend lo cierra con
       *  «…» entre latinas. */
      inicioNota: string | null;
    }
  | {
      tipo: 'incidencia';
      id: string;
      /** Fecha de apertura (spec §12: la que cuenta en el Historial). */
      fecha: string;
      estado: 'abierta' | 'resuelta';
      descripcion: string;
    }
  | {
      tipo: 'objetivo';
      id: string;
      /** Fecha límite (única fecha del objetivo cerrado; no hay fecha de cierre). */
      fecha: string;
      estado: 'cumplido' | 'no cumplido';
      titulo: string;
    }
  | {
      tipo: 'proyecto';
      id: string;
      fecha: string;
      /** Entrada («Entra en …») o salida («Sale de …»). */
      direccion: 'entrada' | 'salida';
      /** Nombre del proyecto (resuelto por la agregación). */
      proyecto: string;
      motivo: string;
    }
  | {
      tipo: 'traspaso';
      id: string;
      fecha: string;
      /** Nombre del manager de origen (resuelto por la agregación). */
      origen: string;
      /** Nombre del manager de destino (resuelto por la agregación). */
      destino: string;
    };

/**
 * Prioridad estable por tipo en el orden de los filtros de §07 (1-to-1s →
 * Objetivos → Incidencias → Proyectos → Traspasos). Es el desempate de los
 * eventos del mismo día: a igual fecha, manda primero el tipo de menor rango.
 */
const ORDEN_POR_TIPO: Record<TipoEventoHistorial, number> = {
  '1-to-1': 0,
  objetivo: 1,
  incidencia: 2,
  proyecto: 3,
  traspaso: 4,
};

/**
 * Ordena los eventos del historial: fecha descendente; a igual fecha, prioridad
 * fija por tipo (orden de los filtros de §07) y, dentro del mismo tipo, id
 * ascendente. Criterio estable del grill del 3-oct (ADR-0007). Es una función
 * pura y determinista: no muta la lista de entrada.
 */
export function ordenarHistorial<
  T extends { fecha: string; tipo: TipoEventoHistorial; id: string },
>(eventos: T[]): T[] {
  return [...eventos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.tipo !== b.tipo) return ORDEN_POR_TIPO[a.tipo] - ORDEN_POR_TIPO[b.tipo];
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

/** Mapa del valor de filtro `?tipo=` al tipo de evento del historial. */
const FILTRO_A_TIPO: Record<FiltroHistorial, TipoEventoHistorial> = {
  '1-to-1s': '1-to-1',
  objetivos: 'objetivo',
  incidencias: 'incidencia',
  proyectos: 'proyecto',
  traspasos: 'traspaso',
};

/**
 * Todos los filtros válidos de `?tipo=`. Sirve para validar el query param en
 * la ruta: un valor fuera de esta lista se ignora (equivale a «Todo»).
 */
export function esFiltroHistorial(valor: unknown): valor is FiltroHistorial {
  return (
    typeof valor === 'string' &&
    (valor === '1-to-1s' ||
      valor === 'objetivos' ||
      valor === 'incidencias' ||
      valor === 'proyectos' ||
      valor === 'traspasos')
  );
}

/** Tipo de evento correspondiente a un filtro (para filtrar la agregación). */
export function tipoDesdeFiltro(filtro: FiltroHistorial): TipoEventoHistorial {
  return FILTRO_A_TIPO[filtro];
}

/** Nº de temas con nota: notas no vacías (canon de decisiones.md §Lista de 1-to-1s). */
export function contarTemasConNota(notas: NotaPorTema[]): number {
  return notas.reduce((total, n) => total + (n.nota.trim() === '' ? 0 : 1), 0);
}

/** Primera nota no vacía de un 1-to-1 (spec §07 «inicio de nota…»); null si no hay notas. */
export function primeraNotaNoVacia(notas: NotaPorTema[]): string | null {
  for (const n of notas) {
    if (n.nota.trim() !== '') return n.nota;
  }
  return null;
}

/** Longitud máxima del «inicio de nota…» del historial (spec §07: truncado a 80 puntos de código). */
const MAX_INICIO_NOTA = 80;

/**
 * «Inicio de nota…» de un 1-to-1 (spec §07): primera nota no vacía truncada a 80
 * puntos de código Unicode (la misma regla de #24: «carácter» = punto de código,
 * nunca una unidad UTF-16 que parte un par sustituto). El frontend cierra con «…»
 * (««inicio de nota…»»). `null` si no hay notas no vacías. «Primera» sigue el
 * orden de las notas tal como las entrega la agregación (formulario de #19: temas
 * genéricos en el orden de su plantilla y después los propios), de modo que el
 * contrato no depende del orden implícito de SQLite.
 */
export function inicioDeNota(notas: NotaPorTema[]): string | null {
  const nota = primeraNotaNoVacia(notas);
  if (nota === null) return null;
  // `[...nota]` itera por puntos de código (no por unidades UTF-16): cortar y
  // medir así nunca parte un par sustituto en dos mitades inválidas.
  const codepoints = [...nota];
  return codepoints.length > MAX_INICIO_NOTA ? codepoints.slice(0, MAX_INICIO_NOTA).join('') : nota;
}