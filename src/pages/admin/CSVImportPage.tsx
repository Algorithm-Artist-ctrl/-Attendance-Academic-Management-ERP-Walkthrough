import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Trash2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { parseAndValidateStudentCSV, CSVValidationResult } from '../../lib/utils/csvParser';
import { exportToCSV } from '../../lib/utils/exportUtils';

export const CSVImportPage: React.FC = () => {
  const { 
    institution, 
    departments, 
    programs, 
    sessions, 
    years, 
    semesters, 
    sections, 
    faculty, 
    students, 
    addStudent, 
    refreshData 
  } = useAcademic();

  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportSuccess(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      validateCSV(text);
    };
    reader.readAsText(file);
  };

  const validateCSV = async (text: string) => {
    setIsValidating(true);
    try {
      const result = await parseAndValidateStudentCSV(text, {
        institutionId: institution.id,
        departmentId: departments[0]?.id || 'dept-cse-01',
        programId: programs[0]?.id || 'prog-btech-cse-01',
        sessionId: sessions[0]?.id || 'session-2026-2027',
        yearId: years[1]?.id || 'year-2nd-btech-01',
        semesterId: semesters[0]?.id || 'sem-3rd-odd-01',
        defaultSectionId: sections[0]?.id || 'sec-btech-cse-2-a',
        sections: sections.map(s => ({ id: s.id, name: s.name })),
        faculty: faculty.map(f => ({ id: f.id, full_name: f.full_name, employee_code: f.employee_code })),
        existingStudents: students,
      });
      setValidationResult(result);
    } catch (err: any) {
      alert(`CSV Parsing Error: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;
    setIsImporting(true);

    try {
      let importedCount = 0;
      for (const row of validationResult.validRows) {
        addStudent({
          institution_id: row.institution_id,
          department_id: row.department_id,
          program_id: row.program_id,
          academic_session_id: row.academic_session_id,
          academic_year_id: row.academic_year_id,
          semester_id: row.semester_id,
          section_id: row.section_id,
          roll_number: row.roll_number,
          full_name: row.full_name,
          admission_type: row.admission_type,
          mentor_faculty_id: row.mentor_faculty_id,
          email: row.email,
          phone: row.phone,
          active: true,
        });
        importedCount++;
      }

      setImportSuccess(`Successfully imported ${importedCount} students into the database!`);
      setValidationResult(null);
      setCsvContent(null);
      setFileName(null);
      refreshData();
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadSampleCSV = () => {
    const sampleData = [
      {
        roll_number: '2503400100091',
        full_name: 'ROHIT SHARMA',
        admission_type: 'Regular',
        section: 'A',
        mentor: 'Ms. Hemlata Chaudhary'
      },
      {
        roll_number: '2503400100092',
        full_name: 'ANANYA VERMA',
        admission_type: 'Regular',
        section: 'B',
        mentor: 'Mr. Imran Raza Khan'
      },
      {
        roll_number: '2603400109015',
        full_name: 'RAHUL CHOUDHARY',
        admission_type: 'Lateral Entry',
        section: 'A',
        mentor: 'Dr. Faizan Nasir'
      }
    ];
    exportToCSV(sampleData, 'VCTM_Student_Import_Sample_Template');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bulk Student CSV Importer</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Import large student cohorts with automatic roll number deduplication and schema validation
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Download className="w-4 h-4 text-vctm-navy-700" />}
          onClick={handleDownloadSampleCSV}
        >
          Download Sample CSV Template
        </Button>
      </div>

      {importSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center gap-2 animate-in zoom-in-95 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{importSuccess}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <Card title="Upload Student List CSV File">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-vctm-navy-600 transition-colors bg-slate-50/50">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">
            {fileName ? fileName : 'Drag and drop your CSV file here, or browse'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Supports columns: <code className="text-slate-700 font-mono">roll_number, full_name, admission_type, section, mentor</code>
          </p>
          <label className="inline-block">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-vctm-navy-800 text-white hover:bg-vctm-navy-900 font-semibold text-xs shadow-sm">
              <Upload className="w-3.5 h-3.5" />
              Choose File (.csv)
            </span>
          </label>
        </div>
      </Card>

      {/* Validation Results & Preview Table */}
      {validationResult && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Summary Pills */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
              Total Rows in File: <strong>{validationResult.totalParsed}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Valid & Ready: <strong>{validationResult.validRows.length}</strong></span>
            </div>
            {validationResult.invalidRows.length > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Errors / Skipped: <strong>{validationResult.invalidRows.length}</strong></span>
              </div>
            )}
          </div>

          {/* Errors List if any */}
          {validationResult.invalidRows.length > 0 && (
            <Card title="Validation Errors Detected" noPadding>
              <div className="p-4 bg-rose-50/40 text-xs divide-y divide-rose-100 max-h-48 overflow-y-auto">
                {validationResult.invalidRows.map((inv, i) => (
                  <div key={i} className="py-2 flex items-start gap-2">
                    <span className="font-bold text-rose-700 shrink-0">Row {inv.rowNumber}:</span>
                    <div className="text-slate-700">
                      <span>{inv.errors.join(', ')}</span>
                      <span className="text-slate-400 block text-[10px] mt-0.5">
                        Raw data: {JSON.stringify(inv.raw)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Valid Rows Preview */}
          {validationResult.validRows.length > 0 && (
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <span>Import Preview ({validationResult.validRows.length} Valid Records)</span>
                  <Button
                    variant="success"
                    size="sm"
                    isLoading={isImporting}
                    leftIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={handleExecuteImport}
                  >
                    Confirm & Insert {validationResult.validRows.length} Students
                  </Button>
                </div>
              }
              noPadding
            >
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase sticky top-0">
                      <th className="px-4 py-2.5">Roll Number</th>
                      <th className="px-4 py-2.5">Student Name</th>
                      <th className="px-4 py-2.5">Admission</th>
                      <th className="px-4 py-2.5">Section</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {validationResult.validRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono font-bold text-vctm-navy-900">{r.roll_number}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{r.full_name}</td>
                        <td className="px-4 py-2.5">{r.admission_type}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-700">Section {sections.find(s => s.id === r.section_id)?.name}</td>
                        <td className="px-4 py-2.5 text-emerald-600 font-semibold">Valid</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
