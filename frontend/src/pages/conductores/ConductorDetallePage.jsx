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

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function nombreCompleto(conductor) {
  return [conductor.nombre, conductor.apPaterno, conductor.apMaterno].filter(Boolean).join(" ");
}

export default function ConductorDetallePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [conductor, setConductor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let active = true;

    api.get(`/conductores/${id}`)
      .then((data) => {
        if (active) setConductor(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "No se pudo cargar el conductor.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  function handleOpenStatusModal() {
    if (!conductor) return;
    setStatusError("");
    setShowStatusModal(true);
  }

  function handleCloseStatusModal() {
    if (saving) return;
    setShowStatusModal(false);
    setStatusError("");
  }

  async function handleToggleStatus() {
    if (!conductor) return;

    const nextActivo = !conductor.activo;

    setSaving(true);
    setStatusError("");

    try {
      const response = await api.put(`/conductores/${conductor.id}`, { activo: nextActivo });
      setConductor(response);
      setShowStatusModal(false);
    } catch (err) {
      setStatusError(err.message || "No se pudo actualizar el estado del conductor.");
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

  if (error || !conductor) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error || "No se pudo cargar el conductor."}
        </div>
      </div>
    );
  }

  const isActivo = conductor.activo;

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/conductores" className="flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Conductores
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{nombreCompleto(conductor)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/conductores/${conductor.id}/editar`)}>
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
            <InfoRow label="Nombre" value={conductor.nombre} />
            <InfoRow label="Apellido paterno" value={conductor.apPaterno} />
            <InfoRow label="Apellido materno" value={conductor.apMaterno || "No disponible"} />
            <InfoRow label="Documento" value={`${conductor.tipoDocumento} ${conductor.nroDocumento}`} mono />
            <InfoRow label="Tipo" value={conductor.tipo} />
            <InfoRow label="Estado" value={conductor.activo ? "ACTIVO" : "INACTIVO"} />
          </Section>

          {conductor.propietarioSubcontratado && (
            <Section title="Empresa propietaria">
              <InfoRow label="Razon social" value={conductor.propietarioSubcontratado.razonSocial} />
              <InfoRow label="RUC" value={conductor.propietarioSubcontratado.ruc} mono />
              <InfoRow label="Contacto" value={conductor.propietarioSubcontratado.contacto || "No disponible"} />
              <InfoRow label="Telefono" value={conductor.propietarioSubcontratado.telefono || "No disponible"} />
            </Section>
          )}

          <Section title="Servicios recientes">
            {conductor.serviciosRecientes?.length ? (
              <div className="space-y-3">
                {conductor.serviciosRecientes.map((servicio) => (
                  <div key={servicio.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{servicio.origen} - {servicio.destino}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{servicio.estado}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(servicio.fechaServicio)} · {servicio.vehiculo?.placa || "Sin placa"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock message="Este conductor aun no tiene servicios asociados." />
            )}
          </Section>

          <Section title="Liquidaciones recientes">
            {conductor.liquidacionesRecientes?.length ? (
              <div className="space-y-3">
                {conductor.liquidacionesRecientes.map((liquidacion) => (
                  <button
                    key={liquidacion.id}
                    type="button"
                    onClick={() => navigate(`/liquidaciones?liquidacionId=${liquidacion.id}`)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{liquidacion.status}</p>
                      <span className="text-sm text-slate-600">{formatCurrency(liquidacion.saldo)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(liquidacion.createdAt)} · Gastos {formatCurrency(liquidacion.totalGastos)}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyBlock message="Este conductor aun no tiene liquidaciones registradas." />
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Actividad">
            <InfoRow label="Servicios" value={conductor._count?.servicios ?? 0} />
            <InfoRow label="Liquidaciones" value={conductor._count?.liquidaciones ?? 0} />
          </Section>
        </div>
      </div>

      <ConfirmModal
        open={showStatusModal}
        title={isActivo ? "Desactivar conductor" : "Activar conductor"}
        description={`Seguro que deseas ${isActivo ? "desactivar" : "activar"} al conductor "${nombreCompleto(conductor)}"?`}
        warning={isActivo
          ? "Al desactivarlo, este conductor dejara de visualizarse en modulos operativos como servicios."
          : "Al activarlo, este conductor volvera a estar disponible en los demas modulos."}
        confirmLabel={isActivo ? "Desactivar conductor" : "Activar conductor"}
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
