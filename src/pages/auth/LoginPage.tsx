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
    <div className="min-h-screen relative overflow-x-hidden bg-slate-50 flex flex-col justify-between select-none">
      {/* 1. BACKGROUND CAMPUS PHOTO & SUBTLE GRADIENTS */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={vctmCampusImage}
          alt="Vivekananda College of Technology & Management Campus"
          className="w-full h-full object-cover object-[center_35%] opacity-90 transition-opacity duration-700"
          loading="eager"
        />
        {/* Soft Left & Top White Gradient to guarantee crisp text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent w-full md:w-3/5" />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white via-white/85 to-transparent" />
        {/* Mobile light wash */}
        <div className="absolute inset-0 bg-white/75 lg:hidden" />
      </div>

      {/* 2. TOP RIGHT ANGLED GEOMETRIC SLICE */}
      <div 
        className="absolute top-0 right-0 z-10 hidden xl:flex items-center justify-end pr-8 pl-20 py-4 text-right bg-[#111827] text-white shadow-2xl"
        style={{ clipPath: 'polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
      >
        <p className="font-serif-institutional italic text-xs lg:text-sm text-slate-100 tracking-wide font-normal">
          &ldquo;Education Today, A Better Tomorrow&rdquo;
        </p>
      </div>

      {/* 3. BOTTOM RIGHT ANGLED GEOMETRIC SLICE */}
      <div 
        className="absolute bottom-12 right-0 z-10 hidden xl:flex flex-col items-end pr-8 pl-16 py-3 bg-[#111827] text-white shadow-2xl"
        style={{ clipPath: 'polygon(12% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
      >
        <span className="font-script-accent text-base text-slate-100 tracking-wider">
          Together
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="h-[1px] w-8 bg-slate-400/80"></span>
          <span className="font-serif-institutional italic text-xs text-slate-300">
            for a Better Future
          </span>
        </div>
      </div>

      {/* 4. TOP NAVIGATION BAR */}
      <header className="relative z-20 w-full px-5 sm:px-10 lg:px-14 pt-4 pb-2 flex items-center justify-between">
        {/* Left: Official College Logo & Branding */}
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
            <img 
              src={vctmOfficialLogo} 
              alt="VCTM Official Emblem" 
              className="w-full h-full object-contain drop-shadow-sm" 
            />
          </div>
          <div className="flex flex-col">
            <h1 className="font-serif-institutional font-black text-2xl sm:text-3xl text-slate-900 tracking-wider leading-none">
              VCTM ERP
            </h1>
            <span className="text-[11px] sm:text-xs text-slate-700 font-medium tracking-normal mt-0.5">
              Vivekananda College of Technology & Management
            </span>
            <div className="flex items-center gap-2 mt-0.5 text-[9.5px] font-bold text-slate-600 tracking-[0.25em]">
              <span className="h-[1px] w-5 bg-slate-400"></span>
              <span>ALIGARH</span>
              <span className="h-[1px] w-5 bg-slate-400"></span>
            </div>
          </div>
        </div>

        {/* Center-Right: Core Institutional Values Nav */}
        <nav className="hidden lg:flex items-center gap-4 text-xs font-semibold text-slate-800 tracking-[0.25em] uppercase pr-4 xl:pr-72">
          <span>LEARN</span>
          <span className="text-slate-400 font-normal">|</span>
          <span>INNOVATE</span>
          <span className="text-slate-400 font-normal">|</span>
          <span>GROW</span>
          <span className="text-slate-400 font-normal">|</span>
          <span>ACHIEVE</span>
        </nav>
      </header>

      {/* 5. MAIN HERO & FLOATING LOGIN CARD GRID */}
      <main className="relative z-20 max-w-7xl mx-auto w-full px-5 sm:px-10 lg:px-14 py-6 sm:py-8 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        
        {/* Left Column: Hero Text & Bottom Feature Pills */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-4xl sm:text-5xl lg:text-[54px] font-serif-institutional font-black text-slate-950 tracking-tight leading-[1.12]">
              Empowering <br />
              Education <span className="font-normal font-sans italic text-slate-800">with Technology</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-700 font-normal tracking-normal pt-1">
              A Smarter Campus for a Brighter Tomorrow
            </p>
          </div>

          {/* Bottom Floating Dark Feature Pill Card */}
          <div className="mt-12 sm:mt-16 lg:mt-24 bg-[#0a0f18]/95 backdrop-blur-md text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-800/80 max-w-2xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80">
              
              {/* Feature 1 */}
              <div className="flex flex-col sm:px-3 pt-2 sm:pt-0">
                <GraduationCap className="w-5 h-5 text-slate-300 mb-1.5" />
                <span className="text-xs font-bold text-white leading-tight">Academic Management</span>
                <span className="text-[10px] text-slate-400 mt-0.5 leading-snug">Classes, Subjects & Timetable</span>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col sm:px-3 pt-2 sm:pt-0">
                <Users className="w-5 h-5 text-slate-300 mb-1.5" />
                <span className="text-xs font-bold text-white leading-tight">Student Information</span>
                <span className="text-[10px] text-slate-400 mt-0.5 leading-snug">Profiles, Records & Performance</span>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col sm:px-3 pt-2 sm:pt-0">
                <FileText className="w-5 h-5 text-slate-300 mb-1.5" />
                <span className="text-xs font-bold text-white leading-tight">Assignments & Grading</span>
                <span className="text-[10px] text-slate-400 mt-0.5 leading-snug">Sessional, Quizzes & Evaluations</span>
              </div>

              {/* Feature 4 */}
              <div className="flex flex-col sm:px-3 pt-2 sm:pt-0">
                <TrendingUp className="w-5 h-5 text-slate-300 mb-1.5" />
                <span className="text-xs font-bold text-white leading-tight">Attendance & Reports</span>
                <span className="text-[10px] text-slate-400 mt-0.5 leading-snug">Real-time Tracking & Insights</span>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Floating White Login Card matching Reference Image */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white rounded-3xl sm:rounded-[32px] p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.22)] border border-slate-100 relative overflow-hidden transition-all duration-300">
            
            {/* Card Emblem & Title */}
            <div className="text-center mb-5">
              <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
                <img 
                  src={vctmOfficialLogo} 
                  alt="VCTM Emblem" 
                  className="w-full h-full object-contain drop-shadow-sm" 
                />
              </div>
              <h3 className="font-serif-institutional font-black text-2xl text-slate-900 tracking-wider">
                VCTM ERP
              </h3>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Vivekananda College of Technology & Management
              </p>
              <div className="flex items-center justify-center gap-2 mt-1 text-[9.5px] font-bold text-slate-500 tracking-[0.25em]">
                <span className="h-[1px] w-6 bg-slate-300"></span>
                <span>ALIGARH</span>
                <span className="h-[1px] w-6 bg-slate-300"></span>
              </div>
            </div>

            {/* Role Selection Tabs (Student / Faculty / Admin) */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1.5 rounded-2xl mb-5 border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => handleRoleTabChange('student')}
                className={clsx(
                  'py-2 px-2 rounded-xl transition-all duration-200 cursor-pointer select-none font-semibold flex items-center justify-center gap-1.5',
                  activeRoleTab === 'student'
                    ? 'bg-[#0f172a] text-white shadow-md font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/60 hover:bg-slate-100'
                )}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('faculty')}
                className={clsx(
                  'py-2 px-2 rounded-xl transition-all duration-200 cursor-pointer select-none font-semibold flex items-center justify-center gap-1.5',
                  activeRoleTab === 'faculty'
                    ? 'bg-[#0f172a] text-white shadow-md font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/60 hover:bg-slate-100'
                )}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Faculty / HOD</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleTabChange('admin')}
                className={clsx(
                  'py-2 px-2 rounded-xl transition-all duration-200 cursor-pointer select-none font-semibold flex items-center justify-center gap-1.5',
                  activeRoleTab === 'admin'
                    ? 'bg-[#0f172a] text-white shadow-md font-bold'
                    : 'bg-white text-slate-700 border border-slate-200/60 hover:bg-slate-100'
                )}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Admin</span>
              </button>
            </div>

            {/* Error Message Banner */}
            {(localError || error) && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium">{localError || error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* College ID / Faculty ID Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  {activeRoleTab === 'student' 
                    ? 'College Roll Number' 
                    : activeRoleTab === 'faculty' 
                    ? 'College ID / Faculty ID' 
                    : 'Admin Identifier / Email'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      activeRoleTab === 'student' 
                        ? 'Enter your college roll number' 
                        : activeRoleTab === 'faculty' 
                        ? 'Enter your college ID / faculty ID' 
                        : 'Enter admin identifier'
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-6 rounded-xl bg-[#0f172a] hover:bg-black text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
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
            <div className="mt-5 pt-3 border-t border-slate-200/80 text-center">
              <p className="text-[11.5px] text-slate-500 font-normal leading-relaxed max-w-xs mx-auto">
                {activeRoleTab === 'student' 
                  ? 'Access your attendance, sessional marks, timetable and academic notices with ease.' 
                  : activeRoleTab === 'faculty' 
                  ? 'Access your academic tools and manage your teaching responsibilities with ease.' 
                  : 'Access institutional administration, department oversight, and academic records.'}
              </p>
            </div>

            {/* Subtle light wavy gradient decoration at the bottom of the card */}
            <div className="absolute -bottom-6 -left-6 -right-6 h-12 bg-gradient-to-t from-slate-100/90 to-transparent pointer-events-none rounded-b-3xl" />
          </div>
        </div>

      </main>

      {/* 6. PAGE FOOTER */}
      <footer className="relative z-20 w-full px-5 sm:px-10 lg:px-14 py-4 border-t border-slate-200/90 bg-white/80 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
        <p className="text-center sm:text-left">
          © 2026 Vivekananda College of Technology & Management, Aligarh. All Rights Reserved.
        </p>

        <div className="flex items-center gap-2 text-slate-500">
          <span className="hidden sm:inline-block h-[1px] w-8 bg-slate-300"></span>
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
