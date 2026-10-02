import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { App } from './App';
// Figtree self-host (sin CDN de Google Fonts): pesos 400–800 usados por los tokens.
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import './tokens.css';
import './styles.css';
import { cambiarTema, iniciarTema } from './lib/tema';

// Mecanismo de tema: se inicia al arrancar y queda conmutable por código. La UI de
// Ajustes · Apariencia (#27) llamará a `cambiarTema`; mientras tanto, el E2E verifica
// la conmutación a través del gancho `window.__jtm.cambiarTema`.
iniciarTema();
declare global {
  interface Window {
    __jtm?: { cambiarTema: typeof cambiarTema };
  }
}
window.__jtm = { cambiarTema };

// Sentry en el cliente: se activa solo si hay VITE_SENTRY_DSN (ver AGENTS.md).
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p className="status">Se ha producido un error.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);