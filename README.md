# Instagram Unfollowers

**Copy → paste into Instagram’s console → automatic CSV.**

Site: **https://petrotafilaj.github.io/InstagramUnfollowers/**  
Repository: **PetroTafilaj/InstagramUnfollowers**

The script starts immediately, logs progress in the console, compares followers with following, and requests a CSV download when the scan is complete. It leaves Instagram’s page and styles intact. There is no scanner interface or Run Scan button.

## Use

1. Open the site and click **Copy code**. The animated confirmation appears only after clipboard success.
2. Sign in at **https://www.instagram.com/** and open Developer Tools → Console.
3. Paste the copied code and press **Enter**. Keep the tab open while progress is logged.
4. The CSV downloads automatically after a complete scan. Its filename includes your account ID and the date.

If clipboard permission is denied, the landing page selects the full script for manual copying. The confirmation supports Close, Got it, Escape, outside click, focus restoration and reduced motion.

Large lists can take several minutes. The scanner reads 50 users per page, waits between pages, and takes a longer rest every five pages. If Instagram limits requests or pagination fails, it stops with an explicit console error. It never presents a partial list as a complete CSV.

If the browser blocks the download, allow it or retry with `InstagramUnfollowers.exportCSV()` after the console reports completion.

## Optional console commands

```javascript
InstagramUnfollowers.results                         // Complete or partial matches in memory
InstagramUnfollowers.search('name')                  // Search username and full name
InstagramUnfollowers.filter({ includePrivate: false, includeVerified: false })
InstagramUnfollowers.filter({ includeWithoutPicture: false })
InstagramUnfollowers.setWhitelist(['username'])       // In-memory exclusion list
InstagramUnfollowers.filter({ whitelisted: true })
InstagramUnfollowers.exportCSV({ search: 'name' })    // Download filtered results
InstagramUnfollowers.exportJSON()                    // Download JSON
InstagramUnfollowers.cancel()                        // Stop the active scan
```

Account matching and deduplication use stable IDs, not mutable usernames. Whitelist entries deliberately use the usernames you supply. Whitelist/search options affect additional exports; the first automatic CSV contains all non-followers.

## Read-only scope

- One authenticated **GET** fetch call, restricted to Instagram’s follower/following endpoints for the signed-in account. Redirects are rejected.
- No unfollow controls or endpoint, account-changing requests, request body, CSRF-cookie access, remote avatars, or analytics.
- No localStorage account cache. Results and whitelist live only in the tab’s JavaScript memory.
- CSV fields are quoted; Unicode and punctuation are preserved, and formula-like text is neutralized.
- A temporary hidden anchor requests the local file download, then is removed. No visible interface is added to Instagram.

The landing page fetches the scanner **as text** and never executes it. See [SECURITY.md](SECURITY.md).

## Develop and verify

Buildless HTML/CSS/JavaScript. No installation, runtime dependencies, or build step. Requires Node.js 18+ for checks:

```bash
npm test
npm run check
```

The suite covers a complete paginated console scan, stable identity matching, automatic CSV, search/filter/whitelist and JSON export, rate limits, invalid responses, repeated cursors, account switches, cancellation, timeout, download errors, and copy-dialog success/failure/dismissal.

Network and DOM tests use mocks. No live Instagram scan or browser visual QA was performed for this revision. Instagram’s internal API can change or refuse automated reads.

## Project skills

Repository-local skills are stored in `.agents/skills/` and routed by [AGENTS.md](AGENTS.md):

- **ponytail** — adapted from DietrichGebert/ponytail; smallest complete implementation.
- **pstack** — selected principles and code-quality guidance from backnotprop/pstack, adapted to this project.
- **landing-page-design** — layout, native dialog animation, accessibility and copy-flow verification.
- **thermo-nuclear-code-quality-review** — adapted from Cursor Team Kit’s strict review rubric.

Source references and MIT notices accompany the third-party material. These are project skills, not globally installed plugins or the full pstack orchestration suite.

## GitHub Pages

In repository **Settings → Pages**, choose **Deploy from a branch → main → /(root)** and save. `index.html`, `assets/`, and `.nojekyll` are at the repository root. Pages rebuilds when `main` changes; wait for the deployment to finish before refreshing and copying the new script.

## Attribution

Inspired by [David Arroyo’s InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers), with the GET endpoint/header conventions retained. The current console scanner is a small readable replacement for the original UI bundle. The original license is retained, and skill licenses are included with their respective folders. Independent project; not affiliated with Instagram or Meta.
