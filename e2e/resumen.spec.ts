import { expect, test } from '@playwright/test';
import { fechaHace } from './fechas.js';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

test('Resumen: sidebar con contrato de accesibilidad y bloques con su copy exacto', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Beatriz Blanco: mentee de la semilla sin 1-to-1s, incidencias ni objetivos.
  await page.getByRole('link', { name: 'Beatriz Blanco' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();

  // Sidebar: nav con aria-label y aria-current en «Resumen»; sin proyectos bajo el nombre.
  const nav = page.getByRole('navigation', { name: 'Secciones de Beatriz Blanco' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Resumen' })).toHaveAttribute('aria-current', 'page');

  // Sin 1-to-1s previos, el subtítulo usa el copy exacto.
  await expect(page.getByText('Aún no habéis tenido ningún 1-to-1')).toBeVisible();

  // Proyectos actuales: nombre + «desde <mes año>», orden alfabético.
  const proyectos = page.getByRole('region', { name: 'Proyectos actuales' });
  await expect(proyectos.getByText('Retail Nova')).toBeVisible();
  await expect(proyectos.getByText(/^desde (ene|feb|mar|abr|may|jun|jul|ago|sept|oct|nov|dic) 20\d\d$/)).toBeVisible();

  // Objetivos en curso vacío + acción «Nuevo objetivo».
  const objetivos = page.getByRole('region', { name: 'Objetivos en curso' });
  await expect(objetivos.getByText('Sin objetivos en curso.')).toBeVisible();
  await expect(objetivos.getByRole('link', { name: 'Nuevo objetivo' })).toBeVisible();

  // Temas propios vacío [v2] con su copy exacto (el enlace se mantiene).
  const temas = page.getByRole('region', { name: 'Temas propios' });
  await expect(
    temas.getByText('Sin temas propios. Añádelos en Ajustes de la mentee o al registrar un 1-to-1.'),
  ).toBeVisible();
  await expect(temas.getByRole('link', { name: 'Gestionar temas propios' })).toBeVisible();
});

test('el punto terracota de Incidencias aparece con texto oculto si hay abiertas', async ({
  page,
  request,
}) => {
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  await request.post('/api/mentees/me-carla/incidencias', {
    data: { descripcion: 'Baja médica', fechaApertura: fechaHace(30) },
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.getByRole('link', { name: 'Carla Cano' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Secciones de Carla Cano' });
  const incidencias = nav.getByRole('link', { name: 'Incidencias' });
  // El punto (8px terracota) solo aparece con una incidencia abierta, con su texto oculto.
  await expect(incidencias.getByText('(hay incidencias abiertas)')).toBeVisible();
  await expect(incidencias.locator('.ficha__punto')).toBeVisible();

  // La tarjeta de atención del Resumen muestra la incidencia abierta.
  const abiertas = page.getByRole('region', { name: 'Incidencias abiertas' });
  await expect(abiertas.getByText('1 incidencia abierta')).toBeVisible();
  await expect(abiertas.getByText('Baja médica')).toBeVisible();
  // La fecha de apertura elegida (hace 30 días) es la que determina la relativa del
  // Resumen («hace {relativa}» sobre `fechaAlta`), no la fecha de creación del registro.
  await expect(abiertas.getByText('hace 4 semanas')).toBeVisible();
});