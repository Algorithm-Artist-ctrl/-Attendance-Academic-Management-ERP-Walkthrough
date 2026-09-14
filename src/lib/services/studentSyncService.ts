import Papa from 'papaparse';
import { supabase } from '../supabase/supabaseClient';
import { fetchCSVContent } from '../utils/urlUtils';
import { AdmissionType } from '../../types/database.types';

export interface StudentSyncRowError {
  row: number;
  rollNumber?: string;
  message: string;
}

export interface StudentSyncResult {
  success: boolean;
  totalRows: number;
  added: number;
  updated: number;
  unchanged: number;
  errorCount: number;
  errors: StudentSyncRowError[];
  timestamp: string;
}

export interface StudentCSVPreviewItem {
  rowNumber: number;
  rollNumber: string;
  fullName: string;
  email: string;
  phone?: string;
  departmentCode: string;
  academicYear: string;
  semesterName: string;
  sectionName: string;
  admissionType: string;
  isValid: boolean;
  errors: string[];
  isExisting: boolean;
}

export interface StudentCSVValidationReport {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicatesInCSV: number;
  newCount: number;
  updateCount: number;
  errors: StudentSyncRowError[];
  previewRows: StudentCSVPreviewItem[];
  canImport: boolean;
}

export interface StudentSyncOptions {
  performedBy?: string;
  defaultCohortYear?: number;
  userRole?: string;
  userDepartmentId?: string;
}

export class StudentSyncService {
  private static instance: StudentSyncService;

  public static getInstance(): StudentSyncService {
    if (!StudentSyncService.instance) {
      StudentSyncService.instance = new StudentSyncService();
    }
    return StudentSyncService.instance;
  }

  /**
   * Helper to load live academic hierarchy from Supabase
   */
  private async loadAcademicHierarchy() {
    const [
      { data: depts, error: dErr },
      { data: progs, error: pErr },
      { data: sessions, error: sesErr },
      { data: years, error: yErr },
      { data: semesters, error: semErr },
      { data: sections, error: secErr },
      { data: existingStudents, error: studErr }
    ] = await Promise.all([
      supabase.from('departments').select('*'),
      supabase.from('programs').select('*'),
      supabase.from('academic_sessions').select('*'),
      supabase.from('academic_years').select('*').order('year_number'),
      supabase.from('semesters').select('*').order('semester_number'),
      supabase.from('sections').select('*').order('name'),
      supabase.from('students').select('*')
    ]);

    if (dErr || pErr || yErr || semErr || secErr || studErr) {
      throw new Error(`Failed to load database academic hierarchy: ${dErr?.message || yErr?.message || secErr?.message}`);
    }

    const currentSession = sessions?.find(s => s.is_current) || sessions?.[0];
    const defaultDept = depts?.find(d => d.code === 'CSE') || depts?.[0];
    const defaultProg = progs?.find(p => p.code === 'BTECH-CSE') || progs?.[0];

    if (!currentSession || !defaultDept || !defaultProg) {
      throw new Error('Database is missing default institution, department, or academic session.');
    }

    return {
      depts: depts || [],
      progs: progs || [],
      sessions: sessions || [],
      years: years || [],
      semesters: semesters || [],
      sections: sections || [],
      existingStudents: existingStudents || [],
      currentSession,
      defaultDept,
      defaultProg,
    };
  }

  /**
   * Validates CSV rows against the database and role restrictions without performing mutations.
   */
  public async validateStudentsCSV(
    rawCsv: string,
    options?: StudentSyncOptions
  ): Promise<StudentCSVValidationReport> {
    if (!rawCsv || rawCsv.trim().length === 0) {
      throw new Error('CSV content is empty.');
    }

    const hierarchy = await this.loadAcademicHierarchy();
    const { depts, years, semesters, sections, existingStudents, defaultDept } = hierarchy;

    const parsed = Papa.parse<Record<string, string>>(rawCsv, {
      header: true,
      skipEmptyLines: 'greedy',
    });

    if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`CSV Parsing Failed: ${parsed.errors[0]?.message || 'Unknown formatting error'}`);
    }

    const rows = parsed.data;
    const errors: StudentSyncRowError[] = [];
    const seenRollsInCSV = new Set<string>();
    const previewRows: StudentCSVPreviewItem[] = [];

    let duplicatesInCSV = 0;
    let validCount = 0;
    let newCount = 0;
    let updateCount = 0;

    for (let index = 0; index < rows.length; index++) {
      const raw = rows[index];
      const rowNum = index + 2;
      const rowErrors: string[] = [];

      // Extract roll number
      const rawRoll = (
        raw.roll_no ||
        raw.roll_number ||
        raw.rollno ||
        raw.enrollment_no ||
        raw.enrollment_number ||
        raw.roll ||
        raw['ROLL NO'] ||
        raw['Roll No'] ||
        raw['Roll Number'] ||
        raw['ROLL NUMBER'] ||
        ''
      ).trim();

      if (!rawRoll) {
        rowErrors.push('Roll number is missing.');
      }

      const cleanRoll = rawRoll.toUpperCase();
      if (cleanRoll) {
        if (seenRollsInCSV.has(cleanRoll)) {
          duplicatesInCSV++;
          rowErrors.push(`Duplicate roll number "${cleanRoll}" in CSV.`);
        } else {
          seenRollsInCSV.add(cleanRoll);
        }
      }

      // Extract name
      const rawName = (
        raw.name ||
        raw.full_name ||
        raw.student_name ||
        raw['STUDENT NAME'] ||
        raw['Student Name'] ||
        raw['Full Name'] ||
        raw['FULL NAME'] ||
        raw['Name'] ||
        ''
      ).trim();

      if (!rawName) {
        rowErrors.push('Student name is missing.');
      }

      // Extract email & phone
      const rawEmail = (raw.email || raw.student_email || raw['EMAIL'] || raw['Email'] || '').trim().toLowerCase();
      const rawMobile = (raw.mobile || raw.phone || raw.contact || raw.mobile_no || raw['MOBILE'] || raw['Mobile'] || raw['Phone'] || '').trim();

      // Resolve Department
      const rawDept = (raw.department || raw.dept || raw.branch || raw['DEPARTMENT'] || raw['Department'] || '').trim().toUpperCase();
      let matchedDept = defaultDept;
      if (rawDept && depts.length > 0) {
        const found = depts.find(d => d.code.toUpperCase() === rawDept || d.name.toUpperCase().includes(rawDept));
        if (found) {
          matchedDept = found;
        } else {
          rowErrors.push(`Department "${rawDept}" does not exist in database.`);
        }
      }

      // HOD Department Scoping Check
      if (options?.userRole === 'hod' && options.userDepartmentId) {
        const userDept = depts.find(d => d.id === options.userDepartmentId);
        const isMismatch = matchedDept.id !== options.userDepartmentId || 
                           (rawDept && userDept && rawDept !== userDept.code.toUpperCase() && !userDept.name.toUpperCase().includes(rawDept));
        if (isMismatch) {
          rowErrors.push(`HOD Access Denied: Student belongs to department "${rawDept || matchedDept.code}" which is outside your administrative department boundary.`);
        }
      }

      // Resolve Academic Year (1, 2, 3, 4)
      const rawYear = (raw.year || raw.academic_year || raw.class_year || raw['YEAR'] || raw['Year'] || '').trim();
      let resolvedYear = years[0];

      if (rawYear) {
        const numYear = parseInt(rawYear.replace(/\D/g, ''), 10);
        const foundYear = years.find(y => 
          (!isNaN(numYear) && y.year_number === numYear) ||
          y.name.toLowerCase().includes(rawYear.toLowerCase())
        );
        if (foundYear) {
          resolvedYear = foundYear;
        } else {
          rowErrors.push(`Academic Year "${rawYear}" does not exist.`);
        }
      } else if (options?.defaultCohortYear) {
        const foundYear = years.find(y => y.year_number === options.defaultCohortYear);
        if (foundYear) resolvedYear = foundYear;
      }

      // Resolve Semester for Year
      const matchingSem = semesters.find(s => s.academic_year_id === resolvedYear?.id) || semesters[0];
      if (!matchingSem && resolvedYear) {
        rowErrors.push(`No active semester for Year ${resolvedYear.year_number}.`);
      }

      // Resolve Section
      const rawSec = (raw.section || raw.sec || raw.class_section || raw['SECTION'] || raw['Section'] || '').trim().toUpperCase();
      if (!rawSec) {
        rowErrors.push('Class section is missing.');
      }

      let matchedSection = matchingSem 
        ? sections.find(s => s.semester_id === matchingSem.id && s.name.toUpperCase() === rawSec && s.active)
        : undefined;

      if (!matchedSection) {
        matchedSection = sections.find(s => s.name.toUpperCase() === rawSec && s.active);
      }

      if (!matchedSection && rawSec) {
        rowErrors.push(`Section "${rawSec}" does not exist for Year ${resolvedYear?.year_number || '?'}.`);
      }

      // Admission Type
      const rawAdm = (raw.admission_type || raw.type || raw.admission || '').trim().toLowerCase();
      const admissionType: AdmissionType = rawAdm.includes('lateral') ? 'Lateral Entry' : 'Regular';

      // Check existing status
      const existing = existingStudents.find(s => s.roll_number.trim().toUpperCase() === cleanRoll);
      const isExisting = !!existing;

      if (rowErrors.length === 0) {
        validCount++;
        if (isExisting) {
          updateCount++;
        } else {
          newCount++;
        }
      } else {
        for (const msg of rowErrors) {
          errors.push({ row: rowNum, rollNumber: cleanRoll, message: msg });
        }
      }

      previewRows.push({
        rowNumber: rowNum,
        rollNumber: cleanRoll,
        fullName: rawName.toUpperCase(),
        email: rawEmail || (existing?.email || `${cleanRoll.toLowerCase()}@student.vctm.in`),
        phone: rawMobile || existing?.phone || undefined,
        departmentCode: matchedDept?.code || 'CSE',
        academicYear: resolvedYear?.name || 'Year 1',
        semesterName: matchingSem?.name || 'Sem 1',
        sectionName: matchedSection?.name || rawSec,
        admissionType,
        isValid: rowErrors.length === 0,
        errors: rowErrors,
        isExisting,
      });
    }

    return {
      totalRows: rows.length,
      validCount,
      invalidCount: rows.length - validCount,
      duplicatesInCSV,
      newCount,
      updateCount,
      errors,
      previewRows,
      canImport: validCount > 0,
    };
  }

  /**
   * Synchronize students from a Google Sheet CSV URL or raw CSV content with atomic DB upsert
   */
  public async syncStudents(
    input: { url?: string; csvContent?: string },
    options?: StudentSyncOptions
  ): Promise<StudentSyncResult> {
    let rawCsv = input.csvContent || '';

    if (input.url && !rawCsv) {
      rawCsv = await fetchCSVContent(input.url);
    }

    if (!rawCsv || rawCsv.trim().length === 0) {
      throw new Error('CSV content is empty.');
    }

    // 1. Fetch live academic hierarchy from Supabase
    const hierarchy = await this.loadAcademicHierarchy();
    const { depts, years, semesters, sections, existingStudents, currentSession, defaultDept, defaultProg } = hierarchy;

    // 2. Parse CSV rows
    const parsed = Papa.parse<Record<string, string>>(rawCsv, {
      header: true,
      skipEmptyLines: 'greedy',
    });

    if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`CSV Parsing Failed: ${parsed.errors[0]?.message || 'Unknown formatting error'}`);
    }

    const rows = parsed.data;
    const errors: StudentSyncRowError[] = [];
    const seenRollsInCSV = new Set<string>();

    let addedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    // 3. Process each row sequentially with Supabase UPSERT
    for (let index = 0; index < rows.length; index++) {
      const raw = rows[index];
      const rowNum = index + 2; // 1-based index including header

      // Extract roll number
      const rawRoll = (
        raw.roll_no ||
        raw.roll_number ||
        raw.rollno ||
        raw.enrollment_no ||
        raw.enrollment_number ||
        raw.roll ||
        raw['ROLL NO'] ||
        raw['Roll No'] ||
        raw['Roll Number'] ||
        raw['ROLL NUMBER'] ||
        ''
      ).trim();

      if (!rawRoll) {
        errors.push({ row: rowNum, message: 'Roll number / Enrollment number is missing.' });
        continue;
      }

      const cleanRoll = rawRoll.toUpperCase();
      if (seenRollsInCSV.has(cleanRoll)) {
        errors.push({ row: rowNum, rollNumber: cleanRoll, message: `Duplicate roll number "${cleanRoll}" encountered within CSV.` });
        continue;
      }
      seenRollsInCSV.add(cleanRoll);

      // Extract name
      const rawName = (
        raw.name ||
        raw.full_name ||
        raw.student_name ||
        raw['STUDENT NAME'] ||
        raw['Student Name'] ||
        raw['Full Name'] ||
        raw['FULL NAME'] ||
        raw['Name'] ||
        ''
      ).trim();

      if (!rawName) {
        errors.push({ row: rowNum, rollNumber: cleanRoll, message: 'Student full name is missing.' });
        continue;
      }

      // Extract email & mobile/phone
      const rawEmail = (raw.email || raw.student_email || raw['EMAIL'] || raw['Email'] || '').trim().toLowerCase();
      const rawMobile = (raw.mobile || raw.phone || raw.contact || raw.mobile_no || raw['MOBILE'] || raw['Mobile'] || raw['Phone'] || '').trim();

      // Resolve Department
      const rawDept = (raw.department || raw.dept || raw.branch || raw['DEPARTMENT'] || raw['Department'] || '').trim().toUpperCase();
      let matchedDept = defaultDept;
      if (rawDept && depts) {
        const found = depts.find(d => d.code.toUpperCase() === rawDept || d.name.toUpperCase().includes(rawDept));
        if (found) matchedDept = found;
      }

      // Enforce HOD role department boundary
      if (options?.userRole === 'hod' && options.userDepartmentId) {
        if (matchedDept.id !== options.userDepartmentId) {
          errors.push({
            row: rowNum,
            rollNumber: cleanRoll,
            message: `HOD department boundary violation: Cannot import student for department "${matchedDept.code}" outside your assigned department.`
          });
          continue;
        }
      }

      // Resolve Academic Year (1, 2, 3, 4)
      const rawYear = (raw.year || raw.academic_year || raw.class_year || raw['YEAR'] || raw['Year'] || '').trim();
      let resolvedYear = years[0];

      if (rawYear) {
        const numYear = parseInt(rawYear.replace(/\D/g, ''), 10);
        const foundYear = years.find(y => 
          (!isNaN(numYear) && y.year_number === numYear) ||
          y.name.toLowerCase().includes(rawYear.toLowerCase())
        );
        if (foundYear) {
          resolvedYear = foundYear;
        } else {
          errors.push({ row: rowNum, rollNumber: cleanRoll, message: `Academic Year "${rawYear}" does not exist in database.` });
          continue;
        }
      } else if (options?.defaultCohortYear) {
        const foundYear = years.find(y => y.year_number === options.defaultCohortYear);
        if (foundYear) resolvedYear = foundYear;
      }

      if (!resolvedYear) {
        errors.push({ row: rowNum, rollNumber: cleanRoll, message: 'Unable to resolve academic year for student.' });
        continue;
      }

      // Resolve Semester for this Year
      const matchingSem = semesters.find(s => s.academic_year_id === resolvedYear.id) || semesters[0];
      if (!matchingSem) {
        errors.push({ row: rowNum, rollNumber: cleanRoll, message: `No active semester found for Year ${resolvedYear.year_number}.` });
        continue;
      }

      // Resolve Section (e.g. 'A', 'B', 'C')
      const rawSec = (raw.section || raw.sec || raw.class_section || raw['SECTION'] || raw['Section'] || '').trim().toUpperCase();
      if (!rawSec) {
        errors.push({ row: rowNum, rollNumber: cleanRoll, message: 'Class section is missing.' });
        continue;
      }

      // Match section specifically linked to this semester/year
      let matchedSection = sections.find(s => 
        s.semester_id === matchingSem.id && 
        s.name.toUpperCase() === rawSec &&
        s.active
      );

      // Fallback: match by name if semester_id is null
      if (!matchedSection) {
        matchedSection = sections.find(s => s.name.toUpperCase() === rawSec && s.active);
      }

      if (!matchedSection) {
        errors.push({ 
          row: rowNum, 
          rollNumber: cleanRoll, 
          message: `Section "${rawSec}" does not exist for Year ${resolvedYear.year_number} (${matchingSem.name}) in database.` 
        });
        continue;
      }

      // Admission Type
      const rawAdm = (raw.admission_type || raw.type || raw.admission || '').trim().toLowerCase();
      const admissionType: AdmissionType = rawAdm.includes('lateral') ? 'Lateral Entry' : 'Regular';

      // Check if student already exists in Supabase
      const existing = existingStudents.find(s => 
        s.roll_number.trim().toUpperCase() === cleanRoll
      );

      const studentData = {
        institution_id: matchedDept.institution_id || '11111111-1111-1111-1111-111111111111',
        department_id: matchedDept.id,
        program_id: defaultProg.id,
        academic_session_id: currentSession.id,
        academic_year_id: resolvedYear.id,
        semester_id: matchingSem.id,
        section_id: matchedSection.id,
        roll_number: cleanRoll,
        full_name: rawName.toUpperCase(),
        admission_type: admissionType,
        email: rawEmail || (existing?.email || `${cleanRoll.toLowerCase()}@student.vctm.in`),
        phone: rawMobile || (existing?.phone || null),
        active: true,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        // Check if anything actually changed
        const hasChanged = 
          existing.full_name !== studentData.full_name ||
          existing.section_id !== studentData.section_id ||
          existing.academic_year_id !== studentData.academic_year_id ||
          existing.semester_id !== studentData.semester_id ||
          existing.department_id !== studentData.department_id ||
          existing.admission_type !== studentData.admission_type ||
          (rawEmail && existing.email !== studentData.email) ||
          (rawMobile && existing.phone !== studentData.phone);

        if (hasChanged) {
          const { error: updErr } = await supabase
            .from('students')
            .update(studentData)
            .eq('id', existing.id);

          if (updErr) {
            errors.push({ row: rowNum, rollNumber: cleanRoll, message: `Update failed: ${updErr.message}` });
          } else {
            // Also update profiles display name / email without altering role or password
            await supabase
              .from('profiles')
              .update({
                full_name: studentData.full_name,
                email: studentData.email,
                department_id: studentData.department_id,
                updated_at: new Date().toISOString()
              })
              .eq('student_id', existing.id);

            updatedCount++;
          }
        } else {
          unchangedCount++;
        }
      } else {
        // Insert new student
        const { data: newStud, error: insErr } = await supabase
          .from('students')
          .insert([studentData])
          .select()
          .single();

        if (insErr) {
          errors.push({ row: rowNum, rollNumber: cleanRoll, message: `Insertion failed: ${insErr.message}` });
        } else {
          // Create matching profile for student login using enrollment number
          await supabase.from('profiles').insert([{
            id: newStud.id,
            email: studentData.email,
            role: 'student',
            full_name: studentData.full_name,
            department_id: studentData.department_id,
            student_id: newStud.id,
            phone: studentData.phone,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]).select();

          addedCount++;
        }
      }
    }

    const result: StudentSyncResult = {
      success: errors.length === 0 || (addedCount + updatedCount + unchangedCount) > 0,
      totalRows: rows.length,
      added: addedCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      errorCount: errors.length,
      errors,
      timestamp: new Date().toISOString()
    };

    // 4. Log sync to audit_logs
    await supabase.from('audit_logs').insert([{
      action: 'STUDENTS_GOOGLE_SHEET_SYNC',
      actor_name: options?.performedBy || 'Tarun Kushwah (Super Admin)',
      actor_role: options?.userRole || 'super_admin',
      entity_type: 'students',
      entity_id: currentSession.id,
      new_values: {
        total_rows: rows.length,
        added: addedCount,
        updated: updatedCount,
        unchanged: unchangedCount,
        errors_count: errors.length,
        department_id: options?.userDepartmentId || null,
      }
    }]);

    return result;
  }
}

export const studentSyncService = StudentSyncService.getInstance();
