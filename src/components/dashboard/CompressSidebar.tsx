// src/components/dashboard/CompressSidebar.tsx
'use client';

import React, { useState, useEffect } from 'react';
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
import { Download, RefreshCw, ArrowRight } from 'lucide-react';

const COMPRESSOR_API_URL = 'https://pdf-compressor-837865788232.us-central1.run.app/compress';

interface CompressedResult {
  url: string;
  size: number;
  name: string;
  originalSize: number;
}

const CompressSidebar = () => {
  const { 
    selectedFileId, 
    files, 
    isCompressing, 
    compressAbortController, 
    setCompressionStatus 
  } = useAppStore();
  const [compressionLevel, setCompressionLevel] = useState('ebook');
  const [compressedResult, setCompressedResult] = useState<CompressedResult | null>(null);

  const selectedFile = files.find((f) => f.id === selectedFileId);

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
      // Optional: abort on unmount if desired, but for now we strictly handle window unload
    };
  }, [isCompressing]);

  const handleCancel = () => {
    if (compressAbortController) {
      compressAbortController.abort();
      toast.info('Compression cancelled.');
    }
  };

  const handleCompress = async () => {
    if (!selectedFileId || !selectedFile) {
      toast.error('Please select a file to compress.');
      return;
    }

    const controller = new AbortController();
    setCompressionStatus(true, controller);
    toast.info('Compressing PDF...');

    try {
      // Fetch the file from the download URL
      const response = await fetch(selectedFile.downloadURL, { signal: controller.signal });
      const fileBlob = await response.blob();

      const formData = new FormData();
      formData.append('file', fileBlob, selectedFile.name);
      formData.append('level', compressionLevel);

      const compressResponse = await fetch(COMPRESSOR_API_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!compressResponse.ok) {
        throw new Error('Failed to compress PDF.');
      }

      const compressedBlob = await compressResponse.blob();
      const url = window.URL.createObjectURL(compressedBlob);
      
      setCompressedResult({
        url,
        size: compressedBlob.size,
        name: `compressed-${selectedFile.name}`,
        originalSize: selectedFile.size,
      });

      toast.success('PDF compressed successfully!');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Already handled by toast in handleCancel, or we can log it
        console.log('Compression cancelled by user');
      } else {
        console.error('Compression error:', error);
        toast.error('An error occurred during compression.');
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
          <h3 className="font-medium">Compression Complete!</h3>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Original</p>
              <p className="font-medium">{formatBytes(compressedResult.originalSize)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Compressed</p>
              <p className="font-medium">{formatBytes(compressedResult.size)}</p>
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-1">Reduction</p>
            <p className={`text-lg font-bold ${isPositiveReduction ? 'text-green-600' : 'text-orange-600'}`}>
              {isPositiveReduction ? '-' : '+'}{formatBytes(Math.abs(reduction))} ({reductionPercent}%)
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Download File
          </Button>
          <Button variant="outline" onClick={handleReset} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Compress Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a compression level. Higher compression reduces file size but may lower quality.
      </p>

      {selectedFile && (
        <div className="text-sm border rounded p-2 bg-muted/50">
          <span className="text-muted-foreground">Selected: </span>
          <span className="font-medium">{selectedFile.name}</span>
          <span className="text-muted-foreground block text-xs mt-1">
            Size: {formatBytes(selectedFile.size)}
          </span>
        </div>
      )}

      <div>
        <Label htmlFor="compression-level" className="mb-2">Compression Level</Label>
        <Select value={compressionLevel} onValueChange={setCompressionLevel}>
          <SelectTrigger id="compression-level">
            <SelectValue placeholder="Select level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="screen">High (Smallest size, 72 dpi)</SelectItem>
            <SelectItem value="ebook">Medium (Average quality, 150 dpi)</SelectItem>
            <SelectItem value="prepress">Low (Best quality, 300 dpi)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={handleCompress} 
          disabled={!selectedFileId || isCompressing}
          className="flex-1"
        >
          {isCompressing ? 'Compressing...' : 'Compress PDF'}
        </Button>
        
        {isCompressing && (
          <Button 
            variant="destructive" 
            onClick={handleCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

export default CompressSidebar;
