import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import GuiaStatusBadge, { VinculoBadge } from "./GuiaStatusBadge";
import GuiaDetailDrawer from "./GuiaDetailDrawer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fechaCorta(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" });
}

// Tamaño del drawer persistido en sesión
const DRAWER_SIZES = {
  compact: { cls: "w-72", label: "Compacto" },
  normal:  { cls: "w-[420px]", label: "Normal" },
  wide:    { cls: "w-[600px]", label: "Amplio" },
};

function getInitialDrawerSize() {
  try {
    const saved = localStorage.getItem("guia_drawer_size");
    if (saved && DRAWER_SIZES[saved]) return saved;
  } catch (_) {}
  return "normal";
}

// ── Tabs de filtro ─────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "TODOS",       label: "Todos" },
  { key: "EN_TRANSITO", label: "En tránsito" },
  { key: "RECIBIDA",    label: "Recibido" },
  { key: "VINCULADO",   label: "Vinculado" },
  { key: "NO_VINCULADO", label: "Sin vincular" },
];

const LIMIT_OPTIONS = [25, 50, 100];

// ── Componente principal ───────────────────────────────────────────────────────

export default function GuiaListTab({ refreshTrigger = 0 }) {
  // Datos
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  // Paginación
  const [page, setPage]   = useState(1);
  const [limit, setLimit] = useState(50);

  // Filtros
  const [activeTab, setActiveTab]   = useState("TODOS");
  const [textoInput, setTextoInput] = useState("");
  const [texto, setTexto]           = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // UI
  const [selected, setSelected]     = useState(null);
  const [drawerSize, setDrawerSize] = useState(getInitialDrawerSize);
  const [localFeedback, setLocalFeedback] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Debounce del texto
  useEffect(() => {
    const timer = setTimeout(() => {
      setTexto(textoInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [textoInput]);

  // Reset página al cambiar filtros (no texto — ese ya resetea arriba)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPage(1);
  }, [activeTab, fechaDesde, fechaHasta, limit]);

  // Fetch principal
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (texto) params.set("texto", texto);
    if (activeTab === "EN_TRANSITO")  params.set("estado", "EN_TRANSITO");
    if (activeTab === "RECIBIDA")     params.set("estado", "RECIBIDA");
    if (activeTab === "VINCULADO")    params.set("vinculo", "VINCULADO");
    if (activeTab === "NO_VINCULADO") params.set("vinculo", "NO_VINCULADO");
    if (fechaDesde) params.set("fechaEmisionDesde", fechaDesde);
    if (fechaHasta) params.set("fechaEmisionHasta", fechaHasta);

    api
      .getList(`/guias?${params.toString()}`)
      .then(({ items: rows, total: t }) => {
        if (cancelled) return;
        setItems(rows);
        setTotal(t);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Error al cargar las guías.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, limit, texto, activeTab, fechaDesde, fechaHasta, refreshTrigger]);

  // Handlers de UI
  function handleTabChange(tab) {
    setActiveTab(tab);
    setPage(1);
  }

  function handleLimitChange(newLimit) {
    setLimit(newLimit);
    setPage(1);
  }

  function handleDrawerSizeChange(size) {
    setDrawerSize(size);
    try { localStorage.setItem("guia_drawer_size", size); } catch (_) {}
  }

  // Actualizar item en lista cuando se edita/vincula/desvincula
  const handleGuiaUpdated = useCallback((updatedGuia) => {
    if (selected?.id === updatedGuia.id) {
      setSelected((prev) => ({ ...prev, ...updatedGuia }));
    }
    setItems((prev) =>
      prev.map((g) =>
        g.id === updatedGuia.id
          ? {
              ...g,
              estado: updatedGuia.estado ?? g.estado,
              servicioId: updatedGuia.servicioId,
              vinculoEstado: updatedGuia.servicioId ? "VINCULADO" : "NO_VINCULADO",
              servicio: updatedGuia.servicio ?? null,
            }
          : g,
      ),
    );
    if (updatedGuia?.message) {
      setLocalFeedback(updatedGuia.message);
      setTimeout(() => setLocalFeedback(""), 4000);
    }
  }, [selected?.id]);

  function handleGuiaDeleted(guiaId, message) {
    if (selected?.id === guiaId) setSelected(null);
    setItems((prev) => prev.filter((g) => g.id !== guiaId));
    if (message) {
      setLocalFeedback(message);
      setTimeout(() => setLocalFeedback(""), 4000);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Barra de filtros */}
      <div className="shrink-0 space-y-2 border-b px-4 py-3 sm:px-6">
        {/* Fila 1: búsqueda + fechas */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={textoInput}
              onChange={(e) => setTextoInput(e.target.value)}
              placeholder="Buscar número, placa, remitente, destinatario o guía remitente..."
              className="h-8 w-full pl-8 text-sm sm:w-80"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              title="Fecha de emisión desde"
            />
            <span className="text-xs text-slate-400">—</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              title="Fecha de emisión hasta"
            />
            {(fechaDesde || fechaHasta) && (
              <button
                onClick={() => { setFechaDesde(""); setFechaHasta(""); setPage(1); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Fila 2: tabs de estado + controles de paginación */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-0.5">
            {FILTER_TABS.map((item) => (
              <button
                key={item.key}
                onClick={() => handleTabChange(item.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  activeTab === item.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {total > 0 ? `${total} guía${total !== 1 ? "s" : ""}` : ""}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">Por página:</span>
              {LIMIT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleLimitChange(opt)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium",
                    limit === opt
                      ? "bg-slate-200 text-slate-800"
                      : "text-slate-400 hover:bg-slate-100",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback local */}
      {localFeedback && (
        <div className="shrink-0 border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 sm:px-6">
          {localFeedback}
        </div>
      )}

      {/* Cuerpo principal: tabla + drawer */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tabla + cards */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
              </div>
            ) : error ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
                <p className="text-sm">No hay guías para mostrar</p>
                {(texto || activeTab !== "TODOS" || fechaDesde || fechaHasta) && (
                  <button
                    onClick={() => {
                      setTextoInput("");
                      setTexto("");
                      setActiveTab("TODOS");
                      setFechaDesde("");
                      setFechaHasta("");
                      setPage(1);
                    }}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* ── Cards móvil (< md) ── */}
                <div className="divide-y md:hidden">
                  {items.map((g) => {
                    const isActive = selected?.id === g.id;
                    const ruta = [g.puntoDeSalida, g.puntoDeLlegada].filter(Boolean).join(" → ");
                    const rutaServicio =
                      g.servicio?.origen
                        ? `${g.servicio.origen} → ${g.servicio.destino}`
                        : ruta;

                    return (
                      <div
                        key={g.id}
                        onClick={() => setSelected(isActive ? null : g)}
                        className={cn(
                          "cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50",
                          isActive && "bg-blue-50 hover:bg-blue-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-blue-600">
                            {g.serie}-{g.numero}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <GuiaStatusBadge estado={g.estado} />
                            <VinculoBadge vinculado={g.servicioId != null} />
                          </div>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {fechaCorta(g.fechaEmision)}
                          {g.placaPrincipal && (
                            <span className="ml-2 font-medium text-slate-700">
                              · {g.placaPrincipal}
                              {g.placaSecundaria && (
                                <span className="text-slate-400"> / {g.placaSecundaria}</span>
                              )}
                            </span>
                          )}
                        </p>
                        {rutaServicio && (
                          <p className="mt-0.5 text-sm text-slate-600">{rutaServicio}</p>
                        )}
                        {(g.remitenteNombre || g.destinatarioNombre) && (
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {g.remitenteNombre}
                            {g.destinatarioNombre && ` → ${g.destinatarioNombre}`}
                          </p>
                        )}
                        {g.guiaRemitentePrincipal && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            Rem: {g.guiaRemitentePrincipal}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Tabla desktop (md+) ── */}
                <div className="hidden md:block">
                  <table className="w-full min-w-[700px] text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b bg-slate-50">
                        <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Guía</th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Fecha</th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Ruta / Servicio</th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Placa</th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Estado</th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Vínculo</th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Partes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((g) => {
                        const isActive = selected?.id === g.id;
                        const ruta = [g.puntoDeSalida, g.puntoDeLlegada].filter(Boolean).join(" → ");
                        const rutaServicio =
                          g.servicio?.origen
                            ? `${g.servicio.origen} → ${g.servicio.destino}`
                            : ruta;

                        return (
                          <tr
                            key={g.id}
                            onClick={() => setSelected(isActive ? null : g)}
                            className={cn(
                              "cursor-pointer border-b transition-colors hover:bg-slate-50",
                              isActive && "bg-blue-50 hover:bg-blue-50",
                            )}
                          >
                            <td className="px-4 py-3">
                              <span className="block text-sm font-semibold text-blue-600">
                                {g.serie}-{g.numero}
                              </span>
                              {g.guiaRemitentePrincipal && (
                                <span className="block text-xs text-slate-400">
                                  Rem: {g.guiaRemitentePrincipal}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500">
                              {fechaCorta(g.fechaEmision)}
                            </td>
                            <td className="px-4 py-3">
                              {rutaServicio ? (
                                <span className="text-sm text-slate-700">{rutaServicio}</span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                              {g.servicio?.clientes?.length > 0 && (
                                <span className="block text-xs text-slate-400">
                                  {g.servicio.clientes.map((c) => c.cliente.razonSocial).join(", ")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                              <span>{g.placaPrincipal ?? "-"}</span>
                              {g.placaSecundaria && (
                                <span className="ml-1 text-xs text-slate-400">
                                  / {g.placaSecundaria}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <GuiaStatusBadge estado={g.estado} />
                            </td>
                            <td className="px-4 py-3">
                              <VinculoBadge vinculado={g.servicioId != null} />
                            </td>
                            <td className="px-4 py-3">
                              {g.remitenteNombre && (
                                <span className="block max-w-[160px] truncate text-xs text-slate-600">
                                  {g.remitenteNombre}
                                </span>
                              )}
                              {g.destinatarioNombre && (
                                <span className="block max-w-[160px] truncate text-xs text-slate-400">
                                  → {g.destinatarioNombre}
                                </span>
                              )}
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

          {/* Paginación */}
          {!loading && total > 0 && (
            <div className="flex shrink-0 items-center justify-between border-t bg-white px-4 py-2 sm:px-6">
              <span className="text-xs text-slate-500">
                Pág. {page}/{totalPages} · {total} guía{total !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded border text-xs font-medium",
                        p === page
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer de detalle — full screen en mobile, lateral en desktop */}
        {selected && (
          <div
            className={cn(
              "overflow-y-auto bg-white shadow-sm",
              "fixed inset-0 z-40",
              "md:relative md:inset-auto md:z-auto md:border-l md:transition-[width] md:duration-200",
              drawerSize === "compact" ? "md:w-72" :
              drawerSize === "wide"    ? "md:w-[600px]" :
                                         "md:w-[420px]",
            )}
          >
            <GuiaDetailDrawer
              guia={selected}
              drawerSize={drawerSize}
              onDrawerSizeChange={handleDrawerSizeChange}
              onClose={() => setSelected(null)}
              onUpdated={handleGuiaUpdated}
              onDeleted={handleGuiaDeleted}
            />
          </div>
        )}
      </div>
    </div>
  );
}
