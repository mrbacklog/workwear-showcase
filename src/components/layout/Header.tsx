import Link from 'next/link';
import { SearchInput } from '@/components/search/SearchInput';
import { LockButton } from '@/components/layout/LockButton';

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
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-gray-200">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 text-lg font-semibold text-gray-900">
          Workwear Showcase
        </Link>

        <div className="mx-8 w-full max-w-xl">
          <SearchInput
            value={searchValue}
            onChange={onSearchChange}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            placeholder="Zoek producten..."
          />
        </div>

        <div className="hidden shrink-0 sm:flex sm:w-40 sm:justify-end">
          <LockButton />
        </div>
      </div>
    </header>
  );
}
