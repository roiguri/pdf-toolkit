import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '@/store/useAppStore';
import DraggableAnnotation from './DraggableAnnotation';

interface TextAnnotationProps {
  annotation: Annotation;
  scale: number;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Annotation>) => void;
}

const TextAnnotation: React.FC<TextAnnotationProps> = ({
  annotation,
  scale,
  isSelected,
  canvasWidth,
  canvasHeight,
  onSelect,
  onDelete,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
    }
  };

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

  return (
    <DraggableAnnotation
      annotation={annotation}
      scale={scale}
      isSelected={isSelected}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      onSelect={onSelect}
      onUpdate={onUpdate}
      onDelete={onDelete}
    >
      <div
        onDoubleClick={handleDoubleClick}
        className={isEditing ? 'cursor-text' : 'cursor-move'}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={annotation.content}
            onChange={handleTextChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-white border-2 border-blue-500 rounded px-2 py-1 resize-none outline-none shadow-sm overflow-hidden"
            style={{
              fontSize: fontSize * scale,
              color: fontColor,
              minWidth: 60 * scale,
              minHeight: 24 * scale,
              height: 'auto',
            }}
            rows={1}
            onPointerDown={(e) => e.stopPropagation()} // Allow text selection
          />
        ) : (
          <div
            className="px-2 py-1 rounded whitespace-pre-wrap"
            style={{
              fontSize: fontSize * scale,
              color: fontColor,
            }}
          >
            {annotation.content || (isSelected ? 'Click to edit' : '')}
          </div>
        )}
      </div>
    </DraggableAnnotation>
  );
};

export default TextAnnotation;
