'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../assets/scanner.js'), 'utf8');
const site = fs.readFileSync(path.join(__dirname, '../assets/site.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const raw = (id, username, extra = {}) => ({ pk: id, username, full_name: username, ...extra });
function harness({ pages, fetchImpl, account = '123', hostname = 'www.instagram.com', pauseWaits = false } = {}) {
  const requests = [], downloads = [], blobs = new Map(), logs = [], timers = new Map();
  let timerId = 0;
  const body = {
    appendChild(element) { assert.equal(element.type, 'a'); assert.equal(element.hidden, true); },
    get innerHTML() { throw new Error('Scanner must not inspect page HTML'); },
    set innerHTML(value) { throw new Error('Scanner must not replace Instagram UI'); },
  };
  const context = vm.createContext({
    console: Object.fromEntries(['log', 'warn', 'error'].map(kind => [kind, (...values) => logs.push({ kind, values })])),
    location: { hostname }, AbortController, Blob, URL, Set, Map,
    document: {
      cookie: account ? `other=ignore; ds_user_id=${account}; session=never_read` : '', body,
      createElement(type) {
        assert.equal(type, 'a');
        return { type, click() { downloads.push(this); }, remove() { this.removed = true; } };
      },
      set title(value) { throw new Error('Scanner must not change document title'); },
    },
    setTimeout(fn, ms) {
      const id = ++timerId; timers.set(id, { fn, ms });
      if (ms <= 10000 && !pauseWaits) queueMicrotask(() => { if (timers.has(id)) { timers.delete(id); fn(); } });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, init) => {
      requests.push({ url, init });
      if (fetchImpl) return fetchImpl(url, init, context);
      const parsed = new URL(url);
      const kind = parsed.pathname.split('/').at(-2);
      const page = pages?.[`${kind}:${parsed.searchParams.get('max_id') || ''}`] || { users: [], has_more: false };
      return { ok: true, json: async () => page };
    },
  });
  context.URL = class extends URL {
    static createObjectURL(blob) { const key = `blob:local-${blobs.size}`; blobs.set(key, blob); return key; }
    static revokeObjectURL(key) { blobs.delete(key); }
  };
  return {
    context, requests, downloads, blobs, logs,
    run() { return vm.runInContext(script, context); },
    fireTimer(ms) { for (const [id, timer] of timers) if (timer.ms === ms) { timers.delete(id); timer.fn(); return; } throw new Error(`No ${ms}ms timer`); }
  };
}

test('scanner contains one explicit GET and no UI, mutation endpoints, remote avatars or storage', () => {
  assert.equal((script.match(/\bfetch\(/g) || []).length, 1);
  assert.match(script, /method: 'GET'/);
  for (const pattern of [/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i, /\/unfollow\//, /dicebear/i, /csrftoken/, /innerHTML\s*=/, /createElement\(['"](?:div|img|style)/, /localStorage/, /sendBeacon/, /new\s+XMLHttpRequest\s*\(/, /eval\(/]) assert.doesNotMatch(script, pattern);
});

test('console scan paginates both lists, matches follower identities and downloads CSV automatically', async () => {
  const h = harness({ pages: {
    'followers:': { users: [raw(1, 'alice')], has_more: true, next_max_id: 'page/2?x=1' },
    'followers:page/2?x=1': { users: [{ pk_id: '2', username: 'BOB' }], has_more: false },
    'following:': { users: [raw('1', 'alice'), raw('3', 'carol')], has_more: true, next_max_id: 'next' },
    'following:next': { users: [raw('2', 'bob'), raw('4', 'dave'), raw('4', 'dave')], has_more: false },
  } });
  const result = plain(await h.run());
  assert.equal(result.status, 'complete'); assert.equal(result.count, 2);
  assert.equal(h.requests.length, 4); assert.equal(h.downloads.length, 1);
  assert.equal(h.downloads[0].removed, true);
  for (const { url, init } of h.requests) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://www.instagram.com');
    assert.match(parsed.pathname, /^\/api\/v1\/friendships\/123\/(followers|following)\/$/);
    assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error');
    assert.equal(init.body, undefined); assert.equal(init.headers['X-CSRFToken'], undefined);
  }
  assert.deepEqual(plain(h.context.InstagramUnfollowers.results).map(user => user.username), ['carol', 'dave']);
  const csv = await h.blobs.get(h.downloads[0].href).text();
  assert.match(csv, /"carol"/); assert.match(csv, /https:\/\/www.instagram.com\/dave\//); assert.doesNotMatch(csv, /"alice"|"bob"/);
  assert.equal(h.context.InstagramUnfollowers.running, false);
});

test('empty lists produce a header-only CSV', async () => {
  const h = harness(); const result = await h.run();
  assert.equal(result.status, 'complete'); assert.equal(result.count, 0); assert.equal(h.downloads.length, 1);
  const csv = await h.blobs.get(h.downloads[0].href).text();
  assert.equal(csv.split('\r\n').length, 1);
});

test('numeric usernames do not collide with other users numeric account IDs', async () => {
  const h = harness({ pages: { 'following:': { users: [raw('1', '2'), raw('2', 'other')], has_more: false } } });
  assert.equal((await h.run()).count, 2);
});

test('CSV preserves Unicode, quotes, commas, hashes, newlines and neutralizes formulas', async () => {
  const h = harness({ pages: { 'following:': { users: [raw('1', 'alice', { full_name: '=HYPERLINK("https://example.invalid")' }), raw('2', 'bob', { full_name: 'José, "Bob" #1\nNext line' })], has_more: false } } });
  await h.run(); const csv = await h.blobs.get(h.downloads[0].href).text();
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example.invalid""\)"/);
  assert.match(csv, /"José, ""Bob"" #1\nNext line"/);
});

test('console search, filtering, whitelist and additional CSV/JSON exports work', async () => {
  const h = harness({ pages: { 'following:': { users: [raw('1', 'alice', { full_name: 'Ada Example', is_verified: true }), raw('2', 'bob', { is_private: true, profile_pic_url: 'photo' }), raw('3', 'carol', { profile_pic_url: 'photo' })], has_more: false } } });
  await h.run(); const api = h.context.InstagramUnfollowers;
  assert.deepEqual(plain(api.search('ADA')).map(user => user.username), ['alice']);
  assert.deepEqual(plain(api.filter({ includePrivate: false, includeVerified: false })).map(user => user.username), ['carol']);
  assert.equal(api.filter({ includeWithoutPicture: false }).length, 2);
  api.setWhitelist(['@BOB']); assert.equal(api.filter().length, 2); assert.equal(api.filter({ whitelisted: true })[0].username, 'bob');
  api.exportCSV({ search: 'carol' }); api.exportJSON({ search: 'alice' });
  assert.equal(h.downloads.length, 3);
  assert.equal(JSON.parse(await h.blobs.get(h.downloads[2].href).text())[0].username, 'alice');
  api.results[0].username = 'modified'; assert.equal(api.results[0].username, 'alice');
});

test('wrong origin or logged-out account makes no network request', async () => {
  for (const options of [{ hostname: 'example.com' }, { account: '' }]) {
    const h = harness(options); await h.run(); assert.equal(h.requests.length, 0); assert.equal(h.downloads.length, 0);
    assert.ok(h.logs.some(log => log.kind === 'error'));
  }
});

test('HTTP 429 stops immediately without exporting a complete CSV', async () => {
  const h = harness({ fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal((await h.run()).status, 'incomplete'); assert.equal(h.requests.length, 1); assert.equal(h.downloads.length, 0);
  assert.match(h.context.InstagramUnfollowers.error, /429/);
  assert.throws(() => h.context.InstagramUnfollowers.exportCSV(), /incomplete/);
});

test('invalid API responses and missing pagination cursors fail without downloading', async () => {
  for (const page of [{ status: 'fail', message: 'checkpoint_required' }, { users: [raw('1', 'alice')], has_more: true }, { users: [{ pk: 1 }], has_more: false }]) {
    const h = harness({ pages: { 'followers:': page } });
    assert.equal((await h.run()).status, 'incomplete'); assert.equal(h.downloads.length, 0);
  }
});

test('repeated pagination cursors stop rather than loop or export incomplete results', async () => {
  const h = harness({ pages: { 'followers:': { users: [raw('1', 'alice')], has_more: true, next_max_id: 'same' }, 'followers:same': { users: [raw('1', 'alice')], has_more: true, next_max_id: 'same' } } });
  assert.equal((await h.run()).status, 'incomplete'); assert.equal(h.requests.length, 2); assert.equal(h.downloads.length, 0);
  assert.match(h.context.InstagramUnfollowers.error, /repeated/);
});

test('an account switch during the scan stops without downloading', async () => {
  const h = harness({ fetchImpl: async (_url, _init, context) => { context.document.cookie = 'ds_user_id=456'; return { ok: true, json: async () => ({ users: [], has_more: false }) }; } });
  assert.equal((await h.run()).status, 'incomplete'); assert.equal(h.downloads.length, 0);
  assert.match(h.context.InstagramUnfollowers.error, /account changed/);
});

test('cancellation interrupts a pending fetch and duplicate paste cannot start another scan', async () => {
  const h = harness({ fetchImpl: async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })) });
  const scan = h.run(); assert.equal(h.context.InstagramUnfollowers.running, true);
  await h.run(); assert.equal(h.requests.length, 1);
  h.context.InstagramUnfollowers.cancel(); assert.equal((await scan).status, 'incomplete'); assert.equal(h.downloads.length, 0);
  assert.equal(h.context.InstagramUnfollowers.running, false);
});

test('timed-out requests stop with an explicit console error', async () => {
  const h = harness({ fetchImpl: async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })) });
  const scan = h.run(); h.fireTimer(30000);
  assert.equal((await scan).status, 'incomplete'); assert.match(h.context.InstagramUnfollowers.error, /timed out/); assert.equal(h.downloads.length, 0);
});

function siteHarness(denied = false, reducedMotion = false) {
  const elements = new Map(), timers = new Map(); let timerId = 0, copied;
  for (const id of ['copy', 'copy-label', 'select', 'source', 'copy-status', 'source-details', 'code-size', 'copy-dialog', 'close-dialog', 'dialog-done']) {
    const classes = new Set();
    elements.set(id, {
      disabled: true, open: false, events: {},
      classList: { add: cls => classes.add(cls), remove: cls => classes.delete(cls), contains: cls => classes.has(cls) },
      addEventListener(event, handler) { this.events[event] = handler; }, focus() { this.focused = true; }, select() { this.selected = true; },
      showModal() { this.open = true; }, close() { this.open = false; },
      getBoundingClientRect() { return { left: 10, right: 100, top: 10, bottom: 100 }; },
    });
  }
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id) }, TextEncoder,
    window: { matchMedia: () => ({ matches: reducedMotion }) },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    fetch: async (_url, init) => { assert.equal(init.method, 'GET'); return { ok: true, text: async () => script }; },
    navigator: { clipboard: { writeText: async text => { if (denied) throw new Error('denied'); copied = text; } } },
  });
  return { elements, context, run: () => vm.runInContext(site, context), get copied() { return copied; },
    fireTimer(ms) { for (const [id, timer] of timers) if (timer.ms === ms) { timers.delete(id); timer.fn(); return; } throw new Error('missing timer'); } };
}

test('landing page copies exact source and opens animated success confirmation', async () => {
  const h = siteHarness(); await h.run(); await h.elements.get('copy').events.click();
  assert.equal(h.copied, script); assert.equal(h.elements.get('source').value, script);
  assert.equal(h.elements.get('copy-dialog').open, true); assert.equal(h.elements.get('copy-label').textContent, 'Copied');
  assert.equal(h.elements.get('copy').classList.contains('is-copied'), true);
  h.elements.get('dialog-done').events.click(); assert.equal(h.elements.get('copy-dialog').classList.contains('closing'), true);
  h.fireTimer(180); assert.equal(h.elements.get('copy-dialog').open, false); assert.equal(h.elements.get('copy').focused, true);
});

test('clipboard failure selects the source without showing false success', async () => {
  const h = siteHarness(true); await h.run(); await h.elements.get('copy').events.click();
  assert.equal(h.elements.get('copy-dialog').open, false); assert.equal(h.elements.get('source').selected, true);
  assert.match(h.elements.get('copy-status').textContent, /Clipboard access is unavailable/);
});

test('Escape and outside click close confirmation and reduced motion skips exit delay', async () => {
  const h = siteHarness(false, true); await h.run(); await h.elements.get('copy').events.click();
  let prevented = false;
  h.elements.get('copy-dialog').events.cancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true); h.fireTimer(0); assert.equal(h.elements.get('copy-dialog').open, false);
  await h.elements.get('copy').events.click();
  h.elements.get('copy-dialog').events.click({ target: h.elements.get('copy-dialog'), clientX: 5, clientY: 5 });
  h.fireTimer(0); assert.equal(h.elements.get('copy-dialog').open, false);
});

test('landing page never executes scanner text and copy confirmation supports reduced motion', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../assets/site.css'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=["']assets\/scanner\.js/);
  assert.doesNotMatch(site, /\beval\s*\(|new Function|\.innerHTML\s*=/);
  assert.match(html, /<dialog[^>]+aria-labelledby="copied-title"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('reassigned usernames cannot override differing stable account IDs', async () => {
  const h = harness({ pages: { 'followers:': { users: [raw('1', 'alice')], has_more: false }, 'following:': { users: [raw('2', 'alice')], has_more: false } } });
  assert.equal((await h.run()).count, 1);
  assert.equal(h.context.InstagramUnfollowers.results[0].id, '2');
});

test('download exceptions preserve completed results and remove the hidden link', async () => {
  const h = harness({ pages: { 'following:': { users: [raw('1', 'alice')], has_more: false } } });
  const create = h.context.document.createElement;
  let anchor;
  h.context.document.createElement = type => {
    anchor = create(type);
    anchor.click = () => { throw new Error('Download blocked'); };
    return anchor;
  };
  const result = plain(await h.run());
  assert.equal(result.status, 'complete'); assert.equal(result.csv, null);
  assert.equal(h.context.InstagramUnfollowers.complete, true); assert.equal(h.context.InstagramUnfollowers.results.length, 1);
  assert.equal(anchor.removed, true); assert.equal(h.blobs.size, 0);
  assert.ok(h.logs.some(log => log.kind === 'error' && log.values[0].includes('Retry with InstagramUnfollowers.exportCSV()')));
});

test('a clipboard denial after success resets success styling and exposes selected fallback', async () => {
  const h = siteHarness(); await h.run(); await h.elements.get('copy').events.click();
  assert.equal(h.elements.get('copy').classList.contains('is-copied'), true);
  h.elements.get('dialog-done').events.click(); h.fireTimer(180);
  h.context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await h.elements.get('copy').events.click();
  assert.equal(h.elements.get('copy').classList.contains('is-copied'), false);
  assert.equal(h.elements.get('copy-dialog').open, false); assert.equal(h.elements.get('source').selected, true);
});
