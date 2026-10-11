---
name: landing-page-design
description: Design and refactor the InstagramUnfollowers static landing page and its copy-success interaction. Use for landing-page UI, responsive layout, typography, copy feedback, animation, accessibility, and visual refinement.
---

# Landing Page Design

Read AGENTS.md, index.html, assets/site.css and assets/site.js. Keep all visible interface on the landing page. Never add an Instagram scanner screen.

## Primary experience

Lead with one headline, a concise explanation and a prominent Copy code button. Follow with three steps: copy the script, open Instagram's console, paste and press Enter. Explain that the scan starts automatically and downloads a CSV when complete.

Keep the established charcoal background, lime action color and restrained purple accents. Use a readable system sans-serif, a clear type hierarchy and consistent spacing. Avoid decorative cards that do not help the user perform the task. Keep the code-inspection area secondary.

## Copy behavior

- Load scanner source as text from the same origin. Enable Copy only after a successful load.
- Use native Clipboard API. Announce success only after writeText resolves.
- Use one native dialog for confirmation; animate its entrance, backdrop, checkmark stroke and exit. Keep movement subtle and brief.
- Support Close, Got it, Escape and outside click. Restore focus to Copy after dismissal.
- Keep the code selectable if clipboard permission fails; do not display a success dialog on failure.
- Respect prefers-reduced-motion in CSS and exit timing. Preserve readable final states with all animation disabled.
- Keep keyboard focus visible, label the dialog, and use a polite live region for status.

## Refactoring and verification

Edit canonical CSS rules instead of appending layers of overriding declarations. Remove selectors for deleted sections. Keep JavaScript state local; avoid an animation library for a single dialog.

Check desktop and narrow layouts if an approved browser surface is available. Check button states, text wrapping, horizontal overflow, contrast, focus order and dialog dismissal. Otherwise run behavioral tests, inspect CSS breakpoints and report that visual QA was not performed.

Run npm test and npm run check. Keep content honest: no promise that automated reads are universally safe, no claim that a download succeeded when the browser only received the request.
