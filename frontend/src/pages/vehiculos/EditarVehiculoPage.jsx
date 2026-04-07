import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { VehiculoFormPage } from "@/pages/vehiculos/NuevoVehiculoPage";

function mapApiErrors(error) {
  if (!(error instanceof ApiError)) return [];
  if (Array.isArray(error.details) && error.details.length > 0) return error.details.map((item) => item.mensaje);
  return error.message ? [error.message] : [];
}

export default function EditarVehiculoPage() {
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

    api.get(`/vehiculos/${id}`)
      .then((vehiculo) => {
        if (!active) return;
        setForm({
          placa: vehiculo.placa ?? "",
          placaCarreta: vehiculo.placaCarreta ?? "",
          tipoUnidad: vehiculo.tipoUnidad ?? "CAMION",
          tipo: vehiculo.tipo ?? "PROPIO",
          mtc: vehiculo.mtc ?? "",
          mtcCarreta: vehiculo.mtcCarreta ?? "",
          pesoNeto: vehiculo.pesoNeto?.toString?.() ?? vehiculo.pesoNeto ?? "",
          pesoBruto: vehiculo.pesoBruto?.toString?.() ?? vehiculo.pesoBruto ?? "",
          cargaUtil: vehiculo.cargaUtil?.toString?.() ?? vehiculo.cargaUtil ?? "",
          estado: vehiculo.estado ?? "ACTIVO",
          propietario: {
            razonSocial: vehiculo.propietarioSubcontratado?.razonSocial ?? "",
            ruc: vehiculo.propietarioSubcontratado?.ruc ?? "",
            contacto: vehiculo.propietarioSubcontratado?.contacto ?? "",
            telefono: vehiculo.propietarioSubcontratado?.telefono ?? "",
          },
        });
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error.message || "No se pudo cargar el vehiculo.");
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
        ...(form.tipo === "SUBCONTRATADO" && {
          propietario: {
            razonSocial: form.propietario.razonSocial.trim(),
            ruc: form.propietario.ruc.trim(),
            contacto: form.propietario.contacto.trim() || null,
            telefono: form.propietario.telefono.trim() || null,
          },
        }),
      };

      const updated = await api.put(`/vehiculos/${id}`, payload);
      navigate(`/vehiculos/${updated.id}`);
    } catch (error) {
      setSubmitError(error.message || "No se pudo actualizar el vehiculo.");
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
          {loadError || "No se pudo cargar el vehiculo."}
        </div>
      </div>
    );
  }

  return (
    <VehiculoFormPage
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
