import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Gauge,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Constantes ────────────────────────────────────────────────────────────────

const TABS = ["documentacion", "mantenimiento", "alertas"];
const TAB_LABELS = {
  documentacion: "Documentación",
  mantenimiento: "Mantenimiento km",
  alertas: "Alertas",
};

const ESTADO_DOC_CFG = {
  VIGENTE:    { label: "Vigente",      color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  POR_VENCER: { label: "Por vencer",   color: "bg-amber-100 text-amber-800",     icon: Clock },
  VENCIDO:    { label: "Vencido",      color: "bg-red-100 text-red-800",         icon: XCircle },
  SIN_FECHA:  { label: "Sin fecha",    color: "bg-slate-100 text-slate-500",     icon: Shield },
};

const ESTADO_MANT_CFG = {
  VIGENTE:        { bar: "bg-emerald-500", text: "text-emerald-700" },
  POR_VENCER:     { bar: "bg-amber-500",   text: "text-amber-700" },
  VENCIDO:        { bar: "bg-red-500",     text: "text-red-700" },
  SIN_CONFIGURAR: { bar: "bg-slate-300",   text: "text-slate-400" },
};

// ── Helpers UI ────────────────────────────────────────────────────────────────

function DocBadge({ doc }) {
  const cfg = ESTADO_DOC_CFG[doc.estadoDoc] ?? ESTADO_DOC_CFG.SIN_FECHA;
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col items-center gap-1" title={doc.label}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
        <Icon className="h-3 w-3" />
        {doc.diasRestantes !== null
          ? doc.diasRestantes > 0
            ? `${doc.diasRestantes}d`
            : `${Math.abs(doc.diasRestantes)}d`
          : "—"}
      </span>
    </div>
  );
}

function BarraProgreso({ porcentaje, estado }) {
  const cfg = ESTADO_MANT_CFG[estado] ?? ESTADO_MANT_CFG.SIN_CONFIGURAR;
  const pct = Math.min(100, porcentaje);
  return (
    <div className="flex flex-col gap-1">
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all ${cfg.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold ${cfg.text}`}>{porcentaje.toFixed(0)}%</span>
    </div>
  );
}

function AlertaDot({ count }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

// ── Pestañas ──────────────────────────────────────────────────────────────────

function TabDocumentacion({ vehiculos, onVerDetalle }) {
  const TIPOS = ["SOAT", "REV_TEC_GENERAL", "REV_TEC_MATPEL", "TC_MATPEL", "TC_MERCANCIAS", "EXTINTOR"];
  const TIPO_LABELS = {
    SOAT: "SOAT",
    REV_TEC_GENERAL: "Rev. Tec. Gral.",
    REV_TEC_MATPEL: "Rev. Tec. MATPEL",
    TC_MATPEL: "TC MATPEL",
    TC_MERCANCIAS: "TC Mercancías",
    EXTINTOR: "Extintor",
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vehículo
            </th>
            {TIPOS.map((t) => (
              <th key={t} className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {TIPO_LABELS[t]}
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vehiculos.map((v) => {
            const docMap = Object.fromEntries(v.documentos.map((d) => [d.tipoDoc, d]));
            return (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="font-semibold text-slate-900">{v.placa}</p>
                  {v.placaCarreta && <p className="text-xs text-slate-400">{v.placaCarreta}</p>}
                  <p className="text-xs text-slate-400">{v.tipoUnidad}</p>
                </td>
                {TIPOS.map((tipoDoc) => (
                  <td key={tipoDoc} className="px-3 py-3 text-center">
                    <DocBadge doc={docMap[tipoDoc] ?? { estadoDoc: "SIN_FECHA", diasRestantes: null, label: TIPO_LABELS[tipoDoc] }} />
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onVerDetalle(v.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Gestionar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {vehiculos.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No hay vehículos activos.</p>
      )}
    </div>
  );
}

function TabMantenimiento({ vehiculos, onVerDetalle }) {
  const COMP_LABELS = { MOTOR: "Motor", CORONA: "Corona", CAJA: "Caja", EMBRAGUE: "Embrague" };
  const COMPS = ["MOTOR", "CORONA", "CAJA", "EMBRAGUE"];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vehículo
            </th>
            {COMPS.map((c) => (
              <th key={c} className="min-w-[120px] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {COMP_LABELS[c]}
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vehiculos.map((v) => {
            const compMap = Object.fromEntries(v.componentes.map((c) => [c.componente, c]));
            return (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="font-semibold text-slate-900">{v.placa}</p>
                  <p className="text-xs text-slate-400">{v.tipoUnidad}</p>
                </td>
                {COMPS.map((comp) => {
                  const c = compMap[comp];
                  if (!c) return <td key={comp} className="px-4 py-3 text-xs text-slate-300">—</td>;
                  return (
                    <td key={comp} className="px-4 py-3">
                      {c.kmPermitido > 0 ? (
                        <BarraProgreso porcentaje={c.porcentajeUso} estado={c.estadoMantenimiento} />
                      ) : (
                        <span className="text-xs text-slate-300">Sin config.</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onVerDetalle(v.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Gestionar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {vehiculos.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No hay vehículos propios activos.</p>
      )}
    </div>
  );
}

function TabAlertas({ alertas, onVerDetalle }) {
  const { docs = [], mantenimientos = [] } = alertas ?? {};
  const total = docs.length + mantenimientos.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckCircle className="h-10 w-10 text-emerald-400" />
        <p className="text-sm font-medium text-slate-600">Sin alertas activas.</p>
        <p className="text-xs text-slate-400">Todos los documentos están vigentes y los componentes dentro del límite.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2">
      {docs.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Documentos vencidos o por vencer — {docs.length}
          </h3>
          <div className="space-y-2">
            {docs.map((d, i) => {
              const cfg = ESTADO_DOC_CFG[d.estadoDoc] ?? ESTADO_DOC_CFG.SIN_FECHA;
              const Icon = cfg.icon;
              return (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {d.estadoDoc === "VENCIDO" ? "Vencido" : `${d.diasRestantes}d`}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{d.placa}</p>
                      <p className="text-xs text-slate-500">{d.label}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onVerDetalle(d.vehiculoId)}
                    className="text-xs text-slate-400 hover:text-slate-700 underline"
                  >
                    Gestionar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {mantenimientos.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Componentes en límite — {mantenimientos.length}
          </h3>
          <div className="space-y-2">
            {mantenimientos.map((m, i) => {
              const cfg = ESTADO_MANT_CFG[m.estadoMantenimiento] ?? ESTADO_MANT_CFG.SIN_CONFIGURAR;
              return (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                      <Gauge className={`h-4 w-4 ${cfg.text}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{m.placa}</p>
                      <p className="text-xs text-slate-500">{m.label} — {m.porcentajeUso.toFixed(0)}% usado</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onVerDetalle(m.vehiculoId)}
                    className="text-xs text-slate-400 hover:text-slate-700 underline"
                  >
                    Gestionar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FlotaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("documentacion");
  const [docs, setDocs] = useState([]);
  const [mant, setMant] = useState([]);
  const [alertas, setAlertas] = useState({ docs: [], mantenimientos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [d, m, a] = await Promise.all([
        api.get("/flota/documentacion"),
        api.get("/flota/mantenimiento"),
        api.get("/flota/alertas"),
      ]);
      setDocs(Array.isArray(d) ? d : []);
      setMant(Array.isArray(m) ? m : []);
      setAlertas(a ?? { docs: [], mantenimientos: [] });
    } catch (err) {
      setError(err.message || "No se pudieron cargar los datos de flota.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  const totalAlertas = (alertas.docs?.length ?? 0) + (alertas.mantenimientos?.length ?? 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Control de Flota</h1>
            <p className="mt-1 text-sm text-slate-500">
              Documentos legales y mantenimiento por kilómetros de todos los vehículos
            </p>
          </div>
          <button
            onClick={cargar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === t
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {TAB_LABELS[t]}
              {t === "alertas" && <AlertaDot count={totalAlertas} />}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {tab === "documentacion" && (
              <TabDocumentacion vehiculos={docs} onVerDetalle={(id) => navigate(`/flota/${id}`)} />
            )}
            {tab === "mantenimiento" && (
              <TabMantenimiento vehiculos={mant} onVerDetalle={(id) => navigate(`/flota/${id}`)} />
            )}
            {tab === "alertas" && (
              <div className="p-4">
                <TabAlertas alertas={alertas} onVerDetalle={(id) => navigate(`/flota/${id}`)} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
