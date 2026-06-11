import { parseShowcaseTail, shardOf, buildRedirectTarget, type UrlLookupEntry } from '../../src/lib/stable-url';

// Minimal Pages-Function context typing (avoids a @cloudflare/workers-types dep).
interface PagesContext {
  request: Request;
  next: () => Promise<Response>;
}

/**
 * Resolver voor stabiele deep-link-URL's. Draait alleen op /product/* (zie _routes.json).
 * Niet-staart-URL's (bestaande leesbare modelpagina's) en elke lookup-miss vallen
 * door naar de statische asset via next() — nooit een valse 404 op een echte pagina.
 */
export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const { request, next } = context;
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean); // ['product', '<slug>']
  const slug = segments[1] ?? '';

  const parsed = parseShowcaseTail(slug);
  if (!parsed) return next(); // ordinary readable model page -> static

  const tail = slug.split('-').pop() as string;
  let shardData: Record<string, UrlLookupEntry>;
  try {
    const res = await fetch(new URL(`/data/url-lookup/${shardOf(tail)}.json`, url.origin).toString());
    if (!res.ok) return next();
    shardData = (await res.json()) as Record<string, UrlLookupEntry>;
  } catch {
    return next();
  }

  const entry = shardData[tail];
  if (!entry) return next(); // unknown/false-positive tail -> static (or natural 404)

  return Response.redirect(buildRedirectTarget(url.origin, entry), 301);
};
