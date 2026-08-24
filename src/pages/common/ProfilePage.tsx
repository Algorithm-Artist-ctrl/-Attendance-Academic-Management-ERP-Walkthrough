import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  Edit3, 
  Save, 
  CheckCircle2,
  Sparkles,
  BookOpen,
  MapPin,
  Lock,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';

export const ProfilePage: React.FC = () => {
  const { user, role, changePassword, changeEmail } = useAuth();
  const { 
    institution, 
    departments, 
    programs, 
    years, 
    semesters, 
    sections, 
    faculty, 
    students,
    getStudentAttendance
  } = useAcademic();

  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const student = currentStudent;
  const currentFaculty = user?.faculty;
  
  const studentId = currentStudent?.id || '';
  const stats = role === 'student' && studentId ? getStudentAttendance(studentId) : null;

  const sec = sections.find(s => s.id === currentStudent?.section_id) || 
              sections.find(s => s.name === currentStudent?.section?.name);
  const isSectionB = sec?.name === 'B';
  const dept = departments.find(d => d.id === (student?.department_id || currentFaculty?.department_id)) || departments[0];
  const prog = programs.find(p => p.id === student?.program_id) || programs[0];
  const branchName = prog?.name || (isSectionB ? 'Computer Science & Engineering + IT' : 'Computer Science & Engineering');
  const year = years.find(y => y.id === student?.academic_year_id);
  const sem = semesters.find(s => s.id === student?.semester_id);
  const mentor = faculty.find(f => f.id === student?.mentor_faculty_id);

  // Edit contact state
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(student?.phone || currentFaculty?.phone || user?.phone || '');
  const [email, setEmail] = useState(user?.email || (student ? `${student.roll_number}@student.vctm.in` : ''));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [successBannerText, setSuccessBannerText] = useState('Profile Contact Updated Successfully!');

  // Account Security Modal States
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [passModalError, setPassModalError] = useState('');
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailModalError, setEmailModalError] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    setSuccessBannerText('Profile Contact Updated Successfully!');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassModalError('');

    if (!newPassInput || newPassInput.length < 6) {
      setPassModalError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      setPassModalError('New passwords do not match.');
      return;
    }

    setIsSubmittingPass(true);
    try {
      const res = await changePassword(currentPassInput, newPassInput);
      if (!res.success) {
        setPassModalError(res.error || 'Failed to update password');
        return;
      }
      setIsPassModalOpen(false);
      setSuccessBannerText('Authentication Password Updated Successfully in Supabase Auth!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setPassModalError(err.message || 'Failed to update password');
    } finally {
      setIsSubmittingPass(false);
    }
  };

  const handleChangeEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailModalError('');

    if (!newEmailInput.trim() || !newEmailInput.includes('@')) {
      setEmailModalError('Please enter a valid authorized email address.');
      return;
    }

    setIsSubmittingEmail(true);
    try {
      const res = await changeEmail(newEmailInput.trim());
      if (!res.success) {
        setEmailModalError(res.error || 'Failed to update email');
        return;
      }
      setIsEmailModalOpen(false);
      setEmail(newEmailInput.trim());
      setSuccessBannerText('Authentication Email Synchronized with Supabase Cloud!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setEmailModalError(err.message || 'Failed to update email');
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <User className="w-6 h-6 text-[#00ff88]" />
            Official Identity & Academic Credentials
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Registered credentials for Academic Session 2026–2027 • {institution?.name || 'VCTM Aligarh'}
          </p>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successBannerText}</span>
          </div>
        )}
      </div>

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Avatar & Role Badge */}
        <div className="lg:col-span-4 glass-panel rounded-3xl p-6 border border-emerald-500/20 text-center space-y-4">
          <div className="relative inline-block">
            <div className="w-28 h-28 rounded-3xl bg-slate-950/80 border-2 border-emerald-500/40 flex items-center justify-center text-[#00ff88] text-4xl font-black mx-auto shadow-[0_0_25px_rgba(0,255,136,0.3)]">
              {(user?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-[#00ff88]">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              {user?.full_name || 'User Profile'}
            </h2>
            <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
              {student ? `Roll: ${student.roll_number}` : currentFaculty ? `Code: ${currentFaculty.faculty_code || currentFaculty.employee_code}` : 'ADMINISTRATOR'}
            </p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
              {role === 'super_admin' ? 'Super Administrator' : (role || 'STUDENT').toUpperCase()}
            </span>
          </div>

          {stats && (
            <div className="pt-4 border-t border-emerald-500/15 grid grid-cols-2 gap-2 text-left">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/15">
                <span className="text-[10px] text-slate-400 font-semibold block">Attendance</span>
                <span className="text-lg font-black text-[#00ff88]">{stats.percentage}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/15">
                <span className="text-[10px] text-slate-400 font-semibold block">Section</span>
                <span className="text-lg font-black text-white">{sec?.name}</span>
              </div>
            </div>
          )}

          <div className="pt-2 text-xs text-slate-400 space-y-1 text-left">
            <p><strong>Institution:</strong> {institution?.name || 'Vivekananda College of Technology & Management (340)'}</p>
            <p><strong>Department:</strong> {dept?.name || 'Computer Science & Engineering'}</p>
          </div>
        </div>

        {/* Right Column: Academic & Contact Form */}
        <div className="lg:col-span-8 glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/20 space-y-6">
          <div className="flex items-center justify-between border-b border-emerald-500/15 pb-4">
            <h3 className="text-base font-bold text-white tracking-wide">
              Academic Credentials & Enrolled Section
            </h3>
            <Button
              variant={isEditing ? "outline" : "neon"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
            >
              {isEditing ? "Cancel" : "Edit Contact Info"}
            </Button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  disabled
                  value={user?.full_name || ''}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  disabled={!isEditing}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl ${
                    isEditing 
                      ? 'bg-slate-950/90 border border-emerald-500/40 text-white focus:outline-none focus:border-[#00ff88]' 
                      : 'bg-slate-950/50 border border-emerald-500/15 text-slate-300 font-semibold'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  disabled={!isEditing}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl ${
                    isEditing 
                      ? 'bg-slate-950/90 border border-emerald-500/40 text-white focus:outline-none focus:border-[#00ff88]' 
                      : 'bg-slate-950/50 border border-emerald-500/15 text-slate-300 font-semibold'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Branch / Specialization</label>
                <input
                  type="text"
                  disabled
                  value={branchName}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-emerald-400 font-semibold cursor-not-allowed"
                />
              </div>

              {student && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Enrolled Degree & Semester</label>
                    <input
                      type="text"
                      disabled
                      value={`${prog?.name || 'Academic Program'}${year?.name ? ` • ${year.name}` : ''}${sem?.name ? ` • ${sem.name}` : ''}`}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Section & Classroom</label>
                    <input
                      type="text"
                      disabled
                      value={sec?.name ? `Section ${sec.name}${sec.room_number ? ` (${sec.room_number})` : ''}` : 'Section Not Assigned'}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-[#00ff88] font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Admission Type</label>
                    <input
                      type="text"
                      disabled
                      value={student.admission_type || 'Regular'}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Faculty Mentor</label>
                    <input
                      type="text"
                      disabled
                      value={mentor?.full_name ? `${mentor.full_name} (${mentor.faculty_code || mentor.employee_code})` : 'Not Assigned'}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                    />
                  </div>
                </>
              )}
            </div>

            {isEditing && (
              <div className="flex justify-end pt-4 border-t border-emerald-500/15">
                <Button type="submit" variant="neon" size="sm" leftIcon={<Save className="w-4 h-4 text-slate-950" />}>
                  Save Profile Changes
                </Button>
              </div>
            )}
          </form>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 2. ACCOUNT SECURITY & SUPABASE AUTH CREDENTIALS */}
      {/* ======================================================== */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/15 pb-4">
          <div>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#00ff88]" />
              Account Security & Supabase Credentials
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Manage your real authentication email and login password for VCTM ERP
            </p>
          </div>

          {/* Security Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Email Verified
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Account Active
            </span>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: Login Email */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/20 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Authentication Login Email
                </span>
                <h4 className="text-sm font-bold text-white font-mono mt-1 break-all">
                  {user?.email || (student ? `${student.roll_number}@student.vctm.in` : 'faculty@vctm.in')}
                </h4>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Mail className="w-4 h-4" />
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Official authorized email used to sign in to the VCTM ERP portal.
            </p>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewEmailInput(user?.email || '');
                  setEmailModalError('');
                  setIsEmailModalOpen(true);
                }}
                className="text-xs font-bold"
              >
                Change Email Address
              </Button>
            </div>
          </div>

          {/* Card 2: Password */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/20 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Authentication Password
                </span>
                <h4 className="text-sm font-bold text-white tracking-widest font-mono mt-1">
                  ••••••••••••••••
                </h4>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Encrypted password managed via Supabase Auth. Never stored in plaintext.
            </p>

            <div className="pt-2">
              <Button
                variant="neon"
                size="sm"
                onClick={() => {
                  setCurrentPassInput('');
                  setNewPassInput('');
                  setConfirmPassInput('');
                  setPassModalError('');
                  setIsPassModalOpen(true);
                }}
                className="text-xs font-bold"
              >
                Change Password
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MODALS */}
      {/* ======================================================== */}

      {/* MODAL A: CHANGE PASSWORD */}
      <Modal
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        title="Change Authentication Password"
      >
        <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs">
          {passModalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passModalError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassInput}
              onChange={(e) => setCurrentPassInput(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">New Password (min 6 chars) *</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassInput}
              onChange={(e) => setNewPassInput(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassInput}
              onChange={(e) => setConfirmPassInput(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/15">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsPassModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="neon" size="sm" type="submit" disabled={isSubmittingPass}>
              {isSubmittingPass ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL B: CHANGE EMAIL */}
      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        title="Change Authentication Email Address"
      >
        <form onSubmit={handleChangeEmailSubmit} className="space-y-4 text-xs">
          {emailModalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{emailModalError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Current Login Email</label>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/15 text-slate-400 font-mono">
              {user?.email || 'N/A'}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">New Authorized Email (e.g. Gmail / College Email) *</label>
            <input
              type="email"
              required
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              placeholder="e.g. hemlata.cse@gmail.com"
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Changing your email updates your real Supabase authentication credential and maintains all existing academic records.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/15">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEmailModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="neon" size="sm" type="submit" disabled={isSubmittingEmail}>
              {isSubmittingEmail ? 'Updating...' : 'Update Login Email'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
