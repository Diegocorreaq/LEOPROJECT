import { useEffect, useMemo, useState } from "react";
import { FileText, PackageOpen, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import FacturaListTab from "./FacturaListTab";
import FacturaImportTab from "./FacturaImportTab";
import FacturaBulkImportTab from "./FacturaBulkImportTab";

const TABS = [
  { key: "lista",   label: "Lista",               icon: FileText },
  { key: "importar", label: "Importar",            icon: Upload },
  { key: "masivo",  label: "Importación masiva",   icon: PackageOpen },
];

export default function FacturacionPage() {
  const [tab, setTab]         = useState("lista");
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

  const sinVincular = useMemo(() => facturas.filter((f) => !f.ordenServicioId).length, [facturas]);
  const pendientes  = useMemo(() => facturas.filter((f) => f.estadoPago === "PENDIENTE").length, [facturas]);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-slate-900">Facturación</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {facturas.length} en total
          </span>
          {sinVincular > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
              {sinVincular} sin vincular
            </span>
          )}
          {pendientes > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
              {pendientes} pendientes de pago
            </span>
          )}
        </div>

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
