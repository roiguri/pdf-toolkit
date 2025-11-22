// src/components/pdf/PDFViewer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FileMetadata } from '@/services/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: FileMetadata;
  showConvertButton?: boolean;
}

export const PDFViewer = ({ file, showConvertButton = true }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isConverting, setIsConverting] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const pageContainerRef = React.useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1); // Reset to first page on new document load
    setPageDimensions(null); // Reset dimensions on new document
  };

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      if (numPages === null) return prevPageNumber;
      return Math.max(1, Math.min(numPages, prevPageNumber + offset));
    });
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const handleDownloadImage = async () => {
    if (!pageContainerRef.current) {
      toast.error('Page container not found.');
      return;
    }

    const canvas = pageContainerRef.current.querySelector('canvas');
    if (!canvas) {
      toast.error('PDF rendering not complete. Please wait a moment.');
      return;
    }

    setIsConverting(true);
    toast.info('Converting page to image...', { id: 'image-conversion' });

    try {
      const imageDataUrl = canvas.toDataURL('image/png', 1.0); // or 'image/jpeg'

      const link = document.createElement('a');
      link.href = imageDataUrl;
      link.download = `${file.name}_page_${pageNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Page converted and downloaded as image!', { id: 'image-conversion' });
    } catch (error) {
      console.error('Error converting page to image:', error);
      toast.error('Failed to convert page to image.', { id: 'image-conversion' });
    } finally {
      setIsConverting(false);
    }
  };


  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {file ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            <Button onClick={previousPage} disabled={pageNumber <= 1} variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium whitespace-nowrap">
              Page {pageNumber} of {numPages || '...'}
            </span>
            <Button onClick={nextPage} disabled={pageNumber >= (numPages || 0)} variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {showConvertButton && (
              <Button
                onClick={handleDownloadImage}
                disabled={isConverting}
                variant="outline"
                className="ml-2 hidden sm:inline-flex"
              >
                {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <ImageIcon className="mr-2 h-4 w-4" />
                Convert to Image
              </Button>
            )}
          </div>

          <div
            className="border p-2 rounded-md shadow-md bg-background overflow-auto w-full max-h-[50vh] sm:max-h-[60vh] flex justify-center [scrollbar-gutter:stable]"
            ref={pageContainerRef}
          >
            <Document
              file={file.downloadURL}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-full w-full min-h-[500px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }
              noData={<p>No PDF file selected or available.</p>}
              error={<p>Failed to load PDF. Check CORS settings or file availability.</p>}
              className="max-w-full"
            >
              <div
                style={{
                  minWidth: pageDimensions?.width ? `${pageDimensions.width}px` : 'auto',
                  minHeight: pageDimensions?.height ? `${pageDimensions.height}px` : '500px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  onRenderSuccess={(page) => {
                    setPageDimensions({ width: page.width, height: page.height });
                  }}
                  loading={
                    <div className="flex items-center justify-center h-full w-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  }
                  renderTextLayer={false} // Optional: Disable text layer for better performance on mobile if needed
                  renderAnnotationLayer={false} // Optional: Disable annotations
                  className="max-w-full"
                  canvasBackground="white"
                />
              </div>
            </Document>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Select a PDF to view.</p>
      )}
    </div>
  );
};
