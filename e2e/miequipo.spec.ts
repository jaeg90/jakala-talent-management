import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';

// Credenciales de los managers semilla (ficticias, ver README).
const DIEGO = 'diego@jakala.example';
const LUCIA = 'lucia@jakala.example';
const PASSWORD = 'secreta123';
const BASE_URL = 'http://localhost:4173';

/** Fecha ISO (YYYY-MM-DD) relativa a hoy: `fechaRelativa(-30)` ≈ hace 30 días. */
function fechaRelativa(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Crea una sesión por API y la aplica al contexto del navegador. */
async function iniciarSesionApi(
  request: APIRequestContext,
  context: BrowserContext,
  email: string,
  password: string = PASSWORD,
) {
  const res = await request.post('/api/login', { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
  const setCookie = res.headers()['set-cookie'] ?? '';
  const [name, value] = setCookie.split(';')[0]!.split('=');
  await context.addCookies([{ name: name ?? 'jtm_session', value: value ?? '', url: BASE_URL }]);
}

/**
 * Fixtures de Mi equipo sobre el equipo de Diego (los mentees de Marta los usan
 * otros specs): una única preparación en beforeAll, con fechas relativas a hoy.
 */
async function prepararEquipo(api: APIRequestContext): Promise<void> {
  await api.post('/api/login', { data: { email: DIEGO, password: PASSWORD } });

  const post = async (path: string, data: Record<string, unknown>) => {
    const res = await api.post(path, { data });
    expect(res.status(), `${path}: ${await res.text()}`).toBe(201);
  };

  const proyectos = (await (await api.get('/api/proyectos')).json()) as {
    proyectos: { id: string; name: string }[];
  };
  const ids = new Map(proyectos.proyectos.map((p) => [p.name, p.id]));
  const idO = async (nombre: string) => {
    const existente = ids.get(nombre);
    if (existente !== undefined) return existente;
    const res = await api.post('/api/proyectos', { data: { name: nombre } });
    expect(res.status()).toBe(201);
    const creado = (await res.json()) as { id: string };
    ids.set(nombre, creado.id);
    return creado.id;
  };

  // David: Aurora Health + Nexo Seguros + Portal Interno. Incidencia abierta y un
  // 1-to-1 RECIENTE (hace 3 días) con 2 acuerdos pendientes → atención por la
  // incidencia, sin badge de antigüedad; primera posición (más acuerdos).
  for (const proyecto of ['Aurora Health', 'Nexo Seguros', 'Portal Interno']) {
    await post('/api/mentees/me-david/proyectos', {
      proyecto: await idO(proyecto),
      desde: fechaRelativa(-60),
      motivoEntrada: 'Alta en el equipo',
    });
  }
  await post('/api/mentees/me-david/incidencias', { descripcion: 'Baja médica' });
  await post('/api/mentees/me-david/onetoones', {
    date: fechaRelativa(-3),
    notas: [{ tema: '¿Cómo estás?', nota: 'Con ganas' }],
    acuerdos: [{ text: 'Acuerdo uno' }, { text: 'Acuerdo dos' }],
  });

  // Elena: 1-to-1 de hace 30 días (más de 14) con 1 acuerdo pendiente → atención
  // por antigüedad (badge) y desempate por acuerdos frente a David.
  await post('/api/mentees/me-elena/onetoones', {
    date: fechaRelativa(-30),
    notas: [{ tema: '¿Cómo estás?', nota: 'A remolque' }],
    acuerdos: [{ text: 'Acuerdo de Elena' }],
  });

  // Fernando: un objetivo en curso (señal con valor distinto de cero) y ningún
  // 1-to-1 previo → sin atención, «Sin 1-to-1s» en Último 1-to-1.
  await post('/api/mentees/me-fernando/objetivos', {
    titulo: 'Certificación cloud',
    descripcion: '',
    fechaLimite: fechaRelativa(+90),
  });
}

test.describe('Mi equipo', () => {
  // Los fixtures son un único estado compartido: se preparan una vez y los tests
  // se ejecutan en serie (un solo worker para el archivo).
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: BASE_URL });
    await prepararEquipo(api);
    await api.dispose();
  });

  test('orden y señales: atención primero, desempate por acuerdos y copys exactos', async ({
    page,
    request,
    context,
  }) => {
    await iniciarSesionApi(request, context, DIEGO);
    await page.goto('/equipo');

  await expect(page.getByText('Hola, Diego')).toBeVisible();
  await expect(page.getByText('3 mentees · primero quien necesita atención')).toBeVisible();

  const tabla = page.getByRole('table', { name: 'Mi equipo' });
  await expect(tabla).toBeVisible();

  // Orden exacto: David (atención, 2 acuerdos) · Elena (atención, 1 acuerdo) · Fernando.
  const nombres = await tabla
    .locator('tbody tr [data-name]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-name')));
  expect(nombres).toEqual(['David Duarte', 'Elena Estévez', 'Fernando Fuentes']);

  const filaDavid = tabla.locator('tbody tr', { hasText: 'David Duarte' });
  await expect(filaDavid.getByText('Necesita atención')).toBeVisible();
  await expect(filaDavid.getByText('2', { exact: true })).toBeVisible();
  // Atención por incidencia con 1-to-1 reciente: el único badge es la incidencia,
  // con el texto visible «1 abierta» y el nombre accesible completo «1 incidencia
  // abierta» (texto oculto); la fecha va sin badge de antigüedad.
  const badgesDavid = filaDavid.locator('.badge');
  await expect(badgesDavid).toHaveCount(1);
  // Texto visible «1 abierta» (oculto a lectores) y texto oculto completo
  // «1 incidencia abierta» para lectores de pantalla (accesibilidad.md §Tabla Mi equipo).
  await expect(badgesDavid.locator('[aria-hidden="true"]')).toHaveText('1 abierta');
  await expect(badgesDavid.locator('.sr-only')).toHaveText('1 incidencia abierta');
  await expect(filaDavid.locator('td').last()).toContainText('hace');

  const filaElena = tabla.locator('tbody tr', { hasText: 'Elena Estévez' });
  await expect(filaElena.getByText('Necesita atención')).toBeVisible();
  await expect(filaElena.getByText('1', { exact: true })).toBeVisible();
  // Atención por antigüedad: el último 1-to-1 (hace 30 días) lleva badge con el
  // texto oculto completo «último 1-to-1 hace 4 semanas».
  const badgesElena = filaElena.locator('.badge');
  await expect(badgesElena).toHaveCount(1);
  await expect(badgesElena.locator('[aria-hidden="true"]')).toHaveText('hace 4 semanas');
  await expect(badgesElena.locator('.sr-only')).toHaveText('último 1-to-1 hace 4 semanas');

  const filaFernando = tabla.locator('tbody tr', { hasText: 'Fernando Fuentes' });
  await expect(filaFernando.getByText('Necesita atención')).toHaveCount(0);
  // Objetivo en curso con valor distinto de cero.
  await expect(filaFernando.getByText('1', { exact: true })).toBeVisible();
  // Sin 1-to-1 previo → badge «Sin 1-to-1s» (nunca «—»).
  const badgesFernando = filaFernando.locator('.badge');
  await expect(badgesFernando).toHaveCount(1);
  await expect(badgesFernando).toHaveText('Sin 1-to-1s');

  // «—» (aria-label "ninguno") para los ceros.
  await expect(filaDavid.getByRole('cell', { name: 'ninguno' }).first()).toBeVisible();
});

test('celda Proyectos [v2]: una por línea, orden alfabético y fila más alta sin romper el centrado', async ({
  page,
  request,
  context,
}) => {
  await iniciarSesionApi(request, context, DIEGO);
  await page.goto('/equipo');

  const lista = page.getByRole('list', { name: 'Proyectos de David Duarte' });
  await expect(lista.getByRole('listitem')).toHaveText([
    'Aurora Health',
    'Nexo Seguros',
    'Portal Interno',
    'Retail Nova',
  ]);

  // Sin elipsis: cada proyecto se conserva en su propia línea (sin desborde).
  for (const li of await lista.getByRole('listitem').all()) {
    expect(await li.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
  }

  // La fila con varios proyectos crece en alto y las demás celdas siguen centradas.
  const filaDavid = page.locator('tbody tr', { hasText: 'David Duarte' });
  const filaElena = page.locator('tbody tr', { hasText: 'Elena Estévez' });
  const altoDavid = await filaDavid.evaluate((el) => el.getBoundingClientRect().height);
  const altoElena = await filaElena.evaluate((el) => el.getBoundingClientRect().height);
  expect(altoDavid).toBeGreaterThan(altoElena);

  const centrado = await filaDavid.evaluate((el) => {
    const fila = el.getBoundingClientRect();
    const celda = el.querySelector<HTMLElement>('td:nth-child(3)')!.getBoundingClientRect();
    return {
      filaCentro: fila.top + fila.height / 2,
      celdaCentro: celda.top + celda.height / 2,
    };
  });
  expect(Math.abs(centrado.filaCentro - centrado.celdaCentro)).toBeLessThan(2);
});

test('contrato de accesibilidad: caption oculto, th scope y enlace en el nombre', async ({
  page,
  request,
  context,
}) => {
  await iniciarSesionApi(request, context, DIEGO);
  await page.goto('/equipo');

  const tabla = page.getByRole('table', { name: 'Mi equipo' });
  await expect(tabla).toBeVisible();

  for (const th of await tabla.locator('thead th').all()) {
    expect(await th.getAttribute('scope')).toBe('col');
  }

  // Cada fila navega vía el enlace del nombre → abre la ficha (Resumen con sidebar).
  await tabla.getByRole('link', { name: 'David Duarte' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Secciones de David Duarte' })).toBeVisible();
});

test('un solo entry en el historial: el enlace no redispara la navegación de la fila', async ({
  page,
  request,
  context,
}) => {
  await iniciarSesionApi(request, context, DIEGO);
  await page.goto('/equipo');

  await page.getByRole('table', { name: 'Mi equipo' }).getByRole('link', { name: 'David Duarte' }).click();
  await expect(page).toHaveURL(/\/mentees\/me-david$/);

  // Si la fila y el enlace duplicaran la navegación, habría dos entradas iguales
  // y un único goBack no devolvería a Mi equipo.
  await page.goBack();
  await expect(page).toHaveURL(/\/equipo$/);
});

test('la fila es activable por teclado (Enter) sin doble navegación', async ({
  page,
  request,
  context,
}) => {
  await iniciarSesionApi(request, context, DIEGO);
  await page.goto('/equipo');

  const fila = page
    .getByRole('table', { name: 'Mi equipo' })
    .getByRole('row', { name: /David Duarte/ });
  await fila.focus();
  await expect(fila).toBeFocused();

  await fila.press('Enter');
  await expect(page).toHaveURL(/\/mentees\/me-david$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/equipo$/);
});

test('estado vacío con invitación a actuar', async ({ page, request, context }) => {
  await iniciarSesionApi(request, context, LUCIA);
  const managers = (await (await request.get('/api/managers')).json()) as {
    managers: { id: string; email: string }[];
  };
  const diego = managers.managers.find((m) => m.email === DIEGO)!.id;

  // Vacía el equipo de Lucía con independencia del orden de ejecución de la suite.
  const equipo = (await (await request.get('/api/team')).json()) as {
    mentees: { id: string }[];
  };
  for (const mentee of equipo.mentees) {
    const res = await request.post(`/api/mentees/${mentee.id}/traspasos`, {
      data: { fecha: fechaRelativa(0), destinoId: diego, motivo: 'Prueba de vacío' },
    });
    expect(res.status()).toBe(201);
  }

  await page.goto('/equipo');
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toBeVisible();
  await expect(page.getByText('Aún no tienes mentees en tu equipo.')).toBeVisible();

  await page.getByRole('link', { name: 'Añadir mentee' }).click();
  await expect(page).toHaveURL(/\/ajustes\/mentees$/);
});

test('estado de carga: skeleton con aria-busy', async ({ page, request, context }) => {
  await iniciarSesionApi(request, context, DIEGO);

  // Retiene la respuesta del equipo para poder observar el estado de carga.
  let liberar: () => void = () => {};
  await page.route('**/api/team', async (route) => {
    await new Promise((resolve) => {
      liberar = () => resolve(undefined);
    });
    await route.continue();
  });

  await page.goto('/equipo');
  const skeleton = page.locator('[data-testid="skeleton-equipo"]');
  await expect(skeleton).toHaveAttribute('aria-busy', 'true');
  await expect(skeleton).toContainText('Cargando…');

  liberar();
  await expect(page.getByRole('table', { name: 'Mi equipo' })).toBeVisible();
});

test('sin skeleton si la carga tarda menos de 300 ms', async ({ page, request, context }) => {
  await iniciarSesionApi(request, context, DIEGO);

  // Respuesta a los 150 ms: por debajo del umbral de 300 ms, la petición se
  // resuelve antes de que el skeleton llegue a programarse (P4 §Estados).
  await page.route('**/api/team', async (route) => {
    await new Promise((r) => setTimeout(r, 150));
    await route.continue();
  });

  await page.goto('/equipo');
  await expect(page.getByRole('table', { name: 'Mi equipo' })).toBeVisible();

  // Aun superado ya el umbral desde la navegación, el skeleton no apareció.
  await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="skeleton-equipo"]')).toHaveCount(0);
});

test('estado de error con reintento', async ({ page, request, context }) => {
  await iniciarSesionApi(request, context, DIEGO);

  await page.route('**/api/team', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }),
  );
  await page.goto('/equipo');

  await expect(
    page.getByText('No hemos podido cargar Mi equipo. Revisa tu conexión.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();

  await page.unroute('**/api/team');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('table', { name: 'Mi equipo' })).toBeVisible();
});
});