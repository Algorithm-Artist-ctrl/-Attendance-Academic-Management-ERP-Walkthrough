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

    // 1. Check if student login with Roll Number
    let matchedProfile = profiles.find(p => {
      if (p.student && p.student.roll_number.toLowerCase() === trimmedId) {
        return true;
      }
      if (p.email.toLowerCase() === trimmedId) {
        return true;
      }
      if (p.faculty && (p.faculty.employee_code.toLowerCase() === trimmedId || p.faculty.email.toLowerCase() === trimmedId)) {
        return true;
      }
      return false;
    });

    if (!matchedProfile) {
      // Check if it's admin@vctm.in or admin
      if (trimmedId === 'admin' || trimmedId === 'admin@vctm.in') {
        matchedProfile = profiles.find(p => p.role === 'super_admin');
      }
    }

    if (!matchedProfile) {
      const errorMsg = 'Invalid Roll Number, Employee Code, or Email address.';
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
