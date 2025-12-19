'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Page } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import AnnotationOverlay from './AnnotationOverlay';

interface PDFPageProps {
  pageNumber: number;
  scale: number;
  containerWidth?: number;
  shouldRender: boolean;
  onAddAnnotation: (position: { x: number; y: number }) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  searchQuery?: string;
}

const PageLoading = (
  <div className="flex items-center justify-center h-full w-full min-h-[300px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export const PDFPage = React.forwardRef<HTMLDivElement, PDFPageProps>(({
  pageNumber,
  scale,
  containerWidth,
  shouldRender,
  onAddAnnotation,
  onDimensionsChange,
  searchQuery,
}, ref) => {
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const pageContentRef = useRef<HTMLDivElement>(null);
  const textLayerRendered = useRef(false);

  // Function to highlight text
  const highlightText = useCallback(() => {
    if (!pageContentRef.current || !searchQuery) return;

    // Simple text highlighting within DOM nodes
    // This is a basic implementation and might need refinement for complex cases
    // Note: react-pdf creates a separate text layer div
    const textLayer = pageContentRef.current.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) return;

    // Reset previous highlights (if we could, but rebuilding text layer handles it usually)
    // Actually, react-pdf rebuilds text layer on zoom, but not on query change.
    // So we might need to "reset" if we modify the DOM.
    // But since we modify innerHTML, we might break React's reconciliation if we are not careful?
    // react-pdf manages the text layer content.
    // If we change searchQuery, we want to re-apply highlighting.
    // If we modify the DOM, we should ideally revert it first?
    // Or just rely on re-rendering?
    // Since we can't easily force re-render of text layer without hack,
    // we can iterate through spans and update them.

    const spans = textLayer.querySelectorAll('span');
    spans.forEach((span) => {
       // Save original text if not saved
       if (!span.getAttribute('data-original-text')) {
         span.setAttribute('data-original-text', span.textContent || '');
       }

       const originalText = span.getAttribute('data-original-text') || '';

       if (!searchQuery.trim()) {
         span.textContent = originalText; // Restore safely
         return;
       }

       const lowerText = originalText.toLowerCase();
       const lowerQuery = searchQuery.toLowerCase();

       if (lowerText.includes(lowerQuery)) {
         // Escape HTML in original text to prevent XSS
         const escapeHtml = (unsafe: string) => {
           return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
         };

         // Highlight
         // We use regex to replace case-insensitive but keep case
         // We need to match against the original text, but inserting HTML tags into escaped text is tricky if we don't escape first.
         // But if we escape first, the query might not match if it contains special chars.
         // Let's assume query is plain text.

         // Better approach:
         // 1. Find matches in original string.
         // 2. Build the new HTML string by escaping non-match parts and wrapping match parts.

         const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

         const parts = originalText.split(regex);
         const newHtml = parts.map(part => {
             if (part.toLowerCase() === lowerQuery) {
                 return `<mark class="bg-yellow-300 text-transparent bg-opacity-50">${escapeHtml(part)}</mark>`;
             } else {
                 return escapeHtml(part);
             }
         }).join('');

         span.innerHTML = newHtml;
       } else {
         // Also escape when restoring!
         // Wait, originalText came from span.textContent which is unescaped.
         // Assigning to innerHTML requires escaping.
         // Or just use textContent to restore.
         span.textContent = originalText;
       }
    });
  }, [searchQuery]);

  // Trigger highlight when searchQuery changes or text layer renders
  useEffect(() => {
    if (textLayerRendered.current) {
      highlightText();
    }
  }, [highlightText]);

  const onRenderTextLayerSuccess = () => {
    textLayerRendered.current = true;
    highlightText();
  };

  // Track canvas dimensions for annotation overlay
  useEffect(() => {
    const container = pageContentRef.current;
    if (!container) return;

    let timeoutId: NodeJS.Timeout;

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

          if (onDimensionsChange) {
            onDimensionsChange(newWidth, newHeight);
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

  return (
    <div
      ref={ref}
      data-page-number={pageNumber}
      className="relative mb-4 flex justify-center"
      style={{ minHeight: '300px' }} // Minimum height to prevent total collapse
    >
      <div ref={pageContentRef} className="relative">
        {shouldRender ? (
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
              height: canvasDimensions.height || '1000px' // Try to maintain height if known, else guess
            }}
          >
             <span className="text-sm">Page {pageNumber}</span>
          </div>
        )}

        {shouldRender && canvasDimensions.width > 0 && (
          <AnnotationOverlay
            pageNumber={pageNumber}
            canvasWidth={canvasDimensions.width}
            canvasHeight={canvasDimensions.height}
            scale={scale}
            onAddAnnotation={onAddAnnotation}
          />
        )}
      </div>
    </div>
  );
});

PDFPage.displayName = 'PDFPage';
