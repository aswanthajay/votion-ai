# Design Language (Void Precision — Compact)

Match the level of finish of the best product sites shipping in 2026 (Vercel, Linear, Resend, Clerk).

## 1. Core Principles
- **White Canvas by Default:** `--color-canvas` and body background = `#ffffff` unless the user explicitly requested another base (cream, dark, gray).
- **Borderless Modern Chrome:** Continuous surface with depth from typography scale, negative space, subtle `bg-soft` fills, and gradient light. Do NOT wrap sections, cards, mocks, or nav in heavy borders or card grids.
- **Monumental Artifact in Hero:** The product must dominate the first viewport: a full-width app mock bleeding below the fold, an inbox UI, an iconic object, a split mock, or a photograph. Size artifacts to dominate (18–24rem+).
- **Single Lighting Accent:** Light is material, not wallpaper. Exactly ONE subtle gradient bloom in the hero backdrop (`radial-gradient` with 10–18% tint). Never repeat glow blobbies across every section below the fold.
- **Typographic Conviction at Scale:** Display H1 at `clamp(3rem, 6vw, 5.5rem)` (tight leading `leading-[0.98]`, tight tracking, max 2 lines). Quiet deck (18px text-fg-muted), meta whispers (12–13px).
- **Complete Page Architecture:** Header + 5–8 purposeful content sections + Footer in the first build. Never ship stub pages or empty canvas.

## 2. Page Structure & Components
- **Header:** Wordmark + 4–6 destinations + one primary CTA. Sticky `backdrop-blur-md bg-white/80` borderless.
- **Hero:** Assigned recipe from `visual_identity` (Showcase, Monument, or Split) with display H1, deck, primary CTA button, and dominant product artifact.
- **Sections:** Proof rail (stats/logos), Feature Bento, Alternating Feature Stories (text beside mock), Deep-dive mock/code tabs, Testimonial wall, Pricing tiers, FAQ accordion, CTA band, and multi-column Footer.
- **Components:** Put each section in `src/components/` (e.g. `Hero.jsx`, `FeatureBento.jsx`, `Pricing.jsx`, `Footer.jsx`).
- **Wire in App:** Overwrite `src/App.jsx` immediately so Preview renders the real product.

## 3. Tailwind CSS v4 (`src/index.css`)
```css
@import "tailwindcss";

@theme {
  --color-canvas: #ffffff;
  --color-surface: #ffffff;
  --color-soft: #f8fafc;
  --color-fg: #0f172a;
  --color-fg-muted: #64748b;
  --color-line: #e2e8f0;
  --color-accent: #7c3aed;
  --font-sans: 'Inter', sans-serif;
  --font-display: 'Gabarito', sans-serif;
}
```
Use project's assigned `visual_identity` or user-stated colors/fonts to populate `@theme`.

## 4. Write Rules
- Always emit the FULL, balanced file content in `write_file` (every tag, brace, and string closed).
- Export alignment: every component must provide both named and default exports (`export function Hero() { ... } export default Hero;`).
- Multi-file delivery: write files decisively; runtime will continue turns until the site is complete.
- Protected Entry File: NEVER overwrite or replace `index.html` with static HTML. `index.html` is the managed React SPA shell with `<div id="root"></div>` and `<script type="module" src="/src/main.jsx"></script>`. All UI layout, pages, and components live exclusively in `src/App.jsx`, `src/components/*`, and `src/index.css`.
