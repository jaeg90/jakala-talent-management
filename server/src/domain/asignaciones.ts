/**
 * Asignación: paso de una mentee a formar parte de un proyecto (entrada) o a
 * dejarlo (salida). La relación Mentee–Proyecto es muchos a muchos: una mentee
 * puede estar en varios proyectos a la vez o en ninguno. Cada paso es un evento
 * y no existe la semántica de "mover de A a B". Ver "Entrada en proyecto" y
 * "Salida de proyecto" en CONTEXT.md y docs/adr/0008.
 */
export interface Asignacion {
  /** Mentee a la que pertenece la asignación. */
  mentee: string;
  /** Proyecto en el que entra (o del que sale) la mentee. */
  proyecto: string;
  /** Fecha ISO (YYYY-MM-DD) de entrada. */
  desde: string;
  /** Motivo por el que la mentee entra en el proyecto. */
  motivoEntrada: string;
  /** Fecha ISO (YYYY-MM-DD) de salida; null mientras la asignación está vigente. */
  hasta: string | null;
  /** Motivo por el que la mentee sale del proyecto; null mientras está vigente. */
  motivoSalida: string | null;
}

/** Estado de un proyecto en el catálogo: vigente (aparece en selectores) o retirado. */
export type EstadoProyecto = 'vigente' | 'retirado';

/**
 * Proyecto con su estado. ADR-0008: un proyecto está vigente o retirado; el
 * retirado deja de aparecer en los selectores, su historial se conserva y se
 * puede volver a activar. Ver "Proyecto" en CONTEXT.md.
 */
export interface ProyectoConEstado {
  id: string;
  estado: EstadoProyecto;
  /** Fecha ISO (YYYY-MM-DD) del retiro; null (o ausente) mientras está vigente. */
  fechaRetirada?: string | null;
}

/** Evento del historial derivado de una asignación (fuente de la agregación de #20). */
export interface EventoHistorialProyecto {
  /** Entrada en el proyecto o salida de él. */
  tipo: 'entrada' | 'salida';
  proyecto: string;
  fecha: string;
  motivo: string;
}

/**
 * Regla de dominio: las asignaciones vigentes son las que no tienen `hasta`.
 * Es la base del resto de reglas: los proyectos actuales de una mentee y el
 * recuento de mentees por proyecto se calculan sobre las vigentes.
 */
export function asignacionesVigentes(asignaciones: Asignacion[]): Asignacion[] {
  return asignaciones.filter((asignacion) => asignacion.hasta === null);
}

/**
 * Las asignaciones sin `hasta` de un proyecto concreto, sin distinguir mentee.
 * Sirve tanto a la regla por mentee (entrar) como a la regla por proyecto
 * (retirar): ambas miran "quién está vigente hoy en este proyecto", cada una
 * en su plano.
 */
function asignacionesVigentesDeProyecto(asignaciones: Asignacion[], proyecto: string): Asignacion[] {
  return asignacionesVigentes(asignaciones).filter(
    (asignacion) => asignacion.proyecto === proyecto,
  );
}

/**
 * Regla de dominio: los proyectos actuales de una mentee son los de sus
 * asignaciones vigentes (sin `hasta`). La pertenencia es por mentee: las
 * asignaciones de otras mentees no cuentan. Sin asignaciones vigentes la lista
 * está vacía (la mentee queda «Sin proyecto»).
 */
export function proyectosActualesDe(asignaciones: Asignacion[], mentee: string): string[] {
  return asignacionesVigentes(asignaciones)
    .filter((asignacion) => asignacion.mentee === mentee)
    .map((asignacion) => asignacion.proyecto);
}

/**
 * Regla de dominio: no se puede entrar dos veces al mismo proyecto sin salir
 * antes. La regla es por mentee: solo bloquea si es la misma mentee quien ya
 * tiene una asignación vigente a ese proyecto; que otra mentee esté en el
 * proyecto no impide la entrada.
 */
export function validarSinAsignacionVigente(
  asignaciones: Asignacion[],
  mentee: string,
  proyecto: string,
): void {
  const repetida = asignacionesVigentesDeProyecto(asignaciones, proyecto).some(
    (asignacion) => asignacion.mentee === mentee,
  );
  if (repetida) {
    throw new Error(`La mentee ya está en el proyecto ${proyecto}`);
  }
}

/**
 * Crea la entrada de una mentee en un proyecto. Regla de dominio: no se puede
 * entrar dos veces al mismo proyecto sin salir antes (lanza si ya hay una
 * asignación vigente de la misma mentee). La entrada nace vigente: sin `hasta`
 * ni `motivoSalida`.
 */
export function crearEntradaEnProyecto(
  mentee: string,
  proyecto: string,
  desde: string,
  motivoEntrada: string,
  asignaciones: Asignacion[],
): Asignacion {
  validarSinAsignacionVigente(asignaciones, mentee, proyecto);
  return { mentee, proyecto, desde, motivoEntrada, hasta: null, motivoSalida: null };
}

/**
 * Registra la salida de una mentee de un proyecto. Regla de dominio: la fecha
 * de salida no puede ser anterior a la de entrada. Se puede salir del último
 * proyecto: quedan cero asignaciones vigentes y la mentee queda «Sin proyecto».
 */
export function salirDeProyecto(
  asignacion: Asignacion,
  hasta: string,
  motivoSalida: string,
): Asignacion {
  if (hasta < asignacion.desde) {
    throw new Error('La fecha de salida no puede ser anterior a la fecha de entrada');
  }
  return { ...asignacion, hasta, motivoSalida };
}

/**
 * Regla de dominio: un proyecto solo se retira si no tiene asignaciones
 * vigentes (ninguna mentee está hoy en él). El plano es por proyecto, no por
 * mentee: cualquier asignación vigente, de quien sea, impide el retiro.
 */
export function validarRetirarProyecto(asignaciones: Asignacion[], proyecto: string): void {
  if (asignacionesVigentesDeProyecto(asignaciones, proyecto).length > 0) {
    throw new Error('No se puede retirar un proyecto con asignaciones vigentes');
  }
}

/**
 * Retira un proyecto vigente. Regla de dominio: solo se retira un proyecto
 * vigente; retirado deja de aparecer en selectores (su historial se conserva).
 */
export function retirarProyecto(proyecto: ProyectoConEstado): ProyectoConEstado {
  if (proyecto.estado !== 'vigente') {
    throw new Error('Solo se puede retirar un proyecto vigente');
  }
  return { ...proyecto, estado: 'retirado' };
}

/**
 * Vuelve a activar un proyecto retirado. Regla de dominio: un proyecto retirado
 * es reactivable; lanza si ya está vigente.
 */
export function reactivarProyecto(proyecto: ProyectoConEstado): ProyectoConEstado {
  if (proyecto.estado !== 'retirado') {
    throw new Error('Solo se puede reactivar un proyecto retirado');
  }
  return { ...proyecto, estado: 'vigente' };
}

/** Regla de dominio: la fecha de una asignación, una vez recortada, no puede estar vacía. */
export function validarFechaAsignacion(fecha: string): string {
  const f = fecha.trim();
  if (f === '') throw new Error('La fecha no puede estar vacía');
  return f;
}

/** Regla de dominio: el motivo de una asignación, una vez recortado, no puede estar vacío. */
export function validarMotivoAsignacion(motivo: string): string {
  const m = motivo.trim();
  if (m === '') throw new Error('El motivo no puede estar vacío');
  return m;
}

/**
 * Proyección de las asignaciones a los eventos del historial (ADR-0007/#20): cada
 * asignación aporta su entrada («Entra en {proyecto}») y, si está cerrada, su
 * salida («Sale de {proyecto}»). Es una función pura, sin orden ni fusión de
 * fuentes: #20 decide el orden de su agregación. Ver "Historial" en CONTEXT.md.
 */
export function eventosDeAsignaciones(asignaciones: Asignacion[]): EventoHistorialProyecto[] {
  const eventos: EventoHistorialProyecto[] = [];
  for (const asignacion of asignaciones) {
    eventos.push({
      tipo: 'entrada',
      proyecto: asignacion.proyecto,
      fecha: asignacion.desde,
      motivo: asignacion.motivoEntrada,
    });
    if (asignacion.hasta !== null) {
      eventos.push({
        tipo: 'salida',
        proyecto: asignacion.proyecto,
        fecha: asignacion.hasta,
        motivo: asignacion.motivoSalida ?? '',
      });
    }
  }
  return eventos;
}