import express, { type Request, type Response } from 'express';
import type { Manager } from '../../domain/model.js';
import { LoginService, TeamService } from '../../application/services.js';
import type { SessionStore } from '../../domain/ports.js';

export const SESSION_COOKIE = 'jtm_session';

/** Dependencias del servidor HTTP: se inyectan desde main.ts (hexagonal). */
export interface AppDeps {
  login: LoginService;
  team: TeamService;
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
