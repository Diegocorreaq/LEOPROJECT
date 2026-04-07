import { useState, useEffect, useRef } from "react";
import { Check, Edit2, X, Loader2, User, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

/**
 * ClienteBlock — bloque de cliente con autocomplete, confirmación y edición.
 *
 * Estados internos:
 *   editing    → campos habilitados, usuario puede buscar/escribir
 *   confirmed  → campos readonly, cliente vinculado
 *
 * Sub-estados cuando editing:
 *   existente  → seleccionado desde sugerencias (clienteId ya existe en BD)
 *   editingId  → editando un cliente ya confirmado previamente (para PUT)
 */
/**
 * disallowedIds — array de clienteIds ya confirmados en otros bloques del mismo servicio.
 * Se usa para impedir que el mismo cliente sea agregado dos veces.
 */
export default function ClienteBlock({ index, onConfirm, onUnconfirm, canRemove, onRemove, disallowedIds = [] }) {
  const [razonSocial, setRazonSocial]   = useState("");
  const [ruc, setRuc]                   = useState("");
  const [clienteId, setClienteId]       = useState(null);
  const [editingId, setEditingId]       = useState(null);   // ID del cliente en edición
  const [isExistente, setIsExistente]   = useState(false);  // seleccionado de sugerencias
  const [isConfirmado, setIsConfirmado] = useState(false);

  const [sugerencias, setSugerencias]         = useState([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [searchLoading, setSearchLoading]     = useState(false);
  const [confirmLoading, setConfirmLoading]   = useState(false);

  const [error, setError]     = useState("");
  const [mensaje, setMensaje] = useState("");

  const dropdownRef  = useRef(null);
  const debounceRef  = useRef(null);
  // Evita que el useEffect resetee el estado cuando el cambio de razonSocial
  // vino de seleccionarSugerencia (no de escritura manual del usuario).
  const justSelected = useRef(false);

  // ── Autocomplete: buscar mientras el usuario escribe ──────────────────────
  useEffect(() => {
    if (isConfirmado) return;

    // Si el cambio fue provocado por seleccionarSugerencia, saltear este ciclo.
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }

    clearTimeout(debounceRef.current);

    if (razonSocial.trim().length < 2) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await api.get(
          `/clientes/buscar?texto=${encodeURIComponent(razonSocial.trim())}`
        );
        setSugerencias(Array.isArray(results) ? results : []);
        setShowSugerencias(Array.isArray(results) && results.length > 0);
      } catch {
        setSugerencias([]);
      } finally {
        setSearchLoading(false);
      }
    }, 280);

    return () => clearTimeout(debounceRef.current);
  }, [razonSocial, isConfirmado]);

  // ── Cerrar dropdown al hacer click fuera ─────────────────────────────────
  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSugerencias(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ── Seleccionar una sugerencia ────────────────────────────────────────────
  function seleccionarSugerencia(c) {
    justSelected.current = true;   // evita que el useEffect pise isExistente
    clearTimeout(debounceRef.current);
    setRazonSocial(c.razonSocial);
    setRuc(c.ruc);
    setClienteId(c.id);
    setIsExistente(true);
    setSugerencias([]);
    setShowSugerencias(false);
    setError("");
    setMensaje("");
  }

  // ── Cambio en razón social ─────────────────────────────────────────────────
  function handleRazonSocialChange(val) {
    setRazonSocial(val);
    setError("");
    setMensaje("");
    // Si el usuario modifica lo que seleccionó, resetear
    if (isExistente) {
      setIsExistente(false);
      setClienteId(editingId ?? null); // conservar editingId si está editando
      setRuc("");
    }
  }

  // ── Cambio en RUC ─────────────────────────────────────────────────────────
  function handleRucChange(val) {
    const soloDigitos = val.replace(/\D/g, "").slice(0, 11);
    setRuc(soloDigitos);
    setError("");
    setMensaje("");
  }

  // ── Confirmar cliente ─────────────────────────────────────────────────────
  async function handleConfirmar() {
    setError("");

    // Validaciones básicas
    if (!razonSocial.trim()) { setError("Debes ingresar la razón social."); return; }
    if (!ruc.trim())          { setError("Debes ingresar el RUC."); return; }
    if (!/^\d{11}$/.test(ruc.trim())) { setError("El RUC debe tener 11 dígitos numéricos."); return; }

    setConfirmLoading(true);

    try {
      let finalId    = clienteId;
      let finalRs    = razonSocial.trim();
      let finalRuc   = ruc.trim();
      let msgExito   = "";

      // ── Verificar que no sea duplicado en el mismo servicio ─────────────────
      // (para nuevos clientes, finalId se resolverá después del POST,
      //  así que la verificación de isExistente o editingId aplica aquí)
      if (isExistente && clienteId && disallowedIds.includes(clienteId)) {
        setError("Este cliente ya fue agregado al servicio.");
        setConfirmLoading(false);
        return;
      }

      if (isExistente && clienteId) {
        // ── Caso A: cliente seleccionado desde sugerencias ──────────────────
        msgExito = "Cliente existente confirmado correctamente.";

      } else if (editingId) {
        // ── Caso B: editando un cliente ya registrado → PUT ─────────────────
        const updated = await api.put(`/clientes/${editingId}`, {
          razonSocial: finalRs,
          ruc: finalRuc,
        });
        finalId  = updated.id;
        finalRs  = updated.razonSocial;
        finalRuc = updated.ruc;
        setClienteId(finalId);
        msgExito = "Cliente actualizado correctamente.";

      } else {
        // ── Caso C: cliente nuevo → POST ────────────────────────────────────
        const created = await api.post("/clientes", {
          razonSocial: finalRs,
          ruc: finalRuc,
        });
        finalId = created.id;
        // Verificar que el cliente recién creado no coincida con uno ya confirmado
        if (disallowedIds.includes(finalId)) {
          setError("Este cliente ya fue agregado al servicio.");
          setConfirmLoading(false);
          return;
        }
        setClienteId(finalId);
        msgExito = "Cliente nuevo registrado y confirmado correctamente.";
      }

      setIsConfirmado(true);
      setIsExistente(false);
      setEditingId(null);
      setMensaje(msgExito);
      onConfirm({ clienteId: finalId, razonSocial: finalRs, ruc: finalRuc });

    } catch (err) {
      setError(err.message || "Error al confirmar cliente.");
    } finally {
      setConfirmLoading(false);
    }
  }

  // ── Editar (desbloquear) ──────────────────────────────────────────────────
  function handleEditar() {
    setEditingId(clienteId);   // recordar el ID del cliente en edición
    setIsConfirmado(false);
    setIsExistente(false);
    setError("");
    setMensaje("Modo edición habilitado.");
    onUnconfirm();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const rucValido  = /^\d{11}$/.test(ruc.trim());
  const puedeConfirmar = razonSocial.trim() && ruc.trim() && rucValido && !confirmLoading;

  return (
    <div className={cn(
      "relative rounded-xl border-2 p-5 transition-all duration-200",
      isConfirmado
        ? "border-emerald-200 bg-emerald-50/60"
        : "border-slate-200 bg-white shadow-sm"
    )}>

      {/* ── Cabecera del bloque ── */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Cliente {index + 1}
          </span>
          {isExistente && !isConfirmado && (
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
              <User className="h-3 w-3" />
              Existente
            </span>
          )}
          {editingId && !isConfirmado && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
              <Edit2 className="h-3 w-3" />
              Editando
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isConfirmado && (
            <button
              type="button"
              onClick={handleEditar}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
            >
              <Edit2 className="h-3 w-3" />
              Editar
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title="Quitar cliente"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Campos ── */}
      <div className="space-y-3">

        {/* Razón social con autocomplete */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Razón social <span className="text-red-400">*</span>
          </Label>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Input
                value={razonSocial}
                onChange={e => handleRazonSocialChange(e.target.value)}
                onFocus={() => sugerencias.length > 0 && setShowSugerencias(true)}
                placeholder="Ej. Alicorp S.A.A."
                disabled={isConfirmado}
                autoComplete="off"
                className={cn(
                  "pr-9 transition-colors",
                  isConfirmado && "cursor-not-allowed bg-slate-50 text-slate-600",
                  isExistente && !isConfirmado && "border-blue-300 bg-blue-50/50 focus-visible:ring-blue-300"
                )}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : isExistente && !isConfirmado ? (
                  <Check className="h-4 w-4 text-blue-500" strokeWidth={2.5} />
                ) : null}
              </div>
            </div>

            {/* Dropdown de sugerencias */}
            {showSugerencias && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="max-h-60 overflow-y-auto">
                  {sugerencias.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); seleccionarSugerencia(c); }}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                        i < sugerencias.length - 1 && "border-b border-slate-100"
                      )}
                    >
                      <span className="text-sm font-semibold text-slate-800">{c.razonSocial}</span>
                      <span className="text-xs text-slate-400">RUC: {c.ruc}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 px-4 py-2">
                  <p className="text-[11px] text-slate-400">
                    {sugerencias.length} resultado{sugerencias.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RUC */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            RUC <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <Input
              value={ruc}
              onChange={e => handleRucChange(e.target.value)}
              placeholder="20XXXXXXXXX"
              maxLength={11}
              disabled={isConfirmado}
              inputMode="numeric"
              className={cn(
                "font-mono tracking-wider transition-colors",
                isConfirmado && "cursor-not-allowed bg-slate-50 text-slate-600",
                isExistente && !isConfirmado && "border-blue-300 bg-blue-50/50",
                ruc.trim().length === 11 && !rucValido && "border-red-300 focus-visible:ring-red-300"
              )}
            />
            {ruc.length > 0 && (
              <span className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium",
                rucValido ? "text-emerald-500" : "text-slate-400"
              )}>
                {ruc.length}/11
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Mensajes de error / éxito ── */}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
          <p className="text-xs font-medium text-red-600">{error}</p>
        </div>
      )}
      {mensaje && !error && (
        <div className={cn(
          "mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5",
          isConfirmado ? "bg-emerald-100" : "bg-amber-50"
        )}>
          <Check className={cn("h-3.5 w-3.5 shrink-0", isConfirmado ? "text-emerald-600" : "text-amber-600")} strokeWidth={3} />
          <p className={cn("text-xs font-medium", isConfirmado ? "text-emerald-700" : "text-amber-700")}>
            {mensaje}
          </p>
        </div>
      )}

      {/* ── Botón confirmar ── */}
      {!isConfirmado && (
        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!puedeConfirmar}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              puedeConfirmar
                ? "bg-slate-900 text-white hover:bg-slate-700 active:scale-95"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            )}
          >
            {confirmLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={3} />
            )}
            {confirmLoading ? "Confirmando..." : "Confirmar cliente"}
          </button>
        </div>
      )}

      {/* ── Estado: confirmado ── */}
      {isConfirmado && (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-emerald-500 px-4 py-2.5">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/30">
            <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
          </div>
          <span className="text-sm font-semibold text-white">
            Cliente confirmado
          </span>
          <span className="ml-auto truncate text-xs text-emerald-100 font-mono">
            RUC {ruc}
          </span>
        </div>
      )}
    </div>
  );
}
