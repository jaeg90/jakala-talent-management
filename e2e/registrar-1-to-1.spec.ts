import { expect, test } from '@playwright/test';

// Credenciales del manager semilla (ficticias, ver README).
const EMAIL = 'manager@jakala.example';
const PASSWORD = 'secreta123';

test('Registrar 1-to-1: flujo completo desde el Resumen hasta guardar y volver con aviso', async ({
  page,
  request,
}) => {
  // Tema propio de Ana para rellenar en el formulario (alta por API; la gestión
  // en UI llega con #32). Se borra al final para no contaminar otros tests.
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  const alta = await request.post('/api/mentees/me-ana/temas', { data: { tema: 'Plan de crecimiento' } });
  expect(alta.status()).toBe(201);
  const temaPropioId = ((await alta.json()) as { id: string }).id;

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Ficha de Ana Alonso → acción primaria del Resumen.
  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await page.getByRole('link', { name: 'Registrar 1-to-1' }).click();

  // Pantalla completa: barra superior con título y enlace de vuelta.
  await expect(page.getByRole('heading', { name: 'Nuevo 1-to-1' })).toBeVisible();
  await expect(page.getByRole('link', { name: '← Ana Alonso' })).toBeVisible();

  // Los temas genéricos de la plantilla aparecen, en su orden, como textareas.
  const temas = page.getByRole('region', { name: 'Temas' });
  await expect(temas.getByLabel('¿Cómo estás?')).toBeVisible();
  await expect(temas.getByLabel('¿Qué tal el proyecto?')).toBeVisible();
  await expect(temas.getByLabel('¿Qué tal los objetivos?')).toBeVisible();

  // El tema propio aparece marcado con su chip y lo relleno (criterio: probar propios).
  await expect(temas.getByText('propio', { exact: true })).toBeVisible();
  await temas.getByRole('textbox', { name: 'Plan de crecimiento' }).fill('Tiene ganas de más responsabilidad');

  // Escribo una nota y añado un acuerdo (validación: al menos nota o acuerdo).
  await temas.getByLabel('¿Cómo estás?').fill('Con ganas de la semana');

  const acuerdos = page.getByRole('region', { name: 'Acuerdos nuevos' });
  await acuerdos.getByLabel('Nuevo acuerdo').fill('Revisar la carga con el líder');
  await acuerdos.getByRole('button', { name: 'Añadir acuerdo' }).click();
  await expect(acuerdos.getByText('Revisar la carga con el líder')).toBeVisible();

  // Guardar y volver al Resumen con el aviso de éxito.
  await page.getByRole('button', { name: 'Guardar 1-to-1' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByText(/1-to-1 del \d+ \w+ guardado\./)).toBeVisible();

  // Limpieza: retiro el tema propio para que otros tests vean a Ana sin propios.
  await request.post(`/api/mentees/me-ana/temas/${temaPropioId}/retirar`);
});

test('Registrar 1-to-1: descartar con cambios pide confirmación', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await page.getByRole('link', { name: 'Registrar 1-to-1' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo 1-to-1' })).toBeVisible();

  // Sin cambios, «Descartar» vuelve sin confirmación.
  await page.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();

  // Reentro y escribo: ahora descartar pide confirmación con su copy exacto.
  await page.getByRole('link', { name: 'Registrar 1-to-1' }).click();
  await page.getByRole('region', { name: 'Temas' }).getByLabel('¿Cómo estás?').fill('borrador');
  await page.getByRole('button', { name: 'Descartar' }).click();

  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('¿Descartar el 1-to-1?')).toBeVisible();
  await expect(dialogo.getByText('Lo que has escrito no se guardará.')).toBeVisible();

  // «Seguir escribiendo» conserva el borrador.
  await dialogo.getByRole('button', { name: 'Seguir escribiendo' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo 1-to-1' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Temas' }).getByLabel('¿Cómo estás?')).toHaveValue(
    'borrador',
  );

  // «Descartar» abandona la pantalla.
  await page.getByRole('button', { name: 'Descartar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();

  // La navegación in-app («← Ana Alonso») con borrador sin guardar también avisa.
  await page.getByRole('link', { name: 'Registrar 1-to-1' }).click();
  await page.getByRole('region', { name: 'Temas' }).getByLabel('¿Cómo estás?').fill('borrador');
  await page.getByRole('link', { name: '← Ana Alonso' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('alertdialog').getByText('¿Descartar el 1-to-1?')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
});

test('Registrar 1-to-1: retirar un tema propio pide confirmación con el copy de §14', async ({
  page,
  request,
}) => {
  // Alta de un tema propio por API (la gestión en UI llega con #32).
  await request.post('/api/login', { data: { email: EMAIL, password: PASSWORD } });
  await request.post('/api/mentees/me-ana/temas', { data: { tema: 'Seguimiento de onboarding' } });

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await page.getByRole('link', { name: 'Registrar 1-to-1' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo 1-to-1' })).toBeVisible();

  const temas = page.getByRole('region', { name: 'Temas' });
  await expect(temas.getByText('Seguimiento de onboarding')).toBeVisible();
  await expect(temas.getByText('propio', { exact: true }).first()).toBeVisible();

  // Escribo en su textarea para verificar la advertencia adicional.
  await temas.getByRole('textbox', { name: 'Seguimiento de onboarding' }).fill('Lee el plan de certificación');

  await temas.getByRole('button', { name: 'Retirar tema: Seguimiento de onboarding' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo.getByText('¿Retirar el tema «Seguimiento de onboarding»?')).toBeVisible();
  await expect(
    dialogo.getByText(
      'Dejará de aparecer en los próximos 1-to-1s con Ana. Los 1-to-1s ya registrados no cambian. Puedes volver a usarlo cuando quieras. Lo que has escrito en este tema no se guardará.',
    ),
  ).toBeVisible();

  // Confirmar retira el tema del formulario (y de verdad, vía POST retirar).
  await dialogo.getByRole('button', { name: 'Retirar tema' }).click();
  await expect(temas.getByText('Seguimiento de onboarding')).toHaveCount(0);
  await expect(temas.getByLabel('Seguimiento de onboarding')).toHaveCount(0);
});

test('Registrar 1-to-1: salir por el historial (botón atrás) con borrador abre el mismo aviso', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await page.getByRole('link', { name: 'Registrar 1-to-1' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo 1-to-1' })).toBeVisible();

  // Borrador sin guardar → el botón atrás del navegador abre el `alertdialog`.
  await page.getByRole('region', { name: 'Temas' }).getByLabel('¿Cómo estás?').fill('borrador');
  await page.goBack();

  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('alertdialog').getByText('¿Descartar el 1-to-1?')).toBeVisible();
  // «Seguir escribiendo» conserva la pantalla y el borrador.
  await page.getByRole('alertdialog').getByRole('button', { name: 'Seguir escribiendo' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo 1-to-1' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Temas' }).getByLabel('¿Cómo estás?')).toHaveValue(
    'borrador',
  );
});

test('Registrar 1-to-1: recarga con borrador dispara el aviso nativo del navegador', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.getByRole('link', { name: 'Ana Alonso' }).click();
  await page.getByRole('link', { name: 'Registrar 1-to-1' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo 1-to-1' })).toBeVisible();

  await page.getByRole('region', { name: 'Temas' }).getByLabel('¿Cómo estás?').fill('borrador');

  // `beforeunload` solo puede mostrar el aviso nativo del navegador, no el
  // `alertdialog` (no es un elemento consultable por rol). Se verifica que el
  // manejador cancela la salida cuando hay borrador: un `beforeunload` cancelable
  // que se `preventDefault` devuelve `false` en `dispatchEvent`.
  const tieneAviso = await page.evaluate(() => {
    const evento = new Event('beforeunload', { cancelable: true });
    return !window.dispatchEvent(evento);
  });
  expect(tieneAviso).toBe(true);
});