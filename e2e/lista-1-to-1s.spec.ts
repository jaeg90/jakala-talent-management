import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { fechaHace } from './fechas.js';

// Credenciales de los managers semilla (ficticias, ver README).
const MARTA = 'manager@jakala.example';
const DIEGO = 'diego@jakala.example';
const PASSWORD = 'secreta123';

// Cada prueba crea su propia mentee (datos propios, no compartidos) y la borra en
// afterEach: las altas de 1-to-1, los cambios de acuerdos y los traspasos no
// tocan a Carla Cano ni dejan rastro en el resto de la suite.
let creadas: string[] = [];

test.beforeEach(() => {
  creadas = [];
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

async function abrirLista(page: Page, nombre: string) {
  await page.getByRole('link', { name: nombre }).click();
  await page
    .getByRole('navigation', { name: `Secciones de ${nombre}` })
    .getByRole('link', { name: '1-to-1s' })
    .click();
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

test('Lista de 1-to-1s: agrupado, filas con su meta y estados, búsqueda y enlace al detalle', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Lista E2E');

  // 1-to-1 de hace 2 días: 2 temas con nota, 1 acuerdo pendiente; «formación» en nota y acuerdo.
  await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(2),
      notas: [
        { tema: '¿Cómo estás?', nota: 'Con ganas de la semana' },
        { tema: '¿Qué tal el proyecto?', nota: 'La plataforma de formación está lista' },
      ],
      acuerdos: [{ text: 'Pedir acceso a la plataforma de formación' }],
    },
  });

  // 1-to-1 de hace 20 días: 1 tema con nota y 1 acuerdo ya cumplido; «formación» solo en el acuerdo.
  const segundo = await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(20),
      notas: [{ tema: '¿Qué tal los objetivos?', nota: 'Seguimiento del trimestre' }],
      acuerdos: [{ text: 'Renovar la formación de Azure' }],
    },
  });
  const segundoId = (((await segundo.json()) as { acuerdos: { id: string }[] }).acuerdos[0]!).id;
  await request.post(`/api/acuerdos/${segundoId}/complete`);

  // 1-to-1 de hace más de un año, sin acuerdos (para el separador del año anterior y el «—»).
  await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(400),
      notas: [{ tema: 'Primer contacto', nota: 'Comenzamos' }],
      acuerdos: [],
    },
  });

  await entrar(page, MARTA);
  await abrirLista(page, 'Lino Lista E2E');

  // Cabecera: título y subtítulo con el total y la relativa del último.
  await expect(page.getByRole('heading', { name: '1-to-1s' })).toBeVisible();
  await expect(page.locator('.ficha__subtitulo')).toContainText('3 1-to-1s · el último, hace 2 días');

  // Buscador con label oculto y placeholder.
  const buscador = page.getByLabel('Buscar en los 1-to-1s de Lino');
  await expect(buscador).toBeVisible();
  await expect(page.getByPlaceholder('Buscar en notas y acuerdos')).toBeVisible();

  // Lista completa sin paginación: tres filas agrupadas por año (año actual y anterior).
  await expect(page.getByRole('link', { name: /1-to-1 del / })).toHaveCount(3);
  await expect(page.locator('.lista__grupo').first()).toContainText(`${new Date().getUTCFullYear()}`);
  await expect(page.locator('.lista__grupo').last()).toContainText(fechaHace(400).slice(0, 4));

  // Meta de cada fila: temas con nota, acuerdos pendientes/cumplidos y sin acuerdos.
  await expect(page.getByRole('link', { name: /2 temas con nota, 1 acuerdo pendiente/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /1 tema con nota, 1 acuerdo cumplido/ })).toContainText('1 cumplido');
  await expect(page.getByRole('link', { name: /sin acuerdos/ })).toContainText('—');

  // Todas las filas las registró Marta: ninguna lleva «Registrado por».
  await expect(page.getByText(/Registrado por/)).toHaveCount(0);

  // Búsqueda en cliente: contador, resaltado y fragmento con «En …» y « · y n más».
  await buscador.fill('formación');
  await expect(page.getByText('2 1-to-1s contienen «formación»')).toBeVisible();
  await expect(page.locator('mark.coincidencia')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /En «¿Qué tal el proyecto\?» · y 1 más/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /, En un acuerdo/ })).toBeVisible();

  // Sin coincidencias: copy exacto + «Borrar búsqueda».
  await buscador.fill('zzzz');
  await expect(page.getByText('Ningún 1-to-1 contiene «zzzz».')).toBeVisible();
  await page.getByRole('button', { name: 'Borrar búsqueda' }).last().click();
  await expect(page.getByRole('link', { name: /1-to-1 del / })).toHaveCount(3);
  await expect(buscador).toHaveValue('');
  await expect(buscador).toBeFocused();

  // Esc borra la búsqueda y devuelve la lista completa.
  await buscador.fill('formación');
  await expect(page.getByText('2 1-to-1s contienen «formación»')).toBeVisible();
  await buscador.press('Escape');
  await expect(page.getByRole('link', { name: /1-to-1 del / })).toHaveCount(3);

  // Desde la lista se llega al detalle (stub #31): la fila enlaza a su URL.
  await page.getByRole('link', { name: /2 temas con nota, 1 acuerdo pendiente/ }).click();
  await expect(page).toHaveURL(new RegExp(`/mentees/${menteeId}/1-to-1s/`));
  await expect(page.getByRole('heading', { name: '1-to-1s' })).toBeVisible();
});

test('Lista de 1-to-1s: estado vacío con su copy exacto', async ({ page }) => {
  await entrar(page, MARTA);
  // Beatriz Blanco: mentee de la semilla sin 1-to-1s, incidencias ni objetivos.
  await abrirLista(page, 'Beatriz Blanco');

  await expect(
    page.getByText('Aún no habéis tenido ningún 1-to-1. Regístralo al terminar la conversación para seguir sus acuerdos.'),
  ).toBeVisible();
  // La acción del vacío resuelve la pantalla (además del botón primario de la cabecera).
  await expect(page.getByRole('link', { name: 'Registrar 1-to-1' })).toHaveCount(2);

  // Sin 1-to-1s, no hay subtítulo «n 1-to-1s…» en la cabecera.
  await expect(page.locator('.ficha__subtitulo')).toHaveCount(0);
});

test('«Registrado por» solo aparece cuando lo registró otro manager (heredado por traspaso)', async ({
  page,
  request,
}) => {
  const menteeId = await nuevaMentee(request, 'Lino Traspaso E2E');
  const fecha = fechaHace(0);

  // Marta registra un 1-to-1 propio.
  await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: { date: fecha, notas: [{ tema: '¿Cómo estás?', nota: 'Mío, de Marta' }], acuerdos: [] },
  });

  // La mentee se traspasa a Diego, que registra un 1-to-1 y la devuelve a Marta.
  await request.post(`/api/mentees/${menteeId}/traspasos`, {
    data: { fecha, destinoId: 'seed-manager-2', motivo: 'Fixture «Registrado por»' },
  });
  await request.post('/api/login', { data: { email: DIEGO, password: PASSWORD } });
  await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: { date: fecha, notas: [{ tema: '¿Qué tal el proyecto?', nota: 'Heredado de Diego' }], acuerdos: [] },
  });
  await request.post(`/api/mentees/${menteeId}/traspasos`, {
    data: { fecha, destinoId: 'seed-manager-1', motivo: 'Devuelta a Marta' },
  });

  await entrar(page, MARTA);
  await abrirLista(page, 'Lino Traspaso E2E');

  // La fila registrada por Diego lo indica; la registrada por Marta no.
  const filaDiego = page.locator('.fila-1to1').filter({ hasText: 'Heredado de Diego' });
  await expect(filaDiego).toContainText('Registrado por Diego Domínguez');
  await expect(filaDiego).toHaveAttribute('aria-label', /, registrado por Diego Domínguez/);

  const filaMarta = page.locator('.fila-1to1').filter({ hasText: 'Mío, de Marta' });
  await expect(filaMarta).not.toContainText('Registrado por');
});