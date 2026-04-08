import { useState, useEffect, useRef } from "react";
import { Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

/**
 * PlacaAutocomplete — input con sugerencias de placas desde la BD.
 *
 * Props:
 *   value            string              texto actual del input
 *   onChange         (text) => void      cuando el usuario escribe
 *   onSelect         (vehiculo) => void  cuando selecciona una sugerencia
 *   placeholder      string
 *   disabled         boolean
 *   soloPropio       boolean             filtra propietarioSubcontratadoId: null
 *   tipoUnidadFiltro string|null         filtra por tipoUnidad (ej. "PLATAFORMA")
 *   mustSelect       boolean             si true, el texto libre sin selección se marca como inválido
 *   isValidated      boolean             CONTROLADO por el padre: true cuando existe un vehiculoId válido
 *                                        asociado al texto actual. Si true, el campo se muestra como
 *                                        seleccionado (azul, check) y no se dispara búsqueda automática.
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
  isValidated = false,
  className,
}) {
  const [sugerencias, setSugerencias]         = useState([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [loading, setLoading]                 = useState(false);

  const dropdownRef  = useRef(null);
  const debounceRef  = useRef(null);
  // Evita que el useEffect busque justo después de que el usuario selecciona una sugerencia.
  // (onChange + onSelect se llaman juntos; el padre actualiza value e isValidated en el
  //  mismo ciclo de render, pero el effect se ejecuta una sola vez y debe saltárselo).
  const justSelected = useRef(false);
  // Protege contra respuestas HTTP obsoletas (race condition con debounce).
  const requestIdRef = useRef(0);

  // ── Búsqueda con debounce ────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return;

    // Selección recién hecha desde el dropdown: no buscar ni limpiar.
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }

    // El padre indica que el valor actual ya corresponde a un registro válido:
    // no disparar búsqueda automática y limpiar cualquier sugerencia residual.
    if (isValidated) {
      clearTimeout(debounceRef.current);
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }

    clearTimeout(debounceRef.current);

    if (!value || value.trim().length < 1) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }

    // Incrementar antes del fetch: toda respuesta con ID distinto es obsoleta.
    requestIdRef.current += 1;
    const myRequestId = requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        let url = `/vehiculos/buscar?texto=${encodeURIComponent(value.trim())}`;
        if (soloPropio)       url += "&soloPropio=true";
        if (tipoUnidadFiltro) url += `&tipoUnidad=${encodeURIComponent(tipoUnidadFiltro)}`;

        const results = await api.get(url);
        if (myRequestId !== requestIdRef.current) return; // respuesta obsoleta
        setSugerencias(Array.isArray(results) ? results : []);
        setShowSugerencias(Array.isArray(results) && results.length > 0);
      } catch {
        if (myRequestId !== requestIdRef.current) return;
        setSugerencias([]);
      } finally {
        if (myRequestId === requestIdRef.current) setLoading(false);
      }
    }, 280);

    return () => clearTimeout(debounceRef.current);
  }, [value, disabled, soloPropio, tipoUnidadFiltro, isValidated]);

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
    // Marcar antes de llamar onChange/onSelect para que el effect no busque.
    justSelected.current = true;
    clearTimeout(debounceRef.current);
    setSugerencias([]);
    setShowSugerencias(false);
    // onChange primero (el padre limpia vehiculoId en handlePlacaTextChange),
    // luego onSelect (el padre vuelve a setear vehiculoId en selVehiculo).
    // React 18 batchea ambas actualizaciones: el resultado final es vehiculoId = vehiculo.id.
    onChange(vehiculo.placa);
    onSelect?.(vehiculo);
  }

  function handleChange(val) {
    onChange(val.toUpperCase());
    // El padre limpiará vehiculoId → isValidated pasará a false → effect buscará.
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  // isValidated viene del padre (fuente de verdad externa).
  const isInvalid = mustSelect && !!value.trim() && !loading && !isValidated;

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
            isValidated && "border-blue-300 bg-blue-50/50 focus-visible:ring-blue-300",
            isInvalid   && "border-red-300 bg-red-50/40 focus-visible:ring-red-300",
            className
          )}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : isValidated ? (
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
