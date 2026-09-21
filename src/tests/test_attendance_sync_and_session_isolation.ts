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
  timetable: TimetableEntry[]
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

        if (lookup.timetableEntryId && s.timetable_entry_id === lookup.timetableEntryId) {
          return true;
        }

        if (lookup.sectionId && lookup.subjectId && s.section_id === lookup.sectionId && s.subject_id === lookup.subjectId) {
          const sStart = s.start_time?.substring(0, 5);
          const lStart = lookup.startTime?.substring(0, 5);
          if (!lStart || !sStart || sStart === lStart) {
            return true;
          }
        }

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

async function runAttendanceSyncVerification() {
  console.log('================================================================================');
  console.log('VCTM ERP: ATTENDANCE COUNT SYNC & SESSION ISOLATION VERIFICATION');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  let tempSessionId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: Target Lecture Resolution (DS Section B, 09:00-09:50, 19/09/2026)
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 1: Target Lecture Matrix Resolution ---');

    const ttRes = await client.query(`
      SELECT tt.*, sub.subject_code, sub.subject_name, sec.name as section_name
      FROM timetable_entries tt
      JOIN subjects sub ON tt.subject_id = sub.id
      JOIN sections sec ON tt.section_id = sec.id
      WHERE (sub.subject_code = 'BCS301' OR sub.subject_name ILIKE '%Data Structure%')
        AND sec.name = 'B'
        AND tt.start_time = '09:00:00'
      LIMIT 1
    `);

    assert(ttRes.rows.length === 1, 'Resolved Timetable Entry for Data Structure (DS) Section B (09:00 - 09:50)');
    const dsEntry: TimetableEntry = ttRes.rows[0];

    // Load active students in Section B
    const studentsRes = await client.query(`
      SELECT * FROM students 
      WHERE section_id = $1 AND active = true
      ORDER BY roll_number ASC
    `, [dsEntry.section_id]);

    const sectionBStudents: Student[] = studentsRes.rows;
    console.log(`   Section B active enrolled students count: ${sectionBStudents.length}`);
    assert(sectionBStudents.length === 53, 'Section B has exactly 53 enrolled active students');

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Live Saved Session & 22 Present + 31 Absent Synchronization
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Exact 22 Present + 31 Absent Synchronization ---');

    // Fetch the actual session from database
    const sessionRes = await client.query(`
      SELECT * FROM attendance_sessions
      WHERE timetable_entry_id = $1 AND session_date = '2026-09-19'
      LIMIT 1
    `, [dsEntry.id]);

    assert(sessionRes.rows.length === 1, 'Found live attendance session in database for 19/09/2026');
    const liveSession: AttendanceSession = sessionRes.rows[0];

    // Fetch the actual attendance records
    const recordsRes = await client.query(`
      SELECT * FROM attendance_records
      WHERE attendance_session_id = $1
    `, [liveSession.id]);

    const liveRecords: AttendanceRecord[] = recordsRes.rows;
    const dbPresent = liveRecords.filter(r => r.status === 'Present').length;
    const dbAbsent = liveRecords.filter(r => r.status === 'Absent').length;
    console.log(`   Live Database Records: Total = ${liveRecords.length}, Present = ${dbPresent}, Absent = ${dbAbsent}`);
    assert(liveRecords.length === 53, 'Database has exactly 53 records for this session');
    assert(dbPresent === 22, 'Database has exactly 22 Present records');
    assert(dbAbsent === 31, 'Database has exactly 31 Absent records');

    // Compute summary using authoritative single source of truth function
    const summary = computeAttendanceSummary(
      liveSession.id,
      [liveSession],
      liveRecords,
      sectionBStudents,
      [dsEntry]
    );

    assert(summary.total === 53, 'Summary total is 53');
    assert(summary.present === 22, 'Summary present is 22');
    assert(summary.absent === 31, 'Summary absent is 31');
    assert(summary.unmarked === 0, 'Summary unmarked is 0');
    assert(summary.marked === 53, 'Summary marked is 53 (Present + Absent = 53)');
    assert(summary.progress === 100, 'Summary progress is 100%');
    assert(summary.status === 'FULLY_MARKED', 'Summary status is FULLY_MARKED');
    assert(summary.statusLabel === 'Marked (53/53)', 'Today\'s Classes card displays: Marked (53/53)');
    assert(summary.statusLabel !== 'Marked (0/53)', 'Card is NOT displaying buggy 0/53');
    assert(summary.statusLabel !== 'Marked (22/53)', 'Card is NOT displaying partial present-only 22/53');

    // Verify lookup by timetable entry and date (as used in Today's Classes cards)
    const cardSummary = computeAttendanceSummary(
      {
        timetableEntryId: dsEntry.id,
        sessionDate: '2026-09-19',
        sectionId: dsEntry.section_id,
        subjectId: dsEntry.subject_id,
        startTime: dsEntry.start_time,
      },
      [liveSession],
      liveRecords,
      sectionBStudents,
      [dsEntry]
    );

    assert(cardSummary.statusLabel === 'Marked (53/53)', 'Lookup by timetable entry & date produces exact Marked (53/53)');

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Partial Marking & Zero States
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Partial Marking & Zero Record States ---');

    // Case 3A: 2 Present + 2 Absent out of 53
    const partialRecords4: AttendanceRecord[] = [
      { id: 'r1', attendance_session_id: liveSession.id, student_id: sectionBStudents[0].id, status: 'Present' } as any,
      { id: 'r2', attendance_session_id: liveSession.id, student_id: sectionBStudents[1].id, status: 'Present' } as any,
      { id: 'r3', attendance_session_id: liveSession.id, student_id: sectionBStudents[2].id, status: 'Absent' } as any,
      { id: 'r4', attendance_session_id: liveSession.id, student_id: sectionBStudents[3].id, status: 'Absent' } as any,
    ];

    const partialSummary4 = computeAttendanceSummary(
      liveSession.id,
      [liveSession],
      partialRecords4,
      sectionBStudents,
      [dsEntry]
    );

    assert(partialSummary4.marked === 4, 'Partial (2P + 2A): marked is 4');
    assert(partialSummary4.unmarked === 49, 'Partial (2P + 2A): unmarked is 49');
    assert(partialSummary4.status === 'PARTIALLY_MARKED', 'Partial (2P + 2A): status is PARTIALLY_MARKED');
    assert(partialSummary4.statusLabel === 'Marked (4/53)', 'Partial (2P + 2A): card displays Marked (4/53)');

    // Case 3B: 10 Present + 0 Absent out of 53
    const partialRecords10: AttendanceRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: `r-p-${i}`,
      attendance_session_id: liveSession.id,
      student_id: sectionBStudents[i].id,
      status: 'Present'
    } as any));

    const partialSummary10 = computeAttendanceSummary(
      liveSession.id,
      [liveSession],
      partialRecords10,
      sectionBStudents,
      [dsEntry]
    );

    assert(partialSummary10.marked === 10, 'Partial (10P + 0A): marked is 10');
    assert(partialSummary10.unmarked === 43, 'Partial (10P + 0A): unmarked is 43');
    assert(partialSummary10.statusLabel === 'Marked (10/53)', 'Partial (10P + 0A): card displays Marked (10/53)');

    // Case 3C: Nothing Marked / No Records (Unrecorded slot or pending session)
    const draftSession: AttendanceSession = {
      ...liveSession,
      id: 'draft-temp-id',
      status: 'pending',
      marked_at: undefined as any,
    };
    const emptySummary = computeAttendanceSummary(
      draftSession.id,
      [draftSession],
      [],
      sectionBStudents,
      [dsEntry]
    );

    assert(emptySummary.marked === 0, 'No records: marked is 0');
    assert(emptySummary.unmarked === 53, 'No records: unmarked is 53');
    assert(emptySummary.status === 'NO_RECORDS', 'No records: status is NO_RECORDS');
    assert(emptySummary.statusLabel === 'Not Recorded', 'No records: card displays Not Recorded');

    // Case 3D: Completed session in DB before child records are hydrated (Zero Data Loss persistence)
    const pendingHydrationSummary = computeAttendanceSummary(
      liveSession.id,
      [liveSession],
      [],
      sectionBStudents,
      [dsEntry]
    );
    assert(pendingHydrationSummary.status === 'RECORDED', 'Completed session awaiting records: status is RECORDED');
    assert(pendingHydrationSummary.statusLabel === '✓ Marked', 'Completed session awaiting records: card displays ✓ Marked');

    // -------------------------------------------------------------------------
    // TEST SUITE 4: Realtime Mutation (Present -> Absent Transition)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Realtime Marks Modification (22P/31A -> 21P/32A) ---');

    // Faculty flips a student currently marked Present to Absent
    const presentRecord = liveRecords.find(r => r.status === 'Present');
    const targetStudentId = presentRecord?.student_id;
    const modifiedRecords = liveRecords.map(r => {
      if (r.student_id === targetStudentId) {
        return { ...r, status: 'Absent' as AttendanceStatus };
      }
      return r;
    });

    const modifiedSummary = computeAttendanceSummary(
      liveSession.id,
      [liveSession],
      modifiedRecords,
      sectionBStudents,
      [dsEntry]
    );

    assert(modifiedSummary.present === 21, 'Realtime transition: Present count is now 21');
    assert(modifiedSummary.absent === 32, 'Realtime transition: Absent count is now 32');
    assert(modifiedSummary.marked === 53, 'Realtime transition: Marked remains 53/53');
    assert(modifiedSummary.statusLabel === 'Marked (53/53)', 'Card maintains Marked (53/53) in realtime');

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Multiple Lectures & Cross-Session Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Multiple Lectures & Session Scoping Isolation ---');

    // Find another lecture for Section B on the same day (e.g. DAA or DS LAB)
    const otherTtRes = await client.query(`
      SELECT * FROM timetable_entries
      WHERE section_id = $1 AND id != $2 AND active = true
      LIMIT 1
    `, [dsEntry.section_id, dsEntry.id]);

    assert(otherTtRes.rows.length === 1, 'Found second timetable entry for Section B');
    const secondEntry: TimetableEntry = otherTtRes.rows[0];

    // Create a temporary second session in database
    const insertSecondSessRes = await client.query(`
      INSERT INTO attendance_sessions (timetable_entry_id, faculty_id, section_id, subject_id, session_date, start_time, end_time, status)
      VALUES ($1, $2, $3, $4, '2026-09-19', '14:00:00', '14:50:00', 'completed')
      RETURNING *
    `, [secondEntry.id, dsEntry.faculty_id, dsEntry.section_id, secondEntry.subject_id]);

    tempSessionId = insertSecondSessRes.rows[0].id;
    const secondSession: AttendanceSession = insertSecondSessRes.rows[0];

    // Insert 10 records for second session
    await client.query(`
      INSERT INTO attendance_records (attendance_session_id, student_id, status, marked_by)
      SELECT $1, id, 'Present', $2
      FROM students
      WHERE section_id = $3 AND active = true
      LIMIT 10
    `, [tempSessionId, dsEntry.faculty_id, dsEntry.section_id]);

    const secondRecordsRes = await client.query(`
      SELECT * FROM attendance_records WHERE attendance_session_id = $1
    `, [tempSessionId]);

    const secondRecords: AttendanceRecord[] = secondRecordsRes.rows;

    const allSessions = [liveSession, secondSession];
    const allRecords = [...liveRecords, ...secondRecords];

    // Verify P1 DS summary
    const summaryP1 = computeAttendanceSummary(
      {
        timetableEntryId: dsEntry.id,
        sessionDate: '2026-09-19',
        sectionId: dsEntry.section_id,
        subjectId: dsEntry.subject_id,
        startTime: dsEntry.start_time,
      },
      allSessions,
      allRecords,
      sectionBStudents,
      [dsEntry, secondEntry]
    );

    // Verify P2 second session summary
    const summaryP2 = computeAttendanceSummary(
      {
        timetableEntryId: secondEntry.id,
        sessionDate: '2026-09-19',
        sectionId: secondEntry.section_id,
        subjectId: secondEntry.subject_id,
        startTime: '14:00:00',
      },
      allSessions,
      allRecords,
      sectionBStudents,
      [dsEntry, secondEntry]
    );

    assert(summaryP1.marked === 53, 'P1 DS remains 53/53 (Zero cross-session leakage)');
    assert(summaryP1.statusLabel === 'Marked (53/53)', 'P1 card displays Marked (53/53)');
    assert(summaryP2.marked === 10, 'P2 second session reflects exact independent count: 10/53');
    assert(summaryP2.statusLabel === 'Marked (10/53)', 'P2 card displays Marked (10/53)');

    // -------------------------------------------------------------------------
    // TEST SUITE 6: Multiple Sections Isolation (Section B vs Section A)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Multiple Sections Cross-Section Isolation ---');

    const secARes = await client.query(`
      SELECT sec.*, sub.id as subject_id, tt.id as tt_id
      FROM sections sec
      JOIN timetable_entries tt ON tt.section_id = sec.id
      JOIN subjects sub ON tt.subject_id = sub.id
      WHERE sec.name = 'A' AND sec.id != $1 AND tt.active = true
      LIMIT 1
    `, [dsEntry.section_id]);

    if (secARes.rows.length > 0) {
      const secAEntry = secARes.rows[0];
      const secAStudentsRes = await client.query(`
        SELECT * FROM students WHERE section_id = $1 AND active = true
      `, [secAEntry.id]);

      const summarySecA = computeAttendanceSummary(
        {
          timetableEntryId: secAEntry.tt_id,
          sessionDate: '2026-09-19',
          sectionId: secAEntry.id,
          subjectId: secAEntry.subject_id,
        },
        allSessions,
        allRecords,
        secAStudentsRes.rows,
        [dsEntry, secondEntry, { id: secAEntry.tt_id, section_id: secAEntry.id, subject_id: secAEntry.subject_id } as any]
      );

      assert(summarySecA.marked === 0, 'Section A class has 0 marked records (No bleed from Section B)');
      assert(summarySecA.statusLabel === 'Not Recorded', 'Section A card shows Not Recorded');
    }

  } catch (err: any) {
    console.error('Test run failed:', err);
    process.exitCode = 1;
  } finally {
    if (tempSessionId) {
      console.log('\n--- Cleaning up temporary test second session ---');
      await client.query(`DELETE FROM attendance_records WHERE attendance_session_id = $1`, [tempSessionId]);
      await client.query(`DELETE FROM attendance_sessions WHERE id = $1`, [tempSessionId]);
      console.log('   Cleaned up temporary second session.');
    }
    await client.end();
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} of ${total} tests passed (${((passed / total) * 100).toFixed(1)}%).`);
  console.log('================================================================================');
}

runAttendanceSyncVerification();
