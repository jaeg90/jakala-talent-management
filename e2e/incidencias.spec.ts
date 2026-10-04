import { expect, test } from '@playwright/test';
import { fechaHace } from './fechas.js';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

async function irAIncidenciasDe(page: import('@playwright/test').Page, nombre: string) {
  await page.getByRole('link', { name: nombre }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await page
    .getByRole('navigation', { name: `Secciones de ${nombre}` })
    .getByRole('link', { name: 'Incidencias' })
    .click();
  await expect(page.getByRole('heading', { name: 'Incidencias', exact: true })).toBeVisible();
}

/** Beatriz Blanco: mentee de Marta sin fixtures en la semilla. Solo la tocan las
 *  pruebas de resolución en medio/último; se limpia antes de cada caso para que
 *  sean independientes entre sí (los E2E comparten una única base de datos). */
const BEA = 'me-bea';

/** Resuelve por API todas las incidencias abiertas de una mentee (limpieza previa). */
async function limpiarAbiertas(
  request: import('@playwright/test').APIRequestContext,
  menteeId: string,
): Promise<void> {
  const res = await request.get(`/api/mentees/${menteeId}/incidencias`);
  const body = (await res.json()) as { incidencias: { id: string; estado: string }[] };
  for (const i of body.incidencias.filter((x) => x.estado === 'abierta')) {
    await request.post(`/api/incidencias/${i.id}/resolver`, { data: { nota: 'Limpieza de E2E' } });
  }
}

test('ciclo de incidencia: alta con fecha de apertura, resolución con nota y aparición en el historial', async ({
  page,
}) => {
  await login(page);
  await irAIncidenciasDe(page, 'Ana Alonso');

  const incidencias = page.getByRole('region', { name: 'Incidencias' });
  // Vacío de la pantalla (copy exacto de §06).
  await expect(
    incidencias.getByText(
      'Sin incidencias. Regístrala aquí si ocurre algo extraordinario (una baja, un conflicto, un retraso).',
    ),
  ).toBeVisible();

  // Abro el diálogo «Registrar incidencia» (subtítulo exacto de §12).
  await incidencias.getByRole('button', { name: 'Registrar incidencia' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Registrar incidencia' });
  await expect(dialogo).toBeVisible();
  await expect(
    dialogo.getByText('Ana Alonso · algo extraordinario: una baja, un conflicto, un retraso.'),
  ).toBeVisible();

  // La textarea «Descripción» pinta min-height 96px (spec §12); `.campo textarea`
  // fija 72px para el §Campo genérico y la clase propia debe prevalecer en la
  // cascada. Se verifica el estilo computado (no basta con la clase: la regla
  // genérica compite por especificidad).
  expect(
    await dialogo.getByLabel('Descripción').evaluate((el) => getComputedStyle(el).minHeight),
  ).toBe('96px');

  // Contrato de accesibilidad: foco inicial en «Cancelar» y, al cerrar con Esc sin
  // cambios, el foco vuelve al disparador (accesibilidad.md §Diálogos).
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(incidencias.getByRole('button', { name: 'Registrar incidencia' })).toBeFocused();

  // Reabro para continuar el ciclo.
  await incidencias.getByRole('button', { name: 'Registrar incidencia' }).click();
  await expect(dialogo).toBeVisible();

  // Enviar vacío → error por campo.
  await dialogo.getByRole('button', { name: 'Registrar incidencia' }).click();
  await expect(dialogo.getByText('Describe la incidencia.')).toBeVisible();

  // Fecha borrada (`input type="date"` admite vacío y `noValidate` ignora el
  // `required`): error por campo, no se envía `''` al servidor.
  await dialogo.getByLabel('Descripción').fill('Baja médica');
  await dialogo.getByLabel('Fecha de apertura').fill('');
  await dialogo.getByRole('button', { name: 'Registrar incidencia' }).click();
  await expect(dialogo.getByText('Elige una fecha.')).toBeVisible();

  // Fecha futura → error exacto.
  await dialogo.getByLabel('Descripción').fill('Baja médica');
  await dialogo.getByLabel('Fecha de apertura').fill('2999-01-01');
  await dialogo.getByRole('button', { name: 'Registrar incidencia' }).click();
  await expect(dialogo.getByText('La fecha no puede ser futura.')).toBeVisible();

  // Alta válida con fecha de apertura en el pasado (≤ hoy).
  await dialogo.getByLabel('Fecha de apertura').fill('2026-09-12');
  await dialogo.getByRole('button', { name: 'Registrar incidencia' }).click();

  // Aviso de éxito y aparición en «Abiertas» con su fecha de apertura.
  await expect(page.getByText('Incidencia registrada.')).toBeVisible();
  const abiertas = page.getByRole('region', { name: 'Incidencias abiertas' });
  await expect(abiertas.getByText('Abiertas · 1')).toBeVisible();
  await expect(abiertas.getByText('Baja médica')).toBeVisible();
  await expect(abiertas.getByText(/Abierta el 12 sept/)).toBeVisible();

  // El punto terracota del sidebar aparece al haber una incidencia abierta.
  const enlaceIncidencias = page
    .getByRole('navigation', { name: 'Secciones de Ana Alonso' })
    .getByRole('link', { name: 'Incidencias' });
  await expect(enlaceIncidencias.getByText('(hay incidencias abiertas)')).toBeVisible();
  await expect(enlaceIncidencias.locator('.ficha__punto')).toBeVisible();

  // Resolver con nota obligatoria: botón deshabilitado mientras la nota está vacía.
  await abiertas.getByRole('button', { name: 'Resolver: Baja médica' }).click();
  const resolver = page.getByRole('dialog', { name: 'Resolver incidencia' });
  await expect(resolver.getByText('Baja médica')).toBeVisible();
  await expect(
    resolver.getByText('Una incidencia resuelta no se puede reabrir; quedará en el historial.'),
  ).toBeVisible();

  // La textarea «Nota de resolución» también pinta min-height 96px (spec §06),
  // compitiendo igualmente con la regla genérica `.campo textarea` de 72px.
  expect(
    await resolver
      .getByLabel('Nota de resolución (obligatoria)')
      .evaluate((el) => getComputedStyle(el).minHeight),
  ).toBe('96px');

  // Contrato de accesibilidad: foco inicial en «Cancelar» y, al cancelar, el foco
  // vuelve al disparador (accesibilidad.md §Diálogos).
  await expect(resolver.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await resolver.getByRole('button', { name: 'Cancelar' }).click();
  await expect(resolver).toBeHidden();
  await expect(abiertas.getByRole('button', { name: 'Resolver: Baja médica' })).toBeFocused();

  // Reabro para continuar con la resolución.
  await abiertas.getByRole('button', { name: 'Resolver: Baja médica' }).click();
  await expect(resolver).toBeVisible();

  const resolverBoton = resolver.getByRole('button', { name: 'Resolver incidencia' });
  await expect(resolverBoton).toBeDisabled();
  await resolver.getByLabel('Nota de resolución (obligatoria)').fill('Reincorporada tras la baja');
  await expect(resolverBoton).toBeEnabled();

  // Con la nota escrita, Esc pide descartar (accesibilidad.md §Diálogos con
  // formulario: «Esc cierra si no hay cambios, y si los hay pide descartar»);
  // «Seguir editando» conserva la nota y devuelve el foco al diálogo de resolución.
  await page.keyboard.press('Escape');
  const descartar = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  await expect(descartar.getByText('Lo que has escrito no se guardará.')).toBeVisible();
  await expect(descartar.getByRole('button', { name: 'Seguir editando' })).toBeFocused();
  await descartar.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(descartar).toBeHidden();
  await expect(resolver).toBeVisible();
  await expect(resolver.getByLabel('Nota de resolución (obligatoria)')).toHaveValue(
    'Reincorporada tras la baja',
  );

  await resolverBoton.click();

  // Pasa a «Resueltas» con su nota.
  const resueltas = page.getByRole('region', { name: 'Incidencias resueltas' });
  await expect(resueltas.getByText('Resueltas · 1')).toBeVisible();
  await expect(resueltas.getByText('Baja médica')).toBeVisible();
  await expect(resueltas.getByText(/«Reincorporada tras la baja»/)).toBeVisible();

  // Foco tras resolver: no queda ninguna abierta → va a «Registrar incidencia»
  // (defecto reparado: el disparador «Resolver» ya no está en el DOM).
  await expect(incidencias.getByRole('button', { name: 'Registrar incidencia' })).toBeFocused();

  // Sin incidencias abiertas, el punto terracota del sidebar desaparece.
  await expect(enlaceIncidencias.getByText('(hay incidencias abiertas)')).toHaveCount(0);

  // La resuelta queda en el historial como incidencia resuelta.
  await page
    .getByRole('navigation', { name: 'Secciones de Ana Alonso' })
    .getByRole('link', { name: 'Historial' })
    .click();
  const historial = page.getByRole('region', { name: 'Historial' });
  await expect(historial.getByText('Baja médica')).toBeVisible();
  await expect(historial.getByText('Resuelta')).toBeVisible();
  // La fecha de apertura elegida (2026-09-12) es la que ubica el evento en el
  // Historial: queda en el grupo «Septiembre 2026», no en el mes en curso.
  const grupoSeptiembre = page.locator('.timeline__grupo').filter({ hasText: 'Septiembre 2026' });
  await expect(grupoSeptiembre.getByText('Baja médica')).toBeVisible();
});

test('al resolver una de varias abiertas, el foco va al siguiente «Resolver»', async ({
  page,
  request,
}) => {
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  // Dos incidencias abiertas: la más reciente (hoy) se lista primero; al resolverla,
  // el foco debe recaer en el «Resolver» de la que queda.
  await request.post('/api/mentees/me-ana/incidencias', {
    data: { descripcion: 'Conflicto de prioridades', fechaApertura: fechaHace(0) },
  });
  await request.post('/api/mentees/me-ana/incidencias', {
    data: { descripcion: 'Retraso en una entrega', fechaApertura: fechaHace(5) },
  });

  await login(page);
  await irAIncidenciasDe(page, 'Ana Alonso');

  const abiertas = page.getByRole('region', { name: 'Incidencias abiertas' });
  await expect(abiertas.getByText('Abiertas · 2')).toBeVisible();

  await abiertas.getByRole('button', { name: 'Resolver: Conflicto de prioridades' }).click();
  const resolver = page.getByRole('dialog', { name: 'Resolver incidencia' });
  await expect(resolver).toBeVisible();
  await resolver.getByLabel('Nota de resolución (obligatoria)').fill('Mediado con el equipo');
  await resolver.getByRole('button', { name: 'Resolver incidencia' }).click();

  // Queda una abierta y el foco recae en su «Resolver» (defecto 1 reparado).
  await expect(abiertas.getByText('Abiertas · 1')).toBeVisible();
  await expect(abiertas.getByRole('button', { name: 'Resolver: Retraso en una entrega' })).toBeFocused();
});

test('al resolver la del medio de tres abiertas, el foco va a la siguiente', async ({
  page,
  request,
}) => {
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  // Tres abiertas: la más reciente (hoy) se lista primero y la más antigua última.
  // Resolver la del medio deja abiertas a la anterior y a la siguiente.
  await limpiarAbiertas(request, BEA);
  await request.post(`/api/mentees/${BEA}/incidencias`, {
    data: { descripcion: 'Primera incidencia', fechaApertura: fechaHace(0) },
  });
  await request.post(`/api/mentees/${BEA}/incidencias`, {
    data: { descripcion: 'Incidencia del medio', fechaApertura: fechaHace(5) },
  });
  await request.post(`/api/mentees/${BEA}/incidencias`, {
    data: { descripcion: 'Última incidencia', fechaApertura: fechaHace(10) },
  });

  await login(page);
  await irAIncidenciasDe(page, 'Beatriz Blanco');

  const abiertas = page.getByRole('region', { name: 'Incidencias abiertas' });
  await expect(abiertas.getByText('Abiertas · 3')).toBeVisible();

  await abiertas.getByRole('button', { name: 'Resolver: Incidencia del medio' }).click();
  const resolver = page.getByRole('dialog', { name: 'Resolver incidencia' });
  await expect(resolver).toBeVisible();
  await resolver.getByLabel('Nota de resolución (obligatoria)').fill('Mediado con el equipo');
  await resolver.getByRole('button', { name: 'Resolver incidencia' }).click();

  // El foco recae en la que ahora ocupa su posición en orden de lectura: la
  // siguiente («Última incidencia»), no en la primera de las restantes.
  await expect(abiertas.getByText('Abiertas · 2')).toBeVisible();
  await expect(abiertas.getByRole('button', { name: 'Resolver: Última incidencia' })).toBeFocused();
});

test('al resolver la última de tres abiertas, el foco envuelve a la primera restante', async ({
  page,
  request,
}) => {
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  await limpiarAbiertas(request, BEA);
  await request.post(`/api/mentees/${BEA}/incidencias`, {
    data: { descripcion: 'Primera incidencia', fechaApertura: fechaHace(0) },
  });
  await request.post(`/api/mentees/${BEA}/incidencias`, {
    data: { descripcion: 'Incidencia del medio', fechaApertura: fechaHace(5) },
  });
  await request.post(`/api/mentees/${BEA}/incidencias`, {
    data: { descripcion: 'Última incidencia', fechaApertura: fechaHace(10) },
  });

  await login(page);
  await irAIncidenciasDe(page, 'Beatriz Blanco');

  const abiertas = page.getByRole('region', { name: 'Incidencias abiertas' });
  await expect(abiertas.getByText('Abiertas · 3')).toBeVisible();

  await abiertas.getByRole('button', { name: 'Resolver: Última incidencia' }).click();
  const resolver = page.getByRole('dialog', { name: 'Resolver incidencia' });
  await expect(resolver).toBeVisible();
  await resolver.getByLabel('Nota de resolución (obligatoria)').fill('Resuelta con seguimiento');
  await resolver.getByRole('button', { name: 'Resolver incidencia' }).click();

  // Al resolver la última, el foco envuelve a la primera de las restantes en
  // orden de lectura («Primera incidencia»).
  await expect(abiertas.getByText('Abiertas · 2')).toBeVisible();
  await expect(abiertas.getByRole('button', { name: 'Resolver: Primera incidencia' })).toBeFocused();
});
