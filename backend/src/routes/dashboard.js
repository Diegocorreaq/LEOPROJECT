/**
 * dashboard.js — Endpoints de Dashboard
 *
 * Rutas:
 *  GET /api/dashboard/general    KPIs, flujo documental, alertas, actividad reciente
 *  GET /api/dashboard/cobranza   KPIs cobranza, serie mensual, aging, top clientes, facturas críticas
 *  GET /api/dashboard/liquidaciones  KPIs y analitica ejecutiva de liquidaciones por rango
 *
 * Seguridad: authMiddleware + requireOperaciones en todo el router.
 */

const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const { serializeServiciosEstado } = require("../lib/servicioEstado");
const { computeFacturaPaymentSnapshot } = require("../lib/facturaPaymentStatus");
const { validate } = require("../lib/validate");
const { isoDateQueryField, uuidQueryField } = require("../validators/common.schema");
const {
  attachLiquidacionEstadoFinanciero,
  computeConductorSettlementSummary,
  groupMovimientosByLiquidacion,
} = require("../modules/liquidaciones/settlement");
const { findMovimientosByLiquidacionIds } = require("../modules/liquidaciones/saldoMovimientos");

const router = express.Router();
router.use(authMiddleware);
router.use(requireOperaciones);

// ─── helpers ────────────────────────────────────────────────────────────────

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Convierte Prisma Decimal (o null) a número JS */
function toNum(v) {
  if (v == null) return 0;
  return Number(v);
}

/** Redondea a 2 decimales */
function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseDateOnly(value) {
  if (!value) return null;
  const part = String(value instanceof Date ? value.toISOString() : value).slice(0, 10);
  const [year, month, day] = part.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysFromToday(dateValue) {
  const date = parseDateOnly(dateValue);
  if (!date) return null;
  return Math.floor((todayDateOnly().getTime() - date.getTime()) / 86400000);
}

function isPastDateOnly(dateValue) {
  const days = daysFromToday(dateValue);
  return days != null && days > 0;
}

/** Resuelve rango de fechas para el dashboard general */
function resolveGeneralRange(rango, desde, hasta) {
  const ahora = new Date();

  if (desde && hasta) {
    return {
      desde: new Date(desde + "T00:00:00"),
      hasta: new Date(hasta + "T23:59:59"),
    };
  }

  const hastaDate = endOfDay(ahora);
  let desdeDate;

  switch (rango) {
    case "today":
      desdeDate = startOfDay(ahora);
      break;
    case "7d":
      desdeDate = new Date(ahora);
      desdeDate.setDate(desdeDate.getDate() - 6);
      desdeDate.setHours(0, 0, 0, 0);
      break;
    case "month":
      desdeDate = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      break;
    default: // 30d
      desdeDate = new Date(ahora);
      desdeDate.setDate(desdeDate.getDate() - 29);
      desdeDate.setHours(0, 0, 0, 0);
  }

  return { desde: desdeDate, hasta: hastaDate };
}

function formatConductorNombre(conductor) {
  if (!conductor) return "Sin conductor";
  const nombre = [conductor.nombre, conductor.apPaterno, conductor.apMaterno]
    .filter(Boolean)
    .join(" ")
    .trim();
  return nombre || "Sin conductor";
}

function resolveLiquidacionFecha(liquidacion) {
  return liquidacion?.servicio?.fechaServicio ?? liquidacion?.createdAt ?? null;
}

function toIsoDayKey(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function toIsoMonthKey(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 7);
}

function buildSerieKeys(desde, hasta, granularity) {
  const keys = [];
  const cursor = new Date(desde);

  if (granularity === "month") {
    const monthCursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
    while (monthCursor <= monthEnd) {
      keys.push(toIsoMonthKey(monthCursor));
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }
    return keys;
  }

  while (cursor <= hasta) {
    keys.push(toIsoDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function formatSerieLabel(key, granularity) {
  if (granularity === "month") {
    const [year, month] = key.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
  }

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

const ESTADO_ANULADA = "ANULADA";

// ─── GET /api/dashboard/general ─────────────────────────────────────────────

const generalQuerySchema = z
  .object({
    rango: z.enum(["today", "7d", "30d", "month"]).optional(),
    desde: isoDateQueryField("desde"),
    hasta: isoDateQueryField("hasta"),
  })
  .strict();

router.get("/general", async (req, res, next) => {
  try {
    const query = validate(generalQuerySchema, req.query, res, "query");
    if (!query) return;

    const { desde, hasta } = resolveGeneralRange(query.rango ?? "30d", query.desde, query.hasta);
    const ahora = new Date();
    const hoyStart = startOfDay(ahora);
    const hoyEnd = endOfDay(ahora);

    const semanaStart = new Date(ahora);
    semanaStart.setDate(semanaStart.getDate() - 6);
    semanaStart.setHours(0, 0, 0, 0);

    // ── KPIs globales (7 queries en paralelo) ──────────────────────────────
    const [
      serviciosHoy,
      serviciosSemana,
      guiasSinVincular,
      facturasSinVincular,
      facturasKpisData,
      liquidacionesPendientes,
    ] = await Promise.all([
      prisma.servicio.count({
        where: { fechaServicio: { gte: hoyStart, lte: hoyEnd } },
      }),
      prisma.servicio.count({
        where: { fechaServicio: { gte: semanaStart } },
      }),
      prisma.guiaRemision.count({
        where: { servicioId: null },
      }),
      prisma.factura.count({
        where: { ordenServicioId: null },
      }),
      prisma.factura.findMany({
        select: {
          fechaVencimiento: true,
          total: true,
          detraccionMonto: true,
          estadoPago: true,
          pagos: { select: { monto: true } },
        },
      }),
      prisma.liquidacion.count({
        where: { status: "PENDIENTE" },
      }),
    ]);

    let facturasPendientesPago = 0;
    let facturasVencidasCount = 0;
    for (const factura of facturasKpisData) {
      const payment = computeFacturaPaymentSnapshot(
        factura.total,
        factura.pagos,
        factura.estadoPago,
        factura.detraccionMonto
      );
      if (payment.isClosed) continue;

      if (payment.status === "PENDIENTE") facturasPendientesPago++;

      const esVencida =
        factura.fechaVencimiento != null &&
        isPastDateOnly(factura.fechaVencimiento) &&
        payment.saldo > 0;
      if (esVencida) facturasVencidasCount++;
    }

    // ── Flujo documental en el rango seleccionado (7 queries en paralelo) ──
    const whereRango = { fechaServicio: { gte: desde, lte: hasta } };
    const whereFacturasRango = { fechaEmision: { gte: desde, lte: hasta } };

    const [
      serviciosTotal,
      serviciosConGuia,
      serviciosConFactura,
      serviciosConGuiaSinFactura,
      facturasSinServicioRango,
      facturasFlujoData,
    ] = await Promise.all([
      prisma.servicio.count({ where: whereRango }),
      prisma.servicio.count({ where: { ...whereRango, guias: { some: {} } } }),
      prisma.servicio.count({
        where: { ...whereRango, orden: { facturas: { some: {} } } },
      }),
      prisma.servicio.count({
        where: {
          ...whereRango,
          guias: { some: {} },
          OR: [{ orden: null }, { orden: { facturas: { none: {} } } }],
        },
      }),
      prisma.factura.count({
        where: { ...whereFacturasRango, ordenServicioId: null },
      }),
      prisma.factura.findMany({
        where: whereFacturasRango,
        select: {
          total: true,
          detraccionMonto: true,
          estadoPago: true,
          pagos: { select: { monto: true } },
        },
      }),
    ]);

    const facturasConPago = facturasFlujoData.reduce((count, factura) => {
      const payment = computeFacturaPaymentSnapshot(
        factura.total,
        factura.pagos,
        factura.estadoPago,
        factura.detraccionMonto
      );
      return payment.status === "PAGADA" ? count + 1 : count;
    }, 0);

    const facturasSinPagoRango = facturasFlujoData.reduce((count, factura) => {
      const payment = computeFacturaPaymentSnapshot(
        factura.total,
        factura.pagos,
        factura.estadoPago,
        factura.detraccionMonto
      );
      if (payment.isClosed) return count;
      if (payment.montoPagado <= 0) return count + 1;
      return count;
    }, 0);

    // ── Alertas (4 queries en paralelo) ────────────────────────────────────
    const [
      guiasSinVincularRecientes,
      facturasObservadasRecientesRaw,
      facturasVencidasAlertaRaw,
      serviciosSinDocumentos,
    ] = await Promise.all([
      prisma.guiaRemision.findMany({
        where: { servicioId: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          serie: true,
          numero: true,
          fechaEmision: true,
          createdAt: true,
          remitenteNombre: true,
          destinatarioNombre: true,
        },
      }),
      prisma.factura.findMany({
        where: {
          OR: [
            { estadoPago: "OBSERVADA" },
            { ordenServicioId: null, estadoPago: { not: ESTADO_ANULADA } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          serie: true,
          numero: true,
          fechaEmision: true,
          total: true,
          detraccionMonto: true,
          estadoPago: true,
          moneda: true,
          ordenServicioId: true,
          pagos: { select: { monto: true } },
          cliente: { select: { razonSocial: true } },
        },
      }),
      prisma.factura.findMany({
        where: {
          fechaVencimiento: { lt: hoyEnd },
          estadoPago: { not: ESTADO_ANULADA },
        },
        orderBy: { fechaVencimiento: "asc" },
        take: 50,
        select: {
          id: true,
          serie: true,
          numero: true,
          fechaEmision: true,
          fechaVencimiento: true,
          total: true,
          detraccionMonto: true,
          estadoPago: true,
          moneda: true,
          pagos: { select: { monto: true } },
          cliente: { select: { razonSocial: true } },
        },
      }),
      prisma.servicio.findMany({
        where: { ...whereRango, guias: { none: {} } },
        orderBy: { fechaServicio: "desc" },
        take: 10,
        select: {
          id: true,
          fechaServicio: true,
          origen: true,
          destino: true,
          estado: true,
        },
      }),
    ]);

    // ── Actividad reciente (3 queries en paralelo) ──────────────────────────
    const [ultimasGuias, ultimasFacturas, ultimosPagos] = await Promise.all([
      prisma.guiaRemision.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          serie: true,
          numero: true,
          fechaEmision: true,
          createdAt: true,
          servicioId: true,
          destinatarioNombre: true,
          remitenteNombre: true,
        },
      }),
      prisma.factura.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          serie: true,
          numero: true,
          fechaEmision: true,
          total: true,
          detraccionMonto: true,
          estadoPago: true,
          moneda: true,
          pagos: { select: { monto: true } },
          cliente: { select: { razonSocial: true } },
        },
      }),
      prisma.pago.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          monto: true,
          fechaPago: true,
          medioPago: true,
          createdAt: true,
          factura: {
            select: {
              serie: true,
              numero: true,
              cliente: { select: { razonSocial: true } },
            },
          },
        },
      }),
    ]);

    const facturasObservadasRecientes = facturasObservadasRecientesRaw
      .filter((f) => {
        const payment = computeFacturaPaymentSnapshot(
          f.total,
          f.pagos,
          f.estadoPago,
          f.detraccionMonto
        );
        return f.estadoPago === "OBSERVADA" || (f.ordenServicioId == null && !payment.isClosed);
      })
      .slice(0, 10)
      .map((f) => {
        const payment = computeFacturaPaymentSnapshot(
          f.total,
          f.pagos,
          f.estadoPago,
          f.detraccionMonto
        );
        return {
          id: f.id,
          serie: f.serie,
          numero: f.numero,
          fechaEmision: f.fechaEmision,
          total: toNum(f.total),
          estadoPago: f.estadoPago === "OBSERVADA" ? "OBSERVADA" : payment.status,
          moneda: f.moneda,
          ordenServicioId: f.ordenServicioId,
          cliente: f.cliente,
        };
      });

    const facturasVencidasAlerta = facturasVencidasAlertaRaw
      .filter((f) => {
        const payment = computeFacturaPaymentSnapshot(
          f.total,
          f.pagos,
          f.estadoPago,
          f.detraccionMonto
        );
        return !payment.isClosed && payment.saldo > 0 && isPastDateOnly(f.fechaVencimiento);
      })
      .slice(0, 10)
      .map((f) => {
        const payment = computeFacturaPaymentSnapshot(
          f.total,
          f.pagos,
          f.estadoPago,
          f.detraccionMonto
        );
        return {
          id: f.id,
          serie: f.serie,
          numero: f.numero,
          fechaEmision: f.fechaEmision,
          fechaVencimiento: f.fechaVencimiento,
          total: toNum(f.total),
          estadoPago: payment.status,
          moneda: f.moneda,
          cliente: f.cliente,
          diasAtraso: daysFromToday(f.fechaVencimiento) ?? 0,
        };
      });

    const ultimasFacturasSerialized = ultimasFacturas.map((f) => {
      const payment = computeFacturaPaymentSnapshot(
        f.total,
        f.pagos,
        f.estadoPago,
        f.detraccionMonto
      );
      return {
        id: f.id,
        serie: f.serie,
        numero: f.numero,
        fechaEmision: f.fechaEmision,
        total: toNum(f.total),
        estadoPago: payment.status,
        moneda: f.moneda,
        cliente: f.cliente,
        montoPagado: round2(payment.montoPagado),
        saldoPendiente: round2(payment.saldo),
      };
    });

    req.log.info("Dashboard general consultado", {
      usuarioId: req.user.id,
      rango: query.rango ?? "30d",
    });

    res.json({
      kpis: {
        serviciosHoy,
        serviciosSemana,
        guiasSinVincular,
        facturasSinVincular,
        facturasPendientesPago,
        facturasVencidas: facturasVencidasCount,
        liquidacionesPendientes,
      },
      flujo: {
        serviciosTotal,
        serviciosConGuia,
        serviciosConFactura,
        facturasConPago,
        serviciosConGuiaSinFactura,
        facturasSinServicio: facturasSinServicioRango,
        facturasSinPago: facturasSinPagoRango,
      },
      alertas: {
        guiasSinVincularRecientes,
        facturasObservadasRecientes,
        facturasVencidas: facturasVencidasAlerta,
        serviciosSinDocumentos: serializeServiciosEstado(serviciosSinDocumentos),
      },
      actividadReciente: {
        ultimasGuias,
        ultimasFacturas: ultimasFacturasSerialized,
        ultimosPagos: ultimosPagos.map((p) => ({ ...p, monto: toNum(p.monto) })),
      },
      meta: {
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        generadoEn: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/dashboard/cobranza ────────────────────────────────────────────

const cobranzaQuerySchema = z
  .object({
    desde: isoDateQueryField("desde"),
    hasta: isoDateQueryField("hasta"),
  })
  .strict();

router.get("/cobranza", async (req, res, next) => {
  try {
    const query = validate(cobranzaQuerySchema, req.query, res, "query");
    if (!query) return;

    const ahora = new Date();
    const mesStart = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const mesEnd = endOfDay(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0));
    const seisMesesAtras = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1);

    // ── KPIs del mes: facturado y cobrado (2 aggregations en paralelo) ──────
    const [facturadoMesAgg, cobradoMesAgg, facturasCobranzaData] = await Promise.all([
      prisma.factura.aggregate({
        where: { fechaEmision: { gte: mesStart, lte: mesEnd } },
        _sum: { total: true },
      }),
      prisma.pago.aggregate({
        where: { fechaPago: { gte: mesStart, lte: mesEnd } },
        _sum: { monto: true },
      }),
      prisma.factura.findMany({
        where: { estadoPago: { not: ESTADO_ANULADA } },
        select: {
          id: true,
          serie: true,
          numero: true,
          clienteId: true,
          fechaEmision: true,
          fechaVencimiento: true,
          total: true,
          detraccionMonto: true,
          estadoPago: true,
          moneda: true,
          cliente: { select: { razonSocial: true, ruc: true } },
          pagos: { select: { monto: true } },
        },
      }),
    ]);

    // ── Dataset de facturas operativas (ANULADA fuera; cierres por saldo en cálculo) ──
    const facturasPendientesData = facturasCobranzaData;

    // ── Computo en JS: saldo, aging, top clientes, facturas críticas ────────
    let pendientePorCobrar = 0;
    let facturasPendientesCount = 0;
    let facturasParcialesCount = 0;
    let facturasPagadasCount = 0;
    let facturasVencidasCount = 0;

    const agingBuckets = {
      porVencer: 0,
      vencido_1_7: 0,
      vencido_8_15: 0,
      vencido_16_30: 0,
      vencido_mas_30: 0,
    };

    const clienteDeuda = {};
    const facturasCriticasList = [];

    for (const f of facturasPendientesData) {
      const payment = computeFacturaPaymentSnapshot(
        f.total,
        f.pagos,
        f.estadoPago,
        f.detraccionMonto
      );
      const montoPagado = payment.montoPagado;
      const saldo = payment.saldo;

      if (payment.status === "PAGADA") facturasPagadasCount++;
      else if (payment.status === "PENDIENTE") facturasPendientesCount++;
      else if (payment.status === "PARCIAL") facturasParcialesCount++;

      const esVencida =
        f.fechaVencimiento != null &&
        isPastDateOnly(f.fechaVencimiento) &&
        saldo > 0;

      if (esVencida) facturasVencidasCount++;
      if (saldo > 0) pendientePorCobrar += saldo;

      // Aging (solo si tiene fechaVencimiento y tiene saldo)
      if (f.fechaVencimiento != null && saldo > 0) {
        const diasAtraso = daysFromToday(f.fechaVencimiento) ?? 0;
        if (diasAtraso < 0) agingBuckets.porVencer += saldo;
        else if (diasAtraso <= 7) agingBuckets.vencido_1_7 += saldo;
        else if (diasAtraso <= 15) agingBuckets.vencido_8_15 += saldo;
        else if (diasAtraso <= 30) agingBuckets.vencido_16_30 += saldo;
        else agingBuckets.vencido_mas_30 += saldo;
      }

      // Top clientes
      if (saldo > 0) {
        const cid = f.clienteId;
        if (!clienteDeuda[cid]) {
          clienteDeuda[cid] = {
            clienteId: cid,
            clienteNombre: f.cliente.razonSocial,
            ruc: f.cliente.ruc,
            cantidadFacturasPendientes: 0,
            montoPendiente: 0,
            montoVencido: 0,
          };
        }
        clienteDeuda[cid].cantidadFacturasPendientes++;
        clienteDeuda[cid].montoPendiente += saldo;
        if (esVencida) clienteDeuda[cid].montoVencido += saldo;
      }

      // Facturas críticas (vencidas con saldo)
      if (esVencida) {
        const diasAtraso = daysFromToday(f.fechaVencimiento) ?? 0;
        facturasCriticasList.push({
          id: f.id,
          numeroCompleto: `${f.serie}-${f.numero}`,
          clienteNombre: f.cliente.razonSocial,
          fechaEmision: f.fechaEmision,
          fechaVencimiento: f.fechaVencimiento,
          total: toNum(f.total),
          montoPagado: round2(montoPagado),
          saldoPendiente: round2(saldo),
          estadoPago: payment.status,
          moneda: f.moneda,
          diasAtraso,
        });
      }
    }

    const topClientesDeuda = Object.values(clienteDeuda)
      .sort((a, b) => b.montoPendiente - a.montoPendiente)
      .slice(0, 10)
      .map((c) => ({
        ...c,
        montoPendiente: round2(c.montoPendiente),
        montoVencido: round2(c.montoVencido),
      }));

    facturasCriticasList.sort((a, b) => b.diasAtraso - a.diasAtraso);
    const facturasCriticas = facturasCriticasList.slice(0, 20);

    // ── Serie mensual últimos 6 meses (2 queries en paralelo) ───────────────
    const [facturasRango, pagosRango] = await Promise.all([
      prisma.factura.findMany({
        where: { fechaEmision: { gte: seisMesesAtras } },
        select: { fechaEmision: true, total: true },
      }),
      prisma.pago.findMany({
        where: { fechaPago: { gte: seisMesesAtras } },
        select: { fechaPago: true, monto: true },
      }),
    ]);

    const serieMap = {};
    for (const f of facturasRango) {
      const periodo = new Date(f.fechaEmision).toISOString().slice(0, 7);
      if (!serieMap[periodo]) serieMap[periodo] = { periodo, facturado: 0, cobrado: 0 };
      serieMap[periodo].facturado += toNum(f.total);
    }
    for (const p of pagosRango) {
      const periodo = new Date(p.fechaPago).toISOString().slice(0, 7);
      if (!serieMap[periodo]) serieMap[periodo] = { periodo, facturado: 0, cobrado: 0 };
      serieMap[periodo].cobrado += toNum(p.monto);
    }

    const serieMensual = Object.values(serieMap)
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
      .map((s) => ({
        ...s,
        facturado: round2(s.facturado),
        cobrado: round2(s.cobrado),
      }));

    req.log.info("Dashboard cobranza consultado", { usuarioId: req.user.id });

    res.json({
      kpis: {
        totalFacturadoMes: round2(toNum(facturadoMesAgg._sum.total)),
        totalCobradoMes: round2(toNum(cobradoMesAgg._sum.monto)),
        pendientePorCobrar: round2(pendientePorCobrar),
        facturasPendientes: facturasPendientesCount,
        facturasParciales: facturasParcialesCount,
        facturasPagadas: facturasPagadasCount,
        facturasVencidas: facturasVencidasCount,
      },
      serieMensual,
      aging: {
        porVencer: round2(agingBuckets.porVencer),
        vencido_1_7: round2(agingBuckets.vencido_1_7),
        vencido_8_15: round2(agingBuckets.vencido_8_15),
        vencido_16_30: round2(agingBuckets.vencido_16_30),
        vencido_mas_30: round2(agingBuckets.vencido_mas_30),
      },
      topClientesDeuda,
      facturasCriticas,
      meta: { generadoEn: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

const liquidacionesDashboardQuerySchema = z
  .object({
    conductorId: uuidQueryField("conductorId"),
    topOrder: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
      z.enum(["EMPRESA_LE_DEBE_MAS", "DEBEN_MAS_A_EMPRESA"]).optional(),
    ),
  })
  .strict();

router.get("/liquidaciones", async (req, res, next) => {
  try {
    const query = validate(liquidacionesDashboardQuerySchema, req.query, res, "query");
    if (!query) return;

    const conductorId = query.conductorId ?? null;
    const topOrder = query.topOrder ?? "DEBEN_MAS_A_EMPRESA";
    const ahora = new Date();

    const liquidacionesRaw = await prisma.liquidacion.findMany({
      where: {
        ...(conductorId ? { conductorId } : {}),
      },
      select: {
        id: true,
        servicioId: true,
        conductorId: true,
        status: true,
        montoEntregado: true,
        totalGastos: true,
        saldo: true,
        createdAt: true,
        conductor: {
          select: {
            id: true,
            nombre: true,
            apPaterno: true,
            apMaterno: true,
          },
        },
        servicio: {
          select: {
            id: true,
            fechaServicio: true,
            origen: true,
            destino: true,
          },
        },
      },
    });
    const liquidacionIds = liquidacionesRaw.map((item) => item.id).filter(Boolean);
    const movimientos = await findMovimientosByLiquidacionIds(prisma, liquidacionIds, {
      includeRelations: false,
      orderDirection: "asc",
    });
    const groupedMovimientos = groupMovimientosByLiquidacion(movimientos);
    const liquidacionesConEstado = liquidacionesRaw.map((liquidacion) =>
      attachLiquidacionEstadoFinanciero(
        {
          ...liquidacion,
          montoEntregado: toNum(liquidacion.montoEntregado),
          totalGastos: toNum(liquidacion.totalGastos),
          saldo: toNum(liquidacion.saldo),
        },
        groupedMovimientos.get(liquidacion.id) ?? [],
      ),
    );
    const liquidaciones = liquidacionesConEstado.filter((item) =>
      ["PENDIENTE_REGULARIZAR", "PARCIALMENTE_COMPENSADA"].includes(item.estadoRegularizacion),
    );
    const fechasOrdenadas = liquidaciones
      .map((item) => resolveLiquidacionFecha(item))
      .filter(Boolean)
      .map((value) => new Date(value))
      .sort((a, b) => a.getTime() - b.getTime());
    const desde = fechasOrdenadas.length > 0 ? startOfDay(fechasOrdenadas[0]) : startOfDay(ahora);
    const hasta = fechasOrdenadas.length > 0 ? endOfDay(fechasOrdenadas[fechasOrdenadas.length - 1]) : endOfDay(ahora);
    const spanDays = Math.max(1, Math.floor((hasta.getTime() - desde.getTime()) / 86400000) + 1);
    const granularity = spanDays > 45 ? "month" : "day";

    const kpis = {
      totalLiquidaciones: 0,
      montoEntregado: 0,
      totalGastos: 0,
      saldoBaseNeto: 0,
      saldoNeto: 0,
      liquidacionesConPendienteReal: 0,
      pendientesRegularizar: 0,
      parcialmenteCompensadas: 0,
      compensadas: 0,
      sinSaldo: 0,
      pendientes: 0,
      sinRendicion: 0,
      cuadradas: 0,
      favorEmpresa: 0,
      favorConductor: 0,
      montoFavorEmpresa: 0,
      montoFavorConductor: 0,
    };

    const porEstadoRendicionMap = {};
    const porEstadoRegularizacionMap = {};
    const porResultadoEconomicoMap = {};
    const topConductoresBaseMap = new Map();
    const pendientesRaw = [];
    const serieMap = new Map(
      buildSerieKeys(desde, hasta, granularity).map((key) => [
        key,
        {
          label: formatSerieLabel(key, granularity),
          montoEntregado: 0,
          totalGastos: 0,
          saldoBaseNeto: 0,
          saldoPendienteNeto: 0,
        },
      ]),
    );

    for (const liquidacion of liquidaciones) {
      const montoEntregado = toNum(liquidacion.montoEntregado);
      const totalGastos = toNum(liquidacion.totalGastos);
      const saldoBase = toNum(liquidacion.saldo);
      const saldoPendiente = toNum(liquidacion.saldoPendiente);
      const fechaRef = resolveLiquidacionFecha(liquidacion);
      if (!fechaRef) continue;

      kpis.totalLiquidaciones += 1;
      kpis.montoEntregado += montoEntregado;
      kpis.totalGastos += totalGastos;
      kpis.saldoBaseNeto += saldoBase;
      kpis.saldoNeto += saldoPendiente;

      if (Math.abs(saldoPendiente) > 0) {
        kpis.liquidacionesConPendienteReal += 1;
      }
      if (saldoPendiente > 0) {
        kpis.favorEmpresa += 1;
        kpis.montoFavorEmpresa += saldoPendiente;
      } else if (saldoPendiente < 0) {
        kpis.favorConductor += 1;
        kpis.montoFavorConductor += Math.abs(saldoPendiente);
      }

      switch (liquidacion.estadoRegularizacion) {
        case "SIN_SALDO":
          kpis.sinSaldo += 1;
          break;
        case "PENDIENTE_REGULARIZAR":
          kpis.pendientesRegularizar += 1;
          break;
        case "PARCIALMENTE_COMPENSADA":
          kpis.parcialmenteCompensadas += 1;
          break;
        case "COMPENSADA":
          kpis.compensadas += 1;
          break;
        default:
          break;
      }

      if (liquidacion.resultadoEconomico === "SIN_RENDICION") kpis.sinRendicion += 1;
      if (liquidacion.resultadoEconomico === "CUADRADA") kpis.cuadradas += 1;
      if (liquidacion.status === "PENDIENTE") {
        kpis.pendientes += 1;
      }

      porEstadoRendicionMap[liquidacion.status] = (porEstadoRendicionMap[liquidacion.status] ?? 0) + 1;
      porEstadoRegularizacionMap[liquidacion.estadoRegularizacion] =
        (porEstadoRegularizacionMap[liquidacion.estadoRegularizacion] ?? 0) + 1;
      porResultadoEconomicoMap[liquidacion.resultadoEconomico] =
        (porResultadoEconomicoMap[liquidacion.resultadoEconomico] ?? 0) + 1;

      const conductorId = liquidacion.conductorId ?? liquidacion.conductor?.id ?? "SIN_CONDUCTOR";
      const conductorNombre = formatConductorNombre(liquidacion.conductor);
      const currentConductor = topConductoresBaseMap.get(conductorId) ?? {
        conductorId,
        conductorNombre,
        cantidadLiquidaciones: 0,
        montoEntregado: 0,
        totalGastos: 0,
        saldoBaseNeto: 0,
        saldoPendienteNeto: 0,
        liquidacionesConPendienteReal: 0,
      };

      currentConductor.cantidadLiquidaciones += 1;
      currentConductor.montoEntregado += montoEntregado;
      currentConductor.totalGastos += totalGastos;
      currentConductor.saldoBaseNeto += saldoBase;
      currentConductor.saldoPendienteNeto += saldoPendiente;
      if (Math.abs(saldoPendiente) > 0) currentConductor.liquidacionesConPendienteReal += 1;
      topConductoresBaseMap.set(conductorId, currentConductor);

      const serieKey = granularity === "month" ? toIsoMonthKey(fechaRef) : toIsoDayKey(fechaRef);
      const serieItem = serieMap.get(serieKey) ?? {
        label: formatSerieLabel(serieKey, granularity),
        montoEntregado: 0,
        totalGastos: 0,
        saldoBaseNeto: 0,
        saldoPendienteNeto: 0,
      };
      serieItem.montoEntregado += montoEntregado;
      serieItem.totalGastos += totalGastos;
      serieItem.saldoBaseNeto += saldoBase;
      serieItem.saldoPendienteNeto += saldoPendiente;
      serieMap.set(serieKey, serieItem);

      if (Math.abs(saldoPendiente) > 0) {
        const fechaServicio = liquidacion.servicio?.fechaServicio ?? liquidacion.createdAt;
        const ruta = [liquidacion.servicio?.origen, liquidacion.servicio?.destino]
          .filter(Boolean)
          .join(" -> ");
        const diasPendiente = Math.max(
          0,
          Math.floor((startOfDay(ahora).getTime() - startOfDay(new Date(fechaServicio)).getTime()) / 86400000),
        );

        pendientesRaw.push({
          id: liquidacion.id,
          servicioId: liquidacion.servicioId,
          fechaServicio,
          conductorNombre,
          ruta: ruta || "-",
          montoEntregado,
          totalGastos,
          saldo: saldoBase,
          saldoPendiente,
          estadoRegularizacion: liquidacion.estadoRegularizacion,
          resultadoEconomico: liquidacion.resultadoEconomico,
          status: liquidacion.status,
          diasPendiente,
        });
      }
    }

    const porEstadoRendicion = ["PENDIENTE", "LIQUIDADA"].map((estado) => ({
      estado,
      cantidad: porEstadoRendicionMap[estado] ?? 0,
    }));
    const porEstadoRegularizacion = ["PENDIENTE_REGULARIZAR", "PARCIALMENTE_COMPENSADA"].map((estado) => ({
      estado,
      cantidad: porEstadoRegularizacionMap[estado] ?? 0,
    }));
    const porResultadoEconomico = [
      "SIN_RENDICION",
      "CUADRADA",
      "FAVOR_EMPRESA",
      "FAVOR_CONDUCTOR",
    ].map((resultado) => ({
      resultado,
      cantidad: porResultadoEconomicoMap[resultado] ?? 0,
    }));
    const porEstado = porEstadoRegularizacion;

    const serie = Array.from(serieMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        key,
        label: value.label,
        montoEntregado: round2(value.montoEntregado),
        totalGastos: round2(value.totalGastos),
        saldoBaseNeto: round2(value.saldoBaseNeto),
        saldoPendienteNeto: round2(value.saldoPendienteNeto),
        saldoNeto: round2(value.saldoPendienteNeto),
      }));

    const conductorSummaryMap = new Map(
      computeConductorSettlementSummary(liquidaciones).map((item) => [item.conductorId, item]),
    );
    const conductoresConsolidado = Array.from(topConductoresBaseMap.values())
      .map((base) => {
        const summary = conductorSummaryMap.get(base.conductorId) ?? {};
        const deudaNetaPendiente = toNum(summary.deudaNetaPendiente ?? base.saldoPendienteNeto);
        const pendientesRegularizar = Number(summary.pendientesRegularizar ?? 0);
        const parcialmenteCompensadas = Number(summary.parcialmenteCompensadas ?? 0);
        return {
          ...base,
          saldoNeto: base.saldoBaseNeto,
          deudaNetaPendiente,
          totalFavorEmpresaPendiente: toNum(summary.totalFavorEmpresaPendiente ?? 0),
          totalFavorConductorPendiente: toNum(summary.totalFavorConductorPendiente ?? 0),
          pendientesRegularizar,
          parcialmenteCompensadas,
          compensadas: Number(summary.compensadas ?? 0),
          sinSaldo: Number(summary.sinSaldo ?? 0),
          pendientes: pendientesRegularizar + parcialmenteCompensadas,
        };
      })
      .filter(
        (item) =>
          item.liquidacionesConPendienteReal > 0 &&
          (Math.abs(item.totalFavorEmpresaPendiente) > 0 || Math.abs(item.totalFavorConductorPendiente) > 0),
      )
      .map((item) => ({
        ...item,
        montoEntregado: round2(item.montoEntregado),
        totalGastos: round2(item.totalGastos),
        saldoBaseNeto: round2(item.saldoBaseNeto),
        saldoPendienteNeto: round2(item.saldoPendienteNeto),
        saldoNeto: round2(item.saldoBaseNeto),
        deudaNetaPendiente: round2(item.deudaNetaPendiente),
        totalFavorEmpresaPendiente: round2(item.totalFavorEmpresaPendiente),
        totalFavorConductorPendiente: round2(item.totalFavorConductorPendiente),
      }));

    let topConductores = [];
    if (conductorId) {
      const selected = conductoresConsolidado.find((item) => item.conductorId === conductorId);
      topConductores = selected ? [selected] : [];
    } else if (topOrder === "EMPRESA_LE_DEBE_MAS") {
      topConductores = [...conductoresConsolidado]
        .sort((a, b) => {
          if (b.totalFavorConductorPendiente !== a.totalFavorConductorPendiente) {
            return b.totalFavorConductorPendiente - a.totalFavorConductorPendiente;
          }
          if (a.deudaNetaPendiente !== b.deudaNetaPendiente) {
            return a.deudaNetaPendiente - b.deudaNetaPendiente;
          }
          return b.cantidadLiquidaciones - a.cantidadLiquidaciones;
        })
        .slice(0, 10);
    } else {
      topConductores = [...conductoresConsolidado]
        .sort((a, b) => {
          if (b.totalFavorEmpresaPendiente !== a.totalFavorEmpresaPendiente) {
            return b.totalFavorEmpresaPendiente - a.totalFavorEmpresaPendiente;
          }
          if (b.deudaNetaPendiente !== a.deudaNetaPendiente) {
            return b.deudaNetaPendiente - a.deudaNetaPendiente;
          }
          return b.cantidadLiquidaciones - a.cantidadLiquidaciones;
        })
        .slice(0, 10);
    }
    const selectedConductorSummary = conductorId
      ? conductoresConsolidado.find((item) => item.conductorId === conductorId) ?? null
      : null;

    const alertas = {
      pendientes: pendientesRaw
        .sort((a, b) => {
          const byDate = new Date(a.fechaServicio).getTime() - new Date(b.fechaServicio).getTime();
          if (byDate !== 0) return byDate;
          return Math.abs(b.saldoPendiente) - Math.abs(a.saldoPendiente);
        })
        .slice(0, 8)
        .map((item) => ({
          ...item,
          montoEntregado: round2(item.montoEntregado),
          totalGastos: round2(item.totalGastos),
          saldo: round2(item.saldo),
          saldoPendiente: round2(item.saldoPendiente),
        })),
    };

    req.log.info("Dashboard liquidaciones consultado", {
      usuarioId: req.user.id,
      conductorId,
      topOrder,
      cantidadLiquidacionesAbiertas: kpis.totalLiquidaciones,
    });

    res.json({
      kpis: {
        totalLiquidaciones: kpis.totalLiquidaciones,
        montoEntregado: round2(kpis.montoEntregado),
        totalGastos: round2(kpis.totalGastos),
        saldoNeto: round2(kpis.saldoNeto),
        saldoBaseNeto: round2(kpis.saldoBaseNeto),
        pendientes: kpis.pendientes,
        pendientesRegularizar: kpis.pendientesRegularizar,
        parcialmenteCompensadas: kpis.parcialmenteCompensadas,
        compensadas: kpis.compensadas,
        sinSaldo: kpis.sinSaldo,
        liquidacionesConPendienteReal: kpis.liquidacionesConPendienteReal,
        sinRendicion: kpis.sinRendicion,
        cuadradas: kpis.cuadradas,
        favorEmpresa: kpis.favorEmpresa,
        favorConductor: kpis.favorConductor,
        montoFavorEmpresa: round2(kpis.montoFavorEmpresa),
        montoFavorConductor: round2(kpis.montoFavorConductor),
        totalFavorEmpresaPendiente: round2(kpis.montoFavorEmpresa),
        totalFavorConductorPendiente: round2(kpis.montoFavorConductor),
      },
      porEstado,
      porEstadoRendicion,
      porEstadoRegularizacion,
      porResultadoEconomico,
      serie,
      topConductores,
      selectedConductorSummary,
      alertas,
      meta: {
        conductorId,
        topOrder,
        granularity,
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        scope: "solo liquidaciones pendientes de regularizacion",
        saldoConvencion: {
          positivo: "saldo > 0 => el conductor debe a la empresa",
          negativo: "saldo < 0 => la empresa le debe al conductor",
          cero: "saldo = 0 => liquidacion cuadrada",
        },
        filtroFecha: "servicio.fechaServicio (fallback: liquidacion.createdAt sin servicio vinculado)",
        generadoEn: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
