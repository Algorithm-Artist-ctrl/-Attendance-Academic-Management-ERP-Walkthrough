import React, { useEffect, useState, useCallback } from 'react';
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
import { supabase } from '../../lib/supabase/supabaseClient';

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

  const loadProfile = useCallback(async (isInitial = false) => {
    if (!studentId) return;
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const res = await fetchStudentProfile(studentId);
      if (res.error) {
        setError(res.error.message || 'Unauthorized: You are not authorized to view this student profile.');
      } else if (res.data) {
        setProfile(res.data);
      } else {
        setError('Student profile could not be found.');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading student profile.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [studentId, fetchStudentProfile]);

  useEffect(() => {
    if (!isOpen || !studentId) {
      setProfile(null);
      setError(null);
      return;
    }

    loadProfile(true);

    // Real-time subscription to ensure profile reflects live updates while modal is open
    const channelName = `realtime-profile-${studentId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students', filter: `id=eq.${studentId}` },
        () => {
          loadProfile(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records', filter: `student_id=eq.${studentId}` },
        () => {
          loadProfile(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, isOpen, loadProfile]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Academic & Institutional Profile"
      maxWidth="2xl"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {loading && (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
            <p className="text-sm font-medium text-slate-500">Retrieving verified student record...</p>
          </div>
        )}

        {error && (
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3.5">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900">Access Restricted</h4>
              <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
                {error.includes('Unauthorized') || error.includes('not assigned')
                  ? 'In compliance with VCTM institutional privacy policy, student personal contact details and records are restricted to assigned faculty, section coordinators, department HODs, and Super Admins.'
                  : error}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && profile && (
          <div className="space-y-5">
            {/* Header / Identity Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <div className="w-16 h-16 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-bold text-xl border border-slate-800 shrink-0 shadow-xs">
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
                  <h3 className="text-lg font-bold text-slate-900 font-serif-institutional tracking-wide truncate">{profile.full_name}</h3>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                    profile.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {profile.status ? profile.status.toUpperCase() : 'ACTIVE'}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-full">
                    {profile.admission_type || 'Regular'}
                  </span>
                </div>

                <p className="text-xs font-mono font-semibold text-slate-800 mt-1">
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
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Academic Year</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{profile.year_number}th Year</span>
                <span className="text-[11px] text-slate-500">{profile.year_name}</span>
              </div>

              <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Section & Room</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">Section {profile.section_name}</span>
                <span className="text-[11px] text-slate-500">{profile.room_number ? `Room ${profile.room_number}` : 'Assigned'}</span>
              </div>

              <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Semester</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">Sem {profile.semester_number || 'N/A'}</span>
                <span className="text-[11px] text-slate-500">Current Term</span>
              </div>

              <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-xs">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">Attendance</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{profile.attendance_percentage}%</span>
                <span className="text-[11px] text-slate-300 font-medium">
                  {profile.attended_sessions} / {profile.total_sessions} Sessions
                </span>
              </div>
            </div>

            {/* Verified Contact & Parent/Guardian Information */}
            <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-900" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Institutional Contact & Guardian Details
                  </h4>
                </div>
                <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-700 font-medium px-2.5 py-0.5 rounded-full">
                  Authorized Faculty Access
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block text-[11px]">Student Contact</span>
                  <div className="flex items-center gap-2 mt-1 text-slate-900 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{profile.phone || <span className="text-slate-400 font-normal italic">Not provided</span>}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block text-[11px]">Student Email</span>
                  <div className="flex items-center gap-2 mt-1 text-slate-900 font-semibold truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{profile.email || <span className="text-slate-400 font-normal italic">Not provided</span>}</span>
                  </div>
                </div>

                {profile.father_name && (
                  <div>
                    <span className="text-slate-500 font-medium block text-[11px]">Father's Name</span>
                    <p className="text-slate-900 font-semibold mt-1">
                      {profile.father_name}
                    </p>
                  </div>
                )}

                {profile.father_contact_number && (
                  <div>
                    <span className="text-slate-500 font-medium block text-[11px]">Father's Contact Number</span>
                    <div className="flex items-center gap-2 mt-1 text-slate-900 font-semibold">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{profile.father_contact_number}</span>
                    </div>
                  </div>
                )}

                {profile.mother_name && (
                  <div>
                    <span className="text-slate-500 font-medium block text-[11px]">Mother's Name</span>
                    <p className="text-slate-900 font-semibold mt-1">{profile.mother_name}</p>
                  </div>
                )}

                {profile.mother_contact_number && (
                  <div>
                    <span className="text-slate-500 font-medium block text-[11px]">Mother's Contact</span>
                    <div className="flex items-center gap-2 mt-1 text-slate-900 font-semibold">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{profile.mother_contact_number}</span>
                    </div>
                  </div>
                )}

                {profile.blood_group && (
                  <div>
                    <span className="text-slate-500 font-medium block text-[11px]">Blood Group</span>
                    <p className="text-slate-900 font-semibold mt-1">{profile.blood_group}</p>
                  </div>
                )}

                {profile.address && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-medium block text-[11px]">Address</span>
                    <div className="flex items-start gap-2 mt-1 text-slate-700 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                      <span>{profile.address}</span>
                    </div>
                  </div>
                )}

                {!profile.father_name && !profile.mother_name && (
                  <div className="col-span-full py-1 text-slate-400 text-xs italic">
                    Guardian details not on file.
                  </div>
                )}
              </div>
            </div>

            {/* Academic Mentorship & Coordination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-slate-500 block">Class Coordinator</span>
                  <span className="text-xs font-bold text-slate-900 truncate block">
                    {profile.coordinator_name || 'Not assigned'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-slate-500 block">Faculty Mentor</span>
                  <span className="text-xs font-bold text-slate-900 truncate block">
                    {profile.mentor_name || 'Not assigned'}
                  </span>
                </div>
              </div>
            </div>

            {/* Enrolled Subjects & Assigned Faculty */}
            {profile.subjects && profile.subjects.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-900" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Enrolled Subjects in Section {profile.section_name} ({profile.subjects.length})
                  </h4>
                </div>

                <div className="border border-slate-200/80 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white shadow-2xs">
                  {profile.subjects.map((sub) => (
                    <div key={sub.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition-colors">
                      <div className="min-w-0 flex-1 mr-3">
                        <span className="font-semibold text-slate-900 block truncate">{sub.subject_name}</span>
                        <span className="text-[11px] font-mono text-slate-500">{sub.subject_code}</span>
                      </div>
                      {sub.faculty_name ? (
                        <span className="text-[11px] font-medium text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg shrink-0">
                          {sub.faculty_name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No faculty assigned</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#0f172a] hover:bg-black rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Close Profile
          </button>
        </div>
      </div>
    </Modal>
  );
};
