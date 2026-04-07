import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ServiciosPage from "@/pages/servicios/ServiciosPage";
import NuevoServicioPage from "@/pages/servicios/NuevoServicioPage";
import EditarServicioPage from "@/pages/servicios/EditarServicioPage";

const Placeholder = ({ title }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />

            {/* Servicios */}
            <Route path="servicios"                element={<ServiciosPage />} />
            <Route path="servicios/nuevo"          element={<NuevoServicioPage />} />
            <Route path="servicios/:id/editar"     element={<EditarServicioPage />} />

            {/* Resto — placeholders hasta que se construyan */}
            <Route path="guias"       element={<Placeholder title="Guías de Remisión" />} />
            <Route path="liquidaciones" element={<Placeholder title="Liquidaciones" />} />
            <Route path="facturacion" element={<Placeholder title="Facturación" />} />
            <Route path="clientes"    element={<Placeholder title="Clientes" />} />
            <Route path="vehiculos"   element={<Placeholder title="Vehículos" />} />
            <Route path="conductores" element={<Placeholder title="Conductores" />} />
            <Route path="rutas"       element={<Placeholder title="Rutas & Tarifas" />} />
            <Route path="compras"     element={<Placeholder title="Libro de Compras" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
