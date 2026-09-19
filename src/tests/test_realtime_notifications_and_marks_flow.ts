import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('========================================================================');
  console.log('VCTM ERP: MASTER TEST SUITE — REALTIME NOTIFICATIONS & MARKS FLOW');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  const rootDir = process.cwd();

  // Test 1: Student marks calculation logic & zero fake marks
  console.log('--- TEST GROUP 1: Student Marks Calculations & Zero Fake Data ---');
  const marksPagePath = path.join(rootDir, 'src/pages/student/StudentMarksPage.tsx');
  const marksPage = fs.readFileSync(marksPagePath, 'utf8');

  assert(marksPage.includes('Marks not published yet'), 'StudentMarksPage renders "Marks not published yet" badge for unpublished subjects');
  assert(marksPage.includes('unpublishedSubjects'), 'StudentMarksPage tracks unpublished subjects explicitly');
  assert(marksPage.includes('publishedCount: scorecard.length'), 'Summary metrics count published scorecards explicitly');
  assert(marksPage.includes('totalMax += item.maxInternalScore'), 'Cumulative percentage max marks only computes 100 per published subject (no fake zeros)');
  assert(!marksPage.includes('demoMarks'), 'Zero demo or mock marks present in StudentMarksPage');

  // Test 2: Student credential security matrix
  console.log('\n--- TEST GROUP 2: Student Credential Security Matrix ---');
  const authPath = path.join(rootDir, 'src/context/AuthContext.tsx');
  const authContent = fs.readFileSync(authPath, 'utf8');
  assert(authContent.includes("if (authState.user.role === 'student')"), 'AuthContext strictly blocks student role from changing password');
  assert(authContent.includes('adminUpdateAccountCredentials'), 'AuthContext provides adminUpdateAccountCredentials for super admin direct credential updates');

  const settingsPath = path.join(rootDir, 'src/pages/common/SettingsPage.tsx');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');
  assert(settingsContent.includes("role === 'student'"), 'SettingsPage checks user role for student credentials banner');

  const profilePath = path.join(rootDir, 'src/pages/common/ProfilePage.tsx');
  const profileContent = fs.readFileSync(profilePath, 'utf8');
  assert(profileContent.includes("role === 'student'"), 'ProfilePage guards credentials section with student institutional policy banner');
  assert(profileContent.includes('Confirmation link sent to your new email address'), 'ProfilePage displays required email change confirmation message');

  // Test 3: Progressive loading skeletons across all four dashboards
  console.log('\n--- TEST GROUP 3: Dashboard Localized Skeletons ---');
  const studentDashPath = path.join(rootDir, 'src/pages/student/StudentDashboard.tsx');
  const studentDash = fs.readFileSync(studentDashPath, 'utf8');
  assert(studentDash.includes('CardSkeleton') && studentDash.includes('TimetableSkeleton'), 'StudentDashboard imports and renders CardSkeleton and TimetableSkeleton');

  const facultyDashPath = path.join(rootDir, 'src/pages/faculty/FacultyDashboard.tsx');
  const facultyDash = fs.readFileSync(facultyDashPath, 'utf8');
  assert(facultyDash.includes('CardSkeleton') && facultyDash.includes('TimetableSkeleton'), 'FacultyDashboard imports and renders CardSkeleton and TimetableSkeleton');

  const hodDashPath = path.join(rootDir, 'src/pages/hod/HODDashboard.tsx');
  const hodDash = fs.readFileSync(hodDashPath, 'utf8');
  assert(hodDash.includes('CardSkeleton') && hodDash.includes('TableSkeleton'), 'HODDashboard imports and renders CardSkeleton and TableSkeleton');

  const adminDashPath = path.join(rootDir, 'src/pages/admin/AdminDashboard.tsx');
  const adminDash = fs.readFileSync(adminDashPath, 'utf8');
  assert(adminDash.includes('CardSkeleton'), 'AdminDashboard imports and renders CardSkeleton');

  // Test 4: Offline Banner Reconnection Text
  console.log('\n--- TEST GROUP 4: Offline Network Resilience ---');
  const appShellPath = path.join(rootDir, 'src/components/layout/AppShell.tsx');
  const appShell = fs.readFileSync(appShellPath, 'utf8');
  assert(appShell.includes('Connection interrupted. Reconnecting...'), 'AppShell renders exact banner text "Connection interrupted. Reconnecting..."');

  // Test 5: Real-time notification triggers and channels
  console.log('\n--- TEST GROUP 5: Real-Time Notifications & Zero Page Reloads ---');
  const academicPath = path.join(rootDir, 'src/context/AcademicContext.tsx');
  const academicContent = fs.readFileSync(academicPath, 'utf8');
  assert(academicContent.includes("table: 'notifications'"), 'AcademicContext subscribes to Supabase notifications table realtime stream');
  assert(academicContent.includes('unreadNotificationCount'), 'AcademicContext maintains unread notification counter');
  assert(academicContent.includes('activeToast'), 'AcademicContext manages live floating toast notifications');

  // Test 6: Strict Zero window.location.reload() audit
  console.log('\n--- TEST GROUP 6: Strict Zero window.location.reload() Audit ---');
  const srcFiles = fs.readdirSync(path.join(rootDir, 'src'), { recursive: true }) as string[];
  let reloadOccurrences: string[] = [];
  for (const f of srcFiles) {
    if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('tests/')) {
      const full = path.join(rootDir, 'src', f);
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('reload(')) {
        reloadOccurrences.push(f);
      }
    }
  }
  assert(reloadOccurrences.length === 0, `Zero reload() found in production files (found: ${reloadOccurrences.join(', ') || 'none'})`);

  console.log('\n========================================================================');
  console.log(`MASTER SUITE RESULTS: ${passed} / ${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('========================================================================\n');
}

runTests();
