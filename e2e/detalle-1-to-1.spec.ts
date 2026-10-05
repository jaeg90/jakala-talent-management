import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { fechaHace } from './fechas.js';

// Credenciales de la manager semilla (ficticias, ver README).
const MARTA = 'manager@jakala.example';
const PASSWORD = 'secreta123';

// Cada prueba crea sus propios datos (mentees y, para el escenario del tema
// genérico retirado, un manager aislado) y los borra en afterEach: así la
// mutación de la plantilla nunca toca la del manager compartido (sin rastro).
let creadas: string[] = [];
let managers: string[] = [];

test.beforeEach(() => {
  creadas = [];
  managers = [];
});

test.afterEach(async ({ page }, testInfo) => {
  await page.close();
  const db = new Database(testInfo.config.metadata.dbPath as string);
  try {
    db.pragma('foreign_keys = ON');
    db.transaction(() => {
      for (const id of creadas) {
        db.prepare('DELETE FROM acuerdos WHERE onetoone_id IN (SELECT id FROM onetoones WHERE mentee_id = ?)').run(id);
        db.prepare('DELETE FROM notas_por_tema WHERE onetoone_id IN (SELECT id FROM onetoones WHERE mentee_id = ?)').run(id);
        db.prepare('DELETE FROM onetoones WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM temas_propios WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM objetivos WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM incidencias WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM cambios_proyecto WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM traspasos WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM asignaciones WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM mentees WHERE id = ?').run(id);
      }
      for (const id of managers) {
        db.prepare('DELETE FROM plantilla WHERE manager_id = ?').run(id);
        db.prepare('DELETE FROM managers WHERE id = ?').run(id);
      }
    })();
  } finally {
    db.close();
  }
});

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

/** Da de alta una mentee propia de Marta y la registra para el borrado final. */
async function nuevaMentee(request: APIRequestContext, nombre: string): Promise<string> {
  await request.post('/api/login', { data: { email: MARTA, password: PASSWORD } });
  const alta = await request.post('/api/mentees', {
    data: { name: nombre, proyectos: [], enEquipoDesde: fechaHace(90) },
  });
  expect(alta.status()).toBe(201);
  const id = ((await alta.json()) as { id: string }).id;
  creadas.push(id);
  return id;
}

test('detalle fiel: cabecera, temas tal como se registraron y chip propio persistido', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Detalle E2E');

  // Un tema propio que se retira después de registrar: el detalle debe seguir
  // mostrándolo con su chip «propio» (el chip se persiste con la nota, §11a).
  await request.post(`/api/mentees/${menteeId}/temas`, { data: { tema: 'Formación en curso' } });
  const temasResp = await request.get(`/api/mentees/${menteeId}/temas`);
  const propioId = ((await temasResp.json()) as { temas: { id: string; tema: string }[] }).temas.find(
    (t) => t.tema === 'Formación en curso',
  )!.id;

  await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(0),
      notas: [
        { tema: '¿Cómo estás?', nota: 'Animada con la semana', propio: false },
        { tema: 'Formación en curso', nota: 'Empieza AZ-900 la semana que viene', propio: true },
        { tema: '¿Qué tal los objetivos?', nota: '' },
      ],
      acuerdos: [{ text: 'Pedir acceso a la plataforma de formación' }],
    },
  });

  await request.post(`/api/mentees/${menteeId}/temas/${propioId}/retirar`);

  await entrar(page, MARTA);
  await page.goto(`/mentees/${menteeId}/1-to-1s`);
  await page.getByRole('link', { name: /1-to-1 del / }).first().click();

  // Cabecera: h1 y fila meta con el registrador.
  await expect(page.getByRole('heading', { name: /1-to-1 del / })).toBeVisible();
  await expect(page.locator('.detalle-1to1__meta')).toContainText('Registrado por Marta Manager');

  // Temas tal como se registraron: el propio retirado conserva su chip y su nota.
  await expect(page.getByRole('heading', { name: /Formación en curso/ }).locator('.chip')).toHaveText('propio');
  await expect(page.getByText('Empieza AZ-900 la semana que viene')).toBeVisible();
  // El tema genérico no lleva chip «propio».
  await expect(page.getByRole('heading', { name: /¿Cómo estás\?/ }).locator('.chip')).toHaveCount(0);

  // Tema sin nota: «Sin nota.».
  const temaSinNota = page.locator('.detalle-1to1__tema', { hasText: '¿Qué tal los objetivos?' });
  await expect(temaSinNota).toContainText('Sin nota.');

  // Acuerdos: 1 pendiente (el cumplimiento se cubre en su propio test).
  await expect(page.getByRole('heading', { name: 'Acuerdos · 1 pendiente' })).toBeVisible();

  // «Marcar cumplido» queda anclado al extremo derecho de la fila (§11a): la fila
  // flex crece completa (el contenedor `.check` incluido, no solo el texto), así que
  // el borde derecho del botón coincide con el del contenido de la fila.
  const fila = page.locator('.detalle-1to1__acuerdo').first();
  const anclaje = await fila.evaluate((el) => {
    const boton = el.querySelector(':scope > .detalle-1to1__marcar')!;
    const fila = el.getBoundingClientRect();
    const botonRect = boton.getBoundingClientRect();
    return {
      derechaFila: fila.right - parseFloat(getComputedStyle(el).paddingRight),
      derechaBoton: botonRect.right,
    };
  });
  expect(Math.abs(anclaje.derechaFila - anclaje.derechaBoton)).toBeLessThan(1);
});

test('un tema genérico retirado de la plantilla y recreado como propio no se clasifica como propio en el detalle', async ({
  page,
  request,
}) => {
  // Manager aislado con su propia plantilla: retirar y recrear el tema no deja
  // rastro en la plantilla compartida de Marta (AGENTS.md · E2E sin contaminación).
  const email = `detalle-propio-${Date.now()}@example.com`;
  await request.post('/api/login', { data: { email: MARTA, password: PASSWORD } });
  const alta = await request.post('/api/managers', {
    data: { name: 'Manager Detalle E2E', email },
  });
  expect(alta.status()).toBe(201);
  const { manager, contrasenaTemporal } = (await alta.json()) as {
    manager: { id: string };
    contrasenaTemporal: string;
  };
  managers.push(manager.id);
  await request.post('/api/login', { data: { email, password: contrasenaTemporal } });
  await request.post('/api/cuenta/contrasena', {
    data: { actual: contrasenaTemporal, nueva: PASSWORD },
  });
  await request.post('/api/login', { data: { email, password: PASSWORD } });

  const menteeAlta = await request.post('/api/mentees', {
    data: { name: 'Lino Propio Retro E2E', proyectos: [], enEquipoDesde: fechaHace(90) },
  });
  expect(menteeAlta.status()).toBe(201);
  const menteeId = ((await menteeAlta.json()) as { id: string }).id;
  creadas.push(menteeId);

  // Registra el 1-to-1 con «¿Qué tal el proyecto?» como tema GENÉRICO (el `propio`
  // lo calcula el cliente, pero aquí se fuerza false para el contrato del test).
  const registro = await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(0),
      notas: [{ tema: '¿Qué tal el proyecto?', nota: 'Va bien', propio: false }],
      acuerdos: [],
    },
  });
  expect(registro.status()).toBe(201);
  const unoId = ((await registro.json()) as { id: string }).id;

  // Retira el genérico de la plantilla y lo crea como tema propio con el mismo nombre.
  const plantilla = (await (await request.get('/api/plantilla')).json()) as {
    temas: { id: string; tema: string }[];
  };
  const generico = plantilla.temas.find((t) => t.tema === '¿Qué tal el proyecto?')!;
  await request.post(`/api/plantilla/temas/${generico.id}/retirar`);
  await request.post(`/api/mentees/${menteeId}/temas`, { data: { tema: '¿Qué tal el proyecto?' } });

  // El detalle conserva la nota tal como se registró y NO muestra el chip «propio»
  // (el tema era genérico en ese momento, aunque ahora exista un propio homónimo).
  await entrar(page, email);
  await page.goto(`/mentees/${menteeId}/1-to-1s/${unoId}`);
  await expect(page.getByRole('heading', { name: /¿Qué tal el proyecto\?/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /¿Qué tal el proyecto\?/ }).locator('.chip')).toHaveCount(0);
});

test('marcar cumplido: elemento en medio, último y lista vacía, con destino de foco', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Marcar E2E');
  await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(0),
      notas: [{ tema: '¿Cómo estás?', nota: 'Bien' }],
      acuerdos: [
        { text: 'Primer acuerdo de foco' },
        { text: 'Segundo acuerdo de foco' },
        { text: 'Tercer acuerdo de foco' },
      ],
    },
  });

  await entrar(page, MARTA);
  await page.goto(`/mentees/${menteeId}/1-to-1s`);
  await page.getByRole('link', { name: /1-to-1 del / }).first().click();
  await expect(page.getByRole('heading', { name: 'Acuerdos · 3 pendientes' })).toBeVisible();

  // Elemento en medio: el foco salta al «Marcar cumplido» siguiente.
  await page.getByRole('button', { name: 'Marcar cumplido: Segundo acuerdo de foco' }).click();
  await expect(page.getByRole('button', { name: 'Marcar cumplido: Tercer acuerdo de foco' })).toBeFocused();

  // Último elemento (quedan dos): el foco salta al «Marcar cumplido» anterior.
  await page.getByRole('button', { name: 'Marcar cumplido: Tercer acuerdo de foco' }).click();
  await expect(page.getByRole('button', { name: 'Marcar cumplido: Primer acuerdo de foco' })).toBeFocused();

  // Lista que queda vacía: el foco va a la etiqueta «Acuerdos · todos cumplidos».
  await page.getByRole('button', { name: 'Marcar cumplido: Primer acuerdo de foco' }).click();
  const titulo = page.getByRole('heading', { name: 'Acuerdos · todos cumplidos' });
  await expect(titulo).toBeVisible();
  await expect(titulo).toBeFocused();
  await expect(page.locator('.badge--cumplido')).toHaveCount(3);
});

test('marcar cumplido que falla deja el checkbox sin marcar y muestra el aviso', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Error Marcar E2E');
  await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(0),
      notas: [{ tema: '¿Cómo estás?', nota: 'Bien' }],
      acuerdos: [{ text: 'Acuerdo que fallará' }],
    },
  });

  await entrar(page, MARTA);
  await page.goto(`/mentees/${menteeId}/1-to-1s`);
  await page.getByRole('link', { name: /1-to-1 del / }).first().click();

  await page.route('**/api/acuerdos/*/complete', (route) =>
    route.fulfill({ status: 500, json: { error: 'fallo simulado' } }),
  );
  const checkbox = page.getByRole('checkbox');
  await checkbox.click();
  await expect(page.getByRole('alert')).toContainText('No se ha podido guardar. Inténtalo de nuevo.');
  // El checkbox es controlado: no queda marcado nativamente antes de la respuesta.
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole('heading', { name: 'Acuerdos · 1 pendiente' })).toBeVisible();
});

test('«Ver 1-to-1 completo» del Resumen y el clic del Historial navegan al detalle', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Navegacion E2E');
  const uno = await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(1),
      notas: [{ tema: '¿Cómo estás?', nota: 'Todo en orden' }],
      acuerdos: [{ text: 'Revisar la carga' }],
    },
  });
  const unoId = ((await uno.json()) as { id: string }).id;

  await entrar(page, MARTA);

  // Resumen → «Ver 1-to-1 completo».
  await page.goto(`/mentees/${menteeId}`);
  await page.getByRole('link', { name: 'Ver 1-to-1 completo' }).click();
  await expect(page).toHaveURL(new RegExp(`/mentees/${menteeId}/1-to-1s/${unoId}$`));
  await expect(page.getByRole('heading', { name: /1-to-1 del / })).toBeVisible();

  // Historial → clic en el evento 1-to-1.
  await page.goto(`/mentees/${menteeId}/historial`);
  await page.getByRole('link', { name: /1 tema · 1 acuerdo/ }).click();
  await expect(page).toHaveURL(new RegExp(`/mentees/${menteeId}/1-to-1s/${unoId}$`));
  await expect(page.getByRole('heading', { name: /1-to-1 del / })).toBeVisible();
});

test('id inexistente y sin acuerdos muestran sus estados', async ({ page, request }) => {
  const menteeId = await nuevaMentee(request, 'Lino Estados E2E');
  await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(0),
      notas: [{ tema: '¿Cómo estás?', nota: 'Bien' }],
      acuerdos: [],
    },
  });

  await entrar(page, MARTA);

  // Id inexistente → «Este 1-to-1 no existe o no es de {mentee}» + enlace.
  await page.goto(`/mentees/${menteeId}/1-to-1s/no-existe`);
  await expect(page.getByText('Este 1-to-1 no existe o no es de Lino Estados E2E.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver sus 1-to-1s' })).toBeVisible();

  // Sin acuerdos → «En este 1-to-1 no se acordó nada.»
  await page.goto(`/mentees/${menteeId}/1-to-1s`);
  await page.getByRole('link', { name: /1-to-1 del / }).first().click();
  await expect(page.getByText('En este 1-to-1 no se acordó nada.')).toBeVisible();
});

test('el alta guarda los temas sin nota y el detalle muestra «Sin nota.» desde el flujo normal', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Alta Sin Nota E2E');

  await entrar(page, MARTA);
  await page.goto(`/mentees/${menteeId}/1-to-1s/nuevo`);
  await expect(page.getByRole('heading', { name: 'Nuevo 1-to-1' })).toBeVisible();

  // Relleno solo un tema: los demás se guardan igual con su nota vacía (§11a deja
  // de filtrar notas vacías; «Sin nota.» es alcanzable desde el flujo normal).
  await page.getByRole('region', { name: 'Temas' }).getByLabel('¿Cómo estás?').fill('Solo esta nota');
  await page.getByRole('button', { name: 'Guardar 1-to-1' }).click();

  // Vuelve al Resumen con el aviso de éxito; desde allí se abre el detalle.
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver 1-to-1 completo' }).click();

  await expect(page.getByRole('heading', { name: /1-to-1 del / })).toBeVisible();
  await expect(page.getByText('Solo esta nota')).toBeVisible();
  // Los temas del formulario que quedaron vacíos muestran «Sin nota.» (no se filtraron al guardar).
  const temaSinNota = page.locator('.detalle-1to1__tema', { hasText: '¿Qué tal el proyecto?' });
  await expect(temaSinNota).toContainText('Sin nota.');
});

test('cambiar de 1-to-1 en SPA no pinta el detalle anterior bajo la URL nueva', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Cambiar E2E');

  // Dos 1-to-1s de la misma mentee con contenido distinto, en URLs distintas.
  const primero = await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(2),
      notas: [{ tema: '¿Cómo estás?', nota: 'Nota del primer 1-to-1' }],
      acuerdos: [],
    },
  });
  const primeroId = ((await primero.json()) as { id: string }).id;
  const segundo = await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(0),
      notas: [{ tema: '¿Cómo estás?', nota: 'Nota del segundo 1-to-1' }],
      acuerdos: [],
    },
  });
  const segundoId = ((await segundo.json()) as { id: string }).id;

  await entrar(page, MARTA);
  await page.goto(`/mentees/${menteeId}/1-to-1s/${primeroId}`);
  await expect(page.getByText('Nota del primer 1-to-1')).toBeVisible();

  // Retiene la respuesta del segundo 1-to-1 para observar el estado de carga bajo
  // los parámetros nuevos: mientras pende, el contenido del anterior no puede verse.
  let liberar: () => void = () => {};
  await page.route(`**/api/mentees/${menteeId}/onetoones/${segundoId}`, async (route) => {
    await new Promise((resolve) => {
      liberar = () => resolve(undefined);
    });
    await route.continue();
  });

  // Navegación de cliente (sin recarga): el detalle cambia de 1-to-1 con el mismo
  // componente montado. La key por 1-to-1 descarta el estado cargado del anterior.
  await page.evaluate((url) => {
    window.history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/mentees/${menteeId}/1-to-1s/${segundoId}`);

  // Mientras la carga del nuevo está pendiente, el anterior no es visible: bajo la
  // URL nueva se muestra el estado de carga (skeleton), nunca el detalle anterior.
  await expect(page.getByText('Nota del primer 1-to-1')).toHaveCount(0);
  await expect(page.locator('[data-testid="skeleton-detalle-1to1"]')).toHaveAttribute('aria-busy', 'true');

  liberar();
  await expect(page.getByText('Nota del segundo 1-to-1')).toBeVisible();
  await expect(page.getByText('Nota del primer 1-to-1')).toHaveCount(0);
});

test('cambiar de mentee no pinta el detalle anterior bajo la URL nueva', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Cambiar Mentee A');
  const otraId = await nuevaMentee(request, 'Lino Cambiar Mentee B');

  const unoA = await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(1),
      notas: [{ tema: '¿Cómo estás?', nota: 'Nota de la primera mentee' }],
      acuerdos: [],
    },
  });
  const unoAId = ((await unoA.json()) as { id: string }).id;
  const unoB = await request.post(`/api/mentees/${otraId}/onetoones`, {
    data: {
      date: fechaHace(0),
      notas: [{ tema: '¿Cómo estás?', nota: 'Nota de la segunda mentee' }],
      acuerdos: [],
    },
  });
  const unoBId = ((await unoB.json()) as { id: string }).id;

  await entrar(page, MARTA);
  await page.goto(`/mentees/${menteeId}/1-to-1s/${unoAId}`);
  await expect(page.getByText('Nota de la primera mentee')).toBeVisible();

  // Retiene la lectura del 1-to-1 de la segunda mentee: mientras pende, el detalle
  // de la primera no puede verse bajo la URL nueva.
  let liberar: () => void = () => {};
  await page.route(`**/api/mentees/${otraId}/onetoones/${unoBId}`, async (route) => {
    await new Promise((resolve) => {
      liberar = () => resolve(undefined);
    });
    await route.continue();
  });

  await page.evaluate((url) => {
    window.history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/mentees/${otraId}/1-to-1s/${unoBId}`);

  await expect(page.getByText('Nota de la primera mentee')).toHaveCount(0);
  await expect(page.locator('[data-testid="skeleton-detalle-1to1"]')).toHaveAttribute('aria-busy', 'true');

  liberar();
  await expect(page.getByText('Nota de la segunda mentee')).toBeVisible();
  await expect(page.getByText('Nota de la primera mentee')).toHaveCount(0);
});