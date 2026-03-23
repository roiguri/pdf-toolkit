// src/components/dashboard/Workspace.tsx
'use client';

import { useAppStore } from '@/store/useAppStore';
import ActionToolbar from './ActionToolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import CompressSidebar from './CompressSidebar';
import EditTool from './tools/EditTool';
import ConvertTool from './tools/ConvertTool';
import SplitTool from './tools/SplitTool';
import MergeTool from './tools/MergeTool';

const Workspace = () => {
  const { selectedFileId, activeMode, files } = useAppStore();
  const selectedFile = files.find((f) => f.id === selectedFileId);
  const noFile = (msg: string) => <p className="text-center text-muted-foreground">{msg}</p>;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Workspace</CardTitle>
        <ActionToolbar />
      </CardHeader>
      <CardContent className="flex flex-grow flex-col space-y-4 overflow-y-auto">

        {activeMode === 'view' && (
          selectedFile
            ? <PDFViewer file={selectedFile} />
            : noFile('Select a PDF from the sidebar to view.')
        )}

        {activeMode === 'split' && (
          selectedFile
            ? <SplitTool file={selectedFile} />
            : noFile('Select a PDF from the sidebar to split.')
        )}

        {activeMode === 'merge' && <MergeTool />}

        {activeMode === 'convert' && (
          selectedFile
            ? <ConvertTool file={selectedFile} />
            : noFile('Select a PDF from the sidebar to convert.')
        )}

        {activeMode === 'edit' && (
          selectedFile
            ? <EditTool file={selectedFile} />
            : noFile('Select a PDF from the sidebar to edit.')
        )}

        {activeMode === 'compress' && (
          selectedFile ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex min-w-0">
                <span className="flex-shrink-0">Compress PDF:&nbsp;</span>
                <span className="truncate">{selectedFile.name}</span>
              </h3>
              <CompressSidebar />
              <PDFViewer file={selectedFile} />
            </div>
          ) : noFile('Select a PDF from the sidebar to compress.')
        )}

      </CardContent>
    </Card>
  );
};

export default Workspace;
