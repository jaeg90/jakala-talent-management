import { expect, test as base, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import express from 'express';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { buildApp } from '../server/test/helpers/app';
import { cleanupTempDirs } from '../server/test/helpers/tempdb';
import { fechaHace } from './fechas';
import { fechaConAnio, fechaMesAnio } from '../web/src/lib/fechas';

// Cada caso usa la API real y una BD propia: ni las asignaciones, ni su historial,
// ni los proyectos creados pueden contaminar los fixtures de la pasada compartida.
const test = base.extend({
  baseURL: async ({ browser: _browser }, use) => {
    const { app, db } = buildApp();
    const webDist = resolve('web/dist');
    app.use(express.static(webDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile('index.html', { root: webDist });
    });
    const server = app.listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      if (address === null || typeof address === 'string') throw new Error('No se ha abierto el servidor E2E');
      await use(`http://127.0.0.1:${address.port}`);
    } finally {
      try {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      } finally {
        db.close();
        cleanupTempDirs();
      }
    }
  },
});

const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';
const URL = '/mentees/me-carla/ajustes';
type Proyecto = { id: string; name: string; desde: string };

async function abrir(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/equipo$/);
  await page.getByRole('link', { name: 'Carla Cano', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Ajustes de la mentee' }).click();
  await expect(page).toHaveURL(new RegExp(`${URL}$`));
}

async function actuales(request: APIRequestContext): Promise<Proyecto[]> {
  return ((await (await request.get('/api/mentees/me-carla/proyectos')).json()) as { proyectos: Proyecto[] }).proyectos;
}

/** El error está asociado al campo, no solo pintado en algún lugar del formulario. */
async function errorCampo(campo: Locator, texto: string) {
  await expect(campo).toHaveAttribute('aria-invalid', 'true');
  await expect(campo).toHaveAccessibleDescription(texto);
}

test('Proyectos: fila hundida y acción textual conservan sus estilos calculados en hover', async ({ page }) => {
  await abrir(page);
  const fila = page.getByRole('list', { name: 'Proyectos actuales' }).getByRole('listitem').first();
  const sacar = fila.getByRole('button', { name: 'Sacar del proyecto: Aurora Health' });
  await expect(fila).toHaveCSS('background-color', 'oklch(0.97 0.012 70)');
  await expect(fila).toHaveCSS('border-radius', '10px');
  await expect(fila).toHaveCSS('padding', '10px 14px');
  await expect(sacar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(sacar).toHaveCSS('padding', '0px');
  await expect(sacar).toHaveCSS('border-width', '0px');
  await expect(sacar).toHaveCSS('color', 'oklch(0.4 0.13 310)');
  await expect(sacar).toHaveCSS('font-size', '13px');
  await expect(sacar).toHaveCSS('font-weight', '600');
  await expect(sacar).toHaveCSS('text-decoration-line', 'none');
  await sacar.hover();
  await expect(sacar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(sacar).toHaveCSS('padding', '0px');
  await expect(fila).toHaveCSS('background-color', 'oklch(0.97 0.012 70)');
  await expect(fila).toHaveCSS('border-radius', '10px');
});

test('Proyectos: entradas y salidas reales, último proyecto y foco en medio/último/vacío', async ({ page, request }) => {
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  const originales = await actuales(request);
    await abrir(page);
    const proyectos = page.getByRole('region', { name: 'Proyectos', exact: true });
    const alta = proyectos.getByRole('button', { name: 'Añadir al proyecto…' });
    const filas = proyectos.getByRole('list', { name: 'Proyectos actuales' });
    await expect(page.locator('#temas-propios')).toHaveAccessibleName('Temas propios');
    await expect(proyectos).toHaveCSS('padding', '22px');
    await expect(page.locator('.ajustes-mentee__grid')).toHaveCSS('gap', '18px');
    await expect(proyectos.getByLabel('Motivo')).toHaveCSS('min-height', '56px');
    expect(await proyectos.getByLabel('Motivo').evaluate((el) => el.getBoundingClientRect().height)).toBe(56);
    await expect(filas.locator('time').first()).toHaveText(fechaMesAnio(originales[0].desde));

    for (const nombre of ['Atlas Bank', 'Campus EdTech']) {
      await proyectos.getByLabel('Proyecto', { exact: true }).selectOption({ label: nombre });
      await proyectos.getByLabel('Motivo').fill(`Entrada adicional en ${nombre}`);
      await alta.click();
      const dialogo = page.getByRole('alertdialog', { name: `¿Añadir a Carla Cano a ${nombre}?` });
      await expect(dialogo).toHaveAccessibleDescription('Quedará registrado en su historial con la fecha y el motivo.');
      const cancelar = dialogo.getByRole('button', { name: 'Cancelar' });
      await expect(cancelar).toBeFocused();
      // Foco encerrado: Shift+Tab desde Cancelar envuelve al botón de acción.
      await page.keyboard.press('Shift+Tab');
      await expect(dialogo.getByRole('button', { name: `Añadir a ${nombre}` })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialogo).not.toBeVisible();
      await expect(alta).toBeFocused();
      await expect(proyectos.getByLabel('Motivo')).toHaveValue(`Entrada adicional en ${nombre}`);
      await alta.click();
      await dialogo.getByRole('button', { name: `Añadir a ${nombre}` }).click();
      await expect(page.getByRole('status')).toHaveText(`Carla Cano ahora también está en ${nombre}.`);
      await expect(alta).toBeFocused();
      await expect(proyectos.getByLabel('Motivo')).toHaveValue('');
      await expect(proyectos.getByLabel('Proyecto').locator('option', { hasText: nombre })).toHaveCount(0);
    }
    await expect(filas.locator('.fila--gestion__nombre')).toHaveText(['Atlas Bank', 'Aurora Health', 'Campus EdTech']);

    for (const [nombre, siguiente] of [['Aurora Health', 'Campus EdTech'], ['Campus EdTech', 'Atlas Bank'], ['Atlas Bank', 'alta']]) {
      const sacar = proyectos.getByRole('button', { name: `Sacar del proyecto: ${nombre}` });
      await sacar.click();
      const dialogo = page.getByRole('alertdialog', { name: `¿Sacar a Carla Cano de ${nombre}?` });
      await expect(dialogo.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
      const confirmar = dialogo.getByRole('button', { name: `Sacar de ${nombre}`, exact: true });
      await expect(confirmar).toBeDisabled();
      await expect(confirmar).toHaveAccessibleDescription('Escribe el motivo para continuar.');
      await expect(dialogo.getByLabel('Motivo')).toHaveCSS('min-height', '72px');
      expect(await dialogo.getByLabel('Motivo').evaluate((el) => el.getBoundingClientRect().height)).toBe(72);
      const otros = nombre === 'Aurora Health' ? 'Atlas Bank · Campus EdTech' : 'Atlas Bank';
      await expect(dialogo).toHaveAccessibleDescription(`${siguiente === 'alta' ? 'Carla Cano quedará sin proyecto.' : `Seguirá en ${otros}.`} Quedará registrado en su historial con la fecha y el motivo.`);

      if (nombre === 'Aurora Health') {
        const fecha = dialogo.getByLabel('Fecha', { exact: true });
        await dialogo.getByLabel('Motivo').fill('Fin de proyecto');
        await fecha.fill('');
        await confirmar.click();
        await errorCampo(fecha, 'Elige una fecha.');
        await expect(fecha).toBeFocused();
        await fecha.fill(fechaHace(-1));
        await confirmar.click();
        await errorCampo(fecha, 'La fecha no puede ser futura.');
        await fecha.fill('1900-01-01');
        await confirmar.click();
        await errorCampo(fecha, `No puede ser anterior a su entrada en Aurora Health (${fechaConAnio(originales[0].desde)}).`);
        await expect(fecha).toHaveAttribute('min', originales[0].desde);
        await expect(fecha).toHaveAttribute('max', fechaHace(0));
        await fecha.fill(fechaHace(0));
        // Cambios en formulario: Esc pide descartar; seguir editando conserva todo.
        await page.keyboard.press('Escape');
        const descartar = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
        await expect(descartar).toBeVisible();
        await descartar.getByRole('button', { name: 'Seguir editando' }).click();
        await expect(dialogo.getByLabel('Motivo')).toHaveValue('Fin de proyecto');
      } else await dialogo.getByLabel('Motivo').fill('Fin de proyecto');

      await confirmar.click();
      await expect(dialogo).not.toBeVisible();
      await expect(page.getByRole('status')).toHaveText(`Carla Cano ya no está en ${nombre}.`);
      if (siguiente === 'alta') {
        await expect(alta).toBeFocused();
        await expect(proyectos.getByText('Sin proyecto.', { exact: true })).toBeVisible();
      } else await expect(proyectos.getByRole('button', { name: `Sacar del proyecto: ${siguiente}` })).toBeFocused();
    }
    expect(await actuales(request)).toEqual([]);
    await page.getByRole('navigation').getByRole('link', { name: 'Historial', exact: true }).click();
    await expect(page.getByText('Entra en Atlas Bank', { exact: true })).toBeVisible();
    await expect(page.getByText('Entra en Campus EdTech', { exact: true })).toBeVisible();
    for (const p of ['Atlas Bank', 'Aurora Health', 'Campus EdTech']) {
      await expect(page.getByText(`Sale de ${p}`, { exact: true })).toBeVisible();
    }
});

test('Selectores: vigentes menos actuales, managers menos el actual y todos los proyectos cubiertos', async ({ page, request }) => {
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  const originales = await actuales(request);
  const retirado = (await (await request.post('/api/proyectos', { data: { name: 'Proyecto retirado ajustes #23' } })).json()) as { id: string };
  expect((await request.post(`/api/proyectos/${retirado.id}/retirar`)).status()).toBe(200);
    await abrir(page);
    const proyectos = page.getByRole('region', { name: 'Proyectos', exact: true });
    const selector = proyectos.getByLabel('Proyecto', { exact: true });
    await expect(selector.locator('option')).toHaveText(['Elige un proyecto', 'Atlas Bank', 'Campus EdTech', 'Green Energy', 'Retail Nova']);
    const managers = page.getByLabel('Nuevo manager');
    await expect(managers.locator('option')).toHaveText(['Elige un manager', 'Diego Domínguez', 'Julia Jiménez', 'Lucía López']);
    await expect(managers.locator('option', { hasText: 'Marta Manager' })).toHaveCount(0);
    const catalogo = ((await (await request.get('/api/proyectos')).json()) as { proyectos: { id: string; fechaRetirada: string | null }[] }).proyectos;
    for (const p of catalogo.filter((p) => p.fechaRetirada === null && p.id !== 'pr-nova' && !originales.some((o) => o.id === p.id))) {
      expect((await request.post('/api/mentees/me-carla/proyectos', {
        data: { proyecto: p.id, desde: fechaHace(0), motivoEntrada: 'Fixture todos los proyectos' },
      })).status()).toBe(201);
    }
    await page.reload();
    // La última entrada desmonta/reinicia el alta y deshabilita su CTA: el foco
    // debe quedar en un campo existente, no volver al botón ya deshabilitado.
    await selector.selectOption({ label: 'Retail Nova' });
    await proyectos.getByLabel('Motivo').fill('Último proyecto disponible');
    await proyectos.getByRole('button', { name: 'Añadir al proyecto…' }).click();
    await page.getByRole('alertdialog', { name: '¿Añadir a Carla Cano a Retail Nova?' })
      .getByRole('button', { name: 'Añadir a Retail Nova' }).click();
    await expect(selector).toBeDisabled();
    await expect(proyectos.getByText('Ya está en todos los proyectos vigentes.')).toBeVisible();
    await expect(proyectos.getByRole('button', { name: 'Añadir al proyecto…' })).toBeDisabled();
    await expect(proyectos.getByLabel('Fecha', { exact: true })).toBeFocused();
});

test('Alta y traspaso: errores asociados, confirmaciones cancelables, error de guardado y enviando', async ({ page }) => {
  await abrir(page);
  const proyectos = page.getByRole('region', { name: 'Proyectos', exact: true });
  const alta = proyectos.getByRole('button', { name: 'Añadir al proyecto…' });
  await proyectos.getByLabel('Fecha', { exact: true }).fill('');
  await alta.click();
  await errorCampo(proyectos.getByLabel('Proyecto', { exact: true }), 'Elige un proyecto.');
  await expect(proyectos.getByLabel('Proyecto', { exact: true })).toBeFocused();
  await errorCampo(proyectos.getByLabel('Fecha', { exact: true }), 'Elige una fecha.');
  await errorCampo(proyectos.getByLabel('Motivo'), 'Escribe el motivo.');
  await proyectos.getByLabel('Proyecto', { exact: true }).selectOption({ label: 'Atlas Bank' });
  await proyectos.getByLabel('Motivo').fill('Nuevo proyecto');
  await alta.click();
  await expect(proyectos.getByLabel('Fecha', { exact: true })).toBeFocused();
  await proyectos.getByLabel('Fecha', { exact: true }).fill(fechaHace(-1));
  await alta.click();
  await errorCampo(proyectos.getByLabel('Fecha', { exact: true }), 'La fecha no puede ser futura.');
  await proyectos.getByLabel('Fecha', { exact: true }).fill(fechaHace(0));
  await alta.click();
  const confirmacionAlta = page.getByRole('alertdialog', { name: '¿Añadir a Carla Cano a Atlas Bank?' });
  let liberarAlta!: () => void;
  const esperaAlta = new Promise<void>((resolve) => { liberarAlta = resolve; });
  await page.route('**/api/mentees/me-carla/proyectos', async (route) => {
    if (route.request().method() === 'POST') {
      await esperaAlta;
      await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
    }
    else await route.continue();
  });
  await confirmacionAlta.getByRole('button', { name: 'Añadir a Atlas Bank' }).click();
  await expect(confirmacionAlta.getByRole('button', { name: 'Añadiendo…' })).toBeDisabled();
  await expect(confirmacionAlta.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(confirmacionAlta).toBeVisible();
  liberarAlta();
  await expect(confirmacionAlta.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await confirmacionAlta.getByRole('button', { name: 'Cancelar' }).click();
  await expect(alta).toBeFocused();
  await expect(proyectos.getByLabel('Motivo')).toHaveValue('Nuevo proyecto');

  const traspaso = page.getByRole('region', { name: 'Traspaso', exact: true });
  const traspasar = traspaso.getByRole('button', { name: 'Traspasar…' });
  const fecha = traspaso.getByLabel('Fecha', { exact: true });
  await fecha.fill('');
  await traspasar.click();
  await errorCampo(traspaso.getByLabel('Nuevo manager'), 'Elige un manager.');
  await errorCampo(fecha, 'Elige una fecha.');
  await errorCampo(traspaso.getByLabel('Motivo'), 'Escribe el motivo.');
  await traspaso.getByLabel('Nuevo manager').selectOption({ label: 'Diego Domínguez' });
  await traspaso.getByLabel('Motivo').fill('Reorganización');
  await traspasar.click();
  await expect(fecha).toBeFocused();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await fecha.fill(fechaHace(0));
  await traspasar.click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Traspasar a Carla Cano a Diego Domínguez?' });
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await expect(dialogo).toHaveAccessibleDescription('Diego Domínguez heredará su historial completo y Carla Cano dejará de aparecer en tu equipo. No se puede deshacer.');
  await page.keyboard.press('Escape');
  await expect(traspasar).toBeFocused();
  await traspasar.click();
  const confirmarTraspaso = dialogo.getByRole('button', { name: 'Traspasar a Diego Domínguez' });
  await expect(confirmarTraspaso).toHaveClass(/boton--atencion/);
  await expect(confirmarTraspaso).toHaveCSS('background-color', 'oklch(0.45 0.13 40)');
  await expect(confirmarTraspaso).toHaveCSS('color', 'rgb(255, 255, 255)');
  await confirmarTraspaso.hover();
  await expect(confirmarTraspaso).toHaveCSS('background-color', 'oklch(0.45 0.13 40)');
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => { liberar = resolve; });
  await page.route('**/api/mentees/me-carla/traspasos', async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
  });
  await dialogo.getByRole('button', { name: 'Traspasar a Diego Domínguez' }).click();
  await expect(dialogo.getByRole('button', { name: 'Traspasando…' })).toBeDisabled();
  await expect(dialogo.getByRole('button', { name: 'Traspasando…' })).toHaveCSS('background-color', 'oklch(0.45 0.13 40)');
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  liberar();
  await expect(dialogo.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(traspasar).toBeFocused();
  await expect(traspaso.getByLabel('Motivo')).toHaveValue('Reorganización');
});

test('P4: carga lenta con skeleton, error con reintento y sin CTAs inertes', async ({ page }) => {
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => { liberar = resolve; });
  let fallar = true;
  await page.route('**/api/mentees/me-carla/proyectos', async (route) => {
    if (fallar) {
      await espera;
      await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
    } else await route.continue();
  });
  await abrir(page);
  await expect(page.getByTestId('skeleton-ajustes-mentee')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Añadir al proyecto…' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Traspasar…' })).toHaveCount(0);
  liberar();
  await expect(page.getByRole('alert')).toContainText('No hemos podido cargar los ajustes de la mentee. Revisa tu conexión.');
  await expect(page.getByRole('button', { name: 'Añadir al proyecto…' })).toHaveCount(0);
  fallar = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('region', { name: 'Proyectos', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Salida: envío bloqueado, error conserva campos y Cancelar descarta devolviendo el foco', async ({ page }) => {
  await abrir(page);
  const sacar = page.getByRole('button', { name: 'Sacar del proyecto: Aurora Health' });
  await sacar.click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Sacar a Carla Cano de Aurora Health?' });
  await page.keyboard.press('Escape');
  await expect(sacar).toBeFocused();
  await sacar.click();
  await dialogo.getByLabel('Motivo').fill('Cierre del proyecto');
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => { liberar = resolve; });
  await page.route('**/api/mentees/me-carla/proyectos/pr-aurora/salir', async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
  });
  await dialogo.getByRole('button', { name: 'Sacar de Aurora Health' }).click();
  await expect(dialogo.getByRole('button', { name: 'Sacando…' })).toBeDisabled();
  await expect(dialogo.getByLabel('Fecha', { exact: true })).toBeDisabled();
  liberar();
  await expect(dialogo.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await expect(dialogo.getByLabel('Motivo')).toHaveValue('Cierre del proyecto');
  await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('alertdialog', { name: '¿Descartar los cambios?' }).getByRole('button', { name: 'Descartar cambios' }).click();
  await expect(sacar).toBeFocused();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('Un traspaso atrasado no navega ni muestra avisos en la ficha de otra mentee', async ({ page }) => {
  await abrir(page);
  const traspaso = page.getByRole('region', { name: 'Traspaso', exact: true });
  await traspaso.getByLabel('Nuevo manager').selectOption({ label: 'Diego Domínguez' });
  await traspaso.getByLabel('Motivo').fill('Reorganización');
  await traspaso.getByRole('button', { name: 'Traspasar…' }).click();
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => { liberar = resolve; });
  await page.route('**/api/mentees/me-carla/traspasos', async (route) => {
    await espera;
    await route.fulfill({ status: 201, json: {
      id: 'traspaso-atrasado', menteeId: 'me-carla', origenId: 'seed-manager-1',
      destinoId: 'seed-manager-2', fecha: fechaHace(0), motivo: 'Reorganización',
    } });
  });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Traspasar a Diego Domínguez' }).click();
  await expect(page.getByRole('button', { name: 'Traspasando…' })).toBeDisabled();
  await page.goBack();
  await expect(page).toHaveURL(/\/mentees\/me-carla$/);
  await page.getByRole('link', { name: '← Mi equipo', exact: true }).click();
  await expect(page).toHaveURL(/\/equipo$/);
  await page.getByRole('link', { name: 'Ana Alonso', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Ajustes de la mentee' }).click();
  await expect(page.getByRole('region', { name: 'Proyectos', exact: true })).toBeVisible();
  const respuesta = page.waitForResponse((r) => r.url().endsWith('/me-carla/traspasos'));
  liberar();
  await (await respuesta).finished();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(page).toHaveURL(/\/mentees\/me-ana\/ajustes$/);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sacar del proyecto: Atlas Bank' })).toBeVisible();
});
