// src/components/pdf/PDFViewer.tsx
'use client';

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
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
  X,
  ScrollText,
  Bookmark as BookmarkIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileMetadata } from '@/services/firestore';
import { usePinch } from '@use-gesture/react';
import { useAppStore } from '@/store/useAppStore';
import { embedAnnotationsInPdf } from '@/lib/pdf-utils';
import { PDFPage } from './PDFPage';
import { Page } from 'react-pdf';
import AnnotationsSidebar from './AnnotationsSidebar';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PDFViewerHandle {
  getPageElement: (pageNumber: number) => HTMLDivElement | null;
  currentPage: number;
  scale: number;
  pagesDimensions: Record<number, { width: number; height: number }>;
}

interface PDFViewerProps {
  file: FileMetadata;
  showConvertButton?: boolean;
  // New optional props — when provided, take precedence over store values
  annotations?: import('@/store/useAppStore').Annotation[];
  selectedAnnotationId?: string | null;
  bookmarks?: import('@/store/useAppStore').Bookmark[];
  selectedBookmarkId?: string | null;
  isEditMode?: boolean;
  activeEditTool?: import('@/store/useAppStore').AnnotationType | null;
  onAnnotationAdd?: (annotation: import('@/store/useAppStore').Annotation) => void;
  onAnnotationUpdate?: (id: string, updates: Partial<import('@/store/useAppStore').Annotation>) => void;
  onAnnotationDelete?: (id: string) => void;
  onAnnotationSelect?: (id: string | null) => void;
  onBookmarkToggle?: (pageNumber: number) => void;
  onBookmarkSelect?: (id: string | null) => void;
  toolbarSlot?: React.ReactNode;
  onSignaturePlacementRequest?: (position: { x: number; y: number }, pageNumber: number) => void;
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

export const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(function PDFViewer({
  file,
  showConvertButton = true,
  toolbarSlot,
  annotations: annotationsProp,
  selectedAnnotationId: selectedAnnotationIdProp,
  bookmarks: bookmarksProp,
  selectedBookmarkId: _selectedBookmarkIdProp,
  isEditMode: isEditModeProp,
  activeEditTool: _activeEditToolProp,
  onAnnotationAdd: onAnnotationAddProp,
  onAnnotationUpdate: onAnnotationUpdateProp,
  onAnnotationDelete: onAnnotationDeleteProp,
  onAnnotationSelect: onAnnotationSelectProp,
  onBookmarkToggle: _onBookmarkToggle,
  onBookmarkSelect: _onBookmarkSelect,
  onSignaturePlacementRequest: onSignaturePlacementRequestProp,
  activeEditTool: activeEditToolProp,
}: PDFViewerProps, ref) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>('1');
  const [isConverting, setIsConverting] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [scale, setScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const [includeHighlights, setIncludeHighlights] = useState(false);

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

  // Expose imperative handle for tools (e.g. ConvertTool needs canvas access)
  useImperativeHandle(ref, () => ({
    getPageElement: (page: number) => pageRefs.current.get(page) ?? null,
    get currentPage() { return pageNumber; },
    get scale() { return scale; },
    get pagesDimensions() { return pagesDimensions; },
  }), [pageNumber, scale, pagesDimensions]);

  const {
    activeMode,
    activeEditTool,
    addAnnotation,
    annotations,
    setSelectedAnnotationId,
    selectedAnnotationId,
    deleteAnnotation,
    updateAnnotation,
    bookmarks,
    toggleBookmark,
    setSelectedBookmarkId
  } = useAppStore();

  // Effective values — props take precedence over store values.
  // This allows tool components to supply their own data/callbacks while
  // keeping the store as fallback so existing usage works unchanged.
  const effectiveAnnotations = annotationsProp ?? annotations;
  const effectiveSelectedAnnotationId = selectedAnnotationIdProp !== undefined ? selectedAnnotationIdProp : selectedAnnotationId;
  const effectiveIsEditMode = isEditModeProp ?? (activeMode === 'edit');
  const effectiveActiveEditTool = activeEditToolProp ?? activeEditTool;
  const effectiveOnAnnotationAdd = onAnnotationAddProp ?? addAnnotation;
  const effectiveOnAnnotationUpdate = onAnnotationUpdateProp ?? updateAnnotation;
  const effectiveOnAnnotationDelete = onAnnotationDeleteProp ?? deleteAnnotation;
  const effectiveOnAnnotationSelect = onAnnotationSelectProp ?? setSelectedAnnotationId;

  const effectiveBookmarks = bookmarksProp ?? bookmarks;
  const isBookmarked = effectiveBookmarks.some(b => b.pageNumber === pageNumber);

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
    if (!showThumbnails) setShowBookmarks(false);
  }, [showThumbnails]);

  // Toggle bookmarks sidebar
  const toggleBookmarks = useCallback(() => {
    setShowBookmarks(prev => !prev);
    if (!showBookmarks) setShowThumbnails(false);
  }, [showBookmarks]);

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
    const pageEl = pageRefs.current.get(pageNumber);
    if (!pageEl) {
      toast.error('Current page not found.');
      return;
    }

    // Determine if we need to burn annotations
    // We burn if there are any non-highlight annotations, OR if there are highlights and user requested them.
    const annotationsForPage = annotations.filter(a => a.pageNumber === pageNumber);
    const hasSignaturesOrText = annotationsForPage.some(a => a.type === 'signature' || a.type === 'text');
    const hasHighlights = annotationsForPage.some(a => a.type === 'highlight');
    const shouldBurn = hasSignaturesOrText || (hasHighlights && includeHighlights);

    setIsConverting(true);
    toast.info('Converting page to image...', { id: 'image-conversion' });

    try {
      let imageDataUrl: string;

      if (shouldBurn && file.downloadURL) {
        // Filter annotations: always keep sigs/text, keep highlights if requested
        const filteredAnnotations = annotations.filter(a =>
          a.type === 'signature' || a.type === 'text' || (includeHighlights && a.type === 'highlight')
        );

        // Embed annotations into a temporary PDF buffer
        // Note: we embed ALL annotations for the doc, then render the specific page
        const pageDims = pagesDimensions[pageNumber];
        const unscaledDimensions = pageDims ? {
          width: pageDims.width / scale,
          height: pageDims.height / scale,
        } : undefined;

        const annotatedPdfBytes = await embedAnnotationsInPdf(
          file.downloadURL,
          filteredAnnotations,
          unscaledDimensions, // Best effort dimensions
          // We don't strictly need bookmarks for image export, but no harm passing them if we have them
          []
        );

        // Load this new PDF data into pdfjs
        // We have to use a separate Document loading approach here just to render the one page to canvas
        const loadingTask = pdfjs.getDocument({ data: annotatedPdfBytes });
        const pdfDoc = await loadingTask.promise;
        const page = await pdfDoc.getPage(pageNumber);

        // Create an off-screen canvas
        const viewport = page.getViewport({ scale: 1.5 }); // Higher scale for better quality
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('Could not get canvas context');

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        imageDataUrl = canvas.toDataURL('image/png', 1.0);
      } else {
        // Fast path: existing canvas (likely no annotations needing burning or user unselected highlights and no signatures)
        // However, if we possess signatures/text, we MUST burn them. The check 'shouldBurn' covers this.
        // So this else block is only for when there are NO annotations at all effectively.
        const canvas = pageEl.querySelector('canvas');
        if (!canvas) {
          toast.error('Page rendering not complete. Please wait a moment.');
          return;
        }
        imageDataUrl = canvas.toDataURL('image/png', 1.0);
      }

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


  const onPageAddAnnotation = useCallback((position: { x: number; y: number }, page: number) => {
    if (!effectiveIsEditMode) return;
    if (effectiveActiveEditTool === 'signature' && onSignaturePlacementRequestProp) {
      onSignaturePlacementRequestProp(position, page);
    }
  }, [effectiveIsEditMode, effectiveActiveEditTool, onSignaturePlacementRequestProp]);


  // Handle delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!effectiveIsEditMode || !effectiveSelectedAnnotationId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        effectiveOnAnnotationDelete(effectiveSelectedAnnotationId);
        effectiveOnAnnotationSelect(null);
        toast.success('Annotation deleted');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectiveIsEditMode, effectiveSelectedAnnotationId, effectiveOnAnnotationDelete, effectiveOnAnnotationSelect]);

  // Deselect when clicking the background
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // If the click target is the container itself or a direct padding area, not a page
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('react-pdf__Document')) {
      effectiveOnAnnotationSelect(null);
      setSelectedBookmarkId(null);
    }
  };

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

            <Button onClick={toggleBookmarks} variant="outline" size="icon" title={showBookmarks ? 'Hide bookmarks' : 'Show bookmarks'}>
              <ScrollText className="h-4 w-4" />
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
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20 bg-background border p-2 rounded-md shadow-lg flex items-center gap-2 min-w-[300px]">
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

            <Button
              onClick={() => toggleBookmark(pageNumber)}
              variant={isBookmarked ? "default" : "outline"}
              size="icon"
              title={isBookmarked ? "Remove bookmark" : "Bookmark this page"}
            >
              <BookmarkIcon className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
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

            <Button onClick={toggleFullscreen} variant="outline" size="icon" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>

            {showConvertButton && (
              <div className="flex items-center gap-2 ml-2 border-l pl-2">
                <div className="flex items-center gap-2 mr-1">
                  <Checkbox
                    id="include-highlights-convert"
                    checked={includeHighlights}
                    onCheckedChange={(checked) => setIncludeHighlights(checked === true)}
                  />
                  <Label htmlFor="include-highlights-convert" className="text-xs font-medium cursor-pointer text-muted-foreground whitespace-nowrap">
                    Highlights
                  </Label>
                </div>
                <Button
                  onClick={handleDownloadImage}
                  disabled={isConverting}
                  variant="outline"
                >
                  {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Convert to Image
                </Button>
              </div>
            )}
          </div>
          {isSearching && (
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 animate-pulse" />
          )}

          {toolbarSlot && (
            <div className="flex justify-center">
              {toolbarSlot}
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

            {/* Bookmarks Sidebar */}
            {showBookmarks && (
              <AnnotationsSidebar onScrollToPage={scrollToPage} />
            )}

            {/* Scrollable PDF List */}
            <div
              className={`border p-2 rounded-md shadow-md bg-background overflow-auto flex-1 [scrollbar-gutter:stable] ${isFullscreen ? 'h-full' : 'max-h-[50vh] sm:max-h-[60vh]'
                }`}
              ref={pageContainerRef}
              {...bind()}
              onClick={handleBackgroundClick} // Handle outside click
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

                    // Estimate height from page 1 or any loaded page
                    const estimatedPageHeight = pagesDimensions[1]?.height || Object.values(pagesDimensions)[0]?.height;

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
                        defaultHeight={estimatedPageHeight}
                        onAddAnnotation={(pos) => onPageAddAnnotation(pos, pageNum)}
                        onAnnotationAdd={effectiveOnAnnotationAdd}
                        onDimensionsChange={(w, h) => handlePageDimensionsChange(pageNum, w, h)}
                        searchQuery={debouncedSearchQuery}
                        focusedMatchIndex={
                          searchResults[currentResultIndex]?.page === pageNum
                            ? searchResults[currentResultIndex].matchIndexOnPage
                            : null
                        }
                        isEditMode={effectiveIsEditMode}
                        annotations={effectiveAnnotations.filter(a => a.pageNumber === pageNum)}
                        selectedAnnotationId={effectiveSelectedAnnotationId}
                        onAnnotationUpdate={effectiveOnAnnotationUpdate}
                        onAnnotationDelete={effectiveOnAnnotationDelete}
                        onAnnotationSelect={effectiveOnAnnotationSelect}
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

    </div>
  );
});
