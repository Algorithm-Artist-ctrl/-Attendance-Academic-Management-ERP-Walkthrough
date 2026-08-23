import { supabaseService } from '../lib/services/supabaseService';
import { erpStorage } from '../lib/storage/erpStorage';
import { getISTTodayDate, getISTDayOfWeek, formatDateDisplay } from '../lib/utils/dateUtils';
import { DayOfWeek } from '../types/database.types';

// Mock localStorage in Node.js environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runMultiDayTests() {
  console.log('======================================================================');
  console.log('    VCTM ERP MULTI-DAY & TIMEZONE SCHEDULE VERIFICATION SUITE       ');
  console.log('======================================================================\n');

  // 1. Test Date & Timezone Resolver Across All 7 Days
  console.log('--- TEST GROUP 1: IST Date & Day-of-Week Engine ---');
  const dateDayMap: Record<string, DayOfWeek> = {
    '2026-08-23': 'SUN',
    '2026-08-24': 'MON',
    '2026-08-25': 'TUE',
    '2026-08-26': 'WED',
    '2026-08-27': 'THU',
    '2026-08-28': 'FRI',
    '2026-08-29': 'SAT',
    '2026-08-30': 'SUN',
  };

  for (const [dateStr, expectedDay] of Object.entries(dateDayMap)) {
    const computedDay = getISTDayOfWeek(dateStr);
    assert(
      computedDay === expectedDay,
      `Date ${dateStr} correctly maps to ${expectedDay} (got: ${computedDay})`
    );
  }

  // 2. Fetch Master Data from Supabase/Storage
  console.log('\n--- TEST GROUP 2: Timetable & Master Data Isolation ---');
  const db = await supabaseService.fetchAllData();
  assert(Boolean(db), 'Database loaded successfully from Supabase Cloud');

  const secA = db!.sections.find(s => s.name === 'A')!;
  const secB = db!.sections.find(s => s.name === 'B')!;
  const studA = db!.students.find(s => s.section_id === secA.id)!;
  const studB = db!.students.find(s => s.section_id === secB.id)!;
  const facultyHemlata = db!.faculty.find(f => f.full_name.includes('Hemlata'))!;

  assert(Boolean(studA), 'Section A student loaded');
  assert(Boolean(studB), 'Section B student loaded');
  assert(Boolean(facultyHemlata), 'Faculty Ms. Hemlata loaded');

  // 3. Test Sunday (2026-08-23) Schedule Invariant
  console.log('\n--- TEST GROUP 3: Sunday 0-Classes Invariant ---');
  const sundayA = db!.timetable.filter(t => t.section_id === secA.id && t.day_of_week === 'SUN');
  const sundayB = db!.timetable.filter(t => t.section_id === secB.id && t.day_of_week === 'SUN');
  const sundayFac = db!.timetable.filter(t => t.faculty_id === facultyHemlata.id && t.day_of_week === 'SUN');

  assert(sundayA.length === 0, 'Section A has exactly 0 classes on Sunday');
  assert(sundayB.length === 0, 'Section B has exactly 0 classes on Sunday');
  assert(sundayFac.length === 0, 'Faculty Ms. Hemlata has exactly 0 classes on Sunday');

  // 4. Test Monday (2026-08-24) Schedule Fidelity
  console.log('\n--- TEST GROUP 4: Monday Schedule Fidelity ---');
  const mondayA = db!.timetable.filter(t => t.section_id === secA.id && t.day_of_week === 'MON');
  const mondayB = db!.timetable.filter(t => t.section_id === secB.id && t.day_of_week === 'MON');
  const mondayFac = db!.timetable.filter(t => t.faculty_id === facultyHemlata.id && t.day_of_week === 'MON');

  assert(mondayA.length === 7, `Section A has exactly 7 Monday lectures (got: ${mondayA.length})`);
  assert(mondayB.length === 7, `Section B has exactly 7 Monday lectures (got: ${mondayB.length})`);
  assert(mondayFac.length > 0, `Faculty Ms. Hemlata has ${mondayFac.length} Monday lectures`);

  // Verify Monday periods are 1, 2, 3, 4, 6, 7, 8
  const expectedPeriods = [1, 2, 3, 4, 6, 7, 8];
  const actualPeriodsA = mondayA.map(t => t.period_number).sort((a, b) => a - b);
  assert(
    JSON.stringify(actualPeriodsA) === JSON.stringify(expectedPeriods),
    `Section A Monday periods are correctly 1,2,3,4,6,7,8 (got: ${actualPeriodsA.join(',')})`
  );

  // 5. Test Tuesday through Saturday Day Independence
  console.log('\n--- TEST GROUP 5: Tuesday through Saturday Schedule Integrity ---');
  const weekdays: DayOfWeek[] = ['TUE', 'WED', 'THU', 'FRI', 'SAT'];
  for (const day of weekdays) {
    const daySlotsA = db!.timetable.filter(t => t.section_id === secA.id && t.day_of_week === day);
    const daySlotsB = db!.timetable.filter(t => t.section_id === secB.id && t.day_of_week === day);
    assert(daySlotsA.length === 7, `Section A has 7 lectures on ${day}`);
    assert(daySlotsB.length === 7, `Section B has 7 lectures on ${day}`);
  }

  // 6. Test Weekly Total
  console.log('\n--- TEST GROUP 6: Weekly Total Invariant ---');
  const totalSecA = db!.timetable.filter(t => t.section_id === secA.id);
  const totalSecB = db!.timetable.filter(t => t.section_id === secB.id);
  assert(totalSecA.length === 42, `Section A total weekly lectures = 42 (6 days * 7 periods)`);
  assert(totalSecB.length === 42, `Section B total weekly lectures = 42 (6 days * 7 periods)`);

  console.log('\n======================================================================');
  console.log('  🎉 ALL MULTI-DAY & TIMEZONE TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================================\n');
}

runMultiDayTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
