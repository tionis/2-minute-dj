import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageProvider';
import { ClientGameProvider } from '@/components/ClientGameProvider';

export const metadata: Metadata = {
  title: '2-Minute DJ',
  description: 'The high-energy music party game.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ClientGameProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ClientGameProvider>
      </body>
    </html>
  );
}
