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
import { LocaleToggle } from './LocaleToggle';
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
import { useTranslation } from 'react-i18next';

type MenuView = 'main' | 'profile' | 'settings';

interface DashboardLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
}

import { deleteUserSignature, subscribeToUserSignature, UserSignature } from '@/services/firestore';

const SignatureManager = ({ currentUser }: { currentUser: { uid: string } | null }) => {
  const [signature, setSignature] = useState<UserSignature | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation('settings');

  React.useEffect(() => {
    if (currentUser?.uid) {
      const unsubscribe = subscribeToUserSignature(currentUser.uid, (sig) => {
        setSignature(sig);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  const handleDelete = async () => {
    if (!currentUser?.uid) return;
    try {
      await deleteUserSignature(currentUser.uid);
      setSignature(null);
      toast.success(t('toasts.signatureDeleted'));
    } catch (error) {
      toast.error(t('toasts.signatureDeleteFailed'));
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground">{t('loadingSignature')}</div>;

  if (!signature) {
    return <div className="text-xs text-muted-foreground italic">{t('noSignature')}</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border rounded bg-white p-2 flex justify-center">
        <img
          src={signature.dataUrl}
          alt="Saved Signature"
          className="max-h-16 object-contain"
        />
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        className="w-full h-7 text-xs"
      >
        <Trash2 className="me-2 h-3 w-3" />
        {t('deleteSignature')}
      </Button>
    </div>
  );
};

const DashboardLayout = ({ sidebar, main }: DashboardLayoutProps) => {
  const { currentUser, logout, updateDisplayName } = useAuth();
  const { files, reset, locale } = useAppStore();
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const { t } = useTranslation('settings');

  const formatDate = (date: string | undefined) => {
    if (!date) return 'Unknown';
    return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
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
            if (file.storageRef) {
              await deletePdfFile(file.storageRef);
            }
            await deleteFileMetadata(currentUser.uid, file.id);
          })
        );
      }

      // Reset app state
      reset();

      // Clear browser storage (preserve locale preference)
      const savedLocale = localStorage.getItem('locale');
      localStorage.clear();
      sessionStorage.clear();
      if (savedLocale) localStorage.setItem('locale', savedLocale);

      toast.success(t('toasts.allDataCleared'));
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast.error(t('toasts.clearDataFailed'));
    }
  };

  const handleStartEditName = () => {
    setEditedName(currentUser?.displayName || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast.error(t('toasts.nameEmpty'));
      return;
    }
    try {
      await updateDisplayName(editedName.trim());
      toast.success(t('toasts.nameUpdated'));
      setIsEditingName(false);
    } catch {
      toast.error(t('toasts.nameUpdateFailed'));
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const filesInfo = files.length > 0
    ? t('clearAllConfirm.filesInfo', { count: files.length, count_plural: files.length })
    : '';

  const renderUserMenu = (side: "right" | "bottom" | "top" | "left", align: "end" | "start" | "center" = "end") => (
    <DropdownMenu onOpenChange={(open) => !open && setMenuView('main')}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
          <Avatar>
            <AvatarImage src={currentUser?.photoURL || '/placeholder-user.jpg'} alt="User Avatar" referrerPolicy="no-referrer" />
            <AvatarFallback>{currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-56">
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
              <User className="me-2 h-4 w-4" />
              <span>{t('profile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuView('settings'); }}>
              <Settings className="me-2 h-4 w-4" />
              <span>{t('settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="me-2 h-4 w-4" />
              <span>{t('logout')}</span>
            </DropdownMenuItem>
          </>
        )}

        {menuView === 'profile' && (
          <>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuView('main'); setIsEditingName(false); }}>
              <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
              <span>{t('back')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('accountInfo')}</DropdownMenuLabel>
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
                      {currentUser?.displayName || t('notSet')}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ms-auto" onClick={handleStartEditName}>
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
                  {t('joined', { date: formatDate(currentUser?.metadata?.creationTime) })}
                </span>
              </div>
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('savedSignature')}</DropdownMenuLabel>
            <div className="px-2 py-1.5">
              <SignatureManager currentUser={currentUser} />
            </div>
          </>
        )}

        {menuView === 'settings' && (
          <>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuView('main'); }}>
              <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
              <span>{t('back')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('storage')}</DropdownMenuLabel>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                  <Trash2 className="me-2 h-4 w-4" />
                  <span>{t('clearAllData')}</span>
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('clearAllConfirm.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('clearAllConfirm.description', { filesInfo })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel', { ns: 'common' })}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAllData}>
                    {t('clearAllConfirm.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu >
  );

  return (
    <div className="flex min-h-dvh w-full flex-col sm:flex-row">
      {/* Sidebar Navigation - Fixed on Desktop, Top bar on Mobile */}
      <aside className="sm:fixed sm:inset-y-0 sm:start-0 sm:z-10 sm:flex sm:w-16 sm:flex-col sm:border-e bg-background sm:items-center sm:py-4">

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
            <LocaleToggle side="bottom" align="end" />
            <ModeToggle side="bottom" align="end" />
            {renderUserMenu("bottom", "end")}
          </div>
        </nav>

        {/* Desktop Only: Bottom Controls */}
        <nav className="mt-auto hidden flex-col items-center gap-4 px-2 sm:flex py-4">
          <LocaleToggle side="left" align="end" />
          <ModeToggle side="left" align="end" />
          {renderUserMenu("right", "end")}
        </nav>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex flex-col sm:ps-16 w-full h-[calc(100dvh-3.5rem)] sm:h-dvh overflow-hidden">
        {/* Below lg the panes stack and this scrolls; at lg it becomes a two-column
            split where each pane scrolls internally instead. */}
        <main className="grid flex-1 gap-4 p-4 sm:px-6 sm:py-6 md:gap-8 lg:grid-cols-3 xl:grid-cols-3 grid-cols-1 grid-rows-[auto_auto] lg:grid-rows-1 overflow-y-auto lg:overflow-hidden">
          <div className="lg:col-span-1 order-1 lg:order-1 lg:h-full">
            {/* Sidebar content (File Explorer) */}
            {sidebar}
          </div>
          {/* Stacked rows are content-sized; the viewer guarantees its own page
              height by aspect ratio, so nothing is forced from up here. */}
          <div className="lg:col-span-2 order-2 lg:order-2 lg:h-full">
            {/* Main Workspace */}
            {main}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
