'use client';

import Link from 'next/link';
import { SearchInput } from '@/components/search/SearchInput';
import { LockButton } from '@/components/layout/LockButton';
import { NavBar } from '@/components/layout/NavBar';
import { MobileNav } from '@/components/layout/MobileNav';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { CategoryNode } from '@/types/product';

interface HeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
  categoryTree?: CategoryNode[];
  categoryCounts?: Record<string, number>;
  activeCategory?: string | null;
  onCategorySelect?: (code: string) => void;
}

export function Header({
  searchValue,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  categoryTree = [],
  categoryCounts,
  activeCategory,
  onCategorySelect,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    function handleScroll() {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 4);
          ticking.current = false;
        });
        ticking.current = true;
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCategorySelect = useCallback(
    (code: string) => {
      onCategorySelect?.(code);
    },
    [onCategorySelect],
  );

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-black transition-shadow duration-200 ${
          scrolled ? 'shadow-lg shadow-black/30' : ''
        }`}
      >
        {/* Row 1: Logo + Search + Lock */}
        <div className="h-20">
          <div className="mx-auto flex h-full max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            {/* Hamburger — mobile only */}
            {categoryTree.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="shrink-0 rounded-lg p-2 text-gray-400 hover:text-white transition-colors lg:hidden"
                aria-label="Menu openen"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            )}

            {/* Logo */}
            <Link href="/" className="shrink-0 transition-opacity hover:opacity-80">
              <img
                src="/logo-vankruiningen.png"
                alt="Van Kruiningen Reklame"
                className="h-10 sm:h-12 w-auto"
              />
            </Link>

            {/* Divider — desktop only */}
            <div className="hidden sm:block h-8 w-px bg-gray-700 shrink-0" />

            {/* Search — takes remaining space */}
            <div className="flex-1 min-w-0">
              <SearchInput
                value={searchValue}
                onChange={onSearchChange}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
                placeholder="Zoek producten..."
              />
            </div>

            {/* Lock button — always visible */}
            <div className="shrink-0">
              <LockButton />
            </div>
          </div>
        </div>

        {/* Row 2: NavBar — desktop only */}
        {categoryTree.length > 0 && (
          <NavBar
            tree={categoryTree}
            counts={categoryCounts}
            activeCategory={activeCategory}
            onCategorySelect={handleCategorySelect}
          />
        )}
      </header>

      {/* Mobile navigation drawer */}
      {categoryTree.length > 0 && (
        <MobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          tree={categoryTree}
          counts={categoryCounts}
          onCategorySelect={handleCategorySelect}
        />
      )}
    </>
  );
}
