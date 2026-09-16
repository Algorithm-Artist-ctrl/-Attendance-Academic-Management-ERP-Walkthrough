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
  const { user, role, changePassword, changeEmail, updateUserProfile, resendEmailVerification, pendingNewEmail } = useAuth();
  const { 
    institution, 
    departments, 
    programs, 
    years, 
    semesters, 
    sections, 
    subjects,
    faculty, 
    assignments,
    timetable,
    students,
    getStudentAttendance,
    refreshData
  } = useAcademic();

  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const student = currentStudent;
  const currentFaculty = user?.faculty || faculty.find(f => f.id === user?.faculty_id || f.id === user?.id || f.email === user?.email);
  
  const studentId = currentStudent?.id || '';
  const stats = role === 'student' && studentId ? getStudentAttendance(studentId) : null;

  const sec = sections.find(s => s.id === currentStudent?.section_id);
  const dept = departments.find(d => d.id === (student?.department_id || currentFaculty?.department_id)) || departments[0];
  const prog = programs.find(p => p.id === student?.program_id) || programs[0];
  const branchName = dept?.name || prog?.name || 'Computer Science & Engineering';
  const year = years.find(y => y.id === student?.academic_year_id);
  const sem = semesters.find(s => s.id === student?.semester_id);
  const mentor = faculty.find(f => f.id === student?.mentor_faculty_id);

  // Faculty specific calculations
  const facId = currentFaculty?.id || user?.faculty_id || user?.id || '';
  const coordinatedSections = sections.filter(s => s.class_coordinator_id === facId);
  const myFsa = (assignments || []).filter(fsa => fsa.faculty_id === facId && fsa.active);
  const myTaughtSubjectIds = Array.from(new Set(myFsa.map(a => a.subject_id)));
  const myTaughtSectionIds = Array.from(new Set(myFsa.map(a => a.section_id)));
  const facultyAssignedSubjectNames = subjects.filter(s => myTaughtSubjectIds.includes(s.id)).map(s => `${s.subject_code} (${s.subject_name})`).join(', ');
  const facultyAssignedSectionNames = sections.filter(s => myTaughtSectionIds.includes(s.id)).map(s => `Section ${s.name}`).join(', ');

  // Edit contact and profile state
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(student?.phone || currentFaculty?.phone || user?.phone || '');
  const [designation, setDesignation] = useState(currentFaculty?.designation || '');
  const [email, setEmail] = useState(user?.email || (student ? `${student.roll_number}@student.vctm.in` : ''));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [successBannerText, setSuccessBannerText] = useState('Profile Updated Successfully!');

  React.useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
    if (student?.phone || currentFaculty?.phone || user?.phone) {
      setPhone(student?.phone || currentFaculty?.phone || user?.phone || '');
    }
    if (currentFaculty?.designation) setDesignation(currentFaculty.designation);
  }, [user, student, currentFaculty]);

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
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendSuccess(false);
    try {
      const res = await resendEmailVerification();
      if (res.success) {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        setSuccessBannerText(res.error || 'Failed to resend confirmation email.');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err: any) {
      setSuccessBannerText(err.message || 'Error resending verification.');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } finally {
      setIsResending(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await updateUserProfile({ 
        full_name: fullName.trim(),
        phone: phone.trim(),
        designation: currentFaculty ? designation.trim() : undefined,
      });
      if (!res.success) {
        setSuccessBannerText(res.error || 'Failed to update profile info');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
        return;
      }
      await refreshData(true);
      setIsEditing(false);
      setSuccessBannerText('Profile Information Updated and Synchronized College-wide!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setSuccessBannerText(err.message || 'Error updating profile');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } finally {
      setIsSaving(false);
    }
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
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
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
      setSuccessBannerText(
        res.pendingVerification
          ? `Confirmation email dispatched to ${newEmailInput.trim()}! Please click the verification link in your inbox.`
          : 'Authentication Email Synchronized with Supabase Cloud!'
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
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
              {isEditing ? "Cancel" : "Edit Profile Info"}
            </Button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Full Legal Name {isEditing && <span className="text-[10px] text-emerald-400 font-normal">(Editable)</span>}
                </label>
                <input
                  type="text"
                  disabled={!isEditing || isSaving}
                  value={isEditing ? fullName : (user?.full_name || '')}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl ${
                    isEditing 
                      ? 'bg-slate-950/90 border border-emerald-500/40 text-white focus:outline-none focus:border-[#00ff88]' 
                      : 'bg-slate-950/50 border border-emerald-500/15 text-slate-300 font-semibold'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Email Address <span className="text-[10px] text-slate-400 font-normal">(Managed via Account Security below)</span>
                </label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950/50 border border-emerald-500/15 text-slate-300 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Contact Phone {isEditing && <span className="text-[10px] text-emerald-400 font-normal">(Editable)</span>}
                </label>
                <input
                  type="tel"
                  disabled={!isEditing || isSaving}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
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

              {role === 'super_admin' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Administrative Role</label>
                    <input
                      type="text"
                      disabled
                      value="System Owner • Full Institutional Control"
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-[#00ff88] font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Institution</label>
                    <input
                      type="text"
                      disabled
                      value={institution?.name || 'Vivekananda College of Technology & Management, Aligarh (Code: 340)'}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Database Authority</label>
                    <input
                      type="text"
                      disabled
                      value="Super Administrator • Authoritative DB Access"
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                    />
                  </div>
                </>
              )}

              {currentFaculty && role !== 'super_admin' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Employee Code & Timetable Code</label>
                    <input
                      type="text"
                      disabled
                      value={`${currentFaculty.employee_code || '—'} • Timetable Code: ${currentFaculty.faculty_code || '—'}`}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-[#00ff88] font-mono font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Designation {isEditing && <span className="text-[10px] text-emerald-400 font-normal">(Editable)</span>} & Department
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="e.g. Assistant Professor & Coordinator (Sec A)"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950/90 border border-emerald-500/40 text-white focus:outline-none focus:border-[#00ff88]"
                      />
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={`${currentFaculty.designation || 'Assistant Professor'} • ${dept?.name || 'Academic Department'}`}
                        className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Teaching Subjects</label>
                    <input
                      type="text"
                      disabled
                      value={facultyAssignedSubjectNames || 'No subjects currently assigned'}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Teaching Sections</label>
                    <input
                      type="text"
                      disabled
                      value={facultyAssignedSectionNames || 'No sections currently assigned'}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                    />
                  </div>
                </>
              )}
            </div>

            {isEditing && (
              <div className="flex justify-end pt-4 border-t border-emerald-500/15 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setIsEditing(false);
                    setPhone(student?.phone || currentFaculty?.phone || user?.phone || '');
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="neon" 
                  size="sm" 
                  disabled={isSaving}
                  leftIcon={<Save className="w-4 h-4 text-slate-950" />}
                >
                  {isSaving ? 'Saving...' : 'Save Profile Changes'}
                </Button>
              </div>
            )}
          </form>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 1.5 CLASS COORDINATOR ASSIGNMENTS (IF APPLICABLE) */}
      {/* ======================================================== */}
      {coordinatedSections.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 space-y-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/15 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30">
                  OFFICIAL ACADEMIC ROLE
                </span>
              </div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2 mt-1">
                <GraduationCap className="w-5 h-5 text-[#00ff88]" />
                Class Coordinator Assignments
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Official coordinator responsibility for complete section oversight and master timetable monitoring
              </p>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Coordinator Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coordinatedSections.map(cSec => {
              const cStudents = students.filter(s => s.section_id === cSec.id && s.active);
              const cLectures = timetable.filter(t => t.section_id === cSec.id && t.active);

              return (
                <div key={cSec.id} className="p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Class Coordinator</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">
                        B.Tech CSE — Second Year — Section {cSec.name}
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-slate-900 border border-emerald-500/30 text-[#00ff88]">
                      {cSec.room_number ? `Room ${cSec.room_number}` : `Section ${cSec.name}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-emerald-500/10">
                    <div>Enrolled Students: <strong className="text-white font-mono">{cStudents.length}</strong></div>
                    <div>Master Classes: <strong className="text-[#00ff88] font-mono">{cLectures.length} / Week</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            {user?.new_email || pendingNewEmail ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-3 h-3 text-amber-400" /> Verification Pending
              </span>
            ) : user?.email_confirmed_at ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Email Verified
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800/80 border border-emerald-500/20 text-slate-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Institutional Account
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Account Active
            </span>
          </div>
        </div>

        {/* Credentials Section */}
        {role === 'student' ? (
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00ff88]" />
                <h4 className="text-sm font-bold text-white">Institutional Authentication Managed by Administration</h4>
              </div>
              <p className="text-xs text-slate-400 max-w-2xl">
                Student institutional authentication credentials and email are managed by college administration. 
                Students cannot alter authentication passwords or login emails directly. If you require assistance or credential updates, please contact your Head of Department (HOD) or the central registrar.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono">
                <span className="text-slate-500">Official Login Identifier: <strong className="text-white">{user?.email || (student ? `${student.roll_number}@student.vctm.in` : '')}</strong></span>
                <span className="text-slate-500">Security Policy: <strong className="text-emerald-400">Institutional Admin Controlled</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Login Email */}
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/20 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Authentication Login Email
                  </span>
                  <h4 className="text-sm font-bold text-white font-mono mt-1 break-all">
                    {user?.email || 'faculty@vctm.in'}
                  </h4>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Mail className="w-4 h-4" />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Official authorized email used to sign in to the VCTM ERP portal.
              </p>

              {(user?.new_email || pendingNewEmail) && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-amber-300 text-[11.5px]">Email Change Awaiting Confirmation</span>
                      <span className="text-[11px] text-slate-300">
                        Supabase sent a confirmation link to <strong className="text-white font-mono">{user?.new_email || pendingNewEmail}</strong>. Click the link in your inbox to complete the change.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-amber-500/15">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      isLoading={isResending}
                      className="text-[10.5px] border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                    >
                      Resend Verification Email
                    </Button>
                    {resendSuccess && (
                      <span className="text-[10.5px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Link resent!
                      </span>
                    )}
                  </div>
                </div>
              )}

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
        )}

      </div>

      {/* ======================================================== */}
      {/* 3. MODALS */}
      {/* ======================================================== */}

      {/* MODAL A: CHANGE PASSWORD */}
      {role !== 'student' && (
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
      )}

      {/* MODAL B: CHANGE EMAIL */}
      {role !== 'student' && (
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

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/15 text-[11px] text-slate-300 space-y-1">
              <p className="font-semibold text-emerald-400">Official Supabase Verification Notice:</p>
              <p className="text-slate-400">
                Supabase Auth will dispatch a confirmation email with a secure verification link to your new address. Your login credentials and database records will automatically update once you click the confirmation link.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/15">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsEmailModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="neon" size="sm" type="submit" disabled={isSubmittingEmail}>
                {isSubmittingEmail ? 'Dispatching Verification...' : 'Send Verification Link'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
