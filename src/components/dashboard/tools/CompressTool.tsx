'use client';

import { FileMetadata } from '@/services/firestore';
import { useAppStore } from '@/store/useAppStore';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import CompressSidebar from '@/components/dashboard/CompressSidebar';
import { useTranslation } from 'react-i18next';

interface CompressToolProps {
  file: FileMetadata;
}

const CompressTool = ({ file }: CompressToolProps) => {
  const { annotations } = useAppStore();
  const { t } = useTranslation('tools');

  return (
    <div className="flex flex-col h-full space-y-4">
      <h3 className="text-lg font-semibold flex min-w-0">
        <span className="flex-shrink-0">{t('compress.title')}&nbsp;</span>
        <span className="truncate">{file.name}</span>
      </h3>
      <CompressSidebar />
      <div className="flex-1 min-h-0">
        <PDFViewer file={file} annotations={annotations} />
      </div>
    </div>
  );
};

export default CompressTool;
