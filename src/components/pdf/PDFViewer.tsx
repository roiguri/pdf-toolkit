// src/components/pdf/PDFViewer.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Image as ImageIcon,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { FileMetadata, saveUserSignature, subscribeToUserSignature, UserSignature } from '@/services/firestore';
import { usePinch } from '@use-gesture/react';
import { useAppStore } from '@/store/useAppStore';
import SignatureModal from './SignatureModal';
import EditToolbar from './EditToolbar';
import { embedAnnotationsInPdf } from '@/lib/pdf-utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { PDFPage } from './PDFPage';
import { Page } from 'react-pdf';

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

const DocumentLoading = (
  <div className="flex items-center justify-center h-full w-full min-h-[500px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const DocumentNoData = <p>No PDF file selected or available.</p>;
const DocumentError = <p>Failed to load PDF. Check CORS settings or file availability.</p>;

export const PDFViewer = ({ file, showConvertButton = true }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>('1');
  const [isConverting, setIsConverting] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [scale, setScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [pendingSignaturePosition, setPendingSignaturePosition] = useState<{ x: number; y: number } | null>(null);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ page: number; matchIndexOnPage: number }[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocumentRef = useRef<any>(null);

  // Track dimensions for all pages to support correct export coordinates
  const [pagesDimensions, setPagesDimensions] = useState<Record<number, { width: number, height: number }>>({});

  // Refs for scrolling to pages
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();

  const { activeMode, activeEditTool, addAnnotation, annotations, setSelectedAnnotationId, selectedAnnotationId, deleteAnnotation } = useAppStore();

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

  const bind = usePinch(
    ({ offset: [s], memo, active, last }) => {
      if (active) {
        if (pdfContentRef.current) {
          const initialScale = memo ?? scale;
          const currentScale = s;
          pdfContentRef.current.style.transform = `scale(${currentScale / initialScale})`;
          pdfContentRef.current.style.transformOrigin = '0 0';
          return initialScale;
        }
      } else if (last) {
        if (pdfContentRef.current) {
          pdfContentRef.current.style.transform = '';
        }
        setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)));
      }
      return memo;
    },
    {
      scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
      from: () => [scale, 0],
      eventOptions: { passive: false }, // Necessary for preventing browser zoom
    }
  );

  // Prevent default pinch-to-zoom on the page (mobile)
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return;

    // We only want to prevent default if it's a multi-touch (pinch) event
    // This allows single-touch scrolling ("pan") to work natively
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    // 'pan-x pan-y' allows browser scrolling (which is 1-finger) 
    // but tells browser we might handle 2-finger gestures or browser zoom shouldn't happen?
    // Actually 'pan-x pan-y' tells the browser "I only handle panning, you can handle zoom".
    // Wait, we WANT to handle zoom. So we should disable browser zoom.
    // 'pan-x pan-y' allows panning but DISABLES double-tap zoom usually.
    // To disable pinch zoom, we often resort to preventDefault on 2 fingers (implemented above).
    container.style.touchAction = 'pan-x pan-y';

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
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const width = container.clientWidth - 32; // More padding for scrollbar
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
    setPagesDimensions({});
  }, [file.id]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onDocumentLoadSuccess = useCallback((pdf: any) => {
    setNumPages(pdf.numPages);
    setPageNumber(1);
    setInputValue('1');
    pdfDocumentRef.current = pdf;
  }, []);

  const scrollToPage = (page: number, options?: ScrollIntoViewOptions) => {
    const pageEl = pageRefs.current.get(page);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'auto', block: 'start', ...options });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = parseInt(inputValue);
      if (!isNaN(page) && page >= 1 && page <= (numPages || 0)) {
        scrollToPage(page);
        // We don't setPageNumber here because the scroll listener will do it
        e.currentTarget.blur();
      } else {
        // Reset to current page if invalid
        setInputValue(pageNumber.toString());
      }
    }
  };

  const handleInputBlur = () => {
    // Reset to current page if invalid or empty
    setInputValue(pageNumber.toString());
  };


  // Intersection Observer for Current Page Detection
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container || !numPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // We want to find the entry that is most visible
        let maxRatio = 0;
        let mostVisiblePage = -1;

        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '0');
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisiblePage = pageNum;
          } else if (entry.isIntersecting && mostVisiblePage === -1) {
            // If we haven't found a "most visible" yet, take the first intersecting one
            mostVisiblePage = pageNum;
          }
        });

        if (mostVisiblePage !== -1) {
          setPageNumber((prev) => {
            if (prev !== mostVisiblePage) {
              setInputValue(mostVisiblePage.toString());
              return mostVisiblePage;
            }
            return prev;
          });
        }
      },
      {
        root: container,
        threshold: [0.1, 0.5, 0.9], // Check at different visibility levels
      }
    );

    // Observe all pages
    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [numPages]); // Re-run when numPages changes (and pages render)


  const handleDownloadImage = async () => {
    // Find the current page's element
    const pageEl = pageRefs.current.get(pageNumber);
    if (!pageEl) {
      toast.error('Current page not found.');
      return;
    }

    const canvas = pageEl.querySelector('canvas');
    if (!canvas) {
      toast.error('Page rendering not complete. Please wait a moment.');
      return;
    }

    setIsConverting(true);
    toast.info('Converting page to image...', { id: 'image-conversion' });

    try {
      const imageDataUrl = canvas.toDataURL('image/png', 1.0);

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

  const handlePageDimensionsChange = useCallback((page: number, width: number, height: number) => {
    setPagesDimensions(prev => ({
      ...prev,
      [page]: { width, height }
    }));
  }, []);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search functionality
  const performSearch = useCallback(async () => {
    if (!debouncedSearchQuery.trim() || !pdfDocumentRef.current) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setCurrentResultIndex(-1);

    try {
      const results: { page: number; matchIndexOnPage: number }[] = [];
      const numPages = pdfDocumentRef.current.numPages;
      const query = debouncedSearchQuery.toLowerCase();

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocumentRef.current.getPage(i);
        const textContent = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = textContent.items.map((item: any) => item.str).join(' ');

        const matchesCount = text.toLowerCase().split(query).length - 1;
        if (matchesCount > 0) {
          for (let k = 0; k < matchesCount; k++) {
            results.push({ page: i, matchIndexOnPage: k });
          }
        }
      }

      setSearchResults(results);
      if (results.length > 0) {
        setCurrentResultIndex(0);
        scrollToPage(results[0].page);
      }

    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to perform search');
    } finally {
      setIsSearching(false);
    }
  }, [debouncedSearchQuery]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const nextResult = () => {
    if (searchResults.length === 0) return;
    const newIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(newIndex);
    const result = searchResults[newIndex];
    if (result.page !== pageNumber) {
      scrollToPage(result.page, { block: 'nearest' });
    }
  };

  const prevResult = () => {
    if (searchResults.length === 0) return;
    const newIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentResultIndex(newIndex);
    const result = searchResults[newIndex];
    if (result.page !== pageNumber) {
      scrollToPage(result.page, { block: 'nearest' });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentResultIndex(-1);
    setIsSearchOpen(false);
  };


  // We need to store the page number for the pending signature
  const [pendingSignaturePage, setPendingSignaturePage] = useState<number | null>(null);

  const onPageAddAnnotation = useCallback((position: { x: number; y: number }, page: number) => {
    if (activeMode !== 'edit') return;
    if (activeEditTool === 'signature') {
      setPendingSignaturePosition(position);
      setPendingSignaturePage(page);
    }
  }, [activeMode, activeEditTool]);


  const [savedSignature, setSavedSignature] = useState<UserSignature | null>(null);

  useEffect(() => {
    if (currentUser?.uid) {
      const unsubscribe = subscribeToUserSignature(currentUser.uid, (signature) => {
        setSavedSignature(signature);
      });
      return () => unsubscribe();
    } else {
      setSavedSignature(null);
    }
  }, [currentUser]);

  // Handle saving signature from modal
  const handleSaveSignature = useCallback(async (signatureDataUrl: string, width: number, height: number, saveToProfile: boolean) => {
    if (!pendingSignaturePosition || pendingSignaturePage === null) return;

    const targetPage = pendingSignaturePage;

    // Get dimensions for the specific page
    const dimensions = pagesDimensions[targetPage] || { width: 0, height: 0 };
    // Fallback if dimensions missing (shouldn't happen if page rendered)
    if (dimensions.width === 0) {
      console.error("Missing dimensions for page", targetPage);
      return;
    }

    if (saveToProfile && currentUser) {
      try {
        await saveUserSignature(currentUser.uid, signatureDataUrl, width, height);
        toast.success('Signature saved to profile');
        setSavedSignature({
          id: 'default',
          dataUrl: signatureDataUrl,
          width,
          height,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Error saving signature:', error);
        toast.error('Failed to save signature to profile');
      }
    }

    const MAX_WIDTH = 120;
    const MAX_HEIGHT = 60;
    const aspectRatio = width / height;

    let targetWidth = MAX_WIDTH;
    let targetHeight = targetWidth / aspectRatio;

    if (targetHeight > MAX_HEIGHT) {
      targetHeight = MAX_HEIGHT;
      targetWidth = targetHeight * aspectRatio;
    }

    const unscaledWidth = dimensions.width / scale;
    const unscaledHeight = dimensions.height / scale;

    const relativeWidth = unscaledWidth > 0 ? targetWidth / unscaledWidth : 0.15;
    const relativeHeight = unscaledHeight > 0 ? targetHeight / unscaledHeight : 0.08;

    const centeredPosition = {
      x: pendingSignaturePosition.x - relativeWidth / 2,
      y: pendingSignaturePosition.y - relativeHeight / 2,
    };

    const newAnnotation = {
      id: crypto.randomUUID(),
      pageNumber: targetPage,
      type: 'signature' as const,
      position: centeredPosition,
      content: signatureDataUrl,
      style: { width: relativeWidth, height: relativeHeight },
    };
    addAnnotation(newAnnotation);
    setPendingSignaturePosition(null);
    setPendingSignaturePage(null);
  }, [pendingSignaturePosition, pendingSignaturePage, addAnnotation, pagesDimensions, scale, currentUser]);

  // Handle exporting PDF with annotations
  const handleExportWithAnnotations = useCallback(async () => {
    if (annotations.length === 0) {
      toast.info('No annotations to export');
      return;
    }

    try {
      toast.info('Exporting PDF with annotations...', { id: 'export-pdf' });

      // Create a map of dimensions for each page that has annotations
      // But embedAnnotationsInPdf expects a single 'unscaledDimensions' object?
      // Let's check embedAnnotationsInPdf usage.
      // It seems the utility might assume same size for all pages or we need to update it.
      // The previous code passed:
      // const unscaledDimensions = {
      //   width: canvasDimensions.width / scale,
      //   height: canvasDimensions.height / scale,
      // };
      // which implies one dimension for the whole doc.

      // If the PDF has varying page sizes, this might be incorrect for some pages.
      // However, the task is "replace pagination with scrolling", not "fix PDF export for mixed page sizes".
      // But "Make sure this does not effect any of the tools woth extra care on edit".

      // I should check if I can pass per-page dimensions to embedAnnotationsInPdf.
      // If not, I should probably use the dimensions of the FIRST page, or the page of the annotation.

      // Let's peek at `embedAnnotationsInPdf` signature in memory or assuming standard.
      // Current usage: embedAnnotationsInPdf(url, annotations, dimensions).

      // I will assume for now we use the dimensions of the first page or a dominant page.
      // Or better, I can iterate and find the dimension for each annotation's page.
      // But the function signature suggests one dimension arg.

      // Let's stick to using the dimension of the *current active page* or Page 1?
      // Using Page 1 is safer if we assume uniform pages.
      // Using `pagesDimensions[1]` (or any available).

      const firstPageDims = pagesDimensions[1] || Object.values(pagesDimensions)[0];

      if (!firstPageDims) {
        throw new Error("Page dimensions not available");
      }

      const unscaledDimensions = {
        width: firstPageDims.width / scale,
        height: firstPageDims.height / scale,
      };

      if (!file.downloadURL) {
        throw new Error('File URL is missing');
      }

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
  }, [annotations, file, pagesDimensions, scale]);

  // Handle delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeMode !== 'edit' || !selectedAnnotationId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteAnnotation(selectedAnnotationId);
        setSelectedAnnotationId(null);
        toast.success('Annotation deleted');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, selectedAnnotationId, deleteAnnotation, setSelectedAnnotationId]);

  return (
    <div
      ref={viewerContainerRef}
      className={`flex flex-col w-full ${isFullscreen ? 'h-screen bg-background p-4 space-y-4' : 'space-y-4'}`}
    >
      {file ? (
        <>
          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-2 w-full relative">
            <Button onClick={toggleThumbnails} variant="outline" size="icon" title={showThumbnails ? 'Hide pages' : 'Show pages'}>
              {showThumbnails ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>

            <Button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              variant={isSearchOpen ? "secondary" : "outline"}
              size="icon"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </Button>

            {isSearchOpen && (
              <div className="absolute top-full left-0 mt-2 z-20 bg-background border p-2 rounded-md shadow-lg flex items-center gap-2 min-w-[300px]">
                <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2 flex-1">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.shiftKey) {
                          prevResult();
                        } else {
                          nextResult();
                        }
                      }
                    }}
                    placeholder="Search text..."
                    className="h-8"
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {searchResults.length > 0 ? `${currentResultIndex + 1} / ${searchResults.length}` : '0 / 0'}
                  </span>
                </form>
                <div className="flex items-center gap-1">
                  <Button onClick={prevResult} disabled={searchResults.length === 0} variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button onClick={nextResult} disabled={searchResults.length === 0} variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button onClick={clearSearch} variant="ghost" size="icon" className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Pagination Input */}
            <div className="flex items-center gap-2">
              <Input
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onBlur={handleInputBlur}
                className="w-16 text-center h-9"
              />
              <span className="text-sm font-medium whitespace-nowrap">
                / {numPages || '...'}
              </span>
            </div>

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

            <Button onClick={toggleFullscreen} variant="outline" size="icon" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>

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
          {isSearching && (
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 animate-pulse" />
          )}

          {activeMode === 'edit' && (
            <div className="flex justify-center">
              <EditToolbar onExport={handleExportWithAnnotations} />
            </div>
          )}

          <div className={`flex flex-1 gap-2 overflow-hidden ${isFullscreen ? 'h-full' : ''}`}>
            {/* Thumbnails */}
            {showThumbnails && (
              <div className={`w-32 flex-shrink-0 border rounded-md bg-muted/30 overflow-y-auto p-2 space-y-2 ${isFullscreen ? 'h-full' : 'max-h-[50vh] sm:max-h-[60vh]'
                }`}>
                <Document file={file.downloadURL} loading={null}>
                  {Array.from({ length: numPages || 0 }, (_, index) => (
                    <button
                      key={index + 1}
                      onClick={() => scrollToPage(index + 1)}
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

            {/* Scrollable PDF List */}
            <div
              className={`border p-2 rounded-md shadow-md bg-background overflow-auto flex-1 [scrollbar-gutter:stable] ${isFullscreen ? 'h-full' : 'max-h-[50vh] sm:max-h-[60vh]'
                }`}
              ref={pageContainerRef}
              {...bind()}
            >
              <div
                ref={pdfContentRef}
                className="w-full"
              >
                <Document
                  file={file.downloadURL}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={DocumentLoading}
                  noData={DocumentNoData}
                  error={DocumentError}
                >
                  {numPages && Array.from({ length: numPages }, (_, index) => {
                    const pageNum = index + 1;
                    // Simple lazy loading logic: Render if within +/- 3 pages of current page
                    const isNear = Math.abs(pageNumber - pageNum) <= 2;

                    return (
                      <PDFPage
                        key={pageNum}
                        ref={(el) => {
                          if (el) {
                            pageRefs.current.set(pageNum, el);
                          } else {
                            pageRefs.current.delete(pageNum);
                          }
                        }}
                        pageNumber={pageNum}
                        scale={scale}
                        containerWidth={containerWidth}
                        shouldRender={isNear || pageNum === 1} // Always render page 1 to start
                        onAddAnnotation={(pos) => onPageAddAnnotation(pos, pageNum)}
                        onDimensionsChange={(w, h) => handlePageDimensionsChange(pageNum, w, h)}
                        searchQuery={debouncedSearchQuery}
                        focusedMatchIndex={
                          searchResults[currentResultIndex]?.page === pageNum
                            ? searchResults[currentResultIndex].matchIndexOnPage
                            : null
                        }
                      />
                    );
                  })}
                </Document>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Select a PDF to view.</p>
      )}

      <SignatureModal
        isOpen={!!pendingSignaturePosition}
        onClose={() => {
          setPendingSignaturePosition(null);
          setPendingSignaturePage(null);
        }}
        onSave={handleSaveSignature}
        savedSignature={savedSignature}
      />
    </div>
  );
};
