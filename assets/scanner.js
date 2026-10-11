/*! Instagram Unfollowers — console-only, read-only scanner. MIT License. */
(async () => {
  'use strict';

  const PREFIX = '[Instagram Unfollowers]';
  if (location.hostname !== 'www.instagram.com') {
    console.error(`${PREFIX} Open https://www.instagram.com/ and run this in that tab's console.`);
    return;
  }
  if (globalThis.InstagramUnfollowers?.running) {
    console.warn(`${PREFIX} A scan is already running. Use InstagramUnfollowers.cancel() to stop it.`);
    return;
  }
  const accountId = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)(?:;|$)/)?.[1];
  if (!accountId) {
    console.error(`${PREFIX} No signed-in Instagram account found. Log in, then run the script again.`);
    return;
  }

  const controller = new AbortController();
  const config = { pageSize: 50, delayMs: 1500, restEvery: 5, restMs: 10000, maxPages: 250, timeoutMs: 30000 };
  const state = { running: true, complete: false, results: [], error: null };
  const whitelist = new Set();
  const imageDefaults = ['44884218_345707102882519_2446069589734326272_n', '464760996_1254146839119862_3605321457742435801_n'];

  function checkAccount() {
    controller.signal.throwIfAborted();
    const current = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)(?:;|$)/)?.[1];
    if (current !== accountId) throw new Error('The signed-in account changed during the scan. Run again in the intended account.');
  }
  function identities(user) {
    return [user.pk, user.pk_id, user.id].filter(value => value != null && String(value).trim()).map(value => String(value).trim());
  }
  function normalize(user) {
    const id = identities(user)[0];
    const username = String(user.username || '').trim();
    if (!id || !/^[a-zA-Z0-9._]+$/.test(username)) throw new Error('Instagram returned an account with missing or invalid identity data.');
    return {
      id, username, full_name: String(user.full_name || ''),
      is_private: Boolean(user.is_private), is_verified: Boolean(user.is_verified),
      profile_pic_url: String(user.profile_pic_url || '')
    };
  }
  function wait(ms) {
    return new Promise((resolve, reject) => {
      controller.signal.throwIfAborted();
      const abort = () => { clearTimeout(timer); reject(controller.signal.reason); };
      const timer = setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(); }, ms);
      controller.signal.addEventListener('abort', abort, { once: true });
    });
  }
  async function readPage(kind, cursor) {
    checkAccount();
    if (!['followers', 'following'].includes(kind)) throw new Error('Invalid reader endpoint.');
    const url = new URL(`https://www.instagram.com/api/v1/friendships/${accountId}/${kind}/`);
    url.searchParams.set('count', String(config.pageSize));
    if (cursor !== undefined) url.searchParams.set('max_id', cursor);
    const timeout = new AbortController();
    const abort = () => timeout.abort(controller.signal.reason);
    controller.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => timeout.abort(new Error('Instagram request timed out.')), config.timeoutMs);
    try {
      const response = await fetch(url.href, {
        method: 'GET', credentials: 'same-origin', redirect: 'error', signal: timeout.signal,
        headers: { 'X-IG-App-ID': '936619743392459', 'X-ASBD-ID': '129477', 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error('Instagram rate-limited the scan (HTTP 429). Stop and try later.');
        throw new Error(`Instagram returned HTTP ${response.status}. The scan could not finish.`);
      }
      const data = await response.json();
      if (data.status === 'fail' || !Array.isArray(data.users)) throw new Error(data.message || 'Instagram returned an unexpected response.');
      checkAccount();
      return data;
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', abort);
    }
  }
  async function readList(kind, onUsers) {
    const cursors = new Set();
    let cursor, count = 0;
    for (let page = 1; page <= config.maxPages; page++) {
      const data = await readPage(kind, cursor);
      onUsers(data.users);
      count += data.users.length;
      console.log(`${PREFIX} ${kind}: ${count} entries read · page ${page}`);
      const next = data.next_max_id;
      if (data.has_more === false || next == null || next === '') {
        if (data.has_more === true) throw new Error(`Instagram omitted the next ${kind} page cursor. Results are incomplete.`);
        return count;
      }
      if (!data.users.length) throw new Error(`Instagram returned an empty ${kind} page with more pages remaining.`);
      if (cursors.has(String(next))) throw new Error(`Instagram repeated a ${kind} page cursor. Results are incomplete.`);
      cursors.add(String(next));
      cursor = String(next);
      if (page === config.maxPages) throw new Error(`The ${kind} list exceeded the ${config.maxPages}-page safety limit.`);
      await wait(page % config.restEvery === 0 ? config.restMs : config.delayMs);
    }
  }
  function find(options = {}) {
    const term = String(options.search || '').toLowerCase();
    return state.results.filter(user => {
      if (options.includePrivate === false && user.is_private) return false;
      if (options.includeVerified === false && user.is_verified) return false;
      if (options.includeWithoutPicture === false && (!user.profile_pic_url || imageDefaults.some(value => user.profile_pic_url.includes(value)))) return false;
      const listed = whitelist.has(user.username.toLowerCase());
      if (options.whitelisted === true && !listed) return false;
      if (options.whitelisted !== true && listed) return false;
      return !term || user.username.toLowerCase().includes(term) || user.full_name.toLowerCase().includes(term);
    });
  }
  function download(text, mime, extension) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `instagram_nonfollowers_${accountId}_${new Date().toISOString().slice(0, 10)}.${extension}`;
    link.hidden = true;
    // A transient hidden download link; no scanner interface or Instagram page replacement.
    let requested = false;
    try {
      document.body.appendChild(link);
      link.click();
      requested = true;
      return link.download;
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), requested ? 60000 : 0);
    }
  }
  function exportCSV(options = {}) {
    if (!state.complete) throw new Error('The scan is incomplete. No CSV is exported as a complete result.');
    const fields = ['id', 'username', 'full_name', 'is_verified', 'is_private', 'profile_url'];
    const cell = value => {
      let text = String(value ?? '');
      if (/^[\t\r\n ]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [fields.map(cell).join(',')];
    for (const user of find(options)) {
      const values = { ...user, profile_url: `https://www.instagram.com/${user.username}/` };
      lines.push(fields.map(field => cell(values[field])).join(','));
    }
    return download('\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8', 'csv');
  }
  function exportJSON(options = {}) {
    if (!state.complete) throw new Error('The scan is incomplete.');
    return download(JSON.stringify(find(options), null, 2), 'application/json', 'json');
  }
  globalThis.InstagramUnfollowers = {
    get running() { return state.running; }, get complete() { return state.complete; },
    get results() { return state.results.map(user => ({ ...user })); }, get error() { return state.error; },
    cancel() { controller.abort(new Error('Scan cancelled.')); },
    search(term) { return find({ search: term }).map(user => ({ ...user })); },
    filter(options) { return find(options).map(user => ({ ...user })); },
    setWhitelist(usernames) {
      if (!Array.isArray(usernames)) throw new Error('Pass an array of usernames.');
      whitelist.clear();
      usernames.forEach(name => whitelist.add(String(name).replace(/^@/, '').trim().toLowerCase()));
      return whitelist.size;
    },
    exportCSV, exportJSON
  };

  console.log(`${PREFIX} Starting read-only scan. Keep this Instagram tab open. CSV downloads automatically when complete.`);
  try {
    const followerIds = new Set(), seenFollowingIds = new Set();
    await readList('followers', users => {
      for (const raw of users) {
        normalize(raw);
        identities(raw).forEach(id => followerIds.add(id));
      }
    });
    // Space reads between the two lists as well as between pages.
    await wait(config.delayMs);
    await readList('following', users => {
      for (const raw of users) {
        const user = normalize(raw);
        const ids = identities(raw);
        if (ids.some(id => seenFollowingIds.has(id))) continue;
        ids.forEach(id => seenFollowingIds.add(id));
        if (!ids.some(id => followerIds.has(id))) state.results.push(user);
      }
    });
    state.results.sort((a, b) => a.username.localeCompare(b.username));
    state.complete = true;
    const filename = exportCSV();
    console.log(`${PREFIX} Complete: ${state.results.length} accounts do not follow you back. CSV download requested: ${filename}`);
    console.log(`${PREFIX} Results: InstagramUnfollowers.results · Search: InstagramUnfollowers.search('name')`);
    return { status: 'complete', count: state.results.length, csv: filename };
  } catch (error) {
    state.error = error?.message || String(error);
    if (state.complete) {
      console.error(`${PREFIX} Scan complete (${state.results.length} matches), but the CSV download failed: ${state.error} Retry with InstagramUnfollowers.exportCSV().`);
      return { status: 'complete', count: state.results.length, csv: null, error: state.error };
    }
    console.error(`${PREFIX} Stopped: ${state.error} No complete CSV was downloaded. Partial matches remain in InstagramUnfollowers.results.`);
    return { status: 'incomplete', count: state.results.length, error: state.error };
  } finally {
    state.running = false;
  }
})();
