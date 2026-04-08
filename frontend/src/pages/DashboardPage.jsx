import { useState } from "react";
import { LayoutDashboard, CreditCard, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardGeneralTab from "./dashboard/DashboardGeneralTab";
import DashboardCobranzaTab from "./dashboard/DashboardCobranzaTab";

const TABS = [
  { id: "general", label: "General", icon: LayoutDashboard },
  { id: "cobranza", label: "Facturación & Cobranza", icon: CreditCard },
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">Vista operativa del sistema</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Selector de rango (solo aplica al tab general) */}
            {activeTab === "general" && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {RANGOS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRango(r.value)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
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
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refrescar"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refrescar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === id
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "general" && (
          <DashboardGeneralTab rango={rango} refreshKey={refreshKey} />
        )}
        {activeTab === "cobranza" && (
          <DashboardCobranzaTab refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
}
