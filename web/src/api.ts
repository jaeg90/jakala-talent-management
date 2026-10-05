/** Cliente HTTP de la API de JTM. Lanza Error con el mensaje del servidor. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Error de red');
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Manager {
  id: string;
  email: string;
  name: string;
}

export interface ManagerCenso extends Manager {
  numMentees: number;
}

/**
 * Manager autenticado: el que devuelven `POST /api/login` y `GET /api/session`.
 * Añade el flag de contraseña temporal (ver "Contraseña temporal" en CONTEXT.md),
 * que viaja con la sesión pero no se expone en el catálogo (`api.managers()`).
 */
export interface ManagerAutenticado extends Manager {
  debeCambiarContraseña: boolean;
}

export interface Project {
  id: string;
  name: string;
}

/** GET /api/proyectos incluye también los retirados (contrato de #39). */
export interface ProyectoCatalogo extends Project {
  fechaRetirada: string | null;
  numMentees: number;
}

export interface Mentee {
  id: string;
  name: string;
  enEquipoDesde: string | null;
  /** Nombres de los proyectos vigentes de la mentee, en orden alfabético. */
  proyectos: string[];
  acuerdosPendientes: number;
  incidenciasAbiertas: number;
  objetivosEnCurso: number;
  /** Fecha ISO (YYYY-MM-DD) del último 1-to-1; null si no hay ninguno. */
  ultimoUnoAUno: string | null;
  /** Señal de dominio «Necesita atención»: incidencia abierta o último 1-to-1 > 14 días. */
  necesitaAtencion: boolean;
  /** Veredicto del badge de antigüedad: el último 1-to-1 tiene más de 14 días. */
  badgeAntiguedad: boolean;
}

export interface TemaPropio {
  id: string;
  menteeId: string;
  tema: string;
  /** Fecha ISO (YYYY-MM-DD) del alta. */
  desde: string;
  estado: 'vigente' | 'retirado';
  /** Fecha ISO (YYYY-MM-DD) del retiro; null mientras está vigente. */
  retiradoEl: string | null;
}

export type EstadoObjetivo = 'en curso' | 'cumplido' | 'no cumplido';

export interface Objetivo {
  id: string;
  menteeId: string;
  titulo: string;
  descripcion: string;
  fechaLimite: string;
  estado: EstadoObjetivo;
}

export interface ObjetivoFields {
  titulo: string;
  descripcion: string;
  fechaLimite: string;
}

export type EstadoIncidencia = 'abierta' | 'resuelta';

export interface Incidencia {
  id: string;
  menteeId: string;
  descripcion: string;
  estado: EstadoIncidencia;
  notaResolucion: string;
  /** Fecha ISO (YYYY-MM-DD) de apertura (elegida por el manager, ≤ hoy). */
  fechaAlta: string;
  fechaResolucion: string | null;
}

export interface IncidenciaConMentee extends Incidencia {
  menteeName: string;
}

/** Proyecto vigente de una mentee con la fecha de entrada (Resumen · «Proyectos actuales»). */
export interface ProyectoActual {
  id: string;
  name: string;
  desde: string;
}

/** Respuesta de los POST de entrada y salida de proyecto (#39). */
export interface Asignacion {
  mentee: string;
  proyecto: string;
  desde: string;
  motivoEntrada: string;
  hasta: string | null;
  motivoSalida: string | null;
}

export interface Traspaso {
  id: string;
  menteeId: string;
  origenId: string;
  destinoId: string;
  fecha: string;
  motivo: string;
}

export type EstadoTemaPlantilla = 'vigente' | 'retirado';

export interface TemaPlantilla {
  id: string;
  managerId: string;
  tema: string;
  orden: number;
  estado: EstadoTemaPlantilla;
}

/** Valores de filtro del historial (`?tipo=`), spec §07. */
export type FiltroHistorial = '1-to-1s' | 'objetivos' | 'incidencias' | 'proyectos' | 'traspasos';

/** Evento del historial proyectado por la agregación (GET /api/mentees/:id/historial). */
export type EventoHistorial =
  | {
      tipo: '1-to-1';
      id: string;
      fecha: string;
      temasConNota: number;
      acuerdos: number;
      inicioNota: string | null;
    }
  | { tipo: 'incidencia'; id: string; fecha: string; estado: 'abierta' | 'resuelta'; descripcion: string }
  | { tipo: 'objetivo'; id: string; fecha: string; estado: 'cumplido' | 'no cumplido'; titulo: string }
  | {
      tipo: 'proyecto';
      id: string;
      fecha: string;
      direccion: 'entrada' | 'salida';
      proyecto: string;
      motivo: string;
    }
  | { tipo: 'traspaso'; id: string; fecha: string; origen: string; destino: string };

export const api = {
  crearManager(name: string, email: string): Promise<{ manager: ManagerCenso; contrasenaTemporal: string }> {
    return request('/api/managers', { method: 'POST', body: JSON.stringify({ name, email }) });
  },
  login(email: string, password: string): Promise<{ manager: ManagerAutenticado }> {
    return request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },
  logout(): Promise<void> {
    return request('/api/logout', { method: 'POST' });
  },
  session(): Promise<{ manager: ManagerAutenticado }> {
    return request('/api/session');
  },
  cambiarContrasena(actual: string, nueva: string): Promise<{ manager: ManagerAutenticado }> {
    return request('/api/cuenta/contrasena', {
      method: 'POST',
      body: JSON.stringify({ actual, nueva }),
    });
  },
  team(): Promise<{ mentees: Mentee[] }> {
    return request('/api/team');
  },
  addMentee(body: { name: string; proyectos: string[]; enEquipoDesde: string }): Promise<{ id: string; name: string; enEquipoDesde: string }> {
    return request('/api/mentees', { method: 'POST', body: JSON.stringify(body) });
  },
  ficha(menteeId: string): Promise<{ history: OneToOne[]; pending: AcuerdoView[] }> {
    return request(`/api/mentees/${menteeId}/onetoones`);
  },
  /**
   * Un 1-to-1 concreto por id (spec §11). Devuelve null si no existe o no es de
   * la mentee (404); cualquier otro fallo es un error de carga.
   */
  oneToOne(menteeId: string, unoAUnoId: string): Promise<OneToOne | null> {
    return fetch(`/api/mentees/${menteeId}/onetoones/${unoAUnoId}`, {
      headers: { 'content-type': 'application/json' },
    }).then((res) => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Error de red');
      return res.json() as Promise<OneToOne>;
    });
  },
  saveOneToOne(
    menteeId: string,
    body: { date: string; notas: { tema: string; nota: string; propio: boolean }[]; acuerdos: { text: string }[] },
  ): Promise<OneToOne> {
    return request(`/api/mentees/${menteeId}/onetoones`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  completeAgreement(acuerdoId: string): Promise<void> {
    return request(`/api/acuerdos/${acuerdoId}/complete`, { method: 'POST' });
  },
  temasPropios(menteeId: string): Promise<{ temas: TemaPropio[] }> {
    return request(`/api/mentees/${menteeId}/temas`);
  },
  addTemaPropio(menteeId: string, tema: string): Promise<TemaPropio> {
    return request(`/api/mentees/${menteeId}/temas`, {
      method: 'POST',
      body: JSON.stringify({ tema }),
    });
  },
  retirarTemaPropio(menteeId: string, temaPropioId: string): Promise<void> {
    return request(`/api/mentees/${menteeId}/temas/${temaPropioId}/retirar`, { method: 'POST' });
  },
  objetivos(menteeId: string): Promise<{ objetivos: Objetivo[] }> {
    return request(`/api/mentees/${menteeId}/objetivos`);
  },
  addObjetivo(menteeId: string, fields: ObjetivoFields): Promise<Objetivo> {
    return request(`/api/mentees/${menteeId}/objetivos`, {
      method: 'POST',
      body: JSON.stringify(fields),
    });
  },
  updateObjetivo(objetivoId: string, fields: ObjetivoFields): Promise<Objetivo> {
    return request(`/api/objetivos/${objetivoId}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
  },
  cambiarEstadoObjetivo(objetivoId: string, estado: 'cumplido' | 'no cumplido'): Promise<Objetivo> {
    return request(`/api/objetivos/${objetivoId}/estado`, {
      method: 'POST',
      body: JSON.stringify({ estado }),
    });
  },
  incidenciasAbiertas(): Promise<{ incidencias: IncidenciaConMentee[] }> {
    return request('/api/incidencias');
  },
  incidenciasDe(menteeId: string): Promise<{ incidencias: Incidencia[] }> {
    return request(`/api/mentees/${menteeId}/incidencias`);
  },
  addIncidencia(menteeId: string, descripcion: string, fechaApertura: string): Promise<Incidencia> {
    return request(`/api/mentees/${menteeId}/incidencias`, {
      method: 'POST',
      body: JSON.stringify({ descripcion, fechaApertura }),
    });
  },
  resolverIncidencia(incidenciaId: string, nota: string): Promise<Incidencia> {
    return request(`/api/incidencias/${incidenciaId}/resolver`, {
      method: 'POST',
      body: JSON.stringify({ nota }),
    });
  },
  proyectos(): Promise<{ proyectos: ProyectoCatalogo[] }> {
    return request('/api/proyectos');
  },
  addProyecto(name: string): Promise<Project> {
    return request('/api/proyectos', { method: 'POST', body: JSON.stringify({ name }) });
  },
  retirarProyecto(id: string): Promise<{ fechaRetirada: string }> {
    return request(`/api/proyectos/${id}/retirar`, { method: 'POST' });
  },
  reactivarProyecto(id: string): Promise<{ fechaRetirada: null }> {
    return request(`/api/proyectos/${id}/reactivar`, { method: 'POST' });
  },
  proyectosActuales(menteeId: string): Promise<{ proyectos: ProyectoActual[] }> {
    return request(`/api/mentees/${menteeId}/proyectos`);
  },
  entrarEnProyecto(
    menteeId: string,
    body: { proyecto: string; desde: string; motivoEntrada: string },
  ): Promise<Asignacion> {
    return request(`/api/mentees/${menteeId}/proyectos`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  salirDeProyecto(
    menteeId: string,
    proyectoId: string,
    body: { hasta: string; motivoSalida: string },
  ): Promise<Asignacion> {
    return request(`/api/mentees/${menteeId}/proyectos/${proyectoId}/salir`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  managers(): Promise<{ managers: ManagerCenso[] }> {
    return request('/api/managers');
  },
  traspasar(menteeId: string, body: { fecha: string; destinoId: string; motivo: string }): Promise<Traspaso> {
    return request(`/api/mentees/${menteeId}/traspasos`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  plantilla(): Promise<{ temas: TemaPlantilla[] }> {
    return request('/api/plantilla');
  },
  /** Añade un tema genérico al final de la plantilla (201 con el tema creado). */
  addTemaPlantilla(tema: string): Promise<TemaPlantilla> {
    return request('/api/plantilla/temas', { method: 'POST', body: JSON.stringify({ tema }) });
  },
  /** Edita el texto de un tema de la plantilla. */
  editarTemaPlantilla(temaId: string, tema: string): Promise<TemaPlantilla> {
    return request(`/api/plantilla/temas/${temaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ tema }),
    });
  },
  /** Sube (delta -1) o baja (delta 1) un tema vigente una posición. */
  moverTemaPlantilla(temaId: string, delta: -1 | 1): Promise<{ temas: TemaPlantilla[] }> {
    return request(`/api/plantilla/temas/${temaId}/mover`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    });
  },
  /** Retira un tema (no se puede retirar el último vigente: 409 del dominio). */
  retirarTemaPlantilla(temaId: string): Promise<TemaPlantilla> {
    return request(`/api/plantilla/temas/${temaId}/retirar`, { method: 'POST' });
  },
  /** Vuelve a activar un tema retirado, al final de los vigentes. */
  reactivarTemaPlantilla(temaId: string): Promise<TemaPlantilla> {
    return request(`/api/plantilla/temas/${temaId}/reactivar`, { method: 'POST' });
  },
  /** Restablece la plantilla a sus temas iniciales (los actuales pasan a retirados). */
  restablecerPlantilla(): Promise<{ temas: TemaPlantilla[] }> {
    return request('/api/plantilla/restablecer', { method: 'POST' });
  },
  historial(menteeId: string, tipo?: FiltroHistorial): Promise<{ eventos: EventoHistorial[] }> {
    const query = tipo === undefined ? '' : `?tipo=${tipo}`;
    return request(`/api/mentees/${menteeId}/historial${query}`);
  },
};

export interface NotaPorTema {
  tema: string;
  nota: string;
  /** Si el tema era propio al registrar el 1-to-1 (spec §11a: el chip se
   *  persiste, no se deduce de los temas propios actuales). */
  propio: boolean;
}

export interface AcuerdoView {
  id: string;
  text: string;
  date: string;
}

/** Acuerdo tal y como vive en un 1-to-1 registrado: pendiente o cumplido, con la
 *  fecha de cumplimiento (spec §11a «Cumplido · {fecha}»). */
export interface AcuerdoDetalle extends AcuerdoView {
  done: boolean;
  /** Fecha ISO (YYYY-MM-DD) del cumplimiento; null mientras esté pendiente. */
  cumplidoEl: string | null;
}

export interface OneToOne {
  id: string;
  date: string;
  notas: NotaPorTema[];
  acuerdos: AcuerdoDetalle[];
  /** Manager que lo registró; base del plazo de edición de 7 días (ADR-0009). */
  registradoPor: string;
  /** Timestamp (ISO 8601) del registro; base del plazo de edición de 7 días (ADR-0009). */
  registradoEn: string;
}
