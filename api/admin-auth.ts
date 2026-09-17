import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obssoojzryqiudllnlkh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ic3Nvb2p6cnlxaXVkbGxubGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU0NzUsImV4cCI6MjEwMjk4MTQ3NX0.eFCU024aroXFpTqnOaVUOpOUpONBwm3KDDdLfzlZ5co';

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

function sendJson(res: any, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: any): Promise<any> {
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
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

export default async function handleAdminAuth(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const urlObj = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  try {
    // 1. Provision Student Account
    if (req.method === 'POST' && pathname === '/api/auth/provision-student') {
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
        actor_name = 'Super Admin',
      } = body;

      if (!roll_number || !full_name || !section_id) {
        return sendJson(res, 400, {
          success: false,
          error: 'Roll number, full name, and section ID are required.',
        });
      }

      // If Supabase Admin Auth API is available, ensure auth.users creation via admin API
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
        p_actor_name: actor_name,
      });

      if (rpcErr) {
        return sendJson(res, 500, { success: false, error: rpcErr.message });
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: 'Student account and Supabase Auth credentials provisioned successfully.',
      });
    }

    // 2. Provision Faculty Account
    if (req.method === 'POST' && pathname === '/api/auth/provision-faculty') {
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
        actor_name = 'Super Admin',
      } = body;

      if (!employee_code || !full_name || !email || !department_id) {
        return sendJson(res, 400, {
          success: false,
          error: 'Employee code, full name, official email, and department ID are required.',
        });
      }

      const targetEmail = email.trim().toLowerCase();

      // Optional Admin API pre-provisioning
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
        p_actor_name: actor_name,
      });

      if (rpcErr) {
        return sendJson(res, 500, { success: false, error: rpcErr.message });
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: 'Faculty account, assignments, and Supabase Auth credentials provisioned successfully.',
      });
    }

    // 3. Batch Reconcile Accounts
    if (req.method === 'POST' && pathname === '/api/auth/reconcile-accounts') {
      const { data: rpcData, error: rpcErr } = await supabaseRpc.rpc('reconcile_all_accounts');
      if (rpcErr) {
        return sendJson(res, 500, { success: false, error: rpcErr.message });
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: 'All unlinked student and faculty accounts reconciled successfully.',
      });
    }

    // 4. Update Account Credentials (Super Admin Only)
    if (req.method === 'POST' && pathname === '/api/auth/update-credentials') {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        return sendJson(res, 401, {
          success: false,
          error: 'Authentication token required.',
        });
      }

      // Verify token with Supabase Auth
      const { data: authUser, error: authUserErr } = await supabaseRpc.auth.getUser(token);
      if (authUserErr || !authUser?.user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Invalid or expired session token.',
        });
      }

      const callerUserId = authUser.user.id;
      // Fetch caller profile to verify super_admin role
      const { data: callerProfile } = await supabaseRpc
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', callerUserId)
        .maybeSingle();

      const isSuperAdmin = callerProfile?.role === 'super_admin' || authUser.user.user_metadata?.role === 'super_admin';
      if (!isSuperAdmin) {
        return sendJson(res, 403, {
          success: false,
          error: 'Unauthorized: Only Super Administrators can modify account credentials.',
        });
      }

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
        });
      }

      if ((!email || !email.trim()) && (!password || !password.trim())) {
        return sendJson(res, 400, {
          success: false,
          error: 'At least one of email or password must be provided.',
        });
      }

      const cleanEmail = email?.trim() ? email.trim().toLowerCase() : null;
      const cleanPassword = password?.trim() ? password.trim() : null;

      if (cleanPassword && cleanPassword.length < 6) {
        return sendJson(res, 400, {
          success: false,
          error: 'Password must be at least 6 characters in length.',
        });
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
        return sendJson(res, 500, { success: false, error: rpcErr.message });
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: 'Account credentials updated successfully and active immediately.',
      });
    }

    // 5. Update Account Status (Super Admin Only)
    if (req.method === 'POST' && pathname === '/api/auth/update-status') {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        return sendJson(res, 401, { success: false, error: 'Authentication token required.' });
      }

      const { data: authUser, error: authUserErr } = await supabaseRpc.auth.getUser(token);
      if (authUserErr || !authUser?.user) {
        return sendJson(res, 401, { success: false, error: 'Invalid or expired session token.' });
      }

      const callerUserId = authUser.user.id;
      const { data: callerProfile } = await supabaseRpc
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', callerUserId)
        .maybeSingle();

      if (callerProfile?.role !== 'super_admin' && authUser.user.user_metadata?.role !== 'super_admin') {
        return sendJson(res, 403, { success: false, error: 'Unauthorized: Only Super Administrators can modify account status.' });
      }

      const body = await readJsonBody(req);
      const { target_user_id, status, reason } = body;

      if (!target_user_id || !status) {
        return sendJson(res, 400, { success: false, error: 'Target user ID and status are required.' });
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
        return sendJson(res, 500, { success: false, error: rpcErr.message });
      }

      return sendJson(res, 200, {
        success: true,
        data: rpcData,
        message: `Account status updated to ${status}.`,
      });
    }

    return sendJson(res, 404, { success: false, error: 'Auth API endpoint not found.' });
  } catch (error: any) {
    console.error('Admin Auth Handler Error:', error);
    return sendJson(res, 500, { success: false, error: error?.message || 'Internal server error' });
  }
}
