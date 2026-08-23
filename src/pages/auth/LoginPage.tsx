import React, { useState } from 'react';
import { 
  GraduationCap, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { CyberCollegeCampus3D } from '../../components/3d/CyberCollegeCampus3D';
import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal';
import vctmOfficialLogo from '../../assets/vctm-logo.png';
import { clsx } from 'clsx';

export const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const [activeRoleTab, setActiveRoleTab] = useState<'student' | 'faculty' | 'admin'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!identifier.trim()) {
      setLocalError(activeRoleTab === 'student' ? 'Please enter your College Roll Number' : 'Please enter your Email or Employee ID');
      return;
    }
    if (!password.trim()) {
      setLocalError('Please enter your password');
      return;
    }

    const res = await login({ identifier: identifier.trim(), password });
    if (!res.success && res.error) {
      setLocalError(res.error);
    }
  };

  const handleRoleTabChange = (tab: 'student' | 'faculty' | 'admin') => {
    setActiveRoleTab(tab);
    setLocalError(null);
    setIdentifier('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Cyber Glow Gradients */}
      <div className="absolute top-1/4 left-1/6 w-96 h-96 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/6 w-96 h-96 rounded-full bg-[#00ff88]/10 blur-[140px] pointer-events-none" />

      {/* Main Container: 2-Column Desktop Grid matching Screen 1 */}
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        
        {/* Left Column: 3D Futuristic Cyber Campus */}
        <div className="hidden lg:flex lg:col-span-6 flex-col items-center justify-center text-center p-6">
          <CyberCollegeCampus3D />
          <div className="mt-4 space-y-1">
            <h3 className="text-xl font-black tracking-tight text-white">
              VIVEKANANDA COLLEGE
            </h3>
            <p className="text-xs text-emerald-400/90 font-semibold tracking-wide">
              OF TECHNOLOGY & MANAGEMENT, ALIGARH
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm pt-2">
              Next-Generation Academic Attendance & Institutional Governance Platform • College Code: 340
            </p>
          </div>
        </div>

        {/* Right Column: Cyber Login Card matching Screen 1 */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.6)] border border-emerald-500/25 relative overflow-hidden">
            
            {/* VCTM Emblem & Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-950/90 border border-emerald-500/40 shadow-[0_0_25px_rgba(0,255,136,0.25)] p-1.5 mb-3">
                <img src={vctmOfficialLogo} alt="VCTM Official Emblem" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-wider">
                VCTM <span className="text-[#00ff88]">ERP</span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Vivekananda College of Technology & Management
              </p>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest block mt-0.5">
                Aligarh
              </span>
            </div>

            {/* Role Selection Tabs (Student / Faculty / Admin) */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-xl mb-6 border border-emerald-500/20 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleRoleTabChange('student')}
                className={clsx(
                  'py-2 rounded-lg transition-all duration-200 cursor-pointer select-none',
                  activeRoleTab === 'student'
                    ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => handleRoleTabChange('faculty')}
                className={clsx(
                  'py-2 rounded-lg transition-all duration-200 cursor-pointer select-none',
                  activeRoleTab === 'faculty'
                    ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Faculty / HOD
              </button>
              <button
                type="button"
                onClick={() => handleRoleTabChange('admin')}
                className={clsx(
                  'py-2 rounded-lg transition-all duration-200 cursor-pointer select-none',
                  activeRoleTab === 'admin'
                    ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Admin
              </button>
            </div>

            {/* Error Message if any */}
            {(localError || error) && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{localError || error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Roll Number / Identifier */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {activeRoleTab === 'student' ? 'College Roll Number' : activeRoleTab === 'faculty' ? 'Employee ID / Email' : 'Admin Identifier'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    {activeRoleTab === 'student' ? <GraduationCap className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      activeRoleTab === 'student' 
                        ? 'Enter your roll number' 
                        : activeRoleTab === 'faculty' 
                        ? 'Enter your employee ID or email' 
                        : 'Enter admin identifier'
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-950/70 border border-emerald-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-[#00ff88] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-950/70 border border-emerald-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sign In Button matching Screen 1 */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="neon"
                  size="lg"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
                  className="w-full font-extrabold text-sm shadow-[0_0_20px_rgba(0,255,136,0.35)]"
                >
                  Sign In to ERP
                </Button>
              </div>
            </form>

            {/* Bottom Supabase Auth Security Badge */}
            <div className="mt-6 pt-4 border-t border-emerald-500/15 text-center flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-[#00ff88]" />
              <span>Secure with Supabase Auth & RLS</span>
            </div>

          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />
    </div>
  );
};
