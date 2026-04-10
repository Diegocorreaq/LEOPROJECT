import { useState } from "react";
import { FileText, PackageOpen, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [feedback, setFeedback] = useState("");
  // Incrementar para forzar re-fetch en GuiaListTab después de importar.
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleImported(nuevaGuia) {
    setRefreshTrigger((t) => t + 1);
    if (nuevaGuia) setFeedback("Guía importada correctamente.");
    setTab("lista");
  }

  function handleMasivoImported() {
    setRefreshTrigger((t) => t + 1);
    setTab("lista");
    setFeedback("Importación masiva completada. Lista actualizada.");
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-8 py-5">
        <h1 className="text-xl font-semibold text-slate-900">Guías de Remisión</h1>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setTab(item.key);
                if (item.key !== "lista") setFeedback("");
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
        <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-8 py-3 text-sm text-emerald-700">
          <span>{feedback}</span>
          <button
            onClick={() => setFeedback("")}
            className="ml-4 text-emerald-500 hover:text-emerald-700"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}

      {tab === "lista" ? (
        <GuiaListTab refreshTrigger={refreshTrigger} />
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
