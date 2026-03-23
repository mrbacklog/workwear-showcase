'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { compareSizes } from '@/lib/size-sort';
import { Header } from '@/components/layout/Header';
import { ProductHeader } from '@/components/product/ProductHeader';
import { ChangeRequestButton } from '@/components/change-request/ChangeRequestButton';
import { ChangeRequestModal, WithdrawDialog } from '@/components/change-request/ChangeRequestModal';
import { PendingIndicator } from '@/components/change-request/PendingIndicator';
import { PinModal } from '@/components/change-request/PinModal';
import { ToastContainer } from '@/components/change-request/Toast';
import { useModelCards } from '@/hooks/useModelCards';
import { useChangeRequest } from '@/hooks/useChangeRequest';
import { usePendingRequests } from '@/hooks/usePendingRequests';
import { useCategoryTree } from '@/hooks/useCategoryTree';
import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';
import { useImageUrl } from '@/hooks/useImageUrl';
import { ProductImage } from '@/components/ui/ProductImage';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { ColorGroup, ShowcaseImage, ShowcaseModel } from '@/types/product';

// ---------------------------------------------------------------------------
// Product Gallery
// ---------------------------------------------------------------------------

function ProductGallery({
  images,
  modelName,
}: {
  images: ShowcaseImage[];
  modelName: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [fullLoaded, setFullLoaded] = useState(false);
  const { getOriginalImageUrl } = useImageUrl();

  // Reset fullLoaded when switching images
  useEffect(() => {
    setFullLoaded(false);
  }, [selectedIndex]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-50">
        <span className="text-gray-300">Geen afbeelding</span>
      </div>
    );
  }

  const mainImage = images[selectedIndex] ?? images[0];
  const originalUrl = getOriginalImageUrl(mainImage.ean, mainImage.sequenceNumber);

  return (
    <div className="space-y-3">
      {/* Main image: full-size from API with thumb placeholder */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-50">
        <ProductImage
          src={mainImage.thumb800Webp}
          alt={modelName}
          className={`h-full w-full object-contain transition-opacity duration-200 ${fullLoaded ? 'opacity-0' : 'opacity-100'}`}
          priority={true}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        {/* Full-size original from backend API */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={originalUrl}
          alt={modelName}
          className={`absolute inset-0 h-full w-full object-contain p-4 cursor-zoom-in transition-opacity duration-200 ${fullLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setFullLoaded(true)}
          onClick={() => setLightboxUrl(originalUrl)}
        />
        {/* Zoom icon */}
        <button
          type="button"
          onClick={() => setLightboxUrl(originalUrl)}
          className="absolute bottom-3 right-3 rounded-full bg-white/80 p-2 text-gray-600 shadow-sm hover:bg-white hover:text-gray-900 transition-colors"
          aria-label="Vergroot afbeelding"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={`${img.ean}-${img.sequenceNumber}`}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded border-2 transition-colors ${
                idx === selectedIndex
                  ? 'border-gray-900'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <ProductImage
                src={img.thumbWebp}
                alt={`${modelName} afbeelding ${idx + 1}`}
                className="h-full w-full object-contain"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <ImageLightbox
          src={lightboxUrl}
          alt={modelName}
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color Selector (swatch dots with hover preview)
// ---------------------------------------------------------------------------

function ColorSelector({
  colorGroups,
  selectedIndex,
  onSelect,
  onHover,
  hoveredIndex,
}: {
  colorGroups: ColorGroup[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
  hoveredIndex: number | null;
}) {
  if (colorGroups.length <= 1) return null;

  const displayIndex = hoveredIndex ?? selectedIndex;
  const displayGroup = colorGroups[displayIndex];

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-900">
        Kleur: {displayGroup?.colorRaw || displayGroup?.colorName}
      </h3>
      <div
        className="mt-2 flex items-center gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}
      >
        {colorGroups.map((cg, idx) => {
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={cg.colorCode || cg.colorRaw}
              type="button"
              onClick={() => onSelect(idx)}
              onMouseEnter={() => onHover(idx)}
              onMouseLeave={() => onHover(null)}
              title={cg.colorRaw || cg.colorName}
              className="shrink-0"
            >
              <ColorSwatch
                hexCode={cg.hexCode}
                secondaryHex={cg.secondaryHex}
                isActive={isSelected}
                size="md"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant Info Table (selected color only)
// ---------------------------------------------------------------------------

function VariantInfoTable({
  colorGroup,
  showPrices,
}: {
  colorGroup: ColorGroup;
  showPrices: boolean;
}) {
  const [showEan, setShowEan] = useState(false);

  const sortedVariants = useMemo(
    () => [...colorGroup.variants].sort((a, b) => compareSizes(a.sizeRaw, b.sizeRaw)),
    [colorGroup.variants],
  );

  if (colorGroup.variants.length === 0) {
    return <p className="text-sm text-gray-400">Geen maten beschikbaar</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          Maten &mdash; {colorGroup.colorRaw || colorGroup.colorName}
        </h3>
        <button
          type="button"
          onClick={() => setShowEan((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          {showEan ? 'Verberg EAN' : 'Toon EAN'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 pr-4 text-left font-medium text-gray-500">
                Maat
              </th>
              {showEan && (
                <th className="py-2 pr-4 text-left font-medium text-gray-500">
                  EAN
                </th>
              )}
              {showPrices && (
                <th className="py-2 text-right font-medium text-gray-500">
                  Prijs
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedVariants.map((v) => (
              <tr key={v.ean}>
                <td className="py-2 pr-4 font-medium text-gray-900">
                  {v.sizeDisplay || v.sizeRaw}
                </td>
                {showEan && (
                  <td className="py-2 pr-4 text-gray-500">{v.ean}</td>
                )}
                {showPrices && (
                  <td className="py-2 text-right text-gray-900">
                    {v.priceCents > 0
                      ? `\u20AC ${(v.priceCents / 100).toFixed(2).replace('.', ',')}`
                      : '\u2014'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color/Size Matrix (all colors x all sizes overview)
// ---------------------------------------------------------------------------

function ColorSizeMatrix({
  colorGroups,
  selectedColorIndex,
  onSelectColor,
  showPrices,
}: {
  colorGroups: ColorGroup[];
  selectedColorIndex: number;
  onSelectColor: (index: number) => void;
  showPrices: boolean;
}) {
  // Collect all unique sizes across all color groups, sorted
  const allSizes = useMemo(() => {
    const sizeSet = new Set<string>();
    for (const cg of colorGroups) {
      for (const v of cg.variants) {
        sizeSet.add(v.sizeDisplay || v.sizeRaw);
      }
    }
    return [...sizeSet].sort((a, b) => compareSizes(a, b));
  }, [colorGroups]);

  if (colorGroups.length === 0 || allSizes.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-gray-900">
        Kleur / Maat overzicht
      </h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-500">
                Kleur
              </th>
              {allSizes.map((size) => (
                <th
                  key={size}
                  className="px-2 py-2 text-center font-medium text-gray-500 whitespace-nowrap"
                >
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {colorGroups.map((cg, idx) => {
              const isActive = idx === selectedColorIndex;
              // Build a size -> variant lookup for this color group
              const sizeMap = new Map<string, number>();
              for (const v of cg.variants) {
                const key = v.sizeDisplay || v.sizeRaw;
                sizeMap.set(key, v.priceCents);
              }

              return (
                <tr
                  key={cg.colorCode || cg.colorRaw || idx}
                  onClick={() => onSelectColor(idx)}
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-gray-100 font-medium'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ColorSwatch
                        hexCode={cg.hexCode}
                        secondaryHex={cg.secondaryHex}
                        isActive={isActive}
                        size="sm"
                      />
                      <span className="text-gray-900 whitespace-nowrap">
                        {cg.colorRaw || cg.colorName}
                      </span>
                    </div>
                  </td>
                  {allSizes.map((size) => {
                    const priceCents = sizeMap.get(size);
                    const available = priceCents !== undefined;
                    return (
                      <td
                        key={size}
                        className={`px-2 py-2 text-center whitespace-nowrap ${
                          available ? 'text-gray-900' : 'text-gray-300'
                        }`}
                      >
                        {available
                          ? showPrices && priceCents > 0
                            ? `\u20AC ${(priceCents / 100).toFixed(2).replace('.', ',')}`
                            : '\u2713'
                          : '\u2014'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color Swatch (reusable)
// ---------------------------------------------------------------------------

function ColorSwatch({
  hexCode,
  secondaryHex,
  isActive,
  size = 'md',
  onClick,
}: {
  hexCode: string;
  secondaryHex?: string | null;
  isActive: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
}) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  const hex = hexCode || '#cccccc';

  const style: React.CSSProperties = secondaryHex
    ? { background: `linear-gradient(135deg, ${hex} 50%, ${secondaryHex} 50%)` }
    : { backgroundColor: hex };

  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={`inline-block shrink-0 rounded-full border-2 ${sizeClass} ${
        isActive
          ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-1'
          : 'border-gray-300'
      } ${onClick ? 'cursor-pointer hover:border-gray-500' : ''}`}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Product Attributes
// ---------------------------------------------------------------------------

function ProductAttributes({ model }: { model: ShowcaseModel }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-gray-900">
        Productinformatie
      </h3>
      {model.descriptionNl ? (
        <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
          {model.descriptionNl}
        </p>
      ) : model.shortDescriptionNl ? (
        <p className="text-sm leading-relaxed text-gray-600">
          {model.shortDescriptionNl}
        </p>
      ) : (
        <p className="text-sm text-gray-400">
          Geen productomschrijving beschikbaar.
        </p>
      )}

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Merk</dt>
          <dd className="font-medium text-gray-900">{model.brandName}</dd>
        </div>
        {model.modelCode && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Artikelnummer</dt>
            <dd className="font-medium text-gray-900">{model.modelCode}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-gray-500">Kleuren</dt>
          <dd className="font-medium text-gray-900">
            {model.colorGroups.length}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Varianten</dt>
          <dd className="font-medium text-gray-900">{model.variantCount}</dd>
        </div>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Detail Page Client
// ---------------------------------------------------------------------------

export default function ProductClient() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const { getBySlug, isLoading } = useModelCards();
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [hoveredColorIndex, setHoveredColorIndex] = useState<number | null>(null);
  const [headerSearch, setHeaderSearch] = useState('');

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/search/');
    }
  }, [router]);

  const pendingRequests = usePendingRequests();
  const changeRequest = useChangeRequest(pendingRequests);
  const { tree: categoryTree } = useCategoryTree();
  const { isUnlocked } = useShowcaseAuth();

  const model = getBySlug(slug);

  // Read initial color from URL query param (?color=RAW)
  // Priority: match colorRaw first (unique per model), then fallback to colorCode
  useEffect(() => {
    if (!model) return;
    const searchParams = new URLSearchParams(window.location.search);
    const colorParam = searchParams.get('color');
    if (colorParam) {
      // Try exact colorRaw match first (unique, preferred)
      let idx = model.colorGroups.findIndex((cg) => cg.colorRaw === colorParam);
      // Fallback to colorCode match (may not be unique, legacy support)
      if (idx < 0) {
        idx = model.colorGroups.findIndex((cg) => cg.colorCode === colorParam);
      }
      if (idx >= 0) setSelectedColorIndex(idx);
    }
  }, [model]);

  const handleSearchChange = useCallback((value: string) => {
    setHeaderSearch(value);
    if (value.trim()) {
      window.location.href = `/search/?q=${encodeURIComponent(value.trim())}`;
    }
  }, []);

  // Show hovered color group images when hovering, otherwise selected
  const displayColorIndex = hoveredColorIndex ?? selectedColorIndex;

  const currentImages = useMemo(() => {
    if (!model) return [];
    const cg = model.colorGroups[displayColorIndex];
    return cg?.images ?? [];
  }, [model, displayColorIndex]);

  const handleColorSelect = useCallback((index: number) => {
    setSelectedColorIndex(index);
  }, []);

  const handleColorHover = useCallback((index: number | null) => {
    setHoveredColorIndex(index);
  }, []);

  if (isLoading) {
    return (
      <>
        <Header searchValue={headerSearch} onSearchChange={handleSearchChange} categoryTree={categoryTree} />
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-6 w-32 rounded bg-gray-100" />
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div className="aspect-square rounded-lg bg-gray-100" />
              <div className="space-y-4">
                <div className="h-4 w-24 rounded bg-gray-100" />
                <div className="h-8 w-64 rounded bg-gray-100" />
                <div className="h-4 w-48 rounded bg-gray-100" />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!model) {
    return (
      <>
        <Header searchValue={headerSearch} onSearchChange={handleSearchChange} categoryTree={categoryTree} />
        <div className="mx-auto max-w-[1600px] px-4 py-24 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Product niet gevonden
          </h1>
          <p className="mt-2 text-gray-500">
            Het product &ldquo;{slug}&rdquo; bestaat niet of is niet meer beschikbaar.
          </p>
          <button onClick={handleBack} className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800">Terug naar catalogus</button>
        </div>
      </>
    );
  }

  const selectedColorGroup = model.colorGroups[selectedColorIndex] ?? model.colorGroups[0];
  const modelId = String(model.id);
  const pendingReq = pendingRequests.getPending(modelId);
  const isBusy =
    changeRequest.status === 'submitting' ||
    changeRequest.status === 'authenticating' ||
    changeRequest.status === 'withdrawing';

  return (
    <>
      <Header searchValue={headerSearch} onSearchChange={handleSearchChange} categoryTree={categoryTree} />

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <button onClick={handleBack} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Terug naar catalogus
        </button>

        {/* Product layout */}
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* Left: Gallery */}
          <ProductGallery
            images={currentImages}
            modelName={model.modelName || model.modelCode || ''}
          />

          {/* Right: Details */}
          <div className="space-y-6">
            <ProductHeader
              model={model}
              showBadge={isUnlocked}
              actionSlot={isUnlocked ? (
                <div className="flex items-center gap-2">
                  {pendingReq && <PendingIndicator request={pendingReq} />}
                  <ChangeRequestButton
                    pendingRequest={pendingReq}
                    isLoading={isBusy}
                    onRequestChange={() => changeRequest.startChangeRequest(modelId)}
                    onWithdraw={() => changeRequest.startWithdraw(modelId)}
                  />
                </div>
              ) : undefined}
            />

            <ColorSelector
              colorGroups={model.colorGroups}
              selectedIndex={selectedColorIndex}
              onSelect={handleColorSelect}
              onHover={handleColorHover}
              hoveredIndex={hoveredColorIndex}
            />

            {selectedColorGroup && (
              <VariantInfoTable
                colorGroup={selectedColorGroup}
                showPrices={isUnlocked}
              />
            )}

            {model.colorGroups.length > 1 && (
              <>
                <hr className="border-gray-200" />
                <ColorSizeMatrix
                  colorGroups={model.colorGroups}
                  selectedColorIndex={selectedColorIndex}
                  onSelectColor={handleColorSelect}
                  showPrices={isUnlocked}
                />
              </>
            )}

            <hr className="border-gray-200" />

            <ProductAttributes model={model} />
          </div>
        </div>
      </div>

      {/* Change Request Modal */}
      <ChangeRequestModal
        isOpen={changeRequest.status === 'modal_open'}
        isLoading={changeRequest.status === 'submitting'}
        model={model}
        categoryTree={categoryTree}
        onSubmit={changeRequest.submitChangeRequest}
        onClose={changeRequest.cancel}
      />

      {/* Withdraw confirmation */}
      <WithdrawDialog
        isOpen={changeRequest.status === 'confirm_withdraw'}
        isLoading={changeRequest.status === 'withdrawing'}
        onConfirm={changeRequest.confirmWithdraw}
        onClose={changeRequest.cancel}
      />

      {/* PIN Modal (shared by create + withdraw flows) */}
      <PinModal
        isOpen={changeRequest.status === 'needs_pin' || changeRequest.status === 'authenticating'}
        isLoading={changeRequest.status === 'authenticating'}
        errorMessage={changeRequest.errorMessage}
        onSubmit={changeRequest.submitPin}
        onClose={changeRequest.cancel}
      />

      <ToastContainer toasts={changeRequest.toasts} onDismiss={changeRequest.dismissToast} />
    </>
  );
}
