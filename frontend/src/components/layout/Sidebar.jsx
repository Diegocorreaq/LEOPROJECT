import { createElement } from "react";
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
  X,
  ChevronRight,
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

/**
 * Sidebar responsive:
 * - Desktop (lg+): posición relativa, siempre visible como hijo del flex layout.
 * - Mobile/tablet (< lg): posición fija, se desliza como drawer desde la izquierda.
 *   Se controla con las props `open` y `onClose`.
 */
export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  // Cierra el drawer al navegar (solo tiene efecto en mobile)
  function handleNavClick() {
    onClose?.();
  }

  return (
    <aside
      className={cn(
        // Estilos base compartidos
        "flex w-72 flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-white",
        // Mobile/tablet: fixed overlay con transición
        "fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full",
        // Desktop: vuelve al flujo normal del flex layout, siempre visible
        "lg:relative lg:inset-y-auto lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0 lg:transition-none"
      )}
    >
      {/* ── Logo + botón cerrar (solo mobile) ── */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/20">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold leading-tight tracking-tight text-white">
              Grupo Leo
            </p>
            <p className="text-xs text-slate-400 font-medium">S.A.C.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Navegación ── */}
      <nav className="sidebar-scrollbar flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Menú principal
        </p>
        <ul className="space-y-1">
          {navItems.map(({ label, icon: Icon, href }) => (
            <li key={href}>
              <NavLink
                to={href}
                end={href === "/"}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-500/25"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      isActive 
                        ? "bg-white/20" 
                        : "bg-slate-800 group-hover:bg-slate-700"
                    )}>
                      {createElement(Icon, { className: "h-4 w-4 shrink-0" })}
                    </span>
                    <span className="flex-1">{label}</span>
                    {isActive && (
                      <ChevronRight className="h-4 w-4 opacity-70" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Usuario + cerrar sesión ── */}
      <div className="border-t border-slate-800/50 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-800/50 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-sm font-bold text-white shadow-md">
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.nombre}</p>
            <p className="text-xs text-slate-400 font-medium">
              {ROL_LABELS[user?.rol] ?? user?.rol}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-slate-800 hover:text-white hover:border-slate-600"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
