import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, PlusSquare } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import LiquidacionFormTab from "./LiquidacionFormTab";
import LiquidacionListTab from "./LiquidacionListTab";
import { getSaldoFavorTag } from "./liquidacion-helpers";

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

    setFeedback(savedLiquidacion.message || "Liquidacion guardada correctamente");
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
    setFeedback(message || "Liquidacion eliminada correctamente");
    openList();
  }

  const totals = useMemo(() => {
    const pendientes = liquidaciones.filter((liquidacion) =>
      ["PENDIENTE", "OBSERVADA"].includes(liquidacion.status),
    ).length;
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
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Liquidaciones</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {totals.total} total
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            {totals.pendientes} pendientes
          </span>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {totals.favorEmpresa} saldo empresa
          </span>
          <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
            {totals.favorConductor} saldo conductor
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
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
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="border-b border-emerald-100 bg-emerald-50 px-8 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      )}

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
  );
}
