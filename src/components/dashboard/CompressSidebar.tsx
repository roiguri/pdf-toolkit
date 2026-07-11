// src/components/dashboard/CompressSidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatBytes } from '@/lib/utils';
import { Download, RefreshCw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { embedAnnotationsInPdf } from '@/lib/pdf-utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { useTranslation } from 'react-i18next';

interface CompressedResult {
  url: string;
  size: number;
  name: string;
  originalSize: number;
}

const CompressSidebar = () => {
  const { currentUser } = useAuth();
  const {
    selectedFileId,
    files,
    isCompressing,
    compressAbortController,
    setCompressionStatus
  } = useAppStore();
  const [compressionLevel, setCompressionLevel] = useState('ebook');
  const [compressedResult, setCompressedResult] = useState<CompressedResult | null>(null);
  const { t } = useTranslation('tools');

  const selectedFile = files.find((f) => f.id === selectedFileId);
  const [includeHighlights, setIncludeHighlights] = useState(false);

  useEffect(() => {
    // Reset result when a new file is selected
    if (selectedFileId) {
      setCompressedResult(null);
    }
  }, [selectedFileId]);

  // Cleanup object URL on unmount or when compressedResult changes
  useEffect(() => {
    return () => {
      if (compressedResult?.url) {
        window.URL.revokeObjectURL(compressedResult.url);
      }
    };
  }, [compressedResult]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isCompressing) {
        // Prompt the user to confirm leaving if compression is in progress
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isCompressing]);

  const handleCancel = () => {
    if (compressAbortController) {
      compressAbortController.abort();
      toast.info(t('compress.toasts.cancelled'));
    }
  };

  const handleCompress = async () => {
    if (!selectedFileId || !selectedFile) {
      toast.error(t('compress.toasts.selectFile'));
      return;
    }

    const controller = new AbortController();
    setCompressionStatus(true, controller);
    toast.info(t('compress.toasts.compressing'));

    try {
      if (!selectedFile.downloadURL) {
        throw new Error(t('compress.toasts.missingUrl'));
      }

      // Fetch the file from the download URL
      const response = await fetch(selectedFile.downloadURL, { signal: controller.signal });
      let fileBlob = await response.blob();

      // Embed annotations if present
      if (selectedFile.annotations?.length || selectedFile.bookmarks?.length) {
        try {
          toast.info(t('compress.toasts.embeddingAnnotations'), { id: 'compress-embedding' });
          const arrayBuffer = await fileBlob.arrayBuffer();

          // Filter out highlights if not requested
          const filteredAnnotations = (selectedFile.annotations || []).filter(a =>
            a.type === 'signature' || a.type === 'text' ||
            (includeHighlights && a.type === 'highlight')
          );

          const annotatedBytes = await embedAnnotationsInPdf(
            arrayBuffer,
            filteredAnnotations,
            selectedFile.bookmarks
          );

          fileBlob = new Blob([annotatedBytes as any], { type: 'application/pdf' });
          toast.success(t('compress.toasts.annotationsEmbedded'), { id: 'compress-embedding' });
        } catch (embedError) {
          console.error('Error embedding annotations for compress:', embedError);
          toast.error(t('compress.toasts.embedFailed'), { id: 'compress-embedding' });
        }
      }

      const formData = new FormData();
      formData.append('file', fileBlob, selectedFile.name);
      formData.append('level', compressionLevel);

      const idToken = await currentUser!.getIdToken();
      const compressResponse = await fetch('/api/pdf/compress', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
        signal: controller.signal,
      });

      if (!compressResponse.ok) {
        throw new Error(t('compress.toasts.failed'));
      }

      const compressedBlob = await compressResponse.blob();
      const url = window.URL.createObjectURL(compressedBlob);

      setCompressedResult({
        url,
        size: compressedBlob.size,
        name: `compressed-${selectedFile.name}`,
        originalSize: selectedFile.size || 0,
      });

      toast.success(t('compress.toasts.success'));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Compression cancelled by user');
      } else {
        console.error('Compression error:', error);
        toast.error(t('compress.toasts.error'));
      }
    } finally {
      setCompressionStatus(false, null);
    }
  };

  const handleDownload = () => {
    if (!compressedResult) return;
    const a = document.createElement('a');
    a.href = compressedResult.url;
    a.download = compressedResult.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleReset = () => {
    setCompressedResult(null);
  };

  if (compressedResult) {
    const reduction = compressedResult.originalSize - compressedResult.size;
    const reductionPercent = ((reduction / compressedResult.originalSize) * 100).toFixed(1);
    const isPositiveReduction = reduction > 0;

    return (
      <div className="space-y-6">
        <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
          <h3 className="font-medium">{t('compress.result.title')}</h3>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('compress.result.original')}</p>
              <p className="font-medium">{formatBytes(compressedResult.originalSize)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('compress.result.compressed')}</p>
              <p className="font-medium">{formatBytes(compressedResult.size)}</p>
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-1">{t('compress.result.reduction')}</p>
            <p className={`text-lg font-bold ${isPositiveReduction ? 'text-green-600' : 'text-orange-600'}`}>
              {isPositiveReduction ? '-' : '+'}{formatBytes(Math.abs(reduction))} ({reductionPercent}%)
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleDownload} className="w-full">
            <Download className="me-2 h-4 w-4" />
            {t('compress.result.downloadButton')}
          </Button>
          <Button variant="outline" onClick={handleReset} className="w-full">
            <RefreshCw className="me-2 h-4 w-4" />
            {t('compress.result.compressAnotherButton')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('compress.selectPrompt')}
      </p>

      {selectedFile && (
        <div className="text-sm border rounded p-2 bg-muted/50">
          <span className="text-muted-foreground">{t('compress.selected')}: </span>
          <span className="font-medium">{selectedFile.name}</span>
          <span className="text-muted-foreground block text-xs mt-1">
            {t('compress.size')}: {formatBytes(selectedFile.size || 0)}
          </span>
        </div>
      )}

      {/* Include Highlights Option */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="include-highlights-compress"
          checked={includeHighlights}
          onCheckedChange={(checked) => setIncludeHighlights(checked === true)}
          disabled={isCompressing || !selectedFile}
        />
        <Label htmlFor="include-highlights-compress" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {t('compress.includeHighlights')}
        </Label>
      </div>

      <div>
        <Label htmlFor="compression-level" className="mb-2">{t('compress.levelLabel')}</Label>
        <Select value={compressionLevel} onValueChange={setCompressionLevel}>
          <SelectTrigger id="compression-level">
            <SelectValue placeholder={t('compress.levelPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="screen">{t('compress.levels.screen')}</SelectItem>
            <SelectItem value="ebook">{t('compress.levels.ebook')}</SelectItem>
            <SelectItem value="prepress">{t('compress.levels.prepress')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleCompress}
          disabled={!selectedFileId || isCompressing}
          className="flex-1"
        >
          {isCompressing ? t('compress.compressing') : t('compress.compressButton')}
        </Button>

        {isCompressing && (
          <Button
            variant="destructive"
            onClick={handleCancel}
          >
            {t('compress.cancelButton')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CompressSidebar;
