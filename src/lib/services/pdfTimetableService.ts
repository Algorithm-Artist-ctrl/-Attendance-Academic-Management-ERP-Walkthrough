import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { CSVTimetableService, CSVValidationResult, CSVTimetableContext } from './csvTimetableService';

// Configure worker for web environments if needed
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    console.warn('PDF.js worker initialization notice:', e);
  }
}

export interface PDFExtractedRow {
  y: number;
  items: { x: number; text: string }[];
}

export class PDFTimetableService {
  private static instance: PDFTimetableService;

  public static getInstance(): PDFTimetableService {
    if (!this.instance) {
      this.instance = new PDFTimetableService();
    }
    return this.instance;
  }

  /**
   * Reads a PDF File or ArrayBuffer and extracts text arranged into lines/tables
   */
  public async extractTextFromPDF(fileOrBuffer: File | ArrayBuffer | Uint8Array): Promise<string> {
    let data: Uint8Array;

    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrBuffer)) {
      data = new Uint8Array(fileOrBuffer.buffer, fileOrBuffer.byteOffset, fileOrBuffer.byteLength);
    } else if (fileOrBuffer instanceof Uint8Array) {
      data = new Uint8Array(fileOrBuffer.buffer, fileOrBuffer.byteOffset, fileOrBuffer.byteLength);
    } else if (fileOrBuffer instanceof ArrayBuffer) {
      data = new Uint8Array(fileOrBuffer);
    } else {
      const buffer = await (fileOrBuffer as File).arrayBuffer();
      data = new Uint8Array(buffer);
    }

    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
    });

    const doc = await loadingTask.promise;
    const allLines: string[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const tolerance = 5;
      const rowMap: PDFExtractedRow[] = [];

      for (const item of textContent.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        const text = item.str.trim();
        const y = Math.round(item.transform[5]);
        const x = Math.round(item.transform[4]);

        let row = rowMap.find(r => Math.abs(r.y - y) <= tolerance);
        if (!row) {
          row = { y, items: [] };
          rowMap.push(row);
        }
        row.items.push({ x, text });
      }

      // Sort rows top-to-bottom (PDF y is ascending upwards, so descending y = top to bottom)
      rowMap.sort((a, b) => b.y - a.y);

      for (const row of rowMap) {
        // Sort items left-to-right
        row.items.sort((a, b) => a.x - b.x);
        
        // Escape CSV values if they contain commas or quotes
        const lineCsv = row.items
          .map(i => {
            if (i.text.includes(',') || i.text.includes('"') || i.text.includes('\n')) {
              return `"${i.text.replace(/"/g, '""')}"`;
            }
            return i.text;
          })
          .join(',');

        if (lineCsv.trim().length > 0) {
          allLines.push(lineCsv);
        }
      }
    }

    return allLines.join('\n');
  }

  /**
   * Extracts text from PDF and validates it through the normalized CSV timetable validation pipeline
   */
  public async parseAndValidatePDF(
    fileOrBuffer: File | ArrayBuffer | Uint8Array,
    context: CSVTimetableContext
  ): Promise<{ csvContent: string; validation: CSVValidationResult }> {
    const csvContent = await this.extractTextFromPDF(fileOrBuffer);
    const csvService = CSVTimetableService.getInstance();
    const validation = csvService.parseAndValidateCSV(csvContent, context);

    return {
      csvContent,
      validation
    };
  }
}

export const pdfTimetableService = PDFTimetableService.getInstance();
