// src/components/dashboard/FileExplorer.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/components/auth/AuthProvider';
import { addFileMetadata, FileMetadata, getUserFilesMetadata, updateFileMetadata, deleteFileMetadata } from '@/services/firestore';
import { uploadPdfFile, deletePdfFile } from '@/services/storage';
import { useAppStore } from '@/store/useAppStore';
import { getPageCount } from '@/lib/pdf-utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, FileText, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const FileExplorer = () => {
  const { currentUser } = useAuth();
  const {
    files,
    setFiles,
    selectedFileId,
    setSelectedFileId,
    activeMode,
    mergeSelection,
    addFileToMergeSelection,
    removeFileFromMergeSelection,
    clearMergeSelection,
  } = useAppStore();
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({}); // {fileName: progress}

  useEffect(() => {
    if (currentUser?.uid) {
      const unsubscribe = getUserFilesMetadata(currentUser.uid, (fetchedFiles) => {
        setFiles(fetchedFiles);
      });
      return () => unsubscribe();
    }
  }, [currentUser?.uid, setFiles]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!currentUser?.uid) {
        toast.error('You must be logged in to upload files.');
        return;
      }
      for (const file of acceptedFiles) {
        if (file.type !== 'application/pdf') {
          toast.error(`File "${file.name}" is not a PDF and will be skipped.`);
          continue;
        }

        setUploadingFiles((prev) => ({ ...prev, [file.name]: 0 }));
        toast.info(`Uploading "${file.name}"...`, { id: file.name, duration: 999999 });

        try {
          const { storageRef, downloadURL } = await uploadPdfFile(
            currentUser.uid,
            file,
            (progress) => {
              setUploadingFiles((prev) => ({ ...prev, [file.name]: progress }));
              toast.info(`Uploading "${file.name}": ${progress.toFixed(0)}%`, { id: file.name, duration: 999999 });
            }
          );

          // Get page count
          let pageCount;
          try {
            const arrayBuffer = await file.arrayBuffer();
            pageCount = await getPageCount(arrayBuffer);
          } catch (pageCountError) {
            console.error('Failed to get page count:', pageCountError);
            toast.warning(`Could not determine page count for "${file.name}".`);
          }

          const metadata = await addFileMetadata(currentUser.uid, {
            name: file.name,
            size: file.size,
            type: file.type,
            storageRef,
            downloadURL,
            pageCount,
          });

          // Update toast to success
          toast.success(`"${file.name}" uploaded successfully!`, { id: file.name });

          // If it's the first file, automatically select it
          if (!selectedFileId && files.length === 0) {
            setSelectedFileId(metadata.id);
          }
        } catch (error) {
          console.error('Upload failed for', file.name, error);
          toast.error(`Failed to upload "${file.name}".`, { id: file.name });
        } finally {
          setUploadingFiles((prev) => {
            const newState = { ...prev };
            delete newState[file.name];
            return newState;
          });
        }
      }
    },
    [currentUser, selectedFileId, files.length, setSelectedFileId, setFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleDeleteFile = async (file: FileMetadata) => {
    if (!currentUser?.uid) return;

    try {
      // 1. Delete from Firebase Storage
      await deletePdfFile(file.storageRef);
      // 2. Delete from Firestore
      await deleteFileMetadata(currentUser.uid, file.id);

      toast.success(`"${file.name}" deleted successfully.`);

      // If the deleted file was selected, clear selection
      if (selectedFileId === file.id) {
        setSelectedFileId(null);
      }
      // If the deleted file was in merge selection, remove it
      removeFileFromMergeSelection(file.id);
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error(`Failed to delete "${file.name}".`);
    }
  };

  const toggleMergeSelection = (fileId: string) => {
    if (mergeSelection.includes(fileId)) {
      removeFileFromMergeSelection(fileId);
    } else {
      addFileToMergeSelection(fileId);
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>My PDFs</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col space-y-4">
        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={cn(
            'flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors',
            isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          )}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop the PDFs here ...</p>
          ) : (
            <p>Drag 'n' drop some PDFs here, or click to select files</p>
          )}
        </div>

        {/* Upload progress indicators */}
        {Object.entries(uploadingFiles).map(([fileName, progress]) => (
          <div key={fileName} className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{fileName}: {progress.toFixed(0)}%</span>
          </div>
        ))}


        {/* File List */}
        <ScrollArea className="flex-grow rounded-md border p-2">
          {files.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">No PDFs uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    'flex items-center justify-between rounded-md p-3 transition-colors',
                    selectedFileId === file.id ? 'bg-primary/10' : 'hover:bg-accent hover:text-accent-foreground',
                    activeMode === 'merge' && mergeSelection.includes(file.id) && 'bg-blue-100 dark:bg-blue-900',
                    activeMode !== 'merge' && 'cursor-pointer'
                  )}
                  onClick={() => {
                    if (activeMode === 'merge') {
                      toggleMergeSelection(file.id);
                    } else {
                      setSelectedFileId(file.id);
                    }
                  }}
                >
                  <div className="flex items-center space-x-2">
                    {/* Show Checkbox in merge mode, FileText icon otherwise */}
                    {activeMode === 'merge' ? (
                      <Checkbox
                        checked={mergeSelection.includes(file.id)}
                        onCheckedChange={() => toggleMergeSelection(file.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5"
                      />
                    ) : (
                      <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate text-sm">
                      {file.name}
                      {file.pageCount && <span className="ml-2 text-xs text-muted-foreground">({file.pageCount} pages)</span>}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your PDF
                            file &quot;{file.name}&quot; from our servers.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteFile(file)}>
                            Continue
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FileExplorer;
