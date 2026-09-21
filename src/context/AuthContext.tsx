import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { UserProfile, UserRole, Student, Faculty, Section, AdmissionType } from '../types/database.types';
import { AuthState, LoginCredentials, SignUpData } from '../types/auth.types';
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { erpStorage } from '../lib/storage/erpStorage';

export interface UserProfileUpdates {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  designation?: string;
  employee_code?: string;
  faculty_code?: string;
  section_id?: string;
  mentor_faculty_id?: string | null;
  admission_type?: AdmissionType;
  academic_year_id?: string;
  semester_id?: string;
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
  adminUpdateAccountCredentials?: (params: {
    targetUserId: string;
    email?: string;
    password?: string;
    isDefaultPassword?: boolean;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
  }) => Promise<{ success: boolean; data?: any; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function initEmailCache(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('vctm_email_resolution_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([k, v]) => map.set(k, v as string));
      }
    }
  } catch {}
  map.set('admin', 'tarunkushwah798@gmail.com');
  map.set('admin@vctm.in', 'tarunkushwah798@gmail.com');
  return map;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const cached = erpStorage.getCurrentSessionUser();
    if (cached && cached.id && cached.role) {
      return {
        user: cached,
        role: cached.role,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isPasswordRecovery: false,
        pendingNewEmail: null,
      };
    }
    // Synchronously inspect localStorage for any Supabase auth token
    let hasLikelySession = false;
    try {
      if (typeof localStorage !== 'undefined') {
        hasLikelySession = Object.keys(localStorage).some(
          key => key.startsWith('sb-') && key.endsWith('-auth-token')
        );
      }
    } catch {}

    return {
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: hasLikelySession,
      error: null,
      isPasswordRecovery: false,
      pendingNewEmail: null,
    };
  });

  const emailCacheRef = useRef<Map<string, string>>(initEmailCache());
  const inFlightProfileRef = useRef<Map<string, Promise<UserProfile | null>>>(new Map());
  const cachedProfileRef = useRef<Map<string, { profile: UserProfile; timestamp: number }>>(new Map());

  const cacheResolvedEmail = (identifier: string, email: string) => {
    const cleanId = identifier.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();
    emailCacheRef.current.set(cleanId, cleanEmail);
    try {
      if (typeof localStorage !== 'undefined') {
        const obj: Record<string, string> = {};
        emailCacheRef.current.forEach((v: string, k: string) => { obj[k] = v; });
        localStorage.setItem('vctm_email_resolution_cache', JSON.stringify(obj));
      }
    } catch {}
  };

  // Helper to resolve official email from any identifier (Roll Number, Employee ID, Faculty Code, 'admin')
  const resolveUserEmail = async (rawIdentifier: string): Promise<string | null> => {
    const trimmed = rawIdentifier.trim();
    if (!trimmed) return null;

    const clean = trimmed.toLowerCase();

    // Map super administrator aliases ('admin' and 'admin@vctm.in') to the active super_admin account
    if (clean === 'admin' || clean === 'admin@vctm.in') {
      emailCacheRef.current.set('admin', 'tarunkushwah798@gmail.com');
      emailCacheRef.current.set('admin@vctm.in', 'tarunkushwah798@gmail.com');
      return 'tarunkushwah798@gmail.com';
    }

    // 1. Direct email provided
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }

    const cached = emailCacheRef.current.get(clean);
    if (cached) return cached;

    try {
      const cleanRoll = trimmed.replace(/[\s\-_]/g, '');

      // 2 & 3. Search student roll number and faculty code in parallel for 2x faster lookup
      const [studentRes, facultyRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, email, roll_number')
          .or(`roll_number.ilike.${cleanRoll},roll_number.ilike.${trimmed}`)
          .maybeSingle(),
        supabase
          .from('faculty')
          .select('email, employee_code, faculty_code')
          .or(`employee_code.ilike.${trimmed},employee_code.ilike.${cleanRoll},faculty_code.ilike.${trimmed},faculty_code.ilike.${cleanRoll}`)
          .maybeSingle(),
      ]);

      if (studentRes.data) {
        const student = studentRes.data;
        if (student.email) {
          const res = student.email.toLowerCase().trim();
          cacheResolvedEmail(clean, res);
          return res;
        }
        const { data: prof } = await supabase
          .from('profiles')
          .select('email')
          .eq('student_id', student.id)
          .maybeSingle();
        if (prof?.email) {
          const res = prof.email.toLowerCase().trim();
          cacheResolvedEmail(clean, res);
          return res;
        }
        const res = `${cleanRoll.toLowerCase()}@student.vctm.in`;
        cacheResolvedEmail(clean, res);
        return res;
      }

      if (facultyRes.data?.email) {
        const res = facultyRes.data.email.toLowerCase().trim();
        cacheResolvedEmail(clean, res);
        return res;
      }

      // 4. Search profiles directly
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .or(`id.eq.${trimmed},email.ilike.${trimmed}`)
        .maybeSingle();

      if (profile?.email) {
        const res = profile.email.toLowerCase().trim();
        cacheResolvedEmail(clean, res);
        return res;
      }

      // 5. If purely numeric, assume student roll number pattern
      if (/^\d+$/.test(cleanRoll)) {
        const res = `${cleanRoll.toLowerCase()}@student.vctm.in`;
        cacheResolvedEmail(clean, res);
        return res;
      }
    } catch (err) {
      console.warn('Error resolving identifier to email:', err);
    }

    return null;
  };

  // Helper to load and deeply hydrate user profile from authenticated Supabase identity (Deduplicated Single Flight)
  const loadHydratedProfile = (authUserId: string, authUserEmail?: string, authUser?: any, forceFresh = false): Promise<UserProfile | null> => {
    if (!authUserId) return Promise.resolve(null);
    if (!forceFresh) {
      const cached = cachedProfileRef.current.get(authUserId);
      if (cached && (Date.now() - cached.timestamp < 60000)) {
        return Promise.resolve(cached.profile);
      }
      const sessionUser = erpStorage.getCurrentSessionUser();
      if (sessionUser && sessionUser.id === authUserId && sessionUser.role) {
        cachedProfileRef.current.set(authUserId, { profile: sessionUser, timestamp: Date.now() });
        return Promise.resolve(sessionUser);
      }
    }
    const existing = inFlightProfileRef.current.get(authUserId);
    if (existing) {
      return existing;
    }

    const fetchPromise = (async (): Promise<UserProfile | null> => {
      try {
        // 1. Query profile by authenticated UUID or email
        let { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, department_id, student_id, faculty_id, phone, avatar_url, status, created_at, updated_at')
          .eq('id', authUserId)
          .maybeSingle();

        if (!profile && authUserEmail) {
          const { data: profByEmail } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, department_id, student_id, faculty_id, phone, avatar_url, status, created_at, updated_at')
            .eq('email', authUserEmail.toLowerCase().trim())
            .maybeSingle();
          profile = profByEmail;
        }

        // Auto-heal missing profile if user authenticated in auth.users
        if (!profile) {
          // Try finding student by auth_user_id or email
          let studentRecord: any = null;
          const { data: stByAuth } = await supabase
            .from('students')
            .select('*')
            .eq('auth_user_id', authUserId)
            .maybeSingle();
          studentRecord = stByAuth;

          if (!studentRecord && authUserEmail) {
            const cleanEmail = authUserEmail.toLowerCase().trim();
            const rollCandidate = cleanEmail.split('@')[0];
            const { data: stByEmail } = await supabase
              .from('students')
              .select('*')
              .or(`email.ilike.${cleanEmail},roll_number.ilike.${rollCandidate}`)
              .maybeSingle();
            studentRecord = stByEmail;
          }

          if (studentRecord) {
            const targetEmail = authUserEmail || studentRecord.email || `${studentRecord.roll_number}@student.vctm.in`;
            const healedProfile = {
              id: authUserId,
              email: targetEmail.toLowerCase().trim(),
              full_name: studentRecord.full_name,
              role: 'student' as UserRole,
              department_id: studentRecord.department_id,
              student_id: studentRecord.id,
              phone: studentRecord.phone,
              status: studentRecord.status || 'ACTIVE',
            };
            try {
              await supabase.from('profiles').upsert(healedProfile, { onConflict: 'id' });
              if (!studentRecord.auth_user_id) {
                await supabase.from('students').update({ auth_user_id: authUserId }).eq('id', studentRecord.id);
              }
            } catch (e) {
              console.warn('Student profile auto-heal notice:', e);
            }
            profile = healedProfile as any;
          }

          // Try finding faculty by auth_user_id or email
          if (!profile) {
            let facRecord: any = null;
            const { data: fByAuth } = await supabase
              .from('faculty')
              .select('*')
              .eq('auth_user_id', authUserId)
              .maybeSingle();
            facRecord = fByAuth;

            if (!facRecord && authUserEmail) {
              const cleanEmail = authUserEmail.toLowerCase().trim();
              const { data: fByEmail } = await supabase
                .from('faculty')
                .select('*')
                .eq('email', cleanEmail)
                .maybeSingle();
              facRecord = fByEmail;
            }

            if (facRecord) {
              const targetEmail = authUserEmail || facRecord.email || `${facRecord.faculty_code?.toLowerCase()}@faculty.vctm.in`;
              const healedProfile = {
                id: authUserId,
                email: targetEmail.toLowerCase().trim(),
                full_name: facRecord.full_name,
                role: (facRecord.is_hod ? 'hod' : 'faculty') as UserRole,
                department_id: facRecord.department_id,
                faculty_id: facRecord.id,
                phone: facRecord.phone,
                status: facRecord.status || 'ACTIVE',
              };
              try {
                await supabase.from('profiles').upsert(healedProfile, { onConflict: 'id' });
                if (!facRecord.auth_user_id) {
                  await supabase.from('faculty').update({ auth_user_id: authUserId }).eq('id', facRecord.id);
                }
              } catch (e) {
                console.warn('Faculty profile auto-heal notice:', e);
              }
              profile = healedProfile as any;
            }
          }
        }

        if (!profile) {
          console.warn(`No public.profiles entry found or healable for auth UID: ${authUserId}`);
          return null;
        }

        // 2. Authoritative sync of confirmed new email across institutional records
        if (authUser?.email && profile.email !== authUser.email) {
          const confirmedNewEmail = authUser.email.toLowerCase().trim();
          try {
            await supabase
              .from('profiles')
              .update({ email: confirmedNewEmail, updated_at: new Date().toISOString() })
              .eq('id', profile.id);

            if (profile.student_id || profile.role === 'student') {
              if (profile.student_id) {
                await supabase
                  .from('students')
                  .update({ email: confirmedNewEmail, updated_at: new Date().toISOString() })
                  .eq('id', profile.student_id);
              }
              await supabase
                .from('students')
                .update({ email: confirmedNewEmail, updated_at: new Date().toISOString() })
                .or(`auth_user_id.eq.${profile.id},id.eq.${profile.id}`);
            }

            if (profile.faculty_id || profile.role === 'faculty' || profile.role === 'hod') {
              if (profile.faculty_id) {
                await supabase
                  .from('faculty')
                  .update({ email: confirmedNewEmail, updated_at: new Date().toISOString() })
                  .eq('id', profile.faculty_id);
              }
              await supabase
                .from('faculty')
                .update({ email: confirmedNewEmail, updated_at: new Date().toISOString() })
                .or(`auth_user_id.eq.${profile.id},id.eq.${profile.id}`);
            }

            profile.email = confirmedNewEmail;
          } catch (syncErr) {
            console.warn('Notice: Background sync of confirmed email to database tables:', syncErr);
          }
        }

        const profileObj: any = profile;

        // Attach authoritative Supabase Auth verification state
        profileObj.email_confirmed_at = authUser?.email_confirmed_at || null;
        profileObj.new_email = authUser?.new_email || null;
        profileObj.pending_email = authUser?.new_email || null;

        // 3. Deeply hydrate student profile with section authority
        if (profile.role === 'student' || profile.student_id) {
          const studId = profile.student_id || profile.id;
          const { data: student } = await supabase
            .from('students')
            .select('*, section:sections(*)')
            .or(`id.eq.${studId},auth_user_id.eq.${authUserId}`)
            .maybeSingle();

          if (student) {
            const hydrated: UserProfile = {
              ...profileObj,
              student_id: student.id,
              student: {
                ...student,
                section_id: (student.section as any)?.id || student.section_id,
              },
            };
            cachedProfileRef.current.set(authUserId, { profile: hydrated, timestamp: Date.now() });
            return hydrated;
          }
        }

        // 4. Deeply hydrate faculty profile
        if (profile.role === 'faculty' || profile.role === 'hod' || profile.faculty_id) {
          const facId = profile.faculty_id || profile.id;
          const { data: fac } = await supabase
            .from('faculty')
            .select('*')
            .or(`id.eq.${facId},auth_user_id.eq.${authUserId}`)
            .maybeSingle();

          if (fac) {
            const hydrated: UserProfile = {
              ...profileObj,
              faculty_id: fac.id,
              faculty: fac,
            };
            cachedProfileRef.current.set(authUserId, { profile: hydrated, timestamp: Date.now() });
            return hydrated;
          }
        }

        if (profileObj) {
          cachedProfileRef.current.set(authUserId, { profile: profileObj as UserProfile, timestamp: Date.now() });
        }
        return profileObj as UserProfile;
      } catch (err) {
        console.error('Failed to load hydrated profile:', err);
        return null;
      } finally {
        inFlightProfileRef.current.delete(authUserId);
      }
    })();

    inFlightProfileRef.current.set(authUserId, fetchPromise);
    return fetchPromise;
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
        // Non-blocking bounded session restore (race with 3000ms timeout) to ensure initial render is never blocked
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: new Error('Session restore timeout') }), 3000)
        );
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

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

        // Bounded profile hydration (race with 3500ms timeout)
        const profilePromise = loadHydratedProfile(session.user.id, session.user.email, session.user);
        const profileTimeoutPromise = new Promise<UserProfile | null>((resolve) =>
          setTimeout(() => resolve(null), 3500)
        );
        const profile = await Promise.race([profilePromise, profileTimeoutPromise]);
        if (isMounted) {
          if (profile) {
            const isInactiveStatus = profile.status && profile.status !== 'ACTIVE';
            if (isInactiveStatus) {
              await supabase.auth.signOut().catch(() => {});
              erpStorage.setCurrentSessionUser(null);
              let errorMsg = 'Your institutional account has been archived. Access is restricted. Please contact the administrator for historical records.';
              if (profile.status === 'BLOCKED') {
                errorMsg = 'Your account has been blocked by the administrator. Access is restricted.';
              } else if (profile.status === 'WITHDRAWN') {
                errorMsg = 'Your student account has been marked as Withdrawn. Access is restricted.';
              } else if (profile.status === 'TRANSFERRED') {
                errorMsg = 'Your institutional account has been marked as Transferred. Access is restricted.';
              } else if (profile.status === 'DROPPED_OUT') {
                errorMsg = 'Your student account has been marked as Dropped Out. Access is restricted.';
              } else if (profile.status === 'GRADUATED') {
                errorMsg = 'Your student account has graduated. Access to active operational portals is restricted.';
              } else if (profile.status === 'RESIGNED') {
                errorMsg = 'Your faculty account has been marked as Resigned. Access is restricted.';
              } else if (profile.status === 'SUSPENDED') {
                errorMsg = 'Your account is currently suspended. Please contact the administrator.';
              }

              setAuthState({
                user: null,
                role: null,
                isAuthenticated: false,
                isLoading: false,
                error: errorMsg,
                isPasswordRecovery: false,
                pendingNewEmail: null,
              });
              return;
            }

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
            // Fallback to cached session user if ID/email matches, preventing logout on transient network hiccup
            const cachedUser = erpStorage.getCurrentSessionUser();
            if (cachedUser && (cachedUser.id === session.user.id || cachedUser.email === session.user.email)) {
              setAuthState({
                user: cachedUser,
                role: cachedUser.role,
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
        }
      } catch {
        if (isMounted) {
          const cachedUser = erpStorage.getCurrentSessionUser();
          if (cachedUser) {
            setAuthState(prev => ({
              ...prev,
              user: cachedUser,
              role: cachedUser.role,
              isAuthenticated: true,
              isLoading: false,
            }));
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
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          cachedProfileRef.current.clear();
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
      } else if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        const forceFresh = event === 'USER_UPDATED';
        const profile = await loadHydratedProfile(session.user.id, session.user.email, session.user, forceFresh);
        if (isMounted && profile) {
          if (profile.status === 'BLOCKED' || profile.status === 'ARCHIVED') {
            await supabase.auth.signOut().catch(() => {});
            cachedProfileRef.current.clear();
            erpStorage.setCurrentSessionUser(null);
            setAuthState({
              user: null,
              role: null,
              isAuthenticated: false,
              isLoading: false,
              error: profile.status === 'BLOCKED'
                ? 'Your account has been blocked by the administrator. Access is restricted.'
                : 'Your account has been archived. Access is restricted.',
              isPasswordRecovery: false,
              pendingNewEmail: null,
            });
            return;
          }

          erpStorage.setCurrentSessionUser(profile);
          setAuthState(prev => {
            if (prev.isAuthenticated && prev.user?.id === profile.id && prev.role === profile.role && !prev.isLoading && prev.pendingNewEmail === (session.user.new_email || null)) {
              return prev;
            }
            return {
              ...prev,
              user: profile,
              role: profile.role,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              pendingNewEmail: session.user.new_email || null,
            };
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

    // Verify account status (all non-ACTIVE statuses are blocked from operational login)
    const isInactive = hydratedProfile.status && hydratedProfile.status !== 'ACTIVE';
    if (isInactive) {
      await supabase.auth.signOut().catch(() => {});
      erpStorage.setCurrentSessionUser(null);
      let errorMsg = 'Your institutional account has been archived. Access is restricted. Please contact the administrator for historical records.';
      if (hydratedProfile.status === 'BLOCKED') {
        errorMsg = 'Your account has been blocked by the administrator. Access is restricted.';
      } else if (hydratedProfile.status === 'WITHDRAWN') {
        errorMsg = 'Your student account has been marked as Withdrawn. Access is restricted.';
      } else if (hydratedProfile.status === 'TRANSFERRED') {
        errorMsg = 'Your institutional account has been marked as Transferred. Access is restricted.';
      } else if (hydratedProfile.status === 'DROPPED_OUT') {
        errorMsg = 'Your student account has been marked as Dropped Out. Access is restricted.';
      } else if (hydratedProfile.status === 'GRADUATED') {
        errorMsg = 'Your student account has graduated. Access to active operational portals is restricted.';
      } else if (hydratedProfile.status === 'RESIGNED') {
        errorMsg = 'Your faculty account has been marked as Resigned. Access is restricted.';
      } else if (hydratedProfile.status === 'SUSPENDED') {
        errorMsg = 'Your account is currently suspended. Please contact the administrator.';
      }

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

    // Update last_sign_in_at and record audit log asynchronously in background (Non-blocking)
    Promise.resolve(
      supabase.from('profiles').update({
        last_sign_in_at: new Date().toISOString()
      }).eq('id', hydratedProfile.id)
    ).catch((e: any) => console.warn('Could not update last_sign_in_at:', e));

    Promise.resolve(
      supabase.from('audit_logs').insert([{
        actor_id: hydratedProfile.id,
        actor_name: hydratedProfile.full_name,
        actor_role: hydratedProfile.role,
        action: 'USER_LOGGED_IN',
        entity_type: 'USER_SESSION',
        entity_id: hydratedProfile.id,
        new_values: { email: hydratedProfile.email, timestamp: new Date().toISOString() },
        created_at: new Date().toISOString(),
      }])
    ).catch(() => {});

    // Session successfully established
    erpStorage.setCurrentSessionUser(hydratedProfile);

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
        await supabase.from('audit_logs').insert([{
          actor_id: user.id,
          actor_name: user.full_name,
          actor_role: user.role,
          action: 'USER_LOGGED_OUT',
          entity_type: 'USER_SESSION',
          entity_id: user.id,
          new_values: { email: user.email, timestamp: new Date().toISOString() },
          created_at: new Date().toISOString(),
        }]);
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

    if (authState.user.role === 'student') {
      return { success: false, error: 'Unauthorized: Student institutional authentication credentials cannot be self-altered.' };
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

      // 4. Audit log (strictly no plaintext or hashed password data in logs)
      try {
        await supabase.from('audit_logs').insert([{
          actor_id: authState.user.id,
          actor_name: authState.user.full_name,
          actor_role: authState.user.role,
          action: 'PASSWORD_CHANGED',
          entity_type: 'USER_ACCOUNT',
          entity_id: authState.user.id,
          new_values: { password_updated: true, timestamp: new Date().toISOString() },
          created_at: new Date().toISOString(),
        }]);
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
    if (authState.user.role === 'student') {
      return { success: false, error: 'Unauthorized: Student institutional authentication credentials cannot be self-altered.' };
    }
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    if (cleanEmail === authState.user.email.toLowerCase()) {
      return { success: false, error: 'New email address must be different from current email.' };
    }

    try {
      // 1. Proactively verify and ensure an active, unexpired Supabase session before updating credentials
      let { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      let session = sessionData?.session;

      const isTokenExpired = !session?.expires_at || (session.expires_at - 60 < Math.floor(Date.now() / 1000));
      if (!session || !session.access_token || sessionErr || isTokenExpired) {
        // Attempt session refresh if token is expired or missing in memory
        const { data: refreshData } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null }, error: null }));
        if (refreshData?.session) {
          session = refreshData.session;
        } else {
          // Attempt local storage token restoration into GoTrue client
          try {
            if (typeof window !== 'undefined') {
              const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
              if (storageKey) {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed.access_token && parsed.refresh_token) {
                    const { data: setRes } = await supabase.auth.setSession({
                      access_token: parsed.access_token,
                      refresh_token: parsed.refresh_token,
                    });
                    if (setRes?.session) {
                      session = setRes.session;
                    }
                  }
                }
              }
            }
          } catch {}
        }
      }

      if (!session || !session.access_token) {
        return { success: false, error: 'Your session has expired or is invalid. Please log in again.' };
      }

      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      let updateRes = await supabase.auth.updateUser(
        { email: cleanEmail },
        { emailRedirectTo: redirectUrl }
      );

      // Proactive retry: If GoTrue reports session missing or expired token, refresh session and retry once
      if (updateRes.error) {
        const msg = updateRes.error.message || '';
        if (msg.includes('Auth session missing') || msg.toLowerCase().includes('session missing') || msg.toLowerCase().includes('jwt expired')) {
          const { data: refData } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null }, error: null }));
          if (refData?.session) {
            updateRes = await supabase.auth.updateUser(
              { email: cleanEmail },
              { emailRedirectTo: redirectUrl }
            );
          }
        }
      }

      const { data, error: authErr } = updateRes;

      if (authErr) {
        const msg = authErr.message || '';
        if (msg.includes('Auth session missing') || msg.toLowerCase().includes('session missing') || msg.toLowerCase().includes('jwt expired')) {
          return { success: false, error: 'Your authentication session could not be refreshed. Please log out and sign back in.' };
        }
        if (msg.includes('over_email_send_rate_limit') || msg.toLowerCase().includes('rate limit')) {
          return { success: false, error: 'Email verification rate limit reached. Please wait a few minutes before trying again.' };
        }
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('exists')) {
          return { success: false, error: 'This email address is already in use by another account.' };
        }
        return { success: false, error: authErr.message };
      }

      // Record pending verification state in React auth state
      const isPending = Boolean(data?.user?.new_email || (data?.user?.email !== cleanEmail));

      if (!isPending) {
        // Immediate email update (confirmation was bypassed or immediate)
        try {
          await supabase.from('profiles').update({ email: cleanEmail, updated_at: new Date().toISOString() }).eq('id', authState.user.id);
          if (authState.user.faculty_id || authState.user.role === 'faculty') {
            const facId = authState.user.faculty_id || authState.user.id;
            await supabase.from('faculty').update({ email: cleanEmail, updated_at: new Date().toISOString() }).eq('id', facId);
          }
        } catch {}
      }

      setAuthState(prev => ({
        ...prev,
        pendingNewEmail: isPending ? cleanEmail : null,
        user: prev.user ? {
          ...prev.user,
          email: !isPending ? cleanEmail : prev.user.email,
          new_email: isPending ? cleanEmail : undefined,
          pending_email: isPending ? cleanEmail : undefined,
        } : null,
      }));

      try {
        await supabase.from('audit_logs').insert([{
          actor_id: authState.user.id,
          actor_name: authState.user.full_name,
          actor_role: authState.user.role,
          action: 'EMAIL_CHANGED',
          entity_type: 'USER_ACCOUNT',
          entity_id: authState.user.id,
          old_values: { email: authState.user.email },
          new_values: { email: cleanEmail, requested_at: new Date().toISOString() },
          created_at: new Date().toISOString(),
        }]);
      } catch {}

      return { success: true, pendingVerification: isPending };
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Auth session missing') || msg.toLowerCase().includes('session missing')) {
        return { success: false, error: 'Your session has expired. Please log in again.' };
      }
      return { success: false, error: msg || 'Failed to request email update' };
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
  // NOTE: Students are strictly blocked from self-service password reset per institutional security policy.
  const resetPasswordForEmail = async (rawIdentifier: string): Promise<{ success: boolean; error?: string; email?: string }> => {
    const trimmed = rawIdentifier.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter your registered Roll Number, Employee ID, or Email.' };
    }

    const email = await resolveUserEmail(trimmed);
    if (!email) {
      return { success: false, error: 'No registered institutional account found matching this identifier.' };
    }

    // STRICT SECURITY POLICY: Students cannot reset passwords directly.
    const cleanRoll = trimmed.replace(/[\s\-_]/g, '');
    const isStudentEmail = email.toLowerCase().includes('@student.');
    const isNumericRoll = /^\d+$/.test(cleanRoll);

    if (isStudentEmail || isNumericRoll) {
      return {
        success: false,
        error: 'For security reasons, students cannot reset their password directly. Please contact your Super Admin / College Administrator to reset your account password.',
      };
    }

    try {
      // Check database to ensure target is not a student account
      const { data: studentMatch } = await supabase
        .from('students')
        .select('id')
        .or(`roll_number.ilike.${cleanRoll},roll_number.ilike.${trimmed},email.ilike.${email}`)
        .maybeSingle();

      if (studentMatch) {
        return {
          success: false,
          error: 'For security reasons, students cannot reset their password directly. Please contact your Super Admin / College Administrator to reset your account password.',
        };
      }

      const { data: profileMatch } = await supabase
        .from('profiles')
        .select('role, student_id')
        .ilike('email', email)
        .maybeSingle();

      if (profileMatch && (profileMatch.role === 'student' || profileMatch.student_id)) {
        return {
          success: false,
          error: 'For security reasons, students cannot reset their password directly. Please contact your Super Admin / College Administrator to reset your account password.',
        };
      }

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
        if (updates.section_id) studentPayload.section_id = updates.section_id;
        if (updates.mentor_faculty_id !== undefined) studentPayload.mentor_faculty_id = updates.mentor_faculty_id || null;
        if (updates.admission_type) studentPayload.admission_type = updates.admission_type;
        if (updates.academic_year_id) studentPayload.academic_year_id = updates.academic_year_id;
        if (updates.semester_id) studentPayload.semester_id = updates.semester_id;

        const { error: sErr } = await supabase
          .from('students')
          .update(studentPayload)
          .eq('id', studId);

        if (sErr) console.warn('Student profile update warning:', sErr.message);
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
          phone: cleanPhone,
          section_id: updates.section_id || authState.user.student.section_id,
          mentor_faculty_id: updates.mentor_faculty_id !== undefined ? (updates.mentor_faculty_id || undefined) : authState.user.student.mentor_faculty_id,
          admission_type: updates.admission_type || authState.user.student.admission_type,
          academic_year_id: updates.academic_year_id || authState.user.student.academic_year_id,
          semester_id: updates.semester_id || authState.user.student.semester_id,
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

  const adminUpdateAccountCredentials = useCallback((params: any) => {
    return supabaseService.adminUpdateAccountCredentials(params);
  }, []);

  const authContextValue = useMemo(() => ({
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
    adminUpdateAccountCredentials,
  }), [authState, adminUpdateAccountCredentials]);

  return (
    <AuthContext.Provider value={authContextValue}>
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
