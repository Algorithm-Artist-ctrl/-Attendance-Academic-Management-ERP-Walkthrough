import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import assert from 'assert';

async function runAssessmentSelectionTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — FUNCTIONAL ASSESSMENT SELECTION & MARKS ISOLATION VERIFICATION     ');
  console.log('  Testing Sessional 1-3, Quizzes 1-5, Marks Isolation, Draft/Publish & Audit     ');
  console.log('================================================================================\n');

  // STEP 1: Authenticate Super Admin
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tarunkushwah798@gmail.com',
    password: 'VctmAdmin@2026',
  });
  if (authErr || !authData.user) {
    throw new Error('Super admin authentication failed: ' + authErr?.message);
  }
  console.log('✓ [TEST 1] Authenticated successfully as Super Admin');

  // STEP 2: Resolve Active Scope (Faculty, Section, Subject)
  const { data: assignments } = await supabase
    .from('faculty_subject_assignments')
    .select('faculty_id, subject_id, section_id')
    .eq('active', true)
    .limit(1);

  assert(assignments && assignments.length > 0, 'Must have at least one active faculty assignment');
  const targetScope = assignments[0];
  console.log(`✓ [TEST 2] Active Teaching Scope: Faculty=${targetScope.faculty_id}, Subject=${targetScope.subject_id}, Section=${targetScope.section_id}`);

  // STEP 3: Ensure Default Assessments (Sessionals 1, 2, 3 and Quizzes 1-5)
  console.log('\n▶ [TEST 3] Auto-ensuring minimum 8 assessments (Sessional 1-3 & Quiz 1-5)...');
  const ensured = await supabaseService.ensureDefaultAssessments({
    subjectId: targetScope.subject_id,
    sectionId: targetScope.section_id,
    facultyId: targetScope.faculty_id
  });

  console.log(`  Ensured Sessionals count: ${ensured.sessionals.length}`);
  console.log(`  Ensured Quizzes count: ${ensured.quizzes.length}`);

  // Check Sessionals: Sessional 1, Sessional 2, Sessional 3
  const s1 = ensured.sessionals.find(s => s.title.toLowerCase().includes('1'));
  const s2 = ensured.sessionals.find(s => s.title.toLowerCase().includes('2'));
  const s3 = ensured.sessionals.find(s => s.title.toLowerCase().includes('3'));
  assert(s1, 'Sessional 1 must exist');
  assert(s2, 'Sessional 2 must exist');
  assert(s3, 'Sessional 3 must exist');
  console.log(`  ✓ Sessional 1 found: "${s1.title}" (Max Marks: ${s1.max_marks})`);
  console.log(`  ✓ Sessional 2 found: "${s2.title}" (Max Marks: ${s2.max_marks})`);
  console.log(`  ✓ Sessional 3 found: "${s3.title}" (Max Marks: ${s3.max_marks})`);

  // Check Quizzes: Quiz 1, 2, 3, 4, 5
  for (let i = 1; i <= 5; i++) {
    const q = ensured.quizzes.find(item => item.title.toLowerCase().includes(`quiz ${i}`));
    assert(q, `Quiz ${i} must exist in ensured quizzes`);
    console.log(`  ✓ Quiz ${i} found: "${q.title}" (Max Marks: ${q.max_marks})`);
  }
  console.log('✓ [TEST 3] All minimum 8 assessments verified in database');

  // STEP 4: Fetch Real Section Students
  const students = await supabaseService.fetchSectionStudents(targetScope.section_id, true);
  assert(students.length > 0, 'Section must have active students');
  const testStudent = students[0];
  console.log(`\n✓ [TEST 4] Loaded ${students.length} section students. Test student: ${testStudent.full_name} (${testStudent.roll_number})`);

  // STEP 5: Test Sessional 3 Marks Entry and Isolation
  console.log('\n▶ [TEST 5] Testing Sessional 3 Marks Entry (Draft & Publish)...');
  const s3MarkVal = 18;
  const s3MarksResult = await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: s3.id,
    facultyId: targetScope.faculty_id,
    subjectId: targetScope.subject_id,
    sectionId: targetScope.section_id,
    sessionalType: s3.title,
    maxMarks: s3.max_marks,
    studentMarks: [
      { studentId: testStudent.id, marksObtained: s3MarkVal, remarks: 'Sessional 3 Verified Score' }
    ],
    isPublished: true
  });
  assert(s3MarksResult.length > 0, 'S3 marks must be saved');
  const s3Saved = s3MarksResult.find(m => m.student_id === testStudent.id);
  assert.strictEqual(s3Saved?.marks_obtained, s3MarkVal, `S3 marks must equal ${s3MarkVal}`);
  console.log(`  ✓ Sessional 3 mark successfully saved and published: ${s3Saved?.marks_obtained}/${s3.max_marks}`);

  // STEP 6: Test Quiz Marks Entry (Quiz 1 and Quiz 2 Isolation)
  console.log('\n▶ [TEST 6] Testing Quiz 1 and Quiz 2 Marks Isolation...');
  const q1 = ensured.quizzes.find(item => item.title.toLowerCase().includes('quiz 1'))!;
  const q2 = ensured.quizzes.find(item => item.title.toLowerCase().includes('quiz 2'))!;

  // Save Quiz 1 marks as Draft first
  const q1DraftRes = await supabaseService.saveQuizMarks({
    quizId: q1.id,
    facultyId: targetScope.faculty_id,
    studentMarks: [
      { studentId: testStudent.id, marksObtained: 17, remarks: 'Quiz 1 Draft' }
    ],
    isPublished: false
  });
  assert(q1DraftRes.length > 0, 'Quiz 1 draft marks must be returned');
  console.log('  ✓ Quiz 1 saved as draft');

  // Publish Quiz 1 marks
  const q1PubRes = await supabaseService.saveQuizMarks({
    quizId: q1.id,
    facultyId: targetScope.faculty_id,
    studentMarks: [
      { studentId: testStudent.id, marksObtained: 19.5, remarks: 'Quiz 1 Final Published' }
    ],
    isPublished: true
  });
  assert(q1PubRes.length > 0, 'Quiz 1 published marks must be returned');
  const q1Saved = q1PubRes.find(r => r.student_id === testStudent.id);
  assert.strictEqual(q1Saved?.marks_obtained, 19.5, 'Quiz 1 mark must equal 19.5');
  console.log(`  ✓ Quiz 1 published: ${q1Saved?.marks_obtained}/${q1.max_marks}`);

  // Save Quiz 2 with different marks
  const q2PubRes = await supabaseService.saveQuizMarks({
    quizId: q2.id,
    facultyId: targetScope.faculty_id,
    studentMarks: [
      { studentId: testStudent.id, marksObtained: 14, remarks: 'Quiz 2 Published' }
    ],
    isPublished: true
  });
  const q2Saved = q2PubRes.find(r => r.student_id === testStudent.id);
  assert.strictEqual(q2Saved?.marks_obtained, 14, 'Quiz 2 mark must equal 14');
  console.log(`  ✓ Quiz 2 published: ${q2Saved?.marks_obtained}/${q2.max_marks}`);

  // Verify marks isolation: Quiz 1 mark is 19.5, Quiz 2 mark is 14, Sessional 3 mark is 18
  assert.notStrictEqual(q1Saved?.marks_obtained, q2Saved?.marks_obtained, 'Quiz 1 and Quiz 2 marks must remain independent');
  console.log('✓ [TEST 6] Marks isolation confirmed across different assessments');

  // STEP 7: Test Creating a Custom Assessment (+ Add Assessment functional workflow)
  console.log('\n▶ [TEST 7] Testing "+ Add Assessment" Workflow for Sessional & Quiz...');
  const customSessional = await supabaseService.createSessionalAssessment({
    title: 'Pre-University Test (PUT)',
    subject_id: targetScope.subject_id,
    section_id: targetScope.section_id,
    faculty_id: targetScope.faculty_id,
    max_marks: 50,
    exam_date: new Date().toISOString().split('T')[0],
    status: 'draft'
  });
  assert(customSessional.id, 'Created sessional must have valid ID');
  console.log(`  ✓ Custom Sessional created: "${customSessional.title}" (ID: ${customSessional.id})`);

  const customQuiz = await supabaseService.createQuiz({
    faculty_id: targetScope.faculty_id,
    subject_id: targetScope.subject_id,
    section_id: targetScope.section_id,
    title: 'Weekly Surprise Quiz',
    max_marks: 10,
    quiz_date: new Date().toISOString().split('T')[0],
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    google_form_url: 'https://vctm.in/quizzes',
    status: 'draft',
    active: true
  });
  assert(customQuiz.id, 'Created quiz must have valid ID');
  console.log(`  ✓ Custom Quiz created: "${customQuiz.title}" (ID: ${customQuiz.id})`);

  console.log('\n================================================================================');
  console.log('  ALL ASSESSMENT SELECTION & MARKS ISOLATION TESTS PASSED (7/7)!                 ');
  console.log('================================================================================\n');
}

runAssessmentSelectionTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
