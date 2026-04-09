import { useRef, useState } from "react";
import { AlertCircle, CheckCircle, FileText, UploadCloud, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function GuiaBulkImportTab({ onImported }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef();

  function addFiles(newFiles) {
    const incoming = Array.from(newFiles ?? []);
    const valid = incoming.filter((file) => /\.(xml|zip)$/i.test(file.name));
    const invalid = incoming.filter((file) => !/\.(xml|zip)$/i.test(file.name));

    if (invalid.length > 0) {
      setError(
        `Archivos no permitidos: ${invalid.map((file) => file.name).join(", ")}. Solo se aceptan .xml y .zip.`,
      );
    } else {
      setError(null);
    }

    if (valid.length > 0) {
      setFiles((prev) => {
        const names = new Set(prev.map((file) => file.name));
        return [...prev, ...valid.filter((file) => !names.has(file.name))];
      });
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function removeFile(name) {
    setFiles((prev) => prev.filter((file) => file.name !== name));
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    if (files.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const data = await api.upload("/guias/importar-masivo", formData);
      setResult(data);
      if (typeof onImported === "function") onImported();
    } catch (err) {
      setError(err.message ?? "Error durante la importación masiva.");
    } finally {
      setImporting(false);
    }
  }

  const ESTADO_CFG = {
    importado: { icon: CheckCircle, cls: "text-emerald-500", label: "Importado" },
    duplicado: { icon: AlertCircle, cls: "text-amber-500", label: "Duplicado" },
    error: { icon: XCircle, cls: "text-red-500", label: "Error" },
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-8 py-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Importación masiva de guías</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sube múltiples archivos XML o ZIP con XML. Los PDF no están permitidos en la importación masiva.
          Los duplicados y errores se registran sin detener el resto del proceso.
        </p>
      </div>

      {!result ? (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-10 transition-colors",
              dragging
                ? "border-slate-400 bg-slate-50"
                : files.length > 0
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xml,.zip"
              multiple
              className="hidden"
              onChange={(event) => addFiles(event.target.files)}
            />
            <UploadCloud className="mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">Arrastra archivos aquí o haz clic para seleccionar</p>
            <p className="mt-1 text-sm text-slate-400">Solo .xml y .zip · Máx. 50 archivos</p>
          </div>

          {files.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {files.length} archivo{files.length !== 1 ? "s" : ""} seleccionado{files.length !== 1 ? "s" : ""}
              </p>
              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                {files.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-sm text-slate-700">{file.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(file.name)}
                      className="ml-2 shrink-0 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={files.length === 0 || importing} className="gap-2">
              {importing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Importando...
                </>
              ) : (
                `Importar ${files.length > 0 ? `(${files.length})` : ""}`
              )}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Recibidos", value: result.totalRecibidos, cls: "bg-slate-50 text-slate-700" },
              { label: "Importados", value: result.importados, cls: "bg-emerald-50 text-emerald-700" },
              { label: "Duplicados", value: result.duplicados, cls: "bg-amber-50 text-amber-700" },
              { label: "Fallidos", value: result.fallidos, cls: "bg-red-50 text-red-700" },
            ].map((item) => (
              <div key={item.label} className={cn("rounded-xl px-4 py-3 text-center", item.cls)}>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="mt-0.5 text-xs font-medium">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {result.detalle?.map((item, index) => {
              const cfg = ESTADO_CFG[item.estado] ?? ESTADO_CFG.error;
              const Icon = cfg.icon;

              return (
                <div
                  key={`${item.filename}-${index}`}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.cls)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{item.filename}</p>
                    {item.estado === "importado" && item.serie ? (
                      <p className="text-xs text-emerald-600">{item.serie}-{item.numero}</p>
                    ) : null}
                    {item.mensaje ? <p className="text-xs text-slate-500">{item.mensaje}</p> : null}
                  </div>
                  <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", cfg.cls)}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={reset} variant="outline">
              Importar más archivos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
