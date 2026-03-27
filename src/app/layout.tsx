import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google'; // Keep Geist fonts
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { LocaleProvider } from '@/components/layout/LocaleProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PDF Toolkit',
  description: 'A web-based SaaS application for PDF management and manipulation.',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon-192x192.svg',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PDF Toolkit',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <LocaleProvider>
              {children}
              <Toaster />
              <ServiceWorkerRegistration />
            </LocaleProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
