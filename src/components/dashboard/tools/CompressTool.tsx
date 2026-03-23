'use client';

import { FileMetadata } from '@/services/firestore';
import { useAppStore } from '@/store/useAppStore';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import CompressSidebar from '@/components/dashboard/CompressSidebar';

interface CompressToolProps {
  file: FileMetadata;
}

const CompressTool = ({ file }: CompressToolProps) => {
  const { annotations } = useAppStore();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex min-w-0">
        <span className="flex-shrink-0">Compress PDF:&nbsp;</span>
        <span className="truncate">{file.name}</span>
      </h3>
      <CompressSidebar />
      <PDFViewer file={file} annotations={annotations} />
    </div>
  );
};

export default CompressTool;
