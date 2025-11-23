import React from 'react';
import { Annotation } from '@/store/useAppStore';
import DraggableAnnotation from './DraggableAnnotation';

interface SignatureAnnotationProps {
  annotation: Annotation;
  scale: number;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Annotation>) => void;
}

const SignatureAnnotation: React.FC<SignatureAnnotationProps> = ({
  annotation,
  scale,
  isSelected,
  canvasWidth,
  canvasHeight,
  onSelect,
  onDelete,
  onUpdate,
}) => {


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
      minWidth={20}
      minHeight={20}
      lockAspectRatio={true}
    >
      <div
        className="w-full h-full"
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <img
          src={annotation.content}
          alt="Signature"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
      </div>
    </DraggableAnnotation>
  );
};

export default SignatureAnnotation;
