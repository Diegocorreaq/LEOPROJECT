import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import ClienteBlock from "@/components/servicios/ClienteBlock";
import PlacaAutocomplete from "@/components/servicios/PlacaAutocomplete";
import ConductorAutocomplete from "@/components/servicios/ConductorAutocomplete";

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const ESTADOS = [
  { value: "PROGRAMADO",  label: "Programado" },
  { value: "EN_TRANSITO", label: "En tránsito" },
  { value: "COMPLETADO",  label: "Completado" },
  { value: "CANCELADO",   label: "Cancelado" },
];
const TIPOS_DOC = ["DNI", "CE", "RUC"];

function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str + "T12:00:00");
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// Cada bloque de cliente tiene un key único y su data confirmada (null = pendiente)
const mkBloque = () => ({ key: Date.now() + Math.random(), confirmed: null });

const INIT_FORM = {
  fechaServicio:  new Date().toISOString().split("T")[0],
  estado:         "PROGRAMADO",
  observaciones:  "",
  origen:         "",
  destino:        "",
  tipoContrato:   "PROPIO",
  vehiculoId:      "",
  conductorId:     "",
  _vehiculo:       null,      // objeto completo del vehículo seleccionado (propio)
  _conductor:      null,
  _placaText:      "",        // texto del input de placa principal (propio)
  _carretaText:    "",        // texto del input de placa carreta (propio)
  _conductorText:  "",        // texto del input de conductor (propio)
  sub: {
    empresa:   { ruc: "", razonSocial: "" },
    vehiculo:  { placa: "", placaCarreta: "", tipoUnidad: "" },
    conductor: { nombre: "", apPaterno: "", apMaterno: "", tipoDocumento: "DNI", nroDocumento: "" },
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NuevoServicioPage() {
  const navigate = useNavigate();

  const [form, setForm]     = useState(INIT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Lista de bloques de cliente (array de { key, confirmed })
  const [bloques, setBloques] = useState([mkBloque()]);

  // ── Helpers form ─────────────────────────────────────────────────────────────

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updSub = (sec, k, v) =>
    setForm(f => ({ ...f, sub: { ...f.sub, [sec]: { ...f.sub[sec], [k]: v } } }));

  function selVehiculo(veh) {
    setForm(f => ({
      ...f,
      vehiculoId:   veh?.id ?? "",
      _vehiculo:    veh,
      _placaText:   veh?.placa ?? "",
      _carretaText: veh?.placaCarreta ?? "",
    }));
  }

  function handlePlacaTextChange(text) {
    // Si el usuario escribe manualmente, limpiar selección
    setForm(f => ({
      ...f,
      _placaText:   text,
      vehiculoId:   "",
      _vehiculo:    null,
      _carretaText: "",
    }));
  }

  function selConductor(cond) {
    const nombreCompleto = [cond.nombre, cond.apPaterno, cond.apMaterno]
      .filter(Boolean)
      .join(" ");
    setForm(f => ({
      ...f,
      conductorId:    cond.id,
      _conductor:     cond,
      _conductorText: nombreCompleto,
    }));
  }

  function handleConductorTextChange(text) {
    setForm(f => ({
      ...f,
      _conductorText: text,
      conductorId:    "",
      _conductor:     null,
    }));
  }

  // ── Callbacks para ClienteBlock ───────────────────────────────────────────────

  const handleConfirmCliente = useCallback((key, data) => {
    setBloques(prev => prev.map(b => b.key === key ? { ...b, confirmed: data } : b));
  }, []);

  const handleUnconfirmCliente = useCallback((key) => {
    setBloques(prev => prev.map(b => b.key === key ? { ...b, confirmed: null } : b));
  }, []);

  const handleRemoveCliente = useCallback((key) => {
    setBloques(prev => prev.filter(b => b.key !== key));
  }, []);

  function handleAgregarCliente() {
    setBloques(prev => [...prev, mkBloque()]);
  }

  // ── Validación (checklist) ────────────────────────────────────────────────────

  const esPropio = form.tipoContrato === "PROPIO";
  const clientesConfirmados = bloques.filter(b => b.confirmed !== null);

  const checks = {
    fecha:     !!form.fechaServicio,
    ruta:      !!form.origen.trim() && !!form.destino.trim(),
    cliente:   clientesConfirmados.length > 0,
    contrato:  true,
    vehiculo:  esPropio ? !!form.vehiculoId : !!form.sub.vehiculo.placa.trim(),
    conductor: esPropio ? !!form.conductorId : (
      !!form.sub.conductor.nombre.trim() &&
      !!form.sub.conductor.apPaterno.trim() &&
      !!form.sub.conductor.nroDocumento.trim()
    ),
  };
  const allOk = Object.values(checks).every(Boolean);

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!allOk) return;
    setLoading(true);
    setError("");
    try {
      const clienteIds = clientesConfirmados.map(b => b.confirmed.clienteId);

      const payload = {
        fechaServicio: form.fechaServicio,
        origen:        form.origen,
        destino:       form.destino,
        estado:        form.estado,
        observaciones: form.observaciones || null,
        tipoContrato:  form.tipoContrato,
        clienteIds,
      };

      if (esPropio) {
        payload.vehiculoId  = form.vehiculoId;
        payload.conductorId = form.conductorId;
      } else {
        payload.subcontratado = form.sub;
      }

      await api.post("/servicios", payload);
      navigate("/servicios");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Datos para el resumen ─────────────────────────────────────────────────────

  const estadoLabel    = ESTADOS.find(e => e.value === form.estado)?.label ?? "";
  const placaResumen   = esPropio ? form._vehiculo?.placa          : form.sub.vehiculo.placa      || null;
  const carretaResumen = esPropio ? (form._carretaText || null)    : form.sub.vehiculo.placaCarreta || null;
  const tipoUResumen   = esPropio ? form._vehiculo?.tipoUnidad     : form.sub.vehiculo.tipoUnidad  || null;
  const condResumen    = esPropio
    ? (form._conductor ? `${form._conductor.nombre} ${form._conductor.apPaterno.charAt(0)}.` : null)
    : (form.sub.conductor.apPaterno
        ? `${form.sub.conductor.nombre} ${form.sub.conductor.apPaterno.charAt(0)}.`
        : null);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-slate-50">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate("/servicios")}
            className="flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Servicios
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">Nuevo servicio</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/servicios")}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!allOk || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar servicio
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 gap-6 overflow-auto px-8 py-6">

        {/* ── Formulario izquierda ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {/* Datos generales */}
          <FormCard title="Datos generales">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha del servicio" required>
                <Input type="date" value={form.fechaServicio}
                  onChange={e => upd("fechaServicio", e.target.value)} />
              </Field>
              <Field label="Estado" required>
                <Select value={form.estado} onValueChange={v => upd("estado", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Observaciones">
              <Textarea placeholder="Notas internas..." rows={3}
                value={form.observaciones} onChange={e => upd("observaciones", e.target.value)} />
            </Field>
          </FormCard>

          {/* Ruta */}
          <FormCard title="Ruta">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Origen" required>
                <Input placeholder="Ej. Callao, Lima" value={form.origen}
                  onChange={e => upd("origen", e.target.value)} />
              </Field>
              <Field label="Destino" required>
                <Input placeholder="Ej. Arequipa" value={form.destino}
                  onChange={e => upd("destino", e.target.value)} />
              </Field>
            </div>
          </FormCard>

          {/* Clientes */}
          <FormCard title="Clientes" subtitle="Uno o más · roles se definen en la guía">
            <div className="space-y-3">
              {bloques.map((bloque, i) => {
                // IDs confirmados en los OTROS bloques (para evitar duplicados)
                const disallowedIds = bloques
                  .filter(b => b.key !== bloque.key && b.confirmed?.clienteId)
                  .map(b => b.confirmed.clienteId);
                return (
                  <ClienteBlock
                    key={bloque.key}
                    index={i}
                    canRemove={bloques.length > 1}
                    disallowedIds={disallowedIds}
                    onConfirm={data => handleConfirmCliente(bloque.key, data)}
                    onUnconfirm={() => handleUnconfirmCliente(bloque.key)}
                    onRemove={() => handleRemoveCliente(bloque.key)}
                  />
                );
              })}
              <button
                type="button"
                onClick={handleAgregarCliente}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
              >
                <Plus className="h-4 w-4" />
                Agregar otro cliente
              </button>
            </div>
          </FormCard>

          {/* Unidad y conductor */}
          <FormCard title="Unidad y conductor">

            {/* Toggle tipo contrato */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tipo de contrato</p>
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {["PROPIO","SUBCONTRATADO"].map((t, idx) => (
                  <button key={t} type="button" onClick={() => upd("tipoContrato", t)}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-sm font-medium transition-all",
                      form.tipoContrato === t
                        ? idx === 0 ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}>
                    {idx === 0 ? "Propio" : "Subcontratado"}
                  </button>
                ))}
              </div>
            </div>

            {esPropio ? (
              <>
                {/* Vehículo propio — autocomplete */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Vehículo</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Placa vehículo" required>
                      <PlacaAutocomplete
                        value={form._placaText}
                        onChange={handlePlacaTextChange}
                        onSelect={selVehiculo}
                        placeholder="T3U-947"
                        soloPropio
                        mustSelect
                      />
                    </Field>
                    <Field label="Placa carreta">
                      <PlacaAutocomplete
                        value={form._carretaText}
                        onChange={text => setForm(f => ({ ...f, _carretaText: text }))}
                        onSelect={veh => setForm(f => ({ ...f, _carretaText: veh.placa }))}
                        placeholder="Z4H-018"
                        tipoUnidadFiltro="PLATAFORMA"
                      />
                    </Field>
                    <Field label="Tipo de unidad">
                      <Input
                        readOnly
                        value={form._vehiculo?.tipoUnidad ?? ""}
                        placeholder="—"
                        className="bg-slate-50 text-slate-500 font-medium"
                      />
                    </Field>
                  </div>
                  {form.vehiculoId && !form._vehiculo?.tipoUnidad && (
                    <p className="text-xs text-amber-600">⚠ El vehículo seleccionado no tiene tipo de unidad registrado.</p>
                  )}
                </div>

                {/* Conductor propio — autocomplete */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Conductor</p>
                  <Field label="Conductor" required>
                    <ConductorAutocomplete
                      value={form._conductorText}
                      onChange={handleConductorTextChange}
                      onSelect={selConductor}
                      placeholder="Buscar por nombre o documento..."
                      soloPropio
                      mustSelect
                    />
                    {form._conductor && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        {form._conductor.tipoDocumento} {form._conductor.nroDocumento}
                        {form._conductor.licencia ? ` · Lic. ${form._conductor.licencia}` : ""}
                      </p>
                    )}
                  </Field>
                </div>
              </>
            ) : (
              <>
                {/* Empresa */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Empresa</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="RUC empresa">
                      <Input maxLength={11} value={form.sub.empresa.ruc}
                        onChange={e => updSub("empresa", "ruc", e.target.value)} />
                    </Field>
                    <Field label="Razón social">
                      <Input value={form.sub.empresa.razonSocial}
                        onChange={e => updSub("empresa", "razonSocial", e.target.value)} />
                    </Field>
                  </div>
                </div>

                {/* Vehículo subcontratado */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Vehículo</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Placa" required>
                      <PlacaAutocomplete
                        value={form.sub.vehiculo.placa}
                        onChange={text => updSub("vehiculo", "placa", text)}
                        onSelect={veh => {
                          setForm(f => ({
                            ...f,
                            sub: {
                              ...f.sub,
                              vehiculo: {
                                ...f.sub.vehiculo,
                                placa:     veh.placa,
                                tipoUnidad: veh.tipoUnidad ?? f.sub.vehiculo.tipoUnidad,
                              },
                            },
                          }));
                        }}
                        placeholder="T3U-947"
                      />
                    </Field>
                    <Field label="Placa carreta">
                      <PlacaAutocomplete
                        value={form.sub.vehiculo.placaCarreta}
                        onChange={text => updSub("vehiculo", "placaCarreta", text)}
                        onSelect={veh => updSub("vehiculo", "placaCarreta", veh.placa)}
                        placeholder="Z4H-018"
                        tipoUnidadFiltro="PLATAFORMA"
                      />
                    </Field>
                    <Field label="Tipo unidad">
                      <Select
                        value={form.sub.vehiculo.tipoUnidad || undefined}
                        onValueChange={v => updSub("vehiculo", "tipoUnidad", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {["CAMION","TRACTO","FURGON","PLATAFORMA","VOLQUETE","CISTERNA","OTRO"].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>

                {/* Conductor subcontratado — sin campo licencia */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Conductor</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nombre" required>
                      <Input value={form.sub.conductor.nombre}
                        onChange={e => updSub("conductor", "nombre", e.target.value)} />
                    </Field>
                    <Field label="Ap. paterno" required>
                      <Input value={form.sub.conductor.apPaterno}
                        onChange={e => updSub("conductor", "apPaterno", e.target.value)} />
                    </Field>
                    <Field label="Ap. materno">
                      <Input value={form.sub.conductor.apMaterno}
                        onChange={e => updSub("conductor", "apMaterno", e.target.value)} />
                    </Field>
                    <Field label="Tipo documento">
                      <Select value={form.sub.conductor.tipoDocumento}
                        onValueChange={v => updSub("conductor", "tipoDocumento", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPOS_DOC.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Nro documento" required>
                      <Input value={form.sub.conductor.nroDocumento}
                        onChange={e => updSub("conductor", "nroDocumento", e.target.value)} />
                    </Field>
                  </div>
                </div>
              </>
            )}
          </FormCard>
        </div>

        {/* ── Panel derecho sticky ── */}
        <div className="w-72 shrink-0">
          <div className="sticky top-0 space-y-4">

            {/* Resumen */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">Resumen</h3>
              <div className="space-y-2.5 text-sm">
                <SRow label="Fecha"  value={fmtDate(form.fechaServicio)} />
                <SRow label="Estado" value={estadoLabel || "—"} />
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Contrato</span>
                  <span className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    esPropio ? "bg-violet-50 text-violet-700 border-violet-200"
                             : "bg-orange-50 text-orange-600 border-orange-200"
                  )}>
                    {esPropio ? "Propio" : "Tercero"}
                  </span>
                </div>
                <SRow label="Origen"  value={form.origen  || "—"} />
                <SRow label="Destino" value={form.destino || "—"} />
                {clientesConfirmados.length > 0 && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0 text-slate-500">Clientes</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {clientesConfirmados.map((b, i) => (
                        <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {b.confirmed.razonSocial}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {placaResumen   && <SRow label="Placa"       value={<b>{placaResumen}</b>} />}
                {carretaResumen && <SRow label="Carreta"     value={<b>{carretaResumen}</b>} />}
                {tipoUResumen   && <SRow label="Tipo unidad" value={tipoUResumen} />}
                {condResumen    && <SRow label="Conductor"   value={<b>{condResumen}</b>} />}
              </div>
            </div>

            {/* Checklist */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">Campos requeridos</h3>
              <div className="space-y-2.5">
                {[
                  { k: "fecha",     l: "Fecha" },
                  { k: "ruta",      l: "Origen y destino" },
                  { k: "cliente",   l: "Al menos un cliente confirmado" },
                  { k: "contrato",  l: "Tipo de contrato" },
                  { k: "vehiculo",  l: "Vehículo" },
                  { k: "conductor", l: "Conductor" },
                ].map(({ k, l }) => (
                  <div key={k} className="flex items-center gap-2.5">
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                      checks[k] ? "bg-emerald-500" : "bg-slate-200"
                    )}>
                      {checks[k] && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className={cn("text-sm transition-colors",
                      checks[k] ? "text-slate-700" : "text-slate-400")}>
                      {l}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function FormCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right text-slate-900">{value}</span>
    </div>
  );
}
