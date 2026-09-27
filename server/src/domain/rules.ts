import type { Mentee } from './model.js';

/**
 * Regla de dominio: una mentee está asignada a exactamente un manager a la vez.
 * Lanza si la misma mentee aparece con dos managers distintos (fuente de datos
 * corrupta o traspaso a medio hacer). Ver "Traspaso" en CONTEXT.md.
 */
export function validarUnManagerPorMentee(mentees: Mentee[]): void {
  const managerPorMentee = new Map<string, string>();
  for (const mentee of mentees) {
    const anterior = managerPorMentee.get(mentee.id);
    if (anterior !== undefined && anterior !== mentee.managerId) {
      throw new Error(
        `Mentee ${mentee.id} aparece asignada a dos managers: ${anterior} y ${mentee.managerId}`,
      );
    }
    managerPorMentee.set(mentee.id, mentee.managerId);
  }
}
