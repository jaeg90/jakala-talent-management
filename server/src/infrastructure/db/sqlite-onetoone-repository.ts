import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Acuerdo, ManagerId, OneToOne } from '../../domain/model.js';
import type { NuevoOneToOne, OneToOneRepository } from '../../domain/ports.js';
import { crearAcuerdoPendiente } from '../../domain/agreements.js';

interface OneToOneRow {
  id: string;
  mentee_id: string;
  date: string;
}

interface NotaRow {
  tema: string;
  nota: string;
}

interface AcuerdoRow {
  id: string;
  text: string;
  date: string;
  done: number;
}

/**
 * Adaptador SQLite del puerto de 1-to-1s. Todas las consultas cruzan por
 * mentees.manager_id para garantizar el aislamiento por manager.
 */
export class SqliteOneToOneRepository implements OneToOneRepository {
  constructor(private readonly db: Database) {}

  private menteeOf(managerId: ManagerId, menteeId: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM mentees WHERE id = ? AND manager_id = ?')
      .get(menteeId, managerId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  async historyOf(managerId: ManagerId, menteeId: string): Promise<OneToOne[]> {
    if (this.menteeOf(managerId, menteeId) === null) return [];
    const rows = this.db
      .prepare('SELECT id, mentee_id, date FROM onetoones WHERE mentee_id = ? ORDER BY date, id')
      .all(menteeId) as OneToOneRow[];
    return rows.map((row) => this.hydrate(row));
  }

  async save(managerId: ManagerId, nuevo: NuevoOneToOne): Promise<OneToOne> {
    if (this.menteeOf(managerId, nuevo.menteeId) === null) {
      throw new Error(`Mentee ${nuevo.menteeId} no pertenece al manager`);
    }
    const id = randomUUID();
    const insertOneToOne = this.db.prepare(
      'INSERT INTO onetoones (id, mentee_id, date) VALUES (?, ?, ?)',
    );
    const insertNota = this.db.prepare(
      'INSERT INTO notas_por_tema (onetoone_id, tema, nota) VALUES (?, ?, ?)',
    );
    const insertAcuerdo = this.db.prepare(
      'INSERT INTO acuerdos (id, onetoone_id, text, date, done) VALUES (?, ?, ?, ?, ?)',
    );

    this.db.transaction(() => {
      insertOneToOne.run(id, nuevo.menteeId, nuevo.date);
      for (const { tema, nota } of nuevo.notas) {
        insertNota.run(id, tema, nota);
      }
      for (const { text } of nuevo.acuerdos) {
        const pendiente = crearAcuerdoPendiente(text, nuevo.date);
        insertAcuerdo.run(randomUUID(), id, pendiente.text, pendiente.date, 0);
      }
    })();

    return this.hydrate({ id, mentee_id: nuevo.menteeId, date: nuevo.date });
  }

  async pendingAgreementsOf(managerId: ManagerId, menteeId: string): Promise<Acuerdo[]> {
    if (this.menteeOf(managerId, menteeId) === null) return [];
    const rows = this.db
      .prepare(
        `SELECT a.id, a.text, a.date, a.done
         FROM acuerdos a
         JOIN onetoones o ON o.id = a.onetoone_id
         WHERE o.mentee_id = ? AND a.done = 0
         ORDER BY a.date`,
      )
      .all(menteeId) as AcuerdoRow[];
    return rows.map((row) => ({ id: row.id, text: row.text, date: row.date, done: false }));
  }

  async completeAgreement(managerId: ManagerId, acuerdoId: string): Promise<boolean> {
    const row = this.db
      .prepare(
        `SELECT a.id
         FROM acuerdos a
         JOIN onetoones o ON o.id = a.onetoone_id
         JOIN mentees m ON m.id = o.mentee_id
         WHERE a.id = ? AND m.manager_id = ?`,
      )
      .get(acuerdoId, managerId) as { id: string } | undefined;
    if (row === undefined) return false;
    this.db.prepare('UPDATE acuerdos SET done = 1 WHERE id = ?').run(acuerdoId);
    return true;
  }

  private hydrate(row: OneToOneRow): OneToOne {
    const notas = this.db
      .prepare('SELECT tema, nota FROM notas_por_tema WHERE onetoone_id = ? ORDER BY rowid')
      .all(row.id) as NotaRow[];
    const acuerdos = this.db
      .prepare('SELECT id, text, date, done FROM acuerdos WHERE onetoone_id = ? ORDER BY rowid')
      .all(row.id) as AcuerdoRow[];
    return {
      id: row.id,
      menteeId: row.mentee_id,
      date: row.date,
      notas: notas.map((n) => ({ tema: n.tema, nota: n.nota })),
      acuerdos: acuerdos.map((a) => ({
        id: a.id,
        text: a.text,
        date: a.date,
        done: a.done === 1,
      })),
    };
  }
}
