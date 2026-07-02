'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { compareSizes } from '@/lib/size-sort';
import { Header } from '@/components/layout/Header';
import { ProductHeader } from '@/components/product/ProductHeader';
import { ProductSpecs } from '@/components/product/ProductSpecs';
import { EanPopover } from '@/components/product/EanPopover';
import { ActionMenu } from '@/components/change-request/ActionMenu';
import { ChangeRequestModal, WithdrawDialog } from '@/components/change-request/ChangeRequestModal';
import { ToastContainer } from '@/components/change-request/Toast';
import { QuoteRequestDialog } from '@/components/product/QuoteRequestDialog';
import { useModelDetail } from '@/hooks/useModelDetail';
import { NoImagePlaceholder } from '@/components/ui/NoImagePlaceholder';
import { useChangeRequest } from '@/hooks/useChangeRequest';
import { usePendingRequests } from '@/hooks/usePendingRequests';
import { useCategoryTree } from '@/hooks/useCategoryTree';
import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';
import { useImageUrl } from '@/hooks/useImageUrl';
import { useEnrichment } from '@/hooks/useEnrichment';
import { ProductImage } from '@/components/ui/ProductImage';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { ColorGroup, ShowcaseImage, ShowcaseModel, ShowcaseVariant } from '@/types/product';

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

  useEffect(() => {
    setFullLoaded(false);
  }, [selectedIndex]);

  if (images.length === 0) {
    return <NoImagePlaceholder className="aspect-square rounded-lg" />;
  }

  const mainImage = images[selectedIndex] ?? images[0];
  const originalUrl = getOriginalImageUrl(mainImage.ean, mainImage.sequenceNumber);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-50">
        <ProductImage
          src={mainImage.thumb800Webp}
          alt={modelName}
          className={`h-full w-full object-contain transition-opacity duration-200 ${fullLoaded ? 'opacity-0' : 'opacity-100'}`}
          priority={true}
          sizes="(max-width: 768px) 100vw, 35vw"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={originalUrl}
          alt={modelName}
          className={`absolute inset-0 h-full w-full object-contain p-4 cursor-zoom-in transition-opacity duration-200 ${fullLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setFullLoaded(true)}
          onClick={() => setLightboxUrl(originalUrl)}
        />
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

      {lightboxUrl && (
        <ImageLightbox
          src={lightboxUrl}
          alt={modelName}
          onClose={() => setLightboxUrl(null)}
          fallbackSrc={mainImage.thumb800Webp}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable Description
// ---------------------------------------------------------------------------

function ExpandableDescription({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > 200;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Productomschrijving</h3>
      <div className="relative">
        <p
          className={`text-sm leading-relaxed text-gray-600 whitespace-pre-line ${
            !expanded && isLong ? 'max-h-[3.6em] overflow-hidden' : ''
          }`}
        >
          {text}
        </p>
        {!expanded && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 mt-1"
        >
          {expanded ? 'Minder tonen ▲' : 'Meer lezen ▼'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color/Size Matrix (enhanced with EAN popover)
// ---------------------------------------------------------------------------

interface ActiveCell {
  colorIdx: number;
  size: string;
  variant: ShowcaseVariant;
  colorName: string;
  anchorRect: DOMRect;
}

function ColorSizeMatrix({
  colorGroups,
  selectedColorIndex,
  onSelectColor,
  showPrices,
  initialSize,
}: {
  colorGroups: ColorGroup[];
  selectedColorIndex: number;
  onSelectColor: (index: number) => void;
  showPrices: boolean;
  initialSize?: string;
}) {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);

  // Preselect size from URL param (?size=) once colorGroups are available
  useEffect(() => {
    if (!initialSize || colorGroups.length === 0) return;
    const cg = colorGroups[selectedColorIndex];
    if (!cg) return;
    const variant =
      cg.variants.find((v) => v.sizeRaw === initialSize) ??
      cg.variants.find((v) => v.sizeDisplay === initialSize);
    if (!variant) return;
    const size = variant.sizeDisplay || variant.sizeRaw;
    setActiveCell({
      colorIdx: selectedColorIndex,
      size,
      variant,
      colorName: cg.colorRaw || cg.colorName,
      anchorRect: new DOMRect(),
    });
  }, [initialSize, colorGroups, selectedColorIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const allSizes = useMemo(() => {
    const sizeSet = new Set<string>();
    for (const cg of colorGroups) {
      for (const v of cg.variants) {
        sizeSet.add(v.sizeDisplay || v.sizeRaw);
      }
    }
    return [...sizeSet].sort((a, b) => compareSizes(a, b));
  }, [colorGroups]);

  const handleCellClick = useCallback(
    (e: React.MouseEvent, colorIdx: number, size: string, variant: ShowcaseVariant, colorName: string) => {
      e.stopPropagation(); // Don't trigger row click
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setActiveCell({ colorIdx, size, variant, colorName, anchorRect: rect });
    },
    [],
  );

  if (colorGroups.length === 0 || allSizes.length === 0) return null;

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-semibold text-gray-700 border-b border-gray-200">
                Kleur
              </th>
              {allSizes.map((size) => (
                <th
                  key={size}
                  className="px-2 py-2.5 text-center font-medium text-gray-500 whitespace-nowrap border-b border-gray-200"
                >
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {colorGroups.map((cg, idx) => {
              const isActive = idx === selectedColorIndex;
              const variantMap = new Map<string, ShowcaseVariant>();
              for (const v of cg.variants) {
                const key = v.sizeDisplay || v.sizeRaw;
                variantMap.set(key, v);
              }
              const colorName = cg.colorRaw || cg.colorName;

              return (
                <tr
                  key={`color-${idx}`}
                  onClick={() => onSelectColor(idx)}
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-50/50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ColorSwatch
                        hexCode={cg.hexCode}
                        secondaryHex={cg.secondaryHex}
                        isActive={isActive}
                        size="sm"
                      />
                      <span className={`whitespace-nowrap ${isActive ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {colorName}
                      </span>
                    </div>
                  </td>
                  {allSizes.map((size) => {
                    const variant = variantMap.get(size);
                    const available = variant !== undefined;
                    const isCellActive =
                      activeCell?.colorIdx === idx && activeCell?.size === size;

                    return (
                      <td
                        key={size}
                        className={`px-2 py-2.5 text-center whitespace-nowrap ${
                          available ? 'text-gray-900' : 'text-gray-300'
                        }`}
                      >
                        {available ? (
                          <button
                            type="button"
                            onClick={(e) => handleCellClick(e, idx, size, variant, colorName)}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${
                              isCellActive
                                ? 'bg-gray-900 text-white'
                                : 'hover:bg-gray-200 text-gray-900'
                            }`}
                            title={`${colorName} ${size} — klik voor EAN`}
                          >
                            ✓
                          </button>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeCell && (
        <EanPopover
          ean={activeCell.variant.ean}
          colorName={activeCell.colorName}
          size={activeCell.size}
          priceCents={activeCell.variant.priceCents}
          showPrices={showPrices}
          anchorRect={activeCell.anchorRect}
          onClose={() => setActiveCell(null)}
        />
      )}
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
}: {
  hexCode: string;
  secondaryHex?: string | null;
  isActive: boolean;
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-6 w-6';
  const hex = hexCode || '#cccccc';

  const style: React.CSSProperties = secondaryHex
    ? { background: `linear-gradient(135deg, ${hex} 50%, ${secondaryHex} 50%)` }
    : { backgroundColor: hex };

  return (
    <span
      className={`inline-block shrink-0 rounded-full border-2 ${sizeClass} ${
        isActive
          ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-1'
          : 'border-gray-300'
      }`}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Product Detail Page Client
// ---------------------------------------------------------------------------

export default function ProductClient() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const { model, isLoading, error } = useModelDetail(slug);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [headerSearch, setHeaderSearch] = useState('');
  const [initialSize, setInitialSize] = useState<string | undefined>(undefined);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/search/');
    }
  }, [router]);

  const pendingRequests = usePendingRequests();
  const changeRequest = useChangeRequest(pendingRequests);
  const { tree: categoryTree, getCategoryPath } = useCategoryTree();
  const { isUnlocked } = useShowcaseAuth();
  const enrichment = useEnrichment();

  // Build clickable breadcrumb nodes from category tree
  // Depend on categoryTree to recompute when tree data loads asynchronously
  const categoryNodes = useMemo(() => {
    if (!model?.categoryCode || categoryTree.length === 0) return [];
    return getCategoryPath(model.categoryCode);
  }, [model?.categoryCode, getCategoryPath, categoryTree]);

  // Read initial color from URL query param (?color=RAW)
  useEffect(() => {
    if (!model) return;
    const searchParams = new URLSearchParams(window.location.search);
    const colorParam = searchParams.get('color');
    if (colorParam) {
      const colorLower = colorParam.toLowerCase();
      let idx = model.colorGroups.findIndex((cg) => cg.colorRaw === colorParam);
      if (idx < 0) idx = model.colorGroups.findIndex((cg) => cg.colorCode === colorParam);
      if (idx < 0) idx = model.colorGroups.findIndex((cg) => cg.colorName.toLowerCase() === colorLower);
      if (idx >= 0) setSelectedColorIndex(idx);
    }
    // Read initial size from URL query param (?size=RAW) — applied after color resolves
    const sizeParam = searchParams.get('size');
    if (sizeParam) setInitialSize(sizeParam);
  }, [model]);

  // Check enrichment status on model load (for authenticated users)
  useEffect(() => {
    if (model && isUnlocked) {
      enrichment.checkStatus(model.id);
    }
  }, [model?.id, isUnlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = useCallback((value: string) => {
    setHeaderSearch(value);
    if (value.trim()) {
      window.location.href = `/search/?q=${encodeURIComponent(value.trim())}`;
    }
  }, []);

  const handleCategorySelect = useCallback((code: string) => {
    window.location.href = `/category/${code}/`;
  }, []);

  // Gallery shows selected color group images
  const currentImages = useMemo(() => {
    if (!model) return [];
    const cg = model.colorGroups[selectedColorIndex];
    return cg?.images ?? [];
  }, [model, selectedColorIndex]);

  const handleColorSelect = useCallback((index: number) => {
    setSelectedColorIndex(index);
    // Sync selected color to URL for back/forward support
    const cg = model?.colorGroups[index];
    if (cg) {
      const url = new URL(window.location.href);
      url.searchParams.set('color', cg.colorRaw);
      window.history.replaceState(null, '', url.toString());
    }
  }, [model]);

  if (isLoading) {
    return (
      <>
        <Header searchValue={headerSearch} onSearchChange={handleSearchChange} categoryTree={categoryTree} onCategorySelect={handleCategorySelect} />
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-6 w-32 rounded bg-gray-100" />
            <div className="mt-8 grid gap-8 lg:grid-cols-[35%_1fr]">
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
        <Header searchValue={headerSearch} onSearchChange={handleSearchChange} categoryTree={categoryTree} onCategorySelect={handleCategorySelect} />
        <div className="mx-auto max-w-[1600px] px-4 py-24 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Product niet gevonden
          </h1>
          <p className="mt-2 text-gray-500">
            {error ?? `Het product "${slug}" bestaat niet of is niet meer beschikbaar.`}
          </p>
          <button onClick={handleBack} className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800">Terug naar catalogus</button>
        </div>
      </>
    );
  }

  const modelId = String(model.id);
  const pendingReq = pendingRequests.getPending(modelId);
  const isBusy =
    changeRequest.status === 'submitting' ||
    changeRequest.status === 'withdrawing';

  return (
    <>
      <Header searchValue={headerSearch} onSearchChange={handleSearchChange} categoryTree={categoryTree} onCategorySelect={handleCategorySelect} />

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <button onClick={handleBack} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Terug naar catalogus
        </button>

        {/* Product layout: 35% image+specs / 65% details+matrix */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[35%_1fr]">
          {/* Left: Gallery + Specs (desktop) */}
          <div className="space-y-4">
            <ProductGallery
              images={currentImages}
              modelName={model.modelName || model.modelCode || ''}
            />
            {/* Specs: desktop under image, mobile at bottom */}
            <div className="hidden lg:block">
              <ProductSpecs model={model} />
            </div>
          </div>

          {/* Right: Header + Description + Matrix */}
          <div className="space-y-5">
            <ProductHeader
              model={model}
              showBadge={isUnlocked}
              showPrices={isUnlocked}
              categoryNodes={categoryNodes}
              actionSlot={isUnlocked ? (
                <ActionMenu
                  pendingRequest={pendingReq}
                  isLoading={isBusy}
                  enrichmentProposalCount={enrichment.proposals.length}
                  onSelectAction={(tab) => changeRequest.startChangeRequest(modelId, tab)}
                  onWithdraw={() => changeRequest.startWithdraw(modelId)}
                />
              ) : undefined}
            />

            <ExpandableDescription
              text={model.descriptionNl || model.shortDescriptionNl || null}
            />

            <button
              type="button"
              onClick={() => setQuoteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
            >
              Offerte aanvragen
            </button>

            <ColorSizeMatrix
              colorGroups={model.colorGroups}
              selectedColorIndex={selectedColorIndex}
              onSelectColor={handleColorSelect}
              showPrices={isUnlocked}
              initialSize={initialSize}
            />
          </div>

          {/* Mobile-only: Specs at bottom */}
          <div className="lg:hidden">
            <ProductSpecs model={model} />
          </div>
        </div>
      </div>

      {/* Change Request Modal */}
      <ChangeRequestModal
        isOpen={changeRequest.status === 'modal_open'}
        isLoading={changeRequest.status === 'submitting'}
        model={model}
        categoryTree={categoryTree}
        selectedColorGroupIndex={selectedColorIndex}
        initialTab={changeRequest.initialTab ?? undefined}
        enrichment={{
          status: enrichment.status,
          proposals: enrichment.proposals,
          notFoundFields: enrichment.notFoundFields,
          onTrigger: () => enrichment.trigger(modelId),
          onAcceptField: enrichment.acceptField,
          onRejectField: enrichment.rejectField,
          onAcceptImage: enrichment.acceptImage,
          onRejectImage: enrichment.rejectImage,
          onBulkAccept: enrichment.bulkAccept,
        }}
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

      <ToastContainer toasts={changeRequest.toasts} onDismiss={changeRequest.dismissToast} />

      {model && (
        <QuoteRequestDialog
          model={model}
          initialColorIndex={selectedColorIndex}
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          productSlug={slug}
          productImageUrl={currentImages.find(img => img.isCover)?.thumb400Webp ?? currentImages[0]?.thumb400Webp}
        />
      )}
    </>
  );
}
