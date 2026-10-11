# Project contract

This repository is a buildless GitHub Pages launcher and a console-only Instagram reader.

- Keep all visible interface in index.html and assets/site.css/site.js.
- Load assets/scanner.js as text; never execute it on the landing page.
- The copied scanner starts immediately in www.instagram.com's console, logs progress there and requests an automatic CSV download after a complete scan.
- Leave the Instagram document and styles alone. A temporary hidden download anchor is permitted; no injected interface.
- Preserve one authenticated GET fetch call to Instagram follower/following endpoints. No account-changing requests, CSRF-cookie handling, remote avatars, third-party analytics or dependencies.
- Keep partial scans explicitly incomplete. Never export them as complete CSVs.
- Preserve console search/filter/whitelist and CSV/JSON export helpers. Do not add persisted account data without a user request.
- Keep native dialog copy feedback accessible: keyboard dismissal, focus return, clipboard failure selection and reduced motion.
- Run npm test and npm run check. Mocked API and DOM tests do not prove live Instagram compatibility or browser visual quality.
- Publish only the intended source changes, preserve unrelated repository content and use a non-forced update.

## Local skills

Read .agents/skills/ponytail/SKILL.md for small complete changes.
Read .agents/skills/pstack/SKILL.md for refactoring and experience-first design.
Read .agents/skills/landing-page-design/SKILL.md for visible layout and copy animation.
Read .agents/skills/thermo-nuclear-code-quality-review/SKILL.md for the final code-quality audit.

These are repository-local skills. Do not report them as globally installed plugins.
