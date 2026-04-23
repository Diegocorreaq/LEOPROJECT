import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, Slash } from "lucide-react";
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
import ListSummary from "@/components/ui/ListSummary";
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

const LIMIT_OPTIONS = [25, 50, 100];

function getVisiblePages(page, totalPages) {
  const size = Math.min(5, totalPages);
  return Array.from({ length: size }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });
}

export default function VehiculosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";

  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("ALL");
  const [estado, setEstado] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [savingId, setSavingId] = useState("");
  const [vehiculoToToggle, setVehiculoToToggle] = useState(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [tipo, estado, limit]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search) params.set("texto", search);
    if (tipo !== "ALL") params.set("tipo", tipo);
    if (estado !== "ALL") params.set("estado", estado);

    api.getList(`/vehiculos?${params.toString()}`)
      .then(({ items, total: totalCount }) => {
        if (!active) return;
        setVehiculos(items);
        setTotal(totalCount);

        if (page > 1 && items.length === 0 && totalCount > 0) {
          setPage((current) => Math.max(1, current - 1));
        }
      })
      .catch((err) => {
        if (!active) return;
        setVehiculos([]);
        setTotal(0);
        setError(err.message || "No se pudieron cargar los vehiculos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search, tipo, estado, page, limit, refreshTick]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const stats = useMemo(() => ({
    total,
    mostrados: vehiculos.length,
    pagina: `${page}/${totalPages}`,
  }), [page, total, totalPages, vehiculos.length]);

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
      await api.put(`/vehiculos/${vehiculoToToggle.id}`, { estado: nextEstado });
      setFeedback(successMessage);
      setVehiculoToToggle(null);
      setRefreshTick((current) => current + 1);
    } catch (err) {
      setStatusError(err.message || "No se pudo actualizar el estado del vehiculo.");
    } finally {
      setSavingId("");
    }
  }

  const statusAction = vehiculoToToggle?.estado === "ACTIVO" ? "desactivar" : "activar";
  const visiblePages = getVisiblePages(page, totalPages);

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
        <StatCard label="Total filtrados" value={stats.total} />
        <StatCard label="Mostrados" value={stats.mostrados} />
        <StatCard label="Pagina" value={stats.pagina} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b px-8 py-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por placa, carreta, MTC o empresa"
            className="pl-9"
          />
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

        <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Por pagina" /></SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option} por pagina</SelectItem>)}
          </SelectContent>
        </Select>

        <ListSummary
          total={total}
          page={page}
          pageSize={limit}
          noun="vehiculo"
          nounPlural="vehiculos"
          className="ml-auto"
        />
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

      {!loading && total > 0 && (
        <div className="flex items-center justify-between border-t bg-white px-8 py-3">
          <span className="text-xs text-slate-400">Pag. {page} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {visiblePages.map((targetPage) => (
              <button
                key={targetPage}
                type="button"
                onClick={() => setPage(targetPage)}
                className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-medium ${
                  targetPage === page
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {targetPage}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
