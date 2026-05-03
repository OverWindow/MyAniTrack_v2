# Warm Amber Design System

## 1. Visual Theme & Atmosphere

This design system is a **warm, soft, friendly amber-first interface** built around the feeling of late-afternoon sunlight, cream paper, soft café lighting, and approachable product cards. The visual mood should feel modern and clean, but not cold. Instead of relying on a strong green flagship identity, the system uses amber as the emotional center: energetic enough for calls-to-action, but softened with cream surfaces so it does not feel aggressive.

The main point color is **Amber Point** (`#f59e0b`). It can be slightly adjusted per state, with deeper amber for hover and richer burnt-orange for emphasis. The soft point background is **Amber Soft** (`#fef3c7`), used for highlighted cards, badges, small empty states, and warm section washes. The page should not become fully orange. Amber works best as a focused action and emphasis color, while the canvas stays warm cream, ivory, white, and soft beige.

The overall atmosphere should be: **minimal, warm, rounded, lightweight, friendly, and slightly playful**. Think clean personal product site, anime/community service, AI assistant, recommendation app, or cozy portfolio — not luxury, not corporate banking, not neon startup.

**Key Characteristics:**

- Amber-centered accent system based on `#f59e0b` and `#fef3c7`
- Warm cream page canvas instead of cold gray or pure white
- Rounded cards and full-pill buttons for a soft, approachable feel
- Amber used for primary actions, selected states, highlights, badges, and small illustrations
- Dark text remains neutral and readable, never orange-heavy for long body copy
- Shadows are soft and low-alpha, creating gentle lift instead of heavy depth
- Layout uses generous whitespace, especially around cards and hero sections
- UI should feel sunny, cozy, and modern, with enough contrast for real product use

**Color-block page rhythm:** Warm cream hero → White or ivory content cards → Amber-soft highlight section → White utility area → Dark warm footer with amber accents.

---

## 2. Color Palette & Roles

### Core Brand / Point Colors

- **Point Color / Amber Point** (`#f59e0b`): Main action color. Use for primary buttons, selected tabs, active icons, important badges, small link hovers, and high-value CTA moments.
- **Point Hover / Deep Amber** (`#d97706`): Hover and active state for amber buttons. Also useful for stronger text emphasis when `#f59e0b` is too bright on a light background.
- **Point Pressed / Burnt Amber** (`#b45309`): Pressed states, active navigation underline, strong warning-like emphasis, or small icon emphasis.
- **Point Border / Golden Amber** (`#fbbf24`): Borders, rings, dividers inside highlighted cards, selected-state outlines, and decorative strokes.
- **Point Soft** (`#fef3c7`): Soft amber background for highlight cards, badges, empty states, callout boxes, and AI recommendation blocks.
- **Point Soft Strong** (`#fde68a`): Hover background for warm cards, selected list rows, and slightly stronger highlight areas.
- **Point Softest** (`#fffbeb`): Very light page wash, hero background, or large section background when `#fef3c7` feels too yellow.

### Surface & Background

- **Page Canvas / Warm Cream** (`#fff7ed`): Primary page background. Use instead of pure white when the full page needs warmth.
- **Ivory Surface** (`#fffbf5`): Secondary section surface and large containers.
- **White** (`#ffffff`): Main card, modal, input, and dropdown surface.
- **Soft Beige** (`#f5efe6`): Quiet section divider, footer upper band, or alternate background.
- **Warm Gray Surface** (`#fafaf9`): Neutral utility area when amber would be visually too much.

### Text Colors

- **Text Primary** (`#1c1917`): Main body and heading text. Warm near-black, better than cold black.
- **Text Secondary** (`#57534e`): Paragraph copy, metadata, helper text.
- **Text Muted** (`#78716c`): Captions, timestamps, disabled-ish secondary labels.
- **Text Inverse** (`#ffffff`): Text on dark surfaces or filled amber buttons.
- **Text on Soft Amber** (`#78350f`): Strong readable text for `#fef3c7` or `#fffbeb` backgrounds.

### Dark Surfaces

- **Dark Espresso** (`#292524`): Footer background, dark hero variant, command palette style surfaces.
- **Dark Cocoa** (`#1c1917`): Highest-contrast dark surface.
- **Dark Warm Border** (`#44403c`): Border on dark surfaces.

### Semantic Colors

- **Success** (`#16a34a`): Success state, completed status, positive feedback.
- **Success Soft** (`#dcfce7`): Success background.
- **Error** (`#dc2626`): Error and destructive state.
- **Error Soft** (`#fee2e2`): Error background.
- **Info** (`#2563eb`): Informational state when amber would be ambiguous.
- **Info Soft** (`#dbeafe`): Info background.

### Recommended CSS Tokens

```css
:root {
  --point-color: #f59e0b;
  --point-hover: #d97706;
  --point-pressed: #b45309;
  --point-border: #fbbf24;
  --point-soft: #fef3c7;
  --point-soft-strong: #fde68a;
  --point-softest: #fffbeb;

  --bg-page: #fff7ed;
  --bg-ivory: #fffbf5;
  --bg-card: #ffffff;
  --bg-soft-beige: #f5efe6;
  --bg-neutral: #fafaf9;

  --text-primary: #1c1917;
  --text-secondary: #57534e;
  --text-muted: #78716c;
  --text-inverse: #ffffff;
  --text-on-point-soft: #78350f;

  --dark-espresso: #292524;
  --dark-cocoa: #1c1917;
  --dark-border: #44403c;

  --success: #16a34a;
  --success-soft: #dcfce7;
  --error: #dc2626;
  --error-soft: #fee2e2;
  --info: #2563eb;
  --info-soft: #dbeafe;
}
```

### Color Usage Rules

- Use `#f59e0b` for the most important action on a screen.
- Use `#d97706` for hover, active, and high-contrast amber text.
- Use `#fef3c7` and `#fffbeb` for soft highlight areas.
- Do not use amber for every button, every heading, and every icon at once.
- Long body text should stay `#1c1917` or `#57534e`, not amber.
- Use amber as a signal: “recommended,” “selected,” “important,” “start,” “AI pick,” “hot,” or “continue.”

---

## 3. Typography Rules

### Font Family

- **Primary:** `Inter, Manrope, Pretendard, "Noto Sans KR", system-ui, sans-serif`
- **Korean-friendly primary:** `Pretendard, "Noto Sans KR", Inter, system-ui, sans-serif`
- **Optional soft display:** `Manrope, Inter, Pretendard, sans-serif`
- **Optional playful accent:** `Nunito Sans, Pretendard, sans-serif`

The type should feel clean and readable, with a small amount of warmth. Avoid overly mechanical fonts. Pretendard works especially well for Korean UI because it stays modern while remaining highly legible.

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| Display | 48–64px | 700–800 | 1.1 | -0.03em | Landing hero, major product statement |
| Hero | 36–44px | 700 | 1.15 | -0.025em | Page hero heading |
| H1 | 28–34px | 700 | 1.2 | -0.02em | Screen title |
| H2 | 22–26px | 650–700 | 1.25 | -0.015em | Section title |
| H3 | 18–20px | 650 | 1.35 | -0.01em | Card title |
| Body Large | 17–19px | 400–500 | 1.65 | -0.005em | Hero intro, important paragraph |
| Body | 15–16px | 400 | 1.55 | 0 | Default copy |
| Small | 13–14px | 400–600 | 1.45 | 0 | Metadata, button, labels |
| Micro | 12px | 500–600 | 1.35 | 0.02em | Badges, captions, small tags |

### Principles

- Headings should be bold and compact, but not overly sharp.
- Body text should use warm near-black rather than pure black.
- Amber text should mostly be used at small sizes with strong contrast (`#d97706` or `#78350f`).
- Buttons should use 14–16px, weight 600–700.
- Korean UI should avoid too much negative letter-spacing in long text.

---

## 4. Component Stylings

### Buttons

#### 1. Primary Amber Filled

- Background: `#f59e0b`
- Hover: `#d97706`
- Pressed: `#b45309`
- Text: `#ffffff`
- Border: `1px solid #f59e0b`
- Radius: `999px` or `50px`
- Padding: `10px 18px` for normal buttons, `14px 24px` for hero CTAs
- Font: 14–16px, weight 700
- Active state: `transform: scale(0.97)`
- Transition: `all 0.18s ease`

Use for the single most important action on a screen: “Start,” “Create,” “Analyze,” “Recommend,” “Continue,” “Save.”

#### 2. Amber Soft Button

- Background: `#fef3c7`
- Hover: `#fde68a`
- Text: `#78350f`
- Border: `1px solid #fbbf24`
- Radius: `999px`
- Padding: `9px 16px`
- Use for secondary positive actions or warm filters.

#### 3. Neutral Outlined Button

- Background: transparent or `#ffffff`
- Text: `#1c1917`
- Border: `1px solid #d6d3d1`
- Hover background: `#fafaf9`
- Radius: `999px`
- Use for cancel, back, filter, and lower-priority actions.

#### 4. Dark Button

- Background: `#1c1917`
- Text: `#ffffff`
- Hover: `#292524`
- Border: `1px solid #1c1917`
- Radius: `999px`
- Use when amber CTA would be too visually repetitive.

#### 5. Floating Action Button

- Size: `56px`
- Background: `#f59e0b`
- Hover: `#d97706`
- Icon: `#ffffff`
- Radius: `50%`
- Shadow: `0 8px 24px rgba(245, 158, 11, 0.28), 0 2px 8px rgba(0,0,0,0.12)`
- Active: `scale(0.95)`
- Use for chat, create, AI assistant, or quick add.

### Cards & Containers

#### Default Card

- Background: `#ffffff`
- Radius: `18px`
- Border: `1px solid rgba(120, 113, 108, 0.16)`
- Shadow: `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(28,25,23,0.06)`
- Padding: `20px–28px`

#### Highlight Card

- Background: `#fffbeb` or `#fef3c7`
- Border: `1px solid #fbbf24`
- Text: `#78350f`
- Shadow: `0 8px 24px rgba(245, 158, 11, 0.12)`
- Use for AI picks, recommendations, warnings that are not errors, onboarding tips, empty states.

#### Feature Card

- Background: `linear-gradient` should generally be avoided, but a very subtle top wash is acceptable if needed.
- Preferred: solid `#ffffff` card with amber icon circle.
- Icon circle: `#fef3c7` background, `#d97706` icon.
- Radius: `20px`.

#### Modal

- Background: `#ffffff`
- Radius: `24px`
- Padding: `28px`
- Shadow: `0 24px 80px rgba(28,25,23,0.22)`
- Overlay: `rgba(28,25,23,0.36)`

### Badges & Tags

#### Point Badge

- Background: `#fef3c7`
- Text: `#92400e` or `#78350f`
- Border: `1px solid #fbbf24`
- Radius: `999px`
- Padding: `4px 10px`
- Font: 12–13px, weight 700

Use labels like “AI Pick,” “HOT,” “추천,” “New,” “Popular,” “Beta.”

#### Neutral Badge

- Background: `#f5f5f4`
- Text: `#57534e`
- Border: `1px solid #e7e5e4`

### Inputs & Forms

#### Text Input

- Background: `#ffffff`
- Border: `1px solid #d6d3d1`
- Focus border: `#f59e0b`
- Focus ring: `0 0 0 4px rgba(245, 158, 11, 0.18)`
- Radius: `14px`
- Padding: `12px 14px`
- Label: `#57534e`, 13–14px, weight 600
- Placeholder: `#a8a29e`

#### Search Bar

- Background: `#ffffff`
- Border: `1px solid rgba(120,113,108,0.2)`
- Radius: `999px`
- Icon: `#a8a29e`
- Focus ring: amber soft ring

#### Checkbox / Radio

- Selected fill: `#f59e0b`
- Selected border: `#d97706`
- Focus ring: `rgba(245, 158, 11, 0.22)`

### Navigation

#### Top Nav

- Background: `rgba(255, 255, 255, 0.86)` with backdrop blur if supported
- Border bottom: `1px solid rgba(120,113,108,0.14)`
- Height: `64px–80px`
- Logo text: `#1c1917`, weight 800
- Active link: `#d97706`
- Hover link: `#f59e0b`
- CTA button: amber filled or dark filled depending on screen density

#### Mobile Nav

- Use white or ivory drawer.
- Active item gets `#fef3c7` background and `#78350f` text.
- Keep tap targets at least `44px` tall.

### Tabs

- Container background: `#f5efe6` or `#fafaf9`
- Active tab: `#ffffff` with amber text and soft shadow
- Active underline alternative: `2px solid #f59e0b`
- Radius: `999px` for segmented tabs

### Toasts

#### Success Toast

- Background: `#ffffff`
- Left accent: `#16a34a`
- Icon: success green

#### Warning / Recommendation Toast

- Background: `#fffbeb`
- Border: `1px solid #fbbf24`
- Text: `#78350f`
- Icon: `#f59e0b`

#### Error Toast

- Background: `#fee2e2`
- Border: `1px solid #fca5a5`
- Text: `#7f1d1d`

---

## 5. Layout Principles

### Spacing System

| Token | Value | Typical Use |
|------|-------|-------------|
| `--space-1` | 4px | Tiny gap, icon/text gap |
| `--space-2` | 8px | Small gap, compact padding |
| `--space-3` | 12px | Form gap, card inner grouping |
| `--space-4` | 16px | Default gap, mobile gutter |
| `--space-5` | 24px | Card padding, section gap |
| `--space-6` | 32px | Large card padding, hero inner gap |
| `--space-7` | 48px | Section padding |
| `--space-8` | 64px | Large section padding |
| `--space-9` | 96px | Hero vertical whitespace |

### Container Width

- Small content: `640px`
- Main content: `960px–1120px`
- Wide content: `1280px`
- Page gutter: `16px` mobile, `24px` tablet, `40px` desktop

### Grid

- Cards: 1 column mobile, 2 columns tablet, 3 columns desktop
- Feature sections: stacked mobile, 40/60 or 50/50 split desktop
- Recommendation lists: use cards or soft rows with amber selected states

### Whitespace Philosophy

Whitespace should make the UI feel calm and premium. Amber is already energetic, so the layout should balance it with enough empty space. Avoid dense orange-heavy blocks.

---

## 6. Depth & Elevation

| Level | Shadow | Use |
|------|--------|-----|
| Flat | none + border | Inputs, simple containers |
| Card | `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(28,25,23,0.06)` | Default cards |
| Highlight | `0 8px 24px rgba(245,158,11,0.12)` | Amber highlight cards |
| Floating | `0 8px 24px rgba(245,158,11,0.28), 0 2px 8px rgba(0,0,0,0.12)` | Floating CTA |
| Modal | `0 24px 80px rgba(28,25,23,0.22)` | Dialogs, command palette |

### Shadow Philosophy

Use soft shadows with warm undertones. Avoid harsh black shadows. Amber components may use amber-tinted shadows, but only on important interactive elements.

---

## 7. Motion & Interaction

### Motion Tokens

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --duration-fast: 120ms;
  --duration-normal: 180ms;
  --duration-slow: 280ms;
}
```

### Interaction Rules

- Buttons scale to `0.97` on press.
- Floating buttons scale to `0.95` on press.
- Cards can lift by `translateY(-2px)` on hover.
- Hover transitions should be fast and soft, around `120–180ms`.
- Avoid bouncy animations unless the product is intentionally playful.

---

## 8. Do's and Don'ts

### Do

- Use `#f59e0b` as the main action and emphasis color.
- Use `#fef3c7` for soft warm background moments.
- Keep the page background cream, ivory, or white.
- Use rounded cards, pill buttons, and soft shadows.
- Use amber for “selected,” “recommended,” “AI Pick,” and “start” states.
- Use dark warm text for readability.
- Keep the interface minimal and spacious.

### Don't

- Don't turn the entire page orange.
- Don't use amber for long paragraphs.
- Don't combine many saturated colors with amber; it should be the star accent.
- Don't use cold blue-gray backgrounds unless necessary.
- Don't use sharp square buttons.
- Don't use heavy black shadows.
- Don't make every icon amber; reserve amber icons for important signals.

---

## 9. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | < 640px | Single column, 16px gutter, full-width buttons |
| Tablet | 640–1023px | 2-column card grids, 24px gutter |
| Desktop | 1024–1439px | 3-column grids, split hero, 40px gutter |
| Wide | 1440px+ | Content caps at 1280px, more whitespace |

### Touch Targets

- Buttons should be at least `44px` tall on mobile.
- Icon buttons should be at least `40px`, preferably `44px`.
- Floating action button should be `56px`.
- Inputs should use at least `12px 14px` padding.

### Mobile Strategy

- Stack feature sections vertically.
- Keep amber CTA visible but avoid multiple amber buttons in one viewport.
- Use soft amber cards sparingly to avoid a yellow-heavy mobile screen.
- Navigation active states can use `#fef3c7` background.

---

## 10. Agent Prompt Guide

### Quick Color Reference

- Main point / CTA: `#f59e0b`
- CTA hover: `#d97706`
- CTA pressed: `#b45309`
- Soft point background: `#fef3c7`
- Strong soft point: `#fde68a`
- Light page wash: `#fffbeb`
- Page canvas: `#fff7ed`
- Card surface: `#ffffff`
- Main text: `#1c1917`
- Secondary text: `#57534e`
- Muted text: `#78716c`
- Dark footer: `#292524`

### Example Component Prompts

1. “Create a warm amber primary CTA button using `#f59e0b` background, white text, `999px` pill radius, `14px 24px` padding, 700 font weight, hover state `#d97706`, and active `scale(0.97)`.”

2. “Design a recommendation card with `#fffbeb` background, `1px solid #fbbf24` border, `20px` radius, dark warm text `#78350f`, and a small `AI Pick` badge using `#fef3c7`.”

3. “Build a clean warm landing hero on `#fff7ed` canvas, with a bold `#1c1917` headline, secondary copy `#57534e`, one amber CTA, one neutral outline button, and a white rounded preview card with soft shadow.”

4. “Create a card grid where each card is white, `18px` rounded, soft warm shadow, and uses a small amber icon circle (`#fef3c7` background, `#d97706` icon).”

5. “Create a mobile nav drawer with white background, active item `#fef3c7`, active text `#78350f`, and primary action button `#f59e0b`.”

### Iteration Guide

When refining existing screens with this system:

1. Replace cold gray backgrounds with warm cream or ivory.
2. Convert primary CTAs to amber.
3. Use amber-soft surfaces only for selected, recommended, or highlighted content.
4. Keep most cards white for balance.
5. Change harsh black text to warm near-black.
6. Increase border radius if the UI feels too rigid.
7. Reduce amber if the screen feels too yellow.

---

## 11. Known Gaps

- This system does not define a strict logo style.
- Illustration style should be chosen based on the product: flat rounded illustrations, soft 3D icons, or minimal line icons all work.
- If accessibility testing shows low contrast for amber text, use `#d97706`, `#b45309`, or `#78350f` instead of `#f59e0b`.
- For Korean-heavy interfaces, test Pretendard and Noto Sans KR spacing carefully.
