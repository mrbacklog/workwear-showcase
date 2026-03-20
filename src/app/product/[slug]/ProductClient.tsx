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
import { useSpriteMap } from '@/hooks/useSpriteMap';
import { CrossfadeSprite } from '@/components/ui/CrossfadeSprite';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { ColorGroup, ShowcaseImage, ShowcaseModel } from '@/types/product';

// ---------------------------------------------------------------------------
// Product Gallery
// ---------------------------------------------------------------------------

function ProductGallery({
  images,
  modelName,
  modelSlug,
}: {
  images: ShowcaseImage[];
  modelName: string;
  modelSlug: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [fullLoaded, setFullLoaded] = useState(false);
  const { getSpriteInfo } = useSpriteMap();

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
  const mainSprite = getSpriteInfo(modelSlug, mainImage.path);

  return (
    <div className="space-y-3">
      {/* Main image: full-size from API with sprite placeholder */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-50">
        {mainSprite ? (
          <>
            {/* Sprite as instant placeholder */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${mainSprite.fullSrc})`,
                backgroundPosition: mainSprite.fullPos,
                backgroundRepeat: 'no-repeat',
                backgroundSize: mainSprite.fullSize,
                opacity: fullLoaded ? 0 : 1,
                transition: 'opacity 200ms ease-out',
              }}
            />
            {/* Full-size original from backend API */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainSprite.originalUrl}
              alt={modelName}
              className="absolute inset-0 h-full w-full object-contain p-4 cursor-zoom-in"
              style={{ opacity: fullLoaded ? 1 : 0, transition: 'opacity 200ms ease-out' }}
              onLoad={() => setFullLoaded(true)}
              onClick={() => setLightboxUrl(mainSprite.originalUrl)}
            />
            {/* Zoom icon */}
            <button
              type="button"
              onClick={() => setLightboxUrl(mainSprite.originalUrl)}
              className="absolute bottom-3 right-3 rounded-full bg-white/80 p-2 text-gray-600 shadow-sm hover:bg-white hover:text-gray-900 transition-colors"
              aria-label="Vergroot afbeelding"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-300">
            Geen afbeelding
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, idx) => {
            const sprite = getSpriteInfo(modelSlug, img.path);
            return (
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
                {sprite ? (
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundImage: `url(${sprite.thumbSrc})`,
                      backgroundPosition: sprite.thumbPos,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: sprite.thumbSize,
                    }}
                  />
                ) : (
                  <div className="h-full w-full bg-gray-100" />
                )}
              </button>
            );
          })}
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
// Color Selector (thumbnail strip with hover preview)
// ---------------------------------------------------------------------------

function ColorSelector({
  colorGroups,
  selectedIndex,
  onSelect,
  onHover,
  hoveredIndex,
  modelSlug,
}: {
  colorGroups: ColorGroup[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
  hoveredIndex: number | null;
  modelSlug: string;
}) {
  const { getSpriteInfo } = useSpriteMap();

  if (colorGroups.length <= 1) return null;

  const displayIndex = hoveredIndex ?? selectedIndex;
  const displayGroup = colorGroups[displayIndex];

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-900">
        Kleur: {displayGroup?.colorRaw || displayGroup?.colorName}
      </h3>
      <div
        className="mt-2 flex items-center gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}
      >
        {colorGroups.map((cg, idx) => {
          const isSelected = idx === selectedIndex;
          const firstImg = cg.images[0];
          const sprite = firstImg ? getSpriteInfo(modelSlug, firstImg.path) : null;

          return (
            <button
              key={cg.colorCode || cg.colorRaw}
              type="button"
              onClick={() => onSelect(idx)}
              onMouseEnter={() => onHover(idx)}
              onMouseLeave={() => onHover(null)}
              title={cg.colorRaw || cg.colorName}
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-50 transition-all ${
                isSelected
                  ? 'ring-2 ring-gray-900 ring-offset-1'
                  : 'ring-1 ring-gray-200 hover:ring-gray-400'
              }`}
            >
              {sprite ? (
                <div
                  className="h-full w-full"
                  style={{
                    backgroundImage: `url(${sprite.thumbSrc})`,
                    backgroundPosition: sprite.thumbPos,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: sprite.thumbSize,
                  }}
                />
              ) : (
                <span
                  className="absolute inset-1.5 rounded-full"
                  style={{ backgroundColor: cg.hexCode || '#cccccc' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color/Size Matrix
// ---------------------------------------------------------------------------

function ColorSizeMatrix({ colorGroup }: { colorGroup: ColorGroup }) {
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
        <h3 className="text-sm font-medium text-gray-900">Maten</h3>
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
              <th className="py-2 text-right font-medium text-gray-500">
                Prijs
              </th>
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
                <td className="py-2 text-right text-gray-900">
                  {v.priceCents > 0
                    ? `${(v.priceCents / 100).toFixed(2).replace('.', ',')} EUR`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
        <Header searchValue={headerSearch} onSearchChange={handleSearchChange} />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
        <Header searchValue={headerSearch} onSearchChange={handleSearchChange} />
        <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
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
      <Header searchValue={headerSearch} onSearchChange={handleSearchChange} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
            modelSlug={model.slug}
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
              modelSlug={model.slug}
            />

            {selectedColorGroup && (
              <ColorSizeMatrix colorGroup={selectedColorGroup} />
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
