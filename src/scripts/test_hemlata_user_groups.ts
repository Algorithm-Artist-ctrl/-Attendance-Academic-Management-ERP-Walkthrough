import { supabase } from "../lib/supabase/supabaseClient";

async function debugHemlata() {
  const userId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';
  const role = 'faculty';

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, role, student_id, faculty_id, department_id')
    .eq('id', userId)
    .maybeSingle();

  console.log("Profile:", profile, "Error:", profErr);

  let facultyId = profile?.faculty_id || null;
  if (!facultyId) {
    const { data: fac } = await supabase
      .from('faculty')
      .select('id')
      .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();
    if (fac) facultyId = fac.id;
  }
  console.log("FacultyId resolved:", facultyId);

  const { data: groups, error: grpErr } = await supabase
    .from('message_groups')
    .select(`
      *,
      subject:subjects(id, subject_name, subject_code),
      section:sections(id, name, room_number),
      academic_year:academic_years(id, year_number, name),
      department:departments(id, name, code)
    `)
    .order('last_message_at', { ascending: false });

  console.log("Raw message_groups count from Supabase client:", groups ? groups.length : 0, "Error:", grpErr);

  if (facultyId) {
    const { data: fsaList, error: fsaErr } = await supabase
      .from('faculty_subject_assignments')
      .select('section_id, subject_id')
      .eq('faculty_id', facultyId)
      .eq('active', true);
    console.log("fsaList count:", fsaList ? fsaList.length : 0, "fsaList:", fsaList, "Error:", fsaErr);
  }
}

debugHemlata().catch(console.error);
