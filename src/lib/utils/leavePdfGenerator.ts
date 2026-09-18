import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LeaveApplication } from '../../types/database.types';

export interface GenerateLeavePdfParams {
  application: LeaveApplication;
  studentName: string;
  rollNumber: string;
  departmentName: string;
  yearName: string;
  sectionName: string;
  coordinatorName: string;
  coordinatorDesignation?: string;
  hodName: string;
  hodDesignation?: string;
}

/**
 * Generates and downloads an authentic, official VCTM ERP Leave Approval Certificate PDF
 * directly to the user's local machine Downloads directory.
 */
export function generateApprovedLeavePdf(params: GenerateLeavePdfParams): jsPDF {
  const {
    application,
    studentName,
    rollNumber,
    departmentName,
    yearName,
    sectionName,
    coordinatorName,
    coordinatorDesignation = 'Assistant Professor / Class Coordinator',
    hodName,
    hodDesignation = 'Associate Professor & HOD'
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Draw elegant decorative border
  doc.setDrawColor(30, 58, 95); // Deep VCTM Navy
  doc.setLineWidth(1.2);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(0, 204, 102); // Emerald Accent Inner Line
  doc.setLineWidth(0.4);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // College Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text('VIVEKANANDA COLLEGE OF TECHNOLOGY & MANAGEMENT', pageWidth / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(80, 80, 80);
  doc.text('ALIGARH (College Code: 340) | Approved by AICTE, Affiliated to Dr. A.P.J. Abdul Kalam Technical University', pageWidth / 2, 28, { align: 'center' });
  doc.text('Website: www.vctm.in | Email: info@vctm.in | ERP Academic Workflow System', pageWidth / 2, 33, { align: 'center' });

  // Divider line
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.5);
  doc.line(15, 36, pageWidth - 15, 36);

  // Certificate Title Banner
  doc.setFillColor(30, 58, 95);
  doc.roundedRect(pageWidth / 2 - 65, 40, 130, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL LEAVE APPROVAL CERTIFICATE', pageWidth / 2, 47.5, { align: 'center' });

  // Top Certificate Metadata Table
  const formattedGenDate = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  autoTable(doc, {
    startY: 55,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 1.5 },
    body: [
      [
        { content: 'Application ID:', styles: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 32 } },
        { content: application.application_number || 'LV-2026', styles: { fontStyle: 'bold', textColor: [30, 58, 95] } },
        { content: 'Final Status:', styles: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 28 } },
        { content: 'APPROVED \u2713', styles: { fontStyle: 'bold', textColor: [0, 153, 76] } }
      ],
      [
        { content: 'Verification Code:', styles: { fontStyle: 'bold', textColor: [80, 80, 80] } },
        { content: application.verification_code || 'VCTM-LV-2026', styles: { fontStyle: 'normal', textColor: [60, 60, 60] } },
        { content: 'Generated On:', styles: { fontStyle: 'bold', textColor: [80, 80, 80] } },
        { content: formattedGenDate + ' IST', styles: { fontStyle: 'normal', textColor: [60, 60, 60] } }
      ]
    ]
  });

  // Section 1: Student Particulars
  let currentY = (doc as any).lastAutoTable.finalY + 4;
  doc.setFillColor(240, 245, 250);
  doc.rect(14, currentY, pageWidth - 28, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 95);
  doc.text('I. STUDENT PARTICULARS', 18, currentY + 4.5);

  autoTable(doc, {
    startY: currentY + 7.5,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [220, 225, 230] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 250, 252], textColor: [50, 50, 50] },
      1: { cellWidth: 55, textColor: [20, 20, 20] },
      2: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 250, 252], textColor: [50, 50, 50] },
      3: { textColor: [20, 20, 20] }
    },
    body: [
      ['Student Name', studentName, 'Roll Number', rollNumber],
      ['Department / Branch', departmentName, 'Academic Year', yearName || '2nd / 3rd Year'],
      ['Section', sectionName ? `Section ${sectionName}` : 'All Sections', 'College / Institute', 'VCTM Aligarh (Code 340)']
    ]
  });

  // Section 2: Sanctioned Leave Particulars
  currentY = (doc as any).lastAutoTable.finalY + 5;
  doc.setFillColor(240, 245, 250);
  doc.rect(14, currentY, pageWidth - 28, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 95);
  doc.text('II. SANCTIONED LEAVE PARTICULARS', 18, currentY + 4.5);

  const fromDateFormatted = new Date(application.from_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const toDateFormatted = new Date(application.to_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  autoTable(doc, {
    startY: currentY + 7.5,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [220, 225, 230] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 250, 252], textColor: [50, 50, 50] },
      1: { cellWidth: 55, textColor: [20, 20, 20] },
      2: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 250, 252], textColor: [50, 50, 50] },
      3: { textColor: [20, 20, 20] }
    },
    body: [
      ['Leave Category', application.leave_type, 'Total Duration', `${application.number_of_days} Day(s)`],
      ['From Date', fromDateFormatted, 'To Date', toDateFormatted],
      [
        'Reason / Purpose', 
        { content: application.reason || 'Not specified', colSpan: 3, styles: { fontStyle: 'italic', textColor: [40, 40, 40] } }
      ]
    ]
  });

  // Section 3: Dual Hierarchy Approval Ledger
  currentY = (doc as any).lastAutoTable.finalY + 5;
  doc.setFillColor(240, 245, 250);
  doc.rect(14, currentY, pageWidth - 28, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 95);
  doc.text('III. TWO-LEVEL APPROVAL ENDORSEMENT AUDIT TRAIL', 18, currentY + 4.5);

  const coordDate = application.coordinator_approved_at 
    ? new Date(application.coordinator_approved_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      }) + ' IST'
    : 'Approved';

  const hodDate = application.hod_approved_at 
    ? new Date(application.hod_approved_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      }) + ' IST'
    : 'Approved';

  autoTable(doc, {
    startY: currentY + 7.5,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: [220, 225, 230] },
    head: [[
      'Stage',
      'Approving Authority',
      'Designation / Role',
      'Decision Status',
      'Endorsement Timestamp',
      'Remarks'
    ]],
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    body: [
      [
        'Level 1',
        coordinatorName,
        coordinatorDesignation,
        'APPROVED & FORWARDED \u2713',
        coordDate,
        application.coordinator_remarks || 'Verified attendance & approved'
      ],
      [
        'Level 2',
        hodName,
        hodDesignation,
        'FINAL SANCTIONED \u2713',
        hodDate,
        application.hod_remarks || 'Official leave sanctioned'
      ]
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 16, halign: 'center' },
      1: { fontStyle: 'bold', cellWidth: 38 },
      2: { cellWidth: 34, fontSize: 8 },
      3: { fontStyle: 'bold', textColor: [0, 153, 76], cellWidth: 34, fontSize: 8 },
      4: { cellWidth: 32, fontSize: 7.5 },
      5: { fontStyle: 'italic', fontSize: 7.5 }
    }
  });

  // Section 4: Signature / Stamp Block
  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Coordinator Signature Box
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.roundedRect(20, currentY, 70, 24, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 95);
  doc.text('Digitally Verified by:', 25, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(coordinatorName, 25, currentY + 11);
  doc.setTextColor(100, 100, 100);
  doc.text('Class Coordinator, VCTM', 25, currentY + 15);
  doc.setTextColor(0, 153, 76);
  doc.setFont('helvetica', 'bold');
  doc.text('[\u2713 Verified electronically]', 25, currentY + 20);

  // HOD Signature Box
  doc.roundedRect(pageWidth - 90, currentY, 70, 24, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 95);
  doc.text('Finally Sanctioned by:', pageWidth - 85, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(hodName, pageWidth - 85, currentY + 11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Head of Department, ${departmentName}`, pageWidth - 85, currentY + 15);
  doc.setTextColor(0, 153, 76);
  doc.setFont('helvetica', 'bold');
  doc.text('[\u2713 Sanctioned electronically]', pageWidth - 85, currentY + 20);

  // Security Seal & Verification Footer
  const footerY = pageHeight - 24;
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.line(14, footerY - 2, pageWidth - 14, footerY - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 58, 95);
  doc.text(`SECURITY VERIFICATION HASH: ${application.verification_code || 'VCTM-LV-2026'}`, 14, footerY + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text(
    'This is an authentic, digitally verified institutional certificate generated by Vivekananda College of Technology & Management ERP.',
    14,
    footerY + 7
  );
  doc.text(
    'Any unauthorized alteration, forgery, or tampering with this document is strictly prohibited under institutional academic policies.',
    14,
    footerY + 11
  );

  // Trigger browser download to local downloads directory if in browser environment
  const filename = `VCTM_Leave_Approved_${application.application_number || application.id.slice(0, 8)}.pdf`;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    doc.save(filename);
  }

  return doc;
}

// Alias for convenience
export const generateApprovedLeavePDF = generateApprovedLeavePdf;
