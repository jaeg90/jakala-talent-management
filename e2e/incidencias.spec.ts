import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

test('abro una incidencia, la veo en el equipo y la resuelvo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Abro la ficha de Ana Alonso y registro una incidencia.
  await page.getByRole('button', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Alonso' })).toBeVisible();

  const incidenciasFicha = page.getByRole('region', { name: 'Incidencias' });
  await expect(incidenciasFicha.getByText('Sin incidencias.')).toBeVisible();
  await incidenciasFicha.getByLabel('Descripción').fill('Baja médica');
  await incidenciasFicha.getByRole('button', { name: 'Registrar incidencia' }).click();
  await expect(incidenciasFicha.getByText('Baja médica')).toBeVisible();
  await expect(incidenciasFicha.getByText('abierta')).toBeVisible();

  // Vuelvo al equipo y veo la incidencia en la vista de incidencias abiertas.
  await page.getByRole('button', { name: '← Mi equipo' }).click();
  await page.getByRole('button', { name: 'Incidencias' }).click();
  await expect(page.getByRole('heading', { name: 'Incidencias abiertas' })).toBeVisible();
  await expect(page.locator('li', { hasText: 'Baja médica' })).toBeVisible();
  await expect(page.locator('.objetivo-meta', { hasText: 'Ana Alonso' })).toBeVisible();

  // La resuelvo dejando nota: desaparece de las abiertas.
  await page.getByLabel('Nota de resolución').fill('Reincorporada tras la baja');
  await page.getByRole('button', { name: 'Resolver' }).click();
  await expect(page.getByText('No hay incidencias abiertas en tu equipo.')).toBeVisible();

  // La resuelta queda en el historial de la ficha.
  await page.getByRole('button', { name: '← Mi equipo' }).click();
  await page.getByRole('button', { name: 'Ana Alonso' }).click();
  const incidenciasTras = page.getByRole('region', { name: 'Incidencias' });
  await expect(incidenciasTras.getByText('Baja médica')).toBeVisible();
  await expect(incidenciasTras.getByText('Reincorporada tras la baja')).toBeVisible();
});