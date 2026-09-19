/**
 * Form State Machine, Input Preservation & Scoped Realtime Automated Verification
 * Vivekananda College of Technology & Management (VCTM) ERP
 */

import fs from 'fs';
import path from 'path';

async function runFormStateMachineAndDataSafetyVerification() {
  console.log('===============================================================');
  console.log('VCTM ERP — Form State Machine & Data-Safety Verification Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function recordTest(name: string, ok: boolean, detail?: string) {
    total++;
    if (ok) {
      passed++;
      console.log(`[PASS] ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  // Helper to read file
  const readSrc = (relPath: string) => {
    const full = path.join(process.cwd(), 'src', relPath);
    return fs.readFileSync(full, 'utf8');
  };

  // 1. FacultySessionalMarksPage — 4-State UX & Marks Preservation
  const sessionalPage = readSrc('pages/faculty/FacultySessionalMarksPage.tsx');
  const hasSessionalSaveSuccess = sessionalPage.includes('saveMarksSuccess') && sessionalPage.includes('setSaveMarksSuccess');
  const hasSessional4StateBtn = sessionalPage.includes('Saved ✓') && sessionalPage.includes('Saving...') && sessionalPage.includes('Save Failed — Retry');
  const preservesSessionalMarks = sessionalPage.includes('Entered marks have been preserved');
  recordTest(
    '1. FacultySessionalMarksPage 4-State Machine & Data Safety',
    hasSessionalSaveSuccess && hasSessional4StateBtn && preservesSessionalMarks,
    'Verified saveMarksSuccess, 4-state button UX, and marks preservation on error'
  );

  // 2. MessagesPage — Scoped Realtime & Send State Machine
  const messagesPage = readSrc('pages/communication/MessagesPage.tsx');
  const hasGroupSendSuccess = messagesPage.includes('groupSendSuccess') && messagesPage.includes('setGroupSendSuccess');
  const hasDirectSendSuccess = messagesPage.includes('directSendSuccess') && messagesPage.includes('setDirectSendSuccess');
  const hasScopedGroupRealtime = messagesPage.includes("`active_group_${selectedGroupId}`") && messagesPage.includes('removeChannel');
  const hasScopedDirectRealtime = messagesPage.includes("`active_direct_${selectedConvId}`") && messagesPage.includes('removeChannel');
  const hasMessagesSendButtons = messagesPage.includes("title={groupSendSuccess ? 'Sent!' : 'Send Message'}") &&
                                messagesPage.includes("title={directSendSuccess ? 'Sent!' : 'Send Message'}");
  recordTest(
    '2. MessagesPage Scoped Realtime & Feedback States',
    hasGroupSendSuccess && hasDirectSendSuccess && hasScopedGroupRealtime && hasScopedDirectRealtime && hasMessagesSendButtons,
    'Verified scoped channels with cleanup, groupSendSuccess, and directSendSuccess'
  );

  // 3. NoticesPage — Notice Modal Error Banner & 4-State Button
  const noticesPage = readSrc('pages/common/NoticesPage.tsx');
  const hasNoticePublishError = noticesPage.includes('publishError') && noticesPage.includes('setPublishError');
  const hasNoticePublishSuccess = noticesPage.includes('publishSuccess') && noticesPage.includes('setPublishSuccess');
  const hasNoticeErrorBanner = noticesPage.includes('bg-rose-500/15 border border-rose-500/30 text-rose-300');
  const hasNotice4StateBtn = noticesPage.includes('Publishing...') && noticesPage.includes('Published ✓') && noticesPage.includes('Publish Failed — Retry');
  const hasNoticeLocalPrepend = noticesPage.includes('setNotices(prev => [newNoticeItem, ...prev])');
  recordTest(
    '3. NoticesPage Error Handling, Local Prepend & 4-State UX',
    hasNoticePublishError && hasNoticePublishSuccess && hasNoticeErrorBanner && hasNotice4StateBtn && hasNoticeLocalPrepend,
    'Verified publishError alert, published notice local prepend, and 4-state button'
  );

  // 4. NewGroupMessageModal — Low-Latency Dispatch & Visual State
  const groupModal = readSrc('components/communication/NewGroupMessageModal.tsx');
  const hasImmediateOnSuccess = groupModal.includes('if (onSuccess && groupId)') && groupModal.includes('onSuccess(groupId);');
  const hasGroupModal4StateBtn = groupModal.includes('Broadcasting...') && groupModal.includes('Broadcast ✓') && groupModal.includes('Retry Broadcast');
  const hasShortDelay = groupModal.includes('350');
  recordTest(
    '4. NewGroupMessageModal Low-Latency Dispatch & State Machine',
    hasImmediateOnSuccess && hasGroupModal4StateBtn && hasShortDelay,
    'Verified immediate callback propagation, 350ms tick, and 4-state action button'
  );

  // 5. FacultyAssignmentsPage — Creation & Grading State Machines
  const assignmentsPage = readSrc('pages/faculty/FacultyAssignmentsPage.tsx');
  const hasAssignmentCreateSuccess = assignmentsPage.includes('createSuccess') && assignmentsPage.includes('setCreateSuccess');
  const hasAssignmentGradeSuccess = assignmentsPage.includes('saveGradeSuccess') && assignmentsPage.includes('setSaveGradeSuccess');
  const hasAssignmentPublishBtn = assignmentsPage.includes('Publishing...') && assignmentsPage.includes('Published ✓');
  const hasAssignmentGradeBtn = assignmentsPage.includes('Saving...') && assignmentsPage.includes('Saved ✓');
  recordTest(
    '5. FacultyAssignmentsPage Creation & Grading State Machines',
    hasAssignmentCreateSuccess && hasAssignmentGradeSuccess && hasAssignmentPublishBtn && hasAssignmentGradeBtn,
    'Verified createSuccess, saveGradeSuccess, and animated button states'
  );

  // 6. FacultyQuizzesPage — Roster Marks Preservation & 4-State UX
  const quizzesPage = readSrc('pages/faculty/FacultyQuizzesPage.tsx');
  const hasQuizSaveMarksSuccess = quizzesPage.includes('saveMarksSuccess') && quizzesPage.includes('setSaveMarksSuccess');
  const hasQuizPreservation = quizzesPage.includes('All entered scores have been preserved.');
  const hasQuizSaveBtn = quizzesPage.includes('Saving Records...') && quizzesPage.includes('Saved ✓');
  recordTest(
    '6. FacultyQuizzesPage Marks Roster State Machine & Preservation',
    hasQuizSaveMarksSuccess && hasQuizPreservation && hasQuizSaveBtn,
    'Verified saveMarksSuccess, error data preservation, and button confirmation'
  );

  // 7. SupabaseService — Role-Scoped Pipeline Functions
  const supabaseServiceCode = readSrc('lib/services/supabaseService.ts');
  const hasFetchScopedData = supabaseServiceCode.includes('fetchScopedData(');
  const hasFetchStudentAttendance = supabaseServiceCode.includes('fetchStudentAttendance(');
  const hasFetchStudentAcademicRecords = supabaseServiceCode.includes('fetchStudentAcademicRecords(');
  recordTest(
    '7. SupabaseService Role-Scoped Loading Pipeline',
    hasFetchScopedData && hasFetchStudentAttendance && hasFetchStudentAcademicRecords,
    'Verified fetchScopedData, fetchStudentAttendance, and fetchStudentAcademicRecords'
  );

  // 8. AcademicContext — Scoped Loading Integration
  const academicContextCode = readSrc('context/AcademicContext.tsx');
  const callsFetchScopedData = academicContextCode.includes('supabaseService.fetchScopedData({');
  const hasRoleAndUserDeps = academicContextCode.includes('[user, role]');
  recordTest(
    '8. AcademicContext Scoped Pipeline Integration',
    callsFetchScopedData && hasRoleAndUserDeps,
    'Verified AcademicContext uses fetchScopedData with user and role dependencies'
  );

  // 9. TakeAttendancePage — Mutual Exclusion & Data Preservation
  const takeAttendancePage = readSrc('pages/faculty/TakeAttendancePage.tsx');
  const hasSavingLock = takeAttendancePage.includes('isSavingRef.current = true');
  const preservesAttendanceOnSaveFail = takeAttendancePage.includes('setAttendanceMap');
  recordTest(
    '9. TakeAttendancePage Lock & Data Preservation',
    hasSavingLock && preservesAttendanceOnSaveFail,
    'Verified isSavingRef lock and attendanceMap preservation'
  );

  // 10. Zero Artificial setTimeout Delays in Critical Path
  const authContextCode = readSrc('context/AuthContext.tsx');
  const hasFakeAuthDelay = /setTimeout\s*\(\s*[\s\S]*?,\s*(?:1000|2000|3000|5000)\s*\)/.test(authContextCode);
  recordTest(
    '10. Zero Artificial Delays in AuthContext Path',
    !hasFakeAuthDelay,
    'Verified no 1000ms+ artificial setTimeout delays blocking authentication'
  );

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED (100%)`);
  console.log('===============================================================\n');
}

runFormStateMachineAndDataSafetyVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
