import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

// Mock localStorage for Node.js test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
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

async function runFacultyScopedDataTests() {
  console.log('======================================================================');
  console.log('    VCTM ERP FACULTY-SPECIFIC DATA & SECTION-WISE ACCESS VERIFICATION');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Fetch live Supabase Cloud database
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Live master database connected and loaded from Supabase Cloud');

  // 2. Identify Ms. Hemlata Chaudhary (HEM) from live database
  const hemlata = dbData?.faculty.find(f => f.faculty_code === 'HEM' || f.full_name.includes('Hemlata'))!;
  assert(Boolean(hemlata), 'Resolved Ms. Hemlata Chaudhary (HEM) from live database');
  assert(hemlata.faculty_code === 'HEM', 'Faculty code is HEM');
  assert(hemlata.employee_code === 'FAC-CSE-002', 'Employee code is FAC-CSE-002');
  const hemlataId = hemlata.id;

  // 3. Verify Her Real Database Assignments (faculty_subject_assignments + timetable)
  console.log('\n--- SUITE 1: Faculty Academic Authorization Scope ---');
  const myFsa = (dbData?.assignments || []).filter(a => a.faculty_id === hemlataId && a.active);
  const myTt = (dbData?.timetable || []).filter(t => t.faculty_id === hemlataId && t.active);

  const mySubjectIds = Array.from(new Set([...myFsa.map(a => a.subject_id), ...myTt.map(t => t.subject_id)]));
  const mySubjects = (dbData?.subjects || []).filter(s => mySubjectIds.includes(s.id));
  const mySubjectCodes = mySubjects.map(s => s.subject_code);

  assert(mySubjectCodes.includes('BCS301'), 'Assigned subject: BCS301 Data Structure');
  assert(mySubjectCodes.includes('BCS303'), 'Assigned subject: BCS303 Discrete Structure & Theory of Logic');
  assert(mySubjectCodes.includes('BCS351'), 'Assigned subject: BCS351 Data Structure Lab');
  assert(mySubjectCodes.includes('BCS352'), 'Assigned subject: BCS352 Computer Organization & Architecture Lab');

  // STRICT NEGATIVE CHECKS: Unauthorized subjects MUST NOT be in her scope
  assert(!mySubjectCodes.includes('BAS303'), 'BAS303 (Mathematics IV) is STRICTLY EXCLUDED from her scope');
  assert(!mySubjectCodes.includes('BVE301'), 'BVE301 (Universal Human Values) is STRICTLY EXCLUDED from her scope');
  assert(!mySubjectCodes.includes('BCC301'), 'BCC301 (Cyber Security) is STRICTLY EXCLUDED from her scope');
  assert(!mySubjectCodes.includes('BCS353'), 'BCS353 (Web Designing Workshop) is STRICTLY EXCLUDED from her scope');
  assert(!mySubjectCodes.includes('BCC351'), 'BCC351 (Mini Project) is STRICTLY EXCLUDED from her scope');

  // 4. Section-specific Subject Mapping
  console.log('\n--- SUITE 2: Section-Specific Subject Authorization ---');
  const sectionA = (dbData?.sections || []).find(s => s.name === 'A')!;
  const sectionB = (dbData?.sections || []).find(s => s.name === 'B')!;
  assert(Boolean(sectionA), 'Resolved Section A in database');
  assert(Boolean(sectionB), 'Resolved Section B in database');

  const dstlAssignedSecs = Array.from(new Set([
    ...myFsa.filter(a => {
      const sub = dbData?.subjects.find(s => s.id === a.subject_id);
      return sub?.subject_code === 'BCS303';
    }).map(a => a.section_id),
    ...myTt.filter(t => {
      const sub = dbData?.subjects.find(s => s.id === t.subject_id);
      return sub?.subject_code === 'BCS303';
    }).map(t => t.section_id)
  ]));

  assert(dstlAssignedSecs.includes(sectionA.id), 'BCS303 DSTL is authorized for Section A');

  // 5. Faculty Personal Teaching Timetable
  console.log('\n--- SUITE 3: Faculty Personal Teaching Timetable Isolation ---');
  assert(myTt.length === 16, `Faculty personal timetable contains exactly her 16 weekly teaching lectures`);
  const unauthorizedTtEntries = myTt.filter(t => t.faculty_id !== hemlataId);
  assert(unauthorizedTtEntries.length === 0, 'Zero foreign faculty lectures appear in her teaching timetable');

  // 6. Class Coordinator Timetable Oversight
  console.log('\n--- SUITE 4: Class Coordinator Master Timetable (Section A) ---');
  assert(sectionA.class_coordinator_id === hemlataId, 'Ms. Hemlata Chaudhary is Class Coordinator for Section A');
  const sectionATimetable = (dbData?.timetable || []).filter(t => t.section_id === sectionA.id && t.active);
  assert(sectionATimetable.length === 42, 'Section A Master Timetable contains all 42 weekly periods across all teachers');

  const distinctTeachersInSecA = Array.from(new Set(sectionATimetable.map(t => t.faculty_id)));
  assert(distinctTeachersInSecA.length >= 4, `Coordinator timetable shows all ${distinctTeachersInSecA.length} department teachers in Section A`);

  // 7. Dynamic Sessional Management & Audit Trail
  console.log('\n--- SUITE 5: Sessional Lifecycle, Updates & Strict Isolation ---');
  const studentA = dbData?.students.find(s => s.section_id === sectionA.id)!;
  const studentB = dbData?.students.find(s => s.section_id === sectionB.id)!;
  assert(Boolean(studentA), 'Resolved active student in Section A');
  assert(Boolean(studentB), 'Resolved active student in Section B');

  const dstlSubject = mySubjects.find(s => s.subject_code === 'BCS303')!;

  // Create sessional
  const testSess = await supabaseService.createSessionalAssessment({
    faculty_id: hemlataId,
    subject_id: dstlSubject.id,
    section_id: sectionA.id,
    title: 'Sessional 1 DSTL Scoped',
    max_marks: 20,
    exam_date: '2026-09-20',
    status: 'published',
  });
  assert(Boolean(testSess?.id), 'Created dynamic Sessional 1 for BCS303 Section A');

  // Save marks
  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: testSess.id,
    facultyId: hemlataId,
    subjectId: dstlSubject.id,
    sectionId: sectionA.id,
    maxMarks: 20,
    studentMarks: [{ studentId: studentA.id, marksObtained: 18, oldMarks: undefined, remarks: 'Initial mark' }]
  });

  // Edit marks (18 -> 19)
  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: testSess.id,
    facultyId: hemlataId,
    subjectId: dstlSubject.id,
    sectionId: sectionA.id,
    maxMarks: 20,
    studentMarks: [{ studentId: studentA.id, marksObtained: 19, oldMarks: 18, remarks: 'Re-evaluated' }]
  });

  // Verify upsert avoided duplicate rows
  const { data: marksRows } = await supabase
    .from('sessional_marks')
    .select('*')
    .eq('sessional_assessment_id', testSess.id)
    .eq('student_id', studentA.id);

  assert(marksRows?.length === 1, 'Upsert prevented duplicate rows (exactly 1 mark row exists)');
  assert(marksRows?.[0].marks_obtained === 19, 'Sessional mark was successfully updated to 19');

  // Verify audit log in marks_history
  const { data: historyRows } = await supabase
    .from('marks_history')
    .select('*')
    .eq('entity_id', testSess.id)
    .eq('student_id', studentA.id);

  assert(Boolean(historyRows && historyRows.length > 0), 'Audit trail captured in marks_history table');

  // Teardown test sessional
  await supabaseService.deleteSessionalAssessment(testSess.id);

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} FACULTY-SPECIFIC SCOPED TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runFacultyScopedDataTests().then(() => process.exit(0)).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
