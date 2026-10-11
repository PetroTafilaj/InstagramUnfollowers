# Instagram Unfollowers · Read only

A static GitHub Pages site that lets you **copy a read-only Instagram follower checker**, run it in your own Instagram tab, and search, filter, and export accounts that do not follow you back.

Target repository: **PetroTafilaj/InstagramUnfollowers**  
Expected Pages URL after activation: **https://petrotafilaj.github.io/InstagramUnfollowers/**

This is a modified version of the supplied InstagramUnfollowers bundle, originally based on [David Arroyo's project](https://github.com/davidarroyo1234/InstagramUnfollowers). The original project is MIT licensed. This project is independent of Instagram and Meta.

## Changes

- Removed the unfollow button, account mutation effect, mutation URL generator, history component, and mutation timing controls.
- The scanner contains **one fetch call**, explicitly using **GET**, directed only to Instagram's follower/following API. No request body or CSRF cookie handling.
- All displayed avatars are generated locally as SVG data URIs, including imported and cached users. No DiceBear requests or remote image requests.
- Kept the original search by username/full name, verified/private/missing-photo filters, sorting and pagination, pause/resume, and account selection.
- Kept local whitelist management, whitelist import/export, pasted usernames, clipboard copy, JSON export, and CSV export.
- Kept English/Spanish switching and scan timing preferences.
- Cached scans and preferences are separate from the original tool and keyed to the active Instagram account.
- Incomplete scans remain labeled and are not cached as completed scans.
- CSV export now handles Unicode, commas, quotes, line breaks, and `#`, and neutralizes spreadsheet formulas in text fields.

## Publish on GitHub Pages

1. While signed into **PetroTafilaj**, create a **public** repository named **InstagramUnfollowers**. Public repositories support GitHub Pages on GitHub Free.
2. Upload this folder's **contents** at the repository root. `index.html`, `assets/`, and `.nojekyll` must be at the root, not inside another `InstagramUnfollowers/` folder. The project has no installation or build step.
3. Open **Settings → Pages → Build and deployment**.
4. Choose **Deploy from a branch**, then **main** and **/(root)**, and save.
5. Wait for GitHub's Pages deployment to finish, then open the URL GitHub shows. The intended URL is `https://petrotafilaj.github.io/InstagramUnfollowers/`.

[GitHub's publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

If the repository already exists, use its default branch and preserve unrelated files. GitHub Pages requires the repository owner or appropriate repository administration access to enable it.

## Use

1. Open the published site and click **Copy code**. There is no download requirement.
2. Open **https://www.instagram.com/** and sign into your account.
3. Open your browser's Developer Tools → Console, inspect the copied code, paste it, and press Enter.
4. Start the scan. The script uses the existing signed-in browser session to read followers and following, then compares them locally.
5. Search or filter the results. **Copy list**, **JSON**, and **CSV** operate on the currently displayed filter/search/whitelist tab.
6. Refresh the Instagram tab to return to Instagram's normal interface.

The landing page loads the scanner as text and copies it; it never executes the Instagram bundle. Clipboard permission failure selects the code for manual copying. Keep the scanner file on the same origin as the landing page.

## Local checks

Requires Node.js 18+ and no third-party packages:

```bash
npm test
npm run check
```

Tests cover network method/destination, errors, follower identity matching, a full paginated scan using mocked responses, filtering/search, pagination, local avatars, exports, whitelist/account storage isolation, and removal of the mutation controls. UI checks exercise the original components through a mocked rendering layer.

The test suite does **not** log into Instagram or establish that its current internal API accepts these requests. No live Instagram scan or browser visual QA was performed for this release.

## Patch provenance

`assets/scanner.js` is the finished runnable bundle. `scripts/patch-bundle.py` records the targeted edits to the exact uploaded original. It refuses an input with an unexpected SHA-256. The original bundle with account mutation functionality is intentionally not shipped.

To reproduce from your original attachment:

```bash
python3 scripts/patch-bundle.py /absolute/path/to/original-bundle.txt
npm test
npm run check
```

Do not regenerate from a changed upstream bundle without reviewing and updating the patches and tests.

## Data and limits

The script reads the `ds_user_id` account-ID cookie to address the logged-in account. It does not read passwords or CSRF cookies. Cookies managed by the browser accompany the same-origin GET requests. It stores scan results, the whitelist, language, and preferences in localStorage on **Instagram's origin**, not on this Pages website. JSON/CSV exports are generated in the browser. See [SECURITY.md](SECURITY.md) for scope and limitations.

Instagram's API is undocumented for this usage. Rate limits, challenges, API changes, and incomplete pagination can interrupt scans. GET-only behavior does not guarantee that Instagram will allow automated reads. Logging out afterward does not undo prior activity or clear localStorage.

The bundled localhost preview uses upstream sample accounts; it is a demo, not an Instagram scan. Production usage must run in the `www.instagram.com` tab.
