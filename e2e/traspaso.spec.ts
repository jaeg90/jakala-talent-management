import { expect, test, type Page } from '@playwright/test';

// Credenciales de los managers semilla (ficticias, ver README).
const PASSWORD = 'secreta123';

async function iniciarSesion(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('traspaso una mentee entre dos managers y el destino hereda su historial', async ({
  page,
  request,
}) => {
  // Diego registra un 1-to-1 de Elena vía API (la pantalla Registrar 1-to-1 es #19).
  await request.post('/api/login', { data: { email: 'diego@jakala.example', password: PASSWORD } });
  const alta = await request.post('/api/mentees/me-elena/onetoones', {
    data: {
      date: '2026-09-27',
      notas: [{ tema: '¿Cómo estás?', nota: 'Animada, con ganas' }],
      acuerdos: [],
    },
  });
  expect(alta.status()).toBe(201);

  // Traspaso desde Ajustes de la mentee.
  await iniciarSesion(page, 'diego@jakala.example');
  await page.getByRole('link', { name: 'Elena Estévez' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Secciones de Elena Estévez' })
    .getByRole('link', { name: 'Ajustes de la mentee' })
    .click();

  const traspaso = page.getByRole('region', { name: 'Traspaso' });
  await expect(traspaso.getByText('Sin traspasos registrados.')).toBeVisible();

  await traspaso.getByLabel('Fecha del traspaso').fill('2026-09-27');
  await traspaso.getByLabel('Manager de destino').selectOption({ label: 'Lucía López' });
  await traspaso.getByLabel('Motivo').fill('Reorganización del equipo');
  await traspaso.getByRole('button', { name: 'Traspasar' }).click();

  // Vuelve a "Mi equipo": Elena ya no está en el equipo de Diego.
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Elena Estévez' })).toHaveCount(0);

  // Lucía inicia sesión y ve a Elena en su equipo.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await iniciarSesion(page, 'lucia@jakala.example');

  await expect(page.getByRole('link', { name: 'Elena Estévez' })).toBeVisible();

  // Abre la ficha: hereda el historial íntegro (1-to-1) y ve el traspaso registrado.
  await page.getByRole('link', { name: 'Elena Estévez' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByText('Animada, con ganas')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Secciones de Elena Estévez' })
    .getByRole('link', { name: 'Ajustes de la mentee' })
    .click();
  const traspasoLucia = page.getByRole('region', { name: 'Traspaso' });
  await expect(traspasoLucia.getByText('Diego Domínguez → Lucía López')).toBeVisible();
  await expect(traspasoLucia.getByText('Reorganización del equipo')).toBeVisible();
});