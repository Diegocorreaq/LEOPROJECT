import { useState } from "react";
import { FileText, PackageOpen, Upload, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import GuiaListTab from "./GuiaListTab";
import GuiaBulkImportTab from "./GuiaBulkImportTab";
import GuiaImportTab from "./GuiaImportTab";

const TABS = [
  { key: "lista", label: "Lista", icon: FileText },
  { key: "importar", label: "Importar", icon: Upload },
  { key: "masivo", label: "Importación masiva", icon: PackageOpen },
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
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header principal */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Título con icono */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-lg">
                <FileText className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Guías de Remisión</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Gestión y seguimiento de guías
                </p>
              </div>
            </div>

            {/* Tabs como botones pill */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setTab(item.key);
                    if (item.key !== "lista") setFeedback("");
                  }}
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
      <div className="flex-1 overflow-hidden">
        {tab === "lista" ? (
          <GuiaListTab refreshTrigger={refreshTrigger} />
        ) : tab === "importar" ? (
          <div className="flex-1 overflow-y-auto h-full">
            <GuiaImportTab onImported={handleImported} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto h-full">
            <GuiaBulkImportTab onImported={handleMasivoImported} />
          </div>
        )}
      </div>
    </div>
  );
}
