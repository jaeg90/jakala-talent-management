import express from 'express';
import type { Database } from 'better-sqlite3';
import { openDatabase } from './infrastructure/db/sqlite.js';
import { seed } from './infrastructure/db/seed.js';
import { SeedAuthenticator } from './infrastructure/auth/seed-authenticator.js';
import { SqliteTeamRepository } from './infrastructure/db/sqlite-team-repository.js';
import { MemorySessionStore } from './infrastructure/sessions/memory-session-store.js';
import { LoginService, TeamService } from './application/services.js';
import { OneToOneService } from './application/onetoone_service.js';
import { TemaPropioService } from './application/tema_propio_service.js';
import { ObjetivoService } from './application/objetivo_service.js';
import { IncidenciaService } from './application/incidencia_service.js';
import { ProyectoService } from './application/proyecto_service.js';
import { TraspasoService } from './application/traspaso_service.js';
import { SqliteOneToOneRepository } from './infrastructure/db/sqlite-onetoone-repository.js';
import { SqliteTemaPropioRepository } from './infrastructure/db/sqlite-tema-propio-repository.js';
import { SqliteObjetivoRepository } from './infrastructure/db/sqlite-objetivo-repository.js';
import { SqliteIncidenciaRepository } from './infrastructure/db/sqlite-incidencia-repository.js';
import { SqliteProyectoRepository } from './infrastructure/db/sqlite-proyecto-repository.js';
import { SqliteTraspasoRepository } from './infrastructure/db/sqlite-traspaso-repository.js';
import { createApp } from './infrastructure/http/app.js';

const PORT = Number(process.env.PORT ?? 3001);
const DB_PATH = process.env.JTM_DB ?? 'jtm.db';
const WEB_DIST = process.env.WEB_DIST ?? '../web/dist';

// Composición de adaptadores (hexagonal): dominio y aplicación no conocen Express ni SQLite.
const db: Database = openDatabase(DB_PATH);
seed(db);

const sessions = new MemorySessionStore();

const app = createApp({
  login: new LoginService(new SeedAuthenticator(db), sessions),
  team: new TeamService(new SqliteTeamRepository(db)),
  onetoones: new OneToOneService(new SqliteOneToOneRepository(db)),
  temasPropios: new TemaPropioService(new SqliteTemaPropioRepository(db)),
  objetivos: new ObjetivoService(new SqliteObjetivoRepository(db)),
  incidencias: new IncidenciaService(new SqliteIncidenciaRepository(db)),
  proyectos: new ProyectoService(new SqliteProyectoRepository(db)),
  traspasos: new TraspasoService(new SqliteTraspasoRepository(db)),
  sessions,
});

// Cliente construido (Vite) servido por el mismo puerto.
app.use(express.static(WEB_DIST));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile('index.html', { root: WEB_DIST });
});

app.listen(PORT, () => {
  console.log(`JTM escuchando en http://localhost:${PORT}`);
});
