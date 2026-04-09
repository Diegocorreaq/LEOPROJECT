import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import LiquidacionStatusBadge from "./LiquidacionStatusBadge";
import {
  formatCurrency,
  formatDate,
  getClienteReferencia,
  getConductorNombre,
  getRutaLabel,
  getServicioReferencia,
  LIQUIDACION_STATUS,
  LIQUIDACION_STATUS_CFG,
} from "./liquidacion-helpers";

function Section({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-800">{value ?? "-"}</span>
    </div>
  );
}

export default function LiquidacionDetailDrawer({
  liquidacionId,
  onClose,
  onUpdated,
  onDeleted,
  onEdit,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [statusValue, setStatusValue] = useState("PENDIENTE");
  const [savingStatus, setSavingStatus] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinkSaving, setUnlinkSaving] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;

    api
      .get(`/liquidaciones/${liquidacionId}`)
      .then((data) => {
        if (!active) return;
        setDetail(data);
        setStatusValue(LIQUIDACION_STATUS.includes(data.status) ? data.status : "PENDIENTE");
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "No se pudo cargar la liquidacion.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [liquidacionId]);

  async function handleStatusChange(event) {
    const nextStatus = event.target.value;
    setStatusValue(nextStatus);
    setSavingStatus(true);
    setError("");

    try {
      const updated = await api.patch(`/liquidaciones/${liquidacionId}/status`, {
        status: nextStatus,
      });
      setDetail(updated);
      setFeedback(updated.message || "Status actualizado correctamente");
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || "No se pudo actualizar el status.");
      setStatusValue(
        detail?.status && LIQUIDACION_STATUS.includes(detail.status) ? detail.status : "PENDIENTE",
      );
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDelete() {
    setDeleteSaving(true);
    setDeleteError("");

    try {
      const response = await api.delete(`/liquidaciones/${liquidacionId}`);
      onDeleted?.(liquidacionId, response.message || "Liquidacion eliminada correctamente");
      onClose?.();
    } catch (err) {
      setDeleteError(err.message || "No se pudo eliminar la liquidacion.");
    } finally {
      setDeleteSaving(false);
    }
  }

  async function handleUnlink() {
    setUnlinkSaving(true);
    setUnlinkError("");
    setError("");

    try {
      const updated = await api.patch(`/liquidaciones/${liquidacionId}/desvincular`, {});
      setDetail(updated);
      setFeedback(updated.message || "Liquidacion desvinculada correctamente");
      setUnlinkOpen(false);
      onUpdated?.(updated);
    } catch (err) {
      setUnlinkError(err.message || "No se pudo desvincular la liquidacion.");
    } finally {
      setUnlinkSaving(false);
    }
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <span className="font-semibold text-slate-900">
              {detail?.servicio ? getServicioReferencia(detail.servicio) : "Liquidacion"}
            </span>
            {detail?.status && (
              <div className="mt-0.5">
                <LiquidacionStatusBadge status={detail.status} />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 border-b px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onEdit?.(liquidacionId, { focusService: false })}>
              <Pencil className="h-4 w-4" />
              Editar liquidacion
            </Button>
            {detail?.servicioId && isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit?.(liquidacionId, { focusService: true })}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Reasignar servicio
              </Button>
            ) : !detail?.servicioId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit?.(liquidacionId, { focusService: true })}
              >
                <Link2 className="h-4 w-4" />
                Vincular servicio
              </Button>
            ) : null}
            {detail?.servicioId ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/servicios/${detail.servicioId}/editar`)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir servicio
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setUnlinkError("");
                    setUnlinkOpen(true);
                  }}
                >
                  <Unlink className="h-4 w-4" />
                  Desvincular
                </Button>
              </>
            ) : null}
            {isAdmin ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            ) : null}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            El conductor y los datos operativos se heredan del servicio vinculado. Los montos se
            recalculan automaticamente al guardar.
          </p>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {feedback && (
          <div className="mx-5 mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {feedback}
          </div>
        )}

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !detail ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No se pudo cargar el detalle de la liquidacion.
            </div>
          ) : (
            <>
              <Section label="Servicio">
                {detail.servicio ? (
                  <>
                    <Row label="Referencia" value={getServicioReferencia(detail.servicio)} />
                    <Row label="Fecha servicio" value={formatDate(detail.servicio?.fechaServicio)} />
                    <Row label="Ruta" value={getRutaLabel(detail.servicio)} />
                    <Row label="Cliente / pagador" value={getClienteReferencia(detail.servicio)} />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                    Esta liquidacion no tiene un servicio vinculado. El registro se conserva y puedes volver a vincularlo.
                  </div>
                )}
              </Section>

              <hr />

              <Section label="Unidad y conductor">
                <Row label="Placa" value={detail.servicio?.vehiculo?.placa ?? "-"} />
                {detail.servicio?.vehiculo?.placaCarreta ? (
                  <Row label="Carreta" value={detail.servicio.vehiculo.placaCarreta} />
                ) : null}
                <Row label="Conductor" value={getConductorNombre(detail.conductor || detail.servicio?.conductor)} />
                {(detail.servicio?.conductor?.nroDocumento || detail.conductor?.nroDocumento) ? (
                  <Row label="Documento" value={detail.servicio?.conductor?.nroDocumento || detail.conductor?.nroDocumento} />
                ) : null}
              </Section>

              {(detail.servicio?.clientes ?? []).length > 0 ? (
                <>
                  <hr />
                  <Section label="Clientes">
                    {detail.servicio.clientes.map((item) => (
                      <Row
                        key={item.id}
                        label={item.cliente?.ruc ?? "Cliente"}
                        value={item.cliente?.razonSocial ?? "-"}
                      />
                    ))}
                  </Section>
                </>
              ) : null}

              <hr />

              <Section label="Guias relacionadas">
                {(detail.servicio?.guias ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {detail.servicio.guias.map((guia) => (
                      <div key={guia.id} className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">
                          {guia.serie}-{guia.numero}
                        </p>
                        <p className="text-xs text-slate-500">
                          {guia.pagadorFleteNombre || guia.destinatarioNombre || "Sin pagador registrado"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No hay guias vinculadas a este servicio.</p>
                )}
              </Section>

              <hr />

              <Section label="Datos financieros">
                <Row label="Monto entregado" value={formatCurrency(detail.montoEntregado)} />
                <Row label="Viaticos" value={formatCurrency(detail.viaticos)} />
                <Row label="Peajes" value={formatCurrency(detail.peajes)} />
                <Row label="Combustible" value={formatCurrency(detail.combustible)} />
                <Row label="Galones ingresados" value={detail.galones ?? 0} />
                <Row label="Otros" value={formatCurrency(detail.otros)} />
                <Row label="Total gastos" value={formatCurrency(detail.totalGastos)} />
                <Row label="Saldo" value={formatCurrency(detail.saldo)} />
                <Row label="Detalle saldo" value={detail.detalleSaldo || "-"} />
              </Section>

              <hr />

              <Section label="Observaciones y status">
                <Row label="Status" value={<LiquidacionStatusBadge status={detail.status} />} />
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cambio rapido de status
                  </span>
                  <select
                    value={statusValue}
                    onChange={handleStatusChange}
                    disabled={savingStatus}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                  >
                    {Object.entries(LIQUIDACION_STATUS_CFG).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                  {savingStatus ? (
                    <p className="text-xs text-slate-400">Actualizando status...</p>
                  ) : null}
                </label>
                <p className="text-sm text-slate-600">
                  {detail.observaciones || "Sin observaciones internas registradas."}
                </p>
              </Section>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={unlinkOpen}
        title="Desvincular liquidacion"
        description="¿Deseas desvincular este documento del servicio? El documento no sera eliminado."
        warning="La liquidacion conservara sus montos, status y trazabilidad, y podra vincularse nuevamente a otro servicio."
        confirmLabel="Desvincular liquidacion"
        loadingLabel="Desvinculando..."
        error={unlinkError}
        loading={unlinkSaving}
        onClose={() => {
          if (!unlinkSaving) {
            setUnlinkOpen(false);
            setUnlinkError("");
          }
        }}
        onConfirm={handleUnlink}
      />

      {isAdmin ? (
        <ConfirmModal
          open={deleteOpen}
          title="Eliminar liquidacion"
          description="Esta accion eliminara la liquidacion registrada para este servicio."
          warning="No se puede deshacer."
          confirmLabel="Eliminar liquidacion"
          loadingLabel="Eliminando..."
          error={deleteError}
          loading={deleteSaving}
          onClose={() => {
            if (!deleteSaving) {
              setDeleteOpen(false);
              setDeleteError("");
            }
          }}
          onConfirm={handleDelete}
        />
      ) : null}
    </>
  );
}
