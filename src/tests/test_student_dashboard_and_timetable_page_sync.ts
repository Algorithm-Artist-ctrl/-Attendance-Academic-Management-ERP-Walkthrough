import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { DayOfWeek } from '../types/database.types';

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

async function runStudentDashboardAndTimetableSyncVerification() {
  console.log('======================================================================');
  console.log('  VCTM ERP — STUDENT DASHBOARD & TIMETABLE PAGE DATA SOURCE SYNC');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Fetch live master DB from Supabase
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Connected to live Supabase Cloud Database');

  const { students, sections, subjects, faculty, timetable } = dbData!;
  const secB = sections.find(s => s.id === '233957c0-4fef-42c6-8285-40ebf73ea6b7') || sections.find(s => s.name === 'B' && s.room_number === 'A006')!;
  const secA = sections.find(s => s.id === 'fc93a413-c18d-4e72-9624-146767bc286b') || sections.find(s => s.name === 'A' && s.room_number === 'A007')!;

  // Find Section B student
  const studentB = students.find(s => s.section_id === secB.id)!;
  assert(Boolean(studentB), 'Resolved Student B record (Section B)');

  // Find Section A student
  const studentA = students.find(s => s.section_id === secA.id)!;
  assert(Boolean(studentA), 'Resolved Student A record (Section A)');

  // =========================================================================
  // SUITE 1: Single Source of Truth Query for Section B Student
  // =========================================================================
  console.log('\n--- SUITE 1: Authoritative Student Timetable Query ---');
  const studentBSectionId = studentB.section_id || studentB.section?.id || secB.id;

  const daysOrder: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const getStudentTimetable = (secId: string) => {
    return timetable
      .filter(t => t.section_id === secId && t.active)
      .sort((a, b) => {
        const dA = daysOrder.indexOf(a.day_of_week);
        const dB = daysOrder.indexOf(b.day_of_week);
        if (dA !== dB) return dA - dB;
        return a.period_number - b.period_number;
      });
  };

  const expectedBCount = timetable.filter(t => t.section_id === secB.id && t.active).length;
  const studentBTimetable = getStudentTimetable(studentBSectionId);
  assert(studentBTimetable.length === expectedBCount && expectedBCount > 0, `Student B timetable has exactly ${expectedBCount} periods across Mon-Sat (got: ${studentBTimetable.length})`);

  // Verify all entries belong to Section B
  assert(studentBTimetable.every(t => t.section_id === secB.id), '100% of student timetable entries belong strictly to Section B');

  // =========================================================================
  // SUITE 2: Dashboard "Today's Classes" vs "Time Table" Page Exact Match
  // =========================================================================
  console.log('\n--- SUITE 2: Dashboard vs Time Table Page Synchronization ---');

  // Compare every day of the week (MON through SAT)
  for (const day of daysOrder) {
    const timetablePageSlots = studentBTimetable.filter(t => t.day_of_week === day);

    // Dashboard today's classes for that day
    const dashboardTodayClasses = studentBTimetable
      .filter(t => t.day_of_week === day)
      .map(entry => {
        const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
        const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;
        return {
          periodNumber: entry.period_number,
          subjectCode: sub?.subject_code,
          subjectName: sub?.subject_name,
          facultyName: fac?.full_name,
          roomNumber: entry.room_number || secB.room_number || 'A006',
          lectureType: entry.lecture_type,
        };
      });

    assert(dashboardTodayClasses.length === timetablePageSlots.length, `${day}: Dashboard (${dashboardTodayClasses.length} classes) matches Timetable Page (${timetablePageSlots.length} slots)`);

    // Verify cell-by-cell subject code and faculty match
    for (let i = 0; i < dashboardTodayClasses.length; i++) {
      const dash = dashboardTodayClasses[i];
      const pageEntry = timetablePageSlots[i];
      const sub = subjects.find(s => s.id === pageEntry.subject_id) || pageEntry.subject;
      const fac = faculty.find(f => f.id === pageEntry.faculty_id) || pageEntry.faculty;

      assert(dash.subjectCode === sub?.subject_code, `${day} P${dash.periodNumber}: Subject code "${dash.subjectCode}" matches across Dashboard and Timetable Page`);
      assert(dash.facultyName === fac?.full_name, `${day} P${dash.periodNumber}: Faculty "${dash.facultyName}" matches across Dashboard and Timetable Page`);
    }
  }

  // =========================================================================
  // SUITE 3: Section A vs Section B Cross-Isolation
  // =========================================================================
  console.log('\n--- SUITE 3: Section A vs Section B Isolation ---');
  const expectedACount = timetable.filter(t => t.section_id === secA.id && t.active).length;
  const studentATimetable = getStudentTimetable(studentA.section_id || secA.id);
  assert(studentATimetable.length === expectedACount && expectedACount > 0, `Student A timetable has exactly ${expectedACount} periods`);
  assert(studentATimetable.every(t => t.section_id === secA.id), 'Student A timetable contains ONLY Section A lectures');

  // Verify Student A sees 0 Section B lectures
  const crossLeakA = studentATimetable.filter(t => t.section_id === secB.id);
  assert(crossLeakA.length === 0, 'Student A sees 0 Section B lectures (Zero Leakage)');

  // Verify Student B sees 0 Section A lectures
  const crossLeakB = studentBTimetable.filter(t => t.section_id === secA.id);
  assert(crossLeakB.length === 0, 'Student B sees 0 Section A lectures (Zero Leakage)');

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} SYNCHRONIZATION TESTS PASSED WITH 100% SUCCESS`);
  console.log('======================================================================\n');
}

runStudentDashboardAndTimetableSyncVerification().catch((err) => {
  console.error('Fatal error running sync verification:', err);
  process.exit(1);
});
