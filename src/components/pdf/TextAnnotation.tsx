import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '@/store/useAppStore';
import { Trash2 } from 'lucide-react';
import ResizeHandles, { ResizeHandle } from './ResizeHandles';

interface TextAnnotationProps {
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

const TextAnnotation: React.FC<TextAnnotationProps> = ({
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
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialResizeState, setInitialResizeState] = useState<{
    fontSize: number;
    width: number;
    height: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const fontSize = annotation.style?.fontSize || 16;
  const fontColor = annotation.style?.fontColor || '#000000';

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Start editing for new empty annotations
  useEffect(() => {
    if (annotation.content === '' && isSelected) {
      setIsEditing(true);
    }
  }, [annotation.content, isSelected]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;

    e.stopPropagation();
    onSelect();

    // Start dragging for move
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
    if (isEditing) return;

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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
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

  const handleBlur = () => {
    setIsEditing(false);
    // Delete if empty
    if (!annotation.content.trim()) {
      onDelete();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ content: e.target.value });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      if (!annotation.content.trim()) {
        onDelete();
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
      if (!annotation.content.trim()) {
        onDelete();
      }
    }
  };

  const handleResize = (deltaX: number, deltaY: number, handle: ResizeHandle) => {
    if (!textRef.current) return;

    // Get current dimensions
    const currentRect = textRef.current.getBoundingClientRect();
    const currentWidth = currentRect.width;
    const currentHeight = currentRect.height;

    // Store initial state on first resize delta
    if (!initialResizeState) {
      setInitialResizeState({
        fontSize,
        width: currentWidth,
        height: currentHeight,
      });
    }

    const baseWidth = initialResizeState?.width || currentWidth;
    const baseHeight = initialResizeState?.height || currentHeight;
    const baseFontSize = initialResizeState?.fontSize || fontSize;

    // Calculate scale factor based on diagonal resize
    let scaleFactorX = 1;
    let scaleFactorY = 1;
    let newX = annotation.position.x;
    let newY = annotation.position.y;

    switch (handle) {
      case 'bottom-right':
        scaleFactorX = (currentWidth + deltaX) / baseWidth;
        scaleFactorY = (currentHeight + deltaY) / baseHeight;
        break;
      case 'bottom-left':
        scaleFactorX = (currentWidth - deltaX) / baseWidth;
        scaleFactorY = (currentHeight + deltaY) / baseHeight;
        newX = annotation.position.x + deltaX / canvasWidth;
        break;
      case 'top-right':
        scaleFactorX = (currentWidth + deltaX) / baseWidth;
        scaleFactorY = (currentHeight - deltaY) / baseHeight;
        newY = annotation.position.y + deltaY / canvasHeight;
        break;
      case 'top-left':
        scaleFactorX = (currentWidth - deltaX) / baseWidth;
        scaleFactorY = (currentHeight - deltaY) / baseHeight;
        newX = annotation.position.x + deltaX / canvasWidth;
        newY = annotation.position.y + deltaY / canvasHeight;
        break;
    }

    // Use average scale factor for uniform scaling
    const avgScaleFactor = (scaleFactorX + scaleFactorY) / 2;
    const newFontSize = Math.max(8, Math.min(200, baseFontSize * avgScaleFactor));

    onUpdate({
      position: { x: newX, y: newY },
      style: {
        ...annotation.style,
        fontSize: newFontSize,
      },
    });
  };

  const handleResizeEnd = () => {
    setInitialResizeState(null);
  };

  return (
    <div
      ref={containerRef}
      className={`absolute group ${isDragging ? 'cursor-grabbing' : isEditing ? 'cursor-text' : 'cursor-move'}`}
      style={{
        left: x,
        top: y,
        transform: 'translate(0, 0)',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={annotation.content}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="bg-white border-2 border-blue-500 rounded px-2 py-1 resize-none outline-none shadow-sm"
          style={{
            fontSize: fontSize * scale,
            color: fontColor,
            minWidth: 60 * scale,
            minHeight: 24 * scale,
          }}
          rows={1}
        />
      ) : (
        <div
          ref={textRef}
          className={`px-2 py-1 rounded whitespace-pre-wrap ${
            isSelected ? 'ring-2 ring-blue-500' : ''
          }`}
          style={{
            fontSize: fontSize * scale,
            color: fontColor,
          }}
        >
          {annotation.content || (isSelected ? 'Click to edit' : '')}
        </div>
      )}

      {/* Resize handles */}
      {isSelected && !isEditing && (
        <ResizeHandles
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          scale={scale}
        />
      )}

      {/* Delete button */}
      {isSelected && !isEditing && (
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

export default TextAnnotation;
