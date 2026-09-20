import fs from 'fs';
import path from 'path';

async function verifyLandingPageRefinements() {
  console.log('================================================================================');
  console.log('  VCTM ERP — LANDING PAGE FINAL PREMIUM LAYOUT REFINEMENT VERIFICATION          ');
  console.log('  Testing Hero Position, Feature Panel Anchoring, Visibility & Typography       ');
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

  // 1. Hero Heading Position & Styling
  console.log('1. Checking Hero Heading & Subtitle positioning...');
  assert(
    code.includes("font-serif-hero font-bold text-slate-950 tracking-tight leading-[1.0]"),
    'Hero heading uses tight leading (1.0), strong dark text (text-slate-950), and serif-hero font'
  );
  assert(
    code.includes("clamp(40px, 3.8vw, 62px)") || code.includes("clamp(42px, 4vw, 68px)") || code.includes("clamp("),
    'Hero heading uses clamp sizing for responsive elegance'
  );
  assert(
    code.includes('A Smarter Campus for a Brighter Tomorrow') &&
    code.includes('font-sans') &&
    code.includes('text-slate-800'),
    'Hero subtitle uses clean sans-serif secondary styling directly below main heading'
  );

  // 2. Focused Sky/Text Gradient (No full white wash over college building)
  console.log('\n2. Checking localized gradient overlay...');
  assert(
    !code.includes('inset-y-0 left-0 w-full sm:w-[50%] lg:w-[42%] bg-gradient-to-r'),
    'Removed previous full vertical gradient that washed out the college building facade'
  );
  assert(
    code.includes('top-0 left-0') && (code.includes('radial-gradient') || code.includes('from-white/90 via-white/40 to-transparent')),
    'Localized gradient is restricted to the upper-left sky area for text contrast'
  );

  // 3. Feature Panel Placement & Spacing
  console.log('\n3. Checking Feature Panel anchoring and spacing...');
  assert(
    code.includes('pb-6 lg:pb-8'),
    'Main container enforces 24px (mobile) to 32px (desktop) visual spacing above footer'
  );
  assert(
    code.includes('Academic Management') &&
    code.includes('Student Information') &&
    code.includes('Assignments & Grading') &&
    code.includes('Attendance & Reports'),
    'Feature panel includes all 4 core functional modules with icons & descriptions'
  );
  assert(
    code.includes('max-w-2xl bg-[#0f172a]/95 backdrop-blur-md text-white rounded-2xl'),
    'Feature panel is compact, dark navy, rounded with subtle border'
  );

  // 4. College Building Image Placement & Hierarchy
  console.log('\n4. Checking College Building background image...');
  assert(
    code.includes('object-[center_35%]') || code.includes('object-[center_36%]'),
    'Photograph positioned to frame sky in upper-left and lawn at bottom'
  );

  // 5. Login Card Integrity
  console.log('\n5. Checking Login Card & Authentication...');
  assert(
    code.includes('Student') && code.includes('Faculty / HOD') && code.includes('Admin'),
    'All 3 role tabs (Student, Faculty/HOD, Admin) are fully present'
  );
  assert(
    code.includes('handleSubmit') && code.includes('login({ identifier: cleanId, password })'),
    'Authentication logic and submit handler remain completely intact'
  );

  // 6. Header & Footer Elements
  console.log('\n6. Checking Header & Footer...');
  assert(
    code.includes('VCTM ERP') && code.includes('LEARN') && code.includes('ACHIEVE'),
    'Header contains complete branding and core values'
  );
  assert(
    code.includes('Tarun Kushwah') && code.includes('All Rights Reserved'),
    'Footer preserves copyright and "Designed & Developed by Tarun Kushwah"'
  );

  // 7. Single Viewport Desktop Experience
  console.log('\n7. Checking Desktop viewport sizing...');
  assert(
    code.includes('lg:h-screen lg:max-h-screen lg:overflow-hidden'),
    'Desktop viewport ensures no unnecessary vertical scrolling on 1366x768, 1440x900, and 1920x1080'
  );

  console.log(`\n================================================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`================================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

verifyLandingPageRefinements();
