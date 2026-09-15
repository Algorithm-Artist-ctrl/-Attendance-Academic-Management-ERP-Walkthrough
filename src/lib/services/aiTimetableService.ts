import { ExtractedTimetableDocument, ExtractedTimetableDay, UploadTargetContext } from '../../types/academic.types';
import { DayOfWeek } from '../../types/database.types';

export async function fileToBase64(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export class AITimetableService {
  private static instance: AITimetableService;
  private constructor() {}
  public static getInstance(): AITimetableService {
    if (!this.instance) this.instance = new AITimetableService();
    return this.instance;
  }

  /**
   * Health check for AI Timetable gateway
   */
  public async checkHealth(): Promise<{ status: string; ai?: { configured: boolean; primaryModel: string; fallbackModel: string } }> {
    try {
      const response = await fetch('/api/timetable/health');
      if (!response.ok) return { status: 'error' };
      return await response.json();
    } catch {
      return { status: 'unavailable' };
    }
  }

  public setApiKey(_key: string | null) {
    // Kept as no-op for backward compatibility. Production uses server-side GEMINI_API_KEY.
  }

  public getApiKey(): string | null {
    // API keys are strictly server-side.
    return null;
  }

  public async extractTimetableImage(
    file: File | Blob,
    fileName: string,
    onProgress?: (message: string) => void,
    uploadContext?: UploadTargetContext
  ): Promise<ExtractedTimetableDocument> {
    if (!(file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf'))) {
      throw new Error('Only PDF timetable files are supported.');
    }

    onProgress?.('Reading PDF document...');
    const data = await fileToBase64(file);

    onProgress?.('Extracting timetable with AI gateway...');
    let response: Response;
    try {
      response = await fetch('/api/timetable/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ data }),
      });
    } catch (networkErr: any) {
      throw new Error('Could not connect to ERP AI extraction service. Please check your network connection or use CSV import.');
    }

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      let rawMsg = body?.error || body?.message || '';
      if (typeof rawMsg !== 'string') rawMsg = JSON.stringify(rawMsg);
      const lower = rawMsg.toLowerCase();

      let userMessage = 'AI timetable extraction is temporarily unavailable. Your existing timetable has not been changed. Please retry or use CSV import.';
      if (
        response.status === 503 ||
        lower.includes('503') ||
        lower.includes('unavailable') ||
        lower.includes('high demand') ||
        lower.includes('spikes in demand') ||
        lower.includes('ai_provider_unavailable') ||
        rawMsg.includes('{"error"')
      ) {
        userMessage = 'AI extraction is temporarily unavailable due to high AI model demand. Your existing timetable has not been changed. Please retry or use CSV import.';
      } else if (response.status === 429 || lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
        userMessage = 'AI extraction rate limit reached. Your existing timetable has not been changed. Please retry in a few moments or use CSV import.';
      } else if (lower.includes('not a valid pdf') || lower.includes('invalid_pdf') || lower.includes('pdf_required')) {
        userMessage = 'Uploaded file is not a valid PDF timetable document. Please verify the file or use CSV import.';
      } else if (rawMsg && !rawMsg.includes('{') && !rawMsg.includes('}')) {
        userMessage = rawMsg;
      }
      throw new Error(userMessage);
    }

    onProgress?.('Validating extracted timetable schedule...');
    const parsed = body;
    return this.normalizeAndValidateExtractedDocument({ ...parsed, source_file_name: fileName }, uploadContext);
  }

  public async extractMultipleTimetables(
    files: File[],
    onProgress?: (overallPercent: number, currentFileName: string, message: string) => void,
    uploadContext?: UploadTargetContext
  ): Promise<ExtractedTimetableDocument[]> {
    if (!files.length) throw new Error('Select at least one PDF timetable file.');
    const results: ExtractedTimetableDocument[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      results.push(
        await this.extractTimetableImage(
          file,
          file.name,
          message => onProgress?.(Math.round((i / files.length) * 100), file.name, message),
          uploadContext
        )
      );
      onProgress?.(Math.round(((i + 1) / files.length) * 100), file.name, 'PDF extracted successfully.');
    }
    return results;
  }

  private normalizeAndValidateExtractedDocument(
    doc: Partial<ExtractedTimetableDocument>,
    context?: UploadTargetContext
  ): ExtractedTimetableDocument {
    const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const schedule: ExtractedTimetableDay[] = days.map(day => {
      const source = (doc.schedule || []).find(item => String(item.day || '').toUpperCase().startsWith(day));
      return {
        day,
        periods: (source?.periods || []).map((period, index) => ({
          ...period,
          period_number: Number(period.period_number) || index + 1,
          start_time: period.start_time || '',
          end_time: period.end_time || '',
          subject_code: period.subject_code || '',
          subject_name: period.subject_name || undefined,
          faculty_code: period.faculty_code || undefined,
          faculty_name: period.faculty_name || undefined,
          room_number: period.room_number || context?.roomNumber || undefined,
          lecture_type: period.is_break ? 'Break' : (period.lecture_type || 'Theory') as any,
          is_break: Boolean(period.is_break || String(period.lecture_type || '').toLowerCase() === 'break' || String(period.lecture_type || '').toLowerCase() === 'lunch'),
          confidence: typeof period.confidence === 'number' ? period.confidence : 0,
        })),
      };
    });

    const normalized: ExtractedTimetableDocument = {
      id: doc.id || `tt-doc-${crypto.randomUUID()}`,
      source_file_name: doc.source_file_name,
      source_file_url: doc.source_file_url,
      institution_name: doc.institution_name,
      program_name: context?.programName || doc.program_name || '',
      program_id: context?.programId,
      branch_name: context?.branchName || doc.branch_name || '',
      branch_id: context?.branchId,
      academic_year: context?.academicYearName || doc.academic_year || '',
      academic_year_id: context?.academicYearId,
      semester: context?.semesterName || doc.semester || '',
      semester_id: context?.semesterId,
      section_name: context?.sectionName || doc.section_name || '',
      target_section_id: context?.sectionId,
      academic_session_id: context?.academicSessionId,
      effective_from: context?.effectiveFrom || doc.effective_from || '',
      room_number: context?.roomNumber || doc.room_number || '',
      class_incharges: doc.class_incharges || [],
      subject_mappings: doc.subject_mappings || [],
      faculty_mappings: doc.faculty_mappings || [],
      schedule,
      overall_confidence: typeof doc.overall_confidence === 'number' ? doc.overall_confidence : 0,
      confidence_breakdown: doc.confidence_breakdown,
      warnings: doc.warnings || [],
      raw_text: doc.raw_text,
    };

    if (!normalized.target_section_id) {
      throw new Error('Target section is missing. Select the section from the live academic structure.');
    }
    if (!normalized.effective_from) {
      throw new Error('Effective date is missing.');
    }
    if (!normalized.schedule.some(day => day.periods.length > 0)) {
      throw new Error('Could not confidently extract the complete timetable. Please review the PDF or use CSV import.');
    }
    return normalized;
  }
}

export const aiTimetableService = AITimetableService.getInstance();
