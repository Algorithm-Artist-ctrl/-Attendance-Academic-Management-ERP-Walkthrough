import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, Student, Faculty, Section } from '../types/database.types';
import { AuthState, LoginCredentials, SignUpData } from '../types/auth.types';
import { supabase } from '../lib/supabase/supabaseClient';
import { erpStorage } from '../lib/storage/erpStorage';

export interface UserProfileUpdates {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  designation?: string;
  employee_code?: string;
  faculty_code?: string;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  changeEmail: (newEmail: string) => Promise<{ success: boolean; error?: string; pendingVerification?: boolean }>;
  resendEmailVerification: (emailToResend?: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordForEmail: (rawIdentifier: string) => Promise<{ success: boolean; error?: string; email?: string }>;
  completePasswordRecovery: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  cancelPasswordRecovery: () => void;
  sendEmailOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  updateUserProfile: (updates: UserProfileUpdates) => Promise<{ success: boolean; error?: string }>;
  resolveUserEmail: (rawIdentifier: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    isPasswordRecovery: false,
    pendingNewEmail: null,
  });

  // Helper to resolve official email from any identifier (Roll Number, Employee ID, Faculty Code, 'admin')
  const resolveUserEmail = async (rawIdentifier: string): Promise<string | null> => {
    const trimmed = rawIdentifier.trim();
    if (!trimmed) return null;

    // 1. Direct email provided
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }

    const clean = trimmed.toLowerCase();
    if (clean === 'admin') {
      return 'admin@vctm.in';
    }

    try {
      const cleanRoll = trimmed.replace(/[\s\-_]/g, '');

      // 2. Search student roll number
      const { data: student } = await supabase
        .from('students')
        .select('id, email, roll_number')
        .ilike('roll_number', cleanRoll)
        .maybeSingle();

      if (student) {
        if (student.email) return student.email.toLowerCase().trim();
        const { data: prof } = await supabase
          .from('profiles')
          .select('email')
          .eq('student_id', student.id)
          .maybeSingle();
        if (prof?.email) return prof.email.toLowerCase().trim();
        return `${cleanRoll}@vctm.in`;
      }

      // 3. Search faculty by employee code or faculty code
      const { data: facultyMember } = await supabase
        .from('faculty')
        .select('email, employee_code, faculty_code')
        .or(`employee_code.ilike.${trimmed},employee_code.ilike.${cleanRoll},faculty_code.ilike.${trimmed},faculty_code.ilike.${cleanRoll}`)
        .maybeSingle();

      if (facultyMember?.email) {
        return facultyMember.email.toLowerCase().trim();
      }

      // 4. Search profiles directly
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .or(`id.eq.${trimmed},email.ilike.${trimmed}`)
        .maybeSingle();

      if (profile?.email) {
        return profile.email.toLowerCase().trim();
      }
    } catch (err) {
      console.warn('Error resolving identifier to email:', err);
    }

    return null;
  };

  // Helper to load and deeply hydrate user profile from authenticated Supabase identity
  const loadHydratedProfile = async (authUserId: string, authUserEmail?: string, authUser?: any): Promise<UserProfile | null> => {
    try {
      // 1. Query profile by authenticated UUID or email
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      if (!profile && authUserEmail) {
        const { data: profByEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', authUserEmail.toLowerCase().trim())
          .maybeSingle();
        profile = profByEmail;
      }

      if (!profile) return null;

      // 2. Check if email was confirmed & changed in Supabase Auth (authoritative synchronization)
      if (authUser?.email && profile.email && authUser.email.toLowerCase().trim() !== profile.email.toLowerCase().trim()) {
        const confirmedNewEmail = authUser.email.toLowerCase().trim();
        try {
          await supabase
            .from('profiles')
            .update({ email: confirmedNewEmail, updated_at: new Date().toISOString() })
            .eq('id', profile.id);

          if (profile.student_id || profile.role === 'student') {
            const sid = profile.student_id || profile.id;
            await supabase
              .from('students')
              .update({ email: confirmedNewEmail, updated_at: new Date().toISOString() })
              .eq('id', sid);
          }

          if (profile.faculty_id || profile.role === 'faculty' || profile.role === 'hod') {
            const fid = profile.faculty_id || profile.id;
            await supabase
              .from('faculty')
              .update({ email: confirmedNewEmail, updated_at: new Date().toISOString() })
              .eq('id', fid);
          }

          profile.email = confirmedNewEmail;
        } catch (syncErr) {
          console.warn('Notice: Background sync of confirmed email to database tables:', syncErr);
        }
      }

      // Attach authoritative Supabase Auth verification state
      profile.email_confirmed_at = authUser?.email_confirmed_at || null;
      profile.new_email = authUser?.new_email || null;
      profile.pending_email = authUser?.new_email || null;

      // 3. Deeply hydrate student profile with section authority
      if (profile.role === 'student' || profile.student_id) {
        const studId = profile.student_id || profile.id;
        const { data: student } = await supabase
          .from('students')
          .select('*, section:sections(*)')
          .eq('id', studId)
          .maybeSingle();

        if (student) {
          return {
            ...profile,
            student_id: student.id,
            student: {
              ...student,
              section_id: (student.section as any)?.id || student.section_id,
            },
          };
        }
      }

      // 4. Deeply hydrate faculty profile
      if (profile.role === 'faculty' || profile.role === 'hod' || profile.faculty_id) {
        const facId = profile.faculty_id || profile.id;
        const { data: fac } = await supabase
          .from('faculty')
          .select('*')
          .eq('id', facId)
          .maybeSingle();

        if (fac) {
          return {
            ...profile,
            faculty_id: fac.id,
            faculty: fac,
          };
        }
      }

      return profile;
    } catch (err) {
      console.error('Failed to load hydrated profile:', err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Check if current URL parameters indicate a password recovery session
    const isRecoverySession = typeof window !== 'undefined' && (
      window.location.hash.includes('type=recovery') ||
      window.location.search.includes('type=recovery')
    );

    // Restore authenticated session directly from Supabase Auth (Single Authority)
    const restoreSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session || !session.user) {
          if (isMounted) {
            erpStorage.setCurrentSessionUser(null);
            setAuthState({
              user: null,
              role: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
              isPasswordRecovery: isRecoverySession,
              pendingNewEmail: null,
            });
          }
          return;
        }

        const profile = await loadHydratedProfile(session.user.id, session.user.email, session.user);
        if (isMounted) {
          if (profile) {
            erpStorage.setCurrentSessionUser(profile);
            setAuthState({
              user: profile,
              role: profile.role,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              isPasswordRecovery: isRecoverySession,
              pendingNewEmail: session.user.new_email || null,
            });
          } else {
            erpStorage.setCurrentSessionUser(null);
            setAuthState({
              user: null,
              role: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
              isPasswordRecovery: isRecoverySession,
              pendingNewEmail: null,
            });
          }
        }
      } catch {
        if (isMounted) {
          erpStorage.setCurrentSessionUser(null);
          setAuthState({
            user: null,
            role: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            isPasswordRecovery: isRecoverySession,
            pendingNewEmail: null,
          });
        }
      }
    };

    restoreSession();

    // Listen to Supabase Auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (isMounted) {
          if (session?.user) {
            const profile = await loadHydratedProfile(session.user.id, session.user.email, session.user);
            if (profile) erpStorage.setCurrentSessionUser(profile);
            setAuthState(prev => ({
              ...prev,
              user: profile || prev.user,
              role: profile?.role || prev.role,
              isAuthenticated: true,
              isLoading: false,
              isPasswordRecovery: true,
              pendingNewEmail: session.user.new_email || null,
            }));
          } else {
            setAuthState(prev => ({
              ...prev,
              isPasswordRecovery: true,
              isLoading: false,
            }));
          }
        }
      } else if (event === 'SIGNED_OUT' || !session || !session.user) {
        if (isMounted) {
          erpStorage.setCurrentSessionUser(null);
          setAuthState({
            user: null,
            role: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            isPasswordRecovery: false,
            pendingNewEmail: null,
          });
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const profile = await loadHydratedProfile(session.user.id, session.user.email, session.user);
        if (isMounted && profile) {
          erpStorage.setCurrentSessionUser(profile);
          setAuthState(prev => ({
            ...prev,
            user: profile,
            role: profile.role,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            pendingNewEmail: session.user.new_email || null,
          }));
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    const rawId = credentials.identifier?.trim();
    const rawPass = credentials.password;

    // Reject empty identifier or password immediately
    if (!rawId || !rawPass || !rawPass.trim()) {
      const errorMsg = 'Invalid email or password.';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      return { success: false, error: errorMsg };
    }

    // Resolve official registered email address
    const email = await resolveUserEmail(rawId);
    if (!email) {
      // Identifier not found in institutional catalog -> generic failure
      const errorMsg = 'Invalid email or password.';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      return { success: false, error: errorMsg };
    }

    // AUTHENTICATE WITH REAL SUPABASE AUTH (SOLE AUTHORITY)
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: rawPass,
    });

    if (authError || !data.session || !data.user) {
      // Authentication failed — Ensure any residual session/token is completely destroyed
      await supabase.auth.signOut().catch(() => {});
      erpStorage.setCurrentSessionUser(null);
      const errorMsg = 'Invalid email or password.';
      setAuthState({
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMsg,
        isPasswordRecovery: false,
        pendingNewEmail: null,
      });
      return { success: false, error: errorMsg };
    }

    // Retrieve authenticated identity & hydrate database profile
    const hydratedProfile = await loadHydratedProfile(data.user.id, data.user.email, data.user);
    if (!hydratedProfile) {
      await supabase.auth.signOut();
      erpStorage.setCurrentSessionUser(null);
      const errorMsg = 'No active institutional profile found for this account. Please contact administrator.';
      setAuthState({
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMsg,
        isPasswordRecovery: false,
        pendingNewEmail: null,
      });
      return { success: false, error: errorMsg };
    }

    // Session successfully established
    erpStorage.setCurrentSessionUser(hydratedProfile);
    try {
      erpStorage.addAuditLog('USER_LOGGED_IN', 'profiles', hydratedProfile.id, undefined, { email });
    } catch {}

    setAuthState({
      user: hydratedProfile,
      role: hydratedProfile.role,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      isPasswordRecovery: false,
      pendingNewEmail: data.user.new_email || null,
    });

    return { success: true };
  };

  const logout = async (): Promise<void> => {
    const user = authState.user;
    if (user) {
      try {
        erpStorage.addAuditLog('USER_LOGGED_OUT', 'profiles', user.id);
      } catch {}
    }
    await supabase.auth.signOut();
    erpStorage.setCurrentSessionUser(null);
    setAuthState({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isPasswordRecovery: false,
      pendingNewEmail: null,
    });
  };

  // Normal sign-up: Does NOT force email confirmation before accessing ERP
  const signUp = async (data: SignUpData): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPass = data.password;
    const cleanName = data.fullName.trim();

    if (!cleanEmail || !cleanPass || !cleanName) {
      const errorMsg = 'Please provide all required fields.';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      return { success: false, error: errorMsg };
    }

    try {
      // 1. Create Supabase Auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPass,
        options: {
          data: {
            full_name: cleanName,
            role: data.role,
          }
        }
      });

      if (authErr) {
        setAuthState(prev => ({ ...prev, isLoading: false, error: authErr.message }));
        return { success: false, error: authErr.message };
      }

      const authUser = authData.user;
      if (!authUser) {
        const errorMsg = 'Account creation failed. Please try again.';
        setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
        return { success: false, error: errorMsg };
      }

      // 2. Link or create corresponding profile record in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .or(`id.eq.${authUser.id},email.ilike.${cleanEmail}`)
        .maybeSingle();

      let studentId: string | undefined;
      let facultyId: string | undefined;

      if (data.role === 'student' && data.rollNumber) {
        const { data: stud } = await supabase
          .from('students')
          .select('id')
          .ilike('roll_number', data.rollNumber.trim())
          .maybeSingle();
        studentId = stud?.id;
      }

      if ((data.role === 'faculty' || data.role === 'hod') && (data.employeeCode || data.facultyCode)) {
        const code = data.employeeCode || data.facultyCode;
        const { data: fac } = await supabase
          .from('faculty')
          .select('id')
          .or(`employee_code.ilike.${code},faculty_code.ilike.${code}`)
          .maybeSingle();
        facultyId = fac?.id;
      }

      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: authUser.id,
          email: cleanEmail,
          full_name: cleanName,
          role: data.role,
          phone: data.phone || null,
          department_id: data.departmentId || null,
          student_id: studentId || null,
          faculty_id: facultyId || null,
        });
      } else {
        await supabase.from('profiles').update({
          id: authUser.id,
          email: cleanEmail,
          full_name: cleanName,
          role: data.role,
          phone: data.phone || existingProfile.phone,
          student_id: studentId || existingProfile.student_id,
          faculty_id: facultyId || existingProfile.faculty_id,
        }).eq('id', existingProfile.id);
      }

      // 3. Normal access flow: Log in immediately without forcing email confirmation!
      const loginRes = await login({ identifier: cleanEmail, password: cleanPass });
      return loginRes;
    } catch (err: any) {
      setAuthState(prev => ({ ...prev, isLoading: false, error: err.message || 'Signup failed' }));
      return { success: false, error: err.message || 'Signup failed' };
    }
  };

  // Authoritative Password Change: Re-authenticates via signInWithPassword, then updates via Supabase Auth
  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    // 1. Verify active Supabase Auth session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !authState.user) {
      return { success: false, error: 'No active session. Please log in.' };
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      return { success: false, error: 'User email not found in active session.' };
    }

    if (!currentPassword || !currentPassword.trim()) {
      return { success: false, error: 'Please provide your current password.' };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    if (currentPassword === newPassword) {
      return { success: false, error: 'New password must be different from current password.' };
    }

    // 2. Authoritative verification of current credentials against Supabase Auth
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });
    if (verifyErr) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    try {
      // 3. Real password update via Supabase Auth
      const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
      if (authErr) {
        return { success: false, error: authErr.message || 'Failed to update password.' };
      }

      // 4. Audit log
      try {
        await supabase.from('audit_logs').insert({
          action: 'PASSWORD_CHANGED',
          actor_name: authState.user.full_name,
          actor_role: authState.user.role,
          entity_type: 'profiles',
          entity_id: authState.user.id,
          new_values: { password_updated: true, timestamp: new Date().toISOString() }
        });
      } catch {}

      // Keep active session valid with updated credentials
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password' };
    }
  };

  // Authoritative Email Change: Initiates genuine Supabase Auth verification flow
  const changeEmail = async (newEmail: string): Promise<{ success: boolean; error?: string; pendingVerification?: boolean }> => {
    if (!authState.user) {
      return { success: false, error: 'No active session. Please log in.' };
    }
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    if (cleanEmail === authState.user.email.toLowerCase()) {
      return { success: false, error: 'New email address must be different from current email.' };
    }

    try {
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { data, error: authErr } = await supabase.auth.updateUser(
        { email: cleanEmail },
        { emailRedirectTo: redirectUrl }
      );

      if (authErr) {
        return { success: false, error: authErr.message };
      }

      // Record pending verification state in React auth state without prematurely overwriting DB records
      const isPending = Boolean(data?.user?.new_email || (data?.user?.email !== cleanEmail));

      setAuthState(prev => ({
        ...prev,
        pendingNewEmail: cleanEmail,
        user: prev.user ? {
          ...prev.user,
          new_email: cleanEmail,
          pending_email: cleanEmail,
        } : null,
      }));

      try {
        await supabase.from('audit_logs').insert({
          action: 'EMAIL_CHANGE_INITIATED',
          actor_name: authState.user.full_name,
          actor_role: authState.user.role,
          entity_type: 'profiles',
          entity_id: authState.user.id,
          new_values: { current_email: authState.user.email, requested_new_email: cleanEmail }
        });
      } catch {}

      return { success: true, pendingVerification: isPending };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to request email update' };
    }
  };

  // Resend email verification link for pending email updates
  const resendEmailVerification = async (emailToResend?: string): Promise<{ success: boolean; error?: string }> => {
    const targetEmail = (emailToResend || authState.pendingNewEmail || authState.user?.new_email || authState.user?.email)?.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      return { success: false, error: 'No email address available to resend verification.' };
    }

    try {
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resend({
        type: 'email_change',
        email: targetEmail,
        options: {
          emailRedirectTo: redirectUrl,
        }
      });

      if (error) {
        // Fallback to updateUser with target email
        const { error: updateErr } = await supabase.auth.updateUser(
          { email: targetEmail },
          { emailRedirectTo: redirectUrl }
        );
        if (updateErr) {
          return { success: false, error: error.message || updateErr.message };
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend confirmation email.' };
    }
  };

  // Password Recovery Initiation: Resolves identifier to registered email and dispatches recovery link
  const resetPasswordForEmail = async (rawIdentifier: string): Promise<{ success: boolean; error?: string; email?: string }> => {
    const trimmed = rawIdentifier.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter your registered Roll Number, Employee ID, or Email.' };
    }

    const email = await resolveUserEmail(trimmed);
    if (!email) {
      return { success: false, error: 'No registered institutional account found matching this identifier.' };
    }

    try {
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, email };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to dispatch password recovery email.' };
    }
  };

  // Password Recovery Completion: Sets new password in Supabase Auth and exits recovery mode
  const completePasswordRecovery = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }

      // Clean recovery tokens from URL address bar
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      setAuthState(prev => ({ ...prev, isPasswordRecovery: false }));

      if (authState.user) {
        try {
          await supabase.from('audit_logs').insert({
            action: 'PASSWORD_RECOVERED',
            actor_name: authState.user.full_name,
            actor_role: authState.user.role,
            entity_type: 'profiles',
            entity_id: authState.user.id,
            new_values: { recovered_via: 'email_recovery_token', timestamp: new Date().toISOString() }
          });
        } catch {}
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to complete password recovery.' };
    }
  };

  const cancelPasswordRecovery = () => {
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setAuthState(prev => ({ ...prev, isPasswordRecovery: false }));
  };

  // Official Supabase Auth OTP methods
  const sendEmailOtp = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: false,
      }
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const verifyEmailOtp = async (email: string, token: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    if (!cleanEmail || !cleanToken) {
      return { success: false, error: 'Email and verification code are required.' };
    }
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });
    if (error || !data.session) {
      return { success: false, error: error?.message || 'Invalid or expired OTP code.' };
    }
    return { success: true };
  };

  const updateUserProfile = async (updates: UserProfileUpdates): Promise<{ success: boolean; error?: string }> => {
    if (!authState.user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const cleanPhone = updates.phone !== undefined ? updates.phone.trim() : (authState.user.phone || '');
      const cleanName = updates.full_name !== undefined ? updates.full_name.trim() : (authState.user.full_name || '');
      const cleanDesignation = updates.designation !== undefined ? updates.designation.trim() : (authState.user.faculty?.designation || '');

      // 1. Update Student record if applicable
      if (authState.user.role === 'student' || authState.user.student_id) {
        const studId = authState.user.student_id || authState.user.student?.id || authState.user.id;
        const studentPayload: any = {
          phone: cleanPhone,
          updated_at: new Date().toISOString()
        };
        if (cleanName) studentPayload.full_name = cleanName;

        const { error: sErr } = await supabase
          .from('students')
          .update(studentPayload)
          .eq('id', studId);

        if (sErr) console.warn('Student phone update warning:', sErr.message);
      }

      // 2. Update Faculty record if applicable
      if (authState.user.role === 'faculty' || authState.user.role === 'hod' || authState.user.faculty_id) {
        const facId = authState.user.faculty_id || authState.user.faculty?.id || authState.user.id;
        const facultyPayload: any = {
          phone: cleanPhone,
          updated_at: new Date().toISOString()
        };
        if (cleanName) facultyPayload.full_name = cleanName;
        if (cleanDesignation) facultyPayload.designation = cleanDesignation;
        if (updates.employee_code) facultyPayload.employee_code = updates.employee_code.trim();
        if (updates.faculty_code) facultyPayload.faculty_code = updates.faculty_code.trim();

        const { error: fErr } = await supabase
          .from('faculty')
          .update(facultyPayload)
          .eq('id', facId);

        if (fErr) console.warn('Faculty profile update warning:', fErr.message);
      }

      // 3. Update Profiles record
      const profilePayload: any = {
        phone: cleanPhone,
        avatar_url: updates.avatar_url || authState.user.avatar_url,
        updated_at: new Date().toISOString()
      };
      if (cleanName) profilePayload.full_name = cleanName;

      const { error: pErr } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', authState.user.id);

      if (pErr) {
        await supabase
          .from('profiles')
          .update(profilePayload)
          .or(`email.eq.${authState.user.email}`);
      }

      // 4. Update session user state
      const updatedUser: UserProfile = {
        ...authState.user,
        full_name: cleanName || authState.user.full_name,
        phone: cleanPhone,
        avatar_url: updates.avatar_url || authState.user.avatar_url,
        student: authState.user.student ? { 
          ...authState.user.student, 
          full_name: cleanName || authState.user.student.full_name,
          phone: cleanPhone 
        } : undefined,
        faculty: authState.user.faculty ? { 
          ...authState.user.faculty, 
          full_name: cleanName || authState.user.faculty.full_name,
          designation: cleanDesignation || authState.user.faculty.designation,
          phone: cleanPhone 
        } : undefined,
      };

      erpStorage.setCurrentSessionUser(updatedUser);
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
      }));

      // 5. Audit log
      try {
        await supabase.from('audit_logs').insert([{
          action: 'PROFILE_UPDATED',
          actor_name: updatedUser.full_name,
          actor_role: authState.user.role,
          entity_type: 'profiles',
          entity_id: authState.user.id,
          new_values: { 
            full_name: cleanName, 
            phone: cleanPhone, 
            designation: cleanDesignation, 
            avatar_url: updates.avatar_url 
          }
        }]);
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error('Update profile error:', err);
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        signUp,
        changePassword,
        changeEmail,
        resendEmailVerification,
        resetPasswordForEmail,
        completePasswordRecovery,
        cancelPasswordRecovery,
        sendEmailOtp,
        verifyEmailOtp,
        updateUserProfile,
        resolveUserEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
