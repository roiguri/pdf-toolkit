// src/lib/pdf-utils.ts
import { PDFDocument, StandardFonts, rgb, PDFName, PDFDict, PDFRef } from 'pdf-lib';
import { Annotation, Bookmark } from '@/services/firestore';

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
 *
 * Geometry is a pure function of the annotation's normalized (0-1) position/size
 * and each target page's own point size (`page.getSize()`). It must never depend on
 * the on-screen canvas size, zoom level, or device — annotation data is already
 * normalized at creation time (see AnnotationOverlay/DraggableAnnotation), and every
 * caller (edit/split/merge/convert/compress) must get the same geometry back for the
 * same annotations regardless of what device produced them.
 *
 * @param pdfSource The URL of the PDF or ArrayBuffer to annotate.
 * @param annotations The annotations to embed.
 * @param bookmarks Optional list of bookmarks.
 * @returns The bytes of the annotated PDF.
 */
export const embedAnnotationsInPdf = async (
  pdfSource: string | ArrayBuffer,
  annotations: Annotation[],
  bookmarks?: Bookmark[]
): Promise<Uint8Array> => {
  let arrayBuffer: ArrayBuffer;

  if (typeof pdfSource === 'string') {
    const response = await fetch(pdfSource);
    arrayBuffer = await response.arrayBuffer();
  } else {
    arrayBuffer = pdfSource;
  }

  const pdfDoc = await PDFDocument.load(arrayBuffer);

  // Embed the font for text annotations
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Parse hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    } : { r: 0, g: 0, b: 0 };
  };

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

      const color = hexToRgb(fontColor);

      // fontSize is an absolute PDF point size (not canvas-relative), so it's used as-is.
      // Fixed point-space padding approximating the on-screen text box's padding
      // (Tailwind px-2/py-1). Deliberately NOT scaled by canvas/page size: a flat
      // constant keeps export geometry independent of device and zoom, which a
      // canvas-derived scale factor cannot guarantee (that was the root cause of
      // this annotation pipeline's device-dependent export bug).
      const paddingX = 6;
      const paddingY = 4;

      // Draw text (adjust for padding and text baseline)
      // Text is positioned from its baseline in PDF coordinates
      page.drawText(annotation.content, {
        x: pdfX + paddingX,
        y: pdfY - paddingY - fontSize, // Adjust for padding and text baseline
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
      });
    } else if (annotation.type === 'signature') {
      // Get signature dimensions (relative coordinates)
      const storedWidth = annotation.style?.width || 0;
      const storedHeight = annotation.style?.height || 0;

      // Detect legacy records that stored signature size in absolute pixels (> 1)
      // instead of the normalized 0-1 fraction current code always writes. We have
      // no way to recover the canvas size those pixels were captured against, so we
      // interpret them deterministically against the PDF page size instead. This is
      // an approximation for old data, but — unlike the previous heuristic, which
      // rescaled by whatever canvas happened to be open on the exporting device — it
      // is reproducible: the same legacy record now exports identically everywhere.
      const relativeWidth = storedWidth > 1 ? storedWidth / pageWidth : storedWidth;
      const relativeHeight = storedHeight > 1 ? storedHeight / pageHeight : storedHeight;

      // Convert relative dimensions to PDF dimensions
      const scaledWidth = relativeWidth * pageWidth;
      const scaledHeight = relativeHeight * pageHeight;

      try {
        // Convert base64 data URL to bytes
        const base64Data = annotation.content.split(',')[1];
        const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Embed the image (PNG format from signature canvas)
        const image = await pdfDoc.embedPng(imageBytes);

        // Draw the signature image. (The previous "+2px * scaleFactor" alignment
        // offset here was itself canvas-size-derived, so it made the misalignment
        // it was meant to fix device-dependent too. pdfX/pdfY already come straight
        // from the normalized position and this page's own size, so no offset is
        // needed here.)
        page.drawImage(image, {
          x: pdfX,
          y: pdfY - scaledHeight, // Adjust for image positioning
          width: scaledWidth,
          height: scaledHeight,
        });
      } catch (error) {
        console.error('Error embedding signature:', error);
      }
    } else if (annotation.type === 'highlight' && annotation.rects) {
      const highlightColor = annotation.style?.color || '#ffff00';
      const opacity = annotation.style?.opacity || 0.4;
      const color = hexToRgb(highlightColor);

      annotation.rects.forEach(rect => {
        // Convert relative rect (0-1) to PDF coordinates
        const x = rect.x * pageWidth;
        const width = rect.width * pageWidth;
        const height = rect.height * pageHeight;

        // y is from top in our data, but pdf is from bottom
        const y = pageHeight - (rect.y * pageHeight) - height;

        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: rgb(color.r, color.g, color.b),
          opacity,
        });
      });
    }
  }

  // Create Bookmarks (Outlines)
  if (bookmarks && bookmarks.length > 0) {
    try {
      const sortedBookmarks = [...bookmarks].sort((a, b) => a.pageNumber - b.pageNumber);

      // We need to construct the outline dictionary manually
      const outlinesDictRef = pdfDoc.context.nextRef();
      const outlineItemRefs: PDFRef[] = [];

      for (let i = 0; i < sortedBookmarks.length; i++) {
        outlineItemRefs.push(pdfDoc.context.nextRef());
      }

      const outlinesDict = pdfDoc.context.obj({
        Type: 'Outlines',
        First: outlineItemRefs[0],
        Last: outlineItemRefs[outlineItemRefs.length - 1],
        Count: sortedBookmarks.length,
      });

      pdfDoc.context.assign(outlinesDictRef, outlinesDict);

      // Assign to Catalog
      pdfDoc.catalog.set(PDFName.of('Outlines'), outlinesDictRef);

      // Create items
      for (let i = 0; i < sortedBookmarks.length; i++) {
        const bookmark = sortedBookmarks[i];
        const pageNum = bookmark.pageNumber;
        const pageIndex = pageNum - 1;

        if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
          const page = pdfDoc.getPage(pageIndex);
          const pageRef = page.ref;

          const itemRef = outlineItemRefs[i];
          const prevRef = i > 0 ? outlineItemRefs[i - 1] : undefined;
          const nextRef = i < sortedBookmarks.length - 1 ? outlineItemRefs[i + 1] : undefined;

          const itemDict = pdfDoc.context.obj({
            Title: bookmark.title || `Page ${pageNum}`,
            Parent: outlinesDictRef,
            ...(prevRef ? { Prev: prevRef } : {}),
            ...(nextRef ? { Next: nextRef } : {}),
            Dest: [pageRef, 'Fit'],
          });

          pdfDoc.context.assign(itemRef, itemDict);
        }
      }
    } catch (error) {
      console.error("Error creating bookmarks outline:", error);
    }
  }

  return pdfDoc.save();
};
