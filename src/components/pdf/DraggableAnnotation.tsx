import React, { useRef, useState, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { Annotation } from '@/store/useAppStore';
import { Trash2 } from 'lucide-react';
import ResizeHandles, { ResizeHandle } from './ResizeHandles';

interface DraggableAnnotationProps {
  annotation: Annotation;
  scale: number;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<Annotation>) => void;
  onDelete: () => void;
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
  lockAspectRatio?: boolean;
}

const DraggableAnnotation: React.FC<DraggableAnnotationProps> = ({
  annotation,
  scale,
  isSelected,
  canvasWidth,
  canvasHeight,
  onSelect,
  onUpdate,
  onDelete,
  children,
  minWidth = 20,
  minHeight = 20,
  lockAspectRatio = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Local state for smooth 60fps animations
  // We use a ref for the current values to avoid re-renders during drag
  // and state for the final commit
  const [position, setPosition] = useState(annotation.position);
  const [size, setSize] = useState({
    width: annotation.style?.width || 0,
    height: annotation.style?.height || 0,
    fontSize: annotation.style?.fontSize || 16,
  });

  // Sync with props when not dragging
  useEffect(() => {
    setPosition(annotation.position);
    setSize({
      width: annotation.style?.width || 0,
      height: annotation.style?.height || 0,
      fontSize: annotation.style?.fontSize || 16,
    });
  }, [annotation]);

  // Drag handler
  const bindDrag = useDrag(
    ({ movement: [mx, my], first, last, memo }) => {
      if (first) {
        onSelect();
        return {
          initialX: position.x * canvasWidth,
          initialY: position.y * canvasHeight,
        };
      }

      const { initialX, initialY } = memo;
      const newX = (initialX + mx) / canvasWidth;
      const newY = (initialY + my) / canvasHeight;

      // Update local state immediately for UI
      setPosition({ x: newX, y: newY });

      // Commit on last
      if (last) {
        onUpdate({ position: { x: newX, y: newY } });
      }

      return memo;
    },
    {
      eventOptions: { passive: false },
      preventDefault: true, // Prevent scrolling
    }
  );

  // Resize handler
  const handleResize = (deltaX: number, deltaY: number, handle: ResizeHandle) => {
    // Current values
    const currentWidth = size.width > 0 ? size.width * canvasWidth : 0; // 0 means auto/text
    const currentHeight = size.height > 0 ? size.height * canvasHeight : 0;
    const currentFontSize = size.fontSize;

    // For text (width=0), we scale font size
    if (annotation.type === 'text') {
      // Calculate effective delta based on handle position
      // For bottom/right handles, positive delta means grow
      // For top/left handles, negative delta means grow
      let effectiveDelta = 0;

      switch (handle) {
        case 'bottom-right':
          effectiveDelta = (deltaX + deltaY) / 2;
          break;
        case 'bottom-left':
          effectiveDelta = (-deltaX + deltaY) / 2;
          break;
        case 'top-right':
          effectiveDelta = (deltaX - deltaY) / 2;
          break;
        case 'top-left':
          effectiveDelta = (-deltaX - deltaY) / 2;
          break;
      }

      const scaleFactor = 1 + effectiveDelta / 200;
      const newFontSize = Math.max(8, Math.min(200, currentFontSize * scaleFactor));

      setSize(prev => ({ ...prev, fontSize: newFontSize }));
      return;
    }

    // For images/signatures (width > 0)
    const relativeDeltaX = deltaX / canvasWidth;
    const relativeDeltaY = deltaY / canvasHeight;

    let newW = size.width;
    let newH = size.height;
    let newX = position.x;
    let newY = position.y;

    switch (handle) {
      case 'bottom-right':
        newW = Math.max(minWidth / canvasWidth, size.width + relativeDeltaX);
        newH = Math.max(minHeight / canvasHeight, size.height + relativeDeltaY);
        break;
      case 'bottom-left':
        newW = Math.max(minWidth / canvasWidth, size.width - relativeDeltaX);
        newH = Math.max(minHeight / canvasHeight, size.height + relativeDeltaY);
        newX = position.x + relativeDeltaX;
        break;
      case 'top-right':
        newW = Math.max(minWidth / canvasWidth, size.width + relativeDeltaX);
        newH = Math.max(minHeight / canvasHeight, size.height - relativeDeltaY);
        newY = position.y + relativeDeltaY;
        break;
      case 'top-left':
        newW = Math.max(minWidth / canvasWidth, size.width - relativeDeltaX);
        newH = Math.max(minHeight / canvasHeight, size.height - relativeDeltaY);
        newX = position.x + relativeDeltaX;
        newY = position.y + relativeDeltaY;
        break;
    }

    setPosition({ x: newX, y: newY });
    setSize(prev => ({ ...prev, width: newW, height: newH }));
  };

  const handleResizeEnd = () => {
    onUpdate({
      position,
      style: {
        ...annotation.style,
        width: size.width,
        height: size.height,
        fontSize: size.fontSize,
      },
    });
  };

  return (
    <div
      ref={containerRef}
      {...bindDrag()}
      className={`absolute ${isSelected ? 'z-50' : 'z-10'} touch-none select-none`}
      style={{
        left: position.x * canvasWidth,
        top: position.y * canvasHeight,
        width: size.width > 0 ? size.width * canvasWidth : 'auto',
        height: size.height > 0 ? size.height * canvasHeight : 'auto',
        fontSize: size.fontSize * scale,
        cursor: isSelected ? 'move' : 'pointer',
        touchAction: 'none',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className={`relative ${isSelected ? 'ring-1 ring-blue-500 ring-offset-2' : ''}`}>
        {children}

        {isSelected && (
          <>
            <ResizeHandles
              onResize={handleResize}
              onResizeEnd={handleResizeEnd}
              scale={scale}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="absolute -top-6 -right-6 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 transition-colors"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div >
  );
};

export default DraggableAnnotation;
