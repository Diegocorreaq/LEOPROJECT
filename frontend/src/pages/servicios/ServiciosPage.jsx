import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Plus,
  Receipt,
  Search,
  X,
  Truck,
  MapPin,
  User,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import ListSummary from "@/components/ui/ListSummary";

const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function normalizeEstadoServicio(estado) {
  return estado === "COMPLETADO" ? "FINALIZADO" : estado;
}

const ESTADO_CFG = {
  PROGRAMADO: { 
    label: "Programado", 
    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" 
  },
  EN_TRANSITO: { 
    label: "En tránsito", 
    cls: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20" 
  },
  FINALIZADO: { 
    label: "Finalizado", 
    cls: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/10" 
  },
  COMPLETADO: { 
    label: "Finalizado", 
    cls: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/10" 
  },
  CANCELADO: { 
    label: "Cancelado", 
    cls: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20" 
  },
};

const TIPO_CFG = {
  PROPIO: { 
    label: "Propio", 
    cls: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20" 
  },
  SUBCONTRATADO: { 
    label: "Tercero", 
    cls: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20" 
  },
};

const TABS = [
  { key: "TODOS", label: "Todos" },
  { key: "PROGRAMADO", label: "Programado" },
  { key: "EN_TRANSITO", label: "En tránsito" },
  { key: "FINALIZADO", label: "Finalizado" },
  { key: "OBS", label: "Con obs." },
];

function fechaCorta(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MESES_CORTO[d.getUTCMonth()]}`;
}

function fechaLarga(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MESES_CORTO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function getTipo(servicio) {
  return servicio.vehiculo?.tipo === "SUBCONTRATADO" ? "SUBCONTRATADO" : "PROPIO";
}

function primerCliente(servicio) {
  return servicio.clientes?.[0]?.cliente?.razonSocial ?? "-";
}

export default function ServiciosPage() {
  const navigate = useNavigate();
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    let active = true;

    api
      .get("/servicios")
      .then((data) => {
        if (active) {
          setServicios(data);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const countMesActual = useMemo(() => {
    const now = new Date();
    return servicios.filter((servicio) => {
      const date = new Date(servicio.fechaServicio);
      return date.getUTCFullYear() === now.getFullYear() && date.getUTCMonth() === now.getMonth();
    }).length;
  }, [servicios]);

  const filtered = useMemo(() => {
    return servicios.filter((servicio) => {
      const estado = normalizeEstadoServicio(servicio.estado);
      const date = new Date(servicio.fechaServicio);
      if (date.getUTCFullYear() !== mes.year || date.getUTCMonth() !== mes.month) return false;
      if (tab === "OBS" && !servicio.observaciones?.trim()) return false;
      if (tab !== "TODOS" && tab !== "OBS" && estado !== tab) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const placa = servicio.vehiculo?.placa?.toLowerCase() ?? "";
        const clientes = servicio.clientes?.map((item) => item.cliente.razonSocial.toLowerCase()).join(" ") ?? "";
        const ruta = `${servicio.origen} ${servicio.destino}`.toLowerCase();

        if (!placa.includes(query) && !clientes.includes(query) && !ruta.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [mes, search, servicios, tab]);

  const mesTotal = useMemo(() => {
    return servicios.filter((servicio) => {
      const date = new Date(servicio.fechaServicio);
      return date.getUTCFullYear() === mes.year && date.getUTCMonth() === mes.month;
    }).length;
  }, [mes, servicios]);

  function prevMes() {
    setMes((current) =>
      current.month === 0
        ? { year: current.year - 1, month: 11 }
        : { ...current, month: current.month - 1 },
    );
  }

  function nextMes() {
    setMes((current) =>
      current.month === 11
        ? { year: current.year + 1, month: 0 }
        : { ...current, month: current.month + 1 },
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      {/* Header principal */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-lg">
                <Truck className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Servicios</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Gestión de servicios de transporte
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
                <span className="text-2xl font-bold text-slate-900">{countMesActual}</span>
                <span className="text-sm text-slate-500">este mes</span>
              </div>
              <Button onClick={() => navigate("/servicios/nuevo")} className="gap-2 h-10 px-4 bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/10">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo servicio</span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Barra de filtros */}
        <div className="px-4 pb-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Búsqueda y tabs */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar placa, cliente, ruta..."
                  className="h-10 w-full pl-10 pr-4 text-sm bg-slate-50 border-slate-200 focus:bg-white sm:w-72"
                />
              </div>
              
              {/* Tabs - scroll horizontal en móvil */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
                {TABS.map((tabItem) => (
                  <button
                    key={tabItem.key}
                    onClick={() => setTab(tabItem.key)}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      tab === tabItem.key
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    {tabItem.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Navegación de mes */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <button
                onClick={prevMes}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700 capitalize">
                  {MESES_LARGO[mes.month]} {mes.year}
                </span>
              </div>
              <button
                onClick={nextMes}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Resumen de registros */}
        <div className="flex items-center justify-end border-t border-slate-100 px-4 py-1.5 sm:px-6 lg:px-8">
          <ListSummary
            total={filtered.length}
            grandTotal={mesTotal}
            noun="servicio"
            nounPlural="servicios"
          />
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-700" />
                <p className="text-sm text-slate-500">Cargando servicios...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Truck className="h-8 w-8 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-slate-700">No hay servicios</p>
                <p className="mt-1 text-sm text-slate-500">No se encontraron servicios para los filtros seleccionados</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate("/servicios/nuevo")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Crear nuevo servicio
              </Button>
            </div>
          ) : (
            <>
              {/* ── Cards móvil (< md) ── */}
              <div className="divide-y divide-slate-200 md:hidden">
                {filtered.map((servicio) => {
                  const tipo     = getTipo(servicio);
                  const tipoCfg  = TIPO_CFG[tipo];
                  const estado   = normalizeEstadoServicio(servicio.estado);
                  const estadoCfg = ESTADO_CFG[estado] ?? { label: estado, cls: "" };
                  const isActive = selected?.id === servicio.id;

                  return (
                    <div
                      key={servicio.id}
                      onClick={() => setSelected(isActive ? null : servicio)}
                      className={cn(
                        "cursor-pointer bg-white px-4 py-4 transition-colors active:bg-slate-50",
                        isActive && "bg-blue-50 border-l-4 border-l-blue-500"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-blue-600">{servicio.codigo}</span>
                            <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", estadoCfg.cls)}>
                              {estadoCfg.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 truncate">{primerCliente(servicio)}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-600">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{servicio.origen}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{servicio.destino}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900">{servicio.vehiculo?.placa ?? "-"}</p>
                          <div className="flex items-center justify-end gap-2 mt-1">
                            <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", tipoCfg.cls)}>
                              {tipoCfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{fechaCorta(servicio.fechaServicio)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Tabla desktop (md+) ── */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["# Servicio", "Fecha", "Cliente (pagador)", "Ruta", "Unidad", "Tipo", "Estado"].map(
                        (heading) => (
                          <th key={heading} className="px-4 lg:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filtered.map((servicio) => {
                      const tipo     = getTipo(servicio);
                      const tipoCfg  = TIPO_CFG[tipo];
                      const estado   = normalizeEstadoServicio(servicio.estado);
                      const estadoCfg = ESTADO_CFG[estado] ?? { label: estado, cls: "" };
                      const isActive = selected?.id === servicio.id;

                      return (
                        <tr
                          key={servicio.id}
                          onClick={() => setSelected(isActive ? null : servicio)}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-slate-50",
                            isActive && "bg-blue-50 hover:bg-blue-50 ring-1 ring-inset ring-blue-200",
                          )}
                        >
                          <td className="px-4 lg:px-6 py-4 text-sm font-semibold text-blue-600">{servicio.codigo}</td>
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {fechaCorta(servicio.fechaServicio)}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <p className="text-sm font-medium text-slate-900 max-w-[200px] truncate">{primerCliente(servicio)}</p>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600 max-w-[200px]">
                              <span className="truncate">{servicio.origen}</span>
                              <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{servicio.destino}</span>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <span className="text-sm font-semibold text-slate-900">
                              {servicio.vehiculo?.placa ?? "-"}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", tipoCfg.cls)}>
                              {tipoCfg.label}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", estadoCfg.cls)}>
                              {estadoCfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Panel de detalle */}
        {selected && (
          <div className="fixed inset-0 z-40 bg-white md:relative md:inset-auto md:z-auto md:w-96 md:shrink-0 md:border-l md:border-slate-200 md:shadow-lg">
            <DetailPanel servicio={selected} onClose={() => setSelected(null)} navigate={navigate} />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ servicio, onClose, navigate }) {
  const tipo = getTipo(servicio);
  const tipoCfg = TIPO_CFG[tipo];
  const estado = normalizeEstadoServicio(servicio.estado);
  const estadoCfg = ESTADO_CFG[estado] ?? { label: estado, cls: "" };
  const conductorNombre = servicio.conductor
    ? [
        servicio.conductor.nombre,
        servicio.conductor.apPaterno,
        servicio.conductor.apMaterno ? `${servicio.conductor.apMaterno.charAt(0)}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "-";
  const liquidacionRoute = servicio.liquidacion
    ? `/liquidaciones?action=editar&liquidacionId=${servicio.liquidacion.id}`
    : `/liquidaciones?action=nueva&servicioId=${servicio.id}`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header del panel */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <span className="text-base font-bold text-slate-900">{servicio.codigo}</span>
            <p className="text-xs text-slate-500">Detalle del servicio</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Contenido scrolleable */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 px-5 py-5">
          {/* Servicio */}
          <Section label="Servicio" icon={<ClipboardList className="h-4 w-4" />}>
            <Row label="Fecha" value={fechaLarga(servicio.fechaServicio)} />
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-500">Estado</span>
              <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", estadoCfg.cls)}>
                {estadoCfg.label}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-500">Tipo contrato</span>
              <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", tipoCfg.cls)}>
                {tipoCfg.label}
              </span>
            </div>
          </Section>

          {/* Ruta */}
          <Section label="Ruta" icon={<MapPin className="h-4 w-4" />}>
            <Row label="Origen" value={servicio.origen} />
            <Row label="Destino" value={servicio.destino} />
            {servicio.orden?.rutaTarifa && (
              <Row label="Tarifa aplicada" value={<span className="font-semibold text-amber-600">30 tn</span>} />
            )}
          </Section>

          {/* Unidad y conductor */}
          <Section label="Unidad y conductor" icon={<Truck className="h-4 w-4" />}>
            <Row label="Vehículo" value={<span className="font-semibold">{servicio.vehiculo?.placa ?? "-"}</span>} />
            {servicio.vehiculo?.placaCarreta && <Row label="Carreta" value={servicio.vehiculo.placaCarreta} />}
            <Row label="Conductor" value={conductorNombre} />
          </Section>

          {/* Clientes */}
          {servicio.clientes?.length > 0 && (
            <Section label="Clientes vinculados" icon={<User className="h-4 w-4" />}>
              {servicio.clientes.map((item, index) => (
                <Row
                  key={item.id}
                  label={index === 0 ? "Remitente" : index === 1 ? "Destinatario" : `Cliente ${index + 1}`}
                  value={item.cliente.razonSocial}
                />
              ))}
            </Section>
          )}

          {/* Documentos */}
          {(servicio.guias?.length > 0 || servicio.liquidacion || servicio.orden) && (
            <Section label="Documentos" icon={<FileText className="h-4 w-4" />}>
              {servicio.guias?.length > 0 && (
                <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-slate-50">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-700">
                    {servicio.guias.length} guía{servicio.guias.length > 1 ? "s" : ""} de remisión
                  </span>
                </div>
              )}
              {servicio.liquidacion && (
                <button
                  type="button"
                  onClick={() => navigate(liquidacionRoute)}
                  className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-slate-50 w-full text-left hover:bg-slate-100 transition-colors"
                >
                  <Receipt className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-700">
                    Liquidación · <span className="font-medium">{servicio.liquidacion.status}</span>
                  </span>
                </button>
              )}
              {servicio.orden && (
                <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-slate-50">
                  <ClipboardList className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-700">Orden de servicio</span>
                </div>
              )}
            </Section>
          )}

          {/* Observaciones */}
          {servicio.observaciones && (
            <Section label="Observaciones">
              <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {servicio.observaciones}
              </p>
            </Section>
          )}
        </div>
      </div>

      {/* Acciones fijas */}
      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 space-y-2">
        <Button
          onClick={() => navigate(liquidacionRoute)}
          variant="outline"
          className="w-full h-10 font-medium"
        >
          <Receipt className="h-4 w-4 mr-2" />
          {servicio.liquidacion ? "Editar liquidación" : "Registrar liquidación"}
        </Button>
        <Button
          onClick={() => navigate(`/servicios/${servicio.id}/editar`)}
          className="w-full h-10 font-medium bg-slate-900 hover:bg-slate-800"
        >
          Editar servicio
        </Button>
      </div>
    </div>
  );
}

function Section({ label, icon, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-slate-400">{icon}</span>}
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <div className="space-y-2 pl-6">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-900 font-medium">{value}</span>
    </div>
  );
}
