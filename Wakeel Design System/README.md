# Wakeel Design System

A design system for **Wakeel**, a legal operations product demo built by Fambzzhh Pvt Ltd for the Islamabad + Rawalpindi legal market. This system packages every color, type token, component, and UI-kit recreation needed to produce on-brand Wakeel artifacts — production screens, stakeholder decks, prototypes, marketing one-pagers, whatever.

> "Wakeel is currently a working demo of a legal operations product focused on Islamabad and Rawalpindi. It shows a lawyer's daily workflow across mobile, firm dashboard, and client view." — stakeholder framing

## Product context

Wakeel is **three connected surfaces** that share one backend:

1. **Mobile app for lawyers** (React Native / Expo) — today's hearings, case list, hearing-log upload with OCR, SMS preview, IHC last-synced visibility.
2. **Firm web dashboard** (Next.js) — overview counts, case roster, manual IHC sync, case assignment, share-link generation, admin-only demo reset.
3. **Client portal** (Next.js, public) — read-only tokenized share page showing next date, latest hearing note, and optional uploaded document preview.

Demo scope is geographically narrow on purpose: Islamabad High Court is the only **live-integrated** court. Islamabad District and Rawalpindi District/Sessions are represented through **seeded demo data**. The UI visibly labels source (`IHC Live` vs `District Demo`) so nothing is misrepresented.

### Guiding principles (from the design system PDF)

- **Clarity over cleverness** — every screen readable at a glance, next hearing visible in under 2 seconds.
- **Hierarchy through color encoding** — color carries meaning, never decoration. Primary for normal actions, accent coral for conflicts, amber for warnings.
- **Respect the profession** — trustworthy and credible. No playful illustrations, no emoji, no aggressive gradients, nothing toy-like. Lawyers are conservative users.

## Sources consulted

- `LEGALBAHI/apps/mobile/` — Expo lawyer app (`App.tsx`, `src/theme.ts`)
- `LEGALBAHI/apps/web/` — Next.js dashboard + client portal (`app/globals.css`, `app/page.tsx`, `app/dashboard/page.tsx`, `app/cases/[id]/page.tsx`, `app/share/[token]/page.tsx`)
- `LEGALBAHI/apps/api/` — Fastify API (routes, notification templates, store)
- `LEGALBAHI/packages/shared/src/index.ts` — shared palette + types
- `LEGALBAHI/Docs/Wakeel_Design_System.pdf` — v1.1, April 2026, Fambzzhh Pvt Ltd (primary spec)
- `LEGALBAHI/Docs/demo-rehearsal.md` — demo run script
- `LEGALBAHI/Docs/demo-assets/hearing-order-sample.png` — real sample of what lawyers photograph

The PDF offers five palettes (A Chambers · B Daftar · C Midnight · D Minimal Mono · E Dusk). **Palette B (Daftar)** is the recommended default and the one currently shipped in code. This design system codifies B as the canonical light mode with C as an optional dark-mode toggle.

## Index / file map

```
Wakeel-Design-System/
├── README.md                   ← you are here
├── SKILL.md                    ← Agent-Skill entry point
├── colors_and_type.css         ← canonical tokens (import this first)
├── assets/
│   ├── wakeel-wordmark.svg     ← brand wordmark (scale-brand, Source Serif)
│   ├── wakeel-mark.svg         ← balance-scale monogram
│   ├── favicon.svg
│   ├── hearing-order-sample.png← real hearing-order photo
│   ├── Wakeel_Design_System.pdf← source spec
│   └── demo-rehearsal.md       ← demo run script (source)
├── preview/                    ← cards that populate the Design System tab
│   ├── logo.html · palette-core.html · palette-semantic.html
│   ├── stage-pills.html · type-scale.html · type-specimens.html
│   ├── spacing.html · radii.html · shadows.html · motion.html
│   ├── buttons.html · badges-sources.html · case-card.html
│   ├── stat-card.html · inputs.html · hearing-timeline.html
│   └── ...
├── ui_kits/
│   ├── mobile/                 ← Expo lawyer app recreation (390×844)
│   │   ├── index.html · README.md
│   │   └── Home.jsx · Cases.jsx · CaseDetail.jsx · Login.jsx · HearingUpload.jsx · Sms.jsx · components.jsx
│   ├── web-dashboard/          ← Next.js firm dashboard recreation (1280×800)
│   │   ├── index.html · README.md
│   │   └── Dashboard.jsx · CaseRoster.jsx · CaseDetail.jsx · LoginWeb.jsx · ResetModal.jsx · components.jsx
│   └── client-portal/          ← public read-only share page (1280×800)
│       ├── index.html · README.md
│       └── SharePage.jsx · components.jsx
```

No `slides/` directory — no slide template was provided in the source material; see Caveats.

## Products represented

| Surface            | Tech                          | Viewport target | UI kit                      |
|--------------------|-------------------------------|-----------------|-----------------------------|
| Mobile lawyer app  | React Native + Expo           | 390 × 844       | `ui_kits/mobile/`           |
| Firm web dashboard | Next.js 15, RSC-compatible    | 1280 × 800      | `ui_kits/web-dashboard/`    |
| Client portal      | Next.js (same app, public)    | 1280 × 800      | `ui_kits/client-portal/`    |

---

## Content fundamentals

Wakeel's copy is **plain, operational, professional** — written the way a calm senior lawyer briefs a junior. It names systems honestly rather than dressing them up.

**Tone** — trustworthy, matter-of-fact, technically literal. Never folksy, never "excited." No exclamation points. No motivational framing. Avoid product-ey verbs ("empower," "elevate," "revolutionize").

**Voice** — third-person or direct-imperative ("Sync IHC", "Create demo case", "Reset demo"). First-person is rare and, when used, plural operational ("we"). Second-person ("your case") is reserved for the client-facing portal and SMS previews — not the lawyer surfaces.

**Casing** — Sentence case for everything: screen titles, buttons, menu items. Proper nouns are preserved: "IHC", "Islamabad High Court", "Rawalpindi District & Sessions", "W.P. 2076/2019". Never ALL CAPS except for micro eyebrows ("WAKEEL DEMO", "FIRM DASHBOARD") set in the tracked micro type token.

**Terminology** — domain-correct. Never "ticket" or "task" — it's a **case**. Never "event" — it's a **hearing**. Never "message" — it's an **SMS preview**. Stages have canonical names from `packages/shared/src/index.ts`: `filing → notice → written_statement → issues → evidence → arguments → reserved → decided`.

**Honesty labels** — every place a data source could be confused, the UI names it:
- `IHC Live` (teal badge) for real synced rows.
- `District Demo` (sand badge) for seeded data.
- `Conflict` (coral badge) for calendar overlaps.
- Sync status lines read literally: "IHC sync checked 220 live rows and matched 1 seeded case."
- `OCR: pending_config` is shown verbatim when the cloud OCR key isn't set — no smoke-and-mirrors.

**Emoji** — **no.** The PDF rules them out explicitly. Exception: the ⚖ balance-scale glyph appears as a document-level brand mark in the spec, but in-product it is rendered as SVG, not emoji.

**Unicode chars as separators** — the interpunct `·` is the canonical meta separator: `03001234567 · Admin`, `Islamabad District Court East · filing · Next date TBC`. Em dash `—` for drop-ins. Arrows `→` for stage progression.

**Examples (pulled verbatim from the codebase)**

- Eyebrow + title: *"WAKEEL DEMO / Islamabad + Rawalpindi lawyer workflow"*
- Sync toast: *"IHC sync checked 220 rows and matched 1 seeded cases."*
- Reset confirmation: *"This will reseed the demo database and remove uploaded hearing files so the walkthrough starts clean."*
- Post-hearing SMS: *"Dear {client}, your case {number} was heard today. Next date: {date}. Status: {notes}. — Wakeel demo"*
- Urdu SMS preview: *"Aap ka muqadma {number} ki tareekh {date} hai."* (romanized Urdu, with full Nastaliq rendering in production).

---

## Visual foundations

### Colors
The default palette is **Palette B "Daftar"** — slate teal `#0F6E56` + off-white canvas `#F8F7F3` + coral alert `#D85A30`. Teal communicates trust without navy's heaviness; off-white reduces eye strain over long case reviews; coral makes conflicts unmissable. Full tokens live in `colors_and_type.css`.

Case stages have semantic color mapping that is consistent across every palette (see `preview/stage-pills.html`): neutral for filing/reserved, green for notice/decided, blue for written-statement/arguments, purple for issues, amber for evidence. **Stage pills always use a light tint background with a darker-shade text color — never saturated fills.**

### Type
Plus Jakarta Sans (all UI), Source Serif 4 (wordmark + display only), JetBrains Mono (case numbers — they read as data, not copy), Noto Nastaliq Urdu (client notifications). Mobile-first scale — h1 26/32, h2 22/28, body 15/22, caption 13/18, small 11/14, micro 10/13. Micro is uppercase with 0.12em tracking — used only for eyebrows and info-grid labels.

### Spacing
4 / 8 / 12 / 16 / 20 / 24 / 32. `space-4` (16) is the default card padding; `space-5` (20) is horizontal screen padding on mobile.

### Backgrounds
Full-bleed canvas uses a subtle top-to-bottom gradient `#F8F7F3 → #F3EFE5` (warmer sand at the fold). **No images, no textures, no patterns** — the canvas is meant to recede. No hand-drawn illustrations. No gradient backgrounds behind cards or buttons. Occasional single-tone tints (`primary-light` on stat cards, `surface-muted` on inline hint panels).

### Borders & corners
0.5–1px borders in `--border` (`#E8E6E1`). Corner radii: pills 6, buttons/inputs 10, cards 14, panels 18, modals 20. The signature element is the **3px colored left-border on case cards** — primary for normal, accent for conflicts, border-color for inactive. This single stripe encodes state without extra UI chrome.

### Shadows
Three levels only:
- `--shadow-card` — `0 10px 30px rgba(15,110,86,0.05)` — subtle, teal-tinted, used on all cards.
- `--shadow-modal` — `0 22px 60px rgba(44,44,42,0.16)` — modal dialogs only.
- Focus rings are **2px solid primary**, not glows.

No inner shadows, no stacked shadows, no colored halos. Elevation is minimal on purpose.

### Transparency & blur
Modal backdrop: `rgba(44,44,42,0.42)` — warm, not pure black. **No backdrop-blur** anywhere — it reads too consumer-app for legal tech.

### Imagery vibe
Real, unprocessed, slightly imperfect. Hearing-order images are photographed inside courtrooms (low light, slight perspective skew) — the UI respects that by putting them in a bordered preview frame at 1.2 aspect ratio on mobile. No stock photography, no brand imagery, no people-shots. When a preview is unavailable the UI says so plainly ("Protected upload available" / "No hearing update has been shared yet.") rather than showing a placeholder silhouette.

### Hover & press states
- **Hover** (web): color shift only — secondary buttons darken their border to 40% primary; primary buttons shift to `--primary-dark`. No shadow growth, no lift.
- **Press**: `scale(0.98)` on buttons and tappable cards per spec. No color flash.
- **Card tap** (mobile): opacity 0.7 momentarily, then navigate.

### Animation
All transitions 200ms `ease-out`, capped at 300ms. Toasts: slide up from bottom, 2.5s display, auto-dismiss. Loading: **skeleton screens**, not spinners. Pull-to-refresh re-runs cause-list sync. No bounces, no parallax, no scroll-linked animation.

### Layout rules
Mobile tab bar fixed at bottom, 76px tall, four destinations (Home, Cases, Calendar, Alerts). Tap targets never below 44×44. Web dashboard is a two-column grid — left 320px aside (stats + quick-add), right fluid (case roster). Below 960px it collapses to one column.

### Cards
Surface white, 0.5–1px border, 14px radius, 16px padding, soft teal shadow, optional 3px left border for state. That silhouette is the visual backbone of every Wakeel surface.

---

## Iconography

Wakeel uses **Lucide** (MIT, stroke-based, 1.5px stroke, 22px size on mobile tab bar). No icon font is embedded in the codebase — icons are imported individually via `lucide-react` / `lucide-react-native`. Since the source repo imports Lucide by component name rather than shipping an SVG folder, **this design system links Lucide from CDN** (`https://unpkg.com/lucide@0.453.0/dist/umd/lucide.js`) and uses `data-lucide="..."` attributes. Documented in `preview/iconography.html`.

No emoji in product UI. No decorative SVG. Unicode `·` is the only typographic glyph used as an icon (separator). Case numbers themselves are the "icon" of case cards — bolded mono typography does the visual work.

Brand assets (`assets/wakeel-wordmark.svg`, `assets/wakeel-mark.svg`) are a simple balance-scale monogram in Source Serif — built into this design system because no canonical logo file existed in the source repo (see Caveats).

---

## Index

Root:
- `README.md` — this file
- `SKILL.md` — cross-compatible Agent Skill manifest
- `colors_and_type.css` — single import for all tokens
- `assets/` — `wakeel-mark.svg`, `wakeel-wordmark.svg`, `hearing-order-sample.png`
- `fonts/` — empty; Google Fonts are used via CSS `@import`
- `preview/` — design-system cards registered for the Design System tab

UI Kits:
- `ui_kits/mobile/` — lawyer Expo app (390×844) · login → home → case → upload → SMS preview
- `ui_kits/web/` — firm admin dashboard (1440×900) · overview, roster, sync, share modal
- `ui_kits/client/` — read-only tokenized client page (single HTML)

## How to use this system

1. Import tokens: `@import url("./colors_and_type.css");` — that's the whole color + type foundation.
2. Pull component shapes from `ui_kits/<product>/` — read `index.html` for the assembly, `.jsx` files for reusable pieces.
3. When you need an icon, use Lucide from CDN — don't draw your own SVGs.
4. Any data that could be mistaken for live data must carry a source badge. This is non-negotiable.
5. Prefer the recommended Daftar palette. Only switch if the brief explicitly calls for a variant (Chambers for senior-advocate positioning; Midnight as dark-mode pair; etc.).

---

## Caveats

- **No canonical logo file existed** in the LEGALBAHI repo. The wordmark + mark in `assets/` are a from-scratch interpretation (balance-scale glyph + Source Serif wordmark) consistent with the PDF's "respect the profession" principle. **Please review and replace if you have an official file.**
- **Fonts** are pulled from Google Fonts (Plus Jakarta Sans, Source Serif 4, JetBrains Mono, Noto Nastaliq Urdu). No local `.ttf` files were shipped in the repo. If you have licensed cuts, drop them into `fonts/` and the CSS will prefer them via the family stack.
- **No slide template was provided** — this design system therefore has no `slides/` folder. If you'd like a stakeholder deck template in Wakeel style, ask and I'll build one.
- **Icons are CDN-linked Lucide**, not vendored locally. The PDF recommends Lucide explicitly, so this matches intent, but if you want the icons packaged offline into `assets/icons/` let me know.
- Palette variants (Midnight dark-mode, Chambers, etc.) were explored but intentionally not promoted to first-class tokens — only the Daftar green/terracotta pair is committed. If a dark mode is needed, ask.
- The client portal UI kit is intentionally thin — in production it's a single read-only page, and the kit reflects that scope.

---

**Want to iterate?** Tell me what's off — a color token that needs tuning, a component you'd draw differently, a missing surface (Alerts tab, Calendar view, stakeholder deck template), or a brand asset you can share to replace my placeholder mark. The system is meant to get tighter over a few passes — let's do that.
