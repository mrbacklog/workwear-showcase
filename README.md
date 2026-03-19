# Workwear Showcase

Public product catalog for the Workwear Platform. Built as a static Next.js 15 site, deployed to Cloudflare Pages.

**Production:** https://showcase.databiz.app

## Quick Start (Offline)

No backend needed. Uses bundled sample data.

```bash
npm install
npm run dev:offline    # Loads fixtures + starts dev server at http://localhost:8500
```

## Quick Start (Live Data)

Requires access to the Workwear Platform backend API.

```bash
cp .env.local.example .env.local
# Edit .env.local with your AGENT_SECRET

npm install
npm run sync           # Fetch latest data from backend
npm run dev            # Start dev server at http://localhost:8500
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server (port 8500) |
| `npm run dev:offline` | Load sample data + start dev server |
| `npm run build` | Static export to `out/` |
| `npm run sync` | Sync product data from backend API |
| `npm run sync:force` | Force full sync (skip change detection) |
| `npm run sync:dry-run` | Preview changes without writing |
| `npm run sync:deploy` | Sync + build + deploy to Cloudflare |
| `npm run fixtures:load` | Copy sample data to public/data/ |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checker |

## Architecture

```
src/
  app/              # Next.js App Router pages
  components/       # React components
  hooks/            # Custom React hooks
  contexts/         # React context providers
  lib/              # Utilities, API clients, search
  types/            # TypeScript interfaces

scripts/
  sync-products.ts  # Data sync orchestrator (backend API -> JSON)
  generate-sprites.ts  # Sprite sheet generator
  load-fixtures.ts  # Load sample data for offline dev

fixtures/
  sample-data/      # Bundled sample dataset for offline development

public/
  data/             # Generated JSON files (gitignored)
  images/           # Generated sprites & thumbnails (gitignored)
```

## Data Flow

```
Workwear PIM (backend) --[API]--> sync-products.ts --> public/data/*.json
                                                   --> public/images/sprites/*.webp

Showcase (frontend)    --[API]--> Change Requests --> Workwear PIM (backend)
```

- **Product data** flows from the PIM backend to showcase via the sync script
- **Change requests** (e.g., promote product to Core) flow from showcase back to the PIM backend
- Data sync runs automatically every 4 hours via GitHub Actions, or manually from the PIM UI

## Environment Variables

| Variable | Required For | Description |
|----------|-------------|-------------|
| `BACKEND_URL` | sync | Backend API URL (default: https://api.databiz.app) |
| `AGENT_SECRET` | sync | API authentication token |
| `NEXT_PUBLIC_API_URL` | runtime | Backend URL for change requests |

## Deployment

Automated via GitHub Actions (`.github/workflows/showcase-deploy.yml`):
- **Scheduled:** Every 4 hours
- **Manual:** GitHub Actions UI
- **Auto-trigger:** Backend worker sends `repository_dispatch` after data sync

Manual deploy:
```bash
npm run sync:deploy
```
