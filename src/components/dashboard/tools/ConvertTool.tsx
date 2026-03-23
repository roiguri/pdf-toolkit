'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { FileMetadata } from '@/services/firestore';
import { useAppStore } from '@/store/useAppStore';
import { PDFViewer, PDFViewerHandle } from '@/components/pdf/PDFViewer';
import { embedAnnotationsInPdf } from '@/lib/pdf-utils';

interface ConvertToolProps {
  file: FileMetadata;
}

const ConvertTool = ({ file }: ConvertToolProps) => {
  const viewerRef = useRef<PDFViewerHandle>(null);
  const { annotations } = useAppStore();

  const [isConverting, setIsConverting] = useState(false);
  const [includeHighlights, setIncludeHighlights] = useState(false);

  const handleDownloadImage = async () => {
    const currentPage = viewerRef.current?.currentPage ?? 1;
    const pageEl = viewerRef.current?.getPageElement(currentPage);

    if (!pageEl) {
      toast.error('Current page not found.');
      return;
    }

    const annotationsForPage = annotations.filter(a => a.pageNumber === currentPage);
    const hasSignaturesOrText = annotationsForPage.some(a => a.type === 'signature' || a.type === 'text');
    const hasHighlights = annotationsForPage.some(a => a.type === 'highlight');
    const shouldBurn = hasSignaturesOrText || (hasHighlights && includeHighlights);

    setIsConverting(true);
    toast.info('Converting page to image...', { id: 'image-conversion' });

    try {
      let imageDataUrl: string;

      if (shouldBurn && file.downloadURL) {
        const filteredAnnotations = annotations.filter(a =>
          a.type === 'signature' || a.type === 'text' || (includeHighlights && a.type === 'highlight')
        );

        const pagesDimensions = viewerRef.current?.pagesDimensions ?? {};
        const scale = viewerRef.current?.scale ?? 1;
        const pageDims = pagesDimensions[currentPage];
        const unscaledDimensions = pageDims
          ? { width: pageDims.width / scale, height: pageDims.height / scale }
          : undefined;

        const annotatedPdfBytes = await embedAnnotationsInPdf(
          file.downloadURL,
          filteredAnnotations,
          unscaledDimensions,
          [],
        );

        const loadingTask = pdfjs.getDocument({ data: annotatedPdfBytes });
        const pdfDoc = await loadingTask.promise;
        const page = await pdfDoc.getPage(currentPage);

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        imageDataUrl = canvas.toDataURL('image/png', 1.0);
      } else {
        const canvas = pageEl.querySelector('canvas');
        if (!canvas) {
          toast.error('Page rendering not complete. Please wait a moment.');
          return;
        }
        imageDataUrl = canvas.toDataURL('image/png', 1.0);
      }

      const link = document.createElement('a');
      link.href = imageDataUrl;
      link.download = `${file.name}_page_${currentPage}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Page converted and downloaded as image!', { id: 'image-conversion' });
    } catch (error) {
      console.error('Error converting page to image:', error);
      toast.error('Failed to convert page to image.', { id: 'image-conversion' });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg w-fit mx-auto">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-highlights-convert"
            checked={includeHighlights}
            onCheckedChange={(checked) => setIncludeHighlights(checked === true)}
            disabled={isConverting}
          />
          <Label htmlFor="include-highlights-convert" className="text-sm font-medium cursor-pointer">
            Include Highlights
          </Label>
        </div>
        <Button onClick={handleDownloadImage} disabled={isConverting} variant="outline">
          {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <ImageIcon className="mr-2 h-4 w-4" />
          Convert to Image
        </Button>
      </div>

      <PDFViewer ref={viewerRef} file={file} annotations={annotations} bookmarks={[]} />
    </>
  );
};

export default ConvertTool;
