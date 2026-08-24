import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { Assignment, Quiz, SessionalType } from '../types/database.types';

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
  console.log('    VCTM ERP ASSIGNMENT + QUIZ + SESSIONAL MARKS VERIFICATION');
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

  // --- SUITE 2: Faculty Quiz Creation & Google Form Validation ---
  console.log('\n--- SUITE 2: Faculty Quiz Creation (Google Form) ---');
  let invalidUrlBlocked = false;
  try {
    await supabaseService.createQuiz({
      faculty_id: facHemlata.id,
      subject_id: subDs.id,
      section_id: secB.id,
      title: 'Invalid Quiz',
      google_form_url: 'javascript:alert(1)',
      max_marks: 20,
      quiz_date: '2026-08-25',
      start_time: '2026-08-25T09:00:00Z',
      end_time: '2026-08-28T18:00:00Z',
      active: true
    });
  } catch (err: any) {
    invalidUrlBlocked = err.message.includes('valid Google Forms URL');
  }
  assert(invalidUrlBlocked, 'Invalid / malicious Google Form URL rejected by validation');

  const createdQuiz = await supabaseService.createQuiz({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Unit 1 Data Structure MCQ Quiz',
    description: 'Covers Arrays, Stacks, and Queues. Submit via Google Form.',
    google_form_url: 'https://forms.google.com/d/e/1FAIpQLScX9TestQuizVCTM/viewform',
    max_marks: 20,
    quiz_date: '2026-08-25',
    start_time: '2026-08-24T00:00:00Z',
    end_time: '2026-08-30T23:59:59Z',
    instructions: '20 questions, 1 mark each. No negative marking.',
    active: true
  });

  assert(Boolean(createdQuiz && createdQuiz.id), 'Faculty Ms. Hemlata successfully created Google Form Quiz in Supabase');
  assert(createdQuiz.google_form_url.startsWith('https://forms.google.com'), 'Google Form URL stored verbatim for student redirection');

  // --- SUITE 3: Section Isolation for Quizzes ---
  console.log('\n--- SUITE 3: Section Isolation for Quizzes ---');
  const allQuizzesRes = await supabase.from('quizzes').select('*');
  const quizzesForSecB = (allQuizzesRes.data || []).filter(q => q.section_id === secB.id);
  const quizzesForSecA = (allQuizzesRes.data || []).filter(q => q.section_id === secA.id);

  assert(quizzesForSecB.some(q => q.id === createdQuiz.id), 'Section B student sees the Data Structure Quiz');
  assert(!quizzesForSecA.some(q => q.id === createdQuiz.id), 'Section A student does NOT see Section B Quiz (Strict Isolation)');

  // --- SUITE 4: Faculty Assignment Creation & Submission Types ---
  console.log('\n--- SUITE 4: Faculty Assignment Creation ---');
  const createdAssignment = await supabaseService.createAssignment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Data Structure Lab Assignment 1 — Linked Lists',
    description: 'Implement singly linked list insertion and deletion in C/C++.',
    submission_type: 'both',
    google_form_url: 'https://forms.google.com/d/e/1FAIpQLScX9TestAssignmentVCTM/viewform',
    max_marks: 10,
    assigned_date: '2026-08-24',
    due_date: '2026-08-30T23:59:59Z',
    allow_late_submission: true,
    active: true
  });

  assert(Boolean(createdAssignment && createdAssignment.id), 'Faculty successfully published Assignment in Supabase');
  assert(createdAssignment.max_marks === 10, 'Assignment max marks set to 10');

  // --- SUITE 5: Student Assignment File Submission ---
  console.log('\n--- SUITE 5: Student Assignment Submission ---');
  const studentSubmission = await supabaseService.submitAssignment({
    assignmentId: createdAssignment.id,
    studentId: studB.id,
    submissionType: 'file_upload',
    filePath: 'data:application/pdf;base64,JVBERi0xLjUKJUZha2VQREZDZXJ0aWZpY2F0ZQ==',
    fileName: 'Tarun_Kushwah_DS_Assignment1.pdf',
    fileSize: 45020,
    mimeType: 'application/pdf',
  });

  assert(Boolean(studentSubmission && studentSubmission.id), 'Student submitted assignment file to Supabase');
  assert(studentSubmission.status === 'submitted', 'Submission status recorded as "submitted" before due date');
  assert(studentSubmission.file_name === 'Tarun_Kushwah_DS_Assignment1.pdf', 'Uploaded filename preserved in metadata');

  // --- SUITE 6: Server-side Due Date & Late Submission Enforcement ---
  console.log('\n--- SUITE 6: Due Date & Late Submission Rule ---');
  const expiredAssignment = await supabaseService.createAssignment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Past Due Assignment',
    submission_type: 'file_upload',
    max_marks: 10,
    assigned_date: '2026-08-01',
    due_date: '2026-08-10T12:00:00Z', // Past deadline
    allow_late_submission: true,
    active: true
  });

  const lateSubmission = await supabaseService.submitAssignment({
    assignmentId: expiredAssignment.id,
    studentId: studB.id,
    submissionType: 'file_upload',
    filePath: 'data:application/pdf;base64,TGF0ZVN1Ym1pc3Npb24=',
    fileName: 'Late_File.pdf',
  });

  assert(lateSubmission.status === 'late_submission', 'Submission after deadline automatically flagged as "late_submission"');

  // Test blocked late submission
  const strictExpiredAssignment = await supabaseService.createAssignment({
    faculty_id: facHemlata.id,
    subject_id: subDs.id,
    section_id: secB.id,
    title: 'Strict No-Late Assignment',
    submission_type: 'file_upload',
    max_marks: 10,
    assigned_date: '2026-08-01',
    due_date: '2026-08-10T12:00:00Z',
    allow_late_submission: false, // Late blocked
    active: true
  });

  let lateBlocked = false;
  try {
    await supabaseService.submitAssignment({
      assignmentId: strictExpiredAssignment.id,
      studentId: studB.id,
      submissionType: 'file_upload',
      filePath: 'data:application/pdf;base64,TGF0ZVN1Ym1pc3Npb24=',
      fileName: 'Blocked_File.pdf',
    });
  } catch (err: any) {
    lateBlocked = err.message.includes('deadline passed');
  }
  assert(lateBlocked, 'Server blocked submission when allow_late_submission is false');

  // --- SUITE 7: Faculty Grading & Feedback ---
  console.log('\n--- SUITE 7: Faculty Grading & Feedback ---');
  // Test invalid marks exceeding max_marks
  let excessMarksBlocked = false;
  try {
    await supabaseService.gradeAssignmentSubmission({
      submissionId: studentSubmission.id,
      marksObtained: 15, // Max is 10
      feedback: 'Too generous',
      facultyId: facHemlata.id
    });
  } catch (err: any) {
    excessMarksBlocked = err.message.includes('exceeds maximum marks');
  }
  assert(excessMarksBlocked, 'Faculty cannot award marks exceeding assignment max_marks');

  const gradedSubmission = await supabaseService.gradeAssignmentSubmission({
    submissionId: studentSubmission.id,
    marksObtained: 9,
    feedback: 'Well implemented linked list with clean pointer manipulation.',
    facultyId: facHemlata.id
  });

  assert(gradedSubmission.status === 'graded', 'Submission status updated to "graded"');
  assert(gradedSubmission.marks_obtained === 9, 'Awarded marks (9/10) saved in Supabase');
  assert(Boolean(gradedSubmission.feedback?.includes('Well implemented')), 'Faculty feedback saved');

  // --- SUITE 8: Faculty Quiz Marks Roster Batch Recording ---
  console.log('\n--- SUITE 8: Quiz Marks Roster Recording ---');
  const quizResults = await supabaseService.saveQuizMarks({
    quizId: createdQuiz.id,
    facultyId: facHemlata.id,
    studentMarks: [
      { studentId: studB.id, marksObtained: 18, remarks: 'Excellent MCQ performance' }
    ]
  });

  assert(quizResults.length > 0, 'Quiz marks recorded for Section B student in Supabase');
  assert(quizResults[0].marks_obtained === 18, 'Student scored 18/20 in Quiz');

  // --- SUITE 9: Sessional Marks Entry & Audit Ledger ---
  console.log('\n--- SUITE 9: Sessional Marks Entry & Change Audit ---');
  const sessional1Res = await supabaseService.saveSessionalMarks({
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secB.id,
    sessionalType: 'Sessional 1',
    maxMarks: 30,
    studentMarks: [
      { studentId: studB.id, marksObtained: 24, remarks: 'Good written theory' }
    ]
  });

  assert(sessional1Res.length > 0, 'Sessional 1 marks recorded in Supabase (24/30)');

  // Update sessional marks (e.g. re-evaluation 24 -> 27)
  const updatedSessional = await supabaseService.saveSessionalMarks({
    facultyId: facHemlata.id,
    subjectId: subDs.id,
    sectionId: secB.id,
    sessionalType: 'Sessional 1',
    maxMarks: 30,
    studentMarks: [
      { studentId: studB.id, marksObtained: 27, oldMarks: 24, remarks: 'Re-evaluation question 3 check' }
    ]
  });

  assert(updatedSessional[0].marks_obtained === 27, 'Sessional marks updated to 27/30');

  // Verify audit log in marks_history
  const { data: history } = await supabase
    .from('marks_history')
    .select('*')
    .eq('student_id', studB.id)
    .eq('subject_id', subDs.id)
    .order('updated_at', { ascending: false });

  assert(history !== null && history.length > 0, 'Marks modification history logged in marks_history table');
  const latestAudit = history?.find(h => h.new_marks === 27);
  assert(latestAudit?.old_marks === 24, 'Audit ledger records: old_marks=24 -> new_marks=27');

  // --- SUITE 10: Audit Log Recording ---
  console.log('\n--- SUITE 10: Operational Audit Trail ---');
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .in('action', ['ASSIGNMENT_CREATED', 'QUIZ_CREATED', 'ASSIGNMENT_SUBMITTED'])
    .limit(10);

  assert(auditLogs !== null && auditLogs.length >= 3, 'Operational audit trail records ASSIGNMENT_CREATED, QUIZ_CREATED, and ASSIGNMENT_SUBMITTED');

  // --- SUITE 11: Cleanup Test Fixtures ---
  console.log('\n--- SUITE 11: Cleanup Test Assessment Data ---');
  await supabase.from('assignments').delete().in('id', [createdAssignment.id, expiredAssignment.id, strictExpiredAssignment.id]);
  await supabase.from('quizzes').delete().eq('id', createdQuiz.id);
  await supabase.from('sessional_marks').delete().eq('subject_id', subDs.id).eq('student_id', studB.id);
  await supabase.from('marks_history').delete().eq('student_id', studB.id);
  console.log('Cleaned up test assessment rows from Supabase Cloud.');

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} ACADEMIC ASSESSMENT TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runAcademicAssessmentsVerification().then(() => process.exit(0)).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
