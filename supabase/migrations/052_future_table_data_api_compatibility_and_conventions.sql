-- ============================================================================
-- VCTM ERP — MIGRATION 052: FUTURE TABLE DATA API COMPATIBILITY & CONVENTIONS
-- ============================================================================
-- Context:
-- Starting October 30, new tables created in schema 'public' in Supabase projects
-- will no longer automatically receive Data API access for 'anon' and 'authenticated'
-- unless explicitly granted.
--
-- Existing tables (41 tables) keep their current grants and remain intact.
--
-- This migration:
-- 1. Establishes forward default privileges for postgres and supabase_admin roles
--    so future tables created in 'public' receive minimum Data API grants for
--    'authenticated' and 'service_role' without blanket 'anon' exposure.
-- 2. Confirms that all existing public tables have Row Level Security enabled.
-- 3. Sets institutional metadata comments for schema audit compliance.
-- ============================================================================

-- 1. Forward Default Privileges for Tables in public schema
-- Grants standard CRUD permissions to authenticated role for future tables created by postgres
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

-- Sequences default privileges for identity/serial columns
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

-- 2. Verification Safety Guard
-- Assert that Row Level Security is actively enabled on all existing base tables
DO $$
DECLARE
  unsecured_table RECORD;
  unsecured_count INT := 0;
BEGIN
  FOR unsecured_table IN (
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
  )
  LOOP
    RAISE WARNING 'Table % in public schema does not have RLS enabled!', unsecured_table.table_name;
    unsecured_count := unsecured_count + 1;
  END LOOP;

  IF unsecured_count > 0 THEN
    RAISE EXCEPTION 'Safety check failed: % table(s) in public schema lack RLS.', unsecured_count;
  END IF;
END $$;

-- 3. Schema Documentation Comment
COMMENT ON SCHEMA public IS 'VCTM ERP (Code 340) Public Schema. All tables must enforce RLS and explicit Data API grants per SUPABASE_MIGRATION_CONVENTIONS.';
