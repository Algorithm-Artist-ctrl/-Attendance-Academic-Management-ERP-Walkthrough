import React, { useState } from 'react';
import { 
  GraduationCap, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Users, 
  FileText, 
  TrendingUp, 
  Loader2 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal';
import vctmOfficialLogo from '../../assets/vctm-logo.png';
import vctmCampusImage from '../../assets/vctm-campus.jpg';
import { clsx } from 'clsx';

export const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const [activeRoleTab, setActiveRoleTab] = useState<'student' | 'faculty' | 'admin'>('faculty');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setLocalError(
        activeRoleTab === 'student' 
          ? 'Please enter your College Roll Number' 
          : activeRoleTab === 'faculty' 
          ? 'Please enter your College ID or Faculty Email' 
          : 'Please enter your Admin Identifier or Email'
      );
      return;
    }
    if (!password.trim()) {
      setLocalError('Please enter your password');
      return;
    }

    const res = await login({ identifier: cleanId, password });
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
    <div className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden w-full flex flex-col bg-slate-100 overflow-x-hidden select-none">
      
      {/* 1. INSTITUTIONAL HEADER BAR (Compact: h-14 / 56px) */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200/90 px-4 sm:px-8 lg:px-10 flex items-center justify-between z-20 shadow-xs">
        {/* Left: Emblem & Institutional Titles */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center">
            <img 
              src={vctmOfficialLogo} 
              alt="VCTM Official Emblem" 
              className="w-full h-full object-contain drop-shadow-xs" 
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-serif-institutional font-bold text-lg sm:text-xl text-slate-900 tracking-tight leading-none">
                VCTM ERP
              </span>
              <span className="hidden sm:inline-block h-3 w-px bg-slate-300" />
              <span className="hidden sm:inline-block text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">
                ALIGARH
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium hidden md:inline leading-tight">
              Vivekananda College of Technology & Management
            </span>
          </div>
        </div>

        {/* Right: Minimal Values Navigation */}
        <nav className="hidden md:flex items-center gap-3 text-xs font-semibold text-slate-600 tracking-[0.2em] uppercase">
          <span>LEARN</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>INNOVATE</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>GROW</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>ACHIEVE</span>
        </nav>
      </header>

      {/* 2. MAIN SPLIT VIEWPORT (flex-1 min-h-0: Left ~60%, Right ~40%) */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 relative overflow-hidden">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: ~60% (lg:col-span-7) Campus Visual & Values */}
        {/* ======================================================== */}
        <div className="relative lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 lg:p-10 xl:p-12 overflow-hidden bg-slate-950 text-white min-h-[360px] lg:min-h-0">
          {/* Subtle real campus photo backdrop */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src={vctmCampusImage}
              alt="VCTM College Campus"
              className="w-full h-full object-cover object-[center_35%] opacity-40 mix-blend-luminosity"
              loading="eager"
            />
            {/* Deep institutional navy gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/90 to-slate-900/75" />
          </div>

          {/* Foreground Hero Content */}
          <div className="relative z-10 flex flex-col justify-between h-full max-w-xl">
            {/* Top Motto Badge */}
            <div className="space-y-3 pt-1 sm:pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-serif-institutional italic">&ldquo;Education Today, A Better Tomorrow&rdquo;</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-sans text-[11px]">Together &mdash; for a Better Future</span>
              </div>

              {/* Main Headline */}
              <h2 className="font-serif-institutional text-3xl sm:text-4xl lg:text-[40px] xl:text-[44px] font-bold text-white tracking-tight leading-[1.15]">
                Empowering <br />
                Education <span className="font-normal font-serif-institutional text-slate-200">with Technology</span>
              </h2>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-slate-300 font-normal tracking-wide">
                A Smarter Campus for a Brighter Tomorrow
              </p>
            </div>

            {/* Compact Lower-Left Feature Panel (Does not overflow) */}
            <div className="mt-6 sm:mt-8 bg-slate-900/85 backdrop-blur-xs rounded-xl p-3.5 sm:p-4 border border-slate-800/90 shadow-lg">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                
                {/* Feature 1 */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-slate-200 shrink-0 mt-0.5">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white leading-snug">Academic Management</h4>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Classes, Subjects & Timetable</p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-slate-200 shrink-0 mt-0.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white leading-snug">Student Information</h4>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Profiles, Records & Performance</p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-slate-200 shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white leading-snug">Assignments & Grading</h4>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Sessional, Quizzes & Evaluations</p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-slate-200 shrink-0 mt-0.5">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white leading-snug">Attendance & Reports</h4>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Real-time Tracking & Insights</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: ~40% (lg:col-span-5) Polished Login Area   */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 bg-white lg:border-l lg:border-slate-200/90 overflow-y-auto lg:overflow-visible">
          
          {/* Institutional Login Card */}
          <div className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-slate-200/90 relative">
            
            {/* College Logo & Institution Header */}
            <div className="text-center mb-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-2 flex items-center justify-center">
                <img 
                  src={vctmOfficialLogo} 
                  alt="VCTM Emblem" 
                  className="w-full h-full object-contain drop-shadow-xs" 
                />
              </div>
              <h3 className="font-serif-institutional font-bold text-xl sm:text-2xl text-slate-900 tracking-tight leading-tight">
                VCTM ERP
              </h3>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Vivekananda College of Technology & Management
              </p>
              <div className="flex items-center justify-center gap-2 mt-1 text-[9px] font-bold text-slate-400 tracking-[0.25em]">
                <span className="h-px w-5 bg-slate-200" />
                <span>ALIGARH</span>
                <span className="h-px w-5 bg-slate-200" />
              </div>
            </div>

            {/* Role Selection Tabs (Student / Faculty / Admin) */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => handleRoleTabChange('student')}
                className={clsx(
                  'py-2 px-1 rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer',
                  activeRoleTab === 'student'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                )}
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('faculty')}
                className={clsx(
                  'py-2 px-1 rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer',
                  activeRoleTab === 'faculty'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                )}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Faculty / HOD</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('admin')}
                className={clsx(
                  'py-2 px-1 rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer',
                  activeRoleTab === 'admin'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Admin</span>
              </button>
            </div>

            {/* Error Message Banner */}
            {(localError || error) && (
              <div className="mb-3.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium">{localError || error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Identifier Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {activeRoleTab === 'student' 
                    ? 'College Roll Number' 
                    : activeRoleTab === 'faculty' 
                    ? 'College ID / Faculty ID' 
                    : 'Admin Identifier / Email'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      activeRoleTab === 'student' 
                        ? 'Enter roll number (e.g. 210123)' 
                        : activeRoleTab === 'faculty' 
                        ? 'Enter faculty ID or college email' 
                        : 'Enter admin identifier or email'
                    }
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                      <span>Signing In to ERP...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to ERP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Role Context Helper Line */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-500 leading-tight">
                {activeRoleTab === 'student' 
                  ? 'Authorized portal for enrolled students to view attendance, marks & timetable.' 
                  : activeRoleTab === 'faculty' 
                  ? 'Faculty gateway for attendance logging, syllabus progress & student evaluation.' 
                  : 'Institutional control panel for academic administration, departments & records.'}
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* 3. INSTITUTIONAL FOOTER & DEVELOPER CREDIT (Fixed height: h-10 / 40px) */}
      <footer className="h-10 shrink-0 bg-white border-t border-slate-200/90 px-4 sm:px-8 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-slate-500 z-20">
        <p className="text-center sm:text-left text-[11px] sm:text-xs">
          © 2026 Vivekananda College of Technology & Management, Aligarh.
        </p>

        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500">
          <span>Designed & Developed by</span>
          <strong className="text-slate-800 font-semibold">Tarun Kushwah</strong>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        portalRole={activeRoleTab}
      />
    </div>
  );
};
