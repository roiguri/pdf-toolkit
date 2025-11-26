// src/components/dashboard/CompressSidebar.tsx
'use client';

import React, { useState } from 'react';
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
  const { selectedFileId, files } = useAppStore();
  const [compressionLevel, setCompressionLevel] = useState('ebook');
  const [isCompressing, setIsCompressing] = useState(false);

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

    setIsCompressing(true);
    toast.info('Compressing PDF...');

    try {
      // Fetch the file from the download URL
      const response = await fetch(selectedFile.downloadURL);
      const fileBlob = await response.blob();

      const formData = new FormData();
      formData.append('file', fileBlob, selectedFile.name);
      formData.append('level', compressionLevel);

      const compressResponse = await fetch(COMPRESSOR_API_URL, {
        method: 'POST',
        body: formData,
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
    } catch (error) {
      console.error('Compression error:', error);
      toast.error('An error occurred during compression.');
    } finally {
      setIsCompressing(false);
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

      <Button onClick={handleCompress} disabled={!selectedFileId || isCompressing}>
        {isCompressing ? 'Compressing...' : 'Compress PDF'}
      </Button>
    </div>
  );
};

export default CompressSidebar;
