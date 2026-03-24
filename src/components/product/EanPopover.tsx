'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface EanPopoverProps {
  ean: string;
  colorName: string;
  size: string;
  priceCents: number;
  showPrices: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
}

export function EanPopover({
  ean,
  colorName,
  size,
  priceCents,
  showPrices,
  anchorRect,
  onClose,
}: EanPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ean);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = ean;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [ean]);

  if (!anchorRect) return null;

  // Position below the anchor, centered
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 8,
    left: anchorRect.left + anchorRect.width / 2,
    transform: 'translateX(-50%)',
    zIndex: 50,
  };

  return (
    <div ref={ref} style={style} className="animate-in fade-in duration-150">
      <div className="bg-gray-900 text-white rounded-lg px-3.5 py-2.5 shadow-xl min-w-[200px]">
        {/* Arrow */}
        <div
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45"
        />

        {/* Content */}
        <div className="relative">
          <div className="font-semibold text-sm">
            {colorName} — {size}
          </div>

          {showPrices && priceCents > 0 && (
            <div className="text-gray-400 text-xs mt-0.5">
              € {(priceCents / 100).toFixed(2).replace('.', ',')}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <code className="bg-gray-800 rounded px-2 py-1 text-xs font-mono flex-1">
              {ean}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded p-1 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title={copied ? 'Gekopieerd!' : 'Kopieer EAN'}
              aria-label="Kopieer EAN naar klembord"
            >
              {copied ? (
                <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
