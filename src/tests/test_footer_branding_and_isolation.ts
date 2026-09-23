import fs from 'fs';
import path from 'path';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, stepName: string, detail?: any) {
  totalAssertions++;
  if (!condition) {
    console.error(`\n❌ FAILED Assertion ${totalAssertions}: ${stepName}`);
    if (detail) console.error('   Detail:', detail);
    process.exit(1);
  } else {
    passedAssertions++;
    console.log(`  ✓ [Step ${totalAssertions}] ${stepName}`);
  }
}

function runFooterBrandingTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — FOOTER COLLEGE NAME UNIQUENESS & ZERO REGRESSION AUDIT             ');
  console.log('================================================================================\n');

  const appShellPath = path.resolve(process.cwd(), 'src/components/layout/AppShell.tsx');
  assert(fs.existsSync(appShellPath), 'AppShell.tsx exists');

  const content = fs.readFileSync(appShellPath, 'utf-8');

  // Find the footer JSX block
  const footerMatch = content.match(/<footer[^>]*>([\s\S]*?)<\/footer>/);
  assert(Boolean(footerMatch), 'Footer element exists in AppShell.tsx');

  const footerMarkup = footerMatch![1].trim();
  console.log('  Found Footer Markup:\n   ', footerMarkup);

  // Assertion 1: Must contain exactly one instance of institution name / college branding in footer
  assert(
    footerMarkup.includes('{institution.name} (VCTM)'),
    'Footer displays authoritative {institution.name} (VCTM)'
  );

  // Assertion 2: Must contain Code: 340
  assert(
    footerMarkup.includes('Code: 340'),
    'Footer displays college Code: 340'
  );

  // Assertion 3: Must NOT contain hardcoded duplicate college name
  assert(
    !footerMarkup.includes('• Vivekananda College of Technology & Management, Aligarh • Code: 340'),
    'Duplicate hardcoded college name is completely eliminated'
  );

  // Count occurrences of 'Vivekananda College' or '{institution.name}' in footer
  const nameOccurrences = (footerMarkup.match(/Vivekananda College|\{institution\.name\}/g) || []).length;
  assert(nameOccurrences === 1, `College name appears EXACTLY ONCE in footer (actual count: ${nameOccurrences})`);

  // Assertion 4: Verify expected footer format exactly matches user requirement
  // Expected: © 2026 <strong className="text-[#0f172a]">{institution.name} (VCTM)</strong> • Code: 340
  const expectedPattern = /©\s*2026\s*<strong\s+className="text-\[#0f172a\]">\{institution\.name\}\s*\(VCTM\)<\/strong>\s*•\s*Code:\s*340/;
  assert(expectedPattern.test(footerMarkup), 'Footer matches exact required format: "© 2026 {institution.name} (VCTM) • Code: 340"');

  // Assertion 5: Verify no network calls, queries or realtime in AppShell footer
  assert(!footerMarkup.includes('fetch'), 'Footer does not execute fetch');
  assert(!footerMarkup.includes('supabase'), 'Footer does not make Supabase calls');
  assert(!footerMarkup.includes('channel'), 'Footer does not create realtime channels');

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} FOOTER AUDIT ASSERTIONS PASSED!`);
  console.log('   - Duplicate college name successfully removed');
  console.log('   - College name appears strictly ONCE');
  console.log('   - Zero additional network calls or performance impact');
  console.log('================================================================================\n');
}

runFooterBrandingTests();
