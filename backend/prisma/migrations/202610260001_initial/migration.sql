-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "Remediation" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('COMPLETED', 'MISSED', 'IN_PROGRESS', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ON_ROUTE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataDomain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "steward" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "steward" TEXT NOT NULL,
    "classification" "Classification" NOT NULL,
    "containsPii" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL,
    "policy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSystem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "freshnessHours" INTEGER NOT NULL DEFAULT 24,
    "lastSuccessAt" TIMESTAMP(3),
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "initiatedBy" TEXT NOT NULL,

    CONSTRAINT "IntegrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLock" (
    "sourceSystemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationLock_pkey" PRIMARY KEY ("sourceSystemId")
);

-- CreateTable
CREATE TABLE "RawImportRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sourceRecordId" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "canonicalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationRecordError" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rawRecordId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "remediation" "Remediation" NOT NULL DEFAULT 'OPEN',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationRecordError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceArea" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionRoute" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceAreaId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "scheduledStops" INTEGER NOT NULL,
    "completedStops" INTEGER NOT NULL,
    "missedStops" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "CollectionStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionStop" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "CollectionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "CollectionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacityKg" DOUBLE PRECISION NOT NULL,
    "mileageKm" DOUBLE PRECISION NOT NULL,
    "fuelLitres" DOUBLE PRECISION NOT NULL,
    "status" "VehicleStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleTelemetryEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "mileageKm" DOUBLE PRECISION NOT NULL,
    "fuelLitres" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleTelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "dailyCapacityKg" DOUBLE PRECISION NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recyclable" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeighbridgeTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "materialTypeId" TEXT NOT NULL,
    "grossKg" DOUBLE PRECISION NOT NULL,
    "tareKg" DOUBLE PRECISION NOT NULL,
    "netKg" DOUBLE PRECISION NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeighbridgeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecyclingRecoveryRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "materialTypeId" TEXT NOT NULL,
    "receivedKg" DOUBLE PRECISION NOT NULL,
    "recoveredKg" DOUBLE PRECISION NOT NULL,
    "contaminationPct" DOUBLE PRECISION NOT NULL,
    "exceptionReason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecyclingRecoveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaminationIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recoveryId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rejectedKg" DOUBLE PRECISION NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaminationIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vehicleId" TEXT,
    "assignee" TEXT NOT NULL,
    "priority" "Severity" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "citizenAlias" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "previousStatus" "RequestStatus",
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitizenRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "serviceAreaId" TEXT NOT NULL,
    "slaTargetPct" DOUBLE PRECISION NOT NULL,
    "ratePerTonne" DOUBLE PRECISION NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DQRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DQRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DQRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "checked" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "initiatedBy" TEXT NOT NULL,

    CONSTRAINT "DQRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DQResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "checked" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "samples" JSONB NOT NULL,
    "remediation" "Remediation" NOT NULL DEFAULT 'OPEN',
    "remediationNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DQResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_code_key" ON "Role"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_roleId_code_key" ON "Permission"("roleId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataDomain_organizationId_code_key" ON "DataDomain"("organizationId", "code");

-- CreateIndex
CREATE INDEX "DataAsset_organizationId_domainId_idx" ON "DataAsset"("organizationId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "DataAsset_organizationId_sourceSystemId_entity_key" ON "DataAsset"("organizationId", "sourceSystemId", "entity");

-- CreateIndex
CREATE INDEX "SourceSystem_organizationId_lastSuccessAt_idx" ON "SourceSystem"("organizationId", "lastSuccessAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSystem_organizationId_code_key" ON "SourceSystem"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_sourceSystemId_adapter_key" ON "IntegrationConnection"("sourceSystemId", "adapter");

-- CreateIndex
CREATE INDEX "IntegrationRun_organizationId_startedAt_idx" ON "IntegrationRun"("organizationId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationRun_organizationId_sourceSystemId_idempotencyKey_key" ON "IntegrationRun"("organizationId", "sourceSystemId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RawImportRecord_organizationId_sourceRecordId_idx" ON "RawImportRecord"("organizationId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "RawImportRecord_runId_rowNumber_key" ON "RawImportRecord"("runId", "rowNumber");

-- CreateIndex
CREATE INDEX "IntegrationRecordError_organizationId_remediation_idx" ON "IntegrationRecordError"("organizationId", "remediation");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceArea_organizationId_code_key" ON "ServiceArea"("organizationId", "code");

-- CreateIndex
CREATE INDEX "CollectionRoute_organizationId_scheduledAt_idx" ON "CollectionRoute"("organizationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "CollectionRoute_organizationId_status_idx" ON "CollectionRoute"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionRoute_organizationId_sourceSystemId_sourceRecordI_key" ON "CollectionRoute"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionStop_routeId_code_key" ON "CollectionStop"("routeId", "code");

-- CreateIndex
CREATE INDEX "CollectionEvent_organizationId_occurredAt_idx" ON "CollectionEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionEvent_organizationId_sourceSystemId_sourceRecordI_key" ON "CollectionEvent"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE INDEX "Vehicle_organizationId_status_idx" ON "Vehicle"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_organizationId_sourceSystemId_sourceRecordId_key" ON "Vehicle"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_organizationId_registration_key" ON "Vehicle"("organizationId", "registration");

-- CreateIndex
CREATE INDEX "VehicleTelemetryEvent_organizationId_vehicleId_occurredAt_idx" ON "VehicleTelemetryEvent"("organizationId", "vehicleId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTelemetryEvent_organizationId_sourceSystemId_sourceR_key" ON "VehicleTelemetryEvent"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_organizationId_sourceSystemId_sourceRecordId_key" ON "Facility"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_organizationId_code_key" ON "Facility"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialType_organizationId_code_key" ON "MaterialType"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WeighbridgeTransaction_organizationId_occurredAt_idx" ON "WeighbridgeTransaction"("organizationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeighbridgeTransaction_organizationId_sourceSystemId_source_key" ON "WeighbridgeTransaction"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "WeighbridgeTransaction_organizationId_ticketNumber_key" ON "WeighbridgeTransaction"("organizationId", "ticketNumber");

-- CreateIndex
CREATE INDEX "RecyclingRecoveryRecord_organizationId_occurredAt_idx" ON "RecyclingRecoveryRecord"("organizationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecyclingRecoveryRecord_organizationId_sourceSystemId_sourc_key" ON "RecyclingRecoveryRecord"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE INDEX "ContaminationIncident_organizationId_idx" ON "ContaminationIncident"("organizationId");

-- CreateIndex
CREATE INDEX "WorkOrder_organizationId_status_idx" ON "WorkOrder"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_organizationId_sourceSystemId_sourceRecordId_key" ON "WorkOrder"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE INDEX "CitizenRequest_organizationId_status_idx" ON "CitizenRequest"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenRequest_organizationId_sourceSystemId_sourceRecordId_key" ON "CitizenRequest"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE INDEX "ServiceContract_organizationId_idx" ON "ServiceContract"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceContract_organizationId_sourceSystemId_sourceRecordI_key" ON "ServiceContract"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "DQRule_organizationId_code_key" ON "DQRule"("organizationId", "code");

-- CreateIndex
CREATE INDEX "DQRun_organizationId_startedAt_idx" ON "DQRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "DQResult_organizationId_remediation_idx" ON "DQResult"("organizationId", "remediation");

-- CreateIndex
CREATE UNIQUE INDEX "DQResult_runId_ruleId_key" ON "DQResult"("runId", "ruleId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_action_idx" ON "AuditEvent"("organizationId", "action");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataDomain" ADD CONSTRAINT "DataDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "DataDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSystem" ADD CONSTRAINT "SourceSystem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRun" ADD CONSTRAINT "IntegrationRun_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawImportRecord" ADD CONSTRAINT "RawImportRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IntegrationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRecordError" ADD CONSTRAINT "IntegrationRecordError_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IntegrationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRecordError" ADD CONSTRAINT "IntegrationRecordError_rawRecordId_fkey" FOREIGN KEY ("rawRecordId") REFERENCES "RawImportRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRoute" ADD CONSTRAINT "CollectionRoute_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "ServiceArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRoute" ADD CONSTRAINT "CollectionRoute_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionStop" ADD CONSTRAINT "CollectionStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CollectionRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionEvent" ADD CONSTRAINT "CollectionEvent_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CollectionRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionEvent" ADD CONSTRAINT "CollectionEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTelemetryEvent" ADD CONSTRAINT "VehicleTelemetryEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighbridgeTransaction" ADD CONSTRAINT "WeighbridgeTransaction_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighbridgeTransaction" ADD CONSTRAINT "WeighbridgeTransaction_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecyclingRecoveryRecord" ADD CONSTRAINT "RecyclingRecoveryRecord_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecyclingRecoveryRecord" ADD CONSTRAINT "RecyclingRecoveryRecord_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaminationIncident" ADD CONSTRAINT "ContaminationIncident_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "RecyclingRecoveryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceContract" ADD CONSTRAINT "ServiceContract_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "ServiceArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DQResult" ADD CONSTRAINT "DQResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DQRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DQResult" ADD CONSTRAINT "DQResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DQRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
