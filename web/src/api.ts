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

export interface Project {
  id: string;
  name: string;
}

export interface Mentee {
  id: string;
  name: string;
  project: Project | null;
}

export interface TemaPropio {
  id: string;
  menteeId: string;
  tema: string;
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
  fechaAlta: string;
  fechaResolucion: string | null;
}

export interface IncidenciaConMentee extends Incidencia {
  menteeName: string;
}

export const api = {
  login(email: string, password: string): Promise<{ manager: Manager }> {
    return request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },
  logout(): Promise<void> {
    return request('/api/logout', { method: 'POST' });
  },
  session(): Promise<{ manager: Manager }> {
    return request('/api/session');
  },
  team(): Promise<{ mentees: Mentee[] }> {
    return request('/api/team');
  },
  ficha(menteeId: string): Promise<{ history: OneToOne[]; pending: AcuerdoView[] }> {
    return request(`/api/mentees/${menteeId}/onetoones`);
  },
  saveOneToOne(
    menteeId: string,
    body: { date: string; notas: { tema: string; nota: string }[]; acuerdos: { text: string }[] },
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
  removeTemaPropio(menteeId: string, temaPropioId: string): Promise<void> {
    return request(`/api/mentees/${menteeId}/temas/${temaPropioId}`, { method: 'DELETE' });
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
  addIncidencia(menteeId: string, descripcion: string): Promise<Incidencia> {
    return request(`/api/mentees/${menteeId}/incidencias`, {
      method: 'POST',
      body: JSON.stringify({ descripcion }),
    });
  },
  resolverIncidencia(incidenciaId: string, nota: string): Promise<Incidencia> {
    return request(`/api/incidencias/${incidenciaId}/resolver`, {
      method: 'POST',
      body: JSON.stringify({ nota }),
    });
  },
};

/** Temas genéricos de plantilla (espejo del dominio). */
export const TEMAS_GENERICOS = ['¿Cómo estás?', '¿Qué tal el proyecto?', '¿Qué tal los objetivos?'];

export interface NotaPorTema {
  tema: string;
  nota: string;
}

export interface AcuerdoView {
  id: string;
  text: string;
  date: string;
}

export interface OneToOne {
  id: string;
  date: string;
  notas: NotaPorTema[];
  acuerdos: (AcuerdoView & { done: boolean })[];
}
