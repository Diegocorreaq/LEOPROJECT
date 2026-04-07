const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Incluir relaciones comunes en los queries
const servicioInclude = {
  vehiculo: {
    include: { propietarioSubcontratado: true },
  },
  conductor: {
    include: { propietarioSubcontratado: true },
  },
  clientes: {
    include: { cliente: true },
  },
  guias: true,
  liquidacion: true,
  orden: true,
};

// GET /api/servicios
router.get("/", async (req, res) => {
  try {
    // Ordenar por createdAt ASC para asignar códigos estables
    const servicios = await prisma.servicio.findMany({
      include: servicioInclude,
      orderBy: { createdAt: "asc" },
    });

    // Generar código SVC-YYMM-NNN estable por mes
    const counters = {};
    servicios.forEach(s => {
      const d = new Date(s.createdAt);
      const yy = String(d.getUTCFullYear()).slice(2);
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const key = `${yy}${mm}`;
      counters[key] = (counters[key] || 0) + 1;
      s.codigo = `SVC-${key}-${String(counters[key]).padStart(3, "0")}`;
    });

    // Devolver por fechaServicio desc para la tabla
    servicios.sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio));

    res.json(servicios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener servicios" });
  }
});

// GET /api/servicios/:id
router.get("/:id", async (req, res) => {
  try {
    const servicio = await prisma.servicio.findUnique({
      where: { id: req.params.id },
      include: servicioInclude,
    });
    if (!servicio) return res.status(404).json({ error: "Servicio no encontrado" });
    res.json(servicio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener servicio" });
  }
});

// POST /api/servicios
router.post("/", async (req, res) => {
  try {
    const {
      fechaServicio,
      origen,
      destino,
      estado = "PROGRAMADO",
      observaciones,
      tipoContrato, // "PROPIO" | "SUBCONTRATADO"
      // Propio
      vehiculoId,
      conductorId,
      // Subcontratado
      subcontratado,
      // IDs de clientes ya confirmados/creados desde el frontend
      clienteIds = [],
    } = req.body;

    if (!fechaServicio || !origen || !destino) {
      return res.status(400).json({ error: "Fecha, origen y destino son requeridos" });
    }

    let finalVehiculoId = vehiculoId;
    let finalConductorId = conductorId;

    // --- SUBCONTRATADO: crear/buscar propietario, vehiculo y conductor ---
    if (tipoContrato === "SUBCONTRATADO" && subcontratado) {
      const { empresa, vehiculo: veh, conductor: cond } = subcontratado;

      // Buscar o crear propietario por RUC
      let propietario = await prisma.propietarioSubcontratado.findUnique({
        where: { ruc: empresa.ruc },
      });
      if (!propietario) {
        propietario = await prisma.propietarioSubcontratado.create({
          data: {
            razonSocial: empresa.razonSocial,
            ruc: empresa.ruc,
            contacto: empresa.contacto || null,
            telefono: empresa.telefono || null,
          },
        });
      }

      // Buscar o crear vehículo por placa
      let vehiculo = await prisma.vehiculo.findUnique({ where: { placa: veh.placa } });
      if (!vehiculo) {
        vehiculo = await prisma.vehiculo.create({
          data: {
            placa: veh.placa,
            placaCarreta: veh.placaCarreta || null,
            tipoUnidad: veh.tipoUnidad || "CAMION",
            tipo: "SUBCONTRATADO",
            propietarioSubcontratadoId: propietario.id,
          },
        });
      }
      finalVehiculoId = vehiculo.id;

      // Buscar o crear conductor por nroDocumento
      let conductor = await prisma.conductor.findFirst({
        where: { nroDocumento: cond.nroDocumento },
      });
      if (!conductor) {
        conductor = await prisma.conductor.create({
          data: {
            nombre: cond.nombre,
            apPaterno: cond.apPaterno,
            apMaterno: cond.apMaterno || null,
            tipoDocumento: cond.tipoDocumento || "DNI",
            nroDocumento: cond.nroDocumento,
            licencia: cond.licencia || null,
            tipo: "SUBCONTRATADO",
            propietarioSubcontratadoId: propietario.id,
          },
        });
      }
      finalConductorId = conductor.id;
    }

    if (!finalVehiculoId || !finalConductorId) {
      return res.status(400).json({ error: "Vehículo y conductor son requeridos" });
    }

    // clienteIds ya vienen confirmados/creados desde el frontend
    // --- Crear servicio con ServicioCliente ---
    const servicio = await prisma.servicio.create({
      data: {
        fechaServicio: new Date(fechaServicio),
        origen,
        destino,
        estado,
        observaciones: observaciones || null,
        vehiculoId: finalVehiculoId,
        conductorId: finalConductorId,
        clientes: {
          create: clienteIds.map((clienteId) => ({ clienteId })),
        },
      },
      include: servicioInclude,
    });

    res.status(201).json(servicio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear servicio" });
  }
});

// PUT /api/servicios/:id
router.put("/:id", async (req, res) => {
  try {
    const { fechaServicio, origen, destino, estado, observaciones, clientes } = req.body;

    const existing = await prisma.servicio.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Servicio no encontrado" });

    // Actualizar clientes si se proporcionan
    if (clientes !== undefined) {
      await prisma.servicioCliente.deleteMany({ where: { servicioId: req.params.id } });

      const clienteIds = await Promise.all(
        clientes.map(async ({ razonSocial, ruc }) => {
          let cliente = await prisma.cliente.findUnique({ where: { ruc } });
          if (!cliente) {
            cliente = await prisma.cliente.create({ data: { razonSocial, ruc } });
          }
          return cliente.id;
        })
      );

      await prisma.servicioCliente.createMany({
        data: clienteIds.map((clienteId) => ({ servicioId: req.params.id, clienteId })),
      });
    }

    const servicio = await prisma.servicio.update({
      where: { id: req.params.id },
      data: {
        ...(fechaServicio && { fechaServicio: new Date(fechaServicio) }),
        ...(origen && { origen }),
        ...(destino && { destino }),
        ...(estado && { estado }),
        ...(observaciones !== undefined && { observaciones }),
      },
      include: servicioInclude,
    });

    res.json(servicio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar servicio" });
  }
});

// PATCH /api/servicios/:id/estado
router.patch("/:id/estado", async (req, res) => {
  try {
    const { estado } = req.body;
    const estadosValidos = ["PROGRAMADO", "EN_TRANSITO", "COMPLETADO", "CANCELADO"];

    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${estadosValidos.join(", ")}` });
    }

    const servicio = await prisma.servicio.update({
      where: { id: req.params.id },
      data: { estado },
      include: servicioInclude,
    });

    res.json(servicio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

module.exports = router;
