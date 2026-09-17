import { INITIAL_SECTIONS, INITIAL_YEARS, INITIAL_SEMESTERS, INITIAL_STUDENTS, INITIAL_FACULTY } from '../lib/storage/initialSeedData';
import { Section, Semester, AcademicYear, Student, TimetableEntry } from '../types/database.types';

function runVerification() {
  console.log('========================================================================');
  console.log('🧪 TESTING FACULTY DASHBOARD ACADEMIC YEAR & SECTION RESOLUTION');
  console.log('========================================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition: boolean, label: string) {
    totalChecks++;
    if (condition) {
      console.log(`  ✅ [PASS] ${label}`);
      passedChecks++;
    } else {
      console.error(`  ❌ [FAIL] ${label}`);
    }
  }

  // 1. Verify Academic Years in Seed/DB structure
  console.log('--- 1. Academic Hierarchy Resolution ---');
  const activeYears = INITIAL_YEARS.filter(y => y.active && y.year_number !== 1);
  assert(activeYears.length >= 3, `At least 3 active academic cohorts (2nd, 3rd, 4th Year) present (found ${activeYears.length})`);
  
  const year1 = INITIAL_YEARS.find(y => y.year_number === 1);
  assert(!year1 || !year1.active, '1st Year (year_number = 1) is archived/inactive');

  const year2 = INITIAL_YEARS.find(y => y.year_number === 2);
  const year3 = INITIAL_YEARS.find(y => y.year_number === 3);
  const year4 = INITIAL_YEARS.find(y => y.year_number === 4);

  assert(year2?.name === '2nd Year', `Year 2 has authoritative name "2nd Year" (found "${year2?.name}")`);
  assert(year3?.name === '3rd Year', `Year 3 has authoritative name "3rd Year" (found "${year3?.name}")`);
  assert(year4?.name === '4th Year', `Year 4 has authoritative name "4th Year" (found "${year4?.name}")`);

  // 2. Multi-Year Simulated Database Structure
  console.log('\n--- 2. Multi-Year Sections & Semesters Setup ---');
  // Construct realistic sections across 2nd, 3rd, and 4th years
  const mockSemesters: Semester[] = [
    { id: 'sem-3-odd', academic_year_id: year2!.id, semester_number: 3, name: '3rd Semester', active: true },
    { id: 'sem-5-odd', academic_year_id: year3!.id, semester_number: 5, name: '5th Semester', active: true },
    { id: 'sem-7-odd', academic_year_id: year4!.id, semester_number: 7, name: '7th Semester', active: true },
  ];

  const sec2A: Section = { id: 'sec-2-a', semester_id: 'sem-3-odd', name: 'A', room_number: 'Room No. A 007', active: true };
  const sec2B: Section = { id: 'sec-2-b', semester_id: 'sem-3-odd', name: 'B', room_number: 'Room No. A 006', active: true };
  const sec3A: Section = { id: 'sec-3-a', semester_id: 'sem-5-odd', name: 'A', room_number: 'Room A-301', active: true };
  const sec3B: Section = { id: 'sec-3-b', semester_id: 'sem-5-odd', name: 'B', room_number: 'Room A-302', active: true };
  const sec4A: Section = { id: 'sec-4-a', semester_id: 'sem-7-odd', name: 'A', room_number: 'Room A-401', active: true };
  const sec4B: Section = { id: 'sec-4-b', semester_id: 'sem-7-odd', name: 'B', room_number: 'Room A-402', active: true };

  const allSections = [sec2A, sec2B, sec3A, sec3B, sec4A, sec4B];

  // Distinct UUID check for same section names across different years
  assert(sec2A.id !== sec3A.id, 'Section A (2nd Year) and Section A (3rd Year) have distinct IDs');
  assert(sec3A.id !== sec4A.id, 'Section A (3rd Year) and Section A (4th Year) have distinct IDs');

  // 3. Test Year Resolution for each section
  console.log('\n--- 3. Relational Year Resolution ---');
  function resolveYearForSection(sec: Section, sems: Semester[], yrs: AcademicYear[]) {
    const sem = sems.find(s => s.id === sec.semester_id);
    const yr = yrs.find(y => y.id === sem?.academic_year_id);
    return yr;
  }

  assert(resolveYearForSection(sec2A, mockSemesters, INITIAL_YEARS)?.name === '2nd Year', 'sec2A resolves to "2nd Year"');
  assert(resolveYearForSection(sec3A, mockSemesters, INITIAL_YEARS)?.name === '3rd Year', 'sec3A resolves to "3rd Year"');
  assert(resolveYearForSection(sec4B, mockSemesters, INITIAL_YEARS)?.name === '4th Year', 'sec4B resolves to "4th Year"');

  // 4. Test Enriched Sections Resolution & Display Formatting
  console.log('\n--- 4. Enriched Section Card Computation ---');
  const mockStudents: Student[] = [
    // 54 students in sec-2-a
    ...Array.from({ length: 54 }, (_, i) => ({
      id: `std-2a-${i}`,
      roll_number: `2200560100${i.toString().padStart(2, '0')}`,
      full_name: `Student 2A ${i}`,
      department_id: 'dept-1',
      program_id: 'prog-1',
      academic_year_id: year2!.id,
      semester_id: 'sem-3-odd',
      section_id: 'sec-2-a',
      active: true,
    } as Student)),
    // 52 students in sec-3-a
    ...Array.from({ length: 52 }, (_, i) => ({
      id: `std-3a-${i}`,
      roll_number: `2100560100${i.toString().padStart(2, '0')}`,
      full_name: `Student 3A ${i}`,
      department_id: 'dept-1',
      program_id: 'prog-1',
      academic_year_id: year3!.id,
      semester_id: 'sem-5-odd',
      section_id: 'sec-3-a',
      active: true,
    } as Student)),
    // 48 students in sec-4-b
    ...Array.from({ length: 48 }, (_, i) => ({
      id: `std-4b-${i}`,
      roll_number: `2000560100${i.toString().padStart(2, '0')}`,
      full_name: `Student 4B ${i}`,
      department_id: 'dept-1',
      program_id: 'prog-1',
      academic_year_id: year4!.id,
      semester_id: 'sem-7-odd',
      section_id: 'sec-4-b',
      active: true,
    } as Student)),
  ];

  // Simulated Faculty assigned to:
  // - sec-2-a (2nd Year, Sec A)
  // - sec-3-a (3rd Year, Sec A)
  // - sec-4-b (4th Year, Sec B)
  const assignedSectionIds = ['sec-2-a', 'sec-3-a', 'sec-4-b'];

  const enrichedAssignedSections = assignedSectionIds.map(secId => {
    const sec = allSections.find(s => s.id === secId);
    if (!sec || !sec.active) return null;
    const sem = mockSemesters.find(s => s.id === sec.semester_id);
    const yr = INITIAL_YEARS.find(y => y.id === sem?.academic_year_id);
    if (yr?.year_number === 1) return null;

    const secStudents = mockStudents.filter(s => s.section_id === sec.id && s.active);
    const cleanSecName = (sec.name || '').replace(/^section\s*/i, '').trim();
    const rawRoom = sec.room_number || '';
    const cleanRoom = rawRoom ? rawRoom.replace(/^Room\s*(No\.?\s*)?/i, '').trim() : 'Room TBD';

    return {
      sec,
      sem,
      year: yr,
      yearName: yr?.name || 'Academic Year',
      yearNumber: yr?.year_number || 0,
      cleanSecName,
      cleanRoom: cleanRoom || 'Room TBD',
      studentCount: secStudents.length,
      displayCardTitle: `SECTION ${cleanSecName}`,
      displaySubtitle: `${yr?.name || 'Year'} • ${cleanRoom} • ${secStudents.length} Students`,
    };
  }).filter(Boolean);

  assert(enrichedAssignedSections.length === 3, 'Faculty has exactly 3 assigned sections across cohorts');

  const card1 = enrichedAssignedSections.find(c => c?.sec.id === 'sec-2-a');
  const card2 = enrichedAssignedSections.find(c => c?.sec.id === 'sec-3-a');
  const card3 = enrichedAssignedSections.find(c => c?.sec.id === 'sec-4-b');

  assert(card1?.displayCardTitle === 'SECTION A', 'Card 1 title is "SECTION A"');
  assert(card1?.displaySubtitle === '2nd Year • A 007 • 54 Students', `Card 1 subtitle matches: "${card1?.displaySubtitle}"`);

  assert(card2?.displayCardTitle === 'SECTION A', 'Card 2 title is "SECTION A"');
  assert(card2?.displaySubtitle === '3rd Year • A-301 • 52 Students', `Card 2 subtitle matches: "${card2?.displaySubtitle}"`);

  assert(card3?.displayCardTitle === 'SECTION B', 'Card 3 title is "SECTION B"');
  assert(card3?.displaySubtitle === '4th Year • A-402 • 48 Students', `Card 3 subtitle matches: "${card3?.displaySubtitle}"`);

  // 5. Test Year Filter Computation
  console.log('\n--- 5. Dynamic Year Filter Tabs Computation ---');
  const yearMap = new Map<string, { id: string; name: string; year_number: number; count: number }>();
  enrichedAssignedSections.forEach(item => {
    if (item?.year) {
      const existing = yearMap.get(item.year.id);
      if (existing) {
        existing.count += 1;
      } else {
        yearMap.set(item.year.id, {
          id: item.year.id,
          name: item.year.name,
          year_number: item.year.year_number,
          count: 1,
        });
      }
    }
  });
  const distinctYears = Array.from(yearMap.values()).sort((a, b) => a.year_number - b.year_number);

  assert(distinctYears.length === 3, `Filter generates 3 year tabs (found ${distinctYears.length})`);
  assert(distinctYears[0].name === '2nd Year' && distinctYears[0].count === 1, 'Tab 1: 2nd Year (1)');
  assert(distinctYears[1].name === '3rd Year' && distinctYears[1].count === 1, 'Tab 2: 3rd Year (1)');
  assert(distinctYears[2].name === '4th Year' && distinctYears[2].count === 1, 'Tab 3: 4th Year (1)');

  // 6. Test Filtering Behavior
  console.log('\n--- 6. Filter Execution ---');
  const filterByYear2 = enrichedAssignedSections.filter(item => item?.year?.id === year2!.id);
  assert(filterByYear2.length === 1 && filterByYear2[0]?.sec.id === 'sec-2-a', 'Filtering by 2nd Year returns only 2nd Year Sec A');

  const filterByYear3 = enrichedAssignedSections.filter(item => item?.year?.id === year3!.id);
  assert(filterByYear3.length === 1 && filterByYear3[0]?.sec.id === 'sec-3-a', 'Filtering by 3rd Year returns only 3rd Year Sec A');

  // Summary
  console.log('\n========================================================================');
  console.log(`📊 TEST RESULTS: ${passedChecks}/${totalChecks} CHECKS PASSED (${((passedChecks / totalChecks) * 100).toFixed(1)}%)`);
  console.log('========================================================================\n');

  if (passedChecks !== totalChecks) {
    process.exit(1);
  }
}

runVerification();
