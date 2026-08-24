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

export const supabaseService = {
  // 1. Fetch All Master & Operational Data
  async fetchAllData() {
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
        supabase.from('profiles').select('*'),
      ]);

      return {
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
        profiles: (profilesList as UserProfile[]) || [],
      };
    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
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

    return updated;
  },

  async deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw new Error(error.message);
    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch {}
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

    return facData as Faculty;
  },

  async deleteFaculty(id: string) {
    const { error } = await supabase.from('faculty').delete().eq('id', id);
    if (error) throw new Error(error.message);
    try {
      await supabase.from('profiles').delete().or(`id.eq.${id},faculty_id.eq.${id}`);
    } catch {}
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
          createdAt: row.created_at
        };
      });
    } catch {
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
    return data as Subject;
  },

  async updateSubject(id: string, updates: Partial<Subject>) {
    const { data, error } = await supabase.from('subjects').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Subject;
  },

  async deleteSubject(id: string) {
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async addDepartment(dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('departments').insert(dept).select().single();
    if (error) throw new Error(error.message);
    return data as Department;
  },

  async updateDepartment(id: string, updates: Partial<Department>) {
    const { data, error } = await supabase.from('departments').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Department;
  },

  async deleteDepartment(id: string) {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async addProgram(prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('programs').insert(prog).select().single();
    if (error) throw new Error(error.message);
    return data as Program;
  },

  async updateProgram(id: string, updates: Partial<Program>) {
    const { data, error } = await supabase.from('programs').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Program;
  },

  async deleteProgram(id: string) {
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async addSection(sec: Omit<Section, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('sections').insert(sec).select().single();
    if (error) throw new Error(error.message);
    return data as Section;
  },

  async updateSection(id: string, updates: Partial<Section>) {
    const { data, error } = await supabase.from('sections').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Section;
  },

  async deleteSection(id: string) {
    const { error } = await supabase.from('sections').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async addAssignment(assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('faculty_subject_assignments').insert(assign).select().single();
    if (error) throw new Error(error.message);
    return data as FacultySubjectAssignment;
  },

  async deleteAssignment(id: string) {
    const { error } = await supabase.from('faculty_subject_assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
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
    return true;
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
    facultyId: string;
    subjectId: string;
    sectionId: string;
    sessionalType?: string;
    maxMarks: number;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }>;
  }) {
    if (params.maxMarks <= 0) {
      throw new Error('Maximum marks must be greater than 0.');
    }

    const rows = params.studentMarks.map(sm => {
      if (sm.marksObtained < 0 || sm.marksObtained > params.maxMarks) {
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

