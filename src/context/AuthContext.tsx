import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types/database.types';
import { AuthState, LoginCredentials } from '../types/auth.types';
import { erpStorage } from '../lib/storage/erpStorage';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchUser: (profileId: string) => void;
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
    const profiles = erpStorage.getProfiles();
    const students = erpStorage.getStudents();
    const faculty = erpStorage.getFaculty();
    const sections = erpStorage.getSections();

    // Clean inputs for flexible searching
    const cleanId = trimmedId.replace(/[\s\-_]/g, '');
    const cleanNumeric = cleanId.replace(/\D/g, '');

    // Step A: Exact Roll Number, Faculty Code, Employee Code, or Email match
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
      if (p.email.toLowerCase() === trimmedId) return true;
      return false;
    });

    // Also search direct students list if profile mapping wasn't found directly
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
        matchedProfile = {
          id: `user-${matchedStudent.id}`,
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

    // Step B: Flexible Student Roll Number suffix match (e.g. 2403400100057 <-> 2503400100057 or last 5-7 digits)
    if (!matchedProfile && cleanNumeric.length >= 4) {
      const targetSuffix = cleanNumeric.slice(-6); // e.g. 000057 or 100057
      const matchedStudent = students.find(s => {
        const studNumeric = s.roll_number.replace(/\D/g, '');
        return studNumeric.endsWith(targetSuffix) || cleanNumeric.endsWith(studNumeric.slice(-6));
      });

      if (matchedStudent) {
        const studSec = sections.find(sec => sec.id === matchedStudent.section_id) ||
                        sections.find(sec => sec.name === matchedStudent.section?.name);
        matchedProfile = {
          id: `user-${matchedStudent.id}`,
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

    // Step C: Flexible Name search (e.g., student enters their first name "Tarun")
    if (!matchedProfile && trimmedId.length >= 3) {
      const matchedStudent = students.find(s => {
        const names = s.full_name.toLowerCase().split(' ');
        return names.some(n => n === trimmedId) || s.full_name.toLowerCase().includes(trimmedId);
      });

      if (matchedStudent) {
        const studSec = sections.find(sec => sec.id === matchedStudent.section_id) ||
                        sections.find(sec => sec.name === matchedStudent.section?.name);
        matchedProfile = {
          id: `user-${matchedStudent.id}`,
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

    // Step D: Super Admin check
    if (!matchedProfile) {
      if (trimmedId === 'admin' || trimmedId === 'admin@vctm.in' || trimmedId === 'superadmin' || trimmedId === 'principal') {
        matchedProfile = profiles.find(p => p.role === 'super_admin');
      }
    }

    if (!matchedProfile) {
      const errorMsg = `No student or faculty found matching "${credentials.identifier}". Please verify your Roll Number (e.g. 2503400100057) or Email.`;
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
    <AuthContext.Provider value={{ ...authState, login, logout, switchUser }}>
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
