import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
import type { Mentee } from './api';
import { api } from './api';
import { AjustesLayout, Perfil } from './Ajustes';
import { AuthProvider, useAuth } from './auth';
import { Login } from './Login';
import { MenteeDetail } from './MenteeDetail';
import { Team } from './Team';

/** Router de JTM: rutas del mapa de `decisiones.md`. Sesión y rutas dirigen; sin estado interno de vista. */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RutaPrivada />}>
            <Route path="/equipo" element={<Team />} />
            <Route path="/mentees/:id" element={<MenteeDetailRoute />} />
            <Route path="/mentees/:id/1-to-1s" element={<PantallaEnConstruccion titulo="1-to-1s" />} />
            <Route path="/mentees/:id/1-to-1s/nuevo" element={<PantallaEnConstruccion titulo="Registrar 1-to-1" />} />
            <Route path="/mentees/:id/1-to-1s/:unoAUnoId" element={<PantallaEnConstruccion titulo="Detalle de 1-to-1" />} />
            <Route path="/mentees/:id/objetivos" element={<PantallaEnConstruccion titulo="Objetivos" />} />
            <Route path="/mentees/:id/incidencias" element={<PantallaEnConstruccion titulo="Incidencias" />} />
            <Route path="/mentees/:id/historial" element={<PantallaEnConstruccion titulo="Historial" />} />
            <Route path="/mentees/:id/ajustes" element={<PantallaEnConstruccion titulo="Ajustes de la mentee" />} />
            <Route path="/ajustes" element={<AjustesLayout />}>
              <Route index element={<Navigate to="/ajustes/perfil" replace />} />
              <Route path="perfil" element={<Perfil />} />
            </Route>
            <Route path="/ajustes/apariencia" element={<PantallaEnConstruccion titulo="Apariencia" />} />
            <Route path="/ajustes/plantilla" element={<PantallaEnConstruccion titulo="Plantilla de 1-to-1" />} />
            <Route path="/ajustes/mentees" element={<PantallaEnConstruccion titulo="Añadir mentee" />} />
            <Route path="/ajustes/managers" element={<PantallaEnConstruccion titulo="Managers + crear cuenta" />} />
            <Route path="/ajustes/proyectos" element={<PantallaEnConstruccion titulo="Catálogo de proyectos" />} />
            <Route path="*" element={<Navigate to="/equipo" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
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

/** Ficha actual montada en su ruta futura (`/mentees/:id`): resuelve el nombre de la mentee. */
function MenteeDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { manager } = useAuth();
  const [mentee, setMentee] = useState<Mentee | null>(null);

  useEffect(() => {
    api.team().then(({ mentees }) => setMentee(mentees.find((m) => m.id === id) ?? null));
  }, [id]);

  if (manager === null || id === undefined) return null;
  if (mentee === null) return <PantallaCargando />;

  return (
    <MenteeDetail
      menteeId={id}
      menteeName={mentee.name}
      manager={manager}
      onBack={() => navigate('/equipo')}
    />
  );
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