// src/components/auth/ProtectedRoute.tsx
'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { Spinner } from '@/components/ui/spinner'; // Assuming a spinner component will be made

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/'); // Redirect to login page if not authenticated
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner /> {/* Placeholder for a spinner component */}
      </div>
    );
  }

  if (!currentUser) {
    return null; // Or a message indicating redirecting
  }

  return <>{children}</>;
};

export default ProtectedRoute;
