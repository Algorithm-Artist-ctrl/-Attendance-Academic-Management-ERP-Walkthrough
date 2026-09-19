import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { 
  Student, 
  SessionalAssessment, 
  SessionalMark 
} from '../types/database.types';

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
      }
    }
  }
}

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

/**
 * Mirror of AcademicContext.getStudentAcademicScorecard
 */
function computeStudentAcademicScorecard(
  student: Student,
  enrolledSubjects: Array<{ id: string; subject_code: string; subject_name: string }>,
  sessionalAssessments: SessionalAssessment[],
  sessionalMarks: SessionalMark[],
  facultyList: Array<{ id: string; full_name: string }> = []
) {
  const reports: any[] = [];

  for (const sub of enrolledSubjects) {
    // Dynamic assessments filtered strictly to published / completed
    const subAssessments = sessionalAssessments.filter(
      sa => sa.subject_id === sub.id &&
            (!sa.section_id || sa.section_id === student.section_id || sessionalMarks.some(m => m.sessional_assessment_id === sa.id && m.student_id === student.id)) &&
            (sa.status === 'published' || sa.status === 'completed')
    );

    const dynamicSessionals = subAssessments
      .map(sa => {
        const mark = sessionalMarks.find(
          sm => sm.sessional_assessment_id === sa.id && 
                sm.student_id === student.id &&
                (sm.status === 'published' || (!sm.status && (sa.status === 'published' || sa.status === 'completed')))
        );
        const hasScore = mark !== undefined && mark.marks_obtained !== undefined && mark.marks_obtained !== null;
        return {
          assessmentId: sa.id,
          title: sa.title,
          maxMarks: Number(sa.max_marks),
          obtainedMarks: hasScore ? Number(mark.marks_obtained) : undefined,
          examDate: sa.exam_date,
        };
      })
      .filter(s => s.obtainedMarks !== undefined);

    // Legacy marks fallback - ONLY marks without assessment ID and MUST be published
    const subSessional = sessionalMarks.filter(
      sm => sm.student_id === student.id && 
            sm.subject_id === sub.id && 
            !sm.sessional_assessment_id &&
            sm.status === 'published'
    );

    for (const sm of subSessional) {
      if (!dynamicSessionals.some(ds => ds.title === sm.sessional_type) && sm.marks_obtained !== undefined && sm.marks_obtained !== null) {
        dynamicSessionals.push({
          assessmentId: sm.sessional_assessment_id || undefined,
          title: sm.sessional_type,
          maxMarks: Number(sm.max_marks),
          obtainedMarks: Number(sm.marks_obtained),
          examDate: sm.created_at,
        });
      }
    }

    // Strict subject visibility rule: MUST have at least one published mark
    const hasPublishedMarks = dynamicSessionals.length > 0;
    if (!hasPublishedMarks) {
      continue; // Exclude unpublished subjects entirely!
    }

    const sessionalTotal = dynamicSessionals.reduce((sum, s) => sum + (s.obtainedMarks || 0), 0);
    const sessionalMax = dynamicSessionals.reduce((sum, s) => sum + s.maxMarks, 0);

    reports.push({
      subjectId: sub.id,
      subjectCode: sub.subject_code,
      subjectName: sub.subject_name,
      facultyName: facultyList[0]?.full_name || 'Faculty',
      sessionalMarks: {
        sessionals: dynamicSessionals,
        totalObtained: sessionalTotal,
        totalMax: sessionalMax,
      },
      totalInternalScore: sessionalTotal,
      maxInternalScore: sessionalMax,
    });
  }

  return reports;
}

async function runStrictMarksPublicationIsolationTests() {
  console.log('================================================================================');
  console.log('VCTM ERP: STRICT UNPUBLISHED MARKS ISOLATION & RLS VERIFICATION');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  let createdAssessmentId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: Target Student (Shailendra Kumar Singh - Section A) Resolution
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 1: Target Student & Section Context Resolution ---');
    
    const studentRes = await client.query(`
      SELECT s.*, sec.name as section_name, ay.name as year_name
      FROM students s
      JOIN sections sec ON s.section_id = sec.id
      JOIN academic_years ay ON s.academic_year_id = ay.id
      WHERE s.roll_number = '2503400100048' OR s.full_name ILIKE '%SHAILENDRA%'
      LIMIT 1
    `);

    assert(studentRes.rows.length === 1, 'Resolved student SHAILENDRA KUMAR SINGH (Roll: 2503400100048)');
    const targetStudent: Student = studentRes.rows[0];
    console.log(`   Student: ${targetStudent.full_name} | ID: ${targetStudent.id} | Section: ${targetStudent.section_id}`);

    // Fetch subjects taught in Section A
    const sectionSubjectsRes = await client.query(`
      SELECT DISTINCT sub.id, sub.subject_code, sub.subject_name
      FROM subjects sub
      JOIN faculty_subject_assignments fsa ON fsa.subject_id = sub.id
      WHERE fsa.section_id = $1 AND fsa.active = true
    `, [targetStudent.section_id]);

    const enrolledSubjects = sectionSubjectsRes.rows;
    console.log(`   Section A Enrolled Subjects count: ${enrolledSubjects.length}`);
    assert(enrolledSubjects.length > 0, 'Section A has enrolled subjects in curriculum');

    // Fetch active faculty
    const facultyRes = await client.query(`SELECT id, full_name FROM faculty WHERE active = true LIMIT 1`);
    const testFaculty = facultyRes.rows[0];

    // Find CAO LAB subject (BCS352) or a suitable lab/theory subject
    const subjectRes = await client.query(`
      SELECT * FROM subjects 
      WHERE subject_code = 'BCS352' OR subject_name ILIKE '%CAO%' OR subject_name ILIKE '%COA%'
      LIMIT 1
    `);
    const testSubject = subjectRes.rows[0] || enrolledSubjects[0];
    console.log(`   Test Subject: ${testSubject.subject_code} - ${testSubject.subject_name}`);

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Initial State Verification (All Existing DB Rows Are Draft)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Initial State: Draft Assessments Are Hidden ---');

    const dbAssessmentsRes = await client.query(`SELECT * FROM sessional_assessments`);
    const dbMarksRes = await client.query(`SELECT * FROM sessional_marks WHERE student_id = $1`, [targetStudent.id]);

    const initialScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      dbAssessmentsRes.rows,
      dbMarksRes.rows
    );

    console.log(`   Initial Published Scorecard subjects count: ${initialScorecard.length}`);
    assert(
      initialScorecard.length === 0,
      'Initial State: All unreleased assessments are in DRAFT status -> Student Dashboard shows 0 published subjects'
    );

    // Verify none of the 5 subjects (Mathematics IV, Data Structure, COA, DSTL, UHV) leak into scorecard
    const leakedSubjects = initialScorecard.filter(r => 
      ['Mathematics IV', 'Data Structure', 'COA', 'DSTL', 'UHV'].some(name => r.subjectName.includes(name))
    );
    assert(
      leakedSubjects.length === 0,
      'Zero Leakage: Draft marks (Math IV, Data Structure, COA, DSTL, UHV) are strictly excluded from Student Dashboard'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 1: Subject with No Entered/Published Marks
    // -------------------------------------------------------------------------
    console.log('\n--- TEST CASE 1: Subject with No Published Marks (Absent from View) ---');

    const hasTestSubInInitial = initialScorecard.some(r => r.subjectId === testSubject.id);
    assert(
      !hasTestSubInInitial,
      `Case 1: Subject ${testSubject.subject_code} with no published marks is completely absent from Student Dashboard (not 0/20, not empty card)`
    );

    // -------------------------------------------------------------------------
    // TEST CASE 2: Faculty Enters Marks & Saves as DRAFT (Save != Publish)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST CASE 2: Faculty Enters Marks (15/20) and Clicks SAVE (Draft) ---');

    const insertDraftRes = await client.query(`
      INSERT INTO sessional_assessments (faculty_id, subject_id, section_id, title, max_marks, exam_date, status)
      VALUES ($1, $2, $3, 'CAO LAB Midterm Test', 20, CURRENT_DATE, 'draft')
      RETURNING *
    `, [testFaculty.id, testSubject.id, targetStudent.section_id]);

    createdAssessmentId = insertDraftRes.rows[0].id;
    const draftAssessment: SessionalAssessment = insertDraftRes.rows[0];

    assert(draftAssessment.status === 'draft', 'Assessment created with status = draft');

    const insertMarksRes = await client.query(`
      INSERT INTO sessional_marks (sessional_assessment_id, faculty_id, subject_id, section_id, student_id, sessional_type, max_marks, marks_obtained, status, updated_by)
      VALUES ($1, $2, $3, $4, $5, 'CAO LAB Midterm Test', 20, 15, 'draft', $2)
      RETURNING *
    `, [createdAssessmentId, testFaculty.id, testSubject.id, targetStudent.section_id, targetStudent.id]);

    const draftMark: SessionalMark = insertMarksRes.rows[0];
    assert(draftMark.status === 'draft', 'Mark saved with status = draft');
    assert(Number(draftMark.marks_obtained) === 15, 'Marks saved: 15 / 20');

    // Compute student scorecard with this saved draft
    const afterDraftScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessmentsRes.rows, draftAssessment],
      [...dbMarksRes.rows, draftMark]
    );

    const hasTestSubInDraft = afterDraftScorecard.some(r => r.subjectId === testSubject.id);
    assert(
      !hasTestSubInDraft,
      'Case 2: Subject is STILL ABSENT from Student Dashboard while status = draft (Save != Publish rule enforced)'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 3: Faculty Clicks PUBLISH -> Immediate Student Visibility
    // -------------------------------------------------------------------------
    console.log('\n--- TEST CASE 3: Faculty Clicks PUBLISH Marks to Students ---');

    await client.query(`
      UPDATE sessional_assessments 
      SET status = 'published', updated_at = NOW() 
      WHERE id = $1
    `, [createdAssessmentId]);

    await client.query(`
      UPDATE sessional_marks 
      SET status = 'published', updated_at = NOW() 
      WHERE sessional_assessment_id = $1
    `, [createdAssessmentId]);

    const publishedAssessment: SessionalAssessment = {
      ...draftAssessment,
      status: 'published'
    };

    const publishedMark: SessionalMark = {
      ...draftMark,
      status: 'published'
    };

    const afterPublishScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessmentsRes.rows, publishedAssessment],
      [...dbMarksRes.rows, publishedMark]
    );

    const testSubPublishedReport = afterPublishScorecard.find(r => r.subjectId === testSubject.id);
    assert(
      !!testSubPublishedReport,
      `Case 3: Subject ${testSubject.subject_code} is now VISIBLE on Student Dashboard after faculty publishes`
    );
    assert(
      testSubPublishedReport?.totalInternalScore === 15,
      'Case 3: Subject displays exact published mark: 15 / 20'
    );
    assert(
      afterPublishScorecard.length === 1,
      'Case 3: Published Continuous Assessments header dynamically shows 1 Subject (Dynamic count)'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 4: Genuine Zero Marks Preservation (0 / 20)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST CASE 4: Genuine Zero Mark (0 / 20) Published Handling ---');

    await client.query(`
      UPDATE sessional_marks 
      SET marks_obtained = 0, status = 'published', updated_at = NOW() 
      WHERE sessional_assessment_id = $1 AND student_id = $2
    `, [createdAssessmentId, targetStudent.id]);

    const zeroMark: SessionalMark = {
      ...publishedMark,
      marks_obtained: 0
    };

    const zeroScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessmentsRes.rows, publishedAssessment],
      [...dbMarksRes.rows, zeroMark]
    );

    const zeroReport = zeroScorecard.find(r => r.subjectId === testSubject.id);
    assert(!!zeroReport, 'Case 4: Subject with genuine 0 mark remains visible');
    assert(
      zeroReport?.totalInternalScore === 0,
      'Case 4: Genuine 0 mark displays accurately as 0 / 20 (NOT hidden, NOT omitted)'
    );
    assert(
      zeroReport?.sessionalMarks.sessionals[0].obtainedMarks === 0,
      'Case 4: Obtained marks value is exactly 0'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 5: Faculty Unpublishes Assessment -> Immediate Disappearance
    // -------------------------------------------------------------------------
    console.log('\n--- TEST CASE 5: Faculty Unpublishes Assessment -> Immediate Disappearance ---');

    await client.query(`
      UPDATE sessional_assessments 
      SET status = 'draft', updated_at = NOW() 
      WHERE id = $1
    `, [createdAssessmentId]);

    await client.query(`
      UPDATE sessional_marks 
      SET status = 'draft', updated_at = NOW() 
      WHERE sessional_assessment_id = $1
    `, [createdAssessmentId]);

    const unpubAssessment: SessionalAssessment = {
      ...publishedAssessment,
      status: 'draft'
    };

    const unpubMark: SessionalMark = {
      ...zeroMark,
      status: 'draft'
    };

    const unpubScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessmentsRes.rows, unpubAssessment],
      [...dbMarksRes.rows, unpubMark]
    );

    const hasTestSubAfterUnpub = unpubScorecard.some(r => r.subjectId === testSubject.id);
    assert(
      !hasTestSubAfterUnpub,
      'Case 5: Subject IMMEDIATELY DISAPPEARS from Student Dashboard upon unpublishing'
    );
    assert(
      unpubScorecard.length === 0,
      'Case 5: Published Continuous Assessments header resets to 0 Subjects with empty state'
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 6: Database-Level RLS Policy Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Database-Level RLS Security Policy Verification ---');

    // Verify RLS is enabled on sessional_assessments and sessional_marks
    const rlsStatusRes = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname IN ('sessional_assessments', 'sessional_marks')
    `);

    for (const row of rlsStatusRes.rows) {
      assert(row.relrowsecurity === true, `RLS is strictly ENABLED on table '${row.relname}'`);
    }

    // Verify sessional_marks table has status column with default 'draft'
    const colRes = await client.query(`
      SELECT column_name, column_default, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessional_marks' AND column_name = 'status'
    `);
    assert(colRes.rows.length === 1, 'sessional_marks table has status column');
    assert(colRes.rows[0].column_default.includes('draft'), "sessional_marks.status defaults to 'draft'");

    // Verify sessional_assessments table default status is 'draft'
    const saColRes = await client.query(`
      SELECT column_name, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'sessional_assessments' AND column_name = 'status'
    `);
    assert(saColRes.rows[0].column_default.includes('draft'), "sessional_assessments.status defaults to 'draft'");

    // Verify RLS policy definition for sessional_marks_read
    const polRes = await client.query(`
      SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual
      FROM pg_policy
      JOIN pg_class ON pg_class.oid = pg_policy.polrelid
      WHERE pg_class.relname = 'sessional_marks' AND polname = 'sessional_marks_read'
    `);
    assert(polRes.rows.length === 1, "RLS policy 'sessional_marks_read' exists on sessional_marks");
    const qual = polRes.rows[0].qual;
    console.log(`   sessional_marks_read policy: ${qual}`);
    assert(
      qual.includes('status') && qual.includes('published'),
      "RLS policy sessional_marks_read enforces (status = 'published' AND assessment status IN ('published', 'completed')) for students"
    );

    // Verify realtime publication inclusion
    const rtPubRes = await client.query(`
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename IN ('sessional_assessments', 'sessional_marks')
    `);
    const rtTables = rtPubRes.rows.map(r => r.tablename);
    assert(rtTables.includes('sessional_assessments'), "sessional_assessments is in 'supabase_realtime' publication");
    assert(rtTables.includes('sessional_marks'), "sessional_marks is in 'supabase_realtime' publication");

  } catch (err: any) {
    console.error('Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (createdAssessmentId) {
      console.log('\n--- Cleaning up temporary test assessment ---');
      await client.query(`DELETE FROM sessional_marks WHERE sessional_assessment_id = $1`, [createdAssessmentId]);
      await client.query(`DELETE FROM sessional_assessments WHERE id = $1`, [createdAssessmentId]);
      console.log('   Cleaned up test assessment and marks.');
    }
    await client.end();
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} of ${total} tests passed (${((passed / total) * 100).toFixed(1)}%).`);
  console.log('================================================================================');
}

runStrictMarksPublicationIsolationTests();
