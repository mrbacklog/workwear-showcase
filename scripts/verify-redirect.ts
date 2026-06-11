import assert from 'node:assert/strict';
import { buildRedirectTarget, parseShowcaseTail } from '../src/lib/stable-url';

assert.equal(
  buildRedirectTarget('https://showcase.databiz.app', { slug: 'werkbroek-80229', color: 'Marine', size: 'L' }),
  'https://showcase.databiz.app/product/werkbroek-80229/?color=Marine&size=L',
);
assert.equal(
  buildRedirectTarget('https://showcase.databiz.app', { slug: 'werkbroek-80229', color: 'Marine' }),
  'https://showcase.databiz.app/product/werkbroek-80229/?color=Marine',
);
assert.equal(
  buildRedirectTarget('https://showcase.databiz.app', { slug: 'werkbroek-80229' }),
  'https://showcase.databiz.app/product/werkbroek-80229/',
);
// non-tail readable slug must NOT parse (so the Function calls next())
assert.equal(parseShowcaseTail('santino-corporate'), null);
console.log('redirect smoke OK');
