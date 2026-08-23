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
  AttendanceStatus 
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

  // 5. Admin CRUD Operations
  async addStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('students').insert(student).select().single();
    if (error) throw new Error(error.message);
    return data as Student;
  },

  async updateStudent(id: string, updates: Partial<Student>) {
    const { data, error } = await supabase.from('students').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Student;
  },

  async deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async addFaculty(fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('faculty').insert(fac).select().single();
    if (error) throw new Error(error.message);
    return data as Faculty;
  },

  async updateFaculty(id: string, updates: Partial<Faculty>) {
    const { data, error } = await supabase.from('faculty').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Faculty;
  },

  async deleteFaculty(id: string) {
    const { error } = await supabase.from('faculty').delete().eq('id', id);
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
};
