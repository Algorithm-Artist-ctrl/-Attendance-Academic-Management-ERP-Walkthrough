import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, Student, Faculty, Section } from '../types/database.types';
import { AuthState, LoginCredentials } from '../types/auth.types';
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

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  changeEmail: (newEmail: string) => Promise<{ success: boolean; error?: string }>;
  updateUserProfile: (updates: UserProfileUpdates) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
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
  const loadHydratedProfile = async (authUserId: string, authUserEmail?: string): Promise<UserProfile | null> => {
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

      // 2. Deeply hydrate student profile with section authority
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

      // 3. Deeply hydrate faculty profile
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
            });
          }
          return;
        }

        const profile = await loadHydratedProfile(session.user.id, session.user.email);
        if (isMounted) {
          if (profile) {
            erpStorage.setCurrentSessionUser(profile);
            setAuthState({
              user: profile,
              role: profile.role,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            erpStorage.setCurrentSessionUser(null);
            setAuthState({
              user: null,
              role: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
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
          });
        }
      }
    };

    restoreSession();

    // Listen to Supabase Auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session || !session.user) {
        if (isMounted) {
          erpStorage.setCurrentSessionUser(null);
          setAuthState({
            user: null,
            role: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const profile = await loadHydratedProfile(session.user.id, session.user.email);
        if (isMounted && profile) {
          erpStorage.setCurrentSessionUser(profile);
          setAuthState({
            user: profile,
            role: profile.role,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
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
      });
      return { success: false, error: errorMsg };
    }

    // Retrieve authenticated identity & hydrate database profile
    const hydratedProfile = await loadHydratedProfile(data.user.id, data.user.email);
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
    });
  };

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

      // 5. Terminate active session to enforce immediate re-authentication with new credentials
      await supabase.auth.signOut();
      erpStorage.setCurrentSessionUser(null);
      setAuthState({
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password' };
    }
  };

  const changeEmail = async (newEmail: string): Promise<{ success: boolean; error?: string }> => {
    if (!authState.user) {
      return { success: false, error: 'No active session. Please log in.' };
    }
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    try {
      // 1. Update in Supabase Auth
      const { error: authErr } = await supabase.auth.updateUser({ email: cleanEmail });
      if (authErr) {
        console.warn('Supabase Auth updateUser email notice:', authErr.message);
      }

      // 2. Synchronize database records
      if (authState.user.role === 'faculty' || authState.user.role === 'hod' || authState.user.faculty_id) {
        const facId = authState.user.faculty_id || authState.user.faculty?.id || authState.user.id;
        await supabase
          .from('faculty')
          .update({ email: cleanEmail, updated_at: new Date().toISOString() })
          .eq('id', facId);
      }

      if (authState.user.role === 'student' || authState.user.student_id) {
        const studId = authState.user.student_id || authState.user.student?.id || authState.user.id;
        await supabase
          .from('students')
          .update({ email: cleanEmail, updated_at: new Date().toISOString() })
          .eq('id', studId);
      }

      await supabase
        .from('profiles')
        .update({ email: cleanEmail, updated_at: new Date().toISOString() })
        .or(`id.eq.${authState.user.id},email.eq.${authState.user.email}`);

      // 3. Update session user state
      const updatedUser: UserProfile = {
        ...authState.user,
        email: cleanEmail,
        faculty: authState.user.faculty ? { ...authState.user.faculty, email: cleanEmail } : undefined,
        student: authState.user.student ? { ...authState.user.student, email: cleanEmail } : undefined,
      };

      erpStorage.setCurrentSessionUser(updatedUser);
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
      }));

      // 4. Audit log
      await supabase.from('audit_logs').insert({
        action: 'EMAIL_CHANGED',
        actor_name: authState.user.full_name,
        actor_role: authState.user.role,
        entity_type: 'profiles',
        entity_id: authState.user.id,
        new_values: { old_email: authState.user.email, new_email: cleanEmail }
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update email' };
    }
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
    <AuthContext.Provider value={{ ...authState, login, logout, changePassword, changeEmail, updateUserProfile }}>
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
