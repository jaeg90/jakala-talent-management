import { expect, test, type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { fechaHace } from './fechas';
import { fechaMesAnio } from '../web/src/lib/fechas';

let proyectosCreados: string[];
let menteesCreadas: string[];

test.beforeEach(async ({ page }) => {
  proyectosCreados = [];
  menteesCreadas = [];
  await page.route('**/api/proyectos', async (route) => {
    const response = await route.fetch();
    if (route.request().method() === 'POST' && response.status() === 201) {
      proyectosCreados.push((await response.json() as { id: string }).id);
    }
    await route.fulfill({ response });
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('manager@jakala.example');
  await page.getByLabel('Contraseña', { exact: true }).fill('secreta123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/equipo$/);
});

test.afterEach(async ({ page }, testInfo) => {
  await page.close();
  const db = new Database(testInfo.config.metadata.dbPath as string);
  try {
    db.pragma('foreign_keys = ON');
    db.transaction(() => {
      for (const id of menteesCreadas) {
        db.prepare('DELETE FROM asignaciones WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM mentees WHERE id = ?').run(id);
      }
      for (const id of proyectosCreados) db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    })();
  } finally { db.close(); }
});

async function abrir(page: Page) {
  await page.goto('/ajustes/perfil');
  await page.getByRole('link', { name: 'Proyectos', exact: true }).click();
  await expect(page).toHaveURL(/\/ajustes\/proyectos$/);
  await expect(page.getByRole('link', { name: 'Proyectos', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Añadir proyecto', exact: true })).toBeEnabled();
}

async function crear(page: Page, name: string) {
  const res = await page.request.post('/api/proyectos', { data: { name } });
  expect(res.status()).toBe(201);
  const proyecto = await res.json() as { id: string; name: string };
  proyectosCreados.push(proyecto.id);
  return proyecto;
}

test('alta por UI, duplicados vigentes y retirados, modal accesible, retirada y reactivación', async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajustes');
  await expect(page.getByText('Aparecen al añadir una mentee a un proyecto. Solo se puede retirar un proyecto sin mentees.')).toBeVisible();
  const nombre = page.getByRole('textbox', { name: /^Nombre del proyecto/ });
  await nombre.fill('  Catálogo E2E  ');
  await page.getByRole('button', { name: 'Añadir proyecto', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Proyecto «Catálogo E2E» añadido.');
  await expect(nombre).toBeFocused();
  await expect(nombre).toHaveValue('');
  const retirar = page.getByRole('button', { name: 'Retirar proyecto: Catálogo E2E', exact: true });
  const fila = page.getByRole('listitem').filter({ has: retirar });
  await expect(fila).toContainText('Sin mentees');
  const estiloFila = await fila.evaluate((n) => {
    const estilo = getComputedStyle(n);
    const muestra = document.createElement('span');
    muestra.style.background = 'var(--color-superficie-hundida)';
    n.append(muestra);
    const fondo = getComputedStyle(muestra).backgroundColor;
    muestra.remove();
    return { fondo: estilo.backgroundColor, esperado: fondo, radio: estilo.borderRadius, padding: estilo.padding };
  });
  expect(estiloFila.fondo).toBe(estiloFila.esperado);
  expect(estiloFila.radio).toBe('10px');
  expect(estiloFila.padding).toBe('11px 14px');
  expect(await fila.locator('.catalogo-proyectos__nombre').evaluate((n) => getComputedStyle(n).fontWeight)).toBe('600');
  await fila.locator('.catalogo-proyectos__nombre').hover();
  await expect(fila).not.toHaveCSS('cursor', 'pointer');
  await retirar.hover();
  await expect(retirar).toHaveCSS('cursor', 'pointer');
  await expect(retirar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(retirar).toHaveCSS('padding', '0px');

  for (const estado of ['vigente', 'retirado']) {
    await nombre.fill(' Catálogo E2E ');
    await page.getByRole('button', { name: 'Añadir proyecto', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Ya existe un proyecto con ese nombre.');
    await expect(nombre).toHaveAttribute('aria-invalid', 'true');
    const descripcion = await nombre.getAttribute('aria-describedby');
    expect(await page.locator(`[id="${descripcion}"]`).textContent()).toBe('Ya existe un proyecto con ese nombre.');
    await expect(nombre).toBeFocused();
    if (estado === 'retirado') break;

    await retirar.click();
    const dialogo = page.getByRole('alertdialog', { name: '¿Retirar Catálogo E2E del catálogo?' });
    await expect(dialogo).toBeVisible();
    expect(await dialogo.evaluate((n) => n.tagName)).toBe('DIALOG');
    await expect(dialogo).toHaveAccessibleDescription('Dejará de aparecer al añadir mentees a un proyecto. Las entradas y salidas pasadas que lo mencionan se mantienen en el historial. Puedes volver a activarlo cuando quieras.');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialogo.getByRole('button', { name: 'Retirar proyecto', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(retirar).toBeFocused();
    await retirar.click();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(retirar).toBeFocused();
    await retirar.click();
    await dialogo.getByRole('button', { name: 'Retirar proyecto', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Proyecto «Catálogo E2E» retirado.');
    await expect(retirar).toHaveCount(0);
    const retirados = page.getByRole('region', { name: 'Proyectos retirados' });
    await expect(retirados.getByRole('heading')).toHaveText('Retirados · 1');
    await expect(retirados).toContainText(`Retirado · ${fechaMesAnio(fechaHace(0))}`);
    await expect(retirados.locator('time')).toHaveAttribute('datetime', fechaHace(0));
    const filaRetirada = retirados.getByRole('listitem');
    await expect(filaRetirada).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(filaRetirada).toHaveCSS('border-radius', '14px');
    const estiloRetirado = await filaRetirada.evaluate((n) => {
      const muestra = document.createElement('span');
      muestra.style.background = 'var(--color-neutro-badge)';
      muestra.style.color = 'var(--color-neutro-texto)';
      muestra.style.boxShadow = 'inset 0 0 0 var(--borde-fino) var(--color-borde)';
      n.append(muestra);
      const esperado = getComputedStyle(muestra);
      const badge = getComputedStyle(n.querySelector('.badge')!);
      const resultado = {
        fondo: badge.backgroundColor, fondoEsperado: esperado.backgroundColor,
        color: badge.color, colorEsperado: esperado.color,
        borde: getComputedStyle(n).boxShadow, bordeEsperado: esperado.boxShadow,
      };
      muestra.remove();
      return resultado;
    });
    expect(estiloRetirado.fondo).toBe(estiloRetirado.fondoEsperado);
    expect(estiloRetirado.color).toBe(estiloRetirado.colorEsperado);
    expect(estiloRetirado.borde).toBe(estiloRetirado.bordeEsperado);
    const activar = retirados.getByRole('button', { name: 'Volver a activar: Catálogo E2E' });
    await activar.hover();
    await expect(activar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(activar).toHaveCSS('padding', '0px');
  }
  await page.getByRole('button', { name: 'Volver a activar: Catálogo E2E' }).click();
  await expect(page.getByRole('status')).toHaveText('Proyecto «Catálogo E2E» vuelve a estar activo.');
  await expect(retirar).toBeVisible();
  await expect(nombre).toBeFocused();
  await expect(page.getByRole('region', { name: 'Proyectos retirados' })).toHaveCount(0);
});

test('recuento vigente: una mentee en varios proyectos suma en cada uno, salidas no suman y Tiene mentees bloquea', async ({ page }) => {
  const a = await crear(page, 'Recuento A E2E');
  const b = await crear(page, 'Recuento B E2E');
  for (const name of ['Mentee recuento uno', 'Mentee recuento dos']) {
    const res = await page.request.post('/api/mentees', { data: { name, proyectos: [a.id, b.id], enEquipoDesde: fechaHace(1) } });
    expect(res.status()).toBe(201);
    menteesCreadas.push((await res.json() as { id: string }).id);
  }
  expect((await page.request.post(`/api/mentees/${menteesCreadas[1]}/proyectos/${b.id}/salir`, {
    data: { hasta: fechaHace(0), motivoSalida: 'Fin E2E' },
  })).status()).toBe(200);
  await abrir(page);
  for (const [name, texto] of [[a.name, '2 mentees'], [b.name, '1 mentee']]) {
    const fila = page.getByRole('list', { name: 'Proyectos vigentes' }).getByRole('listitem').filter({ hasText: name });
    await expect(fila).toContainText(texto);
    await expect(fila).toContainText('Tiene mentees');
    await expect(fila.getByRole('button')).toHaveCount(0);
    await fila.locator('.catalogo-proyectos__nombre').hover();
    await expect(fila).not.toHaveCSS('cursor', 'pointer');
    expect(await fila.locator('.catalogo-proyectos__meta').last().evaluate((n) => getComputedStyle(n).fontSize)).toBe('13px');
  }
});

test('foco al retirar y reactivar el elemento de en medio, el último y al vaciar las listas', async ({ page }) => {
  const propios = await Promise.all(['A', 'B', 'C'].map((n) => crear(page, `${n} Foco E2E`)));
  await page.route('**/api/proyectos', async (route) => {
    const response = await route.fetch();
    const body = await response.json() as { proyectos: { id: string }[] };
    await route.fulfill({ response, json: { proyectos: body.proyectos.filter((p) => propios.some((propio) => propio.id === p.id)) } });
  });
  await abrir(page);
  const boton = (name: string) => page.getByRole('button', { name: `Retirar proyecto: ${name} Foco E2E` });
  for (const [name, siguiente] of [['B', 'C'], ['C', 'A'], ['A', null]]) {
    await boton(name!).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Retirar proyecto', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(siguiente ? boton(siguiente) : page.getByLabel('Nombre del proyecto')).toBeFocused();
  }
  await expect(page.getByRole('heading', { name: 'Proyectos vigentes · 0' })).toBeVisible();
  await expect(page.getByText('Añade un proyecto para que aparezca al añadir mentees a un proyecto.')).toBeVisible();
  const activar = (name: string) => page.getByRole('button', { name: `Volver a activar: ${name} Foco E2E` });
  for (const [name, siguiente] of [['B', 'C'], ['C', 'A'], ['A', null]]) {
    await activar(name!).click();
    await expect(activar(name!)).toHaveCount(0);
    await expect(siguiente ? activar(siguiente) : page.getByLabel('Nombre del proyecto')).toBeFocused();
  }
  await expect(page.getByRole('region', { name: 'Proyectos retirados' })).toHaveCount(0);
});

test('P4: skeleton diferido, error de carga y reintento, catálogo vacío con alta habilitada', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => { soltar = resolve; });
  await page.route('**/api/proyectos', async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
  });
  await page.goto('/ajustes/proyectos');
  await expect(page.getByRole('button', { name: 'Añadir proyecto', exact: true })).toBeDisabled();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.clock.runFor(300);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toContainText('Cargando…');
  const barras = page.locator('.catalogo-proyectos__skeleton[aria-hidden="true"]');
  await expect(barras).toHaveCount(3);
  const estilo = await barras.first().evaluate((n) => {
    const s = getComputedStyle(n);
    const esperado = document.createElement('span');
    esperado.style.background = 'var(--color-superficie-hundida)';
    n.parentElement!.append(esperado);
    const fondo = getComputedStyle(esperado).backgroundColor;
    esperado.remove();
    return { fondo: s.backgroundColor, esperado: fondo, animation: s.animationName, duration: s.animationDuration };
  });
  expect(estilo.fondo).toBe(estilo.esperado);
  expect(estilo.animation).toBe('pulso-esqueleto');
  expect(estilo.duration).toBe('1.2s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await barras.first().evaluate((n) => getComputedStyle(n).animationDuration)).toBe('0s');
  soltar();
  await expect(page.getByRole('alert')).toContainText('No hemos podido cargar los proyectos. Revisa tu conexión.');
  await expect(page.getByRole('button', { name: 'Añadir proyecto', exact: true })).toBeDisabled();
  await page.route('**/api/proyectos', (route) => route.fulfill({ json: { proyectos: [] } }));
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Proyectos vigentes · 0' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Añadir proyecto', exact: true })).toBeEnabled();
});

test('P4: error de alta conserva nombre, enviando evita dobles envíos y campo vacío se enfoca', async ({ page }) => {
  await abrir(page);
  const nombre = page.getByRole('textbox', { name: /^Nombre del proyecto/ });
  await page.getByRole('button', { name: 'Añadir proyecto', exact: true }).click();
  await expect(nombre).toBeFocused();
  await expect(nombre).toHaveAttribute('aria-invalid', 'true');
  await nombre.fill('Conservado E2E');
  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => { soltar = resolve; });
  let peticiones = 0;
  await page.route('**/api/proyectos', async (route) => {
    peticiones += 1;
    await espera;
    await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
  });
  await page.getByRole('button', { name: 'Añadir proyecto', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Añadiendo…' })).toBeDisabled();
  await page.getByRole('form', { name: 'Añadir proyecto' }).evaluate((n) => (n as HTMLFormElement).requestSubmit());
  soltar();
  await expect(page.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  expect(peticiones).toBe(1);
  await expect(nombre).toHaveValue('Conservado E2E');
  await expect(page.getByRole('button', { name: 'Añadir proyecto', exact: true })).toBeEnabled();
});

test('P4: errores de retirada y reactivación no mueven filas y permiten reintentar', async ({ page }) => {
  const proyecto = await crear(page, 'Errores E2E');
  await abrir(page);
  await page.getByRole('button', { name: 'Retirar proyecto: Errores E2E' }).click();
  const dialogo = page.getByRole('alertdialog');
  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => { soltar = resolve; });
  await page.route(`**/api/proyectos/${proyecto.id}/retirar`, async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
  });
  await dialogo.getByRole('button', { name: 'Retirar proyecto', exact: true }).click();
  await expect(dialogo.getByRole('button', { name: 'Retirando…' })).toBeDisabled();
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  soltar();
  await expect(dialogo.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  const listaVigentes = page.getByRole('list', { name: 'Proyectos vigentes' });
  await expect(listaVigentes.getByRole('listitem').filter({ hasText: proyecto.name })).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Proyectos retirados' }).getByRole('listitem').filter({ hasText: proyecto.name })).toHaveCount(0);
  await page.unroute(`**/api/proyectos/${proyecto.id}/retirar`);
  await dialogo.getByRole('button', { name: 'Retirar proyecto', exact: true }).click();
  const activar = page.getByRole('button', { name: 'Volver a activar: Errores E2E' });
  await expect(activar).toBeVisible();
  const esperaActivar = new Promise<void>((resolve) => { soltar = resolve; });
  await page.route(`**/api/proyectos/${proyecto.id}/reactivar`, async (route) => {
    await esperaActivar;
    await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
  });
  await activar.click();
  const activando = page.getByRole('button', { name: 'Activando…: Errores E2E', exact: true });
  await expect(activando).toBeDisabled();
  await expect(activando).toHaveText('Activando…');
  soltar();
  const filaRetirada = page.getByRole('list', { name: 'Proyectos retirados' }).getByRole('listitem').filter({ hasText: proyecto.name });
  await expect(filaRetirada.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await expect(filaRetirada).toHaveCount(1);
  await expect(listaVigentes.getByRole('listitem').filter({ hasText: proyecto.name })).toHaveCount(0);
  const posiciones = await filaRetirada.evaluate((n) => ({
    error: n.querySelector('[role="alert"]')!.getBoundingClientRect().bottom,
    boton: n.querySelector('button')!.getBoundingClientRect().top,
  }));
  expect(posiciones.error).toBeLessThanOrEqual(posiciones.boton);
  await expect(activar).toBeEnabled();
  await page.unroute(`**/api/proyectos/${proyecto.id}/reactivar`);
  await activar.click();
  await expect(page.getByRole('button', { name: 'Retirar proyecto: Errores E2E' })).toBeVisible();
});

test('sin rastro de vista global: /proyectos redirige a Mi equipo y no hay navegación global de proyectos', async ({ page }) => {
  expect((await page.request.get('/api/proyectos/miembros')).status()).toBe(404);
  await page.goto('/proyectos');
  await expect(page).toHaveURL(/\/equipo$/);
  await expect(page.getByRole('link', { name: 'Proyectos', exact: true })).toHaveCount(0);
});
