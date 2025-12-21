import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { updateFileMetadata } from '@/services/firestore';
import { useAuth } from '@/components/auth/AuthProvider';

export const usePdfPersistence = () => {
  const { currentUser } = useAuth();
  const { selectedFileId, annotations, bookmarks, files } = useAppStore();

  // Use refs to track previous values to avoid unnecessary writes
  const prevAnnotationsRef = useRef(annotations);
  const prevBookmarksRef = useRef(bookmarks);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip first render to avoid saving initial state over existing data immediately
    // although `useAppStore` initializes empty, then sets from file.
    // We should wait until we have a selectedFileId and the data is "stable".
    // Actually, `useAppStore` sets state synchronously when file is selected.

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!currentUser || !selectedFileId) return;

    // Check if data actually changed
    const annotationsChanged = JSON.stringify(prevAnnotationsRef.current) !== JSON.stringify(annotations);
    const bookmarksChanged = JSON.stringify(prevBookmarksRef.current) !== JSON.stringify(bookmarks);

    if (!annotationsChanged && !bookmarksChanged) return;

    // Update refs
    prevAnnotationsRef.current = annotations;
    prevBookmarksRef.current = bookmarks;

    const saveToFirestore = async () => {
      try {
        await updateFileMetadata(currentUser.uid, selectedFileId, {
          annotations,
          bookmarks,
        });
        console.log('Saved annotations/bookmarks to Firestore');
      } catch (error) {
        console.error('Error saving PDF data:', error);
      }
    };

    // Debounce slightly to avoid rapid writes
    const timer = setTimeout(saveToFirestore, 1000);

    return () => clearTimeout(timer);
  }, [annotations, bookmarks, currentUser, selectedFileId]);
};
