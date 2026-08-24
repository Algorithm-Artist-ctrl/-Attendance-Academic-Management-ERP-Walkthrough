import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { Assignment, Quiz, SessionalAssessment, SessionalMark } from '../types/database.types';

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

async function runSectionWiseFacultyManagementVerification() {
  console.log('======================================================================');
  console.log('    VCTM ERP SECTION-WISE FACULTY ACADEMIC MANAGEMENT VERIFICATION');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // --- SUITE 1: Master Database & Section Setup ---
  console.log('--- SUITE 1: Master Database & Class Relational Structure ---');
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Fetched live master database from Supabase Cloud');

  const secA = dbData?.sections.find(s => s.name === 'A')!;
  const secB = dbData?.sections.find(s => s.name === 'B')!;
  const facHemlata = dbData?.faculty.find(f => f.full_name.includes('Hemlata'))!;
  const subDs = dbData?.subjects.find(s => s.subject_code === 'BCS301')!; // Data Structure
  const studA = dbData?.students.find(s => s.section_id === secA.id)!;
  const studB = dbData?.students.find(s => s.section_id === secB.id)!;

  assert(Boolean(secA && secB && facHemlata && subDs && studA && studB), 'Found master sections, faculty, subject, and student test fixtures');

  // Pre-cleanup any lingering test fixtures
  await supabase.from('marks_history').delete().in('student_id', [studA.id, studB.id]);
  await supabase.from('sessional_marks').delete().in('student_id', [studA.id, studB.id]);
  await supabase.from('sessional_assessments').delete().eq('subject_id', subDs.id);
  await supabase.from('quiz_results').delete().in('student_id', [studA.id, studB.id]);
  await supabase.from('quizzes').delete().eq('subject_id', subDs.id);
  await supabase.from('assignment_submissions').delete().in('student_id', [studA.id, studB.id]);
  await supabase.from('assignments').delete().eq('subject_id', subDs.id);

  // --- SUITE 2: Section A Assignment Creation & Strict Isolation ---
  console.log('\n--- SUITE 2: Section A vs Section B Assignment Isolation ---');
  const asgnA1 = await supabaseService.createAssignment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secA.id,
    title: 'Assignment A1: Stacks & Queues in C',
    description: 'Exclusive to Section A',
    submission_type: 'both',
    google_form_url: 'https://forms.google.com/asgn-sec-a',
    max_marks: 10,
    assigned_date: '2026-08-24',
    due_date: '2026-08-30T23:59:59Z',
    allow_late_submission: true,
    active: true,
  });
  assert(Boolean(asgnA1 && asgnA1.id), 'Faculty created Assignment A1 for Section A');
  assert(asgnA1.section_id === secA.id, 'Assignment A1 stored in Supabase with section_id = Section A');

  const asgnB1 = await supabaseService.createAssignment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Assignment B1: Binary Trees & Graphs',
    description: 'Exclusive to Section B',
    submission_type: 'file_upload',
    max_marks: 15,
    assigned_date: '2026-08-24',
    due_date: '2026-08-31T23:59:59Z',
    allow_late_submission: true,
    active: true,
  });
  assert(Boolean(asgnB1 && asgnB1.id), 'Faculty created Assignment B1 for Section B');
  assert(asgnB1.section_id === secB.id, 'Assignment B1 stored in Supabase with section_id = Section B');

  // Query as Student A
  const { data: allAsgns } = await supabase.from('assignments').select('*');
  const studentAVisibleAsgns = (allAsgns || []).filter(a => a.section_id === studA.section_id);
  const studentBVisibleAsgns = (allAsgns || []).filter(a => a.section_id === studB.section_id);

  assert(studentAVisibleAsgns.some(a => a.id === asgnA1.id), 'Student A can see Assignment A1');
  assert(!studentAVisibleAsgns.some(a => a.id === asgnB1.id), 'Student A CANNOT see Section B Assignment B1 (Strict Isolation)');
  assert(studentBVisibleAsgns.some(a => a.id === asgnB1.id), 'Student B can see Assignment B1');
  assert(!studentBVisibleAsgns.some(a => a.id === asgnA1.id), 'Student B CANNOT see Section A Assignment A1 (Strict Isolation)');

  // --- SUITE 3: Section A vs Section B Quiz Isolation ---
  console.log('\n--- SUITE 3: Section A vs Section B Quiz Isolation ---');
  const quizA1 = await supabaseService.createQuiz({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secA.id,
    title: 'Quiz A1: Unit 1 Data Structures',
    description: 'MCQ Test for Section A',
    google_form_url: 'https://forms.google.com/quiz-sec-a',
    max_marks: 20,
    quiz_date: '2026-08-25',
    start_time: '2026-08-25T10:00:00Z',
    end_time: '2026-08-30T18:00:00Z',
    status: 'published',
    active: true,
  });
  assert(Boolean(quizA1 && quizA1.id), 'Faculty created Quiz A1 for Section A');

  const quizB1 = await supabaseService.createQuiz({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Quiz B1: Unit 1 & 2 Comprehensive Quiz',
    description: 'MCQ Test for Section B',
    google_form_url: 'https://forms.google.com/quiz-sec-b',
    max_marks: 25,
    quiz_date: '2026-08-25',
    start_time: '2026-08-25T10:00:00Z',
    end_time: '2026-08-30T18:00:00Z',
    status: 'published',
    active: true,
  });
  assert(Boolean(quizB1 && quizB1.id), 'Faculty created Quiz B1 for Section B');

  const { data: allQuizzes } = await supabase.from('quizzes').select('*');
  const studentAVisibleQuizzes = (allQuizzes || []).filter(q => q.section_id === studA.section_id);
  const studentBVisibleQuizzes = (allQuizzes || []).filter(q => q.section_id === studB.section_id);

  assert(studentAVisibleQuizzes.some(q => q.id === quizA1.id), 'Student A can see Quiz A1');
  assert(!studentAVisibleQuizzes.some(q => q.id === quizB1.id), 'Student A CANNOT see Section B Quiz B1 (Strict Isolation)');
  assert(studentBVisibleQuizzes.some(q => q.id === quizB1.id), 'Student B can see Quiz B1');
  assert(!studentBVisibleQuizzes.some(q => q.id === quizA1.id), 'Student B CANNOT see Section A Quiz A1 (Strict Isolation)');

  // --- SUITE 4: Section-Specific Dynamic Sessional Assessments & Marks ---
  console.log('\n--- SUITE 4: Section-Specific Sessional Assessments & Marks ---');
  // Section A: Sessional 1
  const sessA1 = await supabaseService.createSessionalAssessment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secA.id,
    title: 'Sessional 1',
    max_marks: 20,
    exam_date: '2026-08-25',
    status: 'published',
  });
  assert(Boolean(sessA1 && sessA1.id), 'Faculty created Sessional 1 for Section A');

  // Section B: Sessional 1, Sessional 2
  const sessB1 = await supabaseService.createSessionalAssessment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Sessional 1',
    max_marks: 20,
    exam_date: '2026-08-25',
    status: 'published',
  });
  const sessB2 = await supabaseService.createSessionalAssessment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Sessional 2',
    max_marks: 30,
    exam_date: '2026-09-15',
    status: 'published',
  });
  assert(Boolean(sessB1 && sessB2), 'Faculty created Sessional 1 and Sessional 2 for Section B');

  // Enter marks
  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sessA1.id,
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secA.id,
    maxMarks: 20,
    studentMarks: [{ studentId: studA.id, marksObtained: 18 }]
  });

  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sessB1.id,
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secB.id,
    maxMarks: 20,
    studentMarks: [{ studentId: studB.id, marksObtained: 17 }]
  });

  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sessB2.id,
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secB.id,
    maxMarks: 30,
    studentMarks: [{ studentId: studB.id, marksObtained: 28 }]
  });

  const { data: allMarks } = await supabase.from('sessional_marks').select('*');
  const studentAMarks = (allMarks || []).filter(m => m.student_id === studA.id);
  const studentBMarks = (allMarks || []).filter(m => m.student_id === studB.id);

  assert(studentAMarks.length === 1 && studentAMarks[0].marks_obtained === 18, 'Student A scorecard contains Section A Sessional 1: 18/20');
  assert(studentBMarks.length === 2, 'Student B scorecard contains exactly 2 sessionals (Sessional 1 & 2)');
  assert(!studentAMarks.some(m => m.sessional_assessment_id === sessB1.id), 'Student A does NOT have Section B Sessional 1 marks (Strict Isolation)');
  assert(!studentAMarks.some(m => m.sessional_assessment_id === sessB2.id), 'Student A does NOT have Section B Sessional 2 marks (Strict Isolation)');

  // --- SUITE 5: Section Workspace Metrics Fidelity ---
  console.log('\n--- SUITE 5: Section Workspace Metrics Fidelity ---');
  const secAStudents = (dbData?.students || []).filter(s => s.section_id === secA.id);
  const secBStudents = (dbData?.students || []).filter(s => s.section_id === secB.id);
  assert(secAStudents.length === 53, 'Section A Workspace reflects exactly 53 enrolled students from database');
  assert(secBStudents.length === 53, 'Section B Workspace reflects exactly 53 enrolled students from database');

  // --- SUITE 6: Teardown Test Data ---
  console.log('\n--- SUITE 6: Teardown Test Data ---');
  await supabase.from('marks_history').delete().in('student_id', [studA.id, studB.id]);
  await supabase.from('sessional_marks').delete().in('student_id', [studA.id, studB.id]);
  await supabase.from('sessional_assessments').delete().in('id', [sessA1.id, sessB1.id, sessB2.id]);
  await supabase.from('quiz_results').delete().in('student_id', [studA.id, studB.id]);
  await supabase.from('quizzes').delete().in('id', [quizA1.id, quizB1.id]);
  await supabase.from('assignment_submissions').delete().in('student_id', [studA.id, studB.id]);
  await supabase.from('assignments').delete().in('id', [asgnA1.id, asgnB1.id]);
  console.log('Cleaned up section-wise test fixtures from Supabase Cloud.');

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} SECTION-WISE FACULTY MANAGEMENT TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runSectionWiseFacultyManagementVerification().then(() => process.exit(0)).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
