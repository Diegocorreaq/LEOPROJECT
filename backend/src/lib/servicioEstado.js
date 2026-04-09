const ESTADO_SERVICIO_LEGACY = "COMPLETADO";
const ESTADO_SERVICIO_FINAL = "FINALIZADO";
const ESTADOS_SERVICIO = ["PROGRAMADO", "EN_TRANSITO", ESTADO_SERVICIO_FINAL, "CANCELADO"];

function normalizeEstadoServicio(value) {
  if (typeof value !== "string") return value;

  const normalized = value.trim().toUpperCase();
  if (normalized === ESTADO_SERVICIO_LEGACY) {
    return ESTADO_SERVICIO_FINAL;
  }

  return normalized;
}

function buildEstadoServicioWhere(value) {
  const normalized = normalizeEstadoServicio(value);
  if (!normalized) return undefined;

  if (normalized === ESTADO_SERVICIO_FINAL) {
    return { in: [ESTADO_SERVICIO_FINAL, ESTADO_SERVICIO_LEGACY] };
  }

  return normalized;
}

function serializeServicioEstado(servicio) {
  if (!servicio) return servicio;

  return {
    ...servicio,
    estado: normalizeEstadoServicio(servicio.estado),
  };
}

function serializeServiciosEstado(servicios) {
  return (servicios ?? []).map(serializeServicioEstado);
}

module.exports = {
  ESTADOS_SERVICIO,
  ESTADO_SERVICIO_FINAL,
  ESTADO_SERVICIO_LEGACY,
  buildEstadoServicioWhere,
  normalizeEstadoServicio,
  serializeServicioEstado,
  serializeServiciosEstado,
};
