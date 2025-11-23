import React from 'react';
import { useAppStore, Annotation } from '@/store/useAppStore';
import TextAnnotation from './TextAnnotation';
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
    setSelectedAnnotationId(null);

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
        const absoluteX = annotation.position.x * canvasWidth;
        const absoluteY = annotation.position.y * canvasHeight;

        if (annotation.type === 'text') {
          return (
            <TextAnnotation
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

        if (annotation.type === 'signature') {
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

        return null;
      })}
    </div>
  );
};

export default AnnotationOverlay;
