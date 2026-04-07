import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ConductorFormPage } from "@/pages/conductores/NuevoConductorPage";

function mapApiErrors(error) {
  if (!(error instanceof ApiError)) return [];
  if (Array.isArray(error.details) && error.details.length > 0) return error.details.map((item) => item.mensaje);
  return error.message ? [error.message] : [];
}

export default function EditarConductorPage() {
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

    api.get(`/conductores/${id}`)
      .then((conductor) => {
        if (!active) return;
        setForm({
          nombre: conductor.nombre ?? "",
          apPaterno: conductor.apPaterno ?? "",
          apMaterno: conductor.apMaterno ?? "",
          tipoDocumento: conductor.tipoDocumento ?? "DNI",
          nroDocumento: conductor.nroDocumento ?? "",
          licencia: conductor.licencia ?? "",
          tipo: conductor.tipo ?? "PROPIO",
          estado: conductor.activo ? "ACTIVO" : "INACTIVO",
          propietario: {
            razonSocial: conductor.propietarioSubcontratado?.razonSocial ?? "",
            ruc: conductor.propietarioSubcontratado?.ruc ?? "",
            contacto: conductor.propietarioSubcontratado?.contacto ?? "",
            telefono: conductor.propietarioSubcontratado?.telefono ?? "",
          },
        });
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error.message || "No se pudo cargar el conductor.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmit() {
    if (!form) return;

    setSubmitting(true);
    setSubmitError("");
    setSubmitDetails([]);

    try {
      const payload = {
        nombre: form.nombre.trim(),
        apPaterno: form.apPaterno.trim(),
        apMaterno: form.apMaterno.trim() || null,
        tipoDocumento: form.tipoDocumento,
        nroDocumento: form.nroDocumento.trim(),
        licencia: form.licencia.trim() || null,
        tipo: form.tipo,
        activo: form.estado === "ACTIVO",
        ...(form.tipo === "SUBCONTRATADO" && {
          propietario: {
            razonSocial: form.propietario.razonSocial.trim(),
            ruc: form.propietario.ruc.trim(),
            contacto: form.propietario.contacto.trim() || null,
            telefono: form.propietario.telefono.trim() || null,
          },
        }),
      };

      const updated = await api.put(`/conductores/${id}`, payload);
      navigate(`/conductores/${updated.id}`);
    } catch (error) {
      setSubmitError(error.message || "No se pudo actualizar el conductor.");
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
          {loadError || "No se pudo cargar el conductor."}
        </div>
      </div>
    );
  }

  return (
    <ConductorFormPage
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
