'use client';

import Link from 'next/link';
import { SearchInput } from '@/components/search/SearchInput';
import { LockButton } from '@/components/layout/LockButton';
import { useEffect, useRef, useState } from 'react';

interface HeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
}

export function Header({
  searchValue,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-14 bg-white transition-shadow duration-200 ${
        scrolled ? 'shadow-sm border-b border-gray-200' : 'border-b border-gray-100'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Logo / Brand */}
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-tight text-gray-900 hover:text-gray-600 transition-colors"
        >
          <span className="hidden sm:inline">Workwear Showcase</span>
          <span className="sm:hidden font-bold text-base">WW</span>
        </Link>

        {/* Divider — desktop only */}
        <div className="hidden sm:block h-5 w-px bg-gray-200 shrink-0" />

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
    </header>
  );
}
