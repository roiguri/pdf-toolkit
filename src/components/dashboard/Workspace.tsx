// src/components/dashboard/Workspace.tsx
'use client';

import { useAppStore } from '@/store/useAppStore';
import ActionToolbar from './ActionToolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ViewTool from './tools/ViewTool';
import EditTool from './tools/EditTool';
import ConvertTool from './tools/ConvertTool';
import SplitTool from './tools/SplitTool';
import MergeTool from './tools/MergeTool';
import CompressTool from './tools/CompressTool';
import ScanTool from './tools/ScanTool';

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
      <CardContent className="flex flex-grow flex-col space-y-4 overflow-hidden">

        {activeMode === 'view' && (
          selectedFile ? <ViewTool file={selectedFile} /> : noFile('Select a PDF from the sidebar to view.')
        )}

        {activeMode === 'edit' && (
          selectedFile ? <EditTool file={selectedFile} /> : noFile('Select a PDF from the sidebar to edit.')
        )}

        {activeMode === 'convert' && (
          selectedFile ? <ConvertTool file={selectedFile} /> : noFile('Select a PDF from the sidebar to convert.')
        )}

        {activeMode === 'split' && (
          selectedFile ? <SplitTool file={selectedFile} /> : noFile('Select a PDF from the sidebar to split.')
        )}

        {activeMode === 'merge' && <MergeTool />}

        {activeMode === 'scan' && <ScanTool />}

        {activeMode === 'compress' && (
          selectedFile ? <CompressTool file={selectedFile} /> : noFile('Select a PDF from the sidebar to compress.')
        )}

      </CardContent>
    </Card>
  );
};

export default Workspace;
