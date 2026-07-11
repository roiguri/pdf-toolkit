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
  });

  // Sync with props when not dragging
  useEffect(() => {
    setPosition(annotation.position);
    setSize({
      width: annotation.style?.width || 0,
      height: annotation.style?.height || 0,
    });
  }, [annotation]);

  // Drag handler
  const bindDrag = useDrag(
    ({ movement: [mx, my], first, last, memo }) => {
      if (first) {
        if (!isSelected) {
          onSelect();
        }
        return {
          initialPos: position,
        };
      }

      const { initialPos } = memo;
      const newX = initialPos.x + mx / canvasWidth;
      const newY = initialPos.y + my / canvasHeight;

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

  // Store initial state for resize, including canvas dimensions snapshot
  const initialResizeState = useRef<{
    width: number;
    height: number;
    canvasWidth: number;
    canvasHeight: number;
    // On-screen (px) aspect ratio at the moment the gesture started. Fixed for
    // the whole gesture so incremental per-frame deltas can't let it drift.
    aspectRatio: number;
  } | null>(null);

  const handleResizeStart = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      initialResizeState.current = {
        width: rect.width,
        height: rect.height,
        canvasWidth,
        canvasHeight,
        aspectRatio: rect.height > 0 ? rect.width / rect.height : 1,
      };
    }
  };

  // Resize handler. `deltaX`/`deltaY` are the pointer's raw on-screen (physical,
  // not RTL-flipped) movement since the last frame — ResizeHandles reports a
  // per-frame delta, not a cumulative one — so this recomputes from the latest
  // `size`/`position` state on every call rather than from resize-start values.
  const handleResize = (deltaX: number, deltaY: number, handle: ResizeHandle) => {
    // Use canvas dimensions from resize start to prevent shifts during resize
    const resizeCanvasWidth = initialResizeState.current?.canvasWidth || canvasWidth;
    const resizeCanvasHeight = initialResizeState.current?.canvasHeight || canvasHeight;

    // Prevent division by zero
    if (resizeCanvasWidth === 0 || resizeCanvasHeight === 0) return;

    // For images/signatures (width > 0)
    const relativeDeltaX = deltaX / resizeCanvasWidth;
    const relativeDeltaY = deltaY / resizeCanvasHeight;

    const minW = minWidth / resizeCanvasWidth;
    const minH = minHeight / resizeCanvasHeight;

    let newW = size.width;
    let newH = size.height;
    let newX = position.x;
    let newY = position.y;

    if (lockAspectRatio) {
      const aspectRatio = initialResizeState.current?.aspectRatio || 1;
      const growsRight = handle === 'bottom-right' || handle === 'top-right';
      const growsDown = handle === 'bottom-right' || handle === 'bottom-left';

      // All four handles are corners, so both edges move together. Drive the
      // resize off whichever axis the pointer moved more this frame, and derive
      // the other dimension from the locked ratio — this keeps a mostly-horizontal
      // or mostly-vertical drag feeling responsive instead of fighting the user.
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        const signedDeltaX = growsRight ? relativeDeltaX : -relativeDeltaX;
        newW = Math.max(minW, size.width + signedDeltaX);
        newH = Math.max(minH, (newW * resizeCanvasWidth) / aspectRatio / resizeCanvasHeight);
      } else {
        const signedDeltaY = growsDown ? relativeDeltaY : -relativeDeltaY;
        newH = Math.max(minH, size.height + signedDeltaY);
        newW = Math.max(minW, (newH * resizeCanvasHeight) * aspectRatio / resizeCanvasWidth);
      }

      // Keep the corner opposite the dragged handle anchored in place.
      if (!growsRight) newX = position.x + (size.width - newW);
      if (!growsDown) newY = position.y + (size.height - newH);
    } else {
      switch (handle) {
        case 'bottom-right':
          newW = Math.max(minW, size.width + relativeDeltaX);
          newH = Math.max(minH, size.height + relativeDeltaY);
          break;
        case 'bottom-left':
          newW = Math.max(minW, size.width - relativeDeltaX);
          newH = Math.max(minH, size.height + relativeDeltaY);
          newX = position.x + relativeDeltaX;
          break;
        case 'top-right':
          newW = Math.max(minW, size.width + relativeDeltaX);
          newH = Math.max(minH, size.height - relativeDeltaY);
          newY = position.y + relativeDeltaY;
          break;
        case 'top-left':
          newW = Math.max(minW, size.width - relativeDeltaX);
          newH = Math.max(minH, size.height - relativeDeltaY);
          newX = position.x + relativeDeltaX;
          newY = position.y + relativeDeltaY;
          break;
      }
    }

    // Clamp position to valid range (0-1)
    newX = Math.max(0, Math.min(1 - newW, newX));
    newY = Math.max(0, Math.min(1 - newH, newY));

    setPosition({ x: newX, y: newY });
    setSize(prev => ({ ...prev, width: newW, height: newH }));
  };

  const handleResizeEnd = () => {
    initialResizeState.current = null;
    onUpdate({
      position,
      style: {
        ...annotation.style,
        width: size.width,
        height: size.height,
      },
    });
  };

  return (
    <div
      ref={containerRef}
      {...bindDrag()}
      className={`absolute ${isSelected ? 'z-50' : 'z-10'} touch-none select-none`}
      style={{
        left: canvasWidth > 0 ? position.x * canvasWidth : 0,
        top: canvasHeight > 0 ? position.y * canvasHeight : 0,
        width: size.width > 0 && canvasWidth > 0 ? size.width * canvasWidth : 'auto',
        height: size.height > 0 && canvasHeight > 0 ? size.height * canvasHeight : 'auto',

        cursor: isSelected ? 'move' : 'pointer',
        touchAction: 'none', // Critical: prevents browser scrolling when dragging this element
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Selection is handled by drag handler (on pointer down)
      }}
    >
      <div className={`relative ${isSelected ? 'ring-1 ring-blue-500 ring-offset-2' : ''}`}>
        {children}

        {isSelected && (
          <>
            <ResizeHandles
              onResize={handleResize}
              onResizeStart={handleResizeStart}
              onResizeEnd={handleResizeEnd}
              scale={scale}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="group absolute flex items-center justify-center"
              style={{
                // Same visual position as the plain "-top-6 -right-6" button this
                // replaces, but with a larger invisible tap target: padding grows
                // the hit box only upward/rightward — away from the top-right
                // resize handle that sits right at this corner — so the two
                // controls' hit areas don't get any closer together. The visible
                // red disc (below) stays exactly where and how big it was.
                top: -24 - 10,
                right: -24 - 10,
                padding: '10px 10px 0 0',
              }}
            >
              <span className="flex items-center justify-center bg-red-500 text-white rounded-full p-1.5 shadow-md transition-colors group-hover:bg-red-600">
                <Trash2 size={14} />
              </span>
            </button>
          </>
        )}
      </div>
    </div >
  );
};

export default DraggableAnnotation;
