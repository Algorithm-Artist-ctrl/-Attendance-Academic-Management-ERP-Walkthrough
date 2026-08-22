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
        // Re-hydrate profile with latest student/faculty records
        const profiles = erpStorage.getProfiles();
        const latestProfile = profiles.find(p => p.id === savedUser.id) || savedUser;
        setAuthState({
          user: latestProfile,
          role: latestProfile.role,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        // Default to not logged in
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

    // 1. Search across all profiles (students, faculty, admin)
    const cleanId = trimmedId.replace(/[\s\-_]/g, '');
    const cleanNumeric = cleanId.replace(/\D/g, '');

    // Step A: Exact Roll Number or Code or Email match
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

    // Step B: Flexible Student Roll Number suffix match (e.g. 2403400100057 <-> 2503400100057 or last 5-7 digits)
    if (!matchedProfile && cleanNumeric.length >= 4) {
      const targetSuffix = cleanNumeric.slice(-6); // e.g. 000057 or 100057
      matchedProfile = profiles.find(p => {
        if (p.student) {
          const studNumeric = p.student.roll_number.replace(/\D/g, '');
          if (studNumeric.endsWith(targetSuffix) || cleanNumeric.endsWith(studNumeric.slice(-6))) {
            return true;
          }
        }
        return false;
      });
    }

    // Step C: Flexible Name search (e.g., student enters their first name "Tarun")
    if (!matchedProfile && trimmedId.length >= 3) {
      matchedProfile = profiles.find(p => {
        if (p.student) {
          const names = p.student.full_name.toLowerCase().split(' ');
          if (names.some(n => n === trimmedId) || p.student.full_name.toLowerCase().includes(trimmedId)) {
            return true;
          }
        }
        return false;
      });
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
