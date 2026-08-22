import React, { useState } from 'react';
import { 
  GraduationCap, 
  Lock, 
  User, 
  ArrowRight, 
  Sparkles, 
  AlertCircle, 
  Building2,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';

export const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const [activeRoleTab, setActiveRoleTab] = useState<'student' | 'faculty' | 'admin'>('student');
  const [identifier, setIdentifier] = useState('2503400100057'); // Any registered student/roll number
  const [password, setPassword] = useState('123456');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!identifier.trim()) {
      setLocalError('Please enter your Roll Number or Email/Employee Code');
      return;
    }

    const res = await login({ identifier, password });
    if (!res.success && res.error) {
      setLocalError(res.error);
    }
  };

  const handleRoleTabChange = (tab: 'student' | 'faculty' | 'admin') => {
    setActiveRoleTab(tab);
    setLocalError(null);
    if (tab === 'student') {
      setIdentifier('2503400100057');
      setPassword('123456');
    } else if (tab === 'faculty') {
      setIdentifier('hemlata.cse@vctm.in');
      setPassword('123456');
    } else {
      setIdentifier('admin@vctm.in');
      setPassword('admin123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-vctm-navy-950 via-vctm-navy-900 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Institution Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white shadow-xl p-2 mb-4 ring-4 ring-amber-400/20">
          <img src="/vctm-icon.svg" alt="VCTM Logo" className="w-16 h-16" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          VCTM ALIGARH
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Vivekananda College of Technology & Management
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-vctm-navy-800 border border-vctm-navy-700 text-xs font-semibold text-amber-300">
          <Building2 className="w-3.5 h-3.5" />
          <span>College Code: 340 • Attendance & Academic ERP</span>
        </div>
      </div>

      {/* Login Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-100">
          
          {/* Role selector tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleRoleTabChange('student')}
              className={`py-2 rounded-lg transition-all ${
                activeRoleTab === 'student'
                  ? 'bg-vctm-navy-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabChange('faculty')}
              className={`py-2 rounded-lg transition-all ${
                activeRoleTab === 'faculty'
                  ? 'bg-vctm-navy-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faculty / HOD
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabChange('admin')}
              className={`py-2 rounded-lg transition-all ${
                activeRoleTab === 'admin'
                  ? 'bg-vctm-navy-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin
            </button>
          </div>

          {(localError || error) && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{localError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {activeRoleTab === 'student' ? 'College Roll Number' : 'Email Address / Employee Code'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  {activeRoleTab === 'student' ? <GraduationCap className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={activeRoleTab === 'student' ? 'e.g. 2403400100047' : 'e.g. hemlata.cse@vctm.in'}
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-vctm-navy-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-vctm-navy-700 hover:underline cursor-pointer">
                  Forgot?
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-vctm-navy-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="navy"
                size="lg"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full font-semibold shadow-md"
              >
                Sign In to ERP
              </Button>
            </div>
          </form>

          {/* Quick Demo Credentials Help */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick One-Click Test Logins:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setIdentifier('2403400100047');
                  setPassword('123456');
                  setActiveRoleTab('student');
                }}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left"
              >
                <span className="font-semibold text-slate-800 block">Student (Shazeb - A)</span>
                <span className="text-slate-500 text-[10px]">Roll: 2403400100047</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIdentifier('hemlata.cse@vctm.in');
                  setPassword('123456');
                  setActiveRoleTab('faculty');
                }}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left"
              >
                <span className="font-semibold text-slate-800 block">Faculty (Ms. Hemlata)</span>
                <span className="text-slate-500 text-[10px]">Coordinator Sec A</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIdentifier('wasim.cse@vctm.in');
                  setPassword('hod123');
                  setActiveRoleTab('faculty');
                }}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left"
              >
                <span className="font-semibold text-slate-800 block">HOD (Mr. Wasim)</span>
                <span className="text-slate-500 text-[10px]">CSE Department</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIdentifier('admin@vctm.in');
                  setPassword('admin123');
                  setActiveRoleTab('admin');
                }}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left"
              >
                <span className="font-semibold text-slate-800 block">Super Admin</span>
                <span className="text-slate-500 text-[10px]">Full ERP Control</span>
              </button>
            </div>
          </div>

        </div>

        {/* Security badge */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Supabase Auth & Row Level Security (RLS) Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
