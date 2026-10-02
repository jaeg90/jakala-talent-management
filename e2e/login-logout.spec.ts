import { expect, test, type Page } from '@playwright/test';

// Credenciales de los managers semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

async function iniciarSesion(page: Page, email = EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('login normal → Mi equipo → logout', async ({ page }) => {
  await iniciarSesion(page);
  await expect(page).toHaveURL(/\/equipo$/);
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toBeVisible();
  await expect(page.locator('.mentee-list li', { hasText: 'Ana Alonso' })).toContainText('Atlas Bank');
  await expect(page.locator('.mentee-list li', { hasText: 'Beatriz Blanco' })).toContainText('Retail Nova');
  await expect(page.locator('.mentee-list li', { hasText: 'Carla Cano' })).toContainText('Aurora Health');
  await expect(page.locator('.mentee-list li', { hasText: 'David Duarte' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('credenciales incorrectas: error exacto y foco en Contraseña', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Email o contraseña incorrectos. Revísalos e inténtalo de nuevo.',
  );
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toHaveCount(0);
});

test('contraseña temporal → Perfil y contraseña', async ({ page }) => {
  await iniciarSesion(page, 'julia@jakala.example');
  await expect(page).toHaveURL(/\/ajustes\/perfil$/);
  await expect(page.getByRole('heading', { name: 'Perfil y contraseña' })).toBeVisible();
});

test('registro un 1-to-1 con acuerdos y marco uno cumplido', async ({ page }) => {
  await iniciarSesion(page);

  await page.getByRole('button', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Alonso' })).toBeVisible();
  await expect(page.getByText('Todavía no hay 1-to-1s registrados.')).toBeVisible();

  await page.getByLabel('Fecha', { exact: true }).fill('2026-09-27');
  await page.getByLabel('¿Cómo estás?').fill('Animada, con ganas');
  await page.getByLabel('¿Qué tal el proyecto?', { exact: true }).fill('Atlas Bank va bien');
  await page.getByLabel('Nuevo acuerdo').fill('Preparar dossier de Atlas Bank');
  await page.getByRole('button', { name: 'Añadir acuerdo' }).click();
  await page.getByRole('button', { name: 'Registrar 1-to-1' }).click();

  await expect(page.getByRole('heading', { name: '2026-09-27' })).toBeVisible();
  await expect(page.getByText('Animada, con ganas')).toBeVisible();
  const pendientes = page.getByRole('region', { name: 'Acuerdos pendientes' });
  await expect(pendientes.getByText('Preparar dossier de Atlas Bank')).toBeVisible();

  await page.getByRole('button', { name: 'Marcar cumplido' }).click();
  await expect(page.getByText('Sin acuerdos pendientes.')).toBeVisible();
  const historial = page.getByRole('region', { name: 'Historial de 1-to-1s' });
  await expect(historial.getByText('✓ Preparar dossier de Atlas Bank')).toBeVisible();
});

test('rutas navegables: deep-link, recarga, redirecciones', async ({ page }) => {
  await iniciarSesion(page);

  await page.goto('/mentees/me-ana/objetivos');
  await expect(page.getByRole('heading', { name: 'Objetivos' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Objetivos' })).toBeVisible();

  await page.goto('/ajustes');
  await expect(page).toHaveURL(/\/ajustes\/perfil$/);

  await page.goto('/ruta-desconocida');
  await expect(page).toHaveURL(/\/equipo$/);

  // Una ruta privada sin sesión redirige al Login.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.goto('/equipo');
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('el tema se aplica antes del render y es conmutable por código sin recargar', async ({ page }) => {
  await page.goto('/login');
  const inicial = await page.evaluate(() => document.documentElement.dataset.tema);
  expect(['claro', 'oscuro']).toContain(inicial);

  // Conmutación por código en la página activa: actualiza `data-tema` sin recargar.
  await page.evaluate(() => window.__jtm?.cambiarTema('oscuro'));
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');

  await page.evaluate(() => window.__jtm?.cambiarTema('claro'));
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');

  // La preferencia persiste y se aplica antes del render (sin FOUC).
  await page.evaluate(() => window.__jtm?.cambiarTema('oscuro'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');

  // «Según el sistema» resuelve con matchMedia.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => window.__jtm?.cambiarTema('sistema'));
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');

  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => window.__jtm?.cambiarTema('sistema'));
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
});

test('el fondo de body computa --color-fondo en claro y oscuro, no el #f5f5fa legacy', async ({ page }) => {
  await page.goto('/login');

  // Resuelve el fondo computado de <body> y el valor del token --color-fondo en el
  // mismo formato del navegador: una sonda con `background-color: var(--color-fondo)`.
  const leerFondo = () =>
    page.evaluate(() => {
      const sonda = document.createElement('div');
      sonda.style.backgroundColor = 'var(--color-fondo)';
      document.body.appendChild(sonda);
      const tokenResuelto = getComputedStyle(sonda).backgroundColor;
      sonda.remove();
      return {
        fondo: getComputedStyle(document.body).backgroundColor,
        tokenResuelto,
      };
    });

  await page.evaluate(() => window.__jtm?.cambiarTema('claro'));
  const claro = await leerFondo();
  // En claro el fondo sigue al token Lino y no al #f5f5fa legacy.
  expect(claro.fondo).toBe(claro.tokenResuelto);
  expect(claro.fondo).not.toBe('rgb(245, 245, 250)');

  await page.evaluate(() => window.__jtm?.cambiarTema('oscuro'));
  const oscuro = await leerFondo();
  // En oscuro el fondo sigue al token Tueste y tampoco cae al #f5f5fa legacy.
  expect(oscuro.fondo).toBe(oscuro.tokenResuelto);
  expect(oscuro.fondo).not.toBe('rgb(245, 245, 250)');
  expect(oscuro.fondo).not.toBe(claro.fondo);
});

test('foco visible con --foco-anillo en el Login', async ({ page }) => {
  await page.goto('/login');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();

  const sombra = await page.getByLabel('Email').evaluate((el) => getComputedStyle(el).boxShadow);
  expect(sombra).not.toBe('none');
});