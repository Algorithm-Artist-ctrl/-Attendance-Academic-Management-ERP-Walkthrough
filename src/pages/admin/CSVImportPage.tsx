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
  X
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

  const handleExecuteImport = async () => {
    if (!csvContent || !validationReport || validationReport.validCount === 0) return;

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
        year: '1',
        section: 'A',
        admission_type: 'Regular',
      },
      {
        roll_no: '24002',
        name: 'Aman Verma',
        email: 'aman@student.vctm.in',
        phone: '9876543211',
        department: isHOD && userDept ? userDept.code : 'CSE',
        year: '1',
        section: 'A',
        admission_type: 'Regular',
      },
      {
        roll_no: '24003',
        name: 'Neha Gupta',
        email: 'neha@student.vctm.in',
        phone: '9876543212',
        department: isHOD && userDept ? userDept.code : 'CSE',
        year: '1',
        section: 'B',
        admission_type: 'Regular',
      },
      {
        roll_no: '25001',
        name: 'Ravi Kumar',
        email: 'ravi@student.vctm.in',
        phone: '9876543213',
        department: isHOD && userDept ? userDept.code : 'CSE',
        year: '2',
        section: 'A',
        admission_type: 'Lateral Entry',
      },
    ];
    exportToCSV(sample, `VCTM_Student_Onboarding_Template_${isHOD && userDept ? userDept.code : 'College'}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-[#00ff88]" />
            Student Bulk Onboarding & CSV Import
            {isHOD && (
              <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30 font-bold">
                {userDept?.code || 'Department'} Scope
              </span>
            )}
            {isSuperAdmin && (
              <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
                Institution-Wide Scope
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {isHOD
              ? `Onboard and update students strictly for ${userDept?.name || 'your department'} via CSV upload or Google Sheets.`
              : 'Enterprise multi-year student directory synchronization with automatic profile generation, deduplication and role assignment.'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadSampleCSV}
          leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
          className="font-bold border-emerald-500/30 text-white"
        >
          Download Template
        </Button>
      </div>

      {/* Scope Notice Banner */}
      {isHOD && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/25 flex items-center gap-3 text-xs">
          <Building2 className="w-5 h-5 text-[#00ff88] shrink-0" />
          <div>
            <span className="font-bold text-white">Department Boundary Enforced: </span>
            <span className="text-slate-300">
              You are logged in as Head of Department for <strong className="text-[#00ff88]">{userDept?.name} ({userDept?.code})</strong>. Any CSV rows for other departments will be flagged and rejected to preserve departmental integrity.
            </span>
          </div>
        </div>
      )}

      {/* Import Execution Result Toast */}
      {importResult && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold space-y-1.5 animate-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
              <span className="text-sm">✓ Student Onboarding Completed Successfully</span>
            </div>
            <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-slate-200 font-mono">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-emerald-500/20">
              <span className="text-slate-400 block text-[10px]">TOTAL ROWS</span>
              <strong className="text-sm text-white">{importResult.totalRows}</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-emerald-500/20">
              <span className="text-emerald-400 block text-[10px]">NEW ADDED</span>
              <strong className="text-sm text-[#00ff88]">{importResult.added}</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-emerald-500/20">
              <span className="text-blue-400 block text-[10px]">UPDATED</span>
              <strong className="text-sm text-blue-300">{importResult.updated}</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-emerald-500/20">
              <span className="text-slate-400 block text-[10px]">UNCHANGED</span>
              <strong className="text-sm text-slate-300">{importResult.unchanged}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {validationError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs space-y-1.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-200">
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
      <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2">
        <button
          onClick={() => { setImportMode('file'); setValidationReport(null); }}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
            importMode === 'file'
              ? "bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.25)]"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
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
              ? "bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.25)]"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          )}
        >
          <Link className="w-4 h-4" />
          Google Sheet CSV URL
        </button>
      </div>

      {/* Default Cohort Config */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-950/60 px-4 py-3 rounded-2xl border border-emerald-500/20 text-xs">
        <span className="font-bold text-slate-300">Default Cohort Year:</span>
        <select
          value={selectedCohortYearId}
          onChange={(e) => {
            setSelectedCohortYearId(e.target.value);
            if (csvContent) runValidation(csvContent);
          }}
          className="px-3 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-[#00ff88] font-bold focus:outline-none focus:border-[#00ff88] cursor-pointer"
        >
          {years.map(y => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>
        <span className="text-slate-400 text-[11px]">(Used only when a CSV row does not specify an academic year)</span>
      </div>

      {/* File Upload Mode */}
      {importMode === 'file' && (
        <div className="glass-panel rounded-3xl p-8 border border-emerald-500/20 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-center text-[#00ff88] mx-auto shadow-[0_0_20px_rgba(0,255,136,0.2)]">
            <Upload className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              Upload Student CSV Spreadsheet
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Select or drop your student CSV file. Headers supported: roll_no, name, email, phone, year, section, admission_type.
            </p>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#00ff88] hover:bg-[#10b981] text-slate-950 font-black text-xs cursor-pointer shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all">
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
            <p className="text-xs text-emerald-400 font-mono font-semibold">
              Selected: {fileName}
            </p>
          )}
        </div>
      )}

      {/* Google Sheet URL Mode */}
      {importMode === 'url' && (
        <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
              <Link className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Google Sheet CSV Sync</h3>
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
              className="flex-1 w-full px-4 py-2.5 bg-slate-950/90 border border-emerald-500/30 rounded-2xl text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-[#00ff88]"
            />
            <Button
              variant="neon"
              size="sm"
              onClick={handleUrlFetchAndValidate}
              isLoading={isValidating}
              leftIcon={<RefreshCw className="w-4 h-4 text-slate-950" />}
              className="w-full sm:w-auto font-black shrink-0"
            >
              Fetch & Validate
            </Button>
          </div>
        </div>
      )}

      {/* Pre-Import Summary Card & Row Preview */}
      {validationReport && (
        <div className="glass-panel rounded-3xl p-6 border border-emerald-500/25 space-y-6 animate-in fade-in">
          {/* Summary Metrics */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-500/15">
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
                Pre-Flight Validation Summary
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review verified records before committing changes to the live college database.
              </p>
            </div>

            <Button
              variant="neon"
              size="md"
              disabled={!validationReport.canImport || isImporting}
              isLoading={isImporting}
              onClick={handleExecuteImport}
              rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
              className="font-black shadow-[0_0_20px_rgba(0,255,136,0.35)]"
            >
              Commit {validationReport.validCount} Students to Database
            </Button>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/20">
              <span className="text-slate-400 block text-[10px] font-bold">TOTAL ROWS</span>
              <strong className="text-lg text-white font-mono">{validationReport.totalRows}</strong>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-emerald-400 block text-[10px] font-bold">VALID & READY</span>
              <strong className="text-lg text-[#00ff88] font-mono">{validationReport.validCount}</strong>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30">
              <span className="text-blue-400 block text-[10px] font-bold">NEW STUDENTS</span>
              <strong className="text-lg text-blue-300 font-mono">{validationReport.newCount}</strong>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <span className="text-amber-400 block text-[10px] font-bold">EXISTING UPDATES</span>
              <strong className="text-lg text-amber-300 font-mono">{validationReport.updateCount}</strong>
            </div>
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30">
              <span className="text-rose-400 block text-[10px] font-bold">REJECTED / ERRORS</span>
              <strong className="text-lg text-rose-300 font-mono">{validationReport.invalidCount}</strong>
            </div>
          </div>

          {/* Row Preview Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Student Records Preview ({validationReport.previewRows.length} rows)
            </h4>
            <div className="max-h-72 overflow-y-auto border border-emerald-500/15 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/90 text-slate-400 font-bold uppercase tracking-wider border-b border-emerald-500/15 sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2">Row</th>
                    <th className="px-3.5 py-2">Roll No</th>
                    <th className="px-3.5 py-2">Full Name</th>
                    <th className="px-3.5 py-2">Dept</th>
                    <th className="px-3.5 py-2">Year / Section</th>
                    <th className="px-3.5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-500/10 text-slate-300">
                  {validationReport.previewRows.map((row) => (
                    <tr key={row.rowNumber} className={clsx("hover:bg-emerald-500/5", !row.isValid && "bg-rose-500/5")}>
                      <td className="px-3.5 py-2 font-mono text-slate-500">{row.rowNumber}</td>
                      <td className="px-3.5 py-2 font-mono font-bold text-white">{row.rollNumber || '—'}</td>
                      <td className="px-3.5 py-2 font-semibold text-slate-200">{row.fullName || '—'}</td>
                      <td className="px-3.5 py-2 font-mono">{row.departmentCode}</td>
                      <td className="px-3.5 py-2">{row.academicYear} • Sec {row.sectionName}</td>
                      <td className="px-3.5 py-2">
                        {row.isValid ? (
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            row.isExisting 
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30" 
                              : "bg-emerald-500/15 text-[#00ff88] border-emerald-500/30"
                          )}>
                            {row.isExisting ? 'Update' : 'New'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30" title={row.errors.join('; ')}>
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

