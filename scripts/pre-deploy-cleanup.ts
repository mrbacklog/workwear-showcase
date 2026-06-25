/**
 * pre-deploy-cleanup.ts
 *
 * Removes Next.js RSC payload (.txt) files from the `out/` directory before
 * deploying to Cloudflare Pages. These files are generated during `next build`
 * with `output: "export"` and speed up client-side navigation but are not
 * required for direct URL access (the HTML file serves those requests).
 *
 * Without cleanup: ~23k files (over Cloudflare Pages 20k limit)
 * After cleanup:   ~14k files (comfortably under the limit)
 *
 * Idempotent: safe to run multiple times.
 */

import { readdirSync, statSync, unlinkSync } from "fs";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "out");

function findTxtFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findTxtFiles(fullPath));
    } else if (entry.endsWith(".txt")) {
      results.push(fullPath);
    }
  }
  return results;
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

const files = findTxtFiles(OUT_DIR);

if (files.length === 0) {
  console.log("No RSC payload (.txt) files found — nothing to remove.");
} else {
  console.log(
    `Removing ${files.length} RSC payload (.txt) files to stay under Cloudflare Pages 20k limit...`
  );
  for (const file of files) {
    unlinkSync(file);
  }
}

const remaining = countFiles(OUT_DIR);
console.log(`Done. Remaining files in out/: ${remaining}`);

if (remaining >= 20000) {
  console.error(
    `ERROR: ${remaining} files still exceeds the Cloudflare Pages 20k limit!`
  );
  process.exit(1);
}
