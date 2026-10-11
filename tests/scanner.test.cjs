'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../assets/scanner.js'), 'utf8');

function harness({ fetchResult, account = '123', stateOverride } = {}) {
  const requests = [], downloads = [], blobs = new Map(), stored = new Map(), effects = [], hooks = [];
  let hookIndex = 0;
  const fakeReact = {
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } }; },
    Fragment: 'fragment',
    useState(initial) {
      const index = hookIndex++;
      if (!(index in hooks)) hooks[index] = index === 0 && stateOverride ? stateOverride : typeof initial === 'function' ? initial() : initial;
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
    },
    useEffect(fn) { effects.push(fn); },
    useRef(value) { return { current: value }; },
    render(node) { context.root = node; },
  };
  const body = { appendChild() {}, innerHTML: '' };
  const context = vm.createContext({
    fakeReact, console, URL, URLSearchParams, Blob, Set, Map,
    setTimeout(fn) { fn(); return 1; }, clearTimeout() {},
    alert() {}, confirm() { return true; },
    location: { hostname: 'www.instagram.com', search: '', reload() {} },
    navigator: { language: 'en', clipboard: { writeText: async text => { context.copied = text; } } },
    document: {
      cookie: account ? `ds_user_id=${account}; unrelated=secret` : '', body,
      querySelector() { return { appendChild() {} }; },
      createElement(type) {
        const element = { type, attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, appendChild() {}, remove() {}, click() { downloads.push(this); } };
        return element;
      },
      createTextNode(text) { return { text }; },
    },
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    fetch: async (url, init) => { requests.push({ url, init }); return fetchResult || { ok: true, json: async () => ({ users: [], status: 'ok' }) }; },
  });
  context.window = { addEventListener() {}, removeEventListener() {} };
  context.URL = class extends URL {
    static createObjectURL(blob) { const key = `blob:test-${blobs.size}`; blobs.set(key, blob); return key; }
    static revokeObjectURL() {}
  };
  const exposed = script.replace('n.nc=void 0,n(221)', 'n.nc=void 0,e[763]=function(e){e.exports=fakeReact},globalThis.modules=n,globalThis.avatar=localAvatar');
  assert.notEqual(exposed, script);
  vm.runInContext(exposed, context);
  return { context, utils: context.modules(135), requests, downloads, blobs, stored, effects, hooks,
    resetHooks() { hookIndex = 0; effects.length = 0; } };
}
const user = (id, username, extra = {}) => ({ id, username, full_name: username, is_private: false, is_verified: false, follows_viewer: false, profile_pic_url: 'https://instagram.example/photo.jpg', ...extra });
const filters = { showPrivate: true, showVerified: true, showWithOutProfilePicture: true };
const plain = value => JSON.parse(JSON.stringify(value));
const treeNodes = node => {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.props?.children || []).flatMap(treeNodes)];
};

test('bundle has one explicit GET reader and no mutation or third-party avatar code', () => {
  assert.equal((script.match(/fetch\(/g) || []).length, 1);
  assert.match(script, /method:"GET"/);
  for (const prohibited of [/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i, /\/unfollow\//, /unfollowUserUrlGenerator/, /dicebear/i, /csrftoken/, /className:"unfollow"/, /status:"unfollowing"/, /sendBeacon/, /XMLHttpRequest\(/, /WebSocket\(/]) assert.doesNotMatch(script, prohibited);
});

test('reader requests only followers/following with GET and fails on API errors', async () => {
  const h = harness();
  await h.utils.fetchFriendshipsPage('followers', undefined, 50);
  await h.utils.fetchFriendshipsPage('following', 'page/next?foo=bar', 50);
  assert.equal(h.requests.length, 2);
  for (const { url, init } of h.requests) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://www.instagram.com');
    assert.match(parsed.pathname, /^\/api\/v1\/friendships\/123\/(followers|following)\/$/);
    assert.equal(init.method, 'GET');
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.redirect, 'error');
    assert.equal(init.body, undefined);
    assert.equal(init.headers['X-CSRFToken'], undefined);
  }
  assert.equal(new URL(h.requests[1].url).searchParams.get('max_id'), 'page/next?foo=bar');
  assert.throws(() => h.utils.friendshipsUrlGenerator('unfollow'), /Invalid reader/);
  assert.throws(() => harness({ account: '' }).utils.friendshipsUrlGenerator('followers'), /logged-out/);
  assert.throws(() => h.utils.friendshipsUrlGenerator('followers', undefined, 50, '123/../write'), /Invalid reader/);
  const failed = harness({ fetchResult: { ok: false, status: 429 } });
  await assert.rejects(failed.utils.fetchFriendshipsPage('followers'), /HTTP 429/);
});

test('follower comparison handles pk, pk_id, id and normalized usernames', () => {
  const { utils } = harness();
  const index = utils.createFollowerIndex();
  utils.addFollowerToIndex(index, { pk: 1, username: 'Alice' });
  utils.addFollowerToIndex(index, { pk_id: '2', username: 'bob' });
  assert.equal(utils.isUserInFollowerIndex(index, { id: '1' }), true);
  assert.equal(utils.isUserInFollowerIndex(index, { pk: '2' }), true);
  assert.equal(utils.isUserInFollowerIndex(index, { username: ' ALICE ' }), true);
  assert.equal(utils.isUserInFollowerIndex(index, { pk: '3', username: 'charlie' }), false);
});

test('original filtering, search, whitelist tabs and pagination remain functional', () => {
  const { utils } = harness();
  const users = [user('1', 'alice', { full_name: 'Ada Example' }), user('2', 'bob', { is_private: true }), user('3', 'carol', { is_verified: true }), user('4', 'dave', { profile_pic_url: '' }), user('5', 'eve', { follows_viewer: true })];
  const displayed = (filter = filters, term = '', tab = 'non_whitelisted', whitelist = []) => plain(utils.getUsersForDisplay(users, whitelist, tab, term, filter)).map(u => u.username);
  assert.deepEqual(displayed(), ['alice', 'bob', 'carol', 'dave']);
  assert.deepEqual(displayed({ ...filters, showPrivate: false }), ['alice', 'carol', 'dave']);
  assert.deepEqual(displayed({ ...filters, showVerified: false }), ['alice', 'bob', 'dave']);
  assert.deepEqual(displayed({ ...filters, showWithOutProfilePicture: false }), ['alice', 'bob', 'carol']);
  assert.deepEqual(displayed(filters, 'ADA'), ['alice']);
  assert.deepEqual(displayed(filters, 'BO'), ['bob']);
  assert.deepEqual(displayed(filters, '', 'non_whitelisted', [users[0]]), ['bob', 'carol', 'dave']);
  assert.deepEqual(displayed(filters, '', 'whitelisted', [users[0]]), ['alice']);
  assert.equal(utils.getCurrentPageUnfollowers(Array.from({ length: 51 }, (_, i) => user(String(i), `user${String(i).padStart(2, '0')}`)), 2).length, 1);
});

test('all avatars are local data URIs and cannot inject SVG markup', () => {
  const h = harness();
  for (const name of ['alice', '<script>', 'é', '', '5ive']) {
    const url = h.context.avatar(name);
    assert.match(url, /^data:image\/svg\+xml/);
    const svg = decodeURIComponent(url.split(',')[1]);
    assert.doesNotMatch(svg, /<script>|<image|href=/);
  }
  assert.equal(h.requests.length, 0);
});

test('JSON, clipboard and CSV exports work; CSV handles punctuation and formulas', async () => {
  const h = harness();
  const users = [user('1', 'alice', { full_name: '=HYPERLINK("https://example.invalid")' }), user('2', 'bob', { full_name: 'José, "Bob" #1\nNext line' })];
  h.utils.exportToJSON(users);
  const jsonLink = h.downloads.at(-1);
  assert.deepEqual(JSON.parse(decodeURIComponent(jsonLink.attrs.href.split(',')[1])), users);
  await h.utils.copyListToClipboard(users, 'Copied');
  assert.match(h.context.copied, /alice/);
  assert.match(h.context.copied, /bob/);
  h.utils.exportToCSV(users);
  const csvLink = h.downloads.at(-1);
  const csv = await h.blobs.get(csvLink.href).text();
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example.invalid""\)"/);
  assert.match(csv, /"José, ""Bob"" #1\nNext line"/);
  assert.equal(csvLink.download, 'instagram_unfollowers.csv');
  assert.equal(h.requests.length, 0);
});

test('result UI has filters and whitelist controls but no unfollow action or remote images', () => {
  const h = harness();
  const state = { status: 'scanning', percentage: 100, results: [user('1', 'alice')], selectedResults: [user('1', 'alice')], whitelistedResults: [], currentTab: 'non_whitelisted', searchTerm: '', filter: filters, page: 1, isScanningActive: false };
  const tree = h.context.modules(43).Searching({ state, lang: 'en', setState() {}, UserCheckIcon() {}, UserUncheckIcon() {} });
  const nodes = treeNodes(tree);
  assert.equal(nodes.filter(n => n.type === 'img').length, 1);
  assert.match(nodes.find(n => n.type === 'img').props.src, /^data:/);
  assert.equal(nodes.filter(n => n.type === 'input' && n.props.name).length, 3);
  assert.ok(nodes.some(n => n.type === 'button' && String(n.props.className).includes('whitelist')));
  assert.equal(nodes.some(n => n.props.className === 'unfollow'), false);
  const settings = h.context.modules(18).SettingMenu({ currentTimings: { timeBetweenSearchCycles: 1000, timeToWaitAfterFiveSearchCycles: 10000, usersPerSearchCycle: 50 }, whitelistedUsers: [], lang: 'en' });
  assert.equal(treeNodes(settings).some(n => /unfollow/i.test(n.props.id || '')), false);
});

test('scan cache and whitelist are isolated per Instagram account', () => {
  for (const account of ['123', '456']) {
    const h = harness({ account });
    const store = h.context.modules(717);
    store.saveWhitelist([user('1', 'alice')]);
    store.saveCachedScanResults([user('2', 'bob')]);
    for (const key of h.stored.keys()) assert.match(key, new RegExp(`^iu_readonly_.*_${account}$`));
    assert.equal(store.loadWhitelist()[0].username, 'alice');
    assert.equal(store.loadCachedScanResults().results[0].username, 'bob');
  }
});

test('landing page copies scanner source without executing it', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../assets/site.js'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=["']assets\/scanner\.js/);
  assert.match(js, /response\.text\(\)/);
  assert.match(js, /clipboard\.writeText\(code\)/);
  assert.doesNotMatch(js, /\beval\s*\(|new Function|\.innerHTML\s*=/);
});

test('full scan reads paginated follower/following lists and returns only non-followers', async () => {
  const h = harness();
  const responses = {
    'followers:': { users: [{ pk: 1, username: 'alice' }], next_max_id: 'next', has_more: true },
    'followers:next': { users: [{ pk_id: '2', username: 'bob' }], has_more: false },
    'following:': { users: [{ pk: '1', username: 'alice' }, { pk: '3', username: 'carol' }], next_max_id: 'next', has_more: true },
    'following:next': { users: [{ pk: '2', username: 'bob' }, { pk: '4', username: 'dave' }], has_more: false },
  };
  h.context.fetch = async (url, init) => {
    h.requests.push({ url, init });
    const parsed = new URL(url);
    const type = parsed.pathname.split('/').at(-2);
    const page = responses[`${type}:${parsed.searchParams.get('max_id') || ''}`];
    assert.ok(page);
    return { ok: true, json: async () => page };
  };
  h.context.modules(221);
  assert.equal(typeof h.context.root.type, 'function');
  h.resetHooks();
  let tree = h.context.root.type({});
  const launchNode = treeNodes(tree).find(n => n.props.onScan);
  assert.ok(launchNode);
  await launchNode.props.onScan();
  assert.equal(h.hooks[0].status, 'scanning');
  h.resetHooks();
  tree = h.context.root.type({});
  for (const effect of h.effects) effect();
  // Drain the scanner's asynchronous state machine without real timers or a live account.
  for (let i = 0; i < 100; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.requests.length, 4);
  assert.ok(h.requests.every(r => r.init.method === 'GET'));
  assert.deepEqual(plain(h.hooks[0].results).map(u => u.username), ['carol', 'dave']);
  assert.equal(h.hooks[0].scanIncomplete, false);
  assert.equal(h.hooks[0].isScanningActive, false);
  assert.equal(h.hooks[0].percentage, 100);
  assert.equal(h.context.modules(717).loadCachedScanResults().results.length, 2);
});

test('interrupted following scan remains partial and is not saved as a complete cache', async () => {
  const h = harness();
  h.context.console = { ...console, error() {} };
  h.context.fetch = async (url, init) => {
    h.requests.push({ url, init });
    const parsed = new URL(url);
    if (parsed.searchParams.has('max_id')) return { ok: false, status: 429 };
    if (parsed.pathname.includes('/followers/')) return { ok: true, json: async () => ({ users: [], has_more: false }) };
    return { ok: true, json: async () => ({ users: [{ pk: '3', username: 'carol' }], next_max_id: 'blocked-page', has_more: true }) };
  };
  h.context.modules(221);
  h.resetHooks();
  const initialTree = h.context.root.type({});
  await treeNodes(initialTree).find(n => n.props.onScan).props.onScan();
  h.resetHooks();
  h.context.root.type({});
  for (const effect of h.effects) effect();
  for (let i = 0; i < 100; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.hooks[0].scanIncomplete, true);
  assert.equal(h.hooks[0].isScanningActive, false);
  assert.deepEqual(plain(h.hooks[0].results).map(u => u.username), ['carol']);
  assert.equal(h.context.modules(717).loadCachedScanResults(), null);
  assert.ok(h.requests.every(r => r.init.method === 'GET'));
});

for (const denied of [false, true]) test(`landing page ${denied ? 'selects source when clipboard is denied' : 'copies the complete scanner source'}`, async () => {
  const elements = new Map();
  for (const id of ['copy', 'select', 'source', 'copy-status', 'source-details', 'code-size']) {
    elements.set(id, { disabled: true, events: {}, addEventListener(event, handler) { this.events[event] = handler; }, focus() { this.focused = true; }, select() { this.selected = true; } });
  }
  const requests = [];
  let copied;
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id) }, TextEncoder,
    fetch: async (url, init) => { requests.push({ url, init }); return { ok: true, text: async () => script }; },
    navigator: { clipboard: { writeText: async text => { if (denied) throw new Error('denied'); copied = text; } } },
  });
  await vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/site.js'), 'utf8'), context);
  assert.equal(elements.get('source').value, script);
  assert.equal(elements.get('copy').disabled, false);
  assert.equal(requests[0].init.method, 'GET');
  await elements.get('copy').events.click();
  if (denied) {
    assert.equal(elements.get('source').selected, true);
    assert.equal(elements.get('source-details').open, true);
  } else assert.equal(copied, script);
});
