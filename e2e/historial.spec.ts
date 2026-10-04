import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';

// Managers semilla (ficticios, ver README). La mentee Hugo Herrera (manager-3,
// Lucía) no la toca ninguna otra prueba, así que los fixtures del Historial no
// contaminan la mentee compartida por el resto de E2E. Gabriela Gómez (manager-3)
// tampoco la usa nadie: sirve para el contrato de accesibilidad y el vacío.
const LUCIA = 'lucia@jakala.example';
const MARTA = 'manager@jakala.example';
const PASSWORD = 'secreta123';

/** Hoy en ISO (YYYY-MM-DD), la fecha de apertura de una incidencia (spec §12). */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Etiqueta del mes en curso, con el mes COMPLETO («Octubre 2026»), como el timeline. */
function mesActual(): string {
  const d = new Date();
  const mes = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' }).format(d);
  return mes.charAt(0).toUpperCase() + mes.slice(1) + ' ' + d.getUTCFullYear();
}

/** Inicia sesión por API y aplica la cookie al contexto del navegador (mi equipo). */
async function sesionUi(
  request: APIRequestContext,
  context: BrowserContext,
  email: string,
): Promise<void> {
  const res = await request.post('/api/login', { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  const setCookie = res.headers()['set-cookie'] ?? '';
  const [name, value] = setCookie.split(';')[0]!.split('=');
  await context.addCookies([
    { name: name ?? 'jtm_session', value: value ?? '', url: 'http://localhost:4173' },
  ]);
}

test('Historial: feed agregado completo, orden canónico del mismo día y agrupado por mes/año', async ({
  page,
  request,
  context,
}) => {
  // Fixtures por API como Lucía, todo en la MISMA fecha (hoy) para afirmar el
  // criterio estable del mismo día (ADR-0007): orden de filtros §07 (1-to-1s →
  // Objetivos → Incidencias → Proyectos → Traspasos) y desempate por id ascendente.
  await request.post('/api/login', { data: { email: LUCIA, password: PASSWORD } });

  // Eventos de fechas anteriores, para probar el agrupado por mes (año en curso)
  // y por año (anteriores).
  await request.post('/api/mentees/me-hugo/onetoones', {
    data: {
      date: '2025-03-10',
      notas: [{ tema: 'Primer contacto', nota: 'Comenzamos el seguimiento' }],
      acuerdos: [],
    },
  });
  await request.post('/api/mentees/me-hugo/onetoones', {
    data: {
      date: '2026-02-01',
      notas: [{ tema: 'Trimestre', nota: 'Avance del trimestre en marcha' }],
      acuerdos: [],
    },
  });

  // 1-to-1 de hoy (2 temas con nota, 1 acuerdo) → «2 temas · 1 acuerdo · «…»».
  await request.post('/api/mentees/me-hugo/onetoones', {
    data: {
      date: hoy(),
      notas: [
        { tema: '¿Qué tal el proyecto?', nota: 'Atlas va bien' },
        { tema: '¿Qué tal los objetivos?', nota: 'En camino' },
      ],
      acuerdos: [{ text: 'Revisar la carga' }],
    },
  });

  // Objetivo cerrado (cumplido) con fecha límite hoy: se ubica por su fecha límite.
  const objetivo = await request.post('/api/mentees/me-hugo/objetivos', {
    data: { titulo: 'Certificación Azure', descripcion: '', fechaLimite: hoy() },
  });
  const objetivoId = ((await objetivo.json()) as { id: string }).id;
  await request.post(`/api/objetivos/${objetivoId}/estado`, { data: { estado: 'cumplido' } });

  // Incidencia (se abre hoy, spec §12).
  await request.post('/api/mentees/me-hugo/incidencias', {
    data: { descripcion: 'Conflicto de prioridades', fechaApertura: hoy() },
  });

  // Entrada y salida en Atlas Bank, ambas hoy: la salida cierra la asignación.
  const proyectos = (await (await request.get('/api/proyectos')).json()) as {
    proyectos: { id: string; name: string }[];
  };
  const atlas = proyectos.proyectos.find((p) => p.name === 'Atlas Bank')!;
  await request.post('/api/mentees/me-hugo/proyectos', {
    data: { proyecto: atlas.id, desde: hoy(), motivoEntrada: 'Alta en el equipo' },
  });
  await request.post(`/api/mentees/me-hugo/proyectos/${atlas.id}/salir`, {
    data: { hasta: hoy(), motivoSalida: 'Fin de proyecto' },
  });

  // Traspaso hoy a Marta: la mentee cambia de manager y el feed se hereda completo.
  const managers = (await (await request.get('/api/managers')).json()) as {
    managers: { id: string; email: string; name: string }[];
  };
  const marta = managers.managers.find((m) => m.email === MARTA)!;
  await request.post('/api/mentees/me-hugo/traspasos', {
    data: { fecha: hoy(), destinoId: marta.id, motivo: 'Reorganización del equipo' },
  });

  // Marta hereda el historial: lo lee desde su sesión.
  await sesionUi(request, context, MARTA);
  await page.goto('/mentees/me-hugo/historial');
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();

  // El feed reúne las seis fuentes: 1-to-1s, objetivo, incidencia, entrada, salida y traspaso.
  await expect(page.getByText(/2 temas · 1 acuerdo · «Atlas va bien…»/)).toBeVisible();
  await expect(page.getByText('Certificación Azure')).toBeVisible();
  await expect(page.getByText('Conflicto de prioridades')).toBeVisible();
  // La incidencia lleva «Incidencia» como título visible 700 y la descripción
  // como detalle secundario (no el título en negrita): contrato de §07.
  const incidencia = page
    .locator('.timeline__evento')
    .filter({ hasText: 'Conflicto de prioridades' });
  await expect(incidencia.locator('.timeline__evento-titulo')).toHaveText('Incidencia');
  await expect(incidencia.locator('.timeline__evento-detalle')).toHaveText('Conflicto de prioridades');
  await expect(page.getByText('Entra en Atlas Bank')).toBeVisible();
  await expect(page.getByText('Sale de Atlas Bank')).toBeVisible();
  await expect(page.getByText('Traspaso · Lucía López → Marta Manager')).toBeVisible();
  await expect(page.getByText('Historial heredado completo')).toBeVisible();

  // Agrupado: mes en curso con el mes COMPLETO (no el compacto «oct 2026») y los
  // años anteriores agrupados por año. Cada encabezado es un <time datetime>
  // (accesibilidad.md §Globales: «Fechas en <time datetime="…">»).
  await expect(page.getByRole('heading', { name: mesActual() })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Febrero 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2025' })).toBeVisible();
  await expect(
    page.locator('ol.timeline h2 time[datetime="2026-02-01"]'),
    'el grupo «Febrero 2026» lleva <time datetime="2026-02-01">',
  ).toBeVisible();
  await expect(
    page.locator('ol.timeline h2 time[datetime="2025-01-01"]'),
    'el grupo «2025» lleva <time datetime="2025-01-01">',
  ).toBeVisible();

  // Orden canónico del mismo día: el primer grupo (el mes en curso, el más
  // reciente) ordena sus eventos por la prioridad de filtros §07 y, dentro del
  // mismo tipo, por id ascendente (entrada antes que salida).
  const eventosHoy = page.locator('.timeline__grupo').first().locator('.timeline__evento');
  const textos = await eventosHoy.evaluateAll((els) => els.map((el) => el.textContent ?? ''));
  const secuencia = [
    '2 temas · 1 acuerdo', // 1-to-1
    'Certificación Azure', // objetivo
    'Conflicto de prioridades', // incidencia
    'Entra en Atlas Bank', // proyecto: entrada
    'Sale de Atlas Bank', // proyecto: salida
    'Traspaso · Lucía López → Marta Manager', // traspaso
  ];
  expect(textos).toHaveLength(secuencia.length);
  secuencia.forEach((fragmento, indice) => {
    expect(textos[indice], `posición ${indice}: «${fragmento}»`).toContain(fragmento);
  });
});

test('Historial: filtros anuncian estado, vacío con copy y contrato del timeline (ol/li, marcador aria-hidden)', async ({
  page,
  request,
  context,
}) => {
  // Gabriela: mentee de Lucía sin fixtures, para el vacío por filtro y los marcadores.
  await request.post('/api/login', { data: { email: LUCIA, password: PASSWORD } });
  await request.post('/api/mentees/me-gabriela/onetoones', {
    data: {
      date: '2026-09-20',
      notas: [{ tema: 'Progreso', nota: 'Va bien' }],
      acuerdos: [],
    },
  });

  await sesionUi(request, context, LUCIA);
  await page.goto('/mentees/me-gabriela/historial');
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();

  // La pantalla es una sección de ficha (accesibilidad.md §Secciones de ficha) y
  // el encabezado de grupo es un <time datetime> (accesibilidad.md §Globales).
  await expect(page.getByRole('region', { name: 'Historial' })).toBeVisible();
  await expect(page.locator('ol.timeline h2 time[datetime]').first()).toBeVisible();
  const timeMes = page.locator('ol.timeline h2 time').first();
  await expect(timeMes).toHaveText('Septiembre 2026');
  await expect(timeMes).toHaveAttribute('datetime', '2026-09-01');

  // Filtros: grupo con aria-label y botones que anuncian su estado (aria-pressed).
  const filtros = page.getByRole('group', { name: 'Filtrar historial' });
  await expect(filtros).toBeVisible();
  await expect(filtros.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true');
  await expect(filtros.getByRole('button', { name: '1-to-1s' })).toHaveAttribute('aria-pressed', 'false');

  // El timeline es una lista <ol> con un <li> por evento y el mes como encabezado.
  await expect(page.locator('ol.timeline')).toHaveCount(1);
  await expect(page.locator('ol.timeline li.timeline__evento').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Septiembre 2026' })).toBeVisible();

  // El marcador del 1-to-1 es decorativo (aria-hidden) y el tipo va en texto.
  await expect(page.locator('.timeline__marca--1to1').first()).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.timeline__evento').first()).toContainText('1 tema · 0 acuerdos');

  // Filtro «Traspasos»: Gabriela no tiene traspasos → vacío con su copy exacto.
  await filtros.getByRole('button', { name: 'Traspasos' }).click();
  await expect(filtros.getByRole('button', { name: 'Traspasos' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('No hay eventos de este tipo.')).toBeVisible();

  // Filtro «1-to-1s»: anuncia el estado y solo queda el 1-to-1.
  await filtros.getByRole('button', { name: '1-to-1s' }).click();
  await expect(filtros.getByRole('button', { name: '1-to-1s' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('ol.timeline li.timeline__evento')).toHaveCount(1);
  await expect(page.getByText(/1 tema · 0 acuerdos/)).toBeVisible();
});