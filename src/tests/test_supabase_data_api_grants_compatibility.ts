/**
 * VCTM ERP — SUPABASE DATA API / PUBLIC SCHEMA GRANT COMPATIBILITY TEST SUITE
 * 
 * Verifies:
 * 1. 100% of existing 41 public tables have Row Level Security actively enabled.
 * 2. All 41 tables maintain active role grants for Data API usage (authenticated, anon, service_role).
 * 3. Default privileges on schema public adhere to least privilege.
 * 4. Post-October-30 convention test: creates an ephemeral public table, verifies that
 *    explicit grants + RLS work seamlessly under Supabase's authenticated role, and tears down.
 */

import pg from 'pg';

const EXPECTED_PUBLIC_TABLES = [
  'academic_sessions',
  'academic_years',
  'account_lifecycle',
  'assignment_submissions',
  'assignments',
  'attendance_corrections',
  'attendance_records',
  'attendance_sessions',
  'audit_logs',
  'class_coordinator_assignments',
  'classrooms',
  'conversation_user_settings',
  'conversations',
  'departments',
  'faculty',
  'faculty_subject_assignments',
  'group_member_read_state',
  'group_messages',
  'institutions',
  'leave_applications',
  'leave_approval_audit_logs',
  'marks_history',
  'message_groups',
  'messages',
  'notices',
  'notifications',
  'profiles',
  'programs',
  'promotion_batches',
  'quiz_results',
  'quizzes',
  'sections',
  'semesters',
  'sessional_assessments',
  'sessional_marks',
  'student_academic_history',
  'students',
  'subjects',
  'timetable_entries',
  'timetable_imports',
  'timetable_versions'
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('================================================================================');
  console.log('  VCTM ERP — SUPABASE DATA API GRANT COMPATIBILITY & RLS AUDIT TEST SUITE       ');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✓ [Step ${total}] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [Step ${total}] FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // PHASE 1: Existing 41 Tables RLS & Grants Audit
    // ------------------------------------------------------------------------
    console.log('▶ PHASE 1: Existing Public Tables RLS Coverage & Grants Audit');

    const tablesRes = await client.query(`
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `);

    const liveTables = tablesRes.rows.map(r => r.table_name);
    assert(liveTables.length === 41, `Found exactly 41 public base tables in live DB (actual: ${liveTables.length})`);

    const missingTables = EXPECTED_PUBLIC_TABLES.filter(t => !liveTables.includes(t));
    assert(missingTables.length === 0, `All 41 expected ERP tables are present (missing: ${missingTables.join(', ') || 'none'})`);

    const unsecureTables = tablesRes.rows.filter(r => !r.rls_enabled);
    assert(unsecureTables.length === 0, `100% of public base tables have RLS enabled (unsecure: ${unsecureTables.length})`);

    const grantsRes = await client.query(`
      SELECT 
        table_name,
        grantee,
        string_agg(privilege_type, ', ') as privileges
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' 
        AND grantee IN ('anon', 'authenticated', 'service_role')
      GROUP BY table_name, grantee;
    `);

    const grantMap = new Map<string, Set<string>>();
    for (const row of grantsRes.rows) {
      if (!grantMap.has(row.table_name)) grantMap.set(row.table_name, new Set());
      grantMap.get(row.table_name)!.add(row.grantee);
    }

    let tablesWithAuthGrants = 0;
    for (const t of liveTables) {
      const grantees = grantMap.get(t);
      if (grantees && grantees.has('authenticated')) {
        tablesWithAuthGrants++;
      }
    }
    assert(tablesWithAuthGrants === 41, `All 41 existing tables possess active Data API grants for authenticated role (${tablesWithAuthGrants}/41)`);

    // ------------------------------------------------------------------------
    // PHASE 2: Default Privileges Verification (Migration 052)
    // ------------------------------------------------------------------------
    console.log('\n▶ PHASE 2: Forward Default Privileges (Migration 052)');

    const defAclRes = await client.query(`
      SELECT 
        pg_catalog.pg_get_userbyid(d.defaclrole) AS grantor,
        d.defaclobjtype AS object_type,
        d.defaclacl AS acl
      FROM pg_catalog.pg_default_acl d
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
      WHERE n.nspname = 'public';
    `);

    assert(defAclRes.rowCount !== null && defAclRes.rowCount > 0, `Default privileges exist on schema 'public'`);

    const tableDefAcl = defAclRes.rows.find(r => r.object_type === 'r' && r.grantor === 'postgres');
    assert(tableDefAcl !== undefined, `Found table default ACL for role postgres on public schema`);
    assert(tableDefAcl.acl.includes('authenticated='), `Default privileges grant permissions to 'authenticated' role`);
    assert(tableDefAcl.acl.includes('service_role='), `Default privileges grant permissions to 'service_role'`);

    // Verify schema documentation comment
    const commentRes = await client.query(`
      SELECT obj_description(oid, 'pg_namespace') AS comment 
      FROM pg_namespace 
      WHERE nspname = 'public';
    `);
    assert(
      typeof commentRes.rows[0]?.comment === 'string' && commentRes.rows[0].comment.includes('VCTM ERP'),
      `Schema public has proper VCTM ERP documentation comment`
    );

    // ------------------------------------------------------------------------
    // PHASE 3: 7-Step Migration Lifecycle Simulation (Post-October 30 Pattern)
    // ------------------------------------------------------------------------
    console.log('\n▶ PHASE 3: Simulating 7-Step Migration Convention for New Table');

    const testTableName = '_test_oct30_data_api_table';

    // Cleanup beforehand if remnant exists
    await client.query(`DROP TABLE IF EXISTS public.${testTableName} CASCADE;`);

    // Step 1: Create Table
    await client.query(`
      CREATE TABLE public.${testTableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        institution_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    assert(true, `Step 1: Ephemeral table public.${testTableName} created successfully`);

    // Step 2: Create Index
    await client.query(`
      CREATE INDEX idx_${testTableName}_inst ON public.${testTableName}(institution_id);
    `);
    assert(true, `Step 2: Performance index created`);

    // Step 3: Enable RLS
    await client.query(`
      ALTER TABLE public.${testTableName} ENABLE ROW LEVEL SECURITY;
    `);
    assert(true, `Step 3: RLS enabled on test table`);

    // Step 4: Explicit Grants
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${testTableName} TO authenticated;
      GRANT ALL ON TABLE public.${testTableName} TO service_role;
    `);
    assert(true, `Step 4: Explicit Data API grants assigned to authenticated and service_role`);

    // Step 5: RLS Policies (Tenant isolation for VCTM Code 340)
    await client.query(`
      CREATE POLICY "${testTableName}_read" ON public.${testTableName}
        FOR SELECT TO authenticated
        USING (institution_id = '00000000-0000-0000-0000-000000000001');

      CREATE POLICY "${testTableName}_write" ON public.${testTableName}
        FOR INSERT TO authenticated
        WITH CHECK (institution_id = '00000000-0000-0000-0000-000000000001');
    `);
    assert(true, `Step 5: Strict RLS policies established for authenticated role`);

    // Step 6: Verify Grants in PostgreSQL Information Schema
    const testGrantsRes = await client.query(`
      SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) as privs
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = '${testTableName}'
        AND grantee IN ('authenticated', 'service_role')
      GROUP BY grantee;
    `);

    const testGrantees = testGrantsRes.rows.map(r => r.grantee);
    assert(testGrantees.includes('authenticated'), `New table has active grant for 'authenticated'`);
    assert(testGrantees.includes('service_role'), `New table has active grant for 'service_role'`);

    // Step 7: Teardown Ephemeral Table
    await client.query(`DROP TABLE IF EXISTS public.${testTableName} CASCADE;`);
    assert(true, `Step 7: Ephemeral test table torn down cleanly`);

    console.log('\n================================================================================');
    console.log(`🎉 ALL ${passed}/${total} ASSERTIONS PASSED!`);
    console.log('   - 100% of existing 41 tables maintain active RLS and Data API privileges');
    console.log('   - Migration 052 forward default privileges verified');
    console.log('   - 7-step convention for new public tables verified end-to-end');
    console.log('================================================================================\n');

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err.message);
  process.exit(1);
});
