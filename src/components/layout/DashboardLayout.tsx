// src/components/layout/DashboardLayout.tsx
'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/auth/AuthProvider';
import { ModeToggle } from './ModeToggle';
import { FileText, Settings, LogOut, User, Calendar, Mail, Trash2, ArrowLeft, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
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
import { useAppStore } from '@/store/useAppStore';
import { deletePdfFile } from '@/services/storage';
import { deleteFileMetadata } from '@/services/firestore';

type MenuView = 'main' | 'profile' | 'settings';

interface DashboardLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
}

const DashboardLayout = ({ sidebar, main }: DashboardLayoutProps) => {
  const { currentUser, logout, updateDisplayName } = useAuth();
  const { files, reset } = useAppStore();
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const formatDate = (date: string | undefined) => {
    if (!date) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  const handleClearAllData = async () => {
    try {
      // Delete all PDF files from Firebase
      if (currentUser?.uid && files.length > 0) {
        await Promise.all(
          files.map(async (file) => {
            await deletePdfFile(file.storageRef);
            await deleteFileMetadata(currentUser.uid, file.id);
          })
        );
      }

      // Reset app state
      reset();

      // Clear browser storage
      localStorage.clear();
      sessionStorage.clear();

      toast.success('All data cleared successfully');
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast.error('Failed to clear some data');
    }
  };

  const handleStartEditName = () => {
    setEditedName(currentUser?.displayName || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    try {
      await updateDisplayName(editedName.trim());
      toast.success('Display name updated');
      setIsEditingName(false);
    } catch {
      toast.error('Failed to update name');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const userMenuContent = (
    <DropdownMenu onOpenChange={(open) => !open && setMenuView('main')}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
          <Avatar>
            <AvatarImage src={currentUser?.photoURL || '/placeholder-user.jpg'} alt="User Avatar" />
            <AvatarFallback>{currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-56">
        {menuView === 'main' && (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{currentUser?.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {currentUser?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuView('profile'); }}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuView('settings'); }}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </>
        )}

        {menuView === 'profile' && (
          <>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuView('main'); setIsEditingName(false); }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Account Info</DropdownMenuLabel>
            <div className="px-2 py-1.5 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {isEditingName ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="h-6 text-sm py-0 px-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSaveName}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-muted-foreground">
                      {currentUser?.displayName || 'Not set'}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={handleStartEditName}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground truncate">
                  {currentUser?.email}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Joined {formatDate(currentUser?.metadata?.creationTime)}
                </span>
              </div>
            </div>
          </>
        )}

        {menuView === 'settings' && (
          <>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuView('main'); }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Storage</DropdownMenuLabel>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Clear All Data</span>
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your PDF files
                    {files.length > 0 ? ` (${files.length} file${files.length !== 1 ? 's' : ''})` : ''} and clear all local storage.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAllData}>
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen w-full flex-col sm:flex-row">
      {/* Sidebar Navigation - Fixed on Desktop, Top bar on Mobile */}
      <aside className="sm:fixed sm:inset-y-0 sm:left-0 sm:z-10 sm:flex sm:w-16 sm:flex-col sm:border-r bg-background sm:items-center sm:py-4">
        
        {/* Logo */}
        <nav className="flex sm:flex-col items-center gap-4 px-4 sm:px-0 w-full sm:w-auto justify-between sm:justify-start h-14 sm:h-auto border-b sm:border-0">
          <Link
            href="/dashboard"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-10 md:w-10 md:text-base transition-colors hover:bg-primary/90"
          >
            <FileText className="h-5 w-5 transition-all group-hover:scale-110" />
            <span className="sr-only">PDF Toolkit</span>
          </Link>

          {/* Mobile Only: Right side controls */}
          <div className="flex items-center gap-2 sm:hidden">
            <ModeToggle side="bottom" align="start" />
            {userMenuContent}
          </div>
        </nav>

        {/* Desktop Only: Bottom Controls */}
        <nav className="mt-auto hidden flex-col items-center gap-4 px-2 sm:flex py-4">
          <ModeToggle side="right" align="start" />
          {userMenuContent}
        </nav>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex flex-col sm:pl-16 w-full h-[calc(100vh-3.5rem)] sm:h-screen overflow-hidden">
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-6 md:gap-8 lg:grid-cols-3 xl:grid-cols-3 grid-cols-1 grid-rows-[auto_1fr] lg:grid-rows-1 overflow-y-auto">
          <div className="lg:col-span-1 order-1 lg:order-1">
             {/* Sidebar content (File Explorer) */}
            {sidebar}
          </div>
          <div className="lg:col-span-2 order-2 lg:order-2">
             {/* Main Workspace */}
            {main}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;