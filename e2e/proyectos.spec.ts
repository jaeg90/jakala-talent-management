import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

async function iniciarSesion(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('veo el catálogo de proyectos y lo amplío', async ({ page }) => {
  await iniciarSesion(page);

  await page.getByRole('button', { name: 'Proyectos' }).click();
  await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();

  const catalogo = page.getByRole('region', { name: 'Catálogo de proyectos' });
  await expect(catalogo.getByText('Atlas Bank')).toBeVisible();

  // Alta de un proyecto nuevo: aparece en el catálogo.
  await catalogo.getByLabel('Nombre').fill('Proyecto Nuevo');
  await catalogo.getByRole('button', { name: 'Añadir proyecto' }).click();
  await expect(catalogo.getByText('Proyecto Nuevo')).toBeVisible();
});

test('muevo a una mentee de proyecto y aparece en el nuevo', async ({ page }) => {
  await iniciarSesion(page);

  // En la vista de proyectos, Ana está hoy en Atlas Bank.
  await page.getByRole('button', { name: 'Proyectos' }).click();
  const miembros = page.getByRole('region', { name: 'Quién está en cada proyecto' });
  const grupoAtlas = miembros.locator('li.objetivo').filter({ hasText: 'Atlas Bank' });
  await expect(grupoAtlas.getByText('Ana Alonso')).toBeVisible();

  // Abro su ficha y registro un cambio de proyecto.
  await page.getByRole('button', { name: '← Mi equipo' }).click();
  await page.getByRole('button', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Alonso' })).toBeVisible();

  const cambios = page.getByRole('region', { name: 'Cambios de proyecto' });
  await expect(cambios.getByText('Proyecto actual: Atlas Bank')).toBeVisible();
  await expect(cambios.getByText('Sin cambios de proyecto registrados.')).toBeVisible();

  await cambios.getByLabel('Destino').selectOption('pr-nova');
  await cambios.getByLabel('Motivo').fill('Rotación al proyecto de retail');
  await cambios.getByRole('button', { name: 'Registrar cambio' }).click();

  // El historial refleja el paso y el proyecto actual se actualiza.
  await expect(cambios.getByText('Atlas Bank → Retail Nova')).toBeVisible();
  await expect(cambios.getByText('Proyecto actual: Retail Nova')).toBeVisible();

  // Vuelvo a la vista de proyectos: Ana aparece ahora en Retail Nova.
  await page.getByRole('button', { name: '← Mi equipo' }).click();
  await page.getByRole('button', { name: 'Proyectos' }).click();

  const miembrosTras = page.getByRole('region', { name: 'Quién está en cada proyecto' });
  await expect(
    miembrosTras.locator('li.objetivo').filter({ hasText: 'Retail Nova' }).getByText('Ana Alonso'),
  ).toBeVisible();
  await expect(miembrosTras.locator('li.objetivo').filter({ hasText: 'Atlas Bank' })).toHaveCount(0);
});