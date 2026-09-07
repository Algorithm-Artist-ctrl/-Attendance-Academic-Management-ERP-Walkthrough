import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { getISTTodayDate, getISTDayOfWeek } from '../lib/utils/dateUtils';
import { INSTITUTION_TIMEZONE, ATTENDANCE_ELIGIBILITY_THRESHOLD } from '../config/academicConfig';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runZeroHardcodedProductionTests() {
  console.log('================================================================');
  console.log('VCTM ERP: ZERO HARDCODED BUSINESS DATA & REAL-TIME KPI VERIFICATION');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: Server-Side Database Counts & Head Queries
  // -------------------------------------------------------------
  console.log('--- SUITE 1: Server-Side Exact Count Queries (Head Queries) ---');

  const kpis = await supabaseService.getInstitutionKPIs();
  console.log('Database KPIs returned:', JSON.stringify(kpis, null, 2));

  assert(typeof kpis.totalStudents === 'number' && kpis.totalStudents >= 0, `totalStudents is valid database number (${kpis.totalStudents})`);
  assert(typeof kpis.totalFaculty === 'number' && kpis.totalFaculty >= 0, `totalFaculty is valid database number (${kpis.totalFaculty})`);
  assert(typeof kpis.totalDepartments === 'number' && kpis.totalDepartments >= 0, `totalDepartments is valid database number (${kpis.totalDepartments})`);
  assert(typeof kpis.totalSubjects === 'number' && kpis.totalSubjects >= 0, `totalSubjects is valid database number (${kpis.totalSubjects})`);
  assert(typeof kpis.totalSections === 'number' && kpis.totalSections >= 0, `totalSections is valid database number (${kpis.totalSections})`);
  assert(typeof kpis.totalTimetableEntries === 'number' && kpis.totalTimetableEntries >= 0, `totalTimetableEntries is valid database number (${kpis.totalTimetableEntries})`);

  // Verify against raw Supabase queries
  const { count: rawStudentCount } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('active', true);
  assert(kpis.totalStudents === rawStudentCount, `getInstitutionKPIs matches raw students count (${rawStudentCount})`);

  const { count: rawFacultyCount } = await supabase.from('faculty').select('id', { count: 'exact', head: true }).eq('active', true);
  assert(kpis.totalFaculty === rawFacultyCount, `getInstitutionKPIs matches raw faculty count (${rawFacultyCount})`);

  const { count: rawTimetableCount } = await supabase.from('timetable_entries').select('id', { count: 'exact', head: true }).eq('active', true);
  assert(kpis.totalTimetableEntries === rawTimetableCount, `getInstitutionKPIs matches raw timetable count (${rawTimetableCount})`);

  // -------------------------------------------------------------
  // SUITE 2: Scoped HOD Department Faculty & Workload Verification
  // -------------------------------------------------------------
  console.log('\n--- SUITE 2: Department-Scoped HOD Faculty Metrics ---');

  const { data: cseDept } = await supabase.from('departments').select('id, code').eq('code', 'CSE').single();
  assert(!!cseDept, 'Found CSE department record');

  const cseFacultyCount = await supabaseService.getFacultyCount({ departmentId: cseDept!.id, activeOnly: true });
  console.log(`CSE Department Active Faculty Count: ${cseFacultyCount}`);
  assert(cseFacultyCount > 0, `CSE active faculty count is greater than 0 (${cseFacultyCount})`);

  const { data: allFac } = await supabase.from('faculty').select('id, department_id').eq('active', true);
  const manualCseFacCount = (allFac || []).filter(f => f.department_id === cseDept!.id).length;
  assert(cseFacultyCount === manualCseFacCount, `getFacultyCount accurately filters by department (${cseFacultyCount} vs ${manualCseFacCount})`);

  // -------------------------------------------------------------
  // SUITE 3: Empty Section Yields 0 (Zero Fake Fallbacks)
  // -------------------------------------------------------------
  console.log('\n--- SUITE 3: Empty Section Yields 0 (Zero Fake Fallbacks) ---');

  const emptySectionCount = await supabaseService.getTimetableCount({ sectionId: '00000000-0000-0000-0000-000000000000' });
  assert(emptySectionCount === 0, `Non-existent/empty section yields exactly 0 timetable entries (got ${emptySectionCount})`);

  const emptyStudentCount = await supabaseService.getStudentCount({ sectionId: '00000000-0000-0000-0000-000000000000' });
  assert(emptyStudentCount === 0, `Non-existent/empty section yields exactly 0 students (got ${emptyStudentCount})`);

  // -------------------------------------------------------------
  // SUITE 4: Real-Time Date & Timezone Integrity
  // -------------------------------------------------------------
  console.log('\n--- SUITE 4: Real-Time Date & Timezone Integrity ---');

  assert(INSTITUTION_TIMEZONE === 'Asia/Kolkata', 'Institutional timezone is Asia/Kolkata');
  assert(ATTENDANCE_ELIGIBILITY_THRESHOLD === 75, 'Attendance eligibility threshold is 75');

  const todayIST = getISTTodayDate();
  console.log(`Computed IST Today Date: ${todayIST}`);

  // Calculate expected date from system time in Asia/Kolkata
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const expYear = parts.find(p => p.type === 'year')?.value;
  const expMonth = parts.find(p => p.type === 'month')?.value;
  const expDay = parts.find(p => p.type === 'day')?.value;
  const expectedDate = `${expYear}-${expMonth}-${expDay}`;

  assert(todayIST === expectedDate, `getISTTodayDate (${todayIST}) exactly matches current system date in Asia/Kolkata (${expectedDate})`);

  // -------------------------------------------------------------
  // SUITE 5: Codebase Audit for Forbidden Business Hardcodings
  // -------------------------------------------------------------
  console.log('\n--- SUITE 5: Source Code Audit for Hardcoded Business Data ---');

  const projectRoot = path.join(process.cwd(), 'src');
  const pagesDir = path.join(projectRoot, 'pages');
  const componentsDir = path.join(projectRoot, 'components');

  function scanDir(dir: string, ext: string = '.tsx'): string[] {
    let files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(scanDir(fullPath, ext));
      } else if (entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allPageFiles = scanDir(pagesDir);
  const allComponentFiles = scanDir(componentsDir);
  const allSourceFiles = [...allPageFiles, ...allComponentFiles];

  // 1. Audit: Zero "/ 42 Periods" in pages
  let found42Periods = false;
  for (const f of allPageFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('/ 42 Periods')) {
      console.error(`Found "/ 42 Periods" in ${f}`);
      found42Periods = true;
    }
  }
  assert(!found42Periods, 'Zero occurrences of "/ 42 Periods" in UI pages');

  // 2. Audit: Zero "42 Active Slots" in preview modal or components
  let found42Slots = false;
  for (const f of allComponentFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('42 Active Slots')) {
      console.error(`Found "42 Active Slots" in ${f}`);
      found42Slots = true;
    }
  }
  assert(!found42Slots, 'Zero occurrences of "42 Active Slots" in components');

  // 3. Audit: Zero "100% Workload Assigned" in pages
  let found100Workload = false;
  for (const f of allPageFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('100% Workload Assigned')) {
      console.error(`Found "100% Workload Assigned" in ${f}`);
      found100Workload = true;
    }
  }
  assert(!found100Workload, 'Zero occurrences of "100% Workload Assigned" in UI pages');

  // 4. Audit: Zero hardcoded demo UUID fallbacks in pages
  const forbiddenUUIDs = [
    'fe5bc365-7a68-4290-b05e-acfa274f748a',
    'a358fe68-d746-4242-9f36-2c715cd9526e',
    'c71b3983-9ff8-43e1-a9a0-b778676bf186',
    'sec-btech-cse-2-a'
  ];

  for (const uuid of forbiddenUUIDs) {
    let found = false;
    for (const f of allPageFiles) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes(uuid)) {
        console.error(`Found forbidden UUID/ID "${uuid}" in ${f}`);
        found = true;
      }
    }
    assert(!found, `Zero occurrences of fallback ID "${uuid}" in UI pages`);
  }

  // 5. Audit: Zero hardcoded "Academic Session 2026-2027" strings in ReportsPage
  const reportsContent = fs.readFileSync(path.join(pagesDir, 'admin', 'ReportsPage.tsx'), 'utf8');
  assert(!reportsContent.includes("'Academic Session 2026-2027'"), 'ReportsPage uses dynamic academic session title');

  console.log('\n================================================================');
  console.log('🎉 ALL PRODUCTION ZERO-HARDCODED ACCEPTANCE CRITERIA PASSED (100%)');
  console.log('================================================================');
}

runZeroHardcodedProductionTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
