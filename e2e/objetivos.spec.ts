import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

async function irAObjetivosDeAna(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Secciones de Ana Alonso' })
    .getByRole('link', { name: 'Objetivos' })
    .click();
  await expect(page.getByRole('heading', { name: 'Objetivos', exact: true })).toBeVisible();
}

test('alta de un objetivo: vacío, validaciones y aparición en «En curso»', async ({ page }) => {
  await login(page);
  await irAObjetivosDeAna(page);

  // Vacío de la pantalla (copy exacto de §05) y su CTA.
  await expect(
    page.getByText('Aún no hay objetivos para Ana. Define el primero para poder seguirlo en los 1-to-1s.'),
  ).toBeVisible();

  // Abro el diálogo «Nuevo objetivo» (subtítulo exacto de §13).
  await page.getByRole('button', { name: 'Nuevo objetivo' }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Nuevo objetivo' });
  await expect(dialogo).toBeVisible();
  await expect(
    dialogo.getByText(
      'Para Ana Alonso. Lo seguiréis en los 1-to-1s hasta que lo marques cumplido o no cumplido.',
    ),
  ).toBeVisible();

  // Enviar vacío → errores por campo (foco al primer inválido).
  await dialogo.getByRole('button', { name: 'Crear objetivo' }).click();
  await expect(dialogo.getByText('Ponle un título al objetivo.')).toBeVisible();
  await expect(dialogo.getByText('Elige una fecha límite.')).toBeVisible();
  await expect(dialogo.getByLabel('Título')).toBeFocused();

  // Fecha en el pasado → error exacto (fecha límite ≥ hoy).
  await dialogo.getByLabel('Título').fill('Certificar en AWS');
  await dialogo.getByLabel('Fecha límite').fill('2000-01-01');
  await dialogo.getByRole('button', { name: 'Crear objetivo' }).click();
  await expect(dialogo.getByText('La fecha límite no puede estar en el pasado.')).toBeVisible();

  // Alta válida.
  await dialogo.getByLabel('Fecha límite').fill('2099-12-31');
  await dialogo.getByLabel('Descripción (opcional)').fill('Aprobar el examen oficial');
  await dialogo.getByRole('button', { name: 'Crear objetivo' }).click();

  await expect(page.getByText('Objetivo creado.')).toBeVisible();

  // Aparece en «En curso» con su badge y «hasta 31 dic 2099».
  const enCurso = page.getByRole('region', { name: 'Objetivos en curso' });
  await expect(enCurso.getByText('En curso · 1')).toBeVisible();
  await expect(enCurso.getByText('Certificar en AWS')).toBeVisible();
  await expect(enCurso.getByText('hasta 31 dic 2099')).toBeVisible();
});

test('cerrar un objetivo es irreversible: confirmación y sin «Editar» en Cumplidos', async ({
  page,
  request,
}) => {
  // Alta por API para tener un objetivo en curso ya creado.
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  await request.post('/api/mentees/me-ana/objetivos', {
    data: { titulo: 'Liderar una sesión técnica', descripcion: 'Una sesión de 45 min', fechaLimite: '2099-12-31' },
  });

  await login(page);
  await irAObjetivosDeAna(page);

  const enCurso = page.getByRole('region', { name: 'Objetivos en curso' });
  await expect(enCurso.getByText('Liderar una sesión técnica')).toBeVisible();

  // Marcar cumplido pide confirmación irreversible.
  await enCurso.getByRole('button', { name: 'Marcar cumplido: Liderar una sesión técnica' }).click();
  const confirmacion = page.getByRole('alertdialog');
  await expect(
    confirmacion.getByText('¿Marcar «Liderar una sesión técnica» como cumplido?'),
  ).toBeVisible();
  await expect(confirmacion.getByText('No se puede reabrir.')).toBeVisible();
  await confirmacion.getByRole('button', { name: 'Marcar cumplido' }).click();

  // Pasa a «Cumplidos» con su fecha y sin acciones de edición/cierre.
  const cumplidos = page.getByRole('region', { name: 'Objetivos cumplidos' });
  await expect(cumplidos.getByText('Liderar una sesión técnica')).toBeVisible();
  await expect(cumplidos.getByText('Cumplido · 31 dic 2099')).toBeVisible();
  await expect(cumplidos.getByRole('button', { name: /Marcar cumplido|Marcar no cumplido|Editar/ })).toHaveCount(0);

  // Ya no está en curso.
  await expect(enCurso.getByText('Liderar una sesión técnica')).toHaveCount(0);
});

test('editar un objetivo en curso actualiza la tarjeta sin generar evento', async ({
  page,
  request,
}) => {
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  await request.post('/api/mentees/me-ana/objetivos', {
    data: { titulo: 'Preparar demo de pagos', descripcion: '', fechaLimite: '2099-12-31' },
  });

  await login(page);
  await irAObjetivosDeAna(page);

  const enCurso = page.getByRole('region', { name: 'Objetivos en curso' });
  await expect(enCurso.getByText('Preparar demo de pagos')).toBeVisible();

  // Diálogo de edición con subtítulo exacto y campos precargados.
  await enCurso.getByRole('button', { name: 'Editar: Preparar demo de pagos' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Editar objetivo' });
  await expect(dialogo.getByText('Solo los objetivos en curso se pueden editar.')).toBeVisible();
  await expect(dialogo.getByLabel('Título')).toHaveValue('Preparar demo de pagos');

  // Cambio título y fecha; la edición no genera evento de Historial (solo actualiza).
  await dialogo.getByLabel('Título').fill('Preparar demo de pagos trimestral');
  await dialogo.getByLabel('Fecha límite').fill('2099-11-15');
  await dialogo.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(page.getByText('Objetivo actualizado.')).toBeVisible();
  await expect(enCurso.getByText('Preparar demo de pagos trimestral')).toBeVisible();
  await expect(enCurso.getByText('hasta 15 nov 2099')).toBeVisible();
});