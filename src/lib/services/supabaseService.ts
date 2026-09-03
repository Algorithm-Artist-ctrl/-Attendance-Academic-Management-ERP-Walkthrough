import { supabase } from '../supabase/supabaseClient';
import { 
  Institution, 
  Department, 
  Program, 
  AcademicSession, 
  AcademicYear, 
  Semester, 
  Section, 
  Subject, 
  Faculty, 
  FacultySubjectAssignment, 
  Student, 
  TimetableEntry, 
  AttendanceSession, 
  AttendanceRecord, 
  AttendanceCorrection, 
  AuditLog, 
  AttendanceStatus,
  DayOfWeek,
  LectureType,
  TimetableVersion,
  Assignment,
  AssignmentSubmission,
  Quiz,
  QuizResult,
  SessionalMark,
  MarksHistory,
  SessionalType,
  SessionalAssessment,
  UserProfile
} from '../../types/database.types';
import { getISTTodayDate } from '../utils/dateUtils';

interface MasterDataCache {
  timestamp: number;
  data: {
    institutions: Institution[];
    departments: Department[];
    programs: Program[];
    sessions: AcademicSession[];
    years: AcademicYear[];
    semesters: Semester[];
    sections: Section[];
    subjects: Subject[];
    faculty: Faculty[];
    assignments: FacultySubjectAssignment[];
    students: Student[];
    profiles: UserProfile[];
  };
}

let _masterCache: MasterDataCache | null = null;
const MASTER_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute memory cache for static master setup

export const supabaseService = {
  // Clear in-memory master cache when structural entities change
  invalidateMasterCache() {
    _masterCache = null;
  },

  // 1A. Fetch Static Academic Master Entities (with TTL in-memory cache)
  async fetchMasterData(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && _masterCache && (now - _masterCache.timestamp) < MASTER_CACHE_TTL_MS) {
      return _masterCache.data;
    }

    try {
      const [
        { data: institutions },
        { data: departments },
        { data: programs },
        { data: sessions },
        { data: years },
        { data: semesters },
        { data: sections },
        { data: subjects },
        { data: faculty },
        { data: assignments },
        { data: students },
        { data: profilesList },
      ] = await Promise.all([
        supabase.from('institutions').select('*'),
        supabase.from('departments').select('*'),
        supabase.from('programs').select('*'),
        supabase.from('academic_sessions').select('*'),
        supabase.from('academic_years').select('*'),
        supabase.from('semesters').select('*'),
        supabase.from('sections').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('faculty').select('*'),
        supabase.from('faculty_subject_assignments').select('*'),
        supabase.from('students').select('*'),
        supabase.from('profiles').select('*'),
      ]);

      const masterResult = {
        institutions: (institutions as Institution[]) || [],
        departments: (departments as Department[]) || [],
        programs: (programs as Program[]) || [],
        sessions: (sessions as AcademicSession[]) || [],
        years: (years as AcademicYear[]) || [],
        semesters: (semesters as Semester[]) || [],
        sections: (sections as Section[]) || [],
        subjects: (subjects as Subject[]) || [],
        faculty: (faculty as Faculty[]) || [],
        assignments: (assignments as FacultySubjectAssignment[]) || [],
        students: (students as Student[]) || [],
        profiles: (profilesList as UserProfile[]) || [],
      };

      _masterCache = {
        timestamp: now,
        data: masterResult,
      };

      return masterResult;
    } catch (err) {
      console.error('Error fetching master data from Supabase:', err);
      if (_masterCache) return _masterCache.data;
      return null;
    }
  },

  // 1B. Fetch Dynamic Operational Data (Timetable, Attendance, Assessments, Audit)
  async fetchOperationalData() {
    try {
      const [
        { data: timetable },
        { data: attendanceSessions },
        { data: attendanceRecords },
        { data: corrections },
        { data: auditLogs },
        { data: timetableVersions },
        { data: assignmentsList },
        { data: submissionsList },
        { data: quizzesList },
        { data: quizResultsList },
        { data: sessionalMarksList },
        { data: marksHistoryList },
        { data: sessionalAssessmentsList },
      ] = await Promise.all([
        supabase.from('timetable_entries').select('*'),
        supabase.from('attendance_sessions').select('*').order('session_date', { ascending: false }),
        supabase.from('attendance_records').select('*'),
        supabase.from('attendance_corrections').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('timetable_versions').select('*').order('created_at', { ascending: false }),
        supabase.from('assignments').select('*').order('created_at', { ascending: false }),
        supabase.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }),
        supabase.from('quizzes').select('*').order('created_at', { ascending: false }),
        supabase.from('quiz_results').select('*').order('created_at', { ascending: false }),
        supabase.from('sessional_marks').select('*').order('created_at', { ascending: false }),
        supabase.from('marks_history').select('*').order('updated_at', { ascending: false }),
        supabase.from('sessional_assessments').select('*').order('created_at', { ascending: false }),
      ]);

      return {
        timetable: (timetable as TimetableEntry[]) || [],
        attendanceSessions: (attendanceSessions as AttendanceSession[]) || [],
        attendanceRecords: (attendanceRecords as AttendanceRecord[]) || [],
        corrections: (corrections as AttendanceCorrection[]) || [],
        auditLogs: (auditLogs as AuditLog[]) || [],
        timetableVersions: (timetableVersions as TimetableVersion[]) || [],
        courseAssignments: (assignmentsList as Assignment[]) || [],
        assignmentSubmissions: (submissionsList as AssignmentSubmission[]) || [],
        quizzes: (quizzesList as Quiz[]) || [],
        quizResults: (quizResultsList as QuizResult[]) || [],
        sessionalMarks: (sessionalMarksList as SessionalMark[]) || [],
        marksHistory: (marksHistoryList as MarksHistory[]) || [],
        sessionalAssessments: (sessionalAssessmentsList as SessionalAssessment[]) || [],
      };
    } catch (err) {
      console.error('Error fetching operational data from Supabase:', err);
      return null;
    }
  },

  // 1C. Fetch All Master & Operational Data (Composed efficiently)
  async fetchAllData(forceRefreshMaster = false) {
    try {
      const [masterData, operationalData] = await Promise.all([
        this.fetchMasterData(forceRefreshMaster),
        this.fetchOperationalData(),
      ]);

      if (!masterData || !operationalData) {
        return null;
      }

      return {
        ...masterData,
        ...operationalData,
      };
    } catch (err) {
      console.error('Error fetching combined data from Supabase:', err);
      return null;
    }
  },

  // 2. Save Live Attendance Session & Student Records
  async saveAttendance(params: {
    timetableEntryId?: string;
    facultyId: string;
    sectionId: string;
    subjectId: string;
    sessionDate: string;
    startTime?: string;
    endTime?: string;
    studentRecords: Array<{
      studentId: string;
      status: AttendanceStatus;
      remarks?: string;
    }>;
  }) {
    // 1. Validation: Prevent future attendance dates
    const today = getISTTodayDate();
    if (params.sessionDate > today) {
      throw new Error(`Invalid attendance date: ${params.sessionDate}. Attendance cannot be recorded for future dates.`);
    }

    // Check if session already exists for this date, section, and subject
    const { data: existingSessions } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('section_id', params.sectionId)
      .eq('subject_id', params.subjectId)
      .eq('session_date', params.sessionDate)
      .limit(1);

    let session: AttendanceSession;

    if (existingSessions && existingSessions.length > 0) {
      session = existingSessions[0];
      await supabase
        .from('attendance_sessions')
        .update({
          marked_at: new Date().toISOString(),
          status: 'completed',
        })
        .eq('id', session.id);
    } else {
      const { data: newSession, error: sessionErr } = await supabase
        .from('attendance_sessions')
        .insert({
          timetable_entry_id: params.timetableEntryId || null,
          faculty_id: params.facultyId,
          section_id: params.sectionId,
          subject_id: params.subjectId,
          session_date: params.sessionDate,
          start_time: params.startTime || '09:00',
          end_time: params.endTime || '09:50',
          status: 'completed',
          marked_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionErr || !newSession) {
        throw new Error(`Failed to create attendance session: ${sessionErr?.message}`);
      }
      session = newSession;
    }

    // Delete any previous records for this session to avoid duplicates, then insert fresh
    await supabase.from('attendance_records').delete().eq('attendance_session_id', session.id);

    const recordsToInsert = params.studentRecords.map(sr => ({
      attendance_session_id: session.id,
      student_id: sr.studentId,
      status: sr.status,
      marked_by: params.facultyId,
      marked_at: new Date().toISOString(),
      remarks: sr.remarks || null,
    }));

    const { data: insertedRecords, error: recordsErr } = await supabase
      .from('attendance_records')
      .insert(recordsToInsert)
      .select();

    if (recordsErr) {
      throw new Error(`Failed to insert attendance records: ${recordsErr.message}`);
    }

    // Fetch faculty full name for audit fidelity
    const { data: facultyInfo } = await supabase
      .from('faculty')
      .select('full_name')
      .eq('id', params.facultyId)
      .single();

    // Audit Log
    const presentCount = params.studentRecords.filter(r => r.status === 'Present').length;
    const absentCount = params.studentRecords.length - presentCount;

    await supabase.from('audit_logs').insert({
      actor_id: params.facultyId,
      actor_name: facultyInfo?.full_name || 'Faculty Member',
      actor_role: 'faculty',
      action: 'ATTENDANCE_RECORDED',
      entity_type: 'attendance_sessions',
      entity_id: session.id,
      new_values: {
        sessionDate: params.sessionDate,
        sectionId: params.sectionId,
        subjectId: params.subjectId,
        presentCount,
        absentCount,
      },
    });

    return { session, records: insertedRecords as AttendanceRecord[] };
  },

  // 3. Ensure Attendance Session & Record (for unrecorded lecture claims)
  async ensureAttendanceSessionAndRecord(params: {
    timetableEntryId: string;
    sessionDate: string;
    subjectId: string;
    facultyId: string;
    sectionId: string;
    studentId: string;
    status: AttendanceStatus;
  }): Promise<{ sessionId: string; recordId: string }> {
    // 1. Check if session exists in Supabase
    let { data: session } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('section_id', params.sectionId)
      .eq('subject_id', params.subjectId)
      .eq('session_date', params.sessionDate)
      .maybeSingle();

    if (!session) {
      const { data: newSession, error: sErr } = await supabase
        .from('attendance_sessions')
        .insert({
          timetable_entry_id: params.timetableEntryId,
          faculty_id: params.facultyId,
          section_id: params.sectionId,
          subject_id: params.subjectId,
          session_date: params.sessionDate,
          start_time: '09:00:00',
          end_time: '09:50:00',
          status: 'pending',
        })
        .select('id')
        .single();

      if (sErr || !newSession) {
        throw new Error(`Failed to create attendance session: ${sErr?.message}`);
      }
      session = newSession;
    }

    // 2. Check if student record exists
    let { data: record } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('attendance_session_id', session.id)
      .eq('student_id', params.studentId)
      .maybeSingle();

    if (!record) {
      const { data: newRec, error: rErr } = await supabase
        .from('attendance_records')
        .insert({
          attendance_session_id: session.id,
          student_id: params.studentId,
          status: params.status || 'Absent',
          marked_by: params.facultyId,
          remarks: 'Claim initiated for unrecorded lecture',
        })
        .select('id')
        .single();

      if (rErr || !newRec) {
        throw new Error(`Failed to create attendance record: ${rErr?.message}`);
      }
      record = newRec;
    }

    return { sessionId: session.id, recordId: record.id };
  },

  // 4. Submit Correction Request
  async submitCorrection(params: {
    attendanceRecordId: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }) {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .insert({
        attendance_record_id: params.attendanceRecordId,
        student_id: params.studentId,
        requested_status: params.requestedStatus,
        reason: params.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit correction request: ${error.message}`);
    }

    return data as AttendanceCorrection;
  },

  // 4. Review Correction Request (Approve / Reject)
  async reviewCorrection(params: {
    correctionId: string;
    status: 'approved' | 'rejected';
    reviewerFacultyId: string;
    reviewRemarks?: string;
  }) {
    const { data: updatedCorrection, error: corrErr } = await supabase
      .from('attendance_corrections')
      .update({
        status: params.status,
        reviewed_by: params.reviewerFacultyId,
        reviewed_at: new Date().toISOString(),
        review_remarks: params.reviewRemarks || null,
      })
      .eq('id', params.correctionId)
      .select()
      .single();

    if (corrErr || !updatedCorrection) {
      throw new Error(`Failed to update correction: ${corrErr?.message}`);
    }

    // Fetch reviewer faculty full name for audit fidelity
    const { data: reviewerInfo } = await supabase
      .from('faculty')
      .select('full_name')
      .eq('id', params.reviewerFacultyId)
      .single();

    // If approved, update the actual attendance record in database
    if (params.status === 'approved' && updatedCorrection.attendance_record_id) {
      await supabase
        .from('attendance_records')
        .update({
          status: updatedCorrection.requested_status,
          marked_by: params.reviewerFacultyId,
          marked_at: new Date().toISOString(),
          remarks: `Corrected via Request #${params.correctionId}`,
        })
        .eq('id', updatedCorrection.attendance_record_id);

      // Audit Log for Approval
      await supabase.from('audit_logs').insert({
        actor_id: params.reviewerFacultyId,
        actor_name: reviewerInfo?.full_name || 'Faculty Member',
        actor_role: 'faculty',
        action: 'ATTENDANCE_CORRECTION_APPROVED',
        entity_type: 'attendance_records',
        entity_id: updatedCorrection.attendance_record_id,
        new_values: {
          correctionId: params.correctionId,
          newStatus: updatedCorrection.requested_status,
          remarks: params.reviewRemarks,
        },
      });
    } else if (params.status === 'rejected') {
      // Audit Log for Rejection
      await supabase.from('audit_logs').insert({
        actor_id: params.reviewerFacultyId,
        actor_name: reviewerInfo?.full_name || 'Faculty Member',
        actor_role: 'faculty',
        action: 'ATTENDANCE_CORRECTION_REJECTED',
        entity_type: 'attendance_corrections',
        entity_id: params.correctionId,
        new_values: {
          correctionId: params.correctionId,
          rejectionRemarks: params.reviewRemarks,
        },
      });
    }

    return updatedCorrection as AttendanceCorrection;
  },

  // 5. Admin CRUD Operations with Supabase Profile Sync
  async addStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('students').insert(student).select().single();
    if (error) throw new Error(error.message);
    const createdStudent = data as Student;

    // Automatically create Supabase profile for this student
    try {
      await supabase.from('profiles').upsert({
        id: createdStudent.id,
        email: createdStudent.email || `${createdStudent.roll_number}@vctm.in`,
        full_name: createdStudent.full_name,
        role: 'student',
        department_id: createdStudent.department_id,
        student_id: createdStudent.id,
        faculty_id: null,
        phone: createdStudent.phone
      }, { onConflict: 'id' });
    } catch (profErr) {
      console.warn('Profile auto-creation warning:', profErr);
    }

    this.invalidateMasterCache();
    return createdStudent;
  },

  async updateStudent(id: string, updates: Partial<Student>) {
    const { data, error } = await supabase.from('students').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    const updated = data as Student;

    // Update profile if relevant
    try {
      await supabase.from('profiles').update({
        full_name: updated.full_name,
        email: updated.email || `${updated.roll_number}@vctm.in`,
        phone: updated.phone,
        department_id: updated.department_id,
      }).eq('id', id);
    } catch {}

    this.invalidateMasterCache();
    return updated;
  },

  async deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw new Error(error.message);
    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch {}
    this.invalidateMasterCache();
    return true;
  },

  async addFaculty(fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('faculty').insert(fac).select().single();
    if (error) throw new Error(error.message);
    const createdFaculty = data as Faculty;

    // Automatically create Supabase profile for this faculty
    const isHOD = createdFaculty.designation.toLowerCase().includes('hod');
    try {
      await supabase.from('profiles').upsert({
        id: createdFaculty.id,
        email: createdFaculty.email || `${(createdFaculty.faculty_code || 'faculty').toLowerCase()}@vctm.in`,
        full_name: createdFaculty.full_name,
        role: isHOD ? 'hod' : 'faculty',
        department_id: createdFaculty.department_id,
        student_id: null,
        faculty_id: createdFaculty.id,
        phone: createdFaculty.phone
      }, { onConflict: 'id' });
    } catch (profErr) {
      console.warn('Profile auto-creation warning:', profErr);
    }

    this.invalidateMasterCache();
    return createdFaculty;
  },

  async updateFaculty(id: string, updates: Partial<Faculty>) {
    const { data, error } = await supabase.from('faculty').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    const updated = data as Faculty;

    try {
      const isHOD = updated.designation.toLowerCase().includes('hod');
      await supabase.from('profiles').update({
        full_name: updated.full_name,
        email: updated.email,
        phone: updated.phone,
        department_id: updated.department_id,
        role: isHOD ? 'hod' : 'faculty'
      }).or(`id.eq.${id},faculty_id.eq.${id}`);
    } catch {}

    this.invalidateMasterCache();
    return updated;
  },

  async updateFacultyCredentials(facultyId: string, email: string) {
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Update faculty table
    const { data: facData, error: facErr } = await supabase
      .from('faculty')
      .update({ email: cleanEmail, updated_at: new Date().toISOString() })
      .eq('id', facultyId)
      .select()
      .single();
    if (facErr) throw new Error(facErr.message);

    // 2. Update profiles table
    await supabase
      .from('profiles')
      .update({ email: cleanEmail, updated_at: new Date().toISOString() })
      .or(`id.eq.${facultyId},faculty_id.eq.${facultyId}`);

    // 3. Audit log
    await supabase.from('audit_logs').insert({
      action: 'FACULTY_CREDENTIALS_UPDATED',
      actor_name: facData.full_name,
      actor_role: 'faculty',
      entity_type: 'faculty',
      entity_id: facultyId,
      new_values: { email: cleanEmail }
    });

    this.invalidateMasterCache();
    return facData as Faculty;
  },

  async deleteFaculty(id: string) {
    const { error } = await supabase.from('faculty').delete().eq('id', id);
    if (error) throw new Error(error.message);
    try {
      await supabase.from('profiles').delete().or(`id.eq.${id},faculty_id.eq.${id}`);
    } catch {}
    this.invalidateMasterCache();
    return true;
  },

  // 6. Live Notices backed by Supabase
  async fetchNotices() {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'NOTICE_PUBLISHED')
        .eq('entity_type', 'notice')
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []).map(row => {
        const details = row.new_values || {};
        return {
          id: row.id,
          title: details.title || 'Official Circular',
          category: details.category || 'Academic',
          date: details.date || row.created_at?.split('T')[0],
          author: details.author || row.actor_name || 'Administration',
          isPinned: !!details.isPinned,
          content: details.content || '',
          attachment: details.attachment,
          targetAudience: details.targetAudience || 'ALL',
          targetSectionId: details.targetSectionId || null,
          targetDepartmentId: details.targetDepartmentId || null,
          targetProgramId: details.targetProgramId || null,
          targetYearId: details.targetYearId || null,
          targetSemesterId: details.targetSemesterId || null,
          targetRole: details.targetRole || null,
          createdAt: row.created_at
        };
      });
    } catch (err) {
      console.error('Error fetching live notices:', err);
      return [];
    }
  },

  async publishNotice(notice: {
    title: string;
    category: string;
    author: string;
    content: string;
    isPinned?: boolean;
    attachment?: string;
    targetAudience?: string;
    targetSectionId?: string | null;
    targetDepartmentId?: string | null;
    targetProgramId?: string | null;
    targetYearId?: string | null;
    targetSemesterId?: string | null;
    targetRole?: string | null;
    actorId?: string;
    actorName?: string;
  }) {
    const { data, error } = await supabase.from('audit_logs').insert({
      actor_id: notice.actorId || null,
      actor_name: notice.actorName || notice.author,
      actor_role: 'admin',
      action: 'NOTICE_PUBLISHED',
      entity_type: 'notice',
      entity_id: null,
      new_values: {
        title: notice.title,
        category: notice.category,
        author: notice.author,
        content: notice.content,
        isPinned: notice.isPinned || false,
        attachment: notice.attachment,
        targetAudience: notice.targetAudience || 'ALL',
        targetSectionId: notice.targetSectionId || null,
        targetDepartmentId: notice.targetDepartmentId || null,
        targetProgramId: notice.targetProgramId || null,
        targetYearId: notice.targetYearId || null,
        targetSemesterId: notice.targetSemesterId || null,
        targetRole: notice.targetRole || null,
        date: getISTTodayDate()
      }
    }).select().single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteNotice(noticeId: string) {
    const { error } = await supabase.from('audit_logs').delete().eq('id', noticeId);
    if (error) throw new Error(error.message);
    return true;
  },

  async addSubject(sub: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('subjects').insert(sub).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Subject;
  },

  async updateSubject(id: string, updates: Partial<Subject>) {
    const { data, error } = await supabase.from('subjects').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Subject;
  },

  async deleteSubject(id: string) {
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async addDepartment(dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('departments').insert(dept).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Department;
  },

  async updateDepartment(id: string, updates: Partial<Department>) {
    const { data, error } = await supabase.from('departments').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Department;
  },

  async deleteDepartment(id: string) {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async addProgram(prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('programs').insert(prog).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Program;
  },

  async updateProgram(id: string, updates: Partial<Program>) {
    const { data, error } = await supabase.from('programs').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Program;
  },

  async deleteProgram(id: string) {
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async addSection(sec: Omit<Section, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('sections').insert(sec).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Section;
  },

  async updateSection(id: string, updates: Partial<Section>) {
    const { data, error } = await supabase.from('sections').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Section;
  },

  async deleteSection(id: string) {
    const { error } = await supabase.from('sections').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  // ── Academic Year CRUD ──
  async addAcademicYear(year: Omit<AcademicYear, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('academic_years').insert(year).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as AcademicYear;
  },

  async updateAcademicYear(id: string, updates: Partial<AcademicYear>) {
    const { data, error } = await supabase.from('academic_years').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as AcademicYear;
  },

  async deleteAcademicYear(id: string) {
    const { error } = await supabase.from('academic_years').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  // ── Semester CRUD ──
  async addSemester(sem: Omit<Semester, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('semesters').insert(sem).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Semester;
  },

  async updateSemester(id: string, updates: Partial<Semester>) {
    const { data, error } = await supabase.from('semesters').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Semester;
  },

  async deleteSemester(id: string) {
    const { error } = await supabase.from('semesters').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  // ── Dynamic Session Resolver ──
  async getCurrentSessionId(): Promise<string> {
    const { data } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .maybeSingle();
    return data?.id || '';
  },

  async addAssignment(assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('faculty_subject_assignments').insert(assign).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as FacultySubjectAssignment;
  },

  async deleteAssignment(id: string) {
    const { error } = await supabase.from('faculty_subject_assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async addTimetableEntry(entry: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('timetable_entries').insert(entry).select().single();
    if (error) throw new Error(error.message);
    return data as TimetableEntry;
  },

  async updateTimetableEntry(id: string, updates: Partial<TimetableEntry>) {
    const { data, error } = await supabase.from('timetable_entries').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as TimetableEntry;
  },

  async deleteTimetableEntry(id: string) {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async saveSectionTimetable(params: {
    sectionId: string;
    entries: Array<{
      subject_id: string;
      faculty_id: string;
      day_of_week: DayOfWeek;
      period_number: number;
      start_time: string;
      end_time: string;
      room_number?: string;
      lecture_type?: LectureType;
      active?: boolean;
    }>;
    publishedBy?: string;
    effectiveDate?: string;
    sourceType?: 'CSV_URL' | 'CSV_UPLOAD' | 'MANUAL_EDIT' | 'AI_INGESTION' | 'ROLLBACK_RESTORE';
    sourceUrl?: string;
  }): Promise<{ success: boolean; count: number; version?: TimetableVersion }> {
    if (!params.sectionId) {
      throw new Error('Target Section ID is required to save timetable.');
    }

    // 1. Fetch section details from Supabase
    const { data: sectionData, error: secErr } = await supabase
      .from('sections')
      .select('*, semester:semesters(*, academic_year:academic_years(*, program:programs(*, department:departments(*))))')
      .eq('id', params.sectionId)
      .single();

    if (secErr || !sectionData) {
      throw new Error(`Section not found: ${secErr?.message || params.sectionId}`);
    }

    const deptId = sectionData.semester?.academic_year?.program?.department_id || sectionData.department_id;
    const defaultRoom = sectionData.room_number || `Room ${sectionData.name}`;
    const effectiveFrom = params.effectiveDate || getISTTodayDate();
    const publishedBy = params.publishedBy || 'HOD / Super Administrator';
    const actionType = params.sourceType || 'MANUAL_HOD_SECTION_SAVE';

    // 2. Fetch latest version number to increment
    const { data: existingVersions } = await supabase
      .from('timetable_versions')
      .select('version_number')
      .eq('section_id', params.sectionId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = (existingVersions && existingVersions.length > 0)
      ? (existingVersions[0].version_number + 1)
      : 1;

    // 3. Mark old versions as superseded
    await supabase
      .from('timetable_versions')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('section_id', params.sectionId)
      .eq('status', 'active');

    // 4. Format new rows with default rooms & active status
    const rowsToInsert = params.entries.map(e => ({
      section_id: params.sectionId,
      subject_id: e.subject_id,
      faculty_id: e.faculty_id,
      day_of_week: e.day_of_week,
      period_number: e.period_number,
      start_time: e.start_time || '09:00',
      end_time: e.end_time || '09:50',
      room_number: e.room_number || defaultRoom,
      lecture_type: e.lecture_type || 'Theory',
      active: true,
    }));

    // 5. Create new active TimetableVersion storing full period snapshot
    const { data: createdVersion } = await supabase
      .from('timetable_versions')
      .insert([{
        department_id: deptId,
        section_id: params.sectionId,
        version_number: nextVersionNumber,
        effective_from: effectiveFrom,
        status: 'active',
        approved_by: publishedBy,
        approved_at: new Date().toISOString(),
        changes_summary: {
          action: actionType,
          source_type: actionType,
          source_url: params.sourceUrl || null,
          total_slots: rowsToInsert.length,
          effective_from: effectiveFrom,
          room: defaultRoom,
          snapshot: rowsToInsert,
        }
      }])
      .select('*')
      .single();

    // 6. Delete ALL previous timetable entries strictly for this section (Atomic replacement)
    const { error: delErr } = await supabase
      .from('timetable_entries')
      .delete()
      .eq('section_id', params.sectionId);

    if (delErr) {
      throw new Error(`Failed to clear previous section timetable: ${delErr.message}`);
    }

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('timetable_entries')
        .insert(rowsToInsert)
        .select('*');

      if (insertErr) {
        throw new Error(`Failed to insert timetable records: ${insertErr.message}`);
      }
    }

    // 7. Verify Actual Database Write (Source of truth check)
    const { count: verifiedCount, error: verifyErr } = await supabase
      .from('timetable_entries')
      .select('id', { count: 'exact' })
      .eq('section_id', params.sectionId)
      .eq('active', true);

    if (verifyErr || (rowsToInsert.length > 0 && verifiedCount !== rowsToInsert.length)) {
      throw new Error(`Database verification failed: Expected ${rowsToInsert.length} active entries in Supabase, found ${verifiedCount || 0}.`);
    }

    // 8. Synchronize faculty_subject_assignments
    const distinctPairs = new Map<string, { facultyId: string; subjectId: string }>();
    for (const row of rowsToInsert) {
      const pairKey = `${row.faculty_id}-${row.subject_id}`;
      if (!distinctPairs.has(pairKey)) {
        distinctPairs.set(pairKey, { facultyId: row.faculty_id, subjectId: row.subject_id });
      }
    }

    const { data: currentSessionData } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .maybeSingle();
    const currentSessionId = currentSessionData?.id || '';

    for (const pair of distinctPairs.values()) {
      const { data: existingAssignment } = await supabase
        .from('faculty_subject_assignments')
        .select('id, active')
        .eq('faculty_id', pair.facultyId)
        .eq('subject_id', pair.subjectId)
        .eq('section_id', params.sectionId)
        .maybeSingle();

      if (!existingAssignment) {
        await supabase.from('faculty_subject_assignments').insert([{
          faculty_id: pair.facultyId,
          subject_id: pair.subjectId,
          section_id: params.sectionId,
          academic_session_id: currentSessionId,
          active: true,
        }]);
      } else if (!existingAssignment.active) {
        await supabase
          .from('faculty_subject_assignments')
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq('id', existingAssignment.id);
      }
    }

    // 9. Invalidate Master Cache
    this.invalidateMasterCache();

    // 10. Record Audit Log in Supabase
    await supabase.from('audit_logs').insert([{
      action: 'TIMETABLE_SECTION_REPLACED_AND_PUBLISHED',
      actor_name: publishedBy,
      actor_role: 'hod',
      entity_type: 'timetable_version',
      entity_id: createdVersion?.id || params.sectionId,
      new_values: {
        section_id: params.sectionId,
        section_name: sectionData.name,
        version: nextVersionNumber,
        source_type: actionType,
        source_url: params.sourceUrl || null,
        effective_from: effectiveFrom,
        slots_count: rowsToInsert.length,
      }
    }]);

    // 11. Create Official Circular / Notice for affected students & faculty
    await this.publishNotice({
      title: `Official Timetable Updated — Section ${sectionData.name} (W.E.F. ${effectiveFrom})`,
      category: 'Academic',
      author: publishedBy,
      content: `The official academic timetable for Section ${sectionData.name} has been published by HOD (${actionType}, Version ${nextVersionNumber}, Effective ${effectiveFrom}, Room: ${defaultRoom}). Total ${rowsToInsert.length} periods active. All students and assigned faculty are requested to follow this schedule.`,
      isPinned: true,
      targetAudience: `Section ${sectionData.name}`,
      targetSectionId: params.sectionId,
      targetDepartmentId: deptId || null,
      targetProgramId: sectionData.semester?.academic_year?.program_id || null,
      targetSemesterId: sectionData.semester_id || null,
    });

    // 12. Broadcast Realtime Timetable Update Event
    try {
      const channel = supabase.channel('vctm-erp-realtime-channel');
      await channel.send({
        type: 'broadcast',
        event: 'timetable_updated',
        payload: {
          section_id: params.sectionId,
          section_name: sectionData.name,
          new_timetable_version: nextVersionNumber,
          source_type: actionType,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (realtimeErr) {
      console.warn('Realtime broadcast notice skipped:', realtimeErr);
    }

    return {
      success: true,
      count: verifiedCount || 0,
      version: createdVersion as TimetableVersion,
    };
  },

  /**
   * Rollback / Restore a section's timetable to a previous version snapshot atomically
   */
  async rollbackToVersion(params: {
    versionId: string;
    restoredBy?: string;
  }): Promise<{ success: boolean; count: number; version?: TimetableVersion }> {
    const { data: targetVersion, error: verErr } = await supabase
      .from('timetable_versions')
      .select('*')
      .eq('id', params.versionId)
      .single();

    if (verErr || !targetVersion) {
      throw new Error(`Target timetable version not found: ${verErr?.message || params.versionId}`);
    }

    const sectionId = targetVersion.section_id;
    if (!sectionId) {
      throw new Error('Target version does not contain a valid section association.');
    }

    const snapshot = targetVersion.changes_summary?.snapshot;
    if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) {
      throw new Error(`Version ${targetVersion.version_number} does not contain a recoverable period snapshot.`);
    }

    const actorName = params.restoredBy || 'HOD / Administrator';

    return await this.saveSectionTimetable({
      sectionId,
      entries: snapshot.map((s: any) => ({
        subject_id: s.subject_id,
        faculty_id: s.faculty_id,
        day_of_week: s.day_of_week,
        period_number: s.period_number,
        start_time: s.start_time,
        end_time: s.end_time,
        room_number: s.room_number,
        lecture_type: s.lecture_type,
        active: true,
      })),
      publishedBy: `${actorName} (Rollback to v${targetVersion.version_number})`,
      effectiveDate: targetVersion.effective_from || getISTTodayDate(),
      sourceType: 'ROLLBACK_RESTORE',
    });
  },

  // ==========================================
  // ASSIGNMENTS MODULE
  // ==========================================
  async createAssignment(assignment: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('assignments').insert(assignment).select().single();
    if (error) throw new Error(error.message);

    // Audit Log
    await supabase.from('audit_logs').insert({
      action: 'ASSIGNMENT_CREATED',
      actor_name: 'Faculty',
      actor_role: 'faculty',
      entity_type: 'assignment',
      entity_id: data.id,
      new_values: { title: assignment.title, max_marks: assignment.max_marks, due_date: assignment.due_date }
    });

    return data as Assignment;
  },

  async updateAssignment(id: string, updates: Partial<Assignment>) {
    const { data, error } = await supabase.from('assignments').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Assignment;
  },

  async deleteCourseAssignment(id: string) {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async submitAssignment(submission: {
    assignmentId: string;
    studentId: string;
    submissionType: string;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    googleFormSubmitted?: boolean;
  }) {
    // 1. Fetch assignment to check due date
    const { data: assignment, error: assignErr } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', submission.assignmentId)
      .single();

    if (assignErr || !assignment) throw new Error('Assignment not found');

    const now = new Date();
    const dueDate = new Date(assignment.due_date);
    const isLate = now > dueDate;

    if (isLate && !assignment.allow_late_submission) {
      throw new Error(`Submission deadline passed (${dueDate.toLocaleString()}). Late submissions are not accepted.`);
    }

    const status = isLate ? 'late_submission' : 'submitted';

    const { data, error } = await supabase
      .from('assignment_submissions')
      .upsert({
        assignment_id: submission.assignmentId,
        student_id: submission.studentId,
        submission_type: submission.submissionType,
        file_path: submission.filePath,
        file_name: submission.fileName,
        file_size: submission.fileSize,
        mime_type: submission.mimeType,
        google_form_submitted: submission.googleFormSubmitted || false,
        submitted_at: new Date().toISOString(),
        status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Audit Log
    await supabase.from('audit_logs').insert({
      action: 'ASSIGNMENT_SUBMITTED',
      actor_name: 'Student',
      actor_role: 'student',
      entity_type: 'assignment_submission',
      entity_id: data.id,
      new_values: { assignment_id: submission.assignmentId, isLate, fileName: submission.fileName }
    });

    return data as AssignmentSubmission;
  },

  async gradeAssignmentSubmission(params: {
    submissionId: string;
    marksObtained: number;
    feedback?: string;
    facultyId: string;
  }) {
    if (params.marksObtained < 0) {
      throw new Error('Marks obtained cannot be negative.');
    }

    const { data: currentSub } = await supabase
      .from('assignment_submissions')
      .select('*, assignment:assignments(*)')
      .eq('id', params.submissionId)
      .single();

    if (!currentSub) throw new Error('Submission record not found.');
    const maxMarks = currentSub.assignment?.max_marks || 100;

    if (params.marksObtained > maxMarks) {
      throw new Error(`Marks obtained (${params.marksObtained}) exceeds maximum marks (${maxMarks}).`);
    }

    const oldMarks = currentSub.marks_obtained;

    const { data, error } = await supabase
      .from('assignment_submissions')
      .update({
        marks_obtained: params.marksObtained,
        feedback: params.feedback,
        status: 'graded',
        graded_by: params.facultyId,
        graded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.submissionId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Record in marks_history
    await supabase.from('marks_history').insert({
      entity_type: 'assignment',
      entity_id: currentSub.assignment_id,
      student_id: currentSub.student_id,
      subject_id: currentSub.assignment?.subject_id,
      old_marks: oldMarks,
      new_marks: params.marksObtained,
      updated_by: params.facultyId,
      reason: params.feedback || 'Assignment Graded'
    });

    return data as AssignmentSubmission;
  },

  // ==========================================
  // QUIZZES MODULE
  // ==========================================
  async createQuiz(quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at'>) {
    if (!quiz.google_form_url.startsWith('http')) {
      throw new Error('Please enter a valid Google Forms URL (starting with https://)');
    }

    const payload = {
      ...quiz,
      start_time: quiz.start_time || new Date().toISOString(),
      end_time: quiz.end_time || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data, error } = await supabase.from('quizzes').insert(payload).select().single();
    if (error) throw new Error(error.message);

    // Audit Log
    await supabase.from('audit_logs').insert({
      action: 'QUIZ_CREATED',
      actor_name: 'Faculty',
      actor_role: 'faculty',
      entity_type: 'quiz',
      entity_id: data.id,
      new_values: { title: quiz.title, max_marks: quiz.max_marks, url: quiz.google_form_url }
    });

    return data as Quiz;
  },

  async updateQuiz(id: string, updates: Partial<Quiz>) {
    const { data, error } = await supabase.from('quizzes').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Quiz;
  },

  async deleteQuiz(id: string) {
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async saveQuizMarks(params: {
    quizId: string;
    facultyId: string;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
  }) {
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', params.quizId).single();
    if (!quiz) throw new Error('Quiz not found.');

    const rows = params.studentMarks.map(sm => {
      if (sm.marksObtained < 0 || sm.marksObtained > quiz.max_marks) {
        throw new Error(`Invalid marks for student: ${sm.marksObtained}. Must be between 0 and ${quiz.max_marks}.`);
      }
      return {
        quiz_id: params.quizId,
        student_id: sm.studentId,
        marks_obtained: sm.marksObtained,
        graded_by: params.facultyId,
        graded_at: new Date().toISOString(),
        remarks: sm.remarks,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('quiz_results')
      .upsert(rows, { onConflict: 'quiz_id,student_id' })
      .select();

    if (error) throw new Error(error.message);

    // Record audit logs
    for (const sm of params.studentMarks) {
      await supabase.from('marks_history').insert({
        entity_type: 'quiz',
        entity_id: params.quizId,
        student_id: sm.studentId,
        subject_id: quiz.subject_id,
        new_marks: sm.marksObtained,
        updated_by: params.facultyId,
        reason: 'Quiz Marks Recorded'
      });
    }

    return data as QuizResult[];
  },

  // ==========================================
  // SESSIONAL ASSESSMENTS & DYNAMIC MARKS MODULE
  // ==========================================
  async createSessionalAssessment(assessment: Omit<SessionalAssessment, 'id' | 'created_at' | 'updated_at'>) {
    if (assessment.max_marks <= 0) {
      throw new Error('Maximum marks must be greater than 0.');
    }
    if (!assessment.title?.trim()) {
      throw new Error('Sessional title is required.');
    }

    const { data, error } = await supabase
      .from('sessional_assessments')
      .insert({
        ...assessment,
        status: assessment.status || 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase.from('audit_logs').insert({
      action: 'SESSIONAL_ASSESSMENT_CREATED',
      actor_id: assessment.faculty_id || null,
      target_type: 'sessional_assessments',
      target_id: data.id,
      details: { title: assessment.title, maxMarks: assessment.max_marks, subjectId: assessment.subject_id },
      reason: 'Dynamic Sessional Assessment Published'
    });

    return data as SessionalAssessment;
  },

  async updateSessionalAssessment(id: string, updates: Partial<SessionalAssessment>) {
    const { data, error } = await supabase
      .from('sessional_assessments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as SessionalAssessment;
  },

  async deleteSessionalAssessment(id: string) {
    const { error } = await supabase.from('sessional_assessments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async saveSessionalMarks(params: {
    sessionalAssessmentId?: string;
    subjectId?: string;
    sectionId?: string;
    sessionalType?: string;
    maxMarks?: number;
    facultyId: string;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }>;
  }): Promise<SessionalMark[]> {
    if (params.sessionalAssessmentId && (!params.subjectId || !params.sectionId || params.maxMarks === undefined)) {
      const { data: sa } = await supabase.from('sessional_assessments').select('*').eq('id', params.sessionalAssessmentId).single();
      if (sa) {
        params.subjectId = params.subjectId || sa.subject_id;
        params.sectionId = params.sectionId || sa.section_id;
        params.maxMarks = params.maxMarks ?? sa.max_marks;
        params.sessionalType = params.sessionalType || sa.title;
      }
    }

    if (params.maxMarks === undefined || params.maxMarks <= 0) {
      throw new Error('Maximum marks must be defined and greater than 0.');
    }

    const rows = params.studentMarks.map(sm => {
      if (sm.marksObtained < 0 || sm.marksObtained > params.maxMarks!) {
        throw new Error(`Marks ${sm.marksObtained} exceeds valid range (0 - ${params.maxMarks}).`);
      }
      return {
        sessional_assessment_id: params.sessionalAssessmentId || null,
        faculty_id: params.facultyId,
        subject_id: params.subjectId,
        section_id: params.sectionId,
        student_id: sm.studentId,
        sessional_type: params.sessionalType || 'Sessional',
        max_marks: params.maxMarks,
        marks_obtained: sm.marksObtained,
        remarks: sm.remarks,
        updated_by: params.facultyId,
        updated_at: new Date().toISOString(),
      };
    });

    // Upsert using assessment ID conflict if available, else subject/section/student/type
    let upsertResult;
    if (params.sessionalAssessmentId) {
      upsertResult = await supabase
        .from('sessional_marks')
        .upsert(rows, { onConflict: 'sessional_assessment_id,student_id' })
        .select();
    } else {
      upsertResult = await supabase
        .from('sessional_marks')
        .upsert(rows, { onConflict: 'subject_id,section_id,student_id,sessional_type' })
        .select();
    }

    if (upsertResult.error) throw new Error(upsertResult.error.message);

    // Record in marks_history audit table
    for (const sm of params.studentMarks) {
      if (sm.oldMarks !== sm.marksObtained) {
        await supabase.from('marks_history').insert({
          entity_type: 'sessional',
          entity_id: params.sessionalAssessmentId || params.subjectId,
          student_id: sm.studentId,
          subject_id: params.subjectId,
          old_marks: sm.oldMarks,
          new_marks: sm.marksObtained,
          updated_by: params.facultyId,
          reason: `${params.sessionalType || 'Sessional'} Marks Updated`
        });
      }
    }

    return upsertResult.data as SessionalMark[];
  }
};

