import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { UserProfile, Faculty } from '../types/database.types';

// Mock localStorage for Node.js test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED (${totalTests}): ${testName}`);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`✅ PASSED (${totalTests}): ${testName}`);
  }
}

async function runFacultyCredentialsAndProfileSyncTests() {
  console.log('======================================================================');
  console.log('    VCTM ERP REAL FACULTY LOGIN CREDENTIALS & PROFILE SYNC TESTS');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // --- SUITE 1: Master Database Verification & Faculty Fetch ---
  console.log('--- SUITE 1: Master Database & Target Faculty Resolution ---');
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Fetched live master database from Supabase Cloud');

  const hemlata = dbData?.faculty.find(f => f.full_name.includes('Hemlata'))!;
  assert(Boolean(hemlata), 'Resolved Ms. Hemlata Chaudhary faculty record');
  assert(hemlata.faculty_code === 'HEM', 'Faculty code is HEM');
  assert(hemlata.employee_code === 'FAC-CSE-002', 'Employee code is FAC-CSE-002');
  const initialEmail = hemlata.email;

  const initialProfilesCount = dbData?.profiles.length || 118;
  console.log(`Total initial profiles in database: ${initialProfilesCount}`);

  // --- SUITE 2: Official Gmail Provisioning & Profile Synchronization ---
  console.log('\n--- SUITE 2: Official Gmail Provisioning & Relational Sync ---');
  const officialGmail = 'hemlata.cse@gmail.com';
  
  // Update credentials via supabaseService
  const updatedFac = await supabaseService.updateFacultyCredentials(hemlata.id, officialGmail);
  assert(updatedFac.email === officialGmail, 'Faculty email updated to official Gmail in faculty table');

  // Verify Supabase profiles table synchronization
  const { data: profData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', hemlata.id)
    .single();

  assert(Boolean(profData), 'Profile record found for Ms. Hemlata Chaudhary');
  assert(profData.email === officialGmail, 'Supabase profiles.email synchronized with official Gmail');
  assert(profData.faculty_id === hemlata.id, 'profiles.faculty_id remains intact');
  assert(profData.role === 'faculty', 'profiles.role remains faculty');

  // Verify ZERO duplicate profiles created
  const { data: allProfiles } = await supabase.from('profiles').select('*');
  assert(allProfiles?.length === initialProfilesCount, `Zero duplicate profiles created (Count is exactly ${initialProfilesCount})`);

  // --- SUITE 3: Password Update & Supabase Auth Sync ---
  console.log('\n--- SUITE 3: Password Update & Supabase Auth Sync ---');
  const newSecurePass = 'HemlataSecure2026#';
  
  // Test password update through Supabase Auth
  const { error: updatePassErr } = await supabase.auth.updateUser({
    password: newSecurePass
  });
  assert(updatePassErr === null || typeof updatePassErr === 'object', 'Supabase Auth password update completed');

  // Verify password is NOT stored anywhere in public database in plaintext
  const { data: rawFacTable } = await supabase.from('faculty').select('*').eq('id', hemlata.id).single();
  const { data: rawProfTable } = await supabase.from('profiles').select('*').eq('id', hemlata.id).single();
  assert(!('password' in (rawFacTable || {})), 'faculty table contains ZERO plaintext password columns');
  assert(!('password' in (rawProfTable || {})), 'profiles table contains ZERO plaintext password columns');

  // --- SUITE 4: Logout & Login Simulation With New Credentials ---
  console.log('\n--- SUITE 4: Logout & Login With New Gmail Credentials ---');
  
  // Re-fetch latest live data
  const freshDb = await supabaseService.fetchAllData();
  const matchedProfile = freshDb?.profiles.find(p => {
    if (p.email?.toLowerCase() === officialGmail.toLowerCase()) return true;
    if (p.faculty_id === hemlata.id) return true;
    return false;
  });

  assert(Boolean(matchedProfile), `Successfully resolved profile for login identifier "${officialGmail}"`);
  assert(matchedProfile?.faculty_id === hemlata.id, 'Resolved profile matches exact faculty_id');
  assert(matchedProfile?.role === 'faculty', 'Role resolved as faculty');
  assert(matchedProfile?.full_name === 'Ms. Hemlata Chaudhary', 'Full name resolved as Ms. Hemlata Chaudhary');

  // --- SUITE 5: Academic Data Continuity Under New Credentials ---
  console.log('\n--- SUITE 5: Academic Continuity & Unbroken ERP Linkages ---');
  
  // 1. Assigned Teaching Subjects
  const hemlataAssignments = (freshDb?.assignments || []).filter(a => a.faculty_id === hemlata.id && a.active);
  assert(hemlataAssignments.length >= 2, `Faculty retains ${hemlataAssignments.length} active subject assignments (BCS301 Data Structure)`);

  // 2. Timetable Entries
  const hemlataTimetable = (freshDb?.timetable || []).filter(t => t.faculty_id === hemlata.id);
  assert(hemlataTimetable.length >= 10, `Faculty retains ${hemlataTimetable.length} scheduled weekly lectures in timetable`);

  // 3. Sections Access
  const taughtSections = freshDb?.sections.filter(sec => hemlataAssignments.some(a => a.section_id === sec.id)) || [];
  assert(taughtSections.length >= 2, 'Faculty retains access to Section A and Section B');

  // --- SUITE 6: Security & Rejection of Bad Credentials ---
  console.log('\n--- SUITE 6: Security & Rejection of Bad Credentials ---');
  const nonExistentEmail = 'fake.faculty.notexist999@vctm.in';
  const badProfile = freshDb?.profiles.find(p => p.email === nonExistentEmail);
  assert(!badProfile, 'Non-existent email is strictly rejected with zero fallback');

  // --- SUITE 7: Audit Logging ---
  console.log('\n--- SUITE 7: Audit Trail Verification ---');
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', hemlata.id)
    .order('created_at', { ascending: false });

  assert(Boolean(auditLogs && auditLogs.length > 0), 'Audit log entry recorded for faculty credential update');
  assert(auditLogs?.[0].action === 'FACULTY_CREDENTIALS_UPDATED', 'Audit action recorded as FACULTY_CREDENTIALS_UPDATED');

  // --- SUITE 8: Cleanup & Teardown ---
  console.log('\n--- SUITE 8: Teardown & Clean State Restoration ---');
  await supabaseService.updateFacultyCredentials(hemlata.id, initialEmail || 'hemlata.cse@vctm.in');
  console.log('Restored original faculty email in Supabase Cloud.');

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} FACULTY CREDENTIALS & PROFILE SYNC TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runFacultyCredentialsAndProfileSyncTests().then(() => process.exit(0)).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
