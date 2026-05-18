import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/layout/Footer';
import { ShowcaseAuthProvider } from '@/contexts/ShowcaseAuthContext';
import { ShowcasePinModal } from '@/components/layout/ShowcasePinModal';
import { FeedbackDrawerAuth } from '@/components/layout/FeedbackDrawerAuth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Workwear Showcase',
  description: 'Product catalogus voor werkkleding',
  icons: {
    icon: '/vk-logo-icon.png',
    apple: '/vk-logo-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://api.databiz.app" />
        {/*
         * Geen prefetch van search-index.json (1.2 MB Brotli) of model-cards
         * chunks — die concurreren op mobiel met de eerste model-cards download
         * en blokkeren parsing. Search-index laadt lazy bij eerste zoekactie
         * (SearchManager.loadIndex). Alleen de kleine meta + category-tree
         * preloaden.
         */}
        <link rel="preload" href="/data/model-cards-meta.json" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/data/category-tree.json" as="fetch" crossOrigin="anonymous" />

        <style>{`
          @keyframes page-load-progress {
            0%   { transform: translateX(-100%); }
            60%  { transform: translateX(-20%); }
            100% { transform: translateX(0%); }
          }
          @keyframes page-load-fade {
            0%   { opacity: 1; }
            100% { opacity: 0; }
          }
          .page-loading-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            z-index: 9999;
            overflow: hidden;
          }
          .page-loading-bar::after {
            content: '';
            display: block;
            height: 100%;
            background: #111827;
            animation: page-load-progress 8s ease-out forwards,
                       page-load-fade 0.4s ease 8s forwards;
          }
        `}</style>
      </head>
      <body
        className={`${inter.className} bg-white text-gray-900 min-h-screen flex flex-col`}
      >
        <div className="page-loading-bar" aria-hidden="true" />
        <ShowcaseAuthProvider>
          {/* Header is rendered per-page because it requires client state (search input) */}
          <main className="flex-1 pt-20 lg:pt-[128px]">{children}</main>
          <Footer />
          <ShowcasePinModal />
          <FeedbackDrawerAuth />
        </ShowcaseAuthProvider>
      </body>
    </html>
  );
}
