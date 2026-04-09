import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

function formatUbigeoValue(ubigeo) {
  return `${ubigeo.distrito} - ${ubigeo.departamento}`;
}

function formatUbigeoSecondary(ubigeo) {
  return ubigeo.provincia
    ? `${ubigeo.provincia}, ${ubigeo.departamento}`
    : ubigeo.departamento;
}

export default function UbigeoAutocomplete({
  value = "",
  onChange,
  onSelect,
  placeholder = "Buscar distrito o departamento...",
  disabled = false,
  mustSelect = false,
  isValidated = false,
  className,
}) {
  const [sugerencias, setSugerencias] = useState([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const justSelected = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (disabled) return undefined;

    if (justSelected.current) {
      justSelected.current = false;
      return undefined;
    }

    if (isValidated) {
      clearTimeout(debounceRef.current);
      setSugerencias([]);
      setShowSugerencias(false);
      return undefined;
    }

    clearTimeout(debounceRef.current);

    if (!value || value.trim().length < 1) {
      setSugerencias([]);
      setShowSugerencias(false);
      return undefined;
    }

    requestIdRef.current += 1;
    const myRequestId = requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.get(`/ubigeos/buscar?texto=${encodeURIComponent(value.trim())}`);
        if (myRequestId !== requestIdRef.current) return;
        const safeResults = Array.isArray(results) ? results : [];
        setSugerencias(safeResults);
        setShowSugerencias(safeResults.length > 0);
      } catch {
        if (myRequestId !== requestIdRef.current) return;
        setSugerencias([]);
        setShowSugerencias(false);
      } finally {
        if (myRequestId === requestIdRef.current) setLoading(false);
      }
    }, 280);

    return () => clearTimeout(debounceRef.current);
  }, [value, disabled, isValidated]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSugerencias(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(ubigeo) {
    justSelected.current = true;
    clearTimeout(debounceRef.current);
    setSugerencias([]);
    setShowSugerencias(false);
    onChange(formatUbigeoValue(ubigeo));
    onSelect?.(ubigeo);
  }

  const isInvalid = mustSelect && !!value.trim() && !loading && !isValidated;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => sugerencias.length > 0 && setShowSugerencias(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "pr-9 transition-colors",
            isValidated && "border-blue-300 bg-blue-50/50 focus-visible:ring-blue-300",
            isInvalid && "border-red-300 bg-red-50/40 focus-visible:ring-red-300",
            className,
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
          Selecciona una ubicacion registrada desde las sugerencias.
        </p>
      )}

      {showSugerencias && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-52 overflow-y-auto">
            {sugerencias.map((ubigeo, index) => (
              <button
                key={ubigeo.codigo}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(ubigeo);
                }}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-slate-50",
                  index < sugerencias.length - 1 && "border-b border-slate-100",
                )}
              >
                <span className="text-sm font-semibold text-slate-800">{ubigeo.distrito}</span>
                <span className="text-xs text-slate-400">{formatUbigeoSecondary(ubigeo)}</span>
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
