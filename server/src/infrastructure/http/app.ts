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
import { CuentaService } from '../../application/cuenta_service.js';
import { HistorialService } from '../../application/historial_service.js';
import { MenteeService } from '../../application/mentee_service.js';
import { esFiltroHistorial, type FiltroHistorial } from '../../domain/historial.js';
import type { SessionStore } from '../../domain/ports.js';
import type { NuevoOneToOne } from '../../domain/ports.js';

export const SESSION_COOKIE = 'jtm_session';

/** Dependencias del servidor HTTP: se inyectan desde main.ts (hexagonal). */
export interface AppDeps {
  login: LoginService;
  team: TeamService;
  mentees: MenteeService;
  onetoones: OneToOneService;
  temasPropios: TemaPropioService;
  objetivos: ObjetivoService;
  incidencias: IncidenciaService;
  proyectos: ProyectoService;
  traspasos: TraspasoService;
  plantilla: PlantillaService;
  cuentas: CuentaService;
  historial: HistorialService;
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

/** Envoltura de rutas autenticadas: rechaza 401 sin sesión, aplica el bloqueo duro
 * por contraseña temporal (403) y pasa el manager tipado. `permitirBloqueado` deja
 * pasar a los endpoints de sesión y de cambio de contraseña, que siguen disponibles
 * con el flag activo. */
function requireSession(
  sessions: SessionStore,
  handler: Handler,
  permitirBloqueado = false,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    const manager = typeof token === 'string' ? await sessions.find(token) : null;
    if (manager === null) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!permitirBloqueado && manager.debeCambiarContraseña) {
      res.status(403).json({ error: 'Debes cambiar tu contraseña temporal para continuar' });
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
  }, true));

  // Cambio de contraseña: requiere la actual, valida la nueva y, al guardar, se
  // invalidan las demás sesiones de ese manager. Sigue disponible con el flag
  // temporal activo (es el desbloqueo del bloqueo duro).
  app.post('/api/cuenta/contrasena', requireSession(deps.sessions, async (req, res, manager) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string') {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const { actual, nueva } = (req.body ?? {}) as { actual?: unknown; nueva?: unknown };
    if (typeof actual !== 'string' || typeof nueva !== 'string') {
      res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
      return;
    }
    try {
      const actualizado = await deps.cuentas.cambiarContrasena(manager, token, actual, nueva);
      res.json({ manager: actualizado });
    } catch (err) {
      res
        .status(400)
        .json({ error: err instanceof Error ? err.message : 'Error al cambiar la contraseña' });
    }
  }, true));

  app.get('/api/team', requireSession(deps.sessions, async (_req, res, manager) => {
    res.json({ mentees: await deps.team.teamOf(manager) });
  }));

  app.post('/api/mentees', requireSession(deps.sessions, async (req, res, manager) => {
    const { name, proyectos, enEquipoDesde } = (req.body ?? {}) as {
      name?: unknown; proyectos?: unknown; enEquipoDesde?: unknown;
    };
    if (typeof name !== 'string' || typeof enEquipoDesde !== 'string' ||
        !Array.isArray(proyectos) || !proyectos.every((p: unknown) => typeof p === 'string')) {
      res.status(400).json({ error: 'Nombre, proyectos y fecha de entrada requeridos.' });
      return;
    }
    try {
      res.status(201).json(await deps.mentees.addMentee(manager, { name, proyectos: proyectos as string[], enEquipoDesde }));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Error al añadir la mentee' });
    }
  }));

  // Ficha de una mentee: historial de 1-to-1s y acuerdos pendientes.
  app.get('/api/mentees/:menteeId/onetoones', requireSession(deps.sessions, async (req, res, manager) => {
    const [history, pending] = await Promise.all([
      deps.onetoones.historyOf(manager, param(req, 'menteeId')),
      deps.onetoones.pendingAgreementsOf(manager, param(req, 'menteeId')),
    ]);
    res.json({ history, pending });
  }));

  // Temas propios de una mentee: vigentes y retirados, con su estado y fechas.
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

  // Retira un tema propio (sin borrado físico: queda retirado y los 1-to-1s ya
  // registrados no cambian). Ancla al patrón POST /api/plantilla/temas/:id/retirar.
  app.post('/api/mentees/:menteeId/temas/:temaPropioId/retirar', requireSession(deps.sessions, async (req, res, manager) => {
    const ok = await deps.temasPropios.retirarTemaPropio(
      manager,
      param(req, 'menteeId'),
      param(req, 'temaPropioId'),
    );
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

  // Alta de una incidencia abierta en una mentee, con la fecha de apertura elegida
  // por el manager (≤ hoy; es la que cuenta en Mi equipo y en el Historial).
  app.post('/api/mentees/:menteeId/incidencias', requireSession(deps.sessions, async (req, res, manager) => {
    const body = (req.body ?? {}) as { descripcion?: unknown; fechaApertura?: unknown };
    if (typeof body.descripcion !== 'string' || typeof body.fechaApertura !== 'string') {
      res.status(400).json({ error: 'Descripción y fecha de apertura de la incidencia requeridas' });
      return;
    }
    try {
      const incidencia = await deps.incidencias.addIncidencia(
        manager,
        param(req, 'menteeId'),
        body.descripcion,
        body.fechaApertura,
      );
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

  // Retira un proyecto vigente del catálogo (fechaRetirada = hoy).
  app.post('/api/proyectos/:proyectoId/retirar', requireSession(deps.sessions, async (req, res) => {
    try {
      const retirado = await deps.proyectos.retirarProyecto(param(req, 'proyectoId'));
      res.json(retirado);
    } catch (err) {
      responderProyectoError(res, err, 'Error al retirar el proyecto');
    }
  }));

  // Reactiva un proyecto retirado (fechaRetirada = null).
  app.post('/api/proyectos/:proyectoId/reactivar', requireSession(deps.sessions, async (req, res) => {
    try {
      const reactivado = await deps.proyectos.reactivarProyecto(param(req, 'proyectoId'));
      res.json(reactivado);
    } catch (err) {
      responderProyectoError(res, err, 'Error al reactivar el proyecto');
    }
  }));

  // Proyectos vigentes de una mentee (con la fecha de entrada), en orden alfabético.
  app.get('/api/mentees/:menteeId/proyectos', requireSession(deps.sessions, async (req, res, manager) => {
    try {
      const proyectos = await deps.proyectos.proyectosActuales(manager, param(req, 'menteeId'));
      res.json({ proyectos });
    } catch (err) {
      responderProyectoError(res, err, 'Error al leer los proyectos de la mentee');
    }
  }));

  // Entrar en un proyecto: alta de asignación (proyecto, desde, motivoEntrada).
  app.post('/api/mentees/:menteeId/proyectos', requireSession(deps.sessions, async (req, res, manager) => {
    const body = (req.body ?? {}) as { proyecto?: unknown; desde?: unknown; motivoEntrada?: unknown };
    if (
      typeof body.proyecto !== 'string' ||
      typeof body.desde !== 'string' ||
      typeof body.motivoEntrada !== 'string'
    ) {
      res.status(400).json({ error: 'Estructura de entrada en proyecto inválida' });
      return;
    }
    try {
      const asignacion = await deps.proyectos.entrarEnProyecto(manager, param(req, 'menteeId'), {
        proyecto: body.proyecto,
        desde: body.desde,
        motivoEntrada: body.motivoEntrada,
      });
      res.status(201).json(asignacion);
    } catch (err) {
      responderProyectoError(res, err, 'Error al entrar en el proyecto');
    }
  }));

  // Salir de un proyecto: cierra la asignación vigente (hasta, motivoSalida).
  app.post(
    '/api/mentees/:menteeId/proyectos/:proyectoId/salir',
    requireSession(deps.sessions, async (req, res, manager) => {
      const body = (req.body ?? {}) as { hasta?: unknown; motivoSalida?: unknown };
      if (typeof body.hasta !== 'string' || typeof body.motivoSalida !== 'string') {
        res.status(400).json({ error: 'Estructura de salida de proyecto inválida' });
        return;
      }
      try {
        const asignacion = await deps.proyectos.salirDeProyecto(
          manager,
          param(req, 'menteeId'),
          param(req, 'proyectoId'),
          { hasta: body.hasta, motivoSalida: body.motivoSalida },
        );
        res.json(asignacion);
      } catch (err) {
        responderProyectoError(res, err, 'Error al salir del proyecto');
      }
    }),
  );

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

  // Historial unificado de una mentee (ADR-0007): agregación en consulta con
  // filtro opcional `?tipo=` (un valor no reconocido equivale a «Todo»).
  app.get('/api/mentees/:menteeId/historial', requireSession(deps.sessions, async (req, res, manager) => {
    const raw = req.query.tipo;
    const filtro: FiltroHistorial | null = esFiltroHistorial(raw) ? raw : null;
    const eventos = await deps.historial.historialDe(manager, param(req, 'menteeId'), filtro);
    res.json({ eventos });
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
    : msg.includes('no puede cambiar') || msg.includes('no puede editarse') ? 409
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
