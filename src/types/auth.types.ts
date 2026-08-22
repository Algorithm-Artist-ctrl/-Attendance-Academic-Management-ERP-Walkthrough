import { UserProfile, UserRole } from './database.types';

export interface AuthState {
  user: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  identifier: string; // Roll Number for student, Email/Emp Code for faculty/admin
  password?: string;
  roleHint?: UserRole;
}
