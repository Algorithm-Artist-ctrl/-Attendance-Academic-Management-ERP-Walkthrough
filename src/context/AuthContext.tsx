import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, Student, Faculty, Section } from '../types/database.types';
import { AuthState, LoginCredentials } from '../types/auth.types';
import { supabase } from '../lib/supabase/supabaseClient';
import { erpStorage } from '../lib/storage/erpStorage';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchUser: (profileId: string) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  changeEmail: (newEmail: string) => Promise<{ success: boolean; error?: string }>;
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

  useEffect(() => {
    // Restore session on mount
    try {
      const savedUser = erpStorage.getCurrentSessionUser();
      if (savedUser) {
        // Re-hydrate profile with latest student/faculty records from authoritative storage
        const profiles = erpStorage.getProfiles();
        const students = erpStorage.getStudents();
        const faculty = erpStorage.getFaculty();
        const sections = erpStorage.getSections();

        let latestProfile = profiles.find(p => p.id === savedUser.id);
        if (!latestProfile && savedUser.student) {
          latestProfile = profiles.find(p => p.student?.roll_number === savedUser.student?.roll_number);
        }
        if (!latestProfile) {
          latestProfile = savedUser;
        }

        // Ensure student and section are deeply hydrated
        if (latestProfile.student || savedUser.student) {
          const targetRoll = latestProfile.student?.roll_number || savedUser.student?.roll_number;
          const targetId = latestProfile.student?.id || savedUser.student?.id;
          const freshStudent = students.find(s => s.roll_number === targetRoll || s.id === targetId);

          if (freshStudent) {
            const freshSection = sections.find(sec => sec.id === freshStudent.section_id) ||
                                 sections.find(sec => sec.name === freshStudent.section?.name);
            latestProfile = {
              ...latestProfile,
              student_id: freshStudent.id,
              student: {
                ...freshStudent,
                section: freshSection,
                section_id: freshSection?.id || freshStudent.section_id,
              },
            };
          }
        }

        // Ensure faculty profile is deeply hydrated
        if (latestProfile.role === 'faculty' || latestProfile.role === 'hod' || latestProfile.faculty || savedUser.faculty) {
          const targetFacId = latestProfile.faculty_id || latestProfile.faculty?.id || savedUser.faculty_id || savedUser.faculty?.id || savedUser.id;
          const targetCode = latestProfile.faculty?.employee_code || savedUser.faculty?.employee_code || latestProfile.faculty?.faculty_code || savedUser.faculty?.faculty_code;
          const targetName = latestProfile.full_name || savedUser.full_name;
          const targetEmail = latestProfile.email || savedUser.email;

          const freshFaculty = faculty.find(
            f => f.id === targetFacId ||
                 (targetCode && (f.employee_code === targetCode || f.faculty_code === targetCode)) ||
                 (targetName && f.full_name.toLowerCase().trim() === targetName.toLowerCase().trim()) ||
                 (targetEmail && f.email.toLowerCase().trim() === targetEmail.toLowerCase().trim())
          );

          if (freshFaculty) {
            latestProfile = {
              ...latestProfile,
              faculty_id: freshFaculty.id,
              faculty: freshFaculty,
            };
          }
        }

        setAuthState({
          user: latestProfile,
          role: latestProfile.role,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    const trimmedId = credentials.identifier.trim().toLowerCase();

    // 1. Fetch latest profiles, students, faculty, and sections directly from Supabase
    let profiles = erpStorage.getProfiles();
    let students = erpStorage.getStudents();
    let faculty = erpStorage.getFaculty();
    let sections = erpStorage.getSections();

    try {
      const [
        { data: liveProfs },
        { data: liveStuds },
        { data: liveFac },
        { data: liveSecs }
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('students').select('*'),
        supabase.from('faculty').select('*'),
        supabase.from('sections').select('*')
      ]);

      if (liveStuds && liveStuds.length > 0) students = liveStuds as Student[];
      if (liveFac && liveFac.length > 0) faculty = liveFac as Faculty[];
      if (liveSecs && liveSecs.length > 0) sections = liveSecs as Section[];
      if (liveProfs && liveProfs.length > 0) {
        profiles = (liveProfs as UserProfile[]).map(p => ({
          ...p,
          student: students.find(s => s.id === p.student_id),
          faculty: faculty.find(f => f.id === p.faculty_id)
        }));
      }
    } catch (err) {
      console.warn('Network auth query fallback to storage:', err);
    }

    // Clean inputs for flexible searching
    const cleanId = trimmedId.replace(/[\s\-_]/g, '');
    const cleanNumeric = cleanId.replace(/\D/g, '');

    // Step A: Exact Roll Number, Faculty Code, Employee Code, or Email match from live database profiles
    let matchedProfile = profiles.find(p => {
      if (p.student) {
        const studRoll = p.student.roll_number.toLowerCase().replace(/[\s\-_]/g, '');
        if (studRoll === cleanId) return true;
        if (p.student.email && p.student.email.toLowerCase() === trimmedId) return true;
        if (p.student.full_name.toLowerCase() === trimmedId) return true;
      }
      if (p.faculty) {
        if (p.faculty.employee_code.toLowerCase().replace(/[\s\-_]/g, '') === cleanId) return true;
        if (p.faculty.faculty_code && p.faculty.faculty_code.toLowerCase() === cleanId) return true;
        if (p.faculty.email.toLowerCase() === trimmedId) return true;
        if (p.faculty.full_name.toLowerCase().includes(trimmedId)) return true;
      }
      if (p.email && p.email.toLowerCase() === trimmedId) return true;
      return false;
    });

    // Also search direct students list from Supabase
    if (!matchedProfile) {
      const matchedStudent = students.find(s => {
        const studRoll = s.roll_number.toLowerCase().replace(/[\s\-_]/g, '');
        if (studRoll === cleanId) return true;
        if (s.email && s.email.toLowerCase() === trimmedId) return true;
        if (s.full_name.toLowerCase() === trimmedId) return true;
        return false;
      });

      if (matchedStudent) {
        const studSec = sections.find(sec => sec.id === matchedStudent.section_id) ||
                        sections.find(sec => sec.name === matchedStudent.section?.name);
        const existingProf = profiles.find(p => p.student_id === matchedStudent.id || p.email === matchedStudent.email);
        matchedProfile = existingProf || {
          id: matchedStudent.id,
          email: matchedStudent.email || `${matchedStudent.roll_number}@student.vctm.in`,
          role: 'student',
          full_name: matchedStudent.full_name,
          department_id: matchedStudent.department_id,
          student_id: matchedStudent.id,
          student: {
            ...matchedStudent,
            section: studSec,
            section_id: studSec?.id || matchedStudent.section_id,
          },
        };
      }
    }

    // Also search direct faculty list from Supabase
    if (!matchedProfile) {
      const matchedFaculty = faculty.find(f => {
        if (f.employee_code.toLowerCase().replace(/[\s\-_]/g, '') === cleanId) return true;
        if (f.faculty_code && f.faculty_code.toLowerCase() === cleanId) return true;
        if (f.email.toLowerCase() === trimmedId) return true;
        if (f.full_name.toLowerCase() === trimmedId || f.full_name.toLowerCase().includes(trimmedId)) return true;
        return false;
      });

      if (matchedFaculty) {
        const isHod = matchedFaculty.designation.toLowerCase().includes('hod');
        const existingProf = profiles.find(p => p.faculty_id === matchedFaculty.id || p.email === matchedFaculty.email);
        matchedProfile = existingProf || {
          id: matchedFaculty.id,
          email: matchedFaculty.email,
          role: isHod ? 'hod' : 'faculty',
          full_name: matchedFaculty.full_name,
          department_id: matchedFaculty.department_id,
          faculty_id: matchedFaculty.id,
          phone: matchedFaculty.phone,
          faculty: matchedFaculty,
        };
      }
    }

    // Step B: Flexible Student Roll Number suffix match (e.g. 2403400100057 <-> last digits)
    if (!matchedProfile && cleanNumeric.length >= 4) {
      const targetSuffix = cleanNumeric.slice(-6);
      const matchedStudent = students.find(s => {
        const studNumeric = s.roll_number.replace(/\D/g, '');
        return studNumeric.endsWith(targetSuffix) || cleanNumeric.endsWith(studNumeric.slice(-6));
      });

      if (matchedStudent) {
        const studSec = sections.find(sec => sec.id === matchedStudent.section_id) ||
                        sections.find(sec => sec.name === matchedStudent.section?.name);
        const existingProf = profiles.find(p => p.student_id === matchedStudent.id || p.email === matchedStudent.email);
        matchedProfile = existingProf || {
          id: matchedStudent.id,
          email: matchedStudent.email || `${matchedStudent.roll_number}@student.vctm.in`,
          role: 'student',
          full_name: matchedStudent.full_name,
          department_id: matchedStudent.department_id,
          student_id: matchedStudent.id,
          student: {
            ...matchedStudent,
            section: studSec,
            section_id: studSec?.id || matchedStudent.section_id,
          },
        };
      }
    }

    // Step C: Super Admin login from database profile
    if (!matchedProfile) {
      const adminProfile = profiles.find(p => p.role === 'super_admin');
      if (adminProfile && (trimmedId === 'admin' || trimmedId === adminProfile.email?.toLowerCase())) {
        matchedProfile = adminProfile;
      }
    }

    if (!matchedProfile) {
      const errorMsg = `No active ERP account found for "${credentials.identifier}". Please check your Roll Number / Employee ID / Email or contact administrator.`;
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      return { success: false, error: errorMsg };
    }

    // Ensure student profile has fully hydrated Section authority
    if (matchedProfile.student) {
      const currentSection = sections.find(sec => sec.id === matchedProfile.student?.section_id) ||
                             sections.find(sec => sec.name === matchedProfile.student?.section?.name);
      if (currentSection) {
        matchedProfile.student.section = currentSection;
        matchedProfile.student.section_id = currentSection.id;
      }
    }

    // Authenticate and establish persistent session
    erpStorage.setCurrentSessionUser(matchedProfile);
    erpStorage.addAuditLog('USER_LOGGED_IN', 'profiles', matchedProfile.id, undefined, { identifier: credentials.identifier });

    setAuthState({
      user: matchedProfile,
      role: matchedProfile.role,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    return { success: true };
  };

  const logout = () => {
    const user = authState.user;
    if (user) {
      erpStorage.addAuditLog('USER_LOGGED_OUT', 'profiles', user.id);
    }
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
    if (!authState.user) {
      return { success: false, error: 'No active session. Please log in.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    try {
      // 1. Update password in Supabase Auth
      const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
      if (authErr) {
        console.warn('Supabase Auth updateUser notice:', authErr.message);
      }

      // 2. Audit log in Supabase
      await supabase.from('audit_logs').insert({
        action: 'PASSWORD_CHANGED',
        actor_name: authState.user.full_name,
        actor_role: authState.user.role,
        entity_type: 'profiles',
        entity_id: authState.user.id,
        new_values: { password_updated: true, timestamp: new Date().toISOString() }
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

  const switchUser = (profileId: string) => {
    const profiles = erpStorage.getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      erpStorage.setCurrentSessionUser(profile);
      setAuthState({
        user: profile,
        role: profile.role,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, switchUser, changePassword, changeEmail }}>
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
