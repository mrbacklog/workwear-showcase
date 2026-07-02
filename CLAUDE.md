# CLAUDE.md - Workwear Showcase

## Wat is dit?

De **publieke productcatalogus** van het Workwear Platform. Een statische Next.js 15 site op Cloudflare Pages die gepubliceerde werkkleding-producten toont met zoeken, categorienavigatie en productdetails.

| Aspect | Details |
|--------|---------|
| Framework | Next.js 15, App Router, `output: "export"` (statisch) |
| Styling | Tailwind CSS v4 |
| Zoeken | MiniSearch (client-side full-text search) |
| Hosting | Cloudflare Pages (edge CDN) |
| Productie | https://showcase.databiz.app |
| Data | Pre-baked JSON chunks in `public/data/` |
| Images | Thumbnails: `public/images/thumbs/` (CDN), full-size: backend API |
| Backend API | https://api.databiz.app (aparte monorepo: `mrbacklog/workwear-platform`) |

## Snel starten

```bash
# Offline development (met sample data, geen backend nodig)
npm install
npm run dev:offline      # http://localhost:8500

# Live development (backend moet draaien op :8001, of gebruik productie API)
npm run sync             # Sync data van backend
npm run dev              # http://localhost:8500

# Quality checks
npm run lint && npm run type-check

# Build voor productie
npm run build            # Statische export naar out/
```

## Architectuurregels

1. **Geen runtime API calls voor productdata** - Alle productdata komt uit statische JSON bestanden in `public/data/`. Enige runtime API calls zijn voor PIN authenticatie.
2. **Prijzen in centen** - `priceCents: 8995` = `€ 89,95`. Gebruik `lib/format.ts` voor weergave.
3. **Model ID = UUID string** - Het `id` veld in FrontendModel is een UUID string, GEEN number.
4. **Model-cards in chunks** - Gesplitst in ~15MB chunks (Cloudflare 25MB limiet). `model-cards-meta.json` verwijst naar chunks.
5. **Backend retourneert camelCase** - Pydantic schemas gebruiken `CamelModel`, TypeScript types matchen dit direct.
6. **Altijd `npm run sync` voor `npm run build`** - Build zonder sync geeft verouderde data.
7. **Lock/unlock gebruikt `showcase_session`** - PIN-auth slaat de sessie op in `showcase_session` localStorage key.

## Project structuur

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout + ShowcaseAuthProvider
│   ├── page.tsx                  # / → redirect naar /search/
│   ├── search/page.tsx           # Zoek- en browse-pagina (hoofdpagina)
│   ├── category/[...path]/       # Categorie browser (3-level hiërarchie)
│   └── product/[slug]/           # Productdetail pagina
├── components/
│   ├── layout/                   # Header, Footer, LockButton
│   ├── search/                   # ModelCard, SearchInput, AutoSuggest, filters
│   ├── category/                 # CategorySidebar, CategoryTreeNode
│   ├── product/                  # ProductGallery, ColorSizeMatrix, ProductHeader
│   └── change-request/           # ChangeRequestButton, PinModal
├── contexts/
│   └── ShowcaseAuthContext.tsx    # Lock/unlock state (PIN auth)
├── hooks/
│   ├── useSearch.ts              # MiniSearch wrapper (debounced)
│   ├── useModelCards.ts          # Chunked model data loader
│   ├── useCategoryTree.ts        # Categorieboom + breadcrumbs
│   ├── useChangeRequest.ts       # Change request flow
│   └── usePendingRequests.ts     # Pending change requests
├── lib/
│   ├── search/search-manager.ts  # MiniSearch singleton
│   ├── format.ts                 # Prijsformattering (centen → EUR)
│   └── category-utils.ts         # Boom traversal, counts
└── types/
    └── product.ts                # TypeScript interfaces
```

## Scripts

| Script | Doel |
|--------|------|
| `scripts/sync-products.ts` | Sync data van backend API → JSON chunks |
| `scripts/load-fixtures.ts` | Kopieer sample data voor offline dev |
| `scripts/generate-sample-dataset.ts` | Eenmalig: genereer fixtures van API |

## Data sync

Data wordt ge-synct vanuit de Workwear Platform backend API:

```
Backend API (api.databiz.app)
  → sync-products.ts (npm run sync)
    → public/data/model-cards-*.json
    → public/data/category-tree.json
    → public/data/search-index.json
    → public/images/thumbs/*.webp
```

In CI/CD (GitHub Actions) wordt dit automatisch gedaan bij elke deploy.

## Lock/Unlock systeem

De showcase staat standaard **op slot** (alleen Kern-producten, geen prijzen). Na PIN unlock via het hangslot-icoon worden alle producten en prijzen zichtbaar.

- **PIN:** Via backend endpoint `POST /api/v1/distribution/showcase/auth` → JWT (24h)
- **Rate limit:** 5 pogingen per 15 minuten per IP
- **Sessie:** `showcase_session` in localStorage (gedeeld met change requests)

## CI/CD

GitHub Actions workflow (`.github/workflows/showcase-deploy.yml`):
- **Triggers:** Cron (elke 4 uur), `workflow_dispatch`, `repository_dispatch` (van backend worker)
- **Stappen:** checkout → npm install → sync → build → deploy to Cloudflare Pages
- **ALTIJD `--ref main`** voor productie-deploys

## Environment variables

```bash
# Alleen nodig voor live sync (NIET voor offline dev)
BACKEND_URL=https://api.databiz.app
AGENT_SECRET=<your-agent-secret>

# Runtime API voor change requests
NEXT_PUBLIC_API_URL=https://api.databiz.app
```

Kopieer `.env.local.example` naar `.env.local` voor lokale configuratie.

## Conventies

- **Nederlandse UI teksten** - Labels in het Nederlands
- **Tailwind CSS** - Geen CSS modules of styled-components
- **Client-side rendering** - `'use client'` directive op alle interactieve componenten
- **TypeScript strict** - Alle types expliciet, geen `any`
- **ESLint** - Next.js configuratie (`next/core-web-vitals`)

## Relatie met Workwear Platform

Deze repo bevat alleen de **frontend** van de showcase. De backend (API endpoints, data export, sync worker) leeft in de [`workwear-platform`](https://github.com/mrbacklog/workwear-platform) monorepo:

| Component | Waar |
|-----------|------|
| Showcase frontend | **Deze repo** |
| Backend API (`/api/v1/distribution/showcase/*`) | `workwear-platform` monorepo |
| Data export service | `workwear-platform/backend/app/services/distribution/` |
| ARQ sync worker | `workwear-platform/backend/app/worker/tasks/showcase_sync.py` |
| Deploy trigger (repository_dispatch) | Railway worker → deze repo's GitHub Actions |
