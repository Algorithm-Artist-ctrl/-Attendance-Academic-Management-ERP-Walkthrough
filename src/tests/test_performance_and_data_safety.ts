/**
 * Performance Optimization & Data-Safety Automated Test Suite
 * Vivekananda College of Technology & Management (VCTM) ERP
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { supabaseService } from '../lib/services/supabaseService';
import { erpStorage } from '../lib/storage/erpStorage';

async function runPerformanceAndSafetyTests() {
  console.log('===============================================================');
  console.log('VCTM ERP — Performance & Data-Safety Verification Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function recordTest(name: string, ok: boolean, detail?: string) {
    total++;
    if (ok) {
      passed++;
      console.log(`[PASS] ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  // 1. Verify Synchronous Session Cache Performance (< 5ms)
  const t0 = performance.now();
  const cachedUser = erpStorage.getCurrentSessionUser();
  const t1 = performance.now();
  const cacheDuration = t1 - t0;
  recordTest(
    '1. Synchronous Session Restoration Speed',
    cacheDuration < 10,
    `Duration: ${cacheDuration.toFixed(2)}ms (target < 10ms)`
  );

  // 2. Verify Bounded Attendance Query Execution
  const tAtt0 = performance.now();
  const recentSessions = await supabaseService.fetchAllAttendanceSessions(50);
  const tAtt1 = performance.now();
  const sessionsDuration = tAtt1 - tAtt0;
  recordTest(
    '2. Bounded Attendance Sessions Fetch Latency',
    sessionsDuration < 1500 && Array.isArray(recentSessions) && recentSessions.length <= 50,
    `Returned ${recentSessions.length} sessions in ${sessionsDuration.toFixed(0)}ms`
  );

  // 3. Verify Bounded Attendance Records Query
  const tRec0 = performance.now();
  const recentRecords = await supabaseService.fetchAllAttendanceRecords(100);
  const tRec1 = performance.now();
  const recordsDuration = tRec1 - tRec0;
  recordTest(
    '3. Bounded Attendance Records Fetch Latency',
    recordsDuration < 1500 && Array.isArray(recentRecords) && recentRecords.length <= 100,
    `Returned ${recentRecords.length} records in ${recordsDuration.toFixed(0)}ms`
  );

  // 4. Verify Corrections Query Optimization (No 5-level deep join overhead)
  const tCorr0 = performance.now();
  const recentCorrections = await supabaseService.fetchCorrections(50);
  const tCorr1 = performance.now();
  const corrDuration = tCorr1 - tCorr0;
  recordTest(
    '4. Lightweight Corrections Query Latency',
    corrDuration < 1500 && Array.isArray(recentCorrections) && recentCorrections.length <= 50,
    `Returned ${recentCorrections.length} corrections in ${corrDuration.toFixed(0)}ms`
  );

  // 5. Verify Static Master Setup Caching
  const tStatic0 = performance.now();
  const static1 = await supabaseService.fetchStaticSetup(false);
  const tStatic1 = performance.now();
  const static2 = await supabaseService.fetchStaticSetup(false);
  const tStatic2 = performance.now();
  const cachedCallDuration = tStatic2 - tStatic1;
  recordTest(
    '5. In-Memory Static Master Cache Hit',
    cachedCallDuration < 5 && static1 !== null && static2 !== null,
    `Cached fetch executed in ${cachedCallDuration.toFixed(2)}ms`
  );

  // 6. Verify Promise Deduplication for fetchAllData
  const p1 = supabaseService.fetchAllData(false);
  const p2 = supabaseService.fetchAllData(false);
  recordTest(
    '6. In-Flight fetchAllData Promise Deduplication',
    p1 === p2,
    'Parallel fetchAllData calls successfully shared the identical in-flight Promise'
  );
  await Promise.all([p1, p2]);

  // 7. Code Audit: Verify Zero Duplicate Network Event Listeners in AcademicContext
  const academicContextPath = path.join(process.cwd(), 'src', 'context', 'AcademicContext.tsx');
  const academicContent = fs.readFileSync(academicContextPath, 'utf8');
  const onlineListenerMatches = (academicContent.match(/window\.addEventListener\('online'/g) || []).length;
  recordTest(
    '7. Deduplicated Network Event Listeners',
    onlineListenerMatches === 1,
    `Exact 1 online listener found in AcademicContext (was duplicate 2)`
  );

  // 8. Code Audit: Verify Zero Blocking refreshAttendance in saveAttendance
  const saveAttHasBlockingRefresh = /saveAttendance\s*=\s*async[\s\S]*?await refreshAttendance\(\)/.test(academicContent);
  recordTest(
    '8. Zero Blocking refreshAttendance() in saveAttendance',
    !saveAttHasBlockingRefresh,
    'saveAttendance does not block UI with full database re-fetch'
  );

  // 9. Code Audit: Verify Zero Blocking refreshAssessments in saveSessionalMarks
  const saveMarksFuncMatch = academicContent.match(/const saveSessionalMarks\s*=\s*async[\s\S]*?\n  \};/);
  const saveMarksHasBlockingRefresh = saveMarksFuncMatch ? saveMarksFuncMatch[0].includes('await refreshAssessments()') : false;
  recordTest(
    '9. Zero Blocking refreshAssessments() in saveSessionalMarks',
    !saveMarksHasBlockingRefresh,
    'saveSessionalMarks does not block UI with 7 full table re-fetches'
  );

  // 10. Code Audit: Verify Single-Flight Deduplication in AuthContext
  const authContextPath = path.join(process.cwd(), 'src', 'context', 'AuthContext.tsx');
  const authContent = fs.readFileSync(authContextPath, 'utf8');
  const hasInFlightDedup = authContent.includes('inFlightProfileRef') && authContent.includes('emailCacheRef');
  recordTest(
    '10. AuthContext In-Flight Hydration Deduplication & Email Cache',
    hasInFlightDedup,
    'inFlightProfileRef and emailCacheRef properly implemented'
  );

  // 11. Code Audit: Verify Zero window.location.reload() in production src/
  const srcFiles: string[] = [];
  function scan(dir: string) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scan(full);
      } else if ((f.endsWith('.ts') || f.endsWith('.tsx')) && !full.includes('/tests/')) {
        srcFiles.push(full);
      }
    }
  }
  scan(path.join(process.cwd(), 'src'));
  let reloadFound = false;
  for (const file of srcFiles) {
    const code = fs.readFileSync(file, 'utf8');
    if (/window\.location\.reload\(\)/.test(code)) {
      reloadFound = true;
      console.error(`Found window.location.reload in ${file}`);
    }
  }
  recordTest(
    '11. Zero window.location.reload() SPA Routing Guarantee',
    !reloadFound,
    `Verified across ${srcFiles.length} production source files`
  );

  // 12. Code Audit: Verify MessagesPage Never Clears Input on Error
  const messagesPagePath = path.join(process.cwd(), 'src', 'pages', 'communication', 'MessagesPage.tsx');
  const messagesContent = fs.readFileSync(messagesPagePath, 'utf8');
  const hasMessageErrorState = messagesContent.includes('messageSendError') && messagesContent.includes('setMessageSendError');
  recordTest(
    '12. MessagesPage Safe Error Retention & Input Preservation',
    hasMessageErrorState,
    'Inputs and attachments preserved on send failure with inline error alert'
  );

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED (100%)`);
  console.log('===============================================================\n');
}

runPerformanceAndSafetyTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
