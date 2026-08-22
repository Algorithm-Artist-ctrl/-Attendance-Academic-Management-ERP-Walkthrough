import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Export data to CSV file download
export function exportToCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generate printable PDF report
export function exportAttendanceReportPDF(params: {
  title: string;
  subtitle: string;
  department: string;
  section: string;
  academicYear: string;
  tableHeaders: string[];
  tableRows: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF();

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95); // VCTM Navy
  doc.text('VIVEKANANDA COLLEGE OF TECHNOLOGY & MANAGEMENT', 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('ALIGARH (College Code: 340) | Attendance & Academic ERP', 105, 22, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(128, 31, 31); // Maroon
  doc.text(params.title, 105, 30, { align: 'center' });

  // Metadata Box
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(`Department: ${params.department}`, 14, 38);
  doc.text(`Academic Year: ${params.academicYear}`, 14, 43);
  doc.text(`Section: ${params.section}`, 120, 38);
  doc.text(`Date Generated: ${new Date().toLocaleDateString('en-IN')}`, 120, 43);

  // Table
  autoTable(doc, {
    startY: 48,
    head: [params.tableHeaders],
    body: params.tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [33, 33, 33],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 48, bottom: 20 },
  });

  doc.save(`${params.filename}.pdf`);
}
