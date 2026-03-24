'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, ArrowLeft, ScanLine, PlusCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

type Corner = [number, number]; // [x, y] in original image coords

interface ScannedImage {
  file: File;
  previewUrl: string;
  origWidth: number;
  origHeight: number;
  corners: [Corner, Corner, Corner, Corner]; // TL, TR, BR, BL
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Corner handle drag logic ---

const MAG_SIZE = 160; // magnifier window px
const MAG_ZOOM = 4;   // zoom factor

interface MagnifierProps {
  previewUrl: string;
  corner: Corner;
  origWidth: number;
  origHeight: number;
}

function Magnifier({ previewUrl, corner, origWidth, origHeight }: MagnifierProps) {
  const bgW = origWidth * MAG_ZOOM;
  const bgH = origHeight * MAG_ZOOM;
  const bgX = -(corner[0] * MAG_ZOOM - MAG_SIZE / 2);
  const bgY = -(corner[1] * MAG_ZOOM - MAG_SIZE / 2);
  return (
    <div
      className="absolute top-2 right-2 rounded-lg border-2 border-blue-500 overflow-hidden shadow-xl pointer-events-none"
      style={{
        width: MAG_SIZE,
        height: MAG_SIZE,
        backgroundImage: `url(${previewUrl})`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `${bgX}px ${bgY}px`,
        backgroundRepeat: 'no-repeat',
        zIndex: 20,
      }}
    >
      {/* crosshair */}
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500 opacity-70" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500 opacity-70" />
      </div>
    </div>
  );
}

interface CornerHandlesProps {
  corners: [Corner, Corner, Corner, Corner];
  origWidth: number;
  origHeight: number;
  containerEl: HTMLDivElement;
  previewUrl: string;
  onChange: (corners: [Corner, Corner, Corner, Corner]) => void;
}

/** Compute the pixel rect of the image rendered with object-contain inside the container. */
function getImageRect(containerEl: HTMLDivElement, origWidth: number, origHeight: number) {
  const { width: cw, height: ch } = containerEl.getBoundingClientRect();
  const containerAspect = cw / ch;
  const imageAspect = origWidth / origHeight;
  let iw: number, ih: number, ox: number, oy: number;
  if (imageAspect > containerAspect) {
    iw = cw;
    ih = cw / imageAspect;
    ox = 0;
    oy = (ch - ih) / 2;
  } else {
    ih = ch;
    iw = ch * imageAspect;
    ox = (cw - iw) / 2;
    oy = 0;
  }
  return { iw, ih, ox, oy };
}

// Drag sensitivity: 1/MAG_ZOOM means the corner moves 1px per 4px of pointer
// movement, so it moves 1:1 as seen inside the magnifier.
const DRAG_SENSITIVITY = 1 / MAG_ZOOM;

interface DragStart { px: number; py: number; cx: number; cy: number }

function CornerHandles({ corners, origWidth, origHeight, containerEl, previewUrl, onChange }: CornerHandlesProps) {
  const dragging = useRef<number | null>(null);
  const dragStart = useRef<DragStart | null>(null);
  const [activeCorner, setActiveCorner] = useState<Corner | null>(null);

  const toDisplay = (corner: Corner): { x: number; y: number } => {
    const { iw, ih, ox, oy } = getImageRect(containerEl, origWidth, origHeight);
    return { x: ox + (corner[0] / origWidth) * iw, y: oy + (corner[1] / origHeight) * ih };
  };

  const onPointerDown = (idx: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = idx;
    dragStart.current = { px: e.clientX, py: e.clientY, cx: corners[idx][0], cy: corners[idx][1] };
    setActiveCorner(corners[idx]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (dragging.current === null || !dragStart.current) return;
    const idx = dragging.current;
    const { iw, ih } = getImageRect(containerEl, origWidth, origHeight);
    // Convert pointer delta (display px) → original image px, scaled by sensitivity
    const dx = (e.clientX - dragStart.current.px) * (origWidth / iw) * DRAG_SENSITIVITY;
    const dy = (e.clientY - dragStart.current.py) * (origHeight / ih) * DRAG_SENSITIVITY;
    const newCorner: Corner = [
      Math.round(Math.max(0, Math.min(origWidth,  dragStart.current.cx + dx))),
      Math.round(Math.max(0, Math.min(origHeight, dragStart.current.cy + dy))),
    ];
    const next = [...corners] as [Corner, Corner, Corner, Corner];
    next[idx] = newCorner;
    setActiveCorner(newCorner);
    onChange(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corners, origWidth, origHeight, containerEl, onChange]);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
    dragStart.current = null;
    setActiveCorner(null);
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const { width = 0, height = 0 } = containerEl.getBoundingClientRect();

  const pts = corners.map(toDisplay);
  const polygonPts = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <>
      {/* SVG overlay */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
      >
        <polygon
          points={polygonPts}
          fill="rgba(59,130,246,0.15)"
          stroke="rgba(59,130,246,0.8)"
          strokeWidth={2}
        />
      </svg>

      {/* Corner handles */}
      {pts.map((p, i) => (
        <div
          key={i}
          onPointerDown={onPointerDown(i)}
          className="absolute w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-grab active:cursor-grabbing touch-none"
          style={{ left: p.x - 10, top: p.y - 10, zIndex: 10 }}
        />
      ))}

      {/* Magnifier — shown while dragging a corner */}
      {activeCorner && (
        <Magnifier
          previewUrl={previewUrl}
          corner={activeCorner}
          origWidth={origWidth}
          origHeight={origHeight}
        />
      )}
    </>
  );
}

// --- Main ScanTool ---

const ScanTool = () => {
  const { currentUser } = useAuth();
  const [images, setImages] = useState<ScannedImage[]>([]);
  const [step, setStep] = useState<'upload' | 'adjust'>('upload');
  const [enhance, setEnhance] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const currentIdx = images.length - 1; // index of the image being adjusted
  const current = images[currentIdx] ?? null;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    setIsDetecting(true);
    toast.info('Detecting document edges…', { id: 'scan-detect' });

    const previewUrl = URL.createObjectURL(file);

    // Get natural dimensions via an Image element
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = previewUrl;
    });

    try {
      const form = new FormData();
      form.append('file', file);
      const idToken = await currentUser!.getIdToken();
      const res = await fetch('/api/pdf/scan/detect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: form,
      });
      const data = await res.json();

      const clamp = ([x, y]: Corner): Corner => [
        Math.round(Math.max(0, Math.min(dims.w, x))),
        Math.round(Math.max(0, Math.min(dims.h, y))),
      ];
      const corners: [Corner, Corner, Corner, Corner] = data.corners
        ? (data.corners as Corner[]).slice(0, 4).map(clamp) as [Corner, Corner, Corner, Corner]
        : [[0, 0], [dims.w, 0], [dims.w, dims.h], [0, dims.h]];

      setImages(prev => [...prev, { file, previewUrl, origWidth: dims.w, origHeight: dims.h, corners }]);
      setStep('adjust');
      toast.success('Edges detected. Adjust corners if needed.', { id: 'scan-detect' });
    } catch {
      // Fall back to full-image corners
      const corners: [Corner, Corner, Corner, Corner] = [[0, 0], [dims.w, 0], [dims.w, dims.h], [0, dims.h]];
      setImages(prev => [...prev, { file, previewUrl, origWidth: dims.w, origHeight: dims.h, corners }]);
      setStep('adjust');
      toast.warning('Could not detect edges. Using full image.', { id: 'scan-detect' });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleCornersChange = (corners: [Corner, Corner, Corner, Corner]) => {
    setImages(prev => {
      const next = [...prev];
      next[currentIdx] = { ...next[currentIdx], corners };
      return next;
    });
  };

  const handleBack = () => {
    // Remove the most recently added image and go back to upload
    URL.revokeObjectURL(images[currentIdx]?.previewUrl ?? '');
    setImages(prev => prev.slice(0, -1));
    setStep(images.length > 1 ? 'adjust' : 'upload');
  };

  const handleAddAnother = () => {
    setStep('upload');
  };

  const handleScan = async () => {
    if (images.length === 0) return;
    setIsScanning(true);
    toast.info('Scanning…', { id: 'scan-process' });

    try {
      const form = new FormData();
      for (const img of images) form.append('images', img.file);
      form.append('enhance', enhance ? 'true' : 'false');
      for (let i = 0; i < images.length; i++) {
        const c = images[i].corners;
        form.append(`corners_${i}`, c.flat().join(','));
      }

      const idToken = await currentUser!.getIdToken();
      const res = await fetch('/api/pdf/scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      downloadBlob(blob, 'scanned.pdf');
      toast.success('PDF downloaded!', { id: 'scan-process' });

      // Reset
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
      setStep('upload');
    } catch (err) {
      toast.error(`Scan failed: ${err instanceof Error ? err.message : String(err)}`, { id: 'scan-process' });
    } finally {
      setIsScanning(false);
    }
  };

  // --- Render ---

  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Scan Images to PDF</h3>
        {images.length > 0 && (
          <p className="text-sm text-muted-foreground">{images.length} image(s) queued. Add another or go back to adjust.</p>
        )}
        <label
          className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <input type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
          {isDetecting ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Drop image here or click to upload</span>
            </>
          )}
        </label>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="enhance-scan"
            checked={enhance}
            onCheckedChange={v => setEnhance(v === true)}
          />
          <Label htmlFor="enhance-scan" className="text-sm">Enhance document (contrast)</Label>
        </div>

        {images.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('adjust'); }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to adjust
            </Button>
            <Button onClick={handleScan} disabled={isScanning}>
              {isScanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ScanLine className="mr-2 h-4 w-4" />
              Scan {images.length} image(s)
            </Button>
          </div>
        )}
      </div>
    );
  }

  // step === 'adjust'
  return (
    <div className="space-y-4 flex flex-col h-full">
      <h3 className="text-lg font-semibold">Adjust document corners</h3>

      <div
        ref={setContainerEl}
        className="relative flex-1 min-h-0 select-none overflow-hidden rounded-md border bg-muted"
      >
        {current && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.previewUrl}
              alt="Document preview"
              className="w-full h-full object-contain"
              draggable={false}
            />
            {containerEl && (
              <CornerHandles
                corners={current.corners}
                origWidth={current.origWidth}
                origHeight={current.origHeight}
                containerEl={containerEl}
                previewUrl={current.previewUrl}
                onChange={handleCornersChange}
              />
            )}
          </>
        )}
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button variant="outline" onClick={handleAddAnother}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add another image
        </Button>
        <Button onClick={handleScan} disabled={isScanning}>
          {isScanning
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <ScanLine className="mr-2 h-4 w-4" />}
          Scan {images.length} image(s)
        </Button>
      </div>
    </div>
  );
};

export default ScanTool;
