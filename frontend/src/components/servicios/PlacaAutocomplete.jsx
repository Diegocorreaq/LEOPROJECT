import { useState, useEffect, useRef } from "react";
import { Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

/**
 * PlacaAutocomplete — input con sugerencias de placas desde la BD.
 *
 * Props:
 *   value            string          texto actual del input
 *   onChange         (text) => void  cuando el usuario escribe
 *   onSelect         (vehiculo) => void  cuando selecciona una sugerencia
 *   placeholder      string
 *   disabled         boolean
 *   soloPropio       boolean         filtra propietarioSubcontratadoId: null
 *   tipoUnidadFiltro string|null     filtra por tipoUnidad (ej. "PLATAFORMA")
 *   mustSelect       boolean         si true, el texto libre sin selección se marca como inválido
 *   className        string
 */
export default function PlacaAutocomplete({
  value = "",
  onChange,
  onSelect,
  placeholder = "ABC-123",
  disabled = false,
  soloPropio = false,
  tipoUnidadFiltro = null,
  mustSelect = false,
  className,
}) {
  const [sugerencias, setSugerencias]         = useState([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [seleccionado, setSeleccionado]       = useState(false);

  const dropdownRef   = useRef(null);
  const debounceRef   = useRef(null);
  // Ref que impide que el useEffect resetee seleccionado cuando el cambio
  // de value vino de una selección (no de escritura manual).
  const justSelected  = useRef(false);

  // ── Búsqueda con debounce ────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return;

    // Si el cambio de value fue provocado por handleSelect, ignorar este ciclo.
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }

    clearTimeout(debounceRef.current);
    setSeleccionado(false);

    if (!value || value.trim().length < 1) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        let url = `/vehiculos/buscar?texto=${encodeURIComponent(value.trim())}`;
        if (soloPropio)       url += "&soloPropio=true";
        if (tipoUnidadFiltro) url += `&tipoUnidad=${encodeURIComponent(tipoUnidadFiltro)}`;

        const results = await api.get(url);
        setSugerencias(Array.isArray(results) ? results : []);
        setShowSugerencias(Array.isArray(results) && results.length > 0);
      } catch {
        setSugerencias([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(debounceRef.current);
  }, [value, disabled, soloPropio, tipoUnidadFiltro]);

  // ── Cerrar dropdown al hacer click fuera ────────────────────────────────────
  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSugerencias(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ── Seleccionar sugerencia ───────────────────────────────────────────────────
  function handleSelect(vehiculo) {
    justSelected.current = true;   // evita que el useEffect pise seleccionado
    clearTimeout(debounceRef.current);
    onChange(vehiculo.placa);
    setSeleccionado(true);
    setSugerencias([]);
    setShowSugerencias(false);
    onSelect?.(vehiculo);
  }

  function handleChange(val) {
    onChange(val.toUpperCase());
    // No hace falta setSeleccionado(false) aquí; el useEffect lo hace
    // porque justSelected.current sigue en false cuando el usuario escribe.
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const isInvalid = mustSelect && !!value.trim() && !loading && !seleccionado;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Input
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => sugerencias.length > 0 && setShowSugerencias(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "pr-9 font-mono tracking-wider transition-colors",
            seleccionado && "border-blue-300 bg-blue-50/50 focus-visible:ring-blue-300",
            isInvalid && "border-red-300 bg-red-50/40 focus-visible:ring-red-300",
            className
          )}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : seleccionado ? (
            <Check className="h-4 w-4 text-blue-500" strokeWidth={2.5} />
          ) : null}
        </div>
      </div>
      {isInvalid && (
        <p className="mt-1 text-xs text-red-500">
          Selecciona un vehículo registrado desde las sugerencias.
        </p>
      )}

      {/* Dropdown de sugerencias */}
      {showSugerencias && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-48 overflow-y-auto">
            {sugerencias.map((v, i) => (
              <button
                key={v.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(v); }}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-slate-50",
                  i < sugerencias.length - 1 && "border-b border-slate-100"
                )}
              >
                <span className="font-mono font-semibold text-sm text-slate-800">{v.placa}</span>
                <span className="text-xs text-slate-400">{v.tipoUnidad}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 px-4 py-1.5">
            <p className="text-[11px] text-slate-400">
              {sugerencias.length} resultado{sugerencias.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
