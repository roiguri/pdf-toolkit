// src/lib/pdf-utils.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FileMetadata } from '@/services/firestore';

/**
 * Downloads a file to the user's browser.
 * @param bytes The PDF bytes to download.
 * @param filename The name of the file.
 * @param mimeType The MIME type of the file.
 */
export const downloadPdf = (bytes: Uint8Array, filename: string) => {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href); // Clean up the URL object
};

/**
 * Loads a PDF document from an ArrayBuffer.
 * @param arrayBuffer The ArrayBuffer containing the PDF data.
 * @returns A PDFDocument object.
 */
export const loadPdfDocument = async (arrayBuffer: ArrayBuffer): Promise<PDFDocument> => {
  return PDFDocument.load(arrayBuffer);
};

/**
 * Gets the number of pages in a PDF document.
 * @param arrayBuffer The ArrayBuffer containing the PDF data.
 * @returns The number of pages.
 */
export const getPageCount = async (arrayBuffer: ArrayBuffer): Promise<number> => {
  const pdfDoc = await loadPdfDocument(arrayBuffer);
  return pdfDoc.getPageCount();
};

/**
 * Splits a PDF document based on specified page ranges.
 * @param originalPdfBytes The ArrayBuffer of the original PDF.
 * @param pageRanges A string like "1, 3-5, 7" representing pages to extract.
 * @param filename The base filename for the new PDFs.
 * @returns An array of objects, each containing bytes and a filename for the new PDFs.
 */
export const splitPdf = async (
  originalPdfBytes: ArrayBuffer,
  pageRanges: string,
  baseFilename: string
): Promise<Array<{ bytes: Uint8Array; filename: string }>> => {
  const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
  const totalPages = originalPdfDoc.getPageCount();
  const outputPdfs: Array<{ bytes: Uint8Array; filename: string }> = [];

  const parsePageRanges = (rangeStr: string): number[] => {
    const pages: Set<number> = new Set();
    rangeStr.split(',').forEach(rangePart => {
      const trimmed = rangePart.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) {
            pages.add(i);
          }
        }
      } else {
        const pageNum = Number(trimmed);
        if (pageNum >= 1 && pageNum <= totalPages) {
          pages.add(pageNum);
        }
      }
    });
    return Array.from(pages).sort((a, b) => a - b);
  };

  const pagesToExtract = parsePageRanges(pageRanges);

  if (pagesToExtract.length === 0) {
    throw new Error('No valid pages specified for splitting.');
  }

  // Create a new PDF for each set of contiguous pages or single page for simplicity
  // This approach creates one new PDF with all selected pages
  const newPdfDoc = await PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(originalPdfDoc, pagesToExtract.map(p => p - 1)); // pdf-lib is 0-indexed

  copiedPages.forEach(page => newPdfDoc.addPage(page));

  const newBytes = await newPdfDoc.save();
  outputPdfs.push({
    bytes: newBytes,
    filename: `${baseFilename}_split_pages_${pageRanges.replace(/\s/g, '')}.pdf`,
  });

  return outputPdfs;
};

/**
 * Merges multiple PDF documents into a single new PDF.
 * @param pdfArrayBuffers An array of ArrayBuffers, each representing a PDF document.
 * @param filenames An array of original filenames to help name the output.
 * @returns The bytes of the merged PDF.
 */
export const mergePdfs = async (
  pdfArrayBuffers: ArrayBuffer[],
  outputFilename: string = 'merged.pdf'
): Promise<{ bytes: Uint8Array; filename: string }> => {
  const mergedPdf = await PDFDocument.create();

  for (const arrayBuffer of pdfArrayBuffers) {
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBytes = await mergedPdf.save();
  return { bytes: mergedBytes, filename: outputFilename };
};

// Note: Convert to Image logic will primarily be handled by react-pdf rendering to canvas
// and then using canvas.toDataURL, as outlined in the design document.
// This utility will focus on pdf-lib capabilities.
