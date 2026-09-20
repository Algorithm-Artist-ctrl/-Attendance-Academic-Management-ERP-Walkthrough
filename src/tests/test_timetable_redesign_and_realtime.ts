import { DEFAULT_INSTITUTIONAL_PERIODS, ACADEMIC_DAYS, getCanonicalPeriodTiming } from '../config/academicConfig';
import { TimetableEntry } from '../types/database.types';

function cleanTime(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return timeStr;
}

function deduplicateTimetable(
  prev: TimetableEntry[],
  enriched: TimetableEntry[],
  sectionId?: string
): TimetableEntry[] {
  const seenIds = new Set<string>();
  const dedupedEnriched: TimetableEntry[] = [];
  for (const entry of enriched) {
    if (!seenIds.has(entry.id)) {
      seenIds.add(entry.id);
      dedupedEnriched.push(entry);
    }
  }

  if (sectionId) {
    const others = prev.filter(t => t.section_id !== sectionId);
    const idSet = new Set(others.map(o => o.id));
    const newEntries = dedupedEnriched.filter(e => !idSet.has(e.id));
    return [...others, ...newEntries];
  } else {
    return dedupedEnriched;
  }
}

async function runTimetableTests() {
  console.log('🧪 Starting Timetable Redesign & Realtime Verification Tests...\n');

  // Test 1: Period Timings and Lunch Recess Configuration
  console.log('Test 1: Verifying Institutional Period Configuration...');
  if (DEFAULT_INSTITUTIONAL_PERIODS.length !== 8) {
    throw new Error(`Expected 8 periods, got ${DEFAULT_INSTITUTIONAL_PERIODS.length}`);
  }
  const lunchPeriod = DEFAULT_INSTITUTIONAL_PERIODS.find(p => p.is_break);
  if (!lunchPeriod || lunchPeriod.period_number !== 5) {
    throw new Error('Expected Period 5 to be Lunch Break');
  }
  if (lunchPeriod.start_time !== '12:20' || lunchPeriod.end_time !== '13:10') {
    throw new Error(`Unexpected lunch timing: ${lunchPeriod.start_time} - ${lunchPeriod.end_time}`);
  }
  console.log('  ✅ Period 5 is correctly configured as Lunch Break (12:20 – 13:10).');

  // Test 2: Time string cleaning (removing seconds)
  console.log('Test 2: Verifying Time String Formatting...');
  if (cleanTime('09:00:00') !== '09:00') {
    throw new Error(`cleanTime failed: expected '09:00', got '${cleanTime('09:00:00')}'`);
  }
  if (cleanTime('09:50') !== '09:50') {
    throw new Error(`cleanTime failed: expected '09:50', got '${cleanTime('09:50')}'`);
  }
  if (cleanTime('14:00:00') !== '14:00') {
    throw new Error(`cleanTime failed: expected '14:00', got '${cleanTime('14:00:00')}'`);
  }
  console.log('  ✅ Time formatting cleanly strips trailing seconds without corrupting 24h format.');

  // Test 3: Academic Days
  console.log('Test 3: Verifying Academic Working Days...');
  const expectedDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  if (JSON.stringify(ACADEMIC_DAYS) !== JSON.stringify(expectedDays)) {
    throw new Error(`Academic days mismatch: ${JSON.stringify(ACADEMIC_DAYS)}`);
  }
  console.log('  ✅ Academic days match institutional standard Monday through Saturday.');

  // Test 4: Deduplication Logic
  console.log('Test 4: Verifying Timetable Realtime Deduplication...');
  const mockExisting: TimetableEntry[] = [
    {
      id: 'entry-1',
      section_id: 'sec-a',
      subject_id: 'sub-1',
      faculty_id: 'fac-1',
      day_of_week: 'MON',
      period_number: 1,
      start_time: '09:00:00',
      end_time: '09:50:00',
      room_number: 'A007',
      lecture_type: 'Theory',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'entry-2',
      section_id: 'sec-b',
      subject_id: 'sub-2',
      faculty_id: 'fac-2',
      day_of_week: 'MON',
      period_number: 2,
      start_time: '09:50:00',
      end_time: '10:40:00',
      room_number: 'B101',
      lecture_type: 'Theory',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ];

  const incomingDuplicates: TimetableEntry[] = [
    mockExisting[0],
    mockExisting[0], // Duplicate ID
    {
      id: 'entry-3',
      section_id: 'sec-a',
      subject_id: 'sub-3',
      faculty_id: 'fac-3',
      day_of_week: 'TUE',
      period_number: 1,
      start_time: '09:00:00',
      end_time: '09:50:00',
      room_number: 'A007',
      lecture_type: 'Theory',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ];

  // Refresh section 'sec-a'
  const dedupedResult = deduplicateTimetable(mockExisting, incomingDuplicates, 'sec-a');
  if (dedupedResult.length !== 3) {
    throw new Error(`Expected 3 entries after deduplication, got ${dedupedResult.length}`);
  }

  const ids = dedupedResult.map(e => e.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    throw new Error('Duplicate IDs found in deduped timetable!');
  }
  if (!ids.includes('entry-2')) {
    throw new Error('Section B entry was unexpectedly dropped during Section A update!');
  }
  console.log('  ✅ Realtime deduplication successfully filters duplicate rows and preserves cross-section data.');

  console.log('\n🎉 ALL TIMETABLE VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}

runTimetableTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
