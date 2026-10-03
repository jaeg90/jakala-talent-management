import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

test('añado un tema propio, lo veo en el formulario y lo retiro', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Abro la ficha de Ana Alonso
  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Alonso' })).toBeVisible();

  const temasPropios = page.getByRole('region', { name: 'Temas propios' });
  await expect(temasPropios.getByText('Sin temas propios.')).toBeVisible();

  // Alta de un tema propio
  await temasPropios.getByLabel('Nuevo tema propio').fill('formación en curso');
  await temasPropios.getByRole('button', { name: 'Añadir tema' }).click();

  // Aparece en la lista y en el formulario del 1-to-1, junto a los temas genéricos
  await expect(temasPropios.getByText('formación en curso')).toBeVisible();
  await expect(page.getByLabel('formación en curso')).toBeVisible();
  await expect(page.getByLabel('¿Cómo estás?')).toBeVisible();

  // Baja del tema propio: desaparece de la lista y del formulario
  await temasPropios.getByRole('button', { name: 'Retirar' }).click();
  await expect(temasPropios.getByText('Sin temas propios.')).toBeVisible();
  await expect(page.getByLabel('formación en curso')).toHaveCount(0);
});