import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { parseAndValidateStudentCSV } from '../lib/utils/csvParser';

async function runMultiYearTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MULTI-YEAR ACADEMIC ERP TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
      failed++;
    }
  }

  // 1. Verify Academic Years (1st, 2nd, 3rd, 4th)
  const { data: years, error: yErr } = await supabase
    .from('academic_years')
    .select('*')
    .order('year_number');

  assert(!yErr && years && years.length >= 4, 'Test 1: Academic Years exist in database', `Found ${years?.length} years`);
  const yearNumbers = years?.map(y => y.year_number);
  assert(
    [1, 2, 3, 4].every(n => yearNumbers?.includes(n)),
    'Test 2: All 4 year numbers (1, 2, 3, 4) present in academic_years',
    `Found years: ${JSON.stringify(yearNumbers)}`
  );

  // 2. Verify Semesters linked to years
  const { data: semesters, error: semErr } = await supabase
    .from('semesters')
    .select('*')
    .order('semester_number');

  assert(!semErr && semesters && semesters.length >= 4, 'Test 3: Semesters exist in database', `Found ${semesters?.length} semesters`);
  const semNumbers = semesters?.map(s => s.semester_number);
  assert(
    [1, 3, 5, 7].every(n => semNumbers?.includes(n)),
    'Test 4: Odd semesters (1st, 3rd, 5th, 7th) exist for all 4 years',
    `Found semesters: ${JSON.stringify(semNumbers)}`
  );

  // 3. Verify Class Sections exist across multiple years
  const { data: sections, error: secErr } = await supabase
    .from('sections')
    .select('*, semesters(name, academic_year_id)')
    .order('name');

  assert(!secErr && sections && sections.length >= 8, 'Test 5: At least 8 sections (A & B per year) exist in database', `Found ${sections?.length} sections`);

  // 4. Verify Super Admin Identity
  const { data: adminProfile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'super_admin')
    .maybeSingle();

  assert(
    !profErr && adminProfile?.full_name === 'Tarun Kushwah',
    'Test 6: Super Admin profile name is "Tarun Kushwah"',
    `Found full_name: "${adminProfile?.full_name}"`
  );

  // 5. Verify 2nd Year Student Data Integrity & Target Student
  const { data: targetStudent, error: studErr } = await supabase
    .from('students')
    .select('*, sections(name), academic_years(name)')
    .eq('roll_number', '2503400100057')
    .maybeSingle();

  assert(
    !studErr && targetStudent && targetStudent.full_name === 'TARUN KUSHWAH',
    'Test 7: Target Student Tarun Kushwah (2503400100057) preserved intact',
    `Found student: ${targetStudent?.full_name}, section: ${targetStudent?.sections?.name}`
  );

  const { count: studentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true });

  assert((studentCount || 0) >= 106, 'Test 8: Student roster preserved (>= 106 students in 2nd year)', `Total count: ${studentCount}`);

  // 6. Verify Dynamic Session Resolution in Service Layer
  const currentSessionId = await supabaseService.getCurrentSessionId();
  assert(
    Boolean(currentSessionId && currentSessionId.length > 10),
    'Test 9: supabaseService.getCurrentSessionId() resolves active session UUID dynamically',
    `Resolved: ${currentSessionId}`
  );

  // 7. Test CSV Ingestion with Multi-Year Resolution and Updates
  const sampleCSV = `roll_no,name,email,year,section,admission_type
TEST_9901,Test MultiYear Student 1,test1@vctm.in,1,A,Regular
TEST_9902,Test MultiYear Student 2,test2@vctm.in,3,B,Regular
2503400100057,TARUN KUSHWAH,tarun@student.vctm.in,2,B,Regular`;

  const parsed = await parseAndValidateStudentCSV(sampleCSV, {
    institutionId: '11111111-1111-1111-1111-111111111111',
    departmentId: 'fe5bc365-7a68-4290-b05e-acfa274f748a',
    programId: 'c71b3983-9ff8-43e1-a9a0-b778676bf186',
    sessionId: currentSessionId,
    years: years || [],
    semesters: semesters || [],
    sections: sections || [],
    faculty: [],
    existingStudents: [targetStudent as any],
  });

  assert(
    parsed.validRows.length === 3 && parsed.newCount === 2 && parsed.updateCount === 1,
    'Test 10: CSV parser resolves multi-year rows and distinguishes inserts vs updates',
    `Valid: ${parsed.validRows.length}, New: ${parsed.newCount}, Update: ${parsed.updateCount}`
  );

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultiYearTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
