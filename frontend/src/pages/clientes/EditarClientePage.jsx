import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ClienteFormPage } from "@/pages/clientes/NuevoClientePage";

function mapApiErrors(error) {
  if (!(error instanceof ApiError)) return [];
  if (Array.isArray(error.details) && error.details.length > 0) return error.details.map((item) => item.mensaje);
  return error.message ? [error.message] : [];
}

export default function EditarClientePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitDetails, setSubmitDetails] = useState([]);

  useEffect(() => {
    let active = true;

    api.get(`/clientes/${id}`)
      .then((cliente) => {
        if (!active) return;
        setForm({
          razonSocial: cliente.razonSocial ?? "",
          ruc: cliente.ruc ?? "",
          email: cliente.email ?? "",
          telefono: cliente.telefono ?? "",
          direccion: cliente.direccion ?? "",
        });
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error.message || "No se pudo cargar el cliente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    setSubmitDetails([]);

    try {
      const updated = await api.put(`/clientes/${id}`, {
        razonSocial: form.razonSocial.trim(),
        ruc: form.ruc.trim(),
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
      });

      navigate(`/clientes/${updated.id}`);
    } catch (error) {
      setSubmitError(error.message || "No se pudo actualizar el cliente.");
      setSubmitDetails(mapApiErrors(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {loadError || "No se pudo cargar el cliente."}
        </div>
      </div>
    );
  }

  return (
    <ClienteFormPage
      mode="edit"
      form={form}
      setForm={setForm}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
      submitDetails={submitDetails}
    />
  );
}
