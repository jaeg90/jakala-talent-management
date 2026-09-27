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

test('registro un 1-to-1 con acuerdos y marco uno cumplido', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Abro la ficha de Ana Alonso
  await page.getByRole('button', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Alonso' })).toBeVisible();
  await expect(page.getByText('Todavía no hay 1-to-1s registrados.')).toBeVisible();

  // Registro un 1-to-1 con notas por tema y un acuerdo
  await page.getByLabel('Fecha').fill('2026-09-27');
  await page.getByLabel('¿Cómo estás?').fill('Animada, con ganas');
  await page.getByLabel('¿Qué tal el proyecto?', { exact: true }).fill('Atlas Bank va bien');
  await page.getByLabel('Nuevo acuerdo').fill('Preparar dossier de Atlas Bank');
  await page.getByRole('button', { name: 'Añadir acuerdo' }).click();
  await page.getByRole('button', { name: 'Registrar 1-to-1' }).click();

  // Aparece en historial y el acuerdo queda pendiente a la vista
  await expect(page.getByRole('heading', { name: '2026-09-27' })).toBeVisible();
  await expect(page.getByText('Animada, con ganas')).toBeVisible();
  const pendientes = page.getByRole('region', { name: 'Acuerdos pendientes' });
  await expect(pendientes.getByText('Preparar dossier de Atlas Bank')).toBeVisible();

  // Marco el acuerdo cumplido: desaparece de pendientes y queda ✓ en historial
  await page.getByRole('button', { name: 'Marcar cumplido' }).click();
  await expect(page.getByText('Sin acuerdos pendientes.')).toBeVisible();
  const historial = page.getByRole('region', { name: 'Historial de 1-to-1s' });
  await expect(historial.getByText('✓ Preparar dossier de Atlas Bank')).toBeVisible();
});

test('credenciales incorrectas muestran error', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByText('Credenciales incorrectas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toBeHidden();
});
