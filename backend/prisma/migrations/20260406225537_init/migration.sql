-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropietarioSubcontratado" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "contacto" TEXT,
    "telefono" TEXT,

    CONSTRAINT "PropietarioSubcontratado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "propietarioSubcontratadoId" TEXT,
    "placa" TEXT NOT NULL,
    "placaCarreta" TEXT,
    "tipoUnidad" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mtc" TEXT,
    "mtcCarreta" TEXT,
    "pesoNeto" DECIMAL(65,30),
    "pesoBruto" DECIMAL(65,30),
    "cargaUtil" DECIMAL(65,30),
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conductor" (
    "id" TEXT NOT NULL,
    "propietarioSubcontratadoId" TEXT,
    "nombre" TEXT NOT NULL,
    "apPaterno" TEXT NOT NULL,
    "apMaterno" TEXT,
    "tipoDocumento" TEXT NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "licencia" TEXT,
    "tipo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Conductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaTarifa" (
    "id" TEXT NOT NULL,
    "codigoRuta" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "descripcion" TEXT,
    "tarifa1tn" DECIMAL(65,30),
    "tarifa2tn" DECIMAL(65,30),
    "tarifa5tn" DECIMAL(65,30),
    "tarifa10tn" DECIMAL(65,30),
    "tarifa30tn" DECIMAL(65,30),

    CONSTRAINT "RutaTarifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "conductorId" TEXT NOT NULL,
    "fechaServicio" TIMESTAMP(3) NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADO',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioCliente" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,

    CONSTRAINT "ServicioCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuiaRemision" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaInicioTraslado" TIMESTAMP(3),
    "puntoDeSalida" TEXT,
    "puntoDeLlegada" TEXT,
    "remitenteNombre" TEXT,
    "remitenteRuc" TEXT,
    "destinatarioNombre" TEXT,
    "destinatarioRuc" TEXT,
    "pagadorFleteNombre" TEXT,
    "pagadorFleteRuc" TEXT,
    "transbordo" BOOLEAN NOT NULL DEFAULT false,
    "retornoVacio" BOOLEAN NOT NULL DEFAULT false,
    "subcontratado" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'EMITIDA',
    "fechaRecepcion" TIMESTAMP(3),
    "observaciones" TEXT,

    CONSTRAINT "GuiaRemision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuiaBien" (
    "id" TEXT NOT NULL,
    "guiaRemisionId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidadMedida" TEXT,
    "cantidadKg" DECIMAL(65,30),
    "bienNormalizado" TEXT,
    "codigoSunat" TEXT,

    CONSTRAINT "GuiaBien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuiaDocRelacionado" (
    "id" TEXT NOT NULL,
    "guiaRemisionId" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "rucEmisor" TEXT,

    CONSTRAINT "GuiaDocRelacionado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidacion" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "conductorId" TEXT NOT NULL,
    "montoEntregado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "viaticos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "peajes" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "combustible" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "galones" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "otros" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGastos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "detalleSaldo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionComprobante" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT,
    "descripcion" TEXT,
    "monto" DECIMAL(65,30) NOT NULL,
    "urlArchivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidacionComprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenServicio" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "rutaTarifaId" TEXT,
    "numero" TEXT,
    "fleteNeto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fleteTercero" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "incluyeIgv" BOOLEAN NOT NULL DEFAULT true,
    "detraccion" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaEnvioCliente" TIMESTAMP(3),
    "fechaSelloCliente" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "ordenServicioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "montoNeto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "detraccionPorcentaje" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "detraccionMonto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "formaPago" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaGuia" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "serieGuia" TEXT NOT NULL,
    "numeroGuia" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacturaGuia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "medioPago" TEXT,
    "numeroOperacion" TEXT,
    "cuentaBancaria" TEXT,
    "identificado" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibroCompras" (
    "id" TEXT NOT NULL,
    "numeroFactura" TEXT NOT NULL,
    "proveedorNombre" TEXT,
    "proveedorRuc" TEXT,
    "fechaEmision" TIMESTAMP(3),
    "montoNeto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "concepto" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibroCompras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tipoDoc" TEXT NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "fechaAnterior" TIMESTAMP(3),
    "observacion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MantenimientoKm" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "componente" TEXT NOT NULL,
    "kmPermitido" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "kmAcumulado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rendimientoEstandar" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MantenimientoKm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_ruc_key" ON "Cliente"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "PropietarioSubcontratado_ruc_key" ON "PropietarioSubcontratado"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_placa_key" ON "Vehiculo"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "ServicioCliente_servicioId_clienteId_key" ON "ServicioCliente"("servicioId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "GuiaRemision_serie_numero_key" ON "GuiaRemision"("serie", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidacion_servicioId_key" ON "Liquidacion"("servicioId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenServicio_servicioId_key" ON "OrdenServicio"("servicioId");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_serie_numero_key" ON "Factura"("serie", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "DocVehiculo_vehiculoId_tipoDoc_key" ON "DocVehiculo"("vehiculoId", "tipoDoc");

-- CreateIndex
CREATE UNIQUE INDEX "MantenimientoKm_vehiculoId_componente_key" ON "MantenimientoKm"("vehiculoId", "componente");

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_propietarioSubcontratadoId_fkey" FOREIGN KEY ("propietarioSubcontratadoId") REFERENCES "PropietarioSubcontratado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conductor" ADD CONSTRAINT "Conductor_propietarioSubcontratadoId_fkey" FOREIGN KEY ("propietarioSubcontratadoId") REFERENCES "PropietarioSubcontratado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioCliente" ADD CONSTRAINT "ServicioCliente_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioCliente" ADD CONSTRAINT "ServicioCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaRemision" ADD CONSTRAINT "GuiaRemision_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaBien" ADD CONSTRAINT "GuiaBien_guiaRemisionId_fkey" FOREIGN KEY ("guiaRemisionId") REFERENCES "GuiaRemision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaDocRelacionado" ADD CONSTRAINT "GuiaDocRelacionado_guiaRemisionId_fkey" FOREIGN KEY ("guiaRemisionId") REFERENCES "GuiaRemision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionComprobante" ADD CONSTRAINT "LiquidacionComprobante_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_rutaTarifaId_fkey" FOREIGN KEY ("rutaTarifaId") REFERENCES "RutaTarifa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_ordenServicioId_fkey" FOREIGN KEY ("ordenServicioId") REFERENCES "OrdenServicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaGuia" ADD CONSTRAINT "FacturaGuia_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocVehiculo" ADD CONSTRAINT "DocVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantenimientoKm" ADD CONSTRAINT "MantenimientoKm_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
