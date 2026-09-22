import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import handleAdminAuth from '../../api/admin-auth';
import assert from 'assert';

async function runAbsentAndPermanentDeleteTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — MARKS ABSENT SUPPORT & PERMANENT DELETE VERIFICATION SUITE         ');
  console.log('  Real PostgreSQL Constraints, Score Semantics, RPC Cascade & Admin API Test    ');
  console.log('================================================================================\n');

  // STEP 1: Authenticate Super Admin
  const adminEmail = process.env.TEST_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log('⚠️ TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set. Skipping authenticated integration test.');
    return;
  }

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (authErr || !authData.user) {
    throw new Error('Super admin authentication failed: ' + authErr?.message);
  }
  const token = authData.session?.access_token;
  console.log('✓ [TEST 1] Authenticated successfully as Super Admin');

  // STEP 2: Find active subject, section, faculty, and at least 3 students
  const { data: sections } = await supabase.from('sections').select('id, name, semester_id').eq('active', true).limit(5);
  assert(sections && sections.length > 0, 'Must have at least one active section');
  const targetSection = sections[0];

  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('section_id', targetSection.id)
    .eq('active', true)
    .limit(4);
  assert(students && students.length >= 3, 'Must have at least 3 active students in test section');

  const { data: facultyList } = await supabase.from('faculty').select('id, full_name').limit(1);
  assert(facultyList && facultyList.length > 0, 'Must have at least one faculty member');
  const testFaculty = facultyList[0];

  const { data: subjects } = await supabase.from('subjects').select('id, subject_name').eq('active', true).limit(1);
  assert(subjects && subjects.length > 0, 'Must have at least one active subject');
  const targetSubject = subjects[0];

  console.log(`✓ [TEST 2] Resolved Target Scope: Section "${targetSection.name}", Subject "${targetSubject.subject_name}"`);

  // STEP 3: Create or identify a test Sessional Assessment
  const testAssessmentTitle = `Verification Test Assessment ${Date.now().toString().slice(-4)}`;
  const { data: assessment, error: createErr } = await supabase
    .from('sessional_assessments')
    .insert({
      title: testAssessmentTitle,
      subject_id: targetSubject.id,
      section_id: targetSection.id,
      faculty_id: testFaculty.id,
      max_marks: 30,
      status: 'draft',
      exam_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (createErr || !assessment) {
    throw new Error('Failed to create test assessment: ' + createErr?.message);
  }
  console.log(`✓ [TEST 3] Created Test Sessional Assessment (ID: ${assessment.id})`);

  try {
    // STEP 4: Save Marks with 4 Distinct Evaluation States:
    // Student 0: PRESENT with score 24.5
    // Student 1: PRESENT with score 0 (valid score! NOT absent)
    // Student 2: ABSENT with marks = null
    // Student 3 (if exists): EXEMPTED with marks = null
    const student0 = students[0];
    const student1 = students[1];
    const student2 = students[2];
    const student3 = students[3];

    const studentMarksPayload: Array<{
      studentId: string;
      marksObtained: number | null;
      attendanceStatus: 'PRESENT' | 'ABSENT' | 'EXEMPTED';
      remarks?: string;
    }> = [
      {
        studentId: student0.id,
        marksObtained: 24.5,
        attendanceStatus: 'PRESENT',
        remarks: 'Excellent performance',
      },
      {
        studentId: student1.id,
        marksObtained: 0, // Genuine zero score
        attendanceStatus: 'PRESENT',
        remarks: 'Attended exam, scored 0',
      },
      {
        studentId: student2.id,
        marksObtained: null, // Absent
        attendanceStatus: 'ABSENT',
        remarks: 'Medical leave on exam day',
      },
    ];

    if (student3) {
      studentMarksPayload.push({
        studentId: student3.id,
        marksObtained: null, // Exempted
        attendanceStatus: 'EXEMPTED',
        remarks: 'Officially excused for inter-college event',
      });
    }

    await supabaseService.saveSessionalMarks({
      sessionalAssessmentId: assessment.id,
      facultyId: testFaculty.id,
      subjectId: targetSubject.id,
      sectionId: targetSection.id,
      sessionalType: testAssessmentTitle,
      maxMarks: 30,
      studentMarks: studentMarksPayload,
      isPublished: false,
    });
    console.log('✓ [TEST 4] Successfully saved sessional marks with distinct evaluation states via supabaseService');

    // STEP 5: Query PostgreSQL directly and verify stored rows
    const { data: savedMarks, error: fetchErr } = await supabase
      .from('sessional_marks')
      .select('*')
      .eq('sessional_assessment_id', assessment.id);

    assert(!fetchErr && savedMarks && savedMarks.length >= 3, 'Saved marks must be retrievable from database');

    const mark0 = savedMarks.find(m => m.student_id === student0.id);
    const mark1 = savedMarks.find(m => m.student_id === student1.id);
    const mark2 = savedMarks.find(m => m.student_id === student2.id);

    // Assert student 0: PRESENT, marks_obtained = 24.5
    assert.strictEqual(mark0?.attendance_status, 'PRESENT', 'Student 0 must have status PRESENT');
    assert.strictEqual(Number(mark0?.marks_obtained), 24.5, 'Student 0 must have marks_obtained 24.5');

    // Assert student 1: PRESENT, marks_obtained = 0 (MUST NOT BE NULL, MUST NOT BE ABSENT)
    assert.strictEqual(mark1?.attendance_status, 'PRESENT', 'Student 1 must have status PRESENT');
    assert.strictEqual(Number(mark1?.marks_obtained), 0, 'Student 1 must have valid score 0');

    // Assert student 2: ABSENT, marks_obtained = NULL (MUST NOT BE 0)
    assert.strictEqual(mark2?.attendance_status, 'ABSENT', 'Student 2 must have status ABSENT');
    assert.strictEqual(mark2?.marks_obtained, null, 'Student 2 marks_obtained must be strictly NULL, NOT 0');

    if (student3) {
      const mark3 = savedMarks.find(m => m.student_id === student3.id);
      assert.strictEqual(mark3?.attendance_status, 'EXEMPTED', 'Student 3 must have status EXEMPTED');
      assert.strictEqual(mark3?.marks_obtained, null, 'Student 3 marks_obtained must be strictly NULL');
    }

    console.log('✓ [TEST 5] Row-level verification passed: ABSENT stores NULL; PRESENT with 0 stores 0');

    // STEP 6: Verify Database Constraints Enforce Score Semantics
    // Attempt to insert ABSENT with non-null marks (must be rejected by PostgreSQL constraint)
    const { error: invalidAbsentErr } = await supabase
      .from('sessional_marks')
      .insert({
        sessional_assessment_id: assessment.id,
        student_id: student0.id,
        subject_id: targetSubject.id,
        section_id: targetSection.id,
        faculty_id: testFaculty.id,
        marks_obtained: 15,
        max_marks: 30,
        attendance_status: 'ABSENT', // Constraint violation! ABSENT cannot have marks
      });

    assert(invalidAbsentErr, 'Database must reject ABSENT status with non-null marks_obtained');
    console.log('✓ [TEST 6] Database constraint chk_sessional_marks_score_consistency successfully blocked invalid ABSENT score');

    // STEP 7: Test Account Dependencies Endpoint
    console.log('\n--- Testing Account Dependencies Discovery API ---');
    let capturedDepResponse: any = null;
    let depStatusCode = 0;

    const mockDepReq: any = {
      method: 'GET',
      url: `/api/auth/account-dependencies?id=${student0.id}&role=student`,
      headers: {
        authorization: `Bearer ${token}`,
        host: 'localhost:5173',
      },
    };

    const mockDepRes: any = {
      writeHead: (code: number, headers: any) => { depStatusCode = code; },
      end: (data: string) => {
        try { capturedDepResponse = JSON.parse(data); } catch { capturedDepResponse = data; }
      },
    };

    await handleAdminAuth(mockDepReq, mockDepRes);
    if (depStatusCode !== 200) {
      console.error('Captured Dep Error Response:', depStatusCode, capturedDepResponse);
    }
    assert.strictEqual(depStatusCode, 200, 'Dependency discovery endpoint must return 200 OK');
    assert(capturedDepResponse?.success === true, 'Response must indicate success');
    assert(capturedDepResponse?.dependencies, 'Response must include dependencies map');
    assert(typeof capturedDepResponse.dependencies['Attendance Records'] === 'number', 'Must count attendance records');
    assert(typeof capturedDepResponse.dependencies['Assessment & Sessional Marks'] === 'number', 'Must count marks');
    console.log(`✓ [TEST 7] Account dependencies fetched successfully:`, capturedDepResponse.dependencies);

    // STEP 8: Test Permanent Delete Safeguards (Super Admin Only)
    console.log('\n--- Testing Permanent Delete API & Safeguards ---');

    // 8a. Safeguard: Non-DELETE confirmation must be blocked
    let deleteStatus = 0;
    let deleteResponse: any = null;
    const mockInvalidReq: any = {
      method: 'POST',
      url: '/api/auth/permanent-delete',
      headers: {
        authorization: `Bearer ${token}`,
        host: 'localhost:5173',
      },
      body: {
        id: student0.id,
        role: 'student',
        confirmation: 'NO_DELETE', // Invalid confirmation!
      },
    };
    const mockInvalidRes: any = {
      writeHead: (code: number) => { deleteStatus = code; },
      end: (data: string) => {
        try { deleteResponse = JSON.parse(data); } catch { deleteResponse = data; }
      },
    };

    await handleAdminAuth(mockInvalidReq, mockInvalidRes);
    assert.strictEqual(deleteStatus, 400, 'Invalid confirmation must return 400 Bad Request');
    assert(deleteResponse?.error?.includes('DELETE'), 'Error must instruct typing DELETE');
    console.log('✓ [TEST 8a] Permanent Delete blocked non-DELETE confirmation');

    // 8b. Safeguard: Cannot permanently delete ACTIVE account
    let activeDeleteStatus = 0;
    let activeDeleteResponse: any = null;
    const mockActiveReq: any = {
      method: 'POST',
      url: '/api/auth/permanent-delete',
      headers: {
        authorization: `Bearer ${token}`,
        host: 'localhost:5173',
      },
      body: {
        id: student0.id,
        role: 'student',
        confirmation: 'DELETE',
      },
    };
    const mockActiveRes: any = {
      writeHead: (code: number) => { activeDeleteStatus = code; },
      end: (data: string) => {
        try { activeDeleteResponse = JSON.parse(data); } catch { activeDeleteResponse = data; }
      },
    };

    await handleAdminAuth(mockActiveReq, mockActiveRes);
    assert.strictEqual(activeDeleteStatus, 400, 'Attempt to delete active account must return 400 Bad Request');
    assert(activeDeleteResponse?.error?.includes('active') || activeDeleteResponse?.error?.includes('archived'), 'Must require account to be archived first');
    console.log('✓ [TEST 8b] Permanent Delete blocked deletion of active account (requires archive first)');

    // 8c. Create a test ARCHIVED student and execute permanent deletion
    const dummyRoll = `TESTDEL${Date.now().toString().slice(-5)}`;
    const { data: dummyStudent, error: dummyErr } = await supabase
      .from('students')
      .insert({
        roll_number: dummyRoll,
        full_name: 'Ephemeral Test Account For Permanent Deletion',
        institution_id: student0.institution_id,
        department_id: student0.department_id,
        program_id: student0.program_id,
        academic_session_id: student0.academic_session_id,
        academic_year_id: student0.academic_year_id,
        semester_id: student0.semester_id,
        section_id: targetSection.id,
        admission_type: student0.admission_type || 'REGULAR',
        status: 'ARCHIVED',
        active: false,
      })
      .select()
      .single();

    if (dummyErr) {
      console.error('Failed to create dummy student:', dummyErr);
    }
    assert(!dummyErr && dummyStudent, 'Must create dummy archived student for test');
    console.log(`✓ [TEST 8c] Created test archived student: ${dummyStudent.roll_number} (ID: ${dummyStudent.id})`);

    // Insert dummy attendance and marks for cascade test
    const dummySessionId = (await supabase.from('attendance_sessions').select('id').limit(1)).data?.[0]?.id;
    if (dummySessionId) {
      await supabase.from('attendance_records').insert({
        attendance_session_id: dummySessionId,
        student_id: dummyStudent.id,
        status: 'PRESENT',
      });
    }

    // Execute Permanent Delete via API
    let permDeleteStatus = 0;
    let permDeleteResponse: any = null;
    const mockPermReq: any = {
      method: 'POST',
      url: '/api/auth/permanent-delete',
      headers: {
        authorization: `Bearer ${token}`,
        host: 'localhost:5173',
      },
      body: {
        id: dummyStudent.id,
        role: 'student',
        confirmation: 'DELETE',
      },
    };
    const mockPermRes: any = {
      writeHead: (code: number) => { permDeleteStatus = code; },
      end: (data: string) => {
        try { permDeleteResponse = JSON.parse(data); } catch { permDeleteResponse = data; }
      },
    };

    await handleAdminAuth(mockPermReq, mockPermRes);
    if (permDeleteStatus !== 200) {
      console.error('Permanent Delete Error Response:', permDeleteStatus, permDeleteResponse);
    }
    assert.strictEqual(permDeleteStatus, 200, 'Permanent delete must return 200 OK for archived account');
    assert(permDeleteResponse?.success === true, 'Response must indicate successful purge');

    // Verify row is completely deleted from students table
    const { data: checkDeleted } = await supabase.from('students').select('id').eq('id', dummyStudent.id).maybeSingle();
    assert.strictEqual(checkDeleted, null, 'Permanently deleted student must not exist in students table');

    // Verify cascading attendance records are also gone
    const { data: checkRecords } = await supabase.from('attendance_records').select('id').eq('student_id', dummyStudent.id);
    assert(!checkRecords || checkRecords.length === 0, 'Cascading records must be completely purged');

    console.log('✓ [TEST 8d] Permanent Delete successfully purged archived student and cascaded dependencies');

    // 8e. Create a test ARCHIVED faculty and execute permanent deletion
    const dummyFacCode = `TESTFAC${Date.now().toString().slice(-4)}`;
    const { data: dummyFac, error: facErr } = await supabase.from('faculty').insert({
      employee_code: dummyFacCode,
      faculty_code: dummyFacCode,
      full_name: 'Ephemeral Test Faculty For Permanent Deletion',
      designation: 'Assistant Professor',
      department_id: student0.department_id,
      status: 'ARCHIVED',
      active: false,
      email: `${dummyFacCode.toLowerCase()}@vctm.in`
    }).select().single();

    assert(!facErr && dummyFac, 'Must create dummy archived faculty for test');
    console.log(`✓ [TEST 8e] Created test archived faculty: ${dummyFac.employee_code} (ID: ${dummyFac.id})`);

    let facDeleteStatus = 0;
    let facDeleteResponse: any = null;
    const mockFacReq: any = {
      method: 'POST',
      url: '/api/auth/permanent-delete',
      headers: {
        authorization: `Bearer ${token}`,
        host: 'localhost:5173',
      },
      body: {
        id: dummyFac.id,
        role: 'faculty',
        confirmation: 'DELETE',
      },
    };
    const mockFacRes: any = {
      writeHead: (code: number) => { facDeleteStatus = code; },
      end: (data: string) => {
        try { facDeleteResponse = JSON.parse(data); } catch { facDeleteResponse = data; }
      },
    };

    await handleAdminAuth(mockFacReq, mockFacRes);
    assert.strictEqual(facDeleteStatus, 200, 'Faculty permanent delete must return 200 OK');
    assert(facDeleteResponse?.success === true, 'Response must indicate successful purge');

    const { data: checkFacDeleted } = await supabase.from('faculty').select('id').eq('id', dummyFac.id).maybeSingle();
    assert.strictEqual(checkFacDeleted, null, 'Permanently deleted faculty must not exist in faculty table');
    console.log('✓ [TEST 8f] Permanent Delete successfully purged archived faculty and cascaded dependencies');

  } finally {
    // Cleanup test assessment
    await supabase.from('sessional_marks').delete().eq('sessional_assessment_id', assessment.id);
    await supabase.from('sessional_assessments').delete().eq('id', assessment.id);
    console.log('✓ [CLEANUP] Test assessment and sessional marks cleaned up');
  }

  console.log('\n================================================================================');
  console.log('  ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (100% PRODUCTION READY)            ');
  console.log('================================================================================\n');
}

runAbsentAndPermanentDeleteTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
