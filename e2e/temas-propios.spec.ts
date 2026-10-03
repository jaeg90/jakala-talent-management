import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

test('los temas propios aparecen como chips de solo lectura en el Resumen', async ({ page, request }) => {
  // Alta de un tema propio por API (la gestión en UI llega con #32).
  const login = await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  expect(login.status()).toBe(200);
  const alta = await request.post('/api/mentees/me-ana/temas', { data: { tema: 'Formación en curso' } });
  expect(alta.status()).toBe(201);

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();

  // Chips de solo lectura en la sección «Temas propios» del Resumen.
  const temas = page.getByRole('region', { name: 'Temas propios' });
  await expect(temas.getByText('Formación en curso')).toBeVisible();

  // El enlace «Gestionar temas propios» navega a Ajustes de la mentee.
  await temas.getByRole('link', { name: 'Gestionar temas propios' }).click();
  await expect(page).toHaveURL(/\/mentees\/me-ana\/ajustes#temas-propios$/);
  await expect(page.getByRole('heading', { name: 'Ajustes de la mentee' })).toBeVisible();
});