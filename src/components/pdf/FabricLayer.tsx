'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import { useAppStore, Annotation } from '@/store/useAppStore';

interface FabricLayerProps {
  pageNumber: number;
  width: number;
  height: number;
  resolutionScale: number;
  onCanvasClick: (position: { x: number; y: number }) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onSelectAnnotation: (id: string | null) => void;
}

export const FabricLayer = ({
  pageNumber,
  width,
  height,
  resolutionScale,
  onCanvasClick,
  onUpdateAnnotation,
  onSelectAnnotation
}: FabricLayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const {
    annotations,
    activeMode,
    activeEditTool
  } = useAppStore();

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create canvas instance
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: width, // Start with layout dimensions
      height: height,
      selection: activeMode === 'edit',
      renderOnAddRemove: false,
    });

    // Set zoom to match resolutionScale?
    // If we want the canvas to be high-res, we need to set dimensions to w*res, h*res
    // AND setZoom(res).
    // AND scale it down with CSS (which is handled by the parent container usually, but canvas element needs style).

    const renderWidth = width * resolutionScale;
    const renderHeight = height * resolutionScale;

    canvas.setDimensions({ width: renderWidth, height: renderHeight });
    canvas.setZoom(resolutionScale);

    // Force CSS style to match layout size
    // fabric.js setDimensions might set CSS style if cssOnly is false.
    // We want explicit control.
    canvas.getElement().style.width = `${width}px`;
    canvas.getElement().style.height = `${height}px`;

    fabricCanvasRef.current = canvas;

    canvas.requestRenderAll();

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Handle resizing and resolution change
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const renderWidth = width * resolutionScale;
    const renderHeight = height * resolutionScale;

    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
       canvas.setDimensions({ width: renderWidth, height: renderHeight });
       canvas.setZoom(resolutionScale);

       canvas.getElement().style.width = `${width}px`;
       canvas.getElement().style.height = `${height}px`;

       canvas.requestRenderAll();
    }
  }, [width, height, resolutionScale]);

  // Handle Pointer Events & Selection Mode
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (activeMode === 'edit') {
       canvas.selection = true;
       canvas.forEachObject(obj => {
          obj.selectable = true;
          obj.evented = true;
       });
    } else {
       canvas.selection = false;
       canvas.forEachObject(obj => {
          obj.selectable = false;
          obj.evented = false;
       });
       canvas.discardActiveObject();
    }
    canvas.requestRenderAll();

  }, [activeMode]);

  // Sync Store Annotations -> Fabric Objects
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const pageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);

    // Get existing object IDs
    const existingMap = new Map<string, fabric.Object>();
    canvas.getObjects().forEach((obj: any) => {
       if (obj.id) existingMap.set(obj.id, obj);
    });

    // Add or Update
    pageAnnotations.forEach(ann => {
        const existing = existingMap.get(ann.id);
        if (!existing) {
            addAnnotationToCanvas(canvas, ann);
        } else {
            // Check if update needed (e.g. style changed externally)
            // Ideally we compare hash or revision. For now, assume store is truth.
            // But if we are dragging, we don't want to snap back until save.
            // Fabric updates are usually "pushed" to store.
        }
    });

    // Remove deleted
    const annIds = new Set(pageAnnotations.map(a => a.id));
    existingMap.forEach((obj, id) => {
        if (!annIds.has(id)) {
            canvas.remove(obj);
        }
    });

    canvas.requestRenderAll();

  }, [annotations, pageNumber, width, height]);


  // Helper: Add Annotation
  const addAnnotationToCanvas = (canvas: fabric.Canvas, ann: Annotation) => {
      // Coordinates are in layout pixels (0..width) because we setZoom(resolutionScale).
      // So we use ann.position (percentage) * width.

      const left = ann.position.x * width;
      const top = ann.position.y * height;
      const angle = ann.rotation || 0;

      if (ann.type === 'text') {
          const text = new fabric.IText(ann.content || 'Text', {
              left,
              top,
              angle,
              fontSize: 20,
              fill: ann.style?.color || 'black',
              originX: 'left',
              originY: 'top',
          });
          // @ts-ignore
          text.id = ann.id;
          canvas.add(text);
      } else if (ann.type === 'signature' && ann.content) {
          fabric.Image.fromURL(ann.content).then(img => {
              // Calculate scale to match relative size
              // ann.style.width is relative width (0..1)
              const targetWidth = (ann.style?.width || 0.1) * width;
              const targetHeight = (ann.style?.height || 0.1) * height;

              img.set({
                  left,
                  top,
                  angle,
                  scaleX: targetWidth / img.width!,
                  scaleY: targetHeight / img.height!,
                  originX: 'left', // Ensure consistent origin
                  originY: 'top',
              });
              // @ts-ignore
              img.id = ann.id;
              canvas.add(img);
              canvas.requestRenderAll();
          });
      } else if (ann.type === 'highlight' && ann.rects) {
          // Highlight is a group of rects
          // ann.rects contains {x, y, width, height} in percentages
          const rects = ann.rects.map((r: any) => new fabric.Rect({
              left: r.x * width,
              top: r.y * height,
              width: r.width * width,
              height: r.height * height,
              fill: ann.style?.color || 'yellow',
              opacity: ann.style?.opacity || 0.4,
              originX: 'left',
              originY: 'top'
          }));

          const group = new fabric.Group(rects, {
              originX: 'left',
              originY: 'top',
              selectable: true, // Highlights should be selectable to delete?
              evented: true,
          });
          // @ts-ignore
          group.id = ann.id;
          canvas.add(group);
      }
  };

  // Event Listeners
  useEffect(() => {
     const canvas = fabricCanvasRef.current;
     if (!canvas) return;

     // Object Modified (Drag/Resize)
     const handleModified = (e: any) => {
         const target = e.target;
         if (!target || !target.id) return;

         // Normalize back to percentage
         // Because of zoom, target.left is in layout pixels

         const newX = target.left! / width;
         const newY = target.top! / height;

         // Handle scaling
         // For image/group, we need to update style width/height (percentage)
         // target.getScaledWidth() returns layout pixels width

         const newW = target.getScaledWidth() / width;
         const newH = target.getScaledHeight() / height;

         onUpdateAnnotation(target.id, {
             position: { x: newX, y: newY },
             rotation: target.angle,
             style: {
                 ...target.style, // preserve
                 width: newW,
                 height: newH,
             },
             // If text, update content
             content: target.text !== undefined ? target.text : undefined
         });
     };

     // Selection
     const handleSelectionCreated = (e: any) => {
         const selected = e.selected?.[0];
         if (selected && selected.id) {
             onSelectAnnotation(selected.id);
         }
     };

     const handleSelectionCleared = () => {
         onSelectAnnotation(null);
     };

     // Mouse Down (Placement)
     const handleMouseDown = (opt: any) => {
         if (activeMode !== 'edit') return;

         // If we clicked on an object, Fabric handles selection.
         // If we clicked on empty space, we might want to place a new annotation (if tool active).
         if (opt.target) return; // Clicked on object

         if (activeEditTool) {
             const pointer = canvas.getScenePoint(opt.e);
             onCanvasClick({
                 x: pointer.x / width,
                 y: pointer.y / height
             });
         }
     };

     canvas.on('object:modified', handleModified);
     canvas.on('selection:created', handleSelectionCreated);
     canvas.on('selection:updated', handleSelectionCreated);
     canvas.on('selection:cleared', handleSelectionCleared);
     canvas.on('mouse:down', handleMouseDown);

     return () => {
         canvas.off('object:modified', handleModified);
         canvas.off('selection:created', handleSelectionCreated);
         canvas.off('selection:updated', handleSelectionCreated);
         canvas.off('selection:cleared', handleSelectionCleared);
         canvas.off('mouse:down', handleMouseDown);
     };
  }, [width, height, onUpdateAnnotation, onSelectAnnotation, activeMode, activeEditTool, onCanvasClick]);

  return (
    <div
        className="absolute inset-0 z-20"
        style={{
             // If activeMode is edit, we want auto.
             // But if we want to select text under the canvas (View mode), we want none.
             // But if we have annotations in View mode, we might want to hover/click them?
             // Instructions: "View/Select Mode: Set the Fabric canvas CSS pointer-events to none."
             pointerEvents: activeMode === 'edit' ? 'auto' : 'none'
        }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};
