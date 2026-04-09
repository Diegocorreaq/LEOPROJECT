import { useEffect, useMemo, useState } from "react";
import { FileText, PackageOpen, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import FacturaListTab from "./FacturaListTab";
import FacturaImportTab from "./FacturaImportTab";
import FacturaBulkImportTab from "./FacturaBulkImportTab";
import { isFacturaVencida } from "./facturaHelpers";

const TABS = [
  { key: "lista",    label: "Lista",             icon: FileText },
  { key: "importar", label: "Importar",           icon: Upload },
  { key: "masivo",   label: "Importación masiva", icon: PackageOpen },
];

function KpiCard({ label, value, highlight }) {
  const hasValue = value > 0;
  return (
    <div className={cn(
      "flex flex-col items-start rounded-lg border px-3 py-2 min-w-[88px]",
      highlight === "red"   && hasValue ? "border-red-100 bg-red-50"     : "",
      highlight === "amber" && hasValue ? "border-amber-100 bg-amber-50" : "",
      highlight === "blue"  && hasValue ? "border-blue-100 bg-blue-50"   : "",
      (!highlight || !hasValue)         ? "border-slate-100 bg-slate-50" : "",
    )}>
      <span className={cn(
        "text-lg font-semibold leading-none tabular-nums",
        highlight === "red"   && hasValue ? "text-red-700"   : "",
        highlight === "amber" && hasValue ? "text-amber-700" : "",
        highlight === "blue"  && hasValue ? "text-blue-700"  : "",
        (!highlight || !hasValue)         ? "text-slate-700" : "",
      )}>
        {value}
      </span>
      <span className="mt-1 text-[11px] leading-tight text-slate-500">{label}</span>
    </div>
  );
}

export default function FacturacionPage() {
  const [tab, setTab]           = useState("lista");
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading]   = useState(true);
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
    total:         facturas.length,
    sinVincular:   facturas.filter((f) => !f.ordenServicioId).length,
    pendientes:    facturas.filter((f) => f.estadoPago === "PENDIENTE").length,
    credito:       facturas.filter((f) => f.formaPago === "CREDITO").length,
    vencidas:      facturas.filter(isFacturaVencida).length,
    conDetraccion: facturas.filter(
      (f) => Number(f.detraccionMonto) > 0 || Number(f.detraccionPorcentaje) > 0
    ).length,
  }), [facturas]);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5">
        <h1 className="text-xl font-semibold text-slate-900">Facturación</h1>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => { setTab(item.key); if (item.key !== "lista") setFeedback(""); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === item.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip — visible solo en pestaña lista */}
      {tab === "lista" && !loading && facturas.length > 0 && (
        <div className="shrink-0 border-b bg-slate-50/50 px-8 py-3">
          <div className="flex flex-wrap gap-2.5">
            <KpiCard label="Total facturas"  value={kpis.total} />
            <KpiCard label="Sin vincular"    value={kpis.sinVincular}   highlight="red" />
            <KpiCard label="Pendientes"      value={kpis.pendientes}    highlight="amber" />
            <KpiCard label="Crédito"         value={kpis.credito}       highlight="blue" />
            <KpiCard label="Vencidas"        value={kpis.vencidas}      highlight="red" />
            <KpiCard label="Con detracción"  value={kpis.conDetraccion} highlight="blue" />
          </div>
        </div>
      )}

      {feedback && tab === "lista" && (
        <div className="border-b border-emerald-100 bg-emerald-50 px-8 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      )}

      {tab === "lista" ? (
        <FacturaListTab
          facturas={facturas}
          loading={loading}
          onFacturaUpdated={handleFacturaUpdated}
          onFacturaDeleted={handleFacturaDeleted}
        />
      ) : tab === "importar" ? (
        <div className="flex-1 overflow-y-auto">
          <FacturaImportTab onImported={handleImported} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <FacturaBulkImportTab onImported={handleMasivoImported} />
        </div>
      )}
    </div>
  );
}
