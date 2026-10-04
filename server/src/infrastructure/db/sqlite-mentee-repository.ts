import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { MenteeRepository, NuevaMentee } from '../../domain/ports.js';
import { MOTIVO_ALTA_EN_EL_EQUIPO } from '../../domain/mentees.js';

/** El alta y sus entradas en proyectos se guardan juntas o no se guarda nada. */
export class SqliteMenteeRepository implements MenteeRepository {
  constructor(private readonly db: Database) {}

  async addMentee(managerId: string, nueva: NuevaMentee) {
    return this.db.transaction(() => {
      const vigente = this.db.prepare('SELECT id FROM projects WHERE id = ? AND fecha_retirada IS NULL');
      const proyectos = [...new Set(nueva.proyectos)];
      for (const id of proyectos) {
        if (vigente.get(id) === undefined) throw new Error('El proyecto no existe o está retirado.');
      }
      const mentee = { id: randomUUID(), managerId, name: nueva.name, enEquipoDesde: nueva.enEquipoDesde };
      this.db.prepare('INSERT INTO mentees (id, manager_id, name, en_equipo_desde) VALUES (?, ?, ?, ?)')
        .run(mentee.id, managerId, mentee.name, mentee.enEquipoDesde);
      const asignar = this.db.prepare(`INSERT INTO asignaciones
        (mentee_id, proyecto_id, desde, motivo_entrada, hasta, motivo_salida)
        VALUES (?, ?, ?, ?, NULL, NULL)`);
      for (const id of proyectos) {
        asignar.run(mentee.id, id, mentee.enEquipoDesde, MOTIVO_ALTA_EN_EL_EQUIPO);
      }
      return mentee;
    })();
  }
}
