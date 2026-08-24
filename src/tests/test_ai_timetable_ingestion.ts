import { supabaseService } from '../lib/services/supabaseService';
import { aiTimetableService } from '../lib/services/aiTimetableService';
import { TimetableResolver } from '../lib/utils/timetableResolver';
import { timetableIngestionService } from '../lib/services/timetableIngestionService';
import { supabase } from '../lib/supabase/supabaseClient';
import { ExtractedTimetableDocument } from '../types/academic.types';
import fs from 'fs';
import path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASSED (${totalTests}): ${testName}`);
  } else {
    console.error(`❌ FAILED (${totalTests}): ${testName}`);
    if (detail) console.error('   Detail:', detail);
  }
}

async function runAITimetableIngestionTests() {
  console.log('======================================================================');
  console.log('    VCTM ERP AI TIMETABLE INGESTION SYSTEM VERIFICATION');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // --- SUITE 1: Master Context & Database Connectivity ---
  console.log('--- SUITE 1: Master Context & Supabase Cloud Connectivity ---');
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Connected to Supabase and fetched master records');
  assert(dbData?.departments.length! > 0, 'CSE Department retrieved from database');
  assert(dbData?.sections.length! >= 2, 'Section A and Section B exist in database');
  assert(dbData?.subjects.length! >= 10, 'Curriculum subjects loaded from Supabase');
  assert(dbData?.faculty.length! >= 11, 'Faculty members loaded from Supabase');

  // --- SUITE 2: AI Multimodal Document Extraction & Schema ---
  console.log('\n--- SUITE 2: AI Multimodal Document Extraction & Schema ---');
  
  // Test with mock document buffer or fallback parser
  const mockFile = new Blob(['sample-timetable-image-content'], { type: 'image/png' }) as File;
  (mockFile as any).name = 'CSE_2nd_Year_Section_A_Timetable.png';

  const extractedDoc = await aiTimetableService.extractTimetableImage(mockFile, 'CSE_2nd_Year_Section_A_Timetable.png');

  assert(extractedDoc.program_name === 'B.Tech', 'Extracted Program Name: B.Tech');
  assert(extractedDoc.branch_name.includes('CSE'), 'Extracted Branch: CSE');
  assert(extractedDoc.section_name === 'A', 'Extracted Section: A');
  assert(extractedDoc.effective_from.length === 10, 'Extracted Effective Date (W.E.F.): ' + extractedDoc.effective_from);
  assert(extractedDoc.schedule.length === 6, 'Schedule grid spans all 6 working days (MON-SAT)');
  assert(extractedDoc.subject_mappings.length > 0, 'Extracted subject mapping legend from bottom of document');
  assert(extractedDoc.faculty_mappings.length > 0, 'Extracted faculty short codes/initials from legend');

  // --- SUITE 3: Subject & Faculty Short Code Resolution ---
  console.log('\n--- SUITE 3: Subject Code & Faculty Initials Resolution ---');
  
  const report = TimetableResolver.resolveDocument(extractedDoc, {
    departments: dbData?.departments || [],
    programs: dbData?.programs || [],
    years: dbData?.years || [],
    semesters: dbData?.semesters || [],
    sections: dbData?.sections || [],
    subjects: dbData?.subjects || [],
    faculty: dbData?.faculty || [],
    existingTimetable: dbData?.timetable || [],
  });

  assert(report.department !== undefined, 'Resolved Department: ' + report.department?.name);
  assert(report.section !== undefined, 'Resolved Section: ' + report.section?.name);
  
  const bcs301Match = report.subjectMatches.find(sm => sm.extracted.subject_code === 'BCS301');
  assert(bcs301Match?.matchedSubject !== undefined, 'Mapped code BCS301 -> Data Structure in database');

  const nakMatch = report.facultyMatches.find(fm => fm.extracted.faculty_code === 'NAK');
  assert(nakMatch?.matchedFaculty?.full_name.includes('Naseem') === true, 'Mapped initials NAK -> Dr. Naseem Ahamad Khan');

  const hemMatch = report.facultyMatches.find(fm => fm.extracted.faculty_code === 'HEM');
  assert(hemMatch?.matchedFaculty?.full_name.includes('Hemlata') === true, 'Mapped initials HEM -> Ms. Hemlata Chaudhary');

  // --- SUITE 4: Multi-Day Dynamic Schedule Grid & Break Handling ---
  console.log('\n--- SUITE 4: Multi-Day Dynamic Grid & Break Handling ---');
  const mondaySchedule = extractedDoc.schedule.find(s => s.day === 'MON');
  assert(mondaySchedule !== undefined, 'Monday schedule grid exists');
  
  const lunchSlot = mondaySchedule?.periods.find(p => p.period_number === 5);
  assert(lunchSlot?.is_break === true, 'Period 5 identified strictly as Lunch Break (is_break: true)');

  // --- SUITE 5: Conflict Detection Engine ---
  console.log('\n--- SUITE 5: Conflict Detection Engine ---');
  
  // Create an artificial conflicting slot for Dr. Naseem who is teaching in Section A
  const secB = dbData?.sections.find(s => s.name === 'B');
  const naseemFaculty = dbData?.faculty.find(f => f.full_name.includes('Naseem'));
  const naseemSlotInA = dbData?.timetable.find(t => t.faculty_id === naseemFaculty?.id && t.active);
  
  const conflictingDoc: ExtractedTimetableDocument = {
    ...extractedDoc,
    section_name: 'B',
    schedule: [
      {
        day: naseemSlotInA?.day_of_week || 'MON',
        periods: [
          {
            period_number: naseemSlotInA?.period_number || 8, // Collides with Section A
            start_time: '14:50',
            end_time: '15:40',
            subject_code: 'BAS303',
            faculty_code: 'NAK',
            faculty_name: naseemFaculty?.full_name,
            room_number: 'A006',
            is_break: false
          }
        ]
      }
    ]
  };

  const conflictReport = TimetableResolver.resolveDocument(conflictingDoc, {
    departments: dbData?.departments || [],
    programs: dbData?.programs || [],
    years: dbData?.years || [],
    semesters: dbData?.semesters || [],
    sections: dbData?.sections || [],
    subjects: dbData?.subjects || [],
    faculty: dbData?.faculty || [],
    existingTimetable: dbData?.timetable || [],
  });

  assert(conflictReport.conflicts.length > 0, 'Collision engine successfully detected faculty schedule collision');
  assert(conflictReport.conflicts[0].type === 'faculty', 'Collision classified correctly as Faculty Overlap');

  // --- SUITE 6: Old vs New Timetable Comparison (Diff Engine) ---
  console.log('\n--- SUITE 6: Old vs New Timetable Comparison (Diff Engine) ---');
  assert(report.diffs.length > 0, 'Generated slot-by-slot comparison diffs');
  assert(report.stats.totalSlots > 0, 'Total slots analyzed: ' + report.stats.totalSlots);

  // --- SUITE 7: Atomic Publishing & Versioning in Supabase ---
  console.log('\n--- SUITE 7: Atomic Publishing & Versioning in Supabase ---');
  
  // Backup Section A rows
  const { data: initialSecARows } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('section_id', report.section!.id);

  const testPublishResult = await timetableIngestionService.approveAndPublishTimetable({
    doc: extractedDoc,
    report,
    approvedBy: 'Prof. Wasim (HOD CSE)',
    customEffectiveDate: '2026-08-25',
  });

  assert(testPublishResult.version !== undefined, 'Created new TimetableVersion record: Version ' + testPublishResult.version.version_number);
  assert(testPublishResult.version.status === 'active', 'New version status is active');
  assert(testPublishResult.newEntries.length > 0, 'Inserted active timetable entries into Supabase (' + testPublishResult.newEntries.length + ' slots)');

  // Verify Audit Log
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'TIMETABLE_AI_INGESTION_PUBLISHED')
    .limit(1);
  assert(auditLogs !== null && auditLogs.length > 0, 'Audit log created: TIMETABLE_AI_INGESTION_PUBLISHED');

  // Verify Notice / Circular created for students
  const notices = await supabaseService.fetchNotices();
  const timetableNotice = notices.find(n => n.title.includes('Official Timetable Updated'));
  assert(timetableNotice !== undefined, 'Automated notice/circular generated for affected students & faculty');

  // Cleanup test timetable version and restore initial section entries
  await supabase.from('timetable_versions').delete().eq('id', testPublishResult.version.id);
  if (initialSecARows && initialSecARows.length > 0) {
    await supabase.from('timetable_entries').delete().eq('section_id', report.section!.id);
    await supabase.from('timetable_entries').insert(initialSecARows.map(r => ({
      section_id: r.section_id,
      subject_id: r.subject_id,
      faculty_id: r.faculty_id,
      day_of_week: r.day_of_week,
      period_number: r.period_number,
      start_time: r.start_time,
      end_time: r.end_time,
      room_number: r.room_number,
      lecture_type: r.lecture_type,
      active: true,
    })));
  }
  console.log('Restored Section A canonical timetable slots.');

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} AI TIMETABLE INGESTION TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
  console.log('======================================================================\n');
}

runAITimetableIngestionTests().then(() => process.exit(0));
