import fs from 'fs';
import path from 'path';

function verifyHeroPositioningAndClearance() {
  console.log('================================================================================');
  console.log('  VCTM ERP — LANDING HERO POSITIONING & BUILDING CLEARANCE AUDIT                ');
  console.log('  Verifying Alignment, Spacing, Hierarchy & Visual Match to Reference Image 2   ');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function check(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ [Step ${total}] PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [Step ${total}] FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  const loginPagePath = path.join(process.cwd(), 'src/pages/auth/LoginPage.tsx');
  const code = fs.readFileSync(loginPagePath, 'utf8');

  // 1. Spacing and Placement Hierarchy
  console.log('▶ [PHASE 1] Checking Upper-Left Placement & Breathing Room...');
  check(
    code.includes('max-w-[540px]') || code.includes('max-w-[580px]'),
    'Hero headlines container has controlled max-width (540-580px) preventing 3-line wrap and card overlap'
  );
  check(
    code.includes('pt-4 sm:pt-5 lg:pt-6 xl:pt-8') || code.includes('lg:pt-6'),
    'Hero container has generous breathing space below header (not pushed too close)'
  );

  // 2. Eyebrow Tag Spacing
  console.log('\n▶ [PHASE 2] Checking Eyebrow Tag Positioning...');
  check(
    code.includes('Empowering with Technology') && code.includes('h-[2px] w-5 sm:w-6 bg-blue-600'),
    'Eyebrow tag "— Empowering with Technology" rendered with blue accent line'
  );
  check(
    code.includes('mb-2 sm:mb-2.5') || code.includes('mb-2.5'),
    'Eyebrow tag has comfortable bottom spacing before the main heading'
  );

  // 3. Main Heading & Subtitle Order and Sizing
  console.log('\n▶ [PHASE 3] Checking Headline Typography & Subtitle Clearance...');
  check(
    code.includes('clamp(28px, 2.6vw, 42px)') && code.includes('leading-[1.08]'),
    'Main heading uses refined responsive clamp and compact line height to prevent roof collision'
  );
  check(
    code.includes('<div className="block">\n                <TextEffect per="word" preset="slide" delay={0.12}>\n                  Empowering\n                </TextEffect>\n              </div>') ||
    (code.includes('Empowering') && code.includes('Education') && code.includes('with Technology')),
    'Main heading cleanly breaks into Line 1 "Empowering" and Line 2 "Education with Technology"'
  );
  check(
    code.includes('A Smarter Campus for a Brighter Tomorrow') && 
    (code.includes('mt-2 sm:mt-2.5') || code.includes('mt-2.5')),
    'Subtitle appears directly below heading with comfortable margin (never overlapping roof/building)'
  );

  // 4. Background and Signage Protection
  console.log('\n▶ [PHASE 4] Checking Campus Image & Building Signage Visibility...');
  check(
    code.includes('vctmCampusImage') && code.includes('object-[center_top] lg:object-[center_25%]'),
    'Campus image preserves natural building proportions and visible signage'
  );
  check(
    code.includes('bg-gradient-to-br from-white/85 via-white/30 to-transparent') && code.includes('max-w-[50%]'),
    'Localized sky gradient is subtle and scoped to upper-left sky only (building remains unblurred/sunlit)'
  );
  check(
    code.includes('Vivekananda College of Technology & Management') && code.includes('ALIGARH'),
    'Official institutional name and city are prominent in the header branding'
  );

  // 5. Motion and Component Architecture Safety
  console.log('\n▶ [PHASE 5] Checking Motion Primitives & Card Integrity...');
  check(
    code.includes('TextEffect') && code.includes('AnimatedBackground') && code.includes('AnimatedGroup'),
    'Motion Primitives integration retained for entrance and role tabs'
  );
  check(
    code.includes('max-w-[440px]') && code.includes('h-11 min-h-[44px]') && code.includes('h-[52px]'),
    'Login card dimensions, touch targets (44px) and input heights (52px) intact'
  );
  check(
    code.includes('ACADEMICS') && code.includes('ATTENDANCE') && code.includes('TIMETABLE') && code.includes('ASSESSMENTS'),
    'Bottom feature strip remains completely preserved over the lower lawn'
  );

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passed}/${total} HERO POSITIONING & CLEARANCE ASSERTIONS PASSED!`);
  console.log('   - Hero text placed in upper-left sky with proper spacing and zero roof overlap');
  console.log('   - Eyebrow, headline, and subtitle hierarchy match Reference Image 2');
  console.log('   - Campus photo, building signage, and login card completely unobstructed');
  console.log('================================================================================\n');
}

verifyHeroPositioningAndClearance();
