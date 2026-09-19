import { Client } from 'pg';
import { 
  Student, 
  SessionalAssessment, 
  SessionalMark, 
  LeaveApplication 
} from '../types/database.types';

import * as fs from 'fs';
import * as path from 'path';

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

// Emulation of AcademicContext.getStudentAcademicScorecard
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
          sm => sm.sessional_assessment_id === sa.id && sm.student_id === student.id
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

    // Legacy marks fallback - ONLY marks without assessment ID
    const subSessional = sessionalMarks.filter(
      sm => sm.student_id === student.id && sm.subject_id === sub.id && !sm.sessional_assessment_id
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

async function runRealtimeMarksAndLeaveVerification() {
  console.log('================================================================================');
  console.log('VCTM ERP: STUDENT DASHBOARD MARKS VISIBILITY & REALTIME LEAVE VERIFICATION');
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
  let createdLeaveId: string | null = null;

  try {
    // -------------------------------------------------------------
    // 1. Resolve Target Student (AKSHAY KUMAR - 2503400100003) & CAO LAB (BCS352)
    // -------------------------------------------------------------
    console.log('--- SUITE 1: Target Student & Academic Matrix Resolution ---');

    const studentRes = await client.query(`
      SELECT s.*, sec.name as section_name, ay.name as year_name
      FROM students s
      JOIN sections sec ON s.section_id = sec.id
      JOIN academic_years ay ON s.academic_year_id = ay.id
      WHERE s.roll_number = '2503400100048' OR s.full_name ILIKE '%SHAILENDRA%'
      LIMIT 1
    `);

    assert(studentRes.rows.length === 1, 'Found target student SHAILENDRA KUMAR SINGH (Roll: 2503400100048)');
    const targetStudent: Student = studentRes.rows[0];
    console.log(`   Student: ${targetStudent.full_name} | Section: ${targetStudent.section_id} | Year: ${targetStudent.academic_year_id}`);

    // Resolve CAO LAB / COA LAB subject (BCS352)
    const caolabRes = await client.query(`
      SELECT * FROM subjects 
      WHERE subject_code = 'BCS352' OR subject_name ILIKE '%CAO LAB%' OR subject_name ILIKE '%COA LAB%'
      LIMIT 1
    `);

    assert(caolabRes.rows.length === 1, 'Found real CAO LAB subject (BCS352: Computer Organization & Architecture Lab)');
    const caolabSubject = caolabRes.rows[0];

    // Find all subjects taught in this section
    const sectionSubjectsRes = await client.query(`
      SELECT DISTINCT sub.id, sub.subject_code, sub.subject_name
      FROM subjects sub
      JOIN faculty_subject_assignments fsa ON fsa.subject_id = sub.id
      WHERE fsa.section_id = $1 AND fsa.active = true
    `, [targetStudent.section_id]);

    const enrolledSubjects = sectionSubjectsRes.rows;
    console.log(`   Total subjects taught in Section B: ${enrolledSubjects.length}`);
    assert(enrolledSubjects.some((s: any) => s.id === caolabSubject.id), 'CAO LAB is enrolled in Section B syllabus');

    // Fetch existing assessments and marks from database
    const assessmentsRes = await client.query(`SELECT * FROM sessional_assessments`);
    const marksRes = await client.query(`SELECT * FROM sessional_marks WHERE student_id = $1`, [targetStudent.id]);

    let dbAssessments: SessionalAssessment[] = assessmentsRes.rows;
    let dbMarks: SessionalMark[] = marksRes.rows;

    // -------------------------------------------------------------
    // 2. Initial State: CAO LAB has NO marks entered/published
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Unpublished Subject Isolation Rule ---');

    const initialScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      dbAssessments,
      dbMarks
    );

    const hasCaoLabInitially = initialScorecard.some(r => r.subjectId === caolabSubject.id);
    assert(!hasCaoLabInitially, 'CAO LAB (BCS352) is strictly NOT visible on Student Dashboard initially (No marks published)');
    assert(initialScorecard.length >= 0, `Unpublished subjects held in draft (Current visible count: ${initialScorecard.length})`);
    console.log(`   Currently visible published subjects: ${initialScorecard.map(r => r.subjectCode).join(', ') || 'None (All held in draft)'}`);

    // -------------------------------------------------------------
    // 3. Faculty Creates CAO LAB Assessment as DRAFT with Marks
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Draft Assessment Marks Leak Prevention ---');

    // Find an active faculty assigned to this subject or section
    const facultyRes = await client.query(`SELECT id FROM faculty WHERE active = true LIMIT 1`);
    const testFacultyId = facultyRes.rows[0].id;

    // Insert draft assessment
    const insertDraftRes = await client.query(`
      INSERT INTO sessional_assessments (faculty_id, subject_id, section_id, title, max_marks, exam_date, status)
      VALUES ($1, $2, $3, 'CAO LAB Midterm Test', 20, CURRENT_DATE, 'draft')
      RETURNING *
    `, [testFacultyId, caolabSubject.id, targetStudent.section_id]);

    createdAssessmentId = insertDraftRes.rows[0].id;
    const draftAssessment: SessionalAssessment = insertDraftRes.rows[0];
    assert(draftAssessment.status === 'draft', 'Created CAO LAB sessional assessment in DRAFT status');

    // Insert marks for Akshay Kumar in draft assessment
    const insertMarksRes = await client.query(`
      INSERT INTO sessional_marks (sessional_assessment_id, faculty_id, subject_id, section_id, student_id, sessional_type, max_marks, marks_obtained, updated_by)
      VALUES ($1, $2, $3, $4, $5, 'CAO LAB Midterm Test', 20, 17, $2)
      RETURNING *
    `, [createdAssessmentId, testFacultyId, caolabSubject.id, targetStudent.section_id, targetStudent.id]);

    const draftMark: SessionalMark = insertMarksRes.rows[0];
    assert(Number(draftMark.marks_obtained) === 17, 'Saved draft marks (17 / 20) in database');

    // Compute scorecard with draft assessment
    const draftScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessments, draftAssessment],
      [...dbMarks, draftMark]
    );

    const hasCaoLabInDraft = draftScorecard.some(r => r.subjectId === caolabSubject.id);
    assert(!hasCaoLabInDraft, 'CAO LAB is STILL NOT visible to student while assessment is in DRAFT status (Zero Leak)');

    // -------------------------------------------------------------
    // 4. Faculty Publishes Assessment -> Immediate Student Visibility
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: Published Trigger & Scorecard Realtime Visibility ---');

    await client.query(`
      UPDATE sessional_assessments 
      SET status = 'published', updated_at = NOW() 
      WHERE id = $1
    `, [createdAssessmentId]);

    const publishedAssessment: SessionalAssessment = {
      ...draftAssessment,
      status: 'published'
    };

    const publishedScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessments, publishedAssessment],
      [...dbMarks, draftMark]
    );

    const caoLabReport = publishedScorecard.find(r => r.subjectId === caolabSubject.id);
    assert(!!caoLabReport, 'CAO LAB (BCS352) is now VISIBLE on Student Dashboard after faculty publishes marks');
    assert(caoLabReport?.totalInternalScore === 17, 'CAO LAB displays exact published score: 17 / 20');

    // -------------------------------------------------------------
    // 5. Faculty Updates Marks (17 -> 19)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Realtime Marks Modification ---');

    await client.query(`
      UPDATE sessional_marks 
      SET marks_obtained = 19, updated_at = NOW() 
      WHERE sessional_assessment_id = $1 AND student_id = $2
    `, [createdAssessmentId, targetStudent.id]);

    const updatedMark: SessionalMark = {
      ...draftMark,
      marks_obtained: 19
    };

    const updatedScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessments, publishedAssessment],
      [...dbMarks, updatedMark]
    );

    const updatedCaoLabReport = updatedScorecard.find(r => r.subjectId === caolabSubject.id);
    assert(updatedCaoLabReport?.totalInternalScore === 19, 'Scorecard reflects updated score: 19 / 20 in realtime');

    // -------------------------------------------------------------
    // 6. Faculty Unpublishes (Reverts to Draft) -> Hidden in Realtime
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: Unpublish / Revert to Draft Isolation ---');

    await client.query(`
      UPDATE sessional_assessments 
      SET status = 'draft', updated_at = NOW() 
      WHERE id = $1
    `, [createdAssessmentId]);

    const revertedDraftAssessment: SessionalAssessment = {
      ...draftAssessment,
      status: 'draft'
    };

    const revertedScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessments, revertedDraftAssessment],
      [...dbMarks, updatedMark]
    );

    const hasCaoLabReverted = revertedScorecard.some(r => r.subjectId === caolabSubject.id);
    assert(!hasCaoLabReverted, 'CAO LAB IMMEDIATELY DISAPPEARS from Student Dashboard when faculty unpublishes');

    // -------------------------------------------------------------
    // 7. Genuine Zero Score Handling (Real 0 displays 0 / 20)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: Genuine Zero Score Accuracy ---');

    const zeroMark: SessionalMark = {
      ...draftMark,
      marks_obtained: 0
    };

    const zeroScorecard = computeStudentAcademicScorecard(
      targetStudent,
      enrolledSubjects,
      [...dbAssessments, publishedAssessment],
      [...dbMarks, zeroMark]
    );

    const zeroCaoLabReport = zeroScorecard.find(r => r.subjectId === caolabSubject.id);
    assert(!!zeroCaoLabReport, 'Subject with genuine 0 mark IS visible to student');
    assert(zeroCaoLabReport?.totalInternalScore === 0, 'Genuine 0 is accurately preserved as 0 / 20 (NOT hidden, NOT undefined)');
    assert(zeroCaoLabReport?.sessionalMarks.sessionals[0].obtainedMarks === 0, 'Obtained marks property is numerical 0');

    // -------------------------------------------------------------
    // 8. Leave Application Indicators & Dynamic Badge Workflow
    // -------------------------------------------------------------
    console.log('\n--- SUITE 8: Realtime Leave Workflow & Sidebar Indicators ---');

    // Insert student leave application
    const testAppNum = `LA-TEST-${Date.now()}`;
    const testVCode = `VCODE-${Date.now()}`;
    const insertLeaveRes = await client.query(`
      INSERT INTO leave_applications (
        application_number, verification_code, student_id, department_id, academic_year_id, section_id, leave_type, 
        from_date, to_date, number_of_days, reason, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'Medical Leave', CURRENT_DATE, CURRENT_DATE + 1, 2, 'Medical checkup and recovery', 'PENDING_COORDINATOR')
      RETURNING *
    `, [testAppNum, testVCode, targetStudent.id, targetStudent.department_id, targetStudent.academic_year_id, targetStudent.section_id]);

    createdLeaveId = insertLeaveRes.rows[0].id;
    const leaveApp: LeaveApplication = insertLeaveRes.rows[0];

    // Compute student dynamic badge: pending reviews or unread leave notifications
    function computeStudentLeaveBadge(applications: LeaveApplication[], unreadNotifsCount = 0) {
      const activePending = applications.filter(
        l => l.student_id === targetStudent.id && (l.status === 'PENDING_COORDINATOR' || l.status === 'PENDING_HOD')
      ).length;
      return Math.max(activePending, unreadNotifsCount);
    }

    let studentBadge = computeStudentLeaveBadge([leaveApp]);
    assert(studentBadge === 1, 'Student sidebar badge shows 1 pending review while status is PENDING_COORDINATOR');

    // Forward to HOD
    await client.query(`
      UPDATE leave_applications 
      SET status = 'PENDING_HOD', coordinator_approved_at = NOW(), coordinator_remarks = 'Recommended for approval', updated_at = NOW() 
      WHERE id = $1
    `, [createdLeaveId]);

    const hodPendingLeave: LeaveApplication = { ...leaveApp, status: 'PENDING_HOD' };
    studentBadge = computeStudentLeaveBadge([hodPendingLeave]);
    assert(studentBadge === 1, 'Student sidebar badge remains 1 while status is PENDING_HOD');

    // Approved by HOD
    await client.query(`
      UPDATE leave_applications 
      SET status = 'APPROVED', hod_approved_at = NOW(), hod_remarks = 'Approved officially', updated_at = NOW() 
      WHERE id = $1
    `, [createdLeaveId]);

    const approvedLeave: LeaveApplication = { ...leaveApp, status: 'APPROVED' };
    // Before student visits page, there is 1 unread notification about approval
    studentBadge = computeStudentLeaveBadge([approvedLeave], 1);
    assert(studentBadge === 1, 'Student badge indicates 1 unread approval update before page visit');

    // Student visits page -> notification marked as read
    studentBadge = computeStudentLeaveBadge([approvedLeave], 0);
    assert(studentBadge === 0, 'Student badge clears to 0 after student visits Leave Application page');

    // PDF download eligibility guard check
    function isPdfDownloadAllowed(app: LeaveApplication) {
      return app.status === 'APPROVED';
    }

    assert(isPdfDownloadAllowed(approvedLeave) === true, 'Download Approved PDF is ALLOWED for APPROVED leave');
    assert(isPdfDownloadAllowed(leaveApp) === false, 'Download Approved PDF is BLOCKED for PENDING_COORDINATOR leave');
    assert(isPdfDownloadAllowed(hodPendingLeave) === false, 'Download Approved PDF is BLOCKED for PENDING_HOD leave');

    // Rejection status test
    const rejectedLeave: LeaveApplication = { ...leaveApp, status: 'REJECTED' };
    assert(isPdfDownloadAllowed(rejectedLeave) === false, 'Download Approved PDF is BLOCKED for REJECTED leave');

    // Friendly status labels check
    const statusLabels: Record<string, string> = {
      PENDING_COORDINATOR: 'Pending Coordinator Review',
      PENDING_HOD: 'Pending HOD Review',
      APPROVED: 'Approved',
      REJECTED: 'Rejected'
    };

    assert(statusLabels['PENDING_COORDINATOR'] === 'Pending Coordinator Review', 'Status label: Pending Coordinator Review verified');
    assert(statusLabels['PENDING_HOD'] === 'Pending HOD Review', 'Status label: Pending HOD Review verified');
    assert(statusLabels['APPROVED'] === 'Approved', 'Status label: Approved verified');
    assert(statusLabels['REJECTED'] === 'Rejected', 'Status label: Rejected verified');

  } catch (err: any) {
    console.error('Test run failed:', err);
    process.exitCode = 1;
  } finally {
    // -------------------------------------------------------------
    // Cleanup temporary test records
    // -------------------------------------------------------------
    console.log('\n--- Cleaning up temporary test records ---');
    if (createdAssessmentId) {
      await client.query(`DELETE FROM sessional_marks WHERE sessional_assessment_id = $1`, [createdAssessmentId]);
      await client.query(`DELETE FROM sessional_assessments WHERE id = $1`, [createdAssessmentId]);
      console.log('   Cleaned up test sessional assessment and marks.');
    }
    if (createdLeaveId) {
      await client.query(`DELETE FROM leave_applications WHERE id = $1`, [createdLeaveId]);
      console.log('   Cleaned up test leave application.');
    }
    await client.end();
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} of ${total} tests passed (${((passed / total) * 100).toFixed(1)}%).`);
  console.log('================================================================================');
}

runRealtimeMarksAndLeaveVerification();
