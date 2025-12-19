// src/components/dashboard/Workspace.tsx
'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { FileMetadata } from '@/services/firestore';
import ActionToolbar from './ActionToolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PDFViewer } from '@/components/pdf/PDFViewer'; // Will create PDFViewer
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { splitPdf, mergePdfs, downloadPdf } from '@/lib/pdf-utils';
import { Label } from '@/components/ui/label';
import MergeOrderList from './MergeOrderList';
import CompressSidebar from './CompressSidebar';

const Workspace = () => {
  const { selectedFileId, activeMode, files, mergeSelection } = useAppStore();
  const selectedFile = files.find((f) => f.id === selectedFileId);
  const [splitPageRanges, setSplitPageRanges] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Map mergeSelection to files, preserving the selection order
  const filesToMerge = mergeSelection
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is FileMetadata => f !== undefined);

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

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Workspace</CardTitle>
        <ActionToolbar />
      </CardHeader>
      <CardContent className="flex flex-grow flex-col space-y-4 overflow-y-auto">

        {activeMode === 'view' && (
          selectedFile ? (
            <PDFViewer file={selectedFile} showConvertButton={false} />
          ) : (
            <p className="text-center text-muted-foreground">Select a PDF from the sidebar to view.</p>
          )
        )}

        {activeMode === 'split' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex min-w-0">
              <span className="flex-shrink-0">Split PDF:&nbsp;</span>
              <span className="truncate">{selectedFile?.name || 'No file selected'}</span>
            </h3>
            {selectedFile ? (
              <>
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
                <PDFViewer file={selectedFile} showConvertButton={false} />
              </>
            ) : (
              <p className="text-center text-muted-foreground">Select a PDF from the sidebar to split.</p>
            )}
          </div>
        )}

        {activeMode === 'merge' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Merge PDFs</h3>
            {filesToMerge.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Drag to reorder ({filesToMerge.length} selected):
                </p>
                <MergeOrderList files={filesToMerge} />
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
            <h3 className="text-lg font-semibold flex min-w-0">
              <span className="flex-shrink-0">Convert PDF to Image:&nbsp;</span>
              <span className="truncate">{selectedFile?.name || 'No file selected'}</span>
            </h3>
            {selectedFile ? (
              <p className="text-center text-muted-foreground">
                To convert the current page to an image, please click the &quot;Convert to Image&quot; button within the PDF Viewer below.
              </p>
            ) : (
              <p className="text-center text-muted-foreground">Select a PDF from the sidebar to convert.</p>
            )}
            {/* The actual PDFViewer will handle the "Convert to Image" button */}
            {selectedFile && <PDFViewer file={selectedFile} />}
          </div>
        )}

        {activeMode === 'edit' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex min-w-0">
              <span className="flex-shrink-0">Edit PDF:&nbsp;</span>
              <span className="truncate">{selectedFile?.name || 'No file selected'}</span>
            </h3>
            {selectedFile ? (
              <PDFViewer file={selectedFile} showConvertButton={false} />
            ) : (
              <p className="text-center text-muted-foreground">Select a PDF from the sidebar to edit.</p>
            )}
          </div>
        )}

        {activeMode === 'compress' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex min-w-0">
              <span className="flex-shrink-0">Compress PDF:&nbsp;</span>
              <span className="truncate">{selectedFile?.name || 'No file selected'}</span>
            </h3>
            {selectedFile ? (
              <>
                <CompressSidebar />
                <PDFViewer file={selectedFile} showConvertButton={false} />
              </>
            ) : (
              <p className="text-center text-muted-foreground">Select a PDF from the sidebar to compress.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Workspace;
