import { useState } from "react";
import { LayoutDashboard, CreditCard, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardGeneralTab from "./dashboard/DashboardGeneralTab";
import DashboardCobranzaTab from "./dashboard/DashboardCobranzaTab";
import DashboardLiquidacionesTab from "./dashboard/DashboardLiquidacionesTab";

const TABS = [
  { id: "general", label: "General", icon: LayoutDashboard },
  { id: "cobranza", label: "Facturación & Cobranza", icon: CreditCard },
  { id: "liquidaciones", label: "Liquidaciones", icon: Wallet },
];

const RANGOS = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Este mes" },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [rango, setRango] = useState("30d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleRefresh() {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      {/* Header principal */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Título con icono */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-lg">
                <TrendingUp className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
                <p className="text-sm text-slate-500 mt-0.5">Vista operativa del sistema</p>
              </div>
            </div>

            {/* Controles */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Selector de rango (aplica a tabs temporales) */}
              {(activeTab === "general" || activeTab === "liquidaciones") && (
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
                  {RANGOS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRango(r.value)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
                        rango === r.value
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refrescar datos"
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all shadow-sm hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 disabled:opacity-50",
                  isRefreshing && "cursor-wait",
                )}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                <span className="hidden sm:inline">Refrescar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-0 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto pb-px -mx-4 px-4 sm:mx-0 sm:px-0">
            {TABS.map(({ id, label, icon }) => {
              const TabIcon = icon;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all duration-200",
                    activeTab === id
                      ? "border-amber-500 text-amber-600"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
                  )}
                >
                  <TabIcon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "general" && <DashboardGeneralTab rango={rango} refreshKey={refreshKey} />}
        {activeTab === "cobranza" && <DashboardCobranzaTab refreshKey={refreshKey} />}
        {activeTab === "liquidaciones" && (
          <DashboardLiquidacionesTab rango={rango} refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
}
