import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
} from 'react-router';
import { AjustesLayout, Perfil } from './Ajustes';
import { AjustesApariencia } from './AjustesApariencia';
import { AjustesMentees } from './AjustesMentees';
import { AjustesProyectos } from './AjustesProyectos';
import { AuthProvider, useAuth } from './auth';
import { Equipo } from './Equipo';
import { Login } from './Login';
import { Historial } from './Historial';
import { Incidencias } from './Incidencias';
import { Objetivos } from './Objetivos';
import { AjustesMentee } from './AjustesMentee';
import { PuenteLista1to1 } from './puentes';
import { RegistrarUnoAUno } from './RegistrarUnoAUno';
import { Resumen } from './Resumen';
import { ShellFicha } from './ShellFicha';

/**
 * Router de JTM: rutas del mapa de `decisiones.md`. Se monta como data router
 * (`createBrowserRouter`) para poder usar `useBlocker` en Registrar 1-to-1 (#19,
 * aviso de salida con borrador sin guardar). Sesión y rutas dirigen; sin estado
 * interno de vista.
 */
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/login" element={<Login />} />
      <Route element={<RutaPrivada />}>
        <Route path="/equipo" element={<Equipo />} />
        <Route path="/mentees/:id" element={<FichaMenteeRoute />}>
          <Route index element={<Resumen />} />
          <Route path="1-to-1s" element={<PuenteLista1to1 />} />
          {/* Detalle de 1-to-1 (#31): stub «lista temporal hasta #31». */}
          <Route path="1-to-1s/:unoAUnoId" element={<PuenteLista1to1 />} />
          <Route path="objetivos" element={<Objetivos />} />
          <Route path="incidencias" element={<Incidencias />} />
          <Route path="historial" element={<Historial />} />
          <Route path="ajustes" element={<AjustesMentee />} />
        </Route>
        <Route path="/mentees/:id/1-to-1s/nuevo" element={<RegistrarUnoAUno />} />
        <Route path="/ajustes" element={<AjustesLayout />}>
          <Route index element={<Navigate to="/ajustes/perfil" replace />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="apariencia" element={<AjustesApariencia />} />
          <Route path="mentees" element={<AjustesMentees />} />
          <Route path="proyectos" element={<AjustesProyectos />} />
        </Route>
        <Route path="/ajustes/plantilla" element={<PantallaEnConstruccion titulo="Plantilla de 1-to-1" />} />
        <Route path="/ajustes/managers" element={<PantallaEnConstruccion titulo="Managers + crear cuenta" />} />
        <Route path="*" element={<Navigate to="/equipo" replace />} />
      </Route>
    </Route>,
  ),
);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

/** Rutas privadas: requieren sesión; mientras se consulta, pantalla de carga mínima.
 * Con el flag de contraseña temporal activo, cualquier ruta distinta de
 * `/ajustes/perfil` redirige allí (bloqueo duro); cerrar sesión sigue disponible. */
function RutaPrivada() {
  const { status, manager } = useAuth();
  const location = useLocation();
  if (status === 'checking') return <PantallaCargando />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (manager?.debeCambiarContraseña && location.pathname !== '/ajustes/perfil') {
    return <Navigate to="/ajustes/perfil" replace />;
  }
  return <Outlet />;
}

/** Ficha de mentee: el `ShellFicha` resuelve la mentee por `:id` y monta las pantallas. */
function FichaMenteeRoute() {
  return <ShellFicha />;
}

/** Pantalla mínima compartida para URLs sin pantalla propia todavía. */
function PantallaEnConstruccion({ titulo }: { titulo: string }) {
  return (
    <main className="pantalla-en-construccion">
      <h1>{titulo}</h1>
      <p>Pantalla en construcción.</p>
    </main>
  );
}

/** Carga mínima durante la comprobación de sesión. */
function PantallaCargando() {
  return (
    <main className="cargando">
      <p role="status">Cargando…</p>
    </main>
  );
}
