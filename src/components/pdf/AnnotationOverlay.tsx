import React from 'react';
import { useAppStore, Annotation } from '@/store/useAppStore';

import SignatureAnnotation from './SignatureAnnotation';

interface AnnotationOverlayProps {
  pageNumber: number;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  onAddAnnotation: (position: { x: number; y: number }) => void;
}

const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  pageNumber,
  canvasWidth,
  canvasHeight,
  scale,
  onAddAnnotation,
}) => {
  const {
    annotations,
    activeMode,
    updateAnnotation,
    deleteAnnotation,
    selectedAnnotationId,
    setSelectedAnnotationId,
  } = useAppStore();

  const pageAnnotations = annotations.filter((ann) => ann.pageNumber === pageNumber);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeMode !== 'edit') return;

    // Only handle clicks directly on the overlay, not on annotations
    if (e.target !== e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Deselect any selected annotation when clicking empty space
    if (selectedAnnotationId) {
      setSelectedAnnotationId(null);
      return;
    }

    onAddAnnotation({ x, y });
  };

  const handleAnnotationDrag = (id: string, newPosition: { x: number; y: number }) => {
    updateAnnotation(id, { position: newPosition });
  };

  const handleAnnotationSelect = (id: string) => {
    setSelectedAnnotationId(id);
  };

  const handleAnnotationDelete = (id: string) => {
    deleteAnnotation(id);
  };

  const handleAnnotationUpdate = (id: string, updates: Partial<Annotation>) => {
    updateAnnotation(id, updates);
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        pointerEvents: activeMode === 'edit' ? 'auto' : 'none',
        width: canvasWidth,
        height: canvasHeight,
      }}
      onClick={handleOverlayClick}
    >
      {pageAnnotations.map((annotation) => {
        // Validate canvas dimensions
        if (canvasWidth <= 0 || canvasHeight <= 0) return null;

        if (annotation.type === 'signature') {
           // Validate annotation position is within bounds
            if (annotation.position.x < 0 || annotation.position.x > 1 ||
            annotation.position.y < 0 || annotation.position.y > 1) {
            console.warn(`Annotation ${annotation.id} has invalid position:`, annotation.position);
            return null;
            }

          return (
            <SignatureAnnotation
              key={annotation.id}
              annotation={annotation}
              scale={scale}
              isSelected={selectedAnnotationId === annotation.id}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              onSelect={() => handleAnnotationSelect(annotation.id)}
              onDelete={() => handleAnnotationDelete(annotation.id)}
              onUpdate={(updates) => handleAnnotationUpdate(annotation.id, updates)}
            />
          );
        }

        if (annotation.type === 'highlight' && annotation.rects) {
          const isSelected = selectedAnnotationId === annotation.id;
          return (
            <div
              key={annotation.id}
              style={{ pointerEvents: 'auto' }} // Allow clicking highlights
              onClick={(e) => {
                e.stopPropagation();
                handleAnnotationSelect(annotation.id);
              }}
            >
              {annotation.rects.map((rect, i) => (
                <div
                  key={i}
                  className="absolute cursor-pointer transition-colors"
                  style={{
                    top: rect.y * canvasHeight,
                    left: rect.x * canvasWidth,
                    width: rect.width * canvasWidth,
                    height: rect.height * canvasHeight,
                    backgroundColor: annotation.style?.color || '#ffff00',
                    opacity: isSelected ? 0.7 : (annotation.style?.opacity || 0.4),
                    border: isSelected ? '2px solid blue' : 'none',
                  }}
                  title={annotation.content}
                />
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export default AnnotationOverlay;
