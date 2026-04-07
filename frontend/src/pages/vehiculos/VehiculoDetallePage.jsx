import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Slash } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { api } from "@/lib/api";

function formatDate(value) {
  if (!value) return "No disponible";
  return new Date(value).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "No disponible";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default function VehiculoDetallePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [vehiculo, setVehiculo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let active = true;

    api.get(`/vehiculos/${id}`)
      .then((data) => {
        if (active) setVehiculo(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "No se pudo cargar el vehiculo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  function handleOpenStatusModal() {
    if (!vehiculo) return;
    setStatusError("");
    setShowStatusModal(true);
  }

  function handleCloseStatusModal() {
    if (saving) return;
    setShowStatusModal(false);
    setStatusError("");
  }

  async function handleToggleStatus() {
    if (!vehiculo) return;

    const nextEstado = vehiculo.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";

    setSaving(true);
    setStatusError("");

    try {
      const response = await api.put(`/vehiculos/${vehiculo.id}`, { estado: nextEstado });
      setVehiculo(response);
      setShowStatusModal(false);
    } catch (err) {
      setStatusError(err.message || "No se pudo actualizar el estado del vehiculo.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  if (error || !vehiculo) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error || "No se pudo cargar el vehiculo."}
        </div>
      </div>
    );
  }

  const isActivo = vehiculo.estado === "ACTIVO";

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/vehiculos" className="flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Vehiculos
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{vehiculo.placa}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/vehiculos/${vehiculo.id}/editar`)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button variant="outline" onClick={handleOpenStatusModal} disabled={saving}>
            <Slash className="h-4 w-4" />
            {saving ? (isActivo ? "Desactivando..." : "Activando...") : isActivo ? "Desactivar" : "Activar"}
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-auto px-8 py-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Section title="Informacion general">
            <InfoRow label="Placa" value={vehiculo.placa} mono />
            {vehiculo.placaCarreta ? <InfoRow label="Placa carreta" value={vehiculo.placaCarreta} mono /> : null}
            <InfoRow label="Tipo unidad" value={vehiculo.tipoUnidad} />
            <InfoRow label="Tipo" value={vehiculo.tipo} />
            <InfoRow label="Estado" value={vehiculo.estado} />
            <InfoRow label="MTC" value={vehiculo.mtc || "No disponible"} />
            {vehiculo.mtcCarreta ? <InfoRow label="MTC carreta" value={vehiculo.mtcCarreta} /> : null}
            <InfoRow label="Peso neto" value={formatNumber(vehiculo.pesoNeto)} />
            <InfoRow label="Peso bruto" value={formatNumber(vehiculo.pesoBruto)} />
            <InfoRow label="Carga util" value={formatNumber(vehiculo.cargaUtil)} />
          </Section>

          {vehiculo.propietarioSubcontratado && (
            <Section title="Empresa propietaria">
              <InfoRow label="Razon social" value={vehiculo.propietarioSubcontratado.razonSocial} />
              <InfoRow label="RUC" value={vehiculo.propietarioSubcontratado.ruc} mono />
              <InfoRow label="Contacto" value={vehiculo.propietarioSubcontratado.contacto || "No disponible"} />
              <InfoRow label="Telefono" value={vehiculo.propietarioSubcontratado.telefono || "No disponible"} />
            </Section>
          )}

          <Section title="Servicios recientes">
            {vehiculo.serviciosRecientes?.length ? (
              <div className="space-y-3">
                {vehiculo.serviciosRecientes.map((servicio) => (
                  <div key={servicio.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{servicio.origen} - {servicio.destino}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{servicio.estado}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(servicio.fechaServicio)} · {servicio.conductor?.nombre || "Sin conductor"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock message="Este vehiculo aun no tiene servicios asociados." />
            )}
          </Section>

          <Section title="Documentos y mantenimiento">
            <InfoRow label="Documentos registrados" value={vehiculo.docsVehiculo?.length ?? 0} />
            <InfoRow label="Mantenimientos registrados" value={vehiculo.mantenimientos?.length ?? 0} />
            {vehiculo.docsVehiculo?.length ? (
              <div className="space-y-2">
                {vehiculo.docsVehiculo.map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">{doc.tipoDoc}</p>
                    <p className="mt-1 text-slate-500">Vence: {formatDate(doc.fechaVencimiento)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Actividad">
            <InfoRow label="Servicios" value={vehiculo._count?.servicios ?? 0} />
            <InfoRow label="Documentos" value={vehiculo._count?.docsVehiculo ?? 0} />
            <InfoRow label="Mantenimientos" value={vehiculo._count?.mantenimientos ?? 0} />
          </Section>
        </div>
      </div>

      <ConfirmModal
        open={showStatusModal}
        title={isActivo ? "Desactivar vehiculo" : "Activar vehiculo"}
        description={`Seguro que deseas ${isActivo ? "desactivar" : "activar"} el vehiculo "${vehiculo.placa}"?`}
        warning={isActivo
          ? "Al desactivarlo, este vehiculo dejara de visualizarse en modulos operativos como servicios."
          : "Al activarlo, este vehiculo volvera a estar disponible en los demas modulos."}
        confirmLabel={isActivo ? "Desactivar vehiculo" : "Activar vehiculo"}
        loadingLabel={isActivo ? "Desactivando..." : "Activando..."}
        loading={saving}
        error={statusError}
        onClose={handleCloseStatusModal}
        onConfirm={handleToggleStatus}
      />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={mono ? "font-mono text-right text-slate-900" : "text-right text-slate-900"}>{value}</span>
    </div>
  );
}

function EmptyBlock({ message }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}
