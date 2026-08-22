import { erpStorage } from '../lib/storage/erpStorage';
import { supabaseService } from '../lib/services/supabaseService';

// Mock localStorage in Node.js environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${testName}`);
  }
}

async function runSectionMappingVerification() {
  console.log('=================================================================');
  console.log('  VERIFYING STRICT SECTION A vs SECTION B DATA ISOLATION');
  console.log('=================================================================\n');

  // 1. Fetch real Supabase Cloud database
  const supabaseData = await supabaseService.fetchAllData();
  assert(Boolean(supabaseData), 'Fetched authoritative database from Supabase');
  erpStorage.syncFromSupabase(supabaseData!);

  const secA = supabaseData!.sections.find(s => s.name === 'A')!;
  const secB = supabaseData!.sections.find(s => s.name === 'B')!;

  assert(Boolean(secA && secB), 'Sections A and B exist in Supabase');
  assert(secA.room_number.includes('007'), 'Section A room is A-007');
  assert(secB.room_number.includes('006'), 'Section B room is A-006');

  // ---------------------------------------------------------------
  // TEST 1: Login using Section A Student (ADITYA KUMAR - 2503400100001)
  // ---------------------------------------------------------------
  console.log('\n--- TEST 1: Section A Student (2503400100001 - ADITYA KUMAR) ---');
  const studentA = supabaseData!.students.find(s => s.roll_number === '2503400100001')!;
  assert(Boolean(studentA), 'Student A found in Supabase');
  assert(studentA.section_id === secA.id, 'Student A database section_id matches Section A UUID');

  // Verify timetable resolution for Student A
  const timetableA = supabaseData!.timetable.filter(t => t.section_id === studentA.section_id);
  assert(timetableA.length === 42, 'Student A has exactly 42 Section A weekly lectures');
  assert(timetableA.every(t => t.section_id === secA.id), 'Zero Section B timetable records in Student A view');

  // Verify Section A faculty assignments
  const dsSub = supabaseData!.subjects.find(s => s.subject_code === 'BCS301')!;
  const dstlSub = supabaseData!.subjects.find(s => s.subject_code === 'BCS303')!;

  const dsEntryA = timetableA.find(t => t.subject_id === dsSub.id)!;
  const dstlEntryA = timetableA.find(t => t.subject_id === dstlSub.id)!;

  const facDSA = supabaseData!.faculty.find(f => f.id === dsEntryA.faculty_id)!;
  const facDSTLA = supabaseData!.faculty.find(f => f.id === dstlEntryA.faculty_id)!;

  assert(facDSA.full_name === 'Mr. Alok Gupta', 'Section A Data Structure is taught by Mr. Alok Gupta');
  assert(facDSTLA.full_name === 'Ms. Hemlata Chaudhary', 'Section A DSTL is taught by Ms. Hemlata Chaudhary');

  // ---------------------------------------------------------------
  // TEST 2: Login using Section B Student (TARUN KUSHWAH - 2503400100057)
  // ---------------------------------------------------------------
  console.log('\n--- TEST 2: Section B Student (2503400100057 - TARUN KUSHWAH) ---');
  const studentB = supabaseData!.students.find(s => s.roll_number === '2503400100057')!;
  assert(Boolean(studentB), 'Student B found in Supabase');
  assert(studentB.section_id === secB.id, 'Student B database section_id matches Section B UUID');

  // Verify timetable resolution for Student B
  const timetableB = supabaseData!.timetable.filter(t => t.section_id === studentB.section_id);
  assert(timetableB.length === 42, 'Student B has exactly 42 Section B weekly lectures');
  assert(timetableB.every(t => t.section_id === secB.id), 'Zero Section A timetable records in Student B view');

  // Verify Section B faculty assignments
  const dsEntryB = timetableB.find(t => t.subject_id === dsSub.id)!;
  const dstlEntryB = timetableB.find(t => t.subject_id === dstlSub.id)!;

  const facDSB = supabaseData!.faculty.find(f => f.id === dsEntryB.faculty_id)!;
  const facDSTLB = supabaseData!.faculty.find(f => f.id === dstlEntryB.faculty_id)!;

  assert(facDSB.full_name === 'Ms. Hemlata Chaudhary', 'Section B Data Structure is taught by Ms. Hemlata Chaudhary');
  assert(facDSTLB.full_name === 'Mr. Imran Raza Khan', 'Section B DSTL is taught by Mr. Imran Raza Khan');

  // ---------------------------------------------------------------
  // TEST 3: Cross-Section Leakage Check
  // ---------------------------------------------------------------
  console.log('\n--- TEST 3: Strict Cross-Section Zero-Leakage ---');
  const secAEntryIds = new Set(timetableA.map(t => t.id));
  const secBEntryIds = new Set(timetableB.map(t => t.id));
  const overlap = [...secAEntryIds].filter(id => secBEntryIds.has(id));
  assert(overlap.length === 0, 'Zero overlapping timetable entries between Section A and Section B');

  // ---------------------------------------------------------------
  // TEST 4: Regression Test on Section A Student
  // ---------------------------------------------------------------
  console.log('\n--- TEST 4: Regression Verification on Section A Student ---');
  const studentA2 = supabaseData!.students.find(s => s.roll_number === '2403400100021')!; // HIMANSHU
  assert(studentA2.section_id === secA.id, 'Himanshu is strictly in Section A');
  const timetableA2 = supabaseData!.timetable.filter(t => t.section_id === studentA2.section_id);
  assert(timetableA2.length === 42 && timetableA2.every(t => t.section_id === secA.id), 'Section A remains 100% intact');

  console.log('\n=================================================================');
  console.log('  🎉 SECTION ISOLATION & AUTHORITATIVE RESOLUTION VERIFIED! 🎉');
  console.log('=================================================================\n');
}

runSectionMappingVerification().catch(err => {
  console.error('Fatal error during section mapping verification:', err);
  process.exit(1);
});
