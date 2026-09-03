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
    existingStudentId?: string;
    isUpdate: boolean;
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
  newCount: number;
  updateCount: number;
}

export function parseAndValidateStudentCSV(
  fileContent: string,
  context: {
    institutionId: string;
    departmentId: string;
    programId: string;
    sessionId: string;
    yearId?: string;
    semesterId?: string;
    defaultSectionId?: string;
    years?: Array<{ id: string; name: string; year_number: number }>;
    semesters?: Array<{ id: string; name: string; academic_year_id: string; semester_number: number }>;
    sections: Array<{ id: string; name: string; semester_id?: string }>;
    faculty: Array<{ id: string; full_name: string; employee_code: string; faculty_code?: string }>;
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

        let newCount = 0;
        let updateCount = 0;

        results.data.forEach((row, index) => {
          const rowNum = index + 2; // 1-based index including header
          const errors: string[] = [];

          // 1. Roll Number Validation
          const rawRoll = (
            row.roll_no ||
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
            } else {
              seenRolls.add(lowerRoll);
            }
          }

          // 2. Full Name Validation
          const rawName = (
            row.name ||
            row.full_name || 
            row['STUDENT NAME'] || 
            row['Student Name'] || 
            row['Full Name'] || 
            row['FULL NAME'] || 
            row['Name'] || 
            row['NAME'] || 
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

          // 4. Year & Semester resolution
          const rawYear = (
            row.year ||
            row.academic_year ||
            row['YEAR'] ||
            row['Year'] ||
            row['Academic Year'] ||
            ''
          ).trim();

          let resolvedYearId = context.yearId || context.years?.[0]?.id || '';
          let resolvedSemesterId = context.semesterId || context.semesters?.[0]?.id || '';

          if (rawYear && context.years && context.years.length > 0) {
            const numYear = parseInt(rawYear.replace(/\D/g, ''), 10);
            const foundYear = context.years.find(y => 
              (!isNaN(numYear) && y.year_number === numYear) ||
              y.name.toLowerCase().includes(rawYear.toLowerCase())
            );
            if (foundYear) {
              resolvedYearId = foundYear.id;
              // Find matching semester for this year
              const foundSem = context.semesters?.find(s => s.academic_year_id === foundYear.id);
              if (foundSem) {
                resolvedSemesterId = foundSem.id;
              }
            } else {
              errors.push(`Academic year '${rawYear}' does not exist in database`);
            }
          }

          // 5. Section mapping
          const rawSec = (
            row.section || 
            row.section_name || 
            row['SECTION'] || 
            row['Section'] || 
            row['Sec'] || 
            row['SEC'] || 
            ''
          ).trim().toUpperCase();

          let matchedSectionId = context.defaultSectionId || context.sections[0]?.id || '';

          if (rawSec) {
            // First try matching section in the resolved semester
            let foundSec = context.sections.find(s => 
              s.name.toUpperCase() === rawSec && 
              (!resolvedSemesterId || !s.semester_id || s.semester_id === resolvedSemesterId)
            );

            // Fallback to section with the same name anywhere if not found
            if (!foundSec) {
              foundSec = context.sections.find(s => s.name.toUpperCase() === rawSec);
            }

            if (foundSec) {
              matchedSectionId = foundSec.id;
              if (foundSec.semester_id) {
                resolvedSemesterId = foundSec.semester_id;
                const foundSem = context.semesters?.find(s => s.id === foundSec?.semester_id);
                if (foundSem?.academic_year_id) {
                  resolvedYearId = foundSem.academic_year_id;
                }
              }
            } else {
              errors.push(`Section '${rawSec}' does not exist in database`);
            }
          }

          // 6. Mentor mapping (optional)
          const rawMentor = (row.mentor || row.mentor_name || row['MENTOR'] || row['Mentor'] || '').trim().toLowerCase();
          let matchedMentorId: string | undefined = undefined;
          if (rawMentor) {
            const foundFaculty = context.faculty.find(f => 
              f.full_name.toLowerCase().includes(rawMentor) ||
              f.employee_code.toLowerCase() === rawMentor ||
              (f.faculty_code && f.faculty_code.toLowerCase() === rawMentor)
            );
            if (foundFaculty) {
              matchedMentorId = foundFaculty.id;
            }
          }

          // 7. Check if student already exists for update vs insert
          const rawEmail = (row.email || row['EMAIL'] || row['Email'] || '').trim();
          const existingStudent = rawRoll ? context.existingStudents.find(s => 
            s.roll_number.trim().toLowerCase() === rawRoll.toLowerCase() ||
            (rawEmail && s.email && s.email.trim().toLowerCase() === rawEmail.toLowerCase())
          ) : undefined;

          const isUpdate = Boolean(existingStudent);

          if (errors.length > 0) {
            invalidRows.push({
              rowNumber: rowNum,
              raw: row,
              errors,
            });
          } else {
            if (isUpdate) {
              updateCount++;
            } else {
              newCount++;
            }

            validRows.push({
              existingStudentId: existingStudent?.id,
              isUpdate,
              roll_number: rawRoll,
              full_name: rawName,
              admission_type: admissionType,
              section_id: matchedSectionId,
              department_id: context.departmentId,
              program_id: context.programId,
              academic_session_id: context.sessionId,
              academic_year_id: resolvedYearId,
              semester_id: resolvedSemesterId,
              institution_id: context.institutionId,
              mentor_faculty_id: matchedMentorId || existingStudent?.mentor_faculty_id,
              email: rawEmail || `${rawRoll}@student.vctm.in`,
              phone: row.phone?.trim() || existingStudent?.phone,
            });
          }
        });

        resolve({
          validRows,
          invalidRows,
          totalParsed: results.data.length,
          newCount,
          updateCount,
        });
      },
      error: (err: any) => {
        reject(err);
      },
    });
  });
}
