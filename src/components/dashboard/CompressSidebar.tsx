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

const COMPRESSOR_API_URL = 'https://pdf-compressor-837865788232.us-central1.run.app/compress';

const CompressSidebar = () => {
  const { 
    selectedFileId, 
    files, 
    isCompressing, 
    compressAbortController, 
    setCompressionStatus 
  } = useAppStore();
  const [compressionLevel, setCompressionLevel] = useState('ebook');

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
    if (!selectedFileId) {
      toast.error('Please select a file to compress.');
      return;
    }

    const selectedFile = files.find((f) => f.id === selectedFileId);
    if (!selectedFile) {
      toast.error('File not found.');
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
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed-${selectedFile.name}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a compression level. Higher compression reduces file size but may lower quality.
      </p>

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
