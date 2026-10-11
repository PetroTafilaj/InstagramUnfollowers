#!/usr/bin/env python3
"""Apply fail-closed edits to the exact user-provided upstream bundle.
Usage: python3 scripts/patch-bundle.py /path/to/original-bundle.txt
The original bundle is intentionally not distributed with the read-only project.
"""
from pathlib import Path
import hashlib
import re
import sys

EXPECTED = '0b868bc25530bc78338885b2f924b8410f79a7ce7888070a73659b18e907720f'
source = Path(sys.argv[1]).read_text()
if hashlib.sha256(source.encode()).hexdigest() != EXPECTED:
    raise SystemExit('Unexpected input bundle. Review patches before updating the pinned hash.')
s = source

def replace(old, new, count=1):
    global s
    actual = s.count(old)
    if actual != count:
        raise ValueError(f'Expected {count} occurrences, got {actual}: {old[:100]}')
    s = s.replace(old, new)

def matching(text, start, opening='(', closing=')'):
    # These selected bundle calls contain string literals but no regex with parentheses.
    assert text[start] == opening
    depth, quote, escaped = 0, None, False
    for pos in range(start, len(text)):
        ch = text[pos]
        if quote:
            if escaped: escaped = False
            elif ch == '\\': escaped = True
            elif ch == quote: quote = None
        elif ch in "\"'`": quote = ch
        elif ch == opening: depth += 1
        elif ch == closing:
            depth -= 1
            if depth == 0: return pos + 1
    raise ValueError('Unbalanced expression')

def replace_call_at(start, callee, replacement='null'):
    global s
    assert s.startswith(callee, start)
    end = matching(s, start + len(callee))
    s = s[:start] + replacement + s[end:]

# Remove the entire effect which performed authenticated account mutations.
p = s.index('if("unfollowing"!==n.status')
start = s.rfind('(0,d.useEffect)', 0, p)
replace_call_at(start, '(0,d.useEffect)', 'void 0')

# Remove the control, not just its handler or CSS visibility.
start = s.index('o.default.createElement("button",{className:"unfollow"')
replace_call_at(start, 'o.default.createElement')

# Delete the mutation URL generator and unused history filtering helper.
start = s.index('t.unfollowUserUrlGenerator=function')
end = s.index(',t.friendshipsUrlGenerator=', start)
s = s[:start] + s[end + 1:]
start = s.index('t.getUnfollowLogForDisplay=function')
end = s.index(',t.assertUnreachable=', start)
s = s[:start] + s[end + 1:]
s = s.replace('t.unfollowUserUrlGenerator=', '')
s = s.replace('t.getUnfollowLogForDisplay=', '')

# Remove the history component module and the unreachable state branches.
start = s.index('925:function(')
brace = s.index('{', start)
end = matching(s, brace, '{', '}')
s = s[:start] + '925:function(){}' + s[end:]
replace('case"unfollowing":C=n.percentage<100;break;', '')
start = s.index('case"unfollowing":A=')
end = s.index('default:', start)
s = s[:start] + s[end:]
replace('case"unfollowing":', '', count=3)
replace(',x=n(925)', '')

# Remove mutation timing controls and their state/settings fields.
for label in ['timeBetweenUnfollows', 'timeToWaitAfterFiveUnfollows']:
    p = s.index(f'(0,u.t)(d,"{label}")')
    start = s.rfind('l.default.createElement("div",{className:"row"}', 0, p)
    replace_call_at(start, 'l.default.createElement')
replace(',v=(0,l.useState)(r.timeBetweenUnfollows),w=v[0],y=v[1],x=(0,l.useState)(r.timeToWaitAfterFiveUnfollows),E=x[0],S=x[1]', '')
replace('timeBetweenUnfollows:w,timeToWaitAfterFiveUnfollows:E,', '')
replace('timeBetweenUnfollows:null!==(n=null==i?void 0:i.timeBetweenUnfollows)&&void 0!==n?n:_.DEFAULT_TIME_BETWEEN_UNFOLLOWS,timeToWaitAfterFiveUnfollows:null!==(r=null==i?void 0:i.timeToWaitAfterFiveUnfollows)&&void 0!==r?r:_.DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS,', '')
replace('t.DEFAULT_TIME_BETWEEN_UNFOLLOWS=', '', count=2)
replace('t.DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS=', '', count=2)
replace(',t.DEFAULT_TIME_BETWEEN_UNFOLLOWS=4e3', '') if ',t.DEFAULT_TIME_BETWEEN_UNFOLLOWS=4e3' in s else None
# The chained export declarations above were removed globally, leaving bare values.
replace(',4e3,3e5,t.DEFAULT_USERS_PER_SEARCH_CYCLE=', ',t.DEFAULT_USERS_PER_SEARCH_CYCLE=')

# Replace every avatar generator with a bundled data URI; never send usernames out.
replace('"https://api.dicebear.com/9.x/initials/svg?seed=".concat(encodeURIComponent(e),"&backgroundColor=0f172a,1f2937,312e81&fontFamily=Verdana")', ' localAvatar(e)', count=2)
replace('"https://api.dicebear.com/9.x/initials/svg?seed=".concat(encodeURIComponent(e))', ' localAvatar(e)')
# Display only local avatars, including imported/cached entries with untrusted image URLs.
replace('src:e.profile_pic_url', 'src:localAvatar(e.username)')

# GET needs no CSRF cookie. Keep only the reader and explicitly reject redirects.
replace('a=d("csrftoken")||"",i={', 'i={')
replace(',a&&(i["X-CSRFToken"]=a)', '')
replace('fetch(m(e,t,n,r),{credentials:"same-origin",headers:i})', 'fetch(m(e,t,n,r),{method:"GET",credentials:"same-origin",redirect:"error",headers:i})')
replace('var a=null!=r?r:d("ds_user_id"),i=', 'var a=null!=r?r:d("ds_user_id");if(!/^(following|followers)$/.test(e)||!/^\\d+$/.test(String(a)))throw new Error("Invalid reader endpoint or logged-out account");var i=')

# Only complete scans are cached, so reloading cannot present a partial list as complete.
replace('((h=p)||d.length>0)&&((0,E.saveCachedScanResults)(d)', '(h=p)&&((0,E.saveCachedScanResults)(d)')

# Quote every CSV field, preserve Unicode and punctuation, and neutralize spreadsheet formulas.
start = s.index('t.exportToCSV=function')
end = s.index(',t.getMaxPage=', start)
csv = 't.exportToCSV=' + (Path(__file__).parent / 'snippets/csv-export.js').read_text().strip()
s = s[:start] + csv + s[end:]

# Separate saved data from the upstream automation tool and between Instagram accounts.
for key in ['iu_whitelisted-results', 'iu_timings', 'iu_last-scan-results', 'iu_last-scan-time']:
    replace(f'"{key}"', f'"{key.replace("iu_", "iu_readonly_")}_"+(document.cookie.match(/(?:^|;\\s*)ds_user_id=(\\d+)/)||[])[1]')

# Remove stale mutation translations and update the launch copy in both languages.
# Values are JSON-compatible string literals; this pattern is limited to object properties.
s, removed = re.subn(r'(?<=[{,])(?:unfollow\w*|timeBetweenUnfollows|timeToWaitAfterFiveUnfollows|actionBlockedWarning|showSucceeded|showFailed|succeeded|failed):"(?:\\.|[^"\\])*",?', '', s, flags=re.I)
# Delete any trailing comma produced by removing a final translation key.
s = s.replace(',}', '}')
s = s.replace('protect whitelisted accounts, and act only on the accounts you choose.', 'organize a local whitelist, and export your results.')
s = s.replace('document.title="InstagramUnfollowers"', 'document.title="Instagram Unfollowers · Read only"')

# Update the surviving text so the interface never promises account-changing actions.
copy_edits = {
    "launchDescription": [
        "Scan the accounts you follow, search and filter the results, and organize a local whitelist.",
        "Escanea las cuentas que sigues, busca y filtra resultados y organiza una lista blanca local."
    ],
    "partialScanWarning": [
        "Incomplete scan: some accounts could not be checked. This list may be missing non-followers.",
        "Escaneo incompleto: algunas cuentas no se pudieron revisar. Pueden faltar cuentas que no te siguen."
    ],
    "whitelistDescription": ["Manage accounts in your local whitelist.", "Administra cuentas en tu lista blanca local."],
    "scanInProgressWait": ["Scan in progress: wait until it finishes.", "Escaneo en progreso: espera a que termine."],
    "selectAtLeastOneUser": ["Select at least one account.", "Selecciona al menos una cuenta."],
    "settingsWarning1": ["Lower delays can increase the chance of Instagram limiting automated reads.", "Los intervalos más cortos pueden aumentar los límites de lectura de Instagram."],
    "settingsWarning2": ["Read-only requests can still be rate-limited.", "Las solicitudes de solo lectura también pueden tener límites."],
    "failedToUnfollow": ["", ""]
}
for key, values in copy_edits.items():
    matches = list(re.finditer(r'(?<=[{,])' + key + r':"(?:\\.|[^"\\])*"', s))
    for match, value in reversed(list(zip(matches, values))):
        import json
        s = s[:match.start()] + key + ':' + json.dumps(value, ensure_ascii=False) + s[match.end():]

avatar = '''function localAvatar(username){var initial=String(username||"?").charAt(0).toUpperCase();if(!/^[A-Z0-9]$/.test(initial))initial="?";return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#312e81"/><text x="40" y="50" text-anchor="middle" font-family="sans-serif" font-size="32" fill="white">'+initial+'</text></svg>')}'''
replace('(()=>{"use strict";', '(()=>{"use strict";' + avatar)

header = '''/*! Instagram Unfollowers Read Only — derived from the user-provided upstream bundle.
 * Original project: https://github.com/davidarroyo1234/InstagramUnfollowers
 * Copyright (c) 2023 David Arroyo. MIT License; see LICENSE and THIRD_PARTY_NOTICES.md.
 * Read-only patch: authenticated GET reads only. No mutation handlers or remote avatars.
 */\n'''
for prohibited in ['method:"POST"', '/unfollow/', 'unfollowUserUrlGenerator', 'dicebear', 'csrftoken', 'status:"unfollowing"', 'className:"unfollow"']:
    assert prohibited not in s, prohibited
assert s.count('fetch(') == 1
out = Path(__file__).resolve().parents[1] / 'assets/scanner.js'
out.write_text(header + s + '\n')
print(f'Patched {len(source)} characters to {len(s)}; removed {removed} stale translations.')
