import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

test('registro una incidencia desde la ficha', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Alta desde la ficha de Ana Alonso.
  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Alonso' })).toBeVisible();

  const incidencias = page.getByRole('region', { name: 'Incidencias' });
  await expect(incidencias.getByText('Sin incidencias.')).toBeVisible();

  await incidencias.getByLabel('Descripción').fill('Baja médica');
  await incidencias.getByRole('button', { name: 'Registrar incidencia' }).click();
  await expect(incidencias.getByText('Baja médica')).toBeVisible();
  await expect(incidencias.getByText('abierta')).toBeVisible();

  // La resolución de la incidencia (diálogo «Resolver incidencia») vuelve con
  // #22 (pantalla Incidencias de la ficha): aquí solo se comprueba el alta por UI.
});