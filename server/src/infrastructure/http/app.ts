import express, { type Request, type Response } from 'express';
import type { Manager } from '../../domain/model.js';
import { LoginService, TeamService } from '../../application/services.js';
import { OneToOneService } from '../../application/onetoone_service.js';
import { TemaPropioService } from '../../application/tema_propio_service.js';
import { ObjetivoService } from '../../application/objetivo_service.js';
import { IncidenciaService } from '../../application/incidencia_service.js';
import { ProyectoService } from '../../application/proyecto_service.js';
import { TraspasoService } from '../../application/traspaso_service.js';
import { PlantillaService } from '../../application/plantilla_service.js';
import type { SessionStore } from '../../domain/ports.js';
import type { NuevoOneToOne } from '../../domain/ports.js';

export const SESSION_COOKIE = 'jtm_session';

/** Dependencias del servidor HTTP: se inyectan desde main.ts (hexagonal). */
export interface AppDeps {
  login: LoginService;
  team: TeamService;
  onetoones: OneToOneService;
  temasPropios: TemaPropioService;
  objetivos: ObjetivoService;
  incidencias: IncidenciaService;
  proyectos: ProyectoService;
  traspasos: TraspasoService;
  plantilla: PlantillaService;
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

  // Ruta de depuración del arnés de calidad: simula un error de servidor para
  // verificar que Sentry lo captura (el manejador se registra en main.ts). Ver AGENTS.md.
  app.get('/api/debug/sentry-error', () => {
    throw new Error('Error simulado para Sentry');
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

  // Plantilla de 1-to-1 del manager autenticado: vigentes en orden y retirados.
  app.get('/api/plantilla', requireSession(deps.sessions, async (_req, res, manager) => {
    res.json({ temas: await deps.plantilla.plantillaOf(manager) });
  }));

  // Añade un tema genérico al final de la plantilla.
  app.post('/api/plantilla/temas', requireSession(deps.sessions, async (req, res, manager) => {
    const { tema } = (req.body ?? {}) as { tema?: unknown };
    if (typeof tema !== 'string') {
      res.status(400).json({ error: 'Texto del tema requerido' });
      return;
    }
    try {
      const creado = await deps.plantilla.addTema(manager, tema);
      res.status(201).json(creado);
    } catch (err) {
      responderPlantillaError(res, err, 'Error al añadir el tema');
    }
  }));

  // Edita el texto de un tema de la plantilla.
  app.patch('/api/plantilla/temas/:temaId', requireSession(deps.sessions, async (req, res, manager) => {
    const { tema } = (req.body ?? {}) as { tema?: unknown };
    if (typeof tema !== 'string') {
      res.status(400).json({ error: 'Texto del tema requerido' });
      return;
    }
    try {
      const editado = await deps.plantilla.editarTema(manager, param(req, 'temaId'), tema);
      res.json(editado);
    } catch (err) {
      responderPlantillaError(res, err, 'Error al editar el tema');
    }
  }));

  // Sube/baja un tema de la plantilla una posición (delta -1 sube, +1 baja).
  app.post('/api/plantilla/temas/:temaId/mover', requireSession(deps.sessions, async (req, res, manager) => {
    const { delta } = (req.body ?? {}) as { delta?: unknown };
    if (delta !== -1 && delta !== 1) {
      res.status(400).json({ error: 'Movimiento no válido: delta debe ser -1 (subir) o 1 (bajar)' });
      return;
    }
    try {
      const plantilla = await deps.plantilla.moverTema(manager, param(req, 'temaId'), delta);
      res.json({ temas: plantilla });
    } catch (err) {
      responderPlantillaError(res, err, 'Error al reordenar la plantilla');
    }
  }));

  // Retira un tema de la plantilla (no se puede retirar el último vigente).
  app.post('/api/plantilla/temas/:temaId/retirar', requireSession(deps.sessions, async (req, res, manager) => {
    try {
      const retirado = await deps.plantilla.retirarTema(manager, param(req, 'temaId'));
      res.json(retirado);
    } catch (err) {
      responderPlantillaError(res, err, 'Error al retirar el tema');
    }
  }));

  // Vuelve a activar un tema retirado, al final de los vigentes.
  app.post('/api/plantilla/temas/:temaId/reactivar', requireSession(deps.sessions, async (req, res, manager) => {
    try {
      const reactivado = await deps.plantilla.reactivarTema(manager, param(req, 'temaId'));
      res.json(reactivado);
    } catch (err) {
      responderPlantillaError(res, err, 'Error al reactivar el tema');
    }
  }));

  // Restablece la plantilla a sus temas iniciales.
  app.post('/api/plantilla/restablecer', requireSession(deps.sessions, async (_req, res, manager) => {
    const plantilla = await deps.plantilla.restablecerPlantilla(manager);
    res.json({ temas: plantilla });
  }));

  // Objetivos anuales de una mentee.
  app.get('/api/mentees/:menteeId/objetivos', requireSession(deps.sessions, async (req, res, manager) => {
    const objetivos = await deps.objetivos.objetivosOf(manager, param(req, 'menteeId'));
    res.json({ objetivos });
  }));

  // Alta de un objetivo anual (nace en curso).
  app.post('/api/mentees/:menteeId/objetivos', requireSession(deps.sessions, async (req, res, manager) => {
    const fields = parseObjetivoFields((req.body ?? {}) as Record<string, unknown>);
    if (fields === null) {
      res.status(400).json({ error: 'Estructura de objetivo inválida' });
      return;
    }
    try {
      const objetivo = await deps.objetivos.addObjetivo(manager, {
        menteeId: param(req, 'menteeId'),
        ...fields,
      });
      res.status(201).json(objetivo);
    } catch (err) {
      responderObjetivoError(res, err, 'Error al dar de alta el objetivo');
    }
  }));

  // Edición de un objetivo en curso.
  app.patch('/api/objetivos/:objetivoId', requireSession(deps.sessions, async (req, res, manager) => {
    const fields = parseObjetivoFields((req.body ?? {}) as Record<string, unknown>);
    if (fields === null) {
      res.status(400).json({ error: 'Estructura de objetivo inválida' });
      return;
    }
    try {
      const objetivo = await deps.objetivos.updateObjetivo(manager, param(req, 'objetivoId'), fields);
      res.json(objetivo);
    } catch (err) {
      responderObjetivoError(res, err, 'Error al editar el objetivo');
    }
  }));

  // Cambio de estado de un objetivo en curso (cumplido / no cumplido).
  app.post('/api/objetivos/:objetivoId/estado', requireSession(deps.sessions, async (req, res, manager) => {
    const { estado } = (req.body ?? {}) as { estado?: unknown };
    if (estado !== 'cumplido' && estado !== 'no cumplido') {
      res.status(400).json({ error: 'Estado no válido: debe ser "cumplido" o "no cumplido"' });
      return;
    }
    try {
      const objetivo = await deps.objetivos.cambiarEstado(manager, param(req, 'objetivoId'), estado);
      res.json(objetivo);
    } catch (err) {
      responderObjetivoError(res, err, 'Error al cambiar el estado del objetivo');
    }
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

  // Incidencias abiertas de todo el equipo del manager.
  app.get('/api/incidencias', requireSession(deps.sessions, async (_req, res, manager) => {
    const incidencias = await deps.incidencias.abiertasDe(manager);
    res.json({ incidencias });
  }));

  // Historial de incidencias de una mentee (abiertas y resueltas).
  app.get('/api/mentees/:menteeId/incidencias', requireSession(deps.sessions, async (req, res, manager) => {
    const incidencias = await deps.incidencias.historialDe(manager, param(req, 'menteeId'));
    res.json({ incidencias });
  }));

  // Alta de una incidencia abierta en una mentee.
  app.post('/api/mentees/:menteeId/incidencias', requireSession(deps.sessions, async (req, res, manager) => {
    const { descripcion } = (req.body ?? {}) as { descripcion?: unknown };
    if (typeof descripcion !== 'string') {
      res.status(400).json({ error: 'Descripción de la incidencia requerida' });
      return;
    }
    try {
      const incidencia = await deps.incidencias.addIncidencia(manager, param(req, 'menteeId'), descripcion);
      res.status(201).json(incidencia);
    } catch (err) {
      responderIncidenciaError(res, err, 'Error al dar de alta la incidencia');
    }
  }));

  // Resolución de una incidencia abierta con nota de resolución.
  app.post('/api/incidencias/:incidenciaId/resolver', requireSession(deps.sessions, async (req, res, manager) => {
    const { nota } = (req.body ?? {}) as { nota?: unknown };
    if (typeof nota !== 'string') {
      res.status(400).json({ error: 'Nota de resolución requerida' });
      return;
    }
    try {
      const incidencia = await deps.incidencias.resolverIncidencia(manager, param(req, 'incidenciaId'), nota);
      res.json(incidencia);
    } catch (err) {
      responderIncidenciaError(res, err, 'Error al resolver la incidencia');
    }
  }));

  // Catálogo de proyectos (compartido).
  app.get('/api/proyectos', requireSession(deps.sessions, async (_req, res) => {
    res.json({ proyectos: await deps.proyectos.proyectos() });
  }));

  // Alta de un proyecto en el catálogo.
  app.post('/api/proyectos', requireSession(deps.sessions, async (req, res) => {
    const { name } = (req.body ?? {}) as { name?: unknown };
    if (typeof name !== 'string') {
      res.status(400).json({ error: 'Nombre del proyecto requerido' });
      return;
    }
    try {
      const proyecto = await deps.proyectos.addProyecto(name);
      res.status(201).json(proyecto);
    } catch (err) {
      responderProyectoError(res, err, 'Error al crear el proyecto');
    }
  }));

  // Quién está hoy en cada proyecto (mentees del manager, agrupados por proyecto actual).
  app.get('/api/proyectos/miembros', requireSession(deps.sessions, async (_req, res, manager) => {
    res.json({ proyectos: await deps.proyectos.miembrosPorProyecto(manager) });
  }));

  // Situación de una mentee: proyecto actual e historial de cambios de proyecto.
  app.get('/api/mentees/:menteeId/cambios-proyecto', requireSession(deps.sessions, async (req, res, manager) => {
    res.json(await deps.proyectos.situacionDe(manager, param(req, 'menteeId')));
  }));

  // Registro de un cambio de proyecto (el origen se deriva del proyecto actual).
  app.post('/api/mentees/:menteeId/cambios-proyecto', requireSession(deps.sessions, async (req, res, manager) => {
    const body = (req.body ?? {}) as { fecha?: unknown; destinoId?: unknown; motivo?: unknown };
    if (
      typeof body.fecha !== 'string' ||
      (body.destinoId !== null && typeof body.destinoId !== 'string') ||
      typeof body.motivo !== 'string'
    ) {
      res.status(400).json({ error: 'Estructura de cambio de proyecto inválida' });
      return;
    }
    try {
      const cambio = await deps.proyectos.registrarCambio(manager, param(req, 'menteeId'), {
        fecha: body.fecha,
        destinoId: body.destinoId as string | null,
        motivo: body.motivo,
      });
      res.status(201).json(cambio);
    } catch (err) {
      responderProyectoError(res, err, 'Error al registrar el cambio de proyecto');
    }
  }));

  // Catálogo de managers (para elegir el destino de un traspaso).
  app.get('/api/managers', requireSession(deps.sessions, async (_req, res) => {
    res.json({ managers: await deps.traspasos.managers() });
  }));

  // Historial de traspasos de una mentee.
  app.get('/api/mentees/:menteeId/traspasos', requireSession(deps.sessions, async (req, res, manager) => {
    res.json({ traspasos: await deps.traspasos.historialDe(manager, param(req, 'menteeId')) });
  }));

  // Traspaso de una mentee a otro manager (el origen se deriva del manager actual).
  app.post('/api/mentees/:menteeId/traspasos', requireSession(deps.sessions, async (req, res, manager) => {
    const body = (req.body ?? {}) as { fecha?: unknown; destinoId?: unknown; motivo?: unknown };
    if (
      typeof body.fecha !== 'string' ||
      typeof body.destinoId !== 'string' ||
      typeof body.motivo !== 'string'
    ) {
      res.status(400).json({ error: 'Estructura de traspaso inválida' });
      return;
    }
    try {
      const traspaso = await deps.traspasos.traspasar(manager, param(req, 'menteeId'), {
        fecha: body.fecha,
        destinoId: body.destinoId,
        motivo: body.motivo,
      });
      res.status(201).json(traspaso);
    } catch (err) {
      responderTraspasoError(res, err, 'Error al registrar el traspaso');
    }
  }));

  return app;
}

/**
 * Extrae y valida los campos de un objetivo desde el body. Devuelve null si
 * falta el título o la fecha límite; la descripción es opcional (por defecto '').
 */
function parseObjetivoFields(
  body: Record<string, unknown>,
): { titulo: string; descripcion: string; fechaLimite: string } | null {
  if (typeof body.titulo !== 'string' || typeof body.fechaLimite !== 'string') return null;
  return {
    titulo: body.titulo,
    descripcion: typeof body.descripcion === 'string' ? body.descripcion : '',
    fechaLimite: body.fechaLimite,
  };
}

/** Mapea errores del dominio/adaptador de objetivos a su estado HTTP. */
function responderObjetivoError(res: Response, err: unknown, fallback: string): void {
  const msg = err instanceof Error ? err.message : '';
  const status =
    msg.includes('no encontrado') || msg.includes('no pertenece') ? 404
    : msg.includes('no puede') ? 409
    : 400;
  res.status(status).json({ error: msg === '' ? fallback : msg });
}

/** Mapea errores del dominio/adaptador de incidencias a su estado HTTP. */
function responderIncidenciaError(res: Response, err: unknown, fallback: string): void {
  const msg = err instanceof Error ? err.message : '';
  const status =
    msg.includes('no encontrado') || msg.includes('no encontrada') || msg.includes('no pertenece') ? 404
    : msg.includes('no puede resolverse') ? 409
    : 400;
  res.status(status).json({ error: msg === '' ? fallback : msg });
}

/** Mapea errores del dominio/adaptador de proyectos a su estado HTTP. */
function responderProyectoError(res: Response, err: unknown, fallback: string): void {
  const msg = err instanceof Error ? err.message : '';
  const status =
    msg.includes('no encontrado') || msg.includes('no pertenece') ? 404
    : msg.includes('Ya existe') || msg.includes('distinto') ? 409
    : 400;
  res.status(status).json({ error: msg === '' ? fallback : msg });
}

/** Mapea errores del dominio/adaptador de traspasos a su estado HTTP. */
function responderTraspasoError(res: Response, err: unknown, fallback: string): void {
  const msg = err instanceof Error ? err.message : '';
  const status =
    msg.includes('no encontrado') || msg.includes('no pertenece') ? 404
    : msg.includes('distinto') ? 409
    : 400;
  res.status(status).json({ error: msg === '' ? fallback : msg });
}

/** Mapea errores del dominio/adaptador de la plantilla a su estado HTTP. */
function responderPlantillaError(res: Response, err: unknown, fallback: string): void {
  const msg = err instanceof Error ? err.message : '';
  const status =
    msg.includes('no encontrado') || msg.includes('no pertenece') ? 404
    : msg.includes('último') ? 409
    : msg.includes('Ya existe') ? 409
    : 400;
  res.status(status).json({ error: msg === '' ? fallback : msg });
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
