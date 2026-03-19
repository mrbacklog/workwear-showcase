import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/layout/Footer';
import { ShowcaseAuthProvider } from '@/contexts/ShowcaseAuthContext';
import { ShowcasePinModal } from '@/components/layout/ShowcasePinModal';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Workwear Showcase',
  description: 'Product catalogus voor werkkleding',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <head>
        <link rel="preload" href="/data/search-index.json" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/data/model-cards-meta.json" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/data/category-tree.json" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/data/sprite-map.json" as="fetch" crossOrigin="anonymous" />
      </head>
      <body
        className={`${inter.className} bg-white text-gray-900 min-h-screen flex flex-col`}
      >
        <ShowcaseAuthProvider>
          {/* Header is rendered per-page because it requires client state (search input) */}
          <main className="flex-1 pt-16">{children}</main>
          <Footer />
          <ShowcasePinModal />
        </ShowcaseAuthProvider>
      </body>
    </html>
  );
}
