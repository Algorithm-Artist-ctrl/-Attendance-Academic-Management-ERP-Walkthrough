import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function generatePDF() {
  console.log('Connecting to PostgreSQL to fetch directory data...');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('Connected to database. Fetching accounts...');

  // 1. Fetch Super Admin
  const adminRes = await client.query(`
    SELECT id, email, full_name, role 
    FROM public.profiles 
    WHERE role = 'super_admin'
  `);
  const admin = adminRes.rows[0] || {
    full_name: 'Tarun Kushwah',
    email: 'admin@vctm.in',
    role: 'super_admin'
  };

  // 2. Fetch Faculty Members (excluding test dummy records)
  const facRes = await client.query(`
    SELECT f.id, f.employee_code, f.faculty_code, f.full_name, f.designation, f.email, d.name as dept_name
    FROM public.faculty f
    LEFT JOIN public.departments d ON d.id = f.department_id
    WHERE f.active = true
      AND f.full_name NOT ILIKE '%AUTOMATED TEST%'
      AND f.employee_code NOT LIKE 'FAC_TEST_%'
    ORDER BY 
      CASE 
        WHEN f.employee_code = 'FAC-CSE-001' THEN 1
        WHEN f.employee_code = 'FAC-CSE-002' THEN 2
        WHEN f.employee_code = 'FAC-CSE-003' THEN 3
        ELSE 4
      END,
      f.employee_code ASC
  `);
  const facultyList = facRes.rows;

  // 3. Fetch Students grouped by year (excluding test dummy records)
  const stuRes = await client.query(`
    SELECT s.roll_number, s.full_name, s.email, sec.name as section_name, ay.year_number, ay.name as year_name
    FROM public.students s
    LEFT JOIN public.sections sec ON sec.id = s.section_id
    LEFT JOIN public.academic_years ay ON ay.id = s.academic_year_id
    WHERE s.active = true
      AND s.full_name NOT ILIKE '%AUTOMATED TEST%'
      AND s.roll_number NOT LIKE 'TEST_%'
    ORDER BY ay.year_number ASC, sec.name ASC, s.roll_number ASC
  `);
  const allStudents = stuRes.rows;
  const studentsY2 = allStudents.filter(s => s.year_number === 2);
  const studentsY3 = allStudents.filter(s => s.year_number === 3);
  const studentsY4 = allStudents.filter(s => s.year_number === 4);

  await client.end();
  console.log(`Fetched ${facultyList.length} genuine faculty and ${allStudents.length} genuine students.`);

  // Initialize jsPDF document (A4, portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Load Logo
  const logoPath = path.join(process.cwd(), 'src', 'assets', 'vctm-logo.png');
  let logoBase64 = '';
  if (fs.existsSync(logoPath)) {
    logoBase64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
  }

  // Track pages where a section header was explicitly rendered
  const sectionStartPages = new Set<number>();

  // Helper for Top Institutional Header
  const renderHeader = (title: string, subtitle?: string) => {
    sectionStartPages.add(doc.getNumberOfPages());

    // Header background line
    doc.setFillColor(15, 41, 66); // Navy
    doc.rect(0, 0, pageWidth, 5, 'F');

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 14, 10, 15, 15);
      } catch (e) {
        // Fallback if image fails
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 41, 66);
    doc.text('VIVEKANANDA COLLEGE OF TECHNOLOGY & MANAGEMENT', 33, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('College Code: 340 | Affiliated to AKTU, Lucknow | Approved by AICTE, New Delhi', 33, 19.5);
    doc.text('Central ERP Management System • Academic Session 2026–2027', 33, 23.5);

    // Section title banner
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 27, pageWidth - 14, 27);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text(title.toUpperCase(), 14, 33);

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, 14, 37.5);
    }
  };

  // -------------------------------------------------------------
  // PAGE 1: COVER & EXECUTIVE DIRECTORY OVERVIEW
  // -------------------------------------------------------------
  renderHeader('Master Login Access & Credentials Directory', 'Complete Authentication & Role Directory for Super Admin, Faculty, and Students');

  // Overview box
  let curY = 43;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, curY, pageWidth - 28, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 41, 66);
  doc.text('Institutional Portal Access & Multi-Identifier Guidelines', 18, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('• Flexible Authentication: Users can sign in using either their Official Email OR their Institutional ID.', 18, curY + 12);
  doc.text('  - Students: Enter University Roll Number (e.g., 2503400100001) or Official Email (e.g., 2503400100001@student.vctm.in).', 18, curY + 16.5);
  doc.text('  - Faculty / HOD: Enter Employee Code (e.g., FAC-CSE-001) or Official Email (e.g., wasim.cse@vctm.in).', 18, curY + 21);
  doc.text('  - Super Administrator: Enter "admin" or "admin@vctm.in".', 18, curY + 25.5);

  curY += 37;

  // Account Directory Summary Cards
  const colW = (pageWidth - 28 - 9) / 4;
  const stats = [
    { label: 'SUPER ADMIN', count: '1', sub: 'System Owner', color: [30, 58, 95] },
    { label: 'FACULTY & HOD', count: `${facultyList.length}`, sub: 'CSE Department', color: [13, 148, 136] },
    { label: 'TOTAL STUDENTS', count: `${allStudents.length}`, sub: 'Cohorts 2nd, 3rd, 4th Yr', color: [37, 99, 235] },
    { label: 'ACTIVE SECTIONS', count: '6', sub: 'Sec A & B (All Years)', color: [217, 119, 6] },
  ];

  stats.forEach((s, idx) => {
    const x = 14 + idx * (colW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, curY, colW, 20, 2, 2, 'FD');

    // Colored left accent bar
    doc.setFillColor(s.color[0], s.color[1], s.color[2]);
    doc.rect(x, curY, 2, 20, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(s.color[0], s.color[1], s.color[2]);
    doc.text(s.label, x + 5, curY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(s.count, x + 5, curY + 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(s.sub, x + 5, curY + 17);
  });

  curY += 26;

  // Standard Default Credentials Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 41, 66);
  doc.text('Institutional Standard Default Passwords', 14, curY);
  curY += 2;

  autoTable(doc, {
    startY: curY,
    margin: { left: 14, right: 14 },
    head: [['User Role', 'Login Identifier / Keywords', 'Official Email Convention', 'Default Access Password', 'Initial Status']],
    body: [
      ['Super Administrator', 'admin', 'admin@vctm.in', 'VctmAdmin@2026', 'ACTIVE'],
      ['Head of Department (HOD)', 'FAC-CSE-001', 'wasim.cse@vctm.in', 'faculty@123', 'ACTIVE'],
      ['Faculty Members', 'Employee Code (e.g. FAC-CSE-002)', '{name}.cse@vctm.in / faculty.vctm.in', 'faculty@123', 'ACTIVE'],
      ['Students (2nd, 3rd, 4th Year)', 'University Roll Number (13 Digits)', '{roll_number}@student.vctm.in', 'student123', 'ACTIVE'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38 },
      1: { cellWidth: 42 },
      2: { cellWidth: 48 },
      3: { fontStyle: 'bold', textColor: [15, 118, 110], cellWidth: 30 },
      4: { fontStyle: 'bold', textColor: [22, 101, 52], cellWidth: 24 },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 8;

  // SECTION 1: SUPER ADMINISTRATOR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 41, 66);
  doc.text('Section 1: Central Super Administrator Account', 14, curY);
  curY += 2;

  autoTable(doc, {
    startY: curY,
    margin: { left: 14, right: 14 },
    head: [['Role', 'Administrator Name', 'Login Identifier', 'Official Email', 'Access Password', 'System Privileges']],
    body: [
      [
        'Super Administrator',
        admin.full_name,
        'admin',
        admin.email,
        'VctmAdmin@2026',
        'Full Administrative Control, Credential Management, Timetable Ingestion, Master Hierarchy, Audit Oversight'
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 41, 66],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      1: { fontStyle: 'bold', cellWidth: 32 },
      2: { cellWidth: 22 },
      3: { cellWidth: 30 },
      4: { fontStyle: 'bold', textColor: [15, 118, 110], cellWidth: 28 },
      5: { cellWidth: 'auto' },
    }
  });

  // -------------------------------------------------------------
  // PAGE 2: FACULTY & DEPARTMENT LEADERSHIP DIRECTORY
  // -------------------------------------------------------------
  doc.addPage();
  renderHeader('Section 2: Department Leadership & Faculty Master Directory', 'Computer Science & Engineering Department • All login-enabled faculty accounts');

  const facultyRows = facultyList.map((f, i) => [
    (i + 1).toString(),
    f.employee_code,
    f.faculty_code || '-',
    f.full_name,
    f.designation,
    f.email,
    'faculty@123'
  ]);

  autoTable(doc, {
    startY: 42,
    margin: { top: 20, left: 14, right: 14, bottom: 15 },
    head: [['#', 'Emp Code', 'Code', 'Faculty Name', 'Designation & Academic Role', 'Official Login Email', 'Default Password']],
    body: facultyRows,
    theme: 'striped',
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { fontStyle: 'bold', cellWidth: 26 },
      2: { cellWidth: 12, halign: 'center' },
      3: { fontStyle: 'bold', cellWidth: 38 },
      4: { cellWidth: 42 },
      5: { cellWidth: 36 },
      6: { fontStyle: 'bold', textColor: [15, 118, 110], cellWidth: 20 },
    },
  });

  // -------------------------------------------------------------
  // STUDENTS DIRECTORY (2nd Year)
  // -------------------------------------------------------------
  doc.addPage();
  renderHeader('Section 3.1: 2nd Year B.Tech CSE Student Login Directory', `Enrolled Students: ${studentsY2.length} • Section A & Section B • Default Password: student123`);

  const stuY2Rows = studentsY2.map((s, i) => [
    (i + 1).toString(),
    s.roll_number,
    s.full_name,
    `Sec ${s.section_name || 'A'}`,
    s.email,
    'student123'
  ]);

  autoTable(doc, {
    startY: 42,
    margin: { top: 20, left: 14, right: 14, bottom: 15 },
    head: [['#', 'Roll Number', 'Student Name', 'Section', 'Official Login Email', 'Default Password']],
    body: stuY2Rows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { fontStyle: 'bold', cellWidth: 32 },
      2: { fontStyle: 'bold', cellWidth: 50 },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 52 },
      5: { fontStyle: 'bold', textColor: [15, 118, 110], cellWidth: 24 },
    },
  });

  // -------------------------------------------------------------
  // STUDENTS DIRECTORY (3rd Year)
  // -------------------------------------------------------------
  doc.addPage();
  renderHeader('Section 3.2: 3rd Year B.Tech CSE Student Login Directory', `Enrolled Students: ${studentsY3.length} • Section A & Section B • Default Password: student123`);

  const stuY3Rows = studentsY3.map((s, i) => [
    (i + 1).toString(),
    s.roll_number,
    s.full_name,
    `Sec ${s.section_name || 'A'}`,
    s.email,
    'student123'
  ]);

  autoTable(doc, {
    startY: 42,
    margin: { top: 20, left: 14, right: 14, bottom: 15 },
    head: [['#', 'Roll Number', 'Student Name', 'Section', 'Official Login Email', 'Default Password']],
    body: stuY3Rows,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { fontStyle: 'bold', cellWidth: 32 },
      2: { fontStyle: 'bold', cellWidth: 50 },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 52 },
      5: { fontStyle: 'bold', textColor: [15, 118, 110], cellWidth: 24 },
    },
  });

  // -------------------------------------------------------------
  // STUDENTS DIRECTORY (4th Year)
  // -------------------------------------------------------------
  doc.addPage();
  renderHeader('Section 3.3: 4th Year B.Tech CSE Student Login Directory', `Enrolled Students: ${studentsY4.length} • Section A & Section B • Default Password: student123`);

  const stuY4Rows = studentsY4.map((s, i) => [
    (i + 1).toString(),
    s.roll_number,
    s.full_name,
    `Sec ${s.section_name || 'A'}`,
    s.email,
    'student123'
  ]);

  autoTable(doc, {
    startY: 42,
    margin: { top: 20, left: 14, right: 14, bottom: 15 },
    head: [['#', 'Roll Number', 'Student Name', 'Section', 'Official Login Email', 'Default Password']],
    body: stuY4Rows,
    theme: 'striped',
    headStyles: {
      fillColor: [217, 119, 6],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { fontStyle: 'bold', cellWidth: 32 },
      2: { fontStyle: 'bold', cellWidth: 50 },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 52 },
      5: { fontStyle: 'bold', textColor: [15, 118, 110], cellWidth: 24 },
    },
  });

  // -------------------------------------------------------------
  // SECTION 4: INSTITUTIONAL IT POLICY & SECURITY COMPLIANCE
  // -------------------------------------------------------------
  doc.addPage();
  renderHeader('Section 4: IT Security Policy & Credential Management Protocols', 'Vivekananda College of Technology & Management • Central IT Cell & Administration');

  let policyY = 44;

  // Box 1: Multi-Identifier Authentication Protocol
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, policyY, pageWidth - 28, 40, 2, 2, 'FD');

  doc.setFillColor(30, 58, 95);
  doc.rect(14, policyY, 2.5, 40, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 41, 66);
  doc.text('1. Flexible Multi-Identifier Authentication Architecture', 20, policyY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('The VCTM ERP platform incorporates dual-identifier authentication for all university roles:', 20, policyY + 12);
  doc.text('• Students can authenticate using either their 13-digit AKTU Roll Number OR their institutional email address.', 20, policyY + 17);
  doc.text('• Faculty members can authenticate using their assigned Employee Code (e.g. FAC-CSE-001) OR official email.', 20, policyY + 22);
  doc.text('• Super Administrators can authenticate using "admin" or "admin@vctm.in".', 20, policyY + 27);
  doc.text('• Automatic identifier resolution links directly to Supabase Auth credentials without manual alias mapping.', 20, policyY + 32);

  policyY += 46;

  // Box 2: Password Security & Super Admin Controls
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, policyY, pageWidth - 28, 48, 2, 2, 'FD');

  doc.setFillColor(13, 148, 136);
  doc.rect(14, policyY, 2.5, 48, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 41, 66);
  doc.text('2. Password Security & Super Administrator Credential Management', 20, policyY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('• Salted bcrypt hashing: All credentials are cryptographically hashed and never stored in plaintext.', 20, policyY + 12);
  doc.text('• Initial Password Change: Users are encouraged to change their default password upon first successful login.', 20, policyY + 17);
  doc.text('• Super Admin Real-Time Control: The Central Administrator possesses direct server-side credential management', 20, policyY + 22);
  doc.text('  privileges to update login emails, issue temporary access passwords, or re-apply default institutional credentials.', 20, policyY + 26.5);
  doc.text('• No confirmation links required: Administrative credential resets take immediate effect via secure backend endpoints.', 20, policyY + 31.5);
  doc.text('• Audit Logging: All credential alterations are permanently recorded in the institutional system audit trail.', 20, policyY + 36.5);

  policyY += 54;

  // Box 3: Academic Role & Access Privileges
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, policyY, pageWidth - 28, 42, 2, 2, 'FD');

  doc.setFillColor(217, 119, 6);
  doc.rect(14, policyY, 2.5, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 41, 66);
  doc.text('3. Role-Based Access Control (RBAC) & Institutional Scopes', 20, policyY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('• Super Admin (Tarun Kushwah): Full academic hierarchy setup, AI timetable ingestion, user account lifecycle.', 20, policyY + 12);
  doc.text('• HOD (Mr. Waseem): Department-wide oversight, timetable approvals, faculty allocation, attendance audits.', 20, policyY + 17);
  doc.text('• Faculty Members: Real-time class attendance marking, timetable views with academic year & section clarity.', 20, policyY + 22);
  doc.text('• Students: Personalized timetable view, daily attendance statistics, subject syllabi, and official college circulars.', 20, policyY + 27);
  doc.text('• Data Isolation: Row Level Security (RLS) policies strictly isolate student records across distinct cohorts.', 20, policyY + 32);

  policyY += 48;

  // Sign-off & Institutional Verification Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, policyY, pageWidth - 28, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 41, 66);
  doc.text('INSTITUTIONAL AUTHORIZATION & DOCUMENT VERIFICATION', 18, policyY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('This document represents the certified Master Login Access Directory for Vivekananda College of Technology & Management.', 18, policyY + 11.5);
  doc.text('Generated from the live Supabase database for Academic Session 2026–2027.', 18, policyY + 15.5);

  // Signature lines
  const sigY = policyY + 26;
  doc.setDrawColor(148, 163, 184);
  doc.line(22, sigY, 68, sigY);
  doc.line( pageWidth / 2 - 23, sigY, pageWidth / 2 + 23, sigY);
  doc.line(pageWidth - 68, sigY, pageWidth - 22, sigY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Central IT Administrator', 30, sigY + 4);
  doc.text('Head of Department (CSE)', pageWidth / 2 - 19, sigY + 4);
  doc.text('Registrar / Director', pageWidth - 55, sigY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Tarun Kushwah', 37, sigY + 7.5);
  doc.text('Mr. Waseem', pageWidth / 2 - 10, sigY + 7.5);
  doc.text('VCTM Administration', pageWidth - 56, sigY + 7.5);

  // -------------------------------------------------------------
  // RUNNING HEADERS & FOOTERS FOR ALL PAGES
  // -------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // If continuation page, draw sleek top running header
    if (!sectionStartPages.has(i)) {
      doc.setFillColor(15, 41, 66);
      doc.rect(0, 0, pageWidth, 3.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('VIVEKANANDA COLLEGE OF TECHNOLOGY & MANAGEMENT • CENTRAL ERP', 14, 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('Academic Session 2026–2027 • Master Login Directory (Cont.)', pageWidth - 14, 9, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 12, pageWidth - 14, 12);
    }

    // Bottom running footer on every page
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('VCTM ERP • Master Login Access Directory (2026–2027) • Confidential Institutional Record', 14, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  // Output PDF
  const outputFileName = 'VCTM_ERP_Login_Access_Directory_2026-2027.pdf';
  const outputPath = path.join(process.cwd(), outputFileName);
  const pdfBytes = doc.output('arraybuffer');
  fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
  console.log(`✅ PDF successfully generated at: ${outputPath} (${(pdfBytes.byteLength / 1024).toFixed(1)} KB, ${totalPages} pages)`);

  // Also copy to Brain Artifacts directory
  const brainDir = '/Users/tarun/.gemini/antigravity/brain/d469a4d2-950c-4027-a3cc-538f7a37ea0f';
  if (fs.existsSync(brainDir)) {
    const brainPdfPath = path.join(brainDir, outputFileName);
    fs.writeFileSync(brainPdfPath, Buffer.from(pdfBytes));
    console.log(`✅ Copy saved to brain directory: ${brainPdfPath}`);
  }
}

generatePDF().catch(err => {
  console.error('Failed to generate PDF:', err);
  process.exitCode = 1;
});
