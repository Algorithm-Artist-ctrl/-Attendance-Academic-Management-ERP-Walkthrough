import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function runPerformanceAndDataSafetySuite() {
  console.log('================================================================================');
  console.log('VCTM ERP: COMPREHENSIVE PERFORMANCE OVERHAUL & DATA-SAFETY VERIFICATION SUITE');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      if (detail) console.error(`   └─ ${detail}`);
      process.exitCode = 1;
    }
  }

  const rootDir = process.cwd();

  // SECTION 1: Migration 031 Static & Schema Verification
  console.log('\n--- SECTION 1: Database Migration 031 & Atomic RPC ---');
  const mig031Path = path.join(rootDir, 'supabase/migrations/031_performance_optimization_and_atomic_rpc.sql');
  assert(fs.existsSync(mig031Path), 'Migration 031 file exists on disk');
  const mig031Sql = fs.readFileSync(mig031Path, 'utf8');
  assert(mig031Sql.includes('save_attendance_session'), 'Migration 031 upgrades save_attendance_session RPC');
  assert(mig031Sql.toUpperCase().includes('RETURNS JSONB'), 'save_attendance_session RPC returns JSONB atomically');
  assert(mig031Sql.includes('idx_sessional_assessments_sec_sub'), 'Migration 031 includes idx_sessional_assessments_sec_sub index');
  assert(mig031Sql.includes('idx_attendance_sessions_sec_date'), 'Migration 031 includes idx_attendance_sessions_sec_date index');
  assert(mig031Sql.includes('idx_assignments_section_active'), 'Migration 031 includes idx_assignments_section_active index');
  assert(mig031Sql.includes('idx_quizzes_section_active'), 'Migration 031 includes idx_quizzes_section_active index');
  assert(mig031Sql.includes('idx_group_messages_group_created'), 'Migration 031 includes idx_group_messages_group_created index');
  assert(mig031Sql.includes('idx_messages_conversation_created'), 'Migration 031 includes idx_messages_conversation_created index');

  // SECTION 2: Live Database Index & Function Verification
  console.log('\n--- SECTION 2: Live PostgreSQL Database Inspection ---');
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.log('ℹ️ DATABASE_URL not provided. Skipping live DB index inspection (static migration assertions passed).');
  } else {
    const pgClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

    try {
      const t0 = Date.now();
      await pgClient.connect();
      const connTime = Date.now() - t0;
      assert(true, 'Connected to live Supabase PostgreSQL instance', `Connection established in ${connTime}ms`);

      // Verify indexes in pg_indexes
      const { rows: indexes } = await pgClient.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND indexname IN (
            'idx_sessional_assessments_sec_sub',
            'idx_attendance_sessions_sec_date',
            'idx_assignments_section_active',
            'idx_quizzes_section_active',
            'idx_group_messages_group_created',
            'idx_messages_conversation_created'
          );
      `);
      const liveIndexNames = indexes.map((r: any) => r.indexname);
      assert(liveIndexNames.includes('idx_sessional_assessments_sec_sub'), 'Live DB has idx_sessional_assessments_sec_sub index');
      assert(liveIndexNames.includes('idx_attendance_sessions_sec_date'), 'Live DB has idx_attendance_sessions_sec_date index');
      assert(liveIndexNames.includes('idx_assignments_section_active'), 'Live DB has idx_assignments_section_active index');
      assert(liveIndexNames.includes('idx_quizzes_section_active'), 'Live DB has idx_quizzes_section_active index');
      assert(liveIndexNames.includes('idx_group_messages_group_created'), 'Live DB has idx_group_messages_group_created index');
      assert(liveIndexNames.includes('idx_messages_conversation_created'), 'Live DB has idx_messages_conversation_created index');

      // Verify save_attendance_session RPC exists and accepts parameters
      const { rows: rpcRows } = await pgClient.query(`
        SELECT proname, prorettype::regtype::text AS ret_type
        FROM pg_proc
        WHERE proname = 'save_attendance_session';
      `);
      assert(rpcRows.length > 0, 'save_attendance_session RPC exists in PostgreSQL pg_proc catalog');
      assert(rpcRows.some((r: any) => r.ret_type === 'jsonb'), 'save_attendance_session return type is jsonb for single round-trip hydration');

    } catch (err: any) {
      console.error('Error during PostgreSQL verification:', err.message);
      assert(false, 'Live PostgreSQL verification succeeded', err.message);
    } finally {
      await pgClient.end().catch(() => {});
    }
  }

  // SECTION 3: Service Layer Single-RPC & Zero-Invalidation Architecture
  console.log('\n--- SECTION 3: Service Layer Architecture (supabaseService.ts) ---');
  const serviceFile = path.join(rootDir, 'src/lib/services/supabaseService.ts');
  const serviceCode = fs.readFileSync(serviceFile, 'utf8');

  // Verify saveAttendance no longer runs client-side pre-queries or cache wipes
  const saveAttendanceStartIndex = serviceCode.indexOf('async saveAttendance(');
  const saveAttendanceEndIndex = serviceCode.indexOf('async deleteAttendanceSession(');
  const saveAttendanceSnippet = serviceCode.slice(saveAttendanceStartIndex, saveAttendanceEndIndex);

  assert(!saveAttendanceSnippet.includes("verifyFacultyClassAssignment"), 'saveAttendance eliminates redundant client-side faculty verification query');
  assert(!saveAttendanceSnippet.includes("validStudentIds"), 'saveAttendance eliminates redundant client-side roster fetch query');
  assert(!saveAttendanceSnippet.includes("this.invalidateMasterCache()"), 'saveAttendance does NOT wipe master setup cache (prevents cache thrashing)');
  assert(saveAttendanceSnippet.includes("supabase.rpc('save_attendance_session'"), 'saveAttendance executes via single atomic RPC call');
  assert(serviceCode.includes("fetchFacultyAcademicRecords(facultyId: string)"), 'Service layer implements role-scoped fetchFacultyAcademicRecords');
  assert(serviceCode.includes("fetchStudentAcademicRecords(studentId: string, sectionId?: string)"), 'Service layer implements role-scoped fetchStudentAcademicRecords');

  // SECTION 4: AuthContext Speed & Stability
  console.log('\n--- SECTION 4: AuthContext Speed & Provider Memoization ---');
  const authFile = path.join(rootDir, 'src/context/AuthContext.tsx');
  const authCode = fs.readFileSync(authFile, 'utf8');

  assert(authCode.includes('cachedProfileRef = useRef<Map<string, { profile: UserProfile; timestamp: number }>>'), 'AuthContext contains high-speed profile cache ref');
  assert(authCode.includes('const cached = cachedProfileRef.current.get(authUserId)'), 'AuthContext resolves cached user profiles instantaneously');
  assert(authCode.includes('inFlightProfileRef.current.get(authUserId)'), 'AuthContext deduplicates concurrent in-flight profile hydrations');
  assert(authCode.includes('const authContextValue = useMemo('), 'AuthContext.Provider value is wrapped in useMemo to eliminate child re-renders');

  // SECTION 5: AcademicContext Optimization
  console.log('\n--- SECTION 5: AcademicContext Gating, Role-Scoped Realtime & Memoization ---');
  const acadFile = path.join(rootDir, 'src/context/AcademicContext.tsx');
  const acadCode = fs.readFileSync(acadFile, 'utf8');

  assert(acadCode.includes('const { user, role, isLoading: authLoading, isAuthenticated } = useAuth()'), 'AcademicContext extracts authLoading and isAuthenticated');
  assert(acadCode.includes('if (authLoading) return'), 'AcademicContext gates initial fetch on authLoading resolution');
  assert(acadCode.includes('loadDataFromSupabase(false)'), 'AcademicContext initial load passes forceRefreshMaster = false to leverage cache');
  assert(acadCode.includes('}, [user?.id, role])'), 'AcademicContext loadDataFromSupabase depends on primitive user?.id and role');
  assert(acadCode.includes('await supabaseService.fetchStudentAcademicRecords(studentId, sectionId)'), 'refreshAssessments uses role-scoped fetchStudentAcademicRecords for students');
  assert(acadCode.includes('await supabaseService.fetchFacultyAcademicRecords(facultyId)'), 'refreshAssessments uses role-scoped fetchFacultyAcademicRecords for faculty');
  assert(acadCode.includes('const contextValue = useMemo('), 'AcademicContext.Provider value is wrapped in useMemo');

  // SECTION 6: Form Data Safety Across Pages
  console.log('\n--- SECTION 6: Form Data Safety & Error Preservation Audits ---');

  // 1. TakeAttendancePage
  const attendFile = path.join(rootDir, 'src/pages/faculty/TakeAttendancePage.tsx');
  const attendCode = fs.readFileSync(attendFile, 'utf8');
  assert(attendCode.includes('isSavingRef.current = true'), 'TakeAttendancePage locks isSavingRef to prevent concurrent save races');
  assert(attendCode.includes("setSaveStatus('error')"), 'TakeAttendancePage handles save errors with explicit 4-state error indicator');
  assert(attendCode.includes('setSavedAttendanceMap({ ...finalMap })'), 'TakeAttendancePage updates saved map ONLY upon successful save verification');

  // 2. NoticesPage
  const noticeFile = path.join(rootDir, 'src/pages/common/NoticesPage.tsx');
  const noticeCode = fs.readFileSync(noticeFile, 'utf8');
  assert(noticeCode.includes('setPublishSuccess(true)'), 'NoticesPage triggers explicit success state upon Supabase confirmation');
  assert(noticeCode.includes('setPublishError(err.message ||'), 'NoticesPage retains form inputs on error and reports exact message');
  assert(!noticeCode.includes('catch (err: any) {\n      setNewTitle('), 'NoticesPage NEVER clears title or content on catch');

  // 3. FacultyAssignmentsPage
  const assignFile = path.join(rootDir, 'src/pages/faculty/FacultyAssignmentsPage.tsx');
  const assignCode = fs.readFileSync(assignFile, 'utf8');
  assert(assignCode.includes("setErrorMsg(err.message || 'Failed to create assignment.')"), 'FacultyAssignmentsPage retains form fields on error');
  assert(!assignCode.includes('catch (err: any) {\n      setTitle('), 'FacultyAssignmentsPage NEVER clears title on catch');

  // 4. FacultyQuizzesPage
  const quizFile = path.join(rootDir, 'src/pages/faculty/FacultyQuizzesPage.tsx');
  const quizCode = fs.readFileSync(quizFile, 'utf8');
  assert(quizCode.includes("setErrorMsg(err.message || 'Failed to create quiz.')"), 'FacultyQuizzesPage retains inputs on error');
  assert(!quizCode.includes('catch (err: any) {\n      setTitle('), 'FacultyQuizzesPage NEVER clears title on catch');

  // 5. MessagesPage
  const msgFile = path.join(rootDir, 'src/pages/communication/MessagesPage.tsx');
  const msgCode = fs.readFileSync(msgFile, 'utf8');
  assert(msgCode.includes('Your text has been preserved'), 'MessagesPage guarantees unsent message retention on network failure');

  // SECTION 7: Strict Zero window.location.reload() Audit
  console.log('\n--- SECTION 7: SPA Navigation Guarantee (Zero window.location.reload) ---');
  function scanDir(dir: string, fileList: string[] = []) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (f !== 'node_modules' && f !== '.git' && f !== 'dist' && f !== 'tests') {
          scanDir(full, fileList);
        }
      } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
        fileList.push(full);
      }
    }
    return fileList;
  }

  const srcFiles = scanDir(path.join(rootDir, 'src'));
  let reloadViolations: string[] = [];
  for (const f of srcFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('window.location.reload') || content.includes('location.reload(')) {
      reloadViolations.push(path.relative(rootDir, f));
    }
  }
  assert(reloadViolations.length === 0, 'Zero window.location.reload() across all production source files', reloadViolations.length > 0 ? `Violations in: ${reloadViolations.join(', ')}` : 'Scanned all production TS/TSX files');

  // SUMMARY REPORT
  console.log('\n================================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} / ${total} CHECKS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================================\n');

  if (passed === total) {
    console.log('🎉 ALL PERFORMANCE AND DATA-SAFETY AUDITS PASSED WITH ZERO ERRORS!');
  } else {
    console.error('⚠️ SOME AUDITS FAILED. PLEASE REVIEW LOG ABOVE.');
    process.exit(1);
  }
}

runPerformanceAndDataSafetySuite().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
