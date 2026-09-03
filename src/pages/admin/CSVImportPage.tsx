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
import { clsx } from 'clsx';

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
    updateStudent,
    refreshData 
  } = useAcademic();

  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedCohortYearId, setSelectedCohortYearId] = useState<string>(years[0]?.id || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; updated: number; correctionNeeded: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportSummary(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      validateCSV(text, selectedCohortYearId);
    };
    reader.readAsText(file);
  };

  const validateCSV = async (text: string, cohortYearId?: string) => {
    setIsValidating(true);
    const activeYearId = cohortYearId || selectedCohortYearId || years[0]?.id;
    const activeSemester = semesters.find(s => s.academic_year_id === activeYearId) || semesters[0];
    const activeSession = sessions.find(s => s.is_current) || sessions[0];

    try {
      const result = await parseAndValidateStudentCSV(text, {
        institutionId: institution.id,
        departmentId: departments[0]?.id || 'fe5bc365-7a68-4290-b05e-acfa274f748a',
        programId: programs[0]?.id || 'c71b3983-9ff8-43e1-a9a0-b778676bf186',
        sessionId: activeSession?.id || 'a358fe68-d746-4242-9f36-2c715cd9526e',
        yearId: activeYearId,
        semesterId: activeSemester?.id,
        defaultSectionId: sections[0]?.id,
        years,
        semesters,
        sections,
        faculty,
        existingStudents: students,
      });
      setValidationResult(result);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;

    setIsImporting(true);
    try {
      let importedCount = 0;
      let updatedCount = 0;

      for (const studentData of validationResult.validRows) {
        if (studentData.isUpdate && studentData.existingStudentId) {
          await updateStudent(studentData.existingStudentId, {
            full_name: studentData.full_name,
            admission_type: studentData.admission_type,
            section_id: studentData.section_id,
            academic_year_id: studentData.academic_year_id,
            semester_id: studentData.semester_id,
            email: studentData.email,
            phone: studentData.phone,
            mentor_faculty_id: studentData.mentor_faculty_id,
          });
          updatedCount++;
        } else {
          await addStudent({
            ...studentData,
            active: true,
          });
          importedCount++;
        }
      }

      setImportSummary({
        imported: importedCount,
        updated: updatedCount,
        correctionNeeded: validationResult.invalidRows.length,
      });

      setCsvContent(null);
      setFileName(null);
      setValidationResult(null);
      await refreshData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to import student rows');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadSampleCSV = () => {
    const sample = [
      {
        roll_no: '24001',
        name: 'Rahul Sharma',
        email: 'rahul@college.edu',
        year: '1',
        section: 'A',
        admission_type: 'Regular',
        mentor_name: 'Hemlata',
      },
      {
        roll_no: '24002',
        name: 'Aman Verma',
        email: 'aman@college.edu',
        year: '1',
        section: 'A',
        admission_type: 'Regular',
        mentor_name: 'Hemlata',
      },
      {
        roll_no: '24003',
        name: 'Neha Gupta',
        email: 'neha@college.edu',
        year: '1',
        section: 'B',
        admission_type: 'Regular',
        mentor_name: 'Wasim',
      },
      {
        roll_no: '25001',
        name: 'Ravi Kumar',
        email: 'ravi@college.edu',
        year: '2',
        section: 'A',
        admission_type: 'Regular',
        mentor_name: 'Hemlata',
      },
    ];
    exportToCSV(sample, 'VCTM_MultiYear_Student_Import_Template');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-[#00ff88]" />
            Bulk CSV Student Onboarding
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Import batches of students with deduplication and mentor assignment
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadSampleCSV}
          leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
        >
          Download CSV Template
        </Button>
      </div>

      {importSummary && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold space-y-1.5 animate-in zoom-in-95">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
            <span className="text-sm">✓ {importSummary.imported} students imported</span>
          </div>
          {importSummary.updated > 0 && (
            <div className="flex items-center gap-2 text-[#00ff88] pl-7">
              <span>✓ {importSummary.updated} students updated</span>
            </div>
          )}
          {importSummary.correctionNeeded > 0 && (
            <div className="flex items-center gap-2 text-amber-300 pl-7">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>⚠ {importSummary.correctionNeeded} rows need correction</span>
            </div>
          )}
        </div>
      )}

      {/* Cohort Selector Banner */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-950/60 px-4 py-3 rounded-2xl border border-emerald-500/20 text-xs">
        <span className="font-bold text-slate-300">Default Cohort (if row year omitted):</span>
        <select
          value={selectedCohortYearId}
          onChange={(e) => {
            setSelectedCohortYearId(e.target.value);
            if (csvContent) validateCSV(csvContent, e.target.value);
          }}
          className="px-3 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-[#00ff88] font-bold focus:outline-none focus:border-[#00ff88] cursor-pointer"
        >
          {years.map(y => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>
        <span className="text-slate-400 text-[11px]">(If CSV specifies a "year" column like 1, 2, 3, 4, row values take precedence)</span>
      </div>

      {/* Upload Box */}
      <div className="glass-panel rounded-3xl p-8 border border-emerald-500/20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-center text-[#00ff88] mx-auto shadow-[0_0_20px_rgba(0,255,136,0.2)]">
          <Upload className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">
            Upload Student CSV File
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Drag and drop your spreadsheet or click below. Supports roll numbers, sections, admission types, and mentor mapping.
          </p>
        </div>

        <div className="pt-2">
          <label className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#00ff88] hover:bg-[#10b981] text-slate-950 font-black text-xs cursor-pointer shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all">
            <Upload className="w-4 h-4 mr-2" />
            <span>Select .CSV File</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {fileName && (
          <p className="text-xs text-emerald-400 font-mono font-semibold">
            Loaded: {fileName}
          </p>
        )}
      </div>

      {/* Validation Results */}
      {validationResult && (
        <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Validation & Pre-Flight Checks
              </h3>
              <p className="text-xs text-slate-400">
                Found {validationResult.totalParsed} records: {validationResult.validRows.length} valid, {validationResult.invalidRows.length} issues
              </p>
            </div>

            <Button
              variant="neon"
              size="md"
              disabled={validationResult.validRows.length === 0}
              isLoading={isImporting}
              onClick={handleExecuteImport}
              rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
            >
              Commit {validationResult.validRows.length} Students to Database
            </Button>
          </div>

          {/* Valid Records Preview */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Valid Students for Import ({validationResult.validRows.length})
            </h4>
            <div className="max-h-60 overflow-y-auto border border-emerald-500/15 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/90 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                  <tr>
                    <th className="px-4 py-2.5">Roll Number</th>
                    <th className="px-4 py-2.5">Full Name</th>
                    <th className="px-4 py-2.5">Admission Type</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-500/10">
                  {validationResult.validRows.map((s, idx) => (
                    <tr key={idx} className="hover:bg-emerald-500/5">
                      <td className="px-4 py-2.5 font-mono font-bold text-emerald-400">{s.roll_number}</td>
                      <td className="px-4 py-2.5 font-bold text-white">{s.full_name}</td>
                      <td className="px-4 py-2.5 text-slate-300">{s.admission_type}</td>
                      <td className="px-4 py-2.5 text-emerald-400 font-semibold">Ready to Import</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error / Duplicates Preview if any */}
          {validationResult.invalidRows.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-emerald-500/15">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Rows with Validation Errors ({validationResult.invalidRows.length})</span>
              </h4>
              <div className="space-y-2">
                {validationResult.invalidRows.map((err, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                    <span>Row {err.rowNumber}: {err.errors.join(', ')}</span>
                    <span className="font-mono text-slate-400 text-[11px]">{err.raw?.roll_number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
