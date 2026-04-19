import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Search, Slash } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const TIPO_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PROPIO", label: "Propios" },
  { value: "SUBCONTRATADO", label: "Subcontratados" },
];

const ESTADO_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVO", label: "Activos" },
  { value: "INACTIVO", label: "Inactivos" },
];

export default function VehiculosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("ALL");
  const [estado, setEstado] = useState("ALL");
  const [savingId, setSavingId] = useState("");
  const [vehiculoToToggle, setVehiculoToToggle] = useState(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("texto", search.trim());
      if (tipo !== "ALL") params.set("tipo", tipo);
      if (estado !== "ALL") params.set("estado", estado);
      const query = params.toString();

      api.get(`/vehiculos${query ? `?${query}` : ""}`)
        .then((data) => {
          if (active) setVehiculos(data);
        })
        .catch((err) => {
          if (active) setError(err.message || "No se pudieron cargar los vehiculos.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search, tipo, estado]);

  const stats = useMemo(() => ({
    total: vehiculos.length,
    activos: vehiculos.filter((vehiculo) => vehiculo.estado === "ACTIVO").length,
    terceros: vehiculos.filter((vehiculo) => vehiculo.tipo === "SUBCONTRATADO").length,
  }), [vehiculos]);

  function handleToggleStatusClick(vehiculo) {
    setVehiculoToToggle(vehiculo);
    setStatusError("");
    setFeedback("");
  }

  function handleCloseStatusModal() {
    if (savingId) return;
    setVehiculoToToggle(null);
    setStatusError("");
  }

  async function handleConfirmToggleStatus() {
    if (!vehiculoToToggle) return;

    const nextEstado = vehiculoToToggle.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    const successMessage = nextEstado === "ACTIVO"
      ? "Vehiculo activado correctamente."
      : "Vehiculo desactivado correctamente.";

    setSavingId(vehiculoToToggle.id);
    setFeedback("");
    setStatusError("");

    try {
      const response = await api.put(`/vehiculos/${vehiculoToToggle.id}`, { estado: nextEstado });
      setVehiculos((current) => current.map((item) => item.id === vehiculoToToggle.id ? response : item));
      setFeedback(successMessage);
      setVehiculoToToggle(null);
    } catch (err) {
      setStatusError(err.message || "No se pudo actualizar el estado del vehiculo.");
    } finally {
      setSavingId("");
    }
  }

  const statusAction = vehiculoToToggle?.estado === "ACTIVO" ? "desactivar" : "activar";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Vehiculos</h1>
          <p className="text-sm text-slate-500">Administra unidades propias y subcontratadas listas para operar.</p>
        </div>
        <Button onClick={() => navigate("/vehiculos/nuevo")}>
          <Plus className="h-4 w-4" />
          Nuevo vehiculo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 border-b bg-slate-50 px-8 py-4 md:grid-cols-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Activos" value={stats.activos} />
        <StatCard label="Subcontratados" value={stats.terceros} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b px-8 py-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por placa, carreta, MTC o empresa" className="pl-9" />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPO_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ESTADO_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {feedback && (
        <div className="border-b bg-amber-50 px-8 py-3 text-sm text-amber-700">{feedback}</div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
        ) : vehiculos.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <p className="text-sm text-slate-500">No hay vehiculos para mostrar.</p>
            <Button variant="outline" onClick={() => navigate("/vehiculos/nuevo")}>Registrar vehiculo</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Unidad</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Servicios</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vehiculos.map((vehiculo) => (
                  <tr key={vehiculo.id} className="border-t text-sm text-slate-700">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/vehiculos/${vehiculo.id}`)} className="text-left">
                        <div className="font-medium text-slate-900 hover:text-blue-600">{vehiculo.placa}</div>
                        <div className="text-xs text-slate-500">{vehiculo.tipoUnidad}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">{vehiculo.tipo}</td>
                    <td className="px-4 py-3">{vehiculo.propietarioSubcontratado?.razonSocial || "Propio"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${vehiculo.estado === "ACTIVO" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {vehiculo.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">{vehiculo._count?.servicios ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <IconAction label="Ver" onClick={() => navigate(`/vehiculos/${vehiculo.id}`)} icon={<Eye className="h-4 w-4" />} />
                        <IconAction label="Editar" onClick={() => navigate(`/vehiculos/${vehiculo.id}/editar`)} icon={<Pencil className="h-4 w-4" />} />
                        {isAdmin ? (
                          <IconAction
                            label={savingId === vehiculo.id ? (vehiculo.estado === "ACTIVO" ? "Desactivando..." : "Activando...") : vehiculo.estado === "ACTIVO" ? "Desactivar" : "Activar"}
                            onClick={() => handleToggleStatusClick(vehiculo)}
                            disabled={savingId === vehiculo.id}
                            icon={<Slash className="h-4 w-4" />}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin ? (
        <ConfirmModal
          open={Boolean(vehiculoToToggle)}
          title={vehiculoToToggle?.estado === "ACTIVO" ? "Desactivar vehiculo" : "Activar vehiculo"}
          description={vehiculoToToggle ? `Seguro que deseas ${statusAction} el vehiculo "${vehiculoToToggle.placa}"?` : ""}
          warning={vehiculoToToggle?.estado === "ACTIVO"
            ? "Al desactivarlo, este vehiculo dejara de visualizarse en modulos operativos como servicios."
            : "Al activarlo, este vehiculo volvera a estar disponible en los demas modulos."}
          confirmLabel={vehiculoToToggle?.estado === "ACTIVO" ? "Desactivar vehiculo" : "Activar vehiculo"}
          loadingLabel={vehiculoToToggle?.estado === "ACTIVO" ? "Desactivando..." : "Activando..."}
          loading={savingId === vehiculoToToggle?.id}
          error={statusError}
          onClose={handleCloseStatusModal}
          onConfirm={handleConfirmToggleStatus}
        />
      ) : null}
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
