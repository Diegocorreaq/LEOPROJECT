import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, PlusSquare, X, CheckCircle, Building2, User, Clock } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import LiquidacionFormTab from "./LiquidacionFormTab";
import LiquidacionListTab from "./LiquidacionListTab";
import { getSaldoFavorTag } from "./liquidacion-helpers";

function KpiBadge({ label, value, variant = "default" }) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    amber: "bg-amber-50 text-amber-700 border border-amber-100",
    blue: "bg-blue-50 text-blue-700 border border-blue-100",
    violet: "bg-violet-50 text-violet-700 border border-violet-100",
  };

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
      variants[variant]
    )}>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}

export default function LiquidacionesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const action = searchParams.get("action");
  const liquidacionId = searchParams.get("liquidacionId") ?? "";
  const servicioId = searchParams.get("servicioId") ?? "";
  const focusService = searchParams.get("focus") === "servicio";

  const isEditView = action === "editar" && Boolean(liquidacionId);
  const isCreateView = action === "nueva";
  const isFormView = isEditView || isCreateView;

  useEffect(() => {
    let active = true;

    api
      .get("/liquidaciones")
      .then((data) => {
        if (active) {
          setLiquidaciones(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function openList(selectedId = "") {
    const params = new URLSearchParams();
    if (selectedId) {
      params.set("liquidacionId", selectedId);
    }
    setSearchParams(params);
  }

  function openCreate(selectedServiceId = "") {
    const params = new URLSearchParams({ action: "nueva" });
    if (selectedServiceId) {
      params.set("servicioId", selectedServiceId);
    }
    setSearchParams(params);
  }

  function openEdit(selectedLiquidacionId, options = {}) {
    const params = new URLSearchParams({
      action: "editar",
      liquidacionId: selectedLiquidacionId,
    });

    if (options.focusService) {
      params.set("focus", "servicio");
    }

    setSearchParams(params);
  }

  function handleLiquidacionSaved(savedLiquidacion) {
    setLiquidaciones((prev) => {
      const exists = prev.some((liquidacion) => liquidacion.id === savedLiquidacion.id);
      if (exists) {
        return prev.map((liquidacion) =>
          liquidacion.id === savedLiquidacion.id ? { ...liquidacion, ...savedLiquidacion } : liquidacion,
        );
      }
      return [savedLiquidacion, ...prev];
    });

    setFeedback(savedLiquidacion.message || "Liquidación guardada correctamente");
    openList(savedLiquidacion.id);
  }

  function handleLiquidacionUpdated(updatedLiquidacion) {
    setLiquidaciones((prev) =>
      prev.map((liquidacion) =>
        liquidacion.id === updatedLiquidacion.id ? { ...liquidacion, ...updatedLiquidacion } : liquidacion,
      ),
    );

    if (updatedLiquidacion.message) {
      setFeedback(updatedLiquidacion.message);
    }
  }

  function handleLiquidacionDeleted(deletedId, message) {
    setLiquidaciones((prev) => prev.filter((liquidacion) => liquidacion.id !== deletedId));
    setFeedback(message || "Liquidación eliminada correctamente");
    openList();
  }

  const totals = useMemo(() => {
    const pendientes = liquidaciones.filter((liquidacion) => liquidacion.status === "PENDIENTE").length;
    const favorEmpresa = liquidaciones.filter(
      (liquidacion) => getSaldoFavorTag(liquidacion) === "EMPRESA",
    ).length;
    const favorConductor = liquidaciones.filter(
      (liquidacion) => getSaldoFavorTag(liquidacion) === "CONDUCTOR",
    ).length;

    return {
      total: liquidaciones.length,
      pendientes,
      favorEmpresa,
      favorConductor,
    };
  }, [liquidaciones]);

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header principal */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Título con icono y KPIs */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-lg">
                  <FileSpreadsheet className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">Liquidaciones</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Control de liquidaciones de servicios
                  </p>
                </div>
              </div>

              {/* KPIs en línea */}
              <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:pl-4 sm:border-l sm:border-slate-200">
                <KpiBadge label="total" value={totals.total} />
                <KpiBadge label="pendientes" value={totals.pendientes} variant="amber" />
                <KpiBadge label="saldo empresa" value={totals.favorEmpresa} variant="blue" />
                <KpiBadge label="saldo conductor" value={totals.favorConductor} variant="violet" />
              </div>
            </div>

            {/* Tabs como botones pill */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm self-start lg:self-auto">
              {[
                { key: "lista", label: "Lista", icon: FileSpreadsheet },
                { key: "form", label: isEditView ? "Editar" : "Nueva", icon: PlusSquare },
              ].map((item) => {
                const active = item.key === "lista" ? !isFormView : isFormView;

                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      if (item.key === "lista") {
                        openList(liquidacionId && !isFormView ? liquidacionId : "");
                      } else {
                        openCreate();
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback de éxito */}
      {feedback && (
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
        {isFormView ? (
          <LiquidacionFormTab
            key={`${isEditView ? "edit" : "create"}-${liquidacionId || servicioId || "nuevo"}-${focusService ? "service" : "general"}`}
            mode={isEditView ? "edit" : "create"}
            liquidacionId={liquidacionId}
            initialServiceId={servicioId}
            lockInitialService={Boolean(servicioId) && isCreateView}
            focusService={focusService}
            onCancel={() => openList(liquidacionId && isEditView ? liquidacionId : "")}
            onSaved={handleLiquidacionSaved}
          />
        ) : (
          <LiquidacionListTab
            liquidaciones={liquidaciones}
            loading={loading}
            selectedLiquidacionId={liquidacionId}
            onSelectLiquidacion={(nextId) => openList(nextId || "")}
            onLiquidacionUpdated={handleLiquidacionUpdated}
            onLiquidacionDeleted={handleLiquidacionDeleted}
            onEditLiquidacion={openEdit}
          />
        )}
      </div>
    </div>
  );
}
