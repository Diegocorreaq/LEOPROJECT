import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Truck,
  FileText,
  Wallet,
  Receipt,
  Users,
  Car,
  UserCheck,
  MapPin,
  BookOpen,
  LogOut,
  Package,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Servicios", icon: Truck, href: "/servicios" },
  { label: "Guías de Remisión", icon: FileText, href: "/guias" },
  { label: "Liquidaciones", icon: Wallet, href: "/liquidaciones" },
  { label: "Facturación", icon: Receipt, href: "/facturacion" },
  { label: "Clientes", icon: Users, href: "/clientes" },
  { label: "Vehículos", icon: Car, href: "/vehiculos" },
  { label: "Conductores", icon: UserCheck, href: "/conductores" },
  { label: "Rutas & Tarifas", icon: MapPin, href: "/rutas" },
  { label: "Libro de Compras", icon: BookOpen, href: "/compras" },
];

const ROL_LABELS = {
  OPERACIONES: "Operaciones",
  ADMIN: "Administrador",
  CONTABILIDAD: "Contabilidad",
  GERENCIA: "Gerencia",
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-700 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight tracking-wide text-white">
            Grupo Leo
          </p>
          <p className="text-xs text-slate-400">S.A.C.</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Menú principal
        </p>
        <ul className="space-y-0.5">
          {navItems.map(({ label, icon: Icon, href }) => (
            <li key={href}>
              <NavLink
                to={href}
                end={href === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-amber-500 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-slate-700 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.nombre}</p>
            <p className="text-xs text-slate-400">
              {ROL_LABELS[user?.rol] ?? user?.rol}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
