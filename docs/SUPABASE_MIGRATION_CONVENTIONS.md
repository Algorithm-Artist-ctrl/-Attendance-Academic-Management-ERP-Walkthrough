# Supabase Database Migration & Data API Conventions (VCTM ERP)

## Overview & The October 30 Change

Starting **October 30, 2026**, Supabase projects no longer automatically grant Data API access (`anon` and `authenticated` roles) to newly created tables in the `public` schema.

- **Existing Tables (1 to 41)**: Retain their current grants and work as-is. Do NOT modify existing tables unnecessarily.
- **Future Tables (Migration 052+)**: Every newly created table in the `public` schema that is intended to be accessed via the Supabase client (`supabase.from(...)`) **MUST** explicitly define its minimum privileges, enable Row Level Security (RLS), and provide fine-grained policies.

---

## Core Rules for All Migrations

1. **Forward Migrations Only**:
   - Never edit an already-applied production migration file (e.g. `001_initial_schema.sql` through `051_safe_permanent_account_deletion.sql`).
   - All schema additions or fixes must be written as a new sequential forward migration (`053_...sql`, `054_...sql`, etc.).
2. **No Blanket Grants**:
   - **NEVER** write `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;`.
   - Blanket grants violate the principle of least privilege and expose sensitive internal tables.
3. **Mandatory Row Level Security**:
   - Every table in `public` must have `ENABLE ROW LEVEL SECURITY`.
   - Grants grant table access; RLS policies enforce which rows can be read, inserted, updated, or deleted.
4. **Zero Hardcoded Secrets**:
   - Never include database URLs, passwords, service-role keys, or JWT tokens in migration files.
5. **Tenant & Institution Isolation**:
   - VCTM ERP operates under Vivekananda College of Technology & Management (VCTM, Code: 340).
   - All tenant-scoped data must be bounded by `institution_id = '00000000-0000-0000-0000-000000000001'`.

---

## The 7-Step Pattern for New Tables

When creating a new table in `public`, follow this canonical template:

```sql
-- ============================================================================
-- Step 1: CREATE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feature_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' 
        REFERENCES public.institutions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Step 2: PERFORMANCE INDEXES
-- Index foreign keys, high-cardinality filters, and composite query paths
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_feature_records_inst_student 
    ON public.feature_records(institution_id, student_id);

CREATE INDEX IF NOT EXISTS idx_feature_records_status 
    ON public.feature_records(status);

-- ============================================================================
-- Step 3: ENABLE ROW LEVEL SECURITY (MANDATORY)
-- ============================================================================
ALTER TABLE public.feature_records ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: EXPLICIT MINIMUM PRIVILEGES (SUPABASE OCT 30 STANDARD)
-- Grant only the operations actually required by the application
-- ============================================================================
-- 4a. Authenticated users (logged-in Students, Faculty, HOD, Super Admin)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feature_records TO authenticated;

-- 4b. Service role (backend edge functions, batch synchronization)
GRANT ALL ON TABLE public.feature_records TO service_role;

-- 4c. Anonymous role (ONLY IF table contains public unauthenticated data)
-- For sensitive/internal/user data: DO NOT grant to anon.
-- GRANT SELECT ON TABLE public.feature_records TO anon;

-- ============================================================================
-- Step 5: STRICT MULTI-ROLE RLS POLICIES
-- ============================================================================
-- Read policy: Students see only their own rows; Admins see all for VCTM
CREATE POLICY "feature_records_read" ON public.feature_records
    FOR SELECT TO authenticated
    USING (
        (auth.uid() = student_id) OR
        (EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.role IN ('super_admin', 'hod', 'faculty')
        ))
    );

-- Insert policy: Students can insert for themselves; Admins can insert
CREATE POLICY "feature_records_insert" ON public.feature_records
    FOR INSERT TO authenticated
    WITH CHECK (
        (auth.uid() = student_id) OR
        (EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.role IN ('super_admin', 'hod')
        ))
    );

-- Update policy: Controlled by role
CREATE POLICY "feature_records_update" ON public.feature_records
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.role IN ('super_admin', 'hod')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.role IN ('super_admin', 'hod')
        )
    );

-- Delete policy: Super Admin only
CREATE POLICY "feature_records_delete" ON public.feature_records
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.role = 'super_admin'
        )
    );

-- ============================================================================
-- Step 6: REALTIME PUBLICATION (OPTIONAL)
-- Only add if the table is subscribed to in the frontend via supabase.channel()
-- ============================================================================
-- ALTER TABLE public.feature_records REPLICA IDENTITY FULL;
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_publication_tables 
--     WHERE pubname = 'supabase_realtime' AND tablename = 'feature_records'
--   ) THEN
--     ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_records;
--   END IF;
-- END $$;

-- ============================================================================
-- Step 7: AUDIT / MIGRATION SAFETY ASSERTION
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relname = 'feature_records' 
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS assertion failed for table feature_records!';
  END IF;
END $$;
```

---

## Role Grant Reference

| Role | Intended Use | Typical Table Grants |
|---|---|---|
| `authenticated` | Logged-in students, faculty, HOD, and administrators querying via Supabase JS | `SELECT, INSERT, UPDATE, DELETE` (bounded by RLS) |
| `anon` | Unauthenticated public visitors (e.g. landing page institution name, public notices) | `SELECT` ONLY where explicitly public. Otherwise NONE. |
| `service_role` | Backend server endpoints (`api/admin-auth.ts`, Edge Functions, CLI tools) | `ALL` |
| `postgres` / Project Owner | Schema owner executing migrations | Full DDL/DML ownership |

---

## Migration Checklist

Before submitting or applying any new migration:
- [ ] Table created with `IF NOT EXISTS` in `public` schema
- [ ] Necessary foreign keys and performance indexes created
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` executed
- [ ] Explicit grants provided for `authenticated` and `service_role`
- [ ] No `anon` grants unless table is intentionally accessible to public visitors
- [ ] RLS policies define access for Student, Faculty, HOD, and Super Admin
- [ ] Tenant boundary enforced (`institution_id = '00000000-0000-0000-0000-000000000001'`)
- [ ] Migration applied and verified with automated test
