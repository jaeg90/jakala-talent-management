import { expect, test, type Page } from '@playwright/test';

// Credenciales de los managers semilla (ficticias, ver README).
const PASSWORD = 'secreta123';
const BASE_URL = 'http://localhost:4173';

async function iniciarSesion(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('bloqueo duro: redirige, avisa, muestra «—» y permite cerrar sesión', async ({ page }) => {
  await iniciarSesion(page, 'julia@jakala.example');
  await expect(page).toHaveURL(/\/ajustes\/perfil$/);
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await expect(page.getByText('Cambia tu contraseña temporal para continuar.')).toBeVisible();

  // Con el flag activo, /api/team devuelve 403 y la tarjeta muestra «—».
  const meta = page.locator('.perfil__meta');
  await expect(meta).toContainText('julia@jakala.example');
  await expect(meta).toContainText('· —');

  // Cualquier ruta distinta de /ajustes/perfil redirige allí de nuevo.
  await page.goto('/equipo');
  await expect(page).toHaveURL(/\/ajustes\/perfil$/);
  await expect(page.getByText('Cambia tu contraseña temporal para continuar.')).toBeVisible();

  // /login también redirige (el bloqueo duro incluye /login).
  await page.goto('/login');
  await expect(page).toHaveURL(/\/ajustes\/perfil$/);

  // Cerrar sesión sigue disponible.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('carga en frío de /login con cookie temporal → bloqueo inmediato', async ({
  page,
  context,
  request,
}) => {
  // Sesión temporal creada vía API: simula una cookie ya presente al abrir la app.
  const res = await request.post('/api/login', {
    data: { email: 'julia@jakala.example', password: PASSWORD },
  });
  const setCookie = res.headers()['set-cookie'] ?? '';
  const [name, value] = setCookie.split(';')[0].split('=');
  await context.addCookies([{ name: name ?? 'jtm_session', value: value ?? '', url: BASE_URL }]);

  await page.goto('/login');
  await expect(page).toHaveURL(/\/ajustes\/perfil$/);
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0);
});

test('requisitos de contraseña en aria-live y errores por campo', async ({ page }) => {
  await iniciarSesion(page, 'manager@jakala.example');
  await page.goto('/ajustes/perfil');

  const actual = page.getByLabel('Contraseña actual');
  const nueva = page.getByLabel('Nueva contraseña', { exact: true });
  const repetida = page.getByLabel('Repite la nueva contraseña');
  const requisitos = page.locator('#requisitos-contrasena');

  await actual.fill('secreta123');
  await nueva.fill('corto');
  await expect(requisitos).toContainText('○ Mínimo 10 caracteres');

  await nueva.fill('abcdefghij');
  await expect(requisitos).toContainText('✓ Mínimo 10 caracteres');
  await expect(requisitos).toContainText('✓ Distinta de la actual');

  // Repite distinta → error en el segundo campo.
  await repetida.fill('distinta-de');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();

  // Coinciden, pero la actual no es correcta → error en su campo.
  await actual.fill('incorrecta');
  await repetida.fill('abcdefghij');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText('La contraseña actual no es correcta.')).toBeVisible();
});

test('objetivos táctiles ≥ 44px de alto en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await iniciarSesion(page, 'manager@jakala.example');
  await page.goto('/ajustes/perfil');

  const interactivos = [
    page.getByRole('button', { name: 'Cerrar sesión' }),
    page.getByRole('link', { name: 'Ajustes' }),
    page.getByRole('link', { name: '← Mi equipo' }),
    page.getByRole('link', { name: 'Perfil y contraseña' }),
    page.getByRole('button', { name: 'Cambiar contraseña' }),
  ];

  for (const el of interactivos) {
    await expect(el).toBeVisible();
    const alto = await el.evaluate((n) => n.getBoundingClientRect().height);
    expect(alto).toBeGreaterThanOrEqual(44);
  }
});