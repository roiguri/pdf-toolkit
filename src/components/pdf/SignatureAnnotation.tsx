import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '@/store/useAppStore';
import { Trash2 } from 'lucide-react';
import ResizeHandles, { ResizeHandle } from './ResizeHandles';

interface SignatureAnnotationProps {
  annotation: Annotation;
  x: number;
  y: number;
  scale: number;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: () => void;
  onDrag: (position: { x: number; y: number }) => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Annotation>) => void;
}

const SignatureAnnotation: React.FC<SignatureAnnotationProps> = ({
  annotation,
  x,
  y,
  scale,
  isSelected,
  canvasWidth,
  canvasHeight,
  onSelect,
  onDrag,
  onDelete,
  onUpdate,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Default size in relative coordinates (0-1)
  const defaultRelativeWidth = 200 / canvasWidth;
  const defaultRelativeHeight = 100 / canvasHeight;

  // Get current size (relative coordinates)
  // Support both legacy absolute values and new relative values
  const storedWidth = annotation.style?.width || defaultRelativeWidth;
  const storedHeight = annotation.style?.height || defaultRelativeHeight;

  // Detect if values are legacy absolute pixels (> 1) or new relative (0-1)
  // Note: canvasWidth/Height are already scaled (from getBoundingClientRect)
  const unscaledCanvasWidth = canvasWidth / scale;
  const unscaledCanvasHeight = canvasHeight / scale;
  const relativeWidth = storedWidth > 1 ? storedWidth / unscaledCanvasWidth : storedWidth;
  const relativeHeight = storedHeight > 1 ? storedHeight / unscaledCanvasHeight : storedHeight;

  // Convert to absolute pixels for display
  // canvasWidth/Height are already scaled, so just multiply by relative
  const displayWidth = relativeWidth * canvasWidth;
  const displayHeight = relativeHeight * canvasHeight;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    onSelect();

    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && touch) {
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const parent = containerRef.current.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const newX = e.clientX - parentRect.left - dragOffset.x;
    const newY = e.clientY - parentRect.top - dragOffset.y;

    onDrag({ x: newX, y: newY });
  };

      const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !containerRef.current) return;
      e.preventDefault(); // Prevent scrolling while dragging
  
      const touch = e.touches[0];
      if (!touch) return;
    const parent = containerRef.current.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const newX = touch.clientX - parentRect.left - dragOffset.x;
    const newY = touch.clientY - parentRect.top - dragOffset.y;

    onDrag({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, dragOffset]);

  const handleResize = (deltaX: number, deltaY: number, handle: ResizeHandle) => {
    // Convert pixel deltas to relative deltas
    // canvasWidth/Height are already scaled, so just divide by them
    const relativeDeltaX = deltaX / canvasWidth;
    const relativeDeltaY = deltaY / canvasHeight;

    let newWidth = relativeWidth;
    let newHeight = relativeHeight;
    let newX = annotation.position.x;
    let newY = annotation.position.y;

    // Adjust size and position based on which handle is being dragged
    switch (handle) {
      case 'bottom-right':
        newWidth = Math.max(0.02, relativeWidth + relativeDeltaX);
        newHeight = Math.max(0.02, relativeHeight + relativeDeltaY);
        break;
      case 'bottom-left':
        newWidth = Math.max(0.02, relativeWidth - relativeDeltaX);
        newHeight = Math.max(0.02, relativeHeight + relativeDeltaY);
        newX = annotation.position.x + relativeDeltaX;
        break;
      case 'top-right':
        newWidth = Math.max(0.02, relativeWidth + relativeDeltaX);
        newHeight = Math.max(0.02, relativeHeight - relativeDeltaY);
        newY = annotation.position.y + relativeDeltaY;
        break;
      case 'top-left':
        newWidth = Math.max(0.02, relativeWidth - relativeDeltaX);
        newHeight = Math.max(0.02, relativeHeight - relativeDeltaY);
        newX = annotation.position.x + relativeDeltaX;
        newY = annotation.position.y + relativeDeltaY;
        break;
    }

    onUpdate({
      position: { x: newX, y: newY },
      style: {
        ...annotation.style,
        width: newWidth,
        height: newHeight,
      },
    });
  };

  const handleResizeEnd = () => {
    // Could be used for saving state or triggering other actions
  };

  return (
    <div
      ref={containerRef}
      className={`absolute group ${isDragging ? 'cursor-grabbing' : 'cursor-move'}`}
      style={{
        left: x,
        top: y,
        transform: 'translate(0, 0)',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`rounded ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      >
        <img
          src={annotation.content}
          alt="Signature"
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>

      {/* Resize handles */}
      {isSelected && (
        <ResizeHandles
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          scale={scale}
        />
      )}

      {/* Delete button */}
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 transition-opacity hover:bg-red-600 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: `scale(${Math.min(scale, 1)})` }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
};

export default SignatureAnnotation;
