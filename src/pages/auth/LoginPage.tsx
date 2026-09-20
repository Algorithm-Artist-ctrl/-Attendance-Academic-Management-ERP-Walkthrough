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

  // Lock desktop html & body against any scrolling while landing page is active
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

  const handleRoleTabChange = (newRole: 'student' | 'faculty' | 'admin') => {
    setActiveRoleTab(newRole);
    setLocalError(null);
    setIdentifier('');
    setPassword('');
  };

  return (
    <div className="landing-page flex flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-slate-900 select-none relative">
      
      {/* ======================================================== */}
      {/* 1. TOP ZONE: INSTITUTIONAL HEADER BAR (72-76px Desktop)  */}
      {/* ======================================================== */}
      <header className="flex-none h-[68px] lg:h-[76px] w-full px-5 sm:px-8 lg:px-12 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shadow-2xs z-20">
        {/* Left: Official College Logo & Institutional Branding */}
        <div className="flex items-center gap-3 sm:gap-3.5">
          <div className="w-10 h-10 lg:w-11 lg:h-11 shrink-0 flex items-center justify-center">
            <img 
              src={vctmOfficialLogo} 
              alt="VCTM Official Emblem" 
              className="w-full h-full object-contain drop-shadow-xs" 
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <h1 className="font-serif-hero font-extrabold text-xl lg:text-[22px] text-slate-950 tracking-wider leading-none">
                VCTM ERP
              </h1>
              <span className="text-[10px] font-bold text-slate-500 tracking-[0.25em]">
                ALIGARH
              </span>
            </div>
            <span className="text-xs text-slate-600 font-medium tracking-normal mt-0.5">
              Vivekananda College of Technology & Management
            </span>
          </div>
        </div>

        {/* Right: Institutional Values Navigation (Desktop) */}
        <nav className="hidden lg:flex items-center gap-3 text-xs font-semibold text-slate-700 tracking-[0.25em] uppercase" aria-label="Institutional Values">
          <span>LEARN</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>INNOVATE</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>GROW</span>
          <span className="text-slate-300 font-normal">|</span>
          <span>ACHIEVE</span>
        </nav>

        {/* Mobile Right: Compact Tag */}
        <div className="lg:hidden">
          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            PORTAL
          </span>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. MIDDLE ZONE: HERO AREA (BACKGROUND + COPY + LOGIN)     */}
      {/* ======================================================== */}
      <main className="hero relative flex-1 min-h-0 w-full overflow-y-auto lg:overflow-hidden">
        
        {/* A. CAMPUS BACKGROUND PHOTO LAYER (Fills middle area, never overflows) */}
        <div className="hero-background absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src={vctmCampusImage}
            alt="Vivekananda College of Technology & Management Campus"
            className="w-full h-full object-cover object-[center_35%] lg:object-[center_28%]"
            loading="eager"
          />
          {/* Subtle sky overlay gradient for hero text legibility while keeping college building visually dominant */}
          <div className="hidden lg:block absolute top-0 left-0 w-[58%] h-[68%] bg-gradient-to-br from-white/92 via-white/55 to-transparent pointer-events-none" />
          {/* Mobile balanced backdrop overlay for readability */}
          <div className="absolute inset-0 bg-slate-950/40 lg:hidden pointer-events-none" />
        </div>

        {/* B. DESKTOP LEFT: HERO COPY (Vertically centered on left) */}
        <section 
          className="hero-copy hidden lg:flex flex-col justify-center absolute left-[4.5vw] top-[46%] -translate-y-1/2 z-10 max-w-[50vw] xl:max-w-[52vw] pointer-events-none select-none"
          aria-label="Institutional Headline"
        >
          <h2 
            className="font-serif-hero font-extrabold text-slate-950 tracking-tight drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]"
            style={{ 
              fontSize: 'clamp(38px, 3.8vw, 60px)',
              lineHeight: 1.02,
              fontWeight: 800
            }}
          >
            Empowering <br />
            Education <span className="font-semibold font-serif-hero text-slate-900">with Technology</span>
          </h2>
          <p className="text-lg lg:text-[20px] text-slate-800 font-sans font-medium tracking-normal drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] mt-3.5 max-w-lg">
            A Smarter Campus for a Brighter Tomorrow
          </p>
        </section>

        {/* C. DESKTOP BOTTOM-LEFT: FEATURE NAVIGATION BAR (Clear spacing from login card) */}
        <nav 
          className="feature-bar hidden lg:flex items-center h-[62px] xl:h-[66px] px-5 bg-[#0f172a]/95 backdrop-blur-md text-white rounded-2xl shadow-xl border border-slate-700/60 absolute left-[4.5vw] bottom-[26px] z-10 divide-x divide-slate-700/60 pointer-events-auto"
          aria-label="Academic Feature Navigation"
        >
          <div className="flex items-center gap-2.5 pr-4 xl:pr-5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold tracking-wider">ACADEMICS</span>
          </div>

          <div className="flex items-center gap-2.5 px-4 xl:px-5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold tracking-wider">ATTENDANCE</span>
          </div>

          <div className="flex items-center gap-2.5 px-4 xl:px-5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold tracking-wider">TIMETABLE</span>
          </div>

          <div className="flex items-center gap-2.5 pl-4 xl:pl-5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold tracking-wider">ASSESSMENTS</span>
          </div>
        </nav>

        {/* D. RIGHT / MOBILE CENTER: LOGIN CARD (Vertically centered, clear breathing space) */}
        <section 
          className="login-card z-10 w-full flex flex-col items-center justify-center p-4 lg:p-0 lg:absolute lg:right-[4.5vw] lg:top-1/2 lg:-translate-y-1/2 lg:w-[420px] xl:w-[450px]"
          aria-label="User Authentication"
        >
          {/* Mobile-Only Compact Brand Title */}
          <div className="lg:hidden flex flex-col items-center text-center mb-3 px-2">
            <div className="w-12 h-12 mb-1.5 flex items-center justify-center bg-white/95 rounded-2xl p-1.5 shadow-md border border-slate-200/80">
              <img 
                src={vctmOfficialLogo} 
                alt="VCTM Official Emblem" 
                className="w-full h-full object-contain drop-shadow-xs" 
              />
            </div>
            <h2 className="font-serif-hero font-extrabold text-2xl text-white tracking-tight leading-tight drop-shadow-md">
              VCTM ERP
            </h2>
            <p className="text-xs font-semibold text-slate-100 tracking-wide mt-0.5 drop-shadow-sm">
              Vivekananda College of Technology & Management
            </p>
          </div>

          {/* Premium Login Card */}
          <div className="w-full max-w-[430px] xl:max-w-[450px] bg-white rounded-[22px] sm:rounded-[24px] p-5 sm:p-6 shadow-[0_16px_45px_-12px_rgba(15,23,42,0.28)] border border-slate-200/90 relative overflow-hidden transition-all duration-300">
            
            {/* Desktop Card Header */}
            <div className="hidden lg:block text-center mb-3.5">
              <div className="w-11 h-11 mx-auto mb-1 flex items-center justify-center">
                <img 
                  src={vctmOfficialLogo} 
                  alt="VCTM Emblem" 
                  className="w-full h-full object-contain drop-shadow-xs" 
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
                  'h-[40px] px-1.5 rounded-lg transition-all duration-200 cursor-pointer select-none text-xs flex items-center justify-center gap-1 sm:gap-1.5',
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
                  'h-[40px] px-1 rounded-lg transition-all duration-200 cursor-pointer select-none text-xs flex items-center justify-center gap-1 sm:gap-1.5',
                  activeRoleTab === 'faculty'
                    ? 'bg-[#0f172a] text-white shadow-sm font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-50 font-semibold'
                )}
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs leading-tight text-center">Faculty&nbsp;/ HOD</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('admin')}
                className={clsx(
                  'h-[40px] px-1.5 rounded-lg transition-all duration-200 cursor-pointer select-none text-xs flex items-center justify-center gap-1 sm:gap-1.5',
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
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-semibold">{localError || error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* College ID / Roll Number Input */}
              <div>
                <label className="block text-xs font-bold text-[#0f172a] mb-1">
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
                    className="w-full h-[46px] sm:h-[48px] pl-10 pr-3.5 text-sm bg-white border border-[#e2e8f0] rounded-xl text-[#0f172a] font-semibold placeholder:text-[#64748b] placeholder:font-normal focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#0f172a]">
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
                    className="w-full h-[46px] sm:h-[48px] pl-10 pr-12 text-sm bg-white border border-[#e2e8f0] rounded-xl text-[#0f172a] font-semibold placeholder:text-[#64748b] placeholder:font-normal focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-[#0f172a] transition-colors cursor-pointer min-w-[40px] justify-center"
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
                  className="w-full h-[46px] sm:h-[48px] px-4 rounded-xl bg-[#0f172a] hover:bg-black text-white font-bold text-sm sm:text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
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
        </section>

      </main>

      {/* ======================================================== */}
      {/* 3. BOTTOM ZONE: COMPACT INSTITUTIONAL FOOTER (40-44px)   */}
      {/* ======================================================== */}
      <footer className="flex-none h-[40px] lg:h-[44px] w-full px-5 sm:px-8 lg:px-12 bg-white/95 backdrop-blur-md border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] lg:text-xs text-slate-600 z-20">
        <p className="text-center sm:text-left font-medium">
          © 2026 Vivekananda College of Technology & Management, Aligarh. All Rights Reserved.
        </p>

        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <span className="hidden sm:inline-block h-px w-5 bg-slate-300"></span>
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
