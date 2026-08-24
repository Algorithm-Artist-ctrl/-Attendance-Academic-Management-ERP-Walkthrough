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

async function runAcademicAssessmentsVerification() {
  console.log('======================================================================');
  console.log('    VCTM ERP DYNAMIC SESSIONALS, QUIZ & ASSIGNMENT VERIFICATION');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // --- SUITE 1: Supabase Cloud Connectivity & Tables ---
  console.log('--- SUITE 1: Supabase Cloud Database & Tables ---');
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Fetched live master database from Supabase Cloud');

  const secA = dbData?.sections.find(s => s.name === 'A')!;
  const secB = dbData?.sections.find(s => s.name === 'B')!;
  const facAlok = dbData?.faculty.find(f => f.full_name.includes('Alok'))!;
  const facHemlata = dbData?.faculty.find(f => f.full_name.includes('Hemlata'))!;
  const subDs = dbData?.subjects.find(s => s.subject_code === 'BCS301')!; // Data Structure
  const studA = dbData?.students.find(s => s.section_id === secA.id)!;
  const studB = dbData?.students.find(s => s.section_id === secB.id)!;

  assert(Boolean(secA && secB && facAlok && facHemlata && subDs && studA && studB), 'Found master sections, faculty, subject, and student test fixtures');

  // Pre-cleanup any lingering test fixtures
  await supabase.from('marks_history').delete().eq('student_id', studB.id);
  await supabase.from('sessional_marks').delete().eq('student_id', studB.id);
  await supabase.from('sessional_assessments').delete().eq('subject_id', subDs.id).eq('section_id', secB.id);
  await supabase.from('quiz_results').delete().eq('student_id', studB.id);
  await supabase.from('quizzes').delete().eq('subject_id', subDs.id).eq('section_id', secB.id);
  await supabase.from('assignment_submissions').delete().eq('student_id', studB.id);
  await supabase.from('assignments').delete().eq('subject_id', subDs.id).eq('section_id', secB.id);

  // --- SUITE 2: Dynamic Multi-Sessional Creation (Sessional 1, 2, 3, 4) ---
  console.log('\n--- SUITE 2: Dynamic Sessional Assessments Creation ---');
  const sess1 = await supabaseService.createSessionalAssessment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Sessional 1',
    max_marks: 20,
    exam_date: '2026-08-25',
    description: 'Unit 1 Arrays & Stacks',
    status: 'published',
  });
  assert(Boolean(sess1 && sess1.id), 'Faculty Ms. Hemlata created Sessional 1 (Max 20)');

  const sess2 = await supabaseService.createSessionalAssessment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Sessional 2',
    max_marks: 20,
    exam_date: '2026-09-15',
    description: 'Unit 2 Queues & Linked Lists',
    status: 'published',
  });
  assert(Boolean(sess2 && sess2.id), 'Faculty Ms. Hemlata created Sessional 2 (Max 20)');

  const sess3 = await supabaseService.createSessionalAssessment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Sessional 3',
    max_marks: 20,
    exam_date: '2026-10-10',
    description: 'Unit 3 Trees & Binary Search Trees',
    status: 'published',
  });
  assert(Boolean(sess3 && sess3.id), 'Faculty Ms. Hemlata created Sessional 3 (Max 20)');

  const sess4 = await supabaseService.createSessionalAssessment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Sessional 4',
    max_marks: 20,
    exam_date: '2026-11-05',
    description: 'Unit 4 Graphs & Sorting Algorithms',
    status: 'published',
  });
  assert(Boolean(sess4 && sess4.id), 'Faculty Ms. Hemlata created Sessional 4 (Max 20)');

  // Verify all 4 sessionals exist independently in Supabase
  const { data: allSessionals } = await supabase
    .from('sessional_assessments')
    .select('*')
    .eq('subject_id', subDs.id)
    .eq('section_id', secB.id);

  assert((allSessionals || []).length >= 4, 'All 4 dynamic sessionals appear independently in Supabase relational table');

  // --- SUITE 3: Sessional Marks Entry (18/20, 16/20, 19/20) ---
  console.log('\n--- SUITE 3: Sessional Marks Entry ---');
  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sess1.id,
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secB.id,
    sessionalType: 'Sessional 1',
    maxMarks: 20,
    studentMarks: [
      { studentId: studB.id, marksObtained: 18, remarks: 'Good grasp on arrays' }
    ]
  });

  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sess2.id,
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secB.id,
    sessionalType: 'Sessional 2',
    maxMarks: 20,
    studentMarks: [
      { studentId: studB.id, marksObtained: 16, remarks: 'Minor queue issue' }
    ]
  });

  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sess3.id,
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secB.id,
    sessionalType: 'Sessional 3',
    maxMarks: 20,
    studentMarks: [
      { studentId: studB.id, marksObtained: 19, remarks: 'Excellent BST implementation' }
    ]
  });

  const { data: bMarks } = await supabase
    .from('sessional_marks')
    .select('*')
    .eq('student_id', studB.id);

  const m1 = bMarks?.find(m => m.sessional_assessment_id === sess1.id);
  const m2 = bMarks?.find(m => m.sessional_assessment_id === sess2.id);
  const m3 = bMarks?.find(m => m.sessional_assessment_id === sess3.id);

  assert(m1?.marks_obtained === 18, 'Sessional 1 recorded as 18/20 in Supabase');
  assert(m2?.marks_obtained === 16, 'Sessional 2 recorded as 16/20 in Supabase');
  assert(m3?.marks_obtained === 19, 'Sessional 3 recorded as 19/20 in Supabase');

  // --- SUITE 4: Update / Edit Sessional Marks with Audit History ---
  console.log('\n--- SUITE 4: Update Sessional Marks & Audit Trail ---');
  // Edit Sessional 2 from 16 to 19 after re-evaluation
  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: sess2.id,
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secB.id,
    sessionalType: 'Sessional 2',
    maxMarks: 20,
    studentMarks: [
      { studentId: studB.id, marksObtained: 19, oldMarks: 16, remarks: 'Re-evaluation verified' }
    ]
  });

  const { data: updatedBMarks } = await supabase
    .from('sessional_marks')
    .select('*')
    .eq('student_id', studB.id)
    .eq('sessional_assessment_id', sess2.id);

  assert(updatedBMarks?.length === 1, 'Upsert prevented duplicate marks records (exactly 1 row exists)');
  assert(updatedBMarks?.[0].marks_obtained === 19, 'Sessional 2 successfully updated to 19/20 in Supabase');

  const { data: auditHist } = await supabase
    .from('marks_history')
    .select('*')
    .eq('student_id', studB.id)
    .eq('entity_id', sess2.id)
    .order('updated_at', { ascending: false });

  assert(Boolean(auditHist && auditHist.length > 0), 'Marks modification history logged in marks_history table');
  const auditRow = auditHist?.[0];
  assert(Number(auditRow?.old_marks) === 16 && Number(auditRow?.new_marks) === 19, 'Audit record preserves old_marks=16 -> new_marks=19');

  // --- SUITE 5: Faculty Quiz Creation & External Google Form Link ---
  console.log('\n--- SUITE 5: Faculty Quiz Creation ---');
  const createdQuiz = await supabaseService.createQuiz({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Unit 1 Data Structure MCQ Quiz',
    description: 'MCQ Assessment via Google Form',
    google_form_url: 'https://forms.google.com/d/e/1FAIpQLScX9TestQuizVCTM/viewform',
    max_marks: 10,
    quiz_date: '2026-08-25',
    start_time: '2026-08-24T00:00:00Z',
    end_time: '2026-08-30T23:59:59Z',
    instructions: '10 questions, 1 mark each.',
    active: true
  });

  assert(Boolean(createdQuiz && createdQuiz.id), 'Faculty created Google Form Quiz in Supabase');
  assert(createdQuiz.google_form_url.startsWith('https://forms.google.com'), 'Stored Google Form URL for student access');

  // Record Quiz Result (8/10)
  await supabaseService.saveQuizMarks({
    quizId: createdQuiz.id,
    facultyId: facHemlata.id,
    studentMarks: [
      { studentId: studB.id, marksObtained: 8, remarks: 'Good MCQ performance' }
    ]
  });

  const { data: qRes } = await supabase.from('quiz_results').select('*').eq('quiz_id', createdQuiz.id).eq('student_id', studB.id);
  assert(qRes?.[0]?.marks_obtained === 8, 'Quiz marks recorded as 8/10 in Supabase');

  // --- SUITE 6: Faculty Assignment Creation & Submission ---
  console.log('\n--- SUITE 6: Faculty Assignment & Submission ---');
  const createdAssignment = await supabaseService.createAssignment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Linked List Implementation Assignment',
    description: 'Submit PDF or Google Form',
    submission_type: 'both',
    google_form_url: 'https://forms.google.com/d/e/1FAIpQLScX9TestAssignmentVCTM/viewform',
    max_marks: 10,
    assigned_date: '2026-08-24',
    due_date: '2026-08-30T23:59:59Z',
    allow_late_submission: true,
    active: true
  });

  const studentSub = await supabaseService.submitAssignment({
    assignmentId: createdAssignment.id,
    studentId: studB.id,
    submissionType: 'file_upload',
    filePath: 'data:application/pdf;base64,VGVzdFBkZg==',
    fileName: 'Tarun_DS_Assignment.pdf',
    fileSize: 34500,
    mimeType: 'application/pdf',
  });

  assert(studentSub.status === 'submitted', 'Student assignment submitted with status "submitted"');

  // Faculty grades assignment (9/10)
  const gradedSub = await supabaseService.gradeAssignmentSubmission({
    submissionId: studentSub.id,
    marksObtained: 9,
    feedback: 'Well structured code with detailed complexity analysis.',
    facultyId: facHemlata.id,
  });

  assert(gradedSub.status === 'graded' && gradedSub.marks_obtained === 9, 'Faculty graded assignment with 9/10 and feedback');

  // --- SUITE 7: Student Private Scorecard Aggregation ---
  console.log('\n--- SUITE 7: Student Private Scorecard ---');
  const refreshedData = await supabaseService.fetchAllData();
  const subAssessments = (refreshedData?.sessionalAssessments || []).filter(sa => sa.subject_id === subDs.id && sa.section_id === secB.id);
  const studentBMarks = (refreshedData?.sessionalMarks || []).filter(sm => sm.student_id === studB.id);

  const dynamicReport = subAssessments.map(sa => {
    const sm = studentBMarks.find(m => m.sessional_assessment_id === sa.id);
    return {
      title: sa.title,
      maxMarks: sa.max_marks,
      obtainedMarks: sm ? sm.marks_obtained : undefined
    };
  });

  assert(dynamicReport.some(r => r.title === 'Sessional 1' && r.obtainedMarks === 18), 'Student scorecard reports Sessional 1: 18/20');
  assert(dynamicReport.some(r => r.title === 'Sessional 2' && r.obtainedMarks === 19), 'Student scorecard reports updated Sessional 2: 19/20');
  assert(dynamicReport.some(r => r.title === 'Sessional 3' && r.obtainedMarks === 19), 'Student scorecard reports Sessional 3: 19/20');
  assert(dynamicReport.some(r => r.title === 'Sessional 4' && r.obtainedMarks === undefined), 'Student scorecard reports Sessional 4: Pending (not yet conducted)');

  // --- SUITE 8: Section Isolation & Security Checks ---
  console.log('\n--- SUITE 8: Strict Section Isolation ---');
  // Student A in Section A should NOT see Section B's student marks
  const studentAMarks = (refreshedData?.sessionalMarks || []).filter(sm => sm.student_id === studA.id && sm.sessional_assessment_id === sess1.id);
  assert(studentAMarks.length === 0, 'Section A student does NOT have Section B sessional marks (Strict Isolation)');

  // Validation: Attempt invalid marks > max_marks
  let invalidMarksCaught = false;
  try {
    await supabaseService.saveSessionalMarks({
      sessionalAssessmentId: sess1.id,
      facultyId: facHemlata.id,
      subjectId: subDs.id,
      sectionId: secB.id,
      maxMarks: 20,
      studentMarks: [{ studentId: studB.id, marksObtained: 25 }] // Max is 20
    });
  } catch (err: any) {
    invalidMarksCaught = err.message.includes('exceeds valid range');
  }
  assert(invalidMarksCaught, 'System strictly rejected marks > max_marks (25 > 20)');

  // --- SUITE 9: Cleanup Test Data ---
  console.log('\n--- SUITE 9: Teardown Test Data ---');
  await supabase.from('marks_history').delete().eq('student_id', studB.id);
  await supabase.from('sessional_marks').delete().eq('student_id', studB.id);
  await supabase.from('sessional_assessments').delete().in('id', [sess1.id, sess2.id, sess3.id, sess4.id]);
  await supabase.from('quiz_results').delete().eq('student_id', studB.id);
  await supabase.from('quizzes').delete().eq('id', createdQuiz.id);
  await supabase.from('assignment_submissions').delete().eq('student_id', studB.id);
  await supabase.from('assignments').delete().eq('id', createdAssignment.id);
  console.log('Cleaned up test fixtures from Supabase Cloud.');

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} DYNAMIC ASSESSMENT TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runAcademicAssessmentsVerification().then(() => process.exit(0)).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
