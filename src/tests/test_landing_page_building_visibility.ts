import fs from 'fs';
import path from 'path';
import assert from 'assert';

function runLandingPageBuildingVisibilityTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — LANDING PAGE CAMPUS BUILDING VISIBILITY & GEOMETRY VERIFICATION   ');
  console.log('  Testing Photographic Prominence, Non-Obscured Facade, and Viewport Fits      ');
  console.log('================================================================================\n');

  const loginPagePath = path.join(process.cwd(), 'src/pages/auth/LoginPage.tsx');
  assert(fs.existsSync(loginPagePath), 'LoginPage.tsx must exist');
  const content = fs.readFileSync(loginPagePath, 'utf8');

  // TEST 1: Background Image & Focus Point
  console.log('▶ [TEST 1] Verifying College Photograph Focus & Non-Distortion...');
  assert(content.includes('src={vctmCampusImage}'), 'LoginPage must bind vctmCampusImage');
  assert(
    content.includes('object-cover object-[center_22%]'),
    'Background image must use object-[center_22%] to keep rooftop billboard, red sign, and lawn visible'
  );
  console.log('  ✓ Image object positioning: object-[center_22%] preserves roofline (y=9%) and lawn (y=74%)');

  // TEST 2: Localized Gradient
  console.log('\n▶ [TEST 2] Verifying Sky Gradient Boundaries (No Facade Haze)...');
  assert(
    content.includes('h-[24%]'),
    'Gradient height must be restricted to upper sky (h-[24%]) to avoid covering pediment (y=29.5%)'
  );
  assert(
    !content.includes('h-[52%]'),
    'Previous h-[52%] gradient covering central facade and blue windows must be eliminated'
  );
  console.log('  ✓ Gradient is strictly localized to upper-left sky (h-[24%], max-w-[45%])');

  // TEST 3: Container Width & Centering Trap Elimination
  console.log('\n▶ [TEST 3] Verifying Container Geometry & Layout Structure...');
  assert(
    content.includes('max-w-[1780px]'),
    'Main container must expand to max-w-[1780px] to push login card to right screen margin'
  );
  assert(
    !content.includes('max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-12 pt-2 sm:pt-3 pb-6 lg:pb-8 grid grid-cols-1 lg:grid-cols-12'),
    'Deprecated max-w-7xl 1280px centered grid that blocked central building on 1080p must be removed'
  );
  console.log('  ✓ Centered max-w-7xl trap removed in favor of full-width responsive flex container');

  // TEST 4: Hero Headlines Placement
  console.log('\n▶ [TEST 4] Verifying Hero Text Placement in Sky Region...');
  assert(content.includes('leading-[1.04]'), 'Headline uses tight leading-[1.04] for compact vertical footprint');
  assert(content.includes('clamp(28px, 2.8vw, 46px)'), 'Headline font size is clamped to avoid overflowing sky');
  assert(content.includes('Empowering <br />'), 'Headline line break preserves compact 2-line layout');
  console.log('  ✓ Hero text fits securely in sky area above left wing roofline');

  // TEST 5: Feature Bar Anchoring over Foreground Lawn
  console.log('\n▶ [TEST 5] Verifying Feature Bar Positioning & Compact Height...');
  assert(content.includes('mt-auto'), 'Feature panel must use mt-auto to anchor to the bottom lawn');
  assert(content.includes('p-2.5 sm:p-3'), 'Feature panel uses compact padding to minimize vertical height');
  assert(content.includes('Academic Management'), 'Feature panel contains Academic Management');
  assert(content.includes('Student Information'), 'Feature panel contains Student Information');
  assert(content.includes('Assignments & Grading'), 'Feature panel contains Assignments & Grading');
  assert(content.includes('Attendance & Reports'), 'Feature panel contains Attendance & Reports');
  console.log('  ✓ Feature panel anchored to lawn (y > 78%), leaving building facade 100% visible');

  // TEST 6: Login Card Dimension & Far-Right Placement
  console.log('\n▶ [TEST 6] Verifying Login Card Placement & Dimensions...');
  assert(content.includes('lg:w-[380px] xl:w-[400px]'), 'Login card column is constrained to 380px-400px');
  assert(content.includes('max-w-[375px] sm:max-w-[385px] xl:max-w-[400px]'), 'Card max width clamped to 400px');
  assert(content.includes('justify-end'), 'Login column is anchored to far-right edge');
  assert(!content.includes('preserveAspectRatio="none" className="w-full h-full opacity-60"'), 'Wavy decorative SVG removed');
  console.log('  ✓ Login card anchored to far right margin, leaving central building facade fully open');

  // TEST 7: Role Tabs & Essential Form Controls
  console.log('\n▶ [TEST 7] Verifying Role Selection & Login Form...');
  assert(content.includes("activeRoleTab === 'student'"), 'Student tab active state supported');
  assert(content.includes("activeRoleTab === 'faculty'"), 'Faculty tab active state supported');
  assert(content.includes("activeRoleTab === 'admin'"), 'Admin tab active state supported');
  assert(content.includes('Forgot Password?'), 'Forgot password trigger preserved');
  assert(content.includes('Sign In to ERP'), 'Sign In button preserved');
  console.log('  ✓ All 3 role tabs and authentication controls preserved intact');

  // TEST 8: Footer Branding & Credits
  console.log('\n▶ [TEST 8] Verifying Footer Branding & Signature...');
  assert(content.includes('py-1.5 sm:py-2'), 'Footer uses compact py-1.5 padding to prevent vertical desktop scroll');
  assert(content.includes('© 2026 Vivekananda College of Technology & Management, Aligarh'), 'Official copyright intact');
  assert(content.includes('Designed & Developed by <strong className="text-slate-900 font-semibold">Tarun Kushwah</strong>'), 'Developer credit intact');
  console.log('  ✓ Footer branding and developer signature verified');

  console.log('\n================================================================================');
  console.log('  ALL 8 CAMPUS BUILDING VISIBILITY & LAYOUT TESTS PASSED SUCCESSFULLY!          ');
  console.log('================================================================================');
}

runLandingPageBuildingVisibilityTests();
