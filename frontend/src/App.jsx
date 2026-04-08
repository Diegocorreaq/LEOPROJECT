import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import ClientesPage from "@/pages/clientes/ClientesPage";
import ClienteDetallePage from "@/pages/clientes/ClienteDetallePage";
import NuevoClientePage from "@/pages/clientes/NuevoClientePage";
import EditarClientePage from "@/pages/clientes/EditarClientePage";
import VehiculosPage from "@/pages/vehiculos/VehiculosPage";
import VehiculoDetallePage from "@/pages/vehiculos/VehiculoDetallePage";
import NuevoVehiculoPage from "@/pages/vehiculos/NuevoVehiculoPage";
import EditarVehiculoPage from "@/pages/vehiculos/EditarVehiculoPage";
import ConductoresPage from "@/pages/conductores/ConductoresPage";
import ConductorDetallePage from "@/pages/conductores/ConductorDetallePage";
import NuevoConductorPage from "@/pages/conductores/NuevoConductorPage";
import EditarConductorPage from "@/pages/conductores/EditarConductorPage";
import ServiciosPage from "@/pages/servicios/ServiciosPage";
import NuevoServicioPage from "@/pages/servicios/NuevoServicioPage";
import EditarServicioPage from "@/pages/servicios/EditarServicioPage";
import GuiasPage from "@/pages/guias/GuiasPage";
import LiquidacionesPage from "@/pages/liquidaciones/LiquidacionesPage";

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
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={(
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            )}
          >
            <Route index element={<DashboardPage />} />

            <Route path="servicios" element={<ServiciosPage />} />
            <Route path="servicios/nuevo" element={<NuevoServicioPage />} />
            <Route path="servicios/:id/editar" element={<EditarServicioPage />} />

            <Route path="clientes" element={<ClientesPage />} />
            <Route path="clientes/nuevo" element={<NuevoClientePage />} />
            <Route path="clientes/:id" element={<ClienteDetallePage />} />
            <Route path="clientes/:id/editar" element={<EditarClientePage />} />

            <Route path="vehiculos" element={<VehiculosPage />} />
            <Route path="vehiculos/nuevo" element={<NuevoVehiculoPage />} />
            <Route path="vehiculos/:id" element={<VehiculoDetallePage />} />
            <Route path="vehiculos/:id/editar" element={<EditarVehiculoPage />} />

            <Route path="conductores" element={<ConductoresPage />} />
            <Route path="conductores/nuevo" element={<NuevoConductorPage />} />
            <Route path="conductores/:id" element={<ConductorDetallePage />} />
            <Route path="conductores/:id/editar" element={<EditarConductorPage />} />

            <Route path="guias" element={<GuiasPage />} />
            <Route path="liquidaciones" element={<LiquidacionesPage />} />
            <Route path="facturacion" element={<Placeholder title="Facturacion" />} />
            <Route path="rutas" element={<Placeholder title="Rutas & Tarifas" />} />
            <Route path="compras" element={<Placeholder title="Libro de Compras" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
