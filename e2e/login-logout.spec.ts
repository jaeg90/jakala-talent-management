import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

test('login → vista de equipo → logout', async ({ page }) => {
  await page.goto('/');

  // Login
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Vista de equipo con los proyectos correctos
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toBeVisible();
  await expect(page.locator('.mentee-list li', { hasText: 'Ana Alonso' })).toContainText('Atlas Bank');
  await expect(page.locator('.mentee-list li', { hasText: 'Beatriz Blanco' })).toContainText('Retail Nova');
  await expect(page.locator('.mentee-list li', { hasText: 'Carla Cano' })).toContainText('Aurora Health');

  // Aislamiento: no ve mentees de otros managers
  await expect(page.locator('.mentee-list li', { hasText: 'David Duarte' })).toHaveCount(0);

  // Logout: vuelve al login y la vista queda bloqueada
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();

  // Sin sesión, la UI no muestra la vista de equipo
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('credenciales incorrectas muestran error', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByText('Credenciales incorrectas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toBeHidden();
});
