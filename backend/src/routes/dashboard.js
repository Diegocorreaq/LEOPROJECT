/**
 * dashboard.js — Endpoints de Dashboard
 *
 * Rutas:
 *  GET /api/dashboard/general    KPIs, flujo documental, alertas, actividad reciente
 *  GET /api/dashboard/cobranza   KPIs cobranza, serie mensual, aging, top clientes, facturas críticas
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
const { isoDateQueryField } = require("../validators/common.schema");

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
        new Date(factura.fechaVencimiento) < hoyStart &&
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
          fechaVencimiento: { lt: hoyStart },
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
        return !payment.isClosed && payment.saldo > 0;
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
          diasAtraso: Math.floor(
            (ahora.getTime() - new Date(f.fechaVencimiento).getTime()) / 86400000,
          ),
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
        new Date(f.fechaVencimiento) < ahora &&
        saldo > 0;

      if (esVencida) facturasVencidasCount++;
      if (saldo > 0) pendientePorCobrar += saldo;

      // Aging (solo si tiene fechaVencimiento y tiene saldo)
      if (f.fechaVencimiento != null && saldo > 0) {
        const diasAtraso = Math.floor(
          (ahora.getTime() - new Date(f.fechaVencimiento).getTime()) / 86400000,
        );
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
        const diasAtraso = Math.floor(
          (ahora.getTime() - new Date(f.fechaVencimiento).getTime()) / 86400000,
        );
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

module.exports = router;
