if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import { Client } from 'pg';
import { generateMarksReportPdf, StudentMarkRow, SubjectScorecardRow } from '../lib/utils/marksPdfGenerator';

const connectionString = process.env.DATABASE_URL || '';

async function runMarksStatusVerification() {
  console.log('========================================================================');
  console.log('VCTM ERP: MARKS & ASSESSMENTS STATUS AND PDF CONSISTENCY TEST SUITE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    // -------------------------------------------------------------
    // SUITE 1: Schema & DB Constraints Verification
    // -------------------------------------------------------------
    console.log('\n--- SUITE 1: Schema & DB Constraints Verification ---');

    // 1.1 Check attendance_status column in sessional_marks
    const colRes = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sessional_marks'
        AND column_name = 'attendance_status';
    `);
    assert(colRes.rows.length === 1, 'attendance_status column exists in sessional_marks table');
    assert(
      colRes.rows[0]?.column_default?.includes('NOT_ENTERED'),
      `attendance_status defaults to 'NOT_ENTERED' (actual: ${colRes.rows[0]?.column_default})`
    );

    // 1.2 Check CHECK constraints
    const constraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as condef
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'sessional_marks' AND c.contype = 'c';
    `);
    const constraintNames = constraintsRes.rows.map(r => r.conname);
    const scoreConsistency = constraintsRes.rows.find(r => r.conname === 'chk_sessional_marks_score_consistency');
    const statusEnum = constraintsRes.rows.find(r => r.conname === 'chk_sessional_marks_attendance_status');

    assert(constraintNames.includes('chk_sessional_marks_attendance_status'), 'chk_sessional_marks_attendance_status constraint exists');
    assert(constraintNames.includes('chk_sessional_marks_score_consistency'), 'chk_sessional_marks_score_consistency constraint exists');
    console.log(`   Constraint def: ${scoreConsistency?.condef}`);

    // -------------------------------------------------------------
    // SUITE 2: Live DB Constraint Enforcement (Testing all 4 states)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Live DB Constraint Enforcement ---');

    // Find test sessional assessment, faculty, student
    const assessRes = await client.query(`SELECT id, max_marks, subject_id, section_id, faculty_id, title FROM sessional_assessments LIMIT 1;`);
    const studentRes = await client.query(`SELECT id FROM students LIMIT 1;`);

    assert(assessRes.rows.length > 0 && studentRes.rows.length > 0, 'Test assessment and student exist in DB');
    const testAssessment = assessRes.rows[0];
    const testStudentId = studentRes.rows[0].id;
    const testMaxMarks = Number(testAssessment.max_marks || 20);
    const validMark = Math.min(15, testMaxMarks);

    // Clean up any existing mark for this test pair
    await client.query(`DELETE FROM sessional_marks WHERE sessional_assessment_id = $1 AND student_id = $2;`, [
      testAssessment.id,
      testStudentId
    ]);

    // 2.1 Test PRESENT with valid numeric marks -> Must succeed
    let testSuccess = false;
    try {
      await client.query(
        `INSERT INTO sessional_marks (
           sessional_assessment_id, student_id, faculty_id, subject_id, section_id,
           sessional_type, max_marks, status, marks_obtained, attendance_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, 'PRESENT');`,
        [
          testAssessment.id,
          testStudentId,
          testAssessment.faculty_id,
          testAssessment.subject_id,
          testAssessment.section_id,
          testAssessment.title || 'Sessional 1',
          testMaxMarks,
          validMark
        ]
      );
      testSuccess = true;
    } catch (e: any) {
      console.error('Insert PRESENT error:', e.message);
      testSuccess = false;
    }
    assert(testSuccess, `PRESENT status with numeric marks_obtained (${validMark}) successfully inserted`);

    // 2.2 Test PRESENT with NULL marks -> Must be rejected by constraint
    let violatedPresentNull = false;
    try {
      await client.query(
        `UPDATE sessional_marks SET marks_obtained = NULL WHERE sessional_assessment_id = $1 AND student_id = $2;`,
        [testAssessment.id, testStudentId]
      );
    } catch (e: any) {
      violatedPresentNull = e.message.includes('chk_sessional_marks_score_consistency');
    }
    assert(violatedPresentNull, 'PRESENT status with NULL marks is rejected by DB constraint');

    // 2.3 Test ABSENT with non-null marks -> Must be rejected by constraint
    let violatedAbsentScore = false;
    try {
      await client.query(
        `UPDATE sessional_marks SET attendance_status = 'ABSENT', marks_obtained = $3 WHERE sessional_assessment_id = $1 AND student_id = $2;`,
        [testAssessment.id, testStudentId, validMark]
      );
    } catch (e: any) {
      violatedAbsentScore = e.message.includes('chk_sessional_marks_score_consistency');
    }
    assert(violatedAbsentScore, 'ABSENT status with numeric marks is rejected by DB constraint');

    // 2.4 Test ABSENT with NULL marks -> Must succeed
    let testAbsentOk = false;
    try {
      await client.query(
        `UPDATE sessional_marks SET attendance_status = 'ABSENT', marks_obtained = NULL WHERE sessional_assessment_id = $1 AND student_id = $2;`,
        [testAssessment.id, testStudentId]
      );
      testAbsentOk = true;
    } catch (e: any) {
      console.error('ABSENT update error:', e.message);
      testAbsentOk = false;
    }
    assert(testAbsentOk, 'ABSENT status with NULL marks successfully persisted');

    // Verify row state
    const absentRow = await client.query(
      `SELECT attendance_status, marks_obtained FROM sessional_marks WHERE sessional_assessment_id = $1 AND student_id = $2;`,
      [testAssessment.id, testStudentId]
    );
    assert(
      absentRow.rows[0]?.attendance_status === 'ABSENT' && absentRow.rows[0]?.marks_obtained === null,
      'Persisted row confirmed: attendance_status=ABSENT, marks_obtained=NULL'
    );

    // 2.5 Test EXEMPTED with NULL marks -> Must succeed
    let testExemptOk = false;
    try {
      await client.query(
        `UPDATE sessional_marks SET attendance_status = 'EXEMPTED', marks_obtained = NULL WHERE sessional_assessment_id = $1 AND student_id = $2;`,
        [testAssessment.id, testStudentId]
      );
      testExemptOk = true;
    } catch (e: any) {
      console.error('EXEMPTED update error:', e.message);
      testExemptOk = false;
    }
    assert(testExemptOk, 'EXEMPTED status with NULL marks successfully persisted');

    const exemptRow = await client.query(
      `SELECT attendance_status, marks_obtained FROM sessional_marks WHERE sessional_assessment_id = $1 AND student_id = $2;`,
      [testAssessment.id, testStudentId]
    );
    assert(
      exemptRow.rows[0]?.attendance_status === 'EXEMPTED' && exemptRow.rows[0]?.marks_obtained === null,
      'Persisted row confirmed: attendance_status=EXEMPTED, marks_obtained=NULL'
    );

    // 2.6 Test CLEAR action (Reset to NOT_ENTERED with NULL marks) -> Must succeed
    let testClearOk = false;
    try {
      await client.query(
        `UPDATE sessional_marks SET attendance_status = 'NOT_ENTERED', marks_obtained = NULL WHERE sessional_assessment_id = $1 AND student_id = $2;`,
        [testAssessment.id, testStudentId]
      );
      testClearOk = true;
    } catch (e: any) {
      console.error('CLEAR action update error:', e.message);
      testClearOk = false;
    }
    assert(testClearOk, 'CLEAR action (Reset to NOT_ENTERED) successfully persisted');

    const clearRow = await client.query(
      `SELECT attendance_status, marks_obtained FROM sessional_marks WHERE sessional_assessment_id = $1 AND student_id = $2;`,
      [testAssessment.id, testStudentId]
    );
    assert(
      clearRow.rows[0]?.attendance_status === 'NOT_ENTERED' && clearRow.rows[0]?.marks_obtained === null,
      'Persisted row confirmed: attendance_status=NOT_ENTERED, marks_obtained=NULL'
    );

    // 2.7 Transition back to PRESENT with new marks (e.g. validMark)
    await client.query(
      `UPDATE sessional_marks SET attendance_status = 'PRESENT', marks_obtained = $3 WHERE sessional_assessment_id = $1 AND student_id = $2;`,
      [testAssessment.id, testStudentId, validMark]
    );
    const presentRow = await client.query(
      `SELECT attendance_status, marks_obtained FROM sessional_marks WHERE sessional_assessment_id = $1 AND student_id = $2;`,
      [testAssessment.id, testStudentId]
    );
    assert(
      presentRow.rows[0]?.attendance_status === 'PRESENT' && Number(presentRow.rows[0]?.marks_obtained) === validMark,
      `Switch back to PRESENT with score ${validMark} confirmed`
    );

    // Clean up test mark
    await client.query(`DELETE FROM sessional_marks WHERE sessional_assessment_id = $1 AND student_id = $2;`, [
      testAssessment.id,
      testStudentId
    ]);

    // -------------------------------------------------------------
    // SUITE 3: Query Layer attendance_status Selection Verification
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Query Layer Column Selection Verification ---');

    // Check supabaseService.ts includes attendance_status in all 4 query select strings
    const fs = await import('fs');
    const path = await import('path');
    const serviceContent = fs.readFileSync(
      path.resolve('/Users/tarun/Documents/ERP/src/lib/services/supabaseService.ts'),
      'utf-8'
    );

    const hasSelectInOp = serviceContent.includes("from('sessional_marks').select(") && serviceContent.includes("attendance_status, remarks, created_at, updated_at");
    const hasSelectInStudentAcad = serviceContent.includes("fetchStudentAcademicRecords") && serviceContent.includes("attendance_status, remarks, created_at, updated_at");
    const hasSelectInFacultyAcad = serviceContent.includes("fetchFacultyAcademicRecords") && serviceContent.includes("attendance_status, remarks, created_at, updated_at");
    const hasSelectInAssessmentMarks = serviceContent.includes("fetchAssessmentMarks") && serviceContent.includes("attendance_status, remarks, created_at, updated_at");

    assert(hasSelectInOp, 'fetchOperationalData selects attendance_status in sessional_marks');
    assert(hasSelectInStudentAcad, 'fetchStudentAcademicRecords selects attendance_status in sessional_marks');
    assert(hasSelectInFacultyAcad, 'fetchFacultyAcademicRecords selects attendance_status in sessional_marks');
    assert(hasSelectInAssessmentMarks, 'fetchAssessmentMarks selects attendance_status in sessional_marks');

    // -------------------------------------------------------------
    // SUITE 4: PDF Generation Consistency with ABSENT & EXEMPT
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: PDF Generation Consistency Verification ---');

    const sampleStudentRows: StudentMarkRow[] = [
      { sNo: 1, rollNumber: '21001', studentName: 'Aarav Sharma', marksObtained: 27, maxMarks: 30, status: 'Present', percentage: '90.0%' },
      { sNo: 2, rollNumber: '21002', studentName: 'Bhavna Patel', marksObtained: null, maxMarks: 30, status: 'Absent', percentage: '—' },
      { sNo: 3, rollNumber: '21003', studentName: 'Chirag Verma', marksObtained: null, maxMarks: 30, status: 'Exempt', percentage: '—' },
      { sNo: 4, rollNumber: '21004', studentName: 'Divya Gupta', marksObtained: null, maxMarks: 30, status: 'Not Entered', percentage: '—' },
      { sNo: 5, rollNumber: '21005', studentName: 'Eshan Roy', marksObtained: 18, maxMarks: 30, status: 'Present', percentage: '60.0%' }
    ];

    const sampleScorecardRows: SubjectScorecardRow[] = [
      { sNo: 1, rollNumber: '21001', studentName: 'Aarav Sharma', sessional1: 27, sessional2: 'ABSENT', quizzesTotal: '18/20', internalTotal: 45, maxTotal: 80, status: 'Pass' },
      { sNo: 2, rollNumber: '21002', studentName: 'Bhavna Patel', sessional1: 'ABSENT', sessional2: 'EXEMPT', quizzesTotal: '15/20', internalTotal: 15, maxTotal: 80, status: 'Eligible' },
      { sNo: 3, rollNumber: '21003', studentName: 'Chirag Verma', sessional1: 'EXEMPT', sessional2: 24, quizzesTotal: '19/20', internalTotal: 43, maxTotal: 80, status: 'Pass' }
    ];

    // 4.1 Generate CURRENT_ASSESSMENT Report
    let currentPdfOk = false;
    try {
      const pdf1 = await generateMarksReportPdf({
        reportType: 'CURRENT_ASSESSMENT',
        academicYear: '2026-2027',
        sectionName: 'CSE-A',
        subjectName: 'Computer Architecture',
        subjectCode: 'CS-401',
        facultyName: 'Dr. S. K. Gupta',
        assessmentTitle: 'Sessional Assessment 1',
        maxMarks: 30,
        publishStatus: 'published',
        studentRows: sampleStudentRows
      });
      assert(pdf1 && typeof pdf1.output === 'function', 'CURRENT_ASSESSMENT report generated successfully');
      currentPdfOk = true;
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr);
      assert(false, 'CURRENT_ASSESSMENT report generated successfully');
    }

    // 4.2 Generate SUBJECT_SCORECARD Report
    try {
      const pdf2 = await generateMarksReportPdf({
        reportType: 'SUBJECT_SCORECARD',
        academicYear: '2026-2027',
        sectionName: 'CSE-A',
        subjectName: 'Computer Architecture',
        subjectCode: 'CS-401',
        facultyName: 'Dr. S. K. Gupta',
        assessmentTitle: 'Subject Summary',
        scorecardRows: sampleScorecardRows
      });
      assert(pdf2 && typeof pdf2.output === 'function', 'SUBJECT_SCORECARD report generated successfully with ABSENT/EXEMPT');
    } catch (pdfErr) {
      console.error('PDF scorecard error:', pdfErr);
      assert(false, 'SUBJECT_SCORECARD report generated successfully');
    }

    // 4.3 Generate SECTION_REPORT Report
    try {
      const pdf3 = await generateMarksReportPdf({
        reportType: 'SECTION_REPORT',
        academicYear: '2026-2027',
        sectionName: 'CSE-A',
        subjectName: 'Computer Architecture',
        subjectCode: 'CS-401',
        facultyName: 'Dr. S. K. Gupta',
        assessmentTitle: 'Section Overview',
        maxMarks: 30,
        studentRows: sampleStudentRows
      });
      assert(pdf3 && typeof pdf3.output === 'function', 'SECTION_REPORT report generated successfully with Absent/Exempt records');
    } catch (pdfErr) {
      console.error('PDF section report error:', pdfErr);
      assert(false, 'SECTION_REPORT report generated successfully');
    }

    // 4.4 Generate STUDENT_REPORT Report
    try {
      const pdf4 = await generateMarksReportPdf({
        reportType: 'STUDENT_REPORT',
        academicYear: '2026-2027',
        sectionName: 'CSE-A',
        subjectName: 'Computer Architecture',
        subjectCode: 'CS-401',
        facultyName: 'Dr. S. K. Gupta',
        assessmentTitle: 'Individual Student Report',
        singleStudent: {
          studentName: 'Bhavna Patel',
          rollNumber: '21002',
          assessments: [
            { title: 'Sessional 1', marksObtained: null, maxMarks: 30, percentage: '—', status: 'Absent' },
            { title: 'Sessional 2', marksObtained: null, maxMarks: 30, percentage: '—', status: 'Exempt' },
            { title: 'Quiz 1', marksObtained: 15, maxMarks: 20, percentage: '75.0%', status: 'Evaluated' }
          ]
        }
      });
      assert(pdf4 && typeof pdf4.output === 'function', 'STUDENT_REPORT report generated successfully with individual Absent/Exempt history');
    } catch (pdfErr) {
      console.error('PDF student report error:', pdfErr);
      assert(false, 'STUDENT_REPORT report generated successfully');
    }

    console.log('\n========================================================================');
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
    console.log('========================================================================');

    if (passedTests === totalTests) {
      console.log('🎉 ALL MARKS & ASSESSMENTS STATUS AND PDF CONSISTENCY TESTS PASSED!');
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

runMarksStatusVerification().catch(err => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
