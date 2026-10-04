import { expect, test, type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { fechaHace } from './fechas';
import { fechaMesAnio } from '../web/src/lib/fechas';

let creadas: string[];

test.beforeEach(async ({ page }) => {
  creadas = [];
  // Captura el id antes de pintar el éxito: incluso una aserción fallida limpia
  // la mentee y todas sus entradas en proyectos en afterEach.
  await page.route('**/api/mentees', async (route) => {
    const response = await route.fetch();
    if (response.status() === 201) {
      const body = await response.json() as { id: string };
      creadas.push(body.id);
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
      for (const id of creadas) {
        db.prepare('DELETE FROM asignaciones WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM mentees WHERE id = ?').run(id);
      }
    })();
  } finally {
    db.close();
  }
});

async function abrirAlta(page: Page) {
  await page.goto('/ajustes/perfil');
  await page.getByRole('link', { name: 'Mentees', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Añadir a mi equipo' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Mentees', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Perfil y contraseña' })).not.toHaveAttribute('aria-current');
}

test('alta con varios proyectos: copy, chips accesibles, eventos, aviso, ficha y Mi equipo', async ({ page }) => {
  await abrirAlta(page);
  await expect(page.getByText('La mentee entra en tu equipo con el historial vacío. Si viene de otro manager, pídele un traspaso: así conserva su historial.')).toBeVisible();
  await expect(page.getByText('Puedes marcar varios o ninguno («Sin proyecto»).')).toBeVisible();
  const nombre = page.getByLabel('Nombre y apellidos');
  await expect(nombre).toHaveAttribute('placeholder', 'p. ej. Irene Iglesias');
  await expect(nombre).toHaveAttribute('required', '');
  const fecha = page.getByLabel('En tu equipo desde');
  await expect(fecha).toHaveValue(fechaHace(0));
  await expect(fecha).toHaveAttribute('max', fechaHace(0));
  const grupo = page.getByRole('group', { name: 'Proyectos' });
  expect(await grupo.evaluate((n) => n.tagName)).toBe('FIELDSET');
  await expect(grupo.locator('legend')).toHaveText('Proyectos');
  const chips = grupo.getByRole('checkbox');
  expect(await chips.evaluateAll((nodos) => nodos.map((n) => (n as HTMLInputElement).checked))).toEqual([false, false, false, false, false]);
  expect(await chips.evaluateAll((nodos) => nodos.map((n) => n.parentElement?.textContent))).toEqual(['Atlas Bank', 'Aurora Health', 'Campus EdTech', 'Green Energy', 'Retail Nova']);
  const atlas = grupo.getByRole('checkbox', { name: 'Atlas Bank', exact: true });
  await atlas.focus();
  await page.keyboard.press('Space');
  await expect(atlas).toBeChecked();
  await expect(atlas).toBeFocused();
  await expect(grupo.locator('.chip-casilla__texto [aria-hidden="true"]')).toHaveText('✓ ');
  await grupo.getByRole('checkbox', { name: 'Aurora Health', exact: true }).check();
  const estilo = await grupo.locator('.chip-casilla__texto').first().evaluate((n) => {
    const s = getComputedStyle(n);
    return { padding: s.padding, size: s.fontSize, weight: s.fontWeight, radius: s.borderRadius, shadow: s.boxShadow };
  });
  expect(estilo).toMatchObject({ padding: '6px 12px', size: '14px', weight: '600', radius: '999px' });
  expect(estilo.shadow).toContain('1.5px');
  expect(await grupo.locator('.alta-mentee__chips').evaluate((n) => ({ gap: getComputedStyle(n).gap, wrap: getComputedStyle(n).flexWrap }))).toEqual({ gap: '8px', wrap: 'wrap' });
  await nombre.fill('Irene Iglesias E2E');
  const desde = fechaHace(35);
  await fecha.fill(desde);
  await page.getByRole('button', { name: 'Añadir a mi equipo' }).click();
  await expect(page.getByRole('status')).toContainText('Irene Iglesias E2E se ha añadido a tu equipo.');
  const link = page.getByRole('link', { name: 'Abrir su ficha' });
  // Tras el éxito el foco vuelve al nombre; Shift+Tab llega al enlace del aviso.
  await expect(nombre).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  expect(await link.evaluate((n) => n.matches(':focus-visible'))).toBe(true);
  const anillo = await link.evaluate((n) => {
    const esperado = document.createElement('span');
    esperado.style.boxShadow = 'var(--foco-anillo)';
    document.body.append(esperado);
    const resultado = { real: getComputedStyle(n).boxShadow, esperado: getComputedStyle(esperado).boxShadow };
    esperado.remove();
    return resultado;
  });
  expect(anillo.real).not.toBe('none');
  expect(anillo.real).toBe(anillo.esperado);
  const href = await link.getAttribute('href');
  const id = href!.split('/').at(-1)!;
  const response = await page.request.get(`/api/mentees/${id}/historial`);
  const { eventos } = await response.json() as { eventos: { tipo: string; direccion: string; proyecto: string; fecha: string; motivo: string }[] };
  expect(eventos).toHaveLength(2);
  expect(eventos.map((e) => e.proyecto).sort()).toEqual(['Atlas Bank', 'Aurora Health']);
  for (const evento of eventos) expect(evento).toMatchObject({ tipo: 'proyecto', direccion: 'entrada', fecha: desde, motivo: 'Alta en el equipo' });
  await link.click();
  await expect(page.locator('.ficha__desde')).toHaveText(`En tu equipo desde ${fechaMesAnio(desde)}`);
  await expect(page.locator('.ficha__desde time')).toHaveAttribute('datetime', desde);
  expect(await page.locator('.ficha__desde').evaluate((n) => getComputedStyle(n).fontSize)).toBe('13px');
  await page.getByRole('link', { name: 'Objetivos', exact: true }).click();
  await expect(page.locator('.ficha__desde')).toHaveText(`En tu equipo desde ${fechaMesAnio(desde)}`);
  await page.getByRole('link', { name: '← Mi equipo' }).click();
  await expect(page.getByRole('link', { name: 'Irene Iglesias E2E', exact: true })).toBeVisible();
});

test('chips-casilla: el foco añade el anillo sin sustituir el borde interior', async ({ page }) => {
  await abrirAlta(page);
  const nombre = page.getByLabel('Nombre y apellidos');
  const atlas = page.getByRole('checkbox', { name: 'Atlas Bank', exact: true });
  const texto = page.locator('.chip-casilla__texto').first();
  await nombre.focus();
  await page.keyboard.press('Tab');
  await expect(atlas).toBeFocused();

  for (const seleccionado of [true, false]) {
    await page.keyboard.press('Space');
    await expect(atlas).toBeChecked({ checked: seleccionado });
    expect(await atlas.evaluate((n) => n.matches(':focus-visible'))).toBe(true);
    for (const conFoco of [true, false]) {
      if (!conFoco) await nombre.focus();
      const sombras = await texto.evaluate((n, { seleccionado, conFoco }) => {
        const esperado = document.createElement('span');
        const color = seleccionado ? '--color-primario' : '--color-borde-campo';
        esperado.style.boxShadow = `inset 0 0 0 var(--borde-chip-casilla) var(${color})${conFoco ? ', var(--foco-anillo)' : ''}`;
        n.parentElement!.append(esperado);
        const resultado = { real: getComputedStyle(n).boxShadow, esperado: getComputedStyle(esperado).boxShadow };
        esperado.remove();
        return resultado;
      }, { seleccionado, conFoco });
      expect(sombras.real).toContain('1.5px');
      expect(sombras.real).toBe(sombras.esperado);
    }
    await page.keyboard.press('Tab');
    await expect(atlas).toBeFocused();
  }
});

test('chips-casilla: objetivos táctiles de al menos 44px en móvil, también seleccionados', async ({ page }) => {
  await abrirAlta(page);
  const grupo = page.getByRole('group', { name: 'Proyectos' });
  for (const width of [639, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const atlas = grupo.getByRole('checkbox', { name: 'Atlas Bank', exact: true });
    for (const seleccionado of [false, true]) {
      await atlas.setChecked(seleccionado);
      const dimensiones = await grupo.locator('.chip-casilla').evaluateAll((etiquetas) => etiquetas.map((etiqueta) => {
        const checkbox = etiqueta.querySelector('input')!;
        const texto = etiqueta.querySelector('.chip-casilla__texto')!;
        return {
          etiqueta: etiqueta.getBoundingClientRect().height,
          checkbox: checkbox.getBoundingClientRect().height,
          texto: texto.getBoundingClientRect().height,
          minimo: getComputedStyle(texto).minHeight,
        };
      }));
      expect(dimensiones).toHaveLength(5);
      for (const dimension of dimensiones) {
        expect(dimension.etiqueta).toBeGreaterThanOrEqual(44);
        expect(dimension.checkbox).toBeGreaterThanOrEqual(44);
        expect(dimension.texto).toBeGreaterThanOrEqual(44);
        expect(dimension.minimo).toBe('44px');
      }
      await expect(atlas).toBeChecked({ checked: seleccionado });
    }
  }
});

test('alta sin proyecto: aparece en Mi equipo, sin eventos ni historial heredado', async ({ page }) => {
  await abrirAlta(page);
  await page.getByLabel('Nombre y apellidos').fill('Sin Proyecto E2E');
  await page.getByRole('button', { name: 'Añadir a mi equipo' }).click();
  await expect(page.getByRole('status')).toContainText('Sin Proyecto E2E se ha añadido a tu equipo.');
  const id = (await page.getByRole('link', { name: 'Abrir su ficha' }).getAttribute('href'))!.split('/').at(-1)!;
  expect(await (await page.request.get(`/api/mentees/${id}/historial`)).json()).toEqual({ eventos: [] });
  await page.getByRole('link', { name: 'Abrir su ficha' }).click();
  await expect(page.locator('.ficha__desde time')).toHaveAttribute('datetime', fechaHace(0));
  await expect(page.getByRole('region', { name: 'Proyectos actuales' })).toContainText('Sin proyectos.');
  await page.getByRole('link', { name: '← Mi equipo' }).click();
  const fila = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Sin Proyecto E2E', exact: true }) });
  await expect(fila).toContainText('Sin proyecto');
});

test('P4: error al guardar conserva campos y selección; validaciones anuncian y enfocan', async ({ page }) => {
  await abrirAlta(page);
  await page.getByRole('button', { name: 'Añadir a mi equipo' }).click();
  const nombre = page.getByRole('textbox', { name: /^Nombre y apellidos/ });
  await expect(nombre).toBeFocused();
  await expect(nombre).toHaveAttribute('aria-invalid', 'true');
  await expect(nombre).toHaveAttribute('aria-describedby', 'alta-error-nombre');
  await nombre.fill('Conservada E2E');
  const fecha = page.locator('input[type="date"]');
  await fecha.fill(fechaHace(-1));
  await page.getByRole('button', { name: 'Añadir a mi equipo' }).click();
  await expect(page.getByRole('alert')).toHaveText('La fecha no puede ser futura.');
  await expect(fecha).toBeFocused();
  await expect(fecha).toHaveAttribute('aria-invalid', 'true');
  await expect(fecha).toHaveAttribute('aria-describedby', 'alta-error-fecha');
  const desde = fechaHace(10);
  await fecha.fill(desde);
  await page.getByRole('checkbox', { name: 'Atlas Bank', exact: true }).check();
  await page.route('**/api/mentees', (route) => route.fulfill({ status: 500, json: { error: 'Fallo simulado' } }));
  await page.getByRole('button', { name: 'Añadir a mi equipo' }).click();
  await expect(page.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await expect(nombre).toHaveValue('Conservada E2E');
  await expect(fecha).toHaveValue(desde);
  await expect(page.getByRole('checkbox', { name: 'Atlas Bank', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Añadir a mi equipo' })).toBeEnabled();
});

test('P4: carga lenta, error y reintento no permiten altas inertes', async ({ page }) => {
  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => { soltar = resolve; });
  await page.route('**/api/proyectos', async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
  });
  await page.goto('/ajustes/mentees');
  await expect(page.getByRole('button', { name: 'Añadir a mi equipo' })).toBeDisabled();
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toContainText('Cargando…');
  soltar();
  await expect(page.getByRole('alert')).toContainText('No hemos podido cargar los proyectos. Revisa tu conexión.');
  await expect(page.getByRole('button', { name: 'Añadir a mi equipo' })).toBeDisabled();
  await page.unroute('**/api/proyectos');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('checkbox', { name: 'Atlas Bank', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Añadir a mi equipo' })).toBeEnabled();
});

test('catálogo vacío permite alta sin proyecto; los retirados nunca son seleccionables', async ({ page }) => {
  await page.route('**/api/proyectos', (route) => route.fulfill({ json: { proyectos: [{ id: 'retirado', name: 'Retirado', fechaRetirada: '2026-01-01' }] } }));
  await page.goto('/ajustes/mentees');
  await expect(page.getByRole('button', { name: 'Añadir a mi equipo' })).toBeEnabled();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByText('Puedes marcar varios o ninguno («Sin proyecto»).')).toBeVisible();
  await page.getByLabel('Nombre y apellidos').fill('Catálogo Vacío E2E');
  await page.getByRole('button', { name: 'Añadir a mi equipo' }).click();
  await expect(page.getByRole('status')).toContainText('Catálogo Vacío E2E se ha añadido a tu equipo.');
  const id = (await page.getByRole('link', { name: 'Abrir su ficha' }).getAttribute('href'))!.split('/').at(-1)!;
  expect(await (await page.request.get(`/api/mentees/${id}/historial`)).json()).toEqual({ eventos: [] });
});

test('P4: enviando deshabilita CTA, muestra «Añadiendo…» y evita duplicar', async ({ page }) => {
  await abrirAlta(page);
  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => { soltar = resolve; });
  let peticiones = 0;
  await page.route('**/api/mentees', async (route) => {
    peticiones += 1;
    await espera;
    await route.fulfill({ status: 500, json: { error: 'Fallo simulado' } });
  });
  await page.getByLabel('Nombre y apellidos').fill('Pendiente E2E');
  await page.getByRole('button', { name: 'Añadir a mi equipo' }).click();
  await expect(page.getByRole('button', { name: 'Añadiendo…' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Atlas Bank', exact: true })).toBeDisabled();
  // Fuerza un segundo submit incluso con CTA disabled: el guard del formulario
  // también debe rechazarlo, no solo confiar en la deshabilitación del botón.
  await page.getByRole('form', { name: 'Añadir mentee' }).evaluate((n) => (n as HTMLFormElement).requestSubmit());
  soltar();
  await expect(page.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  expect(peticiones).toBe(1);
});

test('sidebar omite la fecha null defensiva sin mostrar proyectos bajo el nombre', async ({ page }) => {
  await page.route('**/api/team', async (route) => {
    const response = await route.fetch();
    const body = await response.json() as { mentees: { enEquipoDesde: string | null }[] };
    body.mentees.forEach((m) => { m.enEquipoDesde = null; });
    await route.fulfill({ response, json: body });
  });
  await page.goto('/mentees/me-ana');
  await expect(page.locator('.ficha__nombre')).toHaveText('Ana Alonso');
  await expect(page.locator('.ficha__desde')).toHaveCount(0);
  await expect(page.locator('.ficha__identidad')).not.toContainText('Atlas Bank');
});
