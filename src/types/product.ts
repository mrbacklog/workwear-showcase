/**
 * Showcase data model types.
 *
 * Data hierarchy:
 *   Brand -> ShowcaseModel -> ColorGroup -> ShowcaseVariant
 *
 * Images are WebP files stored at /images/products/{ean}-{seq}.webp
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

export type ImageType = 'front' | 'back' | 'side' | 'detail' | 'lifestyle';

/** Embedded sprite coordinates, written into model-cards during sync */
export interface EmbeddedSpriteInfo {
  /** Thumb sprite URL, e.g. /images/sprites/t/engel-workwear.webp */
  thumbSrc: string;
  /** Full sprite URL, e.g. /images/sprites/f/engel-workwear.webp */
  fullSrc: string;
  /** Grid column of this image in the sprite sheet (0-based) */
  col: number;
  /** Grid row of this image in the sprite sheet (0-based) */
  row: number;
  /** Total columns in the sprite sheet */
  cols: number;
  /** Total rows in the sprite sheet */
  rows: number;
}

export interface ShowcaseImage {
  /** EAN of the variant this image belongs to */
  ean: string;
  /** Sequence number for ordering (1-based) */
  sequenceNumber: number;
  /** Categorization of the image */
  imageType: ImageType;
  /** Full-size image path, e.g. /images/products/8712345678901-1.webp */
  path: string;
  /** Thumbnail path, e.g. /images/products/thumbs/8712345678901-1.webp */
  thumbPath: string;
  /** Embedded sprite coordinates, present when synced with sprite info */
  sprite?: EmbeddedSpriteInfo;
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
  /** Variants within this color group, sorted by size */
  variants: ShowcaseVariant[];
  /** Images for this color group */
  images: ShowcaseImage[];
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
  /** Variants grouped by color */
  colorGroups: ColorGroup[];
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
// Change requests
// ---------------------------------------------------------------------------

export type ChangeType = 'status_change' | 'category_change';

export type ChangeRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'in_progress'
  | 'applied'
  | 'failed';

export interface PendingChangeRequest {
  id: number;
  modelId: string;
  changeType: ChangeType;
  requestedValue: string;
  status: ChangeRequestStatus;
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
  /** List of all image file paths */
  imageFiles: string[];
  /** Total number of models in the showcase */
  totalModels: number;
  /** Total number of images in the showcase */
  totalImages: number;
}

// ---------------------------------------------------------------------------
// Sprite map (generated by sync, loaded at runtime)
// ---------------------------------------------------------------------------

/** Position of a single image within its model's sprite sheet. [col, row] */
export type SpritePosition = [number, number];

/** Sprite data for a single model */
export interface ModelSpriteEntry {
  /** Thumb sprite path, e.g. /images/sprites/t/brand-slug.webp */
  t: string;
  /** Full sprite path, e.g. /images/sprites/f/brand-slug.webp */
  f: string;
  /** Number of columns in sprite grid (same for thumb and full) */
  cols: number;
  /** Number of rows in sprite grid (same for thumb and full) */
  rows: number;
  /** Map of "ean-seq" → [col, row] position in sprites */
  img: Record<string, SpritePosition>;
}

/** Root sprite map structure */
export interface SpriteMap {
  /** Thumb cell size in px (64) */
  thumbCell: number;
  /** Full cell size in px (400) */
  fullCell: number;
  /** Default columns in sprite grid */
  cols: number;
  /** Backend image base URL for original resolution */
  imageBase: string;
  /** Per-model sprite entries keyed by slug */
  models: Record<string, ModelSpriteEntry>;
}
