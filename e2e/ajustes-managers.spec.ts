import { expect, test, type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { TEMAS_INICIALES } from '../server/src/domain/plantilla';

let creadas: string[];

test.beforeEach(async ({ page }) => {
  creadas = [];
  await page.route('**/api/managers', async (route) => {
    const response = await route.fetch();
    if (route.request().method() === 'POST' && response.status() === 201) {
      const body = await response.json() as { manager: { id: string } };
      creadas.push(body.manager.id);
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
        db.prepare('DELETE FROM plantilla WHERE manager_id = ?').run(id);
        db.prepare('DELETE FROM managers WHERE id = ?').run(id);
      }
    })();
  } finally { db.close(); }
});

async function abrir(page: Page) {
  await page.goto('/ajustes/perfil');
  await page.getByRole('link', { name: 'Managers', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Managers', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeEnabled();
}

test('censo, diseño y alta real: temporal de una sola vez, foco, copia, bloqueo y desbloqueo', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await abrir(page);
  const tabla = page.getByRole('table', { name: 'Managers' });
  await expect(tabla.getByRole('columnheader')).toHaveText(['Manager', 'Mentees']);
  await expect(tabla.getByRole('row').nth(1)).toContainText('Marta Manager (tú)');
  await expect(tabla.getByRole('row').nth(1).getByRole('cell').last()).toHaveText('3');
  await expect(tabla.getByRole('row').filter({ hasText: 'Diego Domínguez' }).getByRole('cell').last()).toHaveText('3');
  await expect(tabla.getByRole('row').filter({ hasText: 'Lucía López' }).getByRole('cell').last()).toHaveText('2');
  expect(await page.locator('.censo-managers').evaluate((n) => getComputedStyle(n).padding)).toBe('8px');
  expect(await tabla.locator('.censo-managers__nombre').first().evaluate((n) => getComputedStyle(n).fontWeight)).toBe('700');
  expect(await tabla.locator('.censo-managers__email').first().evaluate((n) => getComputedStyle(n).fontSize)).toBe('13px');
  await expect(page.getByText('Empezará con el equipo vacío, la plantilla de 1-to-1 inicial y verá solo a sus mentees.')).toBeVisible();
  await expect(page.getByText('JTM genera una al crear la cuenta. Compártela por un canal seguro; tendrá que cambiarla al iniciar sesión.')).toBeVisible();
  await page.getByLabel('Nombre y apellidos').fill('Nueva Manager E2E');
  await page.getByLabel('Email', { exact: true }).fill('nueva-manager-e2e@example.com');
  const crear = page.getByRole('button', { name: 'Crear cuenta', exact: true });
  await crear.click();
  const dialogo = page.getByRole('dialog', { name: 'Cuenta creada para Nueva Manager E2E' });
  await expect(dialogo).toBeVisible();
  expect(await dialogo.evaluate((n) => n.tagName)).toBe('DIALOG');
  expect(await dialogo.evaluate((n) => n.matches(':modal'))).toBe(true);
  await expect(dialogo.getByText('No volverás a verla.')).toBeVisible();
  const clave = dialogo.locator('.alta-manager__clave');
  const temporal = (await clave.textContent())!;
  expect(temporal).toMatch(/^[0-9a-f]{16}$/);
  expect(await clave.evaluate((n) => getComputedStyle(n).userSelect)).toBe('text');
  const copiar = dialogo.getByRole('button', { name: 'Copiar contraseña' });
  const hecho = dialogo.getByRole('button', { name: 'Hecho' });
  await expect(copiar).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(hecho).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(copiar).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(hecho).toBeFocused();
  await copiar.click();
  await expect(dialogo.getByRole('status')).toHaveText('Contraseña copiada.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(temporal);
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(crear).toBeFocused();
  await expect(page.getByText(temporal, { exact: true })).toHaveCount(0);
  await expect(tabla.getByRole('row').filter({ hasText: 'Nueva Manager E2E' }).getByRole('cell').last()).toHaveText('0');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(temporal, { exact: true })).toHaveCount(0);
  const censo = await (await page.request.get('/api/managers')).json();
  expect(JSON.stringify(censo)).not.toContain(temporal);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill('nueva-manager-e2e@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill(temporal);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/ajustes\/perfil$/);
  await expect(page.getByText('Cambia tu contraseña temporal para continuar.')).toBeVisible();
  for (const path of ['/api/team', '/api/managers', '/api/plantilla']) expect((await page.request.get(path)).status()).toBe(403);
  expect((await page.request.post('/api/managers', { data: { name: 'No permitida', email: 'no@example.com' } })).status()).toBe(403);
  await page.goto('/ajustes/managers');
  await expect(page).toHaveURL(/\/ajustes\/perfil$/);
  await page.getByLabel('Contraseña actual').fill(temporal);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('nueva-manager-segura');
  await page.getByLabel('Repite la nueva contraseña').fill('nueva-manager-segura');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText('Contraseña cambiada.')).toBeVisible();
  expect(await (await page.request.get('/api/team')).json()).toEqual({ mentees: [] });
  const plantilla = await (await page.request.get('/api/plantilla')).json() as { temas: { tema: string; orden: number; estado: string }[] };
  expect(plantilla.temas.map((t) => t.tema)).toEqual([...TEMAS_INICIALES]);
  expect(plantilla.temas.map((t) => [t.orden, t.estado])).toEqual([[0, 'vigente'], [1, 'vigente'], [2, 'vigente']]);
  await page.getByRole('link', { name: '← Mi equipo' }).click();
  await expect(page).toHaveURL(/\/equipo$/);
  await expect(page.getByRole('link', { name: 'Ana Alonso', exact: true })).toHaveCount(0);
});

test('validación accesible: email inválido y duplicado con copy exacto y datos conservados', async ({ page }) => {
  await abrir(page);
  const nombre = page.getByLabel('Nombre y apellidos');
  const email = page.getByLabel('Email', { exact: true });
  const crear = page.getByRole('button', { name: 'Crear cuenta', exact: true });
  await crear.click();
  await expect(nombre).toHaveAttribute('aria-invalid', 'true');
  await expect(nombre).toBeFocused();
  await nombre.fill('Otra Marta');
  let peticiones = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/managers')) peticiones++;
  });
  for (const invalido of ['invalido', 'ana@ejemplo..com', 'ana@-ejemplo.com', 'ana@ejemplo-.com', 'ana..lopez@ejemplo.com', `ana@${'a'.repeat(64)}.com`, 'Kana@example.com']) {
    await email.fill(invalido);
    await crear.click();
    await expect(page.getByRole('alert')).toHaveText('Escribe un email válido.');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAccessibleDescription('Escribe un email válido.');
    await expect(email).toBeFocused();
    await expect(nombre).toHaveValue('Otra Marta');
    await expect(email).toHaveValue(invalido);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(peticiones).toBe(0);
  await email.fill('MANAGER@jakala.example');
  await crear.click();
  await expect(page.getByRole('alert')).toHaveText('Ya existe una cuenta con este email.');
  await expect(email).toHaveAccessibleDescription('Ya existe una cuenta con este email.');
  await expect(email).toBeFocused();
  await expect(nombre).toHaveValue('Otra Marta');
  await expect(email).toHaveValue('MANAGER@jakala.example');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('alta desde Managers con barra final muestra la temporal y devuelve el foco al cerrar', async ({ page }) => {
  await page.goto('/ajustes/managers/');
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeEnabled();
  await page.getByLabel('Nombre y apellidos').fill('Manager Barra Final');
  await page.getByLabel('Email', { exact: true }).fill('manager-barra-final@example.com');
  const crear = page.getByRole('button', { name: 'Crear cuenta', exact: true });
  await crear.click();
  const dialogo = page.getByRole('dialog', { name: 'Cuenta creada para Manager Barra Final' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.locator('.alta-manager__clave')).toHaveText(/^[0-9a-f]{16}$/);
  await expect(dialogo.getByRole('button', { name: 'Copiar contraseña' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(crear).toBeFocused();
  await page.getByRole('link', { name: 'Perfil y contraseña' }).click();
  await page.getByRole('link', { name: 'Managers', exact: true }).click();
  await expect(crear).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const volverAntes of [true, false]) {
  test(`alta en vuelo conserva la temporal al salir de Ajustes y volver ${volverAntes ? 'antes' : 'después'} de la respuesta`, async ({ page }) => {
    await abrir(page);
    await page.getByLabel('Nombre y apellidos').fill('Manager Navegación');
    await page.getByLabel('Email', { exact: true }).fill('manager-navegacion@example.com');
    let resolver!: () => void;
    const espera = new Promise<void>((resolve) => { resolver = resolve; });
    let recibida!: () => void;
    const respuestaRecibida = new Promise<void>((resolve) => { recibida = resolve; });
    let temporal = '';
    await page.route('**/api/managers', async (route) => {
      if (route.request().method() !== 'POST') { await route.fallback(); return; }
      const response = await route.fetch();
      const body = await response.json() as { manager: { id: string }; contrasenaTemporal: string };
      creadas.push(body.manager.id);
      temporal = body.contrasenaTemporal;
      recibida();
      await espera;
      await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await respuestaRecibida;
    await page.getByRole('link', { name: '← Mi equipo' }).click();
    await expect(page).toHaveURL(/\/equipo$/);
    if (!volverAntes) resolver();
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('link', { name: 'Managers', exact: true }).click();
    if (volverAntes) {
      await expect(page.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();
      resolver();
    }
    const dialogo = page.getByRole('dialog', { name: 'Cuenta creada para Manager Navegación' });
    await expect(dialogo.locator('.alta-manager__clave')).toHaveText(temporal);
    expect(temporal).toMatch(/^[0-9a-f]{16}$/);
    await expect(dialogo.getByRole('button', { name: 'Copiar contraseña' })).toBeFocused();
    await dialogo.getByRole('button', { name: 'Hecho' }).click();
    await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeFocused();
    await expect(page.getByRole('table', { name: 'Managers' }).getByRole('row').filter({ hasText: 'Manager Navegación' }).getByRole('cell').last()).toHaveText('0');
    await page.getByRole('link', { name: 'Perfil y contraseña' }).click();
    await page.getByRole('link', { name: 'Managers', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeEnabled();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(temporal, { exact: true })).toHaveCount(0);
  });
}

for (const estado of ['carga', 'error'] as const) {
  for (const cierre of ['Escape', 'Hecho'] as const) {
    test(`retorno de foco pendiente al cerrar con ${cierre} durante ${estado} del censo`, async ({ page }) => {
      await abrir(page);
      await page.getByLabel('Nombre y apellidos').fill('Manager Foco');
      await page.getByLabel('Email', { exact: true }).fill('manager-foco@example.com');
      let resolverAlta!: () => void;
      const alta = new Promise<void>((resolve) => { resolverAlta = resolve; });
      let recibirAlta!: () => void;
      const altaRecibida = new Promise<void>((resolve) => { recibirAlta = resolve; });
      let resolverCenso!: () => void;
      const censo = new Promise<void>((resolve) => { resolverCenso = resolve; });
      let recibirCenso!: () => void;
      const censoRecibido = new Promise<void>((resolve) => { recibirCenso = resolve; });
      await page.route('**/api/managers', async (route) => {
        if (route.request().method() === 'POST') {
          recibirAlta();
          await alta;
          await route.fulfill({ status: 201, json: {
            manager: { id: 'manager-foco', name: 'Manager Foco', email: 'manager-foco@example.com', numMentees: 0, debeCambiarContraseña: true },
            contrasenaTemporal: '0123456789abcdef',
          } });
        } else {
          recibirCenso();
          await censo;
          if (estado === 'error') await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
          else await route.fallback();
        }
      });
      await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
      await altaRecibida;
      await page.getByRole('link', { name: '← Mi equipo' }).click();
      await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
      await page.getByRole('link', { name: 'Managers', exact: true }).click();
      await censoRecibido;
      if (estado === 'error') {
        resolverCenso();
        await expect(page.getByRole('alert')).toContainText('No hemos podido cargar los managers.');
      }
      resolverAlta();
      const dialogo = page.getByRole('dialog', { name: 'Cuenta creada para Manager Foco' });
      await expect(dialogo.getByRole('button', { name: 'Copiar contraseña' })).toBeFocused();
      const crear = page.getByRole('button', { name: 'Crear cuenta', exact: true });
      await expect(crear).toBeDisabled();
      if (cierre === 'Escape') await page.keyboard.press('Escape');
      else await dialogo.getByRole('button', { name: 'Hecho' }).click();
      await expect(dialogo).toHaveCount(0);
      await expect(crear).toBeDisabled();
      if (estado === 'error') {
        await page.unroute('**/api/managers');
        await page.getByRole('button', { name: 'Reintentar' }).click();
      } else resolverCenso();
      await expect(crear).toBeEnabled();
      await expect(crear).toBeFocused();
      await expect(page.locator('.alta-manager__clave')).toHaveCount(0);
    });
  }
}

test('P4: skeleton retardado, CTA deshabilitado en carga/error, reintento y reduced-motion', async ({ page }) => {
  let resolver!: () => void;
  const espera = new Promise<void>((resolve) => { resolver = resolve; });
  await page.route('**/api/managers', async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/ajustes/managers');
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeDisabled();
  await expect(page.locator('.censo-managers [aria-busy]')).toHaveCount(0);
  await page.clock.runFor(302);
  await expect(page.locator('.censo-managers [aria-busy="true"]')).toBeVisible();
  await expect(page.locator('.censo-managers__skeleton')).toHaveCount(3);
  expect(await page.locator('.censo-managers__skeleton').first().evaluate((n) => getComputedStyle(n).animationDuration)).toBe('0s');
  resolver();
  await expect(page.getByRole('alert')).toContainText('No hemos podido cargar los managers. Revisa tu conexión.');
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeDisabled();
  await page.unroute('**/api/managers');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('table', { name: 'Managers' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeEnabled();
});

test('P4: envío deshabilitado, fallo conserva formulario; Hecho borra la temporal y devuelve foco', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Nombre y apellidos').fill('Manager Hecho');
  await page.getByLabel('Email', { exact: true }).fill('manager-hecho@example.com');
  let resolver!: () => void;
  const espera = new Promise<void>((resolve) => { resolver = resolve; });
  const fallo = async (route: import('@playwright/test').Route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
  };
  await page.route('**/api/managers', fallo);
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();
  resolver();
  await expect(page.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await expect(page.getByLabel('Nombre y apellidos')).toHaveValue('Manager Hecho');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('manager-hecho@example.com');
  await page.unroute('**/api/managers', fallo);
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Cuenta creada para Manager Hecho' });
  await expect(dialogo).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('fallo simulado')) }); });
  await dialogo.getByRole('button', { name: 'Copiar contraseña' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText('No se ha podido copiar. Selecciona la contraseña y cópiala.');
  await expect(dialogo.locator('.alta-manager__clave')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Hecho' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeFocused();
  await expect(page.locator('.alta-manager__clave')).toHaveCount(0);
});
