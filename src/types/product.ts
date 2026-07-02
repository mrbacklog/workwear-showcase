/**
 * Showcase data model types.
 *
 * Data hierarchy:
 *   Brand -> ShowcaseModel -> ColorGroup -> ShowcaseVariant
 *
 * Images are served from R2 CDN as WebP at multiple sizes (80/400/800px)
 * Prices are in EUR cents (8995 = 89.95 EUR)
 * Categories use a 3-level hierarchy with category_code as PK
 * Publication status controls visibility in the showcase
 */

// ---------------------------------------------------------------------------
// Publication status
// ---------------------------------------------------------------------------

export type PublicationStatus = 'core' | 'extended';

// ---------------------------------------------------------------------------
// Variant (leaf node: single EAN)
// ---------------------------------------------------------------------------

export interface ShowcaseVariant {
  /** EAN-13 barcode */
  ean: string;
  /** Raw size value from supplier data (e.g. "XL", "52/54") */
  sizeRaw: string;
  /** Normalized display size (e.g. "XL", "52/54") */
  sizeDisplay: string;
  /** Price in EUR cents (8995 = 89.95 EUR) */
  priceCents: number;
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export type ImageType = 'front' | 'back' | 'side' | 'detail' | 'lifestyle' | 'default' | 'left' | 'right' | 'top' | 'bottom' | null;

export interface ShowcaseImage {
  /** Image UUID for cover_change requests */
  id: string;
  /** EAN of the variant this image belongs to */
  ean: string;
  /** Sequence number for ordering (1-based) */
  sequenceNumber: number;
  /** Categorization of the image */
  imageType: ImageType;
  /** Image key, e.g. "8712345678901-1" */
  path: string;
  /** R2 WebP thumbnail (80w) for swatches and thumbnail strips */
  thumbWebp: string;
  /** R2 WebP medium thumbnail (400w) for grid cards */
  thumb400Webp: string;
  /** R2 WebP large thumbnail (800w) for product detail */
  thumb800Webp: string;
  /** Whether this image is the current cover for its color group */
  isCover: boolean;
}

// ---------------------------------------------------------------------------
// Color group (variants grouped by color)
// ---------------------------------------------------------------------------

export interface ColorGroup {
  /** Raw color value from supplier data */
  colorRaw: string;
  /** Normalized color code */
  colorCode: string;
  /** Human-readable color name (Dutch) */
  colorName: string;
  /** Primary hex color for swatch display (e.g. "#1a2b3c") */
  hexCode: string;
  /** Secondary hex color for two-tone swatches, null if single color */
  secondaryHex: string | null;
  /** Secondary color name, null if single color */
  secondaryName: string | null;
  /** Secondary color family code for filter matching */
  secondaryCode: string | null;
  /** Tertiary hex color for three-tone display */
  tertiaryHex: string | null;
  /** Tertiary color name */
  tertiaryName: string | null;
  /** Tertiary color family code for filter matching */
  tertiaryCode: string | null;
  /** Whether any variant in this group is fluorescent */
  isFluorescent: boolean;
  /** Whether any variant in this group is high-visibility */
  isHighVisibility: boolean;
  /** Variants within this color group, sorted by size */
  variants: ShowcaseVariant[];
  /** Images for this color group */
  images: ShowcaseImage[];
  /** Stable color-variant id (UUID hex, no dashes) — used in stable color-level URLs */
  colorVariantId: string | null;
}

// ---------------------------------------------------------------------------
// Model (main product entity)
// ---------------------------------------------------------------------------

export interface ShowcaseModel {
  /** Internal unique identifier (UUID) */
  id: string;
  /** URL-safe slug (e.g. "havep-attitude-werkbroek-80229") */
  slug: string;
  /** Brand display name */
  brandName: string;
  /** URL-safe brand slug */
  brandSlug: string;
  /** Manufacturer article/model code */
  modelCode: string;
  /** Product model name */
  modelName: string;
  /** Leaf category code this model belongs to */
  categoryCode: string;
  /** Full category path for display (e.g. "Werkkleding > Broeken > Werkbroeken") */
  categoryPath: string;
  /** Full product description in Dutch */
  descriptionNl: string;
  /** Short product description in Dutch */
  shortDescriptionNl: string;
  /** Publication tier controlling visibility */
  publicationStatus: PublicationStatus;
  /** Total number of variants (EANs) across all color groups */
  variantCount: number;
  /** Material/fabric composition */
  material: string | null;
  /** Gender (Heren/Dames/Unisex) */
  gender: string | null;
  /** Safety norms (EN ISO codes) */
  safetyNorms: string | null;
  /** Care/wash instructions */
  careInstructions: string | null;
  /** Country of origin */
  countryOfOrigin: string | null;
  /** Fabric type and weight */
  fabricTypeWeight: string | null;
  /** Variants grouped by color */
  colorGroups: ColorGroup[];
  /** Stable, opaque model anchor for canonical/stable URLs (minted by the backend) */
  modelPublicId: string | null;
}

// ---------------------------------------------------------------------------
// Category tree
// ---------------------------------------------------------------------------

export interface CategoryNode {
  /** Unique category code (PK) */
  code: string;
  /** Category name in Dutch */
  nameNl: string;
  /** Hierarchy level (1 = top, 2 = mid, 3 = leaf) */
  level: number;
  /** Parent category code, null for root nodes */
  parentCode: string | null;
  /** Sort order within siblings */
  sortOrder: number;
  /** Child categories */
  children: CategoryNode[];
}

// ---------------------------------------------------------------------------
// Sync manifest
// ---------------------------------------------------------------------------

export interface SyncManifest {
  /** ISO 8601 timestamp of the last successful sync */
  lastSyncAt: string;
  /** Content fingerprint for cache invalidation */
  fingerprint: string;
  /** List of all available model slugs */
  modelSlugs: string[];
  /** Total number of models in the showcase */
  totalModels: number;
  /** Total number of images in the showcase */
  totalImages: number;
}


