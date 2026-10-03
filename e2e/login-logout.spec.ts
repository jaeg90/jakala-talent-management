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
  const filaAna = page.locator('tbody tr', { hasText: 'Ana Alonso' });
  await expect(filaAna).toContainText('Atlas Bank');
  const filaBeatriz = page.locator('tbody tr', { hasText: 'Beatriz Blanco' });
  await expect(filaBeatriz).toContainText('Retail Nova');
  const filaCarla = page.locator('tbody tr', { hasText: 'Carla Cano' });
  await expect(filaCarla).toContainText('Aurora Health');
  await expect(page.locator('tbody tr', { hasText: 'David Duarte' })).toHaveCount(0);

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
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
});

test('registro un 1-to-1 con acuerdos y marco uno cumplido desde el Resumen', async ({ page, request }) => {
  // Registro vía API (la pantalla Registrar 1-to-1 es #19): dos notas y un acuerdo.
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  const alta = await request.post('/api/mentees/me-ana/onetoones', {
    data: {
      date: '2026-09-27',
      notas: [
        { tema: '¿Cómo estás?', nota: 'Animada, con ganas' },
        { tema: '¿Qué tal el proyecto?', nota: 'Atlas Bank va bien' },
      ],
      acuerdos: [{ text: 'Preparar dossier de Atlas Bank' }],
    },
  });
  expect(alta.status()).toBe(201);

  await iniciarSesion(page);

  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();

  // El acuerdo pendiente aparece en el Resumen con su fecha.
  const pendientes = page.getByRole('region', { name: 'Acuerdos pendientes' });
  await expect(pendientes.getByText('Preparar dossier de Atlas Bank')).toBeVisible();
  await expect(pendientes.getByText('del 27 sept')).toBeVisible();

  // Marcar el acuerdo desde el Resumen lo cumple: el checkbox queda deshabilitado
  // (conservado) y se anuncia «Cumplido» (accesibilidad.md §Checkbox de acuerdo).
  const checkbox = pendientes.getByRole('checkbox');
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeDisabled();
  await expect(page.getByRole('status')).toHaveText('Cumplido');
});

test('rutas navegables: deep-link, recarga, redirecciones', async ({ page }) => {
  await iniciarSesion(page);

  await page.goto('/mentees/me-ana/objetivos');
  await expect(page.getByRole('heading', { name: 'Objetivos', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Objetivos', exact: true })).toBeVisible();

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
  // El Login espera la resolución de la sesión antes de pintar el formulario
  // (bloqueo duro #24); esperamos a que el campo esté disponible antes de tabular.
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();

  const sombra = await page.getByLabel('Email').evaluate((el) => getComputedStyle(el).boxShadow);
  expect(sombra).not.toBe('none');
});

test('el botón primario muestra --foco-anillo con foco visible en claro y en oscuro', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();

  // Fija el tema claro antes de asertar: el tema inicial depende de la preferencia
  // del sistema, y el anillo debe quedar demostrado en claro Y en oscuro.
  await page.evaluate(() => window.__jtm?.cambiarTema('claro'));
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');

  const boton = page.getByRole('button', { name: 'Iniciar sesión' });

  // Resuelve --foco-anillo en el mismo formato del navegador (sonda con
  // box-shadow: var(--foco-anillo)) y lee el box-shadow computado del botón.
  const leerAnillo = () =>
    page.evaluate(() => {
      const sonda = document.createElement('div');
      sonda.style.boxShadow = 'var(--foco-anillo)';
      document.body.appendChild(sonda);
      const tokenResuelto = getComputedStyle(sonda).boxShadow;
      sonda.remove();
      return tokenResuelto;
    });
  const anilloBoton = () => boton.evaluate((el) => getComputedStyle(el).boxShadow);

  // Foco por teclado (Tab Email → Contraseña → botón) para que aplique :focus-visible.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(boton).toBeFocused();
  expect(await anilloBoton()).toBe(await leerAnillo());

  // Al pasar a oscuro --sombra-primario vale `none`; si el anillo se sumaba a esa
  // sombra, la lista de box-shadow era inválida y el botón perdía el anillo. Con el
  // arreglo (solo --foco-anillo) debe recomputar al token oscuro, sin anillo vacío.
  await page.evaluate(() => window.__jtm?.cambiarTema('oscuro'));
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
  await expect(boton).toBeFocused();
  expect(await anilloBoton()).toBe(await leerAnillo());
});