// src/components/layout/DashboardLayout.tsx
'use client';

import React, { ReactNode } from 'react';
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
import { FileText, Settings, LogOut, HelpCircle, User } from 'lucide-react';

interface DashboardLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
}

const DashboardLayout = ({ sidebar, main }: DashboardLayoutProps) => {
  const { currentUser, logout } = useAuth();

  const UserMenu = () => (
    <DropdownMenu>
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
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{currentUser?.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <HelpCircle className="mr-2 h-4 w-4" />
          <span>Support</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
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
            <UserMenu />
          </div>
        </nav>

        {/* Desktop Only: Bottom Controls */}
        <nav className="mt-auto hidden flex-col items-center gap-4 px-2 sm:flex py-4">
          <ModeToggle side="right" align="start" />
          <UserMenu />
        </nav>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex flex-col sm:pl-16 w-full transition-all duration-300 ease-in-out">
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-6 md:gap-8 lg:grid-cols-3 xl:grid-cols-3 grid-cols-1">
          <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-1 order-2 lg:order-1">
             {/* Sidebar content (File Explorer) */}
            {sidebar}
          </div>
          <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2 order-1 lg:order-2">
             {/* Main Workspace */}
            {main}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;