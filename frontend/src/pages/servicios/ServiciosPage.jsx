import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Calendar, X, ChevronLeft, ChevronRight,
  FileText, Receipt, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ─── Constantes ──────────────────────────────────────────────────────────────

const MESES_CORTO = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESES_LARGO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const ESTADO_CFG = {
  PROGRAMADO:  { label: "Programado",  cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  EN_TRANSITO: { label: "En tránsito", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  COMPLETADO:  { label: "Completado",  cls: "bg-green-100 text-green-800 border border-green-300" },
  CANCELADO:   { label: "Cancelado",   cls: "bg-red-50 text-red-600 border border-red-200" },
};

const TIPO_CFG = {
  PROPIO:        { label: "Propio",  cls: "bg-violet-50 text-violet-700 border border-violet-200" },
  SUBCONTRATADO: { label: "Tercero", cls: "bg-orange-50 text-orange-600 border border-orange-200" },
};

const TABS = [
  { key: "TODOS",       label: "Todos" },
  { key: "PROGRAMADO",  label: "Programado" },
  { key: "EN_TRANSITO", label: "En tránsito" },
  { key: "COMPLETADO",  label: "Completado" },
  { key: "OBS",         label: "Con obs." },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return servicio.clientes?.[0]?.cliente?.razonSocial ?? "—";
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ServiciosPage() {
  const navigate = useNavigate();
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [tab, setTab]             = useState("TODOS");
  const [search, setSearch]       = useState("");
  const [mes, setMes]             = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  useEffect(() => {
    api.get("/servicios")
      .then(data => setServicios(data))
      .finally(() => setLoading(false));
  }, []);

  const countMesActual = useMemo(() => {
    const n = new Date();
    return servicios.filter(s => {
      const d = new Date(s.fechaServicio);
      return d.getUTCFullYear() === n.getFullYear() && d.getUTCMonth() === n.getMonth();
    }).length;
  }, [servicios]);

  const filtered = useMemo(() => {
    return servicios.filter(s => {
      const d = new Date(s.fechaServicio);
      if (d.getUTCFullYear() !== mes.year || d.getUTCMonth() !== mes.month) return false;
      if (tab === "OBS"   && !s.observaciones?.trim()) return false;
      if (tab !== "TODOS" && tab !== "OBS" && s.estado !== tab) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const placa     = s.vehiculo?.placa?.toLowerCase() ?? "";
        const clientes  = s.clientes?.map(c => c.cliente.razonSocial.toLowerCase()).join(" ") ?? "";
        const ruta      = `${s.origen} ${s.destino}`.toLowerCase();
        if (!placa.includes(q) && !clientes.includes(q) && !ruta.includes(q)) return false;
      }
      return true;
    });
  }, [servicios, tab, search, mes]);

  function prevMes() {
    setMes(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 });
  }
  function nextMes() {
    setMes(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 });
  }

  return (
    <div className="flex h-full flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────── */}
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

      {/* ── Filtros ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-b px-8 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar placa, cliente, ruta..."
              className="h-8 w-60 pl-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-0.5">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={prevMes} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm text-slate-600">
              Mes: {MESES_LARGO[mes.month]} {mes.year}
            </span>
          </div>
          <button onClick={nextMes} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Contenido ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Tabla */}
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
                  {["# Servicio","Fecha","Cliente (pagador)","Ruta","Unidad","Tipo","Estado"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const tipo      = getTipo(s);
                  const tipoCfg   = TIPO_CFG[tipo];
                  const estadoCfg = ESTADO_CFG[s.estado] ?? { label: s.estado, cls: "" };
                  const isActive  = selected?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(isActive ? null : s)}
                      className={cn(
                        "cursor-pointer border-b transition-colors hover:bg-slate-50",
                        isActive && "bg-blue-50 hover:bg-blue-50"
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">{s.codigo}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{fechaCorta(s.fechaServicio)}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{primerCliente(s)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.origen} → {s.destino}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{s.vehiculo?.placa ?? "—"}</td>
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

        {/* Panel detalle */}
        {selected && (
          <div className="w-80 shrink-0 overflow-y-auto border-l bg-white shadow-sm">
            <DetailPanel
              servicio={selected}
              onClose={() => setSelected(null)}
              navigate={navigate}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel de detalle ────────────────────────────────────────────────────────

function DetailPanel({ servicio, onClose, navigate }) {
  const tipo      = getTipo(servicio);
  const tipoCfg   = TIPO_CFG[tipo];
  const estadoCfg = ESTADO_CFG[servicio.estado] ?? { label: servicio.estado, cls: "" };
  const cond      = servicio.conductor;
  const conductorNombre = cond
    ? `${cond.nombre} ${cond.apPaterno}${cond.apMaterno ? " " + cond.apMaterno.charAt(0) + "." : ""}`
    : "—";

  return (
    <div className="flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <span className="font-semibold text-slate-900">{servicio.codigo}</span>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">

        {/* SERVICIO */}
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

        {/* RUTA */}
        <Section label="Ruta">
          <Row label="Origen"  value={servicio.origen} />
          <Row label="Destino" value={servicio.destino} />
          {servicio.orden?.rutaTarifa && (
            <Row
              label="Tarifa aplicada"
              value={<span className="font-semibold text-amber-600">30 tn</span>}
            />
          )}
        </Section>

        <hr />

        {/* UNIDAD Y CONDUCTOR */}
        <Section label="Unidad y conductor">
          <Row label="Vehículo"  value={<span className="font-medium">{servicio.vehiculo?.placa ?? "—"}</span>} />
          {servicio.vehiculo?.placaCarreta && (
            <Row label="Carreta" value={servicio.vehiculo.placaCarreta} />
          )}
          <Row label="Conductor" value={conductorNombre} />
        </Section>

        {servicio.clientes?.length > 0 && (
          <>
            <hr />
            <Section label="Clientes vinculados">
              {servicio.clientes.map((sc, i) => (
                <Row
                  key={sc.id}
                  label={i === 0 ? "Remitente" : i === 1 ? "Destinatario" : `Cliente ${i + 1}`}
                  value={sc.cliente.razonSocial}
                />
              ))}
            </Section>
          </>
        )}

        {/* Documentos */}
        {(servicio.guias?.length > 0 || servicio.liquidacion || servicio.orden) && (
          <>
            <hr />
            <Section label="Documentos">
              {servicio.guias?.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  {servicio.guias.length} guía{servicio.guias.length > 1 ? "s" : ""} de remisión
                </div>
              )}
              {servicio.liquidacion && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Receipt className="h-3.5 w-3.5 text-slate-400" />
                  Liquidación · {servicio.liquidacion.status}
                </div>
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

      {/* Acciones */}
      <div className="border-t px-5 py-4 space-y-2">
        {!servicio.liquidacion && (
          <button className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            Registrar liquidación
          </button>
        )}
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
