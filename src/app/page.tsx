// src/app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const { currentUser, loading, signInWithGoogle, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { t } = useTranslation('auth');

  useEffect(() => {
    if (!loading && currentUser) {
      router.push('/dashboard');
    }
  }, [currentUser, loading, router]);

  const handleAuthError = (error: unknown) => {
    if (error instanceof FirebaseError && (
      error.code === 'auth/blocking-function-error' ||
      (error.code === 'auth/internal-error' && error.message.includes('not invited'))
    )) {
      toast.error(t('errors.notInvited'));
    } else if (error instanceof FirebaseError && error.code === 'auth/wrong-password') {
      toast.error(t('errors.wrongPassword'));
    } else if (error instanceof FirebaseError && error.code === 'auth/user-not-found') {
      toast.error(t('errors.userNotFound'));
    } else if (error instanceof FirebaseError && error.code === 'auth/popup-closed-by-user') {
      // User dismissed the popup — no toast needed
    } else {
      toast.error(t('errors.signInFailed'));
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t('errors.missingFields'));
      return;
    }
    setIsSigningIn(true);
    try {
      await signIn(email, password);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading || currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{t('signIn')}</CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isSigningIn}>
            {isSigningIn ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {t('signInWithGoogle')}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('orContinueWith')}
              </span>
            </div>
          </div>
          <form onSubmit={handleEmailSignIn} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSigningIn}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSigningIn}
              />
            </div>
            <Button className="w-full" type="submit" disabled={isSigningIn}>
              {isSigningIn && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('signIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
