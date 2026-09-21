import { Client, types } from 'pg';
// Ensure Postgres DATE columns (OID 1082) are returned as 'YYYY-MM-DD' strings, matching Supabase JS client behavior
types.setTypeParser(1082, (str: string) => str);
import * as fs from 'fs';
import * as path from 'path';
import { 
  Student, 
  TimetableEntry, 
  AttendanceSession, 
  AttendanceRecord,
  AttendanceStatus 
} from '../types/database.types';
import { normalizeDateToIST } from '../lib/utils/dateUtils';
import { supabaseService } from '../lib/services/supabaseService';
import { supabase } from '../lib/supabase/supabaseClient';

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
      }
    }
  }
}

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

export type AttendanceSummaryStatus = 
  | 'NO_RECORDS'
  | 'PARTIALLY_MARKED'
  | 'FULLY_MARKED'
  | 'RECORDED'
  | 'LOADING'
  | 'SYNCING'
  | 'NETWORK_ERROR'
  | 'DATA_ERROR';

export interface AttendanceSummary {
  sessionId?: string;
  total: number;
  present: number;
  absent: number;
  unmarked: number;
  marked: number;
  progress: number;
  status: AttendanceSummaryStatus;
  statusLabel: string;
}

/**
 * Exact implementation mirror of AcademicContext.getAttendanceSummary
 */
function computeAttendanceSummary(
  lookup: string | {
    sessionId?: string;
    timetableEntryId?: string;
    sessionDate?: string;
    sectionId?: string;
    subjectId?: string;
    startTime?: string;
  },
  attendanceSessions: AttendanceSession[],
  attendanceRecords: AttendanceRecord[],
  students: Student[],
  timetable: TimetableEntry[],
  options?: { isLoading?: boolean; hasNetworkError?: boolean }
): AttendanceSummary {
  let session: AttendanceSession | undefined;

  const lookupDateStr = typeof lookup !== 'string' ? normalizeDateToIST(lookup.sessionDate) : '';

  if (typeof lookup === 'string') {
    session = attendanceSessions.find(s => s.id === lookup);
  } else {
    if (lookup.sessionId) {
      session = attendanceSessions.find(s => s.id === lookup.sessionId);
    }
    if (!session) {
      const matchingSessions = attendanceSessions.filter(s => {
        const sDate = normalizeDateToIST(s.session_date);
        const matchesDate = !lookupDateStr || sDate === lookupDateStr;
        if (!matchesDate) return false;

        // 1. Direct timetable entry ID match
        if (lookup.timetableEntryId && s.timetable_entry_id === lookup.timetableEntryId) {
          return true;
        }

        // 2. Section + Subject + StartTime match
        if (lookup.sectionId && lookup.subjectId && s.section_id === lookup.sectionId && s.subject_id === lookup.subjectId) {
          const sStart = s.start_time?.substring(0, 5);
          const lStart = lookup.startTime?.substring(0, 5);
          if (!lStart || !sStart || sStart === lStart) {
            return true;
          }
        }

        // 3. Fallback: Section + StartTime match
        if (lookup.sectionId && lookup.startTime && s.section_id === lookup.sectionId) {
          const sStart = s.start_time?.substring(0, 5);
          const lStart = lookup.startTime?.substring(0, 5);
          if (sStart && lStart && sStart === lStart) {
            return true;
          }
        }

        return false;
      });

      if (matchingSessions.length > 0) {
        matchingSessions.sort((a, b) => {
          if (lookup.timetableEntryId) {
            const aTt = a.timetable_entry_id === lookup.timetableEntryId ? 1 : 0;
            const bTt = b.timetable_entry_id === lookup.timetableEntryId ? 1 : 0;
            if (aTt !== bTt) return bTt - aTt;
          }

          const aCompleted = a.status === 'completed' || a.marked_at ? 1 : 0;
          const bCompleted = b.status === 'completed' || b.marked_at ? 1 : 0;
          if (aCompleted !== bCompleted) return bCompleted - aCompleted;

          const aRecs = attendanceRecords.some(r => r.attendance_session_id === a.id) ? 1 : 0;
          const bRecs = attendanceRecords.some(r => r.attendance_session_id === b.id) ? 1 : 0;
          if (aRecs !== bRecs) return bRecs - aRecs;

          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

        session = matchingSessions[0];
      }
    }
  }

  const sectionId = session?.section_id || 
    (typeof lookup !== 'string' ? lookup.sectionId : undefined) ||
    (typeof lookup !== 'string' && lookup.timetableEntryId ? timetable.find(t => t.id === lookup.timetableEntryId)?.section_id : undefined);

  const sectionStudents = sectionId
    ? students.filter(s => s.section_id === sectionId && s.active)
    : [];
  const uniqueStudentIds = Array.from(new Set(sectionStudents.map(s => s.id)));
  const total = uniqueStudentIds.length;

  if (!session) {
    if (options?.isLoading && attendanceSessions.length === 0) {
      return {
        sessionId: undefined,
        total,
        present: 0,
        absent: 0,
        unmarked: total,
        marked: 0,
        progress: 0,
        status: 'LOADING',
        statusLabel: 'Verifying Attendance...',
      };
    }

    if (options?.hasNetworkError) {
      return {
        sessionId: undefined,
        total,
        present: 0,
        absent: 0,
        unmarked: total,
        marked: 0,
        progress: 0,
        status: 'NETWORK_ERROR',
        statusLabel: 'Unable to verify attendance',
      };
    }

    return {
      sessionId: undefined,
      total,
      present: 0,
      absent: 0,
      unmarked: total,
      marked: 0,
      progress: 0,
      status: 'NO_RECORDS',
      statusLabel: 'Not Recorded',
    };
  }

  const sessionRecords = attendanceRecords.filter(r => r.attendance_session_id === session!.id);

  const studentStatusMap = new Map<string, string>();
  for (const r of sessionRecords) {
    if (uniqueStudentIds.length === 0 || uniqueStudentIds.includes(r.student_id)) {
      studentStatusMap.set(r.student_id, r.status);
    }
  }

  let present = 0;
  let absent = 0;
  studentStatusMap.forEach(status => {
    if (status === 'Present') present++;
    else if (status === 'Absent') absent++;
  });

  const marked = present + absent;
  const effectiveTotal = total > 0 ? total : marked;
  const unmarked = Math.max(0, effectiveTotal - marked);
  const progress = effectiveTotal > 0 ? Math.round((marked / effectiveTotal) * 100) : 0;

  let status: AttendanceSummaryStatus = 'NO_RECORDS';
  let statusLabel = 'Not Recorded';

  if (marked > 0) {
    if (marked >= effectiveTotal) {
      status = 'FULLY_MARKED';
      statusLabel = `Marked (${effectiveTotal}/${effectiveTotal})`;
    } else {
      status = 'PARTIALLY_MARKED';
      statusLabel = `Marked (${marked}/${effectiveTotal})`;
    }
  } else {
    const isSessionCompletedInDb = session.status === 'completed' || (session.status !== 'pending' && Boolean(session.marked_at));
    if (isSessionCompletedInDb) {
      status = 'RECORDED';
      statusLabel = '✓ Marked';
    } else if (options?.isLoading) {
      status = 'LOADING';
      statusLabel = 'Verifying Attendance...';
    } else {
      status = 'NO_RECORDS';
      statusLabel = 'Not Recorded';
    }
  }

  return {
    sessionId: session.id,
    total: effectiveTotal,
    present,
    absent,
    unmarked,
    marked,
    progress,
    status,
    statusLabel,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('VCTM ERP: TODAY\'S CLASSES ATTENDANCE PERSISTENCE & ZERO DATA LOSS TEST');
  console.log('='.repeat(80));

  const client = new Client({ connectionString });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function testAssert(condition: boolean, msg: string) {
    try {
      assert(condition, msg);
      passCount++;
    } catch (e) {
      failCount++;
      throw e;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: Postgres Database Authoritative Truth Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 1: Postgres Authoritative Source of Truth (2026-09-21) ---');
    const waseemEmail = 'waseem.cse@vctm.in';
    const facRes = await client.query('SELECT * FROM faculty WHERE email = $1', [waseemEmail]);
    testAssert(facRes.rows.length === 1, `Resolved faculty row for ${waseemEmail}`);
    const waseem = facRes.rows[0];

    // Check Monday timetable entries for Waseem
    const ttRes = await client.query(
      "SELECT * FROM timetable_entries WHERE faculty_id = $1 AND day_of_week = 'MON' ORDER BY start_time",
      [waseem.id]
    );
    testAssert(ttRes.rows.length >= 2, `Waseem Sir has ${ttRes.rows.length} Monday timetable lectures`);
    const period2Entry = ttRes.rows.find(t => t.start_time.startsWith('09:50'));
    const period3Entry = ttRes.rows.find(t => t.start_time.startsWith('10:40'));
    testAssert(!!period2Entry, 'Resolved Period 2 Timetable Entry (09:50 - 10:40)');
    testAssert(!!period3Entry, 'Resolved Period 3 Timetable Entry (10:40 - 11:30)');

    // Check attendance sessions for 2026-09-21 in database
    const sessRes = await client.query(
      `SELECT * FROM attendance_sessions 
       WHERE faculty_id = $1 
         AND (session_date = '2026-09-21' OR session_date = '2026-09-20' OR session_date = '2026-09-20T18:30:00.000Z')
       ORDER BY start_time`,
      [waseem.id]
    );
    testAssert(sessRes.rows.length >= 2, `Found ${sessRes.rows.length} live sessions in database for today`);

    const p2Session = sessRes.rows.find(s => s.start_time.startsWith('09:50'));
    const p3Session = sessRes.rows.find(s => s.start_time.startsWith('10:40'));
    testAssert(!!p2Session, 'Period 2 session exists in database');
    testAssert(!!p3Session, 'Period 3 session exists in database');
    testAssert(p2Session.status === 'completed', `Period 2 status in DB is "completed" (found ${p2Session.status})`);
    testAssert(p3Session.status === 'completed', `Period 3 status in DB is "completed" (found ${p3Session.status})`);
    testAssert(!!p2Session.marked_at, 'Period 2 has non-null marked_at in database');
    testAssert(!!p3Session.marked_at, 'Period 3 has non-null marked_at in database');

    // Check attendance records for both sessions
    const recP2Res = await client.query('SELECT * FROM attendance_records WHERE attendance_session_id = $1', [p2Session.id]);
    const recP3Res = await client.query('SELECT * FROM attendance_records WHERE attendance_session_id = $1', [p3Session.id]);
    testAssert(recP2Res.rows.length > 0, `Period 2 has ${recP2Res.rows.length} saved attendance records in DB`);
    testAssert(recP3Res.rows.length > 0, `Period 3 has ${recP3Res.rows.length} saved attendance records in DB`);

    // Fetch students enrolled in these sections
    const studentsRes = await client.query('SELECT * FROM students WHERE active = true');
    const allStudents: Student[] = studentsRes.rows;

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Scoped Data Fetch & Preload Invariant (Zero Wipeout)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Scoped Data Fetch & Preload Invariant ---');
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: waseemEmail,
      password: 'faculty@123',
    });
    testAssert(!authErr && !!authData.user, `Authenticated with Supabase Auth as ${waseemEmail}`);

    const scopedData = await supabaseService.fetchScopedData({
      role: 'faculty',
      facultyId: waseem.id,
      departmentId: waseem.department_id,
    });

    testAssert(scopedData.attendanceSessions.length > 0, `fetchScopedData returns ${scopedData.attendanceSessions.length} attendance sessions`);
    testAssert(scopedData.attendanceRecords.length > 0, `fetchScopedData returns ${scopedData.attendanceRecords.length} attendance records (NOT empty [])`);

    const scopedP2Session = scopedData.attendanceSessions.find((s: AttendanceSession) => s.id === p2Session.id);
    const scopedP2Records = scopedData.attendanceRecords.filter((r: AttendanceRecord) => r.attendance_session_id === p2Session.id);
    testAssert(!!scopedP2Session, 'fetchScopedData includes today\'s Period 2 session');
    testAssert(scopedP2Records.length === recP2Res.rows.length, `fetchScopedData includes all ${recP2Res.rows.length} records for Period 2`);

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Zero Data Loss Summary Resolution on Today\'s Classes
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Zero Data Loss Summary Resolution on Today\'s Classes ---');

    // Period 2 card lookup by timetable entry & today's date
    const summaryP2 = computeAttendanceSummary(
      {
        timetableEntryId: period2Entry.id,
        sessionDate: '2026-09-21',
        sectionId: period2Entry.section_id,
        subjectId: period2Entry.subject_id,
        startTime: period2Entry.start_time,
      },
      scopedData.attendanceSessions,
      scopedData.attendanceRecords,
      allStudents,
      ttRes.rows
    );

    testAssert(summaryP2.status !== 'NO_RECORDS', 'Period 2 status is NOT NO_RECORDS');
    testAssert(summaryP2.statusLabel !== 'Not Recorded', 'Period 2 statusLabel is NOT "Not Recorded"');
    testAssert(summaryP2.status === 'FULLY_MARKED' || summaryP2.status === 'PARTIALLY_MARKED', `Period 2 status is ${summaryP2.status}`);
    testAssert(summaryP2.marked === recP2Res.rows.length, `Period 2 marked count matches DB records exactly: ${summaryP2.marked}`);
    testAssert(summaryP2.statusLabel.startsWith('Marked ('), `Period 2 card displays: "${summaryP2.statusLabel}"`);

    // Period 3 card lookup by timetable entry & today's date
    const summaryP3 = computeAttendanceSummary(
      {
        timetableEntryId: period3Entry.id,
        sessionDate: '2026-09-21',
        sectionId: period3Entry.section_id,
        subjectId: period3Entry.subject_id,
        startTime: period3Entry.start_time,
      },
      scopedData.attendanceSessions,
      scopedData.attendanceRecords,
      allStudents,
      ttRes.rows
    );

    testAssert(summaryP3.status !== 'NO_RECORDS', 'Period 3 status is NOT NO_RECORDS');
    testAssert(summaryP3.statusLabel !== 'Not Recorded', 'Period 3 statusLabel is NOT "Not Recorded"');
    testAssert(summaryP3.marked === recP3Res.rows.length, `Period 3 marked count matches DB records exactly: ${summaryP3.marked}`);
    testAssert(summaryP3.statusLabel.startsWith('Marked ('), `Period 3 card displays: "${summaryP3.statusLabel}"`);

    // -------------------------------------------------------------------------
    // TEST SUITE 4: Browser Reload & Cache Deserialization Simulation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Browser Reload & Cache Deserialization Simulation ---');

    // Simulate instant page reload where sessions are restored from cache/fetch,
    // but child attendanceRecords are temporarily empty or awaiting hydration
    const reloadSessionsOnlySummary = computeAttendanceSummary(
      {
        timetableEntryId: period2Entry.id,
        sessionDate: '2026-09-21',
        sectionId: period2Entry.section_id,
        subjectId: period2Entry.subject_id,
        startTime: period2Entry.start_time,
      },
      [p2Session as any],
      [], // EMPTY RECORDS (simulating in-flight child record hydration)
      allStudents,
      ttRes.rows
    );

    testAssert(reloadSessionsOnlySummary.status === 'RECORDED', 'Awaiting child records: status is RECORDED');
    testAssert(reloadSessionsOnlySummary.statusLabel === '✓ Marked', 'Awaiting child records: card displays "✓ Marked"');
    testAssert(reloadSessionsOnlySummary.status !== 'NO_RECORDS', 'Awaiting child records: DOES NOT revert to NO_RECORDS');
    testAssert(reloadSessionsOnlySummary.statusLabel !== 'Not Recorded', 'Awaiting child records: DOES NOT revert to "Not Recorded"');

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Timetable Re-save & ID Regeneration Resilience
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Timetable Re-save & ID Regeneration Resilience ---');

    // If an admin re-saved the timetable, creating a new timetable_entry_id:
    const reGeneratedTimetableEntry = {
      ...period2Entry,
      id: 'brand-new-regenerated-uuid-12345',
    };

    const reSavedLookupSummary = computeAttendanceSummary(
      {
        timetableEntryId: reGeneratedTimetableEntry.id, // Changed ID
        sessionDate: '2026-09-21',
        sectionId: period2Entry.section_id,
        subjectId: period2Entry.subject_id,
        startTime: period2Entry.start_time,
      },
      scopedData.attendanceSessions,
      scopedData.attendanceRecords,
      allStudents,
      [reGeneratedTimetableEntry]
    );

    testAssert(reSavedLookupSummary.status !== 'NO_RECORDS', 'Timetable ID change: fallback resolves completed session');
    testAssert(reSavedLookupSummary.marked === recP2Res.rows.length, `Timetable ID change: resolves exact ${recP2Res.rows.length} records`);

    // -------------------------------------------------------------------------
    // TEST SUITE 6: Strict Date & Session Scoping Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Strict Date & Session Scoping Isolation ---');

    // Future date (2026-09-22) must NOT show today's attendance
    const futureDateSummary = computeAttendanceSummary(
      {
        timetableEntryId: period2Entry.id,
        sessionDate: '2026-09-22', // Tomorrow
        sectionId: period2Entry.section_id,
        subjectId: period2Entry.subject_id,
        startTime: period2Entry.start_time,
      },
      scopedData.attendanceSessions,
      scopedData.attendanceRecords,
      allStudents,
      ttRes.rows
    );

    testAssert(futureDateSummary.status === 'NO_RECORDS', 'Future date (2026-09-22) status is NO_RECORDS');
    testAssert(futureDateSummary.statusLabel === 'Not Recorded', 'Future date (2026-09-22) card displays "Not Recorded"');

    // Cross-session isolation: Period 2 records do NOT count towards Period 3
    testAssert(summaryP2.sessionId !== summaryP3.sessionId, 'Period 2 and Period 3 have distinct session IDs');
    testAssert(summaryP2.marked !== summaryP3.marked, `Period 2 (${summaryP2.marked}) and Period 3 (${summaryP3.marked}) maintain distinct record sets`);

    // -------------------------------------------------------------------------
    // TEST SUITE 7: State Machine & Error States Rigor
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: State Machine & Error States Rigor ---');

    // State 1: LOADING with no cached sessions
    const loadingSummary = computeAttendanceSummary(
      {
        timetableEntryId: 'slot-loading',
        sessionDate: '2026-09-21',
      },
      [],
      [],
      allStudents,
      ttRes.rows,
      { isLoading: true }
    );
    testAssert(loadingSummary.status === 'LOADING', 'State Machine: returns LOADING during initial fetch');
    testAssert(loadingSummary.statusLabel === 'Verifying Attendance...', 'State Machine: label is "Verifying Attendance..."');

    // State 2: NETWORK_ERROR (Supabase unreachable or network failure)
    const errorSummary = computeAttendanceSummary(
      {
        timetableEntryId: 'slot-error',
        sessionDate: '2026-09-21',
      },
      [],
      [],
      allStudents,
      ttRes.rows,
      { hasNetworkError: true }
    );
    testAssert(errorSummary.status === 'NETWORK_ERROR', 'State Machine: returns NETWORK_ERROR on connection failure');
    testAssert(errorSummary.statusLabel === 'Unable to verify attendance', 'State Machine: label is "Unable to verify attendance" (never falsely claims "Not Recorded")');

    // State 3: Truly unrecorded slot (no session, not loading)
    const trulyUnrecordedSummary = computeAttendanceSummary(
      {
        timetableEntryId: 'slot-unrecorded',
        sessionDate: '2026-09-21',
      },
      [],
      [],
      allStudents,
      ttRes.rows,
      { isLoading: false, hasNetworkError: false }
    );
    testAssert(trulyUnrecordedSummary.status === 'NO_RECORDS', 'State Machine: truly unrecorded slot returns NO_RECORDS');
    testAssert(trulyUnrecordedSummary.statusLabel === 'Not Recorded', 'State Machine: label is "Not Recorded"');

    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: All ${passCount} tests passed successfully (${((passCount / (passCount + failCount)) * 100).toFixed(1)}%).`);
    console.log('='.repeat(80));

  } finally {
    await client.end();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
