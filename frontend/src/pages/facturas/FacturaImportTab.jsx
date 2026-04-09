import { useRef, useState } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight,
  FileText, Link, UploadCloud, X, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import ServicioFacturaPicker from "./ServicioFacturaPicker";
import FacturaStatusBadge from "./FacturaStatusBadge";

const SOURCE_LABELS = {
  XML:     "XML directo",
  ZIP_XML: "ZIP (XML extraído)",
  PDF:     "PDF textual",
  ZIP_PDF: "ZIP (PDF extraído)",
};

function CheckItem({ ok, label }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-slate-300" />
      )}
      <span className={ok ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-800">{value}</span>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function fmtNum(val, moneda = "PEN") {
  if (val == null) return null;
  const prefix = moneda === "USD" ? "$ " : "S/ ";
  return `${prefix}${Number(val).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

export default function FacturaImportTab({ onImported }) {
  const [step, setStep]               = useState(1);
  const [file, setFile]               = useState(null);
  const [dragging, setDragging]       = useState(false);
  const [importing, setImporting]     = useState(false);
  const [importError, setImportError] = useState(null);
  const [result, setResult]           = useState(null);
  const [vinculando, setVinculando]   = useState(false);
  const [vincularError, setVincularError] = useState(null);
  const [servicioSel, setServicioSel] = useState(null);
  const [skipVincular, setSkipVincular] = useState(false);
  const inputRef = useRef();

  function reset() {
    setStep(1); setFile(null); setImportError(null); setResult(null);
    setServicioSel(null); setSkipVincular(false); setVincularError(null);
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setImportError(null); }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setImportError(null); }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true); setImportError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api.upload("/facturas/importar", fd);
      setResult(data);
      setStep(2);
    } catch (err) {
      setImportError(err.message ?? "Error al importar el archivo.");
    } finally {
      setImporting(false);
    }
  }

  async function handleVincular() {
    if (!servicioSel || !result?.factura?.id) return;
    setVinculando(true); setVincularError(null);
    try {
      const updated = await api.patch(`/facturas/${result.factura.id}/vincular`, {
        servicioId: servicioSel.id,
      });
      setResult((prev) => ({ ...prev, factura: updated }));
      setStep(4);
    } catch (err) {
      setVincularError(err.message);
    } finally {
      setVinculando(false);
    }
  }

  function handleFinish() { onImported?.(result?.factura); reset(); }

  const factura = result?.factura;
  const moneda = factura?.moneda ?? "PEN";

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      {/* Progress */}
      <div className="mb-8 flex items-center gap-2">
        {[
          { n: 1, label: "Subir archivo" },
          { n: 2, label: "Revisar datos" },
          { n: 3, label: "Vincular servicio" },
          { n: 4, label: "Listo" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center">
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
              step >= s.n ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
            )}>
              {step > s.n ? <CheckCircle className="h-4 w-4" /> : s.n}
            </div>
            <span className={cn("ml-1.5 text-xs", step >= s.n ? "text-slate-700 font-medium" : "text-slate-400")}>
              {s.label}
            </span>
            {i < 3 && <div className={cn("mx-3 h-px w-8 bg-slate-200", step > s.n && "bg-slate-900")} />}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Importar factura</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sube el XML de la factura electrónica SUNAT, un ZIP que lo contenga, o un PDF textual.
              El XML es el origen preferido para mayor precisión.
            </p>
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12 transition-colors",
              dragging ? "border-slate-400 bg-slate-50" : file ? "border-slate-300 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <input ref={inputRef} type="file" accept=".xml,.zip,.pdf" className="hidden" onChange={handleFileChange} />
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-800">{file.name}</p>
                  <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" /> Cambiar archivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <UploadCloud className="h-10 w-10 text-slate-300" />
                <div>
                  <p className="font-medium text-slate-700">Arrastra el archivo aquí o haz clic para seleccionar</p>
                  <p className="mt-1 text-sm text-slate-400">Acepta .xml, .zip o .pdf · Máx. 15 MB</p>
                </div>
              </div>
            )}
          </div>

          {importError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {importError}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={!file || importing} className="gap-2">
              {importing ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Importando...</>
              ) : (
                <>Importar <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && result && (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Factura importada</h2>
              <p className="mt-0.5 text-sm text-slate-500">Revisa los datos extraídos y el checklist.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {SOURCE_LABELS[result.sourceType] ?? result.sourceType}
              </span>
              <FacturaStatusBadge estado={factura?.estadoPago} />
            </div>
          </div>

          {/* Número destacado */}
          <div className="rounded-xl bg-slate-900 px-5 py-4 text-white">
            <p className="text-xs text-slate-400 mb-1">Factura importada</p>
            <p className="text-2xl font-bold tracking-wide">{factura?.serie}-{factura?.numero}</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {factura?.fechaEmision ? new Date(factura.fechaEmision).toLocaleDateString("es-PE") : "—"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Section label="Cliente">
              <Row label="Razón social" value={factura?.cliente?.razonSocial} />
              <Row label="RUC" value={factura?.cliente?.ruc} />
            </Section>

            <Section label="Importes">
              <Row label="Valor venta" value={fmtNum(factura?.montoNeto, moneda)} />
              <Row label="IGV" value={fmtNum(factura?.igv, moneda)} />
              <Row label="Total" value={fmtNum(factura?.total, moneda)} />
              {Number(factura?.detraccionMonto) > 0 && (
                <Row label="Detracción" value={`${factura.detraccionPorcentaje}% · ${fmtNum(factura.detraccionMonto, "PEN")}`} />
              )}
            </Section>
          </div>

          {/* Guías relacionadas */}
          {(factura?.formaPago || factura?.fechaVencimiento) && (
            <Section label="Condiciones de pago">
              <Row label="Forma de pago" value={factura?.formaPago} />
              <Row
                label="Fecha vencimiento"
                value={factura?.fechaVencimiento ? new Date(factura.fechaVencimiento).toLocaleDateString("es-PE") : null}
              />
            </Section>
          )}

          {factura?.guias?.length > 0 && (
            <Section label={`Guías relacionadas (${factura.guias.length})`}>
              <div className="flex flex-wrap gap-2">
                {factura.guias.map((g, i) => (
                  <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {g.serieGuia}-{g.numeroGuia}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Checklist */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Checklist</p>
            <CheckItem ok={result.checklist.archivoValido} label="Archivo válido" />
            <CheckItem ok={result.checklist.datosGeneralesValidos} label="Datos generales completos" />
            <CheckItem ok={result.checklist.totalPresente} label="Importe total presente" />
            <CheckItem ok={result.checklist.clienteIdentificado} label="Cliente identificado" />
            <CheckItem ok={result.checklist.clienteResuelto} label="Cliente resuelto en sistema" />
            <CheckItem ok={result.checklist.guiasRelacionadasPresentes} label="Guías relacionadas presentes" />
          </div>

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Advertencias</p>
              </div>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-700">· {w}</p>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={reset} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ChevronLeft className="h-4 w-4" />
              Importar otra
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => { setSkipVincular(true); setStep(4); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Vincular luego
              </button>
              <Button onClick={() => setStep(3)} className="gap-2">
                <Link className="h-4 w-4" />
                Vincular a servicio
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && result && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Vincular a un servicio</h2>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona el servicio al que corresponde la factura{" "}
              <span className="font-semibold text-slate-700">{factura?.serie}-{factura?.numero}</span>.
            </p>
          </div>

          <ServicioFacturaPicker
            facturaId={factura?.id}
            onSelect={setServicioSel}
            selectedId={servicioSel?.id}
          />

          {vincularError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {vincularError}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ChevronLeft className="h-4 w-4" />
              Volver
            </button>
            <div className="flex gap-3">
              <button onClick={() => setStep(4)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Omitir
              </button>
              <Button onClick={handleVincular} disabled={!servicioSel || vinculando} className="gap-2">
                {vinculando ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Vinculando...</>
                ) : (
                  <>Vincular <ChevronRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && result && (
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {skipVincular ? "Factura importada sin vincular" : "Factura importada y vinculada"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{factura?.serie}-{factura?.numero}</span>{" "}
              fue guardada correctamente.
              {skipVincular && " Puedes vincularla desde la lista."}
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <button onClick={reset} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Importar otra
            </button>
            <Button onClick={handleFinish}>Ver en la lista</Button>
          </div>
        </div>
      )}
    </div>
  );
}
