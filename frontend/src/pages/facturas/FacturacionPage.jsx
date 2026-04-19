import { useEffect, useMemo, useState } from "react";
import { FileText, PackageOpen, Upload, Receipt, X, CheckCircle, AlertTriangle, Clock, CreditCard, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import FacturaListTab from "./FacturaListTab";
import FacturaImportTab from "./FacturaImportTab";
import FacturaBulkImportTab from "./FacturaBulkImportTab";
import { isFacturaVencida } from "./facturaHelpers";

const TABS = [
  { key: "lista", label: "Lista", icon: FileText },
  { key: "importar", label: "Importar", icon: Upload },
  { key: "masivo", label: "Importación masiva", icon: PackageOpen },
];

function KpiCard({ label, value, highlight, icon: Icon }) {
  const hasValue = value > 0;
  
  const colorClasses = {
    red: {
      bg: "bg-red-50 border-red-100",
      text: "text-red-700",
      icon: "text-red-500",
    },
    amber: {
      bg: "bg-amber-50 border-amber-100",
      text: "text-amber-700",
      icon: "text-amber-500",
    },
    blue: {
      bg: "bg-blue-50 border-blue-100",
      text: "text-blue-700",
      icon: "text-blue-500",
    },
    default: {
      bg: "bg-slate-50 border-slate-100",
      text: "text-slate-700",
      icon: "text-slate-400",
    },
  };

  const colors = (highlight && hasValue) ? colorClasses[highlight] : colorClasses.default;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-4 py-3 min-w-[130px] transition-all duration-200 hover:shadow-sm",
      colors.bg
    )}>
      {Icon && (
        <div className={cn("shrink-0", colors.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-col">
        <span className={cn(
          "text-xl font-bold leading-none tabular-nums",
          colors.text
        )}>
          {value}
        </span>
        <span className="mt-1 text-xs font-medium text-slate-500 leading-tight">{label}</span>
      </div>
    </div>
  );
}

export default function FacturacionPage() {
  const [tab, setTab] = useState("lista");
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  function loadFacturas() {
    setLoading(true);
    api.get("/facturas")
      .then(setFacturas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadFacturas(); }, []);

  function handleImported(nuevaFactura) {
    if (nuevaFactura) setFacturas((prev) => [nuevaFactura, ...prev]);
    setTab("lista");
    setFeedback(nuevaFactura ? "Factura importada correctamente." : "");
  }

  function handleMasivoImported() {
    loadFacturas();
    setTab("lista");
    setFeedback("Importación masiva completada. Lista actualizada.");
  }

  function handleFacturaUpdated(updated) {
    setFacturas((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
    if (updated?.message) setFeedback(updated.message);
  }

  function handleFacturaDeleted(id, message) {
    setFacturas((prev) => prev.filter((f) => f.id !== id));
    setFeedback(message || "Factura eliminada");
  }

  const kpis = useMemo(() => ({
    total: facturas.length,
    sinVincular: facturas.filter((f) => !f.ordenServicioId).length,
    pendientes: facturas.filter((f) => f.estadoPago === "PENDIENTE").length,
    credito: facturas.filter((f) => f.formaPago === "CREDITO").length,
    vencidas: facturas.filter(isFacturaVencida).length,
    conDetraccion: facturas.filter(
      (f) => Number(f.detraccionMonto) > 0 || Number(f.detraccionPorcentaje) > 0
    ).length,
  }), [facturas]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      {/* Header principal */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Título con icono */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-lg">
                <Receipt className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Facturación</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Gestión de facturas y documentos
                </p>
              </div>
            </div>

            {/* Tabs como botones pill */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key); if (item.key !== "lista") setFeedback(""); }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                    tab === item.key
                      ? "bg-slate-900 text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">
                    {item.key === "lista" ? "Lista" : item.key === "importar" ? "Importar" : "Masivo"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI strip — visible solo en pestaña lista */}
        {tab === "lista" && !loading && facturas.length > 0 && (
          <div className="px-4 pb-5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-3">
              <KpiCard label="Total facturas" value={kpis.total} icon={FileText} />
              <KpiCard label="Sin vincular" value={kpis.sinVincular} highlight="red" icon={Link2Off} />
              <KpiCard label="Pendientes" value={kpis.pendientes} highlight="amber" icon={Clock} />
              <KpiCard label="Crédito" value={kpis.credito} highlight="blue" icon={CreditCard} />
              <KpiCard label="Vencidas" value={kpis.vencidas} highlight="red" icon={AlertTriangle} />
              <KpiCard label="Con detracción" value={kpis.conDetraccion} highlight="blue" icon={Receipt} />
            </div>
          </div>
        )}
      </div>

      {/* Feedback de éxito */}
      {feedback && tab === "lista" && (
        <div className="mx-4 mt-4 sm:mx-6 lg:mx-8">
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-emerald-800">{feedback}</span>
            </div>
            <button
              onClick={() => setFeedback("")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === "lista" ? (
          <FacturaListTab
            facturas={facturas}
            loading={loading}
            onFacturaUpdated={handleFacturaUpdated}
            onFacturaDeleted={handleFacturaDeleted}
          />
        ) : tab === "importar" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FacturaImportTab onImported={handleImported} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FacturaBulkImportTab onImported={handleMasivoImported} />
          </div>
        )}
      </div>
    </div>
  );
}
