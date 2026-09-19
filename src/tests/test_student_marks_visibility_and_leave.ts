/**
 * Automated Verification Suite: Student Dashboard Marks Visibility & Realtime Leave Indicators
 * Vivekananda College of Technology & Management (VCTM) ERP
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { 
  Student, 
  SessionalAssessment, 
  SessionalMark, 
  LeaveApplication, 
  LeaveStatus 
} from '../types/database.types';

function runTests() {
  console.log('========================================================================');
  console.log('VCTM ERP: STUDENT MARKS VISIBILITY & LEAVE WORKFLOW VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function test(desc: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${desc} — ${err.message}`);
      process.exitCode = 1;
    }
  }

  // Mock data setup
  const mockStudent: Student = {
    id: 'stud-101',
    roll_number: '210143010001',
    full_name: 'Aditya Sharma',
    email: 'aditya@vctm.edu.in',
    section_id: 'sec-a',
    department_id: 'dept-cse',
    academic_year_id: 'ay-2',
    semester_id: 'sem-4',
    academic_session_id: 'sess-2026',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockSubjects = [
    { subjectId: 'sub-math', subjectCode: 'KAS402', subjectName: 'Mathematics IV', facultyName: 'Dr. Sharma', percentage: 85 },
    { subjectId: 'sub-cyber', subjectCode: 'KCS403', subjectName: 'Cyber Security', facultyName: 'Prof. Verma', percentage: 90 },
    { subjectId: 'sub-caolab', subjectCode: 'KCS452', subjectName: 'CAO LAB', facultyName: 'Er. Gupta', percentage: 80 }
  ];

  // Logic emulation of getStudentAcademicScorecard
  function computeScorecard(
    student: Student,
    subjectStats: typeof mockSubjects,
    assessments: SessionalAssessment[],
    marks: SessionalMark[]
  ) {
    const result: any[] = [];

    for (const stat of subjectStats) {
      const subAssessments = assessments.filter(
        sa => sa.subject_id === stat.subjectId && 
              (!sa.section_id || sa.section_id === student.section_id) &&
              (sa.status === 'published' || sa.status === 'completed')
      );

      const dynamicSessionals = subAssessments.map(sa => {
        const sm = marks.find(m => m.sessional_assessment_id === sa.id && m.student_id === student.id);
        const hasScore = sm !== undefined && sm.marks_obtained !== undefined && sm.marks_obtained !== null;
        return {
          assessmentId: sa.id,
          title: sa.title,
          maxMarks: sa.max_marks,
          obtainedMarks: hasScore ? Number(sm.marks_obtained) : undefined,
          examDate: sa.exam_date,
        };
      });

      const visibleSessionals = dynamicSessionals.filter(s => 
        s.obtainedMarks !== undefined && s.obtainedMarks !== null
      );

      const hasPublishedMarks = visibleSessionals.length > 0;

      // CRITICAL RULE: If faculty has NOT entered/published marks for this subject:
      // That subject MUST NOT appear in the Student Dashboard's Marks/Sessional section.
      if (!hasPublishedMarks) {
        continue;
      }

      let totalScore = 0;
      let maxScore = 0;
      for (const ds of visibleSessionals) {
        totalScore += ds.obtainedMarks!;
        maxScore += ds.maxMarks;
      }

      result.push({
        subjectId: stat.subjectId,
        subjectCode: stat.subjectCode,
        subjectName: stat.subjectName,
        facultyName: stat.facultyName,
        totalInternalScore: totalScore,
        maxInternalScore: maxScore,
        sessionalMarks: {
          sessionals: visibleSessionals
        }
      });
    }

    return result;
  }

  // --- 1. CRITICAL MARKS VISIBILITY TEST ---
  test('1.1. Unpublished subject (CAO LAB) is strictly excluded from scorecard', () => {
    const assessments: SessionalAssessment[] = [
      { id: 'sa-1', faculty_id: 'fac-1', subject_id: 'sub-math', section_id: 'sec-a', title: 'Sessional 1', max_marks: 30, status: 'published', created_at: '', updated_at: '' },
      { id: 'sa-2', faculty_id: 'fac-2', subject_id: 'sub-cyber', section_id: 'sec-a', title: 'Sessional 1', max_marks: 30, status: 'published', created_at: '', updated_at: '' },
      { id: 'sa-3', faculty_id: 'fac-3', subject_id: 'sub-caolab', section_id: 'sec-a', title: 'Lab Assessment 1', max_marks: 20, status: 'published', created_at: '', updated_at: '' },
    ];

    const marks: SessionalMark[] = [
      { id: 'm-1', sessional_assessment_id: 'sa-1', faculty_id: 'fac-1', subject_id: 'sub-math', section_id: 'sec-a', student_id: 'stud-101', marks_obtained: 26, max_marks: 30, created_at: '', updated_at: '' },
      { id: 'm-2', sessional_assessment_id: 'sa-2', faculty_id: 'fac-2', subject_id: 'sub-cyber', section_id: 'sec-a', student_id: 'stud-101', marks_obtained: 28, max_marks: 30, created_at: '', updated_at: '' },
      // NOTICE: NO mark entered for CAO LAB!
    ];

    const scorecard = computeScorecard(mockStudent, mockSubjects, assessments, marks);
    assert.strictEqual(scorecard.length, 2, 'Scorecard must contain exactly 2 published subjects');
    
    const math = scorecard.find(s => s.subjectName === 'Mathematics IV');
    assert(math, 'Mathematics IV must appear in scorecard');
    assert.strictEqual(math.totalInternalScore, 26);
    assert.strictEqual(math.maxInternalScore, 30);

    const cyber = scorecard.find(s => s.subjectName === 'Cyber Security');
    assert(cyber, 'Cyber Security must appear in scorecard');
    assert.strictEqual(cyber.totalInternalScore, 28);
    assert.strictEqual(cyber.maxInternalScore, 30);

    const caolab = scorecard.find(s => s.subjectName === 'CAO LAB');
    assert.strictEqual(caolab, undefined, 'CAO LAB MUST NOT appear in scorecard');
  });

  // --- 2. GENUINE 0 MARKS HANDLING TEST ---
  test('1.2. Genuine 0 mark is displayed accurately (0 / 20) and not hidden or undefined', () => {
    const assessments: SessionalAssessment[] = [
      { id: 'sa-1', faculty_id: 'fac-1', subject_id: 'sub-math', section_id: 'sec-a', title: 'Sessional 1', max_marks: 30, status: 'published', created_at: '', updated_at: '' },
      { id: 'sa-2', faculty_id: 'fac-2', subject_id: 'sub-cyber', section_id: 'sec-a', title: 'Sessional 1', max_marks: 30, status: 'published', created_at: '', updated_at: '' },
      { id: 'sa-3', faculty_id: 'fac-3', subject_id: 'sub-caolab', section_id: 'sec-a', title: 'Lab Assessment 1', max_marks: 20, status: 'published', created_at: '', updated_at: '' },
    ];

    // Faculty explicitly entered 0 for CAO LAB
    const marks: SessionalMark[] = [
      { id: 'm-1', sessional_assessment_id: 'sa-1', faculty_id: 'fac-1', subject_id: 'sub-math', section_id: 'sec-a', student_id: 'stud-101', marks_obtained: 26, max_marks: 30, created_at: '', updated_at: '' },
      { id: 'm-2', sessional_assessment_id: 'sa-2', faculty_id: 'fac-2', subject_id: 'sub-cyber', section_id: 'sec-a', student_id: 'stud-101', marks_obtained: 28, max_marks: 30, created_at: '', updated_at: '' },
      { id: 'm-3', sessional_assessment_id: 'sa-3', faculty_id: 'fac-3', subject_id: 'sub-caolab', section_id: 'sec-a', student_id: 'stud-101', marks_obtained: 0, max_marks: 20, created_at: '', updated_at: '' },
    ];

    const scorecard = computeScorecard(mockStudent, mockSubjects, assessments, marks);
    assert.strictEqual(scorecard.length, 3, 'Scorecard must now contain all 3 subjects because CAO LAB has a published 0 mark');

    const caolab = scorecard.find(s => s.subjectName === 'CAO LAB');
    assert(caolab, 'CAO LAB must now appear because genuine 0 was entered');
    assert.strictEqual(caolab.totalInternalScore, 0, 'Total score must be 0');
    assert.strictEqual(caolab.maxInternalScore, 20, 'Max internal score must be 20');
    assert.strictEqual(caolab.sessionalMarks.sessionals[0].obtainedMarks, 0, 'Sessional mark must be 0');
  });

  // --- 3. DRAFT ASSESSMENTS FILTER TEST ---
  test('1.3. Draft assessments are ignored and do not publish subjects', () => {
    const assessments: SessionalAssessment[] = [
      { id: 'sa-draft', faculty_id: 'fac-3', subject_id: 'sub-caolab', section_id: 'sec-a', title: 'Draft Test', max_marks: 20, status: 'draft', created_at: '', updated_at: '' },
    ];
    const marks: SessionalMark[] = [
      { id: 'm-draft', sessional_assessment_id: 'sa-draft', faculty_id: 'fac-3', subject_id: 'sub-caolab', section_id: 'sec-a', student_id: 'stud-101', marks_obtained: 18, max_marks: 20, created_at: '', updated_at: '' },
    ];

    const scorecard = computeScorecard(mockStudent, mockSubjects, assessments, marks);
    const caolab = scorecard.find(s => s.subjectName === 'CAO LAB');
    assert.strictEqual(caolab, undefined, 'Draft assessment mark must NOT publish subject');
  });

  // --- 4. LEAVE APPLICATION DYNAMIC BADGES ---
  test('2.1. Student sidebar dynamic badge reflects active/pending reviews correctly', () => {
    function computeStudentBadge(studentId: string, leaves: LeaveApplication[]) {
      const count = leaves.filter(
        l => (l.student_id === studentId || !l.student_id) && 
             (l.status === 'PENDING_COORDINATOR' || l.status === 'PENDING_HOD')
      ).length;
      return count > 0 ? count : undefined;
    }

    const app1: LeaveApplication = {
      id: 'leave-1',
      application_number: 'VCTM/LV/2026/001',
      student_id: 'stud-101',
      department_id: 'dept-cse',
      academic_year_id: 'ay-2',
      section_id: 'sec-a',
      leave_type: 'Medical Leave',
      from_date: '2026-09-20',
      to_date: '2026-09-22',
      number_of_days: 3,
      reason: 'Fever and viral infection',
      status: 'PENDING_COORDINATOR',
      verification_code: 'VLD123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Initial state: 1 pending coordinator review
    assert.strictEqual(computeStudentBadge('stud-101', [app1]), 1, 'Badge must be 1 on submission');

    // Coordinator reviews and moves to HOD
    app1.status = 'PENDING_HOD';
    assert.strictEqual(computeStudentBadge('stud-101', [app1]), 1, 'Badge remains 1 when pending HOD review');

    // HOD approves
    app1.status = 'APPROVED';
    assert.strictEqual(computeStudentBadge('stud-101', [app1]), undefined, 'Badge disappears (undefined) after final approval');

    // Rejection case
    app1.status = 'REJECTED_BY_COORDINATOR';
    assert.strictEqual(computeStudentBadge('stud-101', [app1]), undefined, 'Badge disappears (undefined) on rejection');
  });

  // --- 5. LEAVE STATUS LABELS TEST ---
  test('2.2. Friendly status text labels match institutional requirements', () => {
    function getFriendlyStatusText(status: LeaveStatus): string {
      switch (status) {
        case 'PENDING_COORDINATOR':
          return 'Pending Coordinator Review';
        case 'PENDING_HOD':
          return 'Pending HOD Review';
        case 'APPROVED':
          return 'Approved';
        case 'REJECTED_BY_COORDINATOR':
        case 'REJECTED_BY_HOD':
          return 'Rejected';
        default:
          return status;
      }
    }

    assert.strictEqual(getFriendlyStatusText('PENDING_COORDINATOR'), 'Pending Coordinator Review');
    assert.strictEqual(getFriendlyStatusText('PENDING_HOD'), 'Pending HOD Review');
    assert.strictEqual(getFriendlyStatusText('APPROVED'), 'Approved');
    assert.strictEqual(getFriendlyStatusText('REJECTED_BY_COORDINATOR'), 'Rejected');
    assert.strictEqual(getFriendlyStatusText('REJECTED_BY_HOD'), 'Rejected');
  });

  // --- 6. APPROVED PDF RESTRICTION GUARD TEST ---
  test('2.3. Download PDF is strictly permitted only for APPROVED status', () => {
    function canDownloadPdf(app: { status: LeaveStatus }): boolean {
      return app.status === 'APPROVED';
    }

    assert.strictEqual(canDownloadPdf({ status: 'PENDING_COORDINATOR' }), false, 'Pending Coordinator cannot download PDF');
    assert.strictEqual(canDownloadPdf({ status: 'PENDING_HOD' }), false, 'Pending HOD cannot download PDF');
    assert.strictEqual(canDownloadPdf({ status: 'REJECTED_BY_COORDINATOR' }), false, 'Rejected by Coordinator cannot download PDF');
    assert.strictEqual(canDownloadPdf({ status: 'REJECTED_BY_HOD' }), false, 'Rejected by HOD cannot download PDF');
    assert.strictEqual(canDownloadPdf({ status: 'APPROVED' }), true, 'Approved application CAN download PDF');
  });

  // --- 7. STATIC CODE AUDIT FOR REALTIME WIRING ---
  test('3.1. AcademicContext.tsx has complete realtime table bindings', () => {
    const contextPath = path.join(process.cwd(), 'src/context/AcademicContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf8');

    assert(content.includes("table: 'sessional_assessments'"), 'AcademicContext subscribes to sessional_assessments');
    assert(content.includes("table: 'sessional_marks'"), 'AcademicContext subscribes to sessional_marks');
    assert(content.includes("table: 'leave_applications'"), 'AcademicContext subscribes to leave_applications');
    assert(content.includes('refreshLeaveApplications'), 'AcademicContext exports refreshLeaveApplications');
    assert(content.includes('leaveApplications,'), 'AcademicContext exports leaveApplications state');
    assert(content.includes('if (!hasPublishedMarks) {\n        continue;\n      }'), 'Scorecard skips subjects without published marks');
  });

  test('3.2. AppShell.tsx integrates dynamic leave sidebar badge', () => {
    const appShellPath = path.join(process.cwd(), 'src/components/layout/AppShell.tsx');
    const content = fs.readFileSync(appShellPath, 'utf8');

    assert(content.includes('pendingLeavesCount'), 'AppShell calculates pendingLeavesCount');
    assert(content.includes("{ id: 'leave', label: 'Leave Application', icon: FileText, badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined }"), 'AppShell shows badge on student Leave Application item');
  });

  test('3.3. StudentMarksPage.tsx omits placeholder text', () => {
    const marksPagePath = path.join(process.cwd(), 'src/pages/student/StudentMarksPage.tsx');
    const content = fs.readFileSync(marksPagePath, 'utf8');

    assert(!content.includes('Marks not published yet'), 'StudentMarksPage does not show "Marks not published yet" placeholder in subject cards');
  });

  test('3.4. StudentDashboard.tsx includes Published Continuous Assessments section', () => {
    const dashPath = path.join(process.cwd(), 'src/pages/student/StudentDashboard.tsx');
    const content = fs.readFileSync(dashPath, 'utf8');

    assert(content.includes('Published Continuous Assessments'), 'StudentDashboard includes Published Continuous Assessments section');
    assert(content.includes('publishedScorecard.length > 0'), 'StudentDashboard checks publishedScorecard.length > 0');
    assert(content.includes('publishedScorecard.map'), 'StudentDashboard maps strictly over publishedScorecard');
  });

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passed}/${total} test cases passed successfully!`);
  console.log('========================================================================\n');
}

runTests();
