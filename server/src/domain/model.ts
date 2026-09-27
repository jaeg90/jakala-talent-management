export type ManagerId = string;

/** Manager autenticado en JTM. Ver glosario en CONTEXT.md. */
export interface Manager {
  id: ManagerId;
  email: string;
  name: string;
}

/** Mentee del equipo de un manager. Existe como dato; no inicia sesión. */
export interface Mentee {
  id: string;
  managerId: ManagerId;
  name: string;
}

/** Proyecto de cliente en el que trabaja una mentee. Catálogo compartido. */
export interface Project {
  id: string;
  name: string;
}

/** Mentee tal y como la ve su manager en "Mi equipo": con su proyecto actual o ninguno. */
export interface MenteeConProyecto {
  id: string;
  name: string;
  project: Project | null;
}
