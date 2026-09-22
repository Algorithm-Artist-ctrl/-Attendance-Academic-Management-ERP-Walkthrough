import { createClient } from '@supabase/supabase-js';

const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || dummyKey;


// Server-side privileged client (if service role key provided)
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// Fallback client using anon key to invoke SECURITY DEFINER RPC functions
const supabaseRpc = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function getAllowedOrigin(req: any): string {
  const origin = req.headers?.origin || req.headers?.Origin || '';
  if (!origin) return '';
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.onrender.com') ||
      host.endsWith('.vctm.in')
    ) {
      return origin;
    }
  } catch {}
  return '';
}

function sendJson(res: any, status: number, data: any, req?: any) {
  const allowedOrigin = req ? getAllowedOrigin(req) : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
  };
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: any): Promise<any> {
  if (req._parsedBody !== undefined) return req._parsedBody;
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        req._parsedBody = parsed;
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
    if (req.readableEnded) {
      try {
        const parsed = body ? JSON.parse(body) : {};
        req._parsedBody = parsed;
        resolve(parsed);
      } catch {
        resolve({});
      }
    }
  });
}

/**
 * Authoritative Super Admin Verification via Supabase Auth & profiles table
 */
async function verifySuperAdmin(req: any): Promise<{ authorized: boolean; user?: any; profile?: any; dbClient?: any; error?: string; status?: number }> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { authorized: false, status: 401, error: 'Authentication token required.' };
  }

  const { data: authUser, error: authUserErr } = await supabaseRpc.auth.getUser(token);
  if (authUserErr || !authUser?.user) {
    return { authorized: false, status: 401, error: 'Invalid or expired session token.' };
  }

  const callerUserId = authUser.user.id;
  const dbClient = supabaseAdmin || createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile, error: profileErr } = await dbClient
    .from('profiles')
    .select('id, full_name, role, status')
    .eq('id', callerUserId)
    .maybeSingle();

  if (profileErr || !callerProfile) {
    return { authorized: false, status: 403, error: 'User profile not found.' };
  }

  if (callerProfile.status && callerProfile.status !== 'ACTIVE') {
    return { authorized: false, status: 403, error: 'Account is not active.' };
  }

  const isSuperAdmin = callerProfile.role === 'super_admin';
  if (!isSuperAdmin) {
    return { authorized: false, status: 403, error: 'Unauthorized: Only Super Administrators can perform this action.' };
  }

  return { authorized: true, user: authUser.user, profile: callerProfile, dbClient };
}

export default async function handleAdminAuth(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    const allowedOrigin = getAllowedOrigin(req);
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = allowedOrigin;
      headers['Vary'] = 'Origin';
    }
    res.writeHead(204, headers);
    return res.end();
  }

  // Pre-parse JSON body immediately on request entry to prevent stream consumption deadlock
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      req._parsedBody = await readJsonBody(req);
    } catch {
      req._parsedBody = {};
    }
  }

  const urlObj = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  try {
    // 1. Provision Student Account (Super Admin Only)
    if (req.method === 'POST' && pathname === '/api/auth/provision-student') {
      const authCheck = await verifySuperAdmin(req);
      if (!authCheck.authorized) {
        return sendJson(res, authCheck.status || 401, { success: false, error: authCheck.error }, req);
      }

      const body = await readJsonBody(req);
      const {
        roll_number,
        full_name,
        section_id,
        admission_type = 'Regular',
        email,
        password = 'student123',
        phone,
        mentor_faculty_id,
      } = body;

      if (!roll_number || !full_name || !section_id) {
        return sendJson(res, 400, {
          success: false,
          error: 'Roll number, full name, and section ID are required.',
        }, req);
      }

      const targetEmail = email?.trim() || `${roll_number.trim().toLowerCase()}@student.vctm.in`;

      if (supabaseAdmin) {
        try {
          const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email: targetEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              roll_number: roll_number.trim().toUpperCase(),
              full_name: full_name.trim().toUpperCase(),
            },
          });
          if (authErr && !authErr.message.includes('already exists') && !authErr.message.includes('already registered')) {
            console.warn('Supabase Admin createUser notice:', authErr.message);
          }
        } catch (adminErr: any) {
          console.warn('Admin auth API call warning:', adminErr.message);
        }
      }

      // Execute authoritative atomic database procedure
      const { data: rpcData, error: rpcErr } = await supabaseRpc.rpc('provision_student_account', {
        p_roll_number: roll_number.trim().toUpperCase(),
        p_full_name: full_name.trim().toUpperCase(),
        p_section_id: section_id,
        p_admission_type: admission_type,
        p_email: targetEmail,
        p_password: password,
        p_phone: phone || null,
        p_mentor_faculty_id: mentor_faculty_id || null,
        p_actor_name: authCheck.profile?.full_name || 'Super Admin',
      });

      if (rpcErr) {
        return sendJson(res, 500, { success: false, error: rpcErr.message }, req);
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: 'Student account and Supabase Auth credentials provisioned successfully.',
      }, req);
    }

    // 2. Provision Faculty Account (Super Admin Only)
    if (req.method === 'POST' && pathname === '/api/auth/provision-faculty') {
      const authCheck = await verifySuperAdmin(req);
      if (!authCheck.authorized) {
        return sendJson(res, authCheck.status || 401, { success: false, error: authCheck.error }, req);
      }

      const body = await readJsonBody(req);
      const {
        employee_code,
        full_name,
        email,
        department_id,
        designation = 'Assistant Professor',
        faculty_code,
        password = 'faculty@123',
        phone,
        assignments = [],
      } = body;

      if (!employee_code || !full_name || !email || !department_id) {
        return sendJson(res, 400, {
          success: false,
          error: 'Employee code, full name, official email, and department ID are required.',
        }, req);
      }

      const targetEmail = email.trim().toLowerCase();

      if (supabaseAdmin) {
        try {
          const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email: targetEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              employee_code: employee_code.trim().toUpperCase(),
              full_name: full_name.trim(),
            },
          });
          if (authErr && !authErr.message.includes('already exists') && !authErr.message.includes('already registered')) {
            console.warn('Supabase Admin createUser notice:', authErr.message);
          }
        } catch (adminErr: any) {
          console.warn('Admin auth API call warning:', adminErr.message);
        }
      }

      // Execute authoritative atomic database procedure
      const { data: rpcData, error: rpcErr } = await supabaseRpc.rpc('provision_faculty_account', {
        p_employee_code: employee_code.trim().toUpperCase(),
        p_full_name: full_name.trim(),
        p_email: targetEmail,
        p_department_id: department_id,
        p_designation: designation.trim(),
        p_faculty_code: faculty_code?.trim().toUpperCase() || null,
        p_password: password,
        p_phone: phone || null,
        p_assignments: assignments,
        p_actor_name: authCheck.profile?.full_name || 'Super Admin',
      });

      if (rpcErr) {
        return sendJson(res, 500, { success: false, error: rpcErr.message }, req);
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: 'Faculty account, assignments, and Supabase Auth credentials provisioned successfully.',
      }, req);
    }

    // 3. Batch Reconcile Accounts (Super Admin Only)
    if (req.method === 'POST' && pathname === '/api/auth/reconcile-accounts') {
      const authCheck = await verifySuperAdmin(req);
      if (!authCheck.authorized) {
        return sendJson(res, authCheck.status || 401, { success: false, error: authCheck.error }, req);
      }

      const { data: rpcData, error: rpcErr } = await supabaseRpc.rpc('reconcile_all_accounts');
      if (rpcErr) {
        return sendJson(res, 500, { success: false, error: rpcErr.message }, req);
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: 'All unlinked student and faculty accounts reconciled successfully.',
      }, req);
    }

    // 4. Update Account Credentials (Super Admin Only)
    if (req.method === 'POST' && pathname === '/api/auth/update-credentials') {
      const authCheck = await verifySuperAdmin(req);
      if (!authCheck.authorized) {
        return sendJson(res, authCheck.status || 401, { success: false, error: authCheck.error }, req);
      }

      const callerUserId = authCheck.user.id;
      const callerProfile = authCheck.profile;

      const body = await readJsonBody(req);
      const {
        target_user_id,
        email,
        password,
        is_default_password = false,
      } = body;

      if (!target_user_id) {
        return sendJson(res, 400, {
          success: false,
          error: 'Target user ID is required.',
        }, req);
      }

      if ((!email || !email.trim()) && (!password || !password.trim())) {
        return sendJson(res, 400, {
          success: false,
          error: 'At least one of email or password must be provided.',
        }, req);
      }

      const cleanEmail = email?.trim() ? email.trim().toLowerCase() : null;
      const cleanPassword = password?.trim() ? password.trim() : null;

      if (cleanPassword && cleanPassword.length < 6) {
        return sendJson(res, 400, {
          success: false,
          error: 'Password must be at least 6 characters in length.',
        }, req);
      }

      // If Supabase Admin client is available (service role), sync Auth User directly
      if (supabaseAdmin) {
        try {
          const updatePayload: any = {};
          if (cleanEmail) {
            updatePayload.email = cleanEmail;
            updatePayload.email_confirm = true;
          }
          if (cleanPassword) {
            updatePayload.password = cleanPassword;
          }
          const { error: adminAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
            target_user_id,
            updatePayload
          );
          if (adminAuthErr) {
            console.warn('Supabase Admin updateUserById notice:', adminAuthErr.message);
          }
        } catch (adminErr: any) {
          console.warn('Supabase Admin API call notice:', adminErr.message);
        }
      }

      // Authoritative database update via SECURITY DEFINER RPC
      const { data: rpcData, error: rpcErr } = await supabaseRpc.rpc('admin_update_account_credentials', {
        p_target_user_id: target_user_id,
        p_new_email: cleanEmail,
        p_new_password: cleanPassword,
        p_is_default_password: Boolean(is_default_password),
        p_actor_id: callerUserId,
        p_actor_name: callerProfile?.full_name || 'Super Admin',
        p_actor_role: 'super_admin',
      });

      if (rpcErr) {
        return sendJson(res, 500, { success: false, error: rpcErr.message }, req);
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: 'Account credentials updated successfully and active immediately.',
      }, req);
    }

    // 5. Update Account Status (Super Admin Only)
    if (req.method === 'POST' && pathname === '/api/auth/update-status') {
      const authCheck = await verifySuperAdmin(req);
      if (!authCheck.authorized) {
        return sendJson(res, authCheck.status || 401, { success: false, error: authCheck.error }, req);
      }

      const callerUserId = authCheck.user.id;
      const callerProfile = authCheck.profile;

      const body = await readJsonBody(req);
      const { target_user_id, status, reason } = body;

      if (!target_user_id || !status) {
        return sendJson(res, 400, { success: false, error: 'Target user ID and status are required.' }, req);
      }

      const { data: rpcData, error: rpcErr } = await supabaseRpc.rpc('update_account_status', {
        p_target_user_id: target_user_id,
        p_target_status: status,
        p_actor_id: callerUserId,
        p_actor_name: callerProfile?.full_name || 'Super Admin',
        p_actor_role: 'super_admin',
        p_reason: reason || null,
      });

      if (rpcErr) {
        return sendJson(res, 500, { success: false, error: rpcErr.message }, req);
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: `Account status updated to ${status}.`,
      }, req);
    }

    // 6. Fetch Account Dependencies (Super Admin Only)
    if (req.method === 'GET' && pathname === '/api/auth/account-dependencies') {
      const authCheck = await verifySuperAdmin(req);
      if (!authCheck.authorized) {
        return sendJson(res, authCheck.status || 401, { success: false, error: authCheck.error }, req);
      }

      const dbClient = authCheck.dbClient || supabaseAdmin || supabaseRpc;
      const targetId = urlObj.searchParams.get('id') || urlObj.searchParams.get('target_id');
      const role = (urlObj.searchParams.get('role') || urlObj.searchParams.get('entity_type') || '').toLowerCase();

      if (!targetId || !role) {
        return sendJson(res, 400, { success: false, error: 'Target ID and role (student/faculty) are required.' }, req);
      }

      if (role === 'student') {
        const { data: student, error: stErr } = await dbClient
          .from('students')
          .select('id, full_name, roll_number, status, active, email, auth_user_id')
          .eq('id', targetId)
          .maybeSingle();

        if (stErr || !student) {
          return sendJson(res, 404, { success: false, error: 'Student record not found.' }, req);
        }

        const [
          { count: attCount },
          { count: marksCount },
          { count: quizCount },
          { count: subCount },
          { count: leaveCount },
          { count: notifCount },
          { count: msgCount },
        ] = await Promise.all([
          dbClient.from('attendance_records').select('*', { count: 'exact', head: true }).eq('student_id', targetId),
          dbClient.from('sessional_marks').select('*', { count: 'exact', head: true }).eq('student_id', targetId),
          dbClient.from('quiz_results').select('*', { count: 'exact', head: true }).eq('student_id', targetId),
          dbClient.from('assignment_submissions').select('*', { count: 'exact', head: true }).eq('student_id', targetId),
          dbClient.from('leave_applications').select('*', { count: 'exact', head: true }).eq('student_id', targetId),
          dbClient.from('notifications').select('*', { count: 'exact', head: true }).or(`recipient_student_id.eq.${targetId}${student.auth_user_id ? `,recipient_user_id.eq.${student.auth_user_id}` : ''}`),
          student.auth_user_id
            ? dbClient.from('messages').select('*', { count: 'exact', head: true }).or(`sender_user_id.eq.${student.auth_user_id},receiver_user_id.eq.${student.auth_user_id},student_id.eq.${targetId}`)
            : dbClient.from('messages').select('*', { count: 'exact', head: true }).eq('student_id', targetId),
        ]);

        const dependencies = {
          'Attendance Records': attCount || 0,
          'Assessment & Sessional Marks': marksCount || 0,
          'Quiz Results': quizCount || 0,
          'Assignment Submissions': subCount || 0,
          'Leave Applications': leaveCount || 0,
          'Notifications': notifCount || 0,
          'Direct Messages': msgCount || 0,
        };

        return sendJson(res, 200, {
          success: true,
          dependencies,
          targetDetails: {
            id: student.id,
            name: student.full_name,
            role: 'student',
            identifier: student.roll_number,
            status: student.status || (student.active ? 'ACTIVE' : 'ARCHIVED'),
            email: student.email || `${student.roll_number.toLowerCase()}@student.vctm.in`,
          },
        }, req);
      } else if (role === 'faculty') {
        const { data: fac, error: facErr } = await dbClient
          .from('faculty')
          .select('id, full_name, employee_code, status, active, email, auth_user_id')
          .eq('id', targetId)
          .maybeSingle();

        if (facErr || !fac) {
          return sendJson(res, 404, { success: false, error: 'Faculty record not found.' }, req);
        }

        const [
          { count: sessCount },
          { count: assessCount },
          { count: quizCount },
          { count: assignCount },
          { count: facAssignCount },
          { count: leaveCount },
          { count: notifCount },
          { count: msgCount },
        ] = await Promise.all([
          dbClient.from('attendance_sessions').select('*', { count: 'exact', head: true }).eq('faculty_id', targetId),
          dbClient.from('sessional_assessments').select('*', { count: 'exact', head: true }).eq('faculty_id', targetId),
          dbClient.from('quizzes').select('*', { count: 'exact', head: true }).eq('faculty_id', targetId),
          dbClient.from('assignments').select('*', { count: 'exact', head: true }).eq('faculty_id', targetId),
          dbClient.from('faculty_subject_assignments').select('*', { count: 'exact', head: true }).eq('faculty_id', targetId),
          dbClient.from('leave_applications').select('*', { count: 'exact', head: true }).or(`coordinator_id.eq.${targetId},hod_id.eq.${targetId}`),
          fac.auth_user_id
            ? dbClient.from('notifications').select('*', { count: 'exact', head: true }).or(`recipient_user_id.eq.${fac.auth_user_id},recipient_faculty_id.eq.${targetId}`)
            : dbClient.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_faculty_id', targetId),
          fac.auth_user_id
            ? dbClient.from('messages').select('*', { count: 'exact', head: true }).or(`sender_user_id.eq.${fac.auth_user_id},receiver_user_id.eq.${fac.auth_user_id},faculty_id.eq.${targetId}`)
            : dbClient.from('messages').select('*', { count: 'exact', head: true }).eq('faculty_id', targetId),
        ]);

        const dependencies = {
          'Attendance Sessions Taken': sessCount || 0,
          'Sessional Assessments Created': assessCount || 0,
          'Quizzes Created': quizCount || 0,
          'Course Assignments': assignCount || 0,
          'Subject Teaching Assignments': facAssignCount || 0,
          'Leave Requests': leaveCount || 0,
          'Notifications': notifCount || 0,
          'Direct Messages': msgCount || 0,
        };

        return sendJson(res, 200, {
          success: true,
          dependencies,
          targetDetails: {
            id: fac.id,
            name: fac.full_name,
            role: 'faculty',
            identifier: fac.employee_code,
            status: fac.status || (fac.active ? 'ACTIVE' : 'ARCHIVED'),
            email: fac.email,
          },
        }, req);
      } else {
        return sendJson(res, 400, { success: false, error: 'Invalid role. Must be student or faculty.' }, req);
      }
    }

    // 7. Permanent Delete Archived Account (Super Admin Only)
    if (req.method === 'POST' && pathname === '/api/auth/permanent-delete') {
      const authCheck = await verifySuperAdmin(req);
      if (!authCheck.authorized) {
        return sendJson(res, authCheck.status || 401, { success: false, error: authCheck.error }, req);
      }

      const dbClient = authCheck.dbClient || supabaseAdmin || supabaseRpc;
      const callerUserId = authCheck.user.id;
      const body = await readJsonBody(req);
      const targetId = body.id || body.target_id;
      const role = (body.role || body.entity_type || '').toLowerCase();
      const confirmation = body.confirmation;

      if (!targetId || !role) {
        return sendJson(res, 400, { success: false, error: 'Target ID and role (student/faculty) are required.' }, req);
      }

      if (confirmation !== 'DELETE') {
        return sendJson(res, 400, {
          success: false,
          error: 'Safety verification failed: You must type DELETE to confirm permanent deletion.',
        }, req);
      }

      // Execute authoritative PostgreSQL atomic cascade deletion RPC
      const { data: rpcData, error: rpcErr } = await dbClient.rpc('permanent_delete_archived_account', {
        p_target_id: targetId,
        p_entity_type: role,
        p_actor_id: callerUserId,
      });

      if (rpcErr) {
        return sendJson(res, 400, { success: false, error: rpcErr.message }, req);
      }

      // Purge Supabase Auth user if targetAuthUserId is returned and supabaseAdmin is available
      const targetAuthUserId = rpcData?.target_auth_user_id || rpcData?.auth_user_id;
      if (targetAuthUserId && supabaseAdmin) {
        try {
          const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(targetAuthUserId);
          if (delAuthErr) {
            console.warn('Supabase Admin deleteUser notice:', delAuthErr.message);
          }
        } catch (adminErr: any) {
          console.warn('Supabase Admin deleteUser call exception:', adminErr?.message);
        }
      }

      return sendJson(res, 200, {
        success: true,
        message: rpcData?.message || 'Account and all associated records permanently purged.',
        purged_records: rpcData?.purged_records || {},
      }, req);
    }

    return sendJson(res, 404, { success: false, error: 'Auth API endpoint not found.' }, req);
  } catch (error: any) {
    console.error('Admin Auth Handler Error:', error);
    return sendJson(res, 500, { success: false, error: error?.message || 'Internal server error' }, req);
  }
}
