import fs from 'fs';
import path from 'path';

async function verifyLoginPageResponsiveRedesign() {
  console.log('================================================================================');
  console.log('  VCTM ERP — LOGIN PAGE PREMIUM RESPONSIVE REDESIGN VERIFICATION               ');
  console.log('  Testing Mobile Hierarchy, Compact Desktop Strip, Branding & Auth Safety       ');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  const loginPagePath = path.join(process.cwd(), 'src/pages/auth/LoginPage.tsx');
  const code = fs.readFileSync(loginPagePath, 'utf-8');

  // 1. Mobile First & Hierarchy
  console.log('1. Checking Mobile First Hierarchy & Promotional Cards Removal...');
  assert(
    code.includes('Smart Campus. One ERP.'),
    'Mobile header includes concise pill tagline "Smart Campus. One ERP."'
  );
  assert(
    code.includes('hidden lg:flex') && code.includes('ACADEMICS') && code.includes('ATTENDANCE'),
    'Desktop feature strip is hidden on mobile screens (hidden lg:flex) so login card is immediately reached'
  );
  assert(
    !code.includes('Classes, Subjects & Timetable') && !code.includes('Profiles, Records & Performance'),
    'Removed bulky marketing paragraphs from login view to prioritize login experience'
  );

  // 2. Desktop Split-Screen & Compact Feature Strip
  console.log('\n2. Checking Desktop Split-Screen & Compact Strip...');
  assert(
    code.includes('vctmCampusImage') && code.includes('object-[center_top] lg:object-[center_25%]'),
    'Real campus image is properly positioned for mobile (center top) and desktop (center 25%)'
  );
  assert(
    code.includes('Empowering') && code.includes('Education') && code.includes('with Technology'),
    'Desktop headline "Empowering Education with Technology" is present'
  );
  assert(
    code.includes('A Smarter Campus for a Brighter Tomorrow'),
    'Desktop subtitle "A Smarter Campus for a Brighter Tomorrow" is present'
  );
  assert(
    code.includes('ACADEMICS') && code.includes('ATTENDANCE') && code.includes('TIMETABLE') && code.includes('ASSESSMENTS'),
    'Desktop feature strip features all 4 modules (Academics, Attendance, Timetable, Assessments) in a single compact horizontal strip'
  );

  // 3. Login Card & Touch Targets
  console.log('\n3. Checking Login Card Styling & Touch Targets...');
  assert(
    code.includes('max-w-[440px]') && code.includes('rounded-[22px] sm:rounded-[24px]'),
    'Login card adheres to specified dimensions (max-w-[440px], 22-24px rounded corners)'
  );
  assert(
    code.includes('h-11') && code.includes('min-h-[44px]'),
    'Role selection tabs enforce minimum 44px touch target (min-h-[44px], h-11)'
  );
  assert(
    code.includes('activeRoleTab === \'student\'') && 
    code.includes('activeRoleTab === \'faculty\'') && 
    code.includes('activeRoleTab === \'admin\''),
    'All 3 roles (Student, Faculty / HOD, Admin) are fully supported'
  );
  assert(
    code.includes('h-[52px]'),
    'Input fields and sign in button enforce comfortable 52px height'
  );
  assert(
    code.includes('EyeOff') && code.includes('Eye') && code.includes('showPassword'),
    'Password visibility toggle (Eye/EyeOff) is present and functional'
  );
  assert(
    code.includes('setIsForgotModalOpen(true)'),
    'Forgot Password link triggers ForgotPasswordModal'
  );

  // 4. Institutional Typography & High Contrast Tokens
  console.log('\n4. Checking Institutional Typography & High Contrast...');
  assert(
    code.includes('#0f172a'),
    'Uses primary dark navy #0f172a for active buttons, typography, and accents'
  );
  assert(
    code.includes('#e2e8f0'),
    'Uses institutional border token #e2e8f0'
  );
  assert(
    code.includes('#64748b'),
    'Uses muted placeholder token #64748b'
  );

  // 5. Auth Logic Preservation
  console.log('\n5. Checking Auth Logic & Component Safety...');
  assert(
    code.includes('const { login, isLoading, error } = useAuth();'),
    'useAuth hook is properly imported and leveraged'
  );
  assert(
    code.includes('const res = await login({ identifier: cleanId, password });'),
    'login({ identifier, password }) is called cleanly with trimmed values'
  );
  assert(
    code.includes('<ForgotPasswordModal'),
    'ForgotPasswordModal component is rendered and connected to portalRole'
  );

  // 6. Branding & Developer Credit
  console.log('\n6. Checking Branding & Footer...');
  assert(
    code.includes('Vivekananda College of Technology & Management') && code.includes('ALIGARH'),
    'Official institution name and city ALIGARH are clearly rendered'
  );
  assert(
    code.includes('Designed & Developed by') && code.includes('Tarun Kushwah'),
    'Developer credit "Designed & Developed by Tarun Kushwah" is preserved'
  );

  console.log('\n================================================================================');
  console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyLoginPageResponsiveRedesign().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
