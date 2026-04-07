import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfirmModal({
  open,
  title,
  description,
  warning,
  confirmLabel = "Confirmar",
  loadingLabel = "Eliminando...",
  cancelLabel = "Cancelar",
  loading = false,
  error = "",
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onClose, open]);

  if (!open) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !loading) {
      onClose?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="text-sm leading-6 text-slate-600">{description}</p>
              {warning && (
                <p className="text-sm font-medium text-red-600">{warning}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? loadingLabel : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
