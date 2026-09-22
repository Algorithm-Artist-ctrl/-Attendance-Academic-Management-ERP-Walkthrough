import { UserRole } from '../../types/database.types';

export interface RouteParseResult {
  tab: string;
  isTeachingMode: boolean;
  params: Record<string, any> | null;
  canonicalPath: string;
  isAuthorized: boolean;
  requiresRedirect: boolean;
}

const HOD_MODE_STORAGE_KEY = 'vctm_hod_active_mode';

/**
 * Persist HOD UI mode preference ('teaching' | 'management')
 */
export function getStoredHODMode(): 'teaching' | 'management' | null {
  try {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(HOD_MODE_STORAGE_KEY) || localStorage.getItem(HOD_MODE_STORAGE_KEY);
      if (stored === 'teaching' || stored === 'management') {
        return stored;
      }
    }
  } catch {}
  return null;
}

export function setStoredHODMode(mode: 'teaching' | 'management'): void {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(HOD_MODE_STORAGE_KEY, mode);
      localStorage.setItem(HOD_MODE_STORAGE_KEY, mode);
    }
  } catch {}
}

/**
 * Parses query string into key-value object
 */
export function parseQueryString(search: string): Record<string, any> {
  const params: Record<string, any> = {};
  if (!search) return params;
  const clean = search.startsWith('?') ? search.slice(1) : search;
  const pairs = clean.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const [rawKey, rawVal] = pair.split('=');
    const key = decodeURIComponent(rawKey);
    const val = rawVal !== undefined ? decodeURIComponent(rawVal) : true;
    params[key] = val;
  }
  return params;
}

/**
 * Builds query string from parameters object
 */
export function buildQueryString(params?: Record<string, any> | null): string {
  if (!params || Object.keys(params).length === 0) return '';
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  const parts = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return `?${parts.join('&')}`;
}

/**
 * Tab to route path slug mapping for each role
 */
const STUDENT_TAB_TO_SLUG: Record<string, string> = {
  dashboard: 'dashboard',
  profile: 'profile',
  attendance: 'attendance',
  timetable: 'timetable',
  student_assignments: 'assignments',
  quizzes: 'quizzes',
  marks: 'marks',
  notices: 'notices',
  messages: 'messages',
  feedback: 'feedback',
  leave: 'leave',
  corrections: 'corrections',
  settings: 'settings',
};

const STUDENT_SLUG_TO_TAB: Record<string, string> = {
  '': 'dashboard',
  dashboard: 'dashboard',
  home: 'dashboard',
  profile: 'profile',
  attendance: 'attendance',
  timetable: 'timetable',
  assignments: 'student_assignments',
  student_assignments: 'student_assignments',
  quizzes: 'quizzes',
  marks: 'marks',
  sessional: 'marks',
  notices: 'notices',
  messages: 'messages',
  feedback: 'feedback',
  leave: 'leave',
  corrections: 'corrections',
  requests: 'corrections',
  settings: 'settings',
};

const FACULTY_TAB_TO_SLUG: Record<string, string> = {
  dashboard: 'dashboard',
  profile: 'profile',
  take_attendance: 'take-attendance',
  timetable: 'timetable',
  quizzes: 'quizzes',
  faculty_assignments: 'assignments',
  section_workspace: 'section-workspace',
  marks_and_assessments: 'marks-assessments',
  sessional_marks: 'marks-assessments',
  history: 'attendance-history',
  students: 'students',
  reports: 'reports',
  notices: 'notices',
  messages: 'messages',
  leave: 'leave',
  corrections: 'corrections',
  settings: 'settings',
};

const FACULTY_SLUG_TO_TAB: Record<string, string> = {
  '': 'dashboard',
  dashboard: 'dashboard',
  home: 'dashboard',
  profile: 'profile',
  'take-attendance': 'take_attendance',
  attendance: 'take_attendance',
  'today-classes': 'take_attendance',
  timetable: 'timetable',
  quizzes: 'quizzes',
  assignments: 'faculty_assignments',
  faculty_assignments: 'faculty_assignments',
  'section-workspace': 'section_workspace',
  'marks-assessments': 'marks_and_assessments',
  marks: 'marks_and_assessments',
  'sessional-marks': 'marks_and_assessments',
  'attendance-history': 'history',
  history: 'history',
  students: 'students',
  reports: 'reports',
  notices: 'notices',
  messages: 'messages',
  leave: 'leave',
  corrections: 'corrections',
  settings: 'settings',
};

const HOD_MANAGEMENT_TAB_TO_SLUG: Record<string, string> = {
  dashboard: 'dashboard',
  profile: 'profile',
  academic_oversight: 'academic-oversight',
  take_attendance: 'take-attendance',
  timetable: 'timetable',
  academic_management: 'academic-management',
  academic_setup: 'academic-setup',
  subjects: 'subjects',
  faculty_assignments: 'faculty-assignments',
  quizzes: 'quizzes',
  faculty_assignments_content: 'assignments',
  section_workspace: 'section-workspace',
  marks_and_assessments: 'marks-assessments',
  sessional_marks: 'marks-assessments',
  history: 'attendance-history',
  students: 'students',
  import: 'student-onboarding',
  faculty: 'faculty',
  notices: 'notices',
  messages: 'messages',
  leave: 'leave',
  reports: 'reports',
  corrections: 'corrections',
  settings: 'settings',
};

const HOD_MANAGEMENT_SLUG_TO_TAB: Record<string, string> = {
  '': 'dashboard',
  dashboard: 'dashboard',
  home: 'dashboard',
  profile: 'profile',
  'academic-oversight': 'academic_oversight',
  oversight: 'academic_oversight',
  'take-attendance': 'take_attendance',
  attendance: 'take_attendance',
  timetable: 'timetable',
  'academic-management': 'academic_management',
  'academic-setup': 'academic_setup',
  'section-management': 'academic_setup',
  subjects: 'subjects',
  'faculty-assignments': 'faculty_assignments',
  quizzes: 'quizzes',
  assignments: 'faculty_assignments_content',
  'section-workspace': 'section_workspace',
  'marks-assessments': 'marks_and_assessments',
  marks: 'marks_and_assessments',
  'attendance-history': 'history',
  history: 'history',
  students: 'students',
  'student-onboarding': 'import',
  import: 'import',
  faculty: 'faculty',
  notices: 'notices',
  messages: 'messages',
  leave: 'leave',
  reports: 'reports',
  corrections: 'corrections',
  settings: 'settings',
};

const ADMIN_TAB_TO_SLUG: Record<string, string> = {
  dashboard: 'dashboard',
  profile: 'profile',
  faculty_accounts: 'faculty-accounts',
  student_accounts: 'student-accounts',
  academic_management: 'academic-management',
  academic_setup: 'academic-setup',
  students: 'student-accounts',
  faculty: 'faculty-accounts',
  subjects: 'subjects',
  faculty_assignments: 'faculty-assignments',
  timetable: 'timetable',
  import: 'import',
  reports: 'reports',
  corrections: 'corrections',
  notices: 'notices',
  messages: 'messages',
  leave: 'leave',
  audit_logs: 'audit-logs',
  records_archive: 'records-archive',
  settings: 'settings',
};

const ADMIN_SLUG_TO_TAB: Record<string, string> = {
  '': 'dashboard',
  dashboard: 'dashboard',
  home: 'dashboard',
  profile: 'profile',
  'faculty-accounts': 'faculty_accounts',
  faculty: 'faculty_accounts',
  'student-accounts': 'student_accounts',
  students: 'student_accounts',
  'academic-management': 'academic_management',
  'academic-setup': 'academic_setup',
  subjects: 'subjects',
  'faculty-assignments': 'faculty_assignments',
  timetable: 'timetable',
  import: 'import',
  'csv-import': 'import',
  reports: 'reports',
  corrections: 'corrections',
  notices: 'notices',
  messages: 'messages',
  leave: 'leave',
  'audit-logs': 'audit_logs',
  'records-archive': 'records_archive',
  archive: 'records_archive',
  settings: 'settings',
};

/**
 * Returns the canonical URL path for a given role, tab, mode, and parameters
 */
export function getCanonicalPath(
  role: UserRole | null | undefined,
  tab: string,
  isTeachingMode: boolean = false,
  params?: Record<string, any> | null
): string {
  const queryStr = buildQueryString(params);

  if (!role) {
    return `/${tab === 'dashboard' ? '' : tab}${queryStr}`;
  }

  if (role === 'student') {
    const slug = STUDENT_TAB_TO_SLUG[tab] || 'dashboard';
    return `/student/${slug}${queryStr}`;
  }

  if (role === 'faculty') {
    const slug = FACULTY_TAB_TO_SLUG[tab] || 'dashboard';
    return `/faculty/${slug}${queryStr}`;
  }

  if (role === 'hod') {
    if (isTeachingMode) {
      const slug = FACULTY_TAB_TO_SLUG[tab] || 'dashboard';
      if (slug === 'dashboard') {
        return `/hod/teaching${queryStr}`;
      }
      return `/hod/teaching/${slug}${queryStr}`;
    }
    const slug = HOD_MANAGEMENT_TAB_TO_SLUG[tab] || 'dashboard';
    return `/hod/${slug}${queryStr}`;
  }

  if (role === 'super_admin') {
    const slug = ADMIN_TAB_TO_SLUG[tab] || 'dashboard';
    return `/admin/${slug}${queryStr}`;
  }

  return `/dashboard${queryStr}`;
}

/**
 * Inspects pathname and search to synchronously resolve route, tab, mode, and params.
 * Used during application bootstrap and popstate events.
 */
export function parseCurrentRoute(
  pathname: string,
  search: string = '',
  role?: UserRole | null
): RouteParseResult {
  const queryParams = parseQueryString(search);
  const normalizedPath = (pathname || '/').trim();
  const segments = normalizedPath.split('/').filter(Boolean);

  const firstSeg = segments[0]?.toLowerCase() || '';
  const secondSeg = segments[1]?.toLowerCase() || '';
  const thirdSeg = segments[2]?.toLowerCase() || '';

  // 1. Check for HOD Teaching Mode paths: /hod/teaching and /hod/teaching/*
  if (firstSeg === 'hod' && secondSeg === 'teaching') {
    const teachingSlug = thirdSeg || '';
    const resolvedTab = FACULTY_SLUG_TO_TAB[teachingSlug] || 'dashboard';
    const isAuthorized = !role || role === 'hod';
    const canonical = getCanonicalPath('hod', resolvedTab, true, queryParams);

    return {
      tab: resolvedTab,
      isTeachingMode: true,
      params: Object.keys(queryParams).length > 0 ? queryParams : null,
      canonicalPath: canonical,
      isAuthorized,
      requiresRedirect: !isAuthorized,
    };
  }

  // 2. Direct /teaching alias (e.g. shortcut for HOD teaching mode)
  if (firstSeg === 'teaching') {
    const teachingSlug = secondSeg || '';
    const resolvedTab = FACULTY_SLUG_TO_TAB[teachingSlug] || 'dashboard';
    const isAuthorized = !role || role === 'hod' || role === 'faculty';
    const effectiveRole = role === 'hod' ? 'hod' : 'faculty';
    const canonical = getCanonicalPath(effectiveRole, resolvedTab, effectiveRole === 'hod', queryParams);

    return {
      tab: resolvedTab,
      isTeachingMode: effectiveRole === 'hod',
      params: Object.keys(queryParams).length > 0 ? queryParams : null,
      canonicalPath: canonical,
      isAuthorized,
      requiresRedirect: true,
    };
  }

  // 3. Check for HOD Management Mode paths: /hod and /hod/*
  if (firstSeg === 'hod') {
    const hodSlug = secondSeg || '';
    const resolvedTab = HOD_MANAGEMENT_SLUG_TO_TAB[hodSlug] || 'dashboard';
    const isAuthorized = !role || role === 'hod';
    const canonical = getCanonicalPath('hod', resolvedTab, false, queryParams);

    return {
      tab: resolvedTab,
      isTeachingMode: false,
      params: Object.keys(queryParams).length > 0 ? queryParams : null,
      canonicalPath: canonical,
      isAuthorized,
      requiresRedirect: !isAuthorized,
    };
  }

  // 4. Check for Faculty Portal paths: /faculty and /faculty/*
  if (firstSeg === 'faculty') {
    const facultySlug = secondSeg || '';
    const resolvedTab = FACULTY_SLUG_TO_TAB[facultySlug] || 'dashboard';
    const isAuthorized = !role || role === 'faculty' || role === 'hod';
    const canonical = getCanonicalPath('faculty', resolvedTab, false, queryParams);

    return {
      tab: resolvedTab,
      isTeachingMode: false,
      params: Object.keys(queryParams).length > 0 ? queryParams : null,
      canonicalPath: canonical,
      isAuthorized,
      requiresRedirect: !isAuthorized,
    };
  }

  // 5. Check for Student Portal paths: /student and /student/*
  if (firstSeg === 'student') {
    const studentSlug = secondSeg || '';
    const resolvedTab = STUDENT_SLUG_TO_TAB[studentSlug] || 'dashboard';
    const isAuthorized = !role || role === 'student';
    const canonical = getCanonicalPath('student', resolvedTab, false, queryParams);

    return {
      tab: resolvedTab,
      isTeachingMode: false,
      params: Object.keys(queryParams).length > 0 ? queryParams : null,
      canonicalPath: canonical,
      isAuthorized,
      requiresRedirect: !isAuthorized,
    };
  }

  // 6. Check for Admin Portal paths: /admin and /admin/*
  if (firstSeg === 'admin') {
    const adminSlug = secondSeg || '';
    const resolvedTab = ADMIN_SLUG_TO_TAB[adminSlug] || 'dashboard';
    const isAuthorized = !role || role === 'super_admin';
    const canonical = getCanonicalPath('super_admin', resolvedTab, false, queryParams);

    return {
      tab: resolvedTab,
      isTeachingMode: false,
      params: Object.keys(queryParams).length > 0 ? queryParams : null,
      canonicalPath: canonical,
      isAuthorized,
      requiresRedirect: !isAuthorized,
    };
  }

  // 7. Generic root / dashboard or un-prefixed common slugs (e.g. /attendance, /timetable, /notices, etc.)
  const genericSlug = firstSeg;
  const storedHODMode = getStoredHODMode();
  const effectiveTeachingMode = role === 'hod' && storedHODMode === 'teaching';

  let resolvedTab = 'dashboard';
  if (genericSlug && genericSlug !== 'dashboard' && genericSlug !== 'home') {
    if (role === 'student') {
      resolvedTab = STUDENT_SLUG_TO_TAB[genericSlug] || 'dashboard';
    } else if (role === 'faculty') {
      resolvedTab = FACULTY_SLUG_TO_TAB[genericSlug] || 'dashboard';
    } else if (role === 'hod') {
      if (effectiveTeachingMode) {
        resolvedTab = FACULTY_SLUG_TO_TAB[genericSlug] || 'dashboard';
      } else {
        resolvedTab = HOD_MANAGEMENT_SLUG_TO_TAB[genericSlug] || 'dashboard';
      }
    } else if (role === 'super_admin') {
      resolvedTab = ADMIN_SLUG_TO_TAB[genericSlug] || 'dashboard';
    } else {
      // Role not resolved yet: match against general common slugs
      resolvedTab =
        FACULTY_SLUG_TO_TAB[genericSlug] ||
        STUDENT_SLUG_TO_TAB[genericSlug] ||
        ADMIN_SLUG_TO_TAB[genericSlug] ||
        'dashboard';
    }
  }

  const canonical = getCanonicalPath(role, resolvedTab, effectiveTeachingMode, queryParams);

  return {
    tab: resolvedTab,
    isTeachingMode: effectiveTeachingMode,
    params: Object.keys(queryParams).length > 0 ? queryParams : null,
    canonicalPath: canonical,
    isAuthorized: true,
    requiresRedirect: false,
  };
}
