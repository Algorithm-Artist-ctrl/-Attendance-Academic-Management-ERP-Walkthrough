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
import { AdmissionType } from '../../types/database.types';

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
    classCoordinatorAssignments,
    getFacultyCoordinatorAssignments,
    timetable,
    students,
    getStudentAttendance,
    refreshData,
    refreshStudents,
    refreshFaculty
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
  const coordinatorRecords = getFacultyCoordinatorAssignments 
    ? getFacultyCoordinatorAssignments(facId) 
    : [];
  const coordinatedSections = coordinatorRecords.length > 0
    ? coordinatorRecords.map(cr => {
        const secObj = sections.find(s => s.id === cr.section_id);
        const semObj = semesters.find(s => s.id === secObj?.semester_id);
        const yrObj = years.find(y => y.id === semObj?.academic_year_id);
        return {
          ...(secObj || (cr.section as any)),
          year_name: yrObj?.name || (cr.section as any)?.semester?.academic_year?.name || 'Academic Year',
        };
      })
    : sections.filter(s => s.class_coordinator_id === facId).map(s => {
        const semObj = semesters.find(sem => sem.id === s.semester_id);
        const yrObj = years.find(y => y.id === semObj?.academic_year_id);
        return {
          ...s,
          year_name: yrObj?.name || 'Academic Year',
        };
      });
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

  // Student-specific editable academic credentials state
  const [selectedSectionId, setSelectedSectionId] = useState(currentStudent?.section_id || '');
  const [classroomRoom, setClassroomRoom] = useState(sec?.room_number || '');
  const [admissionType, setAdmissionType] = useState<AdmissionType>((currentStudent?.admission_type as AdmissionType) || 'Regular');
  const [selectedMentorId, setSelectedMentorId] = useState(currentStudent?.mentor_faculty_id || '');

  React.useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
    if (student?.phone || currentFaculty?.phone || user?.phone) {
      setPhone(student?.phone || currentFaculty?.phone || user?.phone || '');
    }
    if (currentFaculty?.designation) setDesignation(currentFaculty.designation);
    if (student?.section_id) setSelectedSectionId(student.section_id);
    if (sec?.room_number) setClassroomRoom(sec.room_number);
    if (student?.admission_type) setAdmissionType(student.admission_type as AdmissionType);
    if (student?.mentor_faculty_id) setSelectedMentorId(student.mentor_faculty_id);
  }, [user, student, currentFaculty, sec]);

  // Scoped active sections for student
  const studentAvailableSections = React.useMemo(() => {
    if (student?.semester_id) {
      const match = sections.filter(s => s.active && s.semester_id === student.semester_id);
      if (match.length > 0) return match;
    }
    if (student?.academic_year_id) {
      const matchingSemIds = semesters.filter(s => s.academic_year_id === student.academic_year_id).map(s => s.id);
      const match = sections.filter(s => s.active && matchingSemIds.includes(s.semester_id));
      if (match.length > 0) return match;
    }
    return sections.filter(s => s.active);
  }, [sections, semesters, student?.semester_id, student?.academic_year_id]);

  const handleSectionChange = (newSecId: string) => {
    setSelectedSectionId(newSecId);
    const newSec = sections.find(s => s.id === newSecId);
    if (newSec?.room_number) {
      setClassroomRoom(newSec.room_number);
    }
  };

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

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFullName(user?.full_name || '');
    setPhone(student?.phone || currentFaculty?.phone || user?.phone || '');
    setDesignation(currentFaculty?.designation || '');
    setSelectedSectionId(student?.section_id || '');
    setClassroomRoom(sec?.room_number || '');
    setAdmissionType((student?.admission_type as AdmissionType) || 'Regular');
    setSelectedMentorId(student?.mentor_faculty_id || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (role === 'student') {
        if (!fullName.trim()) {
          setSuccessBannerText('Full Legal Name is required.');
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3500);
          setIsSaving(false);
          return;
        }

        const chosenSection = sections.find(s => s.id === selectedSectionId);
        const chosenSem = semesters.find(s => s.id === chosenSection?.semester_id);
        const chosenYear = years.find(y => y.id === chosenSem?.academic_year_id);

        const res = await updateUserProfile({ 
          full_name: fullName.trim().toUpperCase(),
          phone: phone.trim(),
          section_id: selectedSectionId || undefined,
          mentor_faculty_id: selectedMentorId || null,
          admission_type: admissionType,
          semester_id: chosenSem?.id,
          academic_year_id: chosenYear?.id,
        });
        if (!res.success) {
          setSuccessBannerText(res.error || 'Failed to update student profile');
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3500);
          return;
        }
        await refreshStudents();
        setIsEditing(false);
        setSuccessBannerText('Student Profile & Academic Credentials Successfully Updated!');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
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
        await refreshFaculty();
        setIsEditing(false);
        setSuccessBannerText('Profile Information Updated and Synchronized College-wide!');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
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
      setSuccessBannerText('Authentication Password Updated Successfully!');
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
          ? `Confirmation link sent to your new email address (${newEmailInput.trim()}). Please verify to complete the change.`
          : 'Authentication Email Synchronized Successfully!'
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
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif-institutional font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <User className="w-6 h-6 text-slate-900" />
            Official Identity & Academic Credentials
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered credentials for Academic Session 2026–2027 • {institution?.name || 'VCTM Aligarh'}
          </p>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successBannerText}</span>
          </div>
        )}
      </div>

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Avatar & Role Badge */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="relative inline-block">
            <div className="w-28 h-28 rounded-3xl bg-[#0f172a] text-white flex items-center justify-center text-4xl font-bold mx-auto shadow-xs">
              {(user?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {user?.full_name || 'User Profile'}
            </h2>
            <p className="text-xs font-bold text-slate-600 font-mono mt-0.5">
              {student ? `Roll: ${student.roll_number}` : currentFaculty ? `Code: ${currentFaculty.faculty_code || currentFaculty.employee_code}` : 'ADMINISTRATOR'}
            </p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-700">
              {role === 'super_admin' ? 'Super Administrator' : (role || 'STUDENT').toUpperCase()}
            </span>
          </div>

          {stats && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-left">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 font-semibold block">Attendance</span>
                <span className="text-lg font-bold text-slate-900">{stats.percentage}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 font-semibold block">Section</span>
                <span className="text-lg font-bold text-slate-900">{sec?.name}</span>
              </div>
            </div>
          )}

          <div className="pt-2 text-xs text-slate-600 space-y-1 text-left">
            <p><strong>Institution:</strong> {institution?.name || 'Vivekananda College of Technology & Management (340)'}</p>
            <p><strong>Department:</strong> {dept?.name || 'Computer Science & Engineering'}</p>
          </div>
        </div>

        {/* Right Column: Academic & Contact Form */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 tracking-wide">
              Academic Credentials & Enrolled Section
            </h3>
            <Button
              variant={isEditing ? "outline" : "primary"}
              size="sm"
              onClick={() => {
                if (isEditing) {
                  handleCancelEdit();
                } else {
                  setIsEditing(true);
                }
              }}
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
            >
              {isEditing ? "Cancel" : "Edit Profile Info"}
            </Button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  Full Legal Name {isEditing && <span className="text-xs text-emerald-700 font-medium">(Editable)</span>}
                </label>
                <input
                  type="text"
                  disabled={!isEditing || isSaving}
                  value={isEditing ? fullName : (user?.full_name || '')}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm sm:text-base rounded-xl ${
                    isEditing 
                      ? 'bg-white border border-slate-300 text-[#0f172a] font-semibold focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-xs' 
                      : 'bg-slate-50 border border-slate-300 text-[#0f172a] font-semibold cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  Email Address <span className="text-xs text-[#475569] font-medium">{role === 'student' ? '(Institutional Login Identifier)' : '(Managed via Account Security below)'}</span>
                </label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3.5 py-2.5 text-sm sm:text-base rounded-xl bg-slate-50 border border-slate-300 text-[#0f172a] font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  Contact Phone {isEditing && <span className="text-xs text-emerald-700 font-medium">(Editable)</span>}
                </label>
                <input
                  type="tel"
                  disabled={!isEditing || isSaving}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className={`w-full px-3.5 py-2.5 text-sm sm:text-base rounded-xl ${
                    isEditing 
                      ? 'bg-white border border-slate-300 text-[#0f172a] font-semibold focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-xs' 
                      : 'bg-slate-50 border border-slate-300 text-[#0f172a] font-semibold cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Branch / Specialization</label>
                <input
                  type="text"
                  disabled
                  value={branchName}
                  className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                />
              </div>

              {student && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Enrolled Degree & Semester</label>
                    <input
                      type="text"
                      disabled
                      value={`${prog?.name || 'B.Tech in Computer Science & Engineering'}${year?.name ? ` • ${year.name}` : ''}${sem?.name ? ` • ${sem.name}` : ''}`}
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                      Assigned Section {isEditing && <span className="text-xs text-emerald-700 font-medium">(Editable)</span>}
                    </label>
                    {isEditing ? (
                      <select
                        value={selectedSectionId}
                        onChange={(e) => handleSectionChange(e.target.value)}
                        disabled={isSaving}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base rounded-xl bg-white border border-slate-300 text-[#0f172a] font-semibold focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-xs"
                      >
                        <option value="">Select Section</option>
                        {studentAvailableSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            Section {s.name} {s.room_number ? `(Room ${s.room_number})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={sec?.name ? `Section ${sec.name}` : 'Section Not Assigned'}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-bold cursor-not-allowed"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                      Assigned Classroom / Room {isEditing && <span className="text-xs text-emerald-700 font-medium">(Editable)</span>}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={classroomRoom}
                        onChange={(e) => setClassroomRoom(e.target.value)}
                        placeholder="e.g. Room 204 or LH-1"
                        disabled={isSaving}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base rounded-xl bg-white border border-slate-300 text-[#0f172a] font-semibold focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-xs"
                      />
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={sec?.room_number || classroomRoom || '—'}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-bold cursor-not-allowed"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                      Admission Type {isEditing && <span className="text-xs text-emerald-700 font-medium">(Editable)</span>}
                    </label>
                    {isEditing ? (
                      <select
                        value={admissionType}
                        onChange={(e) => setAdmissionType(e.target.value as AdmissionType)}
                        disabled={isSaving}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base rounded-xl bg-white border border-slate-300 text-[#0f172a] font-semibold focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-xs"
                      >
                        <option value="Regular">Regular</option>
                        <option value="Lateral Entry">Lateral Entry</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={student.admission_type || admissionType || 'Regular'}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                      Assigned Faculty Mentor {isEditing && <span className="text-xs text-emerald-700 font-medium">(Editable)</span>}
                    </label>
                    {isEditing ? (
                      <select
                        value={selectedMentorId}
                        onChange={(e) => setSelectedMentorId(e.target.value)}
                        disabled={isSaving}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base rounded-xl bg-white border border-slate-300 text-[#0f172a] font-semibold focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-xs"
                      >
                        <option value="">No Faculty Mentor Assigned</option>
                        {faculty.filter(f => f.active).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.full_name} ({f.faculty_code || f.employee_code || 'Faculty'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={mentor?.full_name ? `${mentor.full_name} (${mentor.faculty_code || mentor.employee_code})` : 'Not Assigned'}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                      />
                    )}
                  </div>
                </>
              )}

              {role === 'super_admin' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Administrative Role</label>
                    <input
                      type="text"
                      disabled
                      value="System Owner • Full Institutional Control"
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Institution</label>
                    <input
                      type="text"
                      disabled
                      value={institution?.name || 'Vivekananda College of Technology & Management, Aligarh (Code: 340)'}
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Database Authority</label>
                    <input
                      type="text"
                      disabled
                      value="Super Administrator • Authoritative DB Access"
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                    />
                  </div>
                </>
              )}

              {currentFaculty && role !== 'super_admin' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Employee Code & Timetable Code</label>
                    <input
                      type="text"
                      disabled
                      value={`${currentFaculty.employee_code || '—'} • Timetable Code: ${currentFaculty.faculty_code || '—'}`}
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-mono font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                      Designation {isEditing && <span className="text-xs text-emerald-700 font-medium">(Editable)</span>} & Department
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="e.g. Assistant Professor & Coordinator (Sec A)"
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base rounded-xl bg-white border border-slate-300 text-[#0f172a] font-semibold focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-xs"
                      />
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={`${currentFaculty.designation || 'Assistant Professor'} • ${dept?.name || 'Academic Department'}`}
                        className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Assigned Teaching Subjects</label>
                    <input
                      type="text"
                      disabled
                      value={facultyAssignedSubjectNames || 'No subjects currently assigned'}
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Assigned Teaching Sections</label>
                    <input
                      type="text"
                      disabled
                      value={facultyAssignedSectionNames || 'No sections currently assigned'}
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Class Coordinator Assignment</label>
                    <input
                      type="text"
                      disabled
                      value={
                        coordinatedSections.length > 0
                          ? coordinatedSections.map(cSec => `${cSec.year_name || 'Academic Year'} • Section ${cSec.name}${cSec.room_number ? ` (Room ${cSec.room_number})` : ''}`).join(', ')
                          : 'No coordinator assignment'
                      }
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-[#0f172a] font-semibold cursor-not-allowed"
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
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
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
      {role === 'faculty' && (
        coordinatedSections.length > 0 ? (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    OFFICIAL ACADEMIC ROLE
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
                  <GraduationCap className="w-5 h-5 text-slate-700" />
                  Class Coordinator Assignments
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Official coordinator responsibility for complete section oversight and master timetable monitoring
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Coordinator Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coordinatedSections.map(cSec => {
                const cStudents = students.filter(s => s.section_id === cSec.id && s.active);
                const cLectures = timetable.filter(t => t.section_id === cSec.id && t.active);

                return (
                  <div key={cSec.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">Class Coordinator</span>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                          {branchName} — {cSec.year_name || 'Academic Year'} — Section {cSec.name}
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-white border border-slate-200 text-slate-900 shadow-2xs">
                        {cSec.room_number ? `Room ${cSec.room_number}` : `Section ${cSec.name}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200/80">
                      <div>Enrolled Students: <strong className="text-slate-900 font-mono">{cStudents.length}</strong></div>
                      <div>Master Classes: <strong className="text-slate-900 font-mono">{cLectures.length} / Week</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-slate-700" />
                Class Coordinator Assignment
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600">
                Not Assigned
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Class Coordinator: <strong className="text-slate-900">No coordinator assignment</strong>. Coordinator roles are assigned by the Head of Department (HOD) or Super Administrator in the Faculty Directory.
            </p>
          </div>
        )
      )}

      {/* ======================================================== */}
      {/* 2. ACCOUNT SECURITY & LOGIN CREDENTIALS */}
      {/* ======================================================== */}
      {role !== 'student' && (
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-black text-[#0f172a] tracking-tight flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#0f172a]" />
              Account Security & Login Credentials
            </h3>
            <p className="text-sm text-[#475569] mt-0.5 font-medium">
              Manage your real authentication email and login password for VCTM ERP
            </p>
          </div>

          {/* Security Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {user?.new_email || pendingNewEmail ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Verification Pending
              </span>
            ) : user?.email_confirmed_at ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Email Verified
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 border border-slate-300 text-[#0f172a] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Institutional Account
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Account Active
            </span>
          </div>
        </div>

        {/* Credentials Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Login Email */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#334155]">
                    Authentication Login Email
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-[#0f172a] font-mono mt-1.5 break-all">
                    {user?.email || 'faculty@vctm.in'}
                  </h4>
                </div>
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
                  <Mail className="w-4 h-4" />
                </div>
              </div>

              <p className="text-sm text-[#475569] font-medium">
                Official authorized email used to sign in to the VCTM ERP portal.
              </p>

              {(user?.new_email || pendingNewEmail) && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-amber-900 text-[11.5px]">Email Change Awaiting Confirmation</span>
                      <span className="text-xs text-[#475569] font-medium">
                        A confirmation link was sent to <strong className="text-[#0f172a] font-mono">{user?.new_email || pendingNewEmail}</strong>. Click the link in your inbox to complete the change.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      isLoading={isResending}
                      className="text-xs font-bold border-slate-400 text-[#0f172a] hover:bg-slate-100 bg-white shadow-xs"
                    >
                      Resend Verification Email
                    </Button>
                    {resendSuccess && (
                      <span className="text-xs text-emerald-800 font-bold flex items-center gap-1">
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
                  className="text-xs font-bold border-slate-400 text-[#0f172a] hover:bg-slate-100 bg-white shadow-xs"
                >
                  Change Email Address
                </Button>
              </div>
            </div>

            {/* Card 2: Password */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#334155]">
                    Authentication Password
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-widest font-mono mt-1.5">
                    ••••••••••••••••
                  </h4>
                </div>
                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800">
                  <KeyRound className="w-4 h-4" />
                </div>
              </div>

              <p className="text-sm text-[#475569] font-medium">
                Encrypted password managed via secure institutional authentication. Never stored in plaintext.
              </p>

              <div className="pt-2">
                <Button
                  variant="primary"
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
      )}

      {/* Student Credential Policy Banner */}
      {role === 'student' && (
        <div className="bg-slate-50 rounded-3xl p-6 sm:p-7 border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#0f172a] tracking-wide">
                Institutional Credential Policy & Security Protection
              </h3>
              <p className="text-xs text-[#334155] leading-relaxed font-medium">
                Student login credentials (official roll number, institutional login email, and initial access passwords) are centrally administered and protected by the Academic Registrar and Super Admin.
              </p>
              <p className="text-xs text-[#475569] leading-relaxed font-medium">
                Students cannot self-alter institutional passwords. If you need a password reset or credential update, please contact the Super Admin or Academic Administration office.
              </p>
            </div>
          </div>
        </div>
      )}

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
            <label className="block text-slate-700 font-semibold mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassInput}
              onChange={(e) => setCurrentPassInput(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">New Password (min 6 chars) *</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassInput}
              onChange={(e) => setNewPassInput(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassInput}
              onChange={(e) => setConfirmPassInput(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/15">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsPassModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmittingPass}>
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
              <label className="block text-[#0f172a] font-bold mb-1">Current Login Email</label>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0f172a] font-bold font-mono">
                {user?.email || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-[#0f172a] font-bold mb-1">New Authorized Email (e.g. Gmail / College Email) *</label>
              <input
                type="email"
                required
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                placeholder="e.g. hemlata.cse@gmail.com"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[#0f172a] font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-emerald-800">Official Verification Notice:</p>
              <p className="text-[#475569] font-medium leading-relaxed">
                A confirmation email with a secure verification link will be dispatched to your new address. Your login credentials and institutional records will automatically update once you click the confirmation link.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/15">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsEmailModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isSubmittingEmail}>
                {isSubmittingEmail ? 'Dispatching Verification...' : 'Send Verification Link'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
