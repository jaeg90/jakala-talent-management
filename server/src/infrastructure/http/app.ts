import express, { type Request, type Response } from 'express';
import type { Manager } from '../../domain/model.js';
import { LoginService, TeamService } from '../../application/services.js';
import { OneToOneService } from '../../application/onetoone_service.js';
import { TemaPropioService } from '../../application/tema_propio_service.js';
import type { SessionStore } from '../../domain/ports.js';
import type { NuevoOneToOne } from '../../domain/ports.js';

export const SESSION_COOKIE = 'jtm_session';

/** Dependencias del servidor HTTP: se inyectan desde main.ts (hexagonal). */
export interface AppDeps {
  login: LoginService;
  team: TeamService;
  onetoones: OneToOneService;
  temasPropios: TemaPropioService;
  sessions: SessionStore;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cookies: Record<string, string>;
    }
  }
}

type Handler = (req: Request, res: Response, manager: Manager) => Promise<void>;

/** Parámetro de ruta :id como string (Express 5 tipa params como string | string[] | undefined). */
function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') throw new Error(`Parámetro ${name} ausente`);
  return value;
}

/** Cookie de sesión httpOnly; con token vacío expira (logout). */
function sessionCookie(token: string): string {
  const expiry = token === '' ? '; Max-Age=0' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax${expiry}`;
}

/** Envoltura de rutas autenticadas: rechaza 401 sin sesión y pasa el manager tipado. */
function requireSession(
  sessions: SessionStore,
  handler: Handler,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    const manager = typeof token === 'string' ? await sessions.find(token) : null;
    if (manager === null) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    await handler(req, res, manager);
  };
}

/** Crea la app Express con las rutas de la API. */
export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json());

  // Middleware mínimo de cookies: solo lee la cookie de sesión.
  app.use((req, _res, next) => {
    req.cookies = parseCookies(req.get('cookie') ?? '');
    next();
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email y contraseña requeridos' });
      return;
    }
    const result = await deps.login.login(email, password);
    if (result === null) {
      res.status(401).json({ error: 'Credenciales incorrectas' });
      return;
    }
    const [token, manager] = result;
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ manager });
  });

  app.post('/api/logout', async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') await deps.sessions.revoke(token);
    res.setHeader('Set-Cookie', sessionCookie(''));
    res.status(204).end();
  });

  app.get('/api/session', requireSession(deps.sessions, async (_req, res, manager) => {
    res.json({ manager });
  }));

  app.get('/api/team', requireSession(deps.sessions, async (_req, res, manager) => {
    res.json({ mentees: await deps.team.teamOf(manager) });
  }));

  // Ficha de una mentee: historial de 1-to-1s y acuerdos pendientes.
  app.get('/api/mentees/:menteeId/onetoones', requireSession(deps.sessions, async (req, res, manager) => {
    const [history, pending] = await Promise.all([
      deps.onetoones.historyOf(manager, param(req, 'menteeId')),
      deps.onetoones.pendingAgreementsOf(manager, param(req, 'menteeId')),
    ]);
    res.json({ history, pending });
  }));

  // Temas propios vigentes de una mentee.
  app.get('/api/mentees/:menteeId/temas', requireSession(deps.sessions, async (req, res, manager) => {
    const temas = await deps.temasPropios.temasPropiosOf(manager, param(req, 'menteeId'));
    res.json({ temas });
  }));

  // Alta de un tema propio para una mentee.
  app.post('/api/mentees/:menteeId/temas', requireSession(deps.sessions, async (req, res, manager) => {
    const body = (req.body ?? {}) as { tema?: unknown };
    if (typeof body.tema !== 'string') {
      res.status(400).json({ error: 'Nombre del tema requerido' });
      return;
    }
    try {
      const tema = await deps.temasPropios.addTemaPropio(manager, param(req, 'menteeId'), body.tema);
      res.status(201).json(tema);
    } catch (err) {
      res.status(err instanceof Error && err.message.includes('no pertenece') ? 404 : 400).json({
        error: err instanceof Error ? err.message : 'Error al dar de alta el tema',
      });
    }
  }));

  // Baja de un tema propio (no borra los temas tratados en 1-to-1s ya registrados).
  app.delete('/api/mentees/:menteeId/temas/:temaPropioId', requireSession(deps.sessions, async (req, res, manager) => {
    const ok = await deps.temasPropios.removeTemaPropio(manager, param(req, 'temaPropioId'));
    if (!ok) {
      res.status(404).json({ error: 'Tema propio no encontrado' });
      return;
    }
    res.status(204).end();
  }));

  // Registrar un 1-to-1 con notas por tema y acuerdos que nacen pendientes.
  app.post('/api/mentees/:menteeId/onetoones', requireSession(deps.sessions, async (req, res, manager) => {
    const body = (req.body ?? {}) as Partial<NuevoOneToOne>;
    if (
      typeof body.date !== 'string' ||
      !Array.isArray(body.notas) ||
      body.notas.some((n) => typeof n?.tema !== 'string' || typeof n?.nota !== 'string') ||
      !Array.isArray(body.acuerdos) ||
      body.acuerdos.some((a) => typeof a?.text !== 'string')
    ) {
      res.status(400).json({ error: 'Estructura de 1-to-1 inválida' });
      return;
    }
    try {
      const saved = await deps.onetoones.save(manager, {
        menteeId: param(req, 'menteeId'),
        date: body.date,
        notas: body.notas,
        acuerdos: body.acuerdos,
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(err instanceof Error && err.message.includes('no pertenece') ? 404 : 400).json({
        error: err instanceof Error ? err.message : 'Error al registrar el 1-to-1',
      });
    }
  }));

  // Marcar un acuerdo cumplido.
  app.post('/api/acuerdos/:acuerdoId/complete', requireSession(deps.sessions, async (req, res, manager) => {
    const ok = await deps.onetoones.completeAgreement(manager, param(req, 'acuerdoId'));
    if (!ok) {
      res.status(404).json({ error: 'Acuerdo no encontrado' });
      return;
    }
    res.status(204).end();
  }));

  return app;
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name !== '') cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}
