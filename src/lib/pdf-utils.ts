// src/lib/pdf-utils.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FileMetadata } from '@/services/firestore';
import { Annotation } from '@/store/useAppStore';

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

/**
 * Embeds annotations (text and signatures) into a PDF document.
 * @param pdfUrl The URL of the PDF to annotate.
 * @param annotations The annotations to embed.
 * @param canvasDimensions The dimensions of the rendered canvas (for coordinate conversion).
 * @returns The bytes of the annotated PDF.
 */
export const embedAnnotationsInPdf = async (
  pdfUrl: string,
  annotations: Annotation[],
  canvasDimensions: { width: number; height: number }
): Promise<Uint8Array> => {
  // Fetch the original PDF
  const response = await fetch(pdfUrl);
  const arrayBuffer = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  // Embed the font for text annotations
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Process each annotation
  for (const annotation of annotations) {
    const pageIndex = annotation.pageNumber - 1; // pdf-lib is 0-indexed
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert relative coordinates (0-1) to PDF coordinates
    // Note: PDF coordinates start from bottom-left, canvas from top-left
    const pdfX = annotation.position.x * pageWidth;
    const pdfY = pageHeight - (annotation.position.y * pageHeight);

    if (annotation.type === 'text') {
      const fontSize = annotation.style?.fontSize || 16;
      const fontColor = annotation.style?.fontColor || '#000000';

      // Parse hex color to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        } : { r: 0, g: 0, b: 0 };
      };

      const color = hexToRgb(fontColor);

      // Scale font size based on canvas to PDF ratio
      const scaleFactor = pageHeight / canvasDimensions.height;
      const scaledFontSize = fontSize * scaleFactor;

      // Account for text box padding (px-2 = 8px, py-1 = 4px in Tailwind)
      // Slight adjustment for font rendering differences
      const paddingX = 6 * scaleFactor;
      const paddingY = 4 * scaleFactor;

      // Draw text (adjust for padding and text baseline)
      // Text is positioned from its baseline in PDF coordinates
      page.drawText(annotation.content, {
        x: pdfX + paddingX,
        y: pdfY - paddingY - scaledFontSize, // Adjust for padding and text baseline
        size: scaledFontSize,
        font,
        color: rgb(color.r, color.g, color.b),
      });
    } else if (annotation.type === 'signature') {
      // Get signature dimensions (relative coordinates)
      const storedWidth = annotation.style?.width || 0;
      const storedHeight = annotation.style?.height || 0;

      // Detect if values are legacy absolute pixels (> 1) or new relative (0-1)
      const relativeWidth = storedWidth > 1 ? storedWidth / canvasDimensions.width : storedWidth;
      const relativeHeight = storedHeight > 1 ? storedHeight / canvasDimensions.height : storedHeight;

      // Convert relative dimensions to PDF dimensions
      const scaledWidth = relativeWidth * pageWidth;
      const scaledHeight = relativeHeight * pageHeight;

      try {
        // Convert base64 data URL to bytes
        const base64Data = annotation.content.split(',')[1];
        const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Embed the image (PNG format from signature canvas)
        const image = await pdfDoc.embedPng(imageBytes);

        // Draw the signature image
        // Small offset adjustment to align with visual position
        const scaleFactor = pageHeight / canvasDimensions.height;
        const offsetX = 2 * scaleFactor;

        page.drawImage(image, {
          x: pdfX + offsetX,
          y: pdfY - scaledHeight, // Adjust for image positioning
          width: scaledWidth,
          height: scaledHeight,
        });
      } catch (error) {
        console.error('Error embedding signature:', error);
      }
    }
  }

  return pdfDoc.save();
};
