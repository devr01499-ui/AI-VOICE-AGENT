import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/providers/AuthProvider';
import QueryProvider from '@/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'Clarity Voice AI - Automated HR Screening Arena',
  description: 'Production Telephony MVP for low-latency automated HR candidate screening.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground flex flex-col font-sans" suppressHydrationWarning>
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
