import type { Manager } from '../domain/model.js';
import type { MenteeRepository, NuevaMentee } from '../domain/ports.js';
import { validarEnEquipoDesde, validarNombreMentee } from '../domain/mentees.js';

/** Alta en el equipo del manager autenticado; nunca hereda otro historial. */
export class MenteeService {
  constructor(private readonly repository: MenteeRepository) {}

  async addMentee(manager: Manager, nueva: NuevaMentee) {
    return this.repository.addMentee(manager.id, {
      ...nueva,
      name: validarNombreMentee(nueva.name),
      enEquipoDesde: validarEnEquipoDesde(nueva.enEquipoDesde),
    });
  }
}
