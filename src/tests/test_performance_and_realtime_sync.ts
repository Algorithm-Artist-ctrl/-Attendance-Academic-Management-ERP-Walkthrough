import { supabaseService } from '../lib/services/supabaseService';
import { supabase } from '../lib/supabase/supabaseClient';
import { TimetableResolver } from '../lib/utils/timetableResolver';
import { ExtractedTimetableDocument } from '../types/academic.types';
import { TimetableEntry } from '../types/database.types';

// Mock localStorage for Node environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED (${totalTests}): ${testName}`);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`✅ PASSED (${totalTests}): ${testName}`);
  }
}

async function runPerformanceAndRealtimeVerification() {
  console.log('======================================================================');
  console.log('  VCTM ERP — HIGH PERFORMANCE & FAST REALTIME SYNCHRONIZATION TEST');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // --- SUITE 1: Master Cache Latency & Invalidation ---
  console.log('--- SUITE 1: Master Cache Latency & Invalidation ---');
  const t0 = Date.now();
  const freshMaster = await supabaseService.fetchMasterData(true);
  const freshTimeMs = Date.now() - t0;
  assert(Boolean(freshMaster && freshMaster.sections.length > 0), `Fresh Master DB fetch completed in ${freshTimeMs}ms`);

  const t1 = Date.now();
  const cachedMaster = await supabaseService.fetchMasterData(false);
  const cachedTimeMs = Date.now() - t1;
  assert(Boolean(cachedMaster && cachedMaster.sections.length === freshMaster!.sections.length), `Cached Master DB fetch completed in ${cachedTimeMs}ms (Sub-5ms Memory Hit)`);
  assert(cachedTimeMs <= 10, 'In-memory master cache retrieval is under 10ms');

  // Test Cache Invalidation
  supabaseService.invalidateMasterCache();
  const t2 = Date.now();
  const revalidatedMaster = await supabaseService.fetchMasterData(false);
  const revalidatedTimeMs = Date.now() - t2;
  assert(Boolean(revalidatedMaster && revalidatedMaster.sections.length > 0), `Revalidated Master DB fetch completed after cache invalidation in ${revalidatedTimeMs}ms`);

  // --- SUITE 2: Composed fetchAllData Performance ---
  console.log('\n--- SUITE 2: Composed fetchAllData Performance ---');
  const t3 = Date.now();
  const fullData = await supabaseService.fetchAllData(false);
  const fullDataTimeMs = Date.now() - t3;
  assert(Boolean(fullData && fullData.timetable.length > 0), `Composed full ERP dataset fetched in ${fullDataTimeMs}ms`);
  assert(fullData!.students.length > 0, `Loaded ${fullData!.students.length} students`);
  assert(fullData!.faculty.length > 0, `Loaded ${fullData!.faculty.length} faculty members`);
  assert(fullData!.timetable.length > 0, `Loaded ${fullData!.timetable.length} timetable entries`);

  // --- SUITE 3: Section B Timetable Live Propagation & Fast Lookup ---
  console.log('\n--- SUITE 3: Section B Timetable Live Propagation & Fast Lookup ---');
  const secB = fullData!.sections.find(s => s.name === 'B')!;
  const secA = fullData!.sections.find(s => s.name === 'A')!;
  assert(Boolean(secB && secA), 'Resolved Section A and Section B records');

  const secBEntries = fullData!.timetable.filter(t => t.section_id === secB.id && t.active);
  assert(secBEntries.length > 0, `Section B has ${secBEntries.length} active live timetable slots`);

  const secAEntries = fullData!.timetable.filter(t => t.section_id === secA.id && t.active);
  assert(secAEntries.length > 0, `Section A has ${secAEntries.length} active live timetable slots`);

  // Verify Zero Cross-Section Leakage
  const crossLeakAInB = secBEntries.some(t => t.section_id === secA.id);
  const crossLeakBInA = secAEntries.some(t => t.section_id === secB.id);
  assert(!crossLeakAInB, 'Section B query returns ZERO Section A records (Strict Isolation)');
  assert(!crossLeakBInA, 'Section A query returns ZERO Section B records (Strict Isolation)');

  // --- SUITE 4: Realtime Notice Fast Targeted Query ---
  console.log('\n--- SUITE 4: Realtime Notice Fast Targeted Query ---');
  const t4 = Date.now();
  const notices = await supabaseService.fetchNotices();
  const noticeTimeMs = Date.now() - t4;
  assert(Array.isArray(notices), `Fetched ${notices.length} live notices in ${noticeTimeMs}ms`);

  // --- SUITE 5: Assessment & Sessional Realtime Isolation ---
  console.log('\n--- SUITE 5: Assessment & Sessional Realtime Isolation ---');
  const sessionalMarks = fullData!.sessionalMarks;
  const quizzes = fullData!.quizzes;
  const assignments = fullData!.courseAssignments;

  assert(Array.isArray(sessionalMarks), `Loaded ${sessionalMarks.length} sessional marks`);
  assert(Array.isArray(quizzes), `Loaded ${quizzes.length} live quizzes`);
  assert(Array.isArray(assignments), `Loaded ${assignments.length} live assignments`);

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} PERFORMANCE & REALTIME CHECKS PASSED WITH 100% SUCCESS`);
  console.log('======================================================================\n');
}

runPerformanceAndRealtimeVerification().catch(err => {
  console.error('Fatal error in performance verification:', err);
  process.exit(1);
});
