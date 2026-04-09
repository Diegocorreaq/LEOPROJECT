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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

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
  PROGRAMADO: { label: "Programado", cls: "border border-emerald-200 bg-emerald-50 text-emerald-700" },
  EN_TRANSITO: { label: "En transito", cls: "border border-blue-200 bg-blue-50 text-blue-700" },
  FINALIZADO: { label: "Finalizado", cls: "border border-green-300 bg-green-100 text-green-800" },
  COMPLETADO: { label: "Finalizado", cls: "border border-green-300 bg-green-100 text-green-800" },
  CANCELADO: { label: "Cancelado", cls: "border border-red-200 bg-red-50 text-red-600" },
};

const TIPO_CFG = {
  PROPIO: { label: "Propio", cls: "border border-violet-200 bg-violet-50 text-violet-700" },
  SUBCONTRATADO: { label: "Tercero", cls: "border border-orange-200 bg-orange-50 text-orange-600" },
};

const TABS = [
  { key: "TODOS", label: "Todos" },
  { key: "PROGRAMADO", label: "Programado" },
  { key: "EN_TRANSITO", label: "En transito" },
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
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Servicios</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {countMesActual} este mes
          </span>
        </div>
        <Button onClick={() => navigate("/servicios/nuevo")} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 border-b px-8 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar placa, cliente, ruta..."
              className="h-8 w-60 pl-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-0.5">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  tab === tabItem.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                )}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={prevMes}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm text-slate-600">
              Mes: {MESES_LARGO[mes.month]} {mes.year}
            </span>
          </div>
          <button
            onClick={nextMes}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-slate-400">
              <p className="text-sm">No hay servicios para mostrar</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/servicios/nuevo")}>
                + Nuevo servicio
              </Button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-slate-50">
                  {["# Servicio", "Fecha", "Cliente (pagador)", "Ruta", "Unidad", "Tipo", "Estado"].map(
                    (heading) => (
                      <th key={heading} className="px-4 py-2.5 text-xs font-semibold text-slate-500">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((servicio) => {
                  const tipo = getTipo(servicio);
                  const tipoCfg = TIPO_CFG[tipo];
                  const estado = normalizeEstadoServicio(servicio.estado);
                  const estadoCfg = ESTADO_CFG[estado] ?? { label: estado, cls: "" };
                  const isActive = selected?.id === servicio.id;

                  return (
                    <tr
                      key={servicio.id}
                      onClick={() => setSelected(isActive ? null : servicio)}
                      className={cn(
                        "cursor-pointer border-b transition-colors hover:bg-slate-50",
                        isActive && "bg-blue-50 hover:bg-blue-50",
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">{servicio.codigo}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{fechaCorta(servicio.fechaServicio)}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{primerCliente(servicio)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {servicio.origen} {"->"} {servicio.destino}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {servicio.vehiculo?.placa ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tipoCfg.cls)}>
                          {tipoCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", estadoCfg.cls)}>
                          {estadoCfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="w-80 shrink-0 overflow-y-auto border-l bg-white shadow-sm">
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
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <span className="font-semibold text-slate-900">{servicio.codigo}</span>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">
        <Section label="Servicio">
          <Row label="Fecha" value={fechaLarga(servicio.fechaServicio)} />
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Estado</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", estadoCfg.cls)}>
              {estadoCfg.label}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Tipo contrato</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tipoCfg.cls)}>
              {tipoCfg.label}
            </span>
          </div>
        </Section>

        <hr />

        <Section label="Ruta">
          <Row label="Origen" value={servicio.origen} />
          <Row label="Destino" value={servicio.destino} />
          {servicio.orden?.rutaTarifa && (
            <Row label="Tarifa aplicada" value={<span className="font-semibold text-amber-600">30 tn</span>} />
          )}
        </Section>

        <hr />

        <Section label="Unidad y conductor">
          <Row label="Vehiculo" value={<span className="font-medium">{servicio.vehiculo?.placa ?? "-"}</span>} />
          {servicio.vehiculo?.placaCarreta && <Row label="Carreta" value={servicio.vehiculo.placaCarreta} />}
          <Row label="Conductor" value={conductorNombre} />
        </Section>

        {servicio.clientes?.length > 0 && (
          <>
            <hr />
            <Section label="Clientes vinculados">
              {servicio.clientes.map((item, index) => (
                <Row
                  key={item.id}
                  label={index === 0 ? "Remitente" : index === 1 ? "Destinatario" : `Cliente ${index + 1}`}
                  value={item.cliente.razonSocial}
                />
              ))}
            </Section>
          </>
        )}

        {(servicio.guias?.length > 0 || servicio.liquidacion || servicio.orden) && (
          <>
            <hr />
            <Section label="Documentos">
              {servicio.guias?.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  {servicio.guias.length} guia{servicio.guias.length > 1 ? "s" : ""} de remision
                </div>
              )}
              {servicio.liquidacion && (
                <button
                  type="button"
                  onClick={() => navigate(liquidacionRoute)}
                  className="flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900"
                >
                  <Receipt className="h-3.5 w-3.5 text-slate-400" />
                  Liquidacion · {servicio.liquidacion.status}
                </button>
              )}
              {servicio.orden && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
                  Orden de servicio
                </div>
              )}
            </Section>
          </>
        )}

        {servicio.observaciones && (
          <>
            <hr />
            <Section label="Observaciones">
              <p className="text-sm text-slate-600">{servicio.observaciones}</p>
            </Section>
          </>
        )}
      </div>

      <div className="space-y-2 border-t px-5 py-4">
        <button
          onClick={() => navigate(liquidacionRoute)}
          className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {servicio.liquidacion ? "Editar liquidacion" : "Registrar liquidacion"}
        </button>
        <button
          onClick={() => navigate(`/servicios/${servicio.id}/editar`)}
          className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Editar servicio
        </button>
      </div>
    </div>
  );
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
      <span className="text-right text-sm text-slate-800">{value}</span>
    </div>
  );
}
