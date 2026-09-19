import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Trash2, 
  ArrowRight,
  Sparkles,
  Link,
  ShieldCheck,
  Building2,
  Users,
  RefreshCw,
  AlertTriangle,
  X,
  Plus
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { studentSyncService, StudentCSVValidationReport, StudentSyncResult } from '../../lib/services/studentSyncService';
import { fetchCSVContent } from '../../lib/utils/urlUtils';
import { exportToCSV } from '../../lib/utils/exportUtils';
import { clsx } from 'clsx';

export const CSVImportPage: React.FC = () => {
  const { user, role } = useAuth();
  const { 
    departments, 
    years, 
    refreshData 
  } = useAcademic();

  const isSuperAdmin = role === 'super_admin';
  const isHOD = role === 'hod';
  const userDept = departments.find(d => d.id === user?.department_id);

  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedCohortYearId, setSelectedCohortYearId] = useState<string>(years[0]?.id || '');
  
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<StudentCSVValidationReport | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<StudentSyncResult | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);
    setValidationError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      await runValidation(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUrlFetchAndValidate = async () => {
    if (!googleSheetUrl.trim()) {
      setValidationError('Please enter a valid Google Sheet CSV URL.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setImportResult(null);

    try {
      const text = await fetchCSVContent(googleSheetUrl);
      setCsvContent(text);
      setFileName('Google Sheet (CSV)');
      await runValidation(text);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to fetch Google Sheet content. Ensure it is accessible.');
      setValidationReport(null);
    } finally {
      setIsValidating(false);
    }
  };

  const runValidation = async (text: string) => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const selectedYearObj = years.find(y => y.id === selectedCohortYearId);
      const report = await studentSyncService.validateStudentsCSV(text, {
        defaultCohortYear: selectedYearObj?.year_number,
        userRole: role || undefined,
        userDepartmentId: isHOD ? user?.department_id : undefined,
      });
      setValidationReport(report);
    } catch (err: any) {
      setValidationError(err.message || 'Validation failed.');
      setValidationReport(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async (createMissingSections: boolean = false) => {
    if (!csvContent || !validationReport) return;
    if (!createMissingSections && validationReport.validCount === 0) return;

    setIsImporting(true);
    setValidationError(null);

    try {
      const selectedYearObj = years.find(y => y.id === selectedCohortYearId);
      const res = await studentSyncService.syncStudents(
        { csvContent },
        {
          performedBy: user?.full_name || (isSuperAdmin ? 'Tarun Kushwah (Super Admin)' : 'HOD'),
          defaultCohortYear: selectedYearObj?.year_number,
          userRole: role || undefined,
          userDepartmentId: isHOD ? user?.department_id : undefined,
          createMissingSections,
        }
      );

      setImportResult(res);
      setValidationReport(null);
      setCsvContent(null);
      setFileName(null);
      await refreshData(true);
    } catch (err: any) {
      setValidationError(err.message || 'Import execution failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadSampleCSV = () => {
    const sample = [
      {
        roll_no: '24001',
        name: 'Rahul Sharma',
        email: 'rahul@student.vctm.in',
        phone: '9876543210',
        department: isHOD && userDept ? userDept.code : 'CSE',
        year: '2',
        section: 'A',
        admission_type: 'Regular',
      },
      {
        roll_no: '24002',
        name: 'Aman Verma',
        email: 'aman@student.vctm.in',
        phone: '9876543211',
        department: isHOD && userDept ? userDept.code : 'CSE',
        year: '2',
        section: 'A',
        admission_type: 'Regular',
      },
      {
        roll_no: '24003',
        name: 'Neha Gupta',
        email: 'neha@student.vctm.in',
        phone: '9876543212',
        department: isHOD && userDept ? userDept.code : 'CSE',
        year: '3',
        section: 'B',
        admission_type: 'Regular',
      },
      {
        roll_no: '25001',
        name: 'Ravi Kumar',
        email: 'ravi@student.vctm.in',
        phone: '9876543213',
        department: isHOD && userDept ? userDept.code : 'CSE',
        year: '3',
        section: 'A',
        admission_type: 'Lateral Entry',
      },
    ];
    exportToCSV(sample, `VCTM_Student_Onboarding_Template_${isHOD && userDept ? userDept.code : 'College'}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-serif-institutional text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-slate-800" />
            Student Bulk Onboarding & CSV Import
            {isHOD && (
              <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                {userDept?.code || 'Department'} Scope
              </span>
            )}
            {isSuperAdmin && (
              <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                Institution-Wide Scope
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isHOD
              ? `Onboard and update students strictly for ${userDept?.name || 'your department'} via CSV upload or Google Sheets.`
              : 'Enterprise multi-year student directory synchronization with automatic profile generation, deduplication and role assignment.'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadSampleCSV}
          leftIcon={<Download className="w-4 h-4 text-slate-600" />}
          className="font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
        >
          Download Template
        </Button>
      </div>

      {/* Scope Notice Banner */}
      {isHOD && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs flex items-center gap-3 text-xs">
          <Building2 className="w-5 h-5 text-slate-700 shrink-0" />
          <div>
            <span className="font-bold text-slate-900">Department Boundary Enforced: </span>
            <span className="text-slate-600">
              You are logged in as Head of Department for <strong className="text-slate-900">{userDept?.name} ({userDept?.code})</strong>. Any CSV rows for other departments will be flagged and rejected to preserve departmental integrity.
            </span>
          </div>
        </div>
      )}

      {/* Import Execution Result Toast */}
      {importResult && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-bold space-y-1.5 shadow-xs animate-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              <span className="text-sm">✓ Student Onboarding Completed Successfully</span>
            </div>
            <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-slate-200 font-mono">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-slate-400 block text-[10px]">TOTAL ROWS</span>
              <strong className="text-sm text-slate-900 font-serif-institutional">{importResult.totalRows}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-emerald-400 block text-[10px]">NEW ADDED</span>
              <strong className="text-sm text-emerald-700 font-serif-institutional">{importResult.added}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-blue-400 block text-[10px]">UPDATED</span>
              <strong className="text-sm text-slate-900 font-serif-institutional">{importResult.updated}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-slate-400 block text-[10px]">UNCHANGED</span>
              <strong className="text-sm text-slate-700 font-serif-institutional">{importResult.unchanged}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {validationError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1.5 shadow-xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Import Issue Detected</span>
            </div>
            <button onClick={() => setValidationError(null)} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="font-mono text-[11px] whitespace-pre-wrap pl-6">{validationError}</p>
        </div>
      )}

      {/* Source Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <button
          onClick={() => { setImportMode('file'); setValidationReport(null); }}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
            importMode === 'file'
              ? "bg-[#0f172a] text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Upload className="w-4 h-4" />
          CSV File Upload
        </button>
        <button
          onClick={() => { setImportMode('url'); setValidationReport(null); }}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
            importMode === 'url'
              ? "bg-[#0f172a] text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Link className="w-4 h-4" />
          Google Sheet CSV URL
        </button>
      </div>

      {/* Default Cohort Config */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80 text-xs shadow-xs">
        <span className="font-semibold text-slate-700">Default Cohort Year:</span>
        <select
          value={selectedCohortYearId}
          onChange={(e) => {
            setSelectedCohortYearId(e.target.value);
            if (csvContent) runValidation(csvContent);
          }}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 cursor-pointer shadow-xs"
        >
          {years.map(y => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>
        <span className="text-slate-500 text-[11px]">(Used only when a CSV row does not specify an academic year)</span>
      </div>

      {/* File Upload Mode */}
      {importMode === 'file' && (
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mx-auto shadow-xs">
            <Upload className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold font-serif-institutional text-slate-900">
              Upload Student CSV Spreadsheet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Select or drop your student CSV file. Headers supported: roll_no, name, email, phone, year, section, admission_type.
            </p>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#0f172a] hover:bg-black text-white font-semibold text-xs cursor-pointer shadow-xs transition-all">
              <Upload className="w-4 h-4 mr-2" />
              <span>Select CSV File</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {fileName && (
            <p className="text-xs text-slate-700 font-mono font-semibold">
              Selected: {fileName}
            </p>
          )}
        </div>
      )}

      {/* Google Sheet URL Mode */}
      {importMode === 'url' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 shadow-xs">
              <Link className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-institutional text-slate-900">Google Sheet CSV Sync</h3>
              <p className="text-xs text-slate-400">
                Paste any Google Sheet link. Automatically normalized and fetched through secure college proxy.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <input
              type="url"
              value={googleSheetUrl}
              onChange={(e) => setGoogleSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit or /export?format=csv"
              className="flex-1 w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 font-mono shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleUrlFetchAndValidate}
              isLoading={isValidating}
              leftIcon={<RefreshCw className="w-4 h-4 text-white" />}
              className="w-full sm:w-auto font-black shrink-0"
            >
              Fetch & Validate
            </Button>
          </div>
        </div>
      )}

      {/* Pre-Import Summary Card & Row Preview */}
      {validationReport && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in">
          {/* New Sections Detected Banner */}
          {validationReport.detectedNewSections && validationReport.detectedNewSections.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">
                    New Class Section(s) Detected in CSV ({validationReport.detectedNewSections.length})
                  </h4>
                  <p className="text-slate-300 mt-0.5">
                    The following sections are referenced by incoming students but do not yet exist in the database:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {validationReport.detectedNewSections.map(sec => (
                      <span key={`${sec.semesterId}_${sec.sectionName}`} className="px-3 py-1 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-mono font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Section {sec.sectionName} ({sec.semesterName} • {sec.studentCount} students)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isImporting}
                  isLoading={isImporting}
                  onClick={() => handleExecuteImport(true)}
                  leftIcon={<Plus className="w-4 h-4 text-white" />}
                  className="font-black"
                >
                  Create Detected Section(s) & Import All Students
                </Button>
              </div>
            </div>
          )}

          {/* Summary Metrics */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold font-serif-institutional text-slate-900 tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                Pre-Flight Validation Summary
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review verified records before committing changes to the live college database.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={!validationReport.canImport || isImporting}
              isLoading={isImporting}
              onClick={() => handleExecuteImport(false)}
              rightIcon={<ArrowRight className="w-4 h-4 text-white" />}
              className="font-black"
            >
              Commit {validationReport.validCount} Students to Database
            </Button>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
              <span className="text-slate-400 block text-[10px] font-bold">TOTAL ROWS</span>
              <strong className="text-lg text-slate-900 font-mono font-bold font-serif-institutional">{validationReport.totalRows}</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs">
              <span className="text-emerald-800 block text-[10px] font-bold">VALID & READY</span>
              <strong className="text-lg text-emerald-900 font-mono font-bold font-serif-institutional">{validationReport.validCount}</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
              <span className="text-slate-600 block text-[10px] font-bold">NEW STUDENTS</span>
              <strong className="text-lg text-slate-900 font-mono font-bold font-serif-institutional">{validationReport.newCount}</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs">
              <span className="text-amber-800 block text-[10px] font-bold">EXISTING UPDATES</span>
              <strong className="text-lg text-amber-900 font-mono font-bold font-serif-institutional">{validationReport.updateCount}</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 shadow-xs">
              <span className="text-rose-800 block text-[10px] font-bold">REJECTED / ERRORS</span>
              <strong className="text-lg text-rose-900 font-mono font-bold font-serif-institutional">{validationReport.invalidCount}</strong>
            </div>
          </div>

          {/* Row Preview Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Student Records Preview ({validationReport.previewRows.length} rows)
            </h4>
            <div className="max-h-72 overflow-y-auto border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px] sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2">Row</th>
                    <th className="px-3.5 py-2">Roll No</th>
                    <th className="px-3.5 py-2">Full Name</th>
                    <th className="px-3.5 py-2">Dept</th>
                    <th className="px-3.5 py-2">Year / Section</th>
                    <th className="px-3.5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {validationReport.previewRows.map((row) => (
                    <tr key={row.rowNumber} className={clsx("hover:bg-slate-50/80 transition-colors", !row.isValid && "bg-rose-50/50")}>
                      <td className="px-3.5 py-2 font-mono text-slate-500">{row.rowNumber}</td>
                      <td className="px-3.5 py-2 font-mono font-bold text-slate-900">{row.rollNumber || '—'}</td>
                      <td className="px-3.5 py-2 font-semibold text-slate-900">{row.fullName || '—'}</td>
                      <td className="px-3.5 py-2 font-mono">{row.departmentCode}</td>
                      <td className="px-3.5 py-2">{row.academicYear} • Sec {row.sectionName}</td>
                      <td className="px-3.5 py-2">
                        {row.isValid ? (
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            row.isExisting 
                              ? "bg-amber-50 text-amber-800 border-amber-200" 
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          )}>
                            {row.isExisting ? 'Update' : 'New'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200" title={row.errors.join('; ')}>
                            Error: {row.errors[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

