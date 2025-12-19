// src/components/dashboard/FileExplorer.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/components/auth/AuthProvider';
import { addFileMetadata, FileMetadata, getUserFilesMetadata, updateFileMetadata, deleteFileMetadata, createFolder, renameFileMetadata, moveFile } from '@/services/firestore';
import { uploadPdfFile, deletePdfFile } from '@/services/storage';
import { useAppStore } from '@/store/useAppStore';
import { getPageCount } from '@/lib/pdf-utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, FileText, Loader2, Folder, MoreVertical, Edit, Move, FolderPlus, ArrowLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // For Move Dialog

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

// Helper Dialogs
const CreateFolderDialog = ({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) => {
  const [name, setName] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>Enter a name for the new folder.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  onCreate(name);
                  setName('');
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (name.trim()) {
                onCreate(name);
                setName('');
              }
            }}
            disabled={!name.trim()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RenameDialog = ({
  open,
  onOpenChange,
  onRename,
  initialName,
  type,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (newName: string) => void;
  initialName: string;
  type: 'file' | 'folder';
}) => {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rename-input" className="text-right">
              Name
            </Label>
            <Input
              id="rename-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  onRename(name);
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (name.trim()) {
                onRename(name);
              }
            }}
            disabled={!name.trim() || name === initialName}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MoveDialog = ({
  open,
  onOpenChange,
  onMove,
  folders,
  currentFolderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (targetFolderId: string | null) => void;
  folders: FileMetadata[];
  currentFolderId: string | null;
}) => {
  const [targetId, setTargetId] = useState<string | null>(currentFolderId || 'root');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move File</DialogTitle>
          <DialogDescription>Select a destination folder.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[300px] overflow-y-auto">
          <RadioGroup value={targetId ?? 'root'} onValueChange={(v) => setTargetId(v === 'root' ? null : v)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="root" id="r-root" disabled={currentFolderId === null} />
              <Label htmlFor="r-root" className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" /> <span>My PDFs (Root)</span>
              </Label>
            </div>
            {folders.map(f => (
              <div key={f.id} className="flex items-center space-x-2 ml-4">
                <RadioGroupItem value={f.id} id={`r-${f.id}`} disabled={currentFolderId === f.id} />
                <Label htmlFor={`r-${f.id}`} className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-blue-500" /> <span>{f.name}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={() => onMove(targetId === 'root' ? null : targetId)}
            disabled={targetId === (currentFolderId || 'root')}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
    setCurrentFolderId
  } = useAppStore();
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({}); // {fileName: progress}
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Dialog states
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [itemToRename, setItemToRename] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [fileToMove, setFileToMove] = useState<FileMetadata | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FileMetadata | null>(null);

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
            folderId: currentFolderId, // Add to current folder
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
    [currentUser, selectedFileId, files.length, setSelectedFileId, setFiles, currentFolderId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleDeleteFile = async (file: FileMetadata) => {
    if (!currentUser?.uid) return;

    try {
      if (file.type === 'folder') {
        // Recursive delete logic would go here if we were doing it clientside
        // But for now, we'll just check if empty
        const filesInFolder = files.filter(f => f.folderId === file.id);
        if (filesInFolder.length > 0) {
          // This case is handled by the specific delete dialog logic below
        }
        await deleteFileMetadata(currentUser.uid, file.id);
      } else {
        // 1. Delete from Firebase Storage (only if it has one)
        if (file.storageRef) {
          await deletePdfFile(file.storageRef);
        }
        // 2. Delete from Firestore
        await deleteFileMetadata(currentUser.uid, file.id);
      }

      toast.success(`"${file.name}" deleted successfully.`);

      if (selectedFileId === file.id) {
        setSelectedFileId(null);
      }
      removeFileFromMergeSelection(file.id);
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error(`Failed to delete "${file.name}".`);
    }
  };

  const handleRecursiveDelete = async (folder: FileMetadata) => {
    if (!currentUser?.uid) return;
    try {
      const filesInFolder = files.filter(f => f.folderId === folder.id);

      // Delete all files inside
      await Promise.all(filesInFolder.map(async (file) => {
        if (file.storageRef) await deletePdfFile(file.storageRef);
        await deleteFileMetadata(currentUser.uid!, file.id);
      }));

      // Delete the folder itself
      await deleteFileMetadata(currentUser.uid, folder.id);
      toast.success(`Folder "${folder.name}" and contents deleted.`);
    } catch (error) {
      console.error("Recursive delete error", error);
      toast.error("Failed to delete folder and contents.");
    }
  };

  const handleDeleteAllFiles = async () => {
    if (!currentUser?.uid || files.length === 0) return;

    setIsDeletingAll(true);
    try {
      await Promise.all(
        files.map(async (file) => {
          if (file.storageRef) await deletePdfFile(file.storageRef);
          await deleteFileMetadata(currentUser.uid!, file.id);
        })
      );

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

  // Filtering and Sorting
  const filteredFiles = files.filter(f => {
    if (currentFolderId) {
      return f.folderId === currentFolderId;
    }
    return !f.folderId; // Root items
  }).sort((a, b) => {
    // Folders first
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  const currentFolder = currentFolderId ? files.find(f => f.id === currentFolderId) : null;
  const folders = files.filter(f => f.type === 'folder');

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {currentFolderId && (
            <Button variant="ghost" size="icon" onClick={() => setCurrentFolderId(null)} title="Back to Root">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <CardTitle>{currentFolder ? currentFolder.name : 'My PDFs'}</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {!currentFolderId && ( // Only allow folder creation at root (single level)
            <Button variant="outline" size="sm" onClick={() => setIsCreatingFolder(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />
              New Folder
            </Button>
          )}
          {files.length > 0 && !currentFolderId && ( // Delete All only at root
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
              {currentFolderId ? 'Folder is empty.' : 'No PDFs uploaded yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md p-3 transition-colors',
                    selectedFileId === file.id ? 'bg-primary/10' : 'hover:bg-accent hover:text-accent-foreground',
                    activeMode === 'merge' && mergeSelection.includes(file.id) && 'bg-blue-100 dark:bg-blue-900',
                    activeMode !== 'merge' && 'cursor-pointer'
                  )}
                  onClick={() => {
                    if (file.type === 'folder') {
                      setCurrentFolderId(file.id);
                      return;
                    }
                    if (activeMode === 'merge') {
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
                      file.type === 'folder' ? <Folder className="h-5 w-5 flex-shrink-0 text-blue-500 fill-blue-100" /> : <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-medium">
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {file.type !== 'folder' && file.pageCount && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap mr-2">
                        {file.pageCount}p
                      </span>
                    )}

                    {file.type !== 'folder' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 md:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(file);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToRename({ id: file.id, name: file.name, type: file.type as 'file' | 'folder' }); }}>
                          <Edit className="mr-2 h-4 w-4" /> Rename
                        </DropdownMenuItem>
                        {file.type !== 'folder' && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setFileToMove(file); }}>
                            <Move className="mr-2 h-4 w-4" /> Move
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(file);
                          }}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CreateFolderDialog
        open={isCreatingFolder}
        onOpenChange={setIsCreatingFolder}
        onCreate={async (name) => {
          if (currentUser) {
            await createFolder(currentUser.uid, name, currentFolderId);
            toast.success('Folder created');
            setIsCreatingFolder(false);
          }
        }}
      />

      {itemToRename && (
        <RenameDialog
          open={!!itemToRename}
          onOpenChange={(open) => !open && setItemToRename(null)}
          initialName={itemToRename.name}
          type={itemToRename.type}
          onRename={async (newName) => {
            if (currentUser && itemToRename) {
              await renameFileMetadata(currentUser.uid, itemToRename.id, newName);
              toast.success('Renamed successfully');
              setItemToRename(null);
            }
          }}
        />
      )}

      {fileToMove && (
        <MoveDialog
          open={!!fileToMove}
          onOpenChange={(open) => !open && setFileToMove(null)}
          folders={folders}
          currentFolderId={fileToMove.folderId || null}
          onMove={async (targetId) => {
            if (currentUser && fileToMove) {
              await moveFile(currentUser.uid, fileToMove.id, targetId);
              toast.success('File moved');
              setFileToMove(null);
            }
          }}
        />
      )}

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemToDelete?.type === 'folder' ? 'Delete folder?' : 'Delete file?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'folder'
                ? `Permanently delete folder "${itemToDelete.name}" and all ${files.filter(f => f.folderId === itemToDelete.id).length} items inside?`
                : `Permanently delete "${itemToDelete?.name}"?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (itemToDelete) {
                  if (itemToDelete.type === 'folder') {
                    handleRecursiveDelete(itemToDelete);
                  } else {
                    handleDeleteFile(itemToDelete);
                  }
                  setItemToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default FileExplorer;
