-- AlterTable: add optional odometer fields to Liquidacion for km-based maintenance accumulation
ALTER TABLE "Liquidacion" ADD COLUMN "kmInicial" DECIMAL(65,30);
ALTER TABLE "Liquidacion" ADD COLUMN "kmFinal" DECIMAL(65,30);

-- Constraint: when both are present, kmFinal must be >= kmInicial (enforced at app level via Zod)
