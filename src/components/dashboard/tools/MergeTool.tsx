'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { FileMetadata } from '@/services/firestore';
import { useAppStore } from '@/store/useAppStore';
import MergeOrderList from '@/components/dashboard/MergeOrderList';
import { mergePdfs, embedAnnotationsInPdf } from '@/lib/pdf-utils';
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

const MergeTool = () => {
  const { files, mergeSelection } = useAppStore();
  const { t } = useTranslation('tools');

  const filesToMerge = mergeSelection
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is FileMetadata => f !== undefined);

  const [isProcessing, setIsProcessing] = useState(false);
  const [includeHighlights, setIncludeHighlights] = useState(false);

  const handleMergePdfs = async () => {
    if (filesToMerge.length < 2) {
      toast.error(t('merge.toasts.selectTwo'));
      return;
    }

    setIsProcessing(true);
    toast.info(t('merge.toasts.merging'), { id: 'pdf-processing' });
    try {
      const arrayBuffers = await Promise.all(
        filesToMerge.map(async (file) => {
          if (!file.downloadURL) {
            throw new Error(`Missing download URL for file: ${file.name}`);
          }
          let buffer = await fetch(file.downloadURL).then(res => res.arrayBuffer());

          if (file.annotations?.length || file.bookmarks?.length) {
            const filteredAnnotations = (file.annotations || []).filter(a =>
              a.type === 'signature' || a.type === 'text' ||
              (includeHighlights && a.type === 'highlight')
            );
            const annotatedBytes = await embedAnnotationsInPdf(
              buffer,
              filteredAnnotations,
              undefined,
              file.bookmarks,
            );
            buffer = annotatedBytes.buffer as ArrayBuffer;
          }
          return buffer;
        })
      );

      const { bytes, filename } = await mergePdfs(arrayBuffers, 'merged_pdfs.pdf');
      downloadPdf(bytes, filename);
      toast.success(t('merge.toasts.success'), { id: 'pdf-processing' });
    } catch (error) {
      console.error('Error merging PDFs:', error);
      toast.error(t('merge.toasts.failed', { error: error instanceof Error ? error.message : String(error) }), { id: 'pdf-processing' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('merge.title')}</h3>
      {filesToMerge.length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('merge.dragToReorder', { count: filesToMerge.length })}
            </p>
            <MergeOrderList files={filesToMerge} />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-highlights-merge"
              checked={includeHighlights}
              onCheckedChange={(checked) => setIncludeHighlights(checked === true)}
              disabled={isProcessing}
            />
            <Label htmlFor="include-highlights-merge" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {t('merge.includeHighlights')}
            </Label>
          </div>
          <Button onClick={handleMergePdfs} disabled={isProcessing || filesToMerge.length < 2}>
            {isProcessing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('merge.mergeButton')}
          </Button>
        </div>
      ) : (
        <p className="text-center text-muted-foreground">{t('merge.selectPrompt')}</p>
      )}
    </div>
  );
};

export default MergeTool;
