import Database from 'better-sqlite3';
import { fechaHaceDias } from '../../domain/fechas.js';

/** Abre la base de datos SQLite y crea el esquema si no existe. */
export function openDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS managers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      debe_cambiar_contrasena INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      fecha_retirada TEXT
    );
    CREATE TABLE IF NOT EXISTS mentees (
      id TEXT PRIMARY KEY,
      manager_id TEXT NOT NULL REFERENCES managers(id),
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS asignaciones (
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      proyecto_id TEXT NOT NULL REFERENCES projects(id),
      desde TEXT NOT NULL,
      motivo_entrada TEXT NOT NULL,
      hasta TEXT,
      motivo_salida TEXT
    );
    CREATE TABLE IF NOT EXISTS onetoones (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      date TEXT NOT NULL,
      registrado_por TEXT NOT NULL REFERENCES managers(id),
      registrado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notas_por_tema (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      onetoone_id TEXT NOT NULL REFERENCES onetoones(id),
      tema TEXT NOT NULL,
      nota TEXT NOT NULL,
      propio INTEGER NOT NULL DEFAULT 0,
      UNIQUE (onetoone_id, tema)
    );
    CREATE TABLE IF NOT EXISTS acuerdos (
      id TEXT PRIMARY KEY,
      onetoone_id TEXT NOT NULL REFERENCES onetoones(id),
      text TEXT NOT NULL,
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS temas_propios (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      tema TEXT NOT NULL,
      desde TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'vigente',
      retirado_el TEXT,
      UNIQUE (mentee_id, tema)
    );
    CREATE TABLE IF NOT EXISTS plantilla (
      id TEXT PRIMARY KEY,
      manager_id TEXT NOT NULL REFERENCES managers(id),
      tema TEXT NOT NULL,
      orden INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'vigente',
      UNIQUE (manager_id, tema)
    );
    CREATE TABLE IF NOT EXISTS objetivos (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      fecha_limite TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'en curso'
    );
    CREATE TABLE IF NOT EXISTS incidencias (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      descripcion TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'abierta',
      nota_resolucion TEXT NOT NULL DEFAULT '',
      fecha_alta TEXT NOT NULL,
      fecha_resolucion TEXT
    );
    CREATE TABLE IF NOT EXISTS cambios_proyecto (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      fecha TEXT NOT NULL,
      origen_id TEXT REFERENCES projects(id),
      destino_id TEXT REFERENCES projects(id),
      motivo TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS traspasos (
      id TEXT PRIMARY KEY,
      mentee_id TEXT NOT NULL REFERENCES mentees(id),
      origen_id TEXT NOT NULL REFERENCES managers(id),
      destino_id TEXT NOT NULL REFERENCES managers(id),
      fecha TEXT NOT NULL,
      motivo TEXT NOT NULL
    );
  `);
  migrarOnetoones(db);
  migrarTemasPropios(db);
  migrarEnEquipoDesde(db);
  migrarAcuerdos(db);
  migrarNotasPropio(db);
  return db;
}

/** Migración única (#26): fecha más antigua de asignación o el alta ficticia de
 * la semilla (hoy − 90). La columna nullable permite el caso defensivo, pero no
 * se vuelve a rellenar en arranques posteriores. */
function migrarEnEquipoDesde(db: Database.Database): void {
  const columnas = db.prepare('PRAGMA table_info(mentees)').all() as { name: string }[];
  if (columnas.some((c) => c.name === 'en_equipo_desde')) return;
  db.transaction(() => {
    db.exec('ALTER TABLE mentees ADD COLUMN en_equipo_desde TEXT');
    db.prepare(`UPDATE mentees SET en_equipo_desde = COALESCE(
      (SELECT MIN(desde) FROM asignaciones WHERE mentee_id = mentees.id), ?
    )`).run(fechaHaceDias(90));
  })();
}

/**
 * Migración de la tabla `onetoones` a ADR-0009 (Cambios de dominio 7): los
 * 1-to-1s se identifican por id y registran `registrado_por`/`registrado_en`.
 * Una base creada antes de este cambio ya tiene la tabla (el `CREATE TABLE IF
 * NOT EXISTS` no le añade las columnas), así que se amplía con `ALTER TABLE` y se
 * rellena con el autor y un timestamp de respaldo.
 *
 * Autoría histórica: el historial pertenece a la mentee y se hereda completo
 * (CONTEXT.md «Historial»), así que un 1-to-1 se atribuye a quien gestionaba a la
 * mentee en su fecha — reconstruido desde la cronología de traspasos —, no al
 * `manager_id` actual, que tras un traspaso podría no haberlo registrado
 * (contrato de autoría de ADR-0009). Sin traspasos registrados, el manager actual
 * es la única referencia disponible.
 */
function migrarOnetoones(db: Database.Database): void {
  const columnas = db.prepare('PRAGMA table_info(onetoones)').all() as { name: string }[];
  if (columnas.some((c) => c.name === 'registrado_por')) return;
  db.exec(`
    ALTER TABLE onetoones ADD COLUMN registrado_por TEXT REFERENCES managers(id);
    ALTER TABLE onetoones ADD COLUMN registrado_en TEXT;
  `);

  const filas = db.prepare('SELECT id, mentee_id, date FROM onetoones ORDER BY date').all() as {
    id: string;
    mentee_id: string;
    date: string;
  }[];
  // `ORDER BY fecha, rowid`: con varios traspasos el mismo día manda el de mayor
  // orden de inserción (el dueño a fin de día); los `id` son aleatorios y no ordenan.
  const traspasos = db
    .prepare('SELECT mentee_id, origen_id, destino_id, fecha FROM traspasos ORDER BY fecha, rowid')
    .all() as { mentee_id: string; origen_id: string; destino_id: string; fecha: string }[];
  const managerActual = db.prepare('SELECT manager_id FROM mentees WHERE id = ?');
  const setAutor = db.prepare('UPDATE onetoones SET registrado_por = ? WHERE id = ?');

  db.transaction(() => {
    for (const fila of filas) {
      const autor = managerEn(fila.mentee_id, fila.date, traspasos, managerActual);
      setAutor.run(autor, fila.id);
    }
  })();

  db.exec(`
    UPDATE onetoones
    SET registrado_en = date || 'T00:00:00.000Z'
    WHERE registrado_en IS NULL
  `);
}

/**
 * Migración de la tabla `temas_propios` al estado vigente/retirado (ADR-0009 /
 * spec §14): una base creada antes del cambio no tiene `desde`/`estado`/
 * `retirado_el`; se amplía con `ALTER TABLE` y los registros existentes quedan
 * vigentes, con `desde` rellenado con la fecha del día de la migración (valor
 * canónico de respaldo; no hay temas propios en la semilla).
 */
/**
 * Migración de la tabla `acuerdos` a la fecha de cumplimiento (spec §11a «Cumplido
 * · {fecha}»): una base creada antes del cambio no tiene `cumplido_el`. Los
 * acuerdos ya cumplidos se quedan sin fecha (no hay referencia histórica: usar su
 * fecha de nacimiento presentaría una fecha de cumplimiento que no lo es); el
 * detalle los pinta como «Cumplido» sin fecha.
 */
function migrarAcuerdos(db: Database.Database): void {
  const columnas = db.prepare('PRAGMA table_info(acuerdos)').all() as { name: string }[];
  if (columnas.some((c) => c.name === 'cumplido_el')) return;
  db.exec('ALTER TABLE acuerdos ADD COLUMN cumplido_el TEXT');
}

/**
 * Migración de la tabla `notas_por_tema` al chip «propio» persistido (spec §11a):
 * una base creada antes del cambio no tiene `propio`. Los 1-to-1s ya registrados
 * se quedan sin chip (no hay forma de saber si el tema era propio entonces), lo
 * cual es lo correcto: el chip refleja cómo era el tema al registrarse.
 */
function migrarNotasPropio(db: Database.Database): void {
  const columnas = db.prepare('PRAGMA table_info(notas_por_tema)').all() as { name: string }[];
  if (columnas.some((c) => c.name === 'propio')) return;
  db.exec('ALTER TABLE notas_por_tema ADD COLUMN propio INTEGER NOT NULL DEFAULT 0');
}

function migrarTemasPropios(db: Database.Database): void {
  const columnas = db.prepare('PRAGMA table_info(temas_propios)').all() as { name: string }[];
  if (columnas.some((c) => c.name === 'desde')) return;
  db.exec(`
    ALTER TABLE temas_propios ADD COLUMN desde TEXT NOT NULL DEFAULT '';
    ALTER TABLE temas_propios ADD COLUMN estado TEXT NOT NULL DEFAULT 'vigente';
    ALTER TABLE temas_propios ADD COLUMN retirado_el TEXT;
  `);
  const hoy = new Date().toISOString().slice(0, 10);
  db.prepare("UPDATE temas_propios SET desde = ? WHERE desde = ''").run(hoy);
}

/** Manager que gestionaba a una mentee en una fecha, por la cronología de traspasos:
 *  la comparación es inclusiva (`t.fecha <= fecha`): un traspaso rige desde el
 *  inicio de su fecha, así que un 1-to-1 del MISMO día pertenece al manager de
 *  DESTINO. El último traspaso anterior o contemporáneo manda (su destino); sin
 *  ninguno, el origen del primer traspaso; sin traspasos, el manager actual. */
function managerEn(
  menteeId: string,
  fecha: string,
  traspasos: { mentee_id: string; origen_id: string; destino_id: string; fecha: string }[],
  managerActual: { get: (id: string) => unknown },
): string {
  const propios = traspasos.filter((t) => t.mentee_id === menteeId);
  if (propios.length === 0) {
    const actual = managerActual.get(menteeId) as { manager_id: string } | undefined;
    return actual?.manager_id ?? '';
  }
  const ultimoAnterior = propios.filter((t) => t.fecha <= fecha).at(-1);
  if (ultimoAnterior !== undefined) {
    return ultimoAnterior.destino_id;
  }
  return propios[0]?.origen_id ?? '';
}
