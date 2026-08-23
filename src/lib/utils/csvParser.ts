import Papa from 'papaparse';
import { AdmissionType, Student } from '../../types/database.types';

export interface CSVStudentRow {
  roll_number: string;
  full_name: string;
  admission_type?: string;
  section_name?: string;
  department_code?: string;
  program_code?: string;
  mentor_name?: string;
  email?: string;
  phone?: string;
}

export interface CSVValidationResult {
  validRows: Array<{
    roll_number: string;
    full_name: string;
    admission_type: AdmissionType;
    section_id: string;
    department_id: string;
    program_id: string;
    academic_session_id: string;
    academic_year_id: string;
    semester_id: string;
    institution_id: string;
    mentor_faculty_id?: string;
    email?: string;
    phone?: string;
  }>;
  invalidRows: Array<{
    rowNumber: number;
    raw: any;
    errors: string[];
  }>;
  totalParsed: number;
}

export function parseAndValidateStudentCSV(
  fileContent: string,
  context: {
    institutionId: string;
    departmentId: string;
    programId: string;
    sessionId: string;
    yearId: string;
    semesterId: string;
    defaultSectionId: string;
    sections: Array<{ id: string; name: string }>;
    faculty: Array<{ id: string; full_name: string; employee_code: string }>;
    existingStudents: Student[];
  }
): Promise<CSVValidationResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validRows: CSVValidationResult['validRows'] = [];
        const invalidRows: CSVValidationResult['invalidRows'] = [];
        const seenRolls = new Set<string>();

        // Pre-populate existing roll numbers for duplicate check
        const dbRolls = new Set(context.existingStudents.map(s => s.roll_number.trim().toLowerCase()));

        results.data.forEach((row, index) => {
          const rowNum = index + 2; // 1-based index including header
          const errors: string[] = [];

          // 1. Roll Number Validation
          const rawRoll = (
            row.roll_number || 
            row['ROLL NO'] || 
            row['Roll No'] || 
            row['Roll Number'] || 
            row['ROLL NUMBER'] || 
            row.roll || 
            row['Roll'] || 
            ''
          ).trim();
          if (!rawRoll) {
            errors.push('Roll Number is missing');
          } else {
            const lowerRoll = rawRoll.toLowerCase();
            if (seenRolls.has(lowerRoll)) {
              errors.push(`Duplicate roll number within CSV: ${rawRoll}`);
            } else if (dbRolls.has(lowerRoll)) {
              errors.push(`Roll number already exists in database: ${rawRoll}`);
            } else {
              seenRolls.add(lowerRoll);
            }
          }

          // 2. Full Name Validation
          const rawName = (
            row.full_name || 
            row['STUDENT NAME'] || 
            row['Student Name'] || 
            row['Full Name'] || 
            row['FULL NAME'] || 
            row['Name'] || 
            row['NAME'] || 
            row.name || 
            ''
          ).trim();
          if (!rawName) {
            errors.push('Student Name is missing');
          }

          // 3. Admission Type
          const rawAdmission = (
            row.admission_type || 
            row['ADMISSION TYPE'] || 
            row['Admission Type'] || 
            row['Type'] || 
            ''
          ).trim().toLowerCase();
          const admissionType: AdmissionType = rawAdmission.includes('lateral') ? 'Lateral Entry' : 'Regular';

          // 4. Section mapping
          const rawSec = (
            row.section || 
            row.section_name || 
            row['SECTION'] || 
            row['Section'] || 
            row['Sec'] || 
            row['SEC'] || 
            ''
          ).trim().toUpperCase();
          let matchedSectionId = context.defaultSectionId;
          if (rawSec) {
            const foundSec = context.sections.find(s => s.name.toUpperCase() === rawSec);
            if (foundSec) {
              matchedSectionId = foundSec.id;
            } else {
              errors.push(`Section '${rawSec}' does not exist`);
            }
          }

          // 5. Mentor mapping (optional)
          const rawMentor = (row.mentor || row.mentor_name || row['MENTOR'] || row['Mentor'] || '').trim().toLowerCase();
          let matchedMentorId: string | undefined = undefined;
          if (rawMentor) {
            const foundFaculty = context.faculty.find(f => 
              f.full_name.toLowerCase().includes(rawMentor) ||
              f.employee_code.toLowerCase() === rawMentor
            );
            if (foundFaculty) {
              matchedMentorId = foundFaculty.id;
            }
          }

          if (errors.length > 0) {
            invalidRows.push({
              rowNumber: rowNum,
              raw: row,
              errors,
            });
          } else {
            validRows.push({
              roll_number: rawRoll,
              full_name: rawName,
              admission_type: admissionType,
              section_id: matchedSectionId,
              department_id: context.departmentId,
              program_id: context.programId,
              academic_session_id: context.sessionId,
              academic_year_id: context.yearId,
              semester_id: context.semesterId,
              institution_id: context.institutionId,
              mentor_faculty_id: matchedMentorId,
              email: row.email?.trim() || `${rawRoll}@student.vctm.in`,
              phone: row.phone?.trim(),
            });
          }
        });

        resolve({
          validRows,
          invalidRows,
          totalParsed: results.data.length,
        });
      },
      error: (err: any) => {
        reject(err);
      },
    });
  });
}
