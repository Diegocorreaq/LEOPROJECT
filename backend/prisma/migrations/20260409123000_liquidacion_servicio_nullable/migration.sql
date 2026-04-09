-- Permite desvincular liquidaciones sin eliminarlas
ALTER TABLE "Liquidacion"
ALTER COLUMN "servicioId" DROP NOT NULL;
