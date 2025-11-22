// src/components/dashboard/Workspace.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import ActionToolbar from './ActionToolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PDFViewer } from '@/components/pdf/PDFViewer'; // Will create PDFViewer
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFileDownloadUrl } from '@/services/storage';
import { splitPdf, mergePdfs, downloadPdf } from '@/lib/pdf-utils';
import { Label } from '@/components/ui/label';

const Workspace = () => {
  const { selectedFileId, activeMode, files, mergeSelection } = useAppStore();
  const selectedFile = files.find((f) => f.id === selectedFileId);
  const [splitPageRanges, setSplitPageRanges] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter files based on mergeSelection
  const filesToMerge = files.filter((f) => mergeSelection.includes(f.id));

  const handleSplitPdf = async () => {
    if (!selectedFile) {
      toast.error('No PDF file selected to split.');
      return;
    }
    if (!splitPageRanges) {
      toast.error('Please enter page ranges to split.');
      return;
    }

    setIsProcessing(true);
    toast.info('Splitting PDF...', { id: 'pdf-processing' });
    try {
      const arrayBuffer = await fetch(selectedFile.downloadURL).then((res) =>
        res.arrayBuffer()
      );
      const output = await splitPdf(arrayBuffer, splitPageRanges, selectedFile.name);
      output.forEach(({ bytes, filename }) => {
        downloadPdf(bytes, filename);
      });
      toast.success('PDF split successfully and downloaded!', { id: 'pdf-processing' });
      setSplitPageRanges(''); // Clear input
    } catch (error) {
      console.error('Error splitting PDF:', error);
      toast.error(`Failed to split PDF: ${error instanceof Error ? error.message : String(error)}`, { id: 'pdf-processing' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMergePdfs = async () => {
    if (filesToMerge.length < 2) {
      toast.error('Please select at least two PDF files to merge.');
      return;
    }

    setIsProcessing(true);
    toast.info('Merging PDFs...', { id: 'pdf-processing' });
    try {
      const arrayBuffers = await Promise.all(
        filesToMerge.map(async (file) => {
          const response = await fetch(file.downloadURL);
          return response.arrayBuffer();
        })
      );

      const { bytes, filename } = await mergePdfs(arrayBuffers, 'merged_pdfs.pdf');
      downloadPdf(bytes, filename);
      toast.success('PDFs merged successfully and downloaded!', { id: 'pdf-processing' });
    } catch (error) {
      console.error('Error merging PDFs:', error);
      toast.error(`Failed to merge PDFs: ${error instanceof Error ? error.message : String(error)}`, { id: 'pdf-processing' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvertPdf = async () => {
    if (!selectedFile) {
      toast.error('No PDF file selected to convert.');
      return;
    }
    toast.info('To convert to image, please use the "Convert to Image" button on the PDF viewer itself.', { id: 'convert-info' });
    // The actual conversion logic (canvas.toDataURL) will be within the PDFViewer or a dedicated component for it.
    // This is just a placeholder to guide the user.
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col space-y-4">
        <ActionToolbar />

        {activeMode === 'view' && (
          selectedFile ? (
            <PDFViewer file={selectedFile} />
          ) : (
            <p className="text-center text-muted-foreground">Select a PDF from the sidebar to view.</p>
          )
        )}

        {activeMode === 'split' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Split PDF: {selectedFile?.name || 'No file selected'}</h3>
            {selectedFile ? (
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
                <Button onClick={handleSplitPdf} disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Split PDF
                </Button>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Select a PDF from the sidebar to split.</p>
            )}
          </div>
        )}

        {activeMode === 'merge' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Merge PDFs</h3>
            {filesToMerge.length > 0 ? (
              <div className="space-y-2">
                <p>Selected for merge ({filesToMerge.length}):</p>
                <ul className="list-inside list-disc">
                  {filesToMerge.map((file) => (
                    <li key={file.id}>{file.name}</li>
                  ))}
                </ul>
                <Button onClick={handleMergePdfs} disabled={isProcessing || filesToMerge.length < 2}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Merge Selected PDFs
                </Button>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Select at least two PDFs from the sidebar to merge.</p>
            )}
          </div>
        )}

        {activeMode === 'convert' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Convert PDF to Image: {selectedFile?.name || 'No file selected'}</h3>
            {selectedFile ? (
              <p className="text-center text-muted-foreground">
                To convert the current page to an image, please click the "Convert to Image" button within the PDF Viewer below.
              </p>
            ) : (
              <p className="text-center text-muted-foreground">Select a PDF from the sidebar to convert.</p>
            )}
            {/* The actual PDFViewer will handle the "Convert to Image" button */}
            {selectedFile && <PDFViewer file={selectedFile} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Workspace;
