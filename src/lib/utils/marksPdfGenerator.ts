export type MarksReportType = 'CURRENT_ASSESSMENT' | 'SUBJECT_SCORECARD' | 'SECTION_REPORT' | 'STUDENT_REPORT';

export interface StudentMarkRow {
  sNo: number;
  rollNumber: string;
  studentName: string;
  marksObtained: number | null;
  maxMarks: number;
  status: 'Entered' | 'Missing';
  percentage?: string;
  remarks?: string;
}

export interface SubjectScorecardRow {
  sNo: number;
  rollNumber: string;
  studentName: string;
  sessional1?: number | string;
  sessional2?: number | string;
  quizzesTotal?: number | string;
  internalTotal?: number | string;
  maxTotal?: number | string;
  status?: string;
}

export interface MarksPdfReportParams {
  reportType: MarksReportType;
  institutionName?: string;
  collegeCode?: string;
  academicYear: string;
  sectionName: string;
  subjectName: string;
  subjectCode: string;
  facultyName: string;
  assessmentTitle: string;
  academicSession?: string;
  maxMarks?: number;
  publishStatus?: 'draft' | 'published';
  studentRows?: StudentMarkRow[];
  scorecardRows?: SubjectScorecardRow[];
  singleStudent?: {
    studentName: string;
    rollNumber: string;
    assessments: Array<{
      title: string;
      marksObtained: number | null;
      maxMarks: number;
      percentage: string;
      status: string;
    }>;
  };
}

export async function generateMarksReportPdf(params: MarksPdfReportParams): Promise<any> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = (autoTableModule.default || autoTableModule) as any;
  const {
    reportType,
    institutionName = 'VIVEKANANDA COLLEGE OF TECHNOLOGY & MANAGEMENT',
    collegeCode = '340',
    academicYear,
    sectionName,
    subjectName,
    subjectCode,
    facultyName,
    assessmentTitle,
    academicSession = '2026-2027 (Odd Semester)',
    maxMarks = 20,
    publishStatus = 'draft',
    studentRows = [],
    scorecardRows = [],
    singleStudent,
  } = params;

  const doc = new jsPDF({
    orientation: reportType === 'SUBJECT_SCORECARD' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Decorative border
  doc.setDrawColor(30, 58, 95); // Deep VCTM Navy
  doc.setLineWidth(1.0);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(0, 204, 102); // Emerald accent border
  doc.setLineWidth(0.3);
  doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19);

  // Institution Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text(institutionName.toUpperCase(), pageWidth / 2, 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `ALIGARH (College Code: ${collegeCode}) | Approved by AICTE, Affiliated to Dr. A.P.J. Abdul Kalam Technical University (AKTU)`,
    pageWidth / 2,
    22,
    { align: 'center' }
  );

  // Divider Line
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.line(14, 25, pageWidth - 14, 25);

  // Report Title Banner
  let reportTitleText = `OFFICIAL ASSESSMENT LEDGER — ${assessmentTitle.toUpperCase()}`;
  if (reportType === 'SUBJECT_SCORECARD') {
    reportTitleText = `COMPLETE SUBJECT INTERNAL SCORECARD — ${subjectCode} (${subjectName.toUpperCase()})`;
  } else if (reportType === 'SECTION_REPORT') {
    reportTitleText = `SECTION MARKS & EVALUATION REPORT — ${academicYear} ${sectionName}`;
  } else if (reportType === 'STUDENT_REPORT') {
    reportTitleText = `STUDENT ACADEMIC PERFORMANCE REPORT — ${singleStudent?.rollNumber || ''}`;
  }

  doc.setFillColor(30, 58, 95);
  doc.roundedRect(14, 28, pageWidth - 28, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(reportTitleText, pageWidth / 2, 33.5, { align: 'center' });

  // Metadata Grid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);

  const col1 = 14;
  const col2 = pageWidth / 2;

  doc.text(`Academic Year:`, col1, 41);
  doc.setFont('helvetica', 'normal');
  doc.text(`${academicYear} • Section ${sectionName}`, col1 + 25, 41);

  doc.setFont('helvetica', 'bold');
  doc.text(`Subject:`, col1, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(`${subjectName} (${subjectCode})`, col1 + 25, 46);

  doc.setFont('helvetica', 'bold');
  doc.text(`Course Faculty:`, col2, 41);
  doc.setFont('helvetica', 'normal');
  doc.text(`${facultyName}`, col2 + 25, 41);

  doc.setFont('helvetica', 'bold');
  doc.text(`Academic Session:`, col2, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(`${academicSession}`, col2 + 28, 46);

  if (reportType === 'CURRENT_ASSESSMENT') {
    doc.setFont('helvetica', 'bold');
    doc.text(`Max Marks:`, col1, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(`${maxMarks}`, col1 + 25, 51);

    doc.setFont('helvetica', 'bold');
    doc.text(`Status:`, col2, 51);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(publishStatus === 'published' ? 0 : 180, publishStatus === 'published' ? 150 : 100, 0);
    doc.text(publishStatus === 'published' ? 'PUBLISHED (Official)' : 'DRAFT (Internal Faculty Work)', col2 + 28, 51);
    doc.setTextColor(40, 40, 40);
  }

  if (reportType === 'STUDENT_REPORT' && singleStudent) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Student Name:`, col1, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(`${singleStudent.studentName}`, col1 + 25, 51);

    doc.setFont('helvetica', 'bold');
    doc.text(`Roll Number:`, col2, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(`${singleStudent.rollNumber}`, col2 + 28, 51);
  }

  // Summary Metrics Box (for Current Assessment and Subject Scorecard)
  let startY = reportType === 'CURRENT_ASSESSMENT' || reportType === 'STUDENT_REPORT' ? 55 : 50;

  if (reportType === 'CURRENT_ASSESSMENT' && studentRows.length > 0) {
    const validScores = studentRows.filter(r => r.marksObtained !== null && r.marksObtained !== undefined).map(r => Number(r.marksObtained));
    const totalCount = studentRows.length;
    const enteredCount = validScores.length;
    const missingCount = totalCount - enteredCount;
    const avgScore = enteredCount > 0 ? (validScores.reduce((a, b) => a + b, 0) / enteredCount).toFixed(1) : 'N/A';
    const maxScore = enteredCount > 0 ? Math.max(...validScores) : 'N/A';
    const minScore = enteredCount > 0 ? Math.min(...validScores) : 'N/A';

    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(210, 220, 235);
    doc.roundedRect(14, startY, pageWidth - 28, 9, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text(`Total Students: ${totalCount}  |  Entered: ${enteredCount}  |  Missing: ${missingCount}  |  Class Average: ${avgScore}  |  Highest: ${maxScore}  |  Lowest: ${minScore}`, pageWidth / 2, startY + 6, { align: 'center' });

    startY += 12;
  }

  // Generate Table
  if (reportType === 'CURRENT_ASSESSMENT') {
    const tableBody = studentRows.map((r, i) => [
      i + 1,
      r.rollNumber,
      r.studentName,
      r.marksObtained !== null && r.marksObtained !== undefined ? r.marksObtained : '—',
      r.maxMarks,
      r.marksObtained !== null && r.marksObtained !== undefined ? `${Math.round((r.marksObtained / r.maxMarks) * 100)}%` : '—',
      r.status,
      r.remarks || '',
    ]);

    autoTable(doc, {
      startY,
      head: [['S.No.', 'Roll Number', 'Student Name', 'Marks Obtained', 'Max Marks', 'Percentage', 'Status', 'Remarks']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 95],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', font: 'courier', cellWidth: 32 },
        2: { halign: 'left' },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 20 },
        6: { halign: 'center', cellWidth: 20 },
        7: { halign: 'left', cellWidth: 25 },
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [33, 33, 33],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 253],
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });
  } else if (reportType === 'SUBJECT_SCORECARD') {
    const tableBody = scorecardRows.map((r, i) => [
      i + 1,
      r.rollNumber,
      r.studentName,
      r.sessional1 ?? '—',
      r.sessional2 ?? '—',
      r.quizzesTotal ?? '—',
      r.internalTotal ?? '—',
      r.maxTotal ?? '—',
      r.status ?? 'Normal',
    ]);

    autoTable(doc, {
      startY: startY + 4,
      head: [['S.No.', 'Roll Number', 'Student Name', 'Sessional 1', 'Sessional 2', 'Quizzes Total', 'Internal Total', 'Max Total', 'Result / Status']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 95],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', font: 'courier', cellWidth: 35 },
        2: { halign: 'left' },
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 24 },
        6: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
        7: { halign: 'center', cellWidth: 22 },
        8: { halign: 'center', cellWidth: 25 },
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [33, 33, 33],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 253],
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });
  } else if (reportType === 'STUDENT_REPORT' && singleStudent) {
    const tableBody = singleStudent.assessments.map((a, i) => [
      i + 1,
      a.title,
      a.marksObtained !== null && a.marksObtained !== undefined ? a.marksObtained : 'Unmarked',
      a.maxMarks,
      a.percentage,
      a.status,
    ]);

    autoTable(doc, {
      startY: startY + 4,
      head: [['S.No.', 'Assessment Type / Name', 'Marks Obtained', 'Max Marks', 'Percentage', 'Publication Status']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 95],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'left' },
        2: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 25 },
        4: { halign: 'center', cellWidth: 25 },
        5: { halign: 'center', cellWidth: 35 },
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [33, 33, 33],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 253],
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });
  } else {
    // SECTION REPORT
    const tableBody = studentRows.map((r, i) => [
      i + 1,
      r.rollNumber,
      r.studentName,
      r.marksObtained !== null && r.marksObtained !== undefined ? r.marksObtained : '—',
      r.maxMarks,
      r.status,
    ]);

    autoTable(doc, {
      startY: startY + 4,
      head: [['S.No.', 'Roll Number', 'Student Name', 'Marks Obtained', 'Max Marks', 'Status']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 95],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'center', font: 'courier', cellWidth: 35 },
        2: { halign: 'left' },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 25 },
        5: { halign: 'center', cellWidth: 30 },
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [33, 33, 33],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 253],
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });
  }

  // Add Signatures & Footer on the last page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    if (p === totalPages) {
      // Signature Blocks on final page
      const sigY = pageHeight - 24;

      doc.setDrawColor(180, 190, 205);
      doc.setLineWidth(0.4);

      // Signature 1: Course Faculty
      doc.line(18, sigY, 65, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text('Subject Teacher', 41.5, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(`(${facultyName})`, 41.5, sigY + 7.5, { align: 'center' });

      // Signature 2: Class Incharge / Coordinator
      const sig2X = pageWidth / 2;
      doc.line(sig2X - 25, sigY, sig2X + 25, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text('Class Incharge', sig2X, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text('(Section Coordinator)', sig2X, sigY + 7.5, { align: 'center' });

      // Signature 3: Head of Department
      const sig3X = pageWidth - 41.5;
      doc.line(pageWidth - 65, sigY, pageWidth - 18, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text('Head of Department', sig3X, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text('(HOD CSE / Dept.)', sig3X, sigY + 7.5, { align: 'center' });
    }

    // Official System Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    doc.text(`Generated by VCTM ERP Academic Ledger • ${dateStr} IST • Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 11, { align: 'center' });
  }

  return doc;
}
