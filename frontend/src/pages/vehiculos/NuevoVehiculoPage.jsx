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

const TIPOS_UNIDAD = ["CAMION", "TRACTO", "FURGON", "PLATAFORMA", "VOLQUETE", "CISTERNA", "OTRO", "CAMIONETA", "AUTO", "FURGON 2TN", "FURGON 10TN", "BARANDA REBATIBLE 2TN", "BARANDA REBATIBLE 10TN", "CAMABAJA"];
const ESTADOS = ["ACTIVO", "INACTIVO"];
const INITIAL_FORM = {
  placa: "",
  placaCarreta: "",
  tipoUnidad: "CAMION",
  tipo: "PROPIO",
  mtc: "",
  mtcCarreta: "",
  pesoNeto: "",
  pesoBruto: "",
  cargaUtil: "",
  estado: "ACTIVO",
  propietario: {
    razonSocial: "",
    ruc: "",
    contacto: "",
    telefono: "",
  },
};

function validPlate(value) {
  return /^[A-Z0-9-]{5,20}$/.test(value.trim().toUpperCase());
}

function validateForm(form) {
  const errors = [];

  if (!validPlate(form.placa)) {
    errors.push("La placa es obligatoria y debe tener un formato valido.");
  }

  if (form.placaCarreta.trim() && !validPlate(form.placaCarreta)) {
    errors.push("La placa de carreta debe tener un formato valido.");
  }

  ["pesoNeto", "pesoBruto", "cargaUtil"].forEach((field) => {
    const value = form[field].trim();
    if (!value) return;
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0) {
      errors.push(`El campo ${field} debe ser numerico y no negativo.`);
    }
  });

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
    placa: form.placa.trim().toUpperCase(),
    placaCarreta: form.placaCarreta.trim().toUpperCase() || null,
    tipoUnidad: form.tipoUnidad,
    tipo: form.tipo,
    mtc: form.mtc.trim() || null,
    mtcCarreta: form.mtcCarreta.trim() || null,
    pesoNeto: form.pesoNeto.trim() ? Number(form.pesoNeto) : null,
    pesoBruto: form.pesoBruto.trim() ? Number(form.pesoBruto) : null,
    cargaUtil: form.cargaUtil.trim() ? Number(form.cargaUtil) : null,
    estado: form.estado,
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

export function VehiculoFormPage({
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
    placa: validPlate(form.placa),
    tipoUnidad: Boolean(form.tipoUnidad),
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
          <Link to="/vehiculos" className="flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Vehiculos
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">
            {mode === "create" ? "Nuevo vehiculo" : "Editar vehiculo"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/vehiculos")}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={!allValid || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Guardar vehiculo" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-auto px-8 py-6">
        <div className="flex-1 min-w-0 space-y-4">
          {(submitError || submitDetails.length > 0) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">{submitError || "No se pudo guardar el vehiculo."}</p>
              {submitDetails.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-red-600">
                  {submitDetails.map((detail, index) => <li key={`${detail}-${index}`}>- {detail}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h1 className="text-lg font-semibold text-slate-900">Datos del vehiculo</h1>
              <p className="text-sm text-slate-500">Registra la unidad con su estado operativo y datos documentarios principales.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Placa" required>
                <Input value={form.placa} onChange={(event) => updateField("placa", event.target.value.toUpperCase())} placeholder="T3U-947" />
              </Field>
              <Field label="Placa carreta">
                <Input value={form.placaCarreta} onChange={(event) => updateField("placaCarreta", event.target.value.toUpperCase())} placeholder="Z4H-018" />
              </Field>
              <Field label="Tipo de unidad" required>
                <Select value={form.tipoUnidad} onValueChange={(value) => updateField("tipoUnidad", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_UNIDAD.map((tipoUnidad) => <SelectItem key={tipoUnidad} value={tipoUnidad}>{tipoUnidad}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                    {ESTADOS.map((estado) => <SelectItem key={estado} value={estado}>{estado}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="MTC">
                <Input value={form.mtc} onChange={(event) => updateField("mtc", event.target.value)} placeholder="Registro MTC" />
              </Field>
              <Field label="MTC carreta">
                <Input value={form.mtcCarreta} onChange={(event) => updateField("mtcCarreta", event.target.value)} placeholder="Registro MTC carreta" />
              </Field>
              <Field label="Peso neto">
                <Input value={form.pesoNeto} onChange={(event) => updateField("pesoNeto", event.target.value)} placeholder="0" inputMode="decimal" />
              </Field>
              <Field label="Peso bruto">
                <Input value={form.pesoBruto} onChange={(event) => updateField("pesoBruto", event.target.value)} placeholder="0" inputMode="decimal" />
              </Field>
              <Field label="Carga util">
                <Input value={form.cargaUtil} onChange={(event) => updateField("cargaUtil", event.target.value)} placeholder="0" inputMode="decimal" />
              </Field>
            </div>
          </div>

          {form.tipo === "SUBCONTRATADO" && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Empresa propietaria</h2>
                <p className="text-sm text-slate-500">Este bloque es obligatorio para vehiculos subcontratados.</p>
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
            <SummaryRow label="Placa" value={form.placa.trim() || "Pendiente"} mono />
            <SummaryRow label="Tipo unidad" value={form.tipoUnidad} />
            <SummaryRow label="Tipo" value={TIPOS.find((item) => item.value === form.tipo)?.label || form.tipo} />
            <SummaryRow label="Estado" value={form.estado} />
            {form.tipo === "SUBCONTRATADO" && (
              <SummaryRow label="Empresa" value={form.propietario.razonSocial.trim() || "Pendiente"} />
            )}
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Campos requeridos</h2>
            <ChecklistItem ok={checks.placa} label="Placa valida" />
            <ChecklistItem ok={checks.tipoUnidad} label="Tipo de unidad seleccionado" />
            <ChecklistItem ok={checks.propietario} label="Empresa requerida si es subcontratado" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NuevoVehiculoPage() {
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
      const created = await api.post("/vehiculos", normalizePayload(form));
      navigate(`/vehiculos/${created.id}`);
    } catch (error) {
      setSubmitError(error.message || "No se pudo guardar el vehiculo.");
      setSubmitDetails(mapApiErrors(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VehiculoFormPage
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
