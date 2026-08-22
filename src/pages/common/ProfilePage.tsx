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
  MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';

export const ProfilePage: React.FC = () => {
  const { user, role } = useAuth();
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

  const student = user?.student;
  const currentFaculty = user?.faculty;
  
  const studentId = student?.id || 'stud-a-05';
  const stats = role === 'student' ? getStudentAttendance(studentId) : null;

  const dept = departments.find(d => d.id === (student?.department_id || currentFaculty?.department_id));
  const prog = programs.find(p => p.id === student?.program_id);
  const year = years.find(y => y.id === student?.academic_year_id);
  const sem = semesters.find(s => s.id === student?.semester_id);
  const sec = sections.find(s => s.id === student?.section_id);
  const mentor = faculty.find(f => f.id === student?.mentor_faculty_id);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(student?.phone || currentFaculty?.phone || '9876543210');
  const [email, setEmail] = useState(user?.email || 'student@vctm.in');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <User className="w-6 h-6 text-[#00ff88]" />
            User Profile & Identity Details
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Official academic credentials, enrolled batch, and contact information
          </p>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>Profile Updated Successfully!</span>
          </div>
        )}
      </div>

      {/* Main Profile Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Avatar & Quick Info */}
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
              {user?.full_name || 'Tarun Kushwah'}
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
                <span className="text-[10px] text-slate-400 font-semibold block">Status</span>
                <span className="text-xs font-bold text-emerald-400">{stats.percentage >= 75 ? 'Eligible' : 'Defaulter'}</span>
              </div>
            </div>
          )}

          <div className="pt-2 text-xs text-slate-400 space-y-1">
            <p><strong>Institution:</strong> {institution?.name || 'Vivekananda College (340)'}</p>
            <p><strong>Department:</strong> {dept?.name || 'Computer Science & Engineering'}</p>
          </div>
        </div>

        {/* Right Column: Detailed Credentials & Editable Info */}
        <div className="lg:col-span-8 glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/20 space-y-6">
          <div className="flex items-center justify-between border-b border-emerald-500/15 pb-4">
            <h3 className="text-base font-bold text-white tracking-wide">
              Academic & Contact Information
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">Department / Branch</label>
                <input
                  type="text"
                  disabled
                  value={dept?.name || 'Computer Science & Engineering'}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                />
              </div>

              {student && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Enrolled Program</label>
                    <input
                      type="text"
                      disabled
                      value={`${prog?.name || 'B.Tech CSE'} • ${year?.name || '2nd Year'} • Sem ${sem?.semester_number || 3}`}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Section & Room</label>
                    <input
                      type="text"
                      disabled
                      value={`Section ${sec?.name || 'A'} (${sec?.room_number || 'Room A-007'})`}
                      className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/15 rounded-xl text-slate-300 font-semibold cursor-not-allowed"
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
                      value={mentor?.full_name ? `${mentor.full_name} (${mentor.faculty_code || 'Faculty'})` : 'Ms. Hemlata Chaudhary (HEM)'}
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
    </div>
  );
};
