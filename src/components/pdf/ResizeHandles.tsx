import React, { useState, useEffect } from 'react';

export type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ResizeHandlesProps {
  onResize: (
    deltaX: number,
    deltaY: number,
    handle: ResizeHandle
  ) => void;
  onResizeEnd: () => void;
  scale: number;
}

const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  onResize,
  onResizeEnd,
  scale,
}) => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (e: React.TouchEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    // e.preventDefault(); // Prevent scrolling while resizing
    setActiveHandle(handle);
    const touch = e.touches[0];
    if (touch) {
      setStartPos({ x: touch.clientX, y: touch.clientY });
    }
  };

  useEffect(() => {
    if (!activeHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      onResize(deltaX, deltaY, activeHandle);
      setStartPos({ x: e.clientX, y: e.clientY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scrolling while resizing
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startPos.x;
      const deltaY = touch.clientY - startPos.y;
      onResize(deltaX, deltaY, activeHandle);
      setStartPos({ x: touch.clientX, y: touch.clientY });
    };

    const handleMouseUp = () => {
      setActiveHandle(null);
      onResizeEnd();
    };

    const handleTouchEnd = () => {
      setActiveHandle(null);
      onResizeEnd();
    };

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
  }, [activeHandle, startPos, onResize, onResizeEnd]);

  // Handle size adjusted for scale (but capped to prevent being too small)
  const handleSize = Math.max(8, 10 * Math.min(scale, 1));

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
          className="absolute bg-white border border-gray-600"
          style={{
            width: handleSize,
            height: handleSize,
            cursor,
            ...style,
          }}
          onMouseDown={(e) => handleMouseDown(e, position)}
          onTouchStart={(e) => handleTouchStart(e, position)}
        />
      ))}
    </>
  );
};

export default ResizeHandles;
