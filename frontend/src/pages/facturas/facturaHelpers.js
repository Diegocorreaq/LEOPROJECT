import { formatDateShort, formatDateLong } from "@/lib/dateOnly";

export function fmtTotal(val, moneda) {
  if (val == null) return "-";
  const prefix = moneda === "USD" ? "$ " : "S/ ";
  return `${prefix}${Number(val).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

export function fechaCorta(iso) {
  return formatDateShort(iso);
}

export function fechaLarga(iso) {
  return formatDateLong(iso);
}

// Vencida: fechaVencimiento pasada y estadoPago no es PAGADA ni ANULADA
export function isFacturaVencida(f) {
  if (!f?.fechaVencimiento) return false;
  if (f.estadoPago === "PAGADA" || f.estadoPago === "ANULADA") return false;
  return new Date(f.fechaVencimiento) < new Date();
}

// Por vencer: vence entre hoy y los próximos 7 días, excluyendo PAGADA/ANULADA
export function isFacturaPorVencer(f) {
  if (!f?.fechaVencimiento) return false;
  if (f.estadoPago === "PAGADA" || f.estadoPago === "ANULADA") return false;
  const venc = new Date(f.fechaVencimiento);
  const hoy = new Date();
  const en7dias = new Date(hoy);
  en7dias.setDate(en7dias.getDate() + 7);
  return venc >= hoy && venc <= en7dias;
}

// Primera guía relacionada como string "SERIE-NUMERO"
export function getFacturaPrimaryGuia(f) {
  const guias = f?.guias ?? [];
  if (guias.length === 0) return null;
  const g = guias[0];
  return `${g.serieGuia}-${g.numeroGuia}`;
}

// Resumen del servicio vinculado
export function getFacturaServicioResumen(f) {
  const servicio = f?.ordenServicio?.servicio;
  if (!servicio) return null;
  return {
    id: servicio.id,
    placa: servicio.vehiculo?.placa ?? null,
    origen: servicio.origen ?? null,
    destino: servicio.destino ?? null,
    ruta:
      servicio.origen && servicio.destino
        ? `${servicio.origen} → ${servicio.destino}`
        : servicio.origen ?? servicio.destino ?? null,
  };
}

// Alertas operativas de una factura — devuelve array de { key, label, color }
export function getFacturaAlertas(f) {
  if (!f) return [];
  const alertas = [];
  const cantGuias = f.guias?.length ?? f.cantidadGuias ?? 0;
  const tieneServicio = !!f.ordenServicioId;
  const esCredito = f.formaPago === "CREDITO";
  const tieneDetraccion =
    Number(f.detraccionMonto) > 0 || Number(f.detraccionPorcentaje) > 0;

  if (isFacturaVencida(f)) {
    alertas.push({ key: "VENCIDA", label: "Vencida", color: "red" });
  } else if (isFacturaPorVencer(f)) {
    alertas.push({ key: "POR_VENCER", label: "Por vencer", color: "amber" });
  }

  if (esCredito && !f.fechaVencimiento) {
    alertas.push({ key: "CREDITO_SIN_VENC", label: "Crédito sin venc.", color: "amber" });
  }

  if (!tieneServicio) {
    alertas.push({ key: "SIN_SERVICIO", label: "Sin servicio", color: "slate" });
  }

  if (cantGuias === 0) {
    alertas.push({ key: "SIN_GUIA", label: "Sin guía", color: "slate" });
  }

  if (tieneDetraccion) {
    alertas.push({ key: "DETRACCION", label: "Detracción", color: "blue" });
  }

  return alertas;
}
