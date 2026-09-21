import { createClient } from '@supabase/supabase-js';
import { supabase as clientA } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import * as fs from 'fs';

if (!process.env.VITE_SUPABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Session B independent client simulating another user / browser tab
const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runRealtimeAndSpeedOptimizationTests() {
  console.log('================================================================');
  console.log('🚀 TESTING MAXIMUM LOADING SPEED & TRUE REAL-TIME MULTI-SESSION SYNC');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  // TEST 1: Granular Query Latency Benchmark
  console.log('--- TEST 1: Granular Query Latency Benchmark ---');
  const t0 = performance.now();
  const students = await supabaseService.fetchStudents(true);
  const t1 = performance.now();
  const studentLatency = Math.round(t1 - t0);
  console.log(`  ⏱️  fetchStudents() direct query: ${studentLatency}ms (${students.length} rows)`);
  assert(students && students.length > 0, `Students fetched successfully without error (${students.length} rows)`);
  assert(studentLatency < 1200, `Students query returned within fast latency threshold (${studentLatency}ms < 1200ms)`);

  const t2 = performance.now();
  const timetable = await supabaseService.fetchTimetable();
  const t3 = performance.now();
  const timetableLatency = Math.round(t3 - t2);
  console.log(`  ⏱️  fetchTimetable() direct query: ${timetableLatency}ms (${timetable.length} rows)`);
  assert(timetable && timetable.length > 0, `Timetable fetched successfully (${timetable.length} entries)`);
  assert(timetableLatency < 1200, `Timetable query returned within fast latency threshold (${timetableLatency}ms < 1200ms)`);

  // TEST 2: Parallel Master Data Fetch Latency Benchmark & Static Cache
  console.log('\n--- TEST 2: Parallel Master Data & Cache Performance ---');
  const t4 = performance.now();
  const static1 = await supabaseService.fetchStaticSetup(true);
  const t5 = performance.now();
  const firstStaticLatency = Math.round(t5 - t4);
  console.log(`  ⏱️  fetchStaticSetup(force=true) uncached: ${firstStaticLatency}ms`);
  assert(Boolean(static1 && static1.departments.length > 0), 'Static institutional setup loaded correctly');

  const t6 = performance.now();
  const static2 = await supabaseService.fetchStaticSetup(false);
  const t7 = performance.now();
  const cachedStaticLatency = Math.round(t7 - t6);
  console.log(`  ⏱️  fetchStaticSetup(force=false) cached: ${cachedStaticLatency}ms`);
  assert(cachedStaticLatency < 5, `Static master data cache lookup is instantaneous (${cachedStaticLatency}ms < 5ms)`);

  // TEST 3: Cross-Session True Realtime Multi-User Sync
  console.log('\n--- TEST 3: Multi-Session Realtime Synchronization (Session A Mutation -> Session B Live Push) ---');
  
  const testRollNumber = `RT-${Date.now().toString().slice(-6)}`;
  const testStudentName = 'REALTIME TEST STUDENT';
  const sampleStudent = students.find(s => s.section_id && s.department_id && s.academic_year_id && s.institution_id && s.program_id) || students[0];

  let sessionBReceivedEvent: any = null;

  const realtimePromise = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.log('  ⚠️ Realtime wait timed out (8000ms)');
      resolve();
    }, 8000);

    const channelB = clientB
      .channel('test-realtime-sub')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'students' },
        (payload) => {
          if (payload.new && (payload.new as any).roll_number === testRollNumber) {
            console.log(`  ⚡ Session B received live postgres_changes INSERT event for ${testRollNumber}!`);
            sessionBReceivedEvent = payload.new;
            clearTimeout(timeout);
            clientB.removeChannel(channelB);
            resolve();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('  📡 Session B subscribed to students postgres_changes channel.');
          triggerSessionAMutation();
        }
      });
  });

  async function triggerSessionAMutation() {
    console.log(`  📤 Session A inserting student ${testRollNumber}...`);
    const { error: insertError } = await clientA
      .from('students')
      .insert({
        roll_number: testRollNumber,
        full_name: testStudentName,
        institution_id: sampleStudent.institution_id,
        department_id: sampleStudent.department_id,
        program_id: sampleStudent.program_id,
        academic_session_id: sampleStudent.academic_session_id,
        academic_year_id: sampleStudent.academic_year_id,
        semester_id: sampleStudent.semester_id,
        section_id: sampleStudent.section_id,
        admission_type: 'Regular',
        active: true,
      });

    if (insertError) {
      console.error('Session A insert error:', insertError);
    } else {
      console.log('  ✅ Session A insert succeeded in Supabase Cloud.');
    }
  }

  await realtimePromise;

  assert(sessionBReceivedEvent !== null, `Session B received postgres_changes INSERT event in realtime without refresh`);
  assert(sessionBReceivedEvent?.roll_number === testRollNumber, `Event payload matched inserted roll number (${testRollNumber})`);

  // Clean up test student from Session A
  console.log('  🧹 Cleaning up test student record...');
  const { error: deleteErr } = await clientA
    .from('students')
    .delete()
    .eq('roll_number', testRollNumber);
  assert(!deleteErr, 'Test student cleaned up successfully');

  // TEST 4: Code Quality - Zero Polling and Zero Stale Cache
  console.log('\n--- TEST 4: Verification of Zero Polling & Zero Stale Dynamic Cache ---');
  const contextCode = fs.readFileSync('src/context/AcademicContext.tsx', 'utf-8');
  const hasSetInterval = contextCode.includes('setInterval');
  assert(!hasSetInterval, 'AcademicContext contains 0 setInterval polling loops');

  const supabaseServiceCode = fs.readFileSync('src/lib/services/supabaseService.ts', 'utf-8');
  const cachesStudentsInStaticMaster = supabaseServiceCode.includes(`students: _staticCache`);
  assert(!cachesStudentsInStaticMaster, 'Dynamic entities (students, faculty, etc.) are NOT blocked by static master cache');

  // TEST 5: Verify Student Directory Pagination
  console.log('\n--- TEST 5: Verify Student Directory Client-Side Pagination ---');
  const studentDirCode = fs.readFileSync('src/pages/admin/StudentDirectoryPage.tsx', 'utf-8');
  assert(studentDirCode.includes('paginatedStudents'), 'StudentDirectoryPage uses paginatedStudents');
  assert(studentDirCode.includes('pageSize = 25'), 'StudentDirectoryPage pageSize is set to 25');
  assert(studentDirCode.includes('ChevronLeft') && studentDirCode.includes('ChevronRight'), 'StudentDirectoryPage renders pagination navigation buttons');

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runRealtimeAndSpeedOptimizationTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
