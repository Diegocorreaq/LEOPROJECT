import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatDateLong } from "@/lib/dateOnly";

function formatDate(value) {
  if (!value) return "No disponible";
  return formatDateLong(value);
}

function formatTimestampDate(value) {
  if (!value) return "No disponible";
  return new Date(value).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ClienteDetallePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;

    api.get(`/clientes/${id}`)
      .then((data) => {
        if (active) setCliente(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "No se pudo cargar el cliente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  function handleOpenDeleteModal() {
    if (!cliente) return;
    setDeleteError("");
    setShowDeleteModal(true);
  }

  function handleCloseDeleteModal() {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeleteError("");
  }

  async function handleDelete() {
    if (!cliente) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`/clientes/${cliente.id}`);
      setShowDeleteModal(false);
      navigate("/clientes");
    } catch (err) {
      setDeleteError(err.message || "No se pudo desactivar el cliente.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error || "No se pudo cargar el cliente."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/clientes" className="flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Clientes
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{cliente.razonSocial}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          {user?.rol === "ADMIN" && (
            <Button variant="outline" onClick={handleOpenDeleteModal} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
              {deleting ? "Desactivando..." : "Desactivar"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-auto px-8 py-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Section title="Informacion general">
            <InfoRow label="Razon social" value={cliente.razonSocial} />
            <InfoRow label="RUC" value={cliente.ruc} mono />
            <InfoRow label="Email" value={cliente.email || "Sin email"} />
            <InfoRow label="Telefono" value={cliente.telefono || "Sin telefono"} />
            <InfoRow label="Direccion" value={cliente.direccion || "Sin direccion"} />
            <InfoRow label="Creado" value={formatTimestampDate(cliente.createdAt)} />
          </Section>

          <Section title="Servicios recientes">
            {cliente.serviciosRecientes?.length ? (
              <div className="space-y-3">
                {cliente.serviciosRecientes.map((servicio) => (
                  <div key={servicio.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{servicio.origen} - {servicio.destino}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{servicio.estado}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(servicio.fechaServicio)} · {servicio.vehiculo?.placa || "Sin placa"} · {servicio.conductor?.nombre || "Sin conductor"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock message="Este cliente aun no tiene servicios asociados." />
            )}
          </Section>

          <Section title="Facturas recientes">
            {cliente.facturasRecientes?.length ? (
              <div className="space-y-3">
                {cliente.facturasRecientes.map((factura) => (
                  <div key={factura.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{factura.serie}-{factura.numero}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{factura.estadoPago}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(factura.fechaEmision)} · {formatCurrency(factura.total)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock message="Este cliente aun no tiene facturas registradas." />
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Actividad">
            <InfoRow label="Servicios" value={cliente._count?.servicios ?? 0} />
            <InfoRow label="Facturas" value={cliente._count?.facturas ?? 0} />
          </Section>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteModal}
        title="Desactivar cliente"
        description={`Seguro que deseas desactivar al cliente "${cliente.razonSocial}"?`}
        warning="El cliente dejara de estar disponible para nuevas operaciones, pero se conservara su historial."
        confirmLabel="Desactivar cliente"
        loading={deleting}
        error={deleteError}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDelete}
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
