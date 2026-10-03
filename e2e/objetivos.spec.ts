import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

test('creo un objetivo anual y lo marco cumplido', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Abro la ficha de Ana Alonso y navego a Objetivos desde el sidebar.
  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Secciones de Ana Alonso' }).getByRole('link', { name: 'Objetivos' }).click();
  await expect(page.getByRole('heading', { name: 'Objetivos', exact: true })).toBeVisible();

  const objetivos = page.getByRole('region', { name: 'Objetivos anuales' });
  await expect(objetivos.getByText('Sin objetivos.')).toBeVisible();

  // Alta de un objetivo anual
  await objetivos.getByLabel('Título').fill('Certificar en AWS');
  await objetivos.getByLabel('Descripción').fill('Aprobar el examen de Solutions Architect');
  await objetivos.getByLabel('Fecha límite').fill('2026-12-31');
  await objetivos.getByRole('button', { name: 'Añadir objetivo' }).click();

  // Aparece en curso con su fecha límite
  await expect(objetivos.getByText('Certificar en AWS')).toBeVisible();
  await expect(objetivos.getByText('Estado: en curso')).toBeVisible();

  // Lo marco cumplido: desaparecen los botones de transición
  await objetivos.getByRole('button', { name: 'Cumplido', exact: true }).click();
  await expect(objetivos.getByText('Estado: cumplido')).toBeVisible();
  await expect(objetivos.getByRole('button', { name: 'Cumplido', exact: true })).toHaveCount(0);
});