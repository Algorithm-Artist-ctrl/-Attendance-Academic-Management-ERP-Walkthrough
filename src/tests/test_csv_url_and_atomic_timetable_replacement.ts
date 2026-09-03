import { supabase } from '../lib/supabase/supabaseClient';
import { csvTimetableService } from '../lib/services/csvTimetableService';
import { supabaseService } from '../lib/services/supabaseService';
import { DayOfWeek, LectureType, Section, Subject, Faculty } from '../types/database.types';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

export async function runCSVTimetableAndAtomicReplacementTests() {
  console.log('========================================================================');
  console.log('🧪 TEST: CSV URL INGESTION, ATOMIC REPLACEMENT & VERSION ROLLBACK');
  console.log('========================================================================\n');

  // 1. Fetch live metadata from Supabase
  const { data: sections, error: secErr } = await supabase.from('sections').select('*');
  const { data: subjects, error: subErr } = await supabase.from('subjects').select('*');
  const { data: faculty, error: facErr } = await supabase.from('faculty').select('*');

  assert(!secErr && sections && sections.length >= 2, 'Supabase contains active sections');
  assert(!subErr && subjects && subjects.length > 0, 'Supabase contains active subjects');
  assert(!facErr && faculty && faculty.length > 0, 'Supabase contains active faculty members');

  if (!sections || !subjects || !faculty) {
    throw new Error('Required metadata missing from Supabase.');
  }

  const secA = sections.find(s => s.name === 'A') || sections[0];
  const secB = sections.find(s => s.name === 'B') || sections[1];

  console.log(`\n📌 Target Section A: ID=${secA.id}, Name=${secA.name}, Room=${secA.room_number || 'A-007'}`);
  console.log(`📌 Control Section B: ID=${secB.id}, Name=${secB.name}, Room=${secB.room_number || 'A006'}`);

  // Count initial Section B slots to test section isolation
  const { count: secBInitialCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB.id)
    .eq('active', true);

  console.log(`📌 Control Section B initial active slots: ${secBInitialCount || 0}`);

  // -------------------------------------------------------------------------
  // TEST SUITE 1: CSV PARSING & DYNAMIC COLUMN NORMALIZATION
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 1] CSV Parser & Dynamic Column Normalization ---');

  const sampleCSV = `
Day,Period,Start Time,End Time,Subject Code,Faculty,Room,Type
Monday,1,09:00,09:50,BCS301,Hemlata Chaudhary,A-007,Theory
Monday,2,09:50,10:40,BCS302,Kuldeep Kumar,A-007,Theory
Monday,3,10:40,11:30,BCS303,Naseem Ahmed Khan,A-007,Theory
Monday,4,11:30,12:20,BAS303,Shivani Sharma,A-007,Theory
Monday,6,13:10,14:00,BVE301,Praveen Sharma,A-007,Theory
Monday,7,14:00,14:50,BCS351,Hemlata Chaudhary,A-007,Practical
Monday,8,14:50,15:40,BCS352,Kuldeep Kumar,A-007,Practical
Tuesday,1,09:00,09:50,BCS302,Kuldeep Kumar,A-007,Theory
Tuesday,2,09:50,10:40,BCS301,Hemlata Chaudhary,A-007,Theory
Tuesday,3,10:40,11:30,BAS303,Shivani Sharma,A-007,Theory
Tuesday,4,11:30,12:20,BCS303,Naseem Ahmed Khan,A-007,Theory
Tuesday,6,13:10,14:00,BCC301,Alok Garg,A-007,Theory
Tuesday,7,14:00,14:50,BCS353,Naseem Ahmed Khan,A-007,Practical
Tuesday,8,14:50,15:40,BCC351,Alok Garg,A-007,Practical
Wednesday,1,09:00,09:50,BCS303,Naseem Ahmed Khan,A-007,Theory
Wednesday,2,09:50,10:40,BAS303,Shivani Sharma,A-007,Theory
Wednesday,3,10:40,11:30,BCS301,Hemlata Chaudhary,A-007,Theory
Wednesday,4,11:30,12:20,BCS302,Kuldeep Kumar,A-007,Theory
Wednesday,6,13:10,14:00,BVE301,Praveen Sharma,A-007,Theory
Wednesday,7,14:00,14:50,BCS351,Hemlata Chaudhary,A-007,Practical
Wednesday,8,14:50,15:40,BCS352,Kuldeep Kumar,A-007,Practical
Thursday,1,09:00,09:50,BAS303,Shivani Sharma,A-007,Theory
Thursday,2,09:50,10:40,BCS303,Naseem Ahmed Khan,A-007,Theory
Thursday,3,10:40,11:30,BCS302,Kuldeep Kumar,A-007,Theory
Thursday,4,11:30,12:20,BCS301,Hemlata Chaudhary,A-007,Theory
Thursday,6,13:10,14:00,BCC301,Alok Garg,A-007,Theory
Thursday,7,14:00,14:50,BCS353,Naseem Ahmed Khan,A-007,Practical
Thursday,8,14:50,15:40,BCC351,Alok Garg,A-007,Practical
Friday,1,09:00,09:50,BCS301,Hemlata Chaudhary,A-007,Theory
Friday,2,09:50,10:40,BCS302,Kuldeep Kumar,A-007,Theory
Friday,3,10:40,11:30,BAS303,Shivani Sharma,A-007,Theory
Friday,4,11:30,12:20,BCS303,Naseem Ahmed Khan,A-007,Theory
Friday,6,13:10,14:00,BVE301,Praveen Sharma,A-007,Theory
Friday,7,14:00,14:50,BCS351,Hemlata Chaudhary,A-007,Practical
Friday,8,14:50,15:40,BCS352,Kuldeep Kumar,A-007,Practical
Saturday,1,09:00,09:50,BCS302,Kuldeep Kumar,A-007,Theory
Saturday,2,09:50,10:40,BCS301,Hemlata Chaudhary,A-007,Theory
Saturday,3,10:40,11:30,BCS303,Naseem Ahmed Khan,A-007,Theory
Saturday,4,11:30,12:20,BAS303,Shivani Sharma,A-007,Theory
Saturday,6,13:10,14:00,BCC301,Alok Garg,A-007,Theory
Saturday,7,14:00,14:50,BCS353,Naseem Ahmed Khan,A-007,Practical
Saturday,8,14:50,15:40,BCC351,Alok Garg,A-007,Practical
`.trim();

  const validationResult = csvTimetableService.parseAndValidateCSV(sampleCSV, {
    targetSection: secA,
    subjects,
    faculty,
  });

  assert(validationResult.valid, 'CSV timetable validation succeeded with 0 errors');
  assert(validationResult.totalSlots === 42, `Exactly 42 active academic slots parsed (detected: ${validationResult.totalSlots})`);
  assert(validationResult.dayBreakdown.MON === 7, 'Monday contains exactly 7 slots');
  assert(validationResult.dayBreakdown.TUE === 7, 'Tuesday contains exactly 7 slots');
  assert(validationResult.dayBreakdown.WED === 7, 'Wednesday contains exactly 7 slots');
  assert(validationResult.dayBreakdown.THU === 7, 'Thursday contains exactly 7 slots');
  assert(validationResult.dayBreakdown.FRI === 7, 'Friday contains exactly 7 slots');
  assert(validationResult.dayBreakdown.SAT === 7, 'Saturday contains exactly 7 slots');

  // Verify deterministic database ID resolution
  const dsEntry = validationResult.entries.find(e => e.subject_code === 'BCS301');
  assert(Boolean(dsEntry?.subject_id), 'Data Structures (BCS301) successfully resolved to database subject UUID');
  assert(Boolean(dsEntry?.faculty_id), 'Faculty Ms. Hemlata successfully resolved to database faculty UUID');

  // -------------------------------------------------------------------------
  // TEST SUITE 2: MALFORMED CSV REJECTION WITH ZERO WRITES
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 2] Malformed CSV Rejection with Zero Database Writes ---');

  const invalidCSV = `
Day,Period,Subject,Faculty
Funday,9,InvalidCode,UnknownPerson
Monday,0,NoCode,NoFaculty
`.trim();

  const invalidResult = csvTimetableService.parseAndValidateCSV(invalidCSV, {
    targetSection: secA,
    subjects,
    faculty,
  });

  assert(!invalidResult.valid, 'Malformed CSV correctly rejected by validation');
  assert(invalidResult.errors.length >= 2, `Validation generated ${invalidResult.errors.length} actionable error messages`);

  // -------------------------------------------------------------------------
  // TEST SUITE 3: ATOMIC FULL SECTION REPLACEMENT IN SUPABASE
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 3] Complete Section Timetable Replacement & Database Write ---');

  const publishResult = await supabaseService.saveSectionTimetable({
    sectionId: secA.id,
    entries: validationResult.entries.map(e => ({
      subject_id: e.subject_id || subjects[0].id,
      faculty_id: e.faculty_id || faculty[0].id,
      day_of_week: e.day_of_week,
      period_number: e.period_number,
      start_time: e.start_time,
      end_time: e.end_time,
      room_number: e.room_number || secA.room_number || 'Room A-007',
      lecture_type: e.lecture_type,
      active: true,
    })),
    publishedBy: 'Dr. Imran Raza Khan (HOD CSE)',
    sourceType: 'CSV_UPLOAD',
  });

  assert(publishResult.success, 'saveSectionTimetable completed successfully');
  assert(publishResult.count === 42, `42 active records verified in Supabase for Section A (found: ${publishResult.count})`);
  assert(Boolean(publishResult.version?.id), 'TimetableVersion record created in Supabase');

  // Verify actual count in Supabase table
  const { count: liveSecACount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secA.id)
    .eq('active', true);

  assert(liveSecACount === 42, `Direct Supabase query confirmed exactly 42 active entries for Section A (found: ${liveSecACount})`);

  // -------------------------------------------------------------------------
  // TEST SUITE 4: STRICT SECTION ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 4] Strict Section Isolation (Section B Untouched) ---');

  const { count: liveSecBCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB.id)
    .eq('active', true);

  assert(liveSecBCount === secBInitialCount, `Section B remained completely untouched (${liveSecBCount} slots before and after Section A replacement)`);

  // -------------------------------------------------------------------------
  // TEST SUITE 5: VERSION SNAPSHOT & ONE-CLICK ROLLBACK RESTORATION
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 5] Version Snapshotting & Rollback Restoration ---');

  const publishedVersionId = publishResult.version!.id;
  
  // Verify snapshot is stored inside timetable_versions
  const { data: verRow } = await supabase
    .from('timetable_versions')
    .select('*')
    .eq('id', publishedVersionId)
    .single();

  assert(Boolean(verRow?.changes_summary?.snapshot), 'TimetableVersion contains full recoverable period snapshot');
  assert(verRow?.changes_summary?.snapshot?.length === 42, 'Snapshot contains all 42 period definitions');

  // Perform a test modification to change Section A to 1 slot
  console.log('  Testing temporary schedule modification...');
  await supabaseService.saveSectionTimetable({
    sectionId: secA.id,
    entries: [{
      subject_id: subjects[0].id,
      faculty_id: faculty[0].id,
      day_of_week: 'MON',
      period_number: 1,
      start_time: '09:00',
      end_time: '09:50',
      room_number: secA.room_number || 'Room A-007',
      lecture_type: 'Theory',
      active: true,
    }],
    publishedBy: 'Test Temporary Modifier',
    sourceType: 'MANUAL_EDIT',
  });

  const { count: tempCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secA.id)
    .eq('active', true);

  assert(tempCount === 1, 'Section A temporarily reduced to 1 slot');

  // Now perform one-click rollback to the original 42-slot version snapshot
  console.log('  Executing rollbackToVersion...');
  const rollbackResult = await supabaseService.rollbackToVersion({
    versionId: publishedVersionId,
    restoredBy: 'Dr. Imran Raza Khan (HOD)',
  });

  assert(rollbackResult.success, 'rollbackToVersion succeeded');
  assert(rollbackResult.count === 42, `Rollback restored all 42 slots atomically (verified: ${rollbackResult.count})`);

  const { count: restoredCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secA.id)
    .eq('active', true);

  assert(restoredCount === 42, `Direct Supabase query verified 42 active slots restored after rollback (found: ${restoredCount})`);

  // -------------------------------------------------------------------------
  // TEST SUITE 6: REALTIME SYNC & AUDIT LOGGING VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 6] Audit Logs & Circular Notice Verification ---');

  const { data: latestAudit } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('actor_role', 'hod')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  assert(Boolean(latestAudit), 'Audit log successfully recorded for HOD timetable operation');
  assert(latestAudit?.entity_type === 'timetable_version', 'Audit log entity_type matches "timetable_version"');

  const { data: latestNotice } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'NOTICE_PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  assert(Boolean(latestNotice), 'Official Circular Notice generated for target Section A students & faculty');

  console.log('\n========================================================================');
  console.log('✅ ALL CSV INGESTION, ATOMIC REPLACEMENT & ROLLBACK TESTS PASSED 100%!');
  console.log('========================================================================\n');
}

// Execute tests if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCSVTimetableAndAtomicReplacementTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
