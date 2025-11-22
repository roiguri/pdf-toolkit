// src/services/storage.ts
import { storage } from '@/lib/firebase';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_PATH = 'uploads';

// Uploads a PDF file to Firebase Storage
export const uploadPdfFile = async (
  userId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ storageRef: string; downloadURL: string }> => {
  const fileId = uuidv4();
  const filePath = `${UPLOADS_PATH}/${userId}/${fileId}_${file.name}`;
  const fileRef = ref(storage, filePath);

  const uploadTask = uploadBytesResumable(fileRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress && onProgress(progress);
      },
      (error) => {
        console.error('Upload failed:', error);
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ storageRef: filePath, downloadURL });
      }
    );
  });
};

// Deletes a PDF file from Firebase Storage
export const deletePdfFile = async (storageRefPath: string) => {
  const fileRef = ref(storage, storageRefPath);
  await deleteObject(fileRef);
};

// Gets the download URL for a file (though uploadPdfFile already returns it)
export const getFileDownloadUrl = async (storageRefPath: string): Promise<string> => {
  const fileRef = ref(storage, storageRefPath);
  return await getDownloadURL(fileRef);
};
