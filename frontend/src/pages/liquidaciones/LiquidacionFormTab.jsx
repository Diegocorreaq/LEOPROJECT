import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import ServicioLiquidacionPicker from "./ServicioLiquidacionPicker";
import {
  computeLiquidacion,
  formatCurrency,
  formatDate,
  getClienteReferencia,
  getConductorNombre,
  getRutaLabel,
  LIQUIDACION_STATUS,
  LIQUIDACION_STATUS_CFG,
} from "./liquidacion-helpers";

const EMPTY_FORM = {
  montoEntregado: "",
  viaticos: "",
  peajes: "",
  combustible: "",
  galones: "",
  otros: "",
  status: "PENDIENTE",
  observaciones: "",
};

function Section({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ReadOnlyGrid({ servicio }) {
  if (!servicio) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <InfoCard label="Fecha servicio" value={formatDate(servicio.fechaServicio)} />
      <InfoCard label="Conductor" value={getConductorNombre(servicio.conductor)} />
      <InfoCard label="Placa" value={servicio.vehiculo?.placa ?? "-"} />
      <InfoCard label="Ruta" value={getRutaLabel(servicio)} />
      <InfoCard label="Cliente / pagador" value={getClienteReferencia(servicio)} />
      <InfoCard label="Estado servicio" value={servicio.estado ?? "-"} />
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value || "-"}</p>
    </div>
  );
}

function MoneyField({ label, value, onChange, disabled = false, name }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
        placeholder="0.00"
      />
    </label>
  );
}

function QuantityField({ label, value, onChange, disabled = false, name }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
        placeholder="0"
      />
    </label>
  );
}

export default function LiquidacionFormTab({
  mode = "create",
  liquidacionId = "",
  initialServiceId = "",
  lockInitialService = false,
  focusService = false,
  onCancel,
  onSaved,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(() => mode === "edit" || Boolean(initialServiceId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        if (mode === "edit" && liquidacionId) {
          const liquidacion = await api.get(`/liquidaciones/${liquidacionId}`);
          if (!active) return;

          setForm({
            montoEntregado: liquidacion.montoEntregado ?? "",
            viaticos: liquidacion.viaticos ?? "",
            peajes: liquidacion.peajes ?? "",
            combustible: liquidacion.combustible ?? "",
            galones: liquidacion.galones ?? "",
            otros: liquidacion.otros ?? "",
            status: LIQUIDACION_STATUS.includes(liquidacion.status) ? liquidacion.status : "PENDIENTE",
            observaciones: liquidacion.observaciones ?? "",
          });
          setSelectedService(liquidacion.servicio);
          setError("");
          return;
        }

        if (initialServiceId) {
          const servicio = await api.get(`/servicios/${initialServiceId}`);
          if (!active) return;
          setSelectedService(servicio);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || "No se pudo cargar la liquidacion.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    hydrate();
    return () => {
      active = false;
    };
  }, [initialServiceId, liquidacionId, mode]);

  const computed = useMemo(
    () =>
      computeLiquidacion({
        montoEntregado: form.montoEntregado,
        viaticos: form.viaticos,
        peajes: form.peajes,
        combustible: form.combustible,
        galones: form.galones,
        otros: form.otros,
        status: form.status,
      }),
    [form],
  );

  const serviceLocked = mode === "create" && Boolean(initialServiceId) && lockInitialService;
  const selectedServiceHasOtherLiquidacion =
    selectedService?.liquidacion &&
    (!liquidacionId || selectedService.liquidacion.id !== liquidacionId);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedService?.id) {
      setError("Debes seleccionar un servicio para registrar la liquidacion.");
      return;
    }

    if (selectedServiceHasOtherLiquidacion) {
      setError("El servicio seleccionado ya tiene una liquidacion registrada.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      servicioId: selectedService.id,
      montoEntregado: form.montoEntregado === "" ? 0 : Number(form.montoEntregado || 0),
      viaticos: form.viaticos === "" ? 0 : Number(form.viaticos || 0),
      peajes: form.peajes === "" ? 0 : Number(form.peajes || 0),
      combustible: form.combustible === "" ? 0 : Number(form.combustible || 0),
      galones: form.galones === "" ? 0 : Number(form.galones || 0),
      otros: form.otros === "" ? 0 : Number(form.otros || 0),
      status: form.status,
      observaciones: form.observaciones?.trim() || null,
    };

    try {
      const response =
        mode === "edit"
          ? await api.put(`/liquidaciones/${liquidacionId}`, payload)
          : await api.post("/liquidaciones", payload);

      onSaved?.(response);
    } catch (err) {
      setError(
        err.message ||
          (mode === "edit"
            ? "No se pudo actualizar la liquidacion."
            : "No se pudo crear la liquidacion."),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-8 py-6">
      <form className="mx-auto max-w-6xl space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {focusService && mode === "edit" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Puedes reasignar esta liquidacion cambiando el servicio seleccionado en la seccion
            inferior.
          </div>
        )}

        <Section
          title="Servicio"
          description="La liquidacion siempre debe quedar vinculada a un servicio. El conductor se hereda automaticamente."
        >
          <ServicioLiquidacionPicker
            key={`${mode}-${liquidacionId || initialServiceId || "nuevo"}`}
            selectedService={selectedService}
            onSelect={setSelectedService}
            liquidacionId={mode === "edit" ? liquidacionId : ""}
            locked={serviceLocked}
            disabled={saving}
          />
          <ReadOnlyGrid servicio={selectedService} />
        </Section>

        <Section title="Datos financieros" description="Ingresa los montos de la liquidacion. Galones es solo una cantidad de referencia y no suma al total de gastos.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MoneyField
              label="Monto entregado"
              name="montoEntregado"
              value={form.montoEntregado}
              onChange={handleFieldChange}
              disabled={saving}
            />
            <MoneyField
              label="Viaticos"
              name="viaticos"
              value={form.viaticos}
              onChange={handleFieldChange}
              disabled={saving}
            />
            <MoneyField
              label="Peajes"
              name="peajes"
              value={form.peajes}
              onChange={handleFieldChange}
              disabled={saving}
            />
            <MoneyField
              label="Combustible"
              name="combustible"
              value={form.combustible}
              onChange={handleFieldChange}
              disabled={saving}
            />
            <QuantityField
              label="Galones ingresados"
              name="galones"
              value={form.galones}
              onChange={handleFieldChange}
              disabled={saving}
            />
            <MoneyField
              label="Otros"
              name="otros"
              value={form.otros}
              onChange={handleFieldChange}
              disabled={saving}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                name="status"
                value={form.status}
                onChange={handleFieldChange}
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              >
                {Object.entries(LIQUIDACION_STATUS_CFG).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Observaciones</span>
              <textarea
                name="observaciones"
                rows={4}
                maxLength={2000}
                value={form.observaciones}
                onChange={handleFieldChange}
                disabled={saving}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                placeholder="Notas internas de la liquidacion..."
              />
            </label>
          </div>
        </Section>

        <Section title="Totales calculados" description="Estos valores se recalculan en backend y tambien se muestran en vivo mientras editas.">
          <div className="grid gap-3 md:grid-cols-3">
            <InfoCard label="Total de gastos" value={formatCurrency(computed.totalGastos)} />
            <InfoCard label="Saldo" value={formatCurrency(computed.saldo)} />
            <InfoCard label="Detalle saldo" value={computed.detalleSaldo || "-"} />
          </div>
        </Section>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !selectedService?.id}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving
              ? mode === "edit"
                ? "Guardando..."
                : "Creando..."
              : mode === "edit"
                ? "Guardar cambios"
                : "Registrar liquidacion"}
          </Button>
        </div>
      </form>
    </div>
  );
}
