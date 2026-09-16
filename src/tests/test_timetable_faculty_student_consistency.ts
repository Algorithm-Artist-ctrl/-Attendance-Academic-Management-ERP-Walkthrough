import { strict as assert } from 'assert';
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { DayOfWeek } from '../types/database.types';
import { getCanonicalPeriodTiming } from '../config/academicConfig';

async function runTest() {
  console.log('========================================================================');
  console.log('VCTM ERP — TIMETABLE -> FACULTY/STUDENT DATA CONSISTENCY TEST SUITE');
  console.log('========================================================================\n');

  // Fetch reference entities
  const secAId = 'fc93a413-c18d-4e72-9624-146767bc286b'; // 2nd Year Sec A
  const secBId = '233957c0-4fef-42c6-8285-40ebf73ea6b7'; // 2nd Year Sec B
  const hemlataId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72'; // Ms. Hemlata Chaudhry
  const dstlId = '616b013d-a42c-481c-8b43-39ba733b548b'; // DSTL / BCS303
  const dsId = '223a68cf-ebf7-445f-abe2-99afaea99933'; // Data Structure / BCS301
  const alokId = 'ae02a640-0e39-47e7-b1aa-636efc09aaf6'; // Mr. Alok Gupta

  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Clean initial slate for Section A
  console.log('Preparing clean test state...');
  await supabaseService.deleteSectionTimetable({ sectionId: secAId, deletedBy: 'Test Setup' });
  await supabase.from('timetable_entries').delete().eq('section_id', '5f7d4a1c-4069-4dac-8998-a7b11bd3cc2f');

  // ========================================================================
  // SCENARIO 1: Section A has published timetable
  // ========================================================================
  console.log('\n--- SCENARIO 1: Section A has published timetable ---');
  const { data: dbSubjects } = await supabase.from('subjects').select('*').eq('active', true);
  const { data: dbFaculty } = await supabase.from('faculty').select('*').eq('active', true);
  const subjectMapByCode = new Map(dbSubjects!.map(s => [s.subject_code, s.id]));
  const facultyMapByCode = new Map(dbFaculty!.map(f => [f.faculty_code, f.id]));

  // Construct official Section A schedule (Hemlata has 6 DSTL lectures in Period 3)
  const sectionAEntries: any[] = [];
  for (const day of days) {
    const t1 = getCanonicalPeriodTiming(1);
    const t2 = getCanonicalPeriodTiming(2);
    const t3 = getCanonicalPeriodTiming(3);
    const t4 = getCanonicalPeriodTiming(4);
    const t5 = getCanonicalPeriodTiming(5);
    const t6 = getCanonicalPeriodTiming(6);
    const t7 = getCanonicalPeriodTiming(7);
    const t8 = getCanonicalPeriodTiming(8);

    // P1: COA (KK)
    sectionAEntries.push({
      day_of_week: day, period_number: 1, start_time: t1.start_time, end_time: t1.end_time,
      subject_id: subjectMapByCode.get('BCS302'), faculty_id: facultyMapByCode.get('KK'),
      room_number: 'A007', lecture_type: 'Theory', active: true,
    });
    // P2: MATHS 4 (NAK)
    sectionAEntries.push({
      day_of_week: day, period_number: 2, start_time: t2.start_time, end_time: t2.end_time,
      subject_id: subjectMapByCode.get('BAS303'), faculty_id: facultyMapByCode.get('NAK'),
      room_number: 'A007', lecture_type: 'Theory', active: true,
    });
    // P3: DSTL (HEM) - Ms. Hemlata Chaudhry (6 lectures per week)
    sectionAEntries.push({
      day_of_week: day, period_number: 3, start_time: t3.start_time, end_time: t3.end_time,
      subject_id: dstlId, faculty_id: hemlataId,
      room_number: 'A007', lecture_type: 'Theory', active: true,
    });
    // P4: DS (ALG)
    sectionAEntries.push({
      day_of_week: day, period_number: 4, start_time: t4.start_time, end_time: t4.end_time,
      subject_id: subjectMapByCode.get('BCS301'), faculty_id: facultyMapByCode.get('ALG'),
      room_number: 'A007', lecture_type: 'Theory', active: true,
    });
    // P5: Lunch Break
    sectionAEntries.push({
      day_of_week: day, period_number: 5, start_time: t5.start_time, end_time: t5.end_time,
      subject_id: null, faculty_id: null,
      room_number: 'A007', lecture_type: 'Lunch', active: true,
    });
    // P6-P8
    if (day === 'MON' || day === 'TUE') {
      sectionAEntries.push({
        day_of_week: day, period_number: 6, start_time: t6.start_time, end_time: t6.end_time,
        subject_id: subjectMapByCode.get('BVE301'), faculty_id: facultyMapByCode.get('SHS'),
        room_number: 'A007', lecture_type: 'Theory', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 7, start_time: t7.start_time, end_time: t7.end_time,
        subject_id: subjectMapByCode.get('BCC301'), faculty_id: facultyMapByCode.get('GDS'),
        room_number: 'A007', lecture_type: 'Theory', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 8, start_time: t8.start_time, end_time: t8.end_time,
        subject_id: subjectMapByCode.get('BCC351'), faculty_id: facultyMapByCode.get('FZN'),
        room_number: 'A007', lecture_type: 'Practical', active: true,
      });
    } else if (day === 'WED') {
      sectionAEntries.push({
        day_of_week: day, period_number: 6, start_time: t6.start_time, end_time: t6.end_time,
        subject_id: subjectMapByCode.get('BVE301'), faculty_id: facultyMapByCode.get('SHS'),
        room_number: 'A007', lecture_type: 'Theory', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 7, start_time: t7.start_time, end_time: t7.end_time,
        subject_id: subjectMapByCode.get('BCS351'), faculty_id: facultyMapByCode.get('ALG'),
        room_number: 'A007', lecture_type: 'Practical', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 8, start_time: t8.start_time, end_time: t8.end_time,
        subject_id: subjectMapByCode.get('BCS351'), faculty_id: facultyMapByCode.get('ALG'),
        room_number: 'A007', lecture_type: 'Practical', active: true,
      });
    } else if (day === 'THU') {
      sectionAEntries.push({
        day_of_week: day, period_number: 6, start_time: t6.start_time, end_time: t6.end_time,
        subject_id: subjectMapByCode.get('BVE301'), faculty_id: facultyMapByCode.get('SHS'),
        room_number: 'A007', lecture_type: 'Theory', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 7, start_time: t7.start_time, end_time: t7.end_time,
        subject_id: subjectMapByCode.get('BAS303'), faculty_id: facultyMapByCode.get('NAK'),
        room_number: 'A007', lecture_type: 'Theory', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 8, start_time: t8.start_time, end_time: t8.end_time,
        subject_id: subjectMapByCode.get('BCC301'), faculty_id: facultyMapByCode.get('GDS'),
        room_number: 'A007', lecture_type: 'Theory', active: true,
      });
    } else if (day === 'FRI') {
      sectionAEntries.push({
        day_of_week: day, period_number: 6, start_time: t6.start_time, end_time: t6.end_time,
        subject_id: subjectMapByCode.get('BCC301'), faculty_id: facultyMapByCode.get('GDS'),
        room_number: 'A007', lecture_type: 'Theory', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 7, start_time: t7.start_time, end_time: t7.end_time,
        subject_id: subjectMapByCode.get('BCS353'), faculty_id: facultyMapByCode.get('GDS'),
        room_number: 'A007', lecture_type: 'Practical', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 8, start_time: t8.start_time, end_time: t8.end_time,
        subject_id: subjectMapByCode.get('BCS353'), faculty_id: facultyMapByCode.get('GDS'),
        room_number: 'A007', lecture_type: 'Practical', active: true,
      });
    } else if (day === 'SAT') {
      sectionAEntries.push({
        day_of_week: day, period_number: 6, start_time: t6.start_time, end_time: t6.end_time,
        subject_id: subjectMapByCode.get('BCS352'), faculty_id: facultyMapByCode.get('ALG'),
        room_number: 'A007', lecture_type: 'Practical', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 7, start_time: t7.start_time, end_time: t7.end_time,
        subject_id: subjectMapByCode.get('BCC301'), faculty_id: facultyMapByCode.get('GDS'),
        room_number: 'A007', lecture_type: 'Theory', active: true,
      });
      sectionAEntries.push({
        day_of_week: day, period_number: 8, start_time: t8.start_time, end_time: t8.end_time,
        subject_id: null, faculty_id: null,
        room_number: 'A007', lecture_type: 'Sports', active: true,
      });
    }
  }

  const pubResult1 = await supabaseService.saveSectionTimetable({
    sectionId: secAId,
    entries: sectionAEntries,
    publishedBy: 'HOD Test Runner',
  });
  assert(pubResult1.success, 'Section A timetable published successfully to Supabase');

  // Query DB directly
  const { count: dbCountA } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secAId)
    .eq('active', true);
  assert(dbCountA === 48, `Section A has exactly 48 active entries in DB (got: ${dbCountA})`);

  // HOD timetable query for Section A
  const hodTtA = await supabaseService.getPublishedTimetable({ sectionId: secAId });
  assert(hodTtA.length === 48, `HOD timetable for Section A returns 48 classes (got: ${hodTtA.length})`);

  // Student timetable query for Section A
  const { data: studentA } = await supabase
    .from('students')
    .select('id, section_id')
    .eq('section_id', secAId)
    .limit(1)
    .single();
  assert(Boolean(studentA), 'Student in Section A exists');
  const studentTtA = await supabaseService.getPublishedTimetable({ sectionId: studentA!.section_id });
  assert(studentTtA.length === 48, `Student in Section A sees 48 classes (got: ${studentTtA.length})`);

  // Faculty timetable query for Hemlata (teaches Section A + Section B)
  const facultyTtHemA = await supabaseService.getPublishedTimetable({ facultyId: hemlataId });
  const hemSecASlots = facultyTtHemA.filter(t => t.section_id === secAId && !t.is_break && t.subject_id);
  assert(hemSecASlots.length === 6, `Faculty Hemlata has exactly 6 DSTL lectures in Section A (got: ${hemSecASlots.length})`);
  assert(hemSecASlots.every(t => t.room_number === 'A007' && t.subject_id === dstlId), 'Hemlata classes are DSTL in Room A007');

  // Faculty timetable query for Alok Gupta (teaches Section A only)
  const facultyTtAlokA = await supabaseService.getPublishedTimetable({ facultyId: alokId });
  const alokSectionsA = Array.from(new Set(facultyTtAlokA.filter(t => !t.is_break && t.subject_id).map(t => t.section_id)));
  assert(alokSectionsA.length === 1 && alokSectionsA[0] === secAId, 'Faculty Alok assigned exactly 1 section: Section A');
  assert(facultyTtAlokA.length === 9, `Faculty Alok has 9 teaching periods in Section A (got: ${facultyTtAlokA.length})`);
  console.log('✓ Scenario 1 passed: Section A, DSTL, Room A007, Load 6 correctly displayed.');

  // ========================================================================
  // SCENARIO 2: HOD deletes/clears Section A timetable
  // ========================================================================
  console.log('\n--- SCENARIO 2: HOD deletes/clears Section A timetable ---');
  const delResult2 = await supabaseService.deleteSectionTimetable({
    sectionId: secAId,
    deletedBy: 'HOD Test Runner'
  });
  assert(delResult2.success, 'Section A timetable deleted successfully');

  // DB timetable entries for Section A = 0
  const { count: dbCountAfterDel } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secAId);
  assert(dbCountAfterDel === 0, `Database timetable entries for Section A = 0 (got: ${dbCountAfterDel})`);

  // HOD timetable shows 0 classes
  const hodTtAfterDel = await supabaseService.getPublishedTimetable({ sectionId: secAId });
  assert(hodTtAfterDel.length === 0, `HOD timetable shows 0 classes for Section A (got: ${hodTtAfterDel.length})`);

  // Student dashboard shows 0 classes
  const studentTtAfterDel = await supabaseService.getPublishedTimetable({ sectionId: studentA!.section_id });
  assert(studentTtAfterDel.length === 0, `Student dashboard shows 0 classes (got: ${studentTtAfterDel.length})`);

  // Faculty who ONLY taught Section A (Alok): 0 assigned sections, 0 subjects, 0 load, 0 classes
  const facultyTtAlokAfterDel = await supabaseService.getPublishedTimetable({ facultyId: alokId });
  const alokSectionsAfterDel = Array.from(new Set(facultyTtAlokAfterDel.filter(t => !t.is_break && t.subject_id).map(t => t.section_id)));
  const alokSubjectsAfterDel = Array.from(new Set(facultyTtAlokAfterDel.filter(t => !t.is_break && t.subject_id).map(t => t.subject_id)));
  assert(facultyTtAlokAfterDel.length === 0, `Alok Gupta weekly teaching load = 0 (got: ${facultyTtAlokAfterDel.length})`);
  assert(alokSectionsAfterDel.length === 0, `Alok Gupta assigned sections = 0 (got: ${alokSectionsAfterDel.length})`);
  assert(alokSubjectsAfterDel.length === 0, `Alok Gupta assigned subjects = 0 (got: ${alokSubjectsAfterDel.length})`);

  // Faculty who also taught Section B (Hemlata): Section A (DSTL, Room A007) is completely removed, leaving ONLY Section B!
  const facultyTtHemAfterDel = await supabaseService.getPublishedTimetable({ facultyId: hemlataId });
  const hemSecAAfterDel = facultyTtHemAfterDel.filter(t => t.section_id === secAId);
  assert(hemSecAAfterDel.length === 0, `Hemlata Section A teaching slots = 0 (got: ${hemSecAAfterDel.length})`);
  const hemSectionsAfterDel = Array.from(new Set(facultyTtHemAfterDel.filter(t => !t.is_break && t.subject_id).map(t => t.section_id)));
  assert(!hemSectionsAfterDel.includes(secAId), 'Section A is completely absent from Hemlata assigned sections');
  console.log('✓ Scenario 2 passed: All Section A classes removed, single-section faculty drops to 0, multi-section retains only other section.');

  // ========================================================================
  // SCENARIO 3: Refresh the page (re-query live database state)
  // ========================================================================
  console.log('\n--- SCENARIO 3: Refresh page state (live DB re-query) ---');
  const freshTtEntries = await supabaseService.fetchTimetable();
  const refreshedSecAEntries = freshTtEntries.filter(t => t.section_id === secAId && t.active);
  const refreshedAlokEntries = freshTtEntries.filter(t => t.faculty_id === alokId && t.active && !t.is_break && t.subject_id);
  const refreshedHemSecAEntries = freshTtEntries.filter(t => t.faculty_id === hemlataId && t.section_id === secAId && t.active);

  assert(refreshedSecAEntries.length === 0, `Refreshed state: Section A entries = 0 (got: ${refreshedSecAEntries.length})`);
  assert(refreshedAlokEntries.length === 0, `Refreshed state: Faculty Alok entries = 0 (got: ${refreshedAlokEntries.length})`);
  assert(refreshedHemSecAEntries.length === 0, `Refreshed state: Hemlata Section A entries = 0 (got: ${refreshedHemSecAEntries.length})`);
  console.log('✓ Scenario 3 passed: Page refresh maintains 0 across all dashboards.');

  // ========================================================================
  // SCENARIO 4: Log out and log back in as faculty
  // ========================================================================
  console.log('\n--- SCENARIO 4: Faculty re-login simulation ---');
  const { data: facultyRecordAlok } = await supabase
    .from('faculty')
    .select('*')
    .eq('id', alokId)
    .single();
  assert(Boolean(facultyRecordAlok), 'Faculty profile exists');

  const reLoginTt = await supabaseService.getPublishedTimetable({ facultyId: facultyRecordAlok!.id });
  assert(reLoginTt.length === 0, `Fresh faculty login for Alok shows 0 timetable entries (got: ${reLoginTt.length})`);
  console.log('✓ Scenario 4 passed: Fresh faculty login shows 0 assigned classes for cleared sections.');

  // ========================================================================
  // SCENARIO 5: Re-import / Publish timetable for Section A
  // ========================================================================
  console.log('\n--- SCENARIO 5: Re-import / Publish timetable for Section A ---');
  const pubResult5 = await supabaseService.saveSectionTimetable({
    sectionId: secAId,
    entries: sectionAEntries,
    publishedBy: 'HOD CSE (Re-Publish)',
  });
  assert(pubResult5.success, 'Section A re-published successfully');

  const hodTt5 = await supabaseService.getPublishedTimetable({ sectionId: secAId });
  const studentTt5 = await supabaseService.getPublishedTimetable({ sectionId: studentA!.section_id });
  const facultyTtAlok5 = await supabaseService.getPublishedTimetable({ facultyId: alokId });
  const facultyTtHem5 = await supabaseService.getPublishedTimetable({ facultyId: hemlataId });
  const hemSecA5 = facultyTtHem5.filter(t => t.section_id === secAId && !t.is_break && t.subject_id);

  assert(hodTt5.length === 48, `HOD sees 48 classes after re-publish (got: ${hodTt5.length})`);
  assert(studentTt5.length === 48, `Student sees 48 classes after re-publish (got: ${studentTt5.length})`);
  assert(facultyTtAlok5.length === 9, `Faculty Alok sees 9 classes after re-publish (got: ${facultyTtAlok5.length})`);
  assert(hemSecA5.length === 6, `Faculty Hemlata sees 6 Section A classes after re-publish (got: ${hemSecA5.length})`);
  console.log('✓ Scenario 5 passed: All dashboards restore schedule upon re-publishing.');

  // ========================================================================
  // SCENARIO 6: Clear timetable again
  // ========================================================================
  console.log('\n--- SCENARIO 6: Clear timetable again ---');
  await supabaseService.deleteSectionTimetable({ sectionId: secAId, deletedBy: 'HOD CSE' });

  const hodTt6 = await supabaseService.getPublishedTimetable({ sectionId: secAId });
  const studentTt6 = await supabaseService.getPublishedTimetable({ sectionId: studentA!.section_id });
  const facultyTtAlok6 = await supabaseService.getPublishedTimetable({ facultyId: alokId });
  const facultyTtHem6 = await supabaseService.getPublishedTimetable({ facultyId: hemlataId });
  const hemSecA6 = facultyTtHem6.filter(t => t.section_id === secAId);

  assert(hodTt6.length === 0, `HOD sees 0 classes after 2nd clear (got: ${hodTt6.length})`);
  assert(studentTt6.length === 0, `Student sees 0 classes after 2nd clear (got: ${studentTt6.length})`);
  assert(facultyTtAlok6.length === 0, `Faculty Alok sees 0 classes after 2nd clear (got: ${facultyTtAlok6.length})`);
  assert(hemSecA6.length === 0, `Faculty Hemlata sees 0 Section A classes after 2nd clear (got: ${hemSecA6.length})`);
  console.log('✓ Scenario 6 passed: All dashboards update back to 0 upon clearing again.');

  // ========================================================================
  // SCENARIO 7: Section B timetable remains completely unaffected throughout
  // ========================================================================
  console.log('\n--- SCENARIO 7: Section B timetable remains unaffected ---');
  // Record current Section B count from live database
  const { count: dbCountBBefore } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secBId)
    .eq('active', true);
  assert(dbCountBBefore !== null && dbCountBBefore > 0, `Section B has active entries (got: ${dbCountBBefore})`);

  // Re-publish Section A
  await supabaseService.saveSectionTimetable({
    sectionId: secAId,
    entries: sectionAEntries,
    publishedBy: 'HOD Test Runner',
  });

  // Now delete Section A
  await supabaseService.deleteSectionTimetable({ sectionId: secAId, deletedBy: 'HOD Test Runner' });

  // Verify Section A is 0
  const { count: dbCountAAfterDel } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secAId)
    .eq('active', true);
  assert(dbCountAAfterDel === 0, `Section A has 0 entries (got: ${dbCountAAfterDel})`);

  // Verify Section B is STILL intact with exact same count
  const { count: dbCountBAfter } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secBId)
    .eq('active', true);
  assert(dbCountBAfter === dbCountBBefore, `Section B is completely unaffected and still has ${dbCountBBefore} entries (got: ${dbCountBAfter})`);

  const hodTtB = await supabaseService.getPublishedTimetable({ sectionId: secBId });
  assert(hodTtB.length === dbCountBBefore, `HOD timetable for Section B intact with ${dbCountBBefore} classes (got: ${hodTtB.length})`);

  // Re-publish Section A so live ERP has a full active timetable for both sections
  console.log('\nFinalizing live production state: Publishing official schedules for Section A...');
  await supabaseService.saveSectionTimetable({
    sectionId: secAId,
    entries: sectionAEntries,
    publishedBy: 'VCTM HOD CSE',
  });

  const finalCountA = (await supabaseService.getPublishedTimetable({ sectionId: secAId })).length;
  const finalCountB = (await supabaseService.getPublishedTimetable({ sectionId: secBId })).length;
  assert(finalCountA === 48, `Final Section A count: ${finalCountA}`);
  assert(finalCountB === dbCountBBefore, `Final Section B count: ${finalCountB}`);

  console.log('✓ Scenario 7 passed: Section B is completely unaffected throughout.');
  console.log('\n========================================================================');
  console.log('🎉 ALL 7 TEST SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
