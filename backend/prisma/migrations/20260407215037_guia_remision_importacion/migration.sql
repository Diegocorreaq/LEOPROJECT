/*
  Warnings:

  - Added the required column `updatedAt` to the `GuiaRemision` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GuiaRemision" DROP CONSTRAINT "GuiaRemision_servicioId_fkey";

-- AlterTable
ALTER TABLE "GuiaBien" ADD COLUMN     "cantidad" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "GuiaDocRelacionado" ADD COLUMN     "tipoDocumentoCode" TEXT;

-- AlterTable
ALTER TABLE "GuiaRemision" ADD COLUMN     "conductorPrincipalDocumento" TEXT,
ADD COLUMN     "conductorPrincipalLicencia" TEXT,
ADD COLUMN     "conductorPrincipalNombre" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "horaEmision" TEXT,
ADD COLUMN     "mtcNumero" TEXT,
ADD COLUMN     "nombreArchivoOrigen" TEXT,
ADD COLUMN     "observacionSunat" TEXT,
ADD COLUMN     "origenImportacion" TEXT,
ADD COLUMN     "pesoBrutoTotal" DECIMAL(65,30),
ADD COLUMN     "placaPrincipal" TEXT,
ADD COLUMN     "placaSecundaria" TEXT,
ADD COLUMN     "rawPayload" JSONB,
ADD COLUMN     "subcontratistaNombre" TEXT,
ADD COLUMN     "subcontratistaRuc" TEXT,
ADD COLUMN     "transportistaNombre" TEXT,
ADD COLUMN     "transportistaRuc" TEXT,
ADD COLUMN     "unidadPeso" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "servicioId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GuiaRemision" ADD CONSTRAINT "GuiaRemision_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
