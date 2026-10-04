import { expect, test, type Page } from '@playwright/test';

async function abrirApariencia(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('manager@jakala.example');
  await page.getByLabel('Contraseña', { exact: true }).fill('secreta123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/equipo$/);
  await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await page.getByRole('link', { name: 'Apariencia', exact: true }).click();
  await expect(page).toHaveURL(/\/ajustes\/apariencia$/);
}

test('el tema cambia al elegirlo y persiste tras recargar y volver a Ajustes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await abrirApariencia(page);
  const oscuro = page.getByRole('radio', { name: 'Oscuro Tueste', exact: true });
  await oscuro.check();
  await expect(oscuro).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
  expect(await page.evaluate(() => localStorage.getItem('jtm-tema'))).toBe('oscuro');

  await page.reload();
  await expect(oscuro).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('radio', { name: 'Claro Lino', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Claro Lino', exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  await page.getByRole('link', { name: 'Perfil y contraseña' }).click();
  await page.getByRole('link', { name: 'Apariencia', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Claro Lino', exact: true })).toBeChecked();
});

test('Según el sistema es la opción inicial y sigue los cambios del SO', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await abrirApariencia(page);
  const sistema = page.getByRole('radio', { name: 'Según el sistema Sigue a tu ordenador', exact: true });
  await expect(sistema).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');

  await page.getByRole('radio', { name: 'Oscuro Tueste', exact: true }).check();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
  await sistema.check();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  expect(await page.evaluate(() => localStorage.getItem('jtm-tema'))).toBe('sistema');
  await page.reload();
  await expect(sistema).toBeChecked();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
  await expect(sistema).toBeChecked();
});

test('el foco conserva el borde interior de las opciones en claro y oscuro', async ({ page }) => {
  await abrirApariencia(page);
  const grupo = page.getByRole('group', { name: 'Tema', exact: true });
  const enlace = page.getByRole('link', { name: 'Apariencia', exact: true });

  for (const tema of ['Claro Lino', 'Oscuro Tueste']) {
    await grupo.getByRole('radio', { name: tema, exact: true }).check();
    await page.keyboard.press('Tab');
    for (const nombre of ['Claro Lino', 'Oscuro Tueste', 'Según el sistema Sigue a tu ordenador']) {
      const radio = page.getByRole('radio', { name: nombre, exact: true });
      const seleccionado = await radio.isChecked();
      const tarjeta = grupo.locator('label').filter({ has: radio });
      await radio.focus();
      await expect(radio).toBeFocused();
      expect(await radio.evaluate((n) => n.matches(':focus-visible'))).toBe(true);
      for (const conFoco of [true, false]) {
        if (!conFoco) await enlace.focus();
        const sombras = await tarjeta.evaluate((n, { seleccionado, conFoco }) => {
          const esperado = document.createElement('span');
          const grosor = seleccionado ? '--borde-checkbox' : '--borde-chip-casilla';
          const color = seleccionado ? '--color-primario' : '--color-borde-campo';
          esperado.style.boxShadow = `inset 0 0 0 var(${grosor}) var(${color})${conFoco ? ', var(--foco-anillo)' : ''}`;
          n.append(esperado);
          const resultado = { real: getComputedStyle(n).boxShadow, esperado: getComputedStyle(esperado).boxShadow };
          esperado.remove();
          return resultado;
        }, { seleccionado, conFoco });
        expect(sombras.real).toContain(seleccionado ? '2px' : '1.5px');
        expect(sombras.real).toBe(sombras.esperado);
      }
    }
  }
});

test('Tema usa fieldset, legend y radios etiquetados con miniaturas decorativas', async ({ page }) => {
  await abrirApariencia(page);
  await expect(page.getByRole('heading', { name: 'Apariencia', exact: true })).toBeVisible();
  await expect(page.getByText('Solo cambia cómo ves JTM en este navegador.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Apariencia', exact: true })).toHaveAttribute('aria-current', 'page');
  const grupo = page.getByRole('group', { name: 'Tema', exact: true });
  await expect(grupo).toHaveJSProperty('tagName', 'FIELDSET');
  await expect(grupo.locator('legend')).toHaveText('Tema');
  await expect(grupo.getByRole('radio')).toHaveCount(3);

  for (const nombre of ['Claro Lino', 'Oscuro Tueste', 'Según el sistema Sigue a tu ordenador']) {
    const radio = grupo.getByRole('radio', { name: nombre, exact: true });
    await expect(radio).toHaveAttribute('type', 'radio');
    const etiqueta = grupo.locator('label').filter({ has: page.getByRole('radio', { name: nombre, exact: true }) });
    await expect(etiqueta).toHaveCount(1);
    await expect(etiqueta).toHaveCSS('border-radius', '14px');
    const miniatura = etiqueta.locator('.opcion-tema__miniatura');
    await expect(miniatura).toHaveAttribute('aria-hidden', 'true');
    expect(await miniatura.evaluate((n) => getComputedStyle(n).height)).toBe('96px');
    for (const tarjeta of await miniatura.locator('.opcion-tema__tarjeta').all()) {
      await expect(tarjeta).toHaveCSS('height', '28px');
    }
  }
  await expect(grupo.locator('.opcion-tema__miniatura--sistema > span')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /guardar/i })).toHaveCount(0);

  const claro = grupo.getByRole('radio', { name: 'Claro Lino', exact: true });
  await claro.focus();
  await page.keyboard.press('Space');
  await expect(claro).toBeChecked();
  await page.keyboard.press('ArrowRight');
  const oscuro = grupo.getByRole('radio', { name: 'Oscuro Tueste', exact: true });
  await expect(oscuro).toBeFocused();
  await expect(oscuro).toBeChecked();
  await expect(oscuro).toHaveCSS('border-top-width', '5px');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
});
