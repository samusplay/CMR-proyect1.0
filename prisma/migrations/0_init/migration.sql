-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SystemType" AS ENUM ('MONOFASICO', 'BIFASICO', 'TRIFASICO');

-- CreateEnum
CREATE TYPE "AnchorType" AS ENUM ('CHAZOS', 'TORNILLOS', 'UNISTRUT');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "ChargerMountType" AS ENUM ('ADOSADO_A_MURO', 'PEDESTAL');

-- CreateEnum
CREATE TYPE "InstallationType" AS ENUM ('SOLAR', 'CARGADOR', 'AMBOS');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('NUEVO', 'CONTACTADO', 'CALIFICADO', 'PROPUESTA', 'GANADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PROGRAMADA', 'REPROGRAMADA', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('CABLEADO', 'CANALIZACION', 'PROTECCIONES', 'CARGADOR', 'ANCLAJES', 'SOLAR', 'MANO_DE_OBRA', 'OTROS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'vendedor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "utmSource" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'NUEVO',
    "installationType" "InstallationType" NOT NULL,
    "estimatedValue" INTEGER NOT NULL,
    "expectedCloseDate" TIMESTAMP(3),
    "notes" TEXT,
    "assignedToId" TEXT,
    "leadId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "installationDate" TIMESTAMP(3),
    "dealId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "parkingNumber" TEXT,
    "systemType" "SystemType" NOT NULL,
    "systemDetail" TEXT,
    "originPoint" TEXT NOT NULL,
    "panelIdentification" TEXT,
    "breakerCapacity" TEXT,
    "hasPanelSpace" BOOLEAN NOT NULL,
    "availablePanelSpaces" TEXT,
    "requiresDrilling" BOOLEAN NOT NULL,
    "drillingLocation" TEXT,
    "conduitType" TEXT,
    "conduitCondition" TEXT,
    "conduitLength" DOUBLE PRECISION,
    "cableLength" DOUBLE PRECISION,
    "cableGauge" TEXT,
    "mountSurface" TEXT,
    "wallCondition" TEXT,
    "anchorType" "AnchorType",
    "requiredHardware" TEXT,
    "chargerMountType" "ChargerMountType",
    "chargerModel" TEXT,
    "differentialProtectionRequired" BOOLEAN NOT NULL,
    "differentialType" TEXT,
    "groundResistanceOhms" DOUBLE PRECISION,
    "neutralGroundReading" TEXT,
    "measuredVoltage" DOUBLE PRECISION,
    "lightingCondition" TEXT,
    "observations" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "offerNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "aiuPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "ivaPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.19,
    "deliveryTime" TEXT,
    "deliveryCondition" TEXT,
    "warranty" TEXT,
    "paymentTerms" TEXT,
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "status" "OfferStatus" NOT NULL DEFAULT 'BORRADOR',
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferItem" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "materialId" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "unitCode" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "groupLabel" TEXT,

    CONSTRAINT "OfferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionAppointment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "inspectorId" TEXT,
    "scheduledById" TEXT NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_leadId_key" ON "Deal"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_dealId_key" ON "Client"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_dealId_key" ON "Inspection"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE INDEX "Material_category_idx" ON "Material"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_dealId_key" ON "Offer"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_offerNumber_key" ON "Offer"("offerNumber");

-- CreateIndex
CREATE INDEX "InspectionAppointment_dealId_idx" ON "InspectionAppointment"("dealId");

-- CreateIndex
CREATE INDEX "InspectionAppointment_inspectorId_scheduledAt_idx" ON "InspectionAppointment"("inspectorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "InspectionAppointment_scheduledAt_idx" ON "InspectionAppointment"("scheduledAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAppointment" ADD CONSTRAINT "InspectionAppointment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAppointment" ADD CONSTRAINT "InspectionAppointment_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAppointment" ADD CONSTRAINT "InspectionAppointment_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAppointment" ADD CONSTRAINT "InspectionAppointment_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

