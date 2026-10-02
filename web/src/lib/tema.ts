/**
 * Mecanismo de tema de JTM: `data-tema` en `<html>`, preferencia en `localStorage`,
 * «Según el sistema» por defecto (`matchMedia`).
 *
 * - El script inline de `index.html` aplica la preferencia antes del primer render
 *   (sin FOUC); este módulo cubre la conmutación por código: aplicar el tema al
 *   instante y reaccionar a cambios de `matchMedia` cuando la preferencia es «sistema».
 * - La UI de Ajustes · Apariencia llega con #27; aquí solo queda el mecanismo que
 *   esa UI llamará (`cambiarTema`) y que el E2E verifica sin pantalla de ajustes.
 */

export type PreferenciaTema = 'claro' | 'oscuro' | 'sistema';
export type TemaResuelto = 'claro' | 'oscuro';

const CLAVE = 'jtm-tema';

function sistemaOscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Resuelve una preferencia a un tema real (claro/oscuro), consultando el sistema si hace falta. */
export function resolverTema(preferencia: PreferenciaTema): TemaResuelto {
  if (preferencia === 'sistema') return sistemaOscuro() ? 'oscuro' : 'claro';
  return preferencia;
}

/** Aplica un tema resuelto a `<html>` de inmediato (sin recarga). */
export function aplicarTema(tema: TemaResuelto): void {
  document.documentElement.dataset.tema = tema;
}

/** Lee la preferencia guardada (o «sistema» por defecto). */
export function preferenciaGuardada(): PreferenciaTema {
  const valor = localStorage.getItem(CLAVE);
  return valor === 'claro' || valor === 'oscuro' || valor === 'sistema' ? valor : 'sistema';
}

/**
 * Conmuta el tema por código: persiste la preferencia y aplica el resultado al
 * instante. La futura UI de Apariencia hará exactamente esta llamada.
 */
export function cambiarTema(preferencia: PreferenciaTema): void {
  localStorage.setItem(CLAVE, preferencia);
  aplicarTema(resolverTema(preferencia));
}

/**
 * Enchufa el mecanismo en la página activa: aplica la preferencia guardada (por si
 * el script inline no corrió) y se suscribe a `matchMedia` para que «sistema» cambie
 * en vivo. Se llama una vez al arrancar.
 */
export function iniciarTema(): void {
  cambiarTema(preferenciaGuardada());

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const alCambiarSistema = () => {
    if (preferenciaGuardada() === 'sistema') aplicarTema(resolverTema('sistema'));
  };
  media.addEventListener('change', alCambiarSistema);
}