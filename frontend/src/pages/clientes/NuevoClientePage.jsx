import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const INITIAL_FORM = {
  razonSocial: "",
  ruc: "",
  email: "",
  telefono: "",
  direccion: "",
};

function validateForm(form) {
  const nextErrors = {};

  if (!form.razonSocial.trim()) {
    nextErrors.razonSocial = "La razon social es obligatoria.";
  } else if (form.razonSocial.trim().length < 2) {
    nextErrors.razonSocial = "La razon social debe tener al menos 2 caracteres.";
  }

  if (!/^\d{11}$/.test(form.ruc.trim())) {
    nextErrors.ruc = "El RUC debe tener exactamente 11 digitos.";
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    nextErrors.email = "Ingresa un email valido.";
  }

  return nextErrors;
}

function mapApiErrors(error) {
  if (!(error instanceof ApiError)) return [];
  if (Array.isArray(error.details) && error.details.length > 0) return error.details.map((item) => item.mensaje);
  return error.message ? [error.message] : [];
}

export function ClienteFormPage({
  mode,
  form,
  setForm,
  onSubmit,
  submitting,
  submitError,
  submitDetails = [],
}) {
  const navigate = useNavigate();
  const checks = useMemo(() => ({
    razonSocial: form.razonSocial.trim().length >= 2,
    ruc: /^\d{11}$/.test(form.ruc.trim()),
    email: !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
  }), [form]);

  const allValid = Object.values(checks).every(Boolean);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/clientes" className="flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Clientes
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">
            {mode === "create" ? "Nuevo cliente" : "Editar cliente"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/clientes")}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={!allValid || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Guardar cliente" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-auto px-8 py-6">
        <div className="flex-1 min-w-0 space-y-4">
          {(submitError || submitDetails.length > 0) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">{submitError || "No se pudo guardar el cliente."}</p>
              {submitDetails.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-red-600">
                  {submitDetails.map((detail, index) => <li key={`${detail}-${index}`}>- {detail}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h1 className="text-lg font-semibold text-slate-900">Datos del cliente</h1>
              <p className="text-sm text-slate-500">Completa la informacion base para identificarlo y usarlo luego en servicios y facturacion.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Razon social" required>
                <Input value={form.razonSocial} onChange={(event) => updateField("razonSocial", event.target.value)} placeholder="Ej. Transportes Leo SAC" />
              </Field>
              <Field label="RUC" required>
                <Input value={form.ruc} onChange={(event) => updateField("ruc", event.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="20123456789" inputMode="numeric" />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="contacto@empresa.com" />
              </Field>
              <Field label="Telefono">
                <Input value={form.telefono} onChange={(event) => updateField("telefono", event.target.value)} placeholder="999 999 999" />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Direccion">
                <Textarea value={form.direccion} onChange={(event) => updateField("direccion", event.target.value)} rows={4} placeholder="Direccion fiscal o comercial del cliente" />
              </Field>
            </div>
          </div>
        </div>

        <div className="w-72 shrink-0 space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Resumen</h2>
            <SummaryRow label="Razon social" value={form.razonSocial.trim() || "Pendiente"} />
            <SummaryRow label="RUC" value={form.ruc.trim() || "Pendiente"} mono />
            <SummaryRow label="Email" value={form.email.trim() || "Sin email"} />
            <SummaryRow label="Telefono" value={form.telefono.trim() || "Sin telefono"} />
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Campos requeridos</h2>
            <ChecklistItem ok={checks.razonSocial} label="Razon social valida" />
            <ChecklistItem ok={checks.ruc} label="RUC con 11 digitos" />
            <ChecklistItem ok={checks.email} label="Email valido o vacio" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NuevoClientePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitDetails, setSubmitDetails] = useState([]);

  async function handleSubmit() {
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("Revisa los campos obligatorios antes de guardar.");
      setSubmitDetails(Object.values(nextErrors));
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitDetails([]);

    try {
      const created = await api.post("/clientes", {
        razonSocial: form.razonSocial.trim(),
        ruc: form.ruc.trim(),
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
      });

      navigate(`/clientes/${created.id}`);
    } catch (error) {
      setSubmitError(error.message || "No se pudo guardar el cliente.");
      setSubmitDetails(mapApiErrors(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClienteFormPage
      mode="create"
      form={form}
      setForm={setForm}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
      submitDetails={submitDetails}
    />
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn("text-right text-slate-900", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function ChecklistItem({ ok, label }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className={cn(
        "flex h-4 w-4 items-center justify-center rounded-full",
        ok ? "bg-emerald-500" : "bg-slate-200"
      )}>
        {ok && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </div>
      <span className={cn("text-sm", ok ? "text-slate-700" : "text-slate-400")}>{label}</span>
    </div>
  );
}
