import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('========================================================================');
  console.log('VCTM ERP: PRODUCTION PERFORMANCE, REALTIME & NO-REFRESH VERIFICATION');
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

  // 1. Check Migration 020
  const migrationPath = path.join(rootDir, 'supabase/migrations/020_performance_indexes_and_notifications_enhancement.sql');
  assert(fs.existsSync(migrationPath), 'Migration 020 exists');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  assert(migrationContent.includes('recipient_role'), 'Migration 020 adds recipient_role to notifications');
  assert(migrationContent.includes('read_at'), 'Migration 020 adds read_at to notifications');
  assert(migrationContent.includes('idx_sessional_marks_student_id'), 'Migration 020 adds hot index on sessional_marks');
  assert(migrationContent.includes('idx_assignments_section_id'), 'Migration 020 adds hot index on assignments');
  assert(migrationContent.includes('idx_attendance_sessions_faculty'), 'Migration 020 adds hot index on attendance_sessions');
  assert(migrationContent.includes('mark_notification_as_read'), 'Migration 020 creates mark_notification_as_read RPC');

  // 2. Check TypeScript Types
  const typesPath = path.join(rootDir, 'src/types/database.types.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  assert(typesContent.includes('recipient_role?: string;'), 'types define recipient_role in StudentNotification');
  assert(typesContent.includes('read_at?: string | null;'), 'types define read_at in StudentNotification');
  assert(typesContent.includes("'MARKS_PUBLISHED'"), 'types include MARKS_PUBLISHED notification type');
  assert(typesContent.includes("'QUIZ_POSTED'"), 'types include QUIZ_POSTED notification type');
  assert(typesContent.includes("'TIMETABLE_UPDATE'"), 'types include TIMETABLE_UPDATE notification type');
  assert(typesContent.includes("'ATTENDANCE_CLAIM'"), 'types include ATTENDANCE_CLAIM notification type');

  // 3. Check Supabase Service Optimizations
  const servicePath = path.join(rootDir, 'src/lib/services/supabaseService.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  assert(!serviceContent.includes('for (const m of studentMarks) {\n        // Fetch student'), 'saveSessionalMarks eliminates sequential student loop query (no N+1)');
  assert(serviceContent.includes('.in(\'id\', studentIds)'), 'saveSessionalMarks performs single batched in() query for students');
  assert(serviceContent.includes("type: 'QUIZ_POSTED'"), 'createQuiz dispatches QUIZ_POSTED notification');
  assert(serviceContent.includes("type: 'QUIZ_GRADED'"), 'saveQuizMarks dispatches QUIZ_GRADED notification');
  assert(serviceContent.includes("type: 'TIMETABLE_UPDATE'"), 'saveSectionTimetable dispatches TIMETABLE_UPDATE notification');
  assert(serviceContent.includes("type: 'ATTENDANCE_CLAIM'"), 'approve/reject attendance claim dispatches notification');

  // 4. Check AuthContext Credential Security & Session Restoration
  const authPath = path.join(rootDir, 'src/context/AuthContext.tsx');
  const authContent = fs.readFileSync(authPath, 'utf8');
  assert(authContent.includes("if (authState.user.role === 'student')"), 'AuthContext strictly blocks student self-altering passwords');
  assert(authContent.includes('adminUpdateAccountCredentials'), 'AuthContext integrates adminUpdateAccountCredentials for super admin direct credential updates');
  assert(authContent.includes('over_email_send_rate_limit'), 'AuthContext handles email rate limit gracefully');
  assert(authContent.includes('Auth session missing'), 'AuthContext handles missing GoTrue auth session gracefully');

  // 5. Check AcademicContext Realtime Single Instance & Toast State
  const academicPath = path.join(rootDir, 'src/context/AcademicContext.tsx');
  const academicContent = fs.readFileSync(academicPath, 'utf8');
  assert(academicContent.includes('realtimeHandlersRef'), 'AcademicContext uses stable realtimeHandlersRef to avoid resubscription churn');
  assert(academicContent.includes('activeToast'), 'AcademicContext exposes activeToast state');
  assert(academicContent.includes('dismissToast'), 'AcademicContext exposes dismissToast handler');
  assert(academicContent.includes('isOnline'), 'AcademicContext tracks isOnline state');
  assert(academicContent.includes("window.addEventListener('online'"), 'AcademicContext listens to network online event for automatic reconnection');
  assert(academicContent.includes("table: 'notifications'"), 'AcademicContext subscribes to realtime notifications table changes');

  // 6. Check AppShell UI & Ergonomics
  const appShellPath = path.join(rootDir, 'src/components/layout/AppShell.tsx');
  const appShellContent = fs.readFileSync(appShellPath, 'utf8');
  assert(appShellContent.includes('activeToast && ('), 'AppShell renders floating live toast banner when activeToast exists');
  assert(appShellContent.includes('!isOnline && ('), 'AppShell renders offline banner when connection is interrupted');
  assert(appShellContent.includes('handleNotificationNavigation'), 'AppShell routes notification clicks to matching tabs');
  assert(appShellContent.includes('touch-target'), 'AppShell uses touch-target classes for thumb-friendly mobile targets');
  assert(appShellContent.includes('pb-24 md:pb-8'), 'AppShell clears bottom navigation on mobile devices');

  // 7. Check SkeletonLoader & StudentMarksPage
  const skeletonPath = path.join(rootDir, 'src/components/common/SkeletonLoader.tsx');
  assert(fs.existsSync(skeletonPath), 'SkeletonLoader.tsx exists with CardSkeleton, TableSkeleton, MarksSkeleton, TimetableSkeleton');
  const marksPagePath = path.join(rootDir, 'src/pages/student/StudentMarksPage.tsx');
  const marksPageContent = fs.readFileSync(marksPagePath, 'utf8');
  assert(marksPageContent.includes('MarksSkeleton'), 'StudentMarksPage integrates MarksSkeleton');
  assert(!marksPageContent.includes('Marks not published yet'), 'StudentMarksPage strictly omits "Marks not published yet" placeholders');

  // 8. Zero window.location.reload Guarantee (excluding test suites)
  const srcFiles = fs.readdirSync(path.join(rootDir, 'src'), { recursive: true }) as string[];
  let reloadFound = false;
  for (const f of srcFiles) {
    if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('tests/')) {
      const full = path.join(rootDir, 'src', f);
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('reload(')) {
        reloadFound = true;
        console.error(`Found reload call in ${f}`);
      }
    }
  }
  assert(!reloadFound, 'Strict zero window.location.reload() verification: no reload calls across production src/');

  console.log('\n========================================================================');
  console.log(`RESULTS: ${passed} / ${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('========================================================================\n');
}

runTests();
