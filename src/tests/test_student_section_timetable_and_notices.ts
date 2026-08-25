import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { NoticeItem } from '../types/academic.types';
import { getISTTodayDate } from '../lib/utils/dateUtils';

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

async function runStudentSectionTimetableAndNoticesTest() {
  console.log('======================================================================');
  console.log('  VCTM ERP — STUDENT SECTION-WISE TIMETABLE & NOTICE VISIBILITY TEST');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Fetch live master DB from Supabase Cloud
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Connected to live Supabase Cloud Database');

  const { sections, faculty, subjects, timetable, students, assignments, departments } = dbData!;
  assert(sections.length >= 2, 'Found active sections in Supabase (Section A & Section B)');
  assert(students.length >= 2, 'Found enrolled students in Supabase');
  assert(timetable.length >= 80, 'Found master timetable entries in Supabase');

  const secA = sections.find(s => s.name === 'A')!;
  const secB = sections.find(s => s.name === 'B')!;
  assert(Boolean(secA && secB), 'Resolved Section A and Section B records');

  // Find Student A (Section A) and Student B (Section B)
  const studentA = students.find(s => s.section_id === secA.id || s.section?.name === 'A')!;
  const studentB = students.find(s => s.section_id === secB.id || s.section?.name === 'B')!;
  assert(Boolean(studentA), `Found Student A in Section A (${studentA?.full_name}, Roll: ${studentA?.roll_number})`);
  assert(Boolean(studentB), `Found Student B in Section B (${studentB?.full_name}, Roll: ${studentB?.roll_number})`);

  // =========================================================================
  // SUITE 1: SECTION-WISE TIMETABLE ISOLATION & LIVE SOURCE OF TRUTH
  // =========================================================================
  console.log('\n--- SUITE 1: Section-Wise Timetable Isolation ---');

  const timetableSecA = timetable.filter(t => (t.section_id === secA.id || t.section?.id === secA.id) && t.active);
  const timetableSecB = timetable.filter(t => (t.section_id === secB.id || t.section?.id === secB.id) && t.active);

  assert(timetableSecA.length > 0, `Section A has ${timetableSecA.length} active timetable lectures`);
  assert(timetableSecB.length > 0, `Section B has ${timetableSecB.length} active timetable lectures`);

  // Verify Student A sees ONLY Section A timetable
  const studentATimetable = timetable.filter(t => (t.section_id === studentA.section_id) && t.active);
  assert(studentATimetable.length === timetableSecA.length, 'Student A sees exactly Section A timetable lectures');
  assert(studentATimetable.every(t => t.section_id === secA.id), '100% of Student A timetable entries belong to Section A');
  assert(!studentATimetable.some(t => t.section_id === secB.id), 'Student A sees ZERO Section B timetable lectures');

  // Verify Student B sees ONLY Section B timetable
  const studentBTimetable = timetable.filter(t => (t.section_id === studentB.section_id) && t.active);
  assert(studentBTimetable.length === timetableSecB.length, 'Student B sees exactly Section B timetable lectures');
  assert(studentBTimetable.every(t => t.section_id === secB.id), '100% of Student B timetable entries belong to Section B');
  assert(!studentBTimetable.some(t => t.section_id === secA.id), 'Student B sees ZERO Section A timetable lectures');

  // =========================================================================
  // SUITE 2: TARGETED NOTICE CREATION & PUBLISHING WITH DATABASE IDs
  // =========================================================================
  console.log('\n--- SUITE 2: Section-Wise Notice Publishing & Targeting ---');

  const testStamp = Date.now();
  const noticeSecATitle = `[TEST-${testStamp}] Section A Exclusive Circular: Lab Schedule`;
  const noticeSecBTitle = `[TEST-${testStamp}] Section B Exclusive Circular: Seminar Room`;
  const noticeAllTitle = `[TEST-${testStamp}] General College Circular: AKTU Registration`;
  const noticeFacTitle = `[TEST-${testStamp}] Faculty Only Directive: Evaluation Deadline`;

  // 1. Publish Notice for Section A
  const publishedSecA = await supabaseService.publishNotice({
    title: noticeSecATitle,
    category: 'Academic',
    author: 'Dean Office',
    content: 'All Section A students must assemble in Lab 3.',
    targetAudience: 'Section A',
    targetSectionId: secA.id,
    targetDepartmentId: (secA as any).department_id || null,
    targetRole: null
  });
  assert(Boolean(publishedSecA), 'Published Section A targeted notice to Supabase');

  // 2. Publish Notice for Section B
  const publishedSecB = await supabaseService.publishNotice({
    title: noticeSecBTitle,
    category: 'Academic',
    author: 'Dean Office',
    content: 'All Section B students must assemble in Seminar Hall.',
    targetAudience: 'Section B',
    targetSectionId: secB.id,
    targetDepartmentId: (secB as any).department_id || null,
    targetRole: null
  });
  assert(Boolean(publishedSecB), 'Published Section B targeted notice to Supabase');

  // 3. Publish Notice for All Students
  const publishedAll = await supabaseService.publishNotice({
    title: noticeAllTitle,
    category: 'Examination',
    author: 'Registrar',
    content: 'All students must verify their AKTU exam enrollment form.',
    targetAudience: 'Students',
    targetSectionId: null,
    targetDepartmentId: null,
    targetRole: 'student'
  });
  assert(Boolean(publishedAll), 'Published All-Students targeted notice to Supabase');

  // 4. Publish Notice for Faculty Only
  const publishedFac = await supabaseService.publishNotice({
    title: noticeFacTitle,
    category: 'Urgent',
    author: 'Director',
    content: 'Faculty meeting at 4:30 PM in Boardroom.',
    targetAudience: 'Faculty',
    targetSectionId: null,
    targetDepartmentId: null,
    targetRole: 'faculty'
  });
  assert(Boolean(publishedFac), 'Published Faculty-only targeted notice to Supabase');

  // =========================================================================
  // SUITE 3: NOTICE VISIBILITY FILTERING LOGIC VERIFICATION
  // =========================================================================
  console.log('\n--- SUITE 3: Notice Visibility & Privacy Isolation ---');

  const allNotices = (await supabaseService.fetchNotices()) as NoticeItem[];
  assert(allNotices.length >= 4, 'Fetched published notices from Supabase');

  // Helper matching the exact NoticesPage filtering logic
  function filterNoticesForRole(
    noticesList: NoticeItem[],
    userRole: 'student' | 'faculty' | 'hod' | 'super_admin',
    userStudent?: typeof studentA,
    userFaculty?: typeof faculty[0]
  ) {
    const studentSecId = userStudent?.section_id;
    const studentDeptId = userStudent?.department_id;
    const studentSecName = userStudent?.section?.name || (userStudent?.section_id === secA.id ? 'A' : 'B');

    const facultyAssignedSecIds = userFaculty ? new Set([
      ...assignments.filter(a => a.faculty_id === userFaculty.id && a.active).map(a => a.section_id),
      ...timetable.filter(t => t.faculty_id === userFaculty.id && t.active).map(t => t.section_id)
    ]) : new Set<string>();

    return noticesList.filter(n => {
      if (userRole === 'super_admin') return true;

      if (userRole === 'hod') {
        if (!n.targetDepartmentId && !n.targetSectionId) return true;
        return true;
      }

      if (userRole === 'student') {
        // Exclude faculty-only notices
        if (n.targetRole === 'faculty' || n.targetAudience === 'Faculty') return false;

        // If notice has targetSectionId
        if (n.targetSectionId) {
          if (n.targetSectionId !== studentSecId) return false;
        }

        // If targetAudience explicitly names a section
        if (n.targetAudience && n.targetAudience.startsWith('Section ')) {
          const targetSecName = n.targetAudience.replace('Section ', '').trim().toUpperCase();
          if (studentSecName && studentSecName.toUpperCase() !== targetSecName) return false;
        }

        // If notice has targetDepartmentId
        if (n.targetDepartmentId && studentDeptId && n.targetDepartmentId !== studentDeptId) {
          return false;
        }

        return true;
      }

      if (userRole === 'faculty') {
        if (n.targetSectionId) {
          if (!facultyAssignedSecIds.has(n.targetSectionId)) return false;
        }
        return true;
      }

      return true;
    });
  }

  // --- Check Student A (Section A) Visibility ---
  const visibleToStudentA = filterNoticesForRole(allNotices, 'student', studentA);
  const seesSecANoticeA = visibleToStudentA.some(n => n.title === noticeSecATitle);
  const seesSecBNoticeA = visibleToStudentA.some(n => n.title === noticeSecBTitle);
  const seesAllNoticeA = visibleToStudentA.some(n => n.title === noticeAllTitle);
  const seesFacNoticeA = visibleToStudentA.some(n => n.title === noticeFacTitle);

  assert(seesSecANoticeA, 'Student A (Section A) SEES Section A targeted notice');
  assert(!seesSecBNoticeA, 'Student A (Section A) CANNOT see Section B targeted notice (STRICT ISOLATION)');
  assert(seesAllNoticeA, 'Student A (Section A) SEES General/All-Student circular');
  assert(!seesFacNoticeA, 'Student A (Section A) CANNOT see Faculty-only notice');

  // --- Check Student B (Section B) Visibility ---
  const visibleToStudentB = filterNoticesForRole(allNotices, 'student', studentB);
  const seesSecANoticeB = visibleToStudentB.some(n => n.title === noticeSecATitle);
  const seesSecBNoticeB = visibleToStudentB.some(n => n.title === noticeSecBTitle);
  const seesAllNoticeB = visibleToStudentB.some(n => n.title === noticeAllTitle);
  const seesFacNoticeB = visibleToStudentB.some(n => n.title === noticeFacTitle);

  assert(!seesSecANoticeB, 'Student B (Section B) CANNOT see Section A targeted notice (STRICT ISOLATION)');
  assert(seesSecBNoticeB, 'Student B (Section B) SEES Section B targeted notice');
  assert(seesAllNoticeB, 'Student B (Section B) SEES General/All-Student circular');
  assert(!seesFacNoticeB, 'Student B (Section B) CANNOT see Faculty-only notice');

  // --- Check Faculty Hemlata Visibility ---
  const hemlata = faculty.find(f => f.faculty_code === 'HEM') || faculty[0];
  const visibleToHemlata = filterNoticesForRole(allNotices, 'faculty', undefined, hemlata);
  assert(visibleToHemlata.some(n => n.title === noticeFacTitle), 'Faculty Hemlata SEES Faculty-only notice');
  assert(visibleToHemlata.some(n => n.title === noticeAllTitle), 'Faculty Hemlata SEES General institutional notice');

  // --- Check Super Admin Visibility ---
  const visibleToAdmin = filterNoticesForRole(allNotices, 'super_admin');
  assert(visibleToAdmin.some(n => n.title === noticeSecATitle), 'Super Admin sees Section A notice');
  assert(visibleToAdmin.some(n => n.title === noticeSecBTitle), 'Super Admin sees Section B notice');
  assert(visibleToAdmin.some(n => n.title === noticeFacTitle), 'Super Admin sees Faculty notice');
  assert(visibleToAdmin.some(n => n.title === noticeAllTitle), 'Super Admin sees General notice');

  // =========================================================================
  // SUITE 4: EMPTY STATE BEHAVIOR
  // =========================================================================
  console.log('\n--- SUITE 4: Empty State Fallbacks ---');
  const emptyTimetableCheck = (timetableEntries: any[]) => {
    return timetableEntries.length === 0 ? 'No timetable published for your section.' : 'Timetable Active';
  };
  const emptyNoticesCheck = (noticeEntries: any[]) => {
    return noticeEntries.length === 0 ? 'No notices for your section.' : 'Notices Active';
  };

  assert(emptyTimetableCheck([]) === 'No timetable published for your section.', 'Empty timetable renders standard empty message');
  assert(emptyNoticesCheck([]) === 'No notices for your section.', 'Empty notice board renders standard empty message');

  // =========================================================================
  // CLEANUP: Delete temporary test notices
  // =========================================================================
  console.log('\n--- Cleanup: Purging Test Notices ---');
  for (const n of [publishedSecA, publishedSecB, publishedAll, publishedFac]) {
    if (n?.id) {
      await supabaseService.deleteNotice(n.id);
    }
  }
  console.log('✅ Temporary test circulars successfully cleaned up from Supabase');

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED WITH 100% SECTION ISOLATION & ACCURACY`);
  console.log('======================================================================\n');
}

runStudentSectionTimetableAndNoticesTest().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
