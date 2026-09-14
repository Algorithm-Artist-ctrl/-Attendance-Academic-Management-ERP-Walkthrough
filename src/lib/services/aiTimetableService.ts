import { GoogleGenAI } from '@google/genai';
import { ExtractedTimetableDocument, ExtractedTimetableDay, UploadTargetContext } from '../../types/academic.types';
import { DayOfWeek } from '../../types/database.types';

export async function fileToBase64(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const TIMETABLE_VISION_PROMPT = `Extract the uploaded college timetable into the requested JSON schema. Never invent or substitute institution-specific values. Read values from the document where present. The selected upload context is authoritative for target IDs and scope metadata. Extract every visible timetable cell, including lunch/break/activity cells. Preserve exact start/end times from the document. Do not replace missing times with made-up defaults. For merged labs spanning multiple periods, emit one entry per actual period. For blank cells, emit no entry. Break/activity entries may have empty subject or faculty values. Return ONLY valid JSON with institution_name, program_name, branch_name, academic_year, semester, section_name, effective_from, room_number, class_incharges, subject_mappings, faculty_mappings, schedule, overall_confidence, confidence_breakdown, and warnings. Schedule days must use MON,TUE,WED,THU,FRI,SAT and each period must contain period_number,start_time,end_time,subject_code,subject_name,faculty_code,faculty_name,room_number,lecture_type,is_break,confidence.`;

export class AITimetableService {
  private static instance: AITimetableService;
  private customApiKey: string | null = null;

  private constructor() {
    this.customApiKey = typeof window !== 'undefined' ? localStorage.getItem('vctm_gemini_api_key') : null;
  }

  public static getInstance(): AITimetableService {
    if (!this.instance) this.instance = new AITimetableService();
    return this.instance;
  }

  public setApiKey(key: string | null) {
    this.customApiKey = key?.trim() || null;
    if (typeof window !== 'undefined') {
      if (this.customApiKey) localStorage.setItem('vctm_gemini_api_key', this.customApiKey);
      else localStorage.removeItem('vctm_gemini_api_key');
    }
  }

  public getApiKey(): string | null {
    return this.customApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || null;
  }

  public async extractTimetableImage(file: File | Blob, fileName: string, onProgress?: (message: string) => void, uploadContext?: UploadTargetContext): Promise<ExtractedTimetableDocument> {
    if (!(file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf'))) {
      throw new Error('Only PDF timetable files are supported.');
    }
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('PDF extraction is not configured. Provide the Gemini API key through the supported configuration.');

    onProgress?.('Reading PDF...');
    const data = await fileToBase64(file);
    onProgress?.('Extracting timetable from PDF...');

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data } }, { text: TIMETABLE_VISION_PROMPT }] }],
      config: { responseMimeType: 'application/json', temperature: 0 }
    });

    const raw = (response.text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    if (!raw) throw new Error('No timetable data was returned from the PDF.');
    let parsed: Partial<ExtractedTimetableDocument>;
    try { parsed = JSON.parse(raw); } catch { throw new Error('The PDF parser returned invalid timetable data.'); }
    return this.normalizeAndValidateExtractedDocument({ ...parsed, source_file_name: fileName, raw_text: raw }, uploadContext);
  }

  public async extractMultipleTimetables(files: File[], onProgress?: (overallPercent: number, currentFileName: string, message: string) => void, uploadContext?: UploadTargetContext): Promise<ExtractedTimetableDocument[]> {
    if (!files.length) throw new Error('Select at least one PDF timetable file.');
    const results: ExtractedTimetableDocument[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await this.extractTimetableImage(file, file.name, message => onProgress?.(Math.round((i / files.length) * 100), file.name, message), uploadContext);
      results.push(result);
      onProgress?.(Math.round(((i + 1) / files.length) * 100), file.name, 'PDF extracted successfully.');
    }
    return results;
  }

  private normalizeAndValidateExtractedDocument(doc: Partial<ExtractedTimetableDocument>, context?: UploadTargetContext): ExtractedTimetableDocument {
    const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const schedule: ExtractedTimetableDay[] = days.map(day => {
      const source = (doc.schedule || []).find(item => String(item.day || '').toUpperCase().startsWith(day));
      return { day, periods: (source?.periods || []).map((period, index) => ({
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
        is_break: Boolean(period.is_break || String(period.lecture_type || '').toLowerCase() === 'break'),
        confidence: typeof period.confidence === 'number' ? period.confidence : 0,
      })) };
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

    if (!normalized.target_section_id) throw new Error('Target section is missing. Select the section from the live academic structure.');
    if (!normalized.effective_from) throw new Error('Effective date is missing.');
    if (!normalized.schedule.some(day => day.periods.length > 0)) throw new Error('No timetable periods were extracted from the PDF.');
    return normalized;
  }
}

export const aiTimetableService = AITimetableService.getInstance();
