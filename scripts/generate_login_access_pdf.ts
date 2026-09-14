import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../src/lib/supabase/supabaseClient';

async function generateLoginAccessPDF() {
  console.log('================================================================');
  console.log('📄 GENERATING OFFICIAL VCTM ERP LOGIN ACCESS & CREDENTIALS PDF');
  console.log('================================================================\n');

  // 1. Fetch live database records from Supabase
  console.log('📡 Fetching live data from Supabase Cloud...');
  const [
    { data: instData },
    { data: deptsData },
    { data: progsData },
    { data: sessData },
    { data: yearsData },
    { data: semsData },
    { data: secsData },
    { data: facultyData },
    { data: studentsData }
  ] = await Promise.all([
    supabase.from('institutions').select('*'),
    supabase.from('departments').select('*'),
    supabase.from('programs').select('*'),
    supabase.from('academic_sessions').select('*'),
    supabase.from('academic_years').select('*').order('year_number'),
    supabase.from('semesters').select('*').order('semester_number'),
    supabase.from('sections').select('*').order('name'),
    supabase.from('faculty').select('*').order('employee_code'),
    supabase.from('students').select('*').order('roll_number')
  ]);

  const institution = instData?.[0] || {
    name: 'Vivekananda College of Technology & Management, Aligarh',
    code: '340',
    address: 'Mathura Bypass Road, Near Khair Road Crossing, Aligarh, Uttar Pradesh 202001',
    website: 'https://vctm.in',
  };

  const activeSession = sessData?.find(s => s.is_current)?.name || '2026-2027';
  const faculty = facultyData || [];
  const students = studentsData || [];
  const sections = secsData || [];
  const years = yearsData || [];
  const semesters = semsData || [];

  const secMap = new Map(sections.map(s => [s.id, s.name]));
  const yrMap = new Map(years.map(y => [y.id, y.name]));
  const facMap = new Map(faculty.map(f => [f.id, f.full_name]));

  console.log(`✅ Loaded ${faculty.length} faculty and ${students.length} students from database.`);

  // 2. Initialize jsPDF instance
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;

  // Colors
  const primaryNavy = [10, 25, 47];       // #0a192f
  const primaryEmerald = [5, 150, 105];   // #059669
  const darkSlate = [30, 41, 59];         // #1e293b
  const lightGrayBg = [248, 250, 252];    // #f8fafc
  const textDark = [15, 23, 42];          // #0f172a
  const textMuted = [100, 116, 139];      // #64748b

  // Read logo if available
  let logoBase64: string | null = null;
  try {
    const logoPath = path.resolve('public/vctm-logo.png');
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath).toString('base64');
    }
  } catch (e) {
    console.warn('Could not read logo image:', e);
  }

  // =========================================================================
  // PAGE 1: COVER & ADMINISTRATIVE GOVERNANCE
  // =========================================================================
  let currentY = 14;

  // Top Institutional Header Block
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', marginX, currentY, 20, 20);
  }

  const textStartX = logoBase64 ? marginX + 24 : marginX;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('VIVEKANANDA COLLEGE OF TECHNOLOGY & MANAGEMENT', textStartX, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Approved by AICTE, New Delhi • Affiliated to Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow', textStartX, currentY + 10);
  doc.text('College Code: 340  •  Mathura Bypass Road, Near Khair Road Crossing, Aligarh, U.P. 202001  •  https://vctm.in', textStartX, currentY + 14);

  currentY += 24;

  // Horizontal Accent Divider
  doc.setDrawColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.setLineWidth(1.2);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 6;

  // Document Title Banner Box
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 22, 2.5, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('CAMPUS ERP PORTAL — LOGIN ACCESS & CREDENTIALS DIRECTORY', pageWidth / 2, currentY + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 255, 136);
  doc.text(`Official Academic Session: ${activeSession}  •  Department of Computer Science & Engineering  •  Release v2.0`, pageWidth / 2, currentY + 14, { align: 'center' });

  currentY += 28;

  // Metadata Box
  doc.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 16, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Document Type:', marginX + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('Confidential Access Manual & Directory', marginX + 28, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Access Portal URL:', marginX + 90, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.text('https://vctm-erp.vercel.app  /  http://localhost:5173', marginX + 118, currentY + 6);

  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('System Architect:', marginX + 4, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text('Tarun Kushwah (Super Administrator)', marginX + 28, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Issue Date:', marginX + 90, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text('September 2026 (Live Database Synchronized)', marginX + 107, currentY + 12);

  currentY += 22;

  // Section 1: Executive Login Architecture
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('1. Institutional Login Portal Architecture', marginX, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const overviewText = 
    'The VCTM ERP platform features a unified, 3-tab role-specific cyber authentication gateway. ' +
    'Users choose their designated role tab (Student, Faculty / HOD, or Admin) and authenticate with their ' +
    'institutional credentials. All records are resolved dynamically against the live PostgreSQL database.';
  doc.text(doc.splitTextToSize(overviewText, pageWidth - (marginX * 2)), marginX, currentY);

  currentY += 12;

  // 3-Tab Summary AutoTable
  autoTable(doc, {
    startY: currentY,
    head: [['Role Tab', 'Eligible Users', 'Primary Login Identifier', 'Default Password', 'Target Access Scope']],
    body: [
      ['Student', 'All Enrolled B.Tech Students', 'University Roll Number (13-digit)', 'student123  /  vctm@2026', 'Personal Timetable, Live Attendance, Claims & Sessional Scorecard'],
      ['Faculty / HOD', 'Professors, HOD & Lab Faculty', 'Official Email  /  Employee Code', 'faculty@123  /  password123', 'Attendance Marking, Subject Workspaces, Timetable & Assessment'],
      ['Admin', 'Super Administrator', 'admin  /  admin@vctm.in', 'admin@123  /  password123', 'Institutional Master Data, Roster Ingestion, Structure & Security Audit']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.8,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 26 },
      1: { cellWidth: 38 },
      2: { fontStyle: 'bold', cellWidth: 42 },
      3: { cellWidth: 32 },
      4: { cellWidth: 44 }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Section 2: Administrative & Departmental Governance Logins
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('2. Administrative & Departmental Governance Accounts', marginX, currentY);

  currentY += 5;

  autoTable(doc, {
    startY: currentY,
    head: [['Role / Authority', 'Official Name', 'Login Tab', 'Login Identifier / Email', 'Default Password', 'Operational Responsibilities']],
    body: [
      [
        'SUPER ADMIN\n(Institutional Owner)',
        'Tarun Kushwah',
        'Admin',
        'admin\nadmin@vctm.in',
        'password123\nadmin@123',
        'Owns Institutional Master Data (Departments, Programs, Sessions, Years, Semesters, Sections), Student Master Roster, Google Sheets Ingestion & Security Audit Logs.'
      ],
      [
        'HEAD OF DEPARTMENT\n(HOD - CSE)',
        'Mr. Wasim',
        'Faculty / HOD',
        'wasim.cse@vctm.in\nFAC-CSE-001',
        'password123\nfaculty@123',
        'Owns Department Timetable Operations (Live editing, CSV sync, AI ingestion, section publishing, version rollback), Teaching Workloads & Attendance Claims.'
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.8,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 34 },
      1: { fontStyle: 'bold', cellWidth: 28 },
      2: { cellWidth: 22 },
      3: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 34 },
      4: { cellWidth: 24 },
      5: { cellWidth: 40 }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // =========================================================================
  // PAGE 2: FACULTY CREDENTIALS DIRECTORY (ALL 10 FACULTY)
  // =========================================================================
  doc.addPage();
  currentY = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('3. Faculty Members Credentials Directory (Department of CSE)', marginX, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    'All faculty members log in under the "Faculty / HOD" tab using either their official institutional email address or ' +
    'their assigned Employee Code. Faculty can mark lecture attendance, view assigned timetables, and evaluate assignments.',
    marginX,
    currentY
  );

  currentY += 8;

  const facultyRows = faculty.map((f, idx) => {
    let roleDesc = 'Faculty Member';
    if (f.designation.toLowerCase().includes('hod')) {
      roleDesc = 'Head of Department (CSE)';
    } else if (f.designation.toLowerCase().includes('coordinator (sec a)')) {
      roleDesc = 'Section A Class Coordinator';
    } else if (f.designation.toLowerCase().includes('coordinator (sec b)')) {
      roleDesc = 'Section B Class Coordinator';
    }

    return [
      String(idx + 1),
      f.employee_code || '—',
      f.faculty_code || '—',
      f.full_name,
      f.designation,
      f.email,
      'password123',
      roleDesc
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Emp Code', 'Code', 'Faculty Name', 'Designation', 'Official Email (Login ID)', 'Password', 'Role']],
    body: facultyRows,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { fontStyle: 'bold', cellWidth: 20 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      3: { fontStyle: 'bold', cellWidth: 35 },
      4: { cellWidth: 40 },
      5: { textColor: [5, 150, 105], fontStyle: 'bold', cellWidth: 35 },
      6: { cellWidth: 17 },
      7: { cellWidth: 16 }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Student Access Overview Callout Box
  doc.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
  doc.setDrawColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.text('4. Student Login Access Protocol (Roll-Number-Driven Authentication)', marginX + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const studentGuidance = [
    '• Login Gateway: Select the "Student" tab on the ERP portal login screen.',
    '• Identifier: Enter the official 13-digit University Roll Number (e.g. 2403400100040, 2503400100001, 2603400139001).',
    '• Default Password: Use "student123" or "vctm@2026" (or student date of birth as registered during enrollment).',
    '• Single Source of Truth: When a student logs in, the ERP dynamically resolves their exact Academic Year, Semester, and Section (A or B).',
    '• Student Features: Personalized daily timetable, subject-wise attendance percentages, 75% eligibility tracker, 7-day attendance claim requests, sessional scorecards, and LMS course assignments.'
  ];
  let bulletY = currentY + 11;
  studentGuidance.forEach(bullet => {
    doc.text(bullet, marginX + 4, bulletY);
    bulletY += 4.4;
  });

  // =========================================================================
  // PAGE 3: STUDENT ROSTER — 2ND YEAR SECTION A (53 STUDENTS)
  // =========================================================================
  doc.addPage();
  currentY = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('Student Access Directory: B.Tech CSE 2nd Year — Section A (53 Students)', marginX, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Academic Session: 2026-2027  •  Semester: 3rd Semester  •  Class Coordinator: Ms. Hemlata Chaudhary (FAC-CSE-002)', marginX, currentY);

  currentY += 6;

  // Filter 2nd Year Sec A students
  const secAStudents = students.filter(s => {
    const yr = yrMap.get(s.academic_year_id) || '';
    const sec = secMap.get(s.section_id) || '';
    return yr.includes('2nd') && sec === 'A';
  });

  const secARows = secAStudents.map((s, idx) => [
    String(idx + 1),
    s.roll_number,
    s.full_name,
    '2nd Year / Sem 3',
    'Section A',
    s.admission_type || 'Regular',
    facMap.get(s.mentor_faculty_id) || 'Faculty Mentor',
    'student123'
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'University Roll No', 'Student Full Name', 'Year & Sem', 'Sec', 'Admission', 'Faculty Mentor', 'Password']],
    body: secARows,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 26 },
      2: { fontStyle: 'bold', cellWidth: 46 },
      3: { cellWidth: 24 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      5: { cellWidth: 18 },
      6: { cellWidth: 32 },
      7: { cellWidth: 17 }
    },
    margin: { left: marginX, right: marginX }
  });

  // =========================================================================
  // PAGE 4: STUDENT ROSTER — 2ND YEAR SECTION B (53 STUDENTS)
  // =========================================================================
  doc.addPage();
  currentY = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('Student Access Directory: B.Tech CSE 2nd Year — Section B (53 Students)', marginX, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Academic Session: 2026-2027  •  Semester: 3rd Semester  •  Class Coordinator: Mr. Imran Raza Khan (FAC-CSE-003)', marginX, currentY);

  currentY += 6;

  // Filter 2nd Year Sec B students
  const secBStudents = students.filter(s => {
    const yr = yrMap.get(s.academic_year_id) || '';
    const sec = secMap.get(s.section_id) || '';
    return yr.includes('2nd') && sec === 'B';
  });

  const secBRows = secBStudents.map((s, idx) => [
    String(idx + 1),
    s.roll_number,
    s.full_name,
    '2nd Year / Sem 3',
    'Section B',
    s.admission_type || 'Regular',
    facMap.get(s.mentor_faculty_id) || 'Faculty Mentor',
    'student123'
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'University Roll No', 'Student Full Name', 'Year & Sem', 'Sec', 'Admission', 'Faculty Mentor', 'Password']],
    body: secBRows,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 26 },
      2: { fontStyle: 'bold', cellWidth: 46 },
      3: { cellWidth: 24 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      5: { cellWidth: 18 },
      6: { cellWidth: 32 },
      7: { cellWidth: 17 }
    },
    margin: { left: marginX, right: marginX }
  });

  // =========================================================================
  // PAGE 5: MULTI-YEAR ENROLLED COHORTS & SECURITY / IT SUPPORT PROTOCOL
  // =========================================================================
  doc.addPage();
  currentY = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('5. Multi-Year Enrolled Cohorts & Pilot Section Roster', marginX, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Enrolled students representing 1st Year, 3rd Year, and 4th Year institutional sections.', marginX, currentY);

  currentY += 6;

  // Other enrolled students
  const otherStudents = students.filter(s => {
    const yr = yrMap.get(s.academic_year_id) || '';
    return !yr.includes('2nd');
  });

  const otherRows = otherStudents.map((s, idx) => [
    String(idx + 1),
    s.roll_number,
    s.full_name,
    yrMap.get(s.academic_year_id) || 'Academic Year',
    `Sec ${secMap.get(s.section_id) || 'A'}`,
    s.admission_type || 'Regular',
    facMap.get(s.mentor_faculty_id) || 'Faculty Mentor',
    'student123'
  ]);

  if (otherRows.length === 0) {
    otherRows.push(['1', '2403400100099', 'SAMPLE 1ST YEAR STUDENT', '1st Year', 'Sec A', 'Regular', 'Faculty Mentor', 'student123']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'University Roll No', 'Student Full Name', 'Academic Year', 'Sec', 'Admission', 'Faculty Mentor', 'Password']],
    body: otherRows,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 28 },
      2: { fontStyle: 'bold', cellWidth: 44 },
      3: { cellWidth: 24 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      5: { cellWidth: 20 },
      6: { cellWidth: 26 },
      7: { cellWidth: 18 }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Security Protocols & RBAC Governance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('6. Security Governance & Role-Based Access Control (RBAC)', marginX, currentY);

  currentY += 6;

  autoTable(doc, {
    startY: currentY,
    head: [['Module / Feature', 'Student', 'Faculty Member', 'Head of Dept (HOD)', 'Super Administrator']],
    body: [
      ['View Live Timetable', 'Personal Section Only', 'Assigned Classes', 'Entire Department', 'All Institutional Years'],
      ['Mark Lecture Attendance', 'No (View-only)', 'Own Scheduled Lectures', 'All Department Sections', 'Global Oversight'],
      ['Manage Timetable & Sync', 'No Access', 'No Access', 'Full Edit, Sync, Publish & Rollback', 'No (HOD Owned)'],
      ['Manage Master Setup', 'No Access', 'No Access', 'View-only', 'Full Master Data Governance'],
      ['Submit / Review Claims', 'Submit Claim (7-day window)', 'Review & Approve Claims', 'Oversight & Department Audit', 'Global Audit Trail'],
      ['Internal Marks & Quizzes', 'Personal Scorecard View', 'Evaluate & Grade', 'Department Oversight', 'Institutional Reports']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42 },
      1: { cellWidth: 32 },
      2: { cellWidth: 36 },
      3: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 36 },
      4: { fontStyle: 'bold', textColor: [10, 25, 47], cellWidth: 36 }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // IT Helpdesk & Support Box
  doc.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('Technical Support & Credential Assistance Desk', marginX + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('• Password Reset: Users can use the "Forgot Password?" prompt on the login screen to receive a verification reset link.', marginX + 4, currentY + 11);
  doc.text('• Account Queries: Contact the Department of Computer Science & Engineering or Super Administrator (Tarun Kushwah).', marginX + 4, currentY + 16);
  doc.text('• IT Center Helpline: admin@vctm.in  •  Campus Office: Computer Science Building, 2nd Floor, VCTM Aligarh Campus.', marginX + 4, currentY + 21);

  // =========================================================================
  // RUNNING HEADERS & FOOTERS (ACROSS ALL PAGES)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running Header (Pages 2 onwards)
    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('VIVEKANANDA COLLEGE OF TECHNOLOGY & MANAGEMENT  •  ERP LOGIN ACCESS & CREDENTIALS MANUAL', marginX, 10);
      doc.text(`Code: 340  •  Session: ${activeSession}`, pageWidth - marginX, 10, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(marginX, 11.5, pageWidth - marginX, 11.5);
    }

    // Running Footer (All pages)
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Confidential Access Directory  •  VCTM Aligarh (Code: 340)', marginX, pageHeight - 7.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 7.5, { align: 'right' });
    doc.text('© 2026 Tarun Kushwah', pageWidth / 2, pageHeight - 7.5, { align: 'center' });
  }

  // 3. Save PDF to disk in both root and public directories
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  
  const rootFilePath = path.resolve('VCTM_ERP_Login_Access_Directory.pdf');
  const publicFilePath = path.resolve('public/VCTM_ERP_Login_Access_Directory.pdf');

  fs.writeFileSync(rootFilePath, pdfBuffer);
  fs.writeFileSync(publicFilePath, pdfBuffer);

  console.log('\n================================================================');
  console.log('🎉 PDF GENERATED SUCCESSFULLY!');
  console.log(`📄 Total Pages: ${totalPages}`);
  console.log(`💾 File Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`📍 Saved to Workspace Root: ${rootFilePath}`);
  console.log(`📍 Saved to Public Web Directory: ${publicFilePath}`);
  console.log('================================================================\n');
}

generateLoginAccessPDF().catch(err => {
  console.error('Fatal error generating PDF:', err);
  process.exit(1);
});
