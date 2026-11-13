# Preserve LoopMart design while unifying components

**Goal:** Restore the approved public marketplace design and the latest pre-Astryx gray-green admin workbench while retaining Astryx for every UI primitive.

**Baseline:** `docs/superpowers/specs/2026-11-13-loopmart-ui-redesign-design.md`, its final left/right prototype, and pre-migration commit `d10a79b`. The user confirmed keeping the gray-green admin theme. The Neutral visual overhaul is superseded.

**Architecture:** A shared Astryx theme foundation owns typography, controls, radii and state rules. The public blue theme and its admin gray-green descendant map the original palettes and density. Compile these themes with Astryx; do not restore legacy global CSS. Existing page composition is restored with Astryx layout components. API, auth, data, drafts, date validation and recent accessibility fixes remain functional.

- [x] Add a failing browser design-language gate for the original colors, system font, geometry and responsive navigation; retain behavioral tests.
- [x] Create and compile shared/public/admin Astryx theme definitions and one responsive hook using their named breakpoints.
- [x] Restore public header/search/subnav, card/media geometry, responsive grids, details, publish actions and full-screen mobile chat.
- [x] Restore admin sidebar/header structure, compact surfaces, metrics, tables/mobile records, details and confirmation presentation.
- [x] Restore shared form panels, layout budgets and fixed mobile actions; update consistency checks to admit only generated theme CSS.
- [x] Verify unit tests, type checks, production builds, theme freshness, visual properties and all existing browser behavior. Inspect screenshots against the original references.

The existing test-data preview stays available. No database or service configuration changes are part of this UI correction.

## Theme workflow

`src/themes/foundation.ts` supplies shared component rules and named responsive breakpoints. `loopmartWebTheme.ts` owns the original public blue theme; `loopmartAdminTheme.ts` extends it with the confirmed gray-green palette and workbench density. `npm run theme:build` uses the official Astryx compiler, and the shared provider imports the resulting production JS/CSS directly. `npm run theme:check` verifies generated artifacts. No legacy global styles or Neutral theme dependency remain.

## Verification

- `npm test`: 37 passing, including both Astryx source/theme boundary checks and currency/seat validation.
- `npm run typecheck`: root and both Next apps pass. Both production apps build; the final chat composer adjustment was rebuilt and type-checked in the public app.
- `npm run theme:check`: both compiled themes are current. Astryx doctor reports zero failures on both builds. Its two advisory warnings concern absent packaged/CLI-managed themes; this implementation uses the documented direct compiled custom-theme imports.
- `tests/browser/design_language.py`: both apps pass palette, actual painted canvas, system font, control sizes/radii, original navigation and responsive geometry checks. Screenshots were inspected against pre-migration references.
- `tests/browser/astryx_ui.py`: 14 public and 17 admin routes pass in Chinese/English at 1440, 390 and 320 widths. Public design checks also cover 1200, 1199, 1024 and 768 breakpoints.
- Browser interactions cover required-field focus (including selectors and locations), exact currency and departure timezone payloads, invalid date handling, drafts, school selection/focus, 45-message chat scrolling, full mobile send labels, and admin confirmation focus/cancel/failure/retry.
- Browser regression traffic uses in-memory API/auth fixtures; it does not write to a database. Existing real-API browser scripts were updated and syntax-checked, but their database write scenarios were not run for this UI correction.
- A separate read-only visit to the running local user app shows 50 existing test listings, with no page errors or visible alerts. Local preview services remain on 3000/3004; the preview uses the existing isolated local test data, without seeding or schema changes.
- Screenshots remain in the ignored `.superpowers/e2e/astryx/` directory.
