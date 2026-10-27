-- Audit history is append-only for application and ordinary SQL writes.
CREATE FUNCTION refuse_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER audit_no_update_delete BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION refuse_audit_mutation();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON "AuditEvent"
FOR EACH STATEMENT EXECUTE FUNCTION refuse_audit_mutation();

-- UUID foreign keys alone do not prevent references across municipalities.
-- Validate organization equality even for writes made outside the API.
CREATE FUNCTION enforce_reference_organization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reference_id text;
  reference_org text;
  argument integer;
BEGIN
  argument := 0;
  WHILE argument < TG_NARGS LOOP
    reference_id := to_jsonb(NEW) ->> TG_ARGV[argument + 1];
    IF reference_id IS NOT NULL THEN
      EXECUTE format('SELECT "organizationId" FROM %I WHERE "id" = $1', TG_ARGV[argument])
        INTO reference_org USING reference_id;
      IF reference_org IS NULL OR reference_org IS DISTINCT FROM NEW."organizationId" THEN
        RAISE EXCEPTION 'Referenced record must belong to the same organization' USING ERRCODE = '23503';
      END IF;
    END IF;
    argument := argument + 2;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_tenant BEFORE INSERT OR UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('Role','roleId');
CREATE TRIGGER asset_tenant BEFORE INSERT OR UPDATE ON "DataAsset" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('DataDomain','domainId','SourceSystem','sourceSystemId');
CREATE TRIGGER connection_tenant BEFORE INSERT OR UPDATE ON "IntegrationConnection" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId');
CREATE TRIGGER run_tenant BEFORE INSERT OR UPDATE ON "IntegrationRun" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId');
CREATE TRIGGER raw_tenant BEFORE INSERT OR UPDATE ON "RawImportRecord" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('IntegrationRun','runId');
CREATE TRIGGER error_tenant BEFORE INSERT OR UPDATE ON "IntegrationRecordError" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('IntegrationRun','runId','RawImportRecord','rawRecordId');
CREATE TRIGGER route_tenant BEFORE INSERT OR UPDATE ON "CollectionRoute" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId','ServiceArea','serviceAreaId','Vehicle','vehicleId');
CREATE TRIGGER stop_tenant BEFORE INSERT OR UPDATE ON "CollectionStop" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('CollectionRoute','routeId');
CREATE TRIGGER event_tenant BEFORE INSERT OR UPDATE ON "CollectionEvent" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId','CollectionRoute','routeId','Vehicle','vehicleId');
CREATE TRIGGER vehicle_tenant BEFORE INSERT OR UPDATE ON "Vehicle" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId');
CREATE TRIGGER telemetry_tenant BEFORE INSERT OR UPDATE ON "VehicleTelemetryEvent" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId','Vehicle','vehicleId');
CREATE TRIGGER facility_tenant BEFORE INSERT OR UPDATE ON "Facility" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId');
CREATE TRIGGER weighbridge_tenant BEFORE INSERT OR UPDATE ON "WeighbridgeTransaction" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId','Facility','facilityId','MaterialType','materialTypeId');
CREATE TRIGGER recovery_tenant BEFORE INSERT OR UPDATE ON "RecyclingRecoveryRecord" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId','Facility','facilityId','MaterialType','materialTypeId');
CREATE TRIGGER contamination_tenant BEFORE INSERT OR UPDATE ON "ContaminationIncident" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('RecyclingRecoveryRecord','recoveryId');
CREATE TRIGGER workorder_tenant BEFORE INSERT OR UPDATE ON "WorkOrder" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId','Vehicle','vehicleId');
CREATE TRIGGER citizen_tenant BEFORE INSERT OR UPDATE ON "CitizenRequest" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId');
CREATE TRIGGER contract_tenant BEFORE INSERT OR UPDATE ON "ServiceContract" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('SourceSystem','sourceSystemId','ServiceArea','serviceAreaId');
CREATE TRIGGER dq_result_tenant BEFORE INSERT OR UPDATE ON "DQResult" FOR EACH ROW EXECUTE FUNCTION enforce_reference_organization('DQRun','runId','DQRule','ruleId');
