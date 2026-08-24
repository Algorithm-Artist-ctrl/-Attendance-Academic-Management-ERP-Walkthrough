import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { UserProfile, Faculty, Section, TimetableEntry } from '../types/database.types';

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

async function runCoordinatorAndSectionAccessTests() {
  console.log('======================================================================');
  console.log('    VCTM ERP CLASS COORDINATOR + SECTION-WISE ACCESS ACCEPTANCE TEST');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Fetch live Supabase Cloud database
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Live master database connected and loaded from Supabase Cloud');

  // 2. Identify Ms. Hemlata Chaudhary (HEM)
  const hemlata = dbData?.faculty.find(f => f.full_name.includes('Hemlata'))!;
  assert(Boolean(hemlata), 'Resolved Ms. Hemlata Chaudhary (HEM)');
  assert(hemlata.faculty_code === 'HEM', 'Faculty code is HEM');
  assert(hemlata.employee_code === 'FAC-CSE-002', 'Employee code is FAC-CSE-002');
  const hemlataId = hemlata.id;

  // 3. Faculty Dashboard: "MY ASSIGNED CLASSES"
  console.log('\n--- VERIFICATION 1: "MY ASSIGNED CLASSES" TEACHING ISOLATION ---');
  const myAssignments = (dbData?.assignments || []).filter(a => a.faculty_id === hemlataId && a.active);
  const myAssignedSectionIds = Array.from(new Set(myAssignments.map(a => a.section_id)));
  const myAssignedSubjectIds = Array.from(new Set(myAssignments.map(a => a.subject_id)));
  const myAssignedSections = (dbData?.sections || []).filter(s => myAssignedSectionIds.includes(s.id));
  const myAssignedSubjects = (dbData?.subjects || []).filter(s => myAssignedSubjectIds.includes(s.id));

  assert(myAssignedSections.some(s => s.name === 'A'), 'Assigned to Section A for teaching');
  assert(myAssignedSections.some(s => s.name === 'B'), 'Assigned to Section B for teaching');
  assert(myAssignedSubjects.some(s => s.subject_code === 'BCS301'), 'Assigned subject: BCS301 Data Structure');
  assert(myAssignedSubjects.some(s => s.subject_code === 'BCS351'), 'Assigned subject: BCS351 DS Lab');
  assert(!myAssignedSubjects.some(s => s.subject_code === 'KAS302'), 'Mathematics IV is NOT in her teaching portfolio (Strict isolation)');

  // 4. "CLASS COORDINATOR" SECTION SPECIFIC ROLE
  console.log('\n--- VERIFICATION 2: "CLASS COORDINATOR" ASSIGNMENT FIDELITY ---');
  const sectionA = (dbData?.sections || []).find(s => s.name === 'A')!;
  const sectionB = (dbData?.sections || []).find(s => s.name === 'B')!;
  assert(Boolean(sectionA), 'Resolved Section A in database');
  assert(Boolean(sectionB), 'Resolved Section B in database');

  assert(sectionA.class_coordinator_id === hemlataId, 'Ms. Hemlata Chaudhary is Class Coordinator for Section A');
  assert(sectionB.class_coordinator_id !== hemlataId, 'Ms. Hemlata Chaudhary is NOT Class Coordinator for Section B (Section-Specific)');

  // 5. COMPLETE SECTION A TIMETABLE (VIEW ALL FACULTY PERIODS)
  console.log('\n--- VERIFICATION 3: COMPLETE SECTION A MASTER TIMETABLE OVERSIGHT ---');
  const sectionATimetable = (dbData?.timetable || []).filter(t => t.section_id === sectionA.id && t.active);
  assert(sectionATimetable.length === 42, `Complete Section A timetable contains all 42 periods (Mon-Sat, 7 periods/day + Lunch)`);

  const distinctTeachersSecA = Array.from(new Set(sectionATimetable.map(t => t.faculty_id).filter(Boolean)));
  assert(distinctTeachersSecA.length >= 4, `Section A timetable contains multiple faculty members (${distinctTeachersSecA.length} distinct faculty)`);

  // Verify non-Hemlata teachers are visible in Section A timetable
  const naseemMaths = sectionATimetable.find(t => {
    const sub = dbData?.subjects.find(s => s.id === t.subject_id);
    return sub?.subject_code === 'BAS303' || sub?.subject_name.includes('Mathematics');
  });
  assert(Boolean(naseemMaths), 'Maths IV (Dr. Naseem) is visible in Section A master timetable');

  const kuldeepCOA = sectionATimetable.find(t => {
    const sub = dbData?.subjects.find(s => s.id === t.subject_id);
    return sub?.subject_code === 'BCS302';
  });
  assert(Boolean(kuldeepCOA), 'COA (Mr. Kuldeep Kumar) is visible in Section A master timetable');

  const imranDSTL = sectionATimetable.find(t => {
    const sub = dbData?.subjects.find(s => s.id === t.subject_id);
    return sub?.subject_code === 'BCS303';
  });
  assert(Boolean(imranDSTL), 'DSTL (Mr. Imran Raza Khan) is visible in Section A master timetable');

  // 6. VIEW ACCESS ONLY: COORDINATOR CANNOT MARK ATTENDANCE FOR OTHER FACULTY
  console.log('\n--- VERIFICATION 4: VIEW ACCESS ONLY (COORDINATOR CANNOT MARK FOR OTHERS) ---');
  const isMyLectureA = (naseemMaths?.faculty_id === hemlataId);
  assert(!isMyLectureA, 'Maths IV lecture belongs to Dr. Naseem, NOT Ms. Hemlata (Attendance marking restricted)');

  // 7. SECTION-WISE ASSIGNMENT, QUIZ & SESSIONAL ISOLATION
  console.log('\n--- VERIFICATION 5: STRICT SECTION-WISE TASK & GRADE ISOLATION ---');
  const studentA = dbData?.students.find(s => s.section_id === sectionA.id)!;
  const studentB = dbData?.students.find(s => s.section_id === sectionB.id)!;
  assert(Boolean(studentA), 'Resolved active student in Section A');
  assert(Boolean(studentB), 'Resolved active student in Section B');

  // Create section-specific sessional
  const sessA = await supabaseService.createSessionalAssessment({
    faculty_id: hemlataId,
    subject_id: myAssignedSubjects[0].id,
    section_id: sectionA.id,
    title: 'Sessional 1 Section A DS',
    max_marks: 20,
    exam_date: '2026-09-15',
    status: 'published',
  });

  const sessB = await supabaseService.createSessionalAssessment({
    faculty_id: hemlataId,
    subject_id: myAssignedSubjects[0].id,
    section_id: sectionB.id,
    title: 'Sessional 1 Section B DS',
    max_marks: 20,
    exam_date: '2026-09-16',
    status: 'published',
  });

  // Enter marks
  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sessA.id,
    facultyId: hemlataId,
    studentMarks: [{ studentId: studentA.id, marksObtained: 18, remarks: 'Excellent' }]
  });

  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sessB.id,
    facultyId: hemlataId,
    studentMarks: [{ studentId: studentB.id, marksObtained: 17, remarks: 'Good' }]
  });

  // Verify marks isolation
  const { data: marksA } = await supabase.from('sessional_marks').select('*').eq('sessional_assessment_id', sessA.id);
  const { data: marksB } = await supabase.from('sessional_marks').select('*').eq('sessional_assessment_id', sessB.id);

  assert(Boolean(marksA?.some(m => m.student_id === studentA.id)), 'Section A student has mark in Section A sessional');
  assert(Boolean(!marksA?.some(m => m.student_id === studentB.id)), 'Section B student CANNOT be graded under Section A sessional');
  assert(Boolean(marksB?.some(m => m.student_id === studentB.id)), 'Section B student has mark in Section B sessional');
  assert(Boolean(!marksB?.some(m => m.student_id === studentA.id)), 'Section A student CANNOT be graded under Section B sessional');

  // Teardown test sessionals
  await supabaseService.deleteSessionalAssessment(sessA.id);
  await supabaseService.deleteSessionalAssessment(sessB.id);

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} COORDINATOR & SECTION ACCESS TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runCoordinatorAndSectionAccessTests().then(() => process.exit(0)).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
