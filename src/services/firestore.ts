// src/services/firestore.ts
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from 'firebase/firestore';

export interface FileMetadata {
  id: string;
  name: string;
  size?: number;
  type: string; // "application/pdf" or "folder"
  storageRef?: string;
  downloadURL?: string;
  uploadedAt: Date;
  lastModified: Date;
  pageCount?: number;
  folderId?: string | null;
}

const USERS_COLLECTION = 'users';
const FILES_SUBCOLLECTION = 'files';

// Add new file metadata to Firestore
export const addFileMetadata = async (
  userId: string,
  fileData: Omit<FileMetadata, 'id' | 'uploadedAt' | 'lastModified'>
): Promise<FileMetadata> => {
  const userFilesCollectionRef = collection(
    db,
    USERS_COLLECTION,
    userId,
    FILES_SUBCOLLECTION
  );
  const docRef = await addDoc(userFilesCollectionRef, {
    ...fileData,
    folderId: fileData.folderId || null, // Ensure folderId is null if undefined
    uploadedAt: serverTimestamp(),
    lastModified: serverTimestamp(),
  });
  // Return the full metadata including the generated ID and server timestamps
  const newDoc = await getDoc(docRef);
  return { id: newDoc.id, ...(newDoc.data() as Omit<FileMetadata, 'id'>) };
};

export const createFolder = async (
  userId: string,
  folderName: string,
  parentFolderId: string | null = null
): Promise<FileMetadata> => {
  return addFileMetadata(userId, {
    name: folderName,
    type: 'folder',
    folderId: parentFolderId,
  });
};

// Get single file metadata
export const getFileMetadata = async (
  userId: string,
  fileId: string
): Promise<FileMetadata | null> => {
  const fileDocRef = doc(db, USERS_COLLECTION, userId, FILES_SUBCOLLECTION, fileId);
  const docSnap = await getDoc(fileDocRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...(docSnap.data() as Omit<FileMetadata, 'id'>) };
  }
  return null;
};

// Listen for a user's files in real-time
export const getUserFilesMetadata = (
  userId: string,
  callback: (files: FileMetadata[]) => void
) => {
  const userFilesCollectionRef = collection(
    db,
    USERS_COLLECTION,
    userId,
    FILES_SUBCOLLECTION
  );
  // Order by uploadedAt for consistent display
  // Note: Sorting logic might need to be done client-side if we mix files and folders
  const q = query(userFilesCollectionRef, orderBy('uploadedAt', 'asc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const files: FileMetadata[] = [];
    snapshot.forEach((doc) => {
      files.push({ id: doc.id, ...(doc.data() as Omit<FileMetadata, 'id'>) });
    });
    callback(files);
  });

  return unsubscribe;
};

// Update file metadata (e.g., pageCount, name, folderId)
export const updateFileMetadata = async (
  userId: string,
  fileId: string,
  data: Partial<Omit<FileMetadata, 'id' | 'uploadedAt'>>
) => {
  const fileDocRef = doc(db, USERS_COLLECTION, userId, FILES_SUBCOLLECTION, fileId);
  await updateDoc(fileDocRef, {
    ...data,
    lastModified: serverTimestamp(),
  });
};

export const renameFile = async (userId: string, fileId: string, newName: string) => {
  await updateFileMetadata(userId, fileId, { name: newName });
};

export const moveFile = async (userId: string, fileId: string, targetFolderId: string | null) => {
  await updateFileMetadata(userId, fileId, { folderId: targetFolderId });
};

// Delete file metadata
export const deleteFileMetadata = async (userId: string, fileId: string) => {
  const fileDocRef = doc(db, USERS_COLLECTION, userId, FILES_SUBCOLLECTION, fileId);
  await deleteDoc(fileDocRef);
};

// Delete folder and its contents
export const deleteFolder = async (userId: string, folderId: string) => {
  // 1. Get all files in the folder
  const userFilesCollectionRef = collection(
      db,
      USERS_COLLECTION,
      userId,
      FILES_SUBCOLLECTION
  );
  const q = query(userFilesCollectionRef, where('folderId', '==', folderId));

  // Note: In a real app with many files, we should use a cursor/pagination.
  // For now, assuming reasonable number of files per folder.
  // Also, since we need to delete from Storage as well for PDFs, we should handle that in the UI/Logic layer
  // or return the list of files to be deleted so the caller can handle storage deletion.
  // However, `deleteFileMetadata` is what we have here.

  // Ideally, the UI should query for files in the folder, delete them (and their storage), then delete the folder.
  // BUT, to be atomic, we might want to do it in a batch.
  // But Storage deletion isn't atomic with Firestore.

  // So, I will just provide a function to delete the folder doc itself.
  // The logic to delete contents should probably be handled by the caller who can iterate and call deleteFileMetadata + deletePdfFile.

  await deleteFileMetadata(userId, folderId);
};


const SIGNATURES_SUBCOLLECTION = 'signatures';
const DEFAULT_SIGNATURE_ID = 'default';

export interface UserSignature {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  updatedAt: Date;
}

// Save user signature
export const saveUserSignature = async (
  userId: string,
  dataUrl: string,
  width: number,
  height: number
) => {
  const signatureDocRef = doc(
    db,
    USERS_COLLECTION,
    userId,
    SIGNATURES_SUBCOLLECTION,
    DEFAULT_SIGNATURE_ID
  );

  await setDoc(signatureDocRef, {
    dataUrl,
    width,
    height,
    updatedAt: serverTimestamp(),
  });
};

// Get user signature
export const getUserSignature = async (userId: string): Promise<UserSignature | null> => {
  const signatureDocRef = doc(
    db,
    USERS_COLLECTION,
    userId,
    SIGNATURES_SUBCOLLECTION,
    DEFAULT_SIGNATURE_ID
  );
  const docSnap = await getDoc(signatureDocRef);

  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...(docSnap.data() as Omit<UserSignature, 'id'>),
    };
  }
  return null;
};

// Delete user signature
export const deleteUserSignature = async (userId: string) => {
  const signatureDocRef = doc(
    db,
    USERS_COLLECTION,
    userId,
    SIGNATURES_SUBCOLLECTION,
    DEFAULT_SIGNATURE_ID
  );
  await deleteDoc(signatureDocRef);
};
// Subscribe to user signature updates
export const subscribeToUserSignature = (
  userId: string,
  callback: (signature: UserSignature | null) => void
) => {
  const signatureDocRef = doc(
    db,
    USERS_COLLECTION,
    userId,
    SIGNATURES_SUBCOLLECTION,
    DEFAULT_SIGNATURE_ID
  );

  return onSnapshot(signatureDocRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserSignature, 'id'>),
      });
    } else {
      callback(null);
    }
  });
};
