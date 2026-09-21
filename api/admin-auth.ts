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
async function verifySuperAdmin(req: any): Promise<{ authorized: boolean; user?: any; profile?: any; error?: string; status?: number }> {
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
  const { data: callerProfile, error: profileErr } = await supabaseRpc
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

  return { authorized: true, user: authUser.user, profile: callerProfile };
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

    return sendJson(res, 404, { success: false, error: 'Auth API endpoint not found.' }, req);
  } catch (error: any) {
    console.error('Admin Auth Handler Error:', error);
    return sendJson(res, 500, { success: false, error: error?.message || 'Internal server error' }, req);
  }
}
