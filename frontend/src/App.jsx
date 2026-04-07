import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="servicios" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Servicios</h1></div>} />
            <Route path="guias" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Guías de Remisión</h1></div>} />
            <Route path="liquidaciones" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Liquidaciones</h1></div>} />
            <Route path="facturacion" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Facturación</h1></div>} />
            <Route path="clientes" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Clientes</h1></div>} />
            <Route path="vehiculos" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Vehículos</h1></div>} />
            <Route path="conductores" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Conductores</h1></div>} />
            <Route path="rutas" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Rutas & Tarifas</h1></div>} />
            <Route path="compras" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Libro de Compras</h1></div>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
