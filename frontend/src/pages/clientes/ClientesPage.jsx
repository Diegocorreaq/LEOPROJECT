import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function ClientesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clienteToDelete, setClienteToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const timeout = setTimeout(() => {
      api.get(`/clientes${search.trim() ? `?texto=${encodeURIComponent(search.trim())}` : ""}`)
        .then((data) => {
          if (active) setClientes(data);
        })
        .catch((err) => {
          if (active) setError(err.message || "No se pudieron cargar los clientes.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search]);

  const stats = useMemo(() => ({
    total: clientes.length,
    conServicios: clientes.filter((cliente) => (cliente._count?.servicios ?? 0) > 0).length,
    conFacturas: clientes.filter((cliente) => (cliente._count?.facturas ?? 0) > 0).length,
  }), [clientes]);

  function handleDeleteClick(cliente) {
    setClienteToDelete(cliente);
    setDeleteError("");
    setFeedback("");
  }

  function handleCloseDeleteModal() {
    if (deletingId) return;
    setClienteToDelete(null);
    setDeleteError("");
  }

  async function handleConfirmDelete() {
    if (!clienteToDelete) return;

    setDeletingId(clienteToDelete.id);
    setFeedback("");
    setDeleteError("");

    try {
      await api.delete(`/clientes/${clienteToDelete.id}`);
      setClientes((current) => current.filter((item) => item.id !== clienteToDelete.id));
      setFeedback("Cliente desactivado correctamente.");
      setClienteToDelete(null);
    } catch (err) {
      setDeleteError(err.message || "No se pudo desactivar el cliente.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500">Gestiona los clientes disponibles para servicios y facturacion.</p>
        </div>
        <Button onClick={() => navigate("/clientes/nuevo")}>
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 border-b bg-slate-50 px-8 py-4 md:grid-cols-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Con servicios" value={stats.conServicios} />
        <StatCard label="Con facturas" value={stats.conFacturas} />
      </div>

      <div className="flex items-center gap-3 border-b px-8 py-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por razon social, RUC o contacto"
            className="pl-9"
          />
        </div>
        {search && (
          <button onClick={() => setSearch("")} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Limpiar
          </button>
        )}
      </div>

      {feedback && (
        <div className="border-b bg-amber-50 px-8 py-3 text-sm text-amber-700">{feedback}</div>
      )}

      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
        ) : clientes.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <p className="text-sm text-slate-500">No hay clientes para mostrar.</p>
            <Button variant="outline" onClick={() => navigate("/clientes/nuevo")}>Registrar cliente</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">RUC</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Servicios</th>
                  <th className="px-4 py-3">Facturas</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="border-t text-sm text-slate-700">
                    <td className="px-4 py-3">
                      <Link to={`/clientes/${cliente.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                        {cliente.razonSocial}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono">{cliente.ruc}</td>
                    <td className="px-4 py-3">
                      <div>{cliente.email || "Sin email"}</div>
                      <div className="text-xs text-slate-500">{cliente.telefono || "Sin telefono"}</div>
                    </td>
                    <td className="px-4 py-3">{cliente._count?.servicios ?? 0}</td>
                    <td className="px-4 py-3">{cliente._count?.facturas ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <IconAction label="Ver" onClick={() => navigate(`/clientes/${cliente.id}`)} icon={<Eye className="h-4 w-4" />} />
                        <IconAction label="Editar" onClick={() => navigate(`/clientes/${cliente.id}/editar`)} icon={<Pencil className="h-4 w-4" />} />
                        {user?.rol === "ADMIN" && (
                          <IconAction
                            label={deletingId === cliente.id ? "Desactivando..." : "Desactivar"}
                            onClick={() => handleDeleteClick(cliente)}
                            disabled={deletingId === cliente.id}
                            icon={<Trash2 className="h-4 w-4" />}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(clienteToDelete)}
        title="Desactivar cliente"
        description={clienteToDelete ? `Seguro que deseas desactivar al cliente "${clienteToDelete.razonSocial}"?` : ""}
        warning="El cliente dejara de estar disponible para nuevas operaciones, pero se conservara su historial."
        confirmLabel="Desactivar cliente"
        loading={deletingId === clienteToDelete?.id}
        error={deleteError}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function IconAction({ label, onClick, icon, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
