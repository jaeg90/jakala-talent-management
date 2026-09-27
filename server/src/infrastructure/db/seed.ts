import type { Database } from 'better-sqlite3';
import { hashPassword } from '../auth/passwords.js';

/** Manager semilla del TFM: credenciales ficticias documentadas en el README. */
export const SEED_MANAGER = {
  id: 'seed-manager-1',
  email: 'manager@jakala.example',
  name: 'Marta Manager',
  password: 'secreta123',
};

/** Inserta el manager semilla si la tabla está vacía. */
export function seed(db: Database): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM managers').get() as { n: number };
  if (count.n > 0) return;
  db.prepare('INSERT INTO managers (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run(
    SEED_MANAGER.id,
    SEED_MANAGER.email,
    SEED_MANAGER.name,
    hashPassword(SEED_MANAGER.password),
  );
}
