// src/components/dashboard/FileExplorer.tsx
'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  addFileMetadata,
  FileMetadata,
  getUserFilesMetadata,
  updateFileMetadata,
  deleteFileMetadata,
  createFolder,
  renameFile,
  moveFile,
  deleteFolder,
} from '@/services/firestore';
import { uploadPdfFile, deletePdfFile } from '@/services/storage';
import { useAppStore } from '@/store/useAppStore';
import { getPageCount } from '@/lib/pdf-utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, FileText, Loader2, Folder, FolderPlus, MoreVertical, ArrowLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
    reset,
    currentFolderId,
    setCurrentFolderId,
  } = useAppStore();
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({}); // {fileName: progress}
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Dialog States
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<FileMetadata | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState<FileMetadata | null>(null);

  useEffect(() => {
    if (currentUser?.uid) {
      const unsubscribe = getUserFilesMetadata(currentUser.uid, (fetchedFiles) => {
        setFiles(fetchedFiles);
      });
      return () => unsubscribe();
    }
  }, [currentUser?.uid, setFiles]);

  const currentFolder = useMemo(() => {
    return files.find((f) => f.id === currentFolderId);
  }, [files, currentFolderId]);

  const filteredFiles = useMemo(() => {
    return files
      .filter((file) => {
        // Handle null vs undefined vs existing folderId
        const fileFolderId = file.folderId || null;
        return fileFolderId === currentFolderId;
      })
      .sort((a, b) => {
        // Folders first
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        // Then by name (case insensitive)
        return a.name.localeCompare(b.name);
      });
  }, [files, currentFolderId]);

  const availableFolders = useMemo(() => {
    return files.filter(
      (f) => f.type === 'folder' && f.id !== itemToMove?.id && f.id !== itemToMove?.folderId
    );
  }, [files, itemToMove]);

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
            folderId: currentFolderId, // Upload to current folder
          });

          // Update toast to success
          toast.success(`"${file.name}" uploaded successfully!`, { id: file.name });

          // If it's the first file, automatically select it (only if it's a file)
          if (!selectedFileId && files.filter(f => f.type === 'application/pdf').length === 0) {
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
    [currentUser, selectedFileId, files, setSelectedFileId, setFiles, currentFolderId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleCreateFolder = async () => {
    if (!currentUser?.uid || !newFolderName.trim()) return;
    try {
      await createFolder(currentUser.uid, newFolderName.trim(), currentFolderId);
      toast.success('Folder created successfully');
      setNewFolderName('');
      setIsNewFolderDialogOpen(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleRename = async () => {
    if (!currentUser?.uid || !itemToRename || !renameValue.trim()) return;
    try {
      await renameFile(currentUser.uid, itemToRename.id, renameValue.trim());
      toast.success('Renamed successfully');
      setIsRenameDialogOpen(false);
      setItemToRename(null);
      setRenameValue('');
    } catch (error) {
      console.error('Failed to rename:', error);
      toast.error('Failed to rename');
    }
  };

  const handleMove = async (targetId: string | null) => {
    if (!currentUser?.uid || !itemToMove) return;
    try {
      await moveFile(currentUser.uid, itemToMove.id, targetId);
      toast.success('Moved successfully');
      setIsMoveDialogOpen(false);
      setItemToMove(null);
    } catch (error) {
      console.error('Failed to move:', error);
      toast.error('Failed to move');
    }
  };

  const handleDeleteItem = async (item: FileMetadata) => {
    if (!currentUser?.uid) return;

    try {
      if (item.type === 'folder') {
        // Check if folder is empty
        const contents = files.filter((f) => f.folderId === item.id);
        if (contents.length > 0) {
            // Logic handled in component rendering for confirmation, but here we execute deletion
            // We need to delete contents too.
             await Promise.all(contents.map(async (child) => {
                 if (child.type === 'application/pdf' && child.storageRef) {
                     await deletePdfFile(child.storageRef);
                 }
                 await deleteFileMetadata(currentUser.uid!, child.id);
             }));
        }
        await deleteFolder(currentUser.uid, item.id);
      } else {
        // Delete PDF
        if (item.storageRef) {
          await deletePdfFile(item.storageRef);
        }
        await deleteFileMetadata(currentUser.uid, item.id);
      }

      toast.success(`"${item.name}" deleted successfully.`);

      // If the deleted file was selected, clear selection
      if (selectedFileId === item.id) {
        setSelectedFileId(null);
      }
      // If the deleted file was in merge selection, remove it
      removeFileFromMergeSelection(item.id);
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error(`Failed to delete "${item.name}".`);
    }
  };

  const handleDeleteAllFiles = async () => {
    if (!currentUser?.uid || files.length === 0) return;

    setIsDeletingAll(true);
    try {
      // Delete all files from Storage and Firestore
      // Note: This needs to be smarter with folders now, but for "Delete All" we can just wipe everything.
      await Promise.all(
        files.map(async (file) => {
          if (file.type === 'application/pdf' && file.storageRef) {
            await deletePdfFile(file.storageRef);
          }
          await deleteFileMetadata(currentUser.uid!, file.id);
        })
      );

      // Reset app state
      reset();
      toast.success('All files deleted successfully');
    } catch (error) {
      console.error('Failed to delete all files:', error);
      toast.error('Failed to delete some files');
    } finally {
      setIsDeletingAll(false);
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
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
            {currentFolderId && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentFolderId(currentFolder?.folderId || null)}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            )}
            <CardTitle>{currentFolder ? currentFolder.name : 'My PDFs'}</CardTitle>
        </div>

        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                onClick={() => setIsNewFolderDialogOpen(true)}
                title="New Folder"
            >
                <FolderPlus className="h-4 w-4" />
            </Button>
            {files.length > 0 && (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    disabled={isDeletingAll}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete all files?</AlertDialogTitle>
                    <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all {files.length} items from your account.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAllFiles}>
                    Delete All
                    </AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col space-y-4 overflow-hidden">
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
            <p className="px-4 text-center text-sm">Drop the PDFs here ...</p>
          ) : (
            <p className="px-4 text-center text-sm">Drag &apos;n&apos; drop PDFs here, or click to select</p>
          )}
        </div>

        {/* Upload progress indicators */}
        {Object.entries(uploadingFiles).map(([fileName, progress]) => (
          <div key={fileName} className="flex items-center space-x-2 text-sm text-muted-foreground min-w-0">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            <span className="truncate min-w-0">{fileName}</span>
            <span className="flex-shrink-0">{progress.toFixed(0)}%</span>
          </div>
        ))}


        {/* File List */}
        <div className="flex-grow overflow-y-auto rounded-md border p-2 max-h-[30vh] sm:max-h-none">
          {filteredFiles.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">
                {currentFolderId ? 'This folder is empty.' : 'No PDFs uploaded yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md p-3 transition-colors group',
                    selectedFileId === file.id ? 'bg-primary/10' : 'hover:bg-accent hover:text-accent-foreground',
                    activeMode === 'merge' && mergeSelection.includes(file.id) && 'bg-blue-100 dark:bg-blue-900',
                    activeMode !== 'merge' && 'cursor-pointer'
                  )}
                  onClick={() => {
                    if (file.type === 'folder') {
                        setCurrentFolderId(file.id);
                    } else if (activeMode === 'merge') {
                      toggleMergeSelection(file.id);
                    } else {
                      setSelectedFileId(file.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {activeMode === 'merge' && file.type !== 'folder' ? (
                      <Checkbox
                        checked={mergeSelection.includes(file.id)}
                        onCheckedChange={() => toggleMergeSelection(file.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 flex-shrink-0"
                      />
                    ) : (
                      file.type === 'folder' ?
                        <Folder className="h-5 w-5 flex-shrink-0 text-yellow-500" /> :
                        <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm">
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {file.pageCount && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {file.pageCount}p
                      </span>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setItemToRename(file);
                            setRenameValue(file.name);
                            setIsRenameDialogOpen(true);
                        }}>
                            Rename
                        </DropdownMenuItem>
                        {file.type !== 'folder' && (
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setItemToMove(file);
                                setIsMoveDialogOpen(true);
                            }}>
                                Move
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                    Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {file.type === 'folder' ? 'Folder' : 'File'}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {file.type === 'folder'
                                            ? `Are you sure you want to delete "${file.name}"? This will also delete all ${files.filter(f => f.folderId === file.id).length} files inside it.`
                                            : `Are you sure you want to delete "${file.name}"? This action cannot be undone.`
                                        }
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteItem(file)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>New Folder</DialogTitle>
                <DialogDescription>Enter a name for the new folder.</DialogDescription>
            </DialogHeader>
            <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder Name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            />
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Rename</DialogTitle>
            </DialogHeader>
            <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="New Name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
            />
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleRename} disabled={!renameValue.trim()}>Save</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Move to...</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                <Button
                    variant={itemToMove?.folderId === null ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => handleMove(null)}
                >
                    <Folder className="mr-2 h-4 w-4" /> Root
                </Button>
                {availableFolders.map((folder) => (
                    <Button
                        key={folder.id}
                        variant={itemToMove?.folderId === folder.id ? "secondary" : "ghost"}
                        className="justify-start"
                        onClick={() => handleMove(folder.id)}
                    >
                        <Folder className="mr-2 h-4 w-4" /> {folder.name}
                    </Button>
                ))}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>Cancel</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FileExplorer;
