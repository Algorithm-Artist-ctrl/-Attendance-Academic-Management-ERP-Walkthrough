import pg from 'pg';

const connectionString = 'postgresql://postgres:Tarun%40759977@db.obssoojzryqiudllnlkh.supabase.co:5432/postgres';

export const DEFAULT_PASSWORDS: Record<string, string> = {
  super_admin: 'VctmAdmin@2026',
  hod: 'VctmHod@2026',
  faculty: 'VctmFaculty@2026',
  student: 'VctmStudent@2026',
};

export async function provisionAllAuthUsers() {
  console.log('================================================================');
  console.log('  VCTM ERP — PROVISIONING INSTITUTIONAL PROFILES TO SUPABASE AUTH');
  console.log('================================================================\n');

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // 1. Fetch all profiles from public.profiles
    const profilesRes = await client.query(`
      SELECT id, email, role, full_name, student_id, faculty_id 
      FROM public.profiles 
      ORDER BY role, email;
    `);
    const profiles = profilesRes.rows;
    console.log(`Found ${profiles.length} profiles in public.profiles.`);

    // 2. Fetch existing auth users
    const authUsersRes = await client.query(`
      SELECT id, email, encrypted_password, email_confirmed_at 
      FROM auth.users;
    `);
    const existingAuthMap = new Map(authUsersRes.rows.map(u => [u.email.toLowerCase(), u]));
    const existingIdMap = new Map(authUsersRes.rows.map(u => [u.id, u]));

    let createdCount = 0;
    let updatedCount = 0;

    for (const profile of profiles) {
      const email = profile.email.toLowerCase().trim();
      const role = profile.role || 'student';
      const defaultPassword = DEFAULT_PASSWORDS[role] || 'VctmStudent@2026';

      // Check if user exists by email or by ID
      const existingUser = existingAuthMap.get(email) || existingIdMap.get(profile.id);

      if (!existingUser) {
        // Compute bcrypt hash with cost 10
        const hashRes = await client.query(`SELECT crypt($1::text, gen_salt('bf', 10)) as h;`, [defaultPassword]);
        const passwordHash = hashRes.rows[0].h;

        // Insert into auth.users with exact profile.id
        await client.query(`
          INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, phone_change_token, email_change_token_current
          ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            $1::uuid,
            'authenticated',
            'authenticated',
            $2::text,
            $3::text,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            json_build_object('sub', $1::text, 'email', $2::text, 'role', $4::text, 'full_name', $5::text),
            NOW(),
            NOW(),
            '', '', '', '', '', '', ''
          )
          ON CONFLICT (id) DO UPDATE SET 
            email = EXCLUDED.email,
            email_confirmed_at = NOW(),
            raw_user_meta_data = EXCLUDED.raw_user_meta_data;
        `, [profile.id, email, passwordHash, role, profile.full_name]);

        // Insert matching auth.identities
        await client.query(`
          INSERT INTO auth.identities (
            id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            $1::text,
            $1::uuid,
            json_build_object('sub', $1::text, 'email', $2::text, 'role', $3::text, 'email_verified', false, 'phone_verified', false),
            'email',
            NOW(),
            NOW(),
            NOW()
          )
          ON CONFLICT (provider_id, provider) DO UPDATE SET 
            identity_data = EXCLUDED.identity_data,
            updated_at = NOW();
        `, [profile.id, email, role]);

        createdCount++;
      } else {
        // User already exists; ensure email is confirmed and metadata set
        await client.query(`
          UPDATE auth.users 
          SET 
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = json_build_object('sub', id::text, 'email', email, 'role', $2::text, 'full_name', $3::text)
          WHERE id = $1;
        `, [existingUser.id, role, profile.full_name]);

        // Ensure matching identity exists
        await client.query(`
          INSERT INTO auth.identities (
            id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            $1::text,
            $1::uuid,
            json_build_object('sub', $1::text, 'email', $2::text, 'role', $3::text, 'email_verified', false, 'phone_verified', false),
            'email',
            NOW(),
            NOW(),
            NOW()
          )
          ON CONFLICT (provider_id, provider) DO UPDATE SET 
            identity_data = EXCLUDED.identity_data,
            updated_at = NOW();
        `, [existingUser.id, email, role]);

        // If existingUser ID differed from profile ID, sync profile ID to auth.users ID
        if (existingUser.id !== profile.id) {
          await client.query(`
            UPDATE public.profiles 
            SET id = $1 
            WHERE email = $2;
          `, [existingUser.id, email]);
        }

        updatedCount++;
      }

      // If faculty, update public.faculty.auth_user_id
      if (profile.faculty_id) {
        await client.query(`
          UPDATE public.faculty 
          SET auth_user_id = $1 
          WHERE id = $2;
        `, [profile.id, profile.faculty_id]);
      }
    }

    console.log(`✓ Created ${createdCount} new Supabase Auth accounts.`);
    console.log(`✓ Verified & updated ${updatedCount} existing Supabase Auth accounts.`);

    // 3. Final verification of auth.users count
    const finalAuth = await client.query('SELECT count(*) FROM auth.users;');
    console.log(`\nTotal verified Supabase Auth accounts in auth.users: ${finalAuth.rows[0].count}`);

  } catch (err: any) {
    console.error('Provisioning error:', err);
    throw err;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (process.argv[1]?.includes('provision_supabase_auth_users')) {
  provisionAllAuthUsers()
    .then(() => {
      console.log('\n✅ All institutional profiles successfully provisioned into Supabase Auth!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Provisioning failed:', err);
      process.exit(1);
    });
}
