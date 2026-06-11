import assert from 'node:assert/strict';
import { parseShowcaseTail, shardOf } from '../src/lib/stable-url';

// parse
assert.deepEqual(parseShowcaseTail('werkbroek-stretch-marine-l-8712345678901'), { level: 'ean', key: '8712345678901' });
assert.deepEqual(parseShowcaseTail('werkbroek-stretch-m7Xk29Qa'), { level: 'model', key: '7Xk29Qa' });
assert.deepEqual(parseShowcaseTail('werkbroek-marine-c4b2f1a9cdef'), { level: 'color', key: '4b2f1a9cdef' });
assert.equal(parseShowcaseTail('santino-corporate'), null); // existing readable slug, no stable tail
assert.equal(parseShowcaseTail('havep-werkbroek-80229'), null); // 5-digit code is NOT an EAN

// shard determinism + matches between writer/reader (same fn)
assert.equal(shardOf('8712345678901'), '01');
assert.equal(shardOf('m7Xk29Qa'), 'qa');
assert.equal(shardOf('c4b2f1a9cd'), 'cd');

console.log('stable-url smoke OK');
