import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "PROPIO", label: "Propio" },
  { value: "SUBCONTRATADO", label: "Subcontratado" },
];

const TIPOS_DOCUMENTO = ["DNI", "CE", "PASAPORTE", "RUC"];
const ESTADOS = [
  { value: "ACTIVO", label: "Activo" },
  { value: "INACTIVO", label: "Inactivo" },
];

const INITIAL_FORM = {
  nombre: "",
  apPaterno: "",
  apMaterno: "",
  tipoDocumento: "DNI",
  nroDocumento: "",
  licencia: "",
  tipo: "PROPIO",
  estado: "ACTIVO",
  propietario: {
    razonSocial: "",
    ruc: "",
    contacto: "",
    telefono: "",
  },
};

function validateDocumento(tipoDocumento, nroDocumento) {
  const value = nroDocumento.trim();
  if (!value) return false;
  if (tipoDocumento === "DNI") return /^\d{8}$/.test(value);
  if (tipoDocumento === "RUC") return /^\d{11}$/.test(value);
  return value.length >= 6;
}

function validateForm(form) {
  const errors = [];
  if (!form.nombre.trim()) errors.push("El nombre es obligatorio.");
  if (!form.apPaterno.trim()) errors.push("El apellido paterno es obligatorio.");
  if (!validateDocumento(form.tipoDocumento, form.nroDocumento)) {
    errors.push("El numero de documento no es valido para el tipo seleccionado.");
  }
  if (form.tipo === "SUBCONTRATADO") {
    if (!form.propietario.razonSocial.trim()) {
      errors.push("La razon social de la empresa propietaria es obligatoria.");
    }
    if (!/^\d{11}$/.test(form.propietario.ruc.trim())) {
      errors.push("El RUC de la empresa propietaria debe tener 11 digitos.");
    }
  }
  return errors;
}

function normalizePayload(form) {
  const payload = {
    nombre: form.nombre.trim(),
    apPaterno: form.apPaterno.trim(),
    apMaterno: form.apMaterno.trim() || null,
    tipoDocumento: form.tipoDocumento,
    nroDocumento: form.nroDocumento.trim(),
    licencia: form.licencia.trim() || null,
    tipo: form.tipo,
    activo: form.estado === "ACTIVO",
  };

  if (form.tipo === "SUBCONTRATADO") {
    payload.propietario = {
      razonSocial: form.propietario.razonSocial.trim(),
      ruc: form.propietario.ruc.trim(),
      contacto: form.propietario.contacto.trim() || null,
      telefono: form.propietario.telefono.trim() || null,
    };
  }

  return payload;
}

function mapApiErrors(error) {
  if (!(error instanceof ApiError)) return [];
  if (Array.isArray(error.details) && error.details.length > 0) return error.details.map((item) => item.mensaje);
  return error.message ? [error.message] : [];
}

export function ConductorFormPage({
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
    nombre: Boolean(form.nombre.trim()),
    apPaterno: Boolean(form.apPaterno.trim()),
    documento: validateDocumento(form.tipoDocumento, form.nroDocumento),
    propietario: form.tipo === "PROPIO"
      ? true
      : Boolean(form.propietario.razonSocial.trim()) && /^\d{11}$/.test(form.propietario.ruc.trim()),
  }), [form]);

  const allValid = Object.values(checks).every(Boolean);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePropietario(field, value) {
    setForm((current) => ({
      ...current,
      propietario: {
        ...current.propietario,
        [field]: value,
      },
    }));
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b bg-white px-8 py-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/conductores" className="flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Conductores
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">
            {mode === "create" ? "Nuevo conductor" : "Editar conductor"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/conductores")}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={!allValid || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Guardar conductor" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-auto px-8 py-6">
        <div className="flex-1 min-w-0 space-y-4">
          {(submitError || submitDetails.length > 0) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">{submitError || "No se pudo guardar el conductor."}</p>
              {submitDetails.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-red-600">
                  {submitDetails.map((detail, index) => <li key={`${detail}-${index}`}>- {detail}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h1 className="text-lg font-semibold text-slate-900">Datos del conductor</h1>
              <p className="text-sm text-slate-500">Registra la persona que operara la unidad y deja sus datos de identificacion consistentes.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nombre" required>
                <Input value={form.nombre} onChange={(event) => updateField("nombre", event.target.value)} />
              </Field>
              <Field label="Apellido paterno" required>
                <Input value={form.apPaterno} onChange={(event) => updateField("apPaterno", event.target.value)} />
              </Field>
              <Field label="Apellido materno">
                <Input value={form.apMaterno} onChange={(event) => updateField("apMaterno", event.target.value)} />
              </Field>
              <Field label="Tipo documento">
                <Select value={form.tipoDocumento} onValueChange={(value) => updateField("tipoDocumento", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((tipoDocumento) => <SelectItem key={tipoDocumento} value={tipoDocumento}>{tipoDocumento}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Numero documento" required>
                <Input value={form.nroDocumento} onChange={(event) => updateField("nroDocumento", event.target.value.trim())} inputMode="numeric" />
              </Field>
              <Field label="Licencia">
                <Input value={form.licencia} onChange={(event) => updateField("licencia", event.target.value)} />
              </Field>
              <Field label="Tipo">
                <Select value={form.tipo} onValueChange={(value) => updateField("tipo", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((tipo) => <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estado">
                <Select value={form.estado} onValueChange={(value) => updateField("estado", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((estado) => <SelectItem key={estado.value} value={estado.value}>{estado.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {form.tipo === "SUBCONTRATADO" && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Empresa propietaria</h2>
                <p className="text-sm text-slate-500">Este bloque es obligatorio para conductores subcontratados.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Razon social" required>
                  <Input value={form.propietario.razonSocial} onChange={(event) => updatePropietario("razonSocial", event.target.value)} />
                </Field>
                <Field label="RUC" required>
                  <Input value={form.propietario.ruc} onChange={(event) => updatePropietario("ruc", event.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" />
                </Field>
                <Field label="Contacto">
                  <Input value={form.propietario.contacto} onChange={(event) => updatePropietario("contacto", event.target.value)} />
                </Field>
                <Field label="Telefono">
                  <Input value={form.propietario.telefono} onChange={(event) => updatePropietario("telefono", event.target.value)} />
                </Field>
              </div>
            </div>
          )}
        </div>

        <div className="w-72 shrink-0 space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Resumen</h2>
            <SummaryRow label="Nombre" value={[form.nombre, form.apPaterno].filter(Boolean).join(" ") || "Pendiente"} />
            <SummaryRow label="Documento" value={`${form.tipoDocumento} ${form.nroDocumento || "Pendiente"}`} mono />
            <SummaryRow label="Licencia" value={form.licencia.trim() || "Sin licencia"} />
            <SummaryRow label="Tipo" value={TIPOS.find((item) => item.value === form.tipo)?.label || form.tipo} />
            <SummaryRow label="Estado" value={ESTADOS.find((item) => item.value === form.estado)?.label || form.estado} />
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Campos requeridos</h2>
            <ChecklistItem ok={checks.nombre} label="Nombre completo base" />
            <ChecklistItem ok={checks.documento} label="Documento valido" />
            <ChecklistItem ok={checks.propietario} label="Empresa requerida si es subcontratado" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NuevoConductorPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitDetails, setSubmitDetails] = useState([]);

  async function handleSubmit() {
    const validationErrors = validateForm(form);
    if (validationErrors.length > 0) {
      setSubmitError("Revisa los campos obligatorios antes de guardar.");
      setSubmitDetails(validationErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitDetails([]);

    try {
      const created = await api.post("/conductores", normalizePayload(form));
      navigate(`/conductores/${created.id}`);
    } catch (error) {
      setSubmitError(error.message || "No se pudo guardar el conductor.");
      setSubmitDetails(mapApiErrors(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConductorFormPage
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
