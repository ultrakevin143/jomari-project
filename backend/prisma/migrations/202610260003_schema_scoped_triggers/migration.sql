-- Resolve references in the table's own schema, including dedicated Neon schemas.
CREATE OR REPLACE FUNCTION enforce_reference_organization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reference_id text;
  reference_org text;
  argument integer;
BEGIN
  argument := 0;
  WHILE argument < TG_NARGS LOOP
    reference_id := to_jsonb(NEW) ->> TG_ARGV[argument + 1];
    IF reference_id IS NOT NULL THEN
      EXECUTE format('SELECT "organizationId" FROM %I.%I WHERE "id" = $1', TG_TABLE_SCHEMA, TG_ARGV[argument])
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
