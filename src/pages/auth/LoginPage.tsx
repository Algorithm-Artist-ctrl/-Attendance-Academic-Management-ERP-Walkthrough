import React, { useState, useEffect } from 'react';
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
  Calendar,
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

  // Enforce zero-scroll on desktop html & body while landing page is mounted
  useEffect(() => {
    document.documentElement.classList.add('landing-page-active');
    document.body.classList.add('landing-page-active');
    return () => {
      document.documentElement.classList.remove('landing-page-active');
      document.body.classList.remove('landing-page-active');
    };
  }, []);

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
    <div className="landing-page h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between bg-slate-50 select-none relative overflow-hidden">
      
      {/* ======================================================== */}
      {/* 1. CAMPUS BACKGROUND PHOTO (Ultra-Optimized Mobile LCP)   */}
      {/* ======================================================== */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={vctmCampusImage}
          alt="Vivekananda College of Technology & Management Campus"
          className="w-full h-full object-cover object-[center_top] lg:object-[center_25%]"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        {/* Desktop localized sky gradient (upper-left) */}
        <div className="hidden lg:block absolute top-0 left-0 w-[480px] max-w-[48%] h-[28%] bg-gradient-to-br from-white/85 via-white/30 to-transparent pointer-events-none" />
        {/* Mobile balanced backdrop overlay for readability while keeping the building visible */}
        <div className="absolute inset-0 bg-slate-900/25 lg:hidden pointer-events-none" />
        {/* Desktop subtle right-side contrast shadow */}
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-900/10 pointer-events-none" />
      </div>

      {/* ======================================================== */}
      {/* 2. INSTITUTIONAL HEADER BAR (Exact First Screenshot)     */}
      {/* ======================================================== */}
      <header className="relative z-20 w-full px-6 sm:px-8 lg:px-12 py-2.5 shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/70 flex items-center justify-between shadow-xs">
        {/* Left: Official College Logo & Institutional Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center">
            <img 
              src={vctmOfficialLogo} 
              alt="VCTM Official Emblem" 
              className="w-full h-full object-contain drop-shadow-xs" 
              width={40}
              height={40}
              loading="eager"
              decoding="async"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <h1 className="font-serif-hero font-bold text-xl text-slate-900 tracking-wider leading-none">
                VCTM ERP
              </h1>
              <span className="text-[9px] font-bold text-slate-500 tracking-[0.25em]">
                ALIGARH
              </span>
            </div>
            <span className="text-xs text-slate-600 font-medium tracking-normal mt-0.5">
              Vivekananda College of Technology & Management
            </span>
          </div>
        </div>

        {/* Right: Institutional Values Navigation */}
        <nav className="flex items-center gap-3 text-xs font-semibold text-slate-700 tracking-[0.25em] uppercase">
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
      <main className="relative z-20 flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-12 max-w-[1780px] mx-auto flex flex-col lg:flex-row items-center lg:items-stretch justify-center lg:justify-between gap-4 lg:gap-8 pt-3 sm:pt-4 lg:pt-4 pb-4 sm:pb-5 lg:pb-6 overflow-y-auto lg:overflow-hidden">
        
        {/* Left Column (Desktop Only): Hero Text in Sky & Feature Strip over Lawn */}
        <div className="hidden lg:flex flex-1 flex-col justify-between min-w-0 pr-6 h-full">
          {/* Hero Headlines (Positioned in upper sky, matching First Screenshot) */}
          <div className="max-w-lg pt-3 sm:pt-4 lg:pt-4">
            <h2 
              className="font-serif-hero font-bold text-slate-950 tracking-tight leading-[1.04] drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]"
              style={{ fontSize: 'clamp(36px, 3.3vw, 52px)' }}
            >
              Empowering <br />
              Education <span className="font-normal font-serif-hero text-slate-900">with Technology</span>
            </h2>
            <p className="text-sm lg:text-[15px] text-slate-800 font-sans font-medium tracking-normal drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] mt-2 max-w-md">
              A Smarter Campus for a Brighter Tomorrow
            </p>
          </div>

          {/* Compact Single Horizontal Feature Strip (Anchored to bottom-left over green lawn) */}
          <div className="w-full max-w-xl xl:max-w-2xl bg-[#0f172a]/95 backdrop-blur-md text-white rounded-xl py-2.5 px-4 shadow-xl border border-slate-700/60 mt-auto mb-1">
            <div className="flex items-center justify-between divide-x divide-slate-700/60 text-xs font-semibold tracking-wide">
              <div className="flex items-center gap-2 pr-3">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white shrink-0">
                  <GraduationCap className="w-3.5 h-3.5" />
                </div>
                <span>ACADEMICS</span>
              </div>
              <div className="flex items-center gap-2 px-3">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <span>ATTENDANCE</span>
              </div>
              <div className="flex items-center gap-2 px-3">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <span>TIMETABLE</span>
              </div>
              <div className="flex items-center gap-2 pl-3">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span>ASSESSMENTS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side / Mobile Center: Login Card Container (Vertically Centered) */}
        <div className="w-full lg:w-[420px] xl:w-[450px] shrink-0 flex flex-col items-center justify-center my-auto">
          
          {/* Mobile-Only Compact Brand Header */}
          <div className="lg:hidden flex flex-col items-center text-center mb-3 sm:mb-4 px-2">
            <div className="w-14 h-14 mb-1.5 flex items-center justify-center bg-white/95 rounded-2xl p-1.5 shadow-md border border-slate-200/80">
              <img 
                src={vctmOfficialLogo} 
                alt="VCTM Official Emblem" 
                className="w-full h-full object-contain drop-shadow-xs" 
                width={56}
                height={56}
                loading="eager"
                decoding="async"
              />
            </div>
            <h1 className="font-serif-hero font-extrabold text-2xl text-slate-950 tracking-tight leading-tight drop-shadow-sm">
              VCTM ERP
            </h1>
            <p className="text-xs font-semibold text-slate-800 tracking-wide mt-0.5 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
              Vivekananda College of Technology & Management
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-700 uppercase">
                ALIGARH
              </span>
              <span className="text-slate-400">•</span>
              <span className="inline-flex items-center text-[11px] font-semibold text-slate-700 bg-white/90 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-slate-200/80 shadow-2xs">
                Smart Campus. One ERP.
              </span>
            </div>
          </div>

          {/* Premium Login Card (Exact First Screenshot Proportions & Styling) */}
          <div className="w-[calc(100%-16px)] sm:w-[calc(100%-32px)] max-w-[440px] xl:max-w-[460px] bg-white rounded-[24px] p-5 sm:p-6 lg:p-6 shadow-[0_16px_45px_-10px_rgba(15,23,42,0.22)] border border-slate-200/90 relative overflow-hidden transition-all duration-300">
            
            {/* Desktop Card Header */}
            <div className="hidden lg:block text-center mb-3.5">
              <div className="w-12 h-12 mx-auto mb-1 flex items-center justify-center">
                <img 
                  src={vctmOfficialLogo} 
                  alt="VCTM Emblem" 
                  className="w-full h-full object-contain drop-shadow-xs" 
                  width={48}
                  height={48}
                  loading="eager"
                  decoding="async"
                />
              </div>
              <h3 className="font-serif-hero font-bold text-xl text-slate-900 tracking-wider">
                VCTM ERP
              </h3>
              <p className="text-xs text-slate-700 font-medium mt-0.5">
                Vivekananda College of Technology & Management
              </p>
              <div className="flex items-center justify-center gap-2 mt-1 text-[9px] font-bold text-slate-600 tracking-[0.25em]">
                <span className="h-px w-5 bg-slate-300"></span>
                <span>ALIGARH</span>
                <span className="h-px w-5 bg-slate-300"></span>
              </div>
            </div>

            {/* Role Selection Tabs (Student / Faculty-HOD / Admin) */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-xl mb-3.5 border border-slate-200">
              <button
                type="button"
                onClick={() => handleRoleTabChange('student')}
                className={clsx(
                  'min-h-[40px] sm:min-h-[42px] py-1 px-1.5 sm:px-2 rounded-lg transition-all duration-200 cursor-pointer select-none text-xs flex items-center justify-center gap-1 sm:gap-1.5',
                  activeRoleTab === 'student'
                    ? 'bg-[#0f172a] text-white shadow-sm font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-50 font-semibold'
                )}
              >
                <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('faculty')}
                className={clsx(
                  'min-h-[40px] sm:min-h-[42px] py-1 px-1 sm:px-2 rounded-lg transition-all duration-200 cursor-pointer select-none text-xs flex items-center justify-center gap-1 sm:gap-1.5',
                  activeRoleTab === 'faculty'
                    ? 'bg-[#0f172a] text-white shadow-sm font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-50 font-semibold'
                )}
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs leading-tight text-center whitespace-nowrap">Faculty / HOD</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('admin')}
                className={clsx(
                  'min-h-[40px] sm:min-h-[42px] py-1 px-1.5 sm:px-2 rounded-lg transition-all duration-200 cursor-pointer select-none text-xs flex items-center justify-center gap-1 sm:gap-1.5',
                  activeRoleTab === 'admin'
                    ? 'bg-[#0f172a] text-white shadow-sm font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-50 font-semibold'
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Admin</span>
              </button>
            </div>

            {/* Error Message Alert */}
            {(localError || error) && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-semibold">{localError || error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* College ID / Roll Number Input */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#0f172a] mb-1">
                  {activeRoleTab === 'student' 
                    ? 'College Roll Number' 
                    : activeRoleTab === 'faculty' 
                    ? 'College ID / Faculty ID' 
                    : 'Admin Identifier / Email'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
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
                        ? 'Enter college ID / faculty email' 
                        : 'Enter admin ID / email'
                    }
                    className="w-full h-[48px] pl-10 pr-3.5 text-sm bg-white border border-[#e2e8f0] rounded-xl text-[#0f172a] font-semibold placeholder:text-[#64748b] placeholder:font-normal focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs sm:text-sm font-bold text-[#0f172a]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-xs font-bold text-[#0f172a] hover:underline transition-colors cursor-pointer py-0.5"
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
                    className="w-full h-[48px] pl-10 pr-12 text-sm bg-white border border-[#e2e8f0] rounded-xl text-[#0f172a] font-semibold placeholder:text-[#64748b] placeholder:font-normal focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-[#0f172a] transition-colors cursor-pointer min-w-[40px] justify-center"
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
                  className="w-full h-[48px] px-4 rounded-xl bg-[#0f172a] hover:bg-black text-white font-bold text-sm sm:text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
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

            {/* Helper Note inside Card */}
            <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-center">
              <p className="text-[11px] text-[#334155] font-medium leading-relaxed max-w-xs mx-auto">
                {activeRoleTab === 'student' 
                  ? 'Access your attendance, sessional marks, timetable and academic notices with ease.' 
                  : activeRoleTab === 'faculty' 
                  ? 'Access your academic tools and manage your teaching responsibilities with ease.' 
                  : 'Access institutional administration, department oversight, and academic records.'}
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* ======================================================== */}
      {/* 4. COMPACT INSTITUTIONAL FOOTER (Exact First Screenshot) */}
      {/* ======================================================== */}
      <footer className="relative z-20 w-full px-4 sm:px-8 lg:px-12 py-2.5 sm:py-3 shrink-0 border-t border-slate-200/80 bg-white/90 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs text-slate-600">
        <p className="text-center sm:text-left font-medium">
          © 2026 Vivekananda College of Technology & Management, Aligarh. All Rights Reserved.
        </p>

        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <span className="hidden sm:inline-block h-px w-6 bg-slate-300"></span>
          <span>
            Designed & Developed by <strong className="text-[#0f172a] font-bold">Tarun Kushwah</strong>
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
