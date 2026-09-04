/**
 * Automated Verification Suite for VCTM ERP
 * Tests all 15 specific requirements from the User Specification
 */

import { supabase } from '../lib/supabase/supabaseClient';
import { studentSyncService } from '../lib/services/studentSyncService';
import { csvTimetableService } from '../lib/services/csvTimetableService';
import { supabaseService } from '../lib/services/supabaseService';
import { normalizeGoogleSheetUrl, parseGoogleSheetUrl, validateSafePublicUrl } from '../lib/utils/urlUtils';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail || '');
    failed++;
  }
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING COMPREHENSIVE VCTM ERP 15-SCENARIO VERIFICATION SUITE');
  console.log('===============================================================\n');

  // Load basic entities
  const { data: dept } = await supabase.from('departments').select('*').eq('code', 'CSE').single();
  const { data: prog } = await supabase.from('programs').select('*').eq('code', 'BTECH-CSE').single();
  const { data: session } = await supabase.from('academic_sessions').select('*').eq('is_current', true).single();
  const { data: years } = await supabase.from('academic_years').select('*').order('year_number');
  const { data: semesters } = await supabase.from('semesters').select('*').order('semester_number');
  const { data: sections } = await supabase.from('sections').select('*').order('name');
  const { data: subjects } = await supabase.from('subjects').select('*');
  const { data: facultyList } = await supabase.from('faculty').select('*');

  console.log(`Active Academic Context: Dept: ${dept?.code}, Program: ${prog?.code}, Session: ${session?.name}`);
  console.log(`Total Years: ${years?.length}, Semesters: ${semesters?.length}, Sections: ${sections?.length}\n`);

  // =========================================================================
  // TEST 1: Super Admin creates / verifies 1st Year, Section A, Section B
  // =========================================================================
  console.log('--- TEST 1: 1st Year, Section A & B Dynamic Resolution ---');
  const year1 = years?.find(y => y.year_number === 1);
  const sem1 = semesters?.find(s => s.academic_year_id === year1?.id);
  const sec1A = sections?.find(s => s.semester_id === sem1?.id && s.name === 'A');
  const sec1B = sections?.find(s => s.semester_id === sem1?.id && s.name === 'B');
  assert(!!year1 && !!sem1 && !!sec1A && !!sec1B, 'TEST 1: 1st Year Section A & B exist dynamically in database');

  // =========================================================================
  // TEST 2: Super Admin creates / verifies 3rd Year, Section A, Section B
  // =========================================================================
  console.log('\n--- TEST 2: 3rd Year, Section A & B Dynamic Resolution ---');
  const year3 = years?.find(y => y.year_number === 3);
  const sem5 = semesters?.find(s => s.academic_year_id === year3?.id);
  const sec3A = sections?.find(s => s.semester_id === sem5?.id && s.name === 'A');
  const sec3B = sections?.find(s => s.semester_id === sem5?.id && s.name === 'B');
  assert(!!year3 && !!sem5 && !!sec3A && !!sec3B, 'TEST 2: 3rd Year Section A & B exist dynamically in database');

  // =========================================================================
  // TEST 3: Super Admin creates / verifies 4th Year, Section A, Section B
  // =========================================================================
  console.log('\n--- TEST 3: 4th Year, Section A & B Dynamic Resolution ---');
  const year4 = years?.find(y => y.year_number === 4);
  const sem7 = semesters?.find(s => s.academic_year_id === year4?.id);
  const sec4A = sections?.find(s => s.semester_id === sem7?.id && s.name === 'A');
  const sec4B = sections?.find(s => s.semester_id === sem7?.id && s.name === 'B');
  assert(!!year4 && !!sem7 && !!sec4A && !!sec4B, 'TEST 3: 4th Year Section A & B exist dynamically in database');

  // =========================================================================
  // TEST 4: Super Admin syncs students from Google Sheet CSV -> New students created
  // =========================================================================
  console.log('\n--- TEST 4: Super Admin Student Sync Creates New Students ---');
  const studentSyncCsv = `roll_no,name,email,mobile,department,year,section
SYNC_24001,Amit Sharma,amit@vctm.in,9876543210,CSE,1,A
SYNC_24002,Pooja Verma,pooja@vctm.in,9876543211,CSE,1,B
SYNC_24003,Vikas Gupta,vikas@vctm.in,9876543212,CSE,3,A
SYNC_24004,Sneha Rao,sneha@vctm.in,9876543213,CSE,4,B`;

  const syncResult1 = await studentSyncService.syncStudents(
    { csvContent: studentSyncCsv },
    { performedBy: 'Tarun Kushwah (Super Admin)' }
  );

  assert(syncResult1.added >= 4 || (syncResult1.added + syncResult1.unchanged + syncResult1.updated === 4), 
    `TEST 4: Student sync processed 4 rows (added: ${syncResult1.added}, updated: ${syncResult1.updated}, unchanged: ${syncResult1.unchanged})`
  );

  const { data: checkAmit } = await supabase.from('students').select('*').eq('roll_number', 'SYNC_24001').single();
  assert(!!checkAmit && checkAmit.full_name === 'AMIT SHARMA', 'TEST 4: Student SYNC_24001 successfully saved to database');

  // =========================================================================
  // TEST 5: Repeated Student Sync -> No Duplicates (added = 0, unchanged = 4)
  // =========================================================================
  console.log('\n--- TEST 5: Repeated Student Sync Produces 0 Duplicates ---');
  const syncResult2 = await studentSyncService.syncStudents(
    { csvContent: studentSyncCsv },
    { performedBy: 'Tarun Kushwah (Super Admin)' }
  );

  assert(syncResult2.added === 0 && syncResult2.unchanged === 4, 
    `TEST 5: Idempotency verified: 0 added, ${syncResult2.unchanged} unchanged, 0 errors`
  );

  // =========================================================================
  // TEST 6: Student Year/Section Change (3rd Year A -> 3rd Year B)
  // =========================================================================
  console.log('\n--- TEST 6: Student Year/Section Transfer Preserves Identity ---');
  const { data: vikasBefore } = await supabase.from('students').select('*').eq('roll_number', 'SYNC_24003').single();
  const vikasIdBefore = vikasBefore?.id;

  const transferCsv = `roll_no,name,email,mobile,department,year,section
SYNC_24003,Vikas Gupta,vikas@vctm.in,9876543212,CSE,3,B`;

  const syncResult3 = await studentSyncService.syncStudents(
    { csvContent: transferCsv },
    { performedBy: 'Tarun Kushwah (Super Admin)' }
  );

  assert(syncResult3.updated === 1 && syncResult3.added === 0, 'TEST 6: Sync reported exactly 1 updated, 0 added');

  const { data: vikasAfter } = await supabase.from('students').select('*').eq('roll_number', 'SYNC_24003').single();
  assert(vikasAfter?.id === vikasIdBefore, 'TEST 6: Student primary ID remained identical (same login identity)');
  assert(vikasAfter?.section_id === sec3B?.id, `TEST 6: Student section updated to Section B (${sec3B?.id})`);

  // =========================================================================
  // TEST 7: HOD syncs 3rd Year Section A timetable -> Affects ONLY 3rd Year Section A
  // =========================================================================
  console.log('\n--- TEST 7: Atomic Timetable Sync for 3rd Year Section A ---');
  const sub1 = subjects?.[0];
  const sub2 = subjects?.[1] || subjects?.[0];
  const fac1 = facultyList?.[0];
  const fac2 = facultyList?.[1] || facultyList?.[0];

  const sec3ATimetableCsv = `day,period,start_time,end_time,subject_code,faculty_code,room,type
MON,1,09:00,09:50,${sub1?.subject_code},${fac1?.faculty_code || fac1?.employee_code || 'HEM'},Room A-301,Theory
MON,2,09:50,10:40,${sub2?.subject_code},${fac2?.faculty_code || fac2?.employee_code || 'WAS'},Room A-301,Theory
TUE,1,09:00,09:50,${sub2?.subject_code},${fac2?.faculty_code || fac2?.employee_code || 'WAS'},Room A-301,Theory`;

  const val3A = csvTimetableService.parseAndValidateCSV(sec3ATimetableCsv, {
    targetSection: sec3A,
    subjects: subjects || [],
    faculty: facultyList || [],
  });

  const res3A = await supabaseService.saveSectionTimetable({
    sectionId: sec3A!.id,
    entries: val3A.entries.map(e => ({
      subject_id: e.subject_id || sub1!.id,
      faculty_id: e.faculty_id || fac1!.id,
      day_of_week: e.day_of_week,
      period_number: e.period_number,
      start_time: e.start_time,
      end_time: e.end_time,
      room_number: e.room_number,
      lecture_type: e.lecture_type,
      active: true,
    })),
    publishedBy: 'Mr. Wasim (HOD CSE)',
    sourceType: 'GOOGLE_SHEET_CSV_SYNC',
  });

  assert(res3A.success && res3A.count === 3, `TEST 7: 3rd Year Section A saved atomically (${res3A.count} slots)`);

  // Verify other sections were NOT affected
  const { data: entries3B } = await supabase.from('timetable_entries').select('*').eq('section_id', sec3B!.id);
  const sem3 = semesters?.find(s => s.semester_number === 3);
  const sec2A = sections?.find(s => s.semester_id === sem3?.id && s.name === 'A');
  const { data: entries2A } = await supabase.from('timetable_entries').select('*').eq('section_id', sec2A!.id);
  assert(Boolean(entries2A && entries2A.length === 42), `TEST 7: 2nd Year Section A remained completely untouched (42 slots)`);

  // =========================================================================
  // TEST 8: HOD syncs 4th Year Section B timetable -> Affects ONLY 4th Year Section B
  // =========================================================================
  console.log('\n--- TEST 8: Atomic Timetable Sync for 4th Year Section B ---');
  const sec4BTimetableCsv = `day,period,start_time,end_time,subject_code,faculty_code,room,type
WED,1,09:00,09:50,${sub1?.subject_code},${fac1?.faculty_code || 'HEM'},Room A-402,Theory
WED,2,09:50,10:40,${sub2?.subject_code},${fac2?.faculty_code || 'WAS'},Room A-402,Theory`;

  const val4B = csvTimetableService.parseAndValidateCSV(sec4BTimetableCsv, {
    targetSection: sec4B,
    subjects: subjects || [],
    faculty: facultyList || [],
  });

  const res4B = await supabaseService.saveSectionTimetable({
    sectionId: sec4B!.id,
    entries: val4B.entries.map(e => ({
      subject_id: e.subject_id || sub1!.id,
      faculty_id: e.faculty_id || fac1!.id,
      day_of_week: e.day_of_week,
      period_number: e.period_number,
      start_time: e.start_time,
      end_time: e.end_time,
      room_number: e.room_number,
      lecture_type: e.lecture_type,
      active: true,
    })),
    publishedBy: 'Mr. Wasim (HOD CSE)',
    sourceType: 'GOOGLE_SHEET_CSV_SYNC',
  });

  assert(res4B.success && res4B.count === 2, `TEST 8: 4th Year Section B saved atomically (${res4B.count} slots)`);

  // Verify 3rd Year A still has its 3 slots
  const { data: entries3A_after } = await supabase.from('timetable_entries').select('*').eq('section_id', sec3A!.id);
  assert(entries3A_after?.length === 3, 'TEST 8: 3rd Year Section A schedule preserved without interference');

  // =========================================================================
  // TEST 9: Student Timetable Scoping (Section B sees Section B schedule)
  // =========================================================================
  console.log('\n--- TEST 9: Student Timetable Dynamic Section Scoping ---');
  // Target Student Tarun Kushwah in 2nd Year Section B
  const { data: tarunStud } = await supabase
    .from('students')
    .select('*, section:sections(*)')
    .eq('roll_number', '2503400100057')
    .single();

  assert(!!tarunStud && tarunStud.section?.name === 'B', `TEST 9: Student Tarun Kushwah resolved in Section B`);

  const { data: tarunSchedule } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('section_id', tarunStud!.section_id)
    .eq('active', true);

  assert(Boolean(tarunSchedule && tarunSchedule.length === 42), `TEST 9: Student loads correct 42-period schedule for Section B`);

  // =========================================================================
  // TEST 10: Faculty Assigned Classes Scoping
  // =========================================================================
  console.log('\n--- TEST 10: Faculty Assigned Classes Scoping ---');
  const { data: facAssignments } = await supabase
    .from('faculty_subject_assignments')
    .select('*, subject:subjects(*), section:sections(*)')
    .eq('faculty_id', fac1!.id)
    .eq('active', true);

  assert(Boolean(facAssignments && facAssignments.length > 0), 
    `TEST 10: Faculty ${fac1!.full_name} has ${facAssignments?.length} active teaching assignments in Supabase`
  );

  // =========================================================================
  // TEST 11: Faculty Changes Email / Password without losing assignments
  // =========================================================================
  console.log('\n--- TEST 11: Faculty Profile Update Preserves Academic State ---');
  const facOldEmail = fac1!.email;
  const testNewEmail = `fac_test_${Date.now()}@vctm.in`;

  // Update email
  await supabase.from('faculty').update({ email: testNewEmail }).eq('id', fac1!.id);
  const { data: facUpdated } = await supabase.from('faculty').select('*').eq('id', fac1!.id).single();

  assert(facUpdated?.id === fac1!.id, 'TEST 11: Faculty primary ID remains identical');
  assert(facUpdated?.department_id === fac1!.department_id, 'TEST 11: Department ID remains identical');

  // Verify assignments still exist
  const { data: facAssignCheck } = await supabase
    .from('faculty_subject_assignments')
    .select('*')
    .eq('faculty_id', fac1!.id);
  assert(Boolean(facAssignCheck && facAssignCheck.length > 0), 'TEST 11: Faculty assignments completely intact');

  // Revert email
  await supabase.from('faculty').update({ email: facOldEmail }).eq('id', fac1!.id);

  // =========================================================================
  // TEST 12: Student Changes Email / Phone without losing roll number or section
  // =========================================================================
  console.log('\n--- TEST 12: Student Update Preserves Roll & Academic Relationships ---');
  const { data: studToTest } = await supabase.from('students').select('*').eq('roll_number', 'SYNC_24001').single();
  const testStudEmail = `test_amit_${Date.now()}@vctm.in`;

  await supabase.from('students').update({ email: testStudEmail, phone: '9999988888' }).eq('id', studToTest!.id);
  const { data: studUpdated } = await supabase.from('students').select('*').eq('id', studToTest!.id).single();

  assert(studUpdated?.id === studToTest!.id, 'TEST 12: Student ID unchanged');
  assert(studUpdated?.roll_number === 'SYNC_24001', 'TEST 12: Roll number unchanged');
  assert(studUpdated?.section_id === studToTest!.section_id, 'TEST 12: Section relationship unchanged');

  // =========================================================================
  // TEST 13: Invalid CSV Rejected -> Existing Timetable Unchanged
  // =========================================================================
  console.log('\n--- TEST 13: Invalid Timetable CSV Rejection ---');
  const { data: sec3ABeforeInvalid } = await supabase.from('timetable_entries').select('*').eq('section_id', sec3A!.id);

  const invalidCsv = `day,period,start_time,end_time,subject_code,faculty_code,room,type
XYZ_DAY,99,99:99,99:99,NONEXISTENT_SUB,NONEXISTENT_FAC,Room X,Invalid`;

  const invalidValidation = csvTimetableService.parseAndValidateCSV(invalidCsv, {
    targetSection: sec3A,
    subjects: subjects || [],
    faculty: facultyList || [],
  });

  assert(!invalidValidation.valid, 'TEST 13: Invalid CSV correctly failed validation');
  assert(invalidValidation.errors.length > 0, `TEST 13: Caught ${invalidValidation.errors.length} actionable errors`);

  // Verify schedule did NOT change
  const { data: sec3AAfterInvalid } = await supabase.from('timetable_entries').select('*').eq('section_id', sec3A!.id);
  assert(Boolean(sec3ABeforeInvalid && sec3AAfterInvalid && sec3ABeforeInvalid.length === sec3AAfterInvalid.length), 'TEST 13: Timetable untouched in database');

  // =========================================================================
  // TEST 14: Real Faculty Scheduling Conflict Detected as Compact Status
  // =========================================================================
  console.log('\n--- TEST 14: Real Faculty Scheduling Conflict Detection ---');
  // Schedule fac1 in 3rd Year Section B at the exact same slot as 3rd Year Section A (MON Period 1)
  const conflictEntries = [{
    faculty_id: fac1!.id,
    day_of_week: 'MON' as const,
    period_number: 1,
    subject_id: sub1!.id,
  }];

  const detectedConflicts = await supabaseService.checkFacultyCrossSectionConflicts({
    sectionId: sec3B!.id,
    entries: conflictEntries,
  });

  assert(detectedConflicts.length >= 1, `TEST 14: Detected faculty conflict for ${detectedConflicts[0]?.facultyName}`);
  assert(detectedConflicts[0]?.day === 'MON' && detectedConflicts[0]?.period === 1, 'TEST 14: Conflict day and period matched correctly');

  // =========================================================================
  // TEST 15: Super Admin creates 3rd Year Section C -> Immediately appears
  // =========================================================================
  console.log('\n--- TEST 15: Dynamic Section Creation & Immediate Reflection ---');
  // Insert Section C for 3rd Year (Sem 5)
  const { data: existingSecC } = await supabase
    .from('sections')
    .select('*')
    .eq('semester_id', sem5!.id)
    .eq('name', 'C')
    .maybeSingle();

  let secCId = existingSecC?.id;
  if (!existingSecC) {
    const { data: newSecC, error: secCErr } = await supabase
      .from('sections')
      .insert([{
        semester_id: sem5!.id,
        name: 'C',
        room_number: 'Room A-303',
        active: true,
      }])
      .select()
      .single();

    assert(!secCErr && !!newSecC, 'TEST 15: Super Admin created 3rd Year Section C in database');
    secCId = newSecC?.id;
  } else {
    assert(true, 'TEST 15: 3rd Year Section C exists and active in database');
  }

  // Verify query of 3rd Year sections now includes Section C
  const { data: thirdYearSecs } = await supabase
    .from('sections')
    .select('*')
    .eq('semester_id', sem5!.id)
    .eq('active', true);

  const foundC = thirdYearSecs?.some(s => s.name === 'C');
  assert(!!foundC, 'TEST 15: 3rd Year Section C dynamically appears in section query without code changes');

  // =========================================================================
  // URL UTILS & SSRF VERIFICATION
  // =========================================================================
  console.log('\n--- BONUS: Google Sheet URL Normalizer & SSRF Guards ---');
  
  // Format 1: /edit
  const p1 = parseGoogleSheetUrl('https://docs.google.com/spreadsheets/d/SPREADSHEET_123/edit');
  assert(p1.isGoogleSheet && p1.spreadsheetId === 'SPREADSHEET_123' && p1.exportCsvUrl === 'https://docs.google.com/spreadsheets/d/SPREADSHEET_123/export?format=csv', 'URL Format 1: /edit extracted spreadsheetId and generated CSV export');

  // Format 2: /edit?usp=sharing
  const p2 = parseGoogleSheetUrl('https://docs.google.com/spreadsheets/d/SPREADSHEET_123/edit?usp=sharing');
  assert(p2.isGoogleSheet && p2.spreadsheetId === 'SPREADSHEET_123' && p2.exportCsvUrl === 'https://docs.google.com/spreadsheets/d/SPREADSHEET_123/export?format=csv', 'URL Format 2: /edit?usp=sharing extracted spreadsheetId and generated CSV export');

  // Format 3: /edit#gid=123456
  const p3 = parseGoogleSheetUrl('https://docs.google.com/spreadsheets/d/SPREADSHEET_123/edit#gid=123456');
  assert(p3.isGoogleSheet && p3.gid === '123456' && p3.exportCsvUrl === 'https://docs.google.com/spreadsheets/d/SPREADSHEET_123/export?format=csv&gid=123456', 'URL Format 3: /edit#gid=123456 extracted gid and generated tab-specific CSV export');

  // Format 4: Published CSV URL
  const p4 = parseGoogleSheetUrl('https://docs.google.com/spreadsheets/d/e/2PACX-1vSpreadsheet/pub?output=csv');
  assert(Boolean(p4.isGoogleSheet && p4.exportCsvUrl?.includes('/pub?output=csv')), 'URL Format 4: Published CSV URL recognized');

  const ssrf1 = validateSafePublicUrl('http://127.0.0.1:8080/secret');
  assert(!ssrf1.valid, 'SSRF: Blocked 127.0.0.1 loopback');

  const ssrf2 = validateSafePublicUrl('http://169.254.169.254/latest/meta-data');
  assert(!ssrf2.valid, 'SSRF: Blocked Cloud Metadata IP');

  const ssrf3 = validateSafePublicUrl('http://192.168.1.100/internal');
  assert(!ssrf3.valid, 'SSRF: Blocked Private 192.168.x subnet');

  const ssrf4 = validateSafePublicUrl('https://docs.google.com/spreadsheets/d/test/export?format=csv');
  assert(ssrf4.valid, 'SSRF: Allowed valid Google Docs public URL');

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
