/**
 * Load fixture data into public/ directories for offline development.
 *
 * Usage: npm run fixtures:load
 *
 * Copies sample data from fixtures/sample-data/ to public/data/ and
 * sample sprite sheets to public/images/sprites/, enabling `npm run dev`
 * to work without a running backend.
 */

import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const FIXTURES_DIR = join(ROOT, 'fixtures', 'sample-data');
const PUBLIC_DATA = join(ROOT, 'public', 'data');
const PUBLIC_SPRITES = join(ROOT, 'public', 'images', 'sprites');

function loadFixtures() {
  if (!existsSync(FIXTURES_DIR)) {
    console.error('Fixtures directory not found:', FIXTURES_DIR);
    console.error('Run "npm run sync" first to populate data, or ensure fixtures/sample-data/ exists.');
    process.exit(1);
  }

  // Ensure target directories exist
  mkdirSync(PUBLIC_DATA, { recursive: true });
  mkdirSync(PUBLIC_SPRITES, { recursive: true });

  // Copy JSON data files
  const jsonFiles = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));
  let copied = 0;

  for (const file of jsonFiles) {
    const src = join(FIXTURES_DIR, file);
    const dest = join(PUBLIC_DATA, file);
    cpSync(src, dest);
    copied++;
  }

  console.log(`Copied ${copied} data files to public/data/`);

  // Copy sprite sheets
  const spritesDir = join(FIXTURES_DIR, 'images', 'sprites');
  if (existsSync(spritesDir)) {
    const spriteFiles = readdirSync(spritesDir).filter(f => f.endsWith('.webp'));
    for (const file of spriteFiles) {
      cpSync(join(spritesDir, file), join(PUBLIC_SPRITES, file));
    }
    console.log(`Copied ${spriteFiles.length} sprite sheets to public/images/sprites/`);
  } else {
    console.log('No sprite fixtures found (fixtures/sample-data/images/sprites/)');
  }

  console.log('Fixtures loaded. Run "npm run dev" to start development.');
}

loadFixtures();
