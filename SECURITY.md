# Security scope

The console scanner contains one explicit GET fetch call. It only constructs HTTPS follower/following URLs under `www.instagram.com/api/v1/friendships/{signed-in-account-ID}/`. Redirects are rejected. It sends no request body, reads no CSRF cookie or password, and contains no account-mutation endpoint.

The browser attaches its signed-in cookies to same-origin reader requests. The script reads only the `ds_user_id` account-ID cookie and checks that it has not changed during the scan. It keeps results in memory without persisting them to localStorage or forwarding them to a server. No avatars are loaded.

The scanner does not replace Instagram’s page or inject visible UI. File exports use Blob URLs and a temporary hidden anchor removed after the request. A CSV download blocked silently by the browser cannot be confirmed programmatically; console messages say the download was requested. Synchronous export errors preserve complete results and provide retry instructions.

The landing page fetches the scanner as text, never evaluates it, and only reports copying after Clipboard API success. Its Content Security Policy restricts scripts, styles and connections to its own origin. Copy confirmation uses a native dialog with focus restoration, keyboard dismissal and reduced motion.

## Verification and limits

Tests use mocked API responses and DOM/clipboard behavior. They cover pagination, ID-based comparison, GET-only requests, exports, invalid responses, rate limiting, account switches, duplicate launches, cancellation, timeouts and copy/download failures.

No live Instagram scan or browser visual QA was performed for this revision. Instagram can change its internal API, limit automated reads or challenge the session. Paginating two changing lists cannot produce an atomic snapshot of an account’s relationships. The scanner marks failed scans incomplete and does not export them as complete results.

Any console script executes with the authority of the page into which it is pasted. Inspect the source before running it. A modified copy, compromised host, browser extensions and Instagram’s own scripts are outside the tested scope. The landing page’s CSP does not transfer to Instagram. Logging out afterward does not undo prior activity.
