'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { FileMetadata } from '@/services/firestore';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { splitPdf, downloadPdf, embedAnnotationsInPdf } from '@/lib/pdf-utils';

interface SplitToolProps {
  file: FileMetadata;
}

const SplitTool = ({ file }: SplitToolProps) => {
  const [splitPageRanges, setSplitPageRanges] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [includeHighlights, setIncludeHighlights] = useState(false);

  const handleSplitPdf = async () => {
    if (!splitPageRanges) {
      toast.error('Please enter page ranges to split.');
      return;
    }
    if (!file.downloadURL) {
      toast.error('File URL is missing: cannot split.');
      return;
    }

    setIsProcessing(true);
    toast.info('Splitting PDF...', { id: 'pdf-processing' });
    try {
      let arrayBuffer = await fetch(file.downloadURL).then((res) => res.arrayBuffer());

      if (file.annotations?.length || file.bookmarks?.length) {
        toast.info('Embedding annotations...', { id: 'pdf-processing' });
        const filteredAnnotations = (file.annotations || []).filter(a =>
          a.type === 'signature' || a.type === 'text' ||
          (includeHighlights && a.type === 'highlight')
        );
        const annotatedBytes = await embedAnnotationsInPdf(
          arrayBuffer,
          filteredAnnotations,
          undefined,
          file.bookmarks,
        );
        arrayBuffer = annotatedBytes.buffer as ArrayBuffer;
      }

      const output = await splitPdf(arrayBuffer, splitPageRanges, file.name);
      output.forEach(({ bytes, filename }) => downloadPdf(bytes, filename));
      toast.success('PDF split successfully and downloaded!', { id: 'pdf-processing' });
      setSplitPageRanges('');
    } catch (error) {
      console.error('Error splitting PDF:', error);
      toast.error(`Failed to split PDF: ${error instanceof Error ? error.message : String(error)}`, { id: 'pdf-processing' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex min-w-0">
        <span className="flex-shrink-0">Split PDF:&nbsp;</span>
        <span className="truncate">{file.name}</span>
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="page-ranges">Page Ranges (e.g., 1, 3-5, 7):</Label>
          <Input
            id="page-ranges"
            type="text"
            value={splitPageRanges}
            onChange={(e) => setSplitPageRanges(e.target.value)}
            placeholder="e.g., 1, 3-5, 7"
            disabled={isProcessing}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-highlights-split"
            checked={includeHighlights}
            onCheckedChange={(checked) => setIncludeHighlights(checked === true)}
            disabled={isProcessing}
          />
          <Label htmlFor="include-highlights-split" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Include Highlights
          </Label>
        </div>
        <Button onClick={handleSplitPdf} disabled={isProcessing}>
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Split PDF
        </Button>
      </div>
      <PDFViewer file={file} />
    </div>
  );
};

export default SplitTool;
