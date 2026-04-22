import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  PlusCircle,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import LiquidacionStatusBadge from "./LiquidacionStatusBadge";
import {
  formatCurrency,
  formatDate,
  getClienteReferencia,
  getConductorNombre,
  getMovimientoSaldoConfig,
  getRegularizacionConfig,
  getResultadoEconomicoConfig,
  getRutaLabel,
  getServicioReferencia,
  LIQUIDACION_SALDO_MOVIMIENTO_TIPOS,
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

function BadgeLike({ config, children }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.cls)}>
      {children ?? config.label}
    </span>
  );
}

const MOVIMIENTO_TYPE_OPTIONS = LIQUIDACION_SALDO_MOVIMIENTO_TIPOS;

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
  const [movimientos, setMovimientos] = useState([]);
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

  const [movimientoForm, setMovimientoForm] = useState({
    tipo: "AJUSTE_MANUAL",
    monto: "",
    liquidacionDestinoId: "",
    observacion: "",
  });
  const [movimientoSaving, setMovimientoSaving] = useState(false);
  const [movimientoError, setMovimientoError] = useState("");
  const [loadingCompensaciones, setLoadingCompensaciones] = useState(false);
  const [compensacionesDisponibles, setCompensacionesDisponibles] = useState([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api.get(`/liquidaciones/${liquidacionId}/movimientos-saldo`);
      setDetail(data.liquidacion);
      setMovimientos(Array.isArray(data.movimientos) ? data.movimientos : []);
      setStatusValue(LIQUIDACION_STATUS.includes(data.liquidacion?.status) ? data.liquidacion.status : "PENDIENTE");
    } catch (err) {
      setError(err.message || "No se pudo cargar la liquidacion.");
    } finally {
      setLoading(false);
    }
  }, [liquidacionId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const saldoPendiente = Number(detail?.saldoPendiente ?? 0);
  const resultadoCfg = getResultadoEconomicoConfig(detail);
  const regularizacionCfg = getRegularizacionConfig(detail);
  const isCompensacion = movimientoForm.tipo === "COMPENSACION_ENTRE_LIQUIDACIONES";

  const saldoPendienteClass = useMemo(() => {
    if (saldoPendiente > 0) return "text-blue-700";
    if (saldoPendiente < 0) return "text-rose-700";
    return "text-green-700";
  }, [saldoPendiente]);

  useEffect(() => {
    let active = true;

    async function fetchCompensaciones() {
      if (!detail?.conductorId || !isCompensacion || Math.abs(saldoPendiente) <= 0) {
        setCompensacionesDisponibles([]);
        return;
      }

      setLoadingCompensaciones(true);
      try {
        const list = await api.get(`/liquidaciones?conductorId=${detail.conductorId}&limit=100`);
        if (!active) return;

        const opciones = (Array.isArray(list) ? list : [])
          .filter((item) => item.id !== detail.id)
          .filter((item) => Math.abs(Number(item.saldoPendiente ?? 0)) > 0)
          .filter((item) => Number(item.saldoPendiente ?? 0) * saldoPendiente < 0)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        setCompensacionesDisponibles(opciones);
        setMovimientoForm((prev) => ({
          ...prev,
          liquidacionDestinoId: prev.liquidacionDestinoId || opciones[0]?.id || "",
        }));
      } catch (err) {
        if (active) {
          setCompensacionesDisponibles([]);
        }
      } finally {
        if (active) {
          setLoadingCompensaciones(false);
        }
      }
    }

    fetchCompensaciones();

    return () => {
      active = false;
    };
  }, [detail?.conductorId, detail?.id, isCompensacion, saldoPendiente]);

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
      await loadDetail();
    } catch (err) {
      setUnlinkError(err.message || "No se pudo desvincular la liquidacion.");
    } finally {
      setUnlinkSaving(false);
    }
  }

  async function handleRegistrarMovimiento(event) {
    event.preventDefault();
    setMovimientoError("");

    const monto = Number(movimientoForm.monto || 0);
    if (!(monto > 0)) {
      setMovimientoError("Ingresa un monto valido mayor a 0.");
      return;
    }

    if (isCompensacion && !movimientoForm.liquidacionDestinoId) {
      setMovimientoError("Selecciona la liquidacion destino para la compensacion.");
      return;
    }

    setMovimientoSaving(true);
    try {
      const payload = {
        tipo: movimientoForm.tipo,
        monto,
        observacion: movimientoForm.observacion?.trim() || undefined,
      };

      if (isCompensacion) {
        payload.liquidacionDestinoId = movimientoForm.liquidacionDestinoId;
      }

      const response = await api.post(`/liquidaciones/${liquidacionId}/movimientos-saldo`, payload);

      const liquidacionOrigen = response.liquidacionesImpactadas?.find((item) => item.id === liquidacionId);
      if (liquidacionOrigen) {
        onUpdated?.({ ...liquidacionOrigen, message: response.message });
      }

      setMovimientoForm({
        tipo: movimientoForm.tipo,
        monto: "",
        liquidacionDestinoId: "",
        observacion: "",
      });
      setFeedback(response.message || "Movimiento registrado correctamente");
      await loadDetail();
    } catch (err) {
      setMovimientoError(err.message || "No se pudo registrar el movimiento.");
    } finally {
      setMovimientoSaving(false);
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
            La rendicion y el saldo base son historicos. La regularizacion financiera se controla con
            movimientos auditables sin alterar el saldo original.
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

              <hr />

              <Section label="Estado financiero">
                <Row label="Estado de rendicion" value={<LiquidacionStatusBadge status={detail.status} />} />
                <Row label="Resultado economico" value={<BadgeLike config={resultadoCfg} />} />
                <Row label="Estado de regularizacion" value={<BadgeLike config={regularizacionCfg} />} />
                <Row label="Saldo base historico" value={formatCurrency(detail.saldo)} />
                <Row
                  label="Saldo pendiente real"
                  value={<span className={cn("font-semibold", saldoPendienteClass)}>{formatCurrency(detail.saldoPendiente)}</span>}
                />
                <Row label="Monto regularizado" value={formatCurrency(detail.montoRegularizado)} />
                <Row label="Avance regularizacion" value={`${Number(detail.porcentajeRegularizado ?? 0).toFixed(0)}%`} />
              </Section>

              <hr />

              <Section label="Datos financieros base">
                <Row label="Monto entregado" value={formatCurrency(detail.montoEntregado)} />
                <Row label="Viaticos" value={formatCurrency(detail.viaticos)} />
                <Row label="Peajes" value={formatCurrency(detail.peajes)} />
                <Row label="Combustible" value={formatCurrency(detail.combustible)} />
                <Row label="Galones ingresados" value={detail.galones ?? 0} />
                <Row label="Otros" value={formatCurrency(detail.otros)} />
                <Row label="Total gastos" value={formatCurrency(detail.totalGastos)} />
              </Section>

              <hr />

              <Section label="Movimientos de saldo">
                <form onSubmit={handleRegistrarMovimiento} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tipo</span>
                      <select
                        value={movimientoForm.tipo}
                        onChange={(event) => {
                          const tipo = event.target.value;
                          setMovimientoForm((prev) => ({
                            ...prev,
                            tipo,
                            liquidacionDestinoId: tipo === "COMPENSACION_ENTRE_LIQUIDACIONES" ? prev.liquidacionDestinoId : "",
                          }));
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      >
                        {MOVIMIENTO_TYPE_OPTIONS.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {getMovimientoSaldoConfig(tipo).label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Monto</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={movimientoForm.monto}
                        onChange={(event) =>
                          setMovimientoForm((prev) => ({
                            ...prev,
                            monto: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        placeholder="0.00"
                      />
                    </label>
                  </div>

                  {isCompensacion ? (
                    <label className="space-y-1 block">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Liquidacion destino</span>
                      <select
                        value={movimientoForm.liquidacionDestinoId}
                        onChange={(event) =>
                          setMovimientoForm((prev) => ({
                            ...prev,
                            liquidacionDestinoId: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        disabled={loadingCompensaciones || compensacionesDisponibles.length === 0}
                      >
                        {loadingCompensaciones ? <option value="">Cargando opciones...</option> : null}
                        {!loadingCompensaciones && compensacionesDisponibles.length === 0 ? (
                          <option value="">No hay liquidaciones compatibles</option>
                        ) : null}
                        {compensacionesDisponibles.map((item) => (
                          <option key={item.id} value={item.id}>
                            {getServicioReferencia(item.servicio)} | {formatDate(item.servicio?.fechaServicio ?? item.createdAt)} | Pendiente {formatCurrency(item.saldoPendiente)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="space-y-1 block">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Observacion</span>
                    <textarea
                      value={movimientoForm.observacion}
                      onChange={(event) =>
                        setMovimientoForm((prev) => ({
                          ...prev,
                          observacion: event.target.value,
                        }))
                      }
                      className="min-h-[72px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      placeholder="Referencia del movimiento, soporte o nota interna"
                    />
                  </label>

                  {movimientoError ? (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{movimientoError}</div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      El movimiento reduce el saldo pendiente sin modificar el saldo base historico.
                    </p>
                    <Button size="sm" type="submit" disabled={movimientoSaving || Math.abs(saldoPendiente) <= 0}>
                      {movimientoSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}
                      Registrar movimiento
                    </Button>
                  </div>
                </form>

                {(movimientos ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {movimientos.map((movimiento) => {
                      const movimientoCfg = getMovimientoSaldoConfig(movimiento.tipo);
                      return (
                        <div key={movimiento.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <BadgeLike config={movimientoCfg} />
                            <span className="text-xs text-slate-500">{formatDate(movimiento.fechaMovimiento)}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(movimiento.monto)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {movimiento.rolEnLiquidacion === "DESTINO" ? "Aplicado como destino" : "Aplicado como origen"}
                            {movimiento.liquidacionDestinoId
                              ? ` | Contra liquidacion ${movimiento.liquidacionDestinoId.slice(0, 8).toUpperCase()}`
                              : ""}
                          </p>
                          {movimiento.observacion ? (
                            <p className="mt-1 text-xs text-slate-600">{movimiento.observacion}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No hay movimientos de saldo registrados.</p>
                )}
              </Section>

              <hr />

              <Section label="Observaciones y status">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cambio rapido de status de rendicion
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
        description="Deseas desvincular este documento del servicio? El documento no sera eliminado."
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
