'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Page } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import AnnotationOverlay from './AnnotationOverlay';
import TextSelectionMenu from './TextSelectionMenu';
import { useAppStore } from '@/store/useAppStore';

interface PDFPageProps {
  pageNumber: number;
  scale: number;
  containerWidth?: number;
  shouldRender: boolean;
  onAddAnnotation: (position: { x: number; y: number }) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  searchQuery?: string;
  focusedMatchIndex?: number | null;
  defaultHeight?: number;
}

const PageLoading = (
  <div className="flex items-center justify-center h-full w-full min-h-[300px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

interface HighlightRect {
  id: string;
  rects: { top: number; left: number; width: number; height: number }[];
  isFocused: boolean;
}

export const PDFPage = React.forwardRef<HTMLDivElement, PDFPageProps>(({
  pageNumber,
  scale,
  containerWidth,
  shouldRender,
  onAddAnnotation,
  onDimensionsChange,
  searchQuery,
  focusedMatchIndex,
  defaultHeight,
}, ref) => {
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [highlights, setHighlights] = useState<HighlightRect[]>([]);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedRects, setSelectedRects] = useState<{ x: number; y: number; width: number; height: number }[]>([]);
  const [selectedText, setSelectedText] = useState('');

  const pageContentRef = useRef<HTMLDivElement>(null);
  const textLayerRendered = useRef(false);
  const { addAnnotation, activeMode } = useAppStore();

  // Function to calculate highlights without modifying DOM
  const calculateHighlights = useCallback(() => {
    if (!pageContentRef.current || !searchQuery || !searchQuery.trim()) {
      setHighlights([]);
      return;
    }

    const textLayer = pageContentRef.current.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) return;

    const containerRect = pageContentRef.current.getBoundingClientRect();
    const spans = Array.from(textLayer.querySelectorAll('span'));

    // 1. Build global text string and map indices to text nodes
    let fullText = '';
    const nodeMap: { node: Node; start: number; end: number }[] = [];

    spans.forEach((span, i) => {
      const textNode = span.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const text = textNode.textContent || '';
        const start = fullText.length;
        fullText += text;
        const end = fullText.length;

        nodeMap.push({ node: textNode, start, end });

        if (i < spans.length - 1) {
          fullText += ' ';
        }
      }
    });

    const newHighlights: HighlightRect[] = [];
    const lowerText = fullText.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    let matchCount = 0;

    let startIndex = 0;
    let index = lowerText.indexOf(lowerQuery, startIndex);

    while (index !== -1) {
      const matchStart = index;
      const matchEnd = matchStart + lowerQuery.length;

      const startNodeData = nodeMap.find(n => matchStart >= n.start && matchStart < n.end);

      if (startNodeData) {
        let endNodeData = nodeMap.find(n => matchEnd > n.start && matchEnd <= n.end);

        if (!endNodeData) {
          const lastNode = nodeMap[nodeMap.length - 1];
          if (lastNode && matchEnd > lastNode.end) endNodeData = lastNode;
          else endNodeData = nodeMap.find(n => matchEnd <= n.end && matchEnd > n.start);
        }
        if (!endNodeData && nodeMap.length > 0) endNodeData = nodeMap.find(n => n.end >= matchEnd);

        if (startNodeData && endNodeData) {
          try {
            const range = document.createRange();
            let startOffset = matchStart - startNodeData.start;
            let endOffset = matchEnd - endNodeData.start;  // Global offset

            if (startOffset < 0) startOffset = 0;
            if (startOffset > (startNodeData.node.textContent?.length || 0)) startOffset = startNodeData.node.textContent?.length || 0;
            if (endOffset < 0) endOffset = 0;
            if (endOffset > (endNodeData.node.textContent?.length || 0)) endOffset = endNodeData.node.textContent?.length || 0;

            range.setStart(startNodeData.node, startOffset);
            range.setEnd(endNodeData.node, endOffset);

            const clientRects = Array.from(range.getClientRects());
            if (clientRects.length > 0) {
              const relativeRects = clientRects.map(rect => ({
                top: rect.top - containerRect.top,
                left: rect.left - containerRect.left,
                width: rect.width,
                height: rect.height
              }));
              newHighlights.push({
                id: `highlight-${matchCount}`,
                rects: relativeRects,
                isFocused: matchCount === focusedMatchIndex
              });
              matchCount++;
            }
          } catch (e) {
            console.warn('Range error', e);
          }
        }
      }
      startIndex = index + lowerQuery.length;
      index = lowerText.indexOf(lowerQuery, startIndex);
    }
    setHighlights(newHighlights);

  }, [searchQuery, focusedMatchIndex]);

  // Trigger calculation when text layer is ready or query changes
  useEffect(() => {
    if (textLayerRendered.current) {
      // Debounce slightly to allow layout to settle?
      // Range API is sync and fast.
      calculateHighlights();
    }
  }, [calculateHighlights]);

  // Handle scrolling via Callback Ref (Simpler, more robust than useEffect)
  const scrollToRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // Use requestAnimationFrame to ensure layout is settled after page scroll
      requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      });
    }
  }, []);

  const onRenderTextLayerSuccess = useCallback(() => {
    textLayerRendered.current = true;
    calculateHighlightsRef.current?.();
  }, []);

  // Use a ref to access latest calculateHighlights without changing callback dependency
  const calculateHighlightsRef = useRef(calculateHighlights);
  useEffect(() => {
    calculateHighlightsRef.current = calculateHighlights;
  }, [calculateHighlights]);

  // Trigger calculation when text layer is ready or query changes
  useEffect(() => {
    if (textLayerRendered.current) {
      calculateHighlights();
    }
  }, [calculateHighlights]); // calculateHighlights changes on query/index change, so this works.

  // Track canvas dimensions for annotation overlay
  useEffect(() => {
    const container = pageContentRef.current;
    if (!container) return;

    let timeoutId: NodeJS.Timeout;

    let lastDimensions = { width: 0, height: 0 };

    const updateCanvasDimensions = () => {
      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const newWidth = rect.width;
          const newHeight = rect.height;

          setCanvasDimensions(prev => {
            if (Math.abs(prev.width - newWidth) < 1 && Math.abs(prev.height - newHeight) < 1) {
              return prev;
            }
            return { width: newWidth, height: newHeight };
          });

          // Only notify parent if dimensions have significantly changed to prevent infinite loops
          if (onDimensionsChange) {
            if (Math.abs(lastDimensions.width - newWidth) >= 1 || Math.abs(lastDimensions.height - newHeight) >= 1) {
              lastDimensions = { width: newWidth, height: newHeight };
              onDimensionsChange(newWidth, newHeight);
            }
          }
        }
      }, 100);
    };

    updateCanvasDimensions();

    const observer = new MutationObserver(updateCanvasDimensions);
    observer.observe(container, { childList: true, subtree: true });
    window.addEventListener('resize', updateCanvasDimensions);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, [pageNumber, scale, containerWidth, shouldRender, onDimensionsChange]);

  // Handle text selection
  useEffect(() => {
    const handleSelection = () => {
      if (!pageContentRef.current) return;
      // We allow selection in any mode, but specific actions might be restricted
      // If we want highlighting only in 'edit' or 'view', we can check here.
      // But typically users expect to be able to select text anywhere.

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSelectionMenuPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const containerRect = pageContentRef.current.getBoundingClientRect();

      // Check if selection is inside this page
      if (!pageContentRef.current.contains(range.commonAncestorContainer)) {
         // It might be selection crossing pages, which is complex.
         // We'll ignore cross-page selections or selections not starting in this page for now.
         // Or if this page is not part of the selection, do nothing.
         return;
      }

      // Calculate position for the menu (at the end of selection)
      const rects = range.getClientRects();
      if (rects.length === 0) return;

      const lastRect = rects[rects.length - 1];

      // Calculate relative rects for storage
      const relativeRects = Array.from(rects).map(r => ({
        x: (r.left - containerRect.left) / containerRect.width,
        y: (r.top - containerRect.top) / containerRect.height,
        width: r.width / containerRect.width,
        height: r.height / containerRect.height
      }));

      setSelectedRects(relativeRects);
      setSelectedText(selection.toString());

      setSelectionMenuPosition({
        top: lastRect.top,
        left: lastRect.left + lastRect.width / 2
      });
    };

    const container = pageContentRef.current;
    if (container) {
      document.addEventListener('mouseup', handleSelection);
      // document.addEventListener('selectionchange', handleSelection); // Too noisy
    }

    return () => {
      document.removeEventListener('mouseup', handleSelection);
    };
  }, []);

  const handleHighlight = (color: string) => {
    if (selectedRects.length === 0) return;

    addAnnotation({
      id: crypto.randomUUID(),
      pageNumber,
      type: 'highlight',
      position: { x: 0, y: 0 }, // Placeholder, real data in rects
      content: selectedText,
      rects: selectedRects,
      style: {
        color: color || '#ffff00', // Use selected color or default yellow
        opacity: 0.4
      }
    });

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectionMenuPosition(null);
  };

  return (
    <div
      ref={ref}
      data-page-number={pageNumber}
      className="relative mb-4 flex justify-center"
      style={{ minHeight: '300px' }} // Minimum height to prevent total collapse
    >
      <div ref={pageContentRef} className="relative">
        {useMemo(() => (
          shouldRender ? (
            <Page
              pageNumber={pageNumber}
              width={containerWidth ? containerWidth * scale : undefined}
              loading={PageLoading}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              onRenderTextLayerSuccess={onRenderTextLayerSuccess}
              canvasBackground="white"
              className="shadow-md"
            />
          ) : (
            <div
              className="bg-white shadow-md flex items-center justify-center text-muted-foreground"
              style={{
                width: containerWidth ? containerWidth * scale : '100%',
                height: canvasDimensions.height || defaultHeight || 800
              }}
            >
              <span className="text-sm">Page {pageNumber}</span>
            </div>
          )
        ), [shouldRender, pageNumber, containerWidth, scale, onRenderTextLayerSuccess, canvasDimensions.height, defaultHeight])}

        {/* Highlight Overlay Layer (Search Results) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {highlights.map((highlight) => (
            <div
              key={highlight.id}
              id={`highlight-overlay-${highlight.id}`}
              className="absolute top-0 left-0 w-full h-full"
            >
              {/* We render individual rects for this match */}
              {highlight.rects.map((rect, i) => (
                <div
                  key={i}
                  // Attach ref to the FIRST rect of the focused highlight to scroll to it
                  ref={highlight.isFocused && i === 0 ? scrollToRef : null}
                  className={`absolute ${highlight.isFocused ? 'bg-orange-500/50' : 'bg-yellow-300/50'}`}
                  style={{
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {shouldRender && canvasDimensions.width > 0 && (
          <AnnotationOverlay
            pageNumber={pageNumber}
            canvasWidth={canvasDimensions.width}
            canvasHeight={canvasDimensions.height}
            scale={scale}
            onAddAnnotation={onAddAnnotation}
          />
        )}

        <TextSelectionMenu
          position={selectionMenuPosition}
          onHighlight={handleHighlight}
          onClose={() => setSelectionMenuPosition(null)}
        />
      </div>
    </div>
  );
});

PDFPage.displayName = 'PDFPage';
