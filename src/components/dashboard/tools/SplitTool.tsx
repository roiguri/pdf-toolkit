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
import { useAppStore } from '@/store/useAppStore';
import { splitPdf, embedAnnotationsInPdf } from '@/lib/pdf-utils';
import { useTranslation } from 'react-i18next';

const downloadPdf = (bytes: Uint8Array, filename: string) => {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

interface SplitToolProps {
  file: FileMetadata;
}

const SplitTool = ({ file }: SplitToolProps) => {
  const { annotations } = useAppStore();
  const [splitPageRanges, setSplitPageRanges] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [includeHighlights, setIncludeHighlights] = useState(false);
  const { t } = useTranslation('tools');

  const handleSplitPdf = async () => {
    if (!splitPageRanges) {
      toast.error(t('split.toasts.missingRanges'));
      return;
    }
    if (!file.downloadURL) {
      toast.error(t('split.toasts.missingUrl'));
      return;
    }

    setIsProcessing(true);
    toast.info(t('split.toasts.splitting'), { id: 'pdf-processing' });
    try {
      let arrayBuffer = await fetch(file.downloadURL).then((res) => res.arrayBuffer());

      if (file.annotations?.length || file.bookmarks?.length) {
        toast.info(t('split.toasts.embeddingAnnotations'), { id: 'pdf-processing' });
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
      toast.success(t('split.toasts.success'), { id: 'pdf-processing' });
      setSplitPageRanges('');
    } catch (error) {
      console.error('Error splitting PDF:', error);
      toast.error(t('split.toasts.failed', { error: error instanceof Error ? error.message : String(error) }), { id: 'pdf-processing' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <h3 className="text-lg font-semibold flex min-w-0">
        <span className="flex-shrink-0">{t('split.title')}&nbsp;</span>
        <span className="truncate">{file.name}</span>
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="page-ranges">{t('split.pageRangesLabel')}</Label>
          <Input
            id="page-ranges"
            type="text"
            value={splitPageRanges}
            onChange={(e) => setSplitPageRanges(e.target.value)}
            placeholder={t('split.pageRangesPlaceholder')}
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
            {t('split.includeHighlights')}
          </Label>
        </div>
        <Button onClick={handleSplitPdf} disabled={isProcessing}>
          {isProcessing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t('split.splitButton')}
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <PDFViewer file={file} annotations={annotations} />
      </div>
    </div>
  );
};

export default SplitTool;
