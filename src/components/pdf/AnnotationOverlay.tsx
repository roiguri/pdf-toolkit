import React from 'react';
import { Annotation, AnnotationType } from '@/store/useAppStore';
import SignatureAnnotation from './SignatureAnnotation';

interface AnnotationOverlayProps {
  pageNumber: number;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  isEditMode: boolean;
  activeEditTool: AnnotationType | null;
  annotations: Annotation[];  // pre-filtered to this page
  selectedAnnotationId: string | null;
  onAddAnnotation: (position: { x: number; y: number }) => void;
  onAnnotationUpdate: (id: string, updates: Partial<Annotation>) => void;
  onAnnotationDelete: (id: string) => void;
  onAnnotationSelect: (id: string | null) => void;
}

const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  pageNumber: _pageNumber,
  canvasWidth,
  canvasHeight,
  scale,
  isEditMode,
  activeEditTool,
  annotations,
  selectedAnnotationId,
  onAddAnnotation,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationSelect,
}) => {
  // Only capture the whole surface while a placement tool (e.g. signature
  // tap-to-place) is active. Otherwise stay pointer-events:none so the text
  // layer underneath can receive native drag-to-select for highlighting.
  // Individual annotations (signature wrapper below, highlight rects) opt
  // back in to pointer events on themselves regardless of this.
  const captureClicks = isEditMode && activeEditTool === 'signature';

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!captureClicks) return;

    // Only handle clicks directly on the overlay, not on annotations
    if (e.target !== e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Deselect any selected annotation when clicking empty space
    if (selectedAnnotationId) {
      onAnnotationSelect(null);
      return;
    }

    onAddAnnotation({ x, y });
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        pointerEvents: captureClicks ? 'auto' : 'none',
        width: canvasWidth,
        height: canvasHeight,
        zIndex: 50,
      }}
      onClick={handleOverlayClick}
    >
      {annotations.map((annotation) => {
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
            // pointerEvents: 'auto' re-enables interaction for this annotation
            // even when the overlay parent above is pointer-events:none, so
            // dragging/resizing/deleting existing signatures keeps working
            // outside of the signature placement tool. Same pattern as the
            // highlight wrapper below.
            <div key={annotation.id} style={{ pointerEvents: 'auto' }}>
              <SignatureAnnotation
                annotation={annotation}
                scale={scale}
                isSelected={selectedAnnotationId === annotation.id}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                onSelect={() => onAnnotationSelect(annotation.id)}
                onDelete={() => onAnnotationDelete(annotation.id)}
                onUpdate={(updates) => onAnnotationUpdate(annotation.id, updates)}
              />
            </div>
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
                onAnnotationSelect(annotation.id);
              }}
            >
              {annotation.rects.map((rect, i) => (
                <div
                  key={i}
                  className="absolute cursor-pointer transition-all duration-300"
                  style={{
                    top: rect.y * canvasHeight,
                    left: rect.x * canvasWidth,
                    width: rect.width * canvasWidth,
                    height: rect.height * canvasHeight,
                    backgroundColor: annotation.style?.color || '#ffff00',
                    opacity: isSelected ? 0.7 : (annotation.style?.opacity || 0.4),
                    boxShadow: isSelected ? `0 0 8px 2px ${annotation.style?.color || '#ffff00'}` : 'none',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    zIndex: isSelected ? 10 : 1,
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
