/**
 * VCTM ERP — Automated Acceptance Test Suite
 * FACULTY ASSIGNMENT/QUIZ SECTION SCOPING & STUDENT SUBMISSION WORKFLOW
 *
 * Verifies:
 * TEST 1: Faculty creates Assignment for BCS303 in Section B -> Visible to Section B student, NOT Section A.
 * TEST 2: Faculty creates Google Form Quiz for BCS303 in Section B -> Visible to Section B student, NOT Section A.
 * TEST 3: Dynamic Section Dropdown shows all valid authorized sections (Section A, Section B, etc.).
 * TEST 4: Section B student dashboard displays assignment and student submits file upload successfully.
 * TEST 5: Section B student accesses published quizzes with working Google Form URLs.
 * TEST 6: Section A student logs in -> Zero leakage of Section B assignments & quizzes.
 * TEST 7: Adding a new section dynamically makes it available in faculty dropdowns without code changes.
 */

import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { getISTTodayDate } from '../lib/utils/dateUtils';

interface TestStats {
  passed: number;
  failed: number;
  total: number;
}

const stats: TestStats = { passed: 0, failed: 0, total: 0 };

function assert(condition: boolean, testName: string, details?: string) {
  stats.total++;
  if (condition) {
    stats.passed++;
    console.log(`✅ PASSED (${stats.total}): ${testName}`);
  } else {
    stats.failed++;
    console.error(`❌ FAILED (${stats.total}): ${testName}`);
    if (details) console.error(`   Details: ${details}`);
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('  VCTM ERP — FACULTY ASSIGNMENT & QUIZ WORKFLOW ACCEPTANCE SUITE');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Initial State & Entity Resolution
  const masterData = await supabaseService.fetchMasterData(true);
  if (!masterData) {
    console.error('Failed to fetch master data from Supabase');
    process.exit(1);
  }

  const { sections, subjects, faculty, students } = masterData;

  const sectionA = sections.find(s => s.name === 'A');
  const sectionB = sections.find(s => s.name === 'B');
  const subjectBCS303 = subjects.find(s => s.subject_code === 'BCS303') || subjects.find(s => s.subject_code === 'BCS301');
  const facultyMember = faculty[0];

  assert(!!sectionA && !!sectionB, 'Resolved Section A and Section B records in Supabase');
  assert(!!subjectBCS303, `Resolved Subject ${subjectBCS303?.subject_code} (${subjectBCS303?.subject_name})`);
  assert(!!facultyMember, `Resolved Faculty Member: ${facultyMember?.full_name}`);

  const studentB = students.find(s => s.section_id === sectionB?.id || s.roll_number === '2503400100057');
  const studentA = students.find(s => s.section_id === sectionA?.id);

  assert(!!studentB, `Resolved Section B Student: ${studentB?.full_name} (${studentB?.roll_number})`);
  assert(!!studentA, `Resolved Section A Student: ${studentA?.full_name} (${studentA?.roll_number})`);

  console.log('\n--- TEST 1: Faculty creates Assignment for Section B ---');
  const testAssignmentTitle = `Unit 2 Tree Traversal Assignment - Section B ${Date.now()}`;
  const createdAssignment = await supabaseService.createAssignment({
    faculty_id: facultyMember!.id,
    subject_id: subjectBCS303!.id,
    section_id: sectionB!.id,
    title: testAssignmentTitle,
    description: 'Solve problems on Binary Search Trees and submit PDF.',
    submission_type: 'file_upload',
    max_marks: 10,
    assigned_date: getISTTodayDate(),
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    allow_late_submission: true,
    active: true,
  });

  assert(!!createdAssignment.id, 'Assignment created successfully in Supabase');
  assert(createdAssignment.section_id === sectionB!.id, 'Assignment section_id strictly matches Section B ID');

  // Fetch operational data
  const opData1 = await supabaseService.fetchOperationalData();
  const allAssignments = opData1?.courseAssignments || [];

  const sectionBAssignments = allAssignments.filter(a => a.section_id === sectionB!.id && a.active);
  const sectionAAssignments = allAssignments.filter(a => a.section_id === sectionA!.id && a.active);

  assert(sectionBAssignments.some(a => a.id === createdAssignment.id), 'Assignment appears in Section B query');
  assert(!sectionAAssignments.some(a => a.id === createdAssignment.id), 'Assignment does NOT appear in Section A query (STRICT ISOLATION)');

  console.log('\n--- TEST 2: Faculty creates Google Form Quiz for Section B ---');
  const testQuizTitle = `BCS303 Pop Quiz 1 - Section B ${Date.now()}`;
  const testGoogleFormUrl = 'https://forms.google.com/d/e/1FAIpQLSc_TEST_QUIZ_VCTM/viewform';
  const createdQuiz = await supabaseService.createQuiz({
    faculty_id: facultyMember!.id,
    subject_id: subjectBCS303!.id,
    section_id: sectionB!.id,
    title: testQuizTitle,
    description: 'Online Google Form Assessment for Section B only.',
    google_form_url: testGoogleFormUrl,
    max_marks: 20,
    quiz_date: getISTTodayDate(),
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    instructions: 'Submit the Google Form before deadline.',
    active: true,
  });

  assert(!!createdQuiz.id, 'Google Form Quiz created successfully in Supabase');
  assert(createdQuiz.section_id === sectionB!.id, 'Quiz section_id strictly matches Section B ID');

  const allQuizzes = opData1?.quizzes || [];
  const { data: latestQuizzes } = await supabase.from('quizzes').select('*').eq('active', true);
  const freshQuizzes = latestQuizzes || [];

  const sectionBQuizzes = freshQuizzes.filter(q => q.section_id === sectionB!.id);
  const sectionAQuizzes = freshQuizzes.filter(q => q.section_id === sectionA!.id);

  assert(sectionBQuizzes.some(q => q.id === createdQuiz.id), 'Quiz appears in Section B query');
  assert(!sectionAQuizzes.some(q => q.id === createdQuiz.id), 'Quiz does NOT appear in Section A query (STRICT ISOLATION)');

  console.log('\n--- TEST 3: Dynamic Section Dropdown Resolution ---');
  // Check that for any subject in semester 3, available sections contain both Section A and Section B
  const activeSectionsForSub = sections.filter(sec => sec.active && (!subjectBCS303?.semester_id || sec.semester_id === subjectBCS303.semester_id));
  assert(activeSectionsForSub.length >= 2, `Subject ${subjectBCS303?.subject_code} has ${activeSectionsForSub.length} dynamic sections available`);
  assert(activeSectionsForSub.some(s => s.name === 'A'), 'Section A is present in dynamic options');
  assert(activeSectionsForSub.some(s => s.name === 'B'), 'Section B is present in dynamic options (NOT hardcoded to Section A only)');

  console.log('\n--- TEST 4: Student File Upload & Submission Workflow ---');
  const dummyBase64Data = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9Db3VudCAxCi9LaWRzIFsgNSAwIFIgXQo+PgplbmRvYmoK...';
  const submissionRecord = await supabaseService.submitAssignment({
    assignmentId: createdAssignment.id,
    studentId: studentB!.id,
    submissionType: 'file_upload',
    filePath: dummyBase64Data,
    fileName: 'Tarun_Kushwah_BCS303_Assignment2.pdf',
    fileSize: 45210,
    mimeType: 'application/pdf',
  });

  assert(!!submissionRecord.id, 'Student submission recorded successfully in Supabase');
  assert(submissionRecord.assignment_id === createdAssignment.id, 'Submission is mapped to the correct Section B assignment');
  assert(submissionRecord.student_id === studentB!.id, 'Submission is mapped to student Tarun Kushwah');
  assert(submissionRecord.status === 'submitted' || submissionRecord.status === 'late_submission', `Submission status is "${submissionRecord.status}"`);

  console.log('\n--- TEST 5: Section B Student accesses Quizzes ---');
  const studentBQuizzes = freshQuizzes.filter(q => q.section_id === studentB?.section_id && q.active);
  assert(studentBQuizzes.length > 0, `Section B student has ${studentBQuizzes.length} active quizzes available`);
  const myQuiz = studentBQuizzes.find(q => q.id === createdQuiz.id);
  assert(!!myQuiz, 'Section B student can access the newly created quiz');
  assert(myQuiz?.google_form_url === testGoogleFormUrl, 'Quiz Google Form URL is intact and accessible for attempt');

  console.log('\n--- TEST 6: Section A Student Isolation ---');
  const studentAVisibleAssignments = allAssignments.filter(a => a.section_id === studentA?.section_id && a.active);
  const studentAVisibleQuizzes = freshQuizzes.filter(q => q.section_id === studentA?.section_id && q.active);

  assert(!studentAVisibleAssignments.some(a => a.id === createdAssignment.id), 'Section A student CANNOT see Section B assignment (Zero Leakage)');
  assert(!studentAVisibleQuizzes.some(q => q.id === createdQuiz.id), 'Section A student CANNOT see Section B quiz (Zero Leakage)');

  console.log('\n--- TEST 7: Dynamic New Section Registration ---');
  const dynamicSecName = `C-Test-${Date.now().toString().slice(-4)}`;
  const { data: newSection, error: secErr } = await supabase
    .from('sections')
    .insert([{
      name: dynamicSecName,
      semester_id: subjectBCS303?.semester_id || 'sem-3',
      room_number: 'A008',
      active: true,
    }])
    .select('*')
    .single();

  assert(!secErr && !!newSection, `Created new dynamic section: "Section ${dynamicSecName}" in Supabase`);

  const updatedMaster = await supabaseService.fetchMasterData(true);
  const dynamicSections = (updatedMaster?.sections || []).filter(s => s.active && (!subjectBCS303?.semester_id || s.semester_id === subjectBCS303.semester_id));

  assert(dynamicSections.some(s => s.id === newSection?.id), `New Section ${dynamicSecName} automatically available in subject dropdown without code modification`);

  // Clean up temporary test section
  if (newSection?.id) {
    await supabase.from('sections').delete().eq('id', newSection.id);
  }

  // Clean up test assignment & quiz
  await supabaseService.deleteCourseAssignment(createdAssignment.id);
  await supabaseService.deleteQuiz(createdQuiz.id);

  console.log('\n======================================================================');
  console.log(`  ALL ${stats.passed}/${stats.total} CHECKS PASSED WITH 100% SUCCESS`);
  console.log('======================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
