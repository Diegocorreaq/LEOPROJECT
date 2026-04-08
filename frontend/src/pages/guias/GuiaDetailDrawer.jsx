import { useEffect, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Link,
  Loader2,
  Link2,
  Pencil,
  Trash2,
  Truck,
  Unlink,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import GuiaStatusBadge from "./GuiaStatusBadge";
import GuiaEditModal from "./GuiaEditModal";
import GuiaVincularModal from "./GuiaVincularModal";

function fechaLarga(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatNumber(value) {
  if (value == null || value === "") return "-";
  return Number(value).toLocaleString("es-PE");
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

export default function GuiaDetailDrawer({ guia, onClose, onUpdated, onDeleted }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const [detail, setDetail] = useState(guia);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinkSaving, setUnlinkSaving] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setDetail(guia);
  }, [guia]);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!guia?.id) {
        setDetail(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setFeedback("");

      try {
        const data = await api.get(`/guias/${guia.id}`);
        if (!active) return;
        setDetail(data);
      } catch (err) {
        if (!active) return;
        setError(err.message || "No se pudo cargar el detalle de la guia");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      active = false;
    };
  }, [guia?.id]);

  async function handleEditSubmit(payload) {
    if (!detail?.id) return;

    setEditSaving(true);
    setEditError("");

    try {
      const updated = await api.patch(`/guias/${detail.id}`, payload);
      setDetail(updated);
      setFeedback(updated.message || "Cambios guardados correctamente");
      setEditOpen(false);
      onUpdated?.(updated);
    } catch (err) {
      setEditError(err.message || "No se pudo actualizar la guia");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleUnlink() {
    if (!detail?.id) return;

    setUnlinkSaving(true);
    setUnlinkError("");

    try {
      const updated = await api.patch(`/guias/${detail.id}/desvincular`, {});
      setDetail(updated);
      setFeedback(updated.message || "La guia fue desvinculada correctamente");
      setUnlinkOpen(false);
      onUpdated?.(updated);
    } catch (err) {
      setUnlinkError(err.message || "No se pudo desvincular la guia");
    } finally {
      setUnlinkSaving(false);
    }
  }

  async function handleLinkSubmit(payload) {
    if (!detail?.id) return;

    setLinkSaving(true);
    setLinkError("");

    try {
      const updated = await api.patch(`/guias/${detail.id}/vincular`, payload);
      setDetail(updated);
      setFeedback(updated.message || "La guia fue vinculada correctamente al servicio");
      setLinkOpen(false);
      onUpdated?.(updated);
    } catch (err) {
      setLinkError(err.message || "No se pudo vincular la guia al servicio");
    } finally {
      setLinkSaving(false);
    }
  }

  async function handleDelete() {
    if (!detail?.id) return;

    setDeleteSaving(true);
    setDeleteError("");

    try {
      const response = await api.delete(`/guias/${detail.id}`);
      setDeleteOpen(false);
      onDeleted?.(detail.id, response.message || "La guia fue eliminada correctamente");
      onClose?.();
    } catch (err) {
      setDeleteError(err.message || "No se pudo eliminar la guia");
    } finally {
      setDeleteSaving(false);
    }
  }

  const servicio = detail?.servicio;
  const hasBienes = Array.isArray(detail?.bienes) && detail.bienes.length > 0;
  const hasDocs = Array.isArray(detail?.docsRelacionados) && detail.docsRelacionados.length > 0;

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <span className="font-semibold text-slate-900">
              {detail?.serie ?? guia?.serie}-{detail?.numero ?? guia?.numero}
            </span>
            <div className="mt-0.5">
              <GuiaStatusBadge estado={detail?.estado ?? guia?.estado} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 space-y-3 border-b px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setEditOpen(true)} disabled={loading || !detail}>
              <Pencil className="h-4 w-4" />
              Editar guia
            </Button>
            {detail?.servicioId ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/servicios/${detail.servicioId}/editar`)}
                  disabled={loading || !detail}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ir al servicio
                </Button>
                {isAdmin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUnlinkError("");
                      setUnlinkOpen(true);
                    }}
                    disabled={loading || !detail}
                  >
                    <Unlink className="h-4 w-4" />
                    Desvincular
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLinkError("");
                  setLinkOpen(true);
                }}
                disabled={loading || !detail}
              >
                <Link2 className="h-4 w-4" />
                Vincular a servicio
              </Button>
            )}
            {isAdmin ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
                disabled={loading || !detail}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar guia
              </Button>
            ) : null}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Los datos oficiales importados desde SUNAT permanecen en solo lectura. Solo puedes
            editar estado, observaciones internas y fecha de recepcion.
          </p>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex shrink-0 items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {feedback && (
          <div className="mx-5 mt-3 shrink-0 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {feedback}
          </div>
        )}

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {loading && !detail ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !detail ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No se pudo cargar la guia seleccionada.
            </div>
          ) : (
            <>
              <Section label="Datos de la guia">
                <Row label="Serie" value={detail.serie} />
                <Row label="Numero" value={detail.numero} />
                <Row label="Fecha emision" value={fechaLarga(detail.fechaEmision)} />
                <Row label="Hora emision" value={detail.horaEmision} />
                <Row label="Inicio traslado" value={fechaLarga(detail.fechaInicioTraslado)} />
                <Row label="Origen importacion" value={detail.origenImportacion} />
                {detail.nombreArchivoOrigen && <Row label="Archivo" value={detail.nombreArchivoOrigen} />}
              </Section>

              <hr />

              <Section label="Datos internos">
                <Row label="Estado" value={<GuiaStatusBadge estado={detail.estado} />} />
                <Row label="Fecha recepcion" value={fechaLarga(detail.fechaRecepcion)} />
                <Row label="Observaciones internas" value={detail.observaciones ?? "-"} />
              </Section>

              <hr />

              <Section label="Traslado">
                <Row label="Punto de salida" value={detail.puntoDeSalida} />
                <Row label="Punto de llegada" value={detail.puntoDeLlegada} />
                <Row label="Remitente" value={detail.remitenteNombre} />
                {detail.remitenteRuc && <Row label="RUC remitente" value={detail.remitenteRuc} />}
                <Row label="Destinatario" value={detail.destinatarioNombre} />
                {detail.destinatarioRuc && <Row label="RUC destinatario" value={detail.destinatarioRuc} />}
                <Row label="Pagador del flete" value={detail.pagadorFleteNombre} />
                {detail.pagadorFleteRuc && <Row label="RUC pagador" value={detail.pagadorFleteRuc} />}
                {detail.pesoBrutoTotal != null && (
                  <Row label="Peso bruto" value={`${formatNumber(detail.pesoBrutoTotal)} ${detail.unidadPeso ?? ""}`} />
                )}
              </Section>

              <hr />

              <Section label="Unidad">
                <Row label="Placa principal" value={detail.placaPrincipal} />
                {detail.placaSecundaria && <Row label="Placa secundaria" value={detail.placaSecundaria} />}
                <Row label="Conductor" value={detail.conductorPrincipalNombre} />
                {detail.conductorPrincipalDocumento && (
                  <Row label="Documento" value={detail.conductorPrincipalDocumento} />
                )}
                {detail.conductorPrincipalLicencia && (
                  <Row label="Licencia" value={detail.conductorPrincipalLicencia} />
                )}
                {detail.mtcNumero && <Row label="MTC" value={detail.mtcNumero} />}
                <Row label="Transportista" value={detail.transportistaNombre} />
                {detail.transportistaRuc && (
                  <Row label="RUC transportista" value={detail.transportistaRuc} />
                )}
              </Section>

              {(detail.subcontratado || detail.subcontratistaNombre || detail.subcontratistaRuc) && (
                <>
                  <hr />
                  <Section label="Subcontratacion">
                    <Row label="Subcontratado" value={detail.subcontratado ? "Si" : "No"} />
                    {detail.subcontratistaNombre && (
                      <Row label="Subcontratista" value={detail.subcontratistaNombre} />
                    )}
                    {detail.subcontratistaRuc && <Row label="RUC" value={detail.subcontratistaRuc} />}
                  </Section>
                </>
              )}

              <hr />

              <Section label="Bienes transportados">
                {hasBienes ? (
                  <div className="overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium text-slate-500">Descripcion</th>
                          <th className="px-3 py-1.5 text-right font-medium text-slate-500">Cant.</th>
                          <th className="px-3 py-1.5 text-right font-medium text-slate-500">Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.bienes.map((bien, index) => (
                          <tr key={bien.id ?? index} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 text-slate-700">{bien.descripcion}</td>
                            <td className="px-3 py-1.5 text-right text-slate-600">
                              {bien.cantidad != null ? formatNumber(bien.cantidad) : "-"}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-500">{bien.unidadMedida ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin bienes registrados en esta guia.</p>
                )}
              </Section>

              <hr />

              <Section label="Documentos relacionados">
                {hasDocs ? (
                  <div className="space-y-1.5">
                    {detail.docsRelacionados.map((doc, index) => (
                      <div
                        key={doc.id ?? index}
                        className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-700">
                            {doc.tipoDocumento} - {doc.numeroDocumento}
                          </p>
                          {doc.rucEmisor && <p className="text-xs text-slate-500">RUC: {doc.rucEmisor}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin documentos relacionados.</p>
                )}
              </Section>

              <hr />

              <Section label="Observaciones">
                {detail.observacionSunat && (
                  <div className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase text-amber-600">SUNAT</p>
                    <p className="text-sm text-amber-800">{detail.observacionSunat}</p>
                  </div>
                )}
                <p className="text-sm text-slate-500">
                  {detail.observaciones || "Sin observaciones internas registradas."}
                </p>
              </Section>

              <hr />

              <Section label="Servicio vinculado">
                {servicio ? (
                  <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">
                        {servicio.origen} {"->"} {servicio.destino}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {fechaLarga(servicio.fechaServicio)} · {servicio.vehiculo?.placa ?? "-"}
                    </p>
                    {(servicio.clientes ?? []).length > 0 && (
                      <p className="text-xs text-slate-500">
                        {servicio.clientes.map((item) => item.cliente.razonSocial).join(", ")}
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
        <GuiaEditModal
          open={editOpen}
          guia={detail}
          loading={editSaving}
          error={editError}
          onClose={() => {
            if (!editSaving) {
              setEditOpen(false);
              setEditError("");
            }
          }}
          onSubmit={handleEditSubmit}
        />
      )}

      {linkOpen && (
        <GuiaVincularModal
          open={linkOpen}
          guia={detail}
          loading={linkSaving}
          error={linkError}
          onClose={() => {
            if (!linkSaving) {
              setLinkOpen(false);
              setLinkError("");
            }
          }}
          onSubmit={handleLinkSubmit}
        />
      )}

      {isAdmin ? (
        <ConfirmModal
          open={unlinkOpen}
          title="Desvincular guia"
          description={`Esta accion quitara la relacion entre la guia "${detail?.serie ?? ""}-${detail?.numero ?? ""}" y el servicio, pero no eliminara la guia.`}
          warning="Los bienes, documentos relacionados y datos importados se mantendran intactos."
          confirmLabel="Desvincular guia"
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
      ) : null}

      {isAdmin ? (
        <ConfirmModal
          open={deleteOpen}
          title="Eliminar guia"
          description={`Esta accion eliminara la guia "${detail?.serie ?? ""}-${detail?.numero ?? ""}" y sus datos relacionados.`}
          warning="No se puede deshacer."
          confirmLabel="Eliminar guia"
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
