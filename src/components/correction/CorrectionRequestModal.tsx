import React, { useState } from 'react';
import { 
  CheckCircle2, 
  RotateCcw, 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  ArrowRight,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CyberClipboard3D } from '../3d/CyberClipboard3D';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { clsx } from 'clsx';
import { AttendanceStatus } from '../../types/database.types';

interface CorrectionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSubjectId?: string;
  preselectedRecordId?: string;
}

export const CorrectionRequestModal: React.FC<CorrectionRequestModalProps> = ({ 
  isOpen, 
  onClose,
  preselectedSubjectId,
  preselectedRecordId,
}) => {
  const { user } = useAuth();
  const { 
    subjects, 
    faculty, 
    assignments,
    attendanceRecords, 
    submitCorrectionRequest
  } = useAcademic();

  const student = user?.student;
  const studentId = student?.id || '';

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-24');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(preselectedSubjectId || subjects[0]?.id || '');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('09:00 – 09:50');
  const [currentStatus, setCurrentStatus] = useState<'Absent' | 'Present'>('Absent');
  const [requestedStatus, setRequestedStatus] = useState<AttendanceStatus>('Present');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0];
  
  // Section-specific faculty lookup
  const currentAssignment = assignments.find(
    a => a.subject_id === selectedSubject?.id && a.section_id === student?.section_id
  ) || assignments.find(a => a.subject_id === selectedSubject?.id);
  const assignedFaculty = faculty.find(f => f.id === currentAssignment?.faculty_id) || faculty[0];

  const steps = [
    { num: 1, title: 'Select Lecture' },
    { num: 2, title: 'Correction Details' },
    { num: 3, title: 'Reason & Justification' },
    { num: 4, title: 'Preview & Submit' },
  ];

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      setErrorMessage('Please state the valid reason for this correction request.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const studentRecord = preselectedRecordId 
        ? attendanceRecords.find(r => r.id === preselectedRecordId)
        : (attendanceRecords.find(r => r.student_id === studentId) || attendanceRecords[0]);

      if (studentRecord) {
        await submitCorrectionRequest({
          attendanceRecordId: studentRecord.id,
          studentId,
          requestedStatus,
          reason: reason.trim(),
        });
      }

      setSuccessMessage('Attendance correction request submitted successfully! Your faculty has been notified.');
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessMessage(null);
        setCurrentStep(1);
        setReason('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to submit request.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-white">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[#00ff88]">
            <RotateCcw className="w-4 h-4" />
          </div>
          <span>Request Attendance Correction</span>
        </div>
      }
      description="Step-by-step attendance correction workflow submitted directly to faculty"
      maxWidth="2xl"
    >
      {/* 4-Step Stepper Bar Matching Screen 5 */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {steps.map((s) => (
          <div
            key={s.num}
            className={clsx(
              'p-2 rounded-xl text-center border transition-all text-xs font-bold',
              currentStep === s.num
                ? 'bg-[#00ff88] text-slate-950 border-[#00ff88] shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                : currentStep > s.num
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-950/60 text-slate-500 border-slate-800'
            )}
          >
            <span className="block text-[10px] uppercase font-mono">Step {s.num}</span>
            <span className="truncate block mt-0.5">{s.title}</span>
          </div>
        ))}
      </div>

      {successMessage ? (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center space-y-3 animate-in zoom-in-95">
          <CheckCircle2 className="w-12 h-12 text-[#00ff88] mx-auto animate-bounce" />
          <h4 className="text-base font-bold text-white">Correction Request Dispatched</h4>
          <p className="text-xs text-slate-300">{successMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* Left Column: 3D Clipboard Checklist Asset */}
          <div className="hidden md:flex md:col-span-4 flex-col items-center justify-center p-4">
            <CyberClipboard3D size={150} />
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400/80 mt-2">
              Official Review Protocol
            </span>
          </div>

          {/* Right Column: Step Forms */}
          <div className="md:col-span-8 space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* STEP 1: SELECT LECTURE */}
            {currentStep === 1 && (
              <div className="space-y-3.5 animate-in fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Lecture Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950/80 border border-emerald-500/20 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subject Name & Code
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950/80 border border-emerald-500/20 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Lecture Time Slot
                  </label>
                  <select
                    value={selectedTimeSlot}
                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950/80 border border-emerald-500/20 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
                  >
                    <option value="09:00 - 09:50">09:00 - 09:50 (Period 1)</option>
                    <option value="09:50 - 10:40">09:50 - 10:40 (Period 2)</option>
                    <option value="10:40 - 11:30">10:40 - 11:30 (Period 3)</option>
                    <option value="11:30 - 12:20">11:30 - 12:20 (Period 4)</option>
                    <option value="13:10 - 14:00">13:10 - 14:00 (Period 6)</option>
                    <option value="14:00 - 14:50">14:00 - 14:50 (Period 7)</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 2: CORRECTION DETAILS */}
            {currentStep === 2 && (
              <div className="space-y-3.5 animate-in fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assigned Faculty Full Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={assignedFaculty?.full_name || 'Ms. Hemlata Chaudhary'}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950/50 border border-emerald-500/10 rounded-xl text-slate-400 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Current Recorded Status
                    </label>
                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                      {currentStatus}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Requested Rectification
                    </label>
                    <select
                      value={requestedStatus}
                      onChange={(e) => setRequestedStatus(e.target.value as AttendanceStatus)}
                      className="w-full px-3.5 py-1.5 text-xs font-bold bg-slate-950/80 border border-emerald-500/30 rounded-xl text-[#00ff88] focus:outline-none focus:border-[#00ff88]"
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: REASON */}
            {currentStep === 3 && (
              <div className="space-y-3.5 animate-in fade-in">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason / Proof of Attendance
                </label>
                <textarea
                  rows={4}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. I was present in Room A-007 for Data Structure lecture but mistakenly marked absent on the register."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
                />
              </div>
            )}

            {/* STEP 4: PREVIEW & SUBMIT */}
            {currentStep === 4 && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-2 text-xs animate-in fade-in">
                <div className="flex justify-between">
                  <span className="text-slate-400">Date:</span>
                  <span className="font-bold text-white">{selectedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Subject:</span>
                  <span className="font-bold text-emerald-400">{selectedSubject?.subject_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Faculty:</span>
                  <span className="font-bold text-slate-200">{assignedFaculty?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status Change:</span>
                  <span className="font-bold text-rose-400">{currentStatus} ➔ <span className="text-[#00ff88]">{requestedStatus}</span></span>
                </div>
                <div className="pt-2 border-t border-emerald-500/10">
                  <span className="text-slate-400 block mb-1">Reason:</span>
                  <p className="text-slate-300 italic">{reason}</p>
                </div>
              </div>
            )}

            {/* Modal Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-emerald-500/15">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
              ) : <div />}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  variant="neon"
                  size="sm"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="neon"
                  size="sm"
                  isLoading={isSubmitting}
                  onClick={handleSubmitRequest}
                  rightIcon={<CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />}
                >
                  Submit Request
                </Button>
              )}
            </div>

          </div>

        </div>
      )}
    </Modal>
  );
};
