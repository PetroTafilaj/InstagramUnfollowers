---
name: pstack
description: Apply selected pstack engineering principles when refactoring the InstagramUnfollowers landing page, console scanner, and verification. Use for pstack, structural simplification, experience-first design, or behavior-preserving refactors.
---

# Pstack for InstagramUnfollowers

Read AGENTS.md and the affected source before changing behavior. This is a focused project adaptation of backnotprop/pstack, not the full poteto-mode plugin or its model-routing system.

## Workflow

1. Read [experience-first](references/experience-first.md) for UI changes. Optimize the copy → console → CSV workflow. Every control must justify its presence.
2. Read [subtract-before-you-add](references/subtract-before-you-add.md) for refactors. Delete stale scanner UI, unused CSS, dead scripts and incorrect docs before adding new mechanisms.
3. Read [code-quality-review](references/code-quality-review.md) before publishing a structural change. Prefer deleting a layer to redistributing its complexity.
4. Keep landing-page behavior in assets/site.js, presentation in assets/site.css, and Instagram reads/export in assets/scanner.js. Never execute the scanner on the landing page.
5. Validate external API responses once at the read boundary. Keep matching and export direct. Separate numeric IDs from usernames; their strings can overlap.
6. Test the way the user invokes the script: evaluate the complete console source, supply realistic paginated responses, and assert CSV downloads and failure behavior. Test clipboard success/failure and confirmation dismissal.
7. Run npm test and npm run check. Confirm the exact committed source matches what the Copy button supplies.
8. State the real verification limit. Mocked tests do not prove current Instagram compatibility or visual correctness in a browser.

Do not introduce a framework, server, analytics, build pipeline, remote fonts, live-account test, or generalized design system for this page. Do not claim a view was visually verified when browser QA was unavailable.

Source: https://github.com/backnotprop/pstack. Selected files from upstream tree 3a604672c46cd8187d2b19980eae0a34f9f91138. Retain LICENSE with the copied references.
