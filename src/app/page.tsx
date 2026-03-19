'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Homepage redirects to the search/browse page so users
 * immediately see all products.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/search/');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-400">Laden...</p>
    </div>
  );
}
