import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { fechaHace } from './fechas';

// Managers semilla (ficticios, ver README). Cada prueba crea su PROPIO manager
// con plantilla inicial (mecanismo de #15/#25) y lo borra en afterEach: así la
// mutación de la plantilla jamás toca la del manager compartido (sin rastro).
const MARTA = 'manager@jakala.example';
const PASSWORD = 'secreta123';
const CLAVE = 'plantilla-e2e-segura';

interface Creados { managers: string[]; mentees: string[] }

let creados: Creados;
let emailDelManager: string;

test.beforeEach(() => {
  creados = { managers: [], mentees: [] };
});

test.afterEach(async ({ page }, testInfo) => {
  await page.close();
  const db = new Database(testInfo.config.metadata.dbPath as string);
  try {
    db.pragma('foreign_keys = ON');
    db.transaction(() => {
      for (const id of creados.mentees) {
        db.prepare('DELETE FROM acuerdos WHERE onetoone_id IN (SELECT id FROM onetoones WHERE mentee_id = ?)').run(id);
        db.prepare('DELETE FROM notas_por_tema WHERE onetoone_id IN (SELECT id FROM onetoones WHERE mentee_id = ?)').run(id);
        db.prepare('DELETE FROM onetoones WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM asignaciones WHERE mentee_id = ?').run(id);
        db.prepare('DELETE FROM mentees WHERE id = ?').run(id);
      }
      for (const id of creados.managers) {
        db.prepare('DELETE FROM plantilla WHERE manager_id = ?').run(id);
        db.prepare('DELETE FROM managers WHERE id = ?').run(id);
      }
    })();
  } finally { db.close(); }
});

/** Crea un manager con su plantilla inicial y le cambia la contraseña temporal
 * (desactiva el bloqueo duro de #24); deja listo el email para el login de UI. */
async function managerDePrueba(request: APIRequestContext, sufijo: string): Promise<void> {
  const email = `plantilla-${sufijo}@example.com`;
  await request.post('/api/login', { data: { email: MARTA, password: PASSWORD } });
  const alta = await request.post('/api/managers', {
    data: { name: `Manager Plantilla ${sufijo}`, email },
  });
  expect(alta.status()).toBe(201);
  const { manager, contrasenaTemporal } = (await alta.json()) as {
    manager: { id: string }; contrasenaTemporal: string;
  };
  creados.managers.push(manager.id);
  const sesion = await request.post('/api/login', { data: { email, password: contrasenaTemporal } });
  expect(sesion.status()).toBe(200);
  const cambio = await request.post('/api/cuenta/contrasena', {
    data: { actual: contrasenaTemporal, nueva: CLAVE },
  });
  expect(cambio.status()).toBe(200);
  emailDelManager = email;
}

async function iniciarSesion(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/equipo$/);
}

async function abrirPlantilla(page: Page) {
  await page.goto('/ajustes/perfil');
  await page.getByRole('link', { name: 'Plantilla de 1-to-1', exact: true }).click();
  await expect(page).toHaveURL(/\/ajustes\/plantilla$/);
  await expect(page.getByRole('link', { name: 'Plantilla de 1-to-1', exact: true })).toHaveAttribute('aria-current', 'page');
}

test('gestión completa: orden, edición en línea, reordenar con anuncio y foco, retirar, volver a usar, añadir y restablecer', async ({ page, request }) => {
  await managerDePrueba(request, 'uno');
  await iniciarSesion(page, emailDelManager);
  await abrirPlantilla(page);

  const tarjeta = page.getByRole('region', { name: 'Tu plantilla de 1-to-1' });
  await expect(tarjeta.getByRole('heading', { name: 'Tu plantilla de 1-to-1' })).toBeVisible();
  await expect(tarjeta.getByText('Los temas genéricos con los que empieza cada 1-to-1 con tus mentees. Es solo tuya: otros managers tienen la suya. Los cambios se aplican a partir del siguiente 1-to-1; los ya registrados no cambian.')).toBeVisible();

  // Tres temas iniciales en su orden, numerados; el primer ↑ y el último ↓ deshabilitados.
  const filas = tarjeta.getByRole('listitem');
  await expect(filas).toHaveCount(3);
  await expect(filas.nth(0).locator('.plantilla__numero')).toHaveText('1');
  await expect(filas.nth(0).locator('.plantilla__tema')).toHaveText('¿Cómo estás?');
  await expect(filas.nth(1).locator('.plantilla__tema')).toHaveText('¿Qué tal el proyecto?');
  await expect(filas.nth(2).locator('.plantilla__tema')).toHaveText('¿Qué tal los objetivos?');
  await expect(page.getByRole('button', { name: 'Subir ¿Cómo estás?' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Bajar ¿Cómo estás?' })).toHaveAttribute('aria-disabled', 'false');
  await expect(page.getByRole('button', { name: 'Bajar ¿Qué tal los objetivos?' })).toHaveAttribute('aria-disabled', 'true');

  // Cascada (guardarraíl): la fila hundida conserva sus tokens pintados y las
  // acciones `.accion` y el control `.boton-icono` anulan el fondo sólido que
  // `button` hereda de styles.css (también en hover).
  const filaPrimera = filas.nth(0);
  await expect(filaPrimera).toHaveCSS('background-color', 'oklch(0.97 0.012 70)');
  await expect(filaPrimera).toHaveCSS('border-radius', '10px');
  await expect(filaPrimera).toHaveCSS('padding', '10px 12px');
  await expect(filaPrimera.locator('.plantilla__tema')).toHaveCSS('font-weight', '600');
  const editar = page.getByRole('button', { name: 'Editar tema: ¿Cómo estás?' });
  await expect(editar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(editar).toHaveCSS('padding', '0px');
  await editar.hover();
  await expect(editar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const retirar = page.getByRole('button', { name: 'Retirar tema: ¿Cómo estás?' });
  await expect(retirar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(retirar).toHaveCSS('padding', '0px');
  const bajar = page.getByRole('button', { name: 'Bajar ¿Cómo estás?' });
  await expect(bajar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(bajar).toHaveCSS('width', '30px');
  await expect(bajar).toHaveCSS('height', '30px');
  await expect(bajar).toHaveCSS('border-radius', '8px');
  await bajar.hover();
  await expect(bajar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  // Reordenar: baja el primero; el anuncio de posición entra en aria-live y el
  // foco permanece en el botón (accesibilidad.md §Reordenar temas).
  await page.getByRole('button', { name: 'Bajar ¿Cómo estás?' }).click();
  await expect(page.getByRole('status')).toHaveText('¿Cómo estás? movido a la posición 2 de 3.');
  await expect(page.getByRole('button', { name: 'Bajar ¿Cómo estás?' })).toBeFocused();
  await expect(filas.nth(0).locator('.plantilla__tema')).toHaveText('¿Qué tal el proyecto?');
  await expect(filas.nth(1).locator('.plantilla__tema')).toHaveText('¿Cómo estás?');
  await expect(filas.nth(2).locator('.plantilla__tema')).toHaveText('¿Qué tal los objetivos?');
  await expect(filas.nth(1).locator('.plantilla__numero')).toHaveText('2');

  // Edición en línea: Cancelar devuelve el texto; Guardar lo cambia y anuncia.
  // Las filas se localizan por posición (el orden ya está afirmado arriba): al
  // guardar, el texto de la fila cambia y un filtro por texto quedaría obsoleto.
  const filaDelMedio = filas.nth(1);
  await page.getByRole('button', { name: 'Editar tema: ¿Cómo estás?' }).click();
  const entrada = page.getByRole('textbox', { name: '¿Cómo estás?' });
  await expect(entrada).toBeFocused();
  await expect(entrada).toHaveValue('¿Cómo estás?');
  await filaDelMedio.getByRole('button', { name: 'Cancelar' }).click();
  await expect(entrada).toHaveCount(0);
  await expect(filaDelMedio.locator('.plantilla__tema')).toHaveText('¿Cómo estás?');
  await expect(page.getByRole('button', { name: 'Editar tema: ¿Cómo estás?' })).toBeFocused();

  await page.getByRole('button', { name: 'Editar tema: ¿Cómo estás?' }).click();
  await entrada.fill('¿Cómo va tu semana?');
  await filaDelMedio.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «¿Cómo va tu semana?» guardado.');
  await expect(filaDelMedio.locator('.plantilla__tema')).toHaveText('¿Cómo va tu semana?');
  await expect(page.getByRole('button', { name: 'Editar tema: ¿Cómo va tu semana?' })).toBeFocused();

  // Retirar: pasa a «Retirados» y el foco va al «Retirar» siguiente.
  await page.getByRole('button', { name: 'Retirar tema: ¿Cómo va tu semana?' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «¿Cómo va tu semana?» retirado.');
  const retirados = page.getByRole('region', { name: 'Temas retirados' });
  await expect(retirados.getByRole('heading', { name: 'Retirados · 1' })).toBeVisible();
  await expect(retirados.getByText('¿Cómo va tu semana?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retirar tema: ¿Qué tal los objetivos?' })).toBeFocused();

  // Volver a usar: regresa al final de los vigentes y vacía «Retirados».
  await page.getByRole('button', { name: 'Volver a usar: ¿Cómo va tu semana?' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «¿Cómo va tu semana?» vuelve a estar en uso.');
  await expect(retirados).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bajar ¿Cómo va tu semana?' })).toHaveAttribute('aria-disabled', 'true');
  await expect(filas.nth(2).locator('.plantilla__tema')).toHaveText('¿Cómo va tu semana?');

  // Añadir: va al final, vacía el campo y devuelve el foco a él.
  const alta = page.getByRole('region', { name: 'Añadir tema genérico' });
  await expect(alta.getByRole('heading', { name: 'Añadir tema genérico' })).toBeVisible();
  await expect(alta.getByText('Formúlalo como pregunta abierta, igual que los demás.', { exact: true })).toBeVisible();
  await alta.getByRole('textbox', { name: 'Tema' }).fill('¿Qué tal la conciliación?');
  await alta.getByRole('button', { name: 'Añadir tema' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «¿Qué tal la conciliación?» añadido.');
  await expect(page.getByRole('button', { name: 'Bajar ¿Qué tal la conciliación?' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('textbox', { name: 'Tema' })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Tema' })).toHaveValue('');

  // Restablecer con confirmación: Cancelar no hace nada; confirmar recompone los
  // tres temas iniciales (el editado y el añadido pasan a retirados).
  const pie = page.getByRole('button', { name: 'Restablecer plantilla inicial' });
  await expect(page.getByText('Cada cuenta nueva de manager empieza con los tres temas iniciales.')).toBeVisible();
  await pie.click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Restablecer tu plantilla?' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toHaveAccessibleDescription('Tus temas actuales pasarán a retirados.');
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(pie).toBeFocused();

  await pie.click();
  await dialogo.getByRole('button', { name: 'Restablecer plantilla' }).click();
  await expect(page.getByRole('status')).toHaveText('Plantilla restablecida.');
  await expect(dialogo).toHaveCount(0);
  await expect(pie).toBeFocused();
  await expect(page.getByRole('button', { name: 'Subir ¿Cómo estás?' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Retirar tema: ¿Cómo va tu semana?' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Temas retirados' }).getByRole('heading', { name: 'Retirados · 2' })).toBeVisible();
  await expect(retirados.getByText('¿Cómo va tu semana?')).toBeVisible();
  await expect(retirados.getByText('¿Qué tal la conciliación?')).toBeVisible();
});

test('validación de alta y edición: vacío, duplicado y P4 de alta con error que conserva lo escrito', async ({ page, request }) => {
  await managerDePrueba(request, 'dos');
  await iniciarSesion(page, emailDelManager);
  await abrirPlantilla(page);

  const alta = page.getByRole('region', { name: 'Añadir tema genérico' });
  const campo = alta.getByRole('textbox', { name: 'Tema' });

  // Alta vacía: mensaje del dominio, foco en el campo y ninguna petición.
  let peticiones = 0;
  await page.route('**/api/plantilla/temas', async (route) => {
    peticiones += 1;
    await route.fallback();
  });
  await alta.getByRole('button', { name: 'Añadir tema' }).click();
  await expect(campo).toHaveAttribute('aria-invalid', 'true');
  const descripcion = await campo.getAttribute('aria-describedby');
  expect(await page.locator(`[id="${descripcion}"]`).textContent()).toBe('El texto del tema no puede estar vacío');
  await expect(campo).toBeFocused();
  expect(peticiones).toBe(0);

  // Duplicado (el servidor responde 409): mensaje exacto y valor conservado.
  await campo.fill('¿Cómo estás?');
  await alta.getByRole('button', { name: 'Añadir tema' }).click();
  await expect(alta.getByRole('alert')).toHaveText('Ya existe el tema "¿Cómo estás?" en la plantilla');
  await expect(campo).toHaveValue('¿Cómo estás?');
  await expect(campo).toBeFocused();

  // Alta con fallo del servidor: gerundio, CTA deshabilitado y aviso encima del botón.
  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => { soltar = resolve; });
  await page.unroute('**/api/plantilla/temas');
  await page.route('**/api/plantilla/temas', async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
  });
  await alta.getByRole('button', { name: 'Añadir tema' }).click();
  await expect(page.getByRole('button', { name: 'Añadiendo…' })).toBeDisabled();
  soltar();
  await expect(alta.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await expect(campo).toHaveValue('¿Cómo estás?');
  await expect(page.getByRole('button', { name: 'Añadir tema' })).toBeEnabled();

  // Reintento: el campo conserva el duplicado, así que lo cambio por un tema nuevo.
  await page.unroute('**/api/plantilla/temas');
  await campo.fill('Tema de reintento');
  await alta.getByRole('button', { name: 'Añadir tema' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «Tema de reintento» añadido.');
  await expect(campo).toHaveValue('');

  // Edición vacía: el mensaje del dominio bajo el input, la edición sigue abierta
  // con lo escrito y Cancelar devuelve la fila sin cambios.
  const tarjeta = page.getByRole('region', { name: 'Tu plantilla de 1-to-1' });
  const fila = tarjeta.getByRole('listitem').filter({ hasText: '¿Cómo estás?' });
  await fila.getByRole('button', { name: 'Editar tema: ¿Cómo estás?' }).click();
  const entrada = page.getByRole('textbox', { name: '¿Cómo estás?' });
  await entrada.fill('   ');
  await fila.getByRole('button', { name: 'Guardar' }).click();
  await expect(fila.getByRole('alert')).toHaveText('El texto del tema no puede estar vacío');
  await expect(entrada).toHaveValue('   ');
  await expect(entrada).toHaveAttribute('aria-invalid', 'true');
  await fila.getByRole('button', { name: 'Cancelar' }).click();
  await expect(fila.locator('.plantilla__tema')).toHaveText('¿Cómo estás?');
});

test('restricción del último vigente y foco al retirar y reactivar en medio, último y vacío', async ({ page, request }) => {
  await managerDePrueba(request, 'tres');
  await iniciarSesion(page, emailDelManager);
  await abrirPlantilla(page);

  const tarjeta = page.getByRole('region', { name: 'Tu plantilla de 1-to-1' });
  const retirados = page.getByRole('region', { name: 'Temas retirados' });

  // Retirar la fila del medio: foco al «Retirar» siguiente.
  await page.getByRole('button', { name: 'Retirar tema: ¿Qué tal el proyecto?' }).click();
  await expect(page.getByRole('button', { name: 'Retirar tema: ¿Qué tal los objetivos?' })).toBeFocused();

  // Retirar la última fila: foco al «Retirar» que queda (el anterior).
  await page.getByRole('button', { name: 'Retirar tema: ¿Qué tal los objetivos?' }).click();
  await expect(page.getByRole('button', { name: 'Retirar tema: ¿Cómo estás?' })).toBeFocused();
  await expect(retirados.getByRole('heading', { name: 'Retirados · 2' })).toBeVisible();

  // Restricción: el último vigente no se puede retirar; el motivo está asociado
  // al botón (aria-describedby) y pulsarlo no cambia nada. Playwright exige
  // force para pulsar un elemento aria-disabled.
  const retirarUltimo = page.getByRole('button', { name: 'Retirar tema: ¿Cómo estás?' });
  await expect(retirarUltimo).toHaveAttribute('aria-disabled', 'true');
  await expect(retirarUltimo).toHaveAccessibleDescription('La plantilla necesita al menos un tema.');
  await expect(page.getByText('La plantilla necesita al menos un tema.')).toBeVisible();
  await retirarUltimo.click({ force: true });
  // Nada cambió: no hay anuncio de retirada del último y sigue siendo el único vigente.
  await expect(page.getByRole('status')).not.toContainText('¿Cómo estás?');
  await expect(tarjeta.getByRole('listitem')).toHaveCount(1);
  await expect(retirados.getByRole('heading', { name: 'Retirados · 2' })).toBeVisible();

  // Añadir y retirar de nuevo: la fila nueva es la última y el foco vuelve al
  // «Retirar» del único vigente.
  const alta = page.getByRole('region', { name: 'Añadir tema genérico' });
  await alta.getByRole('textbox', { name: 'Tema' }).fill('Tema extra de foco');
  await alta.getByRole('button', { name: 'Añadir tema' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «Tema extra de foco» añadido.');
  await page.getByRole('button', { name: 'Retirar tema: Tema extra de foco' }).click();
  await expect(page.getByRole('button', { name: 'Retirar tema: ¿Cómo estás?' })).toBeFocused();
  await expect(retirados.getByRole('heading', { name: 'Retirados · 3' })).toBeVisible();

  // Reactivar la fila del medio: foco al «Volver a usar» siguiente.
  await page.getByRole('button', { name: 'Volver a usar: ¿Qué tal los objetivos?' }).click();
  await expect(page.getByRole('button', { name: 'Volver a usar: Tema extra de foco' })).toBeFocused();

  // Reactivar la primera de las dos que quedan: el foco sigue en la última.
  await page.getByRole('button', { name: 'Volver a usar: ¿Qué tal el proyecto?' }).click();
  await expect(page.getByRole('button', { name: 'Volver a usar: Tema extra de foco' })).toBeFocused();

  // Reactivar la última: «Retirados» queda vacío y el foco va al campo de alta.
  await page.getByRole('button', { name: 'Volver a usar: Tema extra de foco' }).click();
  await expect(page.getByRole('region', { name: 'Temas retirados' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Tema' })).toBeFocused();
  await expect(tarjeta.getByRole('listitem')).toHaveCount(4);
});

test('los 1-to-1s ya registrados no cambian al editar la plantilla; el siguiente usa la nueva', async ({ page, request }) => {
  await managerDePrueba(request, 'cuatro');
  await iniciarSesion(page, emailDelManager);

  // Mentee del manager de prueba y un 1-to-1 registrado con la plantilla original.
  const alta = await request.post('/api/mentees', {
    data: { name: 'Mentee Plantilla E2E', proyectos: [], enEquipoDesde: fechaHace(1) },
  });
  expect(alta.status()).toBe(201);
  const menteeId = ((await alta.json()) as { id: string }).id;
  creados.mentees.push(menteeId);
  const registro = await request.post(`/api/mentees/${menteeId}/onetoones`, {
    data: {
      date: fechaHace(0),
      notas: [{ tema: '¿Cómo estás?', nota: 'Nota original E2E' }],
      acuerdos: [],
    },
  });
  expect(registro.status()).toBe(201);
  const unoAUnoId = ((await registro.json()) as { id: string }).id;

  await abrirPlantilla(page);
  const tarjeta = page.getByRole('region', { name: 'Tu plantilla de 1-to-1' });

  // Edita el texto del tema y retira otro.
  const fila = tarjeta.getByRole('listitem').filter({ hasText: '¿Cómo estás?' });
  await fila.getByRole('button', { name: 'Editar tema: ¿Cómo estás?' }).click();
  await page.getByRole('textbox', { name: '¿Cómo estás?' }).fill('¿Cómo va tu semana?');
  await fila.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «¿Cómo va tu semana?» guardado.');
  await page.getByRole('button', { name: 'Retirar tema: ¿Qué tal el proyecto?' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «¿Qué tal el proyecto?» retirado.');

  // El 1-to-1 ya registrado conserva sus notas tal como estaban.
  const ficha = (await (await request.get(`/api/mentees/${menteeId}/onetoones`)).json()) as {
    history: { id: string; notas: { tema: string; nota: string }[] }[];
  };
  expect(ficha.history.find((o) => o.id === unoAUnoId)?.notas).toEqual([
    { tema: '¿Cómo estás?', nota: 'Nota original E2E' },
  ]);

  // En la lista de 1-to-1s se sigue leyendo el tema original; el nuevo no aparece.
  await page.goto('/equipo');
  await page.getByRole('link', { name: 'Mentee Plantilla E2E' }).click();
  await page.getByRole('navigation').getByRole('link', { name: '1-to-1s' }).click();
  const lista = page.getByRole('region', { name: '1-to-1s' });
  await expect(lista.getByText('¿Cómo estás?')).toBeVisible();
  await expect(lista.getByText('Nota original E2E')).toBeVisible();
  await expect(lista).not.toContainText('¿Cómo va tu semana?');
  await expect(lista).not.toContainText('¿Qué tal el proyecto?');

  // El formulario del siguiente 1-to-1 sí usa la plantilla editada.
  await page.getByRole('link', { name: 'Resumen' }).click();
  await page.getByRole('link', { name: 'Registrar 1-to-1' }).click();
  const temas = page.getByRole('region', { name: 'Temas' });
  await expect(temas.getByLabel('¿Cómo va tu semana?')).toBeVisible();
  await expect(temas.getByLabel('¿Qué tal los objetivos?')).toBeVisible();
  await expect(temas.getByLabel('¿Cómo estás?')).toHaveCount(0);
  await expect(temas.getByLabel('¿Qué tal el proyecto?')).toHaveCount(0);
});

test('P4: skeleton diferido, error de carga y reintento, CTA deshabilitado y reduced-motion', async ({ page, request }) => {
  await managerDePrueba(request, 'cinco');
  await iniciarSesion(page, emailDelManager);

  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => { soltar = resolve; });
  await page.route('**/api/plantilla', async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/ajustes/plantilla');

  await expect(page.getByRole('button', { name: 'Añadir tema' })).toBeDisabled();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restablecer plantilla inicial' })).toHaveCount(0);
  await page.clock.runFor(300);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toContainText('Cargando…');
  const barras = page.locator('.plantilla__skeleton[aria-hidden="true"]');
  await expect(barras).toHaveCount(3);
  const estilo = await barras.first().evaluate((n) => {
    const s = getComputedStyle(n);
    const esperado = document.createElement('span');
    esperado.style.background = 'var(--color-superficie-hundida)';
    n.parentElement!.append(esperado);
    const fondo = getComputedStyle(esperado).backgroundColor;
    esperado.remove();
    return { fondo: s.backgroundColor, esperado: fondo, animation: s.animationName, duration: s.animationDuration };
  });
  expect(estilo.fondo).toBe(estilo.esperado);
  expect(estilo.animation).toBe('pulso-esqueleto');
  expect(estilo.duration).toBe('1.2s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await barras.first().evaluate((n) => getComputedStyle(n).animationDuration)).toBe('0s');

  soltar();
  await expect(page.getByRole('alert')).toContainText('No hemos podido cargar la plantilla. Revisa tu conexión.');
  await expect(page.getByRole('button', { name: 'Añadir tema' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Restablecer plantilla inicial' })).toHaveCount(0);

  await page.unroute('**/api/plantilla');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('button', { name: 'Subir ¿Cómo estás?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Añadir tema' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Restablecer plantilla inicial' })).toBeVisible();
});

test('P4: fallos de mover y retirar no cambian filas, mantienen el foco y permiten reintentar', async ({ page, request }) => {
  await managerDePrueba(request, 'seis');
  await iniciarSesion(page, emailDelManager);
  await abrirPlantilla(page);

  const tarjeta = page.getByRole('region', { name: 'Tu plantilla de 1-to-1' });

  // Movimiento fallido: durante el envío las acciones quedan inoperativas;
  // al fallar, el orden no cambia, el foco sigue en el botón y hay aviso.
  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => { soltar = resolve; });
  await page.route('**/api/plantilla/temas/*/mover', async (route) => {
    await espera;
    await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
  });
  await page.getByRole('button', { name: 'Bajar ¿Cómo estás?' }).click();
  // Durante el envío el botón anuncia el gerundio y queda deshabilitado (P4 §Estados).
  await expect(page.getByRole('button', { name: 'Moviendo ¿Cómo estás?' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Bajar ¿Cómo estás?' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Subir ¿Cómo estás?' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Añadir tema' })).toBeDisabled();
  soltar();
  await expect(tarjeta.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await expect(tarjeta.getByRole('listitem').nth(0).locator('.plantilla__tema')).toHaveText('¿Cómo estás?');
  await expect(page.getByRole('button', { name: 'Bajar ¿Cómo estás?' })).toBeFocused();
  await page.unroute('**/api/plantilla/temas/*/mover');
  await page.getByRole('button', { name: 'Bajar ¿Cómo estás?' }).click();
  await expect(page.getByRole('status')).toHaveText('¿Cómo estás? movido a la posición 2 de 3.');
  await expect(tarjeta.getByRole('listitem').nth(1).locator('.plantilla__tema')).toHaveText('¿Cómo estás?');

  // Retirada fallida: la fila sigue vigente, con el foco en «Retirando…».
  let soltarRetirada!: () => void;
  const esperaRetirada = new Promise<void>((resolve) => { soltarRetirada = resolve; });
  await page.route('**/api/plantilla/temas/*/retirar', async (route) => {
    await esperaRetirada;
    await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
  });
  await page.getByRole('button', { name: 'Retirar tema: ¿Cómo estás?' }).click();
  const retirando = page.getByRole('button', { name: 'Retirando tema: ¿Cómo estás?' });
  await expect(retirando).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Añadir tema' })).toBeDisabled();
  soltarRetirada();
  await expect(page.getByRole('button', { name: 'Retirar tema: ¿Cómo estás?' })).toBeFocused();
  await expect(tarjeta.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await expect(page.getByRole('region', { name: 'Temas retirados' })).toHaveCount(0);
  await page.unroute('**/api/plantilla/temas/*/retirar');
  await page.getByRole('button', { name: 'Retirar tema: ¿Cómo estás?' }).click();
  await expect(page.getByRole('region', { name: 'Temas retirados' }).getByRole('heading', { name: 'Retirados · 1' })).toBeVisible();

  // Retirando la otra fila, la primera queda como única vigente: la restricción aparece.
  await page.getByRole('button', { name: 'Retirar tema: ¿Qué tal el proyecto?' }).click();
  await expect(page.getByText('La plantilla necesita al menos un tema.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retirar tema: ¿Qué tal los objetivos?' })).toHaveAttribute('aria-disabled', 'true');
});

test('P4: «Cancelar» no actúa durante el envío (edición en línea y diálogo de restablecimiento)', async ({ page, request }) => {
  await managerDePrueba(request, 'siete');
  await iniciarSesion(page, emailDelManager);
  await abrirPlantilla(page);

  const tarjeta = page.getByRole('region', { name: 'Tu plantilla de 1-to-1' });
  const fila = tarjeta.getByRole('listitem').filter({ hasText: '¿Cómo estás?' });

  // Edición en línea: mientras se guarda, «Cancelar» queda deshabilitado y no
  // devuelve la fila aunque se fuerce el clic (P4 §Estados «Enviando»).
  let soltarEdicion!: () => void;
  const esperaEdicion = new Promise<void>((resolve) => { soltarEdicion = resolve; });
  await page.route('**/api/plantilla/temas/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      await esperaEdicion;
      await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
    } else {
      await route.fallback();
    }
  });
  await fila.getByRole('button', { name: 'Editar tema: ¿Cómo estás?' }).click();
  const entrada = page.getByRole('textbox', { name: '¿Cómo estás?' });
  await entrada.fill('¿Cómo va tu semana?');
  await fila.getByRole('button', { name: 'Guardar' }).click();
  const cancelarEdicion = fila.getByRole('button', { name: 'Cancelar' });
  await expect(cancelarEdicion).toHaveAttribute('aria-disabled', 'true');
  await cancelarEdicion.click({ force: true });
  await expect(entrada).toBeVisible();
  await expect(fila.getByRole('button', { name: 'Cancelar' })).toHaveAttribute('aria-disabled', 'true');
  soltarEdicion();
  await expect(fila.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await page.unroute('**/api/plantilla/temas/*');
  await fila.getByRole('button', { name: 'Cancelar' }).click();
  await expect(fila.locator('.plantilla__tema')).toHaveText('¿Cómo estás?');

  // Restablecer: mientras la petición está en curso, «Cancelar» y «Restablecer
  // plantilla» quedan deshabilitados (P4 §Estados «Enviando»).
  let soltarRestablecer!: () => void;
  const esperaRestablecer = new Promise<void>((resolve) => { soltarRestablecer = resolve; });
  await page.route('**/api/plantilla/restablecer', async (route) => {
    await esperaRestablecer;
    await route.fulfill({ status: 500, json: { error: 'fallo simulado' } });
  });
  await page.getByRole('button', { name: 'Restablecer plantilla inicial' }).click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Restablecer tu plantilla?' });
  await dialogo.getByRole('button', { name: 'Restablecer plantilla' }).click();
  await expect(dialogo.getByRole('button', { name: 'Restableciendo…' })).toBeDisabled();
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  soltarRestablecer();
  await expect(dialogo.getByRole('alert')).toHaveText('No se ha podido guardar. Inténtalo de nuevo.');
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
});

test('restablecer con una edición en línea abierta limpia el editor', async ({ page, request }) => {
  await managerDePrueba(request, 'ocho');
  await iniciarSesion(page, emailDelManager);
  await abrirPlantilla(page);

  // Añade un tema no inicial: al restablecer pasará a retirados.
  const alta = page.getByRole('region', { name: 'Añadir tema genérico' });
  await alta.getByRole('textbox', { name: 'Tema' }).fill('Tema temporal de reset');
  await alta.getByRole('button', { name: 'Añadir tema' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «Tema temporal de reset» añadido.');

  // Abre su edición en línea y deja un borrador sin guardar.
  await page.getByRole('button', { name: 'Editar tema: Tema temporal de reset' }).click();
  const entrada = page.getByRole('textbox', { name: 'Tema temporal de reset' });
  await expect(entrada).toBeFocused();
  await entrada.fill('Borrador sin guardar');

  // Restablece mientras la edición sigue abierta.
  await page.getByRole('button', { name: 'Restablecer plantilla inicial' }).click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Restablecer tu plantilla?' });
  await dialogo.getByRole('button', { name: 'Restablecer plantilla' }).click();
  await expect(page.getByRole('status')).toHaveText('Plantilla restablecida.');

  // El tema editado quedó retirado; al volver a usarlo no reaparece el editor
  // ni el borrador colgado: la fila muestra el texto del tema, no un input.
  const retirados = page.getByRole('region', { name: 'Temas retirados' });
  await expect(retirados.getByRole('heading', { name: 'Retirados · 1' })).toBeVisible();
  await expect(retirados.getByText('Tema temporal de reset')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tema temporal de reset' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Volver a usar: Tema temporal de reset' }).click();
  await expect(page.getByRole('status')).toHaveText('Tema «Tema temporal de reset» vuelve a estar en uso.');
  await expect(page.getByRole('textbox', { name: 'Tema temporal de reset' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Tu plantilla de 1-to-1' }).getByText('Tema temporal de reset')).toBeVisible();
});
