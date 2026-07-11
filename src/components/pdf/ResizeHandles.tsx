import React, { useState, useEffect } from 'react';

export type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ResizeHandlesProps {
  onResize: (
    deltaX: number,
    deltaY: number,
    handle: ResizeHandle
  ) => void;
  onResizeEnd: () => void;
  onResizeStart?: () => void;
  scale: number;
}

const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  onResize,
  onResizeEnd,
  onResizeStart,
  scale,
}) => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
    if (onResizeStart) onResizeStart();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (!activeHandle) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      onResize(deltaX, deltaY, activeHandle);
      // We don't update startPos here for cumulative delta, or we do?
      // The original code updated startPos, implying delta is per-frame.
      // Let's keep it consistent: delta is "movement" since last event.
      setStartPos({ x: e.clientX, y: e.clientY });
    };

    const handlePointerUp = (e: PointerEvent) => {
      setActiveHandle(null);
      onResizeEnd();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeHandle, startPos, onResize, onResizeEnd]);

  // Visible dot size adjusted for scale (but capped to prevent being too small)
  const dotSize = Math.max(8, 10 * Math.min(scale, 1));
  // Invisible hit area is fixed and larger than the dot for touch targets,
  // independent of scale, centered on the same corner point as the dot.
  const hitAreaSize = 36;

  const handles: { position: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
    {
      position: 'top-left',
      style: { top: 0, left: 0, transform: 'translate(-50%, -50%)' },
      cursor: 'nwse-resize'
    },
    {
      position: 'top-right',
      style: { top: 0, right: 0, transform: 'translate(50%, -50%)' },
      cursor: 'nesw-resize'
    },
    {
      position: 'bottom-left',
      style: { bottom: 0, left: 0, transform: 'translate(-50%, 50%)' },
      cursor: 'nesw-resize'
    },
    {
      position: 'bottom-right',
      style: { bottom: 0, right: 0, transform: 'translate(50%, 50%)' },
      cursor: 'nwse-resize'
    },
  ];

  return (
    <>
      {handles.map(({ position, style, cursor }) => (
        <div
          key={position}
          className="absolute flex items-center justify-center"
          style={{
            width: hitAreaSize,
            height: hitAreaSize,
            cursor,
            touchAction: 'none', // Prevent scrolling while resizing
            ...style,
          }}
          onPointerDown={(e) => handlePointerDown(e, position)}
        >
          <div
            className="bg-white border border-gray-600 pointer-events-none"
            style={{ width: dotSize, height: dotSize }}
          />
        </div>
      ))}
    </>
  );
};

export default ResizeHandles;
