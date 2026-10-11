# Security scope

The distributed scanner removes account mutations from the supplied bundle. Its only fetch call explicitly uses GET and only generates `https://www.instagram.com/api/v1/friendships/{numeric-account-id}/followers/` or `/following/` URLs. Redirects are rejected. It sends no request body and does not read the CSRF cookie.

The landing page makes a separate same-origin GET to load the scanner **as text**. It never evaluates that text. Its Content Security Policy restricts scripts, styles, and connections to its own origin, and it contains no analytics or third-party fonts.

Displayed avatars use local SVG data URIs; imported profile-picture URLs are not loaded. Avatar text is limited to a single ASCII letter, digit, or fallback character. CSV text fields are quoted and formula-like values are prefixed before export. Instagram profile links open only when the user clicks them.

The account ID cookie is read, and the browser attaches its existing cookies to the same-origin reader requests. Account-scoped results, whitelist, and preferences are saved in Instagram's localStorage. Logout does not necessarily delete localStorage. Exports may contain usernames, names, IDs, and original profile-picture URL strings.

## Verified

Automated tests use mocked network responses and a mocked rendering layer. They cover GET-only reads, endpoint validation, API error handling, pagination and follower comparison, original filters/search/whitelist behavior, local avatars, exports, and absence of mutation controls.

## Not guaranteed

There was no live Instagram scan or browser visual QA. Static inspection and these tests do not establish universal safety or current Instagram compatibility. Internal APIs can change; Instagram can limit automated reads or challenge the session. Results are a snapshot of the successfully retrieved lists. Incomplete scans are explicitly labeled and not cached as complete.

Any console script runs with the authority of the page into which it is pasted. Inspect source before running it. A modified copy, compromised host, browser extension, or Instagram's own scripts is outside this bundle's tested scope. The landing page's CSP does not transfer to Instagram's origin.
