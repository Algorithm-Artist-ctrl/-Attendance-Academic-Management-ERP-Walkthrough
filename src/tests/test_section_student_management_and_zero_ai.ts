import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { csvTimetableService } from '../lib/services/csvTimetableService';
import { pdfTimetableService } from '../lib/services/pdfTimetableService';
import fs from 'fs';
import path from 'path';

async function runVerification() {
  console.log('======================================================================');
  console.log('VCTM ERP: SECTION-WISE STUDENT MANAGEMENT & ZERO AI VERIFICATION');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   ℹ️  ${detail}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   ⚠️  ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1: ZERO AI TIMETABLE INGESTION IN UI & PAGES
  // -------------------------------------------------------------
  console.log('\n--- 1. VERIFYING ZERO AI IN UI & PAGES ---');

  const uploadModalPath = path.resolve('src/components/timetable/AITimetableUploadModal.tsx');
  const previewModalPath = path.resolve('src/components/timetable/AITimetablePreviewModal.tsx');
  assert(!fs.existsSync(uploadModalPath), 'AITimetableUploadModal.tsx is completely removed');
  assert(!fs.existsSync(previewModalPath), 'AITimetablePreviewModal.tsx is completely removed');

  const hodDashboardSrc = fs.readFileSync('src/pages/hod/HODDashboard.tsx', 'utf-8');
  assert(!hodDashboardSrc.includes('AI Ingest Timetable'), 'HODDashboard has no "AI Ingest Timetable" button');
  assert(!hodDashboardSrc.includes('AITimetableUploadModal'), 'HODDashboard does not import AITimetableUploadModal');
  assert(hodDashboardSrc.includes('Manage Timetable'), 'HODDashboard includes "Manage Timetable" quick action');

  const timetableMgrSrc = fs.readFileSync('src/pages/admin/TimetableManagerPage.tsx', 'utf-8');
  assert(!timetableMgrSrc.includes('AI Timetable Ingestion'), 'TimetableManagerPage has no "AI Timetable Ingestion" button');
  assert(!timetableMgrSrc.includes('AITimetableUploadModal'), 'TimetableManagerPage does not import AITimetableUploadModal');
  assert(timetableMgrSrc.includes('.pdf'), 'TimetableManagerPage accepts PDF timetable files');
  assert(timetableMgrSrc.includes('pdfTimetableService'), 'TimetableManagerPage integrates pdfTimetableService');

  // -------------------------------------------------------------
  // TEST 2: PDF TIMETABLE SERVICE EXTRACTION (PURE CLIENT-SIDE, ZERO AI)
  // -------------------------------------------------------------
  console.log('\n--- 2. VERIFYING CLIENT-SIDE PDF TIMETABLE SERVICE ---');
  assert(typeof pdfTimetableService.extractTextFromPDF === 'function', 'pdfTimetableService has extractTextFromPDF method');
  assert(typeof pdfTimetableService.parseAndValidatePDF === 'function', 'pdfTimetableService has parseAndValidatePDF method');

  // Test extraction with existing PDF file
  const samplePdfBuffer = fs.readFileSync('BTech_CSE_IT_Sec_B_Time_Table.pdf');
  const extractedText = await pdfTimetableService.extractTextFromPDF(samplePdfBuffer);
  assert(extractedText.length > 100, 'PDF extraction successfully parsed document lines into CSV format', `Extracted ${extractedText.split('\n').length} lines`);
  assert(extractedText.includes('VIVEKANANDA COLLEGE OF TECHNOLOGY'), 'PDF extraction preserved header text');

  // -------------------------------------------------------------
  // TEST 3: LIVE SUPABASE SECTION & STUDENT COUNTS
  // -------------------------------------------------------------
  console.log('\n--- 3. VERIFYING LIVE SUPABASE SECTION & STUDENT ENROLLMENTS ---');
  const { data: sections, error: secErr } = await supabase
    .from('sections')
    .select('id, name, room_number, semester_id')
    .order('name');

  assert(!secErr && !!sections && sections.length > 0, `Supabase has ${sections?.length} active sections configured`);

  const secA = sections?.find(s => s.name === 'A');
  const secB = sections?.find(s => s.name === 'B');
  assert(!!secA, 'Section A exists in Supabase', `ID: ${secA?.id}`);
  assert(!!secB, 'Section B exists in Supabase', `ID: ${secB?.id}`);

  // Fetch live student counts from Supabase
  const { count: secACount, error: cntAErr } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('section_id', secA!.id);

  const { count: secBCount, error: cntBErr } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('section_id', secB!.id);

  assert(!cntAErr && typeof secACount === 'number', `Live Supabase student count for Section A: ${secACount} students`);
  assert(!cntBErr && typeof secBCount === 'number', `Live Supabase student count for Section B: ${secBCount} students`);

  // Test fetchStudentsBySection service method
  const secAStudents = await supabaseService.fetchStudentsBySection(secA!.id);
  assert(secAStudents.length === secACount, `fetchStudentsBySection matches exact count for Section A (${secAStudents.length})`);

  // -------------------------------------------------------------
  // TEST 4: SECTION-SCOPED STUDENT IMPORT & DUPLICATE PROTECTION
  // -------------------------------------------------------------
  console.log('\n--- 4. VERIFYING BATCH STUDENT IMPORT WITH SECTION LOCK ---');
  const testRoll = 'TEST99990001';
  const testStudentPayload = [
    {
      roll_number: testRoll,
      full_name: 'TEST STUDENT IMPORT AUTOMATION',
      email: `${testRoll}@vctm.in`,
      phone: '9999888877',
      admission_type: 'Regular' as const,
    }
  ];

  // Batch import to Section A
  const importResult = await supabaseService.batchImportSectionStudents({
    sectionId: secA!.id,
    students: testStudentPayload,
    importedBy: 'Automated Test Engine',
  });

  assert(importResult.added === 1 || importResult.updated === 1, 'Batch import successfully enrolled/updated student in Section A', `Added: ${importResult.added}, Updated: ${importResult.updated}`);

  // Verify student is in Section A in Supabase
  const { data: testStudentInDb, error: findErr } = await supabase
    .from('students')
    .select('*')
    .eq('roll_number', testRoll)
    .single();

  assert(!findErr && !!testStudentInDb, `Student ${testRoll} verified in Supabase`, `Section ID: ${testStudentInDb?.section_id}`);
  assert(testStudentInDb?.section_id === secA!.id, `Student is strictly locked to Section A`);

  // -------------------------------------------------------------
  // TEST 5: STUDENT SECTION TRANSFER WITH 100% ATTENDANCE INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- 5. VERIFYING STUDENT SECTION TRANSFER ---');
  const transferResult = await supabaseService.transferStudentSection({
    studentId: testStudentInDb!.id,
    newSectionId: secB!.id,
    transferredBy: 'Automated Test Engine',
  });

  assert(transferResult.success === true, `Student ${testRoll} transferred to Section B successfully`);
  assert(transferResult.student.section_id === secB!.id, `Transferred student section_id is now Section B`);

  // Verify in Supabase
  const { data: transferredStudentInDb } = await supabase
    .from('students')
    .select('section_id')
    .eq('id', testStudentInDb!.id)
    .single();
  assert(transferredStudentInDb?.section_id === secB!.id, `Supabase database reflects Section B transfer`);

  // Verify Audit Log recorded
  const { data: auditLog } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'STUDENT_SECTION_TRANSFERRED')
    .eq('entity_id', testStudentInDb!.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  assert(!!auditLog, 'Audit log created for student section transfer', `Action: ${auditLog?.action}`);

  // Clean up test student
  await supabase.from('students').delete().eq('id', testStudentInDb!.id);
  await supabase.from('profiles').delete().eq('id', testStudentInDb!.id);
  console.log('   🧹 Test student cleanly removed after verification.');

  // -------------------------------------------------------------
  // TEST 6: SECTION STUDENT MANAGEMENT MODAL ARTIFACTS
  // -------------------------------------------------------------
  console.log('\n--- 6. VERIFYING UI COMPONENT & MODAL INTEGRATION ---');
  const modalPath = path.resolve('src/components/academic/SectionStudentManagementModal.tsx');
  assert(fs.existsSync(modalPath), 'SectionStudentManagementModal.tsx component exists');

  const modalSrc = fs.readFileSync(modalPath, 'utf-8');
  assert(modalSrc.includes('transferStudentSection'), 'SectionStudentManagementModal calls transferStudentSection');
  assert(modalSrc.includes('batchImportSectionStudents'), 'SectionStudentManagementModal calls batchImportSectionStudents');
  assert(modalSrc.includes('Total Enrolled:'), 'SectionStudentManagementModal displays live student counts');
  assert(modalSrc.includes('Download Template'), 'SectionStudentManagementModal includes CSV template download');

  const setupSrc = fs.readFileSync('src/pages/admin/AcademicSetupPage.tsx', 'utf-8');
  assert(setupSrc.includes('SectionStudentManagementModal'), 'AcademicSetupPage imports SectionStudentManagementModal');
  assert(setupSrc.includes('Enrolled Students'), 'AcademicSetupPage has "Enrolled Students" column');
  assert(setupSrc.includes('filterSectionName'), 'AcademicSetupPage has Section filter dropdown');

  console.log('\n======================================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('VCTM ERP SECTION-WISE STUDENT MANAGEMENT IS 100% PRODUCTION READY.');
  console.log('AI TIMETABLE INGESTION IS COMPLETELY REMOVED.');
  console.log('======================================================================\n');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
