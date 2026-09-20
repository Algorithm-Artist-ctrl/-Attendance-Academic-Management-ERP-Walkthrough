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
    <div className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden w-full flex flex-col justify-between bg-white select-none relative overflow-x-hidden">
      
      {/* ======================================================== */}
      {/* 1. CAMPUS BACKGROUND PHOTO & FOCUSED SKY GRADIENT        */}
      {/* ======================================================== */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={vctmCampusImage}
          alt="Vivekananda College of Technology & Management Campus"
          className="w-full h-full object-cover object-[center_22%]"
          loading="eager"
        />
        {/* Localized sky gradient strictly in upper-left sky (y < 25%): ensures crisp headline readability without washing out roofline, pediment, or facade */}
        <div className="absolute top-0 left-0 w-[420px] max-w-[45%] h-[24%] bg-gradient-to-br from-white/70 via-white/20 to-transparent pointer-events-none" />
        {/* Mobile wash for readability on small screen sizes */}
        <div className="absolute inset-0 bg-white/45 lg:hidden pointer-events-none" />
      </div>

      {/* ======================================================== */}
      {/* 2. TOP HEADER BAR                                        */}
      {/* ======================================================== */}
      <header className="relative z-20 w-full px-6 sm:px-10 lg:px-12 py-2 sm:py-2.5 shrink-0 bg-white/85 backdrop-blur-sm border-b border-slate-200/60 flex items-center justify-between">
        {/* Left: Official College Logo & Institutional Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center">
            <img 
              src={vctmOfficialLogo} 
              alt="VCTM Official Emblem" 
              className="w-full h-full object-contain drop-shadow-xs" 
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <h1 className="font-serif-hero font-bold text-xl sm:text-2xl text-slate-900 tracking-wider leading-none">
                VCTM ERP
              </h1>
              <span className="hidden sm:inline-block text-[9px] font-bold text-slate-500 tracking-[0.25em]">
                ALIGARH
              </span>
            </div>
            <span className="text-[11px] sm:text-xs text-slate-600 font-medium tracking-normal mt-0.5">
              Vivekananda College of Technology & Management
            </span>
          </div>
        </div>

        {/* Right: Core Institutional Values Navigation */}
        <nav className="hidden lg:flex items-center gap-3.5 text-xs font-semibold text-slate-700 tracking-[0.25em] uppercase">
          <span>LEARN</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>INNOVATE</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>GROW</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>ACHIEVE</span>
        </nav>
      </header>

      {/* ======================================================== */}
      {/* 3. MAIN HERO & FLOATING LOGIN CARD                       */}
      {/* ======================================================== */}
      <main className="relative z-20 flex-1 min-h-0 w-full px-6 sm:px-10 lg:px-12 max-w-[1780px] mx-auto flex flex-col lg:flex-row items-stretch justify-between gap-6 pt-2 sm:pt-3 pb-3 sm:pb-4">
        
        {/* Left Column: Hero Text (Top-Left in Sky) & Feature Bar (Bottom-Left over Lawn) */}
        <div className="flex-1 flex flex-col justify-between min-w-0 pr-0 lg:pr-6 h-full">
          {/* Hero Headlines - Positioned strictly in the upper sky area */}
          <div className="max-w-md lg:max-w-lg">
            <h2 
              className="font-serif-hero font-bold text-slate-950 tracking-tight leading-[1.04] drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]"
              style={{ fontSize: 'clamp(28px, 2.8vw, 46px)' }}
            >
              Empowering <br />
              Education <span className="font-normal font-serif-hero text-slate-900">with Technology</span>
            </h2>
            <p className="text-xs sm:text-sm lg:text-[15px] text-slate-800 font-sans font-medium tracking-normal drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] mt-1.5 max-w-md">
              A Smarter Campus for a Brighter Tomorrow
            </p>
          </div>

          {/* Bottom Floating Dark Feature Bar - Anchored strictly to bottom over green lawn, leaving entrance & facade fully visible */}
          <div className="w-full max-w-xl xl:max-w-2xl bg-[#0f172a]/95 backdrop-blur-md text-white rounded-2xl p-2.5 sm:p-3 shadow-2xl border border-slate-700/60 mt-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-700/60">
              
              {/* Feature 1 */}
              <div className="flex flex-col sm:px-3 pt-1 sm:pt-0">
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center mb-1 text-white">
                  <GraduationCap className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-white leading-tight">Academic Management</span>
                <span className="text-[10px] text-slate-300 mt-0.5 leading-snug">Classes, Subjects & Timetable</span>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col sm:px-3 pt-1 sm:pt-0">
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center mb-1 text-white">
                  <Users className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-white leading-tight">Student Information</span>
                <span className="text-[10px] text-slate-300 mt-0.5 leading-snug">Profiles, Records & Performance</span>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col sm:px-3 pt-1 sm:pt-0">
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center mb-1 text-white">
                  <FileText className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-white leading-tight">Assignments & Grading</span>
                <span className="text-[10px] text-slate-300 mt-0.5 leading-snug">Sessional, Quizzes & Evaluations</span>
              </div>

              {/* Feature 4 */}
              <div className="flex flex-col sm:px-3 pt-1 sm:pt-0">
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center mb-1 text-white">
                  <TrendingUp className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-white leading-tight">Attendance & Reports</span>
                <span className="text-[10px] text-slate-300 mt-0.5 leading-snug">Real-time Tracking & Insights</span>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Anchored to far right edge over rightmost walkway/trees */}
        <div className="w-full lg:w-[380px] xl:w-[400px] shrink-0 flex items-center justify-end my-auto">
          <div className="w-full max-w-[375px] sm:max-w-[385px] xl:max-w-[400px] bg-white/98 backdrop-blur-md rounded-2xl sm:rounded-[22px] p-4 sm:p-5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.22)] border border-slate-200/90 relative overflow-hidden transition-all duration-300">
            
            {/* Card Emblem & Title */}
            <div className="text-center mb-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 mx-auto mb-1 flex items-center justify-center">
                <img 
                  src={vctmOfficialLogo} 
                  alt="VCTM Emblem" 
                  className="w-full h-full object-contain drop-shadow-sm" 
                />
              </div>
              <h3 className="font-serif-hero font-bold text-lg sm:text-xl text-slate-900 tracking-wider">
                VCTM ERP
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-700 font-medium mt-0.5">
                Vivekananda College of Technology & Management
              </p>
              <div className="flex items-center justify-center gap-2 mt-0.5 text-[9px] font-bold text-slate-600 tracking-[0.25em]">
                <span className="h-px w-5 bg-slate-300"></span>
                <span>ALIGARH</span>
                <span className="h-px w-5 bg-slate-300"></span>
              </div>
            </div>

            {/* Role Selection Tabs (Student / Faculty / Admin) */}
            <div className="grid grid-cols-3 gap-1 bg-slate-50/90 p-1 rounded-xl mb-3 border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => handleRoleTabChange('student')}
                className={clsx(
                  'py-1.5 px-1 rounded-lg transition-all duration-200 cursor-pointer select-none font-semibold flex items-center justify-center gap-1',
                  activeRoleTab === 'student'
                    ? 'bg-[#111827] text-white shadow-sm font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/60 hover:bg-slate-100'
                )}
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('faculty')}
                className={clsx(
                  'py-1.5 px-1 rounded-lg transition-all duration-200 cursor-pointer select-none font-semibold flex items-center justify-center gap-1',
                  activeRoleTab === 'faculty'
                    ? 'bg-[#111827] text-white shadow-sm font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/60 hover:bg-slate-100'
                )}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Faculty / HOD</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('admin')}
                className={clsx(
                  'py-1.5 px-1 rounded-lg transition-all duration-200 cursor-pointer select-none font-semibold flex items-center justify-center gap-1',
                  activeRoleTab === 'admin'
                    ? 'bg-[#111827] text-white shadow-sm font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/60 hover:bg-slate-100'
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Admin</span>
              </button>
            </div>

            {/* Error Message Banner */}
            {(localError || error) && (
              <div className="mb-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium">{localError || error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
              {/* College ID / Faculty ID Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {activeRoleTab === 'student' 
                    ? 'College Roll Number' 
                    : activeRoleTab === 'faculty' 
                    ? 'College ID / Faculty ID' 
                    : 'Admin Identifier / Email'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-3.5 h-3.5" />
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
                        ? 'Enter your college ID / faculty ID' 
                        : 'Enter admin ID/email'
                    }
                    className="w-full pl-8.5 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-800">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-8.5 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-0.5">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#111827] hover:bg-black text-white font-semibold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
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

            {/* Bottom Helper Note inside Card */}
            <div className="mt-3 pt-2 border-t border-slate-100 text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="h-px w-4 bg-slate-300"></span>
                <p className="text-[10px] sm:text-[11px] text-slate-600 font-normal leading-relaxed max-w-xs">
                  {activeRoleTab === 'student' 
                    ? 'Access your attendance, sessional marks, timetable and academic notices with ease.' 
                    : activeRoleTab === 'faculty' 
                    ? 'Access your academic tools and manage your teaching responsibilities with ease.' 
                    : 'Access institutional administration, department oversight, and academic records.'}
                </p>
                <span className="h-px w-4 bg-slate-300"></span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* ======================================================== */}
      {/* 4. PAGE FOOTER                                           */}
      {/* ======================================================== */}
      <footer className="relative z-20 w-full px-6 sm:px-10 lg:px-12 py-1.5 sm:py-2 shrink-0 border-t border-slate-200/70 bg-white/90 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-600">
        <p className="text-center sm:text-left">
          © 2026 Vivekananda College of Technology & Management, Aligarh. All Rights Reserved.
        </p>

        <div className="flex items-center gap-2 text-slate-500">
          <span className="hidden sm:inline-block h-px w-8 bg-slate-300"></span>
          <span>
            Designed & Developed by <strong className="text-slate-900 font-semibold">Tarun Kushwah</strong>
          </span>
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
