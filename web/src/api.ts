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
};
