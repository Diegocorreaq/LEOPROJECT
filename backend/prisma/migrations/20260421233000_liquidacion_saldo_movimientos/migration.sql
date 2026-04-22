CREATE TABLE "LiquidacionSaldoMovimiento" (
    "id" TEXT NOT NULL,
    "liquidacionOrigenId" TEXT NOT NULL,
    "liquidacionDestinoId" TEXT,
    "conductorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "fechaMovimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquidacionSaldoMovimiento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiquidacionSaldoMovimiento_monto_check" CHECK ("monto" > 0)
);

CREATE INDEX "LiquidacionSaldoMovimiento_liquidacionOrigenId_idx" ON "LiquidacionSaldoMovimiento"("liquidacionOrigenId");
CREATE INDEX "LiquidacionSaldoMovimiento_liquidacionDestinoId_idx" ON "LiquidacionSaldoMovimiento"("liquidacionDestinoId");
CREATE INDEX "LiquidacionSaldoMovimiento_conductorId_idx" ON "LiquidacionSaldoMovimiento"("conductorId");
CREATE INDEX "LiquidacionSaldoMovimiento_fechaMovimiento_idx" ON "LiquidacionSaldoMovimiento"("fechaMovimiento");

ALTER TABLE "LiquidacionSaldoMovimiento" ADD CONSTRAINT "LiquidacionSaldoMovimiento_liquidacionOrigenId_fkey"
FOREIGN KEY ("liquidacionOrigenId") REFERENCES "Liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LiquidacionSaldoMovimiento" ADD CONSTRAINT "LiquidacionSaldoMovimiento_liquidacionDestinoId_fkey"
FOREIGN KEY ("liquidacionDestinoId") REFERENCES "Liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LiquidacionSaldoMovimiento" ADD CONSTRAINT "LiquidacionSaldoMovimiento_conductorId_fkey"
FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
