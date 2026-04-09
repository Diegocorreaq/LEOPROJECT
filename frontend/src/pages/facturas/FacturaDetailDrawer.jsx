import { useEffect, useState } from "react";
import {
  AlertCircle, AlertTriangle, Calendar, ExternalLink,
  FileText, Link, Link2, Loader2, Pencil, Trash2, Unlink, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import FacturaStatusBadge from "./FacturaStatusBadge";
import FacturaEditModal from "./FacturaEditModal";
import FacturaVincularModal from "./FacturaVincularModal";
import { fechaLarga, fmtTotal, isFacturaVencida, isFacturaPorVencer } from "./facturaHelpers";

function Section({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-right text-xs text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

export default function FacturaDetailDrawer({ factura, onClose, onUpdated, onDeleted }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";

  const [detail, setDetail]             = useState(factura);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [feedback, setFeedback]         = useState("");

  const [editOpen, setEditOpen]         = useState(false);
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState("");

  const [linkOpen, setLinkOpen]         = useState(false);
  const [linkSaving, setLinkSaving]     = useState(false);
  const [linkError, setLinkError]       = useState("");

  const [unlinkOpen, setUnlinkOpen]     = useState(false);
  const [unlinkSaving, setUnlinkSaving] = useState(false);
  const [unlinkError, setUnlinkError]   = useState("");

  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError]   = useState("");

  useEffect(() => { setDetail(factura); }, [factura]);

  useEffect(() => {
    if (!factura?.id) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError("");
    api.get(`/facturas/${factura.id}`)
      .then((d) => { if (active) setDetail(d); })
      .catch((e) => { if (active) setError(e.message || "No se pudo cargar el detalle"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [factura?.id]);

  async function handleEditSubmit(payload) {
    setEditSaving(true); setEditError("");
    try {
      const updated = await api.patch(`/facturas/${detail.id}`, payload);
      setDetail(updated);
      setFeedback(updated.message || "Cambios guardados");
      setEditOpen(false);
      onUpdated?.(updated);
    } catch (e) { setEditError(e.message || "Error al guardar"); }
    finally { setEditSaving(false); }
  }

  async function handleLinkSubmit(payload) {
    setLinkSaving(true); setLinkError("");
    try {
      const updated = await api.patch(`/facturas/${detail.id}/vincular`, payload);
      setDetail(updated);
      setFeedback(updated.message || "Factura vinculada correctamente");
      setLinkOpen(false);
      onUpdated?.(updated);
    } catch (e) { setLinkError(e.message || "Error al vincular"); }
    finally { setLinkSaving(false); }
  }

  async function handleUnlink() {
    setUnlinkSaving(true); setUnlinkError("");
    try {
      const updated = await api.patch(`/facturas/${detail.id}/desvincular`, {});
      setDetail(updated);
      setFeedback(updated.message || "Factura desvinculada");
      setUnlinkOpen(false);
      onUpdated?.(updated);
    } catch (e) { setUnlinkError(e.message || "Error al desvincular"); }
    finally { setUnlinkSaving(false); }
  }

  async function handleDelete() {
    setDeleteSaving(true); setDeleteError("");
    try {
      const res = await api.delete(`/facturas/${detail.id}`);
      setDeleteOpen(false);
      onDeleted?.(detail.id, res.message || "Factura eliminada");
      onClose?.();
    } catch (e) { setDeleteError(e.message || "Error al eliminar"); }
    finally { setDeleteSaving(false); }
  }

  const servicio       = detail?.ordenServicio?.servicio;
  const moneda         = detail?.moneda ?? "PEN";
  const vencida        = isFacturaVencida(detail ?? {});
  const porVencer      = isFacturaPorVencer(detail ?? {});
  const tieneDetraccion =
    Number(detail?.detraccionMonto) > 0 || Number(detail?.detraccionPorcentaje) > 0;

  return (
    <>
      <div className="flex h-full flex-col">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <span className="text-sm font-semibold text-slate-900">
              {detail?.serie ?? factura?.serie}-{detail?.numero ?? factura?.numero}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <FacturaStatusBadge estado={detail?.estadoPago ?? factura?.estadoPago} />
              {vencida && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset bg-red-50 text-red-600 ring-red-200">
                  <AlertTriangle className="h-2.5 w-2.5" /> Vencida
                </span>
              )}
              {!vencida && porVencer && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset bg-amber-50 text-amber-600 ring-amber-200">
                  <Calendar className="h-2.5 w-2.5" /> Por vencer
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Acciones */}
        <div className="shrink-0 border-b px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setEditOpen(true)} disabled={loading || !detail}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>

            {detail?.ordenServicioId ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/servicios/${servicio?.id}/editar`)}
                  disabled={loading || !servicio?.id}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ir al servicio
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setUnlinkError(""); setUnlinkOpen(true); }}
                  disabled={loading || !detail}
                >
                  <Unlink className="h-3.5 w-3.5" /> Desvincular
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setLinkError(""); setLinkOpen(true); }}
                disabled={loading || !detail}
              >
                <Link2 className="h-3.5 w-3.5" /> Vincular
              </Button>
            )}

            {isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => { setDeleteError(""); setDeleteOpen(true); }}
                disabled={loading || !detail}
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 shrink-0 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}
        {feedback && (
          <div className="mx-5 mt-3 shrink-0 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {feedback}
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {loading && !detail ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !detail ? (
            <p className="text-xs text-slate-400">No se pudo cargar la factura.</p>
          ) : (
            <>
              {/* 1. Comprobante */}
              <Section label="Comprobante">
                <Row label="Número"    value={`${detail.serie}-${detail.numero}`} />
                <Row label="Tipo"      value={detail.tipo} />
                <Row label="Emisión"   value={fechaLarga(detail.fechaEmision)} />
                <Row
                  label="Vencimiento"
                  value={
                    detail.fechaVencimiento ? (
                      <span className={
                        vencida ? "font-medium text-red-600" :
                        porVencer ? "text-amber-600" :
                        undefined
                      }>
                        {fechaLarga(detail.fechaVencimiento)}
                      </span>
                    ) : "—"
                  }
                />
                <Row label="Moneda"  value={detail.moneda ?? "PEN"} />
                <Row label="Origen"  value={detail.origenImportacion} />
                {detail.nombreArchivoOrigen && (
                  <Row
                    label="Archivo"
                    value={
                      <span
                        className="block max-w-[160px] truncate text-right"
                        title={detail.nombreArchivoOrigen}
                      >
                        {detail.nombreArchivoOrigen}
                      </span>
                    }
                  />
                )}
              </Section>

              <hr className="border-slate-100" />

              {/* 2. Cobranza */}
              <Section label="Cobranza">
                <Row label="Estado"     value={<FacturaStatusBadge estado={detail.estadoPago} />} />
                <Row label="Forma pago" value={detail.formaPago ?? "—"} />
                <div className="mt-1 space-y-1 rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Neto</span>
                    <span className="text-slate-700">{fmtTotal(detail.montoNeto, moneda)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">IGV</span>
                    <span className="text-slate-700">{fmtTotal(detail.igv, moneda)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 text-xs">
                    <span className="font-semibold text-slate-700">Total</span>
                    <span className="font-semibold text-slate-900">{fmtTotal(detail.total, moneda)}</span>
                  </div>
                </div>
              </Section>

              <hr className="border-slate-100" />

              {/* 3. Cliente */}
              <Section label="Cliente">
                <Row label="Razón social" value={detail.cliente?.razonSocial} />
                <Row label="RUC"          value={detail.cliente?.ruc} />
              </Section>

              {/* 4. Detracción — solo si aplica */}
              {tieneDetraccion && (
                <>
                  <hr className="border-slate-100" />
                  <Section label="Detracción">
                    <Row
                      label="Porcentaje"
                      value={`${Number(detail.detraccionPorcentaje ?? 0).toFixed(2)}%`}
                    />
                    <Row label="Monto" value={fmtTotal(detail.detraccionMonto, "PEN")} />
                  </Section>
                </>
              )}

              <hr className="border-slate-100" />

              {/* 5. Operación */}
              <Section label="Operación">
                {servicio ? (
                  <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-slate-800">
                        {servicio.origen} → {servicio.destino}
                      </p>
                      {servicio.vehiculo?.placa && (
                        <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                          {servicio.vehiculo.placa}
                        </span>
                      )}
                    </div>
                    {servicio.fechaServicio && (
                      <p className="text-[11px] text-slate-500">{fechaLarga(servicio.fechaServicio)}</p>
                    )}
                    {(servicio.clientes ?? []).length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        {servicio.clientes.map((sc) => sc.cliente.razonSocial).join(", ")}
                      </p>
                    )}
                    <button
                      onClick={() => navigate(`/servicios/${servicio.id}/editar`)}
                      className="mt-0.5 flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver servicio
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-red-200 bg-red-50/40 px-3 py-2.5">
                    <Link className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    <div>
                      <p className="text-xs font-medium text-red-600">Sin servicio vinculado</p>
                      <p className="mt-0.5 text-[11px] text-red-400">
                        {(detail.guias?.length ?? 0) > 0
                          ? "Hay guías detectadas, pero sin servicio asignado."
                          : "Vincula esta factura a un servicio de transporte."}
                      </p>
                    </div>
                  </div>
                )}
              </Section>

              <hr className="border-slate-100" />

              {/* 6. Guías relacionadas */}
              <Section label={`Guías relacionadas (${detail.guias?.length ?? 0})`}>
                {detail.guias?.length > 0 ? (
                  <div className="space-y-1.5">
                    {detail.guias.map((g, i) => (
                      <div
                        key={g.id ?? i}
                        className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="font-mono text-xs text-slate-700">
                          {g.serieGuia}-{g.numeroGuia}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Sin guías relacionadas registradas.</p>
                )}
              </Section>

              <hr className="border-slate-100" />

              {/* 7. Pagos */}
              <Section label={`Pagos (${detail.pagos?.length ?? 0})`}>
                {detail.pagos?.length > 0 ? (
                  <div className="space-y-1.5">
                    {detail.pagos.map((p, i) => (
                      <div key={p.id ?? i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{fechaLarga(p.fechaPago)}</span>
                          <span className="font-medium text-slate-800">{fmtTotal(p.monto, moneda)}</span>
                        </div>
                        {p.medioPago && (
                          <p className="mt-0.5 text-slate-400">{p.medioPago}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Sin pagos registrados.</p>
                )}
              </Section>
            </>
          )}
        </div>
      </div>

      {editOpen && (
        <FacturaEditModal
          open={editOpen}
          factura={detail}
          loading={editSaving}
          error={editError}
          onClose={() => { if (!editSaving) { setEditOpen(false); setEditError(""); } }}
          onSubmit={handleEditSubmit}
        />
      )}

      {linkOpen && (
        <FacturaVincularModal
          open={linkOpen}
          factura={detail}
          loading={linkSaving}
          error={linkError}
          onClose={() => { if (!linkSaving) { setLinkOpen(false); setLinkError(""); } }}
          onSubmit={handleLinkSubmit}
        />
      )}

        <ConfirmModal
          open={unlinkOpen}
          title="Desvincular factura"
          description={`Esto quitará la relación entre la factura "${detail?.serie}-${detail?.numero}" y el servicio. La orden no será eliminada.`}
          warning="No se eliminarán datos financieros del servicio."
          confirmLabel="Desvincular"
          loadingLabel="Desvinculando..."
          error={unlinkError}
          loading={unlinkSaving}
          onClose={() => { if (!unlinkSaving) { setUnlinkOpen(false); setUnlinkError(""); } }}
          onConfirm={handleUnlink}
        />

      {isAdmin && (
        <ConfirmModal
          open={deleteOpen}
          title="Eliminar factura"
          description={`Se eliminará la factura "${detail?.serie}-${detail?.numero}" junto con sus guías relacionadas y pagos.`}
          warning="Esta acción no se puede deshacer."
          confirmLabel="Eliminar factura"
          loadingLabel="Eliminando..."
          error={deleteError}
          loading={deleteSaving}
          onClose={() => { if (!deleteSaving) { setDeleteOpen(false); setDeleteError(""); } }}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
