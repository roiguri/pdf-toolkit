// src/components/pdf/PDFViewer.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { FileMetadata } from '@/services/firestore';
import { usePinch } from '@use-gesture/react';
import { useAppStore } from '@/store/useAppStore';
import AnnotationOverlay from './AnnotationOverlay';
import SignatureModal from './SignatureModal';
import EditToolbar from './EditToolbar';
import { embedAnnotationsInPdf } from '@/lib/pdf-utils';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: FileMetadata;
  showConvertButton?: boolean;
}

// Zoom constants
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.25;

export const PDFViewer = ({ file, showConvertButton = true }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isConverting, setIsConverting] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [scale, setScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignaturePosition, setPendingSignaturePosition] = useState<{ x: number; y: number } | null>(null);

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  const { activeMode, activeEditTool, addAnnotation, annotations, setSelectedAnnotationId } = useAppStore();

  // Zoom functions
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(MAX_SCALE, prev + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(MIN_SCALE, prev - ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
  }, []);

  // Pinch-to-zoom gesture handler
  usePinch(
    ({ offset: [s], memo, active, last }) => {
      if (active) {
        // During gesture: apply CSS transform for smooth 60fps performance
        if (pageContainerRef.current) {
          // We use the memo to store the initial scale when the gesture starts
          const initialScale = memo ?? scale;

          // Calculate the new visual scale
          // We clamp it visually but allow some overscroll feel
          const currentScale = s;

          // Apply transform
          pageContainerRef.current.style.transform = `scale(${currentScale / initialScale})`;
          pageContainerRef.current.style.transformOrigin = '0 0';

          return initialScale;
        }
      } else if (last) {
        // Gesture ended: commit the new scale
        // Reset transform
        if (pageContainerRef.current) {
          pageContainerRef.current.style.transform = '';
        }

        // Update React state to trigger re-render at new resolution
        setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)));
      }

      return memo;
    },
    {
      target: pageContainerRef,
      scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
      from: () => [scale, 0],
      eventOptions: { passive: false },
    }
  );

  // Prevent default pinch-to-zoom on the page (mobile)
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only prevent default for multi-touch (pinch gestures)
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    // Add touch-action: none to prevent browser zooming/panning interference
    container.style.touchAction = 'none';

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.style.touchAction = '';
    };
  }, []);

  // Mouse wheel zoom (Ctrl+scroll)
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setScale(prev => Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Fullscreen functions
  const toggleFullscreen = useCallback(async () => {
    if (!viewerContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await viewerContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      toast.error('Failed to toggle fullscreen');
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Toggle thumbnails sidebar
  const toggleThumbnails = useCallback(() => {
    setShowThumbnails(prev => !prev);
  }, []);

  // Track container width for responsive PDF scaling
  // We store the base width (at scale 1.0) and apply scale separately
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
      // Subtract padding (p-2 = 8px on each side)
      const width = container.clientWidth - 16;
      setContainerWidth(width > 0 ? width : undefined);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Reset zoom when file changes
  useEffect(() => {
    setScale(1);
  }, [file.id]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1); // Reset to first page on new document load
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

  // Track canvas dimensions for annotation overlay
  useEffect(() => {
    const container = pdfContentRef.current;
    if (!container) return;

    const updateCanvasDimensions = () => {
      const canvas = container.querySelector('canvas');
      if (canvas) {
        // Use getBoundingClientRect for actual display dimensions
        const rect = canvas.getBoundingClientRect();
        setCanvasDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    // Initial update
    updateCanvasDimensions();

    // Update on mutations (page render complete)
    const observer = new MutationObserver(updateCanvasDimensions);
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pageNumber, scale, containerWidth]);

  // Handle adding annotation when clicking on overlay
  const handleAddAnnotation = useCallback((position: { x: number; y: number }) => {
    if (activeMode !== 'edit') return;

    if (activeEditTool === 'text') {
      const id = crypto.randomUUID();
      const newAnnotation = {
        id,
        pageNumber,
        type: 'text' as const,
        position,
        content: '',
        style: { fontSize: 16, fontColor: '#000000' },
      };
      addAnnotation(newAnnotation);
      setSelectedAnnotationId(id); // Auto-select to trigger edit mode
    } else if (activeEditTool === 'signature') {
      setPendingSignaturePosition(position);
      setShowSignatureModal(true);
    }
  }, [activeMode, activeEditTool, pageNumber, addAnnotation, setSelectedAnnotationId]);

  // Handle saving signature from modal
  const handleSaveSignature = useCallback((signatureDataUrl: string) => {
    if (!pendingSignaturePosition) return;

    // Use relative dimensions (default 200x100 pixels converted to relative)
    // Use unscaled dimensions for consistent sizing regardless of zoom level
    const unscaledWidth = canvasDimensions.width / scale;
    const unscaledHeight = canvasDimensions.height / scale;
    const relativeWidth = unscaledWidth > 0 ? 200 / unscaledWidth : 0.2;
    const relativeHeight = unscaledHeight > 0 ? 100 / unscaledHeight : 0.1;

    const newAnnotation = {
      id: crypto.randomUUID(),
      pageNumber,
      type: 'signature' as const,
      position: pendingSignaturePosition,
      content: signatureDataUrl,
      style: { width: relativeWidth, height: relativeHeight },
    };
    addAnnotation(newAnnotation);
    setPendingSignaturePosition(null);
  }, [pendingSignaturePosition, pageNumber, addAnnotation, canvasDimensions, scale]);

  // Handle exporting PDF with annotations
  const handleExportWithAnnotations = useCallback(async () => {
    if (annotations.length === 0) {
      toast.info('No annotations to export');
      return;
    }

    try {
      toast.info('Exporting PDF with annotations...', { id: 'export-pdf' });

      // Pass unscaled dimensions for proper coordinate mapping
      const unscaledDimensions = {
        width: canvasDimensions.width / scale,
        height: canvasDimensions.height / scale,
      };

      const pdfBytes = await embedAnnotationsInPdf(
        file.downloadURL,
        annotations,
        unscaledDimensions
      );

      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name}_annotated.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF exported successfully!', { id: 'export-pdf' });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF with annotations', { id: 'export-pdf' });
    }
  }, [annotations, file, canvasDimensions]);

  return (
    <div
      ref={viewerContainerRef}
      className={`flex flex-col w-full ${isFullscreen ? 'h-screen bg-background p-4 space-y-4' : 'space-y-4'}`}
    >
      {file ? (
        <>
          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            {/* Thumbnail toggle */}
            <Button onClick={toggleThumbnails} variant="outline" size="icon" title={showThumbnails ? 'Hide pages' : 'Show pages'}>
              {showThumbnails ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>

            {/* Page navigation */}
            <Button onClick={previousPage} disabled={pageNumber <= 1} variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium whitespace-nowrap">
              Page {pageNumber} of {numPages || '...'}
            </span>
            <Button onClick={nextPage} disabled={pageNumber >= (numPages || 0)} variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 ml-2">
              <Button onClick={zoomOut} disabled={scale <= MIN_SCALE} variant="outline" size="icon" title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-14 text-center">{Math.round(scale * 100)}%</span>
              <Button onClick={zoomIn} disabled={scale >= MAX_SCALE} variant="outline" size="icon" title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button onClick={resetZoom} disabled={scale === 1} variant="outline" size="icon" title="Reset zoom">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Fullscreen toggle */}
            <Button onClick={toggleFullscreen} variant="outline" size="icon" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>

            {/* Convert to image button */}
            {showConvertButton && (
              <Button
                onClick={handleDownloadImage}
                disabled={isConverting}
                variant="outline"
                className="ml-2"
              >
                {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <ImageIcon className="mr-2 h-4 w-4" />
                Convert to Image
              </Button>
            )}
          </div>

          {/* Edit toolbar */}
          {activeMode === 'edit' && (
            <div className="flex justify-center">
              <EditToolbar onExport={handleExportWithAnnotations} />
            </div>
          )}

          {/* Main content area with thumbnails sidebar */}
          <div className={`flex flex-1 gap-2 overflow-hidden ${isFullscreen ? 'h-full' : ''}`}>
            {/* Thumbnails sidebar */}
            {showThumbnails && (
              <div className={`w-32 flex-shrink-0 border rounded-md bg-muted/30 overflow-y-auto p-2 space-y-2 ${isFullscreen ? 'h-full' : 'max-h-[50vh] sm:max-h-[60vh]'
                }`}>
                <Document file={file.downloadURL} loading={null}>
                  {Array.from({ length: numPages || 0 }, (_, index) => (
                    <button
                      key={index + 1}
                      onClick={() => setPageNumber(index + 1)}
                      className={`w-full p-1 rounded border-2 transition-colors ${pageNumber === index + 1
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent hover:border-muted-foreground/30'
                        }`}
                    >
                      <Page
                        pageNumber={index + 1}
                        width={92}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                          <div className="h-28 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        }
                      />
                      <span className="text-xs text-muted-foreground">{index + 1}</span>
                    </button>
                  ))}
                </Document>
              </div>
            )}

            {/* PDF viewer */}
            <div
              className={`border p-2 rounded-md shadow-md bg-background overflow-auto flex-1 [scrollbar-gutter:stable] ${isFullscreen ? 'h-full' : 'max-h-[50vh] sm:max-h-[60vh]'
                }`}
              ref={pageContainerRef}
              style={{ touchAction: 'pan-x pan-y' }}
            >
              <div
                ref={pdfContentRef}
                className="w-fit mx-auto"
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
                >
                  <div className="relative">
                    <Page
                      pageNumber={pageNumber}
                      width={containerWidth ? containerWidth * scale : undefined}
                      loading={
                        <div className="flex items-center justify-center h-full w-full min-h-[300px]">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      }
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      canvasBackground="white"
                    />
                    {canvasDimensions.width > 0 && (
                      <AnnotationOverlay
                        pageNumber={pageNumber}
                        canvasWidth={canvasDimensions.width}
                        canvasHeight={canvasDimensions.height}
                        scale={scale}
                        onAddAnnotation={handleAddAnnotation}
                      />
                    )}
                  </div>
                </Document>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Select a PDF to view.</p>
      )}

      {/* Signature modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => {
          setShowSignatureModal(false);
          setPendingSignaturePosition(null);
        }}
        onSave={handleSaveSignature}
      />
    </div>
  );
};
