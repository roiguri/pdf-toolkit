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
}, ref) => {
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const pageContentRef = useRef<HTMLDivElement>(null);

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
            renderTextLayer={false}
            renderAnnotationLayer={false}
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
