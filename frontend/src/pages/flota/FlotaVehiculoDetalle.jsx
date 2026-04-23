import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  Loader2,
  RotateCcw,
  Save,
  Shield,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPOS_DOC = ["SOAT", "REV_TEC_GENERAL", "REV_TEC_MATPEL", "TC_MATPEL", "TC_MERCANCIAS", "EXTINTOR"];
const TIPOS_DOC_LABELS = {
  SOAT: "SOAT",
  REV_TEC_GENERAL: "Revisión técnica general",
  REV_TEC_MATPEL: "Revisión técnica MATPEL",
  TC_MATPEL: "Tarjeta de circulación MATPEL",
  TC_MERCANCIAS: "Tarjeta de circulación mercancías",
  EXTINTOR: "Extintor",
};

const COMPONENTES_KM = ["MOTOR", "CORONA", "CAJA", "EMBRAGUE"];
const COMPONENTES_KM_LABELS = { MOTOR: "Motor", CORONA: "Corona", CAJA: "Caja", EMBRAGUE: "Embrague" };

const ESTADO_DOC_CFG = {
  VIGENTE:    { label: "Vigente",    color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle },
  POR_VENCER: { label: "Por vencer", color: "bg-amber-100 text-amber-800 border-amber-200",       icon: Clock },
  VENCIDO:    { label: "Vencido",    color: "bg-red-100 text-red-800 border-red-200",             icon: XCircle },
  SIN_FECHA:  { label: "Sin fecha",  color: "bg-slate-100 text-slate-500 border-slate-200",       icon: Shield },
};

const ESTADO_MANT_CFG = {
  VIGENTE:        { bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
  POR_VENCER:     { bar: "bg-amber-500",   badge: "bg-amber-100 text-amber-800" },
  VENCIDO:        { bar: "bg-red-500",     badge: "bg-red-100 text-red-800" },
  SIN_CONFIGURAR: { bar: "bg-slate-200",   badge: "bg-slate-100 text-slate-400" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toDateInputValue(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().split("T")[0];
}

// ── Formulario de documento ───────────────────────────────────────────────────

function DocForm({ doc, vehiculoId, onSaved, onCancel }) {
  const [fechaVencimiento, setFechaVencimiento] = useState(toDateInputValue(doc.fechaVencimiento));
  const [observacion, setObservacion] = useState(doc.observacion ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await api.put(`/flota/documentacion/${vehiculoId}/${doc.tipoDoc}`, {
        fechaVencimiento: fechaVencimiento || null,
        observacion: observacion.trim() || null,
      });
      onSaved(result);
    } catch (err) {
      setError(err.message || "No se pudo guardar el documento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Nueva fecha de vencimiento</span>
          <input
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Observación</span>
          <input
            type="text"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            disabled={saving}
            maxLength={500}
            placeholder="En trámite, pendiente de entrega..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Guardar
        </button>
      </div>
    </form>
  );
}

// ── Fila de documento ──────────────────────────────────────────────────────────

function DocRow({ doc, vehiculoId, onDocActualizado }) {
  const [editando, setEditando] = useState(false);
  const cfg = ESTADO_DOC_CFG[doc.estadoDoc] ?? ESTADO_DOC_CFG.SIN_FECHA;
  const Icon = cfg.icon;

  function handleSaved(updated) {
    setEditando(false);
    onDocActualizado(updated);
  }

  return (
    <div className={`rounded-xl border p-4 ${editando ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900">{doc.label}</p>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
              <Icon className="h-3 w-3" />
              {cfg.label}
              {doc.diasRestantes !== null && (
                <span className="ml-0.5">
                  ({doc.diasRestantes > 0 ? `${doc.diasRestantes}d restantes` : `${Math.abs(doc.diasRestantes)}d vencido`})
                </span>
              )}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>
              <Calendar className="inline h-3 w-3 mr-1" />
              Vence: <strong className="text-slate-700">{formatFecha(doc.fechaVencimiento)}</strong>
            </span>
            {doc.fechaAnterior && (
              <span>
                Anterior: <strong className="text-slate-700">{formatFecha(doc.fechaAnterior)}</strong>
              </span>
            )}
            {doc.observacion && (
              <span className="italic text-slate-400">{doc.observacion}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setEditando((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
        >
          {editando ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {editando ? "Cancelar" : "Editar"}
        </button>
      </div>
      {editando && (
        <DocForm
          doc={doc}
          vehiculoId={vehiculoId}
          onSaved={handleSaved}
          onCancel={() => setEditando(false)}
        />
      )}
    </div>
  );
}

// ── Formulario de componente ───────────────────────────────────────────────────

function ComponenteForm({ comp, vehiculoId, onSaved, onCancel }) {
  const [kmPermitido, setKmPermitido] = useState(comp.kmPermitido > 0 ? String(comp.kmPermitido) : "");
  const [rendimientoEstandar, setRendimientoEstandar] = useState(
    comp.rendimientoEstandar > 0 ? String(comp.rendimientoEstandar) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {};
      if (kmPermitido !== "") body.kmPermitido = Number(kmPermitido);
      if (rendimientoEstandar !== "") body.rendimientoEstandar = Number(rendimientoEstandar);
      const result = await api.put(`/flota/mantenimiento/${vehiculoId}/${comp.componente}`, body);
      onSaved(result);
    } catch (err) {
      setError(err.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Km permitido para cambio</span>
          <input
            type="number"
            min="0"
            step="1"
            value={kmPermitido}
            onChange={(e) => setKmPermitido(e.target.value)}
            disabled={saving}
            placeholder="Ej: 10000"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Rendimiento estándar (km/gal)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={rendimientoEstandar}
            onChange={(e) => setRendimientoEstandar(e.target.value)}
            disabled={saving}
            placeholder="Ej: 6.5"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Guardar
        </button>
      </div>
    </form>
  );
}

// ── Fila de componente ─────────────────────────────────────────────────────────

function ComponenteRow({ comp, vehiculoId, onActualizado }) {
  const [editando, setEditando] = useState(false);
  const [reseteando, setReseteando] = useState(false);
  const [errorReset, setErrorReset] = useState("");
  const cfg = ESTADO_MANT_CFG[comp.estadoMantenimiento] ?? ESTADO_MANT_CFG.SIN_CONFIGURAR;
  const pct = Math.min(100, comp.porcentajeUso);

  async function handleReset() {
    if (!window.confirm(`¿Confirmar reset de kilómetros acumulados para ${comp.label}? Esta acción no se puede deshacer.`)) return;
    setReseteando(true);
    setErrorReset("");
    try {
      const result = await api.post(`/flota/mantenimiento/${vehiculoId}/${comp.componente}/reset`, {});
      onActualizado(result);
    } catch (err) {
      setErrorReset(err.message || "No se pudo resetear.");
    } finally {
      setReseteando(false);
    }
  }

  function handleSaved(updated) {
    setEditando(false);
    onActualizado(updated);
  }

  return (
    <div className={`rounded-xl border p-4 ${editando ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900">{comp.label}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
              <Gauge className="h-3 w-3" />
              {comp.estadoMantenimiento === "SIN_CONFIGURAR" ? "Sin configurar" : `${comp.porcentajeUso.toFixed(0)}%`}
            </span>
          </div>

          {comp.kmPermitido > 0 && (
            <div className="mt-3">
              <div className="h-2.5 w-full rounded-full bg-slate-100">
                <div className={`h-2.5 rounded-full transition-all ${cfg.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-slate-500">
                <span>Acumulado: <strong className="text-slate-700">{comp.kmAcumulado.toLocaleString()} km</strong></span>
                <span>Límite: <strong className="text-slate-700">{comp.kmPermitido.toLocaleString()} km</strong></span>
                {comp.kmRestantes !== null && (
                  <span>Restante: <strong className="text-slate-700">{comp.kmRestantes.toLocaleString()} km</strong></span>
                )}
                {comp.rendimientoEstandar > 0 && (
                  <span>Rendimiento estándar: <strong className="text-slate-700">{comp.rendimientoEstandar} km/gal</strong></span>
                )}
              </div>
            </div>
          )}

          {errorReset && (
            <p className="mt-2 text-xs text-red-600">{errorReset}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {comp.kmAcumulado > 0 && (
            <button
              onClick={handleReset}
              disabled={reseteando}
              title="Registrar mantenimiento — resetear km acumulado"
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {reseteando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Reset
            </button>
          )}
          <button
            onClick={() => setEditando((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {editando ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {editando ? "Cancelar" : "Configurar"}
          </button>
        </div>
      </div>

      {editando && (
        <ComponenteForm
          comp={comp}
          vehiculoId={vehiculoId}
          onSaved={handleSaved}
          onCancel={() => setEditando(false)}
        />
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FlotaVehiculoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [docData, setDocData] = useState(null);
  const [mantData, setMantData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [d, m] = await Promise.all([
        api.get(`/flota/documentacion/${id}`),
        api.get(`/flota/mantenimiento/${id}`),
      ]);
      setDocData(d);
      setMantData(m);
    } catch (err) {
      setError(err.message || "No se pudo cargar el vehículo.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  function handleDocActualizado(updated) {
    setDocData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documentos: prev.documentos.map((d) =>
          d.tipoDoc === updated.tipoDoc
            ? { ...d, ...updated }
            : d,
        ),
      };
    });
  }

  function handleComponenteActualizado(updated) {
    setMantData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        componentes: prev.componentes.map((c) =>
          c.componente === updated.componente ? { ...c, ...updated } : c,
        ),
      };
    });
  }

  const vehiculo = docData ?? mantData;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={() => navigate("/flota")} className="text-sm underline text-slate-500">
          Volver a flota
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => navigate("/flota")}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Control de Flota
          </button>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{vehiculo?.placa ?? "—"}</h1>
              {vehiculo?.placaCarreta && (
                <p className="text-sm text-slate-400">Carreta: {vehiculo.placaCarreta}</p>
              )}
              <p className="text-sm text-slate-500 mt-0.5">
                {vehiculo?.tipoUnidad} · {vehiculo?.tipo === "PROPIO" ? "Propio" : vehiculo?.propietario}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-6 py-6">
        {/* Documentación */}
        {docData && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Documentación legal</h2>
            <div className="space-y-3">
              {docData.documentos.map((doc) => (
                <DocRow
                  key={doc.tipoDoc}
                  doc={doc}
                  vehiculoId={id}
                  onDocActualizado={handleDocActualizado}
                />
              ))}
            </div>
          </section>
        )}

        {/* Mantenimiento — solo vehículos propios */}
        {mantData && mantData.tipo === "PROPIO" && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Mantenimiento por kilómetros</h2>
            <div className="space-y-3">
              {mantData.componentes.map((comp) => (
                <ComponenteRow
                  key={comp.componente}
                  comp={comp}
                  vehiculoId={id}
                  onActualizado={handleComponenteActualizado}
                />
              ))}
            </div>
          </section>
        )}

        {mantData && mantData.tipo !== "PROPIO" && (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center">
            <p className="text-sm text-slate-400">El mantenimiento por km aplica solo a vehículos propios.</p>
          </div>
        )}
      </div>
    </div>
  );
}
