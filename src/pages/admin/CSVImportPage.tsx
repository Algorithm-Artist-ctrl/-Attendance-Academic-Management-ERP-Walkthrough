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
        yearId: years[1]?.id || 'year-2nd',
        semesterId: semesters[0]?.id || 'sem-3rd',
        defaultSectionId: sections[0]?.id || 'sec-btech-cse-2-a',
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
      for (const studentData of validationResult.validRows) {
        addStudent({
          ...studentData,
          active: true,
        });
        importedCount++;
      }

      setImportSuccess(`Successfully registered ${importedCount} student accounts into the ERP!`);
      setCsvContent(null);
      setFileName(null);
      setValidationResult(null);
      await refreshData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadSampleCSV = () => {
    const sample = [
      {
        roll_number: '2503400100091',
        full_name: 'ROHIT SHARMA',
        section_name: 'A',
        admission_type: 'Regular',
        mentor_name: 'Hemlata',
        email: 'rohit@student.vctm.in',
        phone: '9876543210',
      },
      {
        roll_number: '2503400100092',
        full_name: 'SNEHA VERMA',
        section_name: 'B',
        admission_type: 'Regular',
        mentor_name: 'Imran',
        email: 'sneha@student.vctm.in',
        phone: '9876543211',
      },
    ];
    exportToCSV(sample, 'VCTM_Student_Import_Template');
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

      {importSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
          <span>{importSuccess}</span>
        </div>
      )}

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
