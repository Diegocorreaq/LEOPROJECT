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
import { api } from "@/lib/api";

const TIPO_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PROPIO", label: "Propios" },
  { value: "SUBCONTRATADO", label: "Subcontratados" },
];

const ESTADO_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "true", label: "Activos" },
  { value: "false", label: "Inactivos" },
];

function nombreCompleto(conductor) {
  return [conductor.nombre, conductor.apPaterno, conductor.apMaterno].filter(Boolean).join(" ");
}

export default function ConductoresPage() {
  const navigate = useNavigate();
  const [conductores, setConductores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("ALL");
  const [activo, setActivo] = useState("ALL");
  const [savingId, setSavingId] = useState("");
  const [conductorToToggle, setConductorToToggle] = useState(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("texto", search.trim());
      if (tipo !== "ALL") params.set("tipo", tipo);
      if (activo !== "ALL") params.set("activo", activo);
      const query = params.toString();

      api.get(`/conductores${query ? `?${query}` : ""}`)
        .then((data) => {
          if (active) setConductores(data);
        })
        .catch((err) => {
          if (active) setError(err.message || "No se pudieron cargar los conductores.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search, tipo, activo]);

  const stats = useMemo(() => ({
    total: conductores.length,
    activos: conductores.filter((conductor) => conductor.activo).length,
    terceros: conductores.filter((conductor) => conductor.tipo === "SUBCONTRATADO").length,
  }), [conductores]);

  function handleToggleStatusClick(conductor) {
    setConductorToToggle(conductor);
    setStatusError("");
    setFeedback("");
  }

  function handleCloseStatusModal() {
    if (savingId) return;
    setConductorToToggle(null);
    setStatusError("");
  }

  async function handleConfirmToggleStatus() {
    if (!conductorToToggle) return;

    const nextActivo = !conductorToToggle.activo;
    const successMessage = nextActivo
      ? "Conductor activado correctamente."
      : "Conductor desactivado correctamente.";

    setSavingId(conductorToToggle.id);
    setFeedback("");
    setStatusError("");

    try {
      const response = await api.put(`/conductores/${conductorToToggle.id}`, { activo: nextActivo });
      setConductores((current) => current.map((item) => item.id === conductorToToggle.id ? response : item));
      setFeedback(successMessage);
      setConductorToToggle(null);
    } catch (err) {
      setStatusError(err.message || "No se pudo actualizar el estado del conductor.");
    } finally {
      setSavingId("");
    }
  }

  const statusAction = conductorToToggle?.activo ? "desactivar" : "activar";

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Conductores</h1>
          <p className="text-sm text-slate-500">Administra personal propio y subcontratado disponible para operar.</p>
        </div>
        <Button onClick={() => navigate("/conductores/nuevo")}>
          <Plus className="h-4 w-4" />
          Nuevo conductor
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
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, documento, licencia o empresa" className="pl-9" />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPO_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activo} onValueChange={setActivo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ESTADO_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
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
        ) : conductores.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <p className="text-sm text-slate-500">No hay conductores para mostrar.</p>
            <Button variant="outline" onClick={() => navigate("/conductores/nuevo")}>Registrar conductor</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Conductor</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {conductores.map((conductor) => (
                  <tr key={conductor.id} className="border-t text-sm text-slate-700">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/conductores/${conductor.id}`)} className="text-left">
                        <div className="font-medium text-slate-900 hover:text-blue-600">{nombreCompleto(conductor)}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div>{conductor.tipoDocumento}</div>
                      <div className="font-mono text-xs text-slate-500">{conductor.nroDocumento}</div>
                    </td>
                    <td className="px-4 py-3">{conductor.tipo}</td>
                    <td className="px-4 py-3">{conductor.propietarioSubcontratado?.razonSocial || "Propio"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${conductor.activo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {conductor.activo ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <IconAction label="Ver" onClick={() => navigate(`/conductores/${conductor.id}`)} icon={<Eye className="h-4 w-4" />} />
                        <IconAction label="Editar" onClick={() => navigate(`/conductores/${conductor.id}/editar`)} icon={<Pencil className="h-4 w-4" />} />
                        <IconAction
                          label={savingId === conductor.id ? (conductor.activo ? "Desactivando..." : "Activando...") : conductor.activo ? "Desactivar" : "Activar"}
                          onClick={() => handleToggleStatusClick(conductor)}
                          disabled={savingId === conductor.id}
                          icon={<Slash className="h-4 w-4" />}
                        />
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
        open={Boolean(conductorToToggle)}
        title={conductorToToggle?.activo ? "Desactivar conductor" : "Activar conductor"}
        description={conductorToToggle ? `Seguro que deseas ${statusAction} al conductor "${nombreCompleto(conductorToToggle)}"?` : ""}
        warning={conductorToToggle?.activo
          ? "Al desactivarlo, este conductor dejara de visualizarse en modulos operativos como servicios."
          : "Al activarlo, este conductor volvera a estar disponible en los demas modulos."}
        confirmLabel={conductorToToggle?.activo ? "Desactivar conductor" : "Activar conductor"}
        loadingLabel={conductorToToggle?.activo ? "Desactivando..." : "Activando..."}
        loading={savingId === conductorToToggle?.id}
        error={statusError}
        onClose={handleCloseStatusModal}
        onConfirm={handleConfirmToggleStatus}
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
