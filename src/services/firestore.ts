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
  where,
  orderBy,
  onSnapshot,

  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { User as FirebaseAuthUser } from 'firebase/auth';

export interface FileMetadata {
  id: string; // Stored as document ID, but also good to have in data
  name: string;
  size: number;
  type: string; // "application/pdf"
  storageRef: string; // e.g., uploads/{uid}/{fileId}_originalName.pdf
  downloadURL: string;
  uploadedAt: Date;
  lastModified: Date;
  pageCount?: number; // Optional, calculated on upload
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
    uploadedAt: serverTimestamp(),
    lastModified: serverTimestamp(),
  });
  // Return the full metadata including the generated ID and server timestamps
  const newDoc = await getDoc(docRef);
  return { id: newDoc.id, ...(newDoc.data() as Omit<FileMetadata, 'id'>) };
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
  const q = query(userFilesCollectionRef, orderBy('uploadedAt', 'asc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const files: FileMetadata[] = [];
    snapshot.forEach((doc) => {
      files.push({ id: doc.id, ...(doc.data() as Omit<FileMetadata, 'id'>) });
    });
    callback(files);
  });

  return unsubscribe; // Return the unsubscribe function
};

// Update file metadata (e.g., pageCount)
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

// Delete file metadata
export const deleteFileMetadata = async (userId: string, fileId: string) => {
  const fileDocRef = doc(db, USERS_COLLECTION, userId, FILES_SUBCOLLECTION, fileId);
  await deleteDoc(fileDocRef);
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
