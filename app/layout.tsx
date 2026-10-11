import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import '@/components/fd/fd.css';
import './screens.css';
import { StoreProvider } from '@/lib/store';
import { MarketProvider } from '@/lib/market';
import { AppShell } from '@/components/AppShell';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'FundedDesk',
  description: 'Place, size and close trades inside your prop firm’s rules.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <StoreProvider>
          <MarketProvider>
            <AppShell>{children}</AppShell>
          </MarketProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
