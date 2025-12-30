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
  X,
  ScrollText,
  Bookmark as BookmarkIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileMetadata, saveUserSignature, subscribeToUserSignature, UserSignature } from '@/services/firestore';
import { useAppStore } from '@/store/useAppStore';
import SignatureModal from './SignatureModal';
import EditToolbar from './EditToolbar';
import { embedAnnotationsInPdf } from '@/lib/pdf-utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { PDFPage } from './PDFPage';
import { Page } from 'react-pdf';
import { usePdfPersistence } from '@/hooks/usePdfPersistence';
import AnnotationsSidebar from './AnnotationsSidebar';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: FileMetadata;
  showConvertButton?: boolean;
}

// Zoom constants
const MIN_SCALE = 0.5;
const MAX_SCALE = 5; // Increased for better zoom capability
const ZOOM_STEP = 0.25;

const DocumentLoading = (
  <div className="flex items-center justify-center h-full w-full min-h-[500px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const DocumentNoData = <p>No PDF file selected or available.</p>;
const DocumentError = <p>Failed to load PDF. Check CORS settings or file availability.</p>;

export const PDFViewer = ({ file, showConvertButton = true }: PDFViewerProps) => {
  // Persistence hook
  usePdfPersistence();

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>('1');
  const [isConverting, setIsConverting] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  // scale is now the "base layout scale" (usually 1, or fit-width)
  const [scale, setScale] = useState<number>(1);
  // resolutionScale is the additional quality multiplier from zooming
  const [resolutionScale, setResolutionScale] = useState<number>(1);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [pendingSignaturePosition, setPendingSignaturePosition] = useState<{ x: number; y: number } | null>(null);

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
  const transformComponentRef = useRef<ReactZoomPanPinchContentRef>(null);

  const { currentUser } = useAuth();

  const {
    activeMode,
    activeEditTool,
    addAnnotation,
    annotations,
    setSelectedAnnotationId,
    selectedAnnotationId,
    deleteAnnotation,
    bookmarks,
    toggleBookmark,
    setSelectedBookmarkId
  } = useAppStore();

  const isBookmarked = bookmarks.some(b => b.pageNumber === pageNumber);

  // Zoom functions using the library
  const zoomIn = useCallback(() => {
    if (transformComponentRef.current) {
      transformComponentRef.current.zoomIn(ZOOM_STEP);
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (transformComponentRef.current) {
      transformComponentRef.current.zoomOut(ZOOM_STEP);
    }
  }, []);

  const resetZoom = useCallback(() => {
    if (transformComponentRef.current) {
      transformComponentRef.current.resetTransform();
      setResolutionScale(1);
    }
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
    resetZoom();
    setPagesDimensions({});
  }, [file.id, resetZoom]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onDocumentLoadSuccess = useCallback((pdf: any) => {
    setNumPages(pdf.numPages);
    setPageNumber(1);
    setInputValue('1');
    pdfDocumentRef.current = pdf;
  }, []);

  const scrollToPage = (page: number) => {
    if (transformComponentRef.current) {
        // We use zoomToElement to scroll/pan to the specific page
        // Note: the IDs must be set on the PDFPage components
        // We use a small timeout to ensure refs are ready if just loaded
        setTimeout(() => {
            // Using a hacky way to find element since we need the ID
            const elementId = `pdf-page-${page}`;
            const node = document.getElementById(elementId);
            if(node) {
                 // zoomToElement(node, scale, animationTime, type)
                 // We keep current scale
                 const currentScale = transformComponentRef.current?.instance.transformState.scale || 1;
                 transformComponentRef.current?.zoomToElement(node, currentScale, 300, 'easeOut');
            }
        }, 50);
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
    const container = pageContainerRef.current; // The TransformWrapper container usually?
    // Wait, with TransformWrapper, the container that scrolls is internal.
    // We need to observe the pages relative to the viewport.
    // We can use the window or the main container as root?
    // If TransformWrapper uses `overflow: hidden` and translates content,
    // IntersectionObserver with `root: null` (viewport) should work fine if the container is the viewport.

    if (!numPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisiblePage = -1;

        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '0');
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisiblePage = pageNum;
          } else if (entry.isIntersecting && mostVisiblePage === -1) {
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
        root: null, // viewport
        threshold: [0.1, 0.5, 0.9],
      }
    );

    // Observe all pages
    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [numPages, resolutionScale]); // Re-run when layout changes


  const handleDownloadImage = async () => {
    const pageEl = pageRefs.current.get(pageNumber);
    if (!pageEl) {
      toast.error('Current page not found.');
      return;
    }

    const annotationsForPage = annotations.filter(a => a.pageNumber === pageNumber);
    const hasSignaturesOrText = annotationsForPage.some(a => a.type === 'signature' || a.type === 'text');
    const hasHighlights = annotationsForPage.some(a => a.type === 'highlight');
    const shouldBurn = hasSignaturesOrText || (hasHighlights && includeHighlights);

    setIsConverting(true);
    toast.info('Converting page to image...', { id: 'image-conversion' });

    try {
      let imageDataUrl: string;

      if (shouldBurn && file.downloadURL) {
        const filteredAnnotations = annotations.filter(a =>
          a.type === 'signature' || a.type === 'text' || (includeHighlights && a.type === 'highlight')
        );

        const pageDims = pagesDimensions[pageNumber];
        const unscaledDimensions = pageDims ? {
          width: pageDims.width / scale,
          height: pageDims.height / scale,
        } : undefined;

        const annotatedPdfBytes = await embedAnnotationsInPdf(
          file.downloadURL,
          filteredAnnotations,
          unscaledDimensions,
          []
        );

        const loadingTask = pdfjs.getDocument({ data: annotatedPdfBytes });
        const pdfDoc = await loadingTask.promise;
        const page = await pdfDoc.getPage(pageNumber);

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('Could not get canvas context');

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        imageDataUrl = canvas.toDataURL('image/png', 1.0);
      } else {
        // Since we are now using a complex DOM structure with Fabric/Canvas, grabbing the canvas directly from DOM might be tricky
        // But for Phase 1, we still have the react-pdf canvas.
        // However, if we use the resolutionScale trick, the canvas might be scaled.
        // It's safer to re-render using pdfjs for download to get consistent quality.
        // For now, I'll fallback to the 'shouldBurn' path logic or just use pdfjs directly.
        // Actually, if we don't 'burn', we just want the raw PDF page.
        // Let's force using the PDFJS render to ensure high quality regardless of screen zoom.
         const loadingTask = pdfjs.getDocument(file.downloadURL!);
         const pdfDoc = await loadingTask.promise;
         const page = await pdfDoc.getPage(pageNumber);
         const viewport = page.getViewport({ scale: 1.5 });
         const canvas = document.createElement('canvas');
         canvas.width = viewport.width;
         canvas.height = viewport.height;
         const ctx = canvas.getContext('2d');
         if (!ctx) throw new Error("No context");
         await page.render({ canvasContext: ctx, viewport, canvas }).promise;
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
      scrollToPage(result.page);
    }
  };

  const prevResult = () => {
    if (searchResults.length === 0) return;
    const newIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentResultIndex(newIndex);
    const result = searchResults[newIndex];
    if (result.page !== pageNumber) {
      scrollToPage(result.page);
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
    } else if (activeEditTool === 'text') {
      addAnnotation({
        id: crypto.randomUUID(),
        pageNumber: page,
        type: 'text',
        position,
        content: 'Type here',
        style: { color: 'black', fontSize: 20 }
      });
    }
  }, [activeMode, activeEditTool, addAnnotation]);


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

    // Using layout scale (1) to calculate relative positions, not resolutionScale
    // But we need to be careful if dimensions are scaled.
    // dimensions from pagesDimensions are likely the RENDERED dimensions.
    // If we use resolutionScale, the reported dimensions might be large.
    // We should normalize to scale=1.

    // In PDFPage, we will report the "Base Layout Dimensions" ideally.
    // Or we report the actual dimensions and divide by (scale * resolutionScale).

    // Let's assume PDFPage reports the CSS dimensions (layout size).
    const unscaledWidth = dimensions.width;
    const unscaledHeight = dimensions.height;

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
  }, [pendingSignaturePosition, pendingSignaturePage, addAnnotation, pagesDimensions, currentUser]);

  const handleExportWithAnnotations = useCallback(async () => {
    if (annotations.length === 0 && bookmarks.length === 0) {
      toast.info('No annotations or bookmarks to export');
      return;
    }

    try {
      toast.info('Exporting PDF...', { id: 'export-pdf' });

      const firstPageDims = pagesDimensions[1] || Object.values(pagesDimensions)[0];
      if (!firstPageDims) {
        throw new Error("Page dimensions not available");
      }

      // Assumption: pagesDimensions stores layout dimensions (scale 1 * resolutionScale 1)
      const unscaledDimensions = {
        width: firstPageDims.width,
        height: firstPageDims.height,
      };

      if (!file.downloadURL) {
        throw new Error('File URL is missing');
      }

      const filteredAnnotations = annotations.filter(a =>
        a.type === 'signature' || a.type === 'text' ||
        (includeHighlights && a.type === 'highlight')
      );

      const pdfBytes = await embedAnnotationsInPdf(
        file.downloadURL,
        filteredAnnotations,
        unscaledDimensions,
        bookmarks
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
  }, [annotations, file, pagesDimensions, bookmarks, includeHighlights]);

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

  // Deselect when clicking the background
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('react-pdf__Document')) {
      setSelectedAnnotationId(null);
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
              <Button onClick={zoomOut} disabled={resolutionScale <= MIN_SCALE && false} variant="outline" size="icon" title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              {/* Note: Showing current zoom level is tricky as it is handled by the library. We can show resolutionScale as approximation */}
              <span className="text-sm font-medium w-14 text-center">
                 {/* This might lag behind the visual zoom but is correct for resolution */}
                 {Math.round(resolutionScale * 100)}%
              </span>
              <Button onClick={zoomIn} disabled={resolutionScale >= MAX_SCALE && false} variant="outline" size="icon" title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button onClick={resetZoom} variant="outline" size="icon" title="Reset zoom">
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

          {activeMode === 'edit' && (
            <div className="flex justify-center">
              <EditToolbar
                onExport={handleExportWithAnnotations}
                includeHighlights={includeHighlights}
                setIncludeHighlights={setIncludeHighlights}
              />
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

            {/* Scrollable PDF List with TransformWrapper */}
            <div
              className={`border rounded-md shadow-md bg-background overflow-hidden flex-1 ${isFullscreen ? 'h-full' : 'h-[50vh] sm:h-[60vh]'
                }`}
              ref={pageContainerRef}
            >
               <TransformWrapper
                  ref={transformComponentRef}
                  initialScale={1}
                  minScale={MIN_SCALE}
                  maxScale={MAX_SCALE}
                  centerOnInit={false}
                  onZoomStop={(e) => {
                    // Two-pass rendering: update resolution after zoom stops
                    setResolutionScale(e.state.scale);
                  }}
                  wheel={{ step: 0.1 }}
                  panning={{ velocityDisabled: true }}
                >
                  <TransformComponent
                    wrapperStyle={{ width: "100%", height: "100%" }}
                    contentStyle={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
                  >
                    <div
                        ref={pdfContentRef} // Re-using this ref for Document
                        className="w-full flex flex-col items-center"
                        onClick={handleBackgroundClick}
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
                            const isNear = Math.abs(pageNumber - pageNum) <= 2;
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
                                scale={scale} // Base layout scale (1)
                                resolutionScale={resolutionScale} // Quality scale
                                containerWidth={containerWidth}
                                shouldRender={isNear || pageNum === 1}
                                defaultHeight={estimatedPageHeight}
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
                  </TransformComponent>
               </TransformWrapper>
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
