import { useEffect, useState } from "react";
import {
  AlertCircle, ExternalLink, FileText, Link, Link2,
  Loader2, Pencil, Trash2, Unlink, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import FacturaStatusBadge from "./FacturaStatusBadge";
import FacturaEditModal from "./FacturaEditModal";
import FacturaVincularModal from "./FacturaVincularModal";

function fechaLarga(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtNum(val, moneda = "PEN") {
  if (val == null) return "-";
  return `${moneda === "USD" ? "$ " : "S/ "}${Number(val).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

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

export default function FacturaDetailDrawer({ factura, onClose, onUpdated, onDeleted }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const [detail, setDetail]         = useState(factura);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [feedback, setFeedback]     = useState("");

  const [editOpen, setEditOpen]     = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState("");

  const [linkOpen, setLinkOpen]     = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError]   = useState("");

  const [unlinkOpen, setUnlinkOpen]   = useState(false);
  const [unlinkSaving, setUnlinkSaving] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");

  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const servicio = detail?.ordenServicio?.servicio;
  const moneda = detail?.moneda ?? "PEN";

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <span className="font-semibold text-slate-900">
              {detail?.serie ?? factura?.serie}-{detail?.numero ?? factura?.numero}
            </span>
            <div className="mt-0.5">
              <FacturaStatusBadge estado={detail?.estadoPago ?? factura?.estadoPago} />
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Acciones */}
        <div className="shrink-0 space-y-3 border-b px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setEditOpen(true)} disabled={loading || !detail}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            {detail?.ordenServicioId ? (
              <>
                <Button size="sm" variant="outline"
                  onClick={() => navigate(`/servicios/${detail.ordenServicio?.servicio?.id}/editar`)}
                  disabled={loading || !detail || !detail.ordenServicio?.servicio?.id}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ir al servicio
                </Button>
                {isAdmin ? (
                  <Button size="sm" variant="outline"
                    onClick={() => { setUnlinkError(""); setUnlinkOpen(true); }}
                    disabled={loading || !detail}
                  >
                    <Unlink className="h-4 w-4" />
                    Desvincular
                  </Button>
                ) : null}
              </>
            ) : (
              <Button size="sm" variant="outline"
                onClick={() => { setLinkError(""); setLinkOpen(true); }}
                disabled={loading || !detail}
              >
                <Link2 className="h-4 w-4" />
                Vincular a servicio
              </Button>
            )}
            {isAdmin ? (
              <Button size="sm" variant="destructive"
                onClick={() => { setDeleteError(""); setDeleteOpen(true); }}
                disabled={loading || !detail}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            ) : null}
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 shrink-0 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {feedback && (
          <div className="mx-5 mt-3 shrink-0 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {feedback}
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {loading && !detail ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-slate-400">No se pudo cargar la factura.</p>
          ) : (
            <>
              <Section label="Datos del comprobante">
                <Row label="Número" value={`${detail.serie}-${detail.numero}`} />
                <Row label="Tipo" value={detail.tipo} />
                <Row label="Fecha emisión" value={fechaLarga(detail.fechaEmision)} />
                <Row label="Fecha vencimiento" value={fechaLarga(detail.fechaVencimiento)} />
                <Row label="Moneda" value={detail.moneda ?? "PEN"} />
                <Row label="Origen importación" value={detail.origenImportacion} />
                {detail.nombreArchivoOrigen && <Row label="Archivo" value={detail.nombreArchivoOrigen} />}
              </Section>

              <hr />

              <Section label="Estado de pago">
                <Row label="Estado" value={<FacturaStatusBadge estado={detail.estadoPago} />} />
                <Row label="Forma de pago" value={detail.formaPago} />
              </Section>

              <hr />

              <Section label="Cliente">
                <Row label="Razón social" value={detail.cliente?.razonSocial} />
                <Row label="RUC" value={detail.cliente?.ruc} />
              </Section>

              <hr />

              <Section label="Importes">
                <Row label="Valor venta (neto)" value={fmtNum(detail.montoNeto, moneda)} />
                <Row label="IGV" value={fmtNum(detail.igv, moneda)} />
                <Row label="Total" value={
                  <span className="font-semibold text-slate-900">{fmtNum(detail.total, moneda)}</span>
                } />
                {Number(detail.detraccionMonto) > 0 && (
                  <>
                    <Row label="Detracción %" value={`${Number(detail.detraccionPorcentaje).toFixed(2)}%`} />
                    <Row label="Detracción S/." value={fmtNum(detail.detraccionMonto, "PEN")} />
                  </>
                )}
              </Section>

              <hr />

              <Section label={`Guías relacionadas (${detail.guias?.length ?? 0})`}>
                {detail.guias?.length > 0 ? (
                  <div className="space-y-1.5">
                    {detail.guias.map((g, i) => (
                      <div key={g.id ?? i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="text-xs font-medium text-slate-700">{g.serieGuia}-{g.numeroGuia}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin guías relacionadas registradas.</p>
                )}
              </Section>

              <hr />

              <Section label={`Pagos (${detail.pagos?.length ?? 0})`}>
                {detail.pagos?.length > 0 ? (
                  <div className="space-y-1.5">
                    {detail.pagos.map((p, i) => (
                      <div key={p.id ?? i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{fechaLarga(p.fechaPago)}</span>
                          <span className="font-medium text-slate-800">{fmtNum(p.monto, moneda)}</span>
                        </div>
                        {p.medioPago && <p className="text-slate-400 mt-0.5">{p.medioPago}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin pagos registrados.</p>
                )}
              </Section>

              <hr />

              <Section label="Servicio vinculado">
                {servicio ? (
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5 space-y-1">
                    <p className="text-sm font-medium text-slate-700">
                      {servicio.origen} → {servicio.destino}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fechaLarga(servicio.fechaServicio)} · {servicio.vehiculo?.placa ?? "-"}
                    </p>
                    {(servicio.clientes ?? []).length > 0 && (
                      <p className="text-xs text-slate-500">
                        {servicio.clientes.map((sc) => sc.cliente.razonSocial).join(", ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <Link className="h-3.5 w-3.5" />
                    Sin vincular
                  </div>
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

      {isAdmin ? (
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
      ) : null}

      {isAdmin ? (
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
      ) : null}
    </>
  );
}
