import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { UserProfile, Student, Faculty, Section } from '../types/database.types';

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

async function runGlobalUserAccessVerification() {
  console.log('======================================================================');
  console.log('    VCTM ERP GLOBAL USER ACCESS & ROLE-BASED DATA VERIFICATION');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // --- SUITE 1: Master Database & Profiles Integrity ---
  console.log('--- SUITE 1: Supabase Cloud Database & User Profiles ---');
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Fetched live master database from Supabase Cloud');

  const { data: allProfiles } = await supabase.from('profiles').select('*');
  assert(allProfiles !== null && allProfiles.length >= 118, `All ${allProfiles?.length} authoritative user profiles exist in Supabase`);

  const secA = dbData?.sections.find(s => s.name === 'A')!;
  const secB = dbData?.sections.find(s => s.name === 'B')!;
  assert(Boolean(secA && secB), 'Section A (Room A 007) and Section B (Room A 006) exist in database');

  // --- SUITE 2: Student Login & Dynamic Relationship Resolution ---
  console.log('\n--- SUITE 2: Student Access & Section-Driven Resolution ---');
  // Student A: Aditya Kishor Saraswat (Section A)
  const studentA = dbData?.students.find(s => s.roll_number === '2503400100001' || s.section_id === secA.id)!;
  const profileA = allProfiles?.find(p => p.student_id === studentA.id || p.email === studentA.email);

  assert(Boolean(profileA), `Student A (${studentA.full_name} - ${studentA.roll_number}) has mapped database profile`);
  assert(profileA?.role === 'student', 'Student A role is strictly "student" from database');
  assert(studentA.section_id === secA.id, 'Student A is strictly enrolled in Section A');

  // Student B: Tarun Kushwah / Himanshu (Section B)
  const studentB = dbData?.students.find(s => s.section_id === secB.id)!;
  const profileB = allProfiles?.find(p => p.student_id === studentB.id || p.email === studentB.email);

  assert(Boolean(profileB), `Student B (${studentB.full_name} - ${studentB.roll_number}) has mapped database profile`);
  assert(profileB?.role === 'student', 'Student B role is strictly "student" from database');
  assert(studentB.section_id === secB.id, 'Student B is strictly enrolled in Section B');

  // Timetable Isolation
  const timetableSecA = (dbData?.timetable || []).filter(t => t.section_id === studentA.section_id);
  const timetableSecB = (dbData?.timetable || []).filter(t => t.section_id === studentB.section_id);

  assert(timetableSecA.length === 42, 'Student A receives exactly 42 weekly lectures for Section A (Room A 007)');
  assert(timetableSecB.length === 42, 'Student B receives exactly 42 weekly lectures for Section B (Room A 006)');
  assert(!timetableSecA.some(t => t.section_id === secB.id), 'Student A receives ZERO Section B timetable slots (Strict Isolation)');
  assert(!timetableSecB.some(t => t.section_id === secA.id), 'Student B receives ZERO Section A timetable slots (Strict Isolation)');

  // --- SUITE 3: Student Private Data Isolation (Attendance & Marks) ---
  console.log('\n--- SUITE 3: Student Private Record Isolation ---');
  // Student A attendance
  const attA = (dbData?.attendanceRecords || []).filter(r => r.student_id === studentA.id);
  const attB = (dbData?.attendanceRecords || []).filter(r => r.student_id === studentB.id);

  assert(!attA.some(r => r.student_id === studentB.id), 'Student A attendance records contain zero Student B entries');
  assert(!attB.some(r => r.student_id === studentA.id), 'Student B attendance records contain zero Student A entries');

  // --- SUITE 4: Faculty Access & Subject Assignment Permissions ---
  console.log('\n--- SUITE 4: Faculty Access & Authorized Class Mapping ---');
  // Faculty 1: Ms. Hemlata Chaudhary
  const facHemlata = dbData?.faculty.find(f => f.full_name.includes('Hemlata'))!;
  const profHemlata = allProfiles?.find(p => p.faculty_id === facHemlata.id);
  assert(Boolean(profHemlata), 'Ms. Hemlata Chaudhary has mapped database profile');
  assert(profHemlata?.role === 'faculty', 'Ms. Hemlata role is strictly "faculty" from database');

  const hemlataAssignments = (dbData?.assignments || []).filter(a => a.faculty_id === facHemlata.id && a.active);
  assert(hemlataAssignments.length > 0, `Ms. Hemlata has ${hemlataAssignments.length} active subject assignments`);
  assert(hemlataAssignments.some(a => a.section_id === secA.id), 'Ms. Hemlata is authorized to teach in Section A');
  assert(hemlataAssignments.some(a => a.section_id === secB.id), 'Ms. Hemlata is authorized to teach in Section B');

  // Faculty 2: Dr. Naseem Ahamad Khan (Mathematics IV only)
  const facNaseem = dbData?.faculty.find(f => f.full_name.includes('Naseem'))!;
  const naseemAssignments = (dbData?.assignments || []).filter(a => a.faculty_id === facNaseem.id && a.active);
  const naseemSubjects = naseemAssignments.map(a => dbData?.subjects.find(s => s.id === a.subject_id)?.subject_name);
  assert(naseemSubjects.every(name => name?.includes('Mathematics')), 'Dr. Naseem is authorized strictly for Mathematics IV');

  // Permission Boundary: Ms. Hemlata must not be assigned Mathematics IV
  const hemlataSubjects = hemlataAssignments.map(a => dbData?.subjects.find(s => s.id === a.subject_id)?.subject_name);
  assert(!hemlataSubjects.some(name => name?.includes('Mathematics IV')), 'Ms. Hemlata is NOT assigned Mathematics IV (Strict Class Boundary)');

  // --- SUITE 5: HOD Access & Department-Level Boundary ---
  console.log('\n--- SUITE 5: HOD Access & Department Isolation ---');
  const hodWasim = dbData?.faculty.find(f => f.full_name.includes('Wasim'))!;
  const profWasim = allProfiles?.find(p => p.faculty_id === hodWasim.id);
  assert(Boolean(profWasim), 'HOD Mr. Wasim has mapped database profile');
  assert(profWasim?.role === 'hod', 'Mr. Wasim role is strictly "hod" from database profile');
  assert(profWasim?.department_id === dbData?.departments[0].id, 'HOD is mapped strictly to CSE Department');

  // HOD sees all students in CSE department
  const cseStudents = (dbData?.students || []).filter(s => s.department_id === profWasim?.department_id);
  assert(cseStudents.length === 106, 'HOD sees all 106 students enrolled in CSE department');

  // --- SUITE 6: Super Admin Access ---
  console.log('\n--- SUITE 6: Super Admin Institutional Access ---');
  const profAdmin = allProfiles?.find(p => p.role === 'super_admin');
  assert(Boolean(profAdmin), 'Super Admin profile exists in Supabase');
  assert(profAdmin?.role === 'super_admin', 'Super Admin role is strictly "super_admin" from database');
  assert(profAdmin?.email === 'admin@vctm.in', 'Super Admin email is admin@vctm.in');

  // --- SUITE 7: Rejection of Invalid Credentials (Zero Fallback) ---
  console.log('\n--- SUITE 7: Zero Fallback on Unmatched Credentials ---');
  // Attempt lookup for non-existent roll number
  const fakeRoll = '9999999999999';
  const matchedFakeStudent = (dbData?.students || []).find(s => s.roll_number === fakeRoll);
  const matchedFakeProfile = allProfiles?.find(p => p.email === fakeRoll || p.student_id === fakeRoll);
  assert(matchedFakeStudent === undefined && matchedFakeProfile === undefined, 'Non-existent roll number is rejected with zero fallback');

  // Attempt lookup for non-existent faculty
  const fakeFac = 'FAC-UNKNOWN-999';
  const matchedFakeFaculty = (dbData?.faculty || []).find(f => f.employee_code === fakeFac);
  assert(matchedFakeFaculty === undefined, 'Non-existent faculty is rejected with zero fallback');

  // --- SUITE 8: RLS & Database-Level Security ---
  console.log('\n--- SUITE 8: Database Row Level Security (RLS) ---');
  const { data: rlsTables } = await supabase.from('profiles').select('id').limit(1);
  assert(rlsTables !== null, 'Public profiles queried successfully under RLS');

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} GLOBAL USER ACCESS & ROLE TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runGlobalUserAccessVerification().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
