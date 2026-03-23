'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { FileMetadata, saveUserSignature, subscribeToUserSignature, UserSignature } from '@/services/firestore';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { PDFViewer, PDFViewerHandle } from '@/components/pdf/PDFViewer';
import EditToolbar from '@/components/pdf/EditToolbar';
import SignatureModal from '@/components/pdf/SignatureModal';
import { embedAnnotationsInPdf } from '@/lib/pdf-utils';
import { usePdfPersistence } from '@/hooks/usePdfPersistence';

interface EditToolProps {
  file: FileMetadata;
}

const EditTool = ({ file }: EditToolProps) => {
  usePdfPersistence();

  const viewerRef = useRef<PDFViewerHandle>(null);
  const { currentUser } = useAuth();

  const {
    annotations,
    bookmarks,
    activeEditTool,
    selectedAnnotationId,
    selectedBookmarkId,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setSelectedAnnotationId,
    toggleBookmark,
    setSelectedBookmarkId,
  } = useAppStore();

  const [savedSignature, setSavedSignature] = useState<UserSignature | null>(null);
  const [pendingSignaturePosition, setPendingSignaturePosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingSignaturePage, setPendingSignaturePage] = useState<number | null>(null);
  const [includeHighlights, setIncludeHighlights] = useState(false);

  // Subscribe to user's saved signature
  useEffect(() => {
    if (currentUser?.uid) {
      const unsubscribe = subscribeToUserSignature(currentUser.uid, (signature) => {
        setSavedSignature(signature);
      });
      return () => unsubscribe();
    } else {
      setSavedSignature(null);
    }
  }, [currentUser]);

  const handleSignaturePlacementRequest = useCallback((position: { x: number; y: number }, page: number) => {
    setPendingSignaturePosition(position);
    setPendingSignaturePage(page);
  }, []);

  const handleSaveSignature = useCallback(async (
    signatureDataUrl: string,
    width: number,
    height: number,
    saveToProfile: boolean,
  ) => {
    if (!pendingSignaturePosition || pendingSignaturePage === null) return;

    const targetPage = pendingSignaturePage;
    const dimensions = viewerRef.current?.pagesDimensions[targetPage] || { width: 0, height: 0 };
    const scale = viewerRef.current?.scale ?? 1;

    if (dimensions.width === 0) {
      console.error('Missing dimensions for page', targetPage);
      return;
    }

    if (saveToProfile && currentUser) {
      try {
        await saveUserSignature(currentUser.uid, signatureDataUrl, width, height);
        toast.success('Signature saved to profile');
        setSavedSignature({ id: 'default', dataUrl: signatureDataUrl, width, height, updatedAt: new Date() });
      } catch (error) {
        console.error('Error saving signature:', error);
        toast.error('Failed to save signature to profile');
      }
    }

    const MAX_WIDTH = 120;
    const MAX_HEIGHT = 60;
    const aspectRatio = width / height;
    let targetWidth = MAX_WIDTH;
    let targetHeight = targetWidth / aspectRatio;
    if (targetHeight > MAX_HEIGHT) {
      targetHeight = MAX_HEIGHT;
      targetWidth = targetHeight * aspectRatio;
    }

    const unscaledWidth = dimensions.width / scale;
    const unscaledHeight = dimensions.height / scale;
    const relativeWidth = unscaledWidth > 0 ? targetWidth / unscaledWidth : 0.15;
    const relativeHeight = unscaledHeight > 0 ? targetHeight / unscaledHeight : 0.08;

    const centeredPosition = {
      x: pendingSignaturePosition.x - relativeWidth / 2,
      y: pendingSignaturePosition.y - relativeHeight / 2,
    };

    addAnnotation({
      id: crypto.randomUUID(),
      pageNumber: targetPage,
      type: 'signature',
      position: centeredPosition,
      content: signatureDataUrl,
      style: { width: relativeWidth, height: relativeHeight },
    });

    setPendingSignaturePosition(null);
    setPendingSignaturePage(null);
  }, [pendingSignaturePosition, pendingSignaturePage, addAnnotation, currentUser]);

  const handleExportWithAnnotations = useCallback(async () => {
    if (annotations.length === 0 && bookmarks.length === 0) {
      toast.info('No annotations or bookmarks to export');
      return;
    }

    try {
      toast.info('Exporting PDF...', { id: 'export-pdf' });

      const pagesDimensions = viewerRef.current?.pagesDimensions ?? {};
      const scale = viewerRef.current?.scale ?? 1;
      const firstPageDims = pagesDimensions[1] || Object.values(pagesDimensions)[0];

      if (!firstPageDims) throw new Error('Page dimensions not available');
      if (!file.downloadURL) throw new Error('File URL is missing');

      const unscaledDimensions = {
        width: firstPageDims.width / scale,
        height: firstPageDims.height / scale,
      };

      const filteredAnnotations = annotations.filter(a =>
        a.type === 'signature' || a.type === 'text' ||
        (includeHighlights && a.type === 'highlight')
      );

      const pdfBytes = await embedAnnotationsInPdf(
        file.downloadURL,
        filteredAnnotations,
        unscaledDimensions,
        bookmarks,
      );

      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name}_annotated.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF exported successfully!', { id: 'export-pdf' });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF with annotations', { id: 'export-pdf' });
    }
  }, [annotations, bookmarks, file, includeHighlights]);

  return (
    <>
      <PDFViewer
        ref={viewerRef}
        file={file}
        showConvertButton={false}
        isEditMode={true}
        activeEditTool={activeEditTool}
        annotations={annotations}
        selectedAnnotationId={selectedAnnotationId}
        bookmarks={bookmarks}
        selectedBookmarkId={selectedBookmarkId}
        onAnnotationAdd={addAnnotation}
        onAnnotationUpdate={updateAnnotation}
        onAnnotationDelete={deleteAnnotation}
        onAnnotationSelect={setSelectedAnnotationId}
        onBookmarkToggle={toggleBookmark}
        onBookmarkSelect={setSelectedBookmarkId}
        onSignaturePlacementRequest={handleSignaturePlacementRequest}
        toolbarSlot={
          <EditToolbar
            onExport={handleExportWithAnnotations}
            includeHighlights={includeHighlights}
            setIncludeHighlights={setIncludeHighlights}
          />
        }
      />
      <SignatureModal
        isOpen={!!pendingSignaturePosition}
        onClose={() => {
          setPendingSignaturePosition(null);
          setPendingSignaturePage(null);
        }}
        onSave={handleSaveSignature}
        savedSignature={savedSignature}
      />
    </>
  );
};

export default EditTool;
