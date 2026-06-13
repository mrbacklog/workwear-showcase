import assert from 'node:assert/strict';
import { buildUrlLookup, shardOf } from '../src/lib/stable-url';
import type { ShowcaseModel } from '../src/types/product';

const model = {
  id: 'x', slug: 'werkbroek-stretch-80229', brandName: 'B', brandSlug: 'b',
  modelCode: '80229', modelName: 'Werkbroek', categoryCode: 'c', categoryPath: 'p',
  descriptionNl: '', shortDescriptionNl: '', publicationStatus: 'core',
  variantCount: 1, material: null, gender: null, safetyNorms: null,
  careInstructions: null, countryOfOrigin: null, fabricTypeWeight: null,
  modelPublicId: '7Xk29Qa',
  colorGroups: [{
    colorRaw: 'Marine', colorCode: 'NAV', colorName: 'Marine', hexCode: '#001',
    secondaryHex: null, secondaryName: null, secondaryCode: null,
    tertiaryHex: null, tertiaryName: null, tertiaryCode: null,
    isFluorescent: false, isHighVisibility: false,
    colorVariantId: 'f998a0ce-4859-4a4a-96c5-88e0449ac553',
    variants: [{ ean: '8712345678901', sizeRaw: 'L', sizeDisplay: 'L', priceCents: 1000 }],
    images: [],
  }],
} as unknown as ShowcaseModel;

const shards = buildUrlLookup([model]);
const eanShard = shards[shardOf('8712345678901')];
assert.deepEqual(eanShard['8712345678901'], { slug: 'werkbroek-stretch-80229', color: 'Marine', size: 'L' });
const cHex = 'f998a0ce48594a4a96c588e0449ac553';
assert.deepEqual(shards[shardOf('c' + cHex)]['c' + cHex], { slug: 'werkbroek-stretch-80229', color: 'Marine' });
assert.deepEqual(shards[shardOf('m7Xk29Qa')]['m7Xk29Qa'], { slug: 'werkbroek-stretch-80229' });
console.log('url-lookup smoke OK');
