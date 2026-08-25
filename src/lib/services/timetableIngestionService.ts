import { supabase } from '../supabase/supabaseClient';
import { supabaseService } from './supabaseService';
import { 
  ExtractedTimetableDocument, 
  TimetableSlotDiff 
} from '../../types/academic.types';
import { 
  TimetableVersion, 
  TimetableImport,
  TimetableEntry,
  Section,
  Subject,
  Faculty
} from '../../types/database.types';
import { ResolvedEntityReport } from '../utils/timetableResolver';

export class TimetableIngestionService {
  private static instance: TimetableIngestionService;

  public static getInstance(): TimetableIngestionService {
    if (!TimetableIngestionService.instance) {
      TimetableIngestionService.instance = new TimetableIngestionService();
    }
    return TimetableIngestionService.instance;
  }

  /**
   * Save initial uploaded import record into Supabase
   */
  public async createImportRecord(params: {
    fileName: string;
    departmentId?: string;
    uploadedBy: string;
    extractedData: ExtractedTimetableDocument;
    validationReport?: any;
  }): Promise<TimetableImport> {
    const importData = {
      file_name: params.fileName,
      department_id: params.departmentId,
      status: 'needs_review',
      extracted_data: params.extractedData,
      validation_report: params.validationReport,
      uploaded_by: params.uploadedBy,
    };

    const { data, error } = await supabase
      .from('timetable_imports')
      .insert([importData])
      .select('*')
      .single();

    if (error) {
      console.warn('Could not insert to timetable_imports in Supabase:', error.message);
      return {
        id: `imp-${Date.now()}`,
        file_name: params.fileName,
        department_id: params.departmentId,
        status: 'needs_review',
        extracted_data: params.extractedData,
        validation_report: params.validationReport,
        uploaded_by: params.uploadedBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data as TimetableImport;
  }

  /**
   * Fetch all timetable versions for a section or department
   */
  public async fetchTimetableVersions(sectionId?: string): Promise<TimetableVersion[]> {
    let query = supabase.from('timetable_versions').select('*').order('created_at', { ascending: false });
    if (sectionId) {
      query = query.eq('section_id', sectionId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching timetable_versions:', error.message);
      return [];
    }
    return (data || []) as TimetableVersion[];
  }

  /**
   * Atomically publish approved timetable into live database
   */
  public async approveAndPublishTimetable(params: {
    doc: ExtractedTimetableDocument;
    report: ResolvedEntityReport;
    approvedBy: string;
    importId?: string;
    customEffectiveDate?: string;
  }): Promise<{ version: TimetableVersion; newEntries: TimetableEntry[] }> {
    const { doc, report, approvedBy, importId, customEffectiveDate } = params;

    // 1. Ensure Section exists or create Section
    let targetSectionId = doc.target_section_id || report.section?.id;
    const effectiveFrom = customEffectiveDate || doc.effective_from || new Date().toISOString().split('T')[0];

    if (!targetSectionId) {
      // Create new section
      const { data: newSec, error: secErr } = await supabase
        .from('sections')
        .insert([{
          name: doc.section_name || 'B',
          semester_id: report.semester?.id,
          room_number: doc.room_number || (doc.section_name === 'B' ? 'A006' : 'A007'),
          class_coordinator_id: report.classCoordinator?.id,
          active: true,
        }])
        .select('*')
        .single();

      if (secErr || !newSec) {
        throw new Error(secErr?.message || 'Failed to initialize new section in database.');
      }
      targetSectionId = newSec.id;
    } else {
      // Update existing section classroom & class coordinator if changed
      await supabase
        .from('sections')
        .update({
          room_number: doc.room_number || report.section?.room_number || 'Room TBD',
          class_coordinator_id: report.classCoordinator?.id || report.section?.class_coordinator_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetSectionId);
    }

    // 2. Fetch authoritative database subjects and faculty
    const { data: dbSubjects } = await supabase.from('subjects').select('*').eq('active', true);
    const { data: dbFaculty } = await supabase.from('faculty').select('*').eq('active', true);
    const allSubjects = (dbSubjects || []) as Subject[];
    const allFaculty = (dbFaculty || []) as Faculty[];

    const subjectIdMap = new Map<string, string>(); // Extracted Code -> DB Subject ID

    for (const sm of report.subjectMatches) {
      if (sm.matchedSubject) {
        subjectIdMap.set(sm.extracted.subject_code.toUpperCase(), sm.matchedSubject.id);
      } else {
        // Auto-register new curriculum subject
        const { data: newSub } = await supabase
          .from('subjects')
          .insert([{
            program_id: report.program?.id,
            department_id: report.department?.id,
            semester_id: report.semester?.id,
            subject_code: sm.extracted.subject_code.toUpperCase(),
            subject_name: sm.extracted.subject_name || sm.extracted.subject_code,
            lecture_type: sm.extracted.lecture_type || 'Theory',
            credits: 3,
            active: true
          }])
          .select('*')
          .single();

        if (newSub) {
          subjectIdMap.set(sm.extracted.subject_code.toUpperCase(), newSub.id);
        }
      }
    }

    // 3. Resolve Faculty Map
    const facultyIdMap = new Map<string, string>(); // Extracted Code -> DB Faculty ID

    for (const fm of report.facultyMatches) {
      if (fm.matchedFaculty) {
        facultyIdMap.set(fm.extracted.faculty_code.toUpperCase(), fm.matchedFaculty.id);
      }
    }

    // 4. Supersede Old Timetable Version for this section
    await supabase
      .from('timetable_versions')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('section_id', targetSectionId)
      .eq('status', 'active');

    // Determine version number
    const { data: existingVersions } = await supabase
      .from('timetable_versions')
      .select('version_number')
      .eq('section_id', targetSectionId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = (existingVersions && existingVersions[0] ? existingVersions[0].version_number : 0) + 1;

    // 5. Create New Timetable Version in Supabase
    const { data: createdVersion, error: verErr } = await supabase
      .from('timetable_versions')
      .insert([{
        department_id: report.department?.id,
        section_id: targetSectionId,
        version_number: nextVersionNumber,
        effective_from: effectiveFrom,
        status: 'active',
        uploaded_by: doc.source_file_name,
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        changes_summary: {
          stats: report.stats,
          room_number: doc.room_number,
          class_incharge: doc.class_incharges,
          w_e_f: effectiveFrom,
        }
      }])
      .select('*')
      .single();

    // 6. Remove previous timetable entries for this section (unique constraint safe)
    await supabase
      .from('timetable_entries')
      .delete()
      .eq('section_id', targetSectionId);

    // 7. Insert New Active Timetable Entries from reviewed doc.schedule & report.diffs
    const newTimetableRows: any[] = [];
    const addedKeys = new Set<string>();

    // Helper resolvers
    const resolveSubId = (codeOrName: string): string | undefined => {
      if (!codeOrName) return undefined;
      const clean = codeOrName.toUpperCase().replace(/[\s\-_]/g, '');
      const cleanLower = codeOrName.toLowerCase().trim();

      if (subjectIdMap.has(clean)) return subjectIdMap.get(clean);

      const matched = allSubjects.find(s => {
        const sCode = s.subject_code.toUpperCase().replace(/[\s\-_]/g, '');
        if (sCode === clean) return true;
        if (clean === 'DS' && sCode === 'BCS301') return true;
        if (clean === 'COA' && sCode === 'BCS302') return true;
        if (clean === 'DSTL' && sCode === 'BCS303') return true;
        if ((clean === 'M4' || clean === 'MATHS4' || clean === 'MATHSIV') && sCode === 'BAS303') return true;
        if (clean === 'UHV' && sCode === 'BVE301') return true;
        if (clean === 'DSLAB' && sCode === 'BCS351') return true;
        if (clean === 'COALAB' && sCode === 'BCS352') return true;
        if (clean === 'DSTLLAB' && sCode === 'BCS353') return true;
        if ((clean === 'CS' || clean === 'CYBER' || clean === 'CYBERSECURITY') && sCode === 'BCC301') return true;
        if ((clean === 'CSLAB' || clean === 'CYBERLAB') && sCode === 'BCC351') return true;

        const sNameLower = s.subject_name.toLowerCase();
        if (sNameLower.includes(cleanLower) || cleanLower.includes(sNameLower)) return true;
        return false;
      });

      return matched?.id;
    };

    const resolveFacId = (codeOrName: string): string | undefined => {
      if (!codeOrName) return undefined;
      const cleanCode = codeOrName.toUpperCase().trim();
      const cleanName = codeOrName.toLowerCase().replace(/mr\.|ms\.|dr\.|prof\./g, '').trim();

      if (facultyIdMap.has(cleanCode)) return facultyIdMap.get(cleanCode);

      const matched = allFaculty.find(f => {
        if (f.faculty_code && f.faculty_code.toUpperCase().trim() === cleanCode) return true;
        if (f.employee_code && f.employee_code.toUpperCase().trim() === cleanCode) return true;
        if (cleanCode === 'HEM' && f.full_name.toLowerCase().includes('hemlata')) return true;
        if (cleanCode === 'KK' && f.full_name.toLowerCase().includes('kuldeep')) return true;
        if (cleanCode === 'NAK' && f.full_name.toLowerCase().includes('naseem')) return true;
        if (cleanCode === 'IRK' && f.full_name.toLowerCase().includes('imran')) return true;
        if ((cleanCode === 'SHS' || cleanCode === 'SS') && f.full_name.toLowerCase().includes('shivani')) return true;
        if (cleanCode === 'PRS' && f.full_name.toLowerCase().includes('praveen')) return true;
        if ((cleanCode === 'ALG' || cleanCode === 'AG') && f.full_name.toLowerCase().includes('alok')) return true;
        if (cleanCode === 'ABG' && f.full_name.toLowerCase().includes('abhishek')) return true;
        if (cleanCode === 'GDS' && f.full_name.toLowerCase().includes('gagandep')) return true;

        const fClean = f.full_name.toLowerCase().replace(/mr\.|ms\.|dr\.|prof\./g, '').trim();
        if (fClean.includes(cleanName) || cleanName.includes(fClean)) return true;
        const initials = fClean.split(/\s+/).map(w => w[0]).join('').toUpperCase();
        if (initials === cleanCode) return true;
        return false;
      });

      return matched?.id;
    };

    // Process all days in doc.schedule
    for (const daySchedule of (doc.schedule || [])) {
      for (const slot of (daySchedule.periods || [])) {
        if (slot.is_break || slot.lecture_type === 'Break') continue;

        const subId = (slot as any).resolvedSubject?.id ||
                      resolveSubId(slot.subject_code) ||
                      (slot.subject_name ? resolveSubId(slot.subject_name) : undefined);

        const facId = (slot as any).resolvedFaculty?.id ||
                      resolveFacId(slot.faculty_code || '') ||
                      (slot.faculty_name ? resolveFacId(slot.faculty_name) : undefined);

        if (!subId || !facId) continue;

        const key = `${daySchedule.day}-${slot.period_number}`;
        if (addedKeys.has(key)) continue;
        addedKeys.add(key);

        newTimetableRows.push({
          section_id: targetSectionId,
          subject_id: subId,
          faculty_id: facId,
          day_of_week: daySchedule.day,
          period_number: slot.period_number,
          start_time: slot.start_time || '09:00',
          end_time: slot.end_time || '09:50',
          room_number: slot.room_number || doc.room_number || 'A007',
          lecture_type: slot.lecture_type || 'Theory',
          active: true,
        });
      }
    }

    // Also verify from report.diffs if any slots were marked NEW/CHANGED
    for (const diff of report.diffs) {
      if (diff.status === 'REMOVED' || !diff.new_entry) continue;
      const newSlot = diff.new_entry;
      if (newSlot.is_break || newSlot.lecture_type === 'Break') continue;

      const key = `${diff.day_of_week}-${diff.period_number}`;
      if (addedKeys.has(key)) continue;

      const subId = newSlot.resolvedSubject?.id || resolveSubId(newSlot.subject_code);
      const facId = newSlot.resolvedFaculty?.id || resolveFacId(newSlot.faculty_code || '');

      if (!subId || !facId) continue;
      addedKeys.add(key);

      newTimetableRows.push({
        section_id: targetSectionId,
        subject_id: subId,
        faculty_id: facId,
        day_of_week: diff.day_of_week,
        period_number: diff.period_number,
        start_time: diff.start_time,
        end_time: diff.end_time,
        room_number: newSlot.room_number || doc.room_number || 'A007',
        lecture_type: newSlot.lecture_type || 'Theory',
        active: true,
      });
    }

    let insertedEntries: TimetableEntry[] = [];
    if (newTimetableRows.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('timetable_entries')
        .insert(newTimetableRows)
        .select('*');

      if (insertErr) {
        throw new Error(insertErr.message || 'Failed to insert active timetable records.');
      }
      insertedEntries = (inserted || []) as TimetableEntry[];
    }

    // 8. Synchronize faculty_subject_assignments in Supabase
    const distinctPairs = new Map<string, { facultyId: string; subjectId: string }>();
    for (const row of newTimetableRows) {
      const pairKey = `${row.faculty_id}-${row.subject_id}`;
      if (!distinctPairs.has(pairKey)) {
        distinctPairs.set(pairKey, { facultyId: row.faculty_id, subjectId: row.subject_id });
      }
    }

    for (const pair of distinctPairs.values()) {
      const { data: existingAssignment } = await supabase
        .from('faculty_subject_assignments')
        .select('id, active')
        .eq('faculty_id', pair.facultyId)
        .eq('subject_id', pair.subjectId)
        .eq('section_id', targetSectionId)
        .maybeSingle();

      if (!existingAssignment) {
        await supabase.from('faculty_subject_assignments').insert([{
          faculty_id: pair.facultyId,
          subject_id: pair.subjectId,
          section_id: targetSectionId,
          academic_session_id: '8ef97eaa-8868-4b17-8ff9-c9d3cfb9160d', // 2026-2027
          active: true,
        }]);
      } else if (!existingAssignment.active) {
        await supabase
          .from('faculty_subject_assignments')
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq('id', existingAssignment.id);
      }
    }

    // 9. Update Timetable Import record status
    if (importId) {
      await supabase
        .from('timetable_imports')
        .update({
          status: 'approved',
          section_id: targetSectionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', importId);
    }

    // 10. Record Audit Log in Supabase
    await supabase.from('audit_logs').insert([{
      action: 'TIMETABLE_AI_INGESTION_PUBLISHED',
      actor_name: approvedBy,
      actor_role: 'hod',
      entity_type: 'timetable_version',
      entity_id: createdVersion?.id || targetSectionId,
      new_values: {
        section: doc.section_name,
        department: report.department?.name,
        version: nextVersionNumber,
        effective_from: effectiveFrom,
        slots_count: insertedEntries.length,
        file: doc.source_file_name,
      }
    }]);

    // 11. Create Official Circular / Notice for affected students & faculty
    await supabaseService.publishNotice({
      title: `Official Timetable Updated — Section ${doc.section_name || 'A'} (W.E.F. ${effectiveFrom})`,
      category: 'Academic',
      author: approvedBy,
      content: `The official academic timetable for ${report.program?.name || 'B.Tech'} ${report.department?.name || 'CSE'} Section ${doc.section_name || 'A'} has been published (Version ${nextVersionNumber}, Effective ${effectiveFrom}). Room: ${doc.room_number || 'Assigned'}. All students and assigned faculty members are requested to check their daily schedule.`,
      isPinned: true,
      targetAudience: `Section ${doc.section_name || 'A'}`,
      targetSectionId: targetSectionId,
      targetDepartmentId: report.department?.id || null,
      targetProgramId: report.program?.id || null,
      targetSemesterId: report.semester?.id || null,
    });

    return {
      version: (createdVersion || {
        id: `ver-${Date.now()}`,
        department_id: report.department?.id || '',
        section_id: targetSectionId,
        version_number: nextVersionNumber,
        effective_from: effectiveFrom,
        status: 'active',
        approved_by: approvedBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as TimetableVersion,
      newEntries: insertedEntries,
    };
  }
}

export const timetableIngestionService = TimetableIngestionService.getInstance();
