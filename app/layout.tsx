import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/providers/AuthProvider';
import QueryProvider from '@/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'Claritiy Voice Platform | Visual Voice AI Agent Orchestration',
  description: 'Enterprise no-code visual constructor for building, managing, and tracking production conversational Voice AI agents.',
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
