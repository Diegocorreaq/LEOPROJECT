import { useEffect, useMemo, useState } from "react";
import { FileText, PackageOpen, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import GuiaListTab from "./GuiaListTab";
import GuiaBulkImportTab from "./GuiaBulkImportTab";
import GuiaImportTab from "./GuiaImportTab";

const TABS = [
  { key: "lista", label: "Lista", icon: FileText },
  { key: "importar", label: "Importar", icon: Upload },
  { key: "masivo", label: "Importacion masiva", icon: PackageOpen },
];

export default function GuiasPage() {
  const [tab, setTab] = useState("lista");
  const [guias, setGuias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  function loadGuias(options = {}) {
    const { withLoading = true } = options;
    if (withLoading) {
      setLoading(true);
    }
    api
      .get("/guias")
      .then(setGuias)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadGuias({ withLoading: false });
  }, []);

  function handleImported(nuevaGuia) {
    if (nuevaGuia) {
      setGuias((prev) => [nuevaGuia, ...prev]);
      setFeedback("");
    }
    setTab("lista");
  }

  function handleMasivoImported() {
    loadGuias();
    setTab("lista");
    setFeedback("Importación masiva completada. Lista actualizada.");
  }

  function handleGuiaUpdated(guiaActualizada) {
    setGuias((prev) =>
      prev.map((g) => (g.id === guiaActualizada.id ? { ...g, ...guiaActualizada } : g)),
    );
    if (guiaActualizada?.message) {
      setFeedback(guiaActualizada.message);
    }
  }

  function handleGuiaDeleted(guiaId, message) {
    setGuias((prev) => prev.filter((g) => g.id !== guiaId));
    setFeedback(message || "La guia fue eliminada correctamente");
  }

  const sinVincularCount = useMemo(
    () => guias.filter((g) => !g.servicioId).length,
    [guias],
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Guias de Remision</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {guias.length} en total
          </span>
          {sinVincularCount > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
              {sinVincularCount} sin vincular
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setTab(item.key);
                if (item.key !== "lista") {
                  setFeedback("");
                }
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === item.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-700",
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
        <GuiaListTab
          guias={guias}
          loading={loading}
          onGuiaUpdated={handleGuiaUpdated}
          onGuiaDeleted={handleGuiaDeleted}
        />
      ) : tab === "importar" ? (
        <div className="flex-1 overflow-y-auto">
          <GuiaImportTab onImported={handleImported} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <GuiaBulkImportTab onImported={handleMasivoImported} />
        </div>
      )}
    </div>
  );
}
