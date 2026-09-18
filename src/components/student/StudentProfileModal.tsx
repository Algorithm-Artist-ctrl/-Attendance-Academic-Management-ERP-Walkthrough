import React, { useEffect, useState } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  GraduationCap, 
  Calendar, 
  Layers, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  X, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  HeartHandshake,
  UserCheck
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { DetailedStudentProfile } from '../../types/database.types';
import { useAcademic } from '../../context/AcademicContext';

interface StudentProfileModalProps {
  studentId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  studentId,
  isOpen,
  onClose
}) => {
  const { fetchStudentProfile } = useAcademic();
  const [profile, setProfile] = useState<DetailedStudentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !studentId) {
      setProfile(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchStudentProfile(studentId);
        if (!isMounted) return;
        if (res.error) {
          setError(res.error.message || 'Unauthorized: You are not authorized to view this student profile.');
        } else if (res.data) {
          setProfile(res.data);
        } else {
          setError('Student profile could not be found.');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error loading student profile.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [studentId, isOpen, fetchStudentProfile]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Academic & Institutional Profile"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {loading && (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-slate-500">Retrieving verified student record...</p>
          </div>
        )}

        {error && (
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3.5">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900">Access Restricted</h4>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                {error.includes('Unauthorized') || error.includes('not assigned')
                  ? 'In compliance with VCTM institutional privacy policy, student personal contact details and records are restricted to assigned faculty, section coordinators, department HODs, and Super Admins.'
                  : error}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && profile && (
          <div className="space-y-6">
            {/* Header / Identity Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 border border-blue-100 rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                {profile.full_name
                  .split(' ')
                  .map(n => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 truncate">{profile.full_name}</h3>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    profile.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {profile.status ? profile.status.toUpperCase() : 'ACTIVE'}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    {profile.admission_type || 'Regular'}
                  </span>
                </div>

                <p className="text-xs font-mono font-semibold text-blue-600 mt-0.5">
                  Roll No: {profile.roll_number}
                  {profile.admission_number ? ` • Adm: ${profile.admission_number}` : ''}
                </p>

                <p className="text-xs text-slate-600 mt-1">
                  {profile.department_name} ({profile.department_code || 'ENGG'}) • {profile.program_name}
                </p>
              </div>
            </div>

            {/* Academic Classification Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Academic Year</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{profile.year_number}th Year</span>
                <span className="text-[11px] text-slate-500">{profile.year_name}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Section & Room</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">Section {profile.section_name}</span>
                <span className="text-[11px] text-slate-500">{profile.room_number ? `Room ${profile.room_number}` : 'Assigned'}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Semester</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">Sem {profile.semester_number || 'N/A'}</span>
                <span className="text-[11px] text-slate-500">Current Term</span>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">Attendance</span>
                <span className="text-sm font-bold text-blue-900 mt-0.5 block">{profile.attendance_percentage}%</span>
                <span className="text-[11px] text-blue-600 font-medium">
                  {profile.attended_sessions} / {profile.total_sessions} Sessions
                </span>
              </div>
            </div>

            {/* Verified Contact & Parent/Guardian Information */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Institutional Contact & Guardian Details
                  </h4>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full">
                  Authorized Faculty Access
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">Student Contact</span>
                  <div className="flex items-center gap-2 mt-1 text-slate-900 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{profile.phone || 'Not Provided'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Student Email</span>
                  <div className="flex items-center gap-2 mt-1 text-slate-900 font-semibold truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{profile.email || 'Not Provided'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Father's Name</span>
                  <p className="text-slate-900 font-semibold mt-1">
                    {profile.father_name || 'Recorded on Admission File'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Father's Contact Number</span>
                  <div className="flex items-center gap-2 mt-1 text-slate-900 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{profile.father_contact_number || 'Available via Admin'}</span>
                  </div>
                </div>

                {profile.mother_name && (
                  <div>
                    <span className="text-slate-500 font-medium block">Mother's Name</span>
                    <p className="text-slate-900 font-semibold mt-1">{profile.mother_name}</p>
                  </div>
                )}

                {profile.mother_contact_number && (
                  <div>
                    <span className="text-slate-500 font-medium block">Mother's Contact</span>
                    <p className="text-slate-900 font-semibold mt-1">{profile.mother_contact_number}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Academic Mentorship & Coordination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-slate-500 block">Class Coordinator</span>
                  <span className="text-xs font-bold text-slate-900 truncate block">
                    {profile.coordinator_name || 'Assigned by Department'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-slate-500 block">Faculty Mentor</span>
                  <span className="text-xs font-bold text-slate-900 truncate block">
                    {profile.mentor_name || 'Institutional Mentor'}
                  </span>
                </div>
              </div>
            </div>

            {/* Enrolled Subjects & Assigned Faculty */}
            {profile.subjects && profile.subjects.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Enrolled Subjects in Section {profile.section_name} ({profile.subjects.length})
                  </h4>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {profile.subjects.map((sub) => (
                    <div key={sub.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/80">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 block truncate">{sub.subject_name}</span>
                        <span className="text-[11px] font-mono text-slate-500">{sub.subject_code}</span>
                      </div>
                      {sub.faculty_name && (
                        <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0 ml-2">
                          {sub.faculty_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Close Profile
          </button>
        </div>
      </div>
    </Modal>
  );
};
